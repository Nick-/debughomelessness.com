# API Documentation

## Base URL
Production: `https://debughomelessness.com` (Cloudflare Worker with D1).
Local Worker: `http://127.0.0.1:18787`.

## Authentication
The Workers API is public and read-only. Only GET and HEAD are supported; writes
are performed through authenticated D1 administration and reviewed imports.
API errors are JSON, including unknown endpoints. Empty collections indicate no
data has been imported; missing CoCs or individual assessments return 404.

## Endpoints

### Data source and updates
```
GET /api/data-status
```
Returns `{ "datasets": [...] }`. Imported datasets include `first_year`,
`latest_year`, `source_url`, `source_published`, `source_sha256`, `imported_at`
(UTC ISO timestamp), `next_expected_year`, nullable `next_release_date`,
`next_release_note`, and `methodology_note`. An empty list means no import
metadata exists. A null release date means no announced date. Import time is
recorded when the SQL is applied.

### Health Check
```
GET /health
```
Returns API health status.
The Worker also checks that the D1 schema is accessible and returns 503 if it is not.

### Continuums of Care (CoC)

#### Get All CoCs
```
GET /api/coc/
```
Returns all Continuums of Care.

**Response:**
```json
[
  {
    "coc_id": "CA-501",
    "name": "Los Angeles County CoC",
    "state": "CA",
    "region_type": "Major City",
    "population": 10000000,
    "boundary_geojson": null
  }
]
```

#### Get Specific CoC
```
GET /api/coc/{coc_id}
```
Returns details for a specific CoC.

**Parameters:**
- `coc_id` (path): CoC identifier

#### Get CoC History
```
GET /api/coc/{coc_id}/history?years=5
```
Returns historical data for a CoC.

**Parameters:**
- `coc_id` (path): CoC identifier
- `years` (query): Calendar-year window ending at the CoC's latest available metric year (default: 5, allowed: 1–100)

### Metrics

#### Get All Metrics
```
GET /api/metrics/
```
Returns a page of available metrics, ordered by descending year, CoC ID, and
metric type. `limit` defaults to 1,000 (allowed: 1–5,000); `offset` defaults to 0
(allowed: 0–1,000,000,000). The response stays an array. Advance the offset by
the page length until an empty array is returned. The full archive now includes
PIT history and SPM; a default request does not return the entire archive.

```
GET /api/metrics/pit/latest
```

Returns total, sheltered, and unsheltered PIT metrics for the latest year with
total PIT counts. This compact endpoint powers the dashboard. Newer SPM fiscal
years do not move the PIT year forward. No imported PIT totals yields `[]`.

**Response:**
```json
[
  {
    "metric_id": 1,
    "coc_id": "CA-501",
    "metric_type": "pit_count",
    "year": 2023,
    "value": 45000,
    "unit": "count",
    "source": "HUD Exchange"
  }
]
```

#### Get Specific Metric
```
GET /api/metrics/{metric_id}
```
Returns details for a specific metric.

#### Get CoC Metrics
```
GET /api/metrics/coc/{coc_id}?year=2023
```
Returns all metrics for a specific CoC, optionally filtered by year.

**Parameters:**
- `coc_id` (path): CoC identifier
- `year` (query): Optional year filter

#### Get Metrics by Type
```
GET /api/metrics/type/{metric_type}
```
Returns metrics filtered by type.

**Parameters:**
- `metric_type` (path): Exact metric key, including PIT and SPM types below.

### Functional Zero

#### Get Documented Historical Achievements

```
GET /api/functional-zero/achievements
```

Returns a manually reviewed Community Solutions source snapshot with
`source_name`, `source_url`, `reviewed_on`, `designation: "historical"`, `note`,
and `communities`. Each community has `name`, `state`, and `populations`
(`veteran` and/or `chronic`). The current snapshot documents 14 communities,
12 veteran milestones, and 5 chronic milestones; three communities overlap.
This is available independently of D1. It does not assign current CoC status,
infer CoC boundaries, or supply unreported achievement dates or headcounts.
The review date is the date the source list was checked, not the milestone date.
An unlisted community is unassessed here, not "not achieved". Built for Zero
no longer uses Functional Zero as an active designation.

#### Get All Functional Zero Status
```
GET /api/functional-zero/
```
Returns Functional Zero status for all CoCs.

