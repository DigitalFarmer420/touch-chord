// The chord keyboard: layout spec, pads / keys, pointer input, sounding fingers, haptics.
import { api as ChordAudio } from "../audio/index.js?v=112.10";
import { unlock } from "../audio/unlock.js?v=112.10";
import { keyRootSpell, modeKey, activeKey, keyDegrees, maybeLockKey } from "../keys.js?v=112.10";
import { finalizeOne, armPending } from "../loop.js?v=112.10";
import { paTwin, playAlongKey, playAlongGo } from "../songs/playalong.js?v=112.10";
import { magic, setItemState } from "../songs/playback.js?v=112.10";
import { state, loop, fingers, padsEl, shared } from "../state.js?v=112.10";
import { Theory } from "../theory/index.js?v=112.10";
import { hasDoubleAcc, plainToneName, enharmonicSpell } from "../theory/names.js?v=112.10";
import { wrap12 } from "../theory/quality.js?v=112.10";
import { accSym } from "../theory/spelling.js?v=112.10";
import { playAlongKeyOk, paHintMiss } from "./hints.js?v=112.10";
import { kbFullMode, kbFullRange, kbWindowMode, kbKeyLayout, kidsTonic, kbBorrowKey, kbChord, kbWantLow, kbUpdate, kbTonicLow, kbScheduleReset } from "./keyboard.js?v=112.10";
import { keyTapMidis, chipRootMidi, chipMidis, keyTapType } from "./kbmath.js?v=112.10";
import { paintNextHint, kidsGoldKey, kidsGoldGo } from "./next.js?v=112.10";
import { updateSymbol } from "./nowbox.js?v=112.10";
import { clearStripExt, clearSuggestPreview } from "./strip.js?v=112.10";
import { sustainActive, padPlayable, poolFingerGroup } from "./sustain.js?v=112.10";

