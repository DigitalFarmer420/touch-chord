// Chord quality mapping (type + extensions) and pitch-class helpers.
import { shared } from "../state.js?v=112.4";



export function blankExt() {
  return { six: false, min7: false, maj7: false, nine: false };
}

export function mapQuality(q) {
  var ext = blankExt();
  if (q === "min" || q === "minor") return { type: "minor", extensions: ext, label: "m" };
  if (q === "sus4") return { type: "sus4", extensions: ext, label: "sus4" };
  if (q === "dim") return { type: "dim", extensions: ext, label: "dim" };
  if (q === "dom7" || q === "7") {
    ext.min7 = true;
    return { type: "major", extensions: ext, label: "7" };
  }
  if (q === "m7") {
    ext.min7 = true;
    return { type: "minor", extensions: ext, label: "m7" };
  }
  if (q === "maj7") {
    ext.maj7 = true;
    return { type: "major", extensions: ext, label: "maj7" };
  }
  if (q === "m7b5") {
    ext.min7 = true;
    return { type: "dim", extensions: ext, label: "m7b5" };
  }
  if (q === "add9") {
    ext.nine = true;
    return { type: "major", extensions: ext, label: "add9" };
  }
  if (q === "madd9") {
    ext.nine = true;
    return { type: "minor", extensions: ext, label: "madd9" };
  }
  if (q === "mmaj7") {
    ext.maj7 = true;
    return { type: "minor", extensions: ext, label: "m(maj7)" };
  }
  return { type: "major", extensions: ext, label: "" };
}

export function wrap12(n) { return ((n % 12) + 12) % 12; }
