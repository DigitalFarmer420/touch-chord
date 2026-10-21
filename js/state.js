// One shared app state: `state` (chord / key / style / settings), `loop` (phrase loop), `shared` (mutable values more than one module writes) and persistence (localStorage keys unchanged from v112.3: touchChord.settings.v1, see STORE_KEY).
import { validKeyName, defaultKeyName } from "./keys.js?v=112.8";
import { WARMTH_DEFAULT, clampWarmth } from "./styles.js?v=112.8";
import { Theory } from "./theory/index.js?v=112.8";

// Shared mutable app state: the variables that more than one module writes. Read/write them as shared.<name>.
export const shared = {
  unlocked: false,   // owner: state.js
  paKeyMidi: null,   // owner: songs/playalong.js
  kbWinLow: null,   // owner: ui/keyboard.js
  kbKeyStay: false,   // owner: ui/keyboard.js
  kbFullLo: null,   // owner: ui/keyboard.js
  sustainDown: false,   // owner: ui/sustain.js
  sustainPointers: {},   // owner: ui/sustain.js
  sustainTouches: {},   // owner: ui/sustain.js
  groupSerial: 0,   // owner: ui/sustain.js
  suggestPreview: null,   // owner: ui/keyboard.js
  kbKeyGo: false,   // owner: ui/keyboard.js
  paEvT: 0,   // owner: songs/playalong.js
  paletteStrike: false,   // owner: ui/pads.js
  suggestSig: "",   // owner: theory/quality.js
  lockKey: null,   // owner: keys.js
  kidsSolo: false,   // owner: ui/keyboard.js
  suggestTimer: 0,   // owner: ui/strip.js
  paletteTimer: 0,   // owner: ui/palette.js
  paletteHolds: {},   // owner: ui/palette.js
  U: null,   // owner: songs/upload.js
  upNxOff: false,   // owner: songs/song.js
  paMiss: 0,   // owner: ui/hints.js
  firstFresh: false,   // owner: ui/hints.js
  upPromptVer: "full",   // owner: songs/upload.js
  LIB: { v: 1, active: null, sel: false, songs: [] },   // owner: songs/library.js
  upEdit: null,   // owner: songs/library.js
  upOpenAlt: null,   // owner: ui/songbar.js
  saveTimer: 0,   // owner: state.js
  lastSaved: "",   // owner: state.js
  persistReady: false,   // owner: state.js
};
export var VOICINGS;

export const state = {
  type: "major",
  extensions: { six: false, min7: false, maj7: false, nine: false },
  voicing: "close",
  keyMode: false,
  keyRoot: 0,
  keyScale: "major",
  rootPc: 0,
  degree: 1,
  rootMidi: null,
  layout: "octave",
  style: "pop",
  sound: "piano",
  bass: false,
  warmth: 25,
  holding: false,
  holdPointer: null,
  forceChord: null,
  simple: false,               // Simple mode (v20): hides sound/FX/key/loop/layout controls
  keyModeBeforeSimple: false,  // Key mode is forced off while Simple is on; restored after
  allKeys: false,
  playAlong: true,             // v108: Config > Play along enable
  paHints: true,               // v112: Config > Show hints (Play along hints)
  keySpell: {}                 // v50: key root spelling picks, e.g. { "1major": "Db" }
};

export const loop = {
  events: [],
  recording: false,
  overdub: false,
  playing: false,
  transport: false,
  bpm: 96,
  startTime: 0,
  nextIndex: 0,
  seq: 0,
  gid: 0,
  timer: null,
  active: []
};

export const fingers = {};

export var padsEl;
export var phaseEl;

