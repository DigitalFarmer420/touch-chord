// Built-in progressions (PROGRESSIONS: every style + Kids songs) and their parsing.
import { keyDegrees } from "../keys.js?v=112.11";
import { upInList, upSteps } from "./song.js?v=112.11";
import { upProgObj } from "./upload.js?v=112.11";
import { state, shared } from "../state.js?v=112.11";
import { Theory } from "../theory/index.js?v=112.11";
import { wrap12, blankExt } from "../theory/quality.js?v=112.11";
import { accSym } from "../theory/spelling.js?v=112.11";
import { STRIP_QUAL, plainRootSpell } from "../ui/strip.js?v=112.11";
const PROG_BPM = 80;
export var PROG_BAR;
function P(name, s) { return { name: name, steps: s.split("|") }; }
// v60: labels are Style + feel (phones show the feel only). Steps: "degree quality [xBars]".
export var PROGRESSIONS;
// Phones: the feel only ("Jazz Turnaround" -> "Turnaround", "Yoga Drone" -> "Drone").
export function progFeel(name) { if (upProgObj && shared.U && name === upProgObj.name) return shared.U.title; return String(name || "").replace(/^(Pop|Kids|Jazz|R&B|Ballad|Reggae|Funk|Yoga|Country)\s+/, ""); }
const PROG_SUFFIX = { maj: "", min: "", "7": "7", maj7: "maj7", m7: "7", m7b5: "\u00f87", sus4: "sus4", sus2: "sus2",
  add9: "add9", madd9: "add9", "9": "9", maj9: "maj9", m9: "9", "9sus": "9sus", "13": "13", "7b9": "7\u266d9",
  "7#9": "7\u266f9", "7sus4": "7sus4", "6": "6", dim: "\u00b0", overV: "/V", moverV: "/V", over3: "/3", mover3: "/3" };
