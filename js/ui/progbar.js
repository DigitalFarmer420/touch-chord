// Progression picker (#prog): placement, name fitting, Play / Next wiring.
import { unlock } from "../audio/unlock.js?v=112.12";
import { paintLoop } from "../loop.js?v=112.12";
import { progNext } from "../songs/magic.js?v=112.12";
import { progPlay, prog, progSet } from "../songs/playback.js?v=112.12";
import { progFeel, progSteps, progNumerals } from "../songs/presets.js?v=112.12";
import { state } from "../state.js?v=112.12";

// The picker: Simple = friendly name in the left column under Major / Minor; full mode =
// the numerals in a cycler by the style row (phone landscape: top of the Now column; other
// layouts: the top bar). Play/Stop sits inside it; full mode adds Next.
export function placeProg() {
  var el = document.getElementById("prog");
  if (!el) return;
  var de = document.documentElement;
  var nowCol = document.querySelector(".now-col");
  var where;
  if (state.simple) {
    where = "kid";
    var kid = document.getElementById("kidKey");
    if (el.previousElementSibling !== kid || el.parentNode !== nowCol) nowCol.insertBefore(el, kid.nextSibling);
  } else {
    // v60-v62: every full-mode layout: Now, Key, ‹ name ›, Next, Full Range (CSS order; the key
    // bar's two buttons join the column). v62: iPad and desktop too (no top-bar picker any more).
    where = "now";
    if (el.parentNode !== nowCol || el.previousElementSibling !== nowCol.querySelector(".key-bar")) nowCol.insertBefore(el, nowCol.querySelector(".key-bar").nextSibling);
  }
  el.dataset.at = where;
  de.classList.toggle("prog-top", where === "top");
  fitProgName();
}
export function paintProg() {
  paintLoop();   // v70: the Loop Play button shows Stop while the sequence autoplay runs
  var el = document.getElementById("prog");
  if (!el) return;
  var p = prog.list[prog.idx];
  var txt = el.querySelector(".pg-t");
  var name = p ? p.name : "";
  var num = p ? progNumerals(prog.steps.length ? prog.steps : progSteps(prog.key || { pc: 0, mode: "major" }, p)) : "";
  prog.label = { name: name, feel: progFeel(name), num: num };
  var sel = el.querySelector(".pg-sel");
  sel.setAttribute("aria-valuenow", String(prog.idx));
  sel.setAttribute("aria-valuemax", String(Math.max(0, prog.list.length - 1)));
  sel.setAttribute("aria-valuetext", name + " (" + prog.steps.map(function (s) { return s.roman; }).join(" ") + ")");
  sel.title = name + ": " + prog.steps.map(function (s) { return s.roman; }).join(" ");
  var ps = el.querySelector(".pg-song"), pon = !!prog.playing;   // v74: Play song shows Stop while the pass / random tail runs
  if (ps && PROG_PLAY_SVG && ps._on !== pon) {
    ps._on = pon;
    ps.innerHTML = pon ? PROG_STOP_SVG : PROG_PLAY_SVG;
    ps.classList.toggle("on", pon);
    ps.setAttribute("aria-pressed", pon ? "true" : "false");
    ps.setAttribute("aria-label", pon ? "Stop song" : "Play song");
    ps.title = pon ? "Stop" : "Play song: the whole song / progression, over and over";
  }
  fitProgName();
}
const PROG_PLAY_SVG = "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M7 4.5v15l12.5-7.5z\" fill=\"currentColor\"/></svg>";
const PROG_STOP_SVG = "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect x=\"6\" y=\"6\" width=\"12\" height=\"12\" rx=\"1.5\" fill=\"currentColor\"/></svg>";
// Name fits its box: shrink the font (not below 9 px full / 11 px Simple), up to 2 lines.
// True when a word of the label would have to break (a word wider than the name box).
function splitWord() {
  var el = document.getElementById("prog"), box = el.querySelector(".pg-txt"), t = el.querySelector(".pg-t");
  var probe = document.createElement("span");
  probe.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;font:inherit;letter-spacing:inherit";
  t.appendChild(probe);
  var words = (prog.label && prog.label.feel || "").split(" "), bad = false;
  for (var i = 0; i < words.length && !bad; i++) { probe.textContent = words[i]; if (probe.offsetWidth > box.clientWidth + 0.5) bad = true; }
  t.removeChild(probe);
  return bad;
}
// v112.5 (#6): short names for the narrow phone picker, used only when the full name won't fit one line at 11 px.
const SHORT_NAMES = { "Old MacDonald": "MacDonald", "Row Your Boat": "Row Boat", "Itsy Bitsy Spider": "Itsy Bitsy",
  "London Bridge": "London", "Hey Diddle Diddle": "Hey Diddle", "Head Shoulders Knees and Toes": "Shoulders", "Mary's Lamb": "Mary", "Island Skank": "Skank", "Minor Riddim": "Riddim",
  "Baa Baa Black Sheep": "Baa Baa", "Hickory Dickory Dock": "Hickory", "Hot Cross Buns": "Hot Buns", "Rhythm Changes": "Rhythm" };
