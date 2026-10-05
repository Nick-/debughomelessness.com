"""Validate official HUD PIT workbooks and prepare an idempotent D1 import.

Only prepares local files. Applying SQL to D1 is a separate explicit operation.
"""
import argparse
import hashlib
import json
import math
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen

from pyxlsb import open_workbook

SOURCE_PAGE = 'https://www.huduser.gov/portal/datasets/ahar/2025-ahar-part-1-pit-estimates-of-homelessness-in-the-us.html'
SOURCE_ROOT = 'https://www.huduser.gov/portal/sites/default/files/xls/'
YEARS = range(2022, 2026)
FIELDS = {
    'pit_count': 'Overall Homeless',
    'pit_sheltered': 'Sheltered Total Homeless',
    'pit_unsheltered': 'Unsheltered Homeless',
}


def count(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0 or int(value) != value:
        raise ValueError(f'Expected a nonnegative integer count, got {value!r}')
    return int(value)


def coc_id(value):
    # HUD appends footnote "a" to the interstate MO-604 record. This is not
    # a separate CoC. Reject every other unexpected suffix rather than guessing.
    value = 'MO-604' if value == 'MO-604a' else value
    if not isinstance(value, str) or not re.fullmatch(r'[A-Z]{2}-[0-9]{3}', value):
        raise ValueError(f'Invalid CoC identifier: {value!r}')
    return value


def read_year(path, year, is_state=False):
    key = 'State' if is_state else 'CoC Number'
    with open_workbook(str(path)) as workbook, workbook.get_sheet(str(year)) as sheet:
        rows = sheet.rows()
        headers = [cell.v for cell in next(rows)]
        required = [key, *FIELDS.values()] + ([] if is_state else ['CoC Name', 'Count Types'])
        positions = {}
        for name in required:
            if headers.count(name) != 1:
                raise ValueError(f'{path.name}, {year}: missing or duplicate header {name}')
            positions[name] = headers.index(name)
        if 'CoC Category' in headers:
            positions['CoC Category'] = headers.index('CoC Category')
        records, national = {}, None
        for cells in rows:
            values = [cell.v for cell in cells]
            row = {name: values[index] if index < len(values) else None for name, index in positions.items()}
            raw_id = row[key]
            is_total = raw_id == 'Total' if is_state else row['CoC Name'] == 'Total'
            if is_total:
                if national is not None:
                    raise ValueError(f'{year}: duplicate national total')
                national = {metric: count(row[column]) for metric, column in FIELDS.items()}
                continue
            # Empty rows and explanatory footnotes have no CoC name or counts.
            if not is_state and not row['CoC Name']:
                continue
            if is_state and not (isinstance(raw_id, str) and re.fullmatch(r'[A-Z]{2}', raw_id)):
                continue
            if is_state and all(row[column] is None or (isinstance(row[column], str) and not row[column].strip()) for column in FIELDS.values()):
                # HUD leaves all PIT fields blank for territories without data.
                # Preserve absence; never manufacture zero counts.
                continue
            identifier = raw_id if is_state else coc_id(raw_id)
            if identifier in records:
                raise ValueError(f'{year}: duplicate identifier {identifier}')
            metrics = {metric: count(row[column]) for metric, column in FIELDS.items()}
            if metrics['pit_count'] != metrics['pit_sheltered'] + metrics['pit_unsheltered']:
                raise ValueError(f'{year}, {identifier}: sheltered + unsheltered does not equal total')
            records[identifier] = {'metrics': metrics, 'name': row.get('CoC Name'),
                                   'region_type': row.get('CoC Category'), 'count_type': row.get('Count Types')}
        if not records or national is None:
            raise ValueError(f'{year}: missing records or national total')
        totals = {metric: sum(r['metrics'][metric] for r in records.values()) for metric in FIELDS}
        if totals != national:
            raise ValueError(f'{year}: row sums {totals} differ from HUD totals {national}')
        return records, totals


def sql_literal(value):
    if value is None:
        return 'NULL'
    if isinstance(value, int):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def prepare(coc_path, state_path, output_dir):
    references, metrics, summaries = {}, [], []
    for year in YEARS:
        records, totals = read_year(coc_path, year)
        _, state_totals = read_year(state_path, year, is_state=True)
        if totals != state_totals:
            raise ValueError(f'{year}: CoC and state workbooks disagree')
        for identifier, row in sorted(records.items()):
            previous = references.get(identifier, {})
            references[identifier] = {'name': row['name'], 'state': 'MO, KS' if identifier == 'MO-604' else identifier[:2],
                                      'region_type': row['region_type'] or previous.get('region_type')}
            for metric, value in row['metrics'].items():
                metrics.append((identifier, metric, year, value, 'count', SOURCE_ROOT + coc_path.name))
        summaries.append({'year': year, 'cocs': len(records), **totals,
                          'sheltered_only_cocs': sum(r['count_type'].startswith('Sheltered-Only') for r in records.values())})
    imported_at = datetime.now(timezone.utc).isoformat(timespec='seconds')
    digest = hashlib.sha256(coc_path.read_bytes()).hexdigest()
    metadata = ('hud_pit', min(YEARS), max(YEARS), SOURCE_PAGE, 'May 2026', digest, imported_at, 2026, None,
                'The next annual dataset is expected to cover January 2026. HUD has not announced a publication date on its AHAR release pages.',
                'PIT estimates describe one night in January, not a current live census. HUD carries forward unsheltered estimates for some CoCs in years with sheltered-only counts. Population and Functional Zero assessments are not included in this import.')
    sql = ['-- Verified HUD 2025 AHAR PIT import. Generated by scripts/prepare-hud-import.py.']
    for identifier, row in sorted(references.items()):
        values = ', '.join(sql_literal(v) for v in (identifier, row['name'], row['state'], row['region_type']))
        sql.append('INSERT INTO continuums_of_care (coc_id, name, state, region_type) VALUES (' + values + ') '
                   'ON CONFLICT(coc_id) DO UPDATE SET name=excluded.name, state=excluded.state, '
                   'region_type=excluded.region_type, updated_at=CURRENT_TIMESTAMP;')
    for row in metrics:
        sql.append('INSERT INTO metrics (coc_id, metric_type, year, value, unit, source) VALUES (' + ', '.join(sql_literal(v) for v in row) + ') '
                   'ON CONFLICT(coc_id, metric_type, year) DO UPDATE SET value=excluded.value, unit=excluded.unit, source=excluded.source, updated_at=CURRENT_TIMESTAMP;')
    columns = ('dataset', 'first_year', 'latest_year', 'source_url', 'source_published', 'source_sha256', 'imported_at',
               'next_expected_year', 'next_release_date', 'next_release_note', 'methodology_note')
    metadata_values = ["strftime('%Y-%m-%dT%H:%M:%SZ', 'now')" if column == 'imported_at' else sql_literal(value)
                       for column, value in zip(columns, metadata)]
    sql.append('INSERT INTO data_updates (' + ', '.join(columns) + ') VALUES (' + ', '.join(metadata_values) + ') '
               'ON CONFLICT(dataset) DO UPDATE SET ' + ', '.join(f'{c}=excluded.{c}' for c in columns[1:]) + ';')
    # D1 executes file imports transactionally; do not add unsupported BEGIN/COMMIT.
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / 'hud-pit.sql').write_text('\n'.join(sql) + '\n', encoding='utf-8')
    manifest = {'source_page': SOURCE_PAGE, 'source_file': SOURCE_ROOT + coc_path.name, 'source_sha256': digest,
                'state_control_file': SOURCE_ROOT + state_path.name,
                'state_control_sha256': hashlib.sha256(state_path.read_bytes()).hexdigest(),
                'prepared_at': imported_at, 'reference_count': len(references), 'metric_count': len(metrics),
                'years': summaries, 'metadata': dict(zip(columns, metadata))}
    (output_dir / 'hud-pit-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--raw-dir', type=Path, default=Path('data/raw'))
    parser.add_argument('--output-dir', type=Path, default=Path('data/import'))
    parser.add_argument('--download', action='store_true', help='Download the verified 2025 HUD source workbooks')
    args = parser.parse_args()
    args.raw_dir.mkdir(parents=True, exist_ok=True)
    paths = [args.raw_dir / f'2007-2025-PIT-Counts-by-{level}.xlsb' for level in ['CoC', 'State']]
    if args.download:
        for path in paths:
            with urlopen(SOURCE_ROOT + path.name, timeout=120) as response:
                path.write_bytes(response.read())
    manifest = prepare(*paths, args.output_dir)
    print(json.dumps({k: manifest[k] for k in ['reference_count', 'metric_count', 'years']}, indent=2))


if __name__ == '__main__':
    main()
