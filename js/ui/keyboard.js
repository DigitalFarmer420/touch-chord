// Keyboard window (which octave shows), Kids key placement and the Kids solo note.
import { activeKey, keyDegrees } from "../keys.js?v=112.10";
import { kidKey } from "../kids.js?v=112.10";
import { magic, prog } from "../songs/playback.js?v=112.10";
import { state, fingers, padsEl, shared } from "../state.js?v=112.10";
import { wrap12 } from "../theory/quality.js?v=112.10";
import { paintKeyChip } from "./keychip.js?v=112.10";
import { kidsHintItem } from "./next.js?v=112.10";
import { computeSpec, effectiveLayout, renderKeys, paintPads, kbKidsPtr } from "./pads.js?v=112.10";
import { KB_RESET_MS, tonicLow } from "./kbmath.js?v=112.10";
import { stripHeldNow } from "./strip.js?v=112.10";
// ---- v83 one-octave window ----
var kbLast;
var kbPadAnchor = false;   // v112.9: kbLast came from a Kids chord pad pressed by hand: it leads the window (kbWantLow); v112.10: never over the gold
export var kbChord;
var kbKeySig;
function kbChordOf(spec) {
  if (!spec || !spec.midis || !spec.midis.length) return null;
  var r = null;
  spec.midis.forEach(function (m) { if (r == null && wrap12(m) === wrap12(spec.rootPc)) r = m; });
  return r == null ? null : { rootPc: wrap12(spec.rootPc), type: spec.type, root: r };
}
// v84: the key of an out-of-key chord root (bVII E in F# major) that the window was set by.
export function kbBorrowKey(pc, midi, deg) {
  if (!kbChord || pc !== kbChord.rootPc || !kbKeyLayout()) return false;   // v102: every key of that root (the top key too), not just the one the chord sat on
  if (state.keyMode) return !deg;
  var k = activeKey();
  if (!k || state.allKeys) return false;
  return !keyDegrees(k).some(function (d) { return d.pc === pc; });
}
export function kbWindowMode() { var l = effectiveLayout(); return l === "octave" || l === "piano"; }
// v85 Full: fixed keys, never re-anchored. Kids G3..F5 (55..77, as v81), other styles C4..C6 (60..84, v81 Piano).
export function kbFullMode() { return effectiveLayout() === "full"; }
export function kidsKeyNow() { return kidKey(); }   // v111 (I/K): the Kids key (kidKey: the picked key, else C major, as the Kids key picker shows)
export function kidsTonic() { var ak = kidsKeyNow(); return 55 + wrap12((ak ? ak.pc : 0) - 7); }   // v111 (I): the Kids tonic, G3..F#4
function kidsFullLo() {   // v111 (I/J): the Full Kids keys = tonic to tonic, 2 octaves; a song that dips below its tonic (and fits) starts an octave lower, so no melody note is moved
  var t = kidsTonic(), st = typeof prog !== "undefined" && prog && prog.style === "kids" && prog.steps ? prog.steps : [], mn = 0, mx = 0;
  st.forEach(function (x) { var m = x && x.item ? x.item.mel : null; if (m != null) { if (m < mn) mn = m; if (m > mx) mx = m; } });
  return mn < 0 && mx <= 12 ? t - 12 : t;
}
export function kbFullRange() { if (state.style === "kids") { var t = kidsFullLo(); return { lo: t, hi: t + 24 }; } return { lo: 60, hi: 84 }; }   // v111 (I/J): Kids = tonic to tonic, 2 octaves
export function kbKeyLayout() { return kbWindowMode() || kbFullMode(); }   // piano keys that light what sounds
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
  if (shared.kbKeyStay && kbWindowMode() && shared.kbWinLow != null && (g < shared.kbWinLow || g > shared.kbWinLow + 12)) g = shared.kbWinLow + wrap12(g - shared.kbWinLow);   // v102
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
export function kbWantLow(force) {
  if (state.style === "kids") {   // v111 (I): the Kids window sits on the key's tonic; it moves only as far as needed to show a gold / sounding note outside it, and goes back when they fit
    var kT = kidsTonic();
    if (kbFullMode()) return kbFullRange().lo;
    if (shared.kbWinLow != null && (Object.keys(fingers).length || Object.keys(kbKidsPtr).length)) return shared.kbWinLow;   // never slide the keys under a held finger (v84); kbKidsLift moves them on release
    var kS = kbLast && kbLast.length ? kbLast.slice() : [], kG = kidsGoldNow();
    if (kG != null) kS.push(kG);
    // v112.9: a Kids pad chord now sounds in root position upward from its root (no fold), so it can reach past the gold:
    // while a chord pad pressed by hand is the window anchor (until the reset KB_RESET_MS after it is let go) it wins, so
    // all of it lights; gold melody notes, Play along keys, Next and Play song keep the gold first (the melody leads).
    var kPad = kbPadAnchor && kbLast && kbLast.length && !(typeof prog !== "undefined" && prog && prog.playing);
    // v112.10: the gold always wins. A pad may slide the window only while the gold stays on it (pad + gold fit in 13 keys:
    // the minimal move below shows both); a pad chord that cannot share the window with the gold does not move it (its notes
    // past the window sound but stay dark). Without a gold (no song step) a hand-pressed pad chord still leads (v112.9).
    if (kS.length && Math.max.apply(null, kS) - Math.min.apply(null, kS) > 12) {
      if (kPad && kG != null && !force && shared.kbWinLow != null && kG >= shared.kbWinLow && kG <= shared.kbWinLow + 12) return shared.kbWinLow;   // v112.10: the window stays (the gold is on it)
      kS = kG != null ? [kG] : kPad ? kbLast.slice() : kS.slice(-1);   // the gold first (v112.9: without a gold, a hand-pressed Kids pad chord first)
    }
    var kFit = function (lo) { return kS.every(function (m) { return m >= lo && m <= lo + 12; }); };
    if (kFit(kT)) return kT;
    if (!force && shared.kbWinLow != null && kFit(shared.kbWinLow)) return shared.kbWinLow;
    var kMn = Math.min.apply(null, kS), kMx = Math.max.apply(null, kS);
    return kMn < kT ? kMn : kMx - 12;
  }
  if (!force && shared.kbKeyStay && shared.kbWinLow != null) return shared.kbWinLow;   // v102
  var S = kbLast && kbLast.length ? kbLast.slice() : [];
  var g = kidsGoldNow();
  if (g != null) S.push(g);
  // v84 Kids: the window stays put while the sounding note and the gold both fit in it
  // (a gold-key tap must not slide the keys under the finger).
  if (!force && state.style === "kids" && shared.kbWinLow != null && S.length && S.every(function (m) { return m >= shared.kbWinLow && m <= shared.kbWinLow + 12; })) return shared.kbWinLow;
  if (!kbLast || !kbLast.length) {
    var ak = activeKey(), pc = ak ? ak.pc : wrap12(state.keyRoot || 0);
    var T = state.style === "kids" ? 55 + wrap12(pc - 7) : tonicLow(pc);
    if (S.every(function (m) { return m >= T && m <= T + 12; })) return T;   // v84: the tonic (Kids: when the gold fits)
  }
  // kb-fix: chips are rooted C4..B4 by pitch class now, so move the 13-key window only as far as needed to
  // show the whole chord (a chord that already fits stays put; else its top or bottom note at the edge);
  // a chord wider than the window (slash bass far below): from its lowest note, as before.
  var sMn = Math.min.apply(null, S), sMx = Math.max.apply(null, S), cur = shared.kbWinLow;
  if (state.style !== "kids" && cur != null && sMx - sMn <= 12) {
    if (sMn >= cur && sMx <= cur + 12) return cur;
    return sMn < cur ? sMn : sMx - 12;
  }
  return sMn;
}
export function kbSound(midis, spec, item, kidsPad) {
  if (midis && midis.length) { kbLast = midis.slice(); kbPadAnchor = !!kidsPad; }   // v112.9: kidsPad = a chord pad pressed by hand (not a Play along key / gold melody note / Next / Play)
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
export function kbUpdate() {
  if (padsEl && kbFullMode() && !Object.keys(fingers).length) {   // v111 (I): Kids Full keys move to a new key's tonic
    var fr0 = kbFullRange();
    if (shared.kbFullLo !== null && shared.kbFullLo !== fr0.lo) { kbChord = null; kbLast = null; kbRebuild(); return true; }   // new key / song: no stale borrowed key
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
  if (L === shared.kbWinLow && !force) return false;
  shared.kbWinLow = L;
  kbRebuild();
  return true;
}
// kb-fix: the at-rest window = the selected key's tonic (C 60, G 67, Eb 63, A 69). Key taps and chip
// octaves are measured from it; chips / Next / Play along may move the window to show their chord,
// and KB_RESET_MS after the last release (chip up, key up, the Next / Play along preview ending,
// Play song stopped) it snaps back here. Kids keeps its own window rules (kbWantLow, kbKidsLift).
export function kbTonicLow() { var ak = activeKey(); return tonicLow(ak ? ak.pc : wrap12(state.keyRoot || 0)); }
var kbResetT = 0;
export function kbScheduleReset(ms, kidsPad) {
  if (state.style === "kids" && !kidsPad) return;   // v112.9: in Kids only the chord grid (pad release / preview end) schedules it
  if (kbResetT) clearTimeout(kbResetT);
  kbResetT = setTimeout(kbResetNow, ms == null ? KB_RESET_MS : ms);
}
// Snap back now unless something still holds the chord (a key, a chip, Play song): its release
// (liftFinger / stripUp / clearSuggestPreview / progStop) schedules the reset again.
export function kbResetNow() {
  kbResetT = 0;
  if (state.style === "kids") return kbKidsReset();
  if (!padsEl || !kbKeyLayout()) return false;
  if (Object.keys(fingers).length || stripHeldNow() || (typeof prog !== "undefined" && prog && prog.playing)) return false;
  var hadBorrow = !!(kbChord && padsEl.querySelector(".pad[data-borrow]"));
  kbLast = null; kbChord = null;   // the window anchor and the chip's live borrowed root key go too
  shared.kbKeyStay = false;   // v102 freeze ends with the reset (the window is back at rest)
  var moved = false;
  if (kbWindowMode()) { var T = kbTonicLow(); if (shared.kbWinLow !== T) { shared.kbWinLow = T; moved = true; } }
  if (moved || hadBorrow) kbRebuild();
  return moved || hadBorrow;
}
// v112.9: Kids, KB_RESET_MS after a hand-pressed chord pad is let go (or its preview ends): the pad chord stops anchoring
// the window, which goes back to the v111 Kids rule (tonic, or a minimal move to show the gold). Under a held finger the
// keys stay; kbKidsLift moves them on release. Without a pad anchor nothing changes (gold notes keep the v111 rules).
function kbKidsReset() {
  if (!kbPadAnchor) return false;
  if (!padsEl || !kbKeyLayout() || stripHeldNow() || (typeof prog !== "undefined" && prog && prog.playing)) return false;
  kbLast = null; kbChord = null; kbPadAnchor = false;
  if (!kbWindowMode() || Object.keys(fingers).length || Object.keys(kbKidsPtr).length) return false;
  var L = kbWantLow(false);
  if (L === shared.kbWinLow) return false;
  shared.kbWinLow = L; kbRebuild(); return true;
}
export function kbResetPending() { return !!kbResetT; }
export function kbCancelReset() { if (kbResetT) { clearTimeout(kbResetT); kbResetT = 0; } }   // a new chip / Next / Play along chord: its own release or preview end reschedules
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

// Boot step (runs once, in the original v112.3 order, from main.js)
export function boot() {
kbLast = null;     // midis of the chord layer last sounded (the window anchor)
kbPadAnchor = false;
kbChord = null;    // v84: {rootPc, type, root} of the chip / Next / Play chord that set the window
kbKeySig = null;   // v84: the key the window last saw (a key change moves it to the tonic)
}
