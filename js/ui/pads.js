// The chord keyboard: layout spec, pads / keys, pointer input, haptics, drawing. The touch-to-sound path (chord spec,
// sounding fingers, release / lift, held refresh) lives in touch.js (no DOM); this file draws the keys and feeds it.
import { api as ChordAudio } from "../audio/index.js?v=2026.11.27.19";
import { unlock } from "../audio/unlock.js?v=2026.11.27.19";
import { modeKey, keyDegrees, activeKey, keyNoteName } from "../keys.js?v=2026.11.27.19";
import { paTwin, playAlongKey, playAlongGo } from "../songs/playalong.js?v=2026.11.27.19";
import { magic } from "../songs/playback.js?v=2026.11.27.19";
import { state, fingers, padsEl, shared } from "../state.js?v=2026.11.27.19";
import { Theory } from "../theory/index.js?v=2026.11.27.19";
import { accSym } from "../theory/spelling.js?v=2026.11.27.19";
import { playAlongKeyOk, paHintMiss } from "./hints.js?v=2026.11.27.19";
import { kbFullRange, kbWindowMode, kbKeyLayout, kbBorrowKey, kbChord, kbWantLow } from "./keyboard.js?v=2026.11.27.19";
import { paintNextHint, kidsGoldKey, kidsGoldGo } from "./next.js?v=2026.11.27.19";
import { updateSymbol } from "./nowbox.js?v=2026.11.27.19";
import { padPlayable } from "./sustain.js?v=2026.11.27.19";
import { keyOf, setTouchView, soundFinger, resoundHeldFinger, releaseFinger, liftFinger, kbKidsPtr, kbKidsUp } from "./touch.js?v=2026.11.27.19";
// Moved to touch.js in the split; re-exported so every importer of pads.js is unchanged.
export { computeSpec, specFromFinger, paletteHeld, keyTapQuality, restoreKeyQuality, liftFinger, kbKidsPtr, PERCUSSIVE_SOUNDS, refreshHeld } from "./touch.js?v=2026.11.27.19";

export function eatMove(el) {
  el.addEventListener("touchmove", function (e) { e.preventDefault(); }, { passive: false });
}

// A keyboard key element as the sound path's plain key (touch.js keyOf).
export function padKey(pad) { return keyOf(pad.dataset.id, pad.dataset.pc, pad.dataset.midi, pad.dataset.degree, pad.dataset.borrow, padPlayable(pad)); }
// Lifts every finger (pedal-aware). hard = stop audio regardless of Sustain.
export function releaseFingers(hard) {
  Object.keys(fingers).forEach(function (id) {
    if (hard) releaseFinger(id);
    else liftFinger(id);
  });
  paintPads();
}

function degreeAt(pc) {
  if (!state.keyMode) return null;
  var degrees = keyDegrees(modeKey());
  for (var i = 0; i < degrees.length; i++) {
    if (degrees[i].pc === pc) return degrees[i];
  }
  return null;
}
function keyLabel(pc) {
  var k = activeKey();
  return k ? keyNoteName(k, pc) : Theory.NOTE_NAMES[pc];
}

var keySerial;

function makeKey(pc, midi) {
  var b = document.createElement("button");
  b.type = "button";
  var deg = degreeAt(pc);
  var name = keyLabel(pc);
  b.dataset.id = "k" + (keySerial++);
  b.dataset.pc = String(pc);
  b.dataset.midi = String(midi);
  if (kbBorrowKey(pc, midi, deg)) {   // v84: a borrowed chord's root key is live, never dimmed
    b.className = "pad " + kbChord.type;
    b.dataset.borrow = "1";
    b.dataset.btype = kbChord.type;
    b.innerHTML = "<span class=\"nm\">" + accSym(name) + "</span>";
    bindPad(b);
    return b;
  }
  if (state.keyMode && !deg) {
    b.className = "pad out";
    b.innerHTML = "<span class=\"nm\">" + accSym(name) + "</span>";
    return b;
  }
  if (state.keyMode) {
    b.className = "pad " + deg.type;
    b.dataset.degree = String(deg.degree);
  } else {
    b.className = "pad " + state.type;
  }
  b.innerHTML = "<span class=\"nm\">" + accSym(name) + "</span>";
  bindPad(b);
  return b;
}

