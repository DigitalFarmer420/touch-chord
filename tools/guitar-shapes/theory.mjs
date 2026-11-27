// Pitch-class theory matching Touch Chord 2026.11.24.1 (js/theory/chords.js, spelling.js, keys.js).
export const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
export const NATURAL = [0, 2, 4, 5, 7, 9, 11];
export const DEGREE_STEPS = {
  0: 0, 1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 4, 7: 4, 8: 5, 9: 5, 10: 6, 11: 6,
  13: 1, 14: 1, 15: 1, 21: 5
};
const ROOT_SPELL = [
  { li: 0, acc: 0 }, { li: 0, acc: 1 }, { li: 1, acc: 0 }, { li: 2, acc: -1 },
  { li: 2, acc: 0 }, { li: 3, acc: 0 }, { li: 3, acc: 1 }, { li: 4, acc: 0 },
  { li: 5, acc: -1 }, { li: 5, acc: 0 }, { li: 6, acc: -1 }, { li: 6, acc: 0 }
];
export const KEY_SPELLINGS = {
  major: [["C"], ["Db", "C#"], ["D"], ["Eb"], ["E"], ["F"], ["F#", "Gb"], ["G"], ["Ab"], ["A"], ["Bb"], ["B"]],
  minor: [["C"], ["C#"], ["D"], ["Eb", "D#"], ["E"], ["F"], ["F#"], ["G"], ["G#", "Ab"], ["A"], ["Bb", "A#"], ["B"]]
};
const MAJOR_ROMAN = ["I", "ii", "iii", "IV", "V", "vi", "vii"];
const MINOR_ROMAN = ["i", "ii", "III", "iv", "v", "VI", "VII"];
const MAJOR_QUALITY = ["major", "minor", "minor", "major", "major", "minor", "dim"];
const MINOR_QUALITY = ["minor", "dim", "major", "minor", "minor", "major", "major"];
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];

export function wrap12(n) { return ((n % 12) + 12) % 12; }
export const mod12 = wrap12;

function accStr(acc) {
  if (acc === 0) return "";
  if (acc === 1) return "#";
  if (acc === -1) return "b";
  if (acc === 2) return "x";
  if (acc === -2) return "bb";
  if (acc > 2) return "#".repeat(acc);
  return "b".repeat(-acc);
}

export function spellRoot(pc) {
  const s = ROOT_SPELL[wrap12(pc)];
  return { li: s.li, acc: s.acc };
}
export function noteName(root) { return LETTERS[root.li] + accStr(root.acc); }
export function spellFromName(n) {
  const li = LETTERS.indexOf(String(n).charAt(0));
  if (li < 0) return null;
  let acc = 0;
  for (let i = 1; i < n.length; i++) {
    if (n.charAt(i) === "#") acc++;
    else if (n.charAt(i) === "b") acc--;
  }
  return { li, acc };
}
export function namePc(n) {
  const sp = spellFromName(n);
  return sp ? wrap12(NATURAL[sp.li] + sp.acc) : -1;
}
export function spellInterval(root, semitones, stepsOpt) {
  const steps = stepsOpt != null ? stepsOpt : DEGREE_STEPS[semitones];
  if (steps == null) throw new Error("unsupported interval " + semitones);
  const li = (root.li + steps) % 7;
  const naturalPc = NATURAL[li];
  const target = wrap12((NATURAL[root.li] + root.acc) + semitones);
  let acc = target - naturalPc;
  if (acc > 6) acc -= 12;
  if (acc < -6) acc += 12;
  return { li, acc, pc: target, name: LETTERS[li] + accStr(acc) };
}

export function normalizeExt(ext) {
  ext = ext || {};
  return {
    six: !!ext.six,
    min7: !!ext.min7,
    maj7: !!ext.maj7,
    nine: !!(ext.nine || ext["9"]),
    sus2: !!ext.sus2,
    flat9: !!ext.flat9,
    sharp9: !!ext.sharp9,
    thirteen: !!ext.thirteen,
    sharp5: !!ext.sharp5,
    flat5: !!ext.flat5 && !ext.sharp5,
    over: (typeof ext.over === "number" && ext.over > 0 && ext.over < 12) ? ext.over : 0
  };
}

export function chordIntervals(type, ext) {
  const base = { major: [0, 4, 7], minor: [0, 3, 7], sus4: [0, 5, 7], dim: [0, 3, 6] }[type];
  if (!base) throw new Error("unknown chord type " + type);
  const e = normalizeExt(ext);
  const iv = base.slice();
  const hasMaj7 = e.maj7;
  const hasMin7 = e.min7 && !hasMaj7;
  const has7 = hasMaj7 || hasMin7;
  if (e.sus2 && (type === "major" || type === "minor")) iv[1] = 2;
  if ((e.sharp5 || e.flat5) && iv[2] === 7) iv[2] = e.sharp5 ? 8 : 6;
  if (e.six && !has7) iv.push(9);
  if (hasMin7) iv.push(10);
  if (hasMaj7) iv.push(11);
  if (e.flat9) iv.push(13);
  else if (e.nine || e.thirteen) iv.push(14);
  if (e.sharp9) iv.push(15);
  if (e.thirteen) {
    iv.push(21);
    if (has7 && !(e.sharp5 || e.flat5)) iv.splice(iv.indexOf(7), 1);
  }
  return iv;
}

