import { api as ChordAudio } from "./audio/index.js?v=112.3";
import { keyRootSpell, modeKey, activeKey, keyDegrees, maybeLockKey, keyMainNames, keyAltNames, namePc, keyRootName, buildKeySel, syncKeySel, setKeySpell, suggestionKey } from "./keys.js?v=112.3";
import { kidKey, paintKidChip, paintKidKey, wireKidKey } from "./kids.js?v=112.3";
import { finalizeOne, armPending, killLoopVoices, paintLoop, stopPlayback, onRecord, onPlay, onClear, setBpm } from "./loop.js?v=112.3";
import { applySettings, showToast } from "./settings.js?v=112.3";
import { KIDS_LYRICS } from "./songs/kids-songs.js?v=112.3";
import { upSave, libGet, paintLib, libEntryToU, upRestoreSel, libOpen, libSetVer, libDelete, libConfirm } from "./songs/library.js?v=112.3";
import { progNext, progBadge, magicTarget, magicQueue, magicAdvance } from "./songs/magic.js?v=112.3";
import { paTwin, playAlongKey, playAlongGo, playAlongChip, playAlongNow } from "./songs/playalong.js?v=112.3";
import { magic, setItemState, progStop, progPlay, prog, progSync, progDecorate, PROG_TEST, progSet, progWalkAt, progWalkTo, placeBadges, progRedecorate, progPlayStart } from "./songs/playback.js?v=112.3";
import { progFeel, progSteps, progNumerals } from "./songs/presets.js?v=112.3";
import { upInList, paintUpNext, upSelected, upNextStep, upKeyApply, upKeyNow, upTr, upLiveKeyObj, upT, upA, upSetLock, upPlaceLock, upSelect, upEsc, upStepOf, upCurStep, upPickAlt } from "./songs/song.js?v=112.3";
import { upProgObj, UP_HEAD, UP_PASTE_LINE, UP_PASTE_LINE_2, UP_TAIL, UP_ARTIST_MAX, UP_SKIP_MAX, upListSchemaText, upEv, upSym, upFlagged, upFlagList, upSecName, upLoadBegin, upLoadCheck, upLoadCommit } from "./songs/upload.js?v=112.3";
import { VOICINGS, state, loop, fingers, padsEl, scheduleSave, factoryDefaults, storageClear, loadSettings, collectSettings, saveNow, shared } from "./state.js?v=112.3";
import { applyStylePreset, enforceYogaDeepPaletteGate, setWarmth } from "./styles.js?v=112.3";
import { Theory } from "./theory/index.js?v=112.3";
import { accSym } from "./theory/spelling.js?v=112.3";

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
  // v84: a keyboard key never moves the window. The touched key sounds at its own pitch (the
  // top key too); the other tones go above it when they fit in the window, else an octave down.
  var full = kbFullMode() ? kbFullRange() : null;   // v85
  if (fromKey && rootMidi != null && ((kbWindowMode() && kbWinLow != null) || full)) {
    var W = full ? full.lo : kbWinLow, H = full ? full.hi : kbWinLow + 12, X = rootMidi, kseen = {}, kout = [];
    while (X > H) X -= 12;
    while (X < W) X += 12;
    (chord.midis || []).forEach(function (m) { var x = X + wrap12(m - X); if (x > H) x -= 12; if (!kseen[x]) { kseen[x] = 1; kout.push(x); } });
    kout.sort(function (a, b) { return a - b; });
    return kout;
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
  if (!fromKey && state.style === "kids" && kbKeyLayout()) {   // v111 (I): Kids pad chord inside the tonic-anchored keys
    var kT = full ? kbFullRange().lo : kbWinLow == null ? kidsTonic() : kbWinLow, kH = kT + (full ? 24 : 12), kR = kT + wrap12(chord.rootPc - kT), kSeen = {}, kOut = [];   // inside the keys as drawn
    (chord.midis || []).forEach(function (m) { var x = kR + wrap12(m - kR); if (x > kH) x -= 12; if (!kSeen[x]) { kSeen[x] = 1; kOut.push(x); } });
    kOut.sort(function (a, b) { return a - b; });
    return kOut;
  }
  if (!fromKey && !full && kbWindowMode() && kbWinLow != null && !shared.kbKeyStay) {   // v111 (D3): move the window as little as possible
    var vOff = ({ low: -12, high: 12, bright: 12 })[chord.voicing] || 0;
    var best = null;   // the root's octave inside G3..E5 (55..76, + the Voicing octave) whose lowest key (root; slash: bass) is nearest the current left key
    for (var R2 = 55 + vOff + wrap12(chord.rootPc - 55 - vOff); R2 <= 76 + vOff; R2 += 12) {
      var d2 = Math.abs((ov ? R2 + ov - 12 : R2) - kbWinLow);
      if (best == null || d2 < best.d || (d2 === best.d && R2 < best.r)) best = { r: R2, d: d2 };   // a tie (tritone) goes down
    }
    if (best) R = best.r;
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

// The other single-accidental spelling of a root (E\u266d <-> D\u266f), or null.
function enharmonicSpell(rootPc, rs) {
  if (!rs || rs.acc === 0) return null;
  var li = rs.acc < 0 ? (rs.li + 6) % 7 : (rs.li + 1) % 7;
  var acc = wrap12(rootPc - [0, 2, 4, 5, 7, 9, 11][li]);
  if (acc > 6) acc -= 12;
  return Math.abs(acc) <= 1 ? { li: li, acc: acc } : null;
}
// Root spelling for a chord, switched to the enharmonic root when the given
// spelling would need double accidentals and the switch avoids them.
function cleanRootSpell(rootPc, type, ext, rs) {
  rs = rs || Theory.spellRoot(rootPc);
  var names = Theory.chordToneNames(rs, type, ext || {});
  if (!hasDoubleAcc(names)) return rs;
  var alt = enharmonicSpell(rootPc, rs);
  if (alt && !hasDoubleAcc(Theory.chordToneNames(alt, type, ext || {}))) return alt;
  return rs;
}
function plainToneName(n) {
  if (!/bb|##|x/.test(n)) return n;
  var pc = wrap12({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[n.charAt(0)] + (n.split("#").length - 1) + 2 * (n.split("x").length - 1) - (n.split("b").length - 1));
  var sharp = /#|x/.test(n);
  return (sharp ? ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] : ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"])[pc];
}
function hasDoubleAcc(names) {
  // v52: Theory writes a double sharp as "x" (Fx); treat it like ## / bb.
  for (var i = 0; i < names.length; i++) if (/bb|##|x/.test(names[i])) return true;
  return false;
}

function eatMove(el) {
  el.addEventListener("touchmove", function (e) { e.preventDefault(); }, { passive: false });
}

// ---- iOS ring/silent switch bypass ----
// iOS 17+: navigator.audioSession.type = "playback". Older iOS: a looping,
// silent, inline <audio> element started inside a user gesture moves the
// page's audio session to the playback category, so Web Audio is no longer
// muted by the silent switch. iOS/iPadOS only.
var IS_IOS;
var silentAudio;
var silentAudioHidden;

function setPlaybackSession() {
  try {
    if ("audioSession" in navigator && navigator.audioSession.type !== "playback") {
      navigator.audioSession.type = "playback";
    }
  } catch (err) { /* ignore */ }
}

// ~0.5 s of 8 kHz mono 8-bit PCM silence as a WAV data URI.
function silentWavDataUri() {
  var rate = 8000, n = 4000, bytes = new Uint8Array(44 + n), i;
  function str(o, t) { for (var k = 0; k < t.length; k++) bytes[o + k] = t.charCodeAt(k); }
  function u32(o, v) { bytes[o] = v & 255; bytes[o + 1] = (v >> 8) & 255; bytes[o + 2] = (v >> 16) & 255; bytes[o + 3] = (v >>> 24) & 255; }
  function u16(o, v) { bytes[o] = v & 255; bytes[o + 1] = (v >> 8) & 255; }
  str(0, "RIFF"); u32(4, 36 + n); str(8, "WAVE");
  str(12, "fmt "); u32(16, 16); u16(20, 1); u16(22, 1); u32(24, rate); u32(28, rate); u16(32, 1); u16(34, 8);
  str(36, "data"); u32(40, n);
  for (i = 0; i < n; i++) bytes[44 + i] = 128;
  var bin = "";
  for (i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return "data:audio/wav;base64," + btoa(bin);
}

// Must run synchronously inside the user gesture.
function startSilentAudio() {
  if (!IS_IOS || silentAudioHidden) return;
  try {
    if (!silentAudio) {
      var a = document.createElement("audio");
      a.setAttribute("playsinline", "");
      a.setAttribute("webkit-playsinline", "");
      a.setAttribute("x-webkit-airplay", "deny");
      a.setAttribute("aria-hidden", "true");
      a.disableRemotePlayback = true;
      a.preload = "auto";
      a.loop = true;
      a.controls = false;
      a.style.display = "none";
      a.src = silentWavDataUri();
      try { a.volume = 0.01; } catch (err) { /* iOS: read-only */ }
      (document.body || document.documentElement).appendChild(a);
      silentAudio = a;
    }
    if (silentAudio.paused) {
      var p = silentAudio.play();
      if (p && typeof p.catch === "function") p.catch(function () { /* retry on next gesture */ });
    }
  } catch (err2) { /* ignore */ }
}

export function unlock() {
  setPlaybackSession();
  startSilentAudio();
  var pendingResume = ChordAudio.resume();
  var banner = document.getElementById("unlock");
  function hideBanner() {
    if (shared.unlocked) return;
    shared.unlocked = true;
    if (banner) banner.hidden = true;
  }
  if (ChordAudio.ctx && ChordAudio.ctx.state === "running") {
    hideBanner();
  } else if (pendingResume && typeof pendingResume.then === "function") {
    pendingResume.then(function () {
      if (ChordAudio.ctx && ChordAudio.ctx.state === "running") hideBanner();
    });
  }
  return pendingResume;
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
var padSpan;
function octaveSpan() {
  return 1; // v38: Simple is always one octave (C..B); keys widen to fill
}
function effectiveLayout() {
  return state.simple ? "octave" : state.layout;
}

export function renderPads() {
  // With Sustain down, held fingers hand their chords to the pedal pool.
  releaseFingers();
  state.rootMidi = null;
  if (kbWindowMode()) kbWinLow = kbWantLow();
  renderKeys();
  paintPads();
}
function renderKeys() {
  keySerial = 0;
  padsEl.innerHTML = "";
  var layout = effectiveLayout();
  padSpan = layout === "octave" ? octaveSpan() : 0;
  if (layout === "fourths") addFourths();
  else if (layout === "full") { var fr = kbFullRange(); kbFullLo = fr.lo; addPiano(2, fr.lo, fr.hi - fr.lo + 1); }   // v85; v111 Kids from the tonic
  else addPiano(1, kbWinLow, 13);   // v83: Octave and Piano = one 13-key window, root on the left
}
export var sustainPool;
var groupSerial;

function sustainEnabled() {
  return true;
}

function sustainActive() {
  return shared.sustainDown && sustainEnabled();
}

export function poolCount() {
  return Object.keys(sustainPool).length;
}

function padPlayable(pad) {
  if (pad && pad.dataset.borrow) return true;   // v84: the window's out-of-key chord root    if (!pad || pad.classList.contains("out")) return false;
  if (state.keyMode && !pad.dataset.degree) return false;
  if (!state.allKeys && pad.classList.contains("nokey")) return false;   // v111 (K): Kids with Full Range off: out-of-key keys do not play (v104.2 K1 kept for Full Range on)
  return true;
}

// Move a finger's sounding group into the pool (audio keeps ringing).
function poolFingerGroup(finger) {
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

function setSustain(on) {
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

function wireSustain() {
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
  for (var s = 0; s < specMidis.length; s++) {
    var m = specMidis[s];
    if (!isFinite(m)) continue;
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

function paintPads() {
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
  if (state.keyMode) { if (finger.degree != null) state.degree = finger.degree; }
  else state.rootPc = finger.pc;
  state.rootMidi = finger.midi;
  if (finger.force) state.forceChord = finger.force;
  var spec = computeSpec();
  state.rootPc = root;
  state.degree = degree;
  state.rootMidi = rootMidi;
  state.forceChord = force;
  return spec;
}

function rememberFinger(finger) {
  if (state.keyMode) { if (finger.degree != null) state.degree = finger.degree; }
  else state.rootPc = finger.pc;
  state.rootMidi = finger.midi;
}

function soundFinger(pointerId, pad) {
  if (!padPlayable(pad)) return;
  state.forceChord = null;
  clearStripExt();
  var finger = fingers[pointerId];
  if (!finger) {
    // Unique group per finger-down so pooled (sustained) groups never
    // collide with a reused pointerId (mouse is always 1).
    finger = { group: "live-" + pointerId + "-" + (++groupSerial) };
    fingers[pointerId] = finger;
  }
  if (finger.keyId === pad.dataset.id) return;
  var sustainSlide = finger.keyId != null && sustainActive();
  if (sustainSlide) {
    // Sliding to a new key with Sustain down: leave the old chord ringing.
    poolFingerGroup(finger);
    finger.group = "live-" + pointerId + "-" + (++groupSerial);
  }
  finger.keyId = pad.dataset.id;
  finger.pc = Number(pad.dataset.pc);
  var padMidi = Number(pad.dataset.midi);
  finger.midi = isFinite(padMidi) ? padMidi : null;
  finger.degree = pad.dataset.degree ? Number(pad.dataset.degree) : null;
  finger.force = pad.dataset.borrow && kbChord ? { rootPc: kbChord.rootPc, type: kbChord.type } : null;   // v84
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

const kbKidsPtr = {};   // v111 (I): pointers down on the keys (a gold-key tap advances before its finger is stored)
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
  state.holding = Object.keys(fingers).length > 0;
  var ids = Object.keys(fingers);
  if (ids.length) rememberFinger(fingers[ids[ids.length - 1]]);
  updateSymbol();
}

// Finger up: with Sustain down the chord joins the pedal pool and keeps
// ringing; otherwise it releases as normal hold-to-play.
function liftFinger(pointerId) {
  var finger = fingers[pointerId];
  if (!finger) return;
  if (!sustainActive()) {
    releaseFinger(pointerId);
    return;
  }
  poolFingerGroup(finger);
  delete fingers[pointerId];
  kbKidsLift();
  var ids = Object.keys(fingers);
  state.holding = ids.length > 0;
  if (ids.length) rememberFinger(fingers[ids[ids.length - 1]]);
  updateSymbol();
}

// Lifts every finger (pedal-aware). hard = stop audio regardless of Sustain.
function releaseFingers(hard) {
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
    kbKeyGo = true; shared.kbKeyStay = true;   // v102: a gold KEY tap never moves the window
    try { kidsGoldGo(e.currentTarget, "key"); } finally { kbKeyGo = false; }
    return;
  }
  shared.paEvT = e.timeStamp || performance.now();
  if (!state.simple && e.currentTarget.dataset.midi != null && e.currentTarget.dataset.midi !== "" && paTwin("key", Number(e.currentTarget.dataset.midi))) return;   // v111 (D6): the same press as a chip just now
  if (!playAlongKeyOk(e.currentTarget)) paHintMiss("key", e.currentTarget);   // v112: a hint (the tap still sounds)
  if (playAlongKey(e.currentTarget)) {   // v108 Play along: the marked next chord's root key = Next (v109: root only)
    kbKeyGo = true; shared.kbKeyStay = true; shared.paKeyMidi = Number(e.currentTarget.dataset.midi);   // v109: voiced from the tapped key
    try { playAlongGo(e.currentTarget, "key"); } finally { kbKeyGo = false; shared.paKeyMidi = null; }
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

function onPadUp(e) {
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

// Voicing / palette / sound / suggestion changes while a pad is held:
// skip if nothing audible changed, otherwise morph (common tones sustain,
// changed tones crossfade) instead of cutting and retriggering every voice.
var paletteStrike;
export const PERCUSSIVE_SOUNDS = { piano: true, epiano: true, bell: true };
export function refreshHeld() {
  Object.keys(fingers).forEach(function (id) {
    var finger = fingers[id];
    var spec = specFromFinger(finger);
    maybeLockKey(spec);
    finger.midis = spec.midis.slice();
    var sig = chordSig(spec);
    if (finger.sig === sig && !paletteStrike) return;
    finger.sig = sig;
    // v36: decaying engines (piano, e-piano, bell) re-strike on a chord
    // change; morphing kept faded notes, so the new chord was near-silent.
    if (paletteStrike || PERCUSSIVE_SOUNDS[state.sound] || ChordAudio.art || ChordAudio.grooving()) { // v41: any chord-button press re-strikes on every sound
      ChordAudio.stopChord(finger.group);
      ChordAudio.playChord(finger.group, spec.midis, { bass: spec.bassOut, sound: state.sound, key: true });
    } else {
      ChordAudio.morphChord(finger.group, spec.midis, { bass: spec.bassOut, sound: state.sound });
    }
    if (loop.recording) armPending(finger, spec);
  });
  paletteStrike = false;
  updateSymbol();
}



export function blankExt() {
  return { six: false, min7: false, maj7: false, nine: false };
}

function mapQuality(q) {
  var ext = blankExt();
  if (q === "min" || q === "minor") return { type: "minor", extensions: ext, label: "m" };
  if (q === "sus4") return { type: "sus4", extensions: ext, label: "sus4" };
  if (q === "dim") return { type: "dim", extensions: ext, label: "dim" };
  if (q === "dom7" || q === "7") {
    ext.min7 = true;
    return { type: "major", extensions: ext, label: "7" };
  }
  if (q === "m7") {
    ext.min7 = true;
    return { type: "minor", extensions: ext, label: "m7" };
  }
  if (q === "maj7") {
    ext.maj7 = true;
    return { type: "major", extensions: ext, label: "maj7" };
  }
  if (q === "m7b5") {
    ext.min7 = true;
    return { type: "dim", extensions: ext, label: "m7b5" };
  }
  if (q === "add9") {
    ext.nine = true;
    return { type: "major", extensions: ext, label: "add9" };
  }
  if (q === "madd9") {
    ext.nine = true;
    return { type: "minor", extensions: ext, label: "madd9" };
  }
  if (q === "mmaj7") {
    ext.maj7 = true;
    return { type: "minor", extensions: ext, label: "m(maj7)" };
  }
  return { type: "major", extensions: ext, label: "" };
}

export function wrap12(n) { return ((n % 12) + 12) % 12; }
// ---- v83 one-octave window ----
var kbLast;
export var kbWinLow;
// v102 Kids: after a gold-key tap the window stays where it is (the keys never slide under the finger),
// and the next gold note is placed inside it. Any chip / pad / Next / Play / key change ends this.
var kbKeyGo;
export var kbChord;
var kbKeySig;
function kbChordOf(spec) {
  if (!spec || !spec.midis || !spec.midis.length) return null;
  var r = null;
  spec.midis.forEach(function (m) { if (r == null && wrap12(m) === wrap12(spec.rootPc)) r = m; });
  return r == null ? null : { rootPc: wrap12(spec.rootPc), type: spec.type, root: r };
}
// v84: the key of an out-of-key chord root (bVII E in F# major) that the window was set by.
function kbBorrowKey(pc, midi, deg) {
  if (!kbChord || pc !== kbChord.rootPc || !kbKeyLayout()) return false;   // v102: every key of that root (the top key too), not just the one the chord sat on
  if (state.keyMode) return !deg;
  var k = activeKey();
  if (!k || state.allKeys) return false;
  return !keyDegrees(k).some(function (d) { return d.pc === pc; });
}
function kbWindowMode() { var l = effectiveLayout(); return l === "octave" || l === "piano"; }
// v85 Full: fixed keys, never re-anchored. Kids G3..F5 (55..77, as v81), other styles C4..C6 (60..84, v81 Piano).
function kbFullMode() { return effectiveLayout() === "full"; }
function kidsKeyNow() { return kidKey(); }   // v111 (I/K): the Kids key (kidKey: the picked key, else C major, as the Kids key picker shows)
function kidsTonic() { var ak = kidsKeyNow(); return 55 + wrap12((ak ? ak.pc : 0) - 7); }   // v111 (I): the Kids tonic, G3..F#4
function kidsFullLo() {   // v111 (I/J): the Full Kids keys = tonic to tonic, 2 octaves; a song that dips below its tonic (and fits) starts an octave lower, so no melody note is moved
  var t = kidsTonic(), st = typeof prog !== "undefined" && prog && prog.style === "kids" && prog.steps ? prog.steps : [], mn = 0, mx = 0;
  st.forEach(function (x) { var m = x && x.item ? x.item.mel : null; if (m != null) { if (m < mn) mn = m; if (m > mx) mx = m; } });
  return mn < 0 && mx <= 12 ? t - 12 : t;
}
function kbFullRange() { if (state.style === "kids") { var t = kidsFullLo(); return { lo: t, hi: t + 24 }; } return { lo: 60, hi: 84 }; }   // v111 (I/J): Kids = tonic to tonic, 2 octaves
function kbKeyLayout() { return kbWindowMode() || kbFullMode(); }   // piano keys that light what sounds
function kidsNatural(pc, mel) { var ak = activeKey(), k = ak ? ak.pc : 0; return 55 + wrap12(k - 7) + (mel != null ? mel : wrap12(pc - k)); }   // v96: @melody
// The Kids note at its song pitch, moved by octaves (nearest first) so it shares one window with
// what is sounding now: the gold key is exactly the key that will sound.
function kidsPlace(n) {
  if (state.style === "kids" && kbKeyLayout()) {   // v111 (I): Octave = the song pitch (the window comes to it, kbWantLow); Full = into the tonic-to-tonic keys by octaves (as the v109 clamp)
    if (!kbFullMode()) return n;
    var lo = kbFullRange().lo, hi = lo + 24;
    while (n < lo) n += 12;
    while (n > hi) n -= 12;
    return n;
  }
  var g = kidsPlace0(n);
  if (shared.kbKeyStay && kbWindowMode() && kbWinLow != null && (g < kbWinLow || g > kbWinLow + 12)) g = kbWinLow + wrap12(g - kbWinLow);   // v102
  return g;
}
function kidsPlace0(n) {
  if (kbFullMode()) { var R = kbFullRange(); while (n < R.lo) n += 12; while (n > R.hi) n -= 12; return n; }   // v85; v109: by octaves into the Kids keys
  var S = kbLast && kbLast.length ? kbLast : null;
  if (!S) return n;
  var lo = Math.min.apply(null, S), hi = Math.max.apply(null, S);
  var tries = [0, -12, 12, -24, 24];
  for (var i = 0; i < tries.length; i++) {
    var g = n + tries[i];
    if (Math.max(hi, g) - Math.min(lo, g) <= 12) return g;
  }
  return lo + wrap12(n - lo);
}
function kidsGoldNow() {
  if (state.style !== "kids" || typeof magic === "undefined" || !magic || typeof prog === "undefined" || !prog) return null;
  var it = kidsHintItem();
  return it ? kidsPlace(kidsNatural(it.rootPc, it.mel)) : null;
}
function kbWantLow(force) {
  if (state.style === "kids") {   // v111 (I): the Kids window sits on the key's tonic; it moves only as far as needed to show a gold / sounding note outside it, and goes back when they fit
    var kT = kidsTonic();
    if (kbFullMode()) return kbFullRange().lo;
    if (kbWinLow != null && (Object.keys(fingers).length || Object.keys(kbKidsPtr).length)) return kbWinLow;   // never slide the keys under a held finger (v84); kbKidsLift moves them on release
    var kS = kbLast && kbLast.length ? kbLast.slice() : [], kG = kidsGoldNow();
    if (kG != null) kS.push(kG);
    if (kS.length && Math.max.apply(null, kS) - Math.min.apply(null, kS) > 12) kS = kG != null ? [kG] : kS.slice(-1);   // the gold first
    var kFit = function (lo) { return kS.every(function (m) { return m >= lo && m <= lo + 12; }); };
    if (kFit(kT)) return kT;
    if (!force && kbWinLow != null && kFit(kbWinLow)) return kbWinLow;
    var kMn = Math.min.apply(null, kS), kMx = Math.max.apply(null, kS);
    return kMn < kT ? kMn : kMx - 12;
  }
  if (!force && shared.kbKeyStay && kbWinLow != null) return kbWinLow;   // v102
  var S = kbLast && kbLast.length ? kbLast.slice() : [];
  var g = kidsGoldNow();
  if (g != null) S.push(g);
  // v84 Kids: the window stays put while the sounding note and the gold both fit in it
  // (a gold-key tap must not slide the keys under the finger).
  if (!force && state.style === "kids" && kbWinLow != null && S.length && S.every(function (m) { return m >= kbWinLow && m <= kbWinLow + 12; })) return kbWinLow;
  if (!kbLast || !kbLast.length) {
    var ak = activeKey(), pc = ak ? ak.pc : wrap12(state.keyRoot || 0);
    var T = state.style === "kids" ? 55 + wrap12(pc - 7) : 60 + wrap12(pc);
    if (S.every(function (m) { return m >= T && m <= T + 12; })) return T;   // v84: the tonic (Kids: when the gold fits)
  }
  return Math.min.apply(null, S);
}
export function kbSound(midis, spec, item) {
  if (midis && midis.length) kbLast = midis.slice();
  if (spec) { kbChord = kbChordOf(spec); if (kbChord) kbChord.item = item || null; }
  if (kbUpdate()) return true;
  if (!padsEl || !kbKeyLayout()) return false;
  // v84: same window, new chord: re-draw only when the live borrowed root key changes.
  var cur = padsEl.querySelector(".pad[data-borrow]");
  var tgt = kbChord ? padsEl.querySelector('.pad[data-midi="' + kbChord.root + '"]') : null;
  var need = !!(tgt && !tgt.dataset.borrow && kbBorrowKey(Number(tgt.dataset.pc), kbChord.root, tgt.dataset.degree ? 1 : 0));
  if ((cur && (cur !== tgt || cur.dataset.btype !== (kbChord && kbChord.type))) || need) { kbRebuild(); return true; }
  return false;
}
var kbFullLo;
function kbUpdate() {
  if (padsEl && kbFullMode() && !Object.keys(fingers).length) {   // v111 (I): Kids Full keys move to a new key's tonic
    var fr0 = kbFullRange();
    if (kbFullLo !== null && kbFullLo !== fr0.lo) { kbChord = null; kbLast = null; kbRebuild(); return true; }   // new key / song: no stale borrowed key
  }
  if (!padsEl || !kbWindowMode()) return false;
  // v84: an explicit key change (key to key) moves the window to the new tonic; the first key
  // (locked from the first chord) does not. Never under a held finger.
  var ak = activeKey(), sig = ak ? ak.pc + ak.mode : "", force = false;
  if (sig !== kbKeySig && !Object.keys(fingers).length) {
    if (kbKeySig) { kbLast = null; kbChord = null; force = true; shared.kbKeyStay = false; }
    kbKeySig = sig;
  }
  var L = kbWantLow(force);
  if (L === kbWinLow && !force) return false;
  kbWinLow = L;
  kbRebuild();
  return true;
}
// Redraw the window without lifting fingers: a held finger keeps sounding and stays lit.
function kbRebuild() {
  renderKeys();
  Object.keys(fingers).forEach(function (id) {
    var f = fingers[id], k = f.midi != null ? padsEl.querySelector('.pad[data-midi="' + f.midi + '"]') : null;
    f.keyId = k ? k.dataset.id : "gone";
  });
  paintKeyChip(computeSpec());   // in-key dimming and key spellings on the new keys
  paintPads();
}
export function kidsSoloSpec(spec, rootPc, mel) {   // v96: mel = the step melody (else the root)
  // v76: melody relative to the tonic (G3..F#4), so the contour is the same in every key.
  var ak = activeKey(), keyPc = ak ? ak.pc : 0;
  var tonicMidi = 55 + wrap12(keyPc - 7);
  var pick = (spec.midis && spec.midis.length) ? kidsPlace(tonicMidi + (mel != null ? mel : wrap12(rootPc - keyPc))) : null;   // v83: shifted by octaves into the window
  var o = {}, k;
  for (k in spec) o[k] = spec[k];
  o.midis = pick === null ? [] : [pick];
  o.bassOut = null;
  return o;
}
const suggestTapAt = 0;   // last touch/pen tap on a Next chip (click de-dupe)
var suggestSeq;

export function clearSuggestPreview() {
  if (shared.suggestTimer) {
    clearTimeout(shared.suggestTimer);
    shared.suggestTimer = 0;
  }
  stopStripTails();
  if (!shared.suggestPreview) return;
  shared.suggestPreview = null;
  state.forceChord = null;
  // v47: a preview the pedal has adopted keeps ringing until pedal-up.
  if (!sustainPool["suggest"]) ChordAudio.stopChord("suggest");
  updateSymbol();
}

// v52: chip-only chord colours; a pad press or palette touch drops them.
export const STRIP_EXT = ["sus2", "flat9", "sharp9", "thirteen", "over"];
function clearStripExt() {
  STRIP_EXT.forEach(function (k) { state.extensions[k] = k === "over" ? 0 : false; });
  state.stripSpell = null;
}

// v53: chips and strip notes hold like keys. pointerdown starts the chord in its own
// group and it sounds at full level until the finger lifts. Let go before the preview
// length (1.6 s) and it rings on to the end of the preview (a quick tap sounds as before);
// let go later and it releases now. With Sustain down, a lifted chip joins the pedal pool.
export const PREVIEW_MS = 1600;
const stripHolds = {};   // pointerId -> { group, t0, silent }
const stripTails = {};   // group -> timer (let go, still ringing out its preview)
function stripHoldCount() { return Object.keys(stripHolds).length; }
function stripHeld(h) { for (var k in stripHolds) if (stripHolds[k] === h) return true; return false; }
function stopStripTails() {
  Object.keys(stripTails).forEach(function (g) {
    clearTimeout(stripTails[g]);
    delete stripTails[g];
    if (!sustainPool[g]) ChordAudio.stopChord(g);
  });
}
function stripDown(item, pid) {
  if (stripHolds[pid]) stripUp(pid);
  if (!activeKey() && stripKey) { shared.lockKey = { pc: stripKey.pc, mode: stripKey.mode }; }
  var h = { group: null, t0: Date.now(), silent: false };
  stripHolds[pid] = h;
  applySuggestion(item, h);
}
function stripUp(pid) {
  var h = stripHolds[pid];
  if (!h) return;
  delete stripHolds[pid];
  var g = h.group;
  var left = PREVIEW_MS - (Date.now() - h.t0);
  if (g && !h.silent) {
    if (sustainActive()) {
      sustainPool[g] = { pending: null };
      ChordAudio.protectGroup(g);
      ChordAudio.fadeGroup(g);
    } else if (left > 20) {
      stripTails[g] = setTimeout(function () {
        delete stripTails[g];
        if (!sustainPool[g]) ChordAudio.stopChord(g);
      }, left);
    } else {
      ChordAudio.stopChord(g);
    }
  }
  if (!stripHoldCount()) {
    if (shared.suggestTimer) clearTimeout(shared.suggestTimer);
    shared.suggestTimer = setTimeout(clearSuggestPreview, Math.max(0, left));
  }
}
function releaseStripHolds() { Object.keys(stripHolds).forEach(stripUp); }

export function applySuggestion(item, hold) {
  if (paletteTimer) {
    clearTimeout(paletteTimer);
    paletteTimer = 0;
  }
  paletteHolds = {};
  if (!kbKeyGo) shared.kbKeyStay = false;   // v102: a chip / pad / Next chord may move the window again
  setItemState(item);   // v55: shared with the progression player
  var needReplay = !(ChordAudio.ctx && ChordAudio.ctx.state === "running");
  var pending = unlock();
  refreshHeld();
  var spec;
  if (shared.paKeyMidi != null) {   // v109 Play along key: the chord's root on the tapped key, so the tapped key sounds and lights
    var rm0 = state.rootMidi; state.rootMidi = shared.paKeyMidi;
    try { spec = computeSpec(); } finally { state.rootMidi = rm0; }
    if (spec.midis.indexOf(shared.paKeyMidi) < 0) spec.midis = spec.midis.concat([shared.paKeyMidi]).sort(function (a, b) { return a - b; });
  } else spec = computeSpec();
  if (shared.kidsSolo) spec = kidsSoloSpec(spec, item.rootPc, item.mel);
  if (!Object.keys(fingers).length) kbSound(spec.midis, spec, item);   // v83: move the window before mapping the lit keys (v84: not under a held key)
  // Highlight uses exact pad midis when present; otherwise nearest same-pc
  // pad so drop/low/bright (and off-keyboard registers) still light the
  // notes the suggestion is sounding. Audio keeps the true voiced midis.
  shared.suggestPreview = {
    type: spec.type,
    extensions: {
      six: !!state.extensions.six,
      min7: !!state.extensions.min7,
      maj7: !!state.extensions.maj7,
      nine: !!state.extensions.nine
    },
    midis: highlightMidisFromSpec(spec.midis)
  };
  // Finger-held pads already morphed to this chord above; don't stack a
  // duplicate audition on top (doubles level, can clip). Sustain-pool
  // voices don't count as holding, so Next still auditions over the pedal.
  // v36: with the pedal down each audition gets its own group in the
  // sustain pool (stacks like keys; released by dumpSustain).
  var sg = "suggest";
  var pool = false;
  if (hold) {
    // Held chip / note: its own group, not pooled while the finger is down.
    sg = "hold-" + (++suggestSeq);
    hold.group = sg;
    if (!sustainActive()) { stopStripTails(); ChordAudio.stopChord("suggest"); }
  } else if (sustainActive()) {
    sg = "suggest-" + (++suggestSeq);
    sustainPool[sg] = { pending: null };
    pool = true;
  } else {
    stopStripTails();
    ChordAudio.stopChord("suggest");
  }
  if (!state.holding) {
    ChordAudio.playChord(sg, spec.midis, { bass: spec.bassOut, sound: state.sound, key: shared.paKeyMidi != null });   // v109: a Play along key sounds its pitch (as a key tap)
    if (pool) { ChordAudio.protectGroup(sg); ChordAudio.fadeGroup(sg); }
    if (needReplay && pending && typeof pending.then === "function") {
      pending.then(function () {
        if (state.holding) return;
        if (!(ChordAudio.ctx && ChordAudio.ctx.state === "running")) return;
        if (hold && !stripTails[sg] && !sustainPool[sg] && !stripHeld(hold)) return;
        ChordAudio.stopChord(sg);
        ChordAudio.playChord(sg, spec.midis, { bass: spec.bassOut, sound: state.sound });
        if (pool || sustainPool[sg]) { ChordAudio.protectGroup(sg); ChordAudio.fadeGroup(sg); }
      });
    }
  } else if (hold) {
    hold.silent = true;   // pads held: the chip re-voices them instead (as before)
  }
  updateSymbol();
  if (shared.suggestTimer) clearTimeout(shared.suggestTimer);
  if (!hold) shared.suggestTimer = setTimeout(clearSuggestPreview, PREVIEW_MS);
  else shared.suggestTimer = 0;
}

// v48: scale strip. Middle row = the key's 7 notes in scale order with home
// in the middle (major: vi vii° I ii iii IV V; minor: VI VII i ii° III iv v).
// Chip rows sit in the column of the note they are built on, defined on the
// relative major: Happy/Color = Imaj7 IVmaj7 V7 + borrowed II7 (dashed),
// Sad = vi7 ii7 iii7 (m7), Tension = viim7b5, Vsus. Key = suggestionKey().
// v52: faces from the simple-v2 mockup (faces.js); colours come from CSS (--ss-happy / --ss-sad).
function faceSvg(mouth) {
  return "<svg class=\"ss-face\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"10\"/>" +
    "<circle class=\"eye\" cx=\"8.6\" cy=\"9.6\" r=\"1.2\"/><circle class=\"eye\" cx=\"15.4\" cy=\"9.6\" r=\"1.2\"/><path d=\"" + mouth + "\"/></svg>";
}
function arrowSvg(up) {
  return "<svg class=\"ss-arrow\" viewBox=\"0 0 12 14\" aria-hidden=\"true\">" + (up ? "<path d=\"M6 13V2M2 6l4-4 4 4\"/>" : "<path d=\"M6 1v11M2 8l4 4 4-4\"/>") + "</svg>";
}
const SHOW_STRIP_FACES = false;   // v94: decorative row labels, now only in How to
export var STRIP_ICONS;
const STRIP_ROWS = [
  { id: "happy", glyph: "\u2191", label: "Happy /<br>Color", aria: "Happy / Color" },
  { id: "scale", glyph: "\u266a", label: "Scale", aria: "Scale" },
  { id: "sad", glyph: "\u2193", label: "Sad", aria: "Sad" },
  { id: "tension", glyph: "\u21e3", label: "Tension", aria: "Tension" }
];
// v52: each style has its own chip set (same rows and columns; strip notes still
// play triads). Entry: [relative-major degree, quality, row, lowered root, borrowed].
// A lowered root (\u266dVII, \u266dVI) sits in the column of the scale note with the same letter.
export const STRIP_QUAL = {
  maj:    { type: "major", ext: {}, label: "" },
  min:    { type: "minor", ext: {}, label: "m" },
  "7":    { type: "major", ext: { min7: true }, label: "7" },
  maj7:   { type: "major", ext: { maj7: true }, label: "maj7" },
  m7:     { type: "minor", ext: { min7: true }, label: "m7" },
  m7b5:   { type: "dim",   ext: { min7: true }, label: "m7\u266d5" },
  sus4:   { type: "sus4",  ext: {}, label: "sus4" },
  sus2:   { type: "major", ext: { sus2: true }, label: "sus2" },
  add9:   { type: "major", ext: { nine: true }, label: "add9" },
  madd9:  { type: "minor", ext: { nine: true }, label: "madd9" },
  "9":    { type: "major", ext: { min7: true, nine: true }, label: "9" },
  maj9:   { type: "major", ext: { maj7: true, nine: true }, label: "maj9" },
  m9:     { type: "minor", ext: { min7: true, nine: true }, label: "m9" },
  "9sus": { type: "sus4",  ext: { min7: true, nine: true }, label: "9sus" },
  "13":   { type: "major", ext: { min7: true, thirteen: true }, label: "13" },
  "7b9":  { type: "major", ext: { min7: true, flat9: true }, label: "7\u266d9" },
  "7#9":  { type: "major", ext: { min7: true, sharp9: true }, label: "7\u266f9" },
  "7sus4": { type: "sus4", ext: { min7: true }, label: "7sus4" },
  overV:  { type: "major", ext: { over: 2 }, label: "/" },  // IV/V: bass a whole step up
  moverV: { type: "minor", ext: { over: 2 }, label: "m/" }  // iv/V in minor (Dm/E)
};
// v53: rows by sound. Entry: [degree of the key, quality, row, lowered root, borrowed].
// Rows: "bright" = green row on top (borrowed major / dominant / maj7 / open chords, dashed),
// "happy" (gold), "sad" (purple; a borrowed minor chord sits here dashed), "tension"
// (sus, half-diminished, V7b9 / V7#9, and in minor V / V7; solid unless truly borrowed).
// Major sets count degrees from the major home; minor sets from the minor home
// (natural minor: bIII / bVI / bVII are diatonic there, V is the tension chord,
// Picardy I and Dorian IV are bright borrowed).
const STRIP_SETS = {
  pop: [[1, "maj", "happy"], [4, "maj", "happy"], [5, "maj", "happy"],
        [6, "min", "sad"], [2, "min", "sad"], [3, "min", "sad"],
        [5, "sus4", "tension"], [7, "maj", "bright", true, true]],
  // v68 Kids: plain happy triads, the same chips as Pop.
  kids: [[1, "maj", "happy"], [4, "maj", "happy"], [5, "maj", "happy"],
        [6, "min", "sad"], [2, "min", "sad"], [3, "min", "sad"],
        [5, "sus4", "tension"], [7, "maj", "bright", true, true]],
  jazz: [[1, "maj7", "happy"], [4, "maj7", "happy"], [5, "7", "happy"],
         [2, "m7", "sad"], [3, "m7", "sad"], [6, "m7", "sad"],
         [7, "m7b5", "tension"], [5, "7b9", "tension"]],
  rnb: [[1, "maj9", "happy"], [4, "maj9", "happy"], [5, "13", "happy"],
        [2, "m9", "sad"], [3, "m7", "sad"], [6, "m9", "sad"],
        [5, "9sus", "tension"], [7, "maj7", "bright", true, true]],
  ballad: [[1, "add9", "happy"], [4, "add9", "happy"], [5, "maj", "happy"],
           [6, "m7", "sad"], [2, "m7", "sad"], [3, "min", "sad"],
           [4, "overV", "tension"], [7, "maj", "bright", true, true]],
  reggae: [[1, "maj", "happy"], [4, "maj", "happy"], [5, "maj", "happy"],
           [2, "min", "sad"], [6, "min", "sad"],
           [5, "sus4", "tension"], [7, "maj", "bright", true, true]],
  funk: [[1, "9", "happy"], [4, "9", "happy"], [5, "9", "happy"],
         [2, "m7", "sad"], [6, "m7", "sad"],
         [5, "7#9", "tension"], [7, "9", "bright", true, true]],
  // v68: shown as "Yoga" (internal id stays yogaDeep, so saved settings keep it). Plays low and warm: open sus2 shapes keep the low register clear.
  yogaDeep: [[1, "sus2", "happy"], [4, "sus2", "happy"], [5, "sus2", "happy"],
             [6, "m7", "sad"], [2, "m7", "sad"],
             [1, "sus4", "tension"], [7, "sus2", "bright", true, true]],
  // v60 Country: I IV V7, ii iii vi (iii plain), green borrowed II7 and bVII.
  country: [[1, "maj", "happy"], [4, "maj", "happy"], [5, "7", "happy"],
            [6, "min", "sad"], [2, "min", "sad"], [3, "min", "sad"],
            [2, "7", "bright", false, true], [7, "maj", "bright", true, true]]
};
const STRIP_SETS_MINOR = {
  // Pop: Vsus4 and V share the V column in the tension row, so V alone.
  pop: [[3, "maj", "happy"], [6, "maj", "happy"], [7, "maj", "happy"],
        [1, "min", "sad"], [4, "min", "sad"], [5, "min", "sad"],
        [5, "maj", "tension"]],
  kids: [[3, "maj", "happy"], [6, "maj", "happy"], [7, "maj", "happy"],
        [1, "min", "sad"], [4, "min", "sad"], [5, "min", "sad"],
        [5, "maj", "tension"]],
  jazz: [[3, "maj7", "happy"], [6, "maj7", "happy"], [7, "7", "happy"],
         [1, "m7", "sad"], [4, "m7", "sad"], [5, "m7", "sad"],
         [2, "m7b5", "tension"], [5, "7b9", "tension"]],
  rnb: [[3, "maj9", "happy"], [6, "maj9", "happy"], [7, "13", "happy"],
        [1, "m9", "sad"], [4, "m9", "sad"], [5, "m7", "sad"],
        [2, "m7b5", "tension"], [5, "7#9", "tension"], [4, "9", "bright", false, true]],
  ballad: [[3, "add9", "happy"], [6, "add9", "happy"], [7, "maj", "happy"],
           [1, "m7", "sad"], [4, "m7", "sad"], [5, "min", "sad"],
           [4, "moverV", "tension"], [5, "maj", "tension"]],
  reggae: [[3, "maj", "happy"], [6, "maj", "happy"], [7, "maj", "happy"],
           [1, "min", "sad"], [4, "min", "sad"],
           [5, "maj", "tension"]],
  funk: [[3, "maj7", "happy"], [6, "maj7", "happy"], [7, "9", "happy"],
         [1, "m7", "sad"], [4, "m7", "sad"],
         [5, "7#9", "tension"], [4, "9", "bright", false, true]],
  yogaDeep: [[3, "sus2", "happy"], [6, "sus2", "happy"], [7, "sus2", "happy"],
             [1, "m7", "sad"], [4, "m7", "sad"],
             [1, "sus4", "tension"], [5, "maj", "tension"]],
  // v60 Country minor: bIII bVI bVII, i iv v, V7 as the tension chord, Dorian IV green borrowed.
  country: [[3, "maj", "happy"], [6, "maj", "happy"], [7, "maj", "happy"],
            [1, "min", "sad"], [4, "min", "sad"], [5, "min", "sad"],
            [5, "7", "tension"], [4, "maj", "bright", false, true]]
};
export function prettyAcc(name) { return accSym(name); }
export function stripLabel(item) {
  var q = item.qualityLabel || "";
  if (item.chipLabel != null) return prettyAcc(item.rootName) + item.chipLabel;
  if (q === "m7b5") q = "m7\u266d5";
  else if (q === "sus4") q = "sus";
  else if (q === "m" && item.type === "minor") q = "m";
  else if (item.type === "dim" && q === "dim") q = "\u00b0";
  return prettyAcc(item.rootName) + q;
}
// v54: Roman numeral for a strip chip (full mode). Degree counted from the key's own home
// (major: I ii iii IV V vi vii; minor: i ii III iv v VI VII), case from the chip's
// quality (minor / dim lower case), a flat for a lowered root (bVII, bVI, bII),
// \u00b0 for a diminished triad, \u00f8 for half-diminished, /V for a chord over the 5th.
function chipRoman(d, q, ext, low) {
  var base = d.roman.toUpperCase();
  var lower = q.type === "minor" || q.type === "dim";
  var r = (low ? "\u266d" : "") + (lower ? base.toLowerCase() : base);
  if (q.type === "dim") r += ext.min7 ? "\u00f8" : "\u00b0";
  if (ext.over) r += "/V";
  return r;
}
// v54: lowered-letter spelling for an out-of-row chip root, written as the plain letter when
// it would read Cb, Fb, E#, B# or need a double accidental (those are all white keys).
export function plainRootSpell(pc, rs) {
  var odd = Math.abs(rs.acc) >= 2 || (rs.acc === -1 && (rs.li === 0 || rs.li === 3)) || (rs.acc === 1 && (rs.li === 2 || rs.li === 6));
  if (!odd) return rs;
  var nat = [0, -1, 1, -1, 2, 3, -1, 4, -1, 5, -1, 6][wrap12(pc)];
  return nat >= 0 ? { li: nat, acc: 0 } : Theory.spellRoot(pc);
}
function stripModel(key) {
  var minor = key.mode === "minor";
  // v53: the 7 scale notes run in keyboard order (by pitch class from C, spelling kept);
  // the home note keeps its gold outline wherever it lands.
  var kdegs = keyDegrees(key);
  var dorder = kdegs.slice().sort(function (a, b) { return a.pc - b.pc; }).map(function (d) { return d.degree; });
  var notes = dorder.map(function (deg, i) {
    var d = kdegs[deg - 1];
    var tri = mapQuality(d.type === "minor" ? "min" : d.type === "dim" ? "dim" : "maj");
    return {
      col: i, home: deg === 1, name: d.name, pc: d.pc,
      roman: d.roman + (d.type === "dim" ? "\u00b0" : ""),
      item: { rootPc: d.pc, rootName: d.name, degree: d.degree, type: tri.type, extensions: tri.extensions, qualityLabel: d.type === "major" ? "" : d.type === "minor" ? "m" : "dim" }
    };
  });
  var inKey = {};
  keyDegrees(key).forEach(function (d) { inKey[d.pc] = true; });
  var rowPcs = notes.map(function (n) { return n.pc; });   // ascending (piano order)
  var sets = minor ? STRIP_SETS_MINOR : STRIP_SETS;
  var set = sets[state.style] || sets.pop;
  var degs = kdegs;                        // degrees of the key itself (major or natural minor)
  var chips = set.map(function (c) {
    var d = degs[c[0] - 1];
    var q = STRIP_QUAL[c[1]];
    var low = !!c[3];
    var pc = wrap12(d.pc - (low ? 1 : 0));
    var ext = blankExt();
    for (var ek in q.ext) ext[ek] = q.ext[ek];
    var tonePcs = Theory.chordIntervals(q.type, ext).map(function (iv) { return wrap12(pc + iv); });
    if (ext.over) tonePcs.push(wrap12(pc + ext.over));
    var diatonic = tonePcs.every(function (t) { return inKey[t]; });
    // v54: one spelling rule for every style. A root that is one of the 7 row notes is
    // spelled like that note and sits in its column (half-column 1 + 2n). Any other root
    // (bVII, bVI, bII) is the lowered letter, with Cb / Fb / E# / B# / doubles written as the
    // plain letter (B, E, F, C), and sits half a column off, centred between its piano
    // neighbours like a black key (half-column 2 + 2j; 0 or 14 = the end gutters).
    var ni = rowPcs.indexOf(pc), hc, rs;
    if (ni >= 0) {
      rs = kdegs[dorder[ni] - 1].rootSpell;
      hc = 1 + 2 * ni;
    } else {
      rs = plainRootSpell(pc, low ? { li: d.rootSpell.li, acc: d.rootSpell.acc - 1 } : d.rootSpell);
      var below = rowPcs.filter(function (x) { return x < pc; }).length;
      hc = 2 * below;
    }
    var lab = q.label;
    if (ext.over) lab = (q.type === "minor" ? "m" : "") + "/" + accSym(Theory.spellInterval(rs, ext.over).name);
    var row = c[2];
    return {
      col: ni, hc: hc, row: row, borrowed: !!c[4], roman: chipRoman(d, q, ext, low),
      cls: row === "bright" ? "color" : row === "happy" ? "major" : row === "sad" ? "minor" : "tension",
      item: {
        rootPc: pc, rootName: Theory.noteName(rs), rootSpell: rs,
        degree: (!low && diatonic && q.type === d.type) ? d.degree : null,
        type: q.type, extensions: ext, qualityLabel: q.label, chipLabel: lab,
        keepSpell: ni >= 0
      }
    };
  });
  // v54: a half-column chip that would overlap another chip in its row (A minor Romantic:
  // green bII next to the green Picardy I) moves to the other row of its group
  // (green <-> gold, purple <-> tension), keeping its colour.
  var PARTNER = { bright: "happy", happy: "bright", sad: "tension", tension: "sad" };
  function hits(c, row) {
    return chips.some(function (o) { return o !== c && o.row === row && Math.abs(o.hc - c.hc) < 2; });
  }
  // v55: of two colliding chips, move the one whose own column is empty in the partner row
  // (A minor Romantic: the Picardy A goes to the empty gold A cell, green B\u266d stays put).
  chips.forEach(function (c) {
    if (!hits(c, c.row)) return;
    var group = [c].concat(chips.filter(function (o) { return o !== c && o.row === c.row && Math.abs(o.hc - c.hc) < 2; }));
    var cands = group.filter(function (x) { return PARTNER[x.row] && !hits(x, PARTNER[x.row]); });
    cands.sort(function (a, b) { return (a.hc % 2 === 0 ? 1 : 0) - (b.hc % 2 === 0 ? 1 : 0); });
    if (cands.length) cands[0].row = PARTNER[cands[0].row];
  });
  return { key: key, notes: notes, chips: chips };
}

// Touch/pen fire on pointerup: browsers drop the synthetic click when
// another finger is down (e.g. holding Sustain). Click stays for
// mouse / keyboard, de-duplicated against the pointer tap.
export function wireStripTap(b, item) {
  // v53: hold like a key (see stripDown / stripUp). Pressed look lasts the whole hold.
  var pressT = 0, upAt = 0;
  function unpress() { clearTimeout(pressT); pressT = setTimeout(function () { b.classList.remove("press"); }, 120); }
  b.addEventListener("pointerdown", function (e) {
    if (e.button != null && e.button !== 0) return;
    clearTimeout(pressT);
    b.classList.add("press");
    try { b.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    if (kidsGoldPad(b)) { kidsGoldGo(b, "pad"); return; }   // v79
    shared.paEvT = e.timeStamp || performance.now();
    if (paTwin("chip", null, item, b)) return;   // v111 (D6): the same press as a root key just now
    if (playAlongChip(b, item)) { playAlongGo(b, "chip"); return; }   // v108
    paHintMiss("chip", b);   // v112: a hint (the chip still sounds)
    fxTapPulse(b);   // v93
    stripDown(item, e.pointerId);
  });
  function up(e) { upAt = Date.now(); unpress(); stripUp(e.pointerId); }
  b.addEventListener("pointerup", up);
  b.addEventListener("pointercancel", up);
  b.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  // Keyboard (Enter / Space) still plays a preview; the click after a pointer release is skipped.
  b.addEventListener("click", function () {
    if (upAt && Date.now() - upAt < 700) { upAt = 0; return; }
    if (kidsGoldPad(b)) { kidsGoldGo(b, "pad"); return; }   // v79 (Enter / Space)
    if (playAlongChip(b, item)) { playAlongGo(b, "chip"); return; }   // v108 (Enter / Space)
    fxTapPulse(b);   // v93
    stripTap(item);
  });
}
// No key yet: the strip on screen becomes the key (same as the first chord
// locking it), so tapping a note doesn't re-key the strip under the finger.
export var stripKey;
function stripTap(item) {
  if (!activeKey() && stripKey) { shared.lockKey = { pc: stripKey.pc, mode: stripKey.mode }; }
  applySuggestion(item);
}

export function paintSuggestions(spec) {
  var key = suggestionKey(spec || computeSpec());
  var sig = key.pc + key.mode + keyRootName(key) + state.style;
  if (sig === shared.suggestSig) return;
  shared.suggestSig = sig;
  stripKey = key;
  progSync(key);   // v55: style change -> first progression; key / style change stops its loop
  var model = stripModel(key);
  var el = document.getElementById("suggest");
  el.className = "ss";
  el.setAttribute("aria-label", "Scale strip, key of " + prettyAcc(keyRootName(key)) + " " + key.mode);
  el.innerHTML = "";
  // Rows: 1 borrowed happy-group chips (dashed) | 2 happy | 3 scale | 4 sad | 5 tension.
  // Two rows above the scale and two below keep the scale row at the exact middle.
  // v53: named grid lines (b h n s t; faces hi / si) so each layout can arrange the rows;
  var ROWN = { bright: "b", happy: "h", scale: "n", sad: "s", tension: "t" };
  // v54: fixed 5 rows: the green row keeps its band even when empty (gold stays row 2).
  el.classList.toggle("gutl", model.chips.some(function (c) { return c.hc === 0; }));
  el.classList.toggle("gutr", model.chips.some(function (c) { return c.hc === 14; }));
  // v52: no text labels (young players): a happy face beside the row above the
  // scale, a sad face beside the Sad + Tension rows, nothing on the scale row.
  // v94: the happy / sad face labels are gone from the strip (How to, step 4, shows them)
  if (SHOW_STRIP_FACES) STRIP_ICONS.forEach(function (r) {
    var l = document.createElement("div");
    l.className = "ss-lbl ss-ico-" + r.id;
    l.style.gridRow = r.rows;
    l.setAttribute("role", "img");
    l.setAttribute("aria-label", r.aria);
    l.innerHTML = r.svg;
    el.appendChild(l);
  });
  // v54: faint lines frame only the note row: one line above, one below, and
  // dividers between its 7 cells. No lines anywhere else.
  var gn = document.createElement("div");
  gn.className = "ss-gl ss-gn";
  gn.setAttribute("aria-hidden", "true");
  el.appendChild(gn);
  for (var gci = 0; gci < 7; gci++) {
    var gcEl = document.createElement("div");
    gcEl.className = "ss-gl ss-gc" + (gci === 6 ? " last" : "");
    gcEl.style.gridColumn = (3 + 2 * gci) + " / span 2";
    gcEl.setAttribute("aria-hidden", "true");
    el.appendChild(gcEl);
  }
  var track = document.createElement("div");
  track.className = "ss-track";
  track.setAttribute("aria-hidden", "true");
  el.appendChild(track);
  model.notes.forEach(function (n) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "ss-note" + (n.home ? " home" : "");
    b.style.gridRow = "n";
    b.style.gridColumn = (3 + 2 * n.col) + " / span 2";
    b.innerHTML = "<span class=\"nn\"></span><small></small>";
    b.firstChild.textContent = prettyAcc(n.name);
    b.lastChild.textContent = n.roman;
    b.setAttribute("aria-label", prettyAcc(n.name) + ", " + n.roman + (n.home ? ", home" : "") + ", plays " + stripLabel(n.item));
    b._tc = { item: n.item, hc: 1 + 2 * n.col, row: "scale" };
    wireStripTap(b, n.item);
    el.appendChild(b);
  });
  model.chips.forEach(function (c) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "ss-chip " + c.cls + " r-" + ROWN[c.row] + (c.borrowed ? " borrowed" : "");
    b.style.gridRow = ROWN[c.row];
    b.style.gridColumn = (2 + c.hc) + " / span 2";
    if (c.hc % 2 === 0) b.classList.add("half");
    var lab = stripLabel(c.item), rn = prettyAcc(c.item.rootName);
    // v54: .rn = Roman numeral, shown in full mode only (CSS).
    // .nm wraps the name (display: contents unless the numeral goes on its own line).
    b.innerHTML = "<span class=\"nm\"><span class=\"r\"></span><span class=\"q\"></span></span><span class=\"rn\"></span>";
    b.querySelector(".r").textContent = rn;
    b.querySelector(".q").textContent = lab.slice(rn.length);
    b.querySelector(".rn").textContent = c.roman;
    if (lab.length - rn.length >= 5) b.classList.add("long");
    b.setAttribute("aria-label", stripLabel(c.item) + (state.simple ? "" : ", " + c.roman) + " (" + (c.row === "bright" ? "bright, borrowed" : c.row + (c.borrowed ? ", borrowed" : "")) + ")");
    b._tc = { item: c.item, hc: c.hc, row: c.row };
    wireStripTap(b, c.item);
    el.appendChild(b);
  });
  progDecorate(el, model);   // v55: progression badges + temporary chips
  paintKidChip();   // v70: Kids shows one big chip instead of the board
  paintNextHint();   // v68: queued chord recomputed for the new key / style / progression
  fitStrip();
  paintProg();
  // v52: one gentle left-to-right pulse across the note buttons, the first time
  // the strip shows in Simple (skipped for reduced motion).
  if (state.simple && !notesPulsed) {
    notesPulsed = true;
    var calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!calm) {
      Array.prototype.forEach.call(el.querySelectorAll(".ss-note"), function (n, i) {
        n.style.animationDelay = (250 + i * 110) + "ms";
        n.classList.add("pulse");
        n.addEventListener("animationend", function () { n.classList.remove("pulse"); n.style.animationDelay = ""; }, { once: true });
      });
    }
  }
}
var notesPulsed;
// v99: full mode (not Kids, not Simple, not an uploaded song, which has its own next-chord outline):
// mark the grid cell of the chord Play would sound right now. Stopped: Play starts at step 1. Playing: the
// step after the lit one (none in the random part after one pass). No mark when that step has no grid
// cell, or when it is the cell that is playing now.
var laEl;
var laT;
export function laTarget() {
  var n = prog.steps.length;
  if (!n || state.style === "kids" || state.simple || upSelected()) return null;
  var start = prog.playing ? (prog.cur >= 0 ? prog.cur + 1 : prog.si) : progPlayStart();   // v111: Play starts at the Next walk position
  if (start >= n) start = 0;   // v111: loops
  var t = prog.targets[start] || null;
  if (!t || !t.isConnected || !t.getClientRects().length || getComputedStyle(t).visibility === "hidden") return null;
  var now = prog.cur >= 0 ? prog.targets[prog.cur] : (magic.lit ? magicTarget(magic.item) : null);
  if (t === now || t.classList.contains("pg-on")) return null;
  return t;
}
export function paintLookahead() {
  var t = laTarget();
  if (laEl && laEl !== t) laEl.classList.remove("la-play");
  if (t) t.classList.add("la-play");
  laEl = t;
  nxMarkSoon();   // v105
}
// v105: the NEXT chord = what Next / Play sounds next. Kids: the gold step. Uploaded song: its next step.
// Presets: playing = the step after the lit one (none in the random part); stopped = the queued Next chord.
export function nxNow() {
  if (typeof magic === "undefined" || !magic || !prog.steps.length) return null;
  var item = null, el = null, sig = "", n = prog.steps.length;
  if (state.style === "kids") {
    item = kidsHintItem();
    if (!item) return null;
    el = kidsGoldPadEl(item);
    sig = "k" + (prog.playing ? "p" + prog.cur : "n" + magic.pos);
  } else if (upSelected()) {
    var i = upNextStep();
    if (i < 0) return null;
    item = prog.steps[i].item; el = prog.targets[i] || magicTarget(item);
    sig = "u" + i + (prog.playing ? "p" + prog.cur : "n" + magic.pos);
  } else if (prog.playing) {
    var j = prog.cur >= 0 ? prog.cur + 1 : prog.si;
    if (j >= n) j = 0;   // v111: Play song loops (no random tail)
    item = prog.steps[j].item; el = prog.targets[j] || magicTarget(item);
    sig = "p" + j + "c" + prog.cur;
  } else {
    var d = magicQueue();
    if (!d || !d.item) return null;
    item = d.item; el = d.step >= 0 && prog.targets[d.step] ? prog.targets[d.step] : magicTarget(item);
    sig = "q" + d.step + "m" + magic.pos + "c" + (magic.cycle || 0) + ":" + item.rootPc + item.type;
  }
  if (el && (!el.isConnected || !el.getClientRects().length)) el = null;
  return { item: item, el: el, sig: sig + "|" + prog.idx + "|" + state.style + "|" + (state.simple ? 1 : 0) };
}
function nxTableEls(item) {
  var out = [];
  if (!item) return out;
  var tb = document.querySelector("#palette button[data-type=\"" + item.type + "\"]");
  if (tb && tb.getClientRects().length) out.push(tb);
  var ex = item.extensions || {};
  for (var k in ex) if (ex[k]) { var eb = document.querySelector("#palette button[data-ext=\"" + k + "\"]"); if (eb && eb.getClientRects().length) out.push(eb); }
  return out;
}
export function nxKeyEl(item) {
  if (!item || state.simple) return null;
  var k = padsEl.querySelector(".pad.nx-root");
  if (k) return k;
  var pc = wrap12(state.style === "kids" && item.mel != null ? item.rootPc : item.rootPc), best = null;
  Array.prototype.forEach.call(padsEl.querySelectorAll(".pad"), function (p) {
    if (wrap12(+p.dataset.pc) !== pc || p.classList.contains("out") || !p.getClientRects().length) return;
    if (!best || +p.dataset.midi < +best.dataset.midi) best = p;
  });
  return best;
}
export var nxSigLast;
var nxT;
export var nxBursts;
var nxReduce;
function nxBurst(el) {
  if (!el) return;
  el.classList.remove("nxb");
  void el.offsetWidth;
  el.classList.add("nxb");
  clearTimeout(el._nxb);
  el._nxb = setTimeout(function () { el.classList.remove("nxb"); }, 560);
}
export function paintNxMark() {
  nxT = 0;
  var cur = nxNow(), dots = [];
  if (cur) {
    if (cur.el && !(state.style === "kids" && cur.el.classList.contains("ss-kidpad"))) dots.push(cur.el);   // Kids pads already carry this dot (v71)
    dots = dots.concat(nxTableEls(cur.item));
  }
  Array.prototype.forEach.call(document.querySelectorAll(".nxdot"), function (n) { if (dots.indexOf(n) < 0) { n.classList.remove("nxdot"); var d = n.querySelector(":scope > .nxd"); if (d) d.remove(); } });
  dots.forEach(function (n) {
    n.classList.add("nxdot");
    if (!n.querySelector(":scope > .nxd")) { var d = document.createElement("i"); d.className = "nxd"; d.setAttribute("aria-hidden", "true"); n.appendChild(d); }
  });
  var sig = cur ? cur.sig + "|" + (cur.item.rootPc + ":" + cur.item.type) : "";
  if (sig && sig !== nxSigLast && !(nxReduce && nxReduce.matches)) {
    nxBursts++;
    nxBurst(nxKeyEl(cur.item));
    nxTableEls(cur.item).forEach(nxBurst);
    nxBurst(cur.el);
  }
  nxSigLast = sig;
}
export function nxMarkSoon() { if (!nxT) nxT = setTimeout(paintNxMark, 0); }
export function paintProgActive() {
  Array.prototype.forEach.call(document.querySelectorAll("#suggest .pg-on"), function (n) { n.classList.remove("pg-on"); });
  var t = prog.cur >= 0 ? prog.targets[prog.cur] : (magic.lit ? magicTarget(magic.item) : null);
  if (t) t.classList.add("pg-on");
  prog.badges.forEach(function (b) { b.el.classList.toggle("on", prog.cur >= 0 && b.steps.indexOf(prog.cur) >= 0); });
  if (prog.badges.some(function (b) { return b.steps.length > 2; })) placeBadges();
  paintKidChip();
  paintSongBar();   // Upload: song bar + review flags
  paintKidsLyr();   // v97
  paintNextHint();   // v71: Kids next-note hint advances with each step; first-load fix: every style (Stop / song pick / ring end repaint the keys)
  paintLookahead(); if (!laT) laT = setTimeout(function () { laT = 0; paintLookahead(); }, 0);   // v99 (again once the strip is laid out)
}
// v68 "next chord" hint (full mode only): a soft pulsing gold outline on the exact keys the
// next Next tap will play, a gold dot on its root key, the same outline on its strip chip,
// and a small gold edge arrow if an outlined key is off-screen. Shown from a Next / badge tap
// until that chord's ring ends (or Simple / the loop player takes over).
export function nextHintSpec(item) {
  var ext = {}, k;
  for (k in state.extensions) ext[k] = state.extensions[k];
  var keep = { rootPc: state.rootPc, type: state.type, stripSpell: state.stripSpell, forceChord: state.forceChord, degree: state.degree };
  setItemState(item);
  var spec = computeSpec();
  for (k in ext) state.extensions[k] = ext[k];
  for (k in keep) state[k] = keep[k];
  return spec;
}
function clearNextHintDom() {
  Array.prototype.forEach.call(document.querySelectorAll(".nx, .nx-root"), function (n) { n.classList.remove("nx", "nx-root"); });
  var a = document.getElementById("nxArrow");
  if (a) a.hidden = true;
}
export function magicHintClear() {
  if (magic) magic.hint = false;
  clearNextHintDom();
  paintNextHint();   // v71: the Kids song hint stays until the pass ends; first-load fix: the next chord stays marked in every style
}
// v71 Kids: the UPCOMING song step (Next walk or Play's one pass) is outlined on BOTH the
// keyboard (its single root key, full mode; Simple has no keyboard) and the matching one of
// the seven chord pads, plus the big Now chip in full mode. Shown from the start of the song,
// advances every step, clears when the song pass ends (random part) or Kids is left.
function kidsHintItem() {
  if (!prog.steps.length) return null;
  if (prog.playing) {
    var nx = prog.cur >= 0 ? (prog.cur + 1) % prog.steps.length : prog.si % prog.steps.length;   // v82: Kids Play loops; v111: before the first step, Play's start step
    return prog.steps[nx].item;
  }
  var d = magicQueue();
  return d && d.step >= 0 ? d.item : null;
}
function paintKidsHint() {
  if (kbUpdate()) return;   // v83: the window moved; the rebuild already painted the gold
  var item = kidsHintItem();
  if (!item) return;
  var gp = kidsGoldPadEl(item);
  if (gp) gp.classList.add("nx", "nx-root");
  var outlined = [];
  if (!state.simple) {
    var chip = document.querySelector("#suggest .ss-kid");
    if (chip) chip.classList.add("nx");
    var gk = kidsGoldKeyEl(item);
    if (gk) { gk.classList.add("nx", "nx-root"); outlined.push(gk); }
  }
  nextHintArrow(outlined);
}
// The gold pad: the pad with the step's root and major/minor; v79: if no pad has that
// quality (a major V in a minor key: the pad is the minor v), the pad with that root.
function kidsGoldPadEl(item) {
  var pads = document.querySelectorAll("#suggest .ss-kidpad"), byRoot = null;
  for (var i = 0; i < pads.length; i++) {
    var it = pads[i]._tc && pads[i]._tc.item;
    if (!it || wrap12(it.rootPc) !== wrap12(item.rootPc)) continue;
    if ((it.type === "minor") === (item.type === "minor")) return pads[i];
    if (!byRoot) byRoot = pads[i];
  }
  return byRoot;
}
// The gold key: the keyboard key that shows the step's song note (the same key the hint paints).
function kidsGoldKeyEl(item) {
  var spec = kidsSoloSpec(nextHintSpec(item), item.rootPc, item.mel);
  var mids = highlightMidisFromSpec(spec.midis);
  var keys = padsEl.querySelectorAll(".pad");
  for (var k = 0; k < keys.length; k++) {
    if (!mids[keys[k].dataset.midi] || keys[k].classList.contains("out")) continue;
    return keys[k];
  }
  return null;
}
// v79 Kids tap-to-advance: tapping the gold PAD (that chord pad) or the gold KEY (that exact
// MIDI key) plays the step's single song note and moves the walk on, exactly like Next
// (magicAdvance). Repeated notes advance too. After the last step the walk goes back to the
// start. Not during Play song (its timer owns the walk). Any other tap: unchanged (chord).
function kidsGoldStep() {
  if (state.style !== "kids" || state.playAlong === false || prog.playing || !prog.steps.length || typeof magic === "undefined" || !magic) return null;   // v108: off = sound only
  var d = magicQueue();
  return d && d.step >= 0 && d.item ? d : null;
}
function kidsGoldPad(b) {
  if (!b || !b.classList.contains("ss-kidpad") || !b._tc) return false;
  var d = kidsGoldStep();
  return !!(d && kidsGoldPadEl(d.item) === b);
}
function kidsGoldKey(pad) {   // v108: the gold key's note in ANY octave (pitch class), not only the gold key itself
  if (!pad || state.simple || pad.dataset.midi == null || pad.dataset.midi === "") return false;
  var d = kidsGoldStep();
  var gk = d ? kidsGoldKeyEl(d.item) : null;
  return !!(gk && wrap12(Number(pad.dataset.midi)) === wrap12(Number(gk.dataset.midi)));
}
// v112 Play along hints (Config > Show hints, on by default). A tap that does not advance while a next chord is
// marked gets one small pill above the keyboard for 2 s: at most one every 4 s, the same hint not again until an
// advance, never during Play (song or loop) or with Play along off. The tap itself still sounds as before.
// a: outside Kids, a key that is not the next root (the marked key pulses once); b: outside Kids, another chip;
// c: a key or chip while a chord-table button is held; d: Kids, a pad or key that is not gold (a grayed key too);
// e: the 3rd miss in a row, once per song. Not-in-key taps are folded into a / b.
const PA_HINT_MS = 2000;
const PA_HINT_GAP = 4000;
var paHintAt;
var paHintSeen;
var paHintTimer;
var paLostSong;
export const paHintLog = { shown: [], skipped: [], misses: 0 };
const PA_HINT_TXT = { a: "Try the marked key next", b: "Tap the dot chord next", c: "Let go of the chord button to follow the song",
  d: "Tap the dot chord next", e: "Lost? Tap Next to hear the next chord", ek: "Tap the dot chord next",
  k: "That note isn't in this song's key", kc: "That chord isn't in this song's key" };   // v112.1 (M1)
var paMissSong;
function paTableHeld() { for (var h in paletteHolds) if (paletteHolds[h]) return true; return false; }
function playAlongKeyOk(pad) {   // the tap is an advance (Kids gold key handled earlier; root key outside Kids)
  return playAlongKey(pad);
}
function paHintOk() {
  return state.paHints !== false && state.playAlong !== false && !prog.playing && !(typeof loop !== "undefined" && loop && loop.playing);
}
function paHintMiss(kind, el) {
  if (!paHintOk()) return;
  var id, pulse = null;
  if (state.style === "kids") {
    if (!kidsGoldStep()) return;
    if (kind === "chip" && !(el && el.classList.contains("ss-kidpad"))) return;
    id = "d";
  } else {
    var cur = playAlongNow();
    if (!cur) return;
    if (kind === "key" && state.simple) return;
    if (paTableHeld()) id = "c";
    else if (kind === "key" && el && el.classList.contains("nokey")) id = "k";   // v112.1 (M1): out-of-key key (Full Range off)
    else if (kind === "chip" && el && el.classList.contains("borrowed")) id = "kc";   // v112.1 (M1): out-of-key chip
    else if (kind === "key") { id = "a"; pulse = nxKeyEl(cur.item); }
    else id = "b";
  }
  var song = state.style + "|" + ((prog.list[prog.idx] || {}).name || "");
  if (song !== paMissSong) { paMissSong = song; shared.paMiss = 0; paHintSeen = {}; }   // v112.1 (L2)
  shared.paMiss++;
  paHintLog.misses++;
  if (shared.paMiss >= 3 && paLostSong !== song && paHintShow(state.style === "kids" ? "ek" : "e", kind)) { paLostSong = song; return; }
  if (paHintShow(id, kind) && pulse) nxBurst(pulse);   // a: the marked key pulses once (v105 burst)
}
function paHintShow(id, kind) {
  var now = (window.performance && performance.now) ? performance.now() : Date.now();
  if (now - paHintAt < PA_HINT_GAP) { paHintLog.skipped.push({ id: id, why: "rate" }); return false; }
  if (paHintSeen[id]) { paHintLog.skipped.push({ id: id, why: "repeat" }); return false; }
  var el = document.getElementById("paHint");
  if (!el) return false;
  paHintSeen[id] = true; paHintAt = now;
  el.textContent = PA_HINT_TXT[id];
  el.hidden = false;
  paHintPlace(el);
  void el.offsetWidth;
  el.classList.add("on");
  clearTimeout(paHintTimer);
  paHintTimer = setTimeout(paHintHide, PA_HINT_MS);
  paHintLog.shown.push({ id: id, text: PA_HINT_TXT[id], kind: kind, t: Math.round(now), style: state.style });
  return true;
}
const PA_HINT_AVOID = "#pads .pad, #suggest button, #suggest .ss-chip, #suggest .ss-note, #suggest .ss-kidpad, #palette button, button, input, select, [role=button], #kidsLyr .sb-row";
function paHintPlace(el) {   // v112.3: as high as possible (top area or empty space), every style, Simple and Full
  var vw = window.innerWidth, vh = window.innerHeight, av = [];
  function add(r) { if (r && r.width > 0 && r.height > 0) av.push(r); }
  Array.prototype.forEach.call(document.querySelectorAll(PA_HINT_AVOID + ", #styles, .now-card, #symbol, #tones, #nowMix"), function (b) {
    if (b.closest("#paHint, #tour") || b.matches("#kidsLyr .sb-row")) return;
    add(b.getBoundingClientRect());
  });
  Array.prototype.forEach.call(document.querySelectorAll("#kidsLyr .sb-row"), function (row) {   // lyric lines: the words themselves
    if (!row.getBoundingClientRect().width) return;
    try { var rg = document.createRange(); rg.selectNodeContents(row); Array.prototype.forEach.call(rg.getClientRects(), add); } catch (e) { add(row.getBoundingClientRect()); }
  });
  var cfgs = [[0, 0], [0, 240], [0, 200], [1, 0], [1, 200], [1, 160], [1, 130], [1, 110]], best = null;
  for (var c = 0; c < cfgs.length; c++) {
    el.classList.toggle("compact", !!cfgs[c][0]);
    el.style.width = cfgs[c][1] ? Math.min(cfgs[c][1], vw - 16) + "px" : "";
    var h = el.offsetHeight || 32, w = el.offsetWidth || 200, found = null;
    for (var y = 2; y <= vh - h - 2 && (!best || y < best.y); y += 2) {
      var bx = null;
      for (var x = 4; x <= vw - w - 4; x += 4) {
        var ok = true;
        for (var k = 0; k < av.length; k++) { var r = av[k]; if (x < r.right + 2 && x + w > r.left - 2 && y < r.bottom + 2 && y + h > r.top - 2) { ok = false; break; } }
        if (ok && (bx === null || Math.abs(x + w / 2 - vw / 2) < Math.abs(bx + w / 2 - vw / 2))) bx = x;
      }
      if (bx !== null) { found = { x: bx, y: y, c: c }; break; }
    }
    if (found && (!best || found.y < best.y)) best = found;
    if (best && best.y <= 4) break;
  }
  if (!best) best = { x: 4, y: 2, c: cfgs.length - 1 };
  el.classList.toggle("compact", !!cfgs[best.c][0]);
  el.style.width = cfgs[best.c][1] ? Math.min(cfgs[best.c][1], vw - 16) + "px" : "";
  el.style.left = best.x + "px"; el.style.transform = "none";
  el.style.top = Math.round(best.y) + "px";
}
export function paHintHide() {
  clearTimeout(paHintTimer); paHintTimer = 0;
  var el = document.getElementById("paHint");
  if (!el) return;
  el.classList.remove("on");
  el.hidden = true;
}
export function paHintAdvanced() { shared.paMiss = 0; paHintSeen = {}; }

// v112 first-launch Kids tour: 6 steps in the v110 spotlight look. Runs once after the fresh Kids + Twinkle load,
// saved as done on Skip / Done (its own storage key: Factory reset keeps it); Help > Tour (gear menu) replays it.
const TOUR_KEY = "touchChord.tour.v1";
const TOUR = [
  { sel: null, text: "Hi! Let's play Twinkle Twinkle Little Star." },
  { sel: "#suggest .ss-kidpad.nx-root", text: "Tap the gold pad to play the next chord." },
  { sel: "#pads .pad.nx-root", text: "Or tap the gold key on the piano. This works too." },
  { sel: "#kidsLyr", text: "The words light up as you go." },
  { sel: "#prog .pg-song", text: "Tap Play to hear the whole song." },
  { sel: "#prog .pg-sel", text: "Pick another song here. There are 10!" }
];
export var tourI;
export const tourLog = { runs: 0, done: 0, skipped: 0, steps: [] };
export function tourDone() { try { return window.localStorage && window.localStorage.getItem(TOUR_KEY) === "done"; } catch (err) { return false; } }
function tourSave() { try { if (window.localStorage) window.localStorage.setItem(TOUR_KEY, "done"); } catch (err) { /* quiet */ } }
export function tourStart(replay) {
  var box = document.getElementById("tour");
  if (!box) return;
  tourWire();
  if (replay) {   // Help > Tour: the tour is about Kids + Twinkle, so it opens there
    if (prog.playing) progStop();
    if (state.style !== "kids") { var kb = document.querySelector('#styles button[data-style="kids"]'); if (kb) kb.click(); }
    var tw = -1; prog.list.forEach(function (x, i) { if (tw < 0 && /Twinkle/.test(x.name)) tw = i; });
    if (tw >= 0 && prog.idx !== tw) progSet(tw);
  }
  paHintHide();
  tourI = 0; tourLog.runs++;
  box.hidden = false;
  tourShow();
}
function tourEnd(how) {
  var box = document.getElementById("tour");
  if (box) box.hidden = true;
  tourI = -1;
  tourSave();
  tourLog[how]++;
}
function tourShow() {
  var box = document.getElementById("tour");
  if (!box || tourI < 0) return;
  var st = TOUR[tourI], last = tourI === TOUR.length - 1;
  box.querySelector(".tour-text").textContent = st.text;
  box.querySelector(".tour-step").textContent = (tourI + 1) + " / " + TOUR.length;
  var nx = box.querySelector(".tour-next");
  nx.textContent = last ? "Done" : "Next";
  box.querySelector(".tour-skip").hidden = last;
  tourPlace();
  tourLog.steps.push(tourI + 1);
  try { nx.focus({ preventScroll: true }); } catch (err) { /* quiet */ }
}
function tourPlace() {
  var box = document.getElementById("tour");
  if (!box || tourI < 0) return;
  var st = TOUR[tourI], el = st.sel ? document.querySelector(st.sel) : null, r = el ? el.getBoundingClientRect() : null;
  var hole = box.querySelector(".tour-hole"), num = box.querySelector(".tour-num"), dim = box.querySelector(".tour-dim"), card = box.querySelector(".tour-card");
  var W = window.innerWidth, H = window.innerHeight, P = 6, M = 12;
  var cw = card.offsetWidth, ch = card.offsetHeight, top, left;
  if (r && r.width > 0 && r.height > 0) {
    var hr = { l: Math.max(2, r.left - P), t: Math.max(2, r.top - P), r: Math.min(W - 2, r.right + P), b: Math.min(H - 2, r.bottom + P) };
    hole.hidden = false; dim.hidden = true;
    hole.style.left = hr.l + "px"; hole.style.top = hr.t + "px"; hole.style.width = (hr.r - hr.l) + "px"; hole.style.height = (hr.b - hr.t) + "px";
    num.hidden = false; num.textContent = String(tourI + 1);
    num.style.left = Math.max(2, hr.l - 10) + "px"; num.style.top = Math.max(2, hr.t - 10) + "px";
    var gap = 14;
    if (H - hr.b >= ch + gap + M) { top = hr.b + gap; left = (W - cw) / 2; }
    else if (hr.t >= ch + gap + M) { top = hr.t - gap - ch; left = (W - cw) / 2; }
    else if (W - hr.r >= cw + gap + M) { left = hr.r + gap; top = (H - ch) / 2; }
    else if (hr.l >= cw + gap + M) { left = hr.l - gap - cw; top = (H - ch) / 2; }
    else { top = (H - hr.b > hr.t) ? H - ch - M : M; left = (W - cw) / 2; }
  } else {
    hole.hidden = true; num.hidden = true; dim.hidden = false;
    top = (H - ch) / 2; left = (W - cw) / 2;
  }
  card.style.left = Math.round(Math.max(M, Math.min(W - cw - M, left))) + "px";
  card.style.top = Math.round(Math.max(M, Math.min(H - ch - M, top))) + "px";
}
var tourWired;
function tourWire() {   // the tour box comes after this script in the page: wired on first use
  var box = document.getElementById("tour");
  if (!box || tourWired) return;
  tourWired = true;
  box.querySelector(".tour-next").addEventListener("click", function () {
    if (tourI < 0) return;
    if (tourI >= TOUR.length - 1) { tourEnd("done"); return; }
    tourI++; tourShow();
  });
  box.querySelector(".tour-skip").addEventListener("click", function () { if (tourI >= 0) tourEnd("skipped"); });
  box.addEventListener("keydown", function (e) { if (e.key === "Escape" && tourI >= 0) { e.preventDefault(); tourEnd("skipped"); } });
  window.addEventListener("resize", function () { setTimeout(tourPlace, 60); });
}
export function kidsTapPulse(el) {
  if (!el) return;
  el.classList.remove("kgtap");
  void el.offsetWidth;   // restart the flash on a repeated tap
  el.classList.add("kgtap");
  clearTimeout(el._kgT);
  el._kgT = setTimeout(function () { el.classList.remove("kgtap"); }, 450);
  if (PROG_TEST) kidsTapLog.pulses++;
}
// v93: the same flash for full mode (not Simple, not Kids): a tapped chip, and the chip Next / Play song lights
export const fxTapLog = { n: 0, last: "" };
function fxOn() { return !state.simple && state.style !== "kids"; }
function fxTapPulse(el) {
  if (!el || !fxOn()) return;
  el.classList.remove("fxtap");
  void el.offsetWidth;   // restart on a repeated tap / step
  el.classList.add("fxtap");
  clearTimeout(el._fxT);
  el._fxT = setTimeout(function () { el.classList.remove("fxtap"); }, 380);
  if (PROG_TEST) { fxTapLog.n++; fxTapLog.last = el.textContent; }
}
export function fxStepPulse() { if (fxOn()) fxTapPulse(document.querySelector("#suggest .pg-on")); }
export const kidsTapLog = { taps: [], pulses: 0 };
function kidsGoldGo(el, kind) {
  var d = kidsGoldStep();
  if (!d) return;
  var last = d.step === prog.steps.length - 1;
  magicAdvance();   // plays the single song note (kidsSolo), queues and paints the next gold (v81: wraps like Next)
  if (PROG_TEST) kidsTapLog.taps.push({ kind: kind, step: d.step, pos: magic.pos, wrap: last });
  kidsTapPulse(el);
  Array.prototype.forEach.call(document.querySelectorAll("#suggest .ss-kidpad.nx-root, #pads .pad.nx-root"), function (n) { if (n !== el) kidsTapPulse(n); });
}
export function paintNextHint() {
  nxMarkSoon();   // v105
  clearNextHintDom();
  if (typeof magic === "undefined" || !magic) return;
  if (state.style === "kids") { paintKidsHint(); return; }
  if (!magic || state.simple || prog.playing) return;   // first-load fix: no magic.hint gate (it was only set by a Next / badge tap)
  var d = magicQueue();
  if (!d) return;
  if (upSelected() && upNextStep() < 0) return;   // v73 (v111: never true now, the song loops)
  var spec = nextHintSpec(d.item);
  if (state.style === "kids") spec = kidsSoloSpec(spec, d.item.rootPc, d.item.mel);   // v70: Kids plays the root only
  var mids = highlightMidisFromSpec(spec.midis);
  var pads = padsEl.querySelectorAll(".pad"), seen = {}, root = null, outlined = [];
  for (var i = 0; i < pads.length; i++) {
    var m = pads[i].dataset.midi;
    if (!mids[m] || seen[m] || pads[i].classList.contains("out")) continue;
    seen[m] = true;
    pads[i].classList.add("nx");
    outlined.push(pads[i]);
    if (wrap12(Number(m)) === wrap12(d.item.rootPc) && (!root || Number(m) < Number(root.dataset.midi))) root = pads[i];
  }
  if (root) root.classList.add("nx-root");
  var chip = state.style === "kids" ? document.querySelector("#suggest .ss-kid") : magicTarget(d.item);
  if (chip) chip.classList.add("nx");
  nextHintArrow(outlined);
}
function nextHintArrow(els) {
  var a = document.getElementById("nxArrow");
  if (!a) return;
  var vw = window.innerWidth, vh = window.innerHeight, wrap = padsEl.getBoundingClientRect();
  var L = Math.max(0, wrap.left), R = Math.min(vw, wrap.right), T = Math.max(0, wrap.top), B = Math.min(vh, wrap.bottom);
  var dir = null, at = 0;
  els.forEach(function (e) {
    if (dir) return;
    var r = e.getBoundingClientRect();
    if (r.right <= L + 4) { dir = "left"; at = (Math.max(T, r.top) + Math.min(B, r.bottom)) / 2; }
    else if (r.left >= R - 4) { dir = "right"; at = (Math.max(T, r.top) + Math.min(B, r.bottom)) / 2; }
    else if (r.bottom <= T + 4) { dir = "up"; at = (Math.max(L, r.left) + Math.min(R, r.right)) / 2; }
    else if (r.top >= B - 4) { dir = "down"; at = (Math.max(L, r.left) + Math.min(R, r.right)) / 2; }
  });
  if (!dir) { a.hidden = true; return; }
  a.className = "nx-arrow " + dir;
  a.textContent = { left: "\u25C0", right: "\u25B6", up: "\u25B2", down: "\u25BC" }[dir];
  a.style.left = a.style.top = "";
  if (dir === "left") { a.style.left = (L + 2) + "px"; a.style.top = (at - 11) + "px"; }
  else if (dir === "right") { a.style.left = (R - 24) + "px"; a.style.top = (at - 11) + "px"; }
  else if (dir === "up") { a.style.top = (T + 2) + "px"; a.style.left = (at - 11) + "px"; }
  else { a.style.top = (B - 24) + "px"; a.style.left = (at - 11) + "px"; }
  a.hidden = false;
}
// v95: full-mode two-row lyrics. Lines in play order from the song's chord / section / lyric-line map (no
// word timing): event i is on the line the one-line bar would show for it (first line with a marker on
// that chord, else the last line with a marker before it; -1 = the section's chords). A new entry starts
// whenever (section, repeat, line) changes, so the bar moves on once playback passes the line's last chord.
function upLineOf(sec, ci) {
  var L = sec.lyrics || [], r = -1, i;
  for (i = 0; i < L.length; i++) if (L[i].markers.some(function (m) { return m.chordIndex === ci; })) return i;
  for (i = 0; i < L.length; i++) if (L[i].markers.some(function (m) { return m.chordIndex <= ci; })) r = i;
  return r;
}
export function upLyrMap() {
  if (shared.U._lyr && shared.U._lyr.secs === shared.U.secs) return shared.U._lyr;
  var seq = [], at = [], last = null;
  var any = shared.U.secs.some(function (sec) { return (sec.lyrics || []).some(function (ln) { return ln.markers && ln.markers.length && ln.text; }); });
  shared.U.events.forEach(function (e, i) {
    var li = upLineOf(shared.U.secs[e.si], e.ci), k = e.si + ":" + e.rep + ":" + li;
    if (!last || last.k !== k) { last = { k: k, si: e.si, li: li, start: i }; seq.push(last); }
    at.push(seq.length - 1);
  });
  shared.U._lyr = { secs: shared.U.secs, seq: seq, at: at, any: any };
  return shared.U._lyr;
}
function upLyrRow(ent, curCi, cls, sec2) {
  if (!ent) return "<span class=\"sb-row " + cls + "\"></span>";
  var si = ent.si, sec = shared.U.secs[si], html = sec2 ? "<span class=\"sb-sec2\">" + upEsc(upSecName(si)) + "</span>" : "";
  function tag(ci) {   // row 2: no data-c, so the next-chord outline stays on row 1
    return "<span" + (cls === "r1" ? " data-c=\"" + ci + "\"" : "") + " class=\"sb-ch" + (ci === curCi ? " on" : "") + (upFlagged(si, ci) ? " flag" : "") + "\">" + upEsc(upA(upSym(si, ci))) + "</span>";
  }
  var line = ent.li >= 0 ? sec.lyrics[ent.li] : null;
  if (line) {
    var mk = line.markers.slice().sort(function (a, b) { return a.charIndex - b.charIndex; }), q = 0;
    mk.forEach(function (m) { html += upEsc(line.text.slice(q, m.charIndex)) + tag(m.chordIndex); q = Math.max(q, m.charIndex); });
    html += upEsc(line.text.slice(q));
  } else sec.chords.forEach(function (c, ci) { html += tag(ci); });
  return "<span class=\"sb-row " + cls + "\">" + html + "</span>";
}
export const lyrState = { k: -1, anim: 0, log: [] };
function paintLyr2(bar, cur) {
  var M = upLyrMap(), idx = M.at[cur >= 0 ? cur : 0], ent = M.seq[idx], nxt = M.seq[idx + 1] || null;
  var e0 = shared.U.events[cur >= 0 ? cur : 0], curCi = cur >= 0 ? e0.ci : -1;
  var alts = curCi >= 0 && !shared.U.locked && (upEv(e0.si, curCi).alternates || []).length;
  var r1 = upLyrRow(ent, curCi, "r1", false), r2 = upLyrRow(nxt, -1, "r2", !!nxt && nxt.si !== ent.si);
  var head = "<span class=\"sb-sec\">" + upEsc(upSecName(ent.si)) + "</span>", tail = alts ? "<span class=\"sb-alt\">alt \u25be</span>" : "";
  var key = head + "<span class=\"sb-lyr\"><span class=\"sb-roll\">" + r1 + r2 + "</span></span>" + tail;
  var step = idx === lyrState.k + 1 && lyrState.k >= 0 && bar._html && bar._html.indexOf("sb-lyr") >= 0;
  var calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (lyrState.anim) { lyrState.pend = true; bar.dataset.si = ent.si; return; }   // finish the scroll first
  if (step && !calm) {
    // old row 1 on top, then the new rows; scroll up one row, then settle on the plain two rows
    var old = bar.querySelector(".sb-row.r1"), oldHtml = old ? old.outerHTML.replace(/ data-c="\d+"/g, "").replace(" on\"", "\"") : "";
    bar.innerHTML = head + "<span class=\"sb-lyr\"><span class=\"sb-roll\">" + oldHtml + r1 + r2 + "</span></span>" + tail;
    bar._html = null;
    var roll = bar.querySelector(".sb-roll");
    void roll.offsetWidth;
    roll.classList.add("go");
    lyrState.anim = setTimeout(function () { lyrState.anim = 0; lyrState.pend = false; bar._html = null; paintSongBar(); }, 300);
    if (PROG_TEST) lyrState.log.push({ idx: idx, anim: true });
  } else {
    if (bar._html !== key) { bar.innerHTML = key; bar._html = key; }
    if (PROG_TEST && idx !== lyrState.k) lyrState.log.push({ idx: idx, anim: false });
  }
  lyrState.k = idx;
  bar.dataset.si = ent.si;
}
// v97: Kids lyrics in two rows. Row 1 = the line holding the current step (its sung word lit), row 2 = the
// next line (muted, empty after the last). Moving on to the next line scrolls the rows up (as v95).
export const klState = { name: null, k: -1, anim: 0, log: [] };
function kidsLyrLines() {
  var it = state.style === "kids" && prog.list[prog.idx], L = it && KIDS_LYRICS[it.name];
  return L && L.length ? L : null;
}
function kidsLyrRow(ln, step, cls) {
  if (!ln) return "<span class=\"sb-row " + cls + "\"></span>";
  var mk = ln.markers, h = upEsc(ln.text.slice(0, mk[0].charIndex));
  mk.forEach(function (m, j) {
    var seg = ln.text.slice(m.charIndex, j + 1 < mk.length ? mk[j + 1].charIndex : ln.text.length);
    if (m.chordIndex === step) { var w = seg.match(/^([^\s,.!?;:]*)([\s\S]*)$/); h += "<span class=\"kl-on\">" + upEsc(w[1]) + "</span>" + upEsc(w[2]); }
    else h += upEsc(seg);
  });
  return "<span class=\"sb-row " + cls + "\">" + h + "</span>";
}
function paintKidsLyr() {
  var box = document.getElementById("kidsLyr");
  if (!box) return;
  var L = kidsLyrLines(), on = !!L;
  if (box.hidden === on) {
    box.hidden = !on;
    document.documentElement.classList.toggle("kly-on", on);
    setTimeout(function () { fitStrip(); placeBadges(); }, 0);
  }
  if (!on) { klState.name = null; klState.k = -1; box._html = null; return; }
  var name = prog.list[prog.idx].name, step = prog.cur, li = 0;
  if (name !== klState.name) { klState.name = name; klState.k = -1; box._html = null; }
  if (step >= 0) L.forEach(function (ln, i) { if (ln.markers.some(function (m) { return m.chordIndex <= step; })) li = i; });
  var r1 = kidsLyrRow(L[li], step, "r1"), r2 = kidsLyrRow(L[li + 1] || null, -1, "r2");
  var key = "<span class=\"sb-roll\">" + r1 + r2 + "</span>";
  box.setAttribute("aria-label", "Lyrics: " + L[li].text);
  if (klState.anim) { clearTimeout(klState.anim); klState.anim = 0; box._html = null; }
  var calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (li === klState.k + 1 && klState.k >= 0 && !calm) {
    var old = box.querySelector(".sb-row.r1"), oldHtml = old ? old.outerHTML.replace(/<span class="kl-on">([^<]*)<\/span>/g, "$1") : "";
    box.innerHTML = "<span class=\"sb-roll\">" + oldHtml + r1 + r2 + "</span>";
    box._html = null;
    var roll = box.firstChild;
    void roll.offsetWidth;
    roll.classList.add("go");
    klState.anim = setTimeout(function () { klState.anim = 0; box.innerHTML = key; box._html = key; }, 300);
    if (PROG_TEST) klState.log.push({ li: li, anim: true });
  } else {
    if (box._html !== key) { box.innerHTML = key; box._html = key; }
    if (PROG_TEST && li !== klState.k) klState.log.push({ li: li, anim: false });
  }
  klState.k = li;
}
export function paintSongBar() {
  document.documentElement.classList.toggle("up-nonum", upSelected());   // v73: no sequence numbers on an uploaded song's grid
  var bar = document.getElementById("songBar");
  if (!bar) return;
  var el = document.getElementById("suggest");
  if (el) Array.prototype.forEach.call(el.querySelectorAll(".up-flag"), function (n) { n.classList.remove("up-flag"); });
  var on = upSelected();   // v73: Simple shows the song bar too (lyrics + chords); the Upload panel stays full-mode only
  ChordAudio.grooveBpm = upSelected() ? shared.U.bpm : null;   // v73: style grooves follow the song tempo
  if (bar.hidden === on) {
    bar.hidden = !on;
    document.documentElement.classList.toggle("up-on", on);   // CSS: the strip rows give the bar its room
    setTimeout(function () { fitStrip(); placeBadges(); }, 0);
  }
  var two = on && !state.simple && upLyrMap().any;   // v95
  if (document.documentElement.classList.contains("up-lyr2") !== two) {
    document.documentElement.classList.toggle("up-lyr2", two);
    bar._html = null; lyrState.k = -1;
    setTimeout(function () { fitStrip(); placeBadges(); upPlaceLock(); }, 0);
  }
  if (!on) { paintUploadActive(-1); upPlaceLock(); paintUpNext(); return; }
  prog.steps.forEach(function (s, i) {
    var e = shared.U.events[i];
    if (e && upFlagged(e.si, e.ci) && prog.targets[i]) prog.targets[i].classList.add("up-flag");
  });
  var cur = upCurStep(), e0 = shared.U.events[cur >= 0 ? cur : 0], si = e0.si, sec = shared.U.secs[si];
  var curCi = cur >= 0 ? e0.ci : -1;
  if (two) {
    paintLyr2(bar, cur);
    upPlaceLock();
    paintUpNext();
    bar.setAttribute("aria-label", "Song " + upProgObj.name + ", " + upSecName(si) + (curCi >= 0 ? ", now " + upT(upSym(si, curCi)) : "") + ". Open the song");
    paintUploadActive(cur >= 0 ? cur : -1);
    return;
  }
  function chTag(ci) { return "<span data-c=\"" + ci + "\" class=\"sb-ch" + (ci === curCi ? " on" : "") + (upFlagged(si, ci) ? " flag" : "") + "\">" + upEsc(upA(upSym(si, ci))) + "</span>"; }
  var html = "", line = null;
  (sec.lyrics || []).forEach(function (ln) {
    var has = ln.markers.some(function (m) { return m.chordIndex === Math.max(0, curCi); });
    if (has && !line) line = ln;
  });
  if (!line && sec.lyrics && sec.lyrics.length && curCi >= 0) {
    sec.lyrics.forEach(function (ln) { if (ln.markers.some(function (m) { return m.chordIndex <= curCi; })) line = ln; });
  }
  if (line) {
    var mk = line.markers.slice().sort(function (a, b) { return a.charIndex - b.charIndex; }), p = 0;
    mk.forEach(function (m) { html += upEsc(line.text.slice(p, m.charIndex)) + chTag(m.chordIndex); p = Math.max(p, m.charIndex); });
    html += upEsc(line.text.slice(p));
  } else {
    sec.chords.forEach(function (c, ci) { html += chTag(ci); });
  }
  var alts = curCi >= 0 && !shared.U.locked && (upEv(si, curCi).alternates || []).length;
  var key = "<span class=\"sb-sec\">" + upEsc(upSecName(si)) + "</span><span class=\"sb-line\">" + html + "</span>" + (alts ? "<span class=\"sb-alt\">alt \u25be</span>" : "");
  if (bar._html !== key) { bar.innerHTML = key; bar._html = key; }
  bar.dataset.si = si;
  upPlaceLock();
  paintUpNext();
  bar.setAttribute("aria-label", "Song " + upProgObj.name + ", " + upSecName(si) + (curCi >= 0 ? ", now " + upT(upSym(si, curCi)) : "") + ". Open the song");
  paintUploadActive(cur >= 0 ? cur : -1);
}

// --- the Upload panel ---
var upOpenAlt;
function paintUploadActive(step) {
  var box = document.getElementById("upSecs");
  if (!box) return;
  var e = step >= 0 && shared.U ? shared.U.events[step] : null;
  Array.prototype.forEach.call(box.querySelectorAll(".up-ch"), function (b) {
    b.classList.toggle("on", !!e && +b.dataset.s === e.si && +b.dataset.c === e.ci);
  });
}
function upLyricHtml(sec, ln) {
  var mk = ln.markers.slice().sort(function (a, b) { return a.charIndex - b.charIndex; });
  var top = "", col = 0, marks = {};
  mk.forEach(function (m, k) {
    var nm = upA(upSym(shared.U.secs.indexOf(sec), m.chordIndex));
    var at = Math.max(m.charIndex, col);
    while (top.length < at) top += " ";
    top += nm + " ";
    col = top.length;
    marks[m.charIndex] = true;
  });
  var t = "";
  for (var i = 0; i < ln.text.length; i++) t += marks[i] ? "<span class=\"mk\">" + upEsc(ln.text.charAt(i)) + "</span>" : upEsc(ln.text.charAt(i));
  return "<div class=\"up-ly\"><div class=\"ly-c\">" + upEsc(top.replace(/\s+$/, "")) + "</div><div class=\"ly-t\">" + t + "</div></div>";
}
// v88: the empty-state hint shortens once both title and artist are filled in (live on input)
// v89: "ready" = the Artist box is filled (an empty title asks for songs by the artist)
const UP_EMPTY_FULL = "No song yet. Fill in the artist, and a song title if you like. Tap Copy for AI, paste it into any AI, then paste its answer and tap Load.";
const UP_EMPTY_READY = "Tap Copy for AI. Paste it into any AI, then paste its answer and tap Load.";
function upEmptyText() {
  var ti = document.getElementById("upTitle"), ar = document.getElementById("upArtist");
  return (ar && ar.value.trim()) ? UP_EMPTY_READY : UP_EMPTY_FULL;
}
function upEmptyRefresh() {
  var e = document.querySelector("#upSecs .up-empty");
  if (!shared.U && e) { var t = upEmptyText(); if (e.textContent !== t) e.textContent = t; }
  upAskRefresh();
}
// v89: the mode comes from the two fields (artist required; empty title = artist mode)
// v110: song or artist only (no album mode)
export function upMode(text, artist) {
  var a = String(artist || "").trim(), x = String(text || "").trim();
  if (!a) return { mode: "none", x: x, artist: "" };
  return x ? { mode: "song", x: x, artist: a } : { mode: "artist", x: "", artist: a };
}
function upModeNow() { return upMode(document.getElementById("upTitle").value, document.getElementById("upArtist").value); }
function upAskRefresh() {
  var el = document.getElementById("upAsk");
  if (!el) return;
  var md = upModeNow(), t = md.mode === "song" ? "Asks for: this song" : md.mode === "artist" ? "Asks for: up to " + UP_ARTIST_MAX + " songs by " + md.artist : "";
  if (el.textContent !== t) el.textContent = t;
  el.title = t;
  el.hidden = !t;
}
function upAskLine(md) {
  function q(v) { return "\"" + v + "\""; }
  if (md.mode === "song") return "What I want: " + q(md.x) + " by " + md.artist + ". Return just that one song.";
  return "What I want: up to " + UP_ARTIST_MAX + " of the best-known songs by " + md.artist + ", the ones whose chords you know best.";
}
function upSkipLine(md, have) {
  if (md.mode !== "artist") return "";
  var k = function (v) { return String(v || "").trim().toLowerCase(); };
  var t = have.filter(function (e) { return k(e.artist) === k(md.artist); }).map(function (e) { return e.title; }).slice(0, UP_SKIP_MAX);
  return t.length ? " Leave out these songs, I already have them: " + t.join("; ") + "." : "";
}
export function upPromptFor(md, ver, have) {
  return UP_HEAD + " " + (ver === "full" ? UP_PASTE_LINE_2 : UP_PASTE_LINE) + " " + UP_TAIL + " " + upAskLine(md) + upSkipLine(md, have || []);
}
function upViewSong() {
  if (!shared.upEdit) return null;
  if (shared.U && shared.U.id === shared.upEdit) return shared.U;
  var e = libGet(shared.upEdit), v = null;
  if (e) { try { v = libEntryToU(e); } catch (err) { v = null; } }
  return v;
}
export function paintUpload() {
  var pick = document.getElementById("uploadPick");
  if (!pick) return;
  paintLib();
  var V = upViewSong(), ro = !!V && V !== shared.U, U0 = shared.U, det = document.getElementById("upDetail");
  det.classList.toggle("ro", ro);
  var hd = document.getElementById("upDHead");
  hd.hidden = !V;   // v107: any song in the details (was: two-version songs only, and a CSS rule beat [hidden])
  if (V) {
    var one = !V.two, cur = one ? "simple" : V.ver;   // v107: always repainted, so no stale pick from another row
    Array.prototype.forEach.call(hd.querySelectorAll("[data-ver]"), function (b) {
      var off = one && b.dataset.ver === "full";
      b.setAttribute("aria-checked", b.dataset.ver === cur ? "true" : "false");
      b.disabled = off;
      if (off) { b.setAttribute("aria-disabled", "true"); b.title = "Only Simple chords. Load this song again to get Full."; } else { b.removeAttribute("aria-disabled"); b.removeAttribute("title"); }
    });
    document.getElementById("upDNote").hidden = !one;
  }
  shared.U = V;
  try { upPaintDetail(ro); } finally { shared.U = U0; }
  document.documentElement.classList.toggle("up-locked", !!(shared.U && shared.U.locked));
  if (!ro) { paintUploadActive(upSelected() ? upCurStep() : -1); paintUpNext(); }
}
function upPaintDetail(ro) {
  var keyEl = document.getElementById("upKey"), tEl = document.getElementById("upTempo"), secs = document.getElementById("upSecs");
  var rev = document.getElementById("upReview");
  var lrow = document.getElementById("upLockRow");
  lrow.hidden = !shared.U || ro;   // v105: a saved (not playing) song's details are read-only
  if (shared.U) {
    document.getElementById("upLock").setAttribute("aria-pressed", shared.U.locked ? "true" : "false");
    document.getElementById("upLockHint").textContent = shared.U.locked ? "Chords locked: styles change the sound only, a key change moves every chord. Unlock to review or change chords." : "Unlocked: you can review and change chords.";
  }
  if (!shared.U) {
    keyEl.textContent = "\u2014";
    tEl.textContent = "No song loaded";
    secs.innerHTML = "<div class=\"up-empty\">" + upEmptyText() + "</div>";
    rev.hidden = true;
    return;
  }
  var k = { pc: namePc(shared.U.key.tonic), mode: shared.U.key.mode === "minor" ? "minor" : "major" };
  keyEl.textContent = accSym(keyRootName(k)) + " " + k.mode;
  var lko = upLiveKeyObj();
  if (lko && upTr(lko)) keyEl.innerHTML = upEsc(accSym(keyRootName(lko)) + " " + lko.mode) + " <small style=\"font-size:.4em\">song: " + upEsc(accSym(keyRootName(k)) + " " + k.mode) + "</small>";
  tEl.innerHTML = upEsc(shared.U.title) + " \u2014 " + upEsc(shared.U.artist) + "<br>" + shared.U.bpm + " BPM \u00b7 " + upEsc(shared.U.ts);
  var fl = upFlagList();
  if (fl.length && !shared.U.locked && !ro) {
    var h = "<b>" + fl.length + " chord" + (fl.length > 1 ? "s" : "") + " need" + (fl.length > 1 ? "" : "s") + " review</b> (the AI was not sure). Keep it or pick another:";
    fl.forEach(function (f) {
      var c = upEv(f.si, f.ci);
      h += "<div class=\"ur-row\"><span>" + upEsc(upSecName(f.si)) + " #" + (f.ci + 1) + ": <b>" + upEsc(upA(c.chord)) + "</b> (" + Math.round(c.confidence * 100) + "%)</span>" +
        "<button type=\"button\" data-act=\"accept\" data-s=\"" + f.si + "\" data-c=\"" + f.ci + "\">Keep " + upEsc(upA(c.chord)) + "</button>";
      (c.alternates || []).forEach(function (a) { h += "<button type=\"button\" data-act=\"alt\" data-s=\"" + f.si + "\" data-c=\"" + f.ci + "\" data-sym=\"" + upEsc(a.chord) + "\">" + upEsc(upA(a.chord)) + "</button>"; });
      h += "</div>";
    });
    rev.innerHTML = h;
    rev.hidden = false;
  } else { rev.hidden = true; rev.innerHTML = ""; }
  var html = "";
  shared.U.secs.forEach(function (sec, si) {
    html += "<div class=\"up-sec\" data-s=\"" + si + "\"><div class=\"us-h\"><span>" + upEsc(upSecName(si)) + "</span>" + (sec.repeat > 1 ? "<small>\u00d7" + sec.repeat + "</small>" : "") +
      "<small>" + sec.chords.length + " chord" + (sec.chords.length > 1 ? "s" : "") + "</small></div><div class=\"up-chs\">";
    sec.chords.forEach(function (c, ci) {
      var alts = (c.alternates || []).length;
      html += "<button type=\"button\" class=\"up-ch" + (upFlagged(si, ci) ? " flag" : "") + "\" data-act=\"play\" data-s=\"" + si + "\" data-c=\"" + ci + "\" aria-label=\"" +
        upEsc(upT(upSym(si, ci)) + (upFlagged(si, ci) ? ", needs review" : "") + (alts ? ", has alternates" : "")) + "\">" + upEsc(upA(upSym(si, ci))) +
        (alts ? "<span class=\"alt\" data-act=\"alts\">alt\u25be</span>" : "") + "</button>";
    });
    html += "</div>";
    if (upOpenAlt && +upOpenAlt.split(":")[0] === si) {
      var ci0 = +upOpenAlt.split(":")[1], c0 = sec.chords[ci0], cur = upSym(si, ci0);
      html += "<div class=\"up-alts\"><span>#" + (ci0 + 1) + ":</span><button type=\"button\" data-act=\"alt\" data-s=\"" + si + "\" data-c=\"" + ci0 + "\" data-sym=\"" + upEsc(c0.chord) + "\"" + (cur === c0.chord ? " class=\"on\"" : "") + ">" + upEsc(upA(c0.chord)) + " (original)</button>";
      (c0.alternates || []).forEach(function (a) {
        html += "<button type=\"button\" data-act=\"alt\" data-s=\"" + si + "\" data-c=\"" + ci0 + "\" data-sym=\"" + upEsc(a.chord) + "\"" + (cur === a.chord ? " class=\"on\"" : "") + ">" + upEsc(upA(a.chord)) + (a.reason ? " \u00b7 " + upEsc(a.reason) : "") + "</button>";
      });
      html += "</div>";
    }
    (sec.lyrics || []).forEach(function (ln) { html += upLyricHtml(sec, ln); });
    html += "</div>";
  });
  secs.innerHTML = html;
}
// v89: the multi-song summary in #upMsg (no key anywhere, per v87)
function upSummaryHtml(r) {
  var L = ["Loaded " + r.loaded + ", updated " + r.updated + ", skipped " + r.skipped + "."];
  if (r.active) L.push("Now playing: " + r.active + ".");
  if (r.truncated) { L.push("The answer was cut off: " + r.rows.length + " song" + (r.rows.length > 1 ? "s" : "") + " arrived complete."); }
  if (r.capSkipped) L.push("My songs is full: " + r.capSkipped + " song" + (r.capSkipped > 1 ? "s" : "") + " not saved. Remove some with the trash can and tap Load again.");
  var nf = r.rows.filter(function (x) { return x.status !== "skipped" && x.flags; }).length;
  if (nf) L.push(nf + " song" + (nf > 1 ? "s have" : " has") + " chords to review: play a song, then tap its pencil.");
  if (r.notes) L.push(r.notes.length > 140 ? r.notes.slice(0, 139) + "\u2026" : r.notes);
  var h = L.map(function (t) { return "<span class=\"us-l\">" + upEsc(t) + "</span>"; }).join("");
  h += "<details" + (r.skipped ? " open" : "") + "><summary>Show songs (" + r.rows.length + ")</summary><ul class=\"us-list\">";
  r.rows.forEach(function (x) {
    var nm = upEsc(x.title || "Song " + (x.i + 1));
    if (x.status === "skipped") {
      h += "<li class=\"sk\">\u2717 " + nm + " \u00b7 skipped: " + upEsc(x.reason) + ((x.errors || []).slice(0, 3).map(function (e) { return "<br><code>songs[" + x.i + "]" + (e.path.charAt(0) === "(" ? " " : ".") + upEsc(e.path) + "</code>: " + upEsc(e.msg); }).join("")) + "</li>";
    } else if (x.flags) {
      h += "<li class=\"fl\">\u26a0 " + nm + " \u00b7 " + x.status + " \u00b7 " + x.flags + " chord" + (x.flags > 1 ? "s" : "") + " to review</li>";
    } else {
      h += "<li>\u2713 " + nm + " \u00b7 " + x.status + "</li>";
    }
  });
  return h + "</ul></details>";
}
export function upShowErrors(r) {
  var box = document.getElementById("upErr"), msg = document.getElementById("upMsg");
  msg.hidden = true;
  if (r.ok) { box.hidden = true; box.innerHTML = ""; return; }
  var h = "<b>Could not load " + (r.list ? "any songs" : "the song") + ": " + r.errors.length + " problem" + (r.errors.length > 1 ? "s" : "") + "</b><ul>";
  r.errors.slice(0, 5).forEach(function (e) { h += "<li><code>" + upEsc(e.path) + "</code>: " + upEsc(e.msg) + "</li>"; });
  if (r.errors.length > 5) h += "<li>and " + (r.errors.length - 5) + " more</li>";
  box.innerHTML = h + "</ul>Ask the AI to fix these and paste its new answer.";
  box.hidden = false;
}
export function upCopyText() {
  var md = upModeNow(), have = shared.LIB.songs.map(function (e) { return { title: e.title, artist: e.artist }; });
  if (md.mode === "none") md = { mode: "artist", x: "", artist: "ARTIST" };
  return upPromptFor(md, "full", have) + "\n\n" + upListSchemaText;   // v107: always ask for Simple and Full
}
export function upSetPrompt(v) {
  shared.upPromptVer = "full";   // v107: hardcoded, the request is always Simple and Full
}
function upCopy() {
  var txt = upCopyText(), ok = document.getElementById("upCopied"), fb = document.getElementById("upFallback"), fbt = document.getElementById("upFallbackTxt");
  var t = (document.getElementById("upTitle").value || "").trim(), a = (document.getElementById("upArtist").value || "").trim();
  var err = document.getElementById("upErr");
  if (!a) {   // v89: the title is optional (empty = songs by the artist)
    upShowErrors({ ok: false, errors: [{ path: "Artist", msg: "is empty: type it so the AI knows whose songs to look up" }] });
    document.getElementById("upArtist").focus();
    var eb = document.getElementById("upErr"); if (eb.scrollIntoView) eb.scrollIntoView({ block: "nearest" });   // v91: the error is near the top
    return;
  }
  err.hidden = true;
  function done() { ok.hidden = false; ok.textContent = "Copied"; fb.hidden = true; clearTimeout(upCopy.t); upCopy.t = setTimeout(function () { ok.hidden = true; }, 2500); }
  function legacy() {
    var ta = document.createElement("textarea");
    ta.value = txt; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
    document.body.appendChild(ta); ta.select();
    var good = false;
    try { good = document.execCommand("copy"); } catch (e2) { good = false; }
    document.body.removeChild(ta);
    if (good) done();
    else { fbt.value = txt; fb.hidden = false; ok.hidden = true; fbt.focus(); fbt.select(); }
  }
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, legacy);
  else legacy();
}
function openUpload() {
  var pick = document.getElementById("uploadPick");
  // v105: opens as a clean list: the form is cleared, no details open, no status; playback is untouched
  ["upTitle", "upArtist", "upPaste", "upFallbackTxt"].forEach(function (id) { document.getElementById(id).value = ""; });
  ["upMsg", "upErr", "upFallback", "upCopied"].forEach(function (id) { document.getElementById(id).hidden = true; });
  shared.upEdit = null; upOpenAlt = null;
  paintUpload();
  upAskRefresh();
  upEmptyRefresh();
  pick.hidden = false;
  pick.querySelector(".kp-box").scrollTop = 0;
  var ul = document.getElementById("upLibList"), on = ul && ul.querySelector(".ul-row.on");   // v77: the active song in view
  if (on) ul.scrollTop = Math.max(0, on.offsetTop - ul.offsetTop - 4);
}
function wireUpload() {
  var pick = document.getElementById("uploadPick"), btn = document.getElementById("uploadBtn");
  ["upTitle", "upArtist"].forEach(function (id) { var el = document.getElementById(id); if (el) el.addEventListener("input", upEmptyRefresh); });
  if (!pick || !btn) return;
  btn.addEventListener("click", function () { openUpload(); });
  document.getElementById("songBar").addEventListener("click", function () { if (!state.simple) openUpload(); });
  function close() { pick.hidden = true; }
  pick.querySelector(".up-x").addEventListener("click", close);
  pick.addEventListener("click", function (e) { if (e.target === pick) close(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !pick.hidden) close(); });
  document.getElementById("upCopy").addEventListener("click", upCopy);
  var upLoading = false;
  // v105: the summary / errors sit right under Load; bring them into view
  function upStatusIntoView() {
    var st = document.getElementById("upStatus"), lb = document.getElementById("upLoad");
    try { (st.offsetHeight ? st : lb).scrollIntoView({ block: "nearest" }); } catch (e) {}
  }
  function loadDone(r) {
    upLoading = false;
    var msg = document.getElementById("upMsg");
    upShowErrors(r);
    if (r.full) { var fe = document.getElementById("upErr"); fe.textContent = "My songs is full, remove one first"; fe.hidden = false; }
    if (r.saveFail) { var se = document.getElementById("upErr"); se.textContent = "Couldn't save, storage is full"; se.hidden = false; }
    if (!r.ok) { upStatusIntoView(); return; }
    if (!r.list) {
      var n = shared.U.events.length, fl = upFlagList().length;
      msg.textContent = "Loaded " + shared.U.title + ": " + shared.U.secs.length + " sections, " + n + " chords, " + shared.U.bpm + " BPM." +   // v87: no key on the Upload form
        (fl ? " " + fl + " need review: tap the pencil on its row." : "") + (shared.U.two ? " Simple and Full versions: switch with the pencil on the song in My songs." : "") + (r.warnings.length ? " Note: " + r.warnings.slice(0, 3).join("; ") + (r.warnings.length > 3 ? "\u2026" : "") : "") + " Close this and tap Next or Play.";
      msg.hidden = false;
      document.getElementById("upPaste").value = "";
    } else {
      msg.innerHTML = upSummaryHtml(r);
      msg.hidden = false;
      if (!r.skipped) document.getElementById("upPaste").value = "";   // kept so Load can run again after making room
    }
    ["upTitle", "upArtist"].forEach(function (id) { document.getElementById(id).value = ""; });   // v105: the form clears after Load
    upOpenAlt = null; shared.upEdit = null;
    paintUpload();
    upAskRefresh();
    upEmptyRefresh();
    upStatusIntoView();
  }
  document.getElementById("upLoad").addEventListener("click", function () {
    if (upLoading) return;   // v89: a Load tap during a run is ignored (Load itself stays tappable)
    unlock();
    var b = upLoadBegin(document.getElementById("upPaste").value);
    if (b.done) { loadDone(b.done); return; }
    var L = b.list, N = L.items.length, msg = document.getElementById("upMsg");
    if (N <= 3) { for (var i = 0; i < N; i++) upLoadCheck(L, i); loadDone(upLoadCommit(L)); return; }
    upLoading = true;
    document.getElementById("upErr").hidden = true;
    var k = 0;
    (function step() {
      if (k >= N) { loadDone(upLoadCommit(L)); return; }
      msg.textContent = "Checking song " + (k + 1) + " of " + N + "\u2026"; msg.hidden = false;
      if (k === 0) upStatusIntoView();
      upLoadCheck(L, k++);
      setTimeout(step, 0);
    })();
  });
  // v105: no New song button: the form clears when the panel opens and after Load.
  // v92: no Remove song button; the trash icon on each My songs row removes a song (with a confirm)
  function act(e) {
    var t = e.target.closest ? e.target.closest("[data-act]") : null;
    if (!t || !shared.U) return;
    if (shared.upEdit && shared.U.id !== shared.upEdit) return;   // v105: read-only details of a saved song
    var a = t.dataset.act, b = t.closest("[data-s]"), si = +(t.dataset.s != null ? t.dataset.s : b.dataset.s), ci = +(t.dataset.c != null ? t.dataset.c : (t.closest(".up-ch") || {}).dataset.c);
    if (shared.U.locked && (a === "alts" || a === "alt" || a === "accept")) { e.stopPropagation(); return; }   // v73: Lock = no chord edits
    if (a === "alts") { e.stopPropagation(); upOpenAlt = upOpenAlt === si + ":" + ci ? null : si + ":" + ci; paintUpload(); return; }
    if (a === "play") {
      if (!upSelected()) upSelect();
      var i = upStepOf(si, ci);
      if (i >= 0) { unlock(); progBadge([i]); }
      if (!shared.U.locked && (upEv(si, ci).alternates || []).length) { upOpenAlt = si + ":" + ci; paintUpload(); }
      return;
    }
    if (a === "accept") { shared.U.reviewed[si + ":" + ci] = true; upSave(); if (upSelected()) progRedecorate(); paintUpload(); return; }
    if (a === "alt") { upPickAlt(si, ci, t.dataset.sym); return; }
  }
  document.getElementById("upLibList").addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("[data-lib]") : null, row = b && b.closest("[data-id]");
    if (!b || !row) return;
    var id = row.dataset.id, ent = libGet(id);
    if (!ent) return;
    ["upMsg", "upErr", "upFallback", "upCopied"].forEach(function (x) { document.getElementById(x).hidden = true; });
    upOpenAlt = null;
    if (b.dataset.lib === "edit" || b.dataset.lib === "done") {   // v105: details only via the pencil; playback untouched
      shared.upEdit = b.dataset.lib === "edit" && shared.upEdit !== id ? id : null;
      paintUpload();
      var eb = document.querySelector("#upLibList .ul-row[data-id=\"" + id + "\"] .ul-edit");   // v107: the rebuilt row
      if (shared.upEdit) { var dd = document.getElementById("upDetail"); try { (dd.offsetHeight ? dd : eb).scrollIntoView({ block: "nearest" }); } catch (err) {} }
      if (eb) eb.focus();
      return;
    }
    if (b.dataset.lib === "ver") { unlock(); libSetVer(id, b.dataset.ver); paintUpload(); return; }   // v80
    if (b.dataset.lib === "del") {
      if (!libConfirm(ent)) return;
      if (shared.upEdit === id) shared.upEdit = null;
      libDelete(id);
      document.getElementById("upMsg").textContent = "Song removed.";
      document.getElementById("upMsg").hidden = false;
      paintUpload();
      return;
    }
    unlock();
    if (!libOpen(id)) { var ne = document.getElementById("upErr"); ne.textContent = "This song needs a newer app"; ne.hidden = false; return; }   // v89: kept, never erased
    document.getElementById("upMsg").textContent = shared.U.title + " is ready. Close this and tap Next or Play.";
    document.getElementById("upMsg").hidden = false;
    paintUpload();
  });
  document.getElementById("upSecs").addEventListener("click", act);
  document.getElementById("upReview").addEventListener("click", act);
  // Reload: the saved song comes back selected, in its own key (full-mode key locks are not saved).
  if (upRestoreSel) setTimeout(function () { if (shared.U && upInList()) { upKeyApply(upKeyNow().tonic, upKeyNow().mode); upSelect(); } }, 0);
  document.getElementById("upLock").addEventListener("click", function () { upSetLock(!shared.U || !shared.U.locked); });
  document.getElementById("sbLock").addEventListener("click", function (e) { e.stopPropagation(); upSetLock(!shared.U || !shared.U.locked); });
  window.addEventListener("resize", function () { setTimeout(upPlaceLock, 0); });
}

// The picker: Simple = friendly name in the left column under Major / Minor; full mode =
// the numerals in a cycler by the style row (phone landscape: top of the Now column; other
// layouts: the top bar). Play/Stop sits inside it; full mode adds Next.
function placeProg() {
  var el = document.getElementById("prog");
  if (!el) return;
  var de = document.documentElement;
  var nowCol = document.querySelector(".now-col");
  var where;
  if (state.simple) {
    where = "kid";
    var kid = document.getElementById("kidKey");
    if (el.previousElementSibling !== kid || el.parentNode !== nowCol) nowCol.insertBefore(el, kid.nextSibling);
  } else {
    // v60-v62: every full-mode layout: Now, Key, ‹ name ›, Next, Full Range (CSS order; the key
    // bar's two buttons join the column). v62: iPad and desktop too (no top-bar picker any more).
    where = "now";
    if (el.parentNode !== nowCol || el.previousElementSibling !== nowCol.querySelector(".key-bar")) nowCol.insertBefore(el, nowCol.querySelector(".key-bar").nextSibling);
  }
  el.dataset.at = where;
  de.classList.toggle("prog-top", where === "top");
  fitProgName();
}
export function paintProg() {
  paintLoop();   // v70: the Loop Play button shows Stop while the sequence autoplay runs
  var el = document.getElementById("prog");
  if (!el) return;
  var p = prog.list[prog.idx];
  var txt = el.querySelector(".pg-t");
  var name = p ? p.name : "";
  var num = p ? progNumerals(prog.steps.length ? prog.steps : progSteps(prog.key || { pc: 0, mode: "major" }, p)) : "";
  prog.label = { name: name, feel: progFeel(name), num: num };
  var sel = el.querySelector(".pg-sel");
  sel.setAttribute("aria-valuenow", String(prog.idx));
  sel.setAttribute("aria-valuemax", String(Math.max(0, prog.list.length - 1)));
  sel.setAttribute("aria-valuetext", name + " (" + prog.steps.map(function (s) { return s.roman; }).join(" ") + ")");
  sel.title = name + ": " + prog.steps.map(function (s) { return s.roman; }).join(" ");
  var ps = el.querySelector(".pg-song"), pon = !!prog.playing;   // v74: Play song shows Stop while the pass / random tail runs
  if (ps && PROG_PLAY_SVG && ps._on !== pon) {
    ps._on = pon;
    ps.innerHTML = pon ? PROG_STOP_SVG : PROG_PLAY_SVG;
    ps.classList.toggle("on", pon);
    ps.setAttribute("aria-pressed", pon ? "true" : "false");
    ps.setAttribute("aria-label", pon ? "Stop song" : "Play song");
    ps.title = pon ? "Stop" : "Play song: the whole song / progression, over and over";
  }
  fitProgName();
}
const PROG_PLAY_SVG = "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M7 4.5v15l12.5-7.5z\" fill=\"currentColor\"/></svg>";
const PROG_STOP_SVG = "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect x=\"6\" y=\"6\" width=\"12\" height=\"12\" rx=\"1.5\" fill=\"currentColor\"/></svg>";
// Name fits its box: shrink the font (not below 9 px full / 11 px Simple), up to 2 lines.
// True when a word of the label would have to break (a word wider than the name box).
function splitWord() {
  var el = document.getElementById("prog"), box = el.querySelector(".pg-txt"), t = el.querySelector(".pg-t");
  var probe = document.createElement("span");
  probe.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;font:inherit;letter-spacing:inherit";
  t.appendChild(probe);
  var words = (prog.label && prog.label.feel || "").split(" "), bad = false;
  for (var i = 0; i < words.length && !bad; i++) { probe.textContent = words[i]; if (probe.offsetWidth > box.clientWidth + 0.5) bad = true; }
  t.removeChild(probe);
  return bad;
}
function fitProgName() {
  var el = document.getElementById("prog");
  if (!el || !el.offsetParent) return;
  var box = el.querySelector(".pg-txt"), t = el.querySelector(".pg-t");
  t.style.fontSize = "";
  t.style.letterSpacing = "";
  t.style.whiteSpace = "";
  t.style.lineHeight = "";
  t.style.position = t.style.top = "";
  // v60: a wide name area (iPad, desktop) shows "Jazz Turnaround" with small numerals under it;
  // a narrow one (phones) shows the feel only, on one line when it fits. Width-based, no UA checks.
  var L = prog.label || { name: "", feel: "", num: "" };
  var wide = box.clientWidth >= 150;   // v62: 150 (iPad portrait / 1024 rails are ~151-176; phones <= 144)
  el.classList.toggle("pg-wide", wide);
  if (wide) {
    t.innerHTML = "";
    var a = document.createElement("span"); a.className = "pg-nm"; a.textContent = L.name;
    t.appendChild(a);
    // Simple (for kids): the name only, no numerals.
    if (!state.simple) { var b = document.createElement("span"); b.className = "pg-num"; b.textContent = L.num; t.appendChild(b); }
  } else {
    t.textContent = L.feel;
    t.style.whiteSpace = "nowrap";
    var fs1 = parseFloat(getComputedStyle(t).fontSize) || 14;
    // v62: full mode on phones: the feel label as large as the name box allows, up to 13 px on one
    // line; two-word labels may wrap onto two lines at up to 12 px. Never smaller than before.
    if (!state.simple && fs1 < 13) {
      var base = fs1, bw0 = box.clientWidth + 0.5, bh0 = box.clientHeight + 0.5;
      // Two words: one line down to 11 px, then two lines (larger) before a smaller single line.
      var multi = L.feel.indexOf(" ") >= 0, low = multi ? Math.max(base, 11) - 0.01 : base;
      for (var g = 13; g > low; g -= 0.5) { t.style.fontSize = g + "px"; if (t.scrollWidth <= bw0 && t.offsetHeight <= bh0) return; }
      if (L.feel.indexOf(" ") >= 0) {
        t.style.whiteSpace = "";
        // v63: two lines only with >= 2 px clear of the picker border (glyph bounds, not line boxes);
        // tight line-height where the picker is short (phone landscape).
        var selEl = el.querySelector(".pg-sel"), selR = selEl.getBoundingClientRect(), bT = selEl.clientTop;
        function clear2() {
          var rg = document.createRange(); rg.selectNodeContents(t); var q = rg.getBoundingClientRect();
          return q.top >= selR.top + bT + 2 - 0.01 && q.bottom <= selR.bottom - bT - 2 + 0.01;
        }
        function ok2(g) { return t.scrollWidth <= bw0 && t.offsetHeight <= bh0 && t.offsetHeight <= g * 1.12 * 2 + 1 && !splitWord() && clear2(); }
        // v64: centre the two lines on the picker exactly (the line box lands on whole pixels).
        function centre() {
          t.style.position = t.style.top = "";
          var rg = document.createRange(); rg.selectNodeContents(t); var q = rg.getBoundingClientRect();
          var d = ((selR.bottom - bT - q.bottom) - (q.top - selR.top - bT)) / 2;
          if (Math.abs(d) > 0.05) { t.style.position = "relative"; t.style.top = d.toFixed(2) + "px"; }
        }
        var lhs = ["", "1"];
        for (var lh = 0; lh < 2; lh++) {
          t.style.lineHeight = lhs[lh];
          for (g = 12; g > 10.49; g -= 0.5) { t.style.fontSize = g + "px"; if (ok2(g)) return; }
        }
        // v64: a short picker (phone landscape, 26 px) holds two lines at >= 10.5 px only with a
        // line-height under 1: the glyph boxes overlap, the ink does not.
        var tight = ["0.9", "0.85", "0.8", "0.75"];
        for (g = 12; g > 10.49; g -= 0.5) {
          t.style.fontSize = g + "px";
          for (var ti = 0; ti < tight.length; ti++) { t.style.lineHeight = tight[ti]; centre(); if (ok2(g)) return; }
        }
        t.style.position = t.style.top = "";
        for (lh = 0; lh < 2; lh++) {
          t.style.lineHeight = lhs[lh];
          for (g = 10; g > base - 1.01; g -= 0.5) { t.style.fontSize = g + "px"; if (ok2(g)) return; }
        }
        t.style.lineHeight = "";
        t.style.whiteSpace = "nowrap";
        for (g = Math.max(base, 11) - 0.5; g > base; g -= 0.5) { t.style.fontSize = g + "px"; if (t.scrollWidth <= bw0) return; }
      }
      t.style.fontSize = "";
    }
    while (fs1 > 9 && t.scrollWidth > box.clientWidth + 0.5) { fs1 = Math.max(9, fs1 - 0.5); t.style.fontSize = fs1 + "px"; }
    if (t.scrollWidth <= box.clientWidth + 0.5) return;
    // One word (e.g. "Turnaround") must not break mid-word: tighten, then an 8.5 px floor.
    if (L.feel.indexOf(" ") < 0) {
      var lsx = [-0.02, -0.04, -0.06];
      for (var li = 0; li < lsx.length; li++) { t.style.letterSpacing = lsx[li] + "em"; if (t.scrollWidth <= box.clientWidth + 0.5) return; }
      t.style.fontSize = "8.5px";
      if (t.scrollWidth <= box.clientWidth + 0.5) return;
      t.style.letterSpacing = "";
    }
    t.style.whiteSpace = "";
    t.style.fontSize = "";
  }
  var fs = parseFloat(getComputedStyle(t).fontSize) || 14, floor = state.simple ? 11 : 9;
  function over() { return t.scrollWidth > box.clientWidth + 0.5 || t.offsetHeight > box.clientHeight + 0.5; }
  while (fs > floor && over()) {
    fs = Math.max(floor, fs - 0.5);
    t.style.fontSize = fs + "px";
  }
  // v57: the longest name (Smooth, 5 chords) at the floor: tighten, then 8.5px rather than clip.
  if (over()) t.style.letterSpacing = "-0.03em";
  if (over() && !state.simple) t.style.fontSize = "8.5px";
}
function wireProg() {
  var el = document.getElementById("prog");
  if (!el) return;
  var sel = el.querySelector(".pg-sel"), txt = el.querySelector(".pg-t");
  function step(d) {
    unlock();
    progSet(prog.idx + d);
    txt.classList.remove("nudge-l", "nudge-r");
    void txt.offsetWidth;
    txt.classList.add(d > 0 ? "nudge-r" : "nudge-l");
    setTimeout(function () { txt.classList.remove("nudge-l", "nudge-r"); }, 140);
  }
  el.querySelector(".pg-step").addEventListener("click", function () { unlock(); progNext(); });
  // v74: Play song = the progression / uploaded song once through (song BPM when a song is
  // selected), then the random tail; tap again to stop. The Loop tab's Play stays the phrase loop.
  el.querySelector(".pg-song").addEventListener("click", function () { unlock(); progPlay(); });
  // v56: the whole row swipes, arrows included. A tap on an arrow steps once; a horizontal drag
  // past the threshold steps once (and is not also a tap). One step per gesture.
  var drag = null;
  sel.addEventListener("pointerdown", function (e) {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    // Tap zones: each arrow plus the outer 30% of the row on its side (small arrows, big targets).
    var arrow = e.target.closest ? e.target.closest(".pg-arrow") : null, r = sel.getBoundingClientRect();
    var side = arrow ? (arrow.classList.contains("pg-prev") ? -1 : 1)
      : e.clientX < r.left + r.width * 0.3 ? -1 : e.clientX > r.right - r.width * 0.3 ? 1 : 0;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, done: false,
      arrow: side, unit: Math.max(24, Math.min(40, sel.clientWidth / 6)) };
    try { sel.setPointerCapture(e.pointerId); } catch (err) {}
  });
  sel.addEventListener("pointermove", function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    e.preventDefault();
    var dx = e.clientX - drag.x;
    if (Math.abs(dx) > 8 || Math.abs(e.clientY - drag.y) > 8) drag.moved = true;
    if (!drag.done && Math.abs(dx) >= drag.unit) { drag.done = true; step(dx > 0 ? 1 : -1); }
  });
  function end(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var d = drag;
    drag = null;
    if (e.type === "pointerup" && !d.done && !d.moved && d.arrow) step(d.arrow);
  }
  sel.addEventListener("pointerup", end);
  sel.addEventListener("pointercancel", end);
  sel.addEventListener("touchmove", function (e) { e.preventDefault(); }, { passive: false });
  sel.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); step(1); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); step(-1); }
    else if (e.key === " " || e.key === "Enter") { e.preventDefault(); unlock(); progNext(); }
  });
  window.addEventListener("resize", function () { setTimeout(fitProgName, 80); });
  if (typeof ResizeObserver === "function") new ResizeObserver(function () { fitProgName(); }).observe(el.querySelector(".pg-txt"));
  placeProg();
  paintProg();
}

// Fit chip names to their column: shrink a little first; if a name still
// overflows (narrow phones / portrait), stack root over quality, then shrink.
export function fitStrip() {
  var el = document.getElementById("suggest");
  if (!el || !el.firstChild) return;
  var chips = el.querySelectorAll(".ss-chip");
  function overC(c) { return c.scrollWidth > c.clientWidth + 0.5 || c.scrollHeight > c.clientHeight + 0.5; }
  function nOver() { var n = 0; for (var i = 0; i < chips.length; i++) if (overC(chips[i])) n++; return n; }
  function curK() { return parseFloat(el.style.getPropertyValue("--ss-k")) || 1; }
  // One shared size for all chips, shrunk from 1 toward the floor until nothing overflows.
  function run(floor) {
    var k = 1;
    el.style.setProperty("--ss-k", "1");
    while (k > floor && nOver()) {
      k = Math.max(floor, Math.round((k - 0.05) * 100) / 100);
      el.style.setProperty("--ss-k", String(k));
    }
    return nOver();
  }
  function setMode(m) {
    el.classList.toggle("rn2", m === "rn2");
    el.classList.toggle("stack", m === "stack");
    el.classList.toggle("nonum", m === "stack" || m === "plain");
  }
  el.style.setProperty("--tx", "1");
  el.classList.remove("tight");
  for (var c0 = 0; c0 < chips.length; c0++) chips[c0].classList.remove("sq", "st1", "c2");
  var fs = parseFloat(getComputedStyle(el).getPropertyValue("--ss-fs")) || 16;
  var fl = Math.ceil(11 / fs * 100) / 100;   // chip names never below 11 px
  // v53 Simple: one line only. v55 full mode: the numeral sits beside the name; a chip where
  // it doesn't fit drops its numeral (the note row shows it underneath). Numerals never wrap.
  // Only if names alone still don't fit: no numerals with the root over the quality (.stack).
  var full = !document.documentElement.classList.contains("simple");
  for (var c1 = 0; c1 < chips.length; c1++) chips[c1].classList.remove("norn");
  setMode("inline");
  var rnEl = el.querySelector(".ss-chip .rn");
  var rnOn = full && !!rnEl && getComputedStyle(rnEl).display !== "none";
  var flN = rnOn ? Math.max(fl, 0.88) : fl;
  var n = run(flN);
  while (n && rnOn) {
    var added = 0;
    for (var c2i = 0; c2i < chips.length; c2i++) {
      if (overC(chips[c2i]) && !chips[c2i].classList.contains("norn")) { chips[c2i].classList.add("norn"); added++; }
    }
    if (!added) break;
    n = run(flN);
  }
  if (n) n = run(fl);
  var best = { m: "inline" };
  if (n && full) {
    var kIn = curK();
    setMode("stack");
    var ns = run(fl);
    if (ns < n) best = { m: "stack" };
    else { setMode("inline"); el.style.setProperty("--ss-k", String(kIn)); }
  }
  setMode(best.m);
  if (run(fl)) {
    // Last resort, per chip: tighter letter-spacing, then that one chip's root over its quality.
    el.classList.add("tight");
    for (var ci = 0; ci < chips.length; ci++) {
      var ch = chips[ci];
      if (!overC(ch)) continue;
      ch.classList.add("sq");
      if (overC(ch) && best.m !== "stack") { ch.classList.add("st1"); if (overC(ch)) ch.classList.remove("st1"); }
    }
  }
  // The final size may leave room again: give a numeral back wherever it now fits.
  if (rnOn && best.m === "inline") {
    for (var cr = 0; cr < chips.length; cr++) {
      var chr = chips[cr];
      if (!chr.classList.contains("norn") || chr.classList.contains("sq") || chr.classList.contains("st1")) continue;
      chr.classList.remove("norn");
      if (overC(chr)) chr.classList.add("norn");
    }
  }
  // Simple: note buttons are about chip height, and never wider than their column.
  var gc = String(getComputedStyle(el).gridTemplateColumns).replace(/\[[^\]]*\]/g, " ").trim().split(/\s+/);
  var sadChip = el.querySelector(".ss-chip.r-s") || el.querySelector(".ss-chip");
  var rowH = sadChip ? sadChip.offsetHeight : 0, colW = 2 * (parseFloat(gc[2]) || 0);
  if (rowH && colW) el.style.setProperty("--ss-nb", Math.floor(Math.min(rowH, colW)) + "px");
  if (rowH) el.style.setProperty("--ss-nh", Math.floor(rowH) + "px");
  el.style.removeProperty("--tx");
  placeBadges();
}

