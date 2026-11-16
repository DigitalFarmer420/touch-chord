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