function addPiano(octaves, start, count) {
  // v76: Kids draws from G3 so every Kids triad lights left to right in pitch order.
  // v81: up to F5 (55..77): every Kids melody note (tonic G3..F#4 + up to 11) has its own key.
  if (start == null) start = 60;
  if (count == null) count = octaves === 1 ? 12 : 25;
  var whiteCount = 0;
  for (var wi = 0; wi < count; wi++) if (!{ 1: 1, 3: 1, 6: 1, 8: 1, 10: 1 }[(start + wi) % 12]) whiteCount++;
  var blacks = { 1: 1, 3: 1, 6: 1, 8: 1, 10: 1 };
  padsEl.className = "kb piano";
  padsEl.style.setProperty("--whites", String(whiteCount));
  var whiteRow = document.createElement("div");
  whiteRow.className = "whites";
  var blackLayer = document.createElement("div");
  blackLayer.className = "blacks";
  var whitesSoFar = 0;
  // v76: a range that ends on a black key (Kids C#5) keeps half a black key of room on the right.
  var endPad = blacks[(start + count - 1) % 12] ? "(100% / " + whiteCount + " * 0.29)" : "";
  var begPad = blacks[start % 12] ? "(100% / " + whiteCount + " * 0.29)" : "";   // v83: a window may start on a black key
  if (endPad) whiteRow.style.marginRight = "calc" + endPad;
  if (begPad) whiteRow.style.marginLeft = "calc" + begPad;
  for (var i = 0; i < count; i++) {
    var pc = (start + i) % 12;
    var key = makeKey(pc, start + i);
    if (blacks[pc]) {
      key.classList.add("black");
      key.style.left = (endPad || begPad) ? "calc(" + (begPad || "0px") + " + (100% - " + (begPad || "0px") + " - " + (endPad || "0px") + ") * " + (whitesSoFar / whiteCount) + " - var(--black-w) / 2)" : "calc(" + (whitesSoFar / whiteCount * 100) + "% - var(--black-w) / 2)";
      blackLayer.appendChild(key);
    } else {
      key.classList.add("white");
      whiteRow.appendChild(key);
      whitesSoFar += 1;
    }
  }
  padsEl.appendChild(whiteRow);
  padsEl.appendChild(blackLayer);
}

function addFourths() {
  var rows = 4;
  var cols = 6;
  padsEl.className = "kb fourths";
  padsEl.style.removeProperty("--whites");
  for (var r = rows - 1; r >= 0; r--) {
    for (var c = 0; c < cols; c++) {
      padsEl.appendChild(makeKey((r * 5 + c) % 12, 60 + r * 5 + c));
    }
  }
}

// Simple mode forces the Octave layout; on regular (iPad) size it spans two
// octaves. Full mode is unchanged (Octave = one octave on every size).
export var padSpan;
var winKeys = 0;   // Expert redesign: window key count override (0 = the classic 13); set by js/expert/ui.js
export function setWinKeys(n) { winKeys = n | 0; }
export function winKeysNow() { return winKeys; }
export function octaveSpan() {
  return 1; // v38: Simple is always one octave (C..B); keys widen to fill
}
export function effectiveLayout() {
  if (shared.kidsView) return "octave";   // Kids view: its piano is one octave (the hidden keyboard follows, so key taps sound the same)
  return state.simple ? "octave" : state.layout;
}