// Shrink the Now symbol only when a long name (e.g. F#6sus4(add9)) would
// overflow its card; short ones like Cmaj7 keep the full display size.
function fitNowSymbol() {
  fitKeyRow();
  var sym = document.getElementById("symbol");
  var card = sym && sym.parentNode;
  if (!card) return;
  sym.style.fontSize = "";
  var cs = getComputedStyle(card);
  var avail = card.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  var tones = document.getElementById("tones");
  if (tones) tones.style.fontSize = "";
  var w = sym.getBoundingClientRect().width;
  var base = parseFloat(getComputedStyle(sym).fontSize) || 48;
  if (avail > 0 && w > avail) sym.style.fontSize = Math.max(14, Math.floor(base * (avail / w) * 0.98)) + "px";
  // v64: HEIGHT too, measured on the TEXT (not line boxes): every line in the card (NOW label, name,
  // notes, key row) must sit at least 1.25 px inside the card's border. Start from the full CSS size
  // and shrink only as far as needed; the name never goes below the Simple key note's size unless
  // the note row and the padding have already given way.
  card.style.paddingTop = card.style.paddingBottom = "";
  var cr = card.getBoundingClientRect(), bTop = card.clientTop;
  function gap() {
    var m = 1e9;
    for (var c = 0; c < card.children.length; c++) {
      var ch = card.children[c];
      if (ch.offsetParent === null || getComputedStyle(ch).display === "none") continue;
      var q;
      if (ch.id === "keyRow") { if (!ch.children.length && ch.offsetHeight === 0) continue; q = ch.getBoundingClientRect(); }
      else { var rg = document.createRange(); rg.selectNodeContents(ch); q = rg.getBoundingClientRect(); }
      if (!q.height) continue;
      m = Math.min(m, q.top - (cr.top + bTop), (cr.bottom - bTop) - q.bottom);
    }
    return m;
  }
  var NEED = 1.25;
  if (!(card.clientHeight > 0) || gap() >= NEED) return;
  var kn = document.querySelector(".kk-name");
  var floor = state.simple && kn && kn.offsetParent ? Math.max(14, parseFloat(getComputedStyle(kn).fontSize) || 14) : 14;
  var fsS = parseFloat(getComputedStyle(sym).fontSize);
  // 1) the name, down to the floor
  for (var k = 0; k < 80 && gap() < NEED && fsS > floor; k++) { fsS = Math.max(floor, fsS - 0.5); sym.style.fontSize = fsS + "px"; }
  if (gap() >= NEED) return;
  // 2) the note row, down to 10 px
  var fsT = tones ? parseFloat(getComputedStyle(tones).fontSize) : 0;
  for (k = 0; k < 20 && gap() < NEED && fsT > 10; k++) { fsT -= 0.5; tones.style.fontSize = fsT + "px"; }
  if (gap() >= NEED) return;
  // 3) the padding
  card.style.paddingTop = card.style.paddingBottom = "2px";
  if (gap() >= NEED) return;
  // 4) last resort: the name below the floor
  for (k = 0; k < 80 && gap() < NEED && fsS > 14; k++) { fsS -= 0.5; sym.style.fontSize = fsS + "px"; }
}

