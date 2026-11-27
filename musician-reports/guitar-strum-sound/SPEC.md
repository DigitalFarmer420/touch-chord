# Guitar strum sound: diagnosis and fix spec (for Crash)

Author: Musician (music/QA). Read-only investigation, Fri 27 Nov 2026 (PST).
Code read: deploy clone `jam-2026.11.27.2/site` (develop@6e8a151, .20) and a fresh scratch clone of
`DigitalFarmer420/touch-chord` develop@864b299 (`./src`). Between the two, `js/audio/*`, `js/styles.js`,
`resolve.js`, `profiles.js` differ only in `?v=` import strings, so line numbers below hold for both.
`js/ui/guitar.js` moved: `strum()` is at .20 :388-397, develop@864b299 :360-369 (cited as develop).

Nothing here is a listening result. All numbers are offline renders (OfflineAudioContext, 48 kHz, headless
Chrome) through the app's real engine and master chain. No device, no APK, no Safari/iOS run.

## 1. How it works now

### Guitar tab strum
- `js/ui/guitar.js:360-369` `strum(voicing)`: for each `voicing.midi[i]`, `ChordAudio.pluck(midi, {time: t0 + i*0.02, sound: state.sound, group: "gtr"})`.
  Fixed 20 ms per string, always low to high, no up-strums, no humanize. Called from the card tap at `guitar.js:536`.
- `js/instruments/resolve.js:211-218` `finish()`: `midi` = tuning+fret for each non-muted string, then **sorted by pitch**
  (`midi.sort`). Muted strings are skipped (good). String identity is dropped; for normal shapes pitch order = string order.
- `js/audio/engine.js:521-536` `pluck()`: one `makeVoice` per note with `short: true`, `velocity: 0.85` (fixed, per note,
  no `1/sqrt(n)` scaling), `engine: state.sound`, no bass.
- `js/audio/synths.js:537-542` `flavorFor()`: returns null when `spec.short` → **plucks never use the style voice**
  that the grid uses (jazz/rnb Rhodes, ballad pad, reggae skank, funk clav, country honky-tonk: `synths.js:532, 554-718`).
  `synths.js:215` also drops the style articulation (`art`, e.g. Kids "box") for short voices.
- Oscillators the strum actually uses (`synths.js:82-197`), chosen by the style's `sound` (`styles.js:28-45`):
  Pop/Country = piano partials (sine/triangle + hammer sine, `:82-119`); Jazz/R&B/Lofi = 2-op FM e-piano (`:120-145`);
  Ballad = 4 detuned **saws** (`:146-160`); Reggae/Yoga = 3 detuned **saws** (`:161-174`); Funk ("reed") = falls to the
  `else` **pulse wave** (`:191-196`); Kids = FM bell (`:175-190`).
