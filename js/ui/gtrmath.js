// Guitar-tab decisions with no DOM: which tab is selected, where the tabs sit,
// which cards a layout shows, the diagram marks, and whether a key change is a
// fret slide. The screen (js/ui/guitar.js) only draws what this returns.
import { accSym } from "../theory/spelling.js?v=2026.11.27.24";

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
export function voicingFret(v) { return v && v.baseFret > 1 ? v.baseFret + "fr" : ""; }
// Per-style fine trim (dB) so a guitar strum sits about 1 dB under a held grid tap.
export var GTR_STYLE_DB = { pop: -2.3, jazz: 0.9, rnb: -0.1, ballad: -0.3, reggae: -0.6, funk: -0.2, yogaDeep: 3.2, country: -1.7, lofi: 2.8 };
// Diagram strings, low E first. Muted strings are skipped. Frets are absolute.
export function stringMidis(v, tuning) {
  var out = [], frets = v && v.frets || [];
  for (var i = 0; i < frets.length; i++) if (frets[i] != null) out.push(tuning[i] + frets[i]);
  return out;
}

// Shrink a label that is wider than its box. The fret token ("3fr") is never the part that
// gets cut: if the full line cannot reach the floor, the caller switches to the fret alone.
export function nextVoicingSize(scrollWidth, clientWidth, fontPx, minPx) {
  var min = minPx > 0 ? minPx : 10;
  var font = fontPx > 0 ? fontPx : 12;
  if (!(scrollWidth > clientWidth + 1) || !(clientWidth > 0)) return font;
  var scaled = font * clientWidth / scrollWidth;
  if (scaled < min) return min;
  return Math.round(scaled * 10) / 10;
}

// How many fret spaces the grip needs. Four is the usual window. A 9th that
// reaches five frets (Dm9 x5x968, C9 x3x756) needs the fifth, or its last dot
// is drawn on the string-name row. The window starts where the diagram does:
// the nut when an open grip fits in the first four frets, otherwise the lowest
// fretted note.
export function fretRows(frets) {
  var hasOpen = false, low = null, high = 0;
  var list = frets || [];
  for (var i = 0; i < list.length; i++) {
    var f = list[i];
    if (f === 0) hasOpen = true;
    else if (f > 0) {
      if (low == null || f < low) low = f;
      if (f > high) high = f;
    }
  }
  if (low == null) return 4;
  var base = hasOpen && high <= 4 ? 1 : low;
  var span = high - base + 1;
  return span > 4 ? span : 4;
}

// The finger number sits inside the barre dot nearest the middle of the bar.
// A six-string barre's midpoint falls between two strings, which left the
// digit touching a ring. On a tie the higher string wins. `dots` are the
// barre circles: { string, x, root }.
export function barreFinger(x0, x1, r, dots) {
  var mid = (Math.min(x0, x1) + Math.max(x0, x1)) / 2;
  var best = null;
  var bestD = Infinity;
  var list = dots || [];
  for (var i = 0; i < list.length; i++) {
    var d = Math.abs(list[i].x - mid);
    var closer = d < bestD - 1e-6;
    var tie = best && Math.abs(d - bestD) <= 1e-6 && list[i].string > best.string;
    if (!best || closer || tie) {
      best = list[i];
      bestD = d;
    }
  }
  if (!best) return { x: mid, anchor: "middle", r: r, root: false, string: -1 };
  return { x: best.x, anchor: "middle", r: r, root: !!best.root, string: best.string };
}

// A barre is a bar from the first barred string to the last, as thick as a dot
// and centered on that fret space. The dots sit on the strings; the bar only
// joins them, so a two-string barre is not a floating pill.
export function barreBox(x0, x1, y, r) {
  var left = Math.min(x0, x1);
  var right = Math.max(x0, x1);
  return { x: left, y: y - r, width: Math.max(0, right - left), height: r * 2 };
}

