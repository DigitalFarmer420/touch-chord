// Expert Guitar tab. Draws the resolver's grips in the keyboard area and strums
// them through ChordAudio. Kids, Simple, and the Piano tab do not use this panel.
import { api as ChordAudio } from "../audio/index.js?v=2026.11.27.24";
import { unlock } from "../audio/unlock.js?v=2026.11.27.24";
import { activeKey } from "../keys.js?v=2026.11.27.24";
import { prog, magic } from "../songs/playback.js?v=2026.11.27.24";
import { guitar as guitarProfile } from "../instruments/profiles.js?v=2026.11.27.24";
import { resolveVoicings } from "../instruments/resolve.js?v=2026.11.27.24";
import { state } from "../state.js?v=2026.11.27.24";
import { Theory } from "../theory/index.js?v=2026.11.27.24";
import { accSym } from "../theory/spelling.js?v=2026.11.27.24";
import { computeSpec } from "./touch.js?v=2026.11.27.24";
import {
  GTR_TAB_KEY, readGtrTab, gtrTabReduce, cardSlots, layoutOf,
  chordSig, chordDisplayName, voicingLabel, voicingFret, stringMidis, GTR_STYLE_DB, nextVoicingSize, cycleIndex, fretSlide, diagramModel, diagramFrame, fretRows, barreFinger, barreBox
} from "./gtrmath.js?v=2026.11.27.24";

var TAB_LABEL = { now: "NOW", next: "NEXT", third: "3RD", fourth: "4TH" };
var pick = {};
var tab = "piano";
var built = false;
var lastKey = null;
var lastGrip = {};
var EXT_KEYS = ["six", "min7", "maj7", "nine", "sus2", "flat9", "sharp9", "thirteen", "over", "sharp5", "flat5"];

function de() { return document.documentElement; }
function expertOn() {
  var c = de().classList;
  return c.contains("expert") && !c.contains("kv") && !c.contains("simple");
}
function reducedMotion() {
  return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}
function mod12(n) { return ((n % 12) + 12) % 12; }
function sameChord(a, b) {
  if (!a || !b || mod12(a.rootPc) !== mod12(b.rootPc) || a.type !== b.type) return false;
  var ea = a.extensions || {}, eb = b.extensions || {};
  for (var i = 0; i < EXT_KEYS.length; i++) if ((ea[EXT_KEYS[i]] || 0) !== (eb[EXT_KEYS[i]] || 0)) return false;
  return true;
}
function chordName(chord) {
  if (!chord) return "";
  if (chord.chipLabel != null || chord.qualityLabel) return chordDisplayName(chord);
  if (chord.symbol) return chordDisplayName(chord);
  var builtChord = Theory.buildChord({
    rootPc: chord.rootPc, type: chord.type || "major", extensions: chord.extensions,
    rootSpell: chord.rootSpell, rootName: chord.rootName
  });
  return accSym(builtChord.symbol);
}
function loadTab() {
  try { return readGtrTab(localStorage.getItem(GTR_TAB_KEY)); } catch (e) { return "piano"; }
}
function saveTab(next) {
  try { localStorage.setItem(GTR_TAB_KEY, next); } catch (e) {}
}

function anchorIndex(spec) {
  var steps = prog && prog.steps || [];
  if (!steps.length) return 0;
  if ((prog.playing || prog.paused) && prog.cur >= 0 && prog.cur < steps.length) return prog.cur;
  if (magic && magic.item && sameChord(magic.item, spec)) {
    var played = (magic.pos | 0) - 1;
    if (played >= 0 && played < steps.length) return played;
  }
  for (var i = 0; i < steps.length; i++) if (sameChord(steps[i].item, spec)) return i;
  return 0;
}
function cardChords(spec) {
  var steps = prog && prog.steps || [];
  var anchor = anchorIndex(spec);
  var out = { now: spec };
  var slots = ["next", "third", "fourth"];
  for (var i = 0; i < slots.length; i++) {
    if (!steps.length) { out[slots[i]] = null; continue; }
    out[slots[i]] = steps[(anchor + 1 + i) % steps.length].item;
  }
  return out;
}

