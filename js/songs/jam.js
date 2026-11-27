// Jam extras: the chords offered beside a loaded song. Pure (no DOM).
// A later idea, not built here: context-aware "best next moves" from the chord that is sounding.
import { keyRootSpell } from "../keys.js?v=2026.11.27.9";
import { scaleDegrees } from "../theory/keys.js?v=2026.11.27.9";
import { wrap12, blankExt } from "../theory/quality.js?v=2026.11.27.9";
import { spellRoot, noteName } from "../theory/spelling.js?v=2026.11.27.9";

export const JAM_CAP = 6;
var EXT_KEYS = ["six", "min7", "maj7", "nine", "sus2", "flat9", "sharp9", "thirteen", "over", "sharp5", "flat5"];

// Root plus basic triad family. G7 and Gsus4 are the same family as G; Am7 is the same family as Am.
export function chordFamily(item) {
  if (!item) return "";
  var t = item.type, e = item.extensions || {};
  if (t === "sus4" || t === "sus2" || e.sus2) return "major";
  if (t === "minor") return "minor";
  if (t === "dim") return "dim";
  if (t === "major") return "major";
  return t || "";
}

export function sameSongChord(a, b) {
  if (!a || !b || wrap12(a.rootPc) !== wrap12(b.rootPc) || a.type !== b.type) return false;
  var ea = a.extensions || {}, eb = b.extensions || {};
  for (var i = 0; i < EXT_KEYS.length; i++) {
    var k = EXT_KEYS[i];
    if ((ea[k] || 0) !== (eb[k] || 0)) return false;
  }
  return true;
}

// The song's own chords, exact matches folded, in order of first appearance.
export function songChordList(steps) {
  var out = [];
  (steps || []).forEach(function (s) {
    var it = s && s.item ? s.item : s;
    if (!it || it.rootPc == null || it.rootPc < 0) return;
    for (var i = 0; i < out.length; i++) if (sameSongChord(out[i], it)) return;
    out.push(it);
  });
  return out;
}

function songHasFamily(song, pc, family) {
  pc = wrap12(pc);
  for (var i = 0; i < song.length; i++) if (wrap12(song[i].rootPc) === pc && chordFamily(song[i]) === family) return true;
  return false;
}

function degsOf(key) {
  // The key's own spelling (Db, Gb), not the sharp chromatic name of the same pitch.
  return scaleDegrees(key.pc, key.mode === "minor" ? "minor" : "major", keyRootSpell(key));
}

function spellPc(degs, pc) {
  pc = wrap12(pc);
  for (var i = 0; i < degs.length; i++) if (degs[i].pc === pc) return degs[i].name;
  for (var j = 0; j < degs.length; j++) if (degs[j].pc === wrap12(pc + 1)) {
    var rs = degs[j].rootSpell;
    return noteName({ li: rs.li, acc: rs.acc - 1 });
  }
  for (var k = 0; k < degs.length; k++) if (degs[k].pc === wrap12(pc - 1)) {
    var rs2 = degs[k].rootSpell;
    return noteName({ li: rs2.li, acc: rs2.acc + 1 });
  }
  return noteName(spellRoot(pc));
}

// Half-column of a root on the scale strip (same rule as the chord grid).
export function rootHc(key, pc) {
  var notes = degsOf(key).slice().sort(function (a, b) { return a.pc - b.pc; });
  pc = wrap12(pc);
  for (var i = 0; i < notes.length; i++) if (notes[i].pc === pc) return 1 + 2 * i;
  var below = 0;
  for (var j = 0; j < notes.length; j++) if (notes[j].pc < pc) below++;
  return 2 * below;
}

function extOf(min7) {
  var e = blankExt();
  if (min7) e.min7 = true;
  return e;
}

function symOf(root, type, min7) {
  if (type === "minor") return root + "m";
  if (type === "sus4") return root + "sus4";
  if (type === "dim") return root + "dim";
  if (min7) return root + "7";
  return root;
}

function make(key, degs, pc, type, min7, kind, degree) {
  var root = spellPc(degs, pc);
  var family = type === "minor" ? "minor" : type === "dim" ? "dim" : "major";
  var row = type === "minor" ? "sad"
    : type === "sus4" || type === "dim" ? "tension"
    : (kind === "secdom" || kind === "bVII") ? "bright"
    : "happy";
  return {
    sym: symOf(root, type, min7),
    rootPc: wrap12(pc),
    rootName: root,
    type: type,
    extensions: extOf(min7),
    family: family,
    kind: kind,
    degree: degree || 0,
    row: row,
    hc: rootHc(key, pc)
  };
}