export function progList(style, mode) {
  var s = PROGRESSIONS[style] || PROGRESSIONS.pop;
  var l = s[mode === "minor" ? "minor" : "major"];
  if (!l || !l.length) l = s.major;   // v109: Kids has no minor songs any more
  return upInList() ? l.concat([upProgObj]) : l;   // Upload: the song goes last (full mode, not Kids)
}
function progParse(str) {
  var t = str.trim().split(/\s+/);
  var low = t[0].charAt(0) === "b";
  var bars = 1, mel = null;   // v96: tokens after the quality by prefix: x = bars, @ = melody (semitones above the tonic)
  t.slice(2).forEach(function (x) { if (x.charAt(0) === "x") bars = parseFloat(x.slice(1)); else if (x.charAt(0) === "@") mel = parseInt(x.slice(1), 10); });
  return { deg: parseInt(low ? t[0].slice(1) : t[0], 10), q: t[1], low: low, bars: bars, mel: mel };
}
// One step -> a strip item, its numeral and its strip place (same rules as stripModel chips).
function progStep(key, str) {
  var st = progParse(str);
  var kdegs = keyDegrees(key);
  if (state.style === "kids") kidsMajorStep(st, kdegs);   // v103
  var rowPcs = kdegs.map(function (d) { return d.pc; }).sort(function (a, b) { return a - b; });
  var dorder = kdegs.slice().sort(function (a, b) { return a.pc - b.pc; }).map(function (d) { return d.degree; });
  var inKey = {};
  kdegs.forEach(function (d) { inKey[d.pc] = true; });
  var d = kdegs[st.deg - 1];
  var q = STRIP_QUAL[st.q];
  var pc = wrap12(d.pc - (st.low ? 1 : 0));
  var ext = blankExt();
  for (var ek in q.ext) ext[ek] = q.ext[ek];
  var tonePcs = Theory.chordIntervals(q.type, ext).map(function (iv) { return wrap12(pc + iv); });
  if (ext.over) tonePcs.push(wrap12(pc + ext.over));
  var diatonic = tonePcs.every(function (x) { return inKey[x]; });
  var ni = rowPcs.indexOf(pc), hc, rs;
  if (ni >= 0) { rs = kdegs[dorder[ni] - 1].rootSpell; hc = 1 + 2 * ni; }
  else {
    rs = plainRootSpell(pc, st.low ? { li: d.rootSpell.li, acc: d.rootSpell.acc - 1 } : d.rootSpell);
    hc = 2 * rowPcs.filter(function (x) { return x < pc; }).length;
  }
  var lab = q.label;
  if (ext.over) lab = (q.type === "minor" ? "m" : "") + "/" + accSym(Theory.spellInterval(rs, ext.over).name);
  var base = String(d.roman).replace(/[^ivIV]/g, "").toUpperCase();
  var lower = q.type === "minor" || q.type === "dim";
  var roman = (st.low ? "\u266d" : "") + (lower ? base.toLowerCase() : base) + (PROG_SUFFIX[st.q] || "");
  var row = (q.type === "minor" && !ext.over) ? "sad"
    : (q.type === "dim" || q.type === "sus4" || ext.flat9 || ext.sharp9 || ext.over) ? "tension"
    : (diatonic && ni >= 0) ? "happy" : "bright";
  // Chip numeral (as on strip chips): degree, case, \u00b0 / \u00f8, /V or /3.
  var rn = (st.low ? "\u266d" : "") + (lower ? base.toLowerCase() : base) + (q.type === "dim" ? (ext.min7 ? "\u00f8" : "\u00b0") : "") +
    (ext.over ? (ext.over === 2 ? "/V" : "/3") : "");
  return {
    bars: st.bars, roman: roman, rn: rn, hc: hc, row: row,
    item: { rootPc: pc, rootName: Theory.noteName(rs), rootSpell: rs,
      degree: (!st.low && diatonic && q.type === d.type && !ext.over) ? d.degree : null,
      type: q.type, extensions: ext, qualityLabel: q.label, chipLabel: lab, keepSpell: ni >= 0, mel: st.mel }
  };
}
// v103 Kids: the step's chord is the MAJOR triad on its melody note (the @ token, else the chord root),
// on that scale degree, so the gold pad, Next / Play, the Now card and the keys all show the melody.
function kidsMajorStep(st, kdegs) {
  var tonic = kdegs[0].pc, d = kdegs[st.deg - 1];
  var mpc = st.mel != null ? wrap12(tonic + st.mel) : wrap12(d.pc - (st.low ? 1 : 0));
  for (var i = 0; i < kdegs.length; i++) if (kdegs[i].pc === mpc) { st.deg = i + 1; st.low = false; st.q = "maj"; return; }
  st.q = "maj";   // (not reached by the Kids songs: every melody note is in the key)
}
export function progSteps(key, p) { if (p && p.up) return shared.U ? upSteps(key) : []; return p.steps.map(function (s) { return progStep(key, s); }); }
// Full mode label: the numerals (repeats folded as x2; very long ones list their chords).
export function progNumerals(steps) {
  var out = [];
  steps.forEach(function (s) {
    var last = out[out.length - 1];
    if (last && last.r === s.roman && s.bars === 1 && last.single) { last.n++; return; }
    out.push({ r: s.roman, n: s.bars, single: s.bars === 1 });
  });
  var txt = out.map(function (o) { return o.r + (o.n > 1 ? "\u00d7" + o.n : ""); }).join("\u2013");
  if (txt.length > 30) {
    var uniq = [];
    steps.forEach(function (s) { if (uniq.indexOf(s.roman) < 0) uniq.push(s.roman); });
    var nb = 0;
    steps.forEach(function (s) { nb += s.bars; });
    txt = Math.round(nb) + " bars: " + uniq.join("\u2013");
  }
  return txt;
}
const PROG_EXT_KEYS = ["six", "min7", "maj7", "nine", "sus2", "flat9", "sharp9", "thirteen", "over"];
export function sameChord(a, b) {
  if (!a || !b || wrap12(a.rootPc) !== wrap12(b.rootPc) || a.type !== b.type) return false;
  var ea = a.extensions || {}, eb = b.extensions || {};
  for (var i = 0; i < PROG_EXT_KEYS.length; i++) {
    var k = PROG_EXT_KEYS[i];
    if ((ea[k] || 0) !== (eb[k] || 0)) return false;
  }
  return true;
}

