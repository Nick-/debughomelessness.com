# Google Analytics and owner traffic

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