// "3fr" has to sit fully inside the diagram. The left gutter is used when the
// label fits there; a small Next square puts it in the top band instead, so the
// "3" is not clipped off the left edge.
function fretText(label, left, top, fh, gutter, ink) {
  if (!label) return "";
  var wide = label.length * 0.62;
  var fs = 10;
  while (fs > 7 && wide * fs > gutter - 2) fs -= 1;
  var tw = wide * fs;
  if (tw <= gutter - 2 && left - 1 - tw >= 1) {
    return '<text class="gtr-fr" x="' + (left - 1) + '" y="' + (top + fh * 0.62) + '" font-size="' + fs + '" text-anchor="end" fill="' + ink + '" font-family="Nunito, system-ui, sans-serif" font-weight="800">' + label + "</text>";
  }
  fs = Math.max(7, Math.min(9, top - 1));
  return '<text class="gtr-fr" x="1" y="' + (fs + 0.5) + '" font-size="' + fs + '" text-anchor="start" fill="' + ink + '" font-family="Nunito, system-ui, sans-serif" font-weight="800">' + label + "</text>";
}
function diagramSvg(voicing, chord, o) {
  var model = diagramModel(voicing, guitarProfile.tuning, chord.rootPc);
  var S = model.marks.length, F = fretRows(voicing && voicing.frets);
  var f = diagramFrame({
    w: o.w, fh: o.fh, mk: o.mk || 11, base: model.base, rows: F,
    side: o.side, top: o.top, bot: o.bot != null ? o.bot : (o.strings ? 16 : 8),
    gutter: o.gutter != null ? o.gutter : 10,
    fing: o.fing, strings: o.strings, stringsCount: S, square: o.square, wide: o.wide, compact: o.compact
  });
  var top = f.top, left = f.left, gw = f.gw, sg = f.sg, fh = f.fh, r = f.r, mk = f.mk;
  var base = model.base;
  var gutter = model.base > 1 ? (o.gutter != null ? o.gutter : 10) : 0;
  var H = f.H;
  var ink = o.ink, line = o.line, dot = o.dot, dotT = o.dotT, mute = o.mute;
  // Day's cream card washes out the brand gold (1.3:1). A darker amber still reads
  // as the root and clears 3:1 on the card; the finger number flips to cream so
  // it stays above 4.5:1 on that amber. Lamp keeps the original gold.
  var dayInk = de().classList.contains("x-day");
  var Y = dayInk ? "#8C620C" : "#FFC23D";
  var YT = dayInk ? "#F3EAD8" : "#2a231c";
  var fretted = 0;
  for (var fi0 = 0; fi0 < model.marks.length; fi0++) if (model.marks[fi0].fret > 0) fretted++;
  var g = '<svg class="gtr-diagram" data-gtr-fretted="' + fretted + '" width="100%" viewBox="0 0 ' + o.w + " " + H + '" role="img" aria-label="' + escapeAttr(o.label || "") + '">';
  if (model.nut) g += '<rect class="gtr-nut" x="' + (left - 1) + '" y="' + (top - f.nutAbove) + '" width="' + (gw + 2) + '" height="' + f.nutAbove + '" rx="1.5" fill="' + ink + '"/>';
  else g += '<line x1="' + left + '" x2="' + (left + gw) + '" y1="' + top + '" y2="' + top + '" stroke="' + line + '" stroke-width="1.5"/>' +
    fretText(model.frLabel, left, top, fh, gutter, ink);
  for (var fi = 1; fi <= F; fi++) g += '<line x1="' + left + '" x2="' + (left + gw) + '" y1="' + (top + fi * fh) + '" y2="' + (top + fi * fh) + '" stroke="' + line + '" stroke-width="1.5"/>';
  for (var si = 0; si < S; si++) {
    var sw = (1 + (S - 1 - si) * 0.25).toFixed(2);
    g += '<line x1="' + (left + si * sg) + '" x2="' + (left + si * sg) + '" y1="' + top + '" y2="' + (top + F * fh) + '" stroke="' + line + '" stroke-width="' + sw + '"/>';
  }
  var fingerNotes = [];
  for (var bi = 0; bi < model.barres.length; bi++) {
    var b = model.barres[bi];
    var yb = top + (b.fret - base + 0.5) * fh;
    var x0 = left + b.fromString * sg;
    var x1 = left + b.toString * sg;
    var box = barreBox(x0, x1, yb, r);
    if (box.width > 0.5) g += '<rect class="gtr-barre" x="' + box.x + '" y="' + box.y + '" width="' + box.width + '" height="' + box.height + '" rx="' + Math.min(2.2, r * 0.35) + '" fill="' + dot + '"/>';
    if (o.fing) {
      var loS = Math.min(b.fromString, b.toString), hiS = Math.max(b.fromString, b.toString);
      var dots = [];
      for (var di = 0; di < model.marks.length; di++) {
        var dm = model.marks[di];
        if (dm.fret !== b.fret || dm.string < loS || dm.string > hiS) continue;
        if (dm.kind !== "barre" && dm.kind !== "barre-root") continue;
        dots.push({ string: dm.string, x: left + dm.string * sg, root: dm.kind === "barre-root" });
      }
      var spot = barreFinger(x0, x1, r, dots);
      fingerNotes.push(spot.x + "|" + yb + "|" + b.finger + "|" + (spot.root ? YT : dotT));
    }
  }
  for (var mi = 0; mi < model.marks.length; mi++) {
    var m = model.marks[mi];
    var x = left + m.string * sg;
    if (m.kind === "mute") {
      g += '<text class="gtr-mark" x="' + x + '" y="' + f.muteY + '" font-size="' + mk + '" text-anchor="middle" fill="' + mute + '" font-family="Nunito, system-ui, sans-serif" font-weight="800">\u00d7</text>';
    } else if (m.kind === "open" || m.kind === "open-root") {
      if (m.kind === "open-root") g += '<circle class="gtr-mark" cx="' + x + '" cy="' + f.openCy + '" r="' + f.openR + '" fill="' + Y + '"/>';
      else g += '<circle class="gtr-mark" cx="' + x + '" cy="' + f.openCy + '" r="' + (mk * 0.32) + '" fill="none" stroke="' + ink + '" stroke-width="1.6"/>';
    } else if (m.kind === "barre" || m.kind === "barre-root" || m.kind === "dot" || m.kind === "root") {
      var y = top + (m.fret - base + 0.5) * fh;
      var rootDot = m.kind === "root" || m.kind === "barre-root";
      var onBarre = m.kind === "barre" || m.kind === "barre-root";
      g += '<circle class="gtr-dot" cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + (rootDot ? Y : dot) + '"' + (onBarre ? ' stroke="' + (rootDot ? YT : dotT) + '" stroke-width="1.5"' : "") + "/>";
      if (o.fing && m.finger && !onBarre) g += '<text class="gtr-finger" x="' + x + '" y="' + (y + r * 0.42) + '" font-size="' + (r * 1.15) + '" text-anchor="middle" fill="' + (rootDot ? YT : dotT) + '" font-family="Nunito, system-ui, sans-serif" font-weight="800">' + m.finger + "</text>";
    }
  }
  for (var fn = 0; fn < fingerNotes.length; fn++) {
    var parts = fingerNotes[fn].split("|");
    // A little smaller than a fretted-note number so the glyph stays inside the
    // ring on a short landscape diagram, where the dot is only a few pixels.
    g += '<text class="gtr-finger gtr-barre-num" x="' + parts[0] + '" y="' + (parseFloat(parts[1]) + r * 0.38) + '" font-size="' + (r * 0.9) + '" text-anchor="middle" fill="' + (parts[3] || dotT) + '" font-family="Nunito, system-ui, sans-serif" font-weight="800">' + parts[2] + "</text>";
  }
  if (o.strings) {
    var names = guitarProfile.stringNames;
    for (var n = 0; n < names.length && n < S; n++) {
      g += '<text class="gtr-string" x="' + (left + n * sg) + '" y="' + (top + F * fh + f.nameDrop) + '" font-size="' + (f.nameFs || 10) + '" text-anchor="middle" fill="' + mute + '" font-family="Nunito, system-ui, sans-serif" font-weight="700">' + names[n] + "</text>";
    }
  }
  return g + "</svg>";
}
function escapeAttr(s) { return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;"); }

// Landscape fret spacing follows the card: (height − chrome) / 4.
function landFret(lay) {
  var panel = document.getElementById("gtrPanel");
  var H = panel ? panel.clientHeight : 0;
  if (!(H > 40)) return lay === "pad-land" ? 28 : 16;
  return (H - (lay === "pad-land" ? 46 : 30)) / 4;
}

// iPad landscape only. Height still starts from the card, then stops at 1.3×
// the string spacing. The above-nut gap is the tight one (the fret numeral
// takes 10px), so every diagram, nut or not, stays within the cap.
function capPadLand(fh, w, side) {
  var sg = (w - 2 * side - 10) / 5;
  var cap = 1.3 * sg;
  return fh > cap ? cap : fh;
}

// Phone portrait only. The panel is whatever height the flow layout left under
// the chord rows, so the diagram is the smaller of that free height and half
// the panel width, locked near 1:1. Next stays smaller than Now.
var portFit = null;
// Set on html by the short-portrait breakpoint in guitar.css. Absent at 915 and taller.
function gtrCompact() {
  var raw = getComputedStyle(de()).getPropertyValue("--gtr-compact");
  return parseFloat(raw) > 0;
}
function portInk(px, strings) {
  var side = 4, top = 9, bot = strings ? 10 : 6;
  // The fret numeral column is 10px on a full diagram. On a small phone square
  // that column would make the frets too tall, so it shrinks with the box.
  var gutter = px >= 78 ? 10 : Math.max(4, Math.round(px * 0.16));
  var sgN = (px - 2 * side) / 5;
  var sgB = (px - 2 * side - gutter) / 5;
  var lo = 0.9 * sgN, hi = 1.18 * sgB;
  var fh = (px - top - bot) / 4;
  if (fh < lo) fh = lo;
  if (fh > hi) fh = hi;
  return { w: px, fh: fh, side: side, top: top, bot: bot, gutter: gutter, mk: Math.max(8, Math.min(11, px * 0.2)) };
}
function measurePort() {
  var panel = document.getElementById("gtrPanel");
  var pw = panel ? panel.clientWidth : 0;
  // The panel's height is the diagram, so it cannot decide the diagram's width.
  // A width-only measure is what the second paint (after Next) already settles on.
  // Falling back to 64 while the panel is still empty is what made the first
  // viewBox too tall until the next chord.
  if (!(pw > 40)) {
    var kb = document.querySelector(".kb-wrap");
    pw = kb ? kb.clientWidth - 8 : 0;
  }
  if (!(pw > 40)) return { now: portInk(64, true), next: portInk(52, false) };
  var innerW = (pw - 8) / 2 - 12;
  var nowPx = innerW * 0.94;
  var nextPx = nowPx * 0.85;
  nowPx = Math.max(28, Math.floor(nowPx));
  nextPx = Math.max(24, Math.floor(nextPx));
  if (nextPx > nowPx * 0.9) nextPx = Math.floor(nowPx * 0.9);
  if (nextPx > nowPx - 2) nextPx = Math.max(24, nowPx - 2);
  return { now: portInk(nowPx, true), next: portInk(nextPx, false) };
}
// The first guess above is the panel height minus a chrome allowance. Once the
// cards exist, the diagram grows into the hole that is actually left, so Next
// is about 85% of Now and, when a square that wide fits, at least 60% of the
// card's content width.
function growPort() {
  var host = document.getElementById("gtrPanel");
  var now = document.querySelector("#gtrCards .gtr-card.now");
  var next = document.querySelector("#gtrCards .gtr-card.next");
  if (!host || !now || !next) return;
  function hole(card) {
    var cs = getComputedStyle(card);
    var padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    var padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    var used = padY;
    var kids = card.children;
    for (var i = 0; i < kids.length; i++) {
      if (kids[i].classList.contains("gtr-diagram")) continue;
      var rh = kids[i].getBoundingClientRect().height;
      if (rh > 0) used += rh;
    }
    return { innerW: card.clientWidth - padX, innerH: card.clientHeight - used - 6 };
  }
  var nb = hole(now);
  if (!(nb.innerW > 40)) return;
  // Width comes from the card. Next is 85% of Now, and at least 60% of the
  // card when that still fits under Now. Height follows the drawing.
  var nowPx = Math.floor(nb.innerW * 0.94);
  var nextPx = Math.round(nowPx * 0.85);
  var floor = Math.round(nb.innerW * 0.62);
  if (nextPx < floor && floor <= nowPx * 0.9) nextPx = floor;
  if (nextPx > nowPx * 0.9) nextPx = Math.floor(nowPx * 0.9);
  if (nextPx > nowPx - 2) nextPx = Math.max(24, nowPx - 2);
  host.style.setProperty("--gtr-now", nowPx + "px");
  host.style.setProperty("--gtr-next", nextPx + "px");
  // iPad portrait keeps the piano's fixed grid row, and the cards size to the
  // drawing. Phone portrait's row is the piano keyboard slot, so a diagram that
  // is taller than that slot scales down. Next stays 85% of Now.
  var root = de();
  if (root.classList.contains("gtr") && root.classList.contains("lay-pad-port")) return;
  // If the drawing is taller than a fixed-height card, shrink both widths
  // together so the 0.85 ratio survives.
  var drawn = now.querySelector(".gtr-diagram");
  if (drawn && nb.innerH > 24 && drawn.getBoundingClientRect().height > nb.innerH) {
    var scale = nb.innerH / drawn.getBoundingClientRect().height;
    nowPx = Math.max(28, Math.floor(nowPx * scale));
    nextPx = Math.round(nowPx * 0.85);
    if (nextPx > nowPx - 2) nextPx = nowPx - 2;
    host.style.setProperty("--gtr-now", nowPx + "px");
    host.style.setProperty("--gtr-next", nextPx + "px");
  }
}
function tightenPort() {
  var panel = document.getElementById("gtrPanel");
  var cards = document.querySelectorAll("#gtrCards .gtr-card");
  if (!panel || !cards.length) return;
  var pb = panel.getBoundingClientRect();
  var excess = 0;
  for (var i = 0; i < cards.length; i++) {
    var card = cards[i];
    var cb = card.getBoundingClientRect();
    excess = Math.max(excess, cb.bottom - pb.bottom, cb.right - pb.right);
    var bits = card.querySelectorAll(".gtr-diagram, .gtr-name, .gtr-meta, .gtr-vo, .gtr-tap, .gtr-lb");
    for (var j = 0; j < bits.length; j++) {
      var r = bits[j].getBoundingClientRect();
      if (r.width < 1 && r.height < 1) continue;
      excess = Math.max(excess, r.bottom - cb.bottom, r.right - cb.right, r.top - cb.top < -1 ? cb.top - r.top : 0, r.left - cb.left < -1 ? cb.left - r.left : 0);
    }
  }
  if (excess <= 1) return;
  var now = parseFloat(panel.style.getPropertyValue("--gtr-now")) || 64;
  var next = parseFloat(panel.style.getPropertyValue("--gtr-next")) || 52;
  var cut = Math.ceil(excess);
  now = Math.max(28, now - cut);
  next = Math.round(now * 0.85);
  if (next > now - 2) next = Math.max(24, now - 2);
  panel.style.setProperty("--gtr-now", now + "px");
  panel.style.setProperty("--gtr-next", next + "px");
}

function diaOpts(lay, slot, name) {
  var now = slot === "now";
  var land = lay === "phone-land" || lay === "pad-land";
  var pad = lay === "pad-port" || lay === "pad-land";
  // Day look paints the Next card white. The dark-card cream ink disappears on it,
  // so a Day Next diagram uses the same dark ink as Now. Lamp keeps the cream ink.
  var lite = now || de().classList.contains("x-day");
  var theme = lite
    ? { ink: "#2a231c", line: "#7a6c58", dot: "#2a231c", dotT: "#F3EAD8", mute: "#7a6c58" }
    : { ink: "#F3EAD8", line: "#8a7d69", dot: "#F3EAD8", dotT: "#2a231c", mute: "#9d917e" };
  var w = land ? (pad ? 150 : 86) : (now ? (pad ? 190 : 118) : (pad ? 120 : 84));
  var side = pad ? 14 : 11;
  // iPad portrait (.8 was 40 / 24). Tall enough that Now and Next render about
  // 18% larger than .8, and the Now box stays within the portrait aspect check.
  var fh = land ? landFret(lay) : (now ? (pad ? 49 : 21) : (pad ? 30 : 17));
  var top = pad ? 22 : 17;
  var bot = null;
  var mk = pad ? 13 : 11;
  if (lay === "pad-land") fh = capPadLand(fh, w, side);
  if (lay === "phone-port" && portFit) {
    var ink = now ? portFit.now : portFit.next;
    w = ink.w; fh = ink.fh; side = ink.side; top = ink.top; bot = ink.bot; mk = ink.mk;
  }
  return Object.assign(theme, {
    w: w, fh: fh, mk: mk,
    top: top, side: side, bot: bot, gutter: lay === "phone-port" && portFit ? (now ? portFit.now.gutter : portFit.next.gutter) : null,
    fing: true, strings: now && (!land || pad), label: name,
    square: lay === "phone-port" && !!portFit,
    wide: lay === "phone-port" && !!portFit,
    compact: lay === "phone-port" && gtrCompact()
  });
}

function gripsFor(chord) {
  if (!chord) return [];
  return resolveVoicings(guitarProfile, {
    rootPc: chord.rootPc, type: chord.type || "major", extensions: chord.extensions,
    rootSpell: chord.rootSpell, rootName: chord.rootName
  });
}

function strum(voicing) {
  if (!voicing || !voicing.frets) return;
  var notes = stringMidis(voicing, guitarProfile.tuning);
  if (!notes.length) return;
  unlock();
  try { ChordAudio.ensure(); } catch (e) { return; }
  ChordAudio.strumGuitar(notes, { group: "gtr", styleDb: GTR_STYLE_DB[state.style] || 0 });
}

function applyChrome() {
  var on = expertOn();
  var root = de();
  var tabs = document.getElementById("gtrTabs");
  var panel = document.getElementById("gtrPanel");
  if (!tabs || !panel) return;
  if (!on) {
    root.classList.remove("gtr");
    tabs.hidden = true;
    panel.hidden = true;
    return;
  }
  tabs.hidden = false;
  var guitar = tab === "guitar";
  root.classList.toggle("gtr", guitar);
  panel.hidden = !guitar;
  var buttons = tabs.querySelectorAll("[data-gtr]");
  for (var i = 0; i < buttons.length; i++) {
    var onTab = buttons[i].dataset.gtr === tab;
    buttons[i].classList.toggle("on", onTab);
    buttons[i].setAttribute("aria-selected", onTab ? "true" : "false");
  }
}

function setTab(next) {
  tab = gtrTabReduce(tab, next);
  saveTab(tab);
  applyChrome();
  paintGuitar();
}

function cardHtml(slot, chord, lay, slideDy) {
  if (!chord) return "";
  var grips = gripsFor(chord);
  if (!grips.length) return "";
  var sig = chordSig(chord);
  var index = slot === "now" ? (pick[sig] || 0) : 0;
  if (index >= grips.length) index = 0;
  if (slot === "now") pick[sig] = index;
  var v = grips[index];
  var name = chordName(chord);
  var prev = lastGrip[slot];
  var delta = fretSlide(prev, v);
  var slide = slideDy && delta != null && delta !== 0 && !reducedMotion();
  var dy = !slide ? "" : (delta > 0 ? "-14px" : "14px");
  lastGrip[slot] = { shapeName: v.shapeName, frets: v.frets.slice(), baseFret: v.baseFret };
  var opts = diaOpts(lay, slot, name + " " + voicingLabel(v));
  // "next" is the card's slot. The hint class "nx" is stripped from every element on Next
  // (clearNextHintDom), and the phone-portrait size rules used to key off that class.
  var cls = "gtr-card" + (slot === "now" ? " now" : slot === "next" ? " next" : "");
  var head = '<div class="gtr-head"><p class="gtr-lb">' + TAB_LABEL[slot] + '</p><p class="gtr-name">' + name + "</p></div>";
  var foot = "";
  if (slot === "now") {
    var fullLabel = voicingLabel(v), fretTok = voicingFret(v);
    foot = '<div class="gtr-foot"><div class="gtr-vo"><button type="button" data-gtr-cycle="-1" aria-label="Previous shape">\u2039</button><span data-gtr-label data-gtr-full="' + escapeAttr(fullLabel) + '" data-gtr-fret="' + escapeAttr(fretTok) + '">' +
      escapeAttr(fullLabel) + '</span><button type="button" data-gtr-cycle="1" aria-label="Next shape">\u203a</button></div>' +
      '<p class="gtr-meta">' + (index + 1) + " of " + grips.length + ' \u00b7 <b>\u25cf</b> root</p></div>';
  } else if (slot === "next") foot = '<div class="gtr-foot"><p class="gtr-tap">Tap to strum</p></div>';
  var svg = diagramSvg(v, chord, opts);
  if (slide) svg = svg.replace('class="gtr-diagram"', 'class="gtr-diagram sliding" style="--gtr-dy:' + dy + '"');
  return '<div role="button" tabindex="0" class="' + cls + '" data-slot="' + slot + '" data-sig="' + sig + '">' + head + svg + foot + "</div>";
}

export function paintGuitar(spec) {
  if (!built) return;
  applyChrome();
  if (!expertOn() || tab !== "guitar") return;
  var panel = document.getElementById("gtrCards");
  if (!panel) return;
  if (!spec) { try { spec = computeSpec(); } catch (e) { return; } }
  var lay = layoutOf(de().className);
  portFit = lay === "phone-port" ? measurePort() : null;
  if (portFit) {
    var host = document.getElementById("gtrPanel") || panel;
    host.style.setProperty("--gtr-now", portFit.now.w + "px");
    host.style.setProperty("--gtr-next", portFit.next.w + "px");
  }
  var key = activeKey();
  var keyId = key ? key.pc + ":" + key.mode : "";
  var keyChanged = lastKey != null && lastKey !== keyId;
  lastKey = keyId;
  var chords = cardChords(spec);
  var slots = cardSlots(lay);
  function fill(slide) {
    var html = "";
    for (var i = 0; i < slots.length; i++) html += cardHtml(slots[i], chords[slots[i]], lay, slide);
    panel.innerHTML = html;
  }
  fill(keyChanged);
  if (portFit) {
    growPort();
    tightenPort();
    var host = document.getElementById("gtrPanel");
    var settled = host ? parseFloat(host.style.getPropertyValue("--gtr-now")) : 0;
    // growPort reads the real card. If that width is not the one the viewBox
    // was built with, draw once more in this same turn so the first frame is
    // already the settled size.
    if (settled > 40 && Math.abs(settled - portFit.now.w) > 1) {
      var nextW = parseFloat(host.style.getPropertyValue("--gtr-next"));
      if (!(nextW > 0)) nextW = Math.round(settled * 0.85);
      portFit = { now: portInk(Math.round(settled), true), next: portInk(Math.round(nextW), false) };
      fill(false);
    }
  }
  fitVoicingLines();
  warmGrips(chords, lay);
}
function warmGrips(chords, lay) {
  var slots = cardSlots(lay), notes = [];
  for (var i = 0; i < slots.length; i++) {
    if (slots[i] !== "now" && slots[i] !== "next") continue;
    var chord = chords[slots[i]];
    var grips = gripsFor(chord);
    if (!grips.length) continue;
    var index = slots[i] === "now" ? (pick[chordSig(chord)] || 0) : 0;
    if (index >= grips.length) index = 0;
    notes = notes.concat(stringMidis(grips[index], guitarProfile.tuning));
  }
  var idle = window.requestIdleCallback || function (fn) { return setTimeout(fn, 30); };
  idle(function () { try { ChordAudio.warmGuitar(notes); } catch (e) {} });
}
// The fret number stays whole. The line shrinks to the measured width, and only then
// drops the shape name ("E-shape · 3fr" -> "3fr"). It never ends in an ellipsis.
function fitVoicingLines() {
  var spans = document.querySelectorAll("#gtrCards [data-gtr-label]");
  for (var i = 0; i < spans.length; i++) fitVoicingLine(spans[i]);
}
function fitVoicingLine(span) {
  var full = span.getAttribute("data-gtr-full") || span.textContent;
  var fret = span.getAttribute("data-gtr-fret") || "";
  var minPx = 10;
  span.style.fontSize = "";
  span.textContent = full;
  var guard = 0, size;
  while (span.scrollWidth > span.clientWidth + 1 && guard < 4) {
    size = parseFloat(getComputedStyle(span).fontSize) || 12;
    var next = nextVoicingSize(span.scrollWidth, span.clientWidth, size, minPx);
    if (next >= size - 0.05) break;
    span.style.fontSize = next + "px";
    guard++;
  }
  if (fret && fret !== full && span.scrollWidth > span.clientWidth + 1) {
    span.textContent = fret;
    span.style.fontSize = "";
    guard = 0;
    while (span.scrollWidth > span.clientWidth + 1 && guard < 4) {
      size = parseFloat(getComputedStyle(span).fontSize) || 12;
      next = nextVoicingSize(span.scrollWidth, span.clientWidth, size, minPx);
      if (next >= size - 0.05) break;
      span.style.fontSize = next + "px";
      guard++;
    }
  }
}

function onPanelClick(e) {
  var cycle = e.target.closest("[data-gtr-cycle]");
  if (cycle) {
    e.preventDefault();
    e.stopPropagation();
    var card = cycle.closest("[data-sig]");
    if (!card) return;
    var sig = card.dataset.sig;
    var spec;
    try { spec = computeSpec(); } catch (err) { return; }
    var grips = gripsFor(spec);
    pick[sig] = cycleIndex(pick[sig] || 0, grips.length, +cycle.dataset.gtrCycle);
    lastGrip.now = null;
    paintGuitar(spec);
    return;
  }
  var cardEl = e.target.closest("[data-slot]");
  if (!cardEl) return;
  var spec2;
  try { spec2 = computeSpec(); } catch (err2) { return; }
  var chords = cardChords(spec2);
  var chord = chords[cardEl.dataset.slot];
  if (!chord) return;
  var grips = gripsFor(chord);
  var index = cardEl.dataset.slot === "now" ? (pick[chordSig(chord)] || 0) : 0;
  strum(grips[index] || grips[0]);
}

export function boot() {
  var wrap = document.querySelector(".kb-wrap");
  if (!wrap || document.getElementById("gtrTabs")) { built = !!document.getElementById("gtrTabs"); return; }
  tab = loadTab();
  var tabs = document.createElement("div");
  tabs.id = "gtrTabs";
  tabs.className = "gtr-tabs x-seg";
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "Instrument");
  tabs.innerHTML = '<button type="button" role="tab" data-gtr="piano"><span class="gtr-emoji" aria-hidden="true">\uD83C\uDFB9</span> Piano</button><button type="button" role="tab" data-gtr="guitar"><span class="gtr-emoji" aria-hidden="true">\uD83C\uDFB8</span> Guitar</button>';
  tabs.addEventListener("click", function (e) {
    var b = e.target.closest("[data-gtr]");
    if (!b) return;
    setTab(b.dataset.gtr);
  });
  var panel = document.createElement("div");
  panel.id = "gtrPanel";
  panel.className = "gtr-panel";
  panel.hidden = true;
  panel.innerHTML = '<div class="gtr-cards" id="gtrCards"></div>';
  panel.addEventListener("click", onPanelClick);
  wrap.appendChild(tabs);
  wrap.appendChild(panel);
  built = true;
  applyChrome();
  var laySeen = layoutOf(de().className);
  window.addEventListener("resize", function () {
    var lay = layoutOf(de().className);
    if (lay !== laySeen) { laySeen = lay; lastGrip = {}; paintGuitar(); }
  });
  paintGuitar();
}

export function gtrTabNow() { return tab; }
