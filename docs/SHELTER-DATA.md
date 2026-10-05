# Shelter map data

The map can display numbered public shelter sites for the selected CoC. Pins
match a shelter list with addresses, capacity, occupancy, dates and source links.
The selector changes which metric appears beside the pins; the popup and list
always show both. Missing counts remain null and display as not reported.

## Initial coverage: FL-601

Reviewed October 5, 2026. Five public Broward emergency shelter sites are matched
to projects in [HUD's January 2025 HIC report, page 2](https://files.hudexchange.info/reports/published/CoC_HIC_CoC_FL-601-2025_FL_2025.pdf#page=2).
These project counts are transcribed after visual review of the table:

| Pin | Shelter | Reported beds |
| --- | --- | ---: |
| 1 | Central Homeless Assistance Center | 170 |
| 2 | North Homeless Assistance Center | 268 |
| 3 | South Homeless Assistance Center | 110 |
| 4 | Lippman Youth Shelter | 4 |
| 5 | Salvation Army Open Door Shelter | 28 |

This is a **partial inventory**, not nationwide shelter coverage or a complete
count of Broward facilities. Project counts are not necessarily all physical
beds at a campus. South includes 10 overflow / voucher beds. The Lippman count
describes its HIC project, not all LSF residential capacity. Open Door excludes
other Salvation Army projects, whose service sites have not been matched here.
HUD says the CoC submissions have not been independently verified by HUD.

**Occupancy is unavailable for all five sites in this source.** HIC reports bed
inventory, not people staying at each shelter. CoC PIT sheltered totals also
include other projects and cannot be allocated to these pins. Do not infer
occupancy, empty beds, occupancy rates or current availability from capacity.
An occupancy import requires a facility-matched count, an observation date/time
and its own source. Annual clients served and bed-nights are different measures.

Public addresses come from the linked operators' contact pages, LSF Family
Focus and the local Area Agency on Aging's published October 2023 directory
(Open Door, page 169). Each record retains its address source. Confidential
locations and projects with unknown/scattered service sites are omitted.
Locations use the U.S. Census `Public_AR_Current` address-range geocoder:
pins are approximate street positions, not surveyed building entrances.

## Refresh or extend coverage

1. Review a public project inventory and the actual service-site addresses.
   Add reviewed records to `scripts/shelter-sources.json`, with stable IDs and
   unique pin numbers within each CoC. Record coverage as partial unless an
   authoritative complete inventory has been reconciled.
2. Retain independent sources and dates for capacity and occupancy. Unavailable
   metrics must use an explicit null value. Update the review date.
3. Run `node scripts/prepare-shelter-locations.mjs`. It checks for a unique Census
   address match, matching state and ZIP, and validates records before writing
   `frontend/public/data/shelter-locations.json`. All locations are stored locally;
   visitors do not make geocoding requests.
4. Review the pins against the source addresses and CoC geography, run
   `npm run check`, and verify selection, metric switching and missing coverage
   in the local map before release.

The browser validates the snapshot too. A failed or malformed import shows a
retry message while CoC totals remain available. CoCs without records explicitly
say that shelter data have not been imported, rather than implying no shelters.
