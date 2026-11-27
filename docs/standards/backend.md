# Backend standards

The non-UI half of Touch Chord: theory, songs, guitar data, storage, `tools/`, versions, and CI. The screen is in [frontend.md](frontend.md). There is no server. "Backend" here means the modules that do not draw.

## Data and music theory

`js/theory/` is pure. No DOM, no `localStorage`. `js/theory/index.js` builds one `Theory` object and sets `window.Theory`.

| File | Exports used by the rest of the app |
| --- | --- |
| `chords.js` | `chordIntervals`, `tones`, `chordSymbol`, `bassMidi`, `buildChord`, `normalizeExt` |
| `keys.js` | `scaleDegrees`, `degreeChord` |
| `names.js` | `enharmonicSpell`, `plainToneName`, `hasDoubleAcc` |
| `quality.js` | `mapQuality`, `blankExt`, `wrap12` |
| `spelling.js` | `accSym`, `spellRoot`, `noteName`, `spellInterval`, `chordToneNames`, `NOTE_NAMES` |
| `voicing.js` | `VOICINGS`, `voicedMidis`, `pitchClasses` |

Callers pass a root spelling in (`rootSpell` / `keyRootSpell`). Theory does not read `state`.

`js/songs/` is the song data and the player:

| File | Role |
| --- | --- |
| `presets.js` | Built-in `PROGRESSIONS` and the ranked menu. Step strings like `"1 maj\|5 maj"` |
| `upload.js` | Prompt text, schema load, parse, schema check, load into the library |
| `aipaste.js` | Pure paste cleanup: fences, curly quotes, NFC on lyric strings, version alias |
| `normalize.js` | `repairJson`, `tidyChord`, `is13`, `from13` (a v1.3 answer becomes the v1.2 shape) |
| `validate.js` | Musical flags after the schema passes. Pure |
| `library.js` | `touchChord.library.v1`. Open, list, delete, the one-time upload migration |
| `song.js` | The loaded song: steps, key, lock, transpose |
| `playback.js` | Play / pause / resume / stop, and `tc:transport` |
| `transport-policy.js` | Pure resume rules (`resumeRule`, `songIdentity`, `barOffset`) |
| `playalong.js`, `magic.js`, `jam.js` | Play-along advance, Magic Next, jam extras |
| `kids-songs.js` | Kids lyrics and keys |
| `proghold.js` | Keep the chosen progression across a style change. Pure |

`js/instruments/` is also pure. `profiles.js` defines `guitar` (standard tuning, 15 frets, max span 5) and `ukulele`. `shapes.js` returns `{ open, movable }` for an id. `resolve.js` exports `resolveVoicings(instrument, chord)`. `index.js` is the barrel.

A new music rule that can be decided without the DOM goes in `js/theory/` or `js/instruments/` and gets a unit test that imports the module. A rule that needs the loaded song goes in `js/songs/` and stays out of `js/ui/`.

## Song and upload validation

Two checks run, in order.

**Schema.** `index.html` embeds the contracts. `#songSchemaJson` is Touch Chord Song Contract v1.2, one song: required `contractVersion`, `song`, `timing`, `sections`, `additionalProperties: false`. `contractVersion` is `"1.0"`, `"1.1"`, or `"1.2"`. `song` requires `title`, `artist`, `key`. `timing` requires `bpm` and `timeSignature`. Chord symbols use the contract's ASCII pattern. `#songSchema13Json` is the v1.3 list (`{ contractVersion: "1.3", songs, notes }`) that the copy-for-AI prompt sends. `upload.js` `boot()` parses both blocks. The checker is `upValidate` in `upload.js` (types, enums, patterns, extra keys). It is not Ajv.