function keyLabel(k) {
  return accSym(keyRootName(k)) + (k.mode === "minor" ? " minor" : " major");
}
function paintKeyChip(spec) {
  var chip = document.getElementById("keyChip");
  var row = document.getElementById("keyRow");
  var k = activeKey();
  chip.textContent = k ? "Key: " + keyLabel(k) : "Key: play a chord";
  paintKidKey();
  var inKey = {};
  var spellPc = {};
  if (!k && state.style === "kids") k = kidsKeyNow();   // v111 (K): Kids dims against the song key even before a key is picked
  if (k) keyDegrees(k).forEach(function (d) { inKey[d.pc] = true; spellPc[d.pc] = d.name; });
  Array.prototype.forEach.call(document.querySelectorAll("#pads .pad, .kb .pad"), function (pd) {
    pd.classList.toggle("nokey", !pd.dataset.borrow && !state.allKeys && !!k && !inKey[Number(pd.dataset.pc)]);   // v111 (K): Kids dims out-of-key keys again with Full Range off
    var nmEl = pd.querySelector(".nm");
    if (nmEl) {
      var nmT = accSym(spellPc[Number(pd.dataset.pc)] || Theory.NOTE_NAMES[Number(pd.dataset.pc)]);
      if (nmEl.textContent !== nmT) nmEl.textContent = nmT;
    }
  });
  // v31: chord buttons follow Full Range. A chord "fits" when every note of
  // it (same buildChord spelling as playback) is in the key's scale.
  var gate = false; // v35: chord gating removed; every chord button always plays
  function fits(rootPc, type, ext) {
    try {
      var c = Theory.buildChord({ rootPc: rootPc, type: type, extensions: ext || {} });
      for (var q = 0; q < c.pcs.length; q++) if (!inKey[((c.pcs[q] % 12) + 12) % 12]) return false;
      return true;
    } catch (err) { return true; }
  }
  var anyHeld = false;
  for (var hid in paletteHolds) { anyHeld = true; break; }
  var heldExt = {
    six: !!state.extensions.six, min7: !!state.extensions.min7,
    maj7: !!state.extensions.maj7, nine: !!state.extensions.nine
  };
  Array.prototype.forEach.call(document.querySelectorAll(".kb .pad"), function (pd) {
    var bad = gate && anyHeld && !pd.classList.contains("nokey") && !fits(Number(pd.dataset.pc), state.type, heldExt);
    pd.classList.toggle("nochord", bad);
  });
  var root = spec && !state.forceChord ? state.rootPc : (spec ? spec.rootPc : 0);
  var rootIn = gate && inKey[root];
  var typeIsHeld = false;
  for (var hid2 in paletteHolds) if (paletteHolds[hid2].kind === "type") typeIsHeld = true;
  var baseType = "major";
  if (typeIsHeld) baseType = state.type;
  else if (k) keyDegrees(k).forEach(function (d) { if (d.pc === root) baseType = d.type; });
  Array.prototype.forEach.call(document.querySelectorAll("#palette button[data-type], #palette button[data-ext]"), function (cb) {
    var bad = false;
    if (rootIn) {
      if (cb.dataset.type) {
        bad = !(typeIsHeld && typeHeld(cb.dataset.type)) && !fits(root, cb.dataset.type, heldExt);
      } else {
        var e1 = {}; e1[cb.dataset.ext] = true;
        bad = !extStillHeld(cb.dataset.ext) && !fits(root, baseType, e1);
      }
    }
    cb.classList.toggle("nofit", bad);
    cb.setAttribute("aria-disabled", bad ? "true" : "false");
  });
  var ak = document.getElementById("allKeys");
  ak.classList.toggle("on", !!state.allKeys);
  ak.setAttribute("aria-pressed", state.allKeys ? "true" : "false");
  row.innerHTML = "";
  if (!k) return;
  keyDegrees(k).forEach(function (d) {
    var s = document.createElement("span");
    var b = document.createElement("b");
    b.textContent = d.roman + (d.type === "dim" ? "\u00b0" : "");
    s.appendChild(b);
    var r = document.createElement("i"); r.className = "r";
    var nm = accSym(d.name);
    r.textContent = nm.charAt(0);
    if (nm.length > 1) { var ac = document.createElement("i"); ac.className = "acc"; ac.textContent = nm.slice(1); r.appendChild(ac); }
    var q = document.createElement("i"); q.className = "q"; q.textContent = d.type === "minor" ? "m" : d.type === "dim" ? "\u00b0" : "";
    s.appendChild(r); s.appendChild(q);
    if (spec && d.pc === spec.rootPc && (d.type === spec.type || (spec.type === "sus4"))) s.className = "on";
    row.appendChild(s);
  });
  fitKeyRow();
}
// v49: 7-chord row: one line when it fits, else root stacked over quality.
function fitKeyRow() {
  var row = document.getElementById("keyRow");
  if (!row || !row.firstChild) return;
  row.classList.remove("stack");
  var spans = row.children;
  function over() {
    for (var i = 0; i < spans.length; i++) if (spans[i].scrollWidth > spans[i].clientWidth + 0.5) return true;
    return false;
  }
  var i;
  for (i = 0; i < spans.length; i++) spans[i].style.fontSize = "";
  // v63: iPad / desktop: stay on one line (fixed-height row), shrinking the font down to 9 px.
  // v64: and keep >= 3 px of air each side of the text in every cell (G#m, C#m, D#m at 820 wide).
  if (document.documentElement.className.indexOf("lay-pad") >= 0) {
    var tight = function () {
      if (over()) return true;
      for (var j = 0; j < spans.length; j++) {
        var rg = document.createRange(); rg.selectNodeContents(spans[j]);
        var q = rg.getBoundingClientRect(), sr = spans[j].getBoundingClientRect();
        if (Math.min(q.left - sr.left, sr.right - q.right) < 3) return true;
      }
      return false;
    };
    var f1 = parseFloat(getComputedStyle(spans[0]).fontSize) || 13;
    while (f1 > 9 && tight()) { f1 -= 0.5; for (i = 0; i < spans.length; i++) spans[i].style.fontSize = f1 + "px"; }
    return;
  }
  if (!over()) return;
  row.classList.add("stack");
  var fs = parseFloat(getComputedStyle(spans[0]).fontSize) || 9;
  var floor = 11;
  while (fs > floor && over()) {
    fs -= 0.5;
    for (i = 0; i < spans.length; i++) spans[i].style.fontSize = fs + "px";
  }
}
export function setLockKey(k) {
  shared.lockKey = k;
  shared.suggestSig = "";
  refreshHeld();
}
function wireKeyPick() {
  var pick = document.getElementById("keyPick");
  var roots = pick.querySelector(".kp-roots");
  var sel = null;
  function paint() {
    var k = sel || activeKey() || { pc: 0, mode: "major" };
    var kn = keyRootName(k);
    if (alts.dataset.mode !== k.mode) buildRoots(k.mode);
    // Simple hides the spelling row, so its picker highlights by pitch.
    Array.prototype.forEach.call(pick.querySelectorAll(".kp-roots button, .kp-alts button"), function (b) {
      var on = state.simple ? (b.parentNode === roots && Number(b.dataset.pc) === k.pc) : b.dataset.name === kn;
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    Array.prototype.forEach.call(pick.querySelectorAll(".kp-modes button"), function (b) { b.classList.toggle("on", b.dataset.mode === k.mode); });
  }
  // v50: 12 keys plus the enharmonic spellings (C\u266f D\u266f G\u266d G\u266f A\u266f); the pick sets the spelling.
  function addRoot(name, parent) {
    var i = namePc(name);
    var b = document.createElement("button");
    b.type = "button"; b.dataset.pc = String(i); b.dataset.name = name; b.textContent = accSym(name);
    b.addEventListener("click", function () {
      var k = sel || activeKey() || { pc: 0, mode: "major" };
      setKeySpell(i, k.mode, name);
      sel = { pc: i, mode: k.mode }; setLockKey(sel); paint();
    });
    parent.appendChild(b);
  }
  var alts = document.createElement("div");
  alts.className = "kp-alts";
  alts.setAttribute("aria-label", "Other spellings");
  roots.parentNode.insertBefore(alts, roots.nextSibling);
  // Rows follow the quality: major offers C\u266f and G\u266d; minor D\u266f, A\u266d, A\u266f.
  function buildRoots(mode) {
    roots.innerHTML = ""; alts.innerHTML = "";
    keyMainNames(mode).forEach(function (n) { addRoot(n, roots); });
    keyAltNames(mode).forEach(function (n) { addRoot(n, alts); });
    alts.dataset.mode = mode;
  }
  Array.prototype.forEach.call(pick.querySelectorAll(".kp-modes button"), function (b) {
    b.addEventListener("click", function () {
      var k = sel || activeKey() || { pc: 0, mode: "major" };
      sel = { pc: k.pc, mode: b.dataset.mode }; setLockKey(sel); paint();
    });
  });
  function close() { pick.hidden = true; sel = null; }
  pick.querySelector(".kp-auto").addEventListener("click", function () { setLockKey(null); close(); });
  pick.querySelector(".kp-x").addEventListener("click", close);
  pick.addEventListener("click", function (e) { if (e.target === pick) close(); });
  document.getElementById("allKeys").addEventListener("click", function () {
    state.allKeys = !state.allKeys;
    updateSymbol();
    scheduleSave(0);
  });
  document.getElementById("keyChip").addEventListener("click", function () { sel = null; paint(); pick.hidden = false; });
  var ht = document.getElementById("howto");
  function closeHt() { ht.hidden = true; }
  document.getElementById("howtoBtn").addEventListener("click", function () { ht.hidden = false; ht.querySelector(".ht-x").focus(); });
  ht.querySelector(".ht-x").addEventListener("click", closeHt);
  // v65: yellow words scroll the dialog (not the page, no hash change) to their entry in
  // "Little words to know" and light it briefly. Works the same on phones (touch) and desktop.
  var htBox = ht.querySelector(".ht-box"), htHitT = 0;
  ht.addEventListener("click", function (e) {
    var a = e.target.closest ? e.target.closest("a.ht-term") : null;
    if (!a) return;
    e.preventDefault();
    var id = (a.getAttribute("href") || "").slice(1), tgt = id && document.getElementById(id);
    if (!tgt) return;
    var top = htBox.scrollTop + tgt.getBoundingClientRect().top - htBox.getBoundingClientRect().top - 12;
    top = Math.max(0, Math.min(top, htBox.scrollHeight - htBox.clientHeight));
    try { htBox.scrollTo({ top: top, behavior: "smooth" }); } catch (err) { htBox.scrollTop = top; }
    var hits = ht.querySelectorAll(".ht-words .ht-hit");
    for (var i = 0; i < hits.length; i++) hits[i].classList.remove("ht-hit");
    tgt.classList.add("ht-hit");
    try { tgt.focus({ preventScroll: true }); } catch (err) {}
    clearTimeout(htHitT);
    htHitT = setTimeout(function () { tgt.classList.remove("ht-hit"); }, 1600);
  });
  ht.addEventListener("click", function (e) { if (e.target === ht) closeHt(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { closeHt(); close(); } });
}

export function updateSymbol() {
  kbUpdate();   // v83: key change / walk: keep the window on the root (or the tonic before any chord)
  var spec = computeSpec();
  document.getElementById("symbol").textContent = accSym(spec.symbol);
  document.getElementById("tones").textContent = spec.names.map(accSym).join(" ");
  fitNowSymbol();
  document.getElementById("vname").textContent = state.voicing;
  var slider = document.getElementById("voicing");
  slider.setAttribute("aria-valuetext", state.voicing);
  var ticks = document.querySelectorAll(".vticks span");
  for (var i = 0; i < ticks.length; i++) ticks[i].classList.toggle("on", VOICINGS[i] === state.voicing);
  document.body.classList.toggle("is-key", state.keyMode);
  var keyBtn = document.getElementById("keyMode");
  keyBtn.classList.toggle("on", state.keyMode);
  keyBtn.setAttribute("aria-pressed", state.keyMode ? "true" : "false");
  var types = document.querySelectorAll("#types button");
  for (var t = 0; t < types.length; t++) {
    var typeBtn = types[t];
    var onType = typeHeld(typeBtn.dataset.type) || (shared.suggestPreview && shared.suggestPreview.type === typeBtn.dataset.type);
    typeBtn.classList.toggle("on", onType);
    typeBtn.setAttribute("aria-pressed", onType ? "true" : "false");
  }
  var exts = document.querySelectorAll("#exts button");
  var previewExt = shared.suggestPreview && shared.suggestPreview.extensions;
  // Momentary like type pads: light only while finger-held or during Next preview.
  // (applySuggestion writes state.extensions for sounding/quality, but must not
  // leave min7/maj7/etc. lit after the preview ends.)
  var litMin7 = extStillHeld("min7") || !!(previewExt && previewExt.min7);
  var litMaj7 = extStillHeld("maj7") || !!(previewExt && previewExt.maj7);
  var has7 = !!(litMin7 || litMaj7);
  for (var x = 0; x < exts.length; x++) {
    var extBtn = exts[x];
    var extName = extBtn.dataset.ext;
    var onExt = extStillHeld(extName) || !!(previewExt && previewExt[extName]);
    var dormant = (extName === "six" && has7) || (extName === "min7" && litMaj7);
    extBtn.classList.toggle("on", onExt);
    extBtn.classList.toggle("dormant", dormant && !onExt);
    extBtn.setAttribute("aria-pressed", onExt ? "true" : "false");
  }
  var engines = document.querySelectorAll("#engines button");
  for (var n = 0; n < engines.length; n++) {
    engines[n].classList.toggle("on", engines[n].dataset.sound === state.sound);
    engines[n].setAttribute("aria-pressed", engines[n].dataset.sound === state.sound ? "true" : "false");
  }
  var bass = document.getElementById("bass");
  bass.classList.toggle("on", state.bass);
  bass.setAttribute("aria-pressed", state.bass ? "true" : "false");
  document.getElementById("keyMajor").classList.toggle("on", state.keyScale === "major");
  document.getElementById("keyMinor").classList.toggle("on", state.keyScale === "minor");
  syncKeySel();
  document.getElementById("keyReadout").textContent = state.keyMode
    ? "Key of " + keyLabel(modeKey())
    : "Chromatic";
  paintKeyChip(spec);
  paintSuggestions(spec);
  paintPads();
  paintLoop();
  scheduleSave(200);
}

export var paletteHolds;

function typeHeld(name) {
  for (var id in paletteHolds) {
    if (paletteHolds[id].kind === "type" && paletteHolds[id].value === name) return true;
  }
  return false;
}

function extStillHeld(name) {
  for (var id in paletteHolds) {
    if (paletteHolds[id].kind === "ext" && paletteHolds[id].value === name) return true;
  }
  return false;
}

var paletteTimer;

function syncPalette() {
  var nextType = "major";
  for (var id in paletteHolds) {
    if (paletteHolds[id].kind === "type") nextType = paletteHolds[id].value;
  }
  state.type = nextType;
  var keys = ["six", "min7", "maj7", "nine"];
  for (var i = 0; i < keys.length; i++) state.extensions[keys[i]] = extStillHeld(keys[i]);
  clearStripExt();
  if (paletteTimer) clearTimeout(paletteTimer);
  paletteTimer = setTimeout(function () {
    paletteTimer = 0;
    refreshHeld();
  }, 20);
}

function releasePalette(pointerId) {
  if (pointerId == null) {
    var any = false;
    for (var id in paletteHolds) any = true;
    if (!any) return;
    paletteHolds = {};
  } else {
    if (!paletteHolds[pointerId]) return;
    delete paletteHolds[pointerId];
  }
  syncPalette();
}

function onPaletteDown(e) {
  if (e.button != null && e.button !== 0) return;
  var b = e.target.closest ? e.target.closest("button") : null;
  if (!b || b.disabled || !b.closest("#palette")) return;
  e.preventDefault();
  paletteHolds[e.pointerId] = {
    kind: b.dataset.type ? "type" : "ext",
    value: b.dataset.type || b.dataset.ext
  };
  try { b.setPointerCapture(e.pointerId); } catch (err) {}
  paletteStrike = true;
  syncPalette();
}

function onPaletteUp(e) {
  releasePalette(e.pointerId);
}


function onTouchGone(e) {
  var changed = e.changedTouches;
  if (changed) {
    for (var i = 0; i < changed.length; i++) {
      var tgt = changed[i].target;
      if (tgt && tgt.closest && tgt.closest("#sustainBtn")) continue;
      var id = changed[i].identifier;
      // Pointer path keys fingers by pointerId (often !== touch.identifier).
      // liftFinger no-ops on unknown ids; also try Chrome's identifier+2 map.
      liftFinger(id);
      if (typeof id === "number") liftFinger(id + 2);
      releasePalette(id);
      if (typeof id === "number") releasePalette(id + 2);
    }
  }
  // Only clear leftovers when every touch is gone. Soft lift respects Sustain.
  if (!e.touches || e.touches.length === 0) {
    releaseFingers();
    releasePalette(null);
  }
}

// Key mode on/off bookkeeping (shared by the Key button and Simple mode).
export function setKeyModeState(on) {
  state.keyMode = !!on;
  if (state.keyMode) {
    var degs = keyDegrees(modeKey());
    var found = 1;
    for (var i = 0; i < degs.length; i++) {
      if (degs[i].pc === state.rootPc) found = degs[i].degree;
    }
    state.degree = found;
  } else {
    var d = Theory.degreeChord(state.keyRoot, state.keyScale, state.degree, keyRootSpell(modeKey()));
    state.rootPc = d.rootPc;
  }
}

function wire() {
  var keySel = document.getElementById("keyRoot");
  buildKeySel();

  var palette = document.getElementById("palette");
  palette.addEventListener("pointerdown", onPaletteDown);
  palette.addEventListener("pointerup", onPaletteUp);
  palette.addEventListener("pointercancel", onPaletteUp);
  window.addEventListener("pointerup", onPaletteUp);
  window.addEventListener("pointercancel", onPaletteUp);

  document.getElementById("engines").addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    state.sound = b.dataset.sound;
    ChordAudio.setSound(state.sound);
    refreshHeld();
  });

  document.getElementById("bass").addEventListener("click", function () {
    state.bass = !state.bass;
    refreshHeld();
  });

  document.getElementById("keyMode").addEventListener("click", function () {
    setKeyModeState(!state.keyMode);
    renderPads();
    refreshHeld();
  });

  keySel.addEventListener("change", function () {
    var pcSel = namePc(keySel.value);
    if (pcSel < 0) return;
    state.keyRoot = pcSel;
    setKeySpell(pcSel, modeKey().mode, keySel.value);
    renderPads();
    refreshHeld();
  });

  document.getElementById("keyMajor").addEventListener("click", function () {
    state.keyScale = "major";
    if (state.keyMode) renderPads();
    refreshHeld();
  });
  document.getElementById("keyMinor").addEventListener("click", function () {
    state.keyScale = "minor";
    if (state.keyMode) renderPads();
    refreshHeld();
  });

  document.getElementById("styles").addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b || !b.dataset.style) return;
    var changed = b.dataset.style !== state.style;
    var leftKids = state.style === "kids" && b.dataset.style !== "kids";
    state.style = b.dataset.style;
    if (leftKids && magic) magic.hint = false;   // v71: leaving Kids clears its next-note hint
    if (state.style === "kids") {
      // v70: picking Kids always starts in C major (other styles keep the current key).
      state.keyRoot = 0;
      state.keyScale = "major";
      shared.lockKey = { pc: 0, mode: "major" };
      if (state.keyMode) renderPads();
    }
    if (changed && (leftKids || state.style === "kids")) renderPads();   // v83: same one-octave window in every style
    var all = document.querySelectorAll("#styles button");
    for (var i = 0; i < all.length; i++) all[i].classList.toggle("on", all[i] === b);
    shared.suggestSig = "";
    // A new Style pick loads that style's factory sound row; tweaks made
    // afterwards stick until the next Style pick or Factory reset.
    if (changed && applyStylePreset(state.style)) {
      refreshHeld();
    } else {
      enforceYogaDeepPaletteGate();
      paintSuggestions(computeSpec());
    }
    if (state.style === "kids" && prog.idx !== 0) progSet(0);   // v71: picking Kids starts on Twinkle
    if (leftKids && shared.U && shared.U.locked && shared.U.keep && upInList()) { for (var ui = 0; ui < prog.list.length; ui++) if (prog.list[ui].up) { progSet(ui); break; } }   // v73 Lock
  });

  document.getElementById("layouts").addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b || !b.dataset.layout) return;
    state.layout = b.dataset.layout;
    var all = document.querySelectorAll("#layouts button[data-layout]");
    for (var i = 0; i < all.length; i++) all[i].classList.toggle("on", all[i] === b);
    // Pads DOM is rebuilt below; dump any pooled rings so stale groups die.
    setSustain(false);
    paintSustainBtn();
    renderPads();
    paintKeyChip(computeSpec());   // v111 (K): the new keys get the in-key dimming at once (a layout switch left them undimmed)
  });

  wireSustain();

  document.getElementById("voicing").addEventListener("input", function (e) {
    state.voicing = VOICINGS[Number(e.target.value)];
    refreshHeld();
  });

  document.getElementById("cutoff").addEventListener("input", function (e) {
    ChordAudio.setCutoff(Number(e.target.value));
  });
  document.getElementById("reverb").addEventListener("input", function (e) {
    ChordAudio.setReverb(Number(e.target.value));
  });
  document.getElementById("delay").addEventListener("input", function (e) {
    ChordAudio.setDelay(Number(e.target.value));
  });
  document.getElementById("warmth").addEventListener("input", function (e) {
    setWarmth(e.target.value);
  });
  document.getElementById("bpm").addEventListener("input", function (e) {
    setBpm(e.target.value);
  });

  document.getElementById("rec").addEventListener("click", onRecord);
  document.getElementById("play").addEventListener("click", onPlay);
  document.getElementById("clear").addEventListener("click", onClear);

  eatMove(padsEl);

  document.addEventListener("pointerdown", function () { unlock(); }, true);
  window.addEventListener("pointerup", function (e) { onPadUp(e); });
  window.addEventListener("pointercancel", function (e) { onPadUp(e); });

  document.addEventListener("touchend", onTouchGone, true);
  document.addEventListener("touchcancel", onTouchGone, true);
  document.addEventListener("contextmenu", function (e) {
    if (e.target.closest && e.target.closest("#pads")) e.preventDefault();
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      progStop(); ChordAudio.band.hush();   // v104: hidden page = stopped, Band silent
      killLoopVoices();
      releaseFingers(true);
      setSustain(false);
    } else if (loop.transport && ChordAudio.ctx) {
      var s = 60 / loop.bpm / 4;
      var elapsed = (ChordAudio.currentTime() - loop.startTime) / s;
      loop.nextIndex = Math.max(0, Math.ceil(elapsed));
    }
  });
}

