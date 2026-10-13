// Sustain button and the sustain pool.
import { api as ChordAudio } from "../audio/index.js?v=112.3";
import { unlock } from "../audio/unlock.js?v=112.3";
import { finalizeOne } from "../loop.js?v=112.3";
import { state, loop, shared } from "../state.js?v=112.3";
import { updateSymbol } from "./nowbox.js?v=112.3";
import { stripTails } from "./strip.js?v=112.3";
export var sustainPool;

function sustainEnabled() {
  return true;
}

export function sustainActive() {
  return shared.sustainDown && sustainEnabled();
}

export function poolCount() {
  return Object.keys(sustainPool).length;
}

export function padPlayable(pad) {
  if (pad && pad.dataset.borrow) return true;   // v84: the window's out-of-key chord root    if (!pad || pad.classList.contains("out")) return false;
  if (state.keyMode && !pad.dataset.degree) return false;
  if (!state.allKeys && pad.classList.contains("nokey")) return false;   // v111 (K): Kids with Full Range off: out-of-key keys do not play (v104.2 K1 kept for Full Range on)
  return true;
}

// Move a finger's sounding group into the pool (audio keeps ringing).
export function poolFingerGroup(finger) {
  if (!finger || !finger.group || finger.keyId == null) return;
  sustainPool[finger.group] = { pending: finger.pending || null };
  ChordAudio.protectGroup(finger.group);
  ChordAudio.fadeGroup(finger.group);
  finger.pending = null;
}

const DAMPER_TAU = 0.2;   // v68: pedal up = smooth exponential fade, -40 dB at ~0.9 s, -60 dB at ~1.4 s (was 0.045)
export function dumpSustain() {
  var groups = Object.keys(sustainPool);
  if (!groups.length) return;
  var now = ChordAudio.ctx ? ChordAudio.currentTime() : 0;
  groups.forEach(function (g) {
    var entry = sustainPool[g];
    ChordAudio.stopChord(g, null, DAMPER_TAU); // v68: ~1.4 s fade (v40: ~150 ms damper)
    ChordAudio.unprotectGroup(g);
    if (entry.pending && loop.recording && ChordAudio.ctx) finalizeOne(entry, now);
    else entry.pending = null;
  });
  sustainPool = {};
  ChordAudio.clearProtected();
}

export function paintSustainBtn() {
  var btn = document.getElementById("sustainBtn");
  if (!btn) return;
  var enabled = sustainEnabled();
  var on = sustainActive();
  btn.setAttribute("aria-disabled", enabled ? "false" : "true");
  btn.setAttribute("aria-pressed", on ? "true" : "false");
  btn.classList.toggle("on", on);
}

export function setSustain(on) {
  on = !!on && sustainEnabled();
  if (!on) {
    shared.sustainPointers = {};
    shared.sustainTouches = {};
  }
  if (on !== shared.sustainDown) {
    shared.sustainDown = on;
    if (!on) dumpSustain();
    // v47: pedal pressed while a suggestion preview still rings: hand it to
    // the pool (like a held key) so the 1.6 s preview timeout can't cut it.
    else {
      if (shared.suggestPreview && !sustainPool["suggest"]) {
        sustainPool["suggest"] = { pending: null };
        ChordAudio.protectGroup("suggest");
        ChordAudio.fadeGroup("suggest");
      }
      // v53: chips / notes let go less than a preview ago are still ringing: the pedal
      // catches them too. Chips still held join the pool when they are let go.
      Object.keys(stripTails).forEach(function (g) {
        clearTimeout(stripTails[g]);
        delete stripTails[g];
        sustainPool[g] = { pending: null };
        ChordAudio.protectGroup(g);
        ChordAudio.fadeGroup(g);
      });
    }
  } else if (!on) {
    dumpSustain();
  }
  paintSustainBtn();
  updateSymbol();
}

// Touch identities currently on the pedal. On some mobile browsers a second
// finger on a pad fires lostpointercapture / pointercancel on the pedal
// pointer while the thumb is still down — if we dumped then, pad-up would
// releaseFinger instead of poolFingerGroup. Touches are the ground truth.
function sustainHeldByInput() {
  return Object.keys(shared.sustainPointers).length > 0 || Object.keys(shared.sustainTouches).length > 0;
}

function onSustainDown(e) {
  if (e.button != null && e.button !== 0) return;
  e.preventDefault();
  if (!sustainEnabled()) return;
  unlock();
  shared.sustainPointers[e.pointerId] = true;
  try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  if (!shared.sustainDown) setSustain(true);
}

function onSustainUp(e) {
  if (!shared.sustainPointers[e.pointerId]) return;
  delete shared.sustainPointers[e.pointerId];
  // Keep pedal down if a touch is still on the button (spurious pointer loss).
  if (!sustainHeldByInput()) setSustain(false);
}

export function wireSustain() {
  var btn = document.getElementById("sustainBtn");
  if (!btn) return;
  btn.addEventListener("pointerdown", onSustainDown);
  btn.addEventListener("pointerup", onSustainUp);
  btn.addEventListener("pointercancel", onSustainUp);
  // Do NOT listen for lostpointercapture: with multi-touch, some engines fire
  // it on the pedal when another finger hits a pad, dumping Sustain before
  // pad-up can pool. pointerup/cancel + touchend cover real releases.
  // Do NOT listen for pointerleave: with setPointerCapture many browsers still
  // fire leave when the pointer exits the hit box, which dumped the pedal
  // before a key-up could pool (mouse drag / slight finger drift).
  // Keep iOS from scrolling / selecting / long-press calling out the pedal.
  btn.addEventListener("touchstart", function (e) {
    e.preventDefault();
    if (!sustainEnabled()) return;
    unlock();
    for (var i = 0; i < e.changedTouches.length; i++) {
      shared.sustainTouches[e.changedTouches[i].identifier] = true;
    }
    if (!shared.sustainDown) setSustain(true);
  }, { passive: false });
  function touchReleasePedal(e) {
    for (var i = 0; i < e.changedTouches.length; i++) {
      delete shared.sustainTouches[e.changedTouches[i].identifier];
    }
    if (e.targetTouches && e.targetTouches.length > 0) return;
    if (sustainHeldByInput()) return;
    if (shared.sustainDown) setSustain(false);
  }
  btn.addEventListener("touchend", touchReleasePedal);
  btn.addEventListener("touchcancel", touchReleasePedal);
  btn.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  btn.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); });
  // Keyboard: hold Space / Enter on the focused pedal.
  btn.addEventListener("keydown", function (e) {
    if (e.key !== " " && e.key !== "Enter") return;
    e.preventDefault();
    if (e.repeat || !sustainEnabled()) return;
    unlock();
    shared.sustainPointers.key = true;
    if (!shared.sustainDown) setSustain(true);
  });
  btn.addEventListener("keyup", function (e) {
    if (e.key !== " " && e.key !== "Enter") return;
    e.preventDefault();
    onSustainUp({ pointerId: "key" });
  });
  btn.addEventListener("blur", function () {
    if (shared.sustainPointers.key) onSustainUp({ pointerId: "key" });
  });
  paintSustainBtn();
}

// Boot step (runs once, in the original v112.3 order, from main.js)
export function boot() {
sustainPool = {};       // group id -> { pending } (loop-recording take)
}
