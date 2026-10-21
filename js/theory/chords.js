// Chord intervals, tones, symbols, buildChord, bass note.
import { mod12, spellRoot, noteName, chordToneNames } from "./spelling.js?v=112.8";
import { voicedMidis, pitchClasses } from "./voicing.js?v=112.8";

export function normalizeExt(ext) {
  ext = ext || {};
  return {
    six: !!ext.six,
    min7: !!ext.min7,
    maj7: !!ext.maj7,
    nine: !!(ext.nine || ext["9"]),
    // v52: strip-only colours (style chip sets). sus2 replaces the 3rd;
    // flat9 / sharp9 are altered 9ths; thirteen adds the 13th (5th omitted);
    // over = slash bass, semitones above the root (IV/V -> 2).
    sus2: !!ext.sus2,
    flat9: !!ext.flat9,
    sharp9: !!ext.sharp9,
    thirteen: !!ext.thirteen,
    over: (typeof ext.over === "number" && ext.over > 0 && ext.over < 12) ? ext.over : 0
  };
}

export function chordIntervals(type, ext) {
  var base = {
    major: [0, 4, 7],
    minor: [0, 3, 7],
    sus4: [0, 5, 7],
    dim: [0, 3, 6]
  }[type];
  if (!base) throw new Error("unknown chord type " + type);
  var e = normalizeExt(ext);
  var iv = base.slice();
  var hasMaj7 = e.maj7;
  var hasMin7 = e.min7 && !hasMaj7;
  var has7 = hasMaj7 || hasMin7;
  if (e.sus2 && (type === "major" || type === "minor")) iv[1] = 2;
  if (e.six && !has7) iv.push(9);
  if (hasMin7) iv.push(10);
  if (hasMaj7) iv.push(11);
  if (e.flat9) iv.push(13);
  else if (e.nine || e.thirteen) iv.push(14);
  if (e.sharp9) iv.push(15);
  if (e.thirteen) { iv.push(21); if (has7) iv.splice(iv.indexOf(7), 1); }
  return iv;
}

export function tones(rootPc, type, ext) {
  return chordToneNames(spellRoot(rootPc), type, ext);
}

export function chordSymbol(rootName, type, ext) {
  var e = normalizeExt(ext);
  var hasMaj7 = e.maj7;
  var hasMin7 = e.min7 && !hasMaj7;
  var has7 = hasMaj7 || hasMin7;
  var nine = e.nine;
  var six = e.six && !has7;
  if (e.thirteen && hasMin7) return rootName + (type === "minor" ? "m13" : "13");
  if ((e.flat9 || e.sharp9) && hasMin7 && type === "major") return rootName + "7" + (e.flat9 ? "b9" : "") + (e.sharp9 ? "#9" : "");
  if (e.sus2 && (type === "major" || type === "minor")) {
    if (hasMaj7) return rootName + "maj7sus2";
    if (hasMin7) return rootName + "7sus2";
    return rootName + "sus2";
  }

  if (type === "sus4") {
    if (hasMaj7 && nine) return rootName + "maj9sus4";
    if (hasMin7 && nine) return rootName + "9sus";   // v53: same text as the chip
    if (nine && six) return rootName + "6sus4(add9)";
    if (nine) return rootName + "sus4(add9)";
    if (hasMaj7) return rootName + "maj7sus4";
    if (hasMin7) return rootName + "7sus4";
    if (six) return rootName + "6sus4";
    return rootName + "sus4";
  }

  if (hasMaj7 && nine) {
    if (type === "minor") return rootName + "m(maj9)";
    if (type === "dim") return rootName + "dim(maj9)";
    return rootName + "maj9";
  }
  if (hasMin7 && nine) {
    if (type === "minor") return rootName + "m9";
    if (type === "dim") return rootName + "m9b5";
    return rootName + "9";
  }
  if (nine) {
    if (six && type === "minor") return rootName + "m6(add9)";
    if (six && type === "dim") return rootName + "dim6(add9)";
    if (six) return rootName + "6(add9)";
    if (type === "minor") return rootName + "m(add9)";
    if (type === "dim") return rootName + "dim(add9)";
    return rootName + "add9";
  }
  if (hasMaj7) {
    if (type === "minor") return rootName + "m(maj7)";
    if (type === "dim") return rootName + "dim(maj7)";
    return rootName + "maj7";
  }
  if (hasMin7) {
    if (type === "minor") return rootName + "m7";
    if (type === "dim") return rootName + "m7b5";
    return rootName + "7";
  }
  if (six) {
    if (type === "minor") return rootName + "m6";
    if (type === "dim") return rootName + "dim6";
    return rootName + "6";
  }
  if (type === "minor") return rootName + "m";
  if (type === "dim") return rootName + "\u00b0";   // v60: B\u00b0, as on the chip
  if (type === "major") return rootName;
  throw new Error("unknown chord type " + type);
}

export function bassMidi(rootPc, rootMidiOpt) {
  if (typeof rootMidiOpt === "number" && isFinite(rootMidiOpt)) return rootMidiOpt - 24;
  return 60 + mod12(rootPc) - 24;
}

export function buildChord(opts) {
  opts = opts || {};
  var rootPc = mod12(opts.rootPc || 0);
  var type = opts.type || "major";
  var ext = normalizeExt(opts.extensions);
  var voicing = opts.voicing || "close";
  var rootSpell = opts.rootSpell || spellRoot(rootPc);
  var rootName = opts.rootName || noteName(rootSpell);
  var names = chordToneNames(rootSpell, type, ext);
  var rootMidi = (typeof opts.rootMidi === "number" && isFinite(opts.rootMidi)) ? opts.rootMidi : null;
  var midis = voicedMidis(rootPc, type, ext, voicing, rootMidi);
  return {
    rootPc: rootPc,
    rootName: rootName,
    rootSpell: rootSpell,
    type: type,
    extensions: ext,
    voicing: voicing,
    symbol: chordSymbol(rootName, type, ext) + (ext.over ? "/" + names[0] : ""),
    names: names,
    midis: midis,
    pcs: pitchClasses(midis),
    bassMidi: bassMidi(rootPc + ext.over, rootMidi == null ? null : rootMidi + ext.over)
  };
}
