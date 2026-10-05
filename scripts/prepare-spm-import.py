"""Validate HUD's published FY2015–2024 SPM workbook and prepare a D1 import.

No estimates or zero-filling. Source rates are fractions, stored as percentages.
Only writes local SQL and a checksum/coverage manifest; does not apply SQL.
"""
import argparse
import hashlib
import importlib.util
import json
import math
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen

from openpyxl import load_workbook

spec = importlib.util.spec_from_file_location('hud_pit', Path(__file__).with_name('prepare-hud-import.py'))
hud = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hud)

SOURCE_URL = 'https://files.hudexchange.info/resources/documents/System-Performance-Measures-Data-Since-FY-2015.xlsx'
YEARS = range(2015, 2025)
EARLY_HEADERS = {
    'spm_so_exits': 'Total Persons Exiting Street Outreach',
    'spm_so_temporary': 'Total Persons Exited to Temporary Housing',
    'spm_so_permanent': 'Total Persons Exited to Permanent Housing',
    'spm_housing_exit_rate': 'Percent with Successful Exit',
    'spm_ph_universe': 'Total Persons Exiting PH (but not including PH-RRH)',
    'spm_ph_success': 'Total Persons Exiting PH (but not including PH-RRH) Residing in PH for 6mos or more or exiting to Permanent Housing',
    'spm_ph_retention_rate': 'Percent with Successful Retention or Exit',
}
# Exact HUD headers make schema changes fail visibly rather than shift columns.
FIELDS = {
    'spm_length_es_sh_avg': ('ES-SH Avg (Days)', 'days'),
    'spm_length_es_sh_median': ('ES-SH Median (Days)', 'days'),
    'spm_length_es_sh_th_avg': ('ES-SH-TH Avg (Days)', 'days'),
    'spm_length_es_sh_th_median': ('ES-SH-TH Median (Days)', 'days'),
    'spm_hmis_count': ('Total HMIS Count', 'count'),
    'spm_first_time_es_sh_th': ('ES-SH-TH 1st Time Homeless', 'count'),
    'spm_first_time_es_sh_th_ph': ('ES-SH-TH-PH 1st Time Homeless', 'count'),
    'spm_so_exits': ('Total Persons Exiting Street Outreach (SO)', 'count'),
    'spm_so_temporary': ('Total Persons Exited SO to Temporary Destinations', 'count'),
    'spm_so_permanent': ('Total Persons Exited SO to Permanent Destinations', 'count'),
    'spm_so_success': ('Percent with Successful SO Outcome', 'percent'),
    'spm_housing_exits': ('Total Persons Exiting ES, TH, SH, PH-RRH', 'count'),
    'spm_housing_exits_permanent': ('Total Persons Exiting ES, TH, SH, PH-RRH to Permanent Housing', 'count'),
    'spm_housing_exit_rate': ('Percent with Successful  ES, TH, SH, PH-RRH Exit', 'percent'),
    'spm_ph_universe': ('Total Persons Exiting PH or Remaining in PH at end of reporting period (measure excludes PH-RRH)', 'count'),
    'spm_ph_success': ('Total Persons Exited PH to permanent destinations or Remained in PH for 6+ mos (measure excludes PH-RRH)', 'count'),
    'spm_ph_retention_rate': ('Percent with Successful PH Retention or Exit', 'percent'),
}
for cohort in ['Stayers', 'Leavers']:
    FIELDS[f'spm_{cohort.lower()}'] = (f'Total {cohort} (persons)', 'count')
    for income, key in [('earned', 'earned'), ('non-employment cash', 'nonemployment'), ('total', 'total')]:
        FIELDS[f'spm_{cohort.lower()}_{key}_income'] = (f'Total {cohort} increased {income} income', 'count')
        FIELDS[f'spm_{cohort.lower()}_{key}_income_rate'] = (f'Percent {cohort} increased {income} income', 'percent')


