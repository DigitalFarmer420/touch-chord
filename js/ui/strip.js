// The chord table / scale strip: model, chips, taps, preview, fitting.
import { api as ChordAudio } from "../audio/index.js?v=112.7";
import { unlock } from "../audio/unlock.js?v=112.7";
import { activeKey, keyDegrees, keyRootName, suggestionKey } from "../keys.js?v=112.7";
import { paintKidChip } from "../kids.js?v=112.7";
import { paTwin, playAlongGo, playAlongChip } from "../songs/playalong.js?v=112.7";
import { setItemState, progSync, progDecorate, placeBadges } from "../songs/playback.js?v=112.7";
import { state, fingers, shared } from "../state.js?v=112.7";
import { Theory } from "../theory/index.js?v=112.7";
import { wrap12, blankExt, mapQuality } from "../theory/quality.js?v=112.7";
import { accSym } from "../theory/spelling.js?v=112.7";
import { paHintMiss } from "./hints.js?v=112.7";
import { kbSound, kidsSoloSpec } from "./keyboard.js?v=112.7";
import { paintNextHint, kidsGoldGo, kidsGoldPad } from "./next.js?v=112.7";
import { updateSymbol } from "./nowbox.js?v=112.7";
import { computeSpec, highlightMidisFromSpec, refreshHeld } from "./pads.js?v=112.7";
import { paintProg } from "./progbar.js?v=112.7";
import { fxTapPulse } from "./pulse.js?v=112.7";
import { sustainPool, sustainActive } from "./sustain.js?v=112.7";
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
export function clearStripExt() {
  STRIP_EXT.forEach(function (k) { state.extensions[k] = k === "over" ? 0 : false; });
  state.stripSpell = null;
}

// v53: chips and strip notes hold like keys. pointerdown starts the chord in its own
// group and it sounds at full level until the finger lifts. Let go before the preview
// length (1.6 s) and it rings on to the end of the preview (a quick tap sounds as before);
// let go later and it releases now. With Sustain down, a lifted chip joins the pedal pool.
export const PREVIEW_MS = 1600;
const stripHolds = {};   // pointerId -> { group, t0, silent }
export const stripTails = {};   // group -> timer (let go, still ringing out its preview)
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
  if (shared.paletteTimer) {
    clearTimeout(shared.paletteTimer);
    shared.paletteTimer = 0;
  }
  shared.paletteHolds = {};
  if (!shared.kbKeyGo) shared.kbKeyStay = false;   // v102: a chip / pad / Next chord may move the window again
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

// v112.7: a long name that still overflows its chip at the 11 px floor (F#m7b5/C in a 29 px portrait chip):
// first put the slash bass on its own line (root / quality / "/bass", only when the root is already over
// the quality), and if it still overflows, ellipsize the quality so nothing spills past the border.
// Layout only: the chip's text and aria-label are unchanged.
function fitLong(ch) {
  function over() { return ch.scrollWidth > ch.clientWidth + 0.5 || ch.scrollHeight > ch.clientHeight + 0.5; }
  var q = ch.querySelector(".q"), stacked = getComputedStyle(ch).flexDirection === "column";
  if (q && stacked && !q.querySelector(".sb")) {
    var t = q.textContent, i = t.indexOf("/");
    if (i > 0) { q.textContent = t.slice(0, i); var sb = document.createElement("span"); sb.className = "sb"; sb.textContent = t.slice(i); q.appendChild(sb); }
  }
  if (q && q.querySelector(".sb")) { ch.classList.add("sb3"); if (over()) ch.classList.remove("sb3"); }
  if (over()) ch.classList.add("ell");
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
  for (var c0 = 0; c0 < chips.length; c0++) chips[c0].classList.remove("sq", "st1", "c2", "sb3", "ell");
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
      if (overC(ch)) fitLong(ch);
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

// Boot step (runs once, in the original v112.3 order, from main.js)
export function boot1() {
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
  window.addEventListener("resize", function () { fitStrip(); setTimeout(paintNextHint, 120); });   // v111: the next chord is always marked (no magic.hint gate)
  // v54: the panel can change height without a resize (Now column grows when a key is set).
  if (typeof ResizeObserver === "function") {
    var ssH = 0;
    new ResizeObserver(function (en) {
      var h = Math.round(en[0].contentRect.height);
      if (h !== ssH) { ssH = h; fitStrip(); }
    }).observe(document.getElementById("suggest"));
  }
}