Accepted versions are `UP_VERSIONS`: `"1.0"` through `"1.3"`. A v1.3 song, or an object `is13` recognises, goes through `from13` and is stored as contract `"1.2"`. After the schema, `upCheckObj` rejects a duplicate section id, a chord `upParseChord` cannot read, a lyric marker outside its line, and a time signature it cannot parse. Unknown keys can be stripped with a warning when `upStripW` is set.

Paste cleanup (`normalizeAiPaste` / `normalizeAiVersion` in `aipaste.js`) runs before the parse: code fences, smart quotes, trailing commas, NFC on Vietnamese lyric strings.

**Musical flags.** `validateSong` in `js/songs/validate.js` runs on a song that already passed the schema, before save. It returns `{ flags: [{ layer, severity, message, where }] }`.

- `key` — each chord against the section key (or the song key, carried forward after a modulation). Triad check. Secondary dominants, parallel-minor borrowings, minor-key V and IV, blues I7/IV7/V7/bVII, Neapolitan bII, a chromatic passing diminished, and `borrowed: true` are not flagged. Three or more out-of-scale chords that fit another key become one suggestion.
- `timing` — gaps, overlaps, and a short last bar, in beats. Beats per bar are the time-signature top number, default 4.
- `bpm` — `timing.bpm` is a number from `BPM_MIN` (50) to `BPM_MAX` (180).

The Upload dialog shows the flags and offers Save anyway or Go back. A schema error blocks the load. A musical flag does not, once the player confirms.

Unit tests live in `tests/unit/validate.test.js`, `upload13.test.js`, and the `aipaste*.test.js` files, with fixtures under `tests/fixtures/upload/`.

## Guitar shape data

Shapes are data, not pictures. `js/instruments/guitar-data.js` holds `GUITAR_OPEN` and `GUITAR_MOVABLE` from the musician's table: `quality`, `rootPc`, `bassPc`, `frets`, `fingers`, `barres`. `null` is a muted string. Finger `0` is open or muted. A movable fret of `"b1"` is one fret below the barre. `js/instruments/shapes.js` re-exports those arrays and adds `UKULELE_OPEN`. Adding a curated grip is a new row in the table, not a change to the resolver.

`resolveVoicings` (`js/instruments/resolve.js`) orders grips easiest first: a curated open grip for that exact chord, then movable E, A, and D shapes at the lowest fret that fits, then a search of the board when the library has nothing.

**Library grips are used as written.** `libraryVoicings` copies `frets`, `fingers`, and `barres` into the result. A table row that mutes a middle string on purpose (E-shape maj7 `"8x998x"`) keeps that mute. `tests/unit/gtrshapes.test.js` locks this.

**Search-built grips** follow three rules, all in `resolve.js` and covered by `gtrshapes.test.js`:

- The lowest sounding note is the root, or the slash bass when the chord has one (`bassOk` / `consider`). On a re-entrant tuning (ukulele) `bassOk` skips that check, because the root is not the lowest MIDI note.
- `hasInnerMute` rejects a grip that mutes a string between the first and last sounding string.
- `easeKey` sorts by the lowest fretted position first, then fewer fingers, then more sounding strings. A two-finger grip at fret 11 loses to a playable grip that starts at fret 2. The N28 cases (7sus2 and m9b5, which the library does not cover) must start at fret 7 or below.

Open grips sort before movable ones, then by position, then E-shape before A-shape before D-shape. `tests/unit/frets.test.js` requires every catalog quality in all 12 keys to resolve on guitar.

The screen never invents a grip. `js/ui/guitar.js` calls `resolveVoicings` and draws what it returns. The name on the card is the chord's name (`chordDisplayName`); the grip line is `voicingLabel`. See the frontend standard.

## Storage keys and migrations

All keys are `localStorage`. Nothing uses IndexedDB. The service worker does not touch storage.

