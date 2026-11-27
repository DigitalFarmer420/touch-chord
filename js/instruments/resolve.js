// Resolver: an instrument profile plus an app chord
// ({ rootPc, type, extensions }, the same object buildChord takes)
// becomes an ordered list of playable voicings. Easiest first: a curated open
// grip for that exact chord, then movable E, A and D shapes at the lowest
// fret, then a search of the board when the library has nothing. The lowest
// sounding note is the root, or the slash bass, on every grip. A grip the
// search builds never mutes a string in the middle. A library grip is used
// as written, even when it mutes one on purpose. No DOM.

import { getInstrument } from "./profiles.js?v=2026.11.27.8";
import { shapesFor } from "./shapes.js?v=2026.11.27.8";
import { normalizeExt, chordIntervals, buildChord } from "../theory/chords.js?v=2026.11.27.8";
import { mod12 } from "../theory/spelling.js?v=2026.11.27.8";

var ROLE = {
  0: "root", 2: "2", 3: "3", 4: "3", 5: "4", 6: "b5", 7: "5", 8: "#5",
  9: "6", 10: "b7", 11: "7", 13: "b9", 14: "9", 15: "#9", 21: "13"
};

function analyze(chord) {
  var type = chord.type || "major";
  var ext = normalizeExt(chord.extensions);
  var root = mod12(chord.rootPc || 0);
  var ivs = chordIntervals(type, ext);
  var built = buildChord({
    rootPc: root, type: type, extensions: ext,
    rootSpell: chord.rootSpell, rootName: chord.rootName
  });
  var labels = [];
  var nameAt = 0;
  if (ext.over) {
    labels.push({ pc: mod12(root + ext.over), name: built.names[0], role: "bass", optional: false });
    nameAt = 1;
  }
  for (var i = 0; i < ivs.length; i++) {
    var iv = ivs[i];
    labels.push({
      pc: mod12(root + iv),
      name: built.names[nameAt + i],
      role: ROLE[iv] || String(iv),
      optional: iv === 7
    });
  }
  var allowed = new Set();
  var required = new Set();
  for (var L = 0; L < labels.length; L++) {
    allowed.add(labels[L].pc);
    if (!labels[L].optional) required.add(labels[L].pc);
  }
  var bassPc = ext.over ? mod12(root + ext.over) : root;
  allowed.add(bassPc);
  required.add(bassPc);
  required.add(root);
  var hasThird = false, thirdPc = null, hasSeventh = false, seventhPc = null;
  for (var k = 0; k < ivs.length; k++) {
    if (ivs[k] === 3 || ivs[k] === 4) { hasThird = true; thirdPc = mod12(root + ivs[k]); }
    if (ivs[k] === 10 || ivs[k] === 11) { hasSeventh = true; seventhPc = mod12(root + ivs[k]); }
  }
  return {
    root: root, type: type, ext: ext, ivs: ivs, labels: labels,
    allowed: allowed, required: required, bassPc: bassPc,
    hasThird: hasThird, thirdPc: thirdPc, hasSeventh: hasSeventh, seventhPc: seventhPc
  };
}

function handSpan(frets) {
  var min = null, max = null;
  for (var i = 0; i < frets.length; i++) {
    var f = frets[i];
    if (f > 0) {
      if (min == null || f < min) min = f;
      if (max == null || f > max) max = f;
    }
  }
  return min == null ? 0 : max - min + 1;
}

function fingerCount(fingers) {
  var seen = {};
  var n = 0;
  for (var i = 0; i < fingers.length; i++) {
    var f = fingers[i];
    if (f > 0 && !seen[f]) { seen[f] = true; n++; }
  }
  return n;
}

function fretKey(frets) {
  var s = "";
  for (var i = 0; i < frets.length; i++) s += frets[i] == null ? "x" : String(frets[i]) + ".";
  return s;
}

function copyBarres(barres) {
  var out = [];
  for (var i = 0; i < barres.length; i++) {
    var b = barres[i];
    out.push({ finger: b.finger, fret: b.fret, fromString: b.fromString, toString: b.toString });
  }
  return out;
}

