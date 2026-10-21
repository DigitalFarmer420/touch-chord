// Next-chord marks: lookahead, next hint arrow, Kids gold pad / key.
import { paintKidChip } from "../kids.js?v=112.10";
import { magicTarget, magicQueue, magicAdvance } from "../songs/magic.js?v=112.10";
import { magic, setItemState, prog, PROG_TEST, placeBadges, progPlayStart } from "../songs/playback.js?v=112.10";
import { upSelected, upNextStep } from "../songs/song.js?v=112.10";
import { state, padsEl } from "../state.js?v=112.10";
import { wrap12 } from "../theory/quality.js?v=112.10";
import { kbUpdate, kidsSoloSpec } from "./keyboard.js?v=112.10";
import { paintKidsLyr } from "./lyrics.js?v=112.10";
import { computeSpec, highlightMidisFromSpec } from "./pads.js?v=112.10";
import { kidsTapPulse, kidsTapLog } from "./pulse.js?v=112.10";
import { paintSongBar } from "./songbar.js?v=112.10";
// v99: full mode (not Kids, not Simple, not an uploaded song, which has its own next-chord outline):
// mark the grid cell of the chord Play would sound right now. Stopped: Play starts at step 1. Playing: the
// step after the lit one (none in the random part after one pass). No mark when that step has no grid
// cell, or when it is the cell that is playing now.
var laEl;
var laT;
export function laTarget() {
  var n = prog.steps.length;
  if (!n || state.style === "kids" || state.simple || upSelected()) return null;
  var start = prog.playing ? (prog.cur >= 0 ? prog.cur + 1 : prog.si) : progPlayStart();   // v111: Play starts at the Next walk position
  if (start >= n) start = 0;   // v111: loops
  var t = prog.targets[start] || null;
  if (!t || !t.isConnected || !t.getClientRects().length || getComputedStyle(t).visibility === "hidden") return null;
  var now = prog.cur >= 0 ? prog.targets[prog.cur] : (magic.lit ? magicTarget(magic.item) : null);
  if (t === now || t.classList.contains("pg-on")) return null;
  return t;
}
export function paintLookahead() {
  var t = laTarget();
  if (laEl && laEl !== t) laEl.classList.remove("la-play");
  if (t) t.classList.add("la-play");
  laEl = t;
  nxMarkSoon();   // v105
}
// v105: the NEXT chord = what Next / Play sounds next. Kids: the gold step. Uploaded song: its next step.
// Presets: playing = the step after the lit one (none in the random part); stopped = the queued Next chord.
export function nxNow() {
  if (typeof magic === "undefined" || !magic || !prog.steps.length) return null;
  var item = null, el = null, sig = "", n = prog.steps.length;
  if (state.style === "kids") {
    item = kidsHintItem();
    if (!item) return null;
    el = kidsGoldPadEl(item);
    sig = "k" + (prog.playing ? "p" + prog.cur : "n" + magic.pos);
  } else if (upSelected()) {
    var i = upNextStep();
    if (i < 0) return null;
    item = prog.steps[i].item; el = prog.targets[i] || magicTarget(item);
    sig = "u" + i + (prog.playing ? "p" + prog.cur : "n" + magic.pos);
  } else if (prog.playing) {
    var j = prog.cur >= 0 ? prog.cur + 1 : prog.si;
    if (j >= n) j = 0;   // v111: Play song loops (no random tail)
    item = prog.steps[j].item; el = prog.targets[j] || magicTarget(item);
    sig = "p" + j + "c" + prog.cur;
  } else {
    var d = magicQueue();
    if (!d || !d.item) return null;
    item = d.item; el = d.step >= 0 && prog.targets[d.step] ? prog.targets[d.step] : magicTarget(item);
    sig = "q" + d.step + "m" + magic.pos + "c" + (magic.cycle || 0) + ":" + item.rootPc + item.type;
  }
  if (el && (!el.isConnected || !el.getClientRects().length)) el = null;
  return { item: item, el: el, sig: sig + "|" + prog.idx + "|" + state.style + "|" + (state.simple ? 1 : 0) };
}
function nxTableEls(item) {
  var out = [];
  if (!item) return out;
  var tb = document.querySelector("#palette button[data-type=\"" + item.type + "\"]");
  if (tb && tb.getClientRects().length) out.push(tb);
  var ex = item.extensions || {};
  for (var k in ex) if (ex[k]) { var eb = document.querySelector("#palette button[data-ext=\"" + k + "\"]"); if (eb && eb.getClientRects().length) out.push(eb); }
  return out;
}
export function nxKeyEl(item) {
  if (!item || state.simple) return null;
  var k = padsEl.querySelector(".pad.nx-root");
  if (k) return k;
  var pc = wrap12(state.style === "kids" && item.mel != null ? item.rootPc : item.rootPc), best = null;
  Array.prototype.forEach.call(padsEl.querySelectorAll(".pad"), function (p) {
    if (wrap12(+p.dataset.pc) !== pc || p.classList.contains("out") || !p.getClientRects().length) return;
    if (!best || +p.dataset.midi < +best.dataset.midi) best = p;
  });
  return best;
}
export var nxSigLast;
var nxT;
export var nxBursts;
var nxReduce;
export function nxBurst(el) {
  if (!el) return;
  el.classList.remove("nxb");
  void el.offsetWidth;
  el.classList.add("nxb");
  clearTimeout(el._nxb);
  el._nxb = setTimeout(function () { el.classList.remove("nxb"); }, 560);
}
export function paintNxMark() {
  nxT = 0;
  var cur = nxNow(), dots = [];
  if (cur) {
    if (cur.el && !(state.style === "kids" && cur.el.classList.contains("ss-kidpad"))) dots.push(cur.el);   // Kids pads already carry this dot (v71)
    dots = dots.concat(nxTableEls(cur.item));
  }
  Array.prototype.forEach.call(document.querySelectorAll(".nxdot"), function (n) { if (dots.indexOf(n) < 0) { n.classList.remove("nxdot"); var d = n.querySelector(":scope > .nxd"); if (d) d.remove(); } });
  dots.forEach(function (n) {
    n.classList.add("nxdot");
    if (!n.querySelector(":scope > .nxd")) { var d = document.createElement("i"); d.className = "nxd"; d.setAttribute("aria-hidden", "true"); n.appendChild(d); }
  });
  var sig = cur ? cur.sig + "|" + (cur.item.rootPc + ":" + cur.item.type) : "";
  if (sig && sig !== nxSigLast && !(nxReduce && nxReduce.matches)) {
    nxBursts++;
    nxBurst(nxKeyEl(cur.item));
    nxTableEls(cur.item).forEach(nxBurst);
    nxBurst(cur.el);
  }
  nxSigLast = sig;
}
export function nxMarkSoon() { if (!nxT) nxT = setTimeout(paintNxMark, 0); }
export function paintProgActive() {
  Array.prototype.forEach.call(document.querySelectorAll("#suggest .pg-on"), function (n) { n.classList.remove("pg-on"); });
  var t = prog.cur >= 0 ? prog.targets[prog.cur] : (magic.lit ? magicTarget(magic.item) : null);
  if (t) t.classList.add("pg-on");
  prog.badges.forEach(function (b) { b.el.classList.toggle("on", prog.cur >= 0 && b.steps.indexOf(prog.cur) >= 0); });
  if (prog.badges.some(function (b) { return b.steps.length > 2; })) placeBadges();
  paintKidChip();
  paintSongBar();   // Upload: song bar + review flags
  paintKidsLyr();   // v97
  paintNextHint();   // v71: Kids next-note hint advances with each step; first-load fix: every style (Stop / song pick / ring end repaint the keys)
  paintLookahead(); if (!laT) laT = setTimeout(function () { laT = 0; paintLookahead(); }, 0);   // v99 (again once the strip is laid out)
}
// v68 "next chord" hint (full mode only): a soft pulsing gold outline on the exact keys the
// next Next tap will play, a gold dot on its root key, the same outline on its strip chip,
// and a small gold edge arrow if an outlined key is off-screen. Shown from a Next / badge tap
// until that chord's ring ends (or Simple / the loop player takes over).
export function nextHintSpec(item) {
  var ext = {}, k;
  for (k in state.extensions) ext[k] = state.extensions[k];
  var keep = { rootPc: state.rootPc, type: state.type, stripSpell: state.stripSpell, forceChord: state.forceChord, degree: state.degree };
  setItemState(item);
  var spec = computeSpec();
  for (k in ext) state.extensions[k] = ext[k];
  for (k in keep) state[k] = keep[k];
  return spec;
}
function clearNextHintDom() {
  Array.prototype.forEach.call(document.querySelectorAll(".nx, .nx-root"), function (n) { n.classList.remove("nx", "nx-root"); });
  var a = document.getElementById("nxArrow");
  if (a) a.hidden = true;
}
export function magicHintClear() {
  if (magic) magic.hint = false;
  clearNextHintDom();
  paintNextHint();   // v71: the Kids song hint stays until the pass ends; first-load fix: the next chord stays marked in every style
}
// v71 Kids: the UPCOMING song step (Next walk or Play's one pass) is outlined on BOTH the
// keyboard (its single root key, full mode; Simple has no keyboard) and the matching one of
// the seven chord pads, plus the big Now chip in full mode. Shown from the start of the song,
// advances every step, clears when the song pass ends (random part) or Kids is left.
export function kidsHintItem() {
  if (!prog.steps.length) return null;
  if (prog.playing) {
    var nx = prog.cur >= 0 ? (prog.cur + 1) % prog.steps.length : prog.si % prog.steps.length;   // v82: Kids Play loops; v111: before the first step, Play's start step
    return prog.steps[nx].item;
  }
  var d = magicQueue();
  return d && d.step >= 0 ? d.item : null;
}
function paintKidsHint() {
  if (kbUpdate()) return;   // v83: the window moved; the rebuild already painted the gold
  var item = kidsHintItem();
  if (!item) return;
  var gp = kidsGoldPadEl(item);
  if (gp) gp.classList.add("nx", "nx-root");
  var outlined = [];
  if (!state.simple) {
    var chip = document.querySelector("#suggest .ss-kid");
    if (chip) chip.classList.add("nx");
    var gk = kidsGoldKeyEl(item);
    if (gk) { gk.classList.add("nx", "nx-root"); outlined.push(gk); }
  }
  nextHintArrow(outlined);
}
// The gold pad: the pad with the step's root and major/minor; v79: if no pad has that
// quality (a major V in a minor key: the pad is the minor v), the pad with that root.
function kidsGoldPadEl(item) {
  var pads = document.querySelectorAll("#suggest .ss-kidpad"), byRoot = null;
  for (var i = 0; i < pads.length; i++) {
    var it = pads[i]._tc && pads[i]._tc.item;
    if (!it || wrap12(it.rootPc) !== wrap12(item.rootPc)) continue;
    if ((it.type === "minor") === (item.type === "minor")) return pads[i];
    if (!byRoot) byRoot = pads[i];
  }
  return byRoot;
}
// The gold key: the keyboard key that shows the step's song note (the same key the hint paints).
function kidsGoldKeyEl(item) {
  var spec = kidsSoloSpec(nextHintSpec(item), item.rootPc, item.mel);
  var mids = highlightMidisFromSpec(spec.midis);
  var keys = padsEl.querySelectorAll(".pad");
  for (var k = 0; k < keys.length; k++) {
    if (!mids[keys[k].dataset.midi] || keys[k].classList.contains("out")) continue;
    return keys[k];
  }
  return null;
}
// v79 Kids tap-to-advance: tapping the gold PAD (that chord pad) or the gold KEY (that exact
// MIDI key) plays the step's single song note and moves the walk on, exactly like Next
// (magicAdvance). Repeated notes advance too. After the last step the walk goes back to the
// start. Not during Play song (its timer owns the walk). Any other tap: unchanged (chord).
export function kidsGoldStep() {
  if (state.style !== "kids" || state.playAlong === false || prog.playing || !prog.steps.length || typeof magic === "undefined" || !magic) return null;   // v108: off = sound only
  var d = magicQueue();
  return d && d.step >= 0 && d.item ? d : null;
}
export function kidsGoldPad(b) {
  if (!b || !b.classList.contains("ss-kidpad") || !b._tc) return false;
  var d = kidsGoldStep();
  return !!(d && kidsGoldPadEl(d.item) === b);
}
export function kidsGoldKey(pad) {   // v108: the gold key's note in ANY octave (pitch class), not only the gold key itself
  if (!pad || state.simple || pad.dataset.midi == null || pad.dataset.midi === "") return false;
  var d = kidsGoldStep();
  var gk = d ? kidsGoldKeyEl(d.item) : null;
  return !!(gk && wrap12(Number(pad.dataset.midi)) === wrap12(Number(gk.dataset.midi)));
}
export function kidsGoldGo(el, kind) {
  var d = kidsGoldStep();
  if (!d) return;
  var last = d.step === prog.steps.length - 1;
  magicAdvance();   // plays the single song note (kidsSolo), queues and paints the next gold (v81: wraps like Next)
  if (PROG_TEST) kidsTapLog.taps.push({ kind: kind, step: d.step, pos: magic.pos, wrap: last });
  kidsTapPulse(el);
  Array.prototype.forEach.call(document.querySelectorAll("#suggest .ss-kidpad.nx-root, #pads .pad.nx-root"), function (n) { if (n !== el) kidsTapPulse(n); });
}
export function paintNextHint() {
  nxMarkSoon();   // v105
  clearNextHintDom();
  if (typeof magic === "undefined" || !magic) return;
  if (state.style === "kids") { paintKidsHint(); return; }
  if (!magic || state.simple || prog.playing) return;   // first-load fix: no magic.hint gate (it was only set by a Next / badge tap)
  var d = magicQueue();
  if (!d) return;
  if (upSelected() && upNextStep() < 0) return;   // v73 (v111: never true now, the song loops)
  var spec = nextHintSpec(d.item);
  if (state.style === "kids") spec = kidsSoloSpec(spec, d.item.rootPc, d.item.mel);   // v70: Kids plays the root only
  var mids = highlightMidisFromSpec(spec.midis);
  var pads = padsEl.querySelectorAll(".pad"), seen = {}, root = null, outlined = [];
  for (var i = 0; i < pads.length; i++) {
    var m = pads[i].dataset.midi;
    if (!mids[m] || seen[m] || pads[i].classList.contains("out")) continue;
    seen[m] = true;
    pads[i].classList.add("nx");
    outlined.push(pads[i]);
    if (wrap12(Number(m)) === wrap12(d.item.rootPc) && (!root || Number(m) < Number(root.dataset.midi))) root = pads[i];
  }
  if (root) root.classList.add("nx-root");
  var chip = state.style === "kids" ? document.querySelector("#suggest .ss-kid") : magicTarget(d.item);
  if (chip) chip.classList.add("nx");
  nextHintArrow(outlined);
}
function nextHintArrow(els) {
  var a = document.getElementById("nxArrow");
  if (!a) return;
  var vw = window.innerWidth, vh = window.innerHeight, wrap = padsEl.getBoundingClientRect();
  var L = Math.max(0, wrap.left), R = Math.min(vw, wrap.right), T = Math.max(0, wrap.top), B = Math.min(vh, wrap.bottom);
  var dir = null, at = 0;
  els.forEach(function (e) {
    if (dir) return;
    var r = e.getBoundingClientRect();
    if (r.right <= L + 4) { dir = "left"; at = (Math.max(T, r.top) + Math.min(B, r.bottom)) / 2; }
    else if (r.left >= R - 4) { dir = "right"; at = (Math.max(T, r.top) + Math.min(B, r.bottom)) / 2; }
    else if (r.bottom <= T + 4) { dir = "up"; at = (Math.max(L, r.left) + Math.min(R, r.right)) / 2; }
    else if (r.top >= B - 4) { dir = "down"; at = (Math.max(L, r.left) + Math.min(R, r.right)) / 2; }
  });
  if (!dir) { a.hidden = true; return; }
  a.className = "nx-arrow " + dir;
  a.textContent = { left: "\u25C0", right: "\u25B6", up: "\u25B2", down: "\u25BC" }[dir];
  a.style.left = a.style.top = "";
  if (dir === "left") { a.style.left = (L + 2) + "px"; a.style.top = (at - 11) + "px"; }
  else if (dir === "right") { a.style.left = (R - 24) + "px"; a.style.top = (at - 11) + "px"; }
  else if (dir === "up") { a.style.top = (T + 2) + "px"; a.style.left = (at - 11) + "px"; }
  else { a.style.top = (B - 24) + "px"; a.style.left = (at - 11) + "px"; }
  a.hidden = false;
}

// Boot step (runs once, in the original v112.3 order, from main.js)
export function boot() {
laEl = null;
  laT = 0;
nxSigLast = "";
  nxT = 0;
  nxBursts = 0;
nxReduce = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
}