// bVI / bIII in a major key, and anything diminished or augmented, stay out.
function forbidden(key, pc, type) {
  if (type === "dim") return true;
  if (key.mode === "minor") return false;
  var p = wrap12(pc);
  return p === wrap12(key.pc + 3) || p === wrap12(key.pc + 8);
}

function push(out, song, chord) {
  if (!chord || forbidden(keyOf(chord), chord.rootPc, chord.type)) return;
  if (songHasFamily(song, chord.rootPc, chord.family)) return;
  for (var i = 0; i < out.length; i++) if (sameSongChord(out[i], chord)) return;
  out.push(chord);
}
var keyOf = function () { return { pc: 0, mode: "major" }; };

// Every Jam candidate, best first. No cap: the grid keeps the first ones it can place.
export function jamRank(key, song) {
  song = song || [];
  key = { pc: wrap12(key && key.pc != null ? key.pc : 0), mode: key && key.mode === "minor" ? "minor" : "major" };
  keyOf = function () { return key; };
  var degs = degsOf(key), out = [], minor = key.mode === "minor";
  if (!minor) {
    [6, 2, 3, 4, 5, 1].forEach(function (deg) {
      var d = degs[deg - 1];
      push(out, song, make(key, degs, d.pc, d.type === "minor" ? "minor" : "major", false, "diatonic", deg));
    });
  } else {
    [4, 5, 3].forEach(function (deg) {
      var d = degs[deg - 1];
      push(out, song, make(key, degs, d.pc, d.type === "minor" ? "minor" : "major", false, "diatonic", deg));
    });
    var v = degs[4];
    push(out, song, make(key, degs, v.pc, "major", true, "V7", 5));
    push(out, song, make(key, degs, degs[6].pc, "major", false, "bVII", 7));
    push(out, song, make(key, degs, degs[5].pc, "major", false, "bVI", 6));
  }
  var targets = [], seen = {};
  song.forEach(function (s, i) {
    var fam = chordFamily(s);
    if (fam !== "major" && fam !== "minor") return;
    var id = wrap12(s.rootPc) + fam;
    if (seen[id]) { seen[id].n++; return; }
    seen[id] = { pc: wrap12(s.rootPc), n: 1, i: i };
    targets.push(seen[id]);
  });
  targets.sort(function (a, b) { return b.n - a.n || a.i - b.i; });
  targets.forEach(function (t) {
    push(out, song, make(key, degs, wrap12(t.pc + 7), "major", true, "secdom", 0));
  });
  if (!minor) {
    var iv = degs[3];
    push(out, song, make(key, degs, iv.pc, "minor", false, "iv", 4));
    var seven = degs[6];
    push(out, song, make(key, degs, wrap12(seven.pc - 1), "major", false, "bVII", 7));
  }
  var susV = degs[4], susI = degs[0];
  push(out, song, make(key, degs, susV.pc, "sus4", false, "sus", 5));
  push(out, song, make(key, degs, susI.pc, "sus4", false, "sus", 1));
  return out;
}

// Song grid only while a song is the current chart, and never in Kids.
export function songGridOn(ctx) {
  ctx = ctx || {};
  if (ctx.kids || ctx.kv || ctx.style === "kids") return false;
  return !!ctx.song;
}

export function jamExtras(key, song, limit) {
  var all = jamRank(key, song);
  if (limit == null) limit = JAM_CAP;
  return all.slice(0, limit);
}

// Place ranked extras into the grid. An extra that matches a pad already there uses that pad.
// Otherwise it needs the empty cell of its root in its family's row; a taken cell is skipped
// and the next ranked chord is tried. `limit` counts pads actually placed.
export function takeJam(ranked, occupied, limit) {
  if (limit == null) limit = JAM_CAP;
  var occ = (occupied || []).map(function (o) { return { row: o.row, hc: o.hc, item: o.item || null }; });
  var out = [];
  function taken(row, hc) {
    for (var i = 0; i < occ.length; i++) if (occ[i].row === row && Math.abs(occ[i].hc - hc) < 2) return true;
    return false;
  }
  for (var i = 0; i < ranked.length && out.length < limit; i++) {
    var c = ranked[i], hit = null;
    for (var k = 0; k < occ.length; k++) if (occ[k].item && sameSongChord(occ[k].item, c)) { hit = occ[k]; break; }
    if (hit) { out.push(c); continue; }
    if (taken(c.row, c.hc)) continue;
    out.push(c);
    occ.push({ row: c.row, hc: c.hc, item: c });
  }
  return out;
}
