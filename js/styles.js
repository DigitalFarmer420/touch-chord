// Style presets (sound, FX, warmth per style) and the Yoga palette gate.
import { api as ChordAudio } from "./audio/index.js?v=112.4";
import { setBpm } from "./loop.js?v=112.4";
import { VOICINGS, state, shared } from "./state.js?v=112.4";
import { paintBand } from "./ui/gear.js?v=112.4";

// ---- Warmth + factory style presets ----
export const WARMTH_DEFAULT = 25;

export function clampWarmth(v) {
  v = Math.round(Number(v));
  if (!isFinite(v)) v = WARMTH_DEFAULT;
  return Math.min(100, Math.max(0, v));
}

// 0..100 on the UI; audio takes 0..1.
export function setWarmth(v) {
  v = clampWarmth(v);
  state.warmth = v;
  var el = document.getElementById("warmth");
  if (el.value !== String(v)) el.value = String(v);
  el.setAttribute("aria-valuetext", String(v));
  ChordAudio.setWarmth(v / 100);
}

// Applied on Style change. Never touches Key, layout or the Next grid.
const STYLE_PRESETS = {
  pop:       { sound: "piano",   bass: true,  voicing: "close", cutoff: 0.75, reverb: 0.12, delay: 0.08, bpm: 112, warmth: 15 },
  // v68 Kids: "Bright and bouncy, like a music box." Bell top + soft pluck, short happy notes (art "box").
  kids:      { sound: "bell",    bass: true,  voicing: "close", cutoff: 0.78, reverb: 0.12, delay: 0.05, bpm: 100, warmth: 10, art: "box" },
  jazz:      { sound: "epiano",  bass: true,  voicing: "drop",  cutoff: 0.42, reverb: 0.32, delay: 0.22, bpm: 120, warmth: 55 },
  rnb:       { sound: "epiano",  bass: true,  voicing: "close", cutoff: 0.50, reverb: 0.36, delay: 0.24, bpm: 78,  warmth: 50 },
  ballad:    { sound: "strings", bass: true,  voicing: "close", cutoff: 0.40, reverb: 0.48, delay: 0.14, bpm: 68,  warmth: 35 },
  // v73: Reggae = muted offbeat skank + one-drop bass (style voice, warm engine); Funk = clav stabs + slap bass.
  // Jazz = Rhodes + rootless + walking upright; R&B = round chorused Rhodes + sub; Ballad = string pad + cello;
  // Country = honky-tonk boom-chick; Pop = bright piano + light round bass. Kids / Yoga unchanged.
  reggae:    { sound: "warm",    bass: true,  voicing: "close", cutoff: 0.55, reverb: 0.22, delay: 0.18, bpm: 76,  warmth: 40 },
  funk:      { sound: "reed",    bass: true,  voicing: "close", cutoff: 0.80, reverb: 0.08, delay: 0.06, bpm: 108, warmth: 20 },
  yogaDeep:  { sound: "warm",    bass: false, voicing: "low",   cutoff: 0.32, reverb: 0.58, delay: 0.02, bpm: 52,  warmth: 30, trim: 5.5 },
  // v60 Country: bright piano (the closest existing voice to a picked guitar), bass on, 100 BPM.
  // v68: close voicing (was bright: plain C reached G6, A7 in A).
  country:   { sound: "piano",   bass: true,  voicing: "close", cutoff: 0.82, reverb: 0.10, delay: 0.05, bpm: 100, warmth: 12 }
};

// v68: per-style loudness trims (bus gain), measured so every style plays within ~2 dB.
// v73: re-measured for the style voices (A-weighted 400 ms loudness, 90th percentile, -32 dBA target; v73-sound/TABLE.md).
const STYLE_TRIM = { pop: 1.41, kids: 2.07, jazz: 0.86, rnb: 0.90, ballad: 2.91, reggae: 4.07, funk: 4.60, yogaDeep: 3.94, country: 1.24 };
export function styleTrim(style) { return STYLE_TRIM[style] || 1; }

// Yoga (id yogaDeep): Dim/Sus4 type pads are unavailable (stillness palette).
export function enforceYogaDeepPaletteGate() {
  var gated = false; // v35: no style gates chord types
  var types = document.querySelectorAll("#types button[data-type]");
  for (var i = 0; i < types.length; i++) {
    var t = types[i].dataset.type;
    if (t === "dim" || t === "sus4") {
      types[i].disabled = gated;
      types[i].classList.toggle("gated", gated);
      if (gated) {
        types[i].classList.remove("on");
        types[i].setAttribute("aria-pressed", "false");
      }
    } else {
      types[i].disabled = false;
      types[i].classList.remove("gated");
    }
  }
  if (!gated) return;
  var dirty = false;
  for (var id in shared.paletteHolds) {
    if (shared.paletteHolds[id].kind === "type" && (shared.paletteHolds[id].value === "dim" || shared.paletteHolds[id].value === "sus4")) {
      delete shared.paletteHolds[id];
      dirty = true;
    }
  }
  if (state.type === "dim" || state.type === "sus4") {
    state.type = "major";
    dirty = true;
  }
  if (dirty) {
    var nextType = "major";
    for (var id2 in shared.paletteHolds) {
      if (shared.paletteHolds[id2].kind === "type") nextType = shared.paletteHolds[id2].value;
    }
    state.type = nextType;
  }
}

// Push one preset row into state, controls and audio together.
export function applyStylePreset(style) {
  if (ChordAudio.wake) ChordAudio.wake();
  var p = STYLE_PRESETS[style];
  if (!p) return false;
  state.sound = p.sound;
  state.bass = p.bass;
  state.voicing = p.voicing;
  document.getElementById("voicing").value = String(Math.max(0, VOICINGS.indexOf(p.voicing)));
  document.getElementById("cutoff").value = String(p.cutoff);
  document.getElementById("reverb").value = String(p.reverb);
  document.getElementById("delay").value = String(p.delay);
  ChordAudio.setSound(p.sound);
  ChordAudio.setTrim(styleTrim(style));
  ChordAudio.setArt(p.art);
  ChordAudio.setFlavor(style);   // v73: style voice (Kids / Yoga keep their engines)
  ChordAudio.band.setStyle(style); paintBand();   // v75 Band: Pop / Country / Jazz / Kids only
  ChordAudio.setCutoff(p.cutoff);
  ChordAudio.setReverb(p.reverb);
  ChordAudio.setDelay(p.delay);
  setBpm(p.bpm);
  setWarmth(p.warmth);
  enforceYogaDeepPaletteGate();
  return true;
}