// ---- Settings persistence (localStorage, versioned) ----
// Only sticky settings are stored. Chord type / extension buttons are
// momentary (held), so they are intentionally not persisted.
const STORE_KEY = "touchChord.settings.v1";
const STORE_VERSION = 1;
const LAYOUTS = ["octave", "piano", "fourths", "full"];   // v85: + Full (the pre-v83 multi-octave keyboard)
const SOUNDS = ["piano", "epiano", "strings", "warm", "bell", "reed"];
const STYLES = ["pop", "kids", "jazz", "rnb", "ballad", "reggae", "funk", "yogaDeep", "country"];   // v60: Romantic and the old "yoga" removed (saved ones fall back to Pop). v68: "yogaDeep" is shown as "Yoga"; its id is unchanged, so a saved "yogaDeep" restores to it and an old saved "yoga" still falls back to Pop.
const SCALES = ["major", "minor"];

export function factoryDefaults() {
  return {
    layout: "octave",
    sound: "piano",
    bass: false,
    style: "pop",
    keyMode: false,
    keyRoot: 0,
    keyScale: "major",
    keySpell: {},
    rootPc: 0,
    degree: 1,
    voicing: "close",
    cutoff: 0.62,
    reverb: 0.22,
    delay: 0.14,
    bpm: 96,
    warmth: WARMTH_DEFAULT,
    simple: false,   // v107: the app opens in Full again (Simple is one tap on the Simple toggle); Reset = Full
    allKeys: false,
    // v65: on by default in both modes. A saved false (the switch turned off) is kept;
    // a missing value (new user, or saved before v60) gets on.
    progNums: true,
    playAlong: true,   // v108: Play along on by default
    paHints: true,   // v112: Show hints on by default
    volume: 100,
    band: 0,   // Band fix: one slider, 0 = off, 1..100 = on at that level (saved as bandLvl)
    lockKey: null
  };
}

function sanitizeSettings(raw) {
  var d = factoryDefaults();
  if (!raw || typeof raw !== "object") return d;
  function pick(v, list, def) { return list.indexOf(v) >= 0 ? v : def; }
  function bool(v, def) { return typeof v === "boolean" ? v : def; }
  function num(v, lo, hi, def, int) {
    if (typeof v !== "number" || !isFinite(v)) return def;
    if (int) v = Math.round(v);
    return Math.min(hi, Math.max(lo, v));
  }
  return {
    layout: pick(raw.layout, LAYOUTS, d.layout),
    sound: pick(raw.sound, SOUNDS, d.sound),
    bass: bool(raw.bass, d.bass),
    style: pick(raw.style, STYLES, d.style),
    keyMode: bool(raw.keyMode, d.keyMode),
    keyRoot: num(raw.keyRoot, 0, 11, d.keyRoot, true),
    keyScale: pick(raw.keyScale, SCALES, d.keyScale),
    keySpell: (function (o) {
      var out = {};
      if (o && typeof o === "object") Object.keys(o).forEach(function (k) {
        var m = /^(\d{1,2})(major|minor)$/.exec(k);
        // v52: invalid saved spellings (D\u266f major, G\u266d minor, ...) migrate to the default.
        if (m && typeof o[k] === "string" && validKeyName(Number(m[1]), m[2], o[k]) && o[k] !== defaultKeyName(Number(m[1]), m[2])) out[k] = o[k];
      });
      return out;
    })(raw.keySpell),
    rootPc: num(raw.rootPc, 0, 11, d.rootPc, true),
    degree: num(raw.degree, 1, 7, d.degree, true),
    voicing: pick(raw.voicing, VOICINGS, d.voicing),
    cutoff: num(raw.cutoff, 0, 1, d.cutoff),
    reverb: num(raw.reverb, 0, 1, d.reverb),
    delay: num(raw.delay, 0, 1, d.delay),
    bpm: num(raw.bpm, 50, 180, d.bpm, true),
    warmth: num(raw.warmth, 0, 100, d.warmth, true),
    simple: bool(raw.simple, d.simple),
    allKeys: bool(raw.allKeys, d.allKeys),
    progNums: bool(raw.progNums, d.progNums),
    playAlong: bool(raw.playAlong, d.playAlong),   // v108
    paHints: bool(raw.paHints, d.paHints),   // v112
    volume: num(raw.volume, 0, 100, d.volume, true),
    band: num(raw.bandLvl, 0, 100, d.band, true),   // Band fix: saves from before it (raw.band, toggle always off at load) migrate to 0 = off
    lockKey: (raw.lockKey && typeof raw.lockKey === "object" && raw.lockKey.pc === (raw.lockKey.pc | 0) && raw.lockKey.pc >= 0 && raw.lockKey.pc < 12 && SCALES.indexOf(raw.lockKey.mode) >= 0)
      ? { pc: raw.lockKey.pc, mode: raw.lockKey.mode } : null
    // Legacy `latch` key (cce4d86) is ignored; Sustain is never persisted.
  };
}