function compactFingers(fingers, barres) {
  var used = [];
  for (var i = 0; i < fingers.length; i++) {
    if (fingers[i] > 0 && used.indexOf(fingers[i]) < 0) used.push(fingers[i]);
  }
  used.sort(function (a, b) { return a - b; });
  var map = {};
  for (var u = 0; u < used.length; u++) map[used[u]] = u + 1;
  var nf = fingers.map(function (f) { return f > 0 ? map[f] : 0; });
  var nb = barres.map(function (b) {
    return { finger: map[b.finger] || b.finger, fret: b.fret, fromString: b.fromString, toString: b.toString };
  });
  return { fingers: nf, barres: nb };
}

function pcsOf(profile, frets) {
  var set = new Set();
  for (var i = 0; i < frets.length; i++) {
    if (frets[i] == null) continue;
    set.add(mod12(profile.tuning[i] + frets[i]));
  }
  return set;
}

function subsetOk(pcs, info) {
  for (var pc of pcs) if (!info.allowed.has(pc)) return false;
  return true;
}

function completeOk(pcs, info) {
  for (var pc of info.required) if (!pcs.has(pc)) return false;
  return true;
}

function lowest(profile, frets) {
  var midi = Infinity, index = -1, pc = null;
  for (var i = 0; i < frets.length; i++) {
    if (frets[i] == null) continue;
    var m = profile.tuning[i] + frets[i];
    if (m < midi) { midi = m; index = i; pc = mod12(m); }
  }
  return { midi: midi, index: index, pc: pc };
}

function soundingCount(frets) {
  var n = 0;
  for (var i = 0; i < frets.length; i++) if (frets[i] != null) n++;
  return n;
}

function withinLimits(profile, frets, fingers) {
  return handSpan(frets) <= profile.maxSpan && fingerCount(fingers) <= profile.maxFingers;
}

// One finger per fretted string, except a barre: the lowest fret, when two or
// more strings play it and no open string sits between them, is one finger,
// and adjacent strings at the same higher fret share a finger too.
function assignFingers(frets, maxFingers) {
  var n = frets.length;
  var fingers = [];
  for (var z = 0; z < n; z++) fingers.push(0);
  var played = [];
  for (var i = 0; i < n; i++) if (frets[i] > 0) played.push(i);
  if (!played.length) return { fingers: fingers, barres: [], count: 0 };
  var barres = [];
  var next = 1;
  var assigned = {};
  var minF = frets[played[0]];
  for (var p = 1; p < played.length; p++) if (frets[played[p]] < minF) minF = frets[played[p]];
  var atMin = [];
  for (var a = 0; a < played.length; a++) if (frets[played[a]] === minF) atMin.push(played[a]);
  if (atMin.length >= 2) {
    var from = atMin[0], to = atMin[atMin.length - 1], blocked = false;
    for (var s = from; s <= to; s++) if (frets[s] === 0) blocked = true;
    if (!blocked) {
      barres.push({ fret: minF, fromString: from, toString: to, finger: next });
      for (var m = 0; m < atMin.length; m++) { fingers[atMin[m]] = next; assigned[atMin[m]] = true; }
      next++;
    }
  }
  var rest = [];
  for (var r = 0; r < played.length; r++) if (!assigned[played[r]]) rest.push(played[r]);
  var iR = 0;
  while (iR < rest.length) {
    var j = iR;
    while (j + 1 < rest.length && rest[j + 1] === rest[j] + 1 && frets[rest[j + 1]] === frets[rest[iR]]) j++;
    if (next > maxFingers) return null;
    var finger = next++;
    for (var k = iR; k <= j; k++) fingers[rest[k]] = finger;
    if (rest[j] > rest[iR]) barres.push({ fret: frets[rest[iR]], fromString: rest[iR], toString: rest[j], finger: finger });
    iR = j + 1;
  }
  if (next - 1 > maxFingers) return null;
  return { fingers: fingers, barres: barres, count: next - 1 };
}

function droppedNames(info, pcs) {
  var out = [], seen = {};
  for (var i = 0; i < info.labels.length; i++) {
    var label = info.labels[i];
    if (pcs.has(label.pc) || seen[label.name]) continue;
    seen[label.name] = true;
    out.push(label.name);
  }
  return out;
}

function finish(profile, frets, fingers, barres, baseFret, shapeName, rootPc, simplified, dropped) {
  var midi = [], rootStrings = [];
  for (var i = 0; i < frets.length; i++) {
    if (frets[i] == null) continue;
    var m = profile.tuning[i] + frets[i];
    midi.push(m);
    if (mod12(m) === rootPc) rootStrings.push(i);
  }
  midi.sort(function (a, b) { return a - b; });
  return {
    instrumentId: profile.id,
    frets: frets.slice(),
    fingers: fingers.slice(),
    barres: copyBarres(barres),
    baseFret: baseFret,
    shapeName: shapeName,
    rootStrings: rootStrings,
    simplified: !!simplified,
    dropped: dropped ? dropped.slice() : [],
    midi: midi
  };
}