export function renderPads() {
  // With Sustain down, held fingers hand their chords to the pedal pool.
  releaseFingers();
  state.rootMidi = null;
  if (kbWindowMode()) shared.kbWinLow = kbWantLow();
  renderKeys();
  paintPads();
}
export function renderKeys() {
  keySerial = 0;
  padsEl.innerHTML = "";
  var layout = effectiveLayout();
  padSpan = layout === "octave" ? octaveSpan() : 0;
  if (layout === "fourths") addFourths();
  else if (layout === "full") { var fr = kbFullRange(); shared.kbFullLo = fr.lo; addPiano(2, fr.lo, fr.hi - fr.lo + 1); }   // v85; v111 Kids from the tonic
  else addPiano(1, shared.kbWinLow, winKeys || 13);   // v83: Octave and Piano = one 13-key window, root on the left (Expert: 12 = C..B, setWinKeys)
}

function bindPad(b) {
  b.addEventListener("pointerdown", onPadDown);
  b.addEventListener("pointermove", onPadMove);
  b.addEventListener("pointerup", onPadUp);
  b.addEventListener("pointercancel", onPadUp);
}

// Map sounding suggestion midis onto visible pads: exact midi when the key
// exists, otherwise the nearest same pitch-class pad. Style voicings
// (drop/low/bright) and stale rootMidi often place tones outside the
// on-screen keyboard; without this fold, Next highlight misses notes.
export function highlightMidisFromSpec(specMidis) {
  var buttons = padsEl.querySelectorAll(".pad");
  var padMidis = [];
  for (var i = 0; i < buttons.length; i++) {
    if (buttons[i].classList.contains("out")) continue;
    var pm = Number(buttons[i].dataset.midi);
    if (isFinite(pm)) padMidis.push(pm);
  }
  var out = {};
  if (!specMidis || !specMidis.length || !padMidis.length) return out;
  var exact = kbKeyLayout();   // kb-fix: the piano keys light only the keys that sound; a tone above / below the drawn keys stays dark (as key taps), never an octave-moved stand-in
  for (var s = 0; s < specMidis.length; s++) {
    var m = specMidis[s];
    if (!isFinite(m)) continue;
    if (exact) { if (padMidis.indexOf(m) >= 0) out[m] = true; continue; }
    var best = null;
    var bestDist = Infinity;
    for (var p = 0; p < padMidis.length; p++) {
      var pm2 = padMidis[p];
      if ((((pm2 - m) % 12) + 12) % 12 !== 0) continue;
      var d = Math.abs(pm2 - m);
      if (d < bestDist) {
        bestDist = d;
        best = pm2;
        if (d === 0) break;
      }
    }
    if (best != null) out[best] = true;
  }
  return out;
}

export function paintPads() {
  var held = {}, heldM = {}, win = kbKeyLayout();
  Object.keys(fingers).forEach(function (id) {
    held[fingers[id].keyId] = true;
    (fingers[id].midis || []).forEach(function (m) { heldM[m] = true; });   // v83: light what sounds
  });
  var seenMidi = {};
  var buttons = padsEl.querySelectorAll(".pad");
  for (var i = 0; i < buttons.length; i++) {
    var b = buttons[i];
    var down = win ? !!heldM[b.dataset.midi] : !!held[b.dataset.id];
    var preview = false;
    if (!down && shared.suggestPreview && shared.suggestPreview.midis && shared.suggestPreview.midis[b.dataset.midi] && !seenMidi[b.dataset.midi]) {
      preview = true;
      seenMidi[b.dataset.midi] = true;
    }
    b.classList.toggle("selected", down || preview);
    b.classList.toggle("held", down || preview);
    if (!state.keyMode) {
      b.classList.remove("major", "minor", "sus4", "dim");
      b.classList.add(state.type);
    }
  }
  if (typeof magic !== "undefined" && magic) paintNextHint();   // v68/v71: re-apply after a rebuild (first-load fix: always, not only after a Next tap)
}