// v68: master Volume (Config). 0..100, gain = (v/100)^2 (perceptual), 100 = the old level.
export function setVolume(v) {
  v = Math.round(Number(v));
  if (!isFinite(v)) v = 100;
  v = Math.max(0, Math.min(100, v));
  state.volume = v;
  var el = document.getElementById("volume");
  if (el && el.value !== String(v)) el.value = String(v);
  if (el) el.setAttribute("aria-valuetext", String(v));
  var out = document.getElementById("volVal");
  if (out) out.textContent = String(v);
  ChordAudio.setVolume((v / 100) * (v / 100));
}
// v75 Band level (0 = no scheduler, no nodes). v86: Sound box toggle + level slider. The level
// Band fix: no toggle any more. One slider 0..100 (0 = off), saved as bandLvl. Band audio = level / 100.
export function setBand(v) {
  v = Math.round(Number(v));
  if (!isFinite(v) || v < 0) v = 0;
  state.band = Math.min(100, v);
  state.bandOn = state.band > 0;   // Band fix: no toggle; the slider above 0 is on
  applyBand();
}
function applyBand() {
  ChordAudio.band.setLevel(state.bandOn ? (state.band | 0) / 100 : 0);
  paintBand();
}
export function paintBand() {
  var el = document.getElementById("band");
  if (!el) return;
  var v = state.band | 0, on = !!ChordAudio.band && !!{ pop: 1, country: 1, jazz: 1, kids: 1, ballad: 1, rnb: 1 }[state.style];
  var live = !!state.bandOn;
  if (el.value !== String(v)) el.value = String(v);
  el.setAttribute("aria-valuetext", (live ? String(v) : "Off") + (on ? "" : ", no band for this style yet"));
  document.getElementById("bandVal").textContent = live ? String(v) : "Off";
  el.disabled = !on;
  var box = document.getElementById("bandWrap");
  box.classList.toggle("dim", !on);
  box.classList.toggle("on", live);
  box.classList.toggle("off", !live);
  box.title = on ? "" : "No band on this style yet";
}
export function paintProgNumsBtn() {
  var b = document.getElementById("progNumsBtn");
  if (b) { b.setAttribute("aria-checked", state.progNums ? "true" : "false"); b.classList.toggle("on", !!state.progNums); }
}
export function paintPlayAlongBtn() {   // v108
  var b = document.getElementById("playAlongBtn");
  if (b) { b.setAttribute("aria-checked", state.playAlong !== false ? "true" : "false"); b.classList.toggle("on", state.playAlong !== false); }
  var h = document.getElementById("paHintsBtn");   // v112: Show hints
  if (h) { h.setAttribute("aria-checked", state.paHints !== false ? "true" : "false"); h.classList.toggle("on", state.paHints !== false); }
}
function factoryReset() {
  if (shared.saveTimer) {
    clearTimeout(shared.saveTimer);
    shared.saveTimer = 0;
  }
  storageClear();
  clearSuggestPreview();
  var d = factoryDefaults();
  applySettings(d);
  renderPads();
  refreshHeld();
  updateSymbol();
  if (shared.saveTimer) {
    clearTimeout(shared.saveTimer);
    shared.saveTimer = 0;
  }
  // Storage stays empty until the user changes something again.
  shared.lastSaved = JSON.stringify(collectSettings());
  showToast("Settings reset to factory defaults");
  var btn = document.getElementById("configBtn");
  btn.classList.add("flash");
  setTimeout(function () { btn.classList.remove("flash"); }, 450);
}

