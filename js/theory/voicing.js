// Voicings (drop / low / close / high / bright) and voiced MIDI notes.
import { normalizeExt, chordIntervals } from "./chords.js?v=112.13";
import { mod12 } from "./spelling.js?v=112.13";

var VOICINGS = ["drop", "low", "close", "high", "bright"];
export { VOICINGS };

function applyVoicing(midis, voicing) {
  var n = midis.slice();
  if (voicing === "low") return n.map(function (m) { return m - 12; });
  if (voicing === "high") return n.map(function (m) { return m + 12; });
  if (voicing === "bright") {
    return n.map(function (m, i) { return m + (i === n.length - 1 ? 24 : 12); });
  }
  if (voicing === "drop") {
    if (n.length >= 2) n[n.length - 2] -= 12;
    n.sort(function (a, b) { return a - b; });
    return n;
  }
  if (voicing !== "close") throw new Error("unknown voicing " + voicing);
  return n;
}

export function voicedMidis(rootPc, type, ext, voicing, rootMidiOpt) {
  var rootMidi = (typeof rootMidiOpt === "number" && isFinite(rootMidiOpt)) ? rootMidiOpt : 60 + mod12(rootPc);
  var placed = chordIntervals(type, ext).map(function (iv) { return rootMidi + iv; });
  var e = normalizeExt(ext);
  if (e.over) placed.unshift(rootMidi + e.over - 12);
  return applyVoicing(placed, voicing || "close");
}

export function pitchClasses(midis) {
  var set = {};
  midis.forEach(function (m) { set[mod12(m)] = true; });
  return Object.keys(set).map(Number).sort(function (a, b) { return a - b; });
}