def number(value, unit):
    if value is None or (isinstance(value, str) and value.strip().upper() in {'', 'NA', 'N/A', '#N/A', '-', '—'}):
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
        raise ValueError(f'Invalid {unit} value: {value!r}')
    if unit == 'count':
        return hud.count(value)
    if unit == 'percent':
        if value > 1:
            raise ValueError(f'Rate must be a fraction between 0 and 1: {value}')
        return round(value * 100, 10)
    return value


def columns(first, second, year):
    # HUD swapped its two header rows in FY2022. Choose each field by content.
    headers = [b if b is not None else a for a, b in zip(first, second)]
    def unique(label):
        if headers.count(label) != 1:
            raise ValueError(f'FY{year}: missing or duplicate header {label!r}')
        return headers.index(label)
    result = {key: (unique(EARLY_HEADERS.get(key, label) if year == 2015 else label), unit)
              for key, (label, unit) in FIELDS.items()}
    for key, label, unit in [
        ('spm_non_dv_beds', f'Total Non-DV Beds on {year} HIC ES+TH', 'count'),
        ('spm_non_dv_hmis_beds', f'Total Non-DV HMIS Beds on {year} HIC ES+TH', 'count'),
        ('spm_bed_coverage', f'{year} Bed coverage Percent on HMIS for ES-TH Combined', 'percent'),
    ]:
        result[key] = (unique(label), unit)
    # Return headers recur per project type from FY2018. Anchor to the All cohort.
    start = unique('Total Persons Exited (SO+ES+TH+SH+PH)')
    result['spm_returns_universe'] = (start, 'count')
    for offset, months in enumerate([6, 12, 24], 1):
        suffix = '' if months == 6 else (' (should include the 6-month cohort)' if months == 12 else ' (should include both the 6- and 12-month cohort)')
        if headers[start + offset] != f'Total Persons Returns in {months} mths{suffix}' or headers[start + offset + 3] != f'Percent Returns in {months} mths{suffix}':
            raise ValueError(f'FY{year}: unexpected All-cohort return columns')
        result[f'spm_returns_{months}m'] = (start + offset, 'count')
        result[f'spm_returns_{months}m_rate'] = (start + offset + 3, 'percent')
    return headers, result


def read_year(sheet, year):
    rows = iter(sheet.values)
    headers, fields = columns(next(rows), next(rows), year)
    positions = {label: headers.index(label) for label in ['HUD CoC Number', 'Continuum of Care (CoC)', 'State']}
    records, missing, excluded = {}, {key: 0 for key in fields}, []
    for row in rows:
        raw_id = row[positions['HUD CoC Number']]
        if raw_id is None and row[positions['Continuum of Care (CoC)']] is None:
            continue
        # These are separate HUD SPM reporting units, not PIT footnotes. Never
        # merge their rates/averages or attach one unit's result to all MO-604.
        identifier = raw_id if raw_id in {'MO-604K', 'MO-604M'} else hud.coc_id(raw_id)
        if identifier in records:
            raise ValueError(f'FY{year}: duplicate CoC {identifier}')
        values = {}
        for metric, (index, unit) in fields.items():
            try:
                value = number(row[index], unit)
            except ValueError as error:
                excluded.append({'coc_id': identifier, 'metric_type': metric, 'raw_value': str(row[index]), 'reason': str(error)})
                value = None
            if value is None:
                missing[metric] += 1
            else:
                values[metric] = (value, unit)
        name, state = row[positions['Continuum of Care (CoC)']], row[positions['State']]
        if not isinstance(name, str) or not name.strip() or not isinstance(state, str) or not state.strip():
            raise ValueError(f'FY{year}: missing CoC name/state for {identifier}')
        records[identifier] = {'name': name, 'state': 'MO, KS' if identifier == 'MO-604' else state, 'metrics': values}
    if not records:
        raise ValueError(f'FY{year}: no CoCs')
    return records, missing, excluded