// v100: a tiny buzz when a finger presses a key (only here, so playback, Band, Play and Next never buzz).
// Phones without vibrate (iOS) skip it quietly. Taps closer than 30 ms (a hand of keys) buzz once.
var hapLast;
export const hapLog = { calls: 0, skipped: 0, ms: [] };
export var hapTest;
export function keyHaptic() {
  var t = (window.performance && performance.now) ? performance.now() : Date.now();
  if (t - hapLast < 30) { hapLog.skipped++; return; }
  hapLast = t;
  if ("vibrate" in navigator) try { navigator.vibrate(15); hapLog.calls++; if (hapTest) hapLog.ms.push(15); } catch (err) { /* quiet */ }
}
function onPadDown(e) {
  if (e.button != null && e.button !== 0) return;
  e.preventDefault();
  keyHaptic();   // v100
  if (kidsGoldKey(e.currentTarget)) {   // v79
    shared.kbKeyGo = true; shared.kbKeyStay = true;   // v102: a gold KEY tap never moves the window
    try { kidsGoldGo(e.currentTarget, "key"); } finally { shared.kbKeyGo = false; }
    return;
  }
  shared.paEvT = e.timeStamp || performance.now();
  if (!state.simple && e.currentTarget.dataset.midi != null && e.currentTarget.dataset.midi !== "" && paTwin("key", Number(e.currentTarget.dataset.midi))) return;   // v111 (D6): the same press as a chip just now
  if (!playAlongKeyOk(e.currentTarget)) paHintMiss("key", e.currentTarget);   // v112: a hint (the tap still sounds)
  if (playAlongKey(e.currentTarget)) {   // v108 Play along: the marked next chord's root key = Next (v109: root only)
    shared.kbKeyGo = true; shared.kbKeyStay = true; shared.paKeyMidi = Number(e.currentTarget.dataset.midi);   // v109: voiced from the tapped key
    try { playAlongGo(e.currentTarget, "key"); } finally { shared.kbKeyGo = false; shared.paKeyMidi = null; }
    return;
  }
  var needReplay = !(ChordAudio.ctx && ChordAudio.ctx.state === "running");
  var pending = unlock();
  try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  soundFinger(e.pointerId, padKey(e.currentTarget));
  if (needReplay && pending && typeof pending.then === "function") {
    pending.then(function () { resoundHeldFinger(e.pointerId); });
  }
}

function onPadMove(e) {
  if (!fingers[e.pointerId]) return;
  if (kbWindowMode()) return;   // v83: the window moves with the chord, so no slide-to-change
  e.preventDefault();
  var el = document.elementFromPoint(e.clientX, e.clientY);
  var pad = el && el.closest ? el.closest(".pad") : null;
  if (!pad || !padsEl.contains(pad)) return;
  soundFinger(e.pointerId, padKey(pad));
}

export function onPadUp(e) {
  if (!fingers[e.pointerId]) return;
  liftFinger(e.pointerId);
  paintPads();
}

function applyPad(pad) {
  if (state.keyMode) {
    if (!pad.dataset.degree) return;
    state.degree = Number(pad.dataset.degree);
  } else {
    state.rootPc = Number(pad.dataset.pc);
  }
}

// Boot step (runs once, in the original v112.3 order, from main.js)
export function boot1() {
  setTouchView({ symbol: function () { updateSymbol(); } });   // the sound path refreshes the Now box through this
keySerial = 0;
padSpan = 1;
}

// Boot step (runs once, in the original v112.3 order, from main.js)
export function boot2() {
  document.addEventListener("pointerdown", function (e) { if (e.target && e.target.closest && e.target.closest("#pads")) kbKidsPtr[e.pointerId] = 1; }, true);
  document.addEventListener("pointerup", kbKidsUp, true);
  document.addEventListener("pointercancel", kbKidsUp, true);
hapLast = -1e9;
  hapTest = /[?&]test=1(&|$)/.test(location.search);
  // v83: a rebuilt window drops the pressed key element (and its capture); lift from anywhere.
  window.addEventListener("pointerup", onPadUp);
  window.addEventListener("pointercancel", onPadUp);
}
