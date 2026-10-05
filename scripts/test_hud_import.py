import importlib.util
import sqlite3
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('hud_import', Path(__file__).with_name('prepare-hud-import.py'))
hud = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hud)


class FakeSheet:
    def __init__(self, rows):
        self.data = rows

    def rows(self):
        return iter([[SimpleNamespace(v=value) for value in row] for row in self.data])

    def __enter__(self):
        return self

    def __exit__(self, *_):
        pass

    def get_sheet(self, _):
        return self


class ImportTests(unittest.TestCase):
    headers = ['CoC Number', 'CoC Name', 'Count Types', *hud.FIELDS.values()]

    def read(self, rows, is_state=False):
        with patch.object(hud, 'open_workbook', return_value=FakeSheet(rows)):
            return hud.read_year(Path('test.xlsb'), 2025, is_state)

    def test_footnote_total_and_blank_rows(self):
        records, total = self.read([self.headers,
            ['MO-604a', "Kansas City's CoC", 'Sheltered and Unsheltered Count', 5, 3, 2],
            ['', 'Total', '', 5, 3, 2],
            ['a explanatory footnote', None, None, None, None, None]])
        self.assertEqual(list(records), ['MO-604'])
        self.assertEqual(total['pit_count'], 5)

    def test_missing_and_bad_counts_do_not_become_zero(self):
        for value in [None, '', ' ', -1, 1.2, float('nan'), True]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                hud.count(value)
        self.assertEqual(hud.count(0.0), 0)

    def test_unexpected_identifier_suffix_rejected(self):
        with self.assertRaises(ValueError):
            hud.coc_id('CA-501a')

    def test_duplicate_normalized_identifiers_rejected(self):
        with self.assertRaisesRegex(ValueError, 'duplicate identifier'):
            self.read([self.headers,
                ['MO-604a', 'CoC', 'Sheltered and Unsheltered Count', 5, 3, 2],
                ['MO-604', 'CoC', 'Sheltered and Unsheltered Count', 5, 3, 2]])

    def test_component_and_national_mismatch_rejected(self):
        for total, sheltered, unsheltered, national in [(5, 3, 3, 5), (5, 3, 2, 6)]:
            with self.subTest(total=total, national=national), self.assertRaises(ValueError):
                self.read([self.headers,
                    ['CA-501', 'CoC', 'Sheltered and Unsheltered Count', total, sheltered, unsheltered],
                    ['', 'Total', '', national, sheltered, unsheltered]])

    def test_missing_state_data_preserved_as_absent(self):
        records, _ = self.read([['State', *hud.FIELDS.values()],
            ['AS', ' ', ' ', ' '], ['CA', 5, 3, 2], ['Total', 5, 3, 2]], True)
        self.assertNotIn('AS', records)

    def test_source_control_disagreement_prevents_output(self):
        record = {'CA-501': {'metrics': {'pit_count': 5, 'pit_sheltered': 3, 'pit_unsheltered': 2},
                            'name': 'CoC', 'region_type': None, 'count_type': 'Sheltered and Unsheltered Count'}}
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / 'output'
            with patch.object(hud, 'read_year', side_effect=[(record, {'pit_count': 5}), ({}, {'pit_count': 6})]):
                with self.assertRaisesRegex(ValueError, 'workbooks disagree'):
                    hud.prepare(Path('coc.xlsb'), Path('state.xlsb'), output)
            self.assertFalse(output.exists())

    def test_generated_sql_is_repeatable_and_preserves_missing_data(self):
        values = {'pit_count': 5, 'pit_sheltered': 3, 'pit_unsheltered': 2}
        record = {'MO-604': {'metrics': values, 'name': "Kansas City's CoC", 'region_type': 'Major City CoC',
                            'count_type': 'Sheltered and Unsheltered Count'}}
        with tempfile.TemporaryDirectory() as directory:
            raw = Path(directory) / '2007-2025-PIT-Counts-by-CoC.xlsb'
            state = Path(directory) / '2007-2025-PIT-Counts-by-State.xlsb'
            raw.write_bytes(b'coc-source'); state.write_bytes(b'state-source')
            with patch.object(hud, 'read_year', return_value=(record, values)):
                manifest = hud.prepare(raw, state, Path(directory) / 'output')
            self.assertEqual(manifest['metric_count'], 12)
            with sqlite3.connect(':memory:') as db:
                db.execute('PRAGMA foreign_keys=ON')
                root = Path(__file__).resolve().parents[1]
                for migration in sorted((root / 'database/d1/migrations').glob('*.sql')):
                    db.executescript(migration.read_text())
                sql = (Path(directory) / 'output/hud-pit.sql').read_text(encoding='utf-8')
                db.executescript(sql); db.executescript(sql)
                self.assertEqual(db.execute('SELECT COUNT(*) FROM metrics').fetchone()[0], 12)
                self.assertEqual(db.execute('SELECT name, state, population FROM continuums_of_care').fetchone(), ("Kansas City's CoC", 'MO, KS', None))
                self.assertEqual(db.execute('SELECT COUNT(*) FROM functional_zero_status').fetchone()[0], 0)
                row = db.execute('SELECT latest_year, next_release_date, imported_at FROM data_updates').fetchone()
                self.assertEqual(row[:2], (2025, None))
                self.assertTrue(row[2].endswith('Z'))
                self.assertEqual(db.execute('PRAGMA foreign_key_check').fetchall(), [])


if __name__ == '__main__':
    unittest.main()