export function chordSymbol(rootName, type, ext) {
  const e = normalizeExt(ext);
  if (e.sharp5 || e.flat5) {
    const pe = Object.assign({}, e, { sharp5: false, flat5: false });
    const ps = chordSymbol(rootName, type, pe);
    if (e.sharp5 && type === "major" && ps === rootName) return rootName + "aug";
    if (e.sharp5 && type === "major" && ps === rootName + "7") return rootName + "aug7";
    return ps + (ps === rootName ? "(" + (e.sharp5 ? "#5" : "b5") + ")" : (e.sharp5 ? "#5" : "b5"));
  }
  const hasMaj7 = e.maj7;
  const hasMin7 = e.min7 && !hasMaj7;
  const has7 = hasMaj7 || hasMin7;
  const nine = e.nine;
  const six = e.six && !has7;
  if (e.thirteen && hasMin7) return rootName + (type === "minor" ? "m13" : "13");
  if ((e.flat9 || e.sharp9) && hasMin7 && type === "major") return rootName + "7" + (e.flat9 ? "b9" : "") + (e.sharp9 ? "#9" : "");
  if (e.sus2 && (type === "major" || type === "minor")) {
    if (hasMaj7) return rootName + "maj7sus2";
    if (hasMin7) return rootName + "7sus2";
    return rootName + "sus2";
  }
  if (type === "sus4") {
    if (hasMaj7 && nine) return rootName + "maj9sus4";
    if (hasMin7 && nine) return rootName + "9sus";
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
    if (type === "dim") return rootName + "dim7"; // app label is dim6; charts use dim7 for the same tones
    return rootName + "6";
  }
  if (type === "minor") return rootName + "m";
  if (type === "dim") return rootName + "°";
  if (type === "major") return rootName;
  throw new Error("unknown chord type " + type);
}

export function fullSymbol(rootName, type, ext, bassName) {
  const e = normalizeExt(ext);
  let s = chordSymbol(rootName, type, e);
  if (bassName) s += "/" + bassName;
  else if (e.over) s += "/" + spellInterval(spellFromName(rootName) || spellRoot(0), e.over).name;
  return s;
}

export function scaleDegrees(keyPc, mode, rootSpellOpt) {
  const minor = mode === "minor" || mode === "natural-minor";
  const intervals = minor ? MINOR_SCALE : MAJOR_SCALE;
  const qualities = minor ? MINOR_QUALITY : MAJOR_QUALITY;
  const romans = minor ? MINOR_ROMAN : MAJOR_ROMAN;
  const root = rootSpellOpt || spellRoot(keyPc);
  return intervals.map((iv, i) => {
    const spelled = spellInterval(root, iv);
    return {
      degree: i + 1,
      roman: romans[i],
      pc: spelled.pc,
      name: spelled.name,
      type: qualities[i],
      rootSpell: { li: spelled.li, acc: spelled.acc }
    };
  });
}

export function plainRootSpell(pc, rs) {
  const odd = Math.abs(rs.acc) >= 2 ||
    (rs.acc === -1 && (rs.li === 0 || rs.li === 3)) ||
    (rs.acc === 1 && (rs.li === 2 || rs.li === 6));
  if (!odd) return rs;
  const nat = [0, -1, 1, -1, 2, 3, -1, 4, -1, 5, -1, 6][wrap12(pc)];
  return nat >= 0 ? { li: nat, acc: 0 } : spellRoot(pc);
}

export function defaultKeyName(pc, mode) {
  return KEY_SPELLINGS[mode === "minor" ? "minor" : "major"][wrap12(pc)][0];
}

// Required / allowed pitch classes for a guitar-shape check.
export function toneSets(rootPc, type, ext, bassPc) {
  const e = normalizeExt(ext);
  const ivs = chordIntervals(type, e);
  const allowed = new Set(ivs.map((iv) => wrap12(rootPc + iv)));
  if (bassPc != null && bassPc !== undefined) allowed.add(wrap12(bassPc));
  if (e.over) allowed.add(wrap12(rootPc + e.over));
  const must = [];
  const bass = (bassPc != null && bassPc !== undefined) ? wrap12(bassPc) : null;
  must.push({ pc: rootPc, role: "root" });
  // 3rd or sus tone
  if (e.sus2 && (type === "major" || type === "minor")) must.push({ pc: wrap12(rootPc + 2), role: "sus2" });
  else if (type === "sus4") must.push({ pc: wrap12(rootPc + 5), role: "sus4" });
  else if (type === "minor" || type === "dim") must.push({ pc: wrap12(rootPc + 3), role: "b3" });
  else must.push({ pc: wrap12(rootPc + 4), role: "3" });
  const hasMaj7 = e.maj7;
  const hasMin7 = e.min7 && !hasMaj7;
  if (hasMaj7) must.push({ pc: wrap12(rootPc + 11), role: "maj7" });
  if (hasMin7) must.push({ pc: wrap12(rootPc + 10), role: "b7" });
  if (e.six && !hasMaj7 && !hasMin7) must.push({ pc: wrap12(rootPc + 9), role: "6" });
  if (e.flat9) must.push({ pc: wrap12(rootPc + 13), role: "b9" });
  else if (e.nine || e.thirteen) must.push({ pc: wrap12(rootPc + 14), role: "9" });
  if (e.sharp9) must.push({ pc: wrap12(rootPc + 15), role: "#9" });
  if (e.thirteen) must.push({ pc: wrap12(rootPc + 21), role: "13" });
  if (e.sharp5) must.push({ pc: wrap12(rootPc + 8), role: "#5" });
  if (e.flat5 || type === "dim") must.push({ pc: wrap12(rootPc + 6), role: "b5" });
  return { allowed, must, bass, rootPc: wrap12(rootPc), ext: e, type };
}

export function formatFrets(frets) {
  return frets.map((f) => (f < 0 ? "x" : String(f))).join("");
}
export function formatFingers(fingers) {
  return fingers.map((f) => (f <= 0 ? "x" : String(f))).join(""); // display: 0 shown as 0 below
}
export function formatFingers0(fingers) {
  return fingers.map((f) => (f < 0 ? "x" : String(f))).join("");
}