function minFret(frets) {
  var min = null;
  for (var i = 0; i < frets.length; i++) if (frets[i] > 0 && (min == null || frets[i] < min)) min = frets[i];
  return min == null ? 0 : min;
}

function easeKey(frets, fingers) {
  // Lowest place on the neck first. A two-finger grip at fret 11 must not
  // beat a playable grip that starts at fret 2.
  return [minFret(frets), fingerCount(fingers), -soundingCount(frets)];
}

function absRel(rel, position) {
  if (rel == null) return null;
  if (typeof rel === "string") {
    var drop = parseInt(rel.slice(1), 10) || 1;
    var below = position - drop;
    return below < 0 ? -1 : below;
  }
  return rel + position;
}

function placeMovable(shape, position, profile) {
  var frets = [];
  for (var i = 0; i < shape.frets.length; i++) {
    var abs = absRel(shape.frets[i], position);
    if (abs != null && abs < 0) return null;
    if (abs != null && abs > profile.frets) return null;
    frets.push(abs);
  }
  var fingers = shape.fingers.slice();
  var barres = copyBarres(shape.barres);
  for (var b = 0; b < barres.length; b++) barres[b].fret += position;
  if (position === 0) {
    for (var s = 0; s < frets.length; s++) if (frets[s] === 0) fingers[s] = 0;
    var kept = [];
    for (var k = 0; k < barres.length; k++) if (barres[k].fret !== 0) kept.push(barres[k]);
    var compacted = compactFingers(fingers, kept);
    fingers = compacted.fingers;
    barres = compacted.barres;
  }
  return {
    frets: frets,
    fingers: fingers,
    barres: barres,
    baseFret: windowBase(frets),
    shapeName: shape.name,
    position: position,
    from: "movable"
  };
}

function positionsFor(shape, root, profile) {
  var openPc = mod12(profile.tuning[shape.rootString]);
  var pos = mod12(root - openPc - (shape.rootFret || 0));
  var maxRel = 0;
  for (var i = 0; i < shape.frets.length; i++) if (shape.frets[i] != null && shape.frets[i] > maxRel) maxRel = shape.frets[i];
  var out = [];
  while (pos <= profile.frets - maxRel) {
    out.push(pos);
    pos += 12;
  }
  return out;
}

function windowBase(frets) {
  var hasOpen = false, low = null, high = 0;
  for (var i = 0; i < frets.length; i++) {
    var f = frets[i];
    if (f === 0) hasOpen = true;
    if (f > 0) {
      if (low == null || f < low) low = f;
      if (f > high) high = f;
    }
  }
  if (low == null) return 1;
  if (hasOpen && high <= 4) return 1;
  return low;
}

// A mute with a sounding string on both sides cannot be strummed. Mutes
// before the first sounding string, or after the last, are fine.
function hasInnerMute(frets) {
  var first = -1, last = -1;
  for (var i = 0; i < frets.length; i++) {
    if (frets[i] != null) {
      if (first < 0) first = i;
      last = i;
    }
  }
  if (first < 0) return false;
  for (var s = first; s <= last; s++) if (frets[s] == null) return true;
  return false;
}

