# Test-only note log (`?test=1`)

For headless transport checks (Test Engineer). Present only when the page is opened with `?test=1`.

There was no existing engine-call recorder that logged per-note on/off with audio-clock and wall times, so this is a new hook, not a wrapper around one. `window.__progApi` and `prog.log` still exist; they record scheduled steps (`{i, t, sym, tied, bars, ...}`), not individual MIDI note-on/off events.

## How to turn it on

Open the app with `?test=1` (the same flag the Playwright suites already use). `js/main.js` dynamically imports `js/test-hooks.js`, which calls `install()`. That is the only path that attaches the sink and creates `window.__tcTest`.

Without `?test=1`:

- `test-hooks.js` is not loaded
- `window.__tcTest` is not created
- `recordEngineNote` in `js/audio/engine.js` is a single null-check no-op (no allocations, nothing written to `window`)

## API

```js
window.__tcTest.noteLog
// array of { t, wallMs, type, midi, step, velocity }
//   t        AudioContext time of the event (scheduled start for "on", release/fade time for "off")
//   wallMs   performance.now() at the moment the hook ran
//   type     "on" | "off"
//   midi     MIDI note number
//   step     Play-song step index when the voice came from progSchedule, otherwise null
//   velocity voice velocity (0–1 range used by the engine)

window.__tcTest.clear()          // empties noteLog in place
window.__tcTest.transport()      // getTransportState() snapshot (see below)
```

`getTransportState()` (exported from `js/songs/playback.js`) returns:

```js
{
  playing,       // prog.playing
  si,            // next-to-schedule step index
  cur,           // currently sounding step, or -1 when stopped
  nextT,         // audio time of the next scheduled step
  stepCount,
  ctxState,      // AudioContext.state, or null before unlock
  currentTime,   // ChordAudio.currentTime(), or null
  magicPos,      // Next-walk position (this is where the next Play starts)
  groups         // number of currently tracked Play-song voice groups
}
```

There is no pause field: a second tap on Play calls `progStop()`, which hushes voices, clears groups, and sets `cur` to -1. `si` is left as-is, but the next `progPlay()` ignores it and starts from `progPlayStart()` (`magic.pos`).

## Hook point

`recordEngineNote` is called from the engine voice constructors and from `release` / `fade` in `js/audio/synths.js`:

- `ChordAudio.prototype.makeVoice` (classic voices) — `"on"` when the voice object is returned
- `voiceObject` (style voices from `makeStyleVoice`) — same
- `release` and `fade` on both voice shapes — `"off"` once per voice (`_noteOffLogged`)

`playChord` / `morphChord` / `pluck` pass `opts.step` through to the voice spec. `progSchedule` sets `step` to the Play-song step index. Keyboard taps, pad taps, and other paths leave `step` null. Band/drum notes that do not go through `makeVoice` are not logged.

## Unit tests

`tests/unit/notelog.test.js` checks that the hook is absent by default (`location.search` is empty in the node stub) and that `attachNoteLog` / detach record only while a sink is attached, without creating `window.__tcTest`.


## Pause / resume

`getTransportState()` now includes `state`: `"idle"` | `"playing"` | `"paused"`, plus `paused`, `offset`, `remaining`, `lyricLine`, and `bandBeat` when paused. The other snapshot fields from the note-log hook (`playing`, `si`, `cur`, `nextT`, …) are still there.

A `window` `CustomEvent` `tc:transport` with `{ detail: { state } }` is dispatched on every transition (Play, Pause, Resume, Stop). Play's `aria-label` (and `title` on `#prog .pg-song`) comes from `playButtonLabel()`: "Play song" idle, "Pause" playing, "Resume" paused, in Kids, Simple and Expert (phone and iPad). Icons and layout are unchanged.

### Play button

- Idle → Play starts from `progPlayStart()` (the Next walk position), as before.
- Playing → **Pause** (a second Play tap). Future (not-yet-started) nodes are cancelled; the chord that is sounding gets the engine's normal release (`stopChord` with the default envelope, the same as a chord change; N14), so nothing is held through the pause; the Band stops and remembers its beat. `cur`, step, lyric line, and offset into the bar are kept.
- Paused → Resume, with the rules below.
- Double-taps inside 280 ms are ignored.
- `document.visibilitychange` to hidden pauses a playing song and does not auto-resume when the tab is shown again (playback.js and wire.js both pause now; N16).
- `pagehide` with `persisted: true` (back/forward cache) pauses; `pagehide` without `persisted` (a real unload) still stops hard (gear.js `onPageHide`).

### Next while playing or paused (N15)

- While Play is playing or paused, the Next walk follows the play position: pausing sets `magic.pos` to the paused step + 1, so the next-chord hint and Next mean "the step after the paused one".
- **Paused → Next** sounds the step after the paused one once, with the normal Next ring and release (it is never held), and moves the pause point there. The transport **stays paused**, Play still shows ▶ with the label "Resume", and a later Play resumes from the start of that step (one re-strike). Repeated Next keeps walking while paused.
- On the last step, Next wraps to step 1 (index 0), as Next does when idle. `getTransportState()` reports `nextStep`, `fromTop` (the next Next goes back to the top) and `wrapped` (the last Next did) for the "↻ From the top" preview (N2, Front-End).
- **Playing → Next** stops Play (as before) and plays the step after the sounding one.
- **Idle → Next** is unchanged.
- Stop (from playing or paused) puts the walk back where it was before Play, so Pause → Stop → Play still starts where Play first started.
- The resume re-strike is written to `prog.log` (`resume: true`, `remaining`), so log-based timing is right and a second pause measures from the real bar start.

### Resume rules

- **(a)** Nothing changed (same song, key, style, mode, sound): re-strike the current chord with the same voicing for the remaining bar time; the Band resumes from the paused beat.
- **(b)** Key, style, mode, or sound changed, same song: replay that step from its start in the new sound.
- **(c)** Different song or progression: start at step 0.
- **(d)** `progStop()` from playing or paused always returns to idle, cuts sounding notes, hushes the Band, and clears the pause snapshot.

Policy helpers live in `js/songs/transport-policy.js` (`resumeRule`, `songIdentity`, `worldIdentity`, `barOffset`) so the rules can be unit-tested without Web Audio. Integration tests in `tests/unit/transport-pause.test.js` drive `progPlay` / `progStop` with a stubbed clock and assert each rule through the note-log hook (`attachNoteLog`).

# Offline service worker

**BUILD_ID (deploy stamping).** `js/version.js` exports `BUILD_ID`, equal to `APP_VERSION` in the repo (check-version enforces that). `deploy-web.yml` runs `python3 src/tools/stamp-build.py site <sha>` on the site copy for both dev and production, which sets `BUILD_ID = APP_VERSION-<short sha>`, rewrites every `?v=` tag to it and adds `<meta name="tc-build">` to `index.html`. `js/offline.js` registers `sw.js?v=` + `BUILD_ID`, and the worker names its cache from that query, so every deploy (even a JS- or CSS-only one) installs a new worker that waits for the next cold launch. `pr-checks` (`tools/check-bump.py`) still fails a PR into `main` that changes app files without bumping `APP_VERSION`. The production deploy runs that same check against the previous `main` commit. All network fetches of app files in `sw.js` use `cache: "no-cache"`.

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
