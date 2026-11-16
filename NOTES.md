# Offline service worker

**BUILD_ID (deploy stamping).** `js/version.js` exports `BUILD_ID`, equal to `APP_VERSION` in the repo (check-version enforces that). `deploy-dev.yml` runs `python3 src/tools/stamp-build.py site <develop sha>` on the site copy, which sets `BUILD_ID = APP_VERSION-<short sha>`, rewrites every `?v=` tag to it and adds `<meta name="tc-build">` to `index.html`. `js/offline.js` registers `sw.js?v=` + `BUILD_ID`, and the worker names its cache from that query, so every dev deploy (even a JS- or CSS-only one) installs a new worker that waits for the next cold launch. Production Pages serves `main` as-is (no deploy step), so there `BUILD_ID` is `APP_VERSION`; `pr-checks` (`tools/check-bump.py`) fails a PR into `main` that changes app files without bumping `APP_VERSION`. All network fetches of app files in `sw.js` use `cache: "no-cache"`.

The app can be opened after a first online visit with no network: every runtime asset (modules, CSS, icons, manifest, self-hosted fonts, built-in and Kids song data) is precached. There are no audio sample files; sound is synthesized.

## Registration

`js/offline.js` `boot()` (called from `js/main.js`) registers `sw.js?v=` + `APP_VERSION` (imported from `js/version.js`) with `scope: "./"` and `updateViaCache: "none"`, only when:

- `navigator.serviceWorker` is available
- the page is not inside the Capacitor / Cordova / Android wrapper (`window.Capacitor`, `window.cordova`, or a `capacitor:` / `ionic:` / `file:` protocol)

`?test=1` does **not** change install or wait behaviour. There is no skipWaiting shortcut for tests. The worker always waits for a cold launch, or for an explicit `applyUpdate()` while transport is not playing.

## Cache name and version

Cache name: `"touch-chord" + <scope pathname> + APP_VERSION` (for example `touch-chord/touch-chord-dev/112.13` on the dev Pages site).

`sw.js` does **not** hardcode a version or any `?v=112.x` URL. The version is `new URL(self.location).searchParams.get("v")` from the registered script URL, which is part of the browser's service-worker byte check — so bumping `APP_VERSION` installs a new worker. A `fetch()` of `js/version.js` (`cache: "no-store"`) is only a fallback when that query is missing; a fetch alone would not trigger an update. Install then caches each precache path both bare and (for `css/`, `js/`, `images/`, `fonts/`) with `?v=` + that version. Rebasing over a Front-End version bump (for example PR #7, `?v=112.14`) needs no manual SW edits. `tools/check-version.py` requires the `css/fonts.css?v=` link in `index.html` to match the current `APP_VERSION`, and fails if `js/offline.js` registers a bare `sw.js` without `?v=APP_VERSION`.

On activate, only caches whose name starts with `"touch-chord" + this path's scope` and whose version does not match the current `APP_VERSION` are deleted. Other paths' caches (production vs dev, or another app) are left alone. `localStorage` and IndexedDB are never touched.

## Updates

A new worker is installed in the background and stays waiting. Open pages keep the old worker. The next cold launch activates the new one naturally.

When a waiting worker is ready and this page already has a controller, the page dispatches `window` `CustomEvent` `tc:update-ready`.

### `window.tc.applyUpdate()`

Returns:

- `true` — posted `SKIP_WAITING` to the waiting worker and started a reload
- `false` — nothing waiting, no-op
- `"deferred"` — transport is currently `playing`; did not skipWaiting or reload

When the result is `"deferred"`, the update is applied later, the first time transport becomes `idle` or `paused` (listens for `tc:transport` `{detail:{state}}` when that event exists, and otherwise polls `prog.playing` on this base, which only has idle vs playing). Front-End owns any "Update ready" UI; this branch only exposes the event and the function.

Policy lives in `js/offline-update.js` (`shouldApplyUpdate`, `makeApplyUpdate`) so it can be unit-tested without a service worker.

## Fetch

Precached GET requests are cache-first, with a pathname fallback so a `?v=` miss can still hit the bare (or any other versioned) copy. Navigations are network-first, falling back to the cached `index.html` when offline.

## Fonts

`css/fonts.css` self-hosts, under SIL Open Font License (see `fonts/OFL-*.txt`):

- Nunito (variable) — `fonts/nunito-variable.woff2`
- Fredoka (variable) — `fonts/fredoka-variable.woff2`
- Andika 400 and 700 — `fonts/andika-400.woff2`, `fonts/andika-700.woff2` (Vietnamese lyric diacritics)

Sources were the official Google Fonts / OFL TTF trees, converted to woff2. License text files are in the repo for compliance and are not precached (the page does not fetch them).

## Unit tests

`tests/unit/offline-sw.test.js` fails if any asset referenced by `index.html`, JS imports, CSS `url()`, or the web manifest is missing from `PRECACHE`, or if a `PRECACHE` path does not exist. It also asserts `sw.js` has no hardcoded `112.x` / `?v=` number, that a simulated version bump changes both the registered script URL (`sw.js?v=…`) and the cache name, that activate deletes only this scope's old cache, that query-string test flags never appear as a wait shortcut, and that `applyUpdate` defers while playing and only switches when idle or paused.
