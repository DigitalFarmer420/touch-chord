# Frontend standards

How the screen is built today, and the layout rules every UI change follows. Data, songs, theory, storage keys, and CI are in [backend.md](backend.md).

## Architecture

The page is static. `index.html` is markup. The two `<script type="application/json">` blocks (`#songSchemaJson`, `#songSchema13Json`) are the upload contracts, read by `js/songs/upload.js`. Stylesheets are plain CSS, linked in this order (later files win):

`fonts.css`, `base.css`, `layout.css`, `topbar.css`, `strip.css`, `panels.css`, `keyboard.css`, `modes.css`, `dialogs.css`, `fit.css`, `simpleday.css`, `kids.css`, `expert.css`, `modesheet.css`, `simplepad.css`, `guitar.css`, `look.css`.

`look.css` is last. Every selector in it is scoped so it cannot match Kids (`html:not(.kv)` or `:where(html:not(.kv))`). `tests/unit/look-v4.test.js` fails if a selector there drops that guard.

Startup:

1. `js/boot-early.js` (classic, in `<head>`) sets the size class, `--tx`, `--tc-ih`, and the early `simple` / `kv` / `kv-lamp` classes before first paint.
2. `js/main.js` is a module. Importing it loads every module. Module bodies declare functions and build the pure objects (`Theory`, `ChordAudio`).
3. `main.js` then calls each module's `boot()` in the original order, then its own `boot()` (saved settings, first song, tour).
4. `?test=1` dynamically imports `js/test-hooks.js` and installs `window.__*`. Without that flag the file is never loaded.

| Directory | What it owns |
| --- | --- |
| `js/ui/` | Panels: chord grid (`strip.js`), piano (`pads.js`, `keyboard.js`), Now box, lyrics, controls, guitar screen (`guitar.js` draws, `gtrmath.js` decides) |
| `js/ui/touch.js` | Touch-to-sound with no DOM. Every keyboard view calls `soundFinger` / `liftFinger` |
| `js/expert/` | Expert DOM (`ui.js`) and the pure mode model (`model.js`) |
| `js/kids/` | Kids screens (`view.js`), pad rows (`grid.js`), piano range (`range.js`). `js/kids.js` is the Kids style strip on the grown-up page |
| `js/instruments/` | Profiles, shape tables, resolver. No DOM |
| `js/audio/` | The engine. UI code calls it; it does not call UI |
| `css/` | One file per surface. A new file needs a `<link>` in `index.html` at the right point in the cascade, with `?v=` |

Size classes on `<html>`, set by `window.tcApplySizeClass`:

- `sz-compact` when width < 600, or landscape and height < 500. `sz-regular` when width ≥ 744 and height ≥ 600 (744 is iPad mini portrait). Anything else is `sz-medium`.
- `lay-phone-port`, `lay-phone-land`, `lay-pad-port`, `lay-pad-land` from that size and the orientation.
- Mode classes: `expert`, `simple`, `kv` (Kids view), `kv-lamp`, `gtr` (Guitar tab).

Past the iPad reference (1180×820 landscape, 820×1180 portrait) the page uses CSS `zoom` of `min(width / reference width, height / reference height)`. At zoom 1 nothing is written. `window.tcVW` / `window.tcVH` and the patched `getBoundingClientRect` stay in page pixels while zoomed. UI code reads the viewport through `tcVW` / `tcVH`, with `innerWidth` / `innerHeight` only as the fallback when those functions are missing. `tests/unit/flowlayout.test.js` locks this.

## Naming

Files are short and lowercase: `strip.js`, `guitar.js`, `boot-early.js`, `upload-dialog.js`. Functions are camelCase. DOM updates are `paint*` (`paintSuggestions`, `paintSustainBtn`). One-time setup is `boot()`.

CSS classes use a short prefix for the surface: `ss-` chord grid, `pg-` progression bar, `kk-` key stepper, `kv-` Kids view, `x-` Expert, `gtr-` guitar cards, `cfg-` config menu. Element ids are mostly camelCase (`#suggest`, `#sustainBtn`, `#kidKey`). Expert ids are `x` plus a name (`#xPlay`, `#xSrc`, `#xCtl`).

`state` fields are camelCase (`keyRoot`, `playAlong`, `keySpell`). A field written by more than one module lives on `shared` (`shared.U`, `shared.lockKey`, `shared.kidsView`), with a comment naming the owner. A field written by one module stays in that module and is exported; readers see the live value.

Every local import and stylesheet link carries `?v=` equal to `APP_VERSION`. A module imported under two different queries loads twice and splits its state. `python3 tools/check-version.py` fails a stale or missing tag in `index.html`, `css/`, and `js/`.

