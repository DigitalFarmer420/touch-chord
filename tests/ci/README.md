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

Not covered here: a real iPhone or Android device, audio you can hear, and loading the page with no network.
