# Touch Chord

Static web app. There is no compile step. GitHub Pages serves the files as they are. `develop` is the dev site and `main` is production. Repo owner: DigitalFarmer420.

`ARCHITECTURE.md` is the note from the v112.3 split. The module list, CSS stack, and version scheme there are behind the tree. Use this file and the two standards docs.

- Screen, layout, and sound-from-the-UI: [docs/standards/frontend.md](docs/standards/frontend.md)
- Songs, theory, guitar data, storage, tools, versioning, CI: [docs/standards/backend.md](docs/standards/backend.md)

## Repo map

```
index.html          markup, plus the song-contract JSON blocks (#songSchemaJson, #songSchema13Json)
css/*.css           plain CSS. Order in index.html is the cascade; look.css loads last
js/boot-early.js    classic script in <head>, before first paint (size class, --tx, --tc-ih, iOS audio session)
js/main.js          <script type="module">. Imports every module, then calls boot() in order
js/audio/           ChordAudio and the Band. The only place that creates Web Audio nodes
js/theory/          pure music logic. Builds window.Theory
js/instruments/     guitar and ukulele profiles, shape tables, the voicing resolver
js/songs/           presets, upload, library, playback, jam
js/ui/              panels. touch.js is the shared sound path and draws nothing
js/expert/          Expert screen (ui.js) and its pure model (model.js)
js/kids/            Kids view, pad grid, piano range. js/kids.js is the Kids style strip
js/state.js         state, loop, shared, and touchChord.settings.v1
js/version.js       APP_VERSION, APP_BUILD, BUILD_ID
sw.js               offline cache. The version comes from the script URL, not a hardcoded number
tools/              version bump, cache-tag check, deploy stamp
tests/unit/         node --test
tests/ci/smoke.mjs  the Playwright smoke that pull requests and deploys run
tests/e2e/          the long Playwright suite. The legacy tests workflow runs it on a develop → main PR
```

A new UI area is a file under `js/ui/` (or `js/expert/`, `js/kids/`). A new saved value goes through `state.js` and `js/settings.js`. A value that more than one module assigns goes on `shared`, with an owner comment. One-time DOM setup is an exported `boot()`, called from `js/main.js` in boot order. Test helpers are `window.__*` in `js/test-hooks.js`, loaded only with `?test=1`.

## Tests

Use Node 20. `npm run test:unit` fails on Node 24.

From the repo root:

```bash
python3 tools/check-version.py
node --test tests/unit/*.test.js

# once per machine, then the smoke gate (same script as pr-checks and the deploy)
npx playwright-core install --with-deps chromium
node tests/ci/smoke.mjs
```

`node tests/ci/smoke.mjs` serves this directory (port 8091, or the next free port) and opens `index.html?test=1&hour=12`. Expert is `&expert=1`. Kids is `&kv=1`. On this tree `?test=1&hour=12` boots Expert; Simple checks switch into Simple from that page. `BASE_URL=https://digitalfarmer420.github.io/touch-chord-dev/` runs the same checks against the dev site and skips the local server. A failing check writes `tests/ci/out/<name>.png`.

`npm run test:smoke` is `node tests/e2e/run.cjs`, the long suite. It is not the pull-request gate. The legacy `.github/workflows/tests.yml` job runs it only for a pull request from `develop` into `main`, and that job is not the required check.

`npm test` runs the version check, the unit tests, and the long e2e suite.

## Process

`develop` publishes https://digitalfarmer420.github.io/touch-chord-dev/. `main` publishes https://digitalfarmer420.github.io/touch-chord/. The only web deploy is `.github/workflows/deploy-web.yml`. A failed unit, version, or smoke job skips the publish.

**Rule.** `main` changes only when Vinh gives an explicit go for that release. Do not open or merge a pull request into `main` on your own. A `develop` → `main` release does not need a second version bump: develop's last bump is already above `main`.

**Rule.** Every pull request ships with tests. A behaviour change gets a unit test. A screen change also gets a run of `node tests/ci/smoke.mjs`, including the viewports in the frontend standard.

**Rule.** Bring an open pull request up to date by merging `develop` in (`git merge --no-ff origin/develop`). Merge commits only. Do not rebase the branch and do not force-push.

**Rule.** Web only. Do not add an APK, a store upload, or Capacitor/Cordova packaging. `tools/write-build.py` still rewrites `APP_BUILD` for an old packaging step; leave that script alone.

**Rule.** Do not change Kids mode without Vinh's explicit OK. See the frontend standard.

Version numbers are `YYYY.MM.DD.N`. Bump with `python3 tools/bump-version.py --today` before opening a pull request into `develop`. If another pull request landed the same number, merge `develop` again and run the bump again. Details, and the known `?v=` gap in `tests/`, are in the backend standard.
