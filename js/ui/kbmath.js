// kb-fix: pure keyboard pitch / quality rules (no DOM), shared by pads.js, keyboard.js and the unit tests.
function w12(n) { return ((n % 12) + 12) % 12; }

// The keyboard window snaps back to the selected key's tonic this long after a chip / Next /
// Play along chord is let go (or its preview ends).
export const KB_RESET_MS = 1000;

// The at-rest window's left key: the selected key's tonic in the C4..B4 octave (C 60, G 67, Eb 63, A 69).
export function tonicLow(keyPc) { return 60 + w12(keyPc); }

// A key tap: the chord in close root position stacked UPWARD from the touched key's pitch.
// No octave fold: tones above the visible keys still sound (they just don't light), and
// nothing ever sounds left of the touched root.
export function keyTapMidis(chordMidis, keyMidi) {
  var seen = {}, out = [];
  (chordMidis || []).forEach(function (m) { var x = keyMidi + w12(m - keyMidi); if (!seen[x]) { seen[x] = 1; out.push(x); } });
  return out.sort(function (a, b) { return a - b; });
}

// A chip / Next / Play chord on the keys (Octave/Piano window and Full): the ROOT sits on its key in the
// home octave C4..B4 by pitch class (60 + pc), + the Voicing octave. The chord grid runs its columns in
// keyboard order by pitch class from C (strip.js stripModel, v53), so every row's roots rise strictly left
// to right in every key, whatever chips came before. The tonic chip sits on the at-rest window's left key
// (tonicLow = 60 + tonic pc); degrees below the tonic's pitch class sit under it (G major: C4 D4 E4 F#4 | G4 A4 B4).
export function chipRootMidi(rootPc, vOff) { return 60 + w12(rootPc) + (vOff || 0); }

// The chip's notes: its chord tones in close root position upward from rootMidi (the root is the lowest
// CHORD note, every tone in root..root+11, as key taps). A slash chord (Am7/G, Em/B, C/E) adds its bass
// note under the chord, inside the octave below the root (rootMidi + over - 12); a bass that is also a
// chord tone (C/E) stays in the chord too. tonePcs: the chord tones' pitch classes (bass excluded).
export function chipMidis(chordMidis, rootMidi, overSemis, tonePcs) {
  var ov = w12(overSemis || 0), isTone = {};
  (tonePcs || []).forEach(function (p) { isTone[w12(p)] = 1; });
  var bassPc = w12(rootMidi + ov);
  var tones = (chordMidis || []).filter(function (m) { return !ov || !tonePcs || isTone[w12(m)] || w12(m) !== bassPc; });
  var out = keyTapMidis(tones, rootMidi);
  if (ov) out.unshift(rootMidi + ov - 12);
  return out;
}

// The quality a plain key tap plays: the diatonic chord of that degree in the current key
// (C major: C Dm Em F G Am B°; minor keys: natural minor). Out-of-key keys: a plain major triad.
// degrees = keyDegrees(activeKey()) ({pc, type}); null / empty = no key: major.
export function keyTapType(pc, degrees) {
  pc = w12(pc);
  for (var i = 0; degrees && i < degrees.length; i++) if (degrees[i].pc === pc) return degrees[i].type;
  return "major";
}
