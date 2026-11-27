// Guitar-tab decisions with no DOM: which tab is selected, where the tabs sit,
// which cards a layout shows, the diagram marks, and whether a key change is a
// fret slide. The screen (js/ui/guitar.js) only draws what this returns.
import { accSym } from "../theory/spelling.js?v=2026.11.27.13";

export var GTR_TAB_KEY = "touchChord.gtrTab.v1";
export var ROOT_COLOR = "#FFC23D";
export var SLIDE_MS = 250;

var EXT_KEYS = ["six", "min7", "maj7", "nine", "sus2", "flat9", "sharp9", "thirteen", "over", "sharp5", "flat5"];

export function readGtrTab(raw) {
  return raw === "guitar" ? "guitar" : "piano";
}

export function gtrTabReduce(tab, action) {
  var cur = readGtrTab(tab);
  if (action === "piano" || action === "guitar") return action;
  if (action === "toggle") return cur === "guitar" ? "piano" : "guitar";
  return cur;
}

export function showOctave(tab) {
  return readGtrTab(tab) !== "guitar";
}

// lay is the boot-early size class without the "lay-" prefix.
export function tabAxis(lay) {
  return lay === "phone-land" || lay === "pad-land" ? "side" : "top";
}

export function cardSlots(lay) {
  if (lay === "phone-port") return ["now", "next"];
  return ["now", "next", "third", "fourth"];
}

export function layoutOf(className) {
  var s = String(className || "");
  if (/lay-phone-land/.test(s)) return "phone-land";
  if (/lay-pad-land/.test(s)) return "pad-land";
  if (/lay-pad-port/.test(s)) return "pad-port";
  return "phone-port";
}

// The name on a Guitar card is the chord's own spelling (the song symbol or
// the pad label), never the name of a grip the resolver happened to match.
export function chordDisplayName(chord) {
  if (!chord) return "";
  if (chord.chipLabel != null) return accSym(String(chord.rootName || "") + String(chord.chipLabel));
  if (chord.qualityLabel) {
    var q = chord.qualityLabel;
    if (q === "m7b5") q = "m7\u266d5";
    else if (q === "sus4") q = "sus";
    else if (chord.type === "dim" && q === "dim") q = "\u00b0";
    return accSym(String(chord.rootName || "") + q);
  }
  if (chord.symbol) return accSym(chord.symbol);
  return "";
}

export function chordSig(chord) {
  var ext = chord && chord.extensions || {};
  var bits = [];
  for (var i = 0; i < EXT_KEYS.length; i++) bits.push(ext[EXT_KEYS[i]] ? 1 : 0);
  return (chord && chord.type || "major") + ":" + bits.join("");
}

export function voicingLabel(v) {
  if (!v) return "";
  if (v.shapeName === "Open" || !(v.baseFret > 1)) return v.shapeName === "Open" ? "Open" : (v.shapeName || "Open");
  return v.shapeName + " \u00b7 " + v.baseFret + "fr";
}

export function cycleIndex(index, count, dir) {
  var n = count || 0;
  if (!n) return 0;
  var i = index || 0;
  i = dir < 0 ? i - 1 : i + 1;
  return (i % n + n) % n;
}

// Constant fret offset between two grips of the same shape, or null when the
// grip is a different shape (mutes moved, or the frets did not all shift equally).
export function fretSlide(prev, next) {
  if (!prev || !next || prev.shapeName !== next.shapeName) return null;
  if (!prev.frets || !next.frets || prev.frets.length !== next.frets.length) return null;
  var delta = null;
  for (var i = 0; i < prev.frets.length; i++) {
    var a = prev.frets[i], b = next.frets[i];
    if ((a == null) !== (b == null)) return null;
    if (a == null) continue;
    var d = b - a;
    if (delta == null) delta = d;
    else if (d !== delta) return null;
  }
  return delta == null ? 0 : delta;
}

function mod12(n) { return ((n % 12) + 12) % 12; }

function onBarre(barres, fret, string) {
  for (var i = 0; i < barres.length; i++) {
    var b = barres[i];
    if (fret === b.fret && string >= b.fromString && string <= b.toString) return b;
  }
  return null;
}

// Marks for one grip. Low string is index 0 (drawn on the left).
// kind: mute | open | open-root | dot | root | barre | barre-root
export function diagramModel(voicing, tuning, rootPc) {
  var frets = voicing && voicing.frets || [];
  var fingers = voicing && voicing.fingers || [];
  var barres = voicing && voicing.barres || [];
  var base = voicing && voicing.baseFret > 1 ? voicing.baseFret : 1;
  var root = mod12(rootPc || 0);
  var marks = [];
  for (var i = 0; i < frets.length; i++) {
    var f = frets[i];
    var finger = fingers[i] || 0;
    if (f == null) {
      marks.push({ string: i, fret: null, finger: 0, kind: "mute", root: false });
      continue;
    }
    var isRoot = mod12(tuning[i] + f) === root;
    var barre = f > 0 ? onBarre(barres, f, i) : null;
    var kind;
    if (barre) kind = isRoot ? "barre-root" : "barre";
    else if (f === 0) kind = isRoot ? "open-root" : "open";
    else kind = isRoot ? "root" : "dot";
    marks.push({ string: i, fret: f, finger: finger, kind: kind, root: isRoot });
  }
  var drawn = [];
  for (var b = 0; b < barres.length; b++) {
    drawn.push({
      fret: barres[b].fret,
      fromString: barres[b].fromString,
      toString: barres[b].toString,
      finger: barres[b].finger
    });
  }
  return {
    base: base,
    nut: base === 1,
    frLabel: base > 1 ? base + "fr" : "",
    rootColor: ROOT_COLOR,
    marks: marks,
    barres: drawn
  };
}