// The shape table's quality key for an app chord. Slash bass is not part of
// the key: C/E is still major, with the bass checked separately.
function qualityKey(type, ext) {
  var e = ext || {};
  var hasMaj7 = !!e.maj7;
  var hasMin7 = !!e.min7 && !hasMaj7;
  var nine = !!e.nine;
  var six = !!e.six && !hasMaj7 && !hasMin7;
  if (e.thirteen && hasMin7) return type === "minor" ? "m13" : "13";
  if (e.flat9 && hasMin7 && type === "major") return "7b9";
  if (e.sharp9 && hasMin7 && type === "major") return "7#9";
  if (e.sharp5 && type === "major" && hasMin7) return "aug7";
  if (e.sharp5 && type === "major" && hasMaj7) return "maj7#5";
  if (e.sharp5 && type === "major") return "aug";
  if (e.flat5 && type === "major" && hasMin7) return "7b5";
  if (e.flat5 && type === "major") return "majb5";
  if (e.sus2 && (type === "major" || type === "minor")) {
    if (hasMaj7) return "maj7sus2";
    if (hasMin7) return "7sus2";
    return "sus2";
  }
  if (type === "sus4") {
    if (hasMin7 && nine) return "9sus";
    if (hasMaj7) return "maj7sus4";
    if (hasMin7) return "7sus4";
    if (six) return "6sus4";
    if (nine) return "sus4add9";
    return "sus4";
  }
  if (hasMaj7 && nine) return type === "minor" ? "mmaj9" : "maj9";
  if (hasMin7 && nine) return type === "minor" ? "m9" : type === "dim" ? "m9b5" : "9";
  if (nine) {
    if (six && type === "minor") return "m69";
    if (six) return "69";
    if (type === "minor") return "madd9";
    if (type === "dim") return "dimAdd9";
    return "add9";
  }
  if (hasMaj7) return type === "minor" ? "mmaj7" : type === "dim" ? "dimMaj7" : "maj7";
  if (hasMin7) return type === "minor" ? "m7" : type === "dim" ? "m7b5" : "7";
  if (six) return type === "minor" ? "m6" : type === "dim" ? "dim7" : "6";
  if (type === "minor") return "min";
  if (type === "dim") return "dim";
  return "maj";
}

function familyName(name) {
  return name === "E-shape" || name === "A-shape" || name === "D-shape";
}

function nameRank(name) {
  if (name === "E-shape") return 0;
  if (name === "A-shape") return 1;
  if (name === "D-shape") return 2;
  return 3;
}

function bassOk(profile, frets, info) {
  // Re-entrant tunings (ukulele) do not put the root on the lowest MIDI note.
  if (!monotonic(profile.tuning)) return true;
  return lowest(profile, frets).pc === info.bassPc;
}

function keepGrip(a, b) {
  var pos = Math.max(a.position || 0, b.position || 0);
  if (pos > 0 && (familyName(a.shapeName) || familyName(b.shapeName))) {
    var fam = familyName(b.shapeName) ? b : a;
    var open = a.from === "open" ? a : b.from === "open" ? b : fam;
    return {
      frets: open.frets, fingers: open.fingers, barres: open.barres,
      baseFret: windowBase(open.frets), shapeName: fam.shapeName,
      position: fam.position, from: fam.from
    };
  }
  var chosen = a.from === "open" ? a : b.from === "open" ? b : a;
  chosen.baseFret = windowBase(chosen.frets);
  return chosen;
}

function gripFromFrets(profile, frets, shapeName, position, from) {
  for (var i = 0; i < frets.length; i++) {
    if (frets[i] != null && (frets[i] < 0 || frets[i] > profile.frets)) return null;
  }
  var assigned = assignFingers(frets, profile.maxFingers);
  if (!assigned || !withinLimits(profile, frets, assigned.fingers)) return null;
  return {
    frets: frets, fingers: assigned.fingers, barres: assigned.barres,
    baseFret: windowBase(frets), shapeName: shapeName, position: position, from: from
  };
}

// Slash chords that are not in the open list: the E-shape of the upper chord
// with the named bass on the bottom. A full barre is listed beside the
// inner-muted form so a strum can use the one with no mute in the middle.
function slashFormulas(profile, info) {
  if (!monotonic(profile.tuning) || profile.tuning.length < 6) return [];
  var R = mod12(info.root - mod12(profile.tuning[0]));
  var rel = mod12(info.bassPc - info.root);
  var specs = [];
  if (info.type === "major") {
    if (rel === 4 && R >= 1) specs.push([null, R - 1, R + 2, R + 1, R, R]);
    if (rel === 4 && R === 0) specs.push([4, 2, 2, 1, 0, 0]);
    if (rel === 2) {
      specs.push([R + 2, null, R + 2, R + 1, R, R]);
      specs.push([R + 2, R + 2, R + 2, R + 1, R, R]);
    }
    if (rel === 7) specs.push([null, R + 2, R + 2, R + 1, R, R]);
  }
  if (info.type === "minor") {
    if (rel === 3) specs.push([R + 3, null, R + 2, R, R, R]);
    if (rel === 2) specs.push([R + 2, null, R + 2, R, R, R]);
    if (rel === 7) specs.push([null, R + 2, R + 2, R, R, R]);
  }
  var out = [];
  for (var i = 0; i < specs.length; i++) {
    var low = null;
    for (var s = 0; s < specs[i].length; s++) if (specs[i][s] > 0 && (low == null || specs[i][s] < low)) low = specs[i][s];
    out.push(gripFromFrets(profile, specs[i], "E-shape", low || 0, "slash"));
  }
  return out;
}