## State and storage

`js/state.js` exports:

- `state` — the chord, key, style, and settings the UI reads
- `loop` — phrase-loop record / play
- `shared` — the cross-module mutables
- `fingers` — pointers currently holding a key

Modules assign properties directly. There is no store object and no reducer.

Persistence is `localStorage`. The settings envelope is `{ v: 1, settings }` under `touchChord.settings.v1`. A missing key, bad JSON, or a `v` other than 1 loads factory defaults. `sanitizeSettings` drops unknown enums and illegal `keySpell` entries, and maps the old `bandLvl` field onto `band`. The comment in `loadSettings` is the migration point: read an older key there and write the v1 shape. Do not rename a key that already has user data.

The full key list, including the library and the one-time upload migration, is in the backend standard. The UI-owned keys are `touchChord.tour.v1` (`"done"`), `touchChord.expert.v1`, `touchChord.simpleLook.v1`, `touchChord.notes.v1`, and `touchChord.gtrTab.v1` (`"piano"` or `"guitar"`).

A new saved setting is added in all of these, in the same change: `factoryDefaults`, `sanitizeSettings`, and `collectSettings` in `state.js`, and `applySettings` in `js/settings.js`. Chord-type holds and Sustain are momentary and are not stored.

`boot-early.js` reads `touchChord.settings.v1` itself so Simple, Kids, and Lamp can be on before first paint. Keep that read in agreement with `loadSettings`.

## Events

Modules talk by calling each other and by writing `state` / `shared`. Two window `CustomEvent`s exist:

| Event | Dispatched by | Detail | Listeners |
| --- | --- | --- | --- |
| `tc:transport` | `js/songs/playback.js` | `{ state }` — `"idle"`, `"playing"`, or `"paused"` | Expert play button, `js/offline.js` (apply a waiting service worker when playback is idle or paused) |
| `tc:update-ready` | `js/offline.js` | none | the page, when a new worker is waiting and this page already has a controller |

A new cross-module signal that is really shared state goes on `shared`. A new `tc:` event is for something the service worker or a window listener must see without importing the module.

Deliberate globals: `window.Theory`, `window.ChordAudio`, `window.__tcAudioWake`, `window.APP_VERSION`, `window.accSym`, `window.tcApplySizeClass`, `window.tcVW`, `window.tcVH`, `window.tcZoom`. With `?test=1` only, the `window.__*` hooks in `js/test-hooks.js`.

## Audio from the UI

`js/audio/index.js` builds one `ChordAudio`, attaches the `Band`, and sets `window.ChordAudio`. UI files import `{ api as ChordAudio }` from `js/audio/index.js`.

Synthesis, the master chain, and `AudioContext` live in `js/audio/` (`engine.js`, `synths.js`, `effects.js`, `bass.js`, `band.js`, `unlock.js`). UI code calls the engine API. It does not construct nodes.

The shared play path is `js/ui/touch.js`: `computeSpec` builds the chord, `soundFinger(pointerId, keyOf(...))` starts it, `liftFinger` releases it. `pads.js` (grown-up piano) and the Kids piano both go through that, so timing and sustain match. `strip.js` previews a chord with `playChord` / `stopChord` and `protectGroup` / `fadeGroup`. `sustain.js` holds groups with `protectGroup`, `fadeGroup`, `stopChord`, and `clearProtected`. `guitar.js` strums with `pluck` per string into the `"gtr"` group, after `ensure()` and `stopChord`. Sliders and style changes go through `setSound`, `setVolume`, `setCutoff`, `setReverb`, `setDelay`, `setWarmth`, and `band.setStyle` / `band.setLevel` / `band.hush`.

Song playback (`js/songs/playback.js`) schedules chords and the Band, and is what dispatches `tc:transport`. A mode switch stops playback and calls `band.hush()`.

`recordEngineNote` in the engine is a null check unless `?test=1` attached the note log. Do not write to `window.__tcTest` from UI code.

## Flow layout

The screen is one grid, `#app`, with `overflow: hidden` and `height: min(100dvh, the measured visible height)`. Every child has `min-width: 0` and `min-height: 0`, so a long chord name or a tall lyric cannot force the grid larger than the screen. Viewport units in CSS go through `--tc-vw`, `--tc-vh`, `--tc-dvh`, and the rest of the `--tc-*` lengths in `css/base.css`. `--tc-dvh` is the smaller of `1dvh` and 1% of `--tc-ih`. `boot-early.js` sets `--tc-ih` from `innerHeight` (divided by the zoom), and refreshes it on `resize` and `visualViewport` resize, because some phone browsers report `dvh` taller than the area under the address bar.

