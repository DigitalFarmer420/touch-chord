// Applies loaded settings to the UI (applySettings, markOn) and the toast.
import { api as ChordAudio } from "./audio/index.js?v=2026.11.23.3";
import { syncKeySel } from "./keys.js?v=2026.11.23.3";
import { setBpm } from "./loop.js?v=2026.11.23.3";
import { VOICINGS, state, shared } from "./state.js?v=2026.11.23.3";
import { Theory } from "./theory/index.js?v=2026.11.23.3";
import { applyStylePreset, enforceYogaDeepPaletteGate, setWarmth, styleTrim } from "./styles.js?v=2026.11.23.3";
import { paintProgNumsBtn, paintPlayAlongBtn, setVolume, setBand } from "./ui/gear.js?v=2026.11.23.3";
import { paintSimple } from "./ui/layout.js?v=2026.11.23.3";
import { setKeyModeState } from "./ui/palette.js?v=2026.11.23.3";
import { dumpSustain, paintSustainBtn } from "./ui/sustain.js?v=2026.11.23.3";
import { lookApplyNow } from "./ui/look.js?v=2026.11.23.3";

// N20 PR-A (Simple phone portrait): the style chips sit on one scrolling line. Scroll the picked chip fully into
// view, clear of the 20 px right fade, after settings load, on a style pick, on resize / rotation and on entering
// Simple. Other layouts are left alone. The fade class (.more) is kept by main.js on scroll / resize.
function styleLineOn() {
  var de = document.documentElement;
  return de.classList.contains("simple") && de.classList.contains("lay-phone-port") && !de.classList.contains("expert") && !de.classList.contains("kv");
}
var styleViewWired = false;
export function keepStyleInView() {
  var row = typeof document !== "undefined" && document.getElementById("styles");
  if (!row) return;
  if (!styleViewWired) {
    styleViewWired = true;
    row.addEventListener("click", function () { keepStyleInView(); });
    window.addEventListener("resize", function () { keepStyleInView(); });
    window.addEventListener("orientationchange", function () { keepStyleInView(); });
    var was = styleLineOn();
    if (window.MutationObserver) new MutationObserver(function () { var now = styleLineOn(); if (now && !was) keepStyleInView(); was = now; })
      .observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  }
  var run = function () {
    if (!styleLineOn()) return;
    var on = row.querySelector("button.on");
    if (!on || row.scrollWidth <= row.clientWidth + 1) return;
    var r = on.getBoundingClientRect(), q = row.getBoundingClientRect(), fade = 20;
    if (r.right > q.right - fade) row.scrollLeft += Math.ceil(r.right - (q.right - fade));
    else if (r.left < q.left) row.scrollLeft -= Math.ceil(q.left - r.left);
    row.classList.toggle("more", row.scrollWidth - row.clientWidth - row.scrollLeft > 2);
  };
  if (window.requestAnimationFrame) requestAnimationFrame(function () { requestAnimationFrame(run); }); else setTimeout(run, 0);
}

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
  state.expert = s.expert !== false;   // Kids redesign: Simple (Kids view) / Expert
  state.theme = s.theme === "lamp" || s.theme === "day" ? s.theme : "auto";   // rd6: + Auto (kids/view.js applies the look)
  state.kidsSong = s.kidsSong || null;
  state.kidsWalk = s.kidsWalk || null;
  lookApplyNow("kids");   // rd6: no-op until the Kids view registers its look (boot), then a reset re-applies it
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
  // v112.6: the Now chord's quality is not saved; after a reload it follows the saved key, so a saved D minor
  // shows Dm (D F A), not D major, before the first tap. A root outside the key keeps the default.
  // kb-fix: this only feeds the Now display (and whatever the next chip / palette overwrites): a key tap
  // takes its quality from its own degree (pads.js keyTapQuality), so a reload never changes key taps.
  state.type = "major";
  try {
    var lk = shared.lockKey;
    if (lk) for (var dg = 1; dg <= 7; dg++) {
      var dc = Theory.degreeChord(lk.pc, lk.mode, dg);
      if (dc.rootPc === ((state.rootPc % 12) + 12) % 12) { state.type = dc.type; break; }
    }
  } catch (err) {}
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
  keepStyleInView();
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