- Envelope for short voices: linear attack 4-8 ms (40 ms for strings) (`synths.js:233-238`), then an exponential fall to
  1e-4 over `dur` = 0.2-0.6 s (`synths.js:259-270`; warm 0.34, piano 0.55, epiano 0.48, strings 0.6). Piano partials in
  short mode decay in 0.18-0.34 s (`synths.js:99`). Peak per engine `synths.js:217-226`. Filter per engine `synths.js:17-44`
  (follows the style's Cutoff, e.g. Jazz 0.42 → ~850 Hz).
- `guitar.js:365` calls `stopChord("gtr", …)` but `engine.js:512-519` only releases `!v.short` voices, so the previous
  strum is **never choked** (harmless today because it dies in <0.5 s; it matters once strings ring).
- Master bus (shared with the grid, keep it): `engine.js:135-208` bus(style trim) → dry/reverb(1.7 s noise IR)/dotted-8th
  delay → master 0.62 → compressor (-12 dB, 4:1) → warmth shelves + tanh → volume → soft clipper. Style trims
  `styles.js:49-50` (`STYLE_TRIM`, reggae 4.07, funk 4.60 …) were calibrated for the **style voices**, not for plucks.

### Chord grid tap (the reference)
- `touch.js:176/290/358-360`, `strip.js:152/160` → `engine.js:415-442` `playChord`: close voicing (`touch.js:108-110`,
  root position inside one octave) at `velocity = 1/sqrt(n)` (`engine.js:411-413`), **plus a bass note** C3-B3 (`touch.js:110`),
  held until the finger lifts (sustain stage `synths.js:312-337`) or the style voice (`synths.js:554-718`).

## 2. Why it doesn't sound like a guitar, or like the grid

1. **Wrong source.** It is the keyboard engine (piano partials, FM e-piano, raw detuned saws, a pulse wave) cut short.
   No plucked-string physics: no noise excitation, no pick position, no "higher harmonics die first" decay.
2. **Too short.** Measured dry Pop strum: -20 dB at 0.11-0.15 s, -60 dB at 0.42-0.48 s. A strummed guitar rings 1.5-3 s.
   It reads as a blip/"harp" arpeggio, not a ringing chord.
3. **Even 20 ms stagger, always down.** 100 ms for 6 strings with identical gaps and levels = mechanical arpeggio.
4. **Different voice from the grid.** In 6 of 9 styles the grid uses a style voice the strum never uses (point above).
5. **Loudness is not managed.** Fixed 0.85 per note, no `1/sqrt(n)`, but the style trim still applies. Measured (table 4.3):
   current strum vs grid ranges from **-7.1 dB (Country) to +2.3 dB (Reggae)**: too quiet in Pop/Country/Lofi, too loud in Reggae.
6. No body / tone shaping; on saw styles the raw saws go straight through the style cutoff.

Voicing is NOT the problem: the strum already plays the diagram's strings (muted ones skipped). Measured order
C 48-52-55-60-64, G 43-47-50-55-59-67, Am 45-52-57-60-64, F 41-48-53-57-60-65 (root lowest in all four).

## 3. The fix

### 3.1 Approach: Karplus-Strong, pre-rendered per note
Render each plucked note once in plain JS into an `AudioBuffer` (cached, LRU), play with `AudioBufferSourceNode`.
No AudioWorklet, so it behaves the same in Android WebView, Chrome and Safari. One shared tone chain per strum.

Drop-in module: **`dropin/guitar-pluck.js`** (in this folder) → copy to `js/audio/guitar-pluck.js`.
Parameters (all in `GTR`):

| What | Value |
|---|---|
| Excitation | one period of white noise (deterministic per note, mulberry32), one-pole LP coeff 0.45 |
| Pick-position comb | `e[n] - e[n - round(0.13*P)]` (pluck ~13% from the bridge) |
| Loop | delay N + two-point average (`bright` 0.5) + first-order allpass for exact tuning |
| Loop gain | `g = 0.001^(1/(f*T60))`, T60 2.4 s at E2 → 1.4 s at E5+ (log-interpolated) |
| Buffer | 2.6 s mono, DC-blocked, 80 ms cosine end fade, peak-normalised |
| Chain per strum | HP 75 Hz → peaking 140 Hz Q1.1 +4 dB (body) → LP 4.5 kHz closing to 2.6 kHz (τ 0.45 s) → gain → `this.bus` |
| Stagger | 12 ms/string, ±2 ms humanize (never reorders; min gap 4 ms), ±1.5 dB per string |
| Up-strum | reversed string order, -2 dB; auto-alternates down/up, back to down after 1.2 s gap |
| Level | `0.48 / sqrt(strings) / styleTrim * 10^(styleDb/20)` (dividing by the style trim makes it style-independent) |
| Re-strum | chokes the previous strum in the group: gain setTarget 0, τ 40 ms |
| Cache | 72 buffers max (~500 KB each at 48 kHz → ≤ ~36 MB worst case; typical use far fewer) |

One voice object per strum is pushed into `this.voices` with the usual contract (`release`, `cancel`, `fade`, `done`,
`short: true`, `gtr: true`), so `stopAll`, `enforceLimit` and the voice cap keep working; a strum costs 1 voice slot.

### 3.2 Exact code changes
1. **Add** `js/audio/guitar-pluck.js` = `dropin/guitar-pluck.js` (exports `GTR`, `ksRender`, `ksBuffer`, `installGuitarPluck`).
2. **`js/audio/index.js`** after the existing imports:
   ```js
   import { installGuitarPluck } from "./guitar-pluck.js?v=…";
   installGuitarPluck(ChordAudio);   // before `var api = new ChordAudio()`
   ```
3. **`js/ui/guitar.js`** replace `strum()` (`:360-369`):
   ```js
   // Per-style fine trim (dB) so the strum sits ~1 dB under a held grid tap (SPEC.md 4.3).
   var GTR_STYLE_DB = { pop: -2.3, jazz: 0.9, rnb: -0.1, ballad: -0.3, reggae: -0.6, funk: -0.2, yogaDeep: 3.2, country: -1.7, lofi: 2.8 };
   function stringMidis(v) {   // diagram strings, low E first, muted strings skipped (frets are absolute)
     var out = [];
     for (var i = 0; i < v.frets.length; i++) if (v.frets[i] != null) out.push(guitarProfile.tuning[i] + v.frets[i]);
     return out;
   }
   function strum(voicing) {
     if (!voicing || !voicing.frets) return;
     var notes = stringMidis(voicing);
     if (!notes.length) return;
     unlock();
     try { ChordAudio.ensure(); } catch (e) { return; }
     ChordAudio.strumGuitar(notes, { group: "gtr", styleDb: GTR_STYLE_DB[state.style] || 0 });
   }
   ```
   (`strumGuitar` chokes the previous "gtr" strum itself, so the old `stopChord("gtr")` line goes.)
4. **Pre-render** so the first tap never waits: at the end of `paintGuitar()` (`guitar.js:434`) for the Now and Next grips:
   ```js
   var idle = window.requestIdleCallback || function (f) { return setTimeout(f, 30); };
   idle(function () { try { ChordAudio.warmGuitar(stringMidis(nowGrip).concat(nextGrip ? stringMidis(nextGrip) : [])); } catch (e) {} });
   ```
   (`warmGuitar` only calls `ensureContext()`; it builds no graph, so it is safe before the iOS unlock gesture.)
5. Leave `pluck()`, `loop.js:128-131` ("loop-strum") and every grid path untouched. Kids is not affected (no Guitar tab change there).
6. Optional: ignore the style Cutoff for the guitar (the drop-in does: LP clamped 3-5 kHz), so Jazz/Ballad don't make it dull.

### 3.3 Unit tests to add (`tests/unit/`)
- `ksRender(48000, m)` for m = 40,45,50,55,59,64,69,76: f0 by autocorrelation within ±3 cents (measured: ≤0.07 c).
- Same seed → identical buffer (determinism); peak = 1; last sample = 0; no NaN.
- `stringMidis` of C/G/Am/F open + F E-shape returns the diagram strings in string order (values in §2).

## 4. Measurements (offline renders; scripts `harness/render.html`, `harness/run.cjs`; raw `measure.json`)

Method: new `ChordAudio` on an `OfflineAudioContext(2, 48 kHz)`, the style preset values from `styles.js:28-45` and
`STYLE_TRIM`, the real master chain. Grid = `playChord` close voicing + bass 48+root, held 1.5 s. Current = the exact
`strum()` loop. Proposed = `strumGuitar` (down, seed 1, styleDb 0). Chords C, G, Am, F (first grip). Loudness metric:
**max 400 ms window RMS, unweighted**, dBFS, mean of the 4 chords. (The v73 trims used A-weighted 400 ms loudness;
please re-check with that tool, it may shift a dB or two.) Kids not measured.

### 4.1 Envelope, Pop, dry (reverb/delay 0), relative to the loudest 10 ms frame
| | peak frame | -20 dB at | at +300 ms | at +500 ms | at +1 s | at +2 s | -60 dB at |
|---|---|---|---|---|---|---|---|
| Current strum | 50-120 ms | 0.11-0.15 s | -33 to -39 dB | -56 to -59 dB | silent | silent | 0.42-0.48 s |
| Proposed | 60-80 ms | 0.49-0.54 s | -10 to -11 dB | -15 to -18 dB | -32 to -34 dB | ~-60 dB | 1.79-1.87 s |

Proposed string onsets (ms): 0, 10.0, 25.9, 35.1, 48.9 (+62.0 for 6 strings). Down order C = 48,52,55,60,64;
up order C = 64,60,55,52,48. Re-strum at +500 ms: second strum onsets 500-558 ms (G up: 67…43); the choke of the
first strum is scheduled but its tail was not measured separately.
KS tuning error (8 notes E2-E5): -0.07…+0.02 cents. Render cost: **~1.0 ms per note** in headless desktop Chrome
(37 notes, after warm-up); a phone will be slower, hence the idle pre-render. Not measured on a device.

### 4.2 Peaks / clipping (full chain, all 9 styles × 4 chords)
Max peak: grid -10.2…-17.4, current -7.2…-15.4, proposed -10.1…-14.2 dBFS (6-string G and F included).
Samples ≥ 0.999: **0** in all 108 renders.

### 4.3 Loudness vs grid (max 400 ms RMS, dB; proposed at level 0.48, styleDb 0)
| style | grid | current (Δ grid) | proposed (Δ grid) | GTR_STYLE_DB (→ Δ -1 dB) |
|---|---|---|---|---|
| pop | -27.4 | -32.6 (-5.2) | -26.1 (+1.3) | -2.3 |
| jazz | -25.4 | -28.9 (-3.5) | -27.3 (-1.9) | +0.9 |
| rnb | -26.6 | -29.0 (-2.4) | -27.5 (-0.9) | -0.1 |
| ballad | -27.9 | -29.4 (-1.4) | -28.6 (-0.7) | -0.3 |
| reggae | -26.3 | -24.0 (+2.3) | -26.6 (-0.4) | -0.6 |
| funk | -25.3 | -26.3 (-1.0) | -26.1 (-0.8) | -0.2 |
| yogaDeep | -25.6 | -27.2 (-1.5) | -29.9 (-4.2) | +3.2 |
| country | -26.7 | -33.8 (-7.1) | -26.0 (+0.7) | -1.7 |
| lofi | -23.7 | -28.4 (-4.7) | -27.5 (-3.8) | +2.8 |
Spread vs grid: current 9.4 dB (-7.1…+2.3); proposed 5.5 dB without the table, ~0 by construction with it.
Target -1 dB because the grid is held and the strum decays; adjust by ear if it feels low.

## 5. Acceptance tests for the implementation
1. Envelope (dry Pop render, each of C/G/Am/F): peak within 100 ms of tap; -20 dB later than 0.4 s; T60 1.4-2.6 s; no hold/plateau.
2. Order/timing: down = diagram strings low E → high E, muted strings absent, root lowest pitch; gaps 8-16 ms; up = exact reverse;
   tap #2 within 1.2 s is up, after 1.2 s is down.
3. Loudness: per style, strum max-400 ms within -3…+1 dB of a held grid tap (same metric as 4.3, or A-weighted tool).
4. No clipping: 6-string chord (G, F barre) in Reggae and Funk (highest trims): 0 samples ≥ 0.999; peak ≤ -6 dBFS.
5. Re-strum: second tap 300 ms later; the first strum's gain is ≤ -40 dB 200 ms after the second tap.
6. CPU: 16 fast taps (8/s) on the Galaxy S25 APK: no dropouts; first tap after tab open is not late (pre-render done);
   `ChordAudio.voices.length` stays bounded.
7. Regression: grid, keyboard, Kids, Band, loop "strum" renders unchanged (byte-compare offline renders before/after).

## 6. Not tested
- **Nobody has listened** to the proposed strum. These numbers say it rings and decays like a plucked string at a matched level;
  whether it sounds like a guitar is for Vinh's ears (A/B page: `proto.html`).
- No real device, APK, Android WebView, Safari or iOS run; CPU on phones unmeasured.
- Loudness is unweighted RMS, not the A-weighted v73 method. Grid reference uses `buildChord` close voicings + bass C3-B3,
  approximating `kbPlace` (`touch.js:109`).
- Choke tail after re-strum not measured; Kids style not measured.

## Files
- `dropin/guitar-pluck.js` – drop-in module
- `proto.html` – live A/B page (current / proposed / grid, style picker). Serve this folder over http (it imports `./src`).
- `wav/pop-{current-strum,proposed-strum,grid}-{C,G,Am,F}.wav` – 48 kHz stereo, 3.2 s, Pop preset, full chain
- `harness/render.html`, `harness/run.cjs`, `measure.json` – how the numbers were made
