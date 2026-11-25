// Built-in progressions (PROGRESSIONS: every style + Kids songs) and their parsing.
import { keyDegrees } from "../keys.js?v=2026.11.23.4";
import { upInList, upSteps } from "./song.js?v=2026.11.23.4";
import { upProgObj } from "./upload.js?v=2026.11.23.4";
import { state, shared } from "../state.js?v=2026.11.23.4";
import { Theory } from "../theory/index.js?v=2026.11.23.4";
import { wrap12, blankExt } from "../theory/quality.js?v=2026.11.23.4";
import { accSym } from "../theory/spelling.js?v=2026.11.23.4";
import { STRIP_QUAL, plainRootSpell } from "../ui/strip.js?v=2026.11.23.4";
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
// Ranked menu, Noff v3.2 (final-menus-export-v3.2.json 51fd5585). PROGRESSIONS stays the full catalog.
// Each style and mode lists exactly these charts, most popular first, as one list with nothing below.
// A chart is [name, steps]. Its steps are a menu copy and do not write the source array.
// A family with no chart for a mode is left out of that mode. Kids has no entry and shows its songs.
var PROG_MENU = {
  pop: {
    major: [
      ["Pop Four-Chord", "1 maj|5 maj|6 min|4 maj"],
      ["Pop Turnaround", "1 maj|6 min|4 maj|5 maj"],
      ["Pop Oldies", "1 maj|6 min|2 min|5 maj"],
      ["Pop Electropop", "6 min|1 maj|4 maj|5 maj"],
      ["Pop Sensitive", "1 maj|5 maj|6 min|3 min"],
      ["Pop Plagal", "1 maj|4 maj|1 maj|5 maj"],
      ["Pop Climb", "4 maj|5 maj|3 min|6 min"],
      ["Pop Rock", "1 maj|b7 maj|4 maj|5 maj"],
      ["Pop Bounce", "1 maj|4 maj|6 min|5 maj"],
      ["Pop Garage", "1 maj|b7 maj|4 maj|b7 maj"],
      ["Pop Canon", "1 maj|5 maj|6 min|3 min|4 maj|5 maj"]
    ],
    minor: [
      ["Pop Four-Chord", "1 min|5 min|6 maj|4 min"],
      ["Pop Turnaround", "1 min|6 maj|4 min|5 maj"],
      ["Pop Electropop", "1 min|3 maj|6 maj|7 maj"],
      ["Pop Sensitive", "1 min|5 min|6 maj|3 maj"],
      ["Pop Axis", "1 min|6 maj|3 maj|7 maj"],
      ["Pop Plagal", "1 min|4 min|1 min|5 maj"],
      ["Pop Rock", "1 min|7 maj|6 maj|5 maj"],
      ["Pop Bounce", "1 min|4 min|6 maj|5 maj"],
      ["Pop Canon", "1 min|5 min|6 maj|3 maj|4 min|5 min"]
    ]
  },
  jazz: {
    major: [
      ["Jazz ii\u2013V\u2013I", "2 m7|5 7|1 maj7"],
      ["Jazz Turnaround", "1 maj7|6 m7|2 m7|5 7"],
      ["Jazz Blues", "1 7|4 7|5 7|1 7"],
      ["Jazz Leaves", "2 m7|5 7|1 maj7|4 maj7|7 m7b5|3 7|6 m7 x2"],
      ["Jazz Circle", "3 m7|6 m7|2 m7|5 7|1 maj7"],
      ["Jazz Backdoor", "4 m7|b7 7|1 maj7"],
      ["Jazz Lady", "2 m7|5 7|1 maj7|4 maj7|3 m7|6 7"],
      ["Jazz Slide", "2 m7|b2 7|1 maj7|6 m7"],
      ["Jazz Bossa", "1 maj7 x2|2 7 x2|2 m7|b2 7|1 maj7 x2"],
      ["Jazz Chain", "6 7|2 7|5 7|1 maj7"]
    ],
    minor: [
      ["Jazz Minor ii\u2013V\u2013i", "2 m7b5|5 7b9|1 m7"],
      ["Jazz Turnaround", "1 m7|6 maj7|2 m7b5|5 7b9"],
      ["Jazz Leaves", "4 m7|7 7|3 maj7|6 maj7|2 m7b5|5 7b9|1 m7 x2"],
      ["Jazz Circle", "5 m7|1 m7|4 m7|7 7|3 maj7"],
      ["Jazz Backdoor", "4 m7|7 7|1 m7"],
      ["Jazz Slide", "2 m7b5|b2 7|1 m7|4 m7"],
      ["Jazz Andalusian", "1 m7|7 maj7|6 maj7|5 7"],
      ["Jazz Minor Turn", "1 m7|4 m7|2 m7b5|5 7b9"],
      ["Jazz Bossa", "1 m7 x2|4 m7 x2|2 m7b5|5 7b9|1 m7 x2"],
      ["Jazz Modal Vamp", "1 m9 x2|4 m9 x2|b2 m9 x2|1 m9 x2"]
    ]
  },
  rnb: {
    major: [
      ["R&B DooWop", "1 maj|6 min|4 maj|5 maj"],
      ["R&B Classic", "1 maj7|6 m7|4 maj7|5 7"],
      ["R&B Neo", "2 m9|5 9|1 maj9|6 m9"],
      ["R&B Slow Jam", "4 maj7|3 m7|2 m7|1 maj7"],
      ["R&B Church", "4 maj9|3 m7|6 m9|2 m9|5 9sus|1 maj9"],
      ["R&B Quiet", "1 maj7|3 m7|4 maj7|5 7"],
      ["R&B Sway", "1 maj9|4 maj9|1 maj9|5 9"],
      ["R&B Ladder", "6 m7|5 7|4 maj7|3 m7"],
      ["R&B Smooth", "1 maj9|3 m7|6 m9|2 m9|5 13"]
    ],
    minor: [
      ["R&B DooWop", "1 min|6 maj|4 min|5 maj"],
      ["R&B Classic", "1 m7|6 maj7|4 m7|5 7"],
      ["R&B Slow Jam", "4 m9|3 maj9|2 m7b5|1 m9"],
      ["R&B Church", "6 maj9|7 13|1 m9|4 m9|5 7#9|1 m9"],
      ["R&B Float", "4 m9|7 13|3 maj9|6 maj9"],
      ["R&B Quiet", "1 m7|3 maj7|4 m7|5 7"],
      ["R&B Sway", "1 m9|4 m9|1 m9|5 9"],
      ["R&B Smooth", "1 m9|3 maj9|6 maj9|2 m7b5|5 7#9"],
      ["R&B Groove", "1 m9|7 13|6 maj9|5 m7"],
      ["R&B ii\u2013V\u2013I", "2 m7b5|5 7#9|1 m9|6 maj9"]
    ]
  },
  ballad: {
    major: [
      ["Ballad Axis", "6 min|4 maj|1 maj|5 maj"],
      ["Ballad 50s", "1 maj|6 min|4 maj|5 maj"],
      ["Ballad Steps", "1 add9|5 over3|6 m7|4 add9"],
      ["Ballad Piano", "1 maj|3 min|4 maj|5 maj"],
      ["Ballad Tender", "1 add9|4 add9|4 min|1 add9"],
      ["Ballad Rising", "4 maj|5 maj|3 min|6 min"],
      ["Ballad Home", "6 m7|2 m7|5 maj|1 add9"],
      ["Ballad Hymn", "1 maj|4 maj|1 over3|5 maj"],
      ["Ballad Gentle", "1 add9|3 min|6 m7|4 add9"],
      ["Ballad Big Finish", "4 maj|4 overV|3 min|6 min|2 min|5 maj|1 maj"]
    ],
    minor: [
      ["Ballad Axis", "1 min|6 maj|3 maj|7 maj"],
      ["Ballad 50s", "1 min|6 maj|4 min|5 maj"],
      ["Ballad Lament", "1 min|7 maj|6 maj|5 maj"],
      ["Ballad Steps", "1 m7|7 maj|6 add9|5 maj"],
      ["Ballad Piano", "1 min|3 maj|4 min|5 maj"],
      ["Ballad Tender", "1 m7|4 m7|1 m7|5 maj"],
      ["Ballad Rising", "4 min|5 maj|3 maj|6 maj"],
      ["Ballad Home", "6 add9|4 m7|5 maj|1 m7"],
      ["Ballad Hymn", "1 min|4 min|1 mover3|5 maj"],
      ["Ballad Gentle", "1 m7|3 add9|6 add9|7 maj"],
      ["Ballad Big Finish", "4 min|4 moverV|3 maj|6 maj|2 dim|5 maj|1 min"]
    ]
  },
  reggae: {
    major: [
      ["Reggae Island Skank", "1 maj|4 maj|5 maj|4 maj"],
      ["Reggae One Drop", "1 maj|b7 maj|4 maj|1 maj"],
      ["Reggae Lovers", "1 maj|6 min|4 maj|5 maj"],
      ["Reggae Easy", "1 maj|4 maj|5 maj|b7 maj"],
      ["Reggae Roots", "6 min|5 maj|4 maj|5 maj"],
      ["Reggae Rocksteady", "1 maj|5 maj|6 min|4 maj"],
      ["Reggae Sway", "1 maj|2 min|1 maj|4 maj"],
      ["Reggae Ska", "1 maj x0.5|6 min x0.5|2 min x0.5|5 maj x0.5"]
    ],
    minor: [
      ["Reggae Lovers", "1 min|6 maj|3 maj|7 maj"],
      ["Reggae Skank I", "1 min|4 min|5 maj|4 min"],
      ["Reggae Drop", "1 min|7 maj|4 min|1 min"],
      ["Reggae Easy", "6 maj|7 maj|1 min|4 min"],
      ["Reggae Roots", "1 min|7 maj|6 maj|7 maj"],
      ["Reggae Lover", "1 min|6 maj|4 min|5 maj"],
      ["Reggae Rocksteady", "1 min|5 maj|6 maj|4 min"],
      ["Reggae Sway", "1 min|2 m7|1 min|4 min"],
      ["Reggae Ska", "1 min x0.5|4 min x0.5|5 maj x0.5|1 min x0.5"],
      ["Reggae Minor Riddim", "1 min|4 min|5 min|4 min"]
    ]
  },
  funk: {
    major: [
      ["Funk OneFour", "1 9|4 9|1 9|5 9"],
      ["Funk Vamp", "1 7|4 7|1 7|5 7"],
      ["Funk Mixo", "1 9|b7 9|4 9|1 9"],
      ["Funk Strut", "1 9|b7 9|4 9|5 9"],
      ["Funk iiV", "2 m7|5 9|1 9|4 9"],
      ["Funk Chrome", "1 9|2 m7|4 9|5 9"],
      ["Funk Cool", "6 m7|2 m7|6 m7|5 9"],
      ["Funk Party", "1 9|4 9|5 9|4 9"]
    ],
    minor: [
      ["Funk OneFour", "1 m7|4 m7|1 m7|5 9"],
      ["Funk Dorian", "1 m7|4 7|1 m7|7 9"],
      ["Funk Strut", "1 m7|7 9|4 m7|5 9"],
      ["Funk Breakdown", "1 m9|7 9|4 9|1 m9"],
      ["Funk iiV", "2 m7b5|5 9|1 m7|4 m7"],
      ["Funk Chrome", "1 m7|2 m7b5|4 m7|5 9"],
      ["Funk Cool", "1 m7|3 maj7|4 m7|5 7#9"],
      ["Funk Party", "1 m7|6 maj7|7 9|1 m7"]
    ]
  },
  yogaDeep: {
    major: [
      ["Yoga Om", "1 sus2|4 sus2|1 sus2|5 sus2"],
      ["Yoga Path", "1 sus2|5 sus2|6 m7|4 sus2"],
      ["Yoga Open", "1 sus2|b7 sus2|4 sus2"],
      ["Yoga Rise", "4 sus2|5 sus2|1 sus2|6 m7"],
      ["Yoga Float", "1 sus2 x2|4 sus2 x2|5 sus2 x2|1 sus2 x2"],
      ["Yoga Breathe", "1 sus2 x2|1 add9 x2|4 sus2 x2|5 sus2 x2"],
      ["Yoga Moon", "2 m7 x2|5 sus2 x2|4 sus2 x2|1 sus2 x2"]
    ],
    minor: [
      ["Yoga Om", "1 m7|4 m7|1 m7|5 sus2"],
      ["Yoga Path", "1 m7|5 sus2|6 sus2|4 m7"],
      ["Yoga Open", "1 sus2|7 sus2|4 sus2"],
      ["Yoga Rise", "4 m7|5 sus2|1 m7|6 sus2"],
      ["Yoga Float", "1 m7 x2|4 m7 x2|5 sus2 x2|1 m7 x2"],
      ["Yoga Breathe", "1 m7 x2|1 m9 x2|4 m7 x2|5 sus2 x2"],
      ["Yoga Moon", "4 m7 x2|7 sus2 x2|3 sus2 x2|1 m7 x2"],
      ["Yoga Still", "1 m9|6 maj7|7 6|1 m9"],
      ["Yoga Glow", "6 sus2 x2|7 sus2 x2|1 m7 x4"],
      ["Yoga Sky", "1 m7 x2|3 sus2 x2|6 sus2 x2|7 sus2 x2"]
    ]
  },
  country: {
    major: [
      ["Country Three-Chord", "1 maj|4 maj|5 7|1 maj"],
      ["Country Story", "1 maj|6 min|4 maj|5 maj"],
      ["Country Wagon", "1 maj|5 maj|6 min|4 maj"],
      ["Country Train", "1 maj|4 maj|5 7|6 min"],
      ["Country Honky", "1 maj|4 maj|5 7|4 maj"],
      ["Country Ramble", "1 maj|b7 maj|4 maj|5 maj"],
      ["Country Rag", "1 maj|6 7|2 7|5 7"],
      ["Country Sunset", "1 maj|3 min|4 maj|5 7"],
      ["Country Two-Step", "1 maj|4 maj|1 maj|5 7"]
    ],
    minor: [
      ["Country Story", "1 min|6 maj|4 min|5 maj"],
      ["Country Outlaw", "1 min|7 maj|6 maj|7 maj"],
      ["Country Wagon", "1 min|5 maj|6 maj|4 min"],
      ["Country Classic", "1 min|4 min|5 maj|1 min"],
      ["Country Holler", "1 min|3 maj|7 maj|4 min"],
      ["Country Train", "1 min|4 min|5 7|7 maj"],
      ["Country Honky", "1 min|4 min|5 7|4 min"],
      ["Country Ramble", "1 min|4 maj|1 min|7 maj"],
      ["Country Hoedown", "1 min|7 maj|5 7|1 min"],
      ["Country Rag", "1 min|6 maj|2 dim|5 7"],
      ["Country Sunset", "1 min|3 maj|6 maj|5 7"],
      ["Country Minor Three-Chord", "1 min|4 min|1 min|5 min"]
    ]
  }
};
function progMenu(style, full, mode) {
  var m = PROG_MENU[style];
  if (!m) return full;
  return (m[mode] || []).map(function (e) { return P(e[0], e[1]); });
}
// The row to keep after the list changes: the same factory name, else the first row.
export function progIndexFor(list, name) {
  if (name) for (var i = 0; i < list.length; i++) if (!list[i].up && list[i].name === name) return i;
  return 0;
}
export function progList(style, mode) {
  var s = PROGRESSIONS[style] || PROGRESSIONS.pop;
  var l = s[mode === "minor" ? "minor" : "major"];
  if (!l || !l.length) l = s.major;   // v109: Kids has no minor songs any more
  var menuMode = mode === "minor" && l === s.minor ? "minor" : "major";
  l = progMenu(style, l, menuMode);   // factory menu only; a loaded song is still appended below and is not a factory family
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
const PROG_EXT_KEYS = ["six", "min7", "maj7", "nine", "sus2", "flat9", "sharp9", "thirteen", "over", "sharp5", "flat5"];   // v112.13
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
      major: [P("Pop Four-Chord", "1 maj|5 maj|6 min|4 maj"), P("Pop Minor Start", "6 min|4 maj|1 maj|5 maj"), P("Pop Turnaround", "1 maj|6 min|4 maj|5 maj"),
              P("Pop Oldies", "1 maj|6 min|2 min|5 maj"),
              P("Pop Canon", "1 maj|5 maj|6 min|3 min|4 maj|1 maj|4 maj|5 maj"),
              P("Pop Climb", "4 maj|5 maj|3 min|6 min"),
              P("Pop Rock", "1 maj|b7 maj|4 maj|4 maj"),
              P("Pop Bounce", "1 maj|4 maj|6 min|5 maj")],
      minor: [P("Pop Four-Chord", "1 min|5 min|6 maj|4 min"), P("Pop Minor Start", "6 maj|4 min|1 min|5 min"), P("Pop Turnaround", "1 min|6 maj|4 min|5 maj"),
              P("Pop Oldies", "1 min|6 maj|3 maj|7 maj"),
              P("Pop Canon", "1 min|5 min|6 maj|3 maj|4 min|1 min|4 min|5 maj"),
              P("Pop Climb", "6 maj|7 maj|1 min|1 min"),
              P("Pop Rock", "1 min|7 maj|6 maj|5 maj"),
              P("Pop Bounce", "1 min|4 min|6 maj|5 maj")]
    },
    // v97 Kids. One step = one sung note: "degree quality xBars @melody" (melody = semitones above the
    // key's tonic; xBars = note length, 0.25 = a quarter note at 4/4). The step's CHORD is the standard
    // harmonization under that note; Kids playback sounds the @melody note (no @ = the chord root, as before).
    // Minor degrees count from the minor home (natural minor), so VI and VII need no flat.
    kids: {
      // Kids redesign: the ten Kids songs, in this order (Twinkle first and the default). Row Your Boat keeps its v112.4 in-octave "merrily". Four new public-domain songs added after Mary's Lamb.
      major: [P("Kids Twinkle", "1 maj x0.25 @0|1 maj x0.25 @0|1 maj x0.25 @7|1 maj x0.25 @7|4 maj x0.25 @9|4 maj x0.25 @9|1 maj x0.5 @7|4 maj x0.25 @5|4 maj x0.25 @5|1 maj x0.25 @4|1 maj x0.25 @4|5 maj x0.25 @2|5 maj x0.25 @2|1 maj x0.5 @0|1 maj x0.25 @7|1 maj x0.25 @7|4 maj x0.25 @5|4 maj x0.25 @5|1 maj x0.25 @4|1 maj x0.25 @4|5 maj x0.5 @2|1 maj x0.25 @7|1 maj x0.25 @7|4 maj x0.25 @5|4 maj x0.25 @5|1 maj x0.25 @4|1 maj x0.25 @4|5 maj x0.5 @2|1 maj x0.25 @0|1 maj x0.25 @0|1 maj x0.25 @7|1 maj x0.25 @7|4 maj x0.25 @9|4 maj x0.25 @9|1 maj x0.5 @7|4 maj x0.25 @5|4 maj x0.25 @5|1 maj x0.25 @4|1 maj x0.25 @4|5 maj x0.25 @2|5 maj x0.25 @2|1 maj x0.5 @0"),
              P("Kids Old MacDonald", "1 maj x0.25 @0|1 maj x0.25 @0|1 maj x0.25 @0|1 maj x0.25 @7|4 maj x0.25 @9|4 maj x0.25 @9|1 maj x0.5 @7|1 maj x0.25 @4|1 maj x0.25 @4|5 maj x0.25 @2|5 maj x0.25 @2|1 maj x0.75 @0|1 maj x0.25 @7|1 maj x0.25 @0|1 maj x0.25 @0|1 maj x0.25 @0|1 maj x0.25 @7|4 maj x0.25 @9|4 maj x0.25 @9|1 maj x0.5 @7|1 maj x0.25 @4|1 maj x0.25 @4|5 maj x0.25 @2|5 maj x0.25 @2|1 maj x0.5 @0|1 maj x0.25 @7|1 maj x0.25 @7|1 maj x0.25 @0|1 maj x0.25 @0|1 maj x0.25 @0|1 maj x0.125 @7|1 maj x0.125 @7|1 maj x0.25 @0|1 maj x0.25 @0|1 maj x0.5 @0|1 maj x0.125 @0|1 maj x0.125 @0|1 maj x0.25 @0|1 maj x0.125 @0|1 maj x0.125 @0|1 maj x0.25 @0|1 maj x0.125 @0|1 maj x0.125 @0|1 maj x0.125 @0|1 maj x0.125 @0|1 maj x0.25 @0|1 maj x0.25 @0|1 maj x0.25 @0|1 maj x0.25 @0|1 maj x0.25 @0|1 maj x0.25 @7|4 maj x0.25 @9|4 maj x0.25 @9|1 maj x0.5 @7|1 maj x0.25 @4|1 maj x0.25 @4|5 maj x0.25 @2|5 maj x0.25 @2|1 maj x1 @0"),
              P("Kids Itsy Bitsy Spider", "1 maj x0.125 @-5|1 maj x0.25 @0|1 maj x0.125 @0|1 maj x0.25 @0|1 maj x0.125 @2|1 maj x0.375 @4|1 maj x0.25 @4|1 maj x0.125 @4|5 maj x0.25 @2|5 maj x0.125 @0|5 maj x0.25 @2|5 maj x0.125 @4|1 maj x0.75 @0|1 maj x0.375 @4|1 maj x0.25 @4|1 maj x0.125 @5|5 maj x0.375 @7|5 maj x0.375 @7|7 dim x0.25 @5|7 dim x0.125 @4|7 dim x0.25 @5|7 dim x0.125 @7|1 maj x0.75 @4|1 maj x0.375 @0|1 maj x0.25 @0|1 maj x0.125 @2|1 maj x0.375 @4|1 maj x0.375 @4|5 maj x0.25 @2|5 maj x0.125 @0|5 maj x0.25 @2|5 maj x0.125 @4|1 maj x0.375 @0|1 maj x0.25 @-5|1 maj x0.125 @-5|1 maj x0.25 @0|1 maj x0.125 @0|1 maj x0.25 @0|1 maj x0.125 @2|1 maj x0.375 @4|1 maj x0.25 @4|1 maj x0.125 @4|5 maj x0.25 @2|5 maj x0.125 @0|5 maj x0.25 @2|5 maj x0.125 @4|1 maj x0.625 @0"),
              P("Kids Row Your Boat", "1 maj x0.375 @0|1 maj x0.375 @0|1 maj x0.25 @0|1 maj x0.125 @2|1 maj x0.375 @4|1 maj x0.25 @4|1 maj x0.125 @2|1 maj x0.25 @4|1 maj x0.125 @5|1 maj x0.75 @7|1 maj x0.125 @0|1 maj x0.125 @0|1 maj x0.125 @0|1 maj x0.125 @7|1 maj x0.125 @7|1 maj x0.125 @7|1 maj x0.125 @4|1 maj x0.125 @4|1 maj x0.125 @4|1 maj x0.125 @0|1 maj x0.125 @0|1 maj x0.125 @0|5 maj x0.25 @7|5 maj x0.125 @5|5 maj x0.25 @4|5 maj x0.125 @2|1 maj x0.75 @0"),
              P("Kids Head Shoulders Knees and Toes", "1 maj x0.5 @7|6 min x0.125 @9|1 maj x0.125 @7|5 maj x0.125 @5|1 maj x0.125 @7|1 maj x0.25 @4|1 maj x0.125 @7|1 maj x0.125 @7|1 maj x0.5 @7|1 maj x0.5 @7|6 min x0.125 @9|1 maj x0.125 @7|5 maj x0.125 @5|1 maj x0.125 @7|5 maj x0.25 @2|5 maj x0.125 @7|5 maj x0.125 @7|5 maj x0.25 @7|1 maj x0.25 @4|1 maj x0.25 @0|1 maj x0.25 @4|1 maj x0.25 @7|1 maj x0.25 @12|2 min x0.25 @14|5 maj x0.25 @11|4 maj x0.5 @9|5 maj x0.5 @11|5 maj x0.125 @11|5 maj x0.125 @7|5 maj x0.125 @9|5 maj x0.125 @11|1 maj x0.25 @12|1 maj x0.125 @0|1 maj x0.125 @0|1 maj x0.5 @0"),
              P("Kids Mary's Lamb", "1 maj x0.25 @4|1 maj x0.25 @2|1 maj x0.25 @0|1 maj x0.25 @2|1 maj x0.25 @4|1 maj x0.25 @4|1 maj x0.5 @4|5 maj x0.25 @2|5 maj x0.25 @2|5 maj x0.5 @2|1 maj x0.25 @4|1 maj x0.25 @7|1 maj x0.5 @7|1 maj x0.25 @4|1 maj x0.25 @2|1 maj x0.25 @0|1 maj x0.25 @2|1 maj x0.25 @4|1 maj x0.25 @4|1 maj x0.25 @4|1 maj x0.25 @4|5 maj x0.25 @2|5 maj x0.25 @2|5 maj x0.25 @4|5 maj x0.25 @2|1 maj x1 @0"),
              P("Kids Happy Birthday", "1 maj x0.125 @-5|1 maj x0.125 @-5|1 maj x0.25 @-3|1 maj x0.25 @-5|1 maj x0.25 @0|5 7 x0.75 @-1|5 7 x0.125 @-5|5 7 x0.125 @-5|5 7 x0.25 @-3|5 7 x0.25 @-5|5 7 x0.25 @2|1 maj x0.75 @0|1 maj x0.125 @-5|1 maj x0.125 @-5|1 maj x0.25 @7|1 maj x0.25 @4|1 maj x0.25 @0|4 maj x0.25 @-1|4 maj x0.5 @-3|1 maj x0.125 @5|1 maj x0.125 @5|1 maj x0.25 @4|1 maj x0.25 @0|5 7 x0.25 @2|1 maj x0.75 @0"),
              P("Kids Jingle Bells", "1 maj x0.25 @4|1 maj x0.25 @4|1 maj x0.5 @4|1 maj x0.25 @4|1 maj x0.25 @4|1 maj x0.5 @4|1 maj x0.25 @4|1 maj x0.25 @7|1 maj x0.25 @0|1 maj x0.25 @2|1 maj x1 @4|4 maj x0.125 @5|4 maj x0.125 @5|4 maj x0.125 @5|4 maj x0.125 @5|1 maj x0.125 @5|1 maj x0.125 @4|1 maj x0.125 @4|1 maj x0.125 @4|1 maj x0.125 @4|2 7 x0.125 @4|2 7 x0.125 @2|2 7 x0.125 @2|2 7 x0.125 @4|5 7 x0.125 @2|5 7 x0.25 @7|1 maj x0.25 @4|1 maj x0.25 @4|1 maj x0.5 @4|1 maj x0.25 @4|1 maj x0.25 @4|1 maj x0.5 @4|1 maj x0.25 @4|1 maj x0.25 @7|1 maj x0.25 @0|1 maj x0.25 @2|1 maj x1 @4|4 maj x0.125 @5|4 maj x0.125 @5|4 maj x0.125 @5|4 maj x0.125 @5|1 maj x0.125 @5|1 maj x0.125 @4|1 maj x0.125 @4|1 maj x0.125 @4|1 maj x0.125 @4|1 maj x0.125 @7|1 maj x0.125 @7|5 7 x0.125 @5|5 7 x0.125 @2|1 maj x0.375 @0"),
              P("Kids London Bridge", "1 maj x0.1875 @7|1 maj x0.0625 @9|1 maj x0.125 @7|1 maj x0.125 @5|1 maj x0.125 @4|1 maj x0.125 @5|1 maj x0.25 @7|5 7 x0.125 @2|5 7 x0.125 @4|5 7 x0.25 @5|1 maj x0.125 @4|1 maj x0.125 @5|1 maj x0.25 @7|1 maj x0.1875 @7|1 maj x0.0625 @9|1 maj x0.125 @7|1 maj x0.125 @5|1 maj x0.125 @4|1 maj x0.125 @5|1 maj x0.25 @7|5 7 x0.25 @2|5 7 x0.25 @7|1 maj x0.125 @4|1 maj x0.375 @0"),
              P("Kids This Old Man", "1 maj x0.125 @7|1 maj x0.125 @4|1 maj x0.25 @7|1 maj x0.125 @7|1 maj x0.125 @4|1 maj x0.25 @7|4 maj x0.125 @9|4 maj x0.125 @7|4 maj x0.125 @5|4 maj x0.125 @4|4 maj x0.125 @2|4 maj x0.125 @4|5 7 x0.25 @5|1 maj x0.125 @4|1 maj x0.125 @5|1 maj x0.125 @7|1 maj x0.125 @0|1 maj x0.125 @0|1 maj x0.125 @0|1 maj x0.125 @0|1 maj x0.125 @0|1 maj x0.125 @2|1 maj x0.125 @4|1 maj x0.125 @5|5 7 x0.25 @7|5 7 x0.125 @7|5 7 x0.125 @2|5 7 x0.125 @2|5 7 x0.125 @5|5 7 x0.125 @4|5 7 x0.125 @2|1 maj x0.5 @0")],
      minor: []   // v109: Sunny Day, Lullaby, Silly Walk, Spooky and Rainy Day removed; a minor key in Kids uses the major songs (progList) and goes back to the song's own key (progSync)
    },
    jazz: {
      major: [P("Jazz ii\u2013V\u2013I", "2 m7|5 7|1 maj7"), P("Jazz Turnaround", "1 maj7|6 m7|2 m7|5 7"),
              P("Jazz Blues", "1 7|4 7|1 7|1 7|4 7|4 7|1 7|6 7|2 m7|5 7|1 7|5 7"),
              P("Jazz Minor Blues", "1 m7|1 m7|1 m7|1 m7|4 m7|4 m7|1 m7|1 m7|b6 7|5 7|1 m7|5 7"),
              // 8-bar A section, two chords in a bar where shown: I vi | ii V | iii VI7 | ii V | I I7 | IV iv | I V | I
              P("Jazz Rhythm Changes", "1 maj7 x0.5|6 m7 x0.5|2 m7 x0.5|5 7 x0.5|3 m7 x0.5|6 7 x0.5|2 m7 x0.5|5 7 x0.5|1 maj7 x0.5|1 7 x0.5|4 maj7 x0.5|4 m7 x0.5|1 maj7 x0.5|5 7 x0.5|1 maj7"),
              P("Jazz Minor ii\u2013V\u2013i", "2 m7b5|5 7b9|1 m7"), P("Jazz Backdoor", "4 m7|b7 7|1 maj7"), P("Jazz Modal Vamp", "1 m9 x8|b2 m9 x8"),
              P("Jazz Circle", "3 m7|6 m7|2 m7|5 7|1 maj7"),
              P("Jazz Leaves", "2 m7|5 7|1 maj7|4 maj7|7 m7b5|3 7|6 m7|6 m7"),
              P("Jazz Slide", "2 m7|b2 7|1 maj7|1 maj7"),
              P("Jazz Bossa", "1 maj7 x2|2 7 x2|2 m7|b2 7|1 maj7 x2"),
              P("Jazz Chain", "6 7|2 7|5 7|1 maj7")],
      // Minor home: the major ii-V-I, the major 12-bar Blues and Rhythm Changes are skipped
      // (the minor ii-V-i, Minor Blues and the rest cover them).
      minor: [P("Jazz Turnaround", "1 m7|6 maj7|2 m7b5|5 7b9"),
              P("Jazz Minor Blues", "1 m7|1 m7|1 m7|1 m7|4 m7|4 m7|1 m7|1 m7|6 7|5 7|1 m7|5 7"),
              P("Jazz Minor ii\u2013V\u2013i", "2 m7b5|5 7b9|1 m7"), P("Jazz Backdoor", "4 m7|7 7|1 m7"), P("Jazz Modal Vamp", "1 m9 x8|b2 m9 x8"),
              P("Jazz Circle", "5 m7|1 m7|4 m7|7 7|3 maj7"),
              P("Jazz Leaves", "4 m7|7 7|3 maj7|6 maj7|2 m7b5|5 7b9|1 m7|1 m7"),
              P("Jazz Slide", "2 m7b5|b2 7|1 m7|1 m7"),
              P("Jazz Bossa", "1 m7 x2|4 m7 x2|2 m7b5|5 7b9|1 m7 x2")]
    },
    rnb: {
      major: [P("R&B Classic", "1 maj7|6 m7|4 maj7|5 7"), P("R&B ii\u2013V\u2013I", "2 m9|5 13|1 maj9|6 m9"), P("R&B Smooth", "1 maj9|3 m7|6 m9|2 m9|5 13"), P("R&B Slow Jam", "4 maj7|3 m7|2 m7|1 maj7"),
              P("R&B Float", "2 m9|5 9sus|1 maj9|1 maj9"),
              P("R&B Sway", "1 maj9|4 maj9"),
              P("R&B Church", "4 maj9|5 13|3 m7|6 m9|2 m9|5 9sus|1 maj9"),
              P("R&B Groove", "1 maj9|b7 maj7|4 maj9|4 maj9"),
              P("R&B Glide", "4 maj9|3 7|6 m9|6 m9")],
      minor: [P("R&B Classic", "1 m7|6 maj7|4 m7|5 7"), P("R&B ii\u2013V\u2013I", "2 m7b5|5 7#9|1 m9|6 maj9"), P("R&B Smooth", "1 m9|3 maj9|6 maj9|2 m7b5|5 7#9"), P("R&B Slow Jam", "4 m9|3 maj9|2 m7b5|1 m9"),
              P("R&B Float", "4 m9|7 13|3 maj9|6 maj9"),
              P("R&B Sway", "1 m9|4 9"),
              P("R&B Church", "6 maj9|7 13|5 m7|1 m9|4 m9|5 7#9|1 m9"),
              P("R&B Groove", "1 m9|7 13|6 maj9|5 m7"),
              P("R&B Glide", "6 maj9|5 m7|1 m9|1 m9")]
    },
    ballad: {
      major: [P("Ballad Classic", "1 maj|6 min|4 maj|5 maj"), P("Ballad Hymn", "1 maj|4 maj|1 over3|5 maj"), P("Ballad Big Finish", "4 maj|4 overV|3 min|6 min|2 min|5 maj|1 maj"),
              P("Ballad Gentle", "1 add9|3 min|6 m7|4 add9"),
              P("Ballad Steps", "1 add9|5 over3|6 m7|4 add9"),
              P("Ballad Tender", "1 add9|4 add9|4 min|1 add9"),
              P("Ballad Home", "6 m7|2 m7|5 maj|1 add9"),
              P("Ballad Sunrise", "b7 maj|4 add9|1 add9|1 add9")],   // v109: "Ballad All I Ask" removed (the list is not saved; an old in-session index past the end falls back to 0 = Ballad Classic in progSync)
      minor: [P("Ballad Classic", "1 min|6 maj|4 min|5 maj"), P("Ballad Hymn", "1 min|4 min|1 mover3|5 maj"), P("Ballad Big Finish", "4 min|4 moverV|3 maj|6 maj|2 dim|5 maj|1 min"),
              P("Ballad Gentle", "1 m7|3 add9|6 add9|7 maj"),
              P("Ballad Steps", "1 m7|7 maj|6 add9|5 maj"),
              P("Ballad Tender", "1 m7|4 m7|1 m7|5 maj"),
              P("Ballad Home", "6 add9|4 m7|5 maj|1 m7"),
              P("Ballad Sunrise", "6 add9|7 maj|1 m7|1 m7")]
    },
    reggae: {
      major: [P("Reggae Island Skank", "1 maj|4 maj|5 maj|4 maj"), P("Reggae One Drop", "1 maj|b7 maj|4 maj|1 maj"), P("Reggae Minor Riddim", "1 min|4 min|5 min|4 min"),
              P("Reggae Sway", "1 maj|2 min"),
              P("Reggae Easy", "1 maj|1 maj|4 maj|4 maj"),
              P("Reggae Lovers", "1 maj|6 min|4 maj|5 maj"),
              P("Reggae Ska", "1 maj x0.5|6 min x0.5|2 min x0.5|5 maj x0.5"),
              P("Reggae Roots", "6 min|5 maj|4 maj|5 maj")],
      // Minor home: Island Skank becomes i-iv-v-iv, so Minor Riddim takes its minor-key form i-bVII.
      minor: [P("Reggae Island Skank", "1 min|4 min|5 min|4 min"), P("Reggae One Drop", "1 min|7 maj|4 min|1 min"), P("Reggae Minor Riddim", "1 min|7 maj"),
              P("Reggae Sway", "1 min|6 maj"),
              P("Reggae Easy", "6 maj|7 maj|1 min|1 min"),
              P("Reggae Lovers", "1 min|6 maj|3 maj|7 maj"),
              P("Reggae Ska", "1 min x0.5|4 min x0.5|5 maj x0.5|1 min x0.5"),
              P("Reggae Roots", "1 min|7 maj|6 maj|7 maj")]
    },
    funk: {
      major: [P("Funk Vamp", "1 7|4 7"), P("Funk Minor Vamp", "1 m7|4 7"), P("Funk Breakdown", "1 9|b7 9|4 9|1 9"),
              P("Funk Strut", "1 9|b7 9"),
              P("Funk Fuzz", "1 7#9|1 7#9|4 9|1 7#9"),
              P("Funk Two", "2 m7|5 9"),
              P("Funk Party", "1 9|4 9|5 9|4 9"),
              P("Funk Cool", "6 m7|2 m7|6 m7|5 9")],
      minor: [P("Funk Vamp", "1 m7|4 m7"), P("Funk Minor Vamp", "1 m7|4 7"), P("Funk Breakdown", "1 m9|7 9|4 9|1 m9"),
              P("Funk Strut", "1 m7|7 9"),
              P("Funk Fuzz", "1 m7|1 m7|5 7#9|1 m7"),
              P("Funk Two", "4 m7|7 9"),
              P("Funk Party", "1 m7|6 maj7|7 9|1 m7"),
              P("Funk Cool", "1 m7|3 maj7|4 m7|5 7#9")]
    },
    yogaDeep: {
      major: [P("Yoga Drone", "1 sus2"), P("Yoga Open", "1 sus2|b7 sus2|4 sus2"), P("Yoga Still", "1 m9|b6 maj7|b7 6|1 m9"),
              P("Yoga Breathe", "1 sus2 x2|1 sus4 x2"),
              P("Yoga Float", "1 sus2 x2|4 sus2 x2"),
              P("Yoga Glow", "6 m7 x2|4 sus2 x2|1 sus2 x2|5 sus2 x2"),
              P("Yoga Sky", "1 sus2 x2|5 sus2 x2|6 m7 x2|4 sus2 x2"),
              P("Yoga Moon", "2 m7 x2|1 sus2 x2")],
      minor: [P("Yoga Drone", "1 sus2"), P("Yoga Open", "1 sus2|7 sus2|4 sus2"), P("Yoga Still", "1 m9|6 maj7|7 6|1 m9"),
              P("Yoga Breathe", "1 m7 x2|1 sus4 x2"),
              P("Yoga Float", "1 m7 x2|4 m7 x2"),
              P("Yoga Glow", "6 sus2 x2|7 sus2 x2|1 m7 x4"),
              P("Yoga Sky", "1 m7 x2|3 sus2 x2|6 sus2 x2|7 sus2 x2"),
              P("Yoga Moon", "4 m7 x2|1 m7 x2")]
    },
    // v60 Country. The strip's V chip is V7, so V steps use it (one G7 chip, no extra dashed G).
    country: {
      major: [P("Country Three-Chord", "1 maj|1 maj|4 maj|1 maj|5 7|5 7|1 maj|1 maj"), P("Country Two-Step", "1 maj|4 maj|1 maj|5 7"),
              P("Country Swing", "1 maj|1 maj|2 7|2 7|5 7|5 7|1 maj|1 maj"), P("Country Modern", "1 maj|5 7|6 min|4 maj"),
              P("Country Porch", "1 maj|4 maj|5 7|1 maj"),
              P("Country Hoedown", "1 maj|4 maj|1 maj|5 7|1 maj|4 maj|5 7|1 maj"),
              P("Country Rag", "1 maj|6 7|2 7|5 7"),
              P("Country Sunset", "1 maj|3 min|4 maj|5 7"),
              P("Country Ramble", "1 maj|1 maj|b7 maj|4 maj")],
      minor: [P("Country Outlaw", "1 min|7 maj|6 maj|7 maj"), P("Country Minor Three-Chord", "1 min|4 min|1 min|5 min"), P("Country Holler", "1 min|3 maj|7 maj|4 min"),
              P("Country Porch", "1 min|4 min|5 7|1 min"),
              P("Country Hoedown", "1 min|7 maj|1 min|5 7|1 min|7 maj|5 7|1 min"),
              P("Country Rag", "1 min|6 maj|2 dim|5 7"),
              P("Country Sunset", "1 min|3 maj|6 maj|5 7"),
              P("Country Ramble", "1 min|4 maj|1 min|7 maj")]
    }
  };
}