Text scale `--tx` comes from `min(innerWidth, innerHeight)`. It scales labels. It does not change box sizes.

What is measured today:

- The chord grid (`#suggest`, `js/ui/strip.js` `fitStrip`) measures chip overflow and sets a shared scale. Five functional rows (borrowed, happy, scale, sad, tension). The grid tests also force 4 and 6 rows and require the grid to end at or above the piano.
- The Now symbol (`fitNowSymbol` in `nowbox.js`) shrinks to the card's measured box.
- Guitar fret spacing in landscape (`landFret` in `guitar.js`) is `(panel height − chrome) / 4`. Landscape and iPad diagram widths in `diaOpts` are still fixed (86 phone landscape, 150 iPad landscape, 190/120 iPad portrait Now/Next) and iPad portrait fret heights are still 49 and 30. On iPad landscape only, `capPadLand` stops the fret height at 1.3 times the string spacing.
- Phone portrait measures the guitar panel (`measurePort`). Now and Next are squares from the smaller of the free height and half the width. Next is capped at 0.84 of Now and is at least 2px shorter. CSS uses `--gtr-now` and `--gtr-next` with `aspect-ratio: 1 / 1`. The fret height stays between 0.9 and 1.18 times the string spacing (`portInk`). The Guitar smoke check accepts a portrait Now ratio from 0.8 to 1.25.

**Rule.** Every panel fits the space it is given, at any screen size, with any number of chord rows, with a song or without one, with lyrics or without them. The panels are the chord grid, the piano, the guitar cards, the lyrics, and the controls.

Sizes come from the measured space, using whichever is smaller of the width and the height available to that panel. Do not add a fixed pixel width or height for a panel, a diagram, a fret, or a row. A floor that protects a tap target is allowed when the measured size would fall below it; the size above that floor still comes from the measured space.

Nothing overflows its panel, and nothing overflows the screen. The page does not scroll. A lyric line that is longer than its row ellipsizes or scrolls inside the lyric box; the box stays inside the song card.

Aspect ratios that stay locked:

- A guitar diagram is about 1:1 (the smoke allows 0.8 to 1.25 on the portrait Now and Next stacks).
- Fret height is at most 1.3 times the string spacing, on every diagram, not only iPad landscape.
- The Next card is never bigger than the Now card.

`#app { overflow: hidden }` is not a substitute for a panel that fits. Clipping a control that the player cannot reach still fails the rule.

## Test viewports

**Rule.** Every UI pull request is checked at these sizes, in a browser, with a song and without one, and with the Guitar tab on where that surface exists:

| Size | Device class |
| --- | --- |
| 360×640 | phone portrait |
| 384×700 | phone portrait |
| 412×760 | phone portrait |
| 412×915 | phone portrait |
| 780×360 | phone landscape |
| 820×1180 | iPad portrait |
| 1180×820 | iPad landscape |

Check Expert, Simple, and Kids. Kids must look the same as before the change (see Kids mode).

`tests/ci/smoke.mjs` already walks many of these for specific checks (chord grid against the piano, Now against the song card, Guitar tab at 360×780 / 780×360 / 820×1180 / 1180×820, Simple phone-portrait budget at 360×640).

`node tests/ci/flow-layout.spec.mjs` is the required check for this table. The smoke job in `pr-checks.yml` and `deploy-web.yml` runs it after `smoke.mjs`. It opens Expert, Simple, and Kids at the seven sizes, with Progressions and Song, Piano and Guitar, Anh Đã Ổn Hơn (Eb, with lyrics) and All I Ask (a long chart), and with the upload dialog, style menu, key sheet, sound sheet, How to menu, and mode sheet open. A hit fails the job unless its id is in `tests/ci/flow-layout.known.json`. An id that nothing hits also fails, so a fix deletes its line.