function storageGet() {
  try { return window.localStorage ? window.localStorage.getItem(STORE_KEY) : null; } catch (err) { return null; }
}
function storageSet(str) {
  try { if (window.localStorage) window.localStorage.setItem(STORE_KEY, str); return true; } catch (err) { return false; }
}
export function storageClear() {
  try { if (window.localStorage) window.localStorage.removeItem(STORE_KEY); } catch (err) {}
}

// Future builds: read older keys/versions here and migrate into v1+ shape.
export function loadSettings() {
  var str = storageGet();
  if (!str) { var first = factoryDefaults(); first.style = "kids"; shared.firstFresh = true; return first; }   // v111 (G): first visit opens in Kids (Twinkle, C); v112: then the tour
  try {
    var env = JSON.parse(str);
    if (!env || typeof env !== "object" || env.v !== STORE_VERSION) return factoryDefaults();
    return sanitizeSettings(env.settings);
  } catch (err) {
    return factoryDefaults();
  }
}

export function collectSettings() {
  return {
    layout: state.layout,
    sound: state.sound,
    bass: !!state.bass,
    style: state.style,
    // While Simple forces Key mode off, persist the user's real choice.
    keyMode: !!(state.simple ? state.keyModeBeforeSimple : state.keyMode),
    keyRoot: state.keyRoot,
    keyScale: state.keyScale,
    keySpell: state.keySpell || {},
    rootPc: state.rootPc,
    degree: state.degree,
    voicing: state.voicing,
    cutoff: Number(document.getElementById("cutoff").value),
    reverb: Number(document.getElementById("reverb").value),
    delay: Number(document.getElementById("delay").value),
    bpm: state.bpm,
    warmth: clampWarmth(document.getElementById("warmth").value),
    simple: !!state.simple,
    allKeys: !!state.allKeys,
    progNums: !!state.progNums,
    playAlong: state.playAlong !== false,   // v108
    paHints: state.paHints !== false,   // v112
    volume: state.volume == null ? 100 : state.volume,
    bandLvl: state.band | 0,
    band: (state.band | 0) >= 1 ? state.band | 0 : 50,   // older builds read this (1..100) and start Band off anyway
    lockKey: shared.lockKey ? { pc: shared.lockKey.pc, mode: shared.lockKey.mode } : null
  };
}

export function saveNow() {
  if (shared.saveTimer) {
    clearTimeout(shared.saveTimer);
    shared.saveTimer = 0;
  }
  if (!shared.persistReady) return;
  var str = JSON.stringify(collectSettings());
  if (str === shared.lastSaved) return;
  if (storageSet("{\"v\":" + STORE_VERSION + ",\"settings\":" + str + "}")) shared.lastSaved = str;
}

export function scheduleSave(ms) {
  if (!shared.persistReady) return;
  if (shared.saveTimer) clearTimeout(shared.saveTimer);
  shared.saveTimer = setTimeout(saveNow, ms == null ? 150 : ms);
}

// Boot step (runs once, in the original v112.3 order, from main.js)
export function boot() {
VOICINGS = Theory.VOICINGS;
padsEl = document.getElementById("pads");
phaseEl = document.getElementById("phase");
}
