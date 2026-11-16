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
