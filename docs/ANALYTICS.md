# Google Analytics: visitor behavior and owner traffic

## Private traffic diagnostics

The first-party `/api/traffic` collector supplements GA4 with **future** arrival
and network information. It uses the existing D1 database, so reports don't need
Cloudflare's paid referrer/ASN analytics fields or additional logging permissions.
It records:

- Original landing page (only known public routes), referring **hostname**,
  and allowlisted UTM source/medium categories.
- Country, ASN and network owner supplied by Cloudflare on the incoming request.
- Browser family and major version, not the raw user-agent string.
- Separate evidence labels: `verified_bot` (if Cloudflare supplies it),
  `headless_browser`, `scanner_agent`, `automation_reported`, or `no_signal`.
- Page-view count, whether the tab spent at least 10 seconds visible, and whether
  it triggered an existing deliberate action event. Automatic detail loads and
  data errors are not interactions.

No IP address, full URL, URL query, search text, or permanent visitor ID is stored
in D1. A random ID in session storage groups one browsing session and rotates
after 30 minutes of inactivity; closing the tab removes it. Duplicated tabs may
inherit session storage. The daily cleanup removes records last active more than
30 days ago (within the following daily cleanup run). IPs are used transiently
by Cloudflare's rate limiter, not written to the analytics table. The collector
ignores cookies. Existing Cloudflare infrastructure logging is separate.

The browser exclusion applies to both collectors. Local/preview frontend builds
send neither GA nor first-party diagnostics; blocked browser storage skips
collection. The endpoint validates origin, limits payload size and rate, and
accepts only three fixed event types. It never exposes a public read endpoint.
Database errors do not affect browsing, and failed requests are not retried.

Run a report using the existing owner Cloudflare credential:

```sh
npm run analytics:report
npm run analytics:report -- --days 1
npm run analytics:report -- --days 7 --output data/traffic-report.md
```

Reports show automation evidence, country/network/browser combinations, arrival
sources, landing pages, and visible/interacted visits. They use a rolling UTC
window of 1–30 days and list the top 30 groups, with full totals separately.
For a development database, add `--local` after applying the local migrations.
The report performs only SELECT queries and never exports session IDs.

**Interpretation:** These are browser sessions, not unique people or GA's active
user metric. `no_signal` means unknown, not confirmed human. Headless browsers
can be legitimate monitoring or accessibility tooling. A hosting-company ASN
can represent a bot, VPN, proxy, or real visitor. Client automation flags,
user-agent strings, referrers, and UTM values can be spoofed. Visible time and
interaction do not prove human attention. Bot scores remain empty when the
Cloudflare plan doesn't supply them. Simple scanners that don't execute the
app's JavaScript are still found in Cloudflare request analytics, not this report.
GA totals may differ due to blocking, exclusions, session definitions, rate
limiting, and network failures. Past GA users cannot be reconstructed.

For links you share, add tags such as
`?utm_source=discord&utm_medium=social` or
`?utm_source=newsletter&utm_medium=email`. Supported sources are newsletter,
discord, linkedin, reddit, github, facebook, x, bluesky, google, bing, chatgpt,
perplexity, and email. Supported mediums are email, social, referral, organic,
cpc, qr, and link. Other nonempty values become `other_tagged`; campaign names
are not retained. GA4's existing attribution still works independently.