function wireConfig() {
  var btn = document.getElementById("configBtn");
  var menu = document.getElementById("configMenu");
  var wrap = document.getElementById("configWrap");
  function setOpen(open) {
    menu.hidden = !open;
    if (!open) { var pt = document.getElementById("playAlongTip"); if (pt) pt.hidden = true; var pq = document.getElementById("playAlongQ"); if (pq) pq.setAttribute("aria-expanded", "false"); }   // v108
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  }
  btn.addEventListener("click", function (e) {
    e.stopPropagation();
    setOpen(menu.hidden);
    if (!menu.hidden) document.getElementById("factoryReset").focus({ preventScroll: true });
  });
  document.getElementById("factoryReset").addEventListener("click", function () {
    setOpen(false);
    factoryReset();
  });
  var bandEl = document.getElementById("band");
  bandEl.addEventListener("input", function () { setBand(bandEl.value); scheduleSave(150); });
  bandEl.addEventListener("change", function () { setBand(bandEl.value); scheduleSave(0); });
  var volEl = document.getElementById("volume");
  volEl.addEventListener("input", function () { setVolume(volEl.value); scheduleSave(150); });
  volEl.addEventListener("change", function () { setVolume(volEl.value); scheduleSave(0); });
  // v60: order badges on the strip (full mode only). Saved like the other settings.
  document.getElementById("progNumsBtn").addEventListener("click", function () {
    state.progNums = !state.progNums;
    paintProgNumsBtn();
    progRedecorate();
    scheduleSave();
  });
  // v108: Play along enable (saved), and its ? explanation (opens / closes under the switch)
  document.getElementById("playAlongBtn").addEventListener("click", function () {
    state.playAlong = state.playAlong === false;
    paintPlayAlongBtn();
    scheduleSave();
  });
  document.getElementById("paHintsBtn").addEventListener("click", function () {   // v112
    state.paHints = state.paHints === false;
    if (state.paHints === false) paHintHide();
    paintPlayAlongBtn();
    scheduleSave();
  });
  document.getElementById("tourBtn").addEventListener("click", function () {   // v112: Help > Tour (replay)
    setOpen(false);
    tourStart(true);
  });
  document.getElementById("playAlongQ").addEventListener("click", function (e) {
    e.stopPropagation();
    var tip = document.getElementById("playAlongTip"), q = e.currentTarget;
    tip.hidden = !tip.hidden;
    q.setAttribute("aria-expanded", tip.hidden ? "false" : "true");
    if (!tip.hidden && tip.scrollIntoView) tip.scrollIntoView({ block: "nearest" });   // v112: the menu can scroll in landscape
  });
  document.addEventListener("pointerdown", function (e) {
    if (!menu.hidden && !wrap.contains(e.target)) setOpen(false);
  }, true);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !menu.hidden) {
      setOpen(false);
      btn.focus({ preventScroll: true });
    }
  });

  // Every sticky control saves on change (sliders debounced).
  ["engines", "bass", "keyMode", "keyMajor", "keyMinor", "styles", "layouts"].forEach(function (id) {
    document.getElementById(id).addEventListener("click", function () { scheduleSave(0); });
  });
  document.getElementById("keyRoot").addEventListener("change", function () { scheduleSave(0); });
  ["voicing", "cutoff", "reverb", "delay", "warmth", "bpm"].forEach(function (id) {
    var el = document.getElementById(id);
    el.addEventListener("input", function () { scheduleSave(150); });
    el.addEventListener("change", function () { scheduleSave(0); });
  });
  window.addEventListener("pagehide", saveNow);
  window.addEventListener("pagehide", function () { progStop(); ChordAudio.band.hush(); });   // v104
  document.addEventListener("visibilitychange", function () { if (document.hidden) saveNow(); });
}