// Padding for one diagram, in the same user units the SVG draws. The dot radius is
// min(string spacing, fret height) * 0.36, and the side inset is at least that radius
// so an outer-string dot and a barre cap stay inside. The band above the nut fits an
// O or X. A caller that already leaves more room keeps it. `rows` is the fret count
// from fretRows; the caller's fh is the height of one fret in a 4-fret stack, and a
// taller grip shares that stack so the box stays about square (fret height stays
// between 0.9× and 1.3× the string spacing).
export function diagramFrame(o) {
  var S = o.stringsCount > 1 ? o.stringsCount : 6;
  var fh = o.fh > 0 ? o.fh : 16;
  var mk = o.mk > 0 ? o.mk : 11;
  // Short portrait phones set --gtr-compact. Markers, the string-name row and
  // the padding around them shrink together so the fretboard stays wide while
  // the card gets shorter and the chord grid takes the height.
  if (o.compact) mk = Math.max(6.5, mk * 0.7);
  var base = o.base > 1 ? o.base : 1;
  var gutter = base > 1 ? (o.gutter > 0 ? o.gutter : 10) : 0;
  var openR = mk * 0.36;
  var stroke = 0.8;
  var gap = Math.max(0.6, openR * 0.2);
  // The × glyph's em box is about the font size above its baseline (measured, not the cap height).
  var muteAscent = mk * 1.05;
  var openCy = gap + openR + stroke;
  var muteY = gap + muteAscent;
  var marksBottom = Math.max(muteY + mk * 0.3, openCy + openR + stroke);
  var nutAbove = 4;
  var top = Math.max(o.top > 0 ? o.top : 0, marksBottom + nutAbove + gap);
  var nameFs = o.strings ? (o.compact ? 7 : 10) : 0;
  var nameDrop = nameFs ? nameFs * (o.compact ? 0.9 : 1.15) : 0;
  var bot = Math.max(o.bot > 0 ? o.bot : 0, nameDrop + nameFs * 0.28 + gap);
  var side = o.side > 0 ? o.side : 0;
  var rows = o.rows > 4 ? o.rows : 4;
  var r = 0, sg = 1, gw = 1, left = side;
  for (var i = 0; i < 8; i++) {
    left = side + gutter;
    gw = o.w - 2 * side - gutter;
    if (!(gw > 1)) gw = 1;
    sg = S > 1 ? gw / (S - 1) : gw;
    r = Math.min(sg, fh) * 0.36;
    var need = r + gap;
    if (need <= side + 0.05) break;
    side = need;
  }
  // The caller's fh fills four rows. A 5-fret grip uses that same stack, so the
  // diagram does not grow, and each fret stays close to the string spacing.
  if (rows > 4) {
    fh = fh * 4 / rows;
    if (fh > sg * 1.3) fh = sg * 1.3;
    if (fh < sg * 0.9) fh = sg * 0.9;
    r = Math.min(sg, fh) * 0.36;
    var grew = r + gap;
    if (grew > side + 0.05) {
      side = grew;
      left = side + gutter;
      gw = o.w - 2 * side - gutter;
      if (!(gw > 1)) gw = 1;
      sg = S > 1 ? gw / (S - 1) : gw;
      if (fh > sg * 1.3) fh = sg * 1.3;
      if (fh < sg * 0.9) fh = sg * 0.9;
      r = Math.min(sg, fh) * 0.36;
    }
  }
  // Phone diagrams are a little wider than tall, so a short card still holds a
  // fretboard that fills most of the card width. Other layouts stay within the
  // 0.82 height cap (the flow check allows 0.8).
  var wide = !!o.wide;
  // A 5-fret grip stays at 0.9 so its fret ratio still clears the flow check.
  // A short phone's 4-fret diagram may sit a little lower (still above 0.8).
  var fretFloor = sg * (o.compact && rows <= 4 ? 0.82 : 0.9);
  var wideCap = o.compact ? 1.22 : 1.12;
  if (o.square) {
    var H0 = top + rows * fh + bot;
    var capH = wide ? o.w / wideCap : o.w;
    if (H0 > capH && fh > fretFloor) {
      fh = Math.max(fretFloor, fh - (H0 - capH) / rows);
      r = Math.min(sg, fh) * 0.36;
    }
  }
  var H = top + rows * fh + bot;
  var limit = wide ? o.w / wideCap : o.w / 0.82;
  if (H > limit) {
    fh = Math.max(fretFloor, fh - (H - limit) / rows);
    r = Math.min(sg, fh) * 0.36;
    H = top + rows * fh + bot;
  }
  // A fret-1 dot has to clear the nut (the nut ends at `top`).
  var nutClear = fh * 0.5 - 1.2;
  if (r > nutClear && nutClear > 1) r = nutClear;
  return {
    side: side, top: top, bot: bot, left: left, gw: gw, sg: sg, fh: fh, r: r, rows: rows,
    H: H, mk: mk, gap: gap, nutAbove: nutAbove, openR: openR, stroke: stroke,
    nameDrop: nameDrop, openCy: openCy, muteY: muteY, nameFs: nameFs
  };
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