The check ignores a line an ancestor already clips, the 1px visually-hidden Expert song title on phones, piano-key overlaps (including the key sheet's mini keyboard), and the Lock docked inside the progression bar or the song bar. A label may be 4px over `clientWidth` before it counts as clipped (the border). Step badges may cross the grid edge by up to 12px; they still have to stay on screen.

Verified after #62 and #63: Guitar cards stay inside the panel, and Song mode no longer shows Jam. Still listed in the known file, and not edited here:

- Kids pads, `scrollWidth` 8px over `clientWidth` at every size. Kids does not change without Vinh's OK.
- The ? button 5px over its box at 780×360, and the How to menu, style menu, and key-sheet close overlapping the control under them.

## Real devices

The layout viewport is the visible area, after browser chrome. `boot-early.js` records that as `--tc-ih` from `innerHeight`. Samsung Galaxy S25 in Brave, landscape, reports `1dvh` about 56px taller than `innerHeight` (the address bar). The GRID smoke check replays that by adding 56px to `--tc-dvh0` at widths around 915 and heights 330, 345, and 360. A layout that trusts `100dvh` and ignores `--tc-ih` paints the piano under the browser chrome. Phone portrait on the same device is in the 360–412 wide class; the chrome still costs vertical space, so 412×915 in a desktop browser is taller than the S25 shows the page.

`visualViewport` resize (address bar showing and hiding) must keep running `tcApplySizeClass`. The listener is in `boot-early.js`.

## Accessibility

Controls that the player acts on have an `aria-label` (or visible text that is the name). The chord grid sets one per chip and per note. Guitar diagrams are `role="img"` with an `aria-label` of the chord plus the grip. Toggles use `aria-pressed` or `aria-checked`. The transport button's label comes from `playButtonLabel()`: "Play song", "Pause", "Resume". Dialogs use `role="dialog"`. `#symbol` is `aria-live="polite"`.

**Rule.** Tap targets are at least 44px on the hit axis where the screen has room. `css/fit.css` already does this with a real 44px box on iPad and on the phone-portrait control column, and with a transparent `::after` when the painted control is shorter (phone landscape cannot give every row 44px of paint without losing the piano). A new control uses a 44px box, or a 44px hit area that does not cover a neighbour. Do not shrink an existing 44px target to make a panel fit; take the space from a fluid row.

**Rule.** Text and the control that carries it contrast at at least 4.5:1 against the surface behind them. The look tokens in `css/look.css` (`--tc-ink` on `--tc-surface`, `--tc-gold` for the hint) are the palette to stay inside. There is no contrast test in the suite; check the pairs you change.

`prefers-reduced-motion` is already honoured for the strip pulse, lyric roll, next-chord arrow, and the guitar fret slide. A new animation follows that.

## Music text

Chord names use the current key's spelling. `keyRootName` in `js/keys.js` reads `state.keySpell["<pc>major"]` or `"<pc>minor"` when that spelling is legal, and otherwise the default spelling for that pitch class. Simple always uses the default. `keyRootSpell` turns that name into the accidental form `Theory.scaleDegrees` / `degreeChord` expect. `computeSpec`, the palette, and jam all pass `keyRootSpell(modeKey())` (or the active key) into theory. Display then goes through `accSym` (`♯` / `♭`).

**Rule.** A label shows the song's chord name or the pad's chord name. It does not show the name of the guitar shape the resolver matched. `chordDisplayName` in `js/ui/gtrmath.js` is that label: `chipLabel`, or `qualityLabel`, or `symbol`, then `accSym`. The grip is a separate line, `voicingLabel`: `"Open"` or `"A-shape · 3fr"`. A new card, hint, or lyric cue uses `chordDisplayName` (or the same inputs) for the chord, and `voicingLabel` only for the grip.

## Sustain

`#sustainBtn` is one button, grid area `sus`. Where it sits today:

| Layout | Sustain |
| --- | --- |
| Expert, phone and iPad | left column (`sus` before the controls or the grid) |
| Simple phone portrait (`css/fit.css`) and Simple iPad (`css/simplepad.css`) | left column |
| Classic phone landscape and iPad landscape (`css/layout.css`) | left rail, bottom |
| Classic phone portrait and iPad portrait | right column (`pal pal sus`) |

Kids has no Sustain button.

**Rule.** Sustain stays on the left. A layout you touch keeps it in the left column, including the classic portrait grids that still paint it on the right. Do not add Sustain to Kids.

## Kids mode

Kids is a separate screen: `html.kv`, `js/kids/view.js`, `css/kids.css`, the songs in `js/songs/kids-songs.js`. `look.css` does not restyle it. The LOOK smoke check fails if any `look.css` rule matches an element on the Kids hello, song picker, or song screens. The Kids sound path goes through `strip.js` / `touch.js`; `kids/view.js` does not play audio itself.

**Rule.** Kids mode does not change without Vinh's explicit OK. That covers `js/kids.js`, `js/kids/`, `css/kids.css`, the Kids songs, the Kids piano range, and the Kids layout. A change that shares a file with Kids (a `css` edit, a `touch.js` edit) has to leave the Kids screens pixel-identical unless that OK is in the pull request.