// ---- Simple mode + responsive controls (v20) ----
export function paintSimple() {
  var de = document.documentElement;
  de.classList.toggle("simple", !!state.simple);
  var btn = document.getElementById("simpleBtn");
  if (btn) btn.setAttribute("aria-checked", state.simple ? "true" : "false");
  if (state.simple) setDrawer(false);
  placeProg();
}

// One switch. ON: hide Sound/FX/Key/Loop/Layout controls (CSS: html.simple),
// force the Octave layout, stop any loop recording/playback, and force Key
// mode off. Hidden values are kept; OFF restores the chosen layout and Key mode.
function setSimple(on) {
  on = !!on;
  if (on === state.simple) return;
  var keep = progWalkAt();   // v111 (D5): the matching step after the switch
  progStop(); ChordAudio.band.hush();   // v104: a mode switch stops Play song and silences the Band
  if (on) {
    if (loop.recording || loop.playing || loop.transport) stopPlayback();
    state.keyModeBeforeSimple = !!state.keyMode;
    if (state.keyMode) setKeyModeState(false);
    // Simple has no keyboard or chord buttons; let go of anything held there.
    Object.keys(fingers).forEach(function (id) { liftFinger(id); });
    if (Object.keys(paletteHolds).length) { paletteHolds = {}; syncPalette(); }
    if (!activeKey()) shared.lockKey = { pc: 0, mode: "major" };
    state.simple = true;
    magicHintClear();   // v68: the next-chord hint is full mode only
  } else {
    var restoreKey = state.keyModeBeforeSimple;
    state.keyModeBeforeSimple = false;
    state.simple = false;
    if (restoreKey) setKeyModeState(true);
  }
  paintSimple();
  shared.suggestSig = "";
  paintSuggestions(computeSpec());
  progWalkTo(keep);   // v111 (D5)
  // Pads DOM is rebuilt; dump pooled rings like a layout change does.
  setSustain(false);
  paintSustainBtn();
  renderPads();
  refreshHeld();
  fitNowSymbol();
  scheduleSave(0);
}

