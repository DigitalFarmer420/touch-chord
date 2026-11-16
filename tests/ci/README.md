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

`smoke.mjs` serves this directory on `127.0.0.1` port 8091 and opens `/index.html?test=1&hour=12`. Expert is `&expert=1`. Kids is `&kv=1`. If 8091 is already taken, the script picks a free port and says so. Set `PORT` to force a port; if that port is taken, the script stops and names it. On this revision `?test=1&hour=12` boots Expert, because the old Full screen now opens Expert; the Simple checks switch into Simple from that page.

A failing check saves `tests/ci/out/<name>.png` before the process exits. The workflow uploads that directory when the smoke job fails.

The Song | Progressions walk is skipped (`FIXME`) while the toggle bug on develop / PR #5 is open. In GitHub Actions that line is a `::warning::` on the smoke job. `TOGGLE_FIXME=0 node tests/ci/smoke.mjs` runs the walk and fails the process if the toggle is missing, zero-sized, off-screen, or covering a chord pad. `placeSimpleTog` is optional in the unit test: absent on develop, and a function when `js/ui/simplesrc.js` is in the tree. The walk still owns the on-screen behaviour.

Not covered here: a real iPhone or Android device, audio you can hear, and loading the page with no network.