Implementation sources: [Cloudflare request metadata](https://developers.cloudflare.com/workers/runtime-apis/request/)
and [Bot Management fields](https://developers.cloudflare.com/bots/reference/bot-management-variables/).

## What to look at

Use the [configured Reports snapshot](https://analytics.google.com/analytics/web/#/a296956267p557395391/reports/dashboard?r=16064577018)
for an overview of behavior. Bookmark this direct link if Google's Reports
navigation still shows its setup screen. The generic GA Home
screen's event total mixes page views, session starts, and engagement events;
it does not tell you how many people actually explored the data.
Use the last **7 or 28 days**, compared with the previous period. Today's partial
day and yesterday's full day are not a useful comparison at this traffic level.

| Question | Report / measurement |
| --- | --- |
| Where do visitors come from? | Traffic acquisition: session source / medium and engaged sessions |
| Which pages do people read? | Pages and screens: **Page path and screen class**, views, active users, average engagement time |
| What do people actually do? | Events: the action names below, **Total users** as well as event count |
| Which CoCs are useful? | `coc_detail_view` by CoC ID; `coc_select` by CoC ID and selection method |
| Do people get from searching to useful data? | Explore: open funnel `coc_search` → `coc_select` → `coc_detail_view` within the same session |
| Where do people go next? | Explore: path exploration starting at `page_view` or `coc_detail_view` |
| Are people joining/supporting the project? | `discord_click` and `donate_click` by link placement and traffic source |
| Are people hitting problems? | `data_load_error` by data section; searches with `result_count = 0` |

The search funnel covers visitors who search; direct CoC links and map-only
visits can skip search. Use an open funnel and separate map/list breakdowns.
Click counts indicate intent: a Discord click does not prove a join, and a
donation click does not prove a payment. This app cannot see those completions.

## Tracked actions

The site sends these custom GA4 events after the behavior-tracking build is
deployed. They apply to future visits; past interactions cannot be reconstructed.
Each event includes `page_type` and a known `page_path`; CoC detail routes also
include their public `coc_id`. Page views remain handled by enhanced measurement.

The GA4 property is **DebugHomelessness.com**, account `296956267`, property
`557395391`, owned through `nicholasconrad96@gmail.com`. On October 7, 2026,
the 16 event-scoped dimensions below and four key events were registered in
that property. The custom Reports snapshot was saved and set as the default,
with active users, views, average engagement time, and key events at the top,
plus traffic-source, device, returning-user, event, and page-path cards.
**Visitor pages** was saved as a dedicated page-path report in the Library.
The generic Home tab remains GA's own home screen; use **Reports → Reports
snapshot** for the configured overview.

| Event | Trigger and additional parameters |
| --- | --- |
| `coc_search` | Nonempty search settles for 800 ms, loses focus, or Enter is pressed. `result_count`, optional `state_filter`; no raw search text. |
| `coc_select` | CoC selected in the map/list. `coc_id`, `coc_state`, `selection_method` (`map` / `list`). |
| `coc_detail_view` | CoC details successfully load, including direct visits. `coc_id`, `coc_state`. |
| `coc_state_filter` | State selection changes. `state_filter` (or `all`). |
| `map_region_change` | Map region changes. `map_region`. |
| `shelter_select` | Shelter pin/list entry selected. `coc_id`, `shelter_id`, `selection_method`. |
| `shelter_toggle` | Visitor shows/hides shelters. `enabled`. |
| `shelter_metric_change` | Visitor chooses capacity/occupancy. `shelter_metric`. |
| `spm_year_change` | Visitor changes fiscal year. `data_year`, `coc_id`. |
| `spm_expand` | Visitor opens all imported measures. `coc_id`. |
| `achievement_search` | Achievement search settles, loses focus, or Enter is pressed. `result_count`; no raw search text. |
| `achievement_population_filter` | Population selection changes. `population_filter`. |
| `discord_click` | Discord link clicked. `link_placement`. |
| `donate_click` | GitHub Sponsors link clicked. `link_placement`. |
| `source_click` | Known HUD, boundary, Community Solutions, or shelter source clicked. `source_host`, `link_placement`; no custom URL or link-text parameter. |
| `shelter_resource_click` | HUD Find Shelter clicked. `link_placement`. |
| `repository_click` | GitHub repository link clicked. `link_placement`. |
| `navigation_click` | Internal link clicked. `destination`, `link_placement`, target `coc_id` where applicable. |
| `data_load_error` | An API/data load fails. `data_section`; no exception text. |

Link placement is `navigation`, `mission`, `footer`, or `content`. Delegated
capture listeners track normal/keyboard clicks and middle clicks, including
dynamically mounted Leaflet popup links. Custom events honor the same production
host restrictions and browser exclusion as the Google tag. Local tests use a
fake Google tag and do not send test traffic to the production property.
GA enhanced measurement may separately record generic outbound `click` or file
download events; do not add them to these action totals as if they were separate
visitor actions.

## Register behavior parameters and key events in GA4

In the **DebugHomelessness.com** property, open **Admin → Custom definitions**.
Create event-scoped custom dimensions for these parameter names:

| Dimension name | Event parameter |
| --- | --- |
| Page type | `page_type` |
| CoC ID | `coc_id` |
| CoC state | `coc_state` |
| Selection method | `selection_method` |
| State filter | `state_filter` |
| Shelter ID | `shelter_id` |
| Shelter metric | `shelter_metric` |
| Map region | `map_region` |
| Data year | `data_year` |
| Population filter | `population_filter` |
| Link placement | `link_placement` |
| Source host | `source_host` |
| Destination | `destination` |
| Data section | `data_section` |
| Shelters enabled | `enabled` |
| Search result count | `result_count` |

Use the result-count dimension to filter zero-result searches. Do not create a
summed result-count metric: adding result counts does not measure search success.
GA4 dimensions and normal reports can take 24–48 hours to become available.

Under **Admin → Events**, mark `coc_detail_view`, `shelter_resource_click`,
`discord_click`, and `donate_click` as key events, using **once per session**
counting for each. Keep action events such as search and filter changes as
diagnostics. No monetary value is assigned to outbound clicks. Do not create a
second GA event that duplicates the event the application already sends.

The configured Reports snapshot includes cards for page paths, events, traffic
acquisition, engagement, device category, and key events. It was saved through
the report editor because Google's User behavior template setup returned an error.
Prefer page paths: the app currently shares a document title across routes.
For detailed exploration, use Total users alongside Event count so repeated
clicks by one visitor do not look like more people.

References: [Google custom events](https://developers.google.com/analytics/devguides/collection/ga4/events),
[event parameters and custom definitions](https://developers.google.com/analytics/devguides/collection/ga4/event-parameters),
and [Reports snapshot customization](https://support.google.com/analytics/answer/10659091).

## Configure GA4

The production stream is configured as `G-01Q4FQHS0X` in
`frontend/.env.production`. This public configuration is committed so subsequent
builds retain it. Use the following steps to check the stream or override it.

1. Open [Google Analytics](https://analytics.google.com/) and select the site's
   property, or create a property and a Web data stream for
   `https://debughomelessness.com`.
2. Under **Admin → Data streams**, open the Web stream and copy the
   **Measurement ID** starting with `G-`.
3. To override the committed production ID, set `VITE_GA_MEASUREMENT_ID` in
   `frontend/.env.local`:

   ```dotenv
   VITE_GA_MEASUREMENT_ID=G-YOURMEASUREMENTID
   ```

   Alternatively supply this variable in the build environment. Root `.env`
   files are not loaded by the frontend's Vite build. The measurement ID is a
   public identifier, not a secret. Never put a Measurement Protocol API secret
   in a `VITE_` variable. An explicitly empty override disables collection.
4. In the stream's **Enhanced measurement → Page views → Show advanced
   settings**, enable **Page loads** and **Page changes based on browser history
   events**. GA4 then measures initial loads, React Router navigation, and
   back/forward navigation. Do not add another page-view tag or manual page-view
   event for this installation.
5. Rebuild, validate, and deploy using the normal release procedure. Vite embeds
   the ID at build time; setting a Worker runtime variable alone has no effect.

No tag loads without a valid measurement ID. Collection is limited to production
builds on HTTPS `debughomelessness.com` and `www.debughomelessness.com`; local
development, Workers previews, and other hosts are excluded. Google signals and
advertising personalization are disabled in the tag configuration.

## Exclude your visits

On **each browser/profile/device you use**, make your first visit after deployment:

[Exclude this browser](https://debughomelessness.com/?analytics=off)

The exclusion is saved in local storage before the Google tag can load, so even
this first visit is excluded. Subsequent visits and route changes remain excluded
regardless of changes to your IP address. The footer confirms **Analytics excluded
for this browser**. It also provides the exclusion link for other visitors.
Already-open tabs disable collection when they receive the saved exclusion.
Events sent before the exclusion are not removed from Google Analytics.

This preference is specific to the site's origin and browser profile. Repeat the
link after clearing site data and for new profiles, private sessions, devices, or
the `www` hostname if used. Browsers that block access to local storage skip
analytics and show a storage-unavailable message.

To restore tracking deliberately, use the footer's **Allow analytics** link or
visit `https://debughomelessness.com/?analytics=on`. Control parameters are
removed from the URL before analytics initializes; other parameters and hashes
are preserved.

## Verify

After deployment, use a separate browser profile that is not excluded to browse
the dashboard, a CoC detail page, and Functional Zero. Check the stream's Realtime
report or Tag Assistant/DebugView for page views and correct page locations.
There should be one page view per page load or route transition.

In your excluded browser, verify that no request to
`www.googletagmanager.com/gtag/js` or Google Analytics collection endpoints is
made. Reload and navigate again to confirm persistence. Repeat on localhost and
a preview host: neither should load the tag even when built with an ID.

Implementation references:
[Google's SPA measurement guide](https://developers.google.com/analytics/devguides/collection/ga4/single-page-applications)
and [Google's collection-disable control](https://developers.google.com/tag-platform/security/guides/privacy#turn_off_google_analytics).
