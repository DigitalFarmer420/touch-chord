// Scale degrees, roman numerals, degree chords.
import { spellRoot, spellInterval } from "./spelling.js?v=112.11";

var DEGREE_STEPS = {
  0: 0,
  1: 1,
  2: 1,
  3: 2,
  4: 2,
  5: 3,
  6: 4,
  7: 4,
  8: 5,
  9: 5,
  10: 6,
  11: 6,
  13: 1,
  14: 1,
  15: 1,
  21: 5
};
export { DEGREE_STEPS };

var MAJOR_ROMAN = ["I", "ii", "iii", "IV", "V", "vi", "vii"];
var MINOR_ROMAN = ["i", "ii", "III", "iv", "v", "VI", "VII"];
var MAJOR_QUALITY = ["major", "minor", "minor", "major", "major", "minor", "dim"];
var MINOR_QUALITY = ["minor", "dim", "major", "minor", "minor", "major", "major"];
var MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
var MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];

export function scaleDegrees(keyPc, mode, rootSpellOpt) {
  var minor = mode === "minor" || mode === "natural-minor";
  var intervals = minor ? MINOR_SCALE : MAJOR_SCALE;
  var qualities = minor ? MINOR_QUALITY : MAJOR_QUALITY;
  var romans = minor ? MINOR_ROMAN : MAJOR_ROMAN;
  var root = rootSpellOpt || spellRoot(keyPc);
  return intervals.map(function (iv, i) {
    var spelled = spellInterval(root, iv);
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

export function degreeChord(keyPc, mode, degree, rootSpellOpt) {
  if (degree < 1 || degree > 7) throw new Error("degree out of range");
  var d = scaleDegrees(keyPc, mode, rootSpellOpt)[degree - 1];
  return {
    degree: d.degree,
    roman: d.roman,
    rootPc: d.pc,
    rootName: d.name,
    type: d.type,
    rootSpell: d.rootSpell
  };
}
