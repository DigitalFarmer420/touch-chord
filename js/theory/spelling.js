// Note letters, spelling of roots / intervals / chord tones, accSym (display accidentals).
import { normalizeExt, chordIntervals } from "./chords.js?v=112.9";
import { DEGREE_STEPS } from "./keys.js?v=112.9";

// v49: display-only accidentals. "Bb" -> "B♭", "F#" -> "F♯", "m7b5" -> "m7♭5".
// Internal names stay ASCII; call this only where text is shown.
export function accSym(s) {
return String(s == null ? "" : s)
  .replace(/([A-G])x/g, "$1\u266f\u266f")
  .replace(/([A-G])(bb|##|b|#)/g, function (m, l, a) { return l + a.replace(/b/g, "\u266d").replace(/#/g, "\u266f"); })
  .replace(/(\d|\()b(\d)/g, "$1\u266d$2")
  .replace(/(\d|\()#(\d)/g, "$1\u266f$2");
}
var LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
var NATURAL = [0, 2, 4, 5, 7, 9, 11];

// Preferred chromatic spellings: C C# D Eb E F F# G Ab A Bb B
var ROOT_SPELL = [
  { li: 0, acc: 0 },
  { li: 0, acc: 1 },
  { li: 1, acc: 0 },
  { li: 2, acc: -1 },
  { li: 2, acc: 0 },
  { li: 3, acc: 0 },
  { li: 3, acc: 1 },
  { li: 4, acc: 0 },
  { li: 5, acc: -1 },
  { li: 5, acc: 0 },
  { li: 6, acc: -1 },
  { li: 6, acc: 0 }
];

export function mod12(n) {
  return ((n % 12) + 12) % 12;
}

function accStr(acc) {
  if (acc === 0) return "";
  if (acc === 1) return "#";
  if (acc === -1) return "b";
  if (acc === 2) return "x";
  if (acc === -2) return "bb";
  if (acc > 2) return new Array(acc + 1).join("#");
  return new Array(-acc + 1).join("b");
}

export function spellRoot(pc) {
  var s = ROOT_SPELL[mod12(pc)];
  return { li: s.li, acc: s.acc };
}

function rootPitchClass(root) {
  return mod12(NATURAL[root.li] + root.acc);
}

export function noteName(root) {
  return LETTERS[root.li] + accStr(root.acc);
}

export function spellInterval(root, semitones) {
  var steps = DEGREE_STEPS[semitones];
  if (steps == null) throw new Error("unsupported interval " + semitones);
  var li = (root.li + steps) % 7;
  var naturalPc = NATURAL[li];
  var target = mod12(rootPitchClass(root) + semitones);
  var acc = target - naturalPc;
  if (acc > 6) acc -= 12;
  if (acc < -6) acc += 12;
  return { li: li, acc: acc, pc: target, name: LETTERS[li] + accStr(acc) };
}

// An altered 9th that would need a double accidental (A\u266f\u266f in G\u266f7\u266f9) is
// written as its single-accidental enharmonic (B), the usual chart spelling.
function spellTone(rootSpell, iv) {
  var t = spellInterval(rootSpell, iv);
  if ((iv === 13 || iv === 15) && Math.abs(t.acc) > 1) {
    var li = (t.li + (t.acc > 0 ? 1 : 6)) % 7;
    var acc = t.pc - NATURAL[li];
    if (acc > 6) acc -= 12;
    if (acc < -6) acc += 12;
    t = { li: li, acc: acc, pc: t.pc, name: LETTERS[li] + accStr(acc) };
  }
  return t;
}

export function chordToneNames(rootSpell, type, ext) {
  var e = normalizeExt(ext);
  var names = chordIntervals(type, e).map(function (iv) {
    return spellTone(rootSpell, iv).name;
  });
  if (e.over) names.unshift(spellInterval(rootSpell, e.over).name);
  return names;
}

var NOTE_NAMES = ROOT_SPELL.map(function (s) { return noteName(s); });
export { NOTE_NAMES };
