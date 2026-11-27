// Expert Guitar tab. Draws the resolver's grips in the keyboard area and strums
// them through ChordAudio. Kids, Simple, and the Piano tab do not use this panel.
import { api as ChordAudio } from "../audio/index.js?v=2026.11.27.3";
import { unlock } from "../audio/unlock.js?v=2026.11.27.3";
import { activeKey } from "../keys.js?v=2026.11.27.3";
import { prog, magic } from "../songs/playback.js?v=2026.11.27.3";
import { guitar as guitarProfile } from "../instruments/profiles.js?v=2026.11.27.3";
import { resolveVoicings } from "../instruments/resolve.js?v=2026.11.27.3";
import { state } from "../state.js?v=2026.11.27.3";
import { Theory } from "../theory/index.js?v=2026.11.27.3";
import { accSym } from "../theory/spelling.js?v=2026.11.27.3";
import { computeSpec } from "./touch.js?v=2026.11.27.3";
import {
  GTR_TAB_KEY, readGtrTab, gtrTabReduce, cardSlots, layoutOf,
  chordSig, voicingLabel, cycleIndex, fretSlide, diagramModel
} from "./gtrmath.js?v=2026.11.27.3";

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

function diagramSvg(voicing, chord, o) {
  var model = diagramModel(voicing, guitarProfile.tuning, chord.rootPc);
  var S = model.marks.length, F = 4;
  var top = o.top || 16, side = o.side || 10, fh = o.fh, mk = o.mk || 11;
  var base = model.base;
  var left = side + (base > 1 ? 10 : 0);
  var gw = o.w - 2 * side - (base > 1 ? 10 : 0);
  var sg = S > 1 ? gw / (S - 1) : gw;
  var bot = o.bot != null ? o.bot : (o.strings ? 16 : 8);
  var H = top + F * fh + bot;
  var ink = o.ink, line = o.line, dot = o.dot, dotT = o.dotT, mute = o.mute;
  var Y = "#FFC23D", YT = "#2a231c";
  var r = Math.min(sg, fh) * 0.36;
  var g = '<svg class="gtr-diagram" width="100%" viewBox="0 0 ' + o.w + " " + H + '" role="img" aria-label="' + escapeAttr(o.label || "") + '">';
  if (model.nut) g += '<rect x="' + (left - 1) + '" y="' + (top - 4) + '" width="' + (gw + 2) + '" height="5" rx="1.5" fill="' + ink + '"/>';
  else g += '<line x1="' + left + '" x2="' + (left + gw) + '" y1="' + top + '" y2="' + top + '" stroke="' + line + '" stroke-width="1.5"/>' +
    '<text x="' + (left - 5) + '" y="' + (top + fh * 0.62) + '" font-size="10" text-anchor="end" fill="' + ink + '" font-family="Nunito, system-ui, sans-serif" font-weight="800">' + model.frLabel + "</text>";
  for (var fi = 1; fi <= F; fi++) g += '<line x1="' + left + '" x2="' + (left + gw) + '" y1="' + (top + fi * fh) + '" y2="' + (top + fi * fh) + '" stroke="' + line + '" stroke-width="1.5"/>';
  for (var si = 0; si < S; si++) {
    var sw = (1 + (S - 1 - si) * 0.25).toFixed(2);
    g += '<line x1="' + (left + si * sg) + '" x2="' + (left + si * sg) + '" y1="' + top + '" y2="' + (top + F * fh) + '" stroke="' + line + '" stroke-width="' + sw + '"/>';
  }
  for (var bi = 0; bi < model.barres.length; bi++) {
    var b = model.barres[bi];
    var yb = top + (b.fret - base + 0.5) * fh;
    var x0 = left + b.fromString * sg;
    var x1 = left + b.toString * sg;
    g += '<rect x="' + (x0 - r) + '" y="' + (yb - r) + '" width="' + (x1 - x0 + 2 * r) + '" height="' + (2 * r) + '" rx="' + r + '" fill="' + dot + '"/>';
    if (o.fing) g += '<text x="' + (x1 + r + 2) + '" y="' + (yb + r * 0.42) + '" font-size="' + (r * 1.15) + '" fill="' + mute + '" font-family="Nunito, system-ui, sans-serif" font-weight="800">' + b.finger + "</text>";
  }
  for (var mi = 0; mi < model.marks.length; mi++) {
    var m = model.marks[mi];
    var x = left + m.string * sg;
    if (m.kind === "mute") {
      g += '<text x="' + x + '" y="' + (top - 8) + '" font-size="' + mk + '" text-anchor="middle" fill="' + mute + '" font-family="Nunito, system-ui, sans-serif" font-weight="800">\u00d7</text>';
    } else if (m.kind === "open" || m.kind === "open-root") {
      if (m.kind === "open-root") g += '<circle cx="' + x + '" cy="' + (top - 11) + '" r="' + (mk * 0.36) + '" fill="' + Y + '"/>';
      else g += '<circle cx="' + x + '" cy="' + (top - 11) + '" r="' + (mk * 0.32) + '" fill="none" stroke="' + ink + '" stroke-width="1.6"/>';
    } else if (m.kind === "barre-root") {
      var ybr = top + (m.fret - base + 0.5) * fh;
      g += '<circle cx="' + x + '" cy="' + ybr + '" r="' + (r * 0.92) + '" fill="' + Y + '"/>';
    } else if (m.kind === "dot" || m.kind === "root") {
      var y = top + (m.fret - base + 0.5) * fh;
      var rootDot = m.kind === "root";
      g += '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + (rootDot ? Y : dot) + '"/>';
      if (o.fing && m.finger) g += '<text x="' + x + '" y="' + (y + r * 0.42) + '" font-size="' + (r * 1.15) + '" text-anchor="middle" fill="' + (rootDot ? YT : dotT) + '" font-family="Nunito, system-ui, sans-serif" font-weight="800">' + m.finger + "</text>";
    }
  }
  if (o.strings) {
    var names = guitarProfile.stringNames;
    for (var n = 0; n < names.length && n < S; n++) {
      g += '<text x="' + (left + n * sg) + '" y="' + (top + F * fh + 12) + '" font-size="10" text-anchor="middle" fill="' + mute + '" font-family="Nunito, system-ui, sans-serif" font-weight="700">' + names[n] + "</text>";
    }
  }
  return g + "</svg>";
}
function escapeAttr(s) { return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;"); }

function diaOpts(lay, slot, name) {
  var now = slot === "now";
  var land = lay === "phone-land" || lay === "pad-land";
  var pad = lay === "pad-port" || lay === "pad-land";
  var lite = now;
  var theme = lite
    ? { ink: "#2a231c", line: "#7a6c58", dot: "#2a231c", dotT: "#F3EAD8", mute: "#7a6c58" }
    : { ink: "#F3EAD8", line: "#8a7d69", dot: "#F3EAD8", dotT: "#2a231c", mute: "#9d917e" };
  var w = land ? (pad ? 150 : 86) : (now ? (pad ? 190 : 118) : (pad ? 120 : 84));
  var fh = land ? (pad ? 28 : 16) : (now ? (pad ? 36 : 21) : (pad ? 24 : 17));
  return Object.assign(theme, {
    w: w, fh: fh, mk: pad ? 13 : 11,
    top: pad ? 22 : 17, side: pad ? 14 : 11,
    fing: now, strings: now && (!land || pad), label: name
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
  if (!voicing || !voicing.midi || !voicing.midi.length) return;
  unlock();
  try { ChordAudio.ensure(); } catch (e) { return; }
  var t0 = ChordAudio.ctx ? ChordAudio.ctx.currentTime : 0;
  if (ChordAudio.stopChord) ChordAudio.stopChord("gtr", t0, 0.02);
  for (var i = 0; i < voicing.midi.length; i++) {
    ChordAudio.pluck(voicing.midi[i], { time: t0 + i * 0.02, sound: state.sound, group: "gtr" });
  }
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
  var cls = "gtr-card" + (slot === "now" ? " now" : slot === "next" ? " nx" : "");
  var body = '<div class="gtr-tx"><p class="gtr-lb">' + TAB_LABEL[slot] + '</p><p class="gtr-name">' + name + "</p>";
  if (slot === "now") {
    body += '<div class="gtr-vo"><button type="button" data-gtr-cycle="-1" aria-label="Previous shape">\u2039</button><span data-gtr-label>' +
      voicingLabel(v) + '</span><button type="button" data-gtr-cycle="1" aria-label="Next shape">\u203a</button></div>' +
      '<p class="gtr-meta">' + (index + 1) + " of " + grips.length + ' \u00b7 <b>\u25cf</b> root</p>';
  } else if (slot === "next") body += '<p class="gtr-tap">Tap to strum</p>';
  body += "</div>";
  var svg = diagramSvg(v, chord, opts);
  if (slide) svg = svg.replace('class="gtr-diagram"', 'class="gtr-diagram sliding" style="--gtr-dy:' + dy + '"');
  return '<div role="button" tabindex="0" class="' + cls + '" data-slot="' + slot + '" data-sig="' + sig + '">' + body + svg + "</div>";
}

export function paintGuitar(spec) {
  if (!built) return;
  applyChrome();
  if (!expertOn() || tab !== "guitar") return;
  var panel = document.getElementById("gtrCards");
  if (!panel) return;
  if (!spec) { try { spec = computeSpec(); } catch (e) { return; } }
  var lay = layoutOf(de().className);
  var key = activeKey();
  var keyId = key ? key.pc + ":" + key.mode : "";
  var keyChanged = lastKey != null && lastKey !== keyId;
  lastKey = keyId;
  var chords = cardChords(spec);
  var slots = cardSlots(lay);
  var html = "";
  for (var i = 0; i < slots.length; i++) html += cardHtml(slots[i], chords[slots[i]], lay, keyChanged);
  panel.innerHTML = html;
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
  tabs.innerHTML = '<button type="button" role="tab" data-gtr="piano">Piano</button><button type="button" role="tab" data-gtr="guitar">Guitar</button>';
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
