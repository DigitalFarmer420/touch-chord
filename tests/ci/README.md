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
```

`smoke.mjs` serves this directory on `127.0.0.1` (port 8091, or `PORT`) and opens `/index.html?test=1&hour=12`. Expert is `&expert=1`. Kids is `&kv=1`. On this revision `?test=1&hour=12` boots Expert, because the old Full screen now opens Expert; the Simple checks switch into Simple from that page.

The Song | Progressions walk is skipped (`FIXME`) while the toggle bug on develop / PR #5 is open. `TOGGLE_FIXME=0 node tests/ci/smoke.mjs` runs that walk and fails the process if the toggle is missing, zero-sized, off-screen, or covering a chord pad.

Not covered here: a real iPhone or Android device, audio you can hear, and loading the page with no network.