| Key | Module | Shape |
| --- | --- | --- |
| `touchChord.settings.v1` | `js/state.js` | `{ v: 1, settings }`. Sticky settings only |
| `touchChord.library.v1` | `js/songs/library.js` | `{ v: 1, active, sel, songs }`, max 50 (`LIB_MAX`). A full library does not evict |
| `touchChord.upload.v1` | `js/songs/upload.js` | Legacy single song. Read once |
| `touchChord.tour.v1` | `js/ui/tour.js` | `"done"` |
| `touchChord.expert.v1` | `js/expert/model.js` | `{ v: 1, on, look }`. Separate from settings |
| `touchChord.simpleLook.v1` | `js/expert/ui.js` | `{ v: 1, look }` |
| `touchChord.notes.v1` | `js/expert/ui.js` | One-shot flags, e.g. `{ denseMoved: true }` |
| `touchChord.gtrTab.v1` | `js/ui/gtrmath.js` | `"piano"` or `"guitar"` |

The one migration that exists: `library.js` `boot`, if there is no library key, reads `touchChord.upload.v1`, and on a song that passes `upCheck` copies it into the library and removes the old key. `touchChord.settings.v1` is not touched by that path.

`sanitizeSettings` is the soft migration for settings: illegal spellings drop, the old `band` toggle becomes band level 0, a legacy `latch` field is ignored (Sustain is never persisted). A future migration reads the old key inside `loadSettings` and writes the v1 envelope. Do not rename `touchChord.settings.v1` or `touchChord.library.v1`. Saved data from v112.3 still loads; `tests/unit/persistence.test.js` uses `tests/unit/v112.3-localStorage.json`.

A first visit (no settings key) opens Kids (`style: "kids"`, `expert: false`), except `?test=1` without `&kv=1`, which opens the full app so the suites stay on Expert. `shared.firstFresh` marks that visit. The tour runs only when that flag is set and `touchChord.tour.v1` is not `"done"`.

## tools/

Run these from the repo root.

| Script | What it does |
| --- | --- |
| `tools/tcversion.py` | The scheme. `python3 tools/tcversion.py next` prints the next version. `check <version>` exits 0 when it is `YYYY.MM.DD.N` |
| `tools/bump-version.py` | `python3 tools/bump-version.py --today` or an explicit version. Rewrites `APP_VERSION`, `BUILD_ID`, and `APP_BUILD` in `js/version.js`, and every `?v=` in `index.html`, `css/*.css`, `js/**/*.js`, and `manifest.webmanifest`. Refuses a version that does not sort after the current one. Looks at this checkout, `origin/develop`, and `origin/main`, and takes the next counter after the highest |
| `tools/check-version.py` | Fails if any import or link in those same trees is missing `?v=APP_VERSION`, if `BUILD_ID` differs from `APP_VERSION`, if `sw.js` is registered without the query, or if the version is not `YYYY.MM.DD.N` |
| `tools/check-bump.py` | `python3 tools/check-bump.py origin/develop`. When `index.html`, `sw.js`, `manifest.webmanifest`, `css/`, `js/`, `fonts/`, or `images/` differ from the base, `APP_VERSION` must be higher. Docs, tests, and workflow-only diffs pass without a bump |
| `tools/stamp-build.py` | Deploy copies only. `python3 tools/stamp-build.py <site dir> <sha>` sets `BUILD_ID` to `APP_VERSION-<7 char sha>` and rewrites `?v=` in `index.html`, `css/`, `js/`, and the manifest. Adds `<meta name="tc-build">`. Refuses to stamp a tree that is already stamped. Never run it on the repo |
| `tools/write-build.py` | Rewrites only the `APP_BUILD` line. Left over from APK packaging. Do not add a caller |
| `tools/howto-shots.cjs`, `tools/howto-webp.py` | Rebuild the How to images under `images/howto-*.webp` |
| `.github/dev/inject-dev-badge.py` | Dev publish only. Inserts the DEV badge and a noindex robots tag. The production job fails if that badge is present |

## Versioning

