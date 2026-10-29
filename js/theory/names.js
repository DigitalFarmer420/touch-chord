// Enharmonic / clean root spellings used by the UI.
import { Theory } from "./index.js?v=112.13";
import { wrap12 } from "./quality.js?v=112.13";

// The other single-accidental spelling of a root (E\u266d <-> D\u266f), or null.
export function enharmonicSpell(rootPc, rs) {
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
export function plainToneName(n) {
  if (!/bb|##|x/.test(n)) return n;
  var pc = wrap12({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[n.charAt(0)] + (n.split("#").length - 1) + 2 * (n.split("x").length - 1) - (n.split("b").length - 1));
  var sharp = /#|x/.test(n);
  return (sharp ? ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] : ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"])[pc];
}
export function hasDoubleAcc(names) {
  // v52: Theory writes a double sharp as "x" (Fx); treat it like ## / bb.
  for (var i = 0; i < names.length; i++) if (/bb|##|x/.test(names[i])) return true;
  return false;
}
