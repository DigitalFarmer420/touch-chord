// Touch-to-sound: the chord keyboard's sound path with no DOM drawing (split out of pads.js): the chord spec
// (computeSpec / kbPlace), finger tracking, spec from a finger, sounding / re-sounding a finger, release / lift,
// the held-chord refresh and the Kids pointer set. Any view (the grown-up keyboard in pads.js, the Kids piano)
// calls soundFinger(pointerId, keyOf(...)) / liftFinger(pointerId), so sound and timing are the same everywhere.
import { api as ChordAudio } from "../audio/index.js?v=2026.11.27.5";
import { keyRootSpell, modeKey, activeKey, keyDegrees, maybeLockKey } from "../keys.js?v=2026.11.27.5";
import { finalizeOne, armPending } from "../loop.js?v=2026.11.27.5";
import { setItemState } from "../songs/playback.js?v=2026.11.27.5";
import { state, loop, fingers, shared } from "../state.js?v=2026.11.27.5";
import { Theory } from "../theory/index.js?v=2026.11.27.5";
import { hasDoubleAcc, plainToneName, enharmonicSpell } from "../theory/names.js?v=2026.11.27.5";
import { wrap12 } from "../theory/quality.js?v=2026.11.27.5";
import { kbFullMode, kbFullRange, kbWindowMode, kbKeyLayout, kidsTonic, kbChord, kbUpdate, kbScheduleReset } from "./keyboard.js?v=2026.11.27.5";
import { keyTapMidis, chipRootMidi, chipMidis, keyTapType } from "./kbmath.js?v=2026.11.27.5";
import { clearStripExt, clearSuggestPreview } from "./strip.js?v=2026.11.27.5";
import { sustainActive, poolFingerGroup } from "./sustain.js?v=2026.11.27.5";

// The touched key as plain data (from a key element's data-* and its playable state), so any view can sound it.
export function keyOf(id, pc, midi, degree, borrow, playable) {
  var m = Number(midi);
  return { id: id, pc: Number(pc), midi: isFinite(m) ? m : null, degree: degree ? Number(degree) : null, borrow: !!borrow, playable: !!playable };
}
// The one view callback the sound path needs: refresh the Now chord display after a finger change (pads.js sets it).
const view = { symbol: function () {} };
export function setTouchView(v) { if (v && v.symbol) view.symbol = v.symbol; }

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


// iOS: notes scheduled while AudioContext is still suspended are often
// dropped once resume completes. Replay the held finger after unlock.
export function resoundHeldFinger(pointerId) {
  var finger = fingers[pointerId];
  if (!finger || finger.keyId == null) return;
  if (!(ChordAudio.ctx && ChordAudio.ctx.state === "running")) return;
  rememberFinger(finger);
  var spec = kidsChordNow() ? kidsMajorSpec(finger) : computeSpec();
  ChordAudio.stopChord(finger.group);
  ChordAudio.playChord(finger.group, spec.midis, { bass: spec.bassOut, sound: state.sound, key: true });
  finger.sig = chordSig(spec);
  finger.midis = spec.midis.slice();
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
  var spec = kidsChordNow() ? kidsMajorSpec(finger) : computeSpec();
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
// extensions a chip, Next, Play along step or a reload left in state. Kids keeps its own rule
// (kidsMajorSpec: a plain major triad, without writing that type back onto Simple / Expert).
export function paletteHeld() { return !!shared.paletteHolds && Object.keys(shared.paletteHolds).length > 0; }
function kidsChordNow() { return state.style === "kids" || !!shared.kidsView; }
// The chord a Kids key plays: the plain major triad on that key (the same chord kidTriad builds
// for a pad). Key mode, a minor key, and a type / extension / root left by Simple or Expert are
// used only for this spec, then put back. Gold and Play song do not come through here.
function kidsMajorSpec(finger) {
  var saved = {
    km: state.keyMode, fc: state.forceChord, type: state.type, spell: state.stripSpell,
    root: state.rootPc, midi: state.rootMidi, deg: state.degree, ext: Object.assign({}, state.extensions)
  };
  state.keyMode = false; state.forceChord = null; state.type = "major"; state.stripSpell = null;
  if (finger) { state.rootPc = finger.pc; if (finger.midi != null) state.rootMidi = finger.midi; }
  state.extensions.six = state.extensions.min7 = state.extensions.maj7 = state.extensions.nine = false;
  clearStripExt();
  var spec;
  try { spec = computeSpec(); }
  finally {
    state.keyMode = saved.km; state.forceChord = saved.fc; state.type = saved.type; state.stripSpell = saved.spell;
    state.rootPc = saved.root; state.rootMidi = saved.midi; state.degree = saved.deg;
    Object.assign(state.extensions, saved.ext);
  }
  return spec;
}
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
export function rememberFinger(finger) {
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

export function soundFinger(pointerId, key) {   // key = keyOf(pad): what the touched key is (no DOM here)
  if (!key.playable) return;
  state.forceChord = null;
  clearStripExt();
  var finger = fingers[pointerId];
  if (!finger) {
    // Unique group per finger-down so pooled (sustained) groups never
    // collide with a reused pointerId (mouse is always 1).
    finger = { group: "live-" + pointerId + "-" + (++shared.groupSerial) };
    fingers[pointerId] = finger;
  }
  if (finger.keyId === key.id) return;
  var sustainSlide = finger.keyId != null && sustainActive();
  if (sustainSlide) {
    // Sliding to a new key with Sustain down: leave the old chord ringing.
    poolFingerGroup(finger);
    finger.group = "live-" + pointerId + "-" + (++shared.groupSerial);
  }
  finger.keyId = key.id;
  finger.pc = key.pc;
  finger.midi = key.midi;
  finger.degree = key.degree;
  finger.force = key.borrow && kbChord ? { rootPc: kbChord.rootPc, type: kbChord.type } : null;   // v84
  finger.kq = finger.force ? null : keyTapQuality(finger.pc);   // kb-fix
  rememberFinger(finger);
  clearSuggestPreview();
  var spec;
  if (kidsChordNow()) spec = kidsMajorSpec(finger);   // plain major triad; Simple / Expert type, root and key mode stay as they were
  else {
    if (finger.force) {   // v84: the borrowed root key plays that chord (as the chip did)
      if (kbChord.item) setItemState(kbChord.item);
      state.forceChord = finger.force;
    }
    spec = computeSpec();
  }
  // New pad: release the old chord (ramped) and attack the new one.
  if (!sustainSlide) ChordAudio.stopChord(finger.group);
  ChordAudio.playChord(finger.group, spec.midis, { bass: spec.bassOut, sound: state.sound, key: true });
  finger.sig = chordSig(spec);
  finger.midis = spec.midis.slice();
  state.holding = true;
  if (loop.recording) armPending(finger, spec);
  maybeLockKey(spec);
  view.symbol();
}


export const kbKidsPtr = {};   // v111 (I): pointers down on the keys (a gold-key tap advances before its finger is stored)
function kbKidsLift() {   // v111 (I): the last Kids finger up: the window may now move to show the gold (minimal move)
  if (state.style === "kids" && !Object.keys(fingers).length && !Object.keys(kbKidsPtr).length) setTimeout(function () { if (!Object.keys(fingers).length && !Object.keys(kbKidsPtr).length) kbUpdate(); }, 0);
}
export function kbKidsUp(e) { if (kbKidsPtr[e.pointerId]) { delete kbKidsPtr[e.pointerId]; kbKidsLift(); } }
export function releaseFinger(pointerId) {
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
  view.symbol();
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
  view.symbol();
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
  view.symbol();
}