export function computeSpec() {
  var rootPc = state.rootPc;
  var type = state.type;
  var extra = {};
  if (state.forceChord) {
    rootPc = state.forceChord.rootPc;
    type = state.forceChord.type;
  } else if (state.keyMode) {
    var d = Theory.degreeChord(state.keyRoot, state.keyScale, state.degree, keyRootSpell(modeKey()));
    rootPc = d.rootPc;
    type = d.type;
    extra.rootSpell = d.rootSpell;
    extra.rootName = d.rootName;
  }
  // v52: a strip chip carries its own root spelling (flat borrowed roots).
  var ss = state.stripSpell, keepSpell = false;
  if (!extra.rootSpell && ss && ss.pc === wrap12(rootPc) && ss.type === type) {
    extra.rootSpell = ss.rs; extra.rootName = Theory.noteName(ss.rs);
    keepSpell = !!ss.keep;
  }
  // v50: spell an in-key root the way the key (strip, 7-chord row) does.
  if (!extra.rootSpell) {
    var ak = activeKey();
    if (ak) {
      var kd = keyDegrees(ak);
      for (var ki = 0; ki < kd.length; ki++) {
        if (kd[ki].pc === wrap12(rootPc)) { extra.rootSpell = kd[ki].rootSpell; extra.rootName = kd[ki].name; break; }
      }
    }
  }
  // Pad register: root the chord at the pressed pad's MIDI. If the resolved
  // root pc differs (forced suggestion / key degree), snap to the nearest
  // MIDI with that pc so the chord stays in the held pad's register.
  var rootMidi;
  if (typeof state.rootMidi === "number" && isFinite(state.rootMidi)) {
    var off = ((((rootPc - state.rootMidi) % 12) + 12) % 12);
    if (off > 6) off -= 12;
    rootMidi = state.rootMidi + off;
  }
  if (rootMidi == null && state.style === "kids") rootMidi = 55 + wrap12(rootPc - 7);   // v76: Kids root G3..F#4, root lowest
  var chord = Theory.buildChord({
    rootPc: rootPc,
    type: type,
    extensions: state.extensions,
    voicing: state.voicing,
    rootSpell: extra.rootSpell,
    rootName: extra.rootName,
    rootMidi: rootMidi
  });
  // v51: a chord that is not diatonic to the key and whose spelling needs double
  // accidentals (E\u266ddim -> B\u266d\u266d, G\u266dm in D\u266d -> B\u266d\u266d): use the enharmonic
  // root when that avoids them (D\u266fdim, F\u266fm). Diatonic chords keep the key spelling.
  var inKeyPcs = null;
  var akD = activeKey();
  if (akD) { inKeyPcs = {}; keyDegrees(akD).forEach(function (dd) { inKeyPcs[dd.pc] = true; }); }
  var diatonic = !!inKeyPcs && chord.pcs.every(function (q) { return inKeyPcs[wrap12(q)]; });
  if (!diatonic && hasDoubleAcc(chord.names) && keepSpell) {
    // v54: a chip spelled to match its row note keeps that root (D# in G# minor, Gbm in Db);
    // only the tone names drop their double accidentals (F## -> G) for display.
    chord.names = chord.names.map(plainToneName);
  } else if (!diatonic && hasDoubleAcc(chord.names)) {
    var alt = enharmonicSpell(rootPc, chord.rootSpell);
    if (alt) {
      var c2 = Theory.buildChord({ rootPc: rootPc, type: type, extensions: state.extensions, voicing: state.voicing, rootSpell: alt, rootMidi: rootMidi });
      if (!hasDoubleAcc(c2.names)) chord = c2;
    }
  }
  chord.bassOut = state.bass ? chord.bassMidi + 12 : null;   // v68: bass an octave up (C3-B3) so phones play it
  chord.midis = kbPlace(chord, rootMidi);   // v83: close position from the root, inside one octave
  if (chord.bassOut != null && chord.midis.length) chord.bassOut = 48 + wrap12(chord.rootPc + (chord.extensions && chord.extensions.over ? chord.extensions.over : 0));   // v83: chord-layer bass = the root (slash: bass) note in C3..B3 (not drawn)
  chord.pcs = Theory.pitchClasses ? Theory.pitchClasses(chord.midis) : chord.pcs;
  return chord;
}
// v83 one-octave keyboard: what sounds is what lights. The chord is stacked in close position
// from its root (slash: from the bass), every tone (9, 11, 13 too) folded into root..root+11.
// The Voicing slider only moves the register for chips / Next / Play (low -12, high and
// bright +12; drop and bright fold to close); a keyboard key is the root itself.
function kbPlace(chord, rootMidi) {
  var fromKey = typeof fingers !== "undefined" && Object.keys(fingers).length > 0;
  if (typeof shared.paKeyMidi !== "undefined" && shared.paKeyMidi != null && rootMidi === shared.paKeyMidi) fromKey = true;   // v111 (E): a Play along key advance = a key tap on that key
  // v84: a keyboard key never moves the window. kb-fix: the touched key sounds at its own pitch and
  // the chord stacks UPWARD from it in root position (no v84 octave fold), exactly as the chip of that
  // chord on that key. Tones above the drawn keys still sound; paintPads lights only keys that exist.
  var full = kbFullMode() ? kbFullRange() : null;   // v85
  if (fromKey && rootMidi != null && ((kbWindowMode() && shared.kbWinLow != null) || full)) {
    var W = full ? full.lo : shared.kbWinLow, H = full ? full.hi : shared.kbWinLow + 12, X = rootMidi;
    while (X > H) X -= 12;
    while (X < W) X += 12;
    return keyTapMidis(chord.midis, X);
  }
  // Chips / Next / Play: a fixed home octave (C4..B4; Kids G3..F#4) moved by the Voicing slider,
  // so the register does not follow the last key tapped. A held key: that key.
  var R = fromKey && rootMidi != null ? rootMidi : (state.style === "kids" ? 55 + wrap12(chord.rootPc - 7) : 60 + wrap12(chord.rootPc));
  if (!fromKey) R += ({ low: -12, high: 12, bright: 12 })[chord.voicing] || 0;
  // A key is the root, but the window would climb (or sink) an octave with every tap on its
  // top (or bottom) key: keep key roots in G3..E5 and every root in C3..C6.
  var lo = fromKey ? 55 : 48, hi = fromKey ? 76 : 84;
  while (R > hi) R -= 12;
  while (R < lo) R += 12;
  var ov = chord.extensions && chord.extensions.over ? wrap12(chord.extensions.over) : 0;
  if (!fromKey && state.style === "kids" && kbKeyLayout()) {   // v111 (I) / v112.9: Kids pad chord on the tonic-anchored keys
    // v112.9: the root on its key at or above the Kids tonic (Octave: kidsTonic G3..F#4 at rest, not the possibly moved
    // window; Full: the drawn low key), chord in root position stacked UPWARD from it (no v111 fold into the keys), so
    // every pad has its root lowest and the pads' roots rise strictly in reading order (tonic first). The window then
    // moves to show the whole chord (kbWantLow Kids branch), so what sounds lights.
    var kT = full ? kbFullRange().lo : kidsTonic(), kR = kT + wrap12(chord.rootPc - kT);
    return chipMidis(chord.midis, kR, ov, Theory.chordIntervals(chord.type, chord.extensions).map(function (iv) { return chord.rootPc + iv; }));
  }
  if (!fromKey && kbKeyLayout()) {   // kb-fix (replaces the v111 D3 nearest-window octave and, on Full, the v85 octave moves):
    // root = its home-octave key C4..B4 by pitch class (kbmath chipRootMidi: grid rows rise left to right), chord in root
    // position from it, a slash bass under it (chipMidis). Same notes whatever came before; the window shows it, then snaps back.
    R = chipRootMidi(chord.rootPc, full ? 0 : ({ low: -12, high: 12, bright: 12 })[chord.voicing] || 0);   // Full: fixed C4..C6 keys, no Voicing octave
    var tp = Theory.chordIntervals(chord.type, chord.extensions).map(function (iv) { return chord.rootPc + iv; });
    return chipMidis(chord.midis, R, ov, tp);
  }
  var L = ov ? R + ov - 12 : R, seen = {}, out = [];
  (chord.midis || []).forEach(function (m) { var x = L + wrap12(m - L); if (!seen[x]) { seen[x] = 1; out.push(x); } });
  out.sort(function (a, b) { return a - b; });
  if (full && out.length) {   // v85: chips / Next / Play move by octaves onto the Full keyboard
    while (out[out.length - 1] > full.hi && out[0] - 12 >= full.lo) out = out.map(function (m) { return m - 12; });
    while (out[0] < full.lo && out[out.length - 1] + 12 <= full.hi) out = out.map(function (m) { return m + 12; });
  }
  return out;
}