**Response:**
```json
[
  {
    "coc_id": "CA-501",
    "status": "not_achieved",
    "achieved_date": null,
    "current_population": 45000,
    "benchmark_population": 3000,
    "percentage_change": 1400.0,
    "last_updated": "2024-01-15"
  }
]
```

#### Get CoC Functional Zero Status
```
GET /api/functional-zero/{coc_id}
```
Returns Functional Zero status for a specific CoC.

#### Get Functional Zero Timeline
```
GET /api/functional-zero/{coc_id}/timeline
```
Returns timeline of Functional Zero progress for a CoC.

## Metric Types

- `pit_count`: total people experiencing homelessness in the January PIT estimate.
- `pit_sheltered`: people in sheltered locations.
- `pit_unsheltered`: people in unsheltered locations.

Each metric preserves its year and HUD workbook URL. CoC references include
historical communities, so use same-year metrics for national totals. Population,
boundaries, and assessments are absent from the PIT import. The separate SPM
import covers FY2015–2024. JSON
examples above illustrate API shape, not verified records.

PIT history covers 2007–2025. In 2021 only `pit_sheltered` is imported; no total
or unsheltered count is inferred. National totals reconcile independently for
each imported year, including the sheltered-only 2021 measure.

### System performance metric keys

SPM `year` is the federal fiscal year (October 1 through September 30), not the
January PIT count year. Each result includes the original HUD workbook URL.

| Keys | Units / meaning |
| --- | --- |
| `spm_length_es_sh_avg`, `spm_length_es_sh_median` | Days in emergency shelter / safe haven |
| `spm_length_es_sh_th_avg`, `spm_length_es_sh_th_median` | Days including transitional housing |
| `spm_returns_universe`, `spm_returns_6m`, `spm_returns_12m`, `spm_returns_24m` | People in the All-project return cohort / returning within each period |
| `spm_returns_6m_rate`, `spm_returns_12m_rate`, `spm_returns_24m_rate` | Percent returning within each period |
| `spm_hmis_count` | People in the HMIS measure |
| `spm_stayers`, `spm_leavers` | People in CoC-funded project income cohorts |
| `spm_{stayers,leavers}_{earned,nonemployment,total}_income` | People with increased income in each cohort |
| The same income keys with `_rate` appended | Percent with increased income |
| `spm_first_time_es_sh_th`, `spm_first_time_es_sh_th_ph` | People homeless for the first time in the named project types |
| `spm_so_exits`, `spm_so_temporary`, `spm_so_permanent` | Street outreach exits and destinations |
| `spm_so_success` | Percent with successful street outreach outcomes |
| `spm_housing_exits`, `spm_housing_exits_permanent`, `spm_housing_exit_rate` | ES / TH / SH / RRH exits, permanent destinations, and percent successful |
| `spm_ph_universe`, `spm_ph_success`, `spm_ph_retention_rate` | PH outcome cohort, successful retention/exits, and percent successful; excludes RRH |
| `spm_non_dv_beds`, `spm_non_dv_hmis_beds`, `spm_bed_coverage` | Non-DV ES / TH beds, HMIS beds, and percent coverage |

Braces in this table describe naming alternatives, not literal API keys. Rate
values are percentages (e.g. `12.5` with `unit: "percent"`), converted from HUD's
source fractions. Invalid, missing, and NA cells produce no metric row. Valid
reported zeros remain zero. Import manifests audit the exclusions. Measures
depend on local HMIS coverage and data quality; do not sum CoC rates or treat
HMIS counts as PIT totals. FY2015 has older PH and street outreach header labels;
the importer explicitly maps these rather than guessing column positions.

`MO-604K` and `MO-604M` are source SPM reporting units. They are deliberately
separate from PIT `MO-604`; their rates and averages are never combined or used
as a current interstate CoC assessment. They have detail/API records and no
inferred PIT data. Historical references without latest-year PIT totals do not
appear in dashboard totals.

## Functional Zero Status Values

- `functional_zero`, `approaching`, `not_achieved`: stored project assessments.

The API returns the latest stored assessment per CoC and does not infer achievement
from absent data. The rate thresholds are project measures, not official
Functional Zero certification. The timeline endpoint returns all stored assessments.

## Error Responses

All endpoints may return standard error responses:

```json
{
  "detail": "Error message here"
}
```

Common HTTP status codes:
- 200: Success
- 404: Resource not found
- 405: Method not allowed
- 422: Invalid query or path parameter
- 503: Database unavailable or not configured
