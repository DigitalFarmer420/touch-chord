// Applies loaded settings to the UI (applySettings, markOn) and the toast.
import { api as ChordAudio } from "./audio/index.js?v=112.4";
import { syncKeySel } from "./keys.js?v=112.4";
import { setBpm } from "./loop.js?v=112.4";
import { VOICINGS, state, shared } from "./state.js?v=112.4";
import { applyStylePreset, enforceYogaDeepPaletteGate, setWarmth, styleTrim } from "./styles.js?v=112.4";
import { paintProgNumsBtn, paintPlayAlongBtn, setVolume, setBand } from "./ui/gear.js?v=112.4";
import { paintSimple } from "./ui/layout.js?v=112.4";
import { setKeyModeState } from "./ui/palette.js?v=112.4";
import { dumpSustain, paintSustainBtn } from "./ui/sustain.js?v=112.4";

function markOn(groupSel, attr, value) {
  var all = document.querySelectorAll(groupSel + " button");
  for (var i = 0; i < all.length; i++) {
    if (all[i].dataset[attr] == null) continue;
    var on = all[i].dataset[attr] === value;
    all[i].classList.toggle("on", on);
    if (all[i].hasAttribute("aria-pressed") || all[i].getAttribute("role") === "radio") {
      all[i].setAttribute("aria-pressed", on ? "true" : "false");
    }
  }
}

// Push a settings object into state, controls and audio. Caller re-renders.
export function applySettings(s) {
  state.progNums = !!s.progNums;
  paintProgNumsBtn();
  state.playAlong = s.playAlong !== false;   // v108
  state.paHints = s.paHints !== false;   // v112
  paintPlayAlongBtn();
  state.layout = s.layout;
  state.sound = s.sound;
  state.bass = s.bass;
  state.style = s.style;
  ChordAudio.setTrim(styleTrim(s.style));
  // v27: Key mode retired; the key picker is the only key control.
  if (s.keyMode) shared.lockKey = { pc: s.keyRoot, mode: s.keyScale === "minor" ? "minor" : "major" };
  // v52: Simple picks up where it left off (its key control has no Auto).
  // v113 (5) port: Full uses the same root + Major/Minor control (no Auto), so it does too.
  else shared.lockKey = s.lockKey || { pc: 0, mode: "major" };
  state.keyMode = false;
  state.keyRoot = s.keyRoot;
  state.keyScale = s.keyScale;
  state.rootPc = s.rootPc;
  state.degree = s.degree;
  state.voicing = s.voicing;
  state.forceChord = null;
  state.rootMidi = null;
  shared.sustainDown = false;
  shared.sustainPointers = {};
  shared.sustainTouches = {};
  dumpSustain();

  markOn("#layouts", "layout", s.layout);
  paintSustainBtn();
  markOn("#styles", "style", s.style);
  state.keySpell = s.keySpell || {};
  syncKeySel();
  document.getElementById("voicing").value = String(Math.max(0, VOICINGS.indexOf(s.voicing)));
  document.getElementById("cutoff").value = String(s.cutoff);
  document.getElementById("reverb").value = String(s.reverb);
  document.getElementById("delay").value = String(s.delay);

  ChordAudio.setSound(s.sound);
  ChordAudio.setCutoff(s.cutoff);
  ChordAudio.setReverb(s.reverb);
  ChordAudio.setDelay(s.delay);
  setBpm(s.bpm);
  setWarmth(s.warmth);
  // Simple mode: Key mode is forced off while on (real value kept for later).
  state.simple = !!s.simple;
  state.allKeys = !!s.allKeys;
  state.keyModeBeforeSimple = false;
  if (state.simple && state.keyMode) {
    state.keyModeBeforeSimple = true;
    setKeyModeState(false);
  }
  paintSimple();
  shared.suggestSig = "";
  enforceYogaDeepPaletteGate();
  // v68: the active style's sound preset always applies at load (cold Pop has its bass).
  applyStylePreset(s.style);
  setVolume(s.volume);
  setBand(s.band);   // Band fix: the saved slider level; 0 = off
}

var toastTimer;
export function showToast(msg) {
  var el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { el.classList.remove("show"); }, 1600);
}

// Boot step (runs once, in the original v112.3 order, from main.js)
export function boot() {
toastTimer = 0;
}