export function eatMove(el) {
  el.addEventListener("touchmove", function (e) { e.preventDefault(); }, { passive: false });
}

// iOS: notes scheduled while AudioContext is still suspended are often
// dropped once resume completes. Replay the held finger after unlock.
function resoundHeldFinger(pointerId) {
  var finger = fingers[pointerId];
  if (!finger || finger.keyId == null) return;
  if (!(ChordAudio.ctx && ChordAudio.ctx.state === "running")) return;
  rememberFinger(finger);
  var spec = computeSpec();
  ChordAudio.stopChord(finger.group);
  ChordAudio.playChord(finger.group, spec.midis, { bass: spec.bassOut, sound: state.sound, key: true });
  finger.sig = chordSig(spec);
  finger.midis = spec.midis.slice();
}

function degreeAt(pc) {
  if (!state.keyMode) return null;
  var degrees = keyDegrees(modeKey());
  for (var i = 0; i < degrees.length; i++) {
    if (degrees[i].pc === pc) return degrees[i];
  }
  return null;
}

var keySerial;

function makeKey(pc, midi) {
  var b = document.createElement("button");
  b.type = "button";
  var deg = degreeAt(pc);
  var name = deg ? deg.name : Theory.NOTE_NAMES[pc];
  b.dataset.id = "k" + (keySerial++);
  b.dataset.pc = String(pc);
  b.dataset.midi = String(midi);
  if (kbBorrowKey(pc, midi, deg)) {   // v84: a borrowed chord's root key is live, never dimmed
    b.className = "pad " + kbChord.type;
    b.dataset.borrow = "1";
    b.dataset.btype = kbChord.type;
    b.innerHTML = "<span class=\"nm\">" + accSym(Theory.NOTE_NAMES[pc]) + "</span>";
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
export function octaveSpan() {
  return 1; // v38: Simple is always one octave (C..B); keys widen to fill
}
export function effectiveLayout() {
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
  else addPiano(1, shared.kbWinLow, 13);   // v83: Octave and Piano = one 13-key window, root on the left
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

export function specFromFinger(finger) {
  var root = state.rootPc;
  var degree = state.degree;
  var rootMidi = state.rootMidi, force = state.forceChord;
  var type = state.type, ext = Object.assign({}, state.extensions), sspell = state.stripSpell;   // kb-fix
  if (state.keyMode) { if (finger.degree != null) state.degree = finger.degree; }
  else state.rootPc = finger.pc;
  state.rootMidi = finger.midi;
  if (finger.force) state.forceChord = finger.force;
  applyFingerQuality(finger);   // kb-fix: each held key keeps its own quality
  var spec = computeSpec();
  state.type = type; Object.assign(state.extensions, ext); state.stripSpell = sspell;
  state.rootPc = root;
  state.degree = degree;
  state.rootMidi = rootMidi;
  state.forceChord = force;
  return spec;
}

// kb-fix: a plain key tap's quality. "Picked" = a palette type / extension button (Major, Minor,
// Sus4, Dim, 6, min7, maj7, 9) held down right now (shared.paletteHolds, the palette's only state:
// it is momentary, syncPalette resets state.type to major on release). Held: the palette wins, as
// before. Not held: the diatonic chord of the key's degree (out-of-key: major), never the type /
// extensions a chip, Next, Play along step or a reload left in state. Kids keeps its own rule.
export function paletteHeld() { return !!shared.paletteHolds && Object.keys(shared.paletteHolds).length > 0; }
export function keyTapQuality(pc) {
  if (state.style === "kids") return null;
  var ak = activeKey();
  return { type: keyTapType(pc, ak ? keyDegrees(ak) : null) };
}
function applyFingerQuality(finger) {
  if (!finger || !finger.kq || finger.force || paletteHeld()) return;
  state.type = finger.kq.type;
  state.extensions.six = state.extensions.min7 = state.extensions.maj7 = state.extensions.nine = false;
  clearStripExt();
}
function rememberFinger(finger) {
  if (state.keyMode) { if (finger.degree != null) state.degree = finger.degree; }
  else state.rootPc = finger.pc;
  state.rootMidi = finger.midi;
  applyFingerQuality(finger);   // kb-fix
}
// kb-fix: palette let go with keys still down: the last key goes back to its own diatonic quality.
export function restoreKeyQuality() {
  var ids = Object.keys(fingers);
  if (ids.length) applyFingerQuality(fingers[ids[ids.length - 1]]);
}

function soundFinger(pointerId, pad) {
  if (!padPlayable(pad)) return;
  state.forceChord = null;
  clearStripExt();
  var finger = fingers[pointerId];
  if (!finger) {
    // Unique group per finger-down so pooled (sustained) groups never
    // collide with a reused pointerId (mouse is always 1).
    finger = { group: "live-" + pointerId + "-" + (++shared.groupSerial) };
    fingers[pointerId] = finger;
  }
  if (finger.keyId === pad.dataset.id) return;
  var sustainSlide = finger.keyId != null && sustainActive();
  if (sustainSlide) {
    // Sliding to a new key with Sustain down: leave the old chord ringing.
    poolFingerGroup(finger);
    finger.group = "live-" + pointerId + "-" + (++shared.groupSerial);
  }
  finger.keyId = pad.dataset.id;
  finger.pc = Number(pad.dataset.pc);
  var padMidi = Number(pad.dataset.midi);
  finger.midi = isFinite(padMidi) ? padMidi : null;
  finger.degree = pad.dataset.degree ? Number(pad.dataset.degree) : null;
  finger.force = pad.dataset.borrow && kbChord ? { rootPc: kbChord.rootPc, type: kbChord.type } : null;   // v84
  finger.kq = finger.force ? null : keyTapQuality(finger.pc);   // kb-fix
  rememberFinger(finger);
  clearSuggestPreview();
  if (finger.force) {   // v84: the borrowed root key plays that chord (as the chip did)
    if (kbChord.item) setItemState(kbChord.item);
    state.forceChord = finger.force;
  }
  var spec = computeSpec();
  // New pad: release the old chord (ramped) and attack the new one.
  if (!sustainSlide) ChordAudio.stopChord(finger.group);
  ChordAudio.playChord(finger.group, spec.midis, { bass: spec.bassOut, sound: state.sound, key: true });
  finger.sig = chordSig(spec);
  finger.midis = spec.midis.slice();
  state.holding = true;
  if (loop.recording) armPending(finger, spec);
  maybeLockKey(spec);
  updateSymbol();
}

export const kbKidsPtr = {};   // v111 (I): pointers down on the keys (a gold-key tap advances before its finger is stored)
function kbKidsLift() {   // v111 (I): the last Kids finger up: the window may now move to show the gold (minimal move)
  if (state.style === "kids" && !Object.keys(fingers).length && !Object.keys(kbKidsPtr).length) setTimeout(function () { if (!Object.keys(fingers).length && !Object.keys(kbKidsPtr).length) kbUpdate(); }, 0);
}
function kbKidsUp(e) { if (kbKidsPtr[e.pointerId]) { delete kbKidsPtr[e.pointerId]; kbKidsLift(); } }
function releaseFinger(pointerId) {
  var finger = fingers[pointerId];
  if (!finger) return;
  ChordAudio.stopChord(finger.group);
  if (loop.recording && ChordAudio.ctx) finalizeOne(finger, ChordAudio.currentTime());
  else finger.pending = null;
  delete fingers[pointerId];
  kbKidsLift();
  if (!Object.keys(fingers).length) kbScheduleReset();   // kb-fix: the window snaps back to the tonic after the last key up
  state.holding = Object.keys(fingers).length > 0;
  var ids = Object.keys(fingers);
  if (ids.length) rememberFinger(fingers[ids[ids.length - 1]]);
  updateSymbol();
}

// Finger up: with Sustain down the chord joins the pedal pool and keeps
// ringing; otherwise it releases as normal hold-to-play.
export function liftFinger(pointerId) {
  var finger = fingers[pointerId];
  if (!finger) return;
  if (!sustainActive()) {
    releaseFinger(pointerId);
    return;
  }
  poolFingerGroup(finger);
  delete fingers[pointerId];
  kbKidsLift();
  if (!Object.keys(fingers).length) kbScheduleReset();   // kb-fix
  var ids = Object.keys(fingers);
  state.holding = ids.length > 0;
  if (ids.length) rememberFinger(fingers[ids[ids.length - 1]]);
  updateSymbol();
}

// Lifts every finger (pedal-aware). hard = stop audio regardless of Sustain.
export function releaseFingers(hard) {
  Object.keys(fingers).forEach(function (id) {
    if (hard) releaseFinger(id);
    else liftFinger(id);
  });
  paintPads();
}

// v100: a tiny buzz when a finger presses a key (only here, so playback, Band, Play and Next never buzz).
// Phones without vibrate (iOS) skip it quietly. Taps closer than 30 ms (a hand of keys) buzz once.
var hapLast;
export const hapLog = { calls: 0, skipped: 0, ms: [] };
export var hapTest;
function keyHaptic() {
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
  soundFinger(e.pointerId, e.currentTarget);
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
  soundFinger(e.pointerId, pad);
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

function chordSig(spec) {
  return spec.midis.join(",") + "|" + (spec.bassOut == null ? "" : spec.bassOut) + "|" + state.sound;
}
export const PERCUSSIVE_SOUNDS = { piano: true, epiano: true, bell: true };
export function refreshHeld() {
  Object.keys(fingers).forEach(function (id) {
    var finger = fingers[id];
    var spec = specFromFinger(finger);
    maybeLockKey(spec);
    finger.midis = spec.midis.slice();
    var sig = chordSig(spec);
    if (finger.sig === sig && !shared.paletteStrike) return;
    finger.sig = sig;
    // v36: decaying engines (piano, e-piano, bell) re-strike on a chord
    // change; morphing kept faded notes, so the new chord was near-silent.
    if (shared.paletteStrike || PERCUSSIVE_SOUNDS[state.sound] || ChordAudio.art || ChordAudio.grooving()) { // v41: any chord-button press re-strikes on every sound
      ChordAudio.stopChord(finger.group);
      ChordAudio.playChord(finger.group, spec.midis, { bass: spec.bassOut, sound: state.sound, key: true });
    } else {
      ChordAudio.morphChord(finger.group, spec.midis, { bass: spec.bassOut, sound: state.sound });
    }
    if (loop.recording) armPending(finger, spec);
  });
  shared.paletteStrike = false;
  updateSymbol();
}

// Boot step (runs once, in the original v112.3 order, from main.js)
export function boot1() {
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