function placeBassUnder(placed, profile, info) {
  var out = [];
  for (var s = 0; s <= 3 && s < profile.tuning.length; s++) {
    var f = mod12(info.bassPc - mod12(profile.tuning[s]));
    while (f <= profile.frets) {
      var frets = placed.frets.slice();
      for (var i = 0; i < s; i++) frets[i] = null;
      frets[s] = f;
      var low = null;
      for (var k = 0; k < frets.length; k++) if (frets[k] > 0 && (low == null || frets[k] < low)) low = frets[k];
      out.push(gripFromFrets(profile, frets, placed.shapeName, low || 0, "slash"));
      f += 12;
    }
  }
  return out;
}

function libraryVoicings(profile, info) {
  var lib = shapesFor(profile.id);
  var q = qualityKey(info.type, info.ext);
  var seen = {};
  var plain = [];
  var list = [];
  function accept(placed) {
    if (!placed) return;
    if (placed.frets.length !== profile.tuning.length) return;
    if (!withinLimits(profile, placed.frets, placed.fingers)) return;
    if (!bassOk(profile, placed.frets, info)) return;
    var pcs = pcsOf(profile, placed.frets);
    if (!subsetOk(pcs, info) || !completeOk(pcs, info)) return;
    var key = fretKey(placed.frets);
    if (seen[key]) seen[key] = keepGrip(seen[key], placed);
    else seen[key] = placed;
  }
  for (var o = 0; o < lib.open.length; o++) {
    var shape = lib.open[o];
    if (shape.quality && shape.quality !== q) continue;
    if (shape.rootPc != null && shape.rootPc !== info.root) continue;
    if (shape.bassPc != null && shape.bassPc !== info.bassPc) continue;
    var openPlaced = {
      frets: shape.frets.slice(),
      fingers: shape.fingers.slice(),
      barres: copyBarres(shape.barres),
      baseFret: windowBase(shape.frets),
      shapeName: shape.name || "Open",
      position: 0,
      from: "open"
    };
    if (shape.bassPc == null) plain.push(openPlaced);
    if (shape.quality && shape.bassPc == null && info.bassPc !== info.root) continue;
    accept(openPlaced);
  }
  for (var m = 0; m < lib.movable.length; m++) {
    var mov = lib.movable[m];
    if (mov.quality && mov.quality !== q) continue;
    if (mov.frets.length !== profile.tuning.length) continue;
    var spots = positionsFor(mov, info.root, profile);
    for (var s = 0; s < spots.length; s++) {
      var moved = placeMovable(mov, spots[s], profile);
      if (moved) plain.push(moved);
      accept(moved);
    }
  }
  if (info.bassPc !== info.root) {
    var formulas = slashFormulas(profile, info);
    for (var f = 0; f < formulas.length; f++) accept(formulas[f]);
    for (var u = 0; u < plain.length; u++) {
      var under = placeBassUnder(plain[u], profile, info);
      for (var p = 0; p < under.length; p++) accept(under[p]);
    }
  }
  for (var id in seen) list.push(seen[id]);
  list.sort(function (a, b) {
    var ao = a.from === "open" ? 0 : 1, bo = b.from === "open" ? 0 : 1;
    if (ao !== bo) return ao - bo;
    if (a.position !== b.position) return a.position - b.position;
    return nameRank(a.shapeName) - nameRank(b.shapeName);
  });
  var out = [];
  for (var i = 0; i < list.length; i++) {
    out.push(finish(profile, list[i].frets, list[i].fingers, list[i].barres, list[i].baseFret, list[i].shapeName, info.root, false, []));
  }
  return out;
}

function candidatesFor(profile, info) {
  var all = [];
  for (var s = 0; s < profile.tuning.length; s++) {
    var list = [null];
    var open = profile.tuning[s];
    for (var f = 0; f <= profile.frets; f++) if (info.allowed.has(mod12(open + f))) list.push(f);
    all.push(list);
  }
  return all;
}

function monotonic(tuning) {
  for (var i = 1; i < tuning.length; i++) if (tuning[i] < tuning[i - 1]) return false;
  return true;
}