def prepare(path, output_dir):
    references, metrics, years = {}, [], []
    workbook = load_workbook(path, read_only=True, data_only=True)
    try:
        for year in YEARS:
            records, missing, excluded = read_year(workbook[str(year)], year)
            if len(records) < 380:
                raise ValueError(f'FY{year}: unexpectedly incomplete coverage ({len(records)} CoCs)')
            references.update(records)
            year_metrics = [(identifier, metric, year, value, unit, SOURCE_URL)
                            for identifier, row in sorted(records.items())
                            for metric, (value, unit) in row['metrics'].items()]
            metrics.extend(year_metrics)
            years.append({'year': year, 'cocs': len(records), 'metrics': len(year_metrics),
                          'missing_by_metric': missing, 'excluded_invalid_cells': excluded})
    finally:
        workbook.close()
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    sql = ['-- Verified HUD SPM import. Generated by scripts/prepare-spm-import.py.']
    # Reapplying a refreshed source must not leave a formerly reported value
    # behind when its replacement is missing or invalid. Restrict deletion to
    # this exact source and the reviewed fiscal-year window.
    for year in YEARS:
        sql.append('DELETE FROM metrics WHERE source=' + hud.sql_literal(SOURCE_URL) +
                   f" AND year = {year} AND substr(metric_type, 1, 4) = 'spm_';")
    for identifier, row in sorted(references.items()):
        sql.append('INSERT INTO continuums_of_care (coc_id, name, state) VALUES (' +
                   ', '.join(hud.sql_literal(v) for v in (identifier, row['name'], row['state'])) +
                   ') ON CONFLICT(coc_id) DO NOTHING;')
    sql.extend(hud.metric_statements(metrics))
    note = ('HUD System Performance Measures cover federal fiscal years (October 1 through September 30), '
            'and people recorded in participating HMIS projects, not the January PIT population. '
            'Source fractions are stored as percentages. Missing/NA cells are omitted, never converted to zero. '
            'Returns use the All-project cohort; housing exits cover ES, TH, SH and RRH. '
            'PH retention/exit excludes RRH. Results depend on local HMIS coverage and data quality; '
            'they do not establish Functional Zero. Invalid source cells are excluded and listed in the import manifest. '
            'MO-604K and MO-604M are separate source reporting units, never merged into MO-604. '
            'The workbook does not state a publication date.')
    metadata = ('hud_spm', min(YEARS), max(YEARS), SOURCE_URL, 'Not stated in source workbook', digest,
                None, max(YEARS) + 1, None, 'Next fiscal-year dataset expected; release date not verified.', note)
    columns_ = ('dataset', 'first_year', 'latest_year', 'source_url', 'source_published', 'source_sha256', 'imported_at',
                'next_expected_year', 'next_release_date', 'next_release_note', 'methodology_note')
    values = ["strftime('%Y-%m-%dT%H:%M:%SZ', 'now')" if key == 'imported_at' else hud.sql_literal(value)
              for key, value in zip(columns_, metadata)]
    sql.append('INSERT INTO data_updates (' + ', '.join(columns_) + ') VALUES (' + ', '.join(values) +
               ') ON CONFLICT(dataset) DO UPDATE SET ' + ', '.join(f'{key}=excluded.{key}' for key in columns_[1:]) + ';')
    manifest = {'source_file': SOURCE_URL, 'source_sha256': digest,
                'prepared_at': datetime.now(timezone.utc).isoformat(timespec='seconds'),
                'reference_count': len(references), 'metric_count': len(metrics), 'years': years,
                'metadata': dict(zip(columns_, metadata))}
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / 'hud-spm.sql').write_text('\n'.join(sql) + '\n', encoding='utf-8')
    (output_dir / 'hud-spm-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--raw-dir', type=Path, default=Path('data/raw'))
    parser.add_argument('--output-dir', type=Path, default=Path('data/import'))
    parser.add_argument('--download', action='store_true')
    args = parser.parse_args()
    args.raw_dir.mkdir(parents=True, exist_ok=True)
    path = args.raw_dir / SOURCE_URL.rsplit('/', 1)[-1]
    if args.download:
        with urlopen(SOURCE_URL, timeout=120) as response:
            path.write_bytes(response.read())
    manifest = prepare(path, args.output_dir)
    print(json.dumps({key: manifest[key] for key in ['reference_count', 'metric_count', 'years']}, indent=2))


if __name__ == '__main__':
    main()
