# Data coverage review — October 5, 2026

| Dataset | Verified coverage | Source |
| --- | --- | --- |
| PIT | 2007–2025; 21,519 metric records, 413 distinct references | [HUD 2025 AHAR release](https://www.huduser.gov/portal/datasets/ahar/2025-ahar-part-1-pit-estimates-of-homelessness-in-the-us.html) |
| System performance | FY2015–2024; 158,294 metric records, 411 source reporting units, 41 measures | [HUD SPM workbook](https://files.hudexchange.info/resources/documents/System-Performance-Measures-Data-Since-FY-2015.xlsx) |
| Map boundaries | FY2024 snapshot; latest-year coverage varies as CoCs change | [HUD grantee-area layer](https://services.arcgis.com/VTyQ9soqVukalItT/arcgis/rest/services/Continuum_of_Care_Grantee_Areas/FeatureServer/0) |
| Historical Functional Zero milestones | Previously documented 14-community snapshot, reviewed October 4, 2026 | [Community Solutions](https://community.solutions/built-for-zero/functional-zero/) |

Counts describe the prepared source snapshots, not a production deployment.
Import manifests record SHA-256 digests, per-year coverage, and preparation time.
The database records actual application time separately. Raw files and generated
SQL are stored under ignored `data/raw/` and `data/import/` directories.

PIT totals reconcile with the workbook's national row and an independent state
workbook for every year. Only sheltered counts are imported for 2021 because HUD
describes pandemic disruption to unsheltered counts. The chart shows missing
totals as gaps. Coverage and CoC boundaries change over time, so apparent changes
need that context.

SPM is a federal fiscal-year HMIS measure. Missing/NA cells are excluded without
substituting zeros. Four invalid cells (two durations in FY2015 and a count/rate pair in FY2016)
are excluded and recorded with raw values and reasons in the manifest. Source
fractions are converted to percentage units. There is no national control total
for all of these measures; verification checks exact reviewed headers, unique
reporting IDs, source coverage, and valid numeric domains. It does not certify
the quality of each community's HMIS submission.

HUD's separate `MO-604K` and `MO-604M` SPM rows retain their identities. Combining
their rates or averages, or attaching a single component to all PIT `MO-604`,
would change their meaning. The MO-604 detail page links to these source units.

## Remaining gaps

- **CoC population and rates per resident:** the documented HUD [CoC Analysis
  Tool v4 workbook](https://files.hudexchange.info/resources/documents/CoC-Analysis-Tool-4.0.xlsx)
  and its [landing page](https://www.hudexchange.info/resource/5787/coc-analysis-tool-race-and-ethnicity/)
  returned HTTP 404 during this review. [GAO's methodology](https://files.gao.gov/reports/GAO-26-107502/index.html)
  identifies its population vintage as ACS 2017–2021, which would require an
  explicit year label and a boundary review even if recovered. No population
  estimate was substituted from an overlapping city, county, or state.
- **Current Functional Zero assessments:** annual PIT and SPM data cannot supply
  current by-name-list assessments, benchmarks, certification dates, or current
  homelessness headcounts. Historical milestones remain separate. Missing
  assessments do not mean a community failed to achieve a milestone.
- **2021 total/unsheltered PIT:** intentionally unavailable for comparable
  national history; sheltered-only values are accessible.
- **Unreported or invalid SPM cells and mismatched reporting geography:** retained
  as unavailable, including canonical MO-604 in years reported only for component
  units. Import manifests list the exact missing/excluded metric coverage.
- **Boundary mismatches:** the FY2024 map cannot provide a verified current
  boundary for every latest-year CoC. Those CoCs remain in the searchable list.
- **Newer releases:** no January 2026 PIT release or SPM fiscal year after 2024
  was imported without a verified source. An expected next year is not a promised
  release date or an automatic update.

The next population import requires a recoverable authoritative CoC population
dataset with a stated ACS vintage and matching geographic definitions. Keep
population year and source alongside each value before displaying derived rates.
