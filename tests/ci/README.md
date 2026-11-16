# PR checks

Static checks for a pull request into `develop`. There is no build. Use Node 20 (`npm run test:unit` breaks on Node 24).

From the repo root:

```bash
# cache tags in index.html match APP_VERSION
python3 tools/check-version.py

# unit tests, including tests/unit/ci-regress.test.js
node --test tests/unit/*.test.js

# one-time browser install, then the headless smoke
npx playwright-core install --with-deps chromium
node tests/ci/smoke.mjs

# the same checks against the dev Pages site, with no local server
BASE_URL=https://digitalfarmer420.github.io/touch-chord-dev/ node tests/ci/smoke.mjs
```

`smoke.mjs` opens `/index.html?test=1&hour=12`. Expert is `&expert=1`. Kids is `&kv=1`. On this revision `?test=1&hour=12` boots Expert, because the old Full screen now opens Expert; the Simple checks switch into Simple from that page.

With `BASE_URL` unset, the script serves this directory on `127.0.0.1` port 8091. If 8091 is already taken, it picks a free port and says so. Set `PORT` to force a port; if that port is taken, the script stops and names it. It prints `target: http://127.0.0.1:<port>/ (local)` before the checks.

Set `BASE_URL` to a deployed site root (a trailing slash is optional) to skip that server. `PORT` is not used. Every page URL is resolved against the root, so the path prefix stays. `BASE_URL=https://digitalfarmer420.github.io/touch-chord-dev/` opens `https://digitalfarmer420.github.io/touch-chord-dev/index.html?test=1&hour=12`, and the same root with `&expert=1` or `&kv=1`. Each of those URLs gets `cb=<timestamp>` so the browser does not reuse a cached `index.html`. Document load waits 45s against `BASE_URL` and 20s on the local server. The script prints `target:` with that root, then the three page URLs. A browser request to the same host that falls outside the site (for example `https://digitalfarmer420.github.io/favicon.ico` on a project page) is ignored and named on that check. It is not a failed check. A console error that mentions such a URL is ignored the same way. Each one is printed in full, with the check it came from, as `ignored (outside prefix): <check>: <text>`. The summary counts those lines (`N ignored (outside prefix)`). That does not change pass or fail. Every check in this script runs against the deployed site the same way it runs locally.

A failing check saves `tests/ci/out/<name>.png` before the process exits. The workflow uploads that directory when the smoke job fails.

The Song | Progressions walk is skipped (`FIXME`) while the toggle bug on develop / PR #5 is open. In GitHub Actions that line is a `::warning::` on the smoke job. `TOGGLE_FIXME=0 node tests/ci/smoke.mjs` runs the walk and fails the process if the toggle is missing, zero-sized, off-screen, or covering a chord pad. `placeSimpleTog` is optional in the unit test: absent on develop, and a function when `js/ui/simplesrc.js` is in the tree. The walk still owns the on-screen behaviour.

The `simple toggle keeps song step` check (390x844 and 1180x820, always on) loads `tests/fixtures/upload/anh-v13.json`, switches to Simple, taps Next five times, then Progressions, Song and Next, and expects the 6th step. It also taps Progressions and Song during Play and expects Play to keep running. A build with no Simple toggle reports it as `FIXME` instead of failing.

Not covered here: a real iPhone or Android device, audio you can hear, and loading the page with no network.

## Offline update checks (PR #15)

`tests/ci/update-ab.mjs` runs from `smoke.mjs` (local server only; skipped with `BASE_URL`) and alone with `node tests/ci/update-ab.mjs`. It serves the app under `/touch-chord/` on its own port and builds versions in memory (nothing is written to disk):

- `offline update A->B (sw.js unchanged)`: A installs and controls; B (every `?v=` tag and `APP_VERSION` bumped, `sw.js` byte-identical, which the check asserts) is served on the same path. Within two reloads B's label, HTML and JS must all be B, `fetch('js/version.js?v=B')` must be B's file, and `sw.js?v=B` must install. A cold launch must be controlled by `sw.js?v=B`, A's cache for this scope must be gone, and a seeded `touch-chord/touch-chord-dev/...` cache (the other site) must be kept.
- `offline reload after B is active`: offline reload boots B (label, HTML, JS, controller).
- `offline asset-only change A->A2`: same version, only `index.html` and `js/boot-early.js` change. The online reload must show A2's HTML with A2's JS, and after the cache refill an offline reload must too.
- `offline existing 971119a install picks up B`: A is served with `tests/fixtures/offline/sw-971119a.js` (the worker shipped at 971119a), then this tree's B. B's label, HTML and JS on the first cold launch, controller `sw.js?v=B` by the second.

- `offline code-only deploy (js/ui/next.js, same APP_VERSION)` and `offline CSS-only deploy (css/base.css, same APP_VERSION)`: two deploy copies are written to a temp dir the way `deploy-dev.yml` makes them (copy, then `tools/stamp-build.py <dir> <sha>` when the tree has it) and served with `Cache-Control: max-age=600` like Pages. Three reloads and two cold launches: no load may mix builds, and the new code must be live and in control (`sw.js?v=<BUILD_ID>`) by the first cold launch, and offline after that.
- `same-version HTML+JS deploy under max-age=600`: stamped deploy that changes `index.html` and `js/boot-early.js` at the same `APP_VERSION`. No reload may pair the new HTML with the old JS. In Chromium a reload reuses the renderer's memory cache for same-URL subresources without asking the worker, so only the per-deploy `?v=` fixes this.

`AB_ROOT=<other tree> node tests/ci/update-ab.mjs` runs the same checks against another checkout (the first four fail on 971119a; the three deploy checks fail on 14fc21e, which has no stamping).