function generate(profile, info) {
  var n = profile.tuning.length;
  var cands = candidatesFor(profile, info);
  var mono = monotonic(profile.tuning);
  var frets = new Array(n);
  var completes = [];
  var partials = [];
  var seen = {};

  function consider() {
    var snap = frets.slice();
    if (soundingCount(snap) < 2) return;
    if (hasInnerMute(snap)) return;
    var low = lowest(profile, snap);
    if (low.pc !== info.bassPc) return;
    var pcs = pcsOf(profile, snap);
    if (!subsetOk(pcs, info)) return;
    var assigned = assignFingers(snap, profile.maxFingers);
    if (!assigned) return;
    if (!withinLimits(profile, snap, assigned.fingers)) return;
    var key = fretKey(snap);
    if (seen[key]) return;
    seen[key] = true;
    var lowFret = minFret(snap);
    var hasOpen = false, highFret = 0;
    for (var i = 0; i < snap.length; i++) {
      if (snap[i] === 0) hasOpen = true;
      if (snap[i] > highFret) highFret = snap[i];
    }
    // Nut diagrams start at fret 1. A grip that also uses open strings stays on
    // the nut when every fretted note is inside the first four frets.
    var base = (!hasOpen) ? (lowFret || 1) : (highFret <= 4 ? 1 : (lowFret || 1));
    var item = {
      frets: snap,
      fingers: assigned.fingers,
      barres: assigned.barres,
      baseFret: base,
      ease: easeKey(snap, assigned.fingers),
      pcs: pcs
    };
    if (completeOk(pcs, info)) completes.push(item);
    else partials.push(item);
  }

  function dfs(si, sounded, minF, maxF) {
    if (si === n) { consider(); return; }
    var list = cands[si];
    for (var c = 0; c < list.length; c++) {
      var f = list[c];
      if (f == null) {
        frets[si] = null;
        dfs(si + 1, sounded, minF, maxF);
        continue;
      }
      var pc = mod12(profile.tuning[si] + f);
      if (mono && !sounded && pc !== info.bassPc) continue;
      var nMin = minF, nMax = maxF;
      if (f > 0) {
        nMin = minF == null ? f : Math.min(minF, f);
        nMax = maxF == null ? f : Math.max(maxF, f);
        if (nMax - nMin + 1 > profile.maxSpan) continue;
      }
      frets[si] = f;
      dfs(si + 1, true, nMin, nMax);
    }
  }
  dfs(0, false, null, null);

  function byEase(a, b) {
    for (var i = 0; i < a.ease.length; i++) if (a.ease[i] !== b.ease[i]) return a.ease[i] - b.ease[i];
    return 0;
  }
  if (completes.length) {
    completes.sort(byEase);
    var out = [];
    var take = Math.min(6, completes.length);
    for (var i = 0; i < take; i++) {
      var g = completes[i];
      out.push(finish(profile, g.frets, g.fingers, g.barres, g.baseFret, "Generated", info.root, false, []));
    }
    return out;
  }

  // Simplest playable grip: keep the root and the 3rd (a sus chord has no 3rd),
  // and drop the fewest other required tones. The bass note stays on the bottom.
  var best = null, bestRank = null;
  for (var p = 0; p < partials.length; p++) {
    var part = partials[p];
    if (!part.pcs.has(info.root)) continue;
    if (info.hasThird && !part.pcs.has(info.thirdPc)) continue;
    var missing = 0;
    for (var req of info.required) if (!part.pcs.has(req)) missing++;
    var rank = [missing, info.hasSeventh && !part.pcs.has(info.seventhPc) ? 1 : 0].concat(part.ease);
    var better = best == null;
    if (!better) {
      for (var r = 0; r < rank.length; r++) if (rank[r] !== bestRank[r]) { better = rank[r] < bestRank[r]; break; }
    }
    if (better) { best = part; bestRank = rank; }
  }
  if (!best) return [];
  var names = droppedNames(info, best.pcs);
  return [finish(profile, best.frets, best.fingers, best.barres, best.baseFret, "Generated", info.root, true, names)];
}

function resolveVoicings(instrument, chord) {
  var profile = typeof instrument === "string" ? getInstrument(instrument) : instrument;
  if (!profile || !profile.tuning) throw new Error("unknown instrument");
  var info = analyze(chord || {});
  var found = libraryVoicings(profile, info);
  if (found.length) return found;
  return generate(profile, info);
}

export { resolveVoicings, handSpan, fingerCount };