// Boot step (runs once, in the original v112.3 order, from main.js)
export function boot() {
PROG_BAR = 60 / PROG_BPM * 4;   // 3 s
PROGRESSIONS = {
    pop: {
      major: [P("Pop Four-Chord", "1 maj|5 maj|6 min|4 maj"), P("Pop Minor Start", "6 min|4 maj|1 maj|5 maj"), P("Pop Turnaround", "1 maj|6 min|4 maj|5 maj")],
      minor: [P("Pop Four-Chord", "1 min|5 min|6 maj|4 min"), P("Pop Minor Start", "6 maj|4 min|1 min|5 min"), P("Pop Turnaround", "1 min|6 maj|4 min|5 maj")]
    },
    // v97 Kids. One step = one sung note: "degree quality xBars @melody" (melody = semitones above the
    // key's tonic; xBars = note length, 0.25 = a quarter note at 4/4). The step's CHORD is the standard
    // harmonization under that note; Kids playback sounds the @melody note (no @ = the chord root, as before).
    // Minor degrees count from the minor home (natural minor), so VI and VII need no flat.
    kids: {
      major: [P("Kids Twinkle", "1 maj x0.25 @0|1 maj x0.25 @0|1 maj x0.25 @7|1 maj x0.25 @7|4 maj x0.25 @9|4 maj x0.25 @9|1 maj x0.5 @7|4 maj x0.25 @5|4 maj x0.25 @5|1 maj x0.25 @4|1 maj x0.25 @4|5 maj x0.25 @2|5 maj x0.25 @2|1 maj x0.5 @0|1 maj x0.25 @7|1 maj x0.25 @7|4 maj x0.25 @5|4 maj x0.25 @5|1 maj x0.25 @4|1 maj x0.25 @4|5 maj x0.5 @2|1 maj x0.25 @7|1 maj x0.25 @7|4 maj x0.25 @5|4 maj x0.25 @5|1 maj x0.25 @4|1 maj x0.25 @4|5 maj x0.5 @2|1 maj x0.25 @0|1 maj x0.25 @0|1 maj x0.25 @7|1 maj x0.25 @7|4 maj x0.25 @9|4 maj x0.25 @9|1 maj x0.5 @7|4 maj x0.25 @5|4 maj x0.25 @5|1 maj x0.25 @4|1 maj x0.25 @4|5 maj x0.25 @2|5 maj x0.25 @2|1 maj x0.5 @0"),
              P("Kids Mary's Lamb", "1 maj x0.25 @4|1 maj x0.25 @2|1 maj x0.25 @0|1 maj x0.25 @2|1 maj x0.25 @4|1 maj x0.25 @4|1 maj x0.5 @4|5 maj x0.25 @2|5 maj x0.25 @2|5 maj x0.5 @2|1 maj x0.25 @4|1 maj x0.25 @7|1 maj x0.5 @7|1 maj x0.25 @4|1 maj x0.25 @2|1 maj x0.25 @0|1 maj x0.25 @2|1 maj x0.25 @4|1 maj x0.25 @4|1 maj x0.25 @4|1 maj x0.25 @4|5 maj x0.25 @2|5 maj x0.25 @2|5 maj x0.25 @4|5 maj x0.25 @2|1 maj x1 @0"),
              P("Kids Row Your Boat", "1 maj x0.375 @0|1 maj x0.375 @0|1 maj x0.25 @0|1 maj x0.125 @2|1 maj x0.375 @4|1 maj x0.25 @4|1 maj x0.125 @2|1 maj x0.25 @4|1 maj x0.125 @5|1 maj x0.75 @7|1 maj x0.125 @0|1 maj x0.125 @0|1 maj x0.125 @0|1 maj x0.125 @7|1 maj x0.125 @7|1 maj x0.125 @7|1 maj x0.125 @4|1 maj x0.125 @4|1 maj x0.125 @4|1 maj x0.125 @0|1 maj x0.125 @0|1 maj x0.125 @0|5 maj x0.25 @7|5 maj x0.125 @5|5 maj x0.25 @4|5 maj x0.125 @2|1 maj x0.75 @0"),
              P("Kids Hot Cross Buns", "1 maj x0.25 @4|1 maj x0.25 @2|1 maj x0.5 @0|1 maj x0.25 @4|1 maj x0.25 @2|1 maj x0.5 @0|1 maj x0.125 @0|1 maj x0.125 @0|1 maj x0.125 @0|1 maj x0.125 @0|5 maj x0.125 @2|5 maj x0.125 @2|5 maj x0.125 @2|5 maj x0.125 @2|1 maj x0.25 @4|1 maj x0.25 @2|1 maj x0.5 @0"),   // v112.4: traditional (public domain), 4/4
              P("Kids Old MacDonald", "1 maj x0.25 @0|1 maj x0.25 @0|1 maj x0.25 @0|1 maj x0.25 @7|4 maj x0.25 @9|4 maj x0.25 @9|1 maj x0.5 @7|1 maj x0.25 @4|1 maj x0.25 @4|5 maj x0.25 @2|5 maj x0.25 @2|1 maj x0.75 @0|1 maj x0.25 @7|1 maj x0.25 @0|1 maj x0.25 @0|1 maj x0.25 @0|1 maj x0.25 @7|4 maj x0.25 @9|4 maj x0.25 @9|1 maj x0.5 @7|1 maj x0.25 @4|1 maj x0.25 @4|5 maj x0.25 @2|5 maj x0.25 @2|1 maj x0.5 @0|1 maj x0.25 @7|1 maj x0.25 @7|1 maj x0.25 @0|1 maj x0.25 @0|1 maj x0.25 @0|1 maj x0.125 @7|1 maj x0.125 @7|1 maj x0.25 @0|1 maj x0.25 @0|1 maj x0.5 @0|1 maj x0.125 @0|1 maj x0.125 @0|1 maj x0.25 @0|1 maj x0.125 @0|1 maj x0.125 @0|1 maj x0.25 @0|1 maj x0.125 @0|1 maj x0.125 @0|1 maj x0.125 @0|1 maj x0.125 @0|1 maj x0.25 @0|1 maj x0.25 @0|1 maj x0.25 @0|1 maj x0.25 @0|1 maj x0.25 @0|1 maj x0.25 @7|4 maj x0.25 @9|4 maj x0.25 @9|1 maj x0.5 @7|1 maj x0.25 @4|1 maj x0.25 @4|5 maj x0.25 @2|5 maj x0.25 @2|1 maj x1 @0"),
              // v109: six more sing-alongs (traditional / public-domain words), same format as Twinkle
              P("Kids Itsy Bitsy Spider", "1 maj x0.125 @-5|1 maj x0.25 @0|1 maj x0.125 @0|1 maj x0.25 @0|1 maj x0.125 @2|1 maj x0.375 @4|1 maj x0.25 @4|1 maj x0.125 @4|5 maj x0.25 @2|5 maj x0.125 @0|5 maj x0.25 @2|5 maj x0.125 @4|1 maj x0.75 @0|1 maj x0.375 @4|1 maj x0.25 @4|1 maj x0.125 @5|5 maj x0.375 @7|5 maj x0.375 @7|7 dim x0.25 @5|7 dim x0.125 @4|7 dim x0.25 @5|7 dim x0.125 @7|1 maj x0.75 @4|1 maj x0.375 @0|1 maj x0.25 @0|1 maj x0.125 @2|1 maj x0.375 @4|1 maj x0.375 @4|5 maj x0.25 @2|5 maj x0.125 @0|5 maj x0.25 @2|5 maj x0.125 @4|1 maj x0.375 @0|1 maj x0.25 @-5|1 maj x0.125 @-5|1 maj x0.25 @0|1 maj x0.125 @0|1 maj x0.25 @0|1 maj x0.125 @2|1 maj x0.375 @4|1 maj x0.25 @4|1 maj x0.125 @4|5 maj x0.25 @2|5 maj x0.125 @0|5 maj x0.25 @2|5 maj x0.125 @4|1 maj x0.625 @0"),
              P("Kids London Bridge", "1 maj x0.1875 @7|1 maj x0.0625 @9|1 maj x0.125 @7|1 maj x0.125 @5|1 maj x0.125 @4|1 maj x0.125 @5|1 maj x0.25 @7|5 maj x0.125 @2|5 maj x0.125 @4|5 maj x0.25 @5|1 maj x0.125 @4|1 maj x0.125 @5|1 maj x0.25 @7|1 maj x0.1875 @7|1 maj x0.0625 @9|1 maj x0.125 @7|1 maj x0.125 @5|1 maj x0.125 @4|1 maj x0.125 @5|1 maj x0.25 @7|5 maj x0.25 @2|5 maj x0.25 @7|1 maj x0.125 @4|1 maj x0.375 @0"),
              P("Kids Hey Diddle Diddle", "1 maj x0.125 @4|1 maj x0.125 @4|1 maj x0.125 @4|1 maj x0.125 @4|1 maj x0.125 @5|1 maj x0.125 @7|5 maj x0.125 @2|5 maj x0.125 @2|5 maj x0.125 @2|5 maj x0.125 @2|5 maj x0.125 @0|5 maj x0.125 @2|1 maj x0.25 @4|1 maj x0.125 @4|1 maj x0.125 @4|1 maj x0.125 @5|1 maj x0.125 @7|5 maj x0.625 @2|5 maj x0.125 @4|4 maj x0.125 @5|4 maj x0.125 @5|4 maj x0.125 @5|4 maj x0.25 @5|4 maj x0.125 @9|1 maj x0.25 @7|1 maj x0.125 @4|6 min x0.125 @0|6 min x0.125 @2|6 min x0.125 @4|1 maj x0.25 @-5|1 maj x0.125 @-5|5 maj x0.125 @-5|5 maj x0.125 @-3|5 maj x0.125 @-1|1 maj x0.75 @0"), // v110: public-domain swap
              P("Kids Head Shoulders Knees and Toes", "1 maj x0.5 @7|6 min x0.125 @9|1 maj x0.125 @7|5 maj x0.125 @5|1 maj x0.125 @7|1 maj x0.25 @4|1 maj x0.125 @7|1 maj x0.125 @7|1 maj x0.5 @7|1 maj x0.5 @7|6 min x0.125 @9|1 maj x0.125 @7|5 maj x0.125 @5|1 maj x0.125 @7|5 maj x0.25 @2|5 maj x0.125 @7|5 maj x0.125 @7|5 maj x0.25 @7|1 maj x0.25 @4|1 maj x0.25 @0|1 maj x0.25 @4|1 maj x0.25 @7|1 maj x0.25 @12|2 min x0.25 @14|5 maj x0.25 @11|4 maj x0.5 @9|5 maj x0.5 @11|5 maj x0.125 @11|5 maj x0.125 @7|5 maj x0.125 @9|5 maj x0.125 @11|1 maj x0.25 @12|1 maj x0.125 @0|1 maj x0.125 @0|1 maj x0.5 @0"),
              P("Kids Baa Baa Black Sheep", "1 maj x0.25 @0|1 maj x0.25 @0|1 maj x0.25 @7|1 maj x0.25 @7|4 maj x0.125 @9|5 maj x0.125 @11|4 maj x0.125 @12|4 maj x0.125 @9|1 maj x0.5 @7|4 maj x0.25 @5|4 maj x0.25 @5|1 maj x0.25 @4|1 maj x0.25 @4|5 maj x0.25 @2|5 maj x0.25 @2|1 maj x0.5 @0|1 maj x0.25 @7|1 maj x0.125 @7|1 maj x0.125 @7|4 maj x0.25 @5|4 maj x0.125 @5|4 maj x0.125 @5|1 maj x0.25 @4|1 maj x0.125 @4|1 maj x0.125 @4|5 maj x0.375 @2|5 maj x0.125 @2|1 maj x0.25 @7|1 maj x0.125 @7|1 maj x0.125 @7|4 maj x0.125 @5|4 maj x0.125 @7|4 maj x0.125 @9|4 maj x0.125 @5|1 maj x0.25 @4|5 maj x0.125 @2|5 maj x0.125 @2|1 maj x0.5 @0"),
              P("Kids Hickory Dickory Dock", "1 maj x0.125 @4|4 maj x0.125 @5|1 maj x0.125 @7|1 maj x0.125 @7|4 maj x0.125 @9|5 maj x0.125 @11|1 maj x0.625 @12|1 maj x0.125 @4|1 maj x0.25 @4|1 maj x0.125 @7|1 maj x0.25 @7|5 maj x0.125 @11|1 maj x0.625 @12|1 maj x0.125 @7|1 maj x0.25 @12|1 maj x0.125 @12|5 maj x0.25 @11|5 maj x0.125 @11|4 maj x0.25 @9|4 maj x0.125 @9|1 maj x0.375 @7|5 maj x0.125 @7|4 maj x0.125 @9|5 maj x0.125 @7|7 dim x0.125 @5|1 maj x0.125 @4|5 maj x0.125 @2|1 maj x0.75 @0")],
      minor: []   // v109: Sunny Day, Lullaby, Silly Walk, Spooky and Rainy Day removed; a minor key in Kids uses the major songs (progList) and goes back to the song's own key (progSync)
    },
    jazz: {
      major: [P("Jazz ii\u2013V\u2013I", "2 m7|5 7|1 maj7"), P("Jazz Turnaround", "1 maj7|6 m7|2 m7|5 7"),
              P("Jazz Blues", "1 7|4 7|1 7|1 7|4 7|4 7|1 7|6 7|2 m7|5 7|1 7|5 7"),
              P("Jazz Minor Blues", "1 m7|1 m7|1 m7|1 m7|4 m7|4 m7|1 m7|1 m7|b6 7|5 7|1 m7|5 7"),
              // 8-bar A section, two chords in a bar where shown: I vi | ii V | iii VI7 | ii V | I I7 | IV iv | I V | I
              P("Jazz Rhythm Changes", "1 maj7 x0.5|6 m7 x0.5|2 m7 x0.5|5 7 x0.5|3 m7 x0.5|6 7 x0.5|2 m7 x0.5|5 7 x0.5|1 maj7 x0.5|1 7 x0.5|4 maj7 x0.5|4 m7 x0.5|1 maj7 x0.5|5 7 x0.5|1 maj7"),
              P("Jazz Minor ii\u2013V\u2013i", "2 m7b5|5 7b9|1 m7"), P("Jazz Backdoor", "4 m7|b7 7|1 maj7"), P("Jazz Modal Vamp", "1 m9 x8|b2 m9 x8")],
      // Minor home: the major ii-V-I, the major 12-bar Blues and Rhythm Changes are skipped
      // (the minor ii-V-i, Minor Blues and the rest cover them).
      minor: [P("Jazz Turnaround", "1 m7|6 maj7|2 m7b5|5 7b9"),
              P("Jazz Minor Blues", "1 m7|1 m7|1 m7|1 m7|4 m7|4 m7|1 m7|1 m7|6 7|5 7|1 m7|5 7"),
              P("Jazz Minor ii\u2013V\u2013i", "2 m7b5|5 7b9|1 m7"), P("Jazz Backdoor", "4 m7|7 7|1 m7"), P("Jazz Modal Vamp", "1 m9 x8|b2 m9 x8")]
    },
    rnb: {
      major: [P("R&B Classic", "1 maj7|6 m7|4 maj7|5 7"), P("R&B ii\u2013V\u2013I", "2 m9|5 13|1 maj9|6 m9"), P("R&B Smooth", "1 maj9|3 m7|6 m9|2 m9|5 13"), P("R&B Slow Jam", "4 maj7|3 m7|2 m7|1 maj7")],
      minor: [P("R&B Classic", "1 m7|6 maj7|4 m7|5 7"), P("R&B ii\u2013V\u2013I", "2 m7b5|5 7#9|1 m9|6 maj9"), P("R&B Smooth", "1 m9|3 maj9|6 maj9|2 m7b5|5 7#9"), P("R&B Slow Jam", "4 m9|3 maj9|2 m7b5|1 m9")]
    },
    ballad: {
      major: [P("Ballad Classic", "1 maj|6 min|4 maj|5 maj"), P("Ballad Hymn", "1 maj|4 maj|1 over3|5 maj"), P("Ballad Big Finish", "4 maj|4 overV|3 min|6 min|2 min|5 maj|1 maj")],   // v109: "Ballad All I Ask" removed (the list is not saved; an old in-session index past the end falls back to 0 = Ballad Classic in progSync)
      minor: [P("Ballad Classic", "1 min|6 maj|4 min|5 maj"), P("Ballad Hymn", "1 min|4 min|1 mover3|5 maj"), P("Ballad Big Finish", "4 min|4 moverV|3 maj|6 maj|2 dim|5 maj|1 min")]
    },
    reggae: {
      major: [P("Reggae Island Skank", "1 maj|4 maj|5 maj|4 maj"), P("Reggae One Drop", "1 maj|b7 maj|4 maj|1 maj"), P("Reggae Minor Riddim", "1 min|4 min|5 min|4 min")],
      // Minor home: Island Skank becomes i-iv-v-iv, so Minor Riddim takes its minor-key form i-bVII.
      minor: [P("Reggae Island Skank", "1 min|4 min|5 min|4 min"), P("Reggae One Drop", "1 min|7 maj|4 min|1 min"), P("Reggae Minor Riddim", "1 min|7 maj")]
    },
    funk: {
      major: [P("Funk Vamp", "1 7|4 7"), P("Funk Minor Vamp", "1 m7|4 7"), P("Funk Breakdown", "1 9|b7 9|4 9|1 9")],
      minor: [P("Funk Vamp", "1 m7|4 m7"), P("Funk Minor Vamp", "1 m7|4 7"), P("Funk Breakdown", "1 m9|7 9|4 9|1 m9")]
    },
    yogaDeep: {
      major: [P("Yoga Drone", "1 sus2"), P("Yoga Open", "1 sus2|b7 sus2|4 sus2"), P("Yoga Still", "1 m9|b6 maj7|b7 6|1 m9")],
      minor: [P("Yoga Drone", "1 sus2"), P("Yoga Open", "1 sus2|7 sus2|4 sus2"), P("Yoga Still", "1 m9|6 maj7|7 6|1 m9")]
    },
    // v60 Country. The strip's V chip is V7, so V steps use it (one G7 chip, no extra dashed G).
    country: {
      major: [P("Country Three-Chord", "1 maj|1 maj|4 maj|1 maj|5 7|5 7|1 maj|1 maj"), P("Country Two-Step", "1 maj|4 maj|1 maj|5 7"),
              P("Country Swing", "1 maj|1 maj|2 7|2 7|5 7|5 7|1 maj|1 maj"), P("Country Modern", "1 maj|5 7|6 min|4 maj")],
      minor: [P("Country Outlaw", "1 min|7 maj|6 maj|7 maj"), P("Country Minor Three-Chord", "1 min|4 min|1 min|5 min"), P("Country Holler", "1 min|3 maj|7 maj|4 min")]
    }
  };
}
