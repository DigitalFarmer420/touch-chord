# Touch Chord: architecture (modular build, from v112.3 / 6d36a4f)

Static site, no build step. GitHub Pages serves the files as they are:

```
index.html          markup only (+ the song-contract JSON data block #songSchemaJson, which the Upload prompt reads)
css/*.css           8 plain CSS files, linked in this order (the v112.3 cascade order; order matters, later rules win):
                    base, layout, topbar, strip, panels, keyboard, modes, dialogs
js/boot-early.js    classic script in <head>, runs before first paint (text scale, tc-boot flash guard,
                    iOS audio session, size classes, Simple before paint)
js/main.js          <script type="module">: the entry point
js/**               ES modules (see the map below)
images/             How to pictures
tools/              bump-version.py, check-version.py
```

## Module map

```
lines  file
   672  index.html
    63  css/base.css
   258  css/dialogs.css
   124  css/keyboard.css
   168  css/layout.css
   669  css/modes.css
   364  css/panels.css
    84  css/strip.css
   214  css/topbar.css
   294  js/audio/band.js           Band: drums and groove per style, the beat scheduler.
    43  js/audio/bass.js           Band bass lines (bass, sub, walking-bass helpers).
    56  js/audio/effects.js        Impulse response, soft clip, warmth curve, pulse wave.
   545  js/audio/engine.js         ChordAudio: AudioContext, master chain, mix / cutoff / reverb / delay / warmth, play / morph / stop chords, voice limit.
    14  js/audio/index.js          Builds the one ChordAudio api (window.ChordAudio) and its Band.
   668  js/audio/synths.js         Voices: piano, e-piano, strings, pad, reed, bell, and the per-style voices (makeVoice, makeStyleVoice).
   100  js/audio/unlock.js         iOS audio unlock: silent audio loop, playback session, first-tap unlock.
    44  js/boot-early.js
    92  js/keys.js                 The current key: lock key, key spellings, key picker data (keyRootName, modeKey, setKeySpell...).
   145  js/kids.js                 Kids style: the one-chip Kids strip, Kids key control (kidKey / wireKidKey).
   317  js/loop.js                 Phrase loop: record / play / clear, the scheduler and BPM.
   147  js/main.js                 Entry point: loads every module, runs the boot steps in the v112.3 order, final boot (saved settings, first song, tour), deliberate globals, test hooks with ?test=1.
   100  js/settings.js             Applies loaded settings to the UI (applySettings, markOn) and the toast.
    24  js/songs/kids-songs.js     Kids lyrics and Kids song keys.
   188  js/songs/library.js        My songs library (touchChord.library.v1): storage, open, versions, delete, list.
   123  js/songs/magic.js          Magic Next (one chord per tap).
    60  js/songs/playalong.js      Play along: advance on the marked key / chip.
   471  js/songs/playback.js       The progression player: walk, Play song, step state, song key, progSet.
   179  js/songs/presets.js        Built-in progressions (PROGRESSIONS: every style + Kids songs) and their parsing.
   167  js/songs/song.js           The loaded uploaded song: steps, key, lock, next step.
   510  js/songs/upload.js         Upload: AI prompt text, schema, answer parsing and validation, load flow.
   252  js/state.js                One shared app state: `state` (chord / key / style / settings), `loop` (phrase loop), `shared` (mutable values more than one module writes) and persistence (localStorage keys unchanged from v112.3: touchChord.settings.v1, see STORE_KEY).
   113  js/styles.js               Style presets (sound, FX, warmth per style) and the Yoga palette gate.
    90  js/test-hooks.js           window.__* helpers for the Playwright suites. Loaded only with ?test=1 (dynamic import from main.js).
   145  js/theory/chords.js        Chord intervals, tones, symbols, buildChord, bass note.
    26  js/theory/index.js         The Theory object (window.Theory) built from the theory modules.
    61  js/theory/keys.js          Scale degrees, roman numerals, degree chords.
    33  js/theory/names.js         Enharmonic / clean root spellings used by the UI.
    46  js/theory/quality.js       Chord quality mapping (type + extensions) and pitch-class helpers.
    96  js/theory/spelling.js      Note letters, spelling of roots / intervals / chord tones, accSym (display accidentals).
    36  js/theory/voicing.js       Voicings (drop / low / close / high / bright) and voiced MIDI notes.
   164  js/ui/gear.js              Gear (Config) menu: volume, band, toggles, factory reset.
   122  js/ui/hints.js             Play along hint pill (placement, misses, timers).
   158  js/ui/keyboard.js          Keyboard window (which octave shows), Kids key placement and the Kids solo note.
   221  js/ui/keychip.js           Key chip / key row (Key chip hidden in every mode since the v113 (5) port; Full uses #kidKey).
   157  js/ui/layout.js            Simple mode, controls drawer / tabs, size-class changes.
   122  js/ui/lyrics.js            Two-row lyrics (uploaded songs) and Kids lyrics.
   295  js/ui/next.js              Next-chord marks: lookahead, next hint arrow, Kids gold pad / key.
   129  js/ui/nowbox.js            Now box: chord symbol and its fitting.
   566  js/ui/pads.js              The chord keyboard: layout spec, pads / keys, pointer input, sounding fingers, haptics.
   106  js/ui/palette.js           Chord types / extensions palette holds.
   220  js/ui/progbar.js           Progression picker (#prog): placement, name fitting, Play / Next wiring.
    26  js/ui/pulse.js             Tap flashes (Kids gold tap, full-mode tap pulse).
    90  js/ui/songbar.js           Song bar (uploaded song sections) and the upload active state.
   657  js/ui/strip.js             The chord table / scale strip: model, chips, taps, preview, fitting.
   180  js/ui/sustain.js           Sustain button and the sustain pool.
   101  js/ui/tour.js              First-launch Kids tour.
   340  js/ui/upload-dialog.js     Upload song dialog: prompt copy, paste, check, load, library list.
   160  js/ui/wire.js              Main event wiring (wire()): style row, sound tiles, sliders, controls.
     7  js/version.js              APP_VERSION (the one version constant) and the "Version x" label in the gear menu.
    18  tools/bump-version.py
     9  tools/check-version.py
 11649  total (v112.3 index.html: 11033)
```