// v43: drawer opens below the top bar so Simple / gear / ? stay tappable.
function syncTopbarH() { var t = document.querySelector("header.topbar"); if (t) document.documentElement.style.setProperty("--topbar-h", Math.ceil(t.getBoundingClientRect().bottom) + "px"); }
function isDrawerLayout() {
  return document.documentElement.classList.contains("lay-phone-land");
}

function paintCtl() {
  var ctl = document.getElementById("ctl");
  var open = ctl.dataset.open || "";
  var tabs = ctl.querySelectorAll(".ctl-tabs button[data-tab]");
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].setAttribute("aria-selected", tabs[i].dataset.tab === open ? "true" : "false");
  }
  var fold = document.getElementById("ctlFold");
  if (isDrawerLayout()) {
    fold.textContent = "\u2715";
    fold.setAttribute("aria-label", "Close controls");
  } else {
    fold.textContent = open ? "\u25B4" : "\u25BE";
    fold.setAttribute("aria-label", open ? "Collapse controls" : "Expand controls");
  }
  var toggle = document.getElementById("ctlToggle");
  toggle.setAttribute("aria-expanded", document.documentElement.classList.contains("drawer-open") ? "true" : "false");
}

var lastTab;
function setOpenTab(tab) {
  var ctl = document.getElementById("ctl");
  ctl.dataset.open = tab || "";
  if (tab) lastTab = tab;
  paintCtl();
}