`APP_VERSION` in `js/version.js` is the number in the gear menu and the `?v=` on every local URL. Since 21 Nov 2026 it is the build date plus a counter: `YYYY.MM.DD.N`. The first build of a day is `.1`, the next is `.2`. `MM` and `DD` are two digits, `N` has no leading zero, and the date has to be a real date. Legacy `112.16` and earlier sort before every date version (`tools/tcversion.py` `key`).

`BUILD_ID` equals `APP_VERSION` in the repo. A deploy stamps the copy so each publish, including a JS-only or CSS-only one, is a new `sw.js?v=BUILD_ID` and a new cache. `APP_BUILD` is the Settings "Build …" string. Web builds keep `<APP_VERSION>-web`.

**Rule.** Every pull request into `develop` bumps the version, including a docs-only or test-only change, so dev builds stay in order. The command is `python3 tools/bump-version.py --today`. `check-bump.py` currently enforces the bump only when the app paths above changed; the rule is stricter than the script. Run the bump anyway.

If `origin/develop` moved and now carries your number or a higher one, merge `develop` and run `--today` again. The script takes the next free counter after this checkout, `origin/develop`, and `origin/main`.

A release into `main` does not bump again. develop's last number is already above `main`. The production deploy runs `check-bump.py` against the previous `main` commit and refuses an app-file change that did not bump.

## CI and GitHub Pages

Node 20 in every workflow. `tests/ci/README.md` notes that the unit runner breaks on Node 24.

`.github/workflows/pr-checks.yml` is the gate for a pull request into `develop` or `main`:

- `unit` — `node --test tests/unit/*.test.js`
- `version` — `check-version.py`, then `check-bump.py origin/<base>`
- `smoke` — `npm ci`, Chromium, `node tests/ci/smoke.mjs`

`.github/workflows/deploy-web.yml` runs the same three jobs on a push to `develop` or `main`. A failed job stays red and the deploy is skipped.

- Push to `develop`: copy the tree, inject the DEV badge, `stamp-build.py`, push that copy to `main` on `DigitalFarmer420/touch-chord-dev`. Pages serves https://digitalfarmer420.github.io/touch-chord-dev/. Dev is a separate repository because one Pages site cannot host both.
- Push to `main`: the same gate, plus `check-bump.py` against `github.event.before`, then a Pages artifact with no DEV badge. https://digitalfarmer420.github.io/touch-chord/.

`.github/workflows/tests.yml` is the legacy job. It runs the version check and `npm run test:unit` on pull requests, and `npm run test:smoke` (`tests/e2e/run.cjs`) only when the pull request is `develop` into `main`. It is not the required gate. A red `tests` job there does not block a `develop` merge when `pr-checks` is green.

The dev site may serve a same-version tree after a stamp: `BUILD_ID` carries the commit, so an installed copy still updates. Do not commit a stamped `BUILD_ID`.

## Known issue: `?v=` and `tests/`

`bump-version.py` and `stamp-build.py` rewrite `?v=` in `index.html`, `css/`, `js/`, and `manifest.webmanifest`. They do not walk `tests/`. `check-version.py` does not scan `tests/` either.

A publish therefore restamps every module URL under `js/` and leaves `tests/` as it was in the repo. That is fine for the site (the suite does not run from the Pages copy), and it is a trap in the repo: a unit test that hardcodes `?v=` keeps the old number after a bump. `tests/unit/gtrname.test.js` imports `js/theory/spelling.js?v=2026.11.27.6` while `APP_VERSION` has moved on. Other unit tests import with no query (`gtr.test.js`, several `rd*.test.js`), which Node allows and the version check does not see.

**Rule.** New and touched unit tests import with `?v=${APP_VERSION}` read from `js/version.js`, the same way `tests/unit/validate.test.js` does. Do not paste a literal version into `tests/`. Fixing the stamp scripts to rewrite `tests/` is still open; until that lands, a bump will not repair a hardcoded tag.