function fitProgName() {
  var el = document.getElementById("prog");
  if (!el || !el.offsetParent) return;
  var box = el.querySelector(".pg-txt"), t = el.querySelector(".pg-t");
  t.style.fontSize = "";
  t.style.letterSpacing = "";
  t.style.whiteSpace = "";
  t.style.lineHeight = "";
  t.style.position = t.style.top = "";
  // v60: a wide name area (iPad, desktop) shows "Jazz Turnaround" with small numerals under it;
  // a narrow one (phones) shows the feel only, on one line when it fits. Width-based, no UA checks.
  var L = prog.label || { name: "", feel: "", num: "" };
  var wide = box.clientWidth >= 150;   // v62: 150 (iPad portrait / 1024 rails are ~151-176; phones <= 144)
  el.classList.toggle("pg-wide", wide);
  if (wide) {
    t.innerHTML = "";
    var a = document.createElement("span"); a.className = "pg-nm"; a.textContent = L.name;
    t.appendChild(a);
    // Simple (for kids): the name only, no numerals.
    if (!state.simple) { var b = document.createElement("span"); b.className = "pg-num"; b.textContent = L.num; t.appendChild(b); }
  } else {
    t.textContent = L.feel;
    t.style.whiteSpace = "nowrap";
    var fs1 = parseFloat(getComputedStyle(t).fontSize) || 14;
    // v62: full mode on phones: the feel label as large as the name box allows, up to 13 px on one
    // line; two-word labels may wrap onto two lines at up to 12 px. Never smaller than before.
    if (!state.simple && fs1 < 13) {
      var base = fs1, bw0 = box.clientWidth + 0.5, bh0 = box.clientHeight + 0.5;
      // v112.5 (#6): one line at 11-13 px first; a name too long for that shows its short phone name
      // ("Old MacDonald" -> "MacDonald") before it may wrap. The full name stays in the picker's aria-label.
      var cands = [L.feel]; if (SHORT_NAMES[L.feel]) cands.push(SHORT_NAMES[L.feel]);
      for (var wi = 0; wi < cands.length; wi++) {
        t.textContent = cands[wi];
        for (var g1 = 13; g1 > 10.99; g1 -= 0.5) { t.style.fontSize = g1 + "px"; if (t.scrollWidth <= bw0 && t.offsetHeight <= bh0) return; }
      }
      t.textContent = L.feel; t.style.fontSize = "";
      // Two words: one line down to 11 px, then two lines (larger) before a smaller single line.
      var multi = L.feel.indexOf(" ") >= 0, low = multi ? Math.max(base, 11) - 0.01 : base;
      for (var g = 13; g > low; g -= 0.5) { t.style.fontSize = g + "px"; if (t.scrollWidth <= bw0 && t.offsetHeight <= bh0) return; }
      if (L.feel.indexOf(" ") >= 0) {
        t.style.whiteSpace = "";
        // v63: two lines only with >= 2 px clear of the picker border (glyph bounds, not line boxes);
        // tight line-height where the picker is short (phone landscape).
        var selEl = el.querySelector(".pg-sel"), selR = selEl.getBoundingClientRect(), bT = selEl.clientTop;
        function clear2() {
          var rg = document.createRange(); rg.selectNodeContents(t); var q = rg.getBoundingClientRect();
          return q.top >= selR.top + bT + 2 - 0.01 && q.bottom <= selR.bottom - bT - 2 + 0.01;
        }
        function ok2(g) { return t.scrollWidth <= bw0 && t.offsetHeight <= bh0 && t.offsetHeight <= g * 1.12 * 2 + 1 && !splitWord() && clear2(); }
        // v64: centre the two lines on the picker exactly (the line box lands on whole pixels).
        function centre() {
          t.style.position = t.style.top = "";
          var rg = document.createRange(); rg.selectNodeContents(t); var q = rg.getBoundingClientRect();
          var d = ((selR.bottom - bT - q.bottom) - (q.top - selR.top - bT)) / 2;
          if (Math.abs(d) > 0.05) { t.style.position = "relative"; t.style.top = d.toFixed(2) + "px"; }
        }
        var lhs = ["", "1"];
        for (var lh = 0; lh < 2; lh++) {
          t.style.lineHeight = lhs[lh];
          for (g = 12; g > 10.99; g -= 0.5) { t.style.fontSize = g + "px"; if (ok2(g)) return; }
        }
        // v64: a short picker (phone landscape, 26 px) holds two lines at >= 10.5 px only with a
        // line-height under 1: the glyph boxes overlap, the ink does not.
        var tight = ["0.9", "0.85", "0.8", "0.75"];
        for (g = 12; g > 10.99; g -= 0.5) {
          t.style.fontSize = g + "px";
          for (var ti = 0; ti < tight.length; ti++) { t.style.lineHeight = tight[ti]; centre(); if (ok2(g)) return; }
        }
        t.style.position = t.style.top = "";
        for (lh = 0; lh < 2; lh++) {
          t.style.lineHeight = lhs[lh];
          for (g = 11; g > Math.max(base, 11) - 0.01; g -= 0.5) { t.style.fontSize = g + "px"; if (ok2(g)) return; }
        }
        t.style.lineHeight = "";
        t.style.whiteSpace = "nowrap";
        for (g = Math.max(base, 11) - 0.5; g > base; g -= 0.5) { t.style.fontSize = g + "px"; if (t.scrollWidth <= bw0) return; }
      }
      t.style.fontSize = "";
    }
    while (fs1 > 11 && t.scrollWidth > box.clientWidth + 0.5) { fs1 = Math.max(11, fs1 - 0.5); t.style.fontSize = fs1 + "px"; }
    if (t.scrollWidth <= box.clientWidth + 0.5) return;
    // One word (e.g. "Turnaround") must not break mid-word: tighten, then an 8.5 px floor.
    if (L.feel.indexOf(" ") < 0) {
      var lsx = [-0.02, -0.04, -0.06];
      for (var li = 0; li < lsx.length; li++) { t.style.letterSpacing = lsx[li] + "em"; if (t.scrollWidth <= box.clientWidth + 0.5) return; }
      t.style.fontSize = "11px";
      if (t.scrollWidth <= box.clientWidth + 0.5) return;
      t.style.letterSpacing = "";
    }
    t.style.whiteSpace = "";
    t.style.fontSize = "";
  }
  if (state.simple && !wide) t.style.whiteSpace = "nowrap";   // v112.5 (#6): Simple phone names stay on one line
  var fs = parseFloat(getComputedStyle(t).fontSize) || 14, floor = 11;   // v112.5 (#8): no text under 11 px
  function over() { return t.scrollWidth > box.clientWidth + 0.5 || t.offsetHeight > box.clientHeight + 0.5; }
  while (fs > floor && over()) {
    fs = Math.max(floor, fs - 0.5);
    t.style.fontSize = fs + "px";
  }
  // v112.5 (#6): still too big (e.g. Simple, "Head Shoulders Knees and Toes"): the short name, refit from the top.
  if (over() && !wide && SHORT_NAMES[L.feel]) {
    t.textContent = SHORT_NAMES[L.feel]; t.style.fontSize = ""; fs = parseFloat(getComputedStyle(t).fontSize) || 14;
    while (fs > floor && over()) { fs = Math.max(floor, fs - 0.5); t.style.fontSize = fs + "px"; }
  }
  // v57: the longest name (Smooth, 5 chords) at the floor: tighten, then 8.5px rather than clip.
  if (over()) t.style.letterSpacing = "-0.03em";
  if (over() && !state.simple) t.style.fontSize = "11px";
}
export function wireProg() {
  var el = document.getElementById("prog");
  if (!el) return;
  var sel = el.querySelector(".pg-sel"), txt = el.querySelector(".pg-t");
  function step(d) {
    unlock();
    progSet(prog.idx + d);
    txt.classList.remove("nudge-l", "nudge-r");
    void txt.offsetWidth;
    // v112.6: the nudge only moves the name as far as the free space beside it, so a name that fills the box
    // is never pushed past the box edge (it was clipped without an ellipsis mid-animation).
    var bx = el.querySelector(".pg-txt"), rg = document.createRange(); rg.selectNodeContents(txt);
    var free = (bx.getBoundingClientRect().width - rg.getBoundingClientRect().width) / 2;
    txt.style.setProperty("--pg-nudge", Math.max(0, Math.min(8, Math.floor(free))) + "px");
    txt.classList.add(d > 0 ? "nudge-r" : "nudge-l");
    setTimeout(function () { txt.classList.remove("nudge-l", "nudge-r"); }, 140);
  }
  el.querySelector(".pg-step").addEventListener("click", function () { unlock(); progNext(); });
  // v74: Play song = the progression / uploaded song once through (song BPM when a song is
  // selected), then the random tail; tap again to stop. The Loop tab's Play stays the phrase loop.
  el.querySelector(".pg-song").addEventListener("click", function () { unlock(); progPlay(); });
  // v56: the whole row swipes, arrows included. A tap on an arrow steps once; a horizontal drag
  // past the threshold steps once (and is not also a tap). One step per gesture.
  var drag = null;
  sel.addEventListener("pointerdown", function (e) {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    // Tap zones: each arrow plus its half of the row (v112.5: was the outer 30%; the middle did nothing on a tap).
    var arrow = e.target.closest ? e.target.closest(".pg-arrow") : null, r = sel.getBoundingClientRect();
    var side = arrow ? (arrow.classList.contains("pg-prev") ? -1 : 1)
      : e.clientX < r.left + r.width * 0.5 ? -1 : 1;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, done: false,
      arrow: side, unit: Math.max(24, Math.min(40, sel.clientWidth / 6)) };
    try { sel.setPointerCapture(e.pointerId); } catch (err) {}
  });
  sel.addEventListener("pointermove", function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    e.preventDefault();
    var dx = e.clientX - drag.x;
    if (Math.abs(dx) > 8 || Math.abs(e.clientY - drag.y) > 8) drag.moved = true;
    if (!drag.done && Math.abs(dx) >= drag.unit) { drag.done = true; step(dx > 0 ? 1 : -1); }
  });
  function end(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var d = drag;
    drag = null;
    if (e.type === "pointerup" && !d.done && !d.moved && d.arrow) step(d.arrow);
  }
  sel.addEventListener("pointerup", end);
  sel.addEventListener("pointercancel", end);
  sel.addEventListener("touchmove", function (e) { e.preventDefault(); }, { passive: false });
  sel.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); step(1); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); step(-1); }
    else if (e.key === " " || e.key === "Enter") { e.preventDefault(); unlock(); progNext(); }
  });
  window.addEventListener("resize", function () { setTimeout(fitProgName, 80); });
  if (typeof ResizeObserver === "function") new ResizeObserver(function () { fitProgName(); }).observe(el.querySelector(".pg-txt"));
  placeProg();
  paintProg();
}