function setDrawer(open) {
  var de = document.documentElement;
  open = !!open && isDrawerLayout() && !state.simple;
  syncTopbarH();
  de.classList.toggle("drawer-open", open);
  if (open && !document.getElementById("ctl").dataset.open) setOpenTab(lastTab);
  else paintCtl();
}

function onSizeChange() {
  if (typeof window.tcApplySizeClass === "function") window.tcApplySizeClass();
  if (!isDrawerLayout()) document.documentElement.classList.remove("drawer-open");
  // Re-render only when the Octave span changes (Simple on iPad = 2 octaves).
  if (effectiveLayout() === "octave" && padSpan !== octaveSpan()) {
    setSustain(false);
    paintSustainBtn();
    renderPads();
    refreshHeld();
  }
  paintCtl();
  placeProg();
  fitNowSymbol();
}

function wireLayoutUi() {
  document.getElementById("simpleBtn").addEventListener("click", function () {
    setSimple(!state.simple);
  });
  document.querySelector("#ctl .ctl-tabs").addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("button") : null;
    if (!b) return;
    var ctl = document.getElementById("ctl");
    if (b.id === "ctlFold") {
      if (isDrawerLayout()) setDrawer(false);
      else setOpenTab(ctl.dataset.open ? "" : lastTab);
      return;
    }
    var tab = b.dataset.tab;
    if (!tab) return;
    // Strip: tapping the open tab collapses it. Drawer: always shows a pane.
    if (!isDrawerLayout() && ctl.dataset.open === tab) setOpenTab("");
    else setOpenTab(tab);
  });
  document.getElementById("ctlToggle").addEventListener("click", function () {
    setDrawer(!document.documentElement.classList.contains("drawer-open"));
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && document.documentElement.classList.contains("drawer-open")) setDrawer(false);
  });
  var sizeTimer = 0;
  function queueSize() {
    if (sizeTimer) clearTimeout(sizeTimer);
    sizeTimer = setTimeout(function () { sizeTimer = 0; onSizeChange(); }, 60);
  }
  window.addEventListener("resize", queueSize);
  window.addEventListener("orientationchange", queueSize);
  paintCtl();
}

var startBanner;

// Boot step (runs once, in the original v112.3 order, from main.js)
export function boot1() {
IS_IOS = /iP(hone|ad|od)/.test(navigator.userAgent || "") ||
    (/Mac/.test(navigator.platform || "") && (navigator.maxTouchPoints || 0) > 1);
silentAudio = null;
silentAudioHidden = false;

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      silentAudioHidden = true;
      if (silentAudio) { try { silentAudio.pause(); } catch (err) { /* ignore */ } }
    } else {
      // Resumed by startSilentAudio() on the next user gesture.
      silentAudioHidden = false;
    }
  });
keySerial = 0;
padSpan = 1;
sustainPool = {};       // group id -> { pending } (loop-recording take)
groupSerial = 0;
  document.addEventListener("pointerdown", function (e) { if (e.target && e.target.closest && e.target.closest("#pads")) kbKidsPtr[e.pointerId] = 1; }, true);
  document.addEventListener("pointerup", kbKidsUp, true);
  document.addEventListener("pointercancel", kbKidsUp, true);
hapLast = -1e9;
  hapTest = /[?&]test=1(&|$)/.test(location.search);
  // v83: a rebuilt window drops the pressed key element (and its capture); lift from anywhere.
  window.addEventListener("pointerup", onPadUp);
  window.addEventListener("pointercancel", onPadUp);
paletteStrike = false;
kbLast = null;     // midis of the chord layer last sounded (the window anchor)
kbWinLow = null;   // MIDI of the window's left key
kbKeyGo = false;
kbChord = null;    // v84: {rootPc, type, root} of the chip / Next / Play chord that set the window
kbKeySig = null;   // v84: the key the window last saw (a key change moves it to the tonic)
kbFullLo = null;   // v111 (I): the Full layout's first key as drawn
suggestSeq = 0;
  window.addEventListener("pointerup", function (e) { if (stripHolds[e.pointerId]) stripUp(e.pointerId); }, true);
  window.addEventListener("pointercancel", function (e) { if (stripHolds[e.pointerId]) stripUp(e.pointerId); }, true);
  window.addEventListener("blur", releaseStripHolds);
  document.addEventListener("visibilitychange", function () { if (document.hidden) releaseStripHolds(); });
STRIP_ICONS = [
    { id: "happy", rows: "hi", aria: "Happy chords", svg: faceSvg("M7.6 14.2c1.1 1.9 2.6 2.8 4.4 2.8s3.3-.9 4.4-2.8") + arrowSvg(true) },
    { id: "sad", rows: "si", aria: "Sad and tense chords", svg: arrowSvg(false) + faceSvg("M7.6 17.2c1.1-1.9 2.6-2.8 4.4-2.8s3.3.9 4.4 2.8") }
  ];
stripKey = null;
notesPulsed = false;

  // ===== v55: chord progressions (PROGRESSIONS.md) =====
  // A step is "degree quality [xBars]": degree counts from the key's own home (major: I..VII,
  // minor: natural minor i..VII); a leading b lowers the root (bVII, bVI, bii). Quality names
  // are STRIP_QUAL keys. Played at 80 BPM, 4/4, one chord per bar (So What: 8 bars each).
  STRIP_QUAL["6"] = { type: "major", ext: { six: true }, label: "6" };
  STRIP_QUAL.dim = { type: "dim", ext: {}, label: "\u00b0" };
  STRIP_QUAL.over3 = { type: "major", ext: { over: 4 }, label: "/" };    // I/3 (C/E)
  STRIP_QUAL.mover3 = { type: "minor", ext: { over: 3 }, label: "m/" };  // i/3 (Cm/Eb)
}

// Boot step (runs once, in the original v112.3 order, from main.js)
export function boot2() {
laEl = null;
  laT = 0;
nxSigLast = "";
  nxT = 0;
  nxBursts = 0;
nxReduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
}

// Boot step (runs once, in the original v112.3 order, from main.js)
export function boot3() {
paHintAt = -1e9;
  paHintSeen = {};
  paHintTimer = 0;
  paLostSong = null;
paMissSong = null;   // v112.1 (L2)
tourI = -1;
tourWired = false;
}

// Boot step (runs once, in the original v112.3 order, from main.js)
export function boot4() {
upOpenAlt = null;   // "si:ci" whose alternates row is open
  window.addEventListener("resize", function () { fitStrip(); setTimeout(paintNextHint, 120); });   // v111: the next chord is always marked (no magic.hint gate)
  // v54: the panel can change height without a resize (Now column grows when a key is set).
  if (typeof ResizeObserver === "function") {
    var ssH = 0;
    new ResizeObserver(function (en) {
      var h = Math.round(en[0].contentRect.height);
      if (h !== ssH) { ssH = h; fitStrip(); }
    }).observe(document.getElementById("suggest"));
  }

  window.addEventListener("resize", function () { fitNowSymbol(); });
  window.addEventListener("resize", function () { fitKeyRow(); });
paletteHolds = {};
paletteTimer = 0;
}

// Boot step (runs once, in the original v112.3 order, from main.js)
export function boot5() {
lastTab = "sound";
startBanner = document.getElementById("unlock");
  if (startBanner) startBanner.textContent = "Tap anywhere to enable sound";

  try {
    wire();
    wireConfig();
    wireKeyPick();
    wireKidKey();
    wireProg();
    wireUpload();
    wireLayoutUi();
    // v52: fade the style row's right edge while more styles are scrolled out of view.
    (function () {
      var row = document.getElementById("styles");
      function fade() { row.classList.toggle("more", row.scrollWidth - row.clientWidth - row.scrollLeft > 2); }
      // v53: full mode, phone landscape: step the buttons tighter until all of them show.
      function fitStyles() {
        var root = document.documentElement;
        row.classList.remove("fit-1", "fit-2", "fit-3", "fit-4");
        if (root.classList.contains("lay-phone-land")) {
          var over = function () {
            var last = row.lastElementChild.getBoundingClientRect(), rr = row.getBoundingClientRect();
            return row.scrollWidth > row.clientWidth || last.right > rr.right - 1;
          };
          for (var i = 1; i <= 4 && over(); i++) {
            row.classList.remove("fit-" + (i - 1));
            row.classList.add("fit-" + i);
          }
        }
        fade();
      }
      row.addEventListener("scroll", fade, { passive: true });
      window.addEventListener("resize", fitStyles);
      if (window.MutationObserver) new MutationObserver(fitStyles).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
      setTimeout(fitStyles, 0); setTimeout(fitStyles, 400);
    })();
    var initial;
    try { initial = loadSettings(); } catch (err) { initial = factoryDefaults(); }
    try { applySettings(initial); } catch (err2) { applySettings(factoryDefaults()); }
    renderPads();
    updateSymbol();
    shared.lastSaved = JSON.stringify(collectSettings());
    shared.persistReady = true;
    if (shared.firstFresh && !tourDone() && (!PROG_TEST || /[?&]tour=1(&|$)/.test(location.search))) setTimeout(function () { tourStart(false); }, 700);   // v112: once, after the fresh Kids + Twinkle load (tests: only with tour=1)
  } finally {
    document.documentElement.classList.remove("tc-boot");
  }
}
