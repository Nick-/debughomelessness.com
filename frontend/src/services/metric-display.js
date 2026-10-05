export function pitHistory(metrics) {
  const pits = metrics.filter(metric => metric.metric_type.startsWith('pit_'))
  if (!pits.length) return []
  const counts = new Map(pits.filter(metric => metric.metric_type === 'pit_count').map(metric => [metric.year, metric.value]))
  const sheltered = new Map(pits.filter(metric => metric.metric_type === 'pit_sheltered').map(metric => [metric.year, metric.value]))
  const unsheltered = new Map(pits.filter(metric => metric.metric_type === 'pit_unsheltered').map(metric => [metric.year, metric.value]))
  const first = Math.min(...pits.map(metric => metric.year))
  const last = Math.max(...pits.map(metric => metric.year))
  return Array.from({ length: last - first + 1 }, (_, index) => ({
    year: first + index, homeless: counts.get(first + index) ?? null,
    sheltered: sheltered.get(first + index) ?? null, unsheltered: unsheltered.get(first + index) ?? null,
  }))
}

export const spmHighlights = [
  ['spm_length_es_sh_avg', 'Average time in emergency shelter / safe haven'],
  ['spm_length_es_sh_th_avg', 'Average time including transitional housing'],
  ['spm_returns_6m_rate', 'Returns to homelessness within 6 months'],
  ['spm_returns_12m_rate', 'Returns to homelessness within 12 months'],
  ['spm_returns_24m_rate', 'Returns to homelessness within 24 months'],
  ['spm_housing_exit_rate', 'Exits to permanent housing (ES / TH / SH / RRH)'],
  ['spm_ph_retention_rate', 'Permanent housing retention / exit (excludes RRH)'],
  ['spm_first_time_es_sh_th_ph', 'First time homeless (ES / SH / TH / PH)'],
  ['spm_hmis_count', 'People recorded in HMIS'],
  ['spm_bed_coverage', 'HMIS bed coverage (ES / TH, non-DV)'],
]

export const spmLabels = Object.fromEntries([
  ...spmHighlights,
  ['spm_length_es_sh_median', 'Median time in emergency shelter / safe haven'],
  ['spm_length_es_sh_th_median', 'Median time including transitional housing'],
  ['spm_first_time_es_sh_th', 'First time homeless (ES / SH / TH)'],
  ['spm_so_exits', 'Street outreach exits'],
  ['spm_so_temporary', 'Street outreach exits to temporary destinations'],
  ['spm_so_permanent', 'Street outreach exits to permanent destinations'],
  ['spm_so_success', 'Successful street outreach outcome'],
  ['spm_housing_exits', 'Exits from ES / TH / SH / RRH'],
  ['spm_housing_exits_permanent', 'Exits from ES / TH / SH / RRH to permanent housing'],
  ['spm_ph_universe', 'People in the HUD permanent housing measure'],
  ['spm_ph_success', 'Successful permanent housing retention / exits'],
  ['spm_non_dv_beds', 'Non-DV beds in ES / TH'],
  ['spm_non_dv_hmis_beds', 'Non-DV HMIS beds in ES / TH'],
  ['spm_returns_universe', 'People in the All-project returns cohort'],
  ...[6, 12, 24].map(months => [`spm_returns_${months}m`, `People returning to homelessness within ${months} months`]),
  ...['stayers', 'leavers'].flatMap(cohort => [
    [`spm_${cohort}`, `CoC-funded project ${cohort}`],
    ...[['earned', 'earned'], ['nonemployment', 'non-employment cash'], ['total', 'total']].flatMap(([key, label]) => [
      [`spm_${cohort}_${key}_income`, `${cohort}: increased ${label} income`],
      [`spm_${cohort}_${key}_income_rate`, `${cohort}: increased ${label} income (%)`],
    ]),
  ]),
])

export function formatMetric(metric) {
  if (!metric) return 'Not available'
  const value = metric.value.toLocaleString('en-US', { maximumFractionDigits: metric.unit === 'count' ? 0 : 1 })
  return metric.unit === 'percent' ? `${value}%` : metric.unit === 'days' ? `${value} days` : value
}
