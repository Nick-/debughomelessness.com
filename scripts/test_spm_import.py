import importlib.util
import unittest
from pathlib import Path
from types import SimpleNamespace

spec = importlib.util.spec_from_file_location('spm', Path(__file__).with_name('prepare-spm-import.py'))
spm = importlib.util.module_from_spec(spec)
spec.loader.exec_module(spm)


class SpmTests(unittest.TestCase):
    def headers(self):
        # Return headings are repeated for two cohorts. All must be selected.
        return ['State', 'Continuum of Care (CoC)', 'HUD CoC Number',
                *[label for label, _ in spm.FIELDS.values()],
                'Total Non-DV Beds on 2024 HIC ES+TH',
                'Total Non-DV HMIS Beds on 2024 HIC ES+TH',
                '2024 Bed coverage Percent on HMIS for ES-TH Combined',
                *self.returns('SO'), *self.returns('SO+ES+TH+SH+PH')]

    def returns(self, cohort):
        suffixes = ['', ' (should include the 6-month cohort)', ' (should include both the 6- and 12-month cohort)']
        return [f'Total Persons Exited ({cohort})',
                *[f'Total Persons Returns in {months} mths{suffix}' for months, suffix in zip([6, 12, 24], suffixes)],
                *[f'Percent Returns in {months} mths{suffix}' for months, suffix in zip([6, 12, 24], suffixes)]]

    def test_missing_zero_units_and_invalid_values(self):
        for value in [None, '', 'NA', '#N/A', '-']:
            self.assertIsNone(spm.number(value, 'count'))
        self.assertEqual(spm.number(0, 'percent'), 0)
        self.assertEqual(spm.number(0.125, 'percent'), 12.5)
        self.assertEqual(spm.number(62.2, 'days'), 62.2)
        for value, unit in [(-1, 'days'), (float('nan'), 'days'), (True, 'count'), (1.2, 'percent'), (1.5, 'count'), ('#REF!', 'count')]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                spm.number(value, unit)

    def test_all_cohort_and_swapped_headers(self):
        h = self.headers()
        _, columns = spm.columns(h, [None] * len(h), 2024)
        self.assertEqual(columns['spm_returns_6m'][0], h.index('Total Persons Exited (SO+ES+TH+SH+PH)') + 1)
        _, swapped = spm.columns([None] * len(h), h, 2024)
        self.assertEqual(columns, swapped)
        with self.assertRaises(ValueError):
            spm.columns(h + [h[3]], [None] * (len(h) + 1), 2024)

    def test_reporting_units_stay_separate_and_bad_cells_are_audited(self):
        h = self.headers()
        rows = [h, [None] * len(h)]
        for identifier in ['MO-604K', 'MO-604M']:
            row = ['KS', 'Kansas City source unit', identifier] + [0] * (len(h) - 3)
            row[h.index('ES-SH Avg (Days)')] = -1
            row[h.index('Total HMIS Count')] = 'NA'
            rows.append(row)
        records, missing, excluded = spm.read_year(SimpleNamespace(values=rows), 2024)
        self.assertEqual(set(records), {'MO-604K', 'MO-604M'})
        self.assertEqual(len(excluded), 2)
        self.assertEqual(missing['spm_hmis_count'], 2)
        self.assertNotIn('spm_length_es_sh_avg', records['MO-604K']['metrics'])
        self.assertEqual(records['MO-604K']['metrics']['spm_returns_6m_rate'], (0, 'percent'))
        with self.assertRaisesRegex(ValueError, 'duplicate CoC'):
            spm.read_year(SimpleNamespace(values=rows + [rows[2]]), 2024)


if __name__ == '__main__':
    unittest.main()