## How the app starts

1. `boot-early.js` (classic, synchronous) sets the size classes and `tc-boot` before first paint.
2. `main.js` is a module (deferred: it runs after the whole document is parsed, before DOMContentLoaded).
   Importing it loads every module. Module bodies only *declare* things (functions, constants, `var`s):
   theory/* and audio/* build their objects at load (pure, self-contained, like the old IIFEs).
3. `main.js` then calls each module's `boot()` / `bootN()` step **in the exact order the old single script ran its
   top-level statements** (DOM lookups, listeners, initial values), and finally its own `boot()` (load saved settings,
   render, first song, tour). Listener registration order is therefore unchanged.
4. With `?test=1`, `main.js` also does `import("./test-hooks.js")` and installs the `window.__*` test helpers.
   Without `?test=1` that file is never loaded.

## State model

- `state.js` → `state`: the app state object from v112.3, unchanged (type, extensions, voicing, key, style,
  sound, simple, playAlong, paHints, ...). Modules mutate its properties directly, as before.
- `state.js` → `loop`: the phrase-loop state.
- `state.js` → `shared`: every top-level variable that **more than one module assigns** (ES imports are read-only,
  so these live as properties: `shared.U` = the loaded uploaded song, `shared.LIB` = the My songs library,
  `shared.lockKey`, `shared.kbWinLow`, sustain pools, timers, ...). Each field is commented with its owner module.
- A variable written by only one module stays in that module; other modules import it and read the live value.
- Persistence lives in `state.js` (factoryDefaults, sanitizeSettings, loadSettings, collectSettings, saveNow,
  scheduleSave) with the same localStorage keys as v112.3:
  `touchChord.settings.v1` (settings, `{v:1, settings}`), `touchChord.library.v1` (My songs, songs/library.js),
  `touchChord.tour.v1` (tour done, ui/tour.js), the upload store / flag keys in songs/upload.js. Saved data from
  v112.3 loads unchanged (checked: see PROGRESS.md).

## Globals

No hidden globals. Deliberate ones, all kept from v112.3 for the console and the test suites:
`window.Theory` (theory/index.js), `window.ChordAudio` + `window.__tcAudioWake` (audio/index.js; the engine's
visibility listener calls __tcAudioWake), `window.APP_VERSION`, `window.accSym` (main.js),
`window.tcApplySizeClass`, `tcRaw`, `tcEnv` (boot-early.js, classic script). With `?test=1` only:
`window.__prog, __progApi, __band, __nx, __la, __playAlong, __paHint, __tour, __fxTap, __kidsTap, __kidsPads,
__kbWin, __magic, __applySongKey, __lyr2, __kidsLyr, __upload, __haptic` (js/test-hooks.js).

## Versioning and cache busting

- One constant: `APP_VERSION` in `js/version.js` (shown as "Version x" in the gear menu).
- Every local URL carries `?v=<APP_VERSION>`: the CSS links, boot-early.js and main.js in index.html, the How to
  images, and **every import specifier** in every module (`import { state } from "../state.js?v=112.3"`).
  A module's identity is its full URL, so all imports of one file must use the same `?v=` (otherwise it would load
  twice with two copies of its state). We chose queries over an import map so that Safari < 16.4 keeps working.
- To release a new version: `python3 tools/bump-version.py 112.4` (rewrites APP_VERSION and every `?v=`), then
  `python3 tools/check-version.py` (fails on any stale or missing `?v=`).
- The DEV badge (`.github/dev/inject-dev-badge.py`) only edits `</head>`, `<title>` and `</body>` of index.html; it
  works unchanged with this structure (checked on a copy).

## How to add a feature

1. Pick the module by area (ui/* for screen parts, songs/* for song data and playback, audio/* for sound,
   theory/* for pure music logic, state.js for anything saved). New area → new file; keep it focused.
2. Import what you need explicitly with the same `?v=` as everywhere else
   (`import { state, shared } from "../state.js?v=112.3"`). Export what other modules need.
3. A value several modules must **assign**: add it to `shared` in state.js (with an owner comment). A value only you
   assign: keep it in your module and export it (readers get the live value).
4. One-time setup (DOM lookups, listeners): put it in an exported `boot()` and call it from `main.js` in the right
   place in the boot order (before main's own `boot()` if the first render needs it).
5. A new saved setting: add it to factoryDefaults / sanitizeSettings / collectSettings (state.js) and
   applySettings (settings.js). Never rename an existing storage key.
6. Test helper: add a `window.__x` in js/test-hooks.js (only loaded with `?test=1`).
7. New file → no index.html change needed (it's reached via imports). New CSS file → add a `<link>` in index.html in
   the right cascade position, with `?v=`.
8. Run `python3 tools/check-version.py`, then the suites (see PROGRESS.md for the commands).

## How this was produced

The split was mechanical, so behaviour is identical: a Babel-based tool (kept outside the repo at
/workspace/chord-touch/modular/tools/split.js with the module map tools/layout.js) resolved every top-level binding
of the v112.3 script, assigned each top-level statement to a module by line range, generated the imports/exports,
moved cross-module-assigned variables into `shared`, and turned top-level executable statements into ordered boot
steps. Function bodies are the v112.3 code, re-indented by two spaces (the old IIFE level), with `x` → `shared.x` for the 30 shared variables; nothing else in them changed.
