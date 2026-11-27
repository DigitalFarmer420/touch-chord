// rd17 (Uiux, one home per control): in Simple and Expert the "?" circle (#howtoBtn, #xHelp) is the one home for help.
// A tap opens a tiny menu under it with "How to" (the How to dialog) and "Tour" (the first-launch tour, #tourBtn).
// Kids has no "?": its Settings sheet keeps "How to & tour" (modesheet.js calls openHowto directly).
import { fitPopover } from "../expert/model.js?v=2026.11.27.24";
var menu = null, anchor = null;
export const helpLog = { opens: 0, picks: [] };
function $(id) { return document.getElementById(id); }
export function openHowto() {
  var ht = $("howto"); if (!ht) return;
  ht.hidden = false;
  var x = ht.querySelector(".ht-x"); if (x) x.focus();
}
function build() {
  menu = document.createElement("div");
  menu.id = "helpMenu"; menu.className = "help-menu"; menu.setAttribute("role", "menu"); menu.setAttribute("aria-label", "Help"); menu.hidden = true;
  menu.innerHTML = "<button type=\"button\" role=\"menuitem\" data-help=\"howto\">How to</button><button type=\"button\" role=\"menuitem\" data-help=\"tour\">Tour</button>";
  document.body.appendChild(menu);
  menu.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-help]"); if (!b) return;
    var what = b.dataset.help; helpLog.picks.push(what);
    closeHelpMenu();
    if (what === "howto") openHowto(); else { var t = $("tourBtn"); if (t) t.click(); }
  });
  document.addEventListener("pointerdown", function (e) {
    if (!menu.hidden && !menu.contains(e.target) && !(anchor && anchor.contains(e.target))) closeHelpMenu();
  }, true);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !menu.hidden) { closeHelpMenu(); if (anchor) anchor.focus({ preventScroll: true }); } });
  window.addEventListener("resize", function () { if (!menu.hidden) place(); });
}
function shownRect(el) {
  if (!el || el.hidden || (el.closest && el.closest("[hidden]"))) return null;
  var s = getComputedStyle(el);
  if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) return null;
  var r = el.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return null;
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
}
function bandEdges() {
  var bars = [document.getElementById("xTop"), document.querySelector("header.topbar")], i, r, top = 0;
  for (i = 0; i < bars.length; i++) { r = shownRect(bars[i]); if (r) { top = r.bottom; break; } }
  var kb = shownRect(document.querySelector(".kb-wrap"));
  var bottom = window.tcVH ? window.tcVH() : window.innerHeight;
  if (kb) bottom = kb.top;
  return { top: top, bottom: bottom };
}
// Place a popover in the band between the top bar and the piano.
// cover "content": clear every control outside the chord grid (the How to menu has no scrim).
// cover "scrim": clear the opener, the Song | Progressions toggle (it sits above the scrim), and the piano.
// shiftX false keeps the element's own left/width (the key sheet's side insets).
export function placeInBand(el, opener, opt) {
  if (!el || !opener) return null;
  opt = opt || {};
  var ar = shownRect(opener) || opener.getBoundingClientRect();
  var band = bandEdges();
  var keep = [];
  var openerRect = shownRect(opener);
  if (openerRect) keep.push(openerRect);
  var kb = shownRect(document.querySelector(".kb-wrap"));
  if (kb) keep.push(kb);
  if (opt.cover === "scrim") {
    var tog = shownRect(document.getElementById("xTog"));
    if (tog) keep.push(tog);
  } else {
    var nodes = document.querySelectorAll("button, [role='tab']"), n, r;
    for (var i = 0; i < nodes.length; i++) {
      n = nodes[i];
      if (n === opener || el.contains(n)) continue;
      if (n.closest && (n.closest("#suggest") || n.closest(".kb-wrap"))) continue;
      r = shownRect(n);
      if (r) keep.push(r);
    }
  }
  var box = el.getBoundingClientRect();
  var width = el.offsetWidth || box.width;
  var height = el.scrollHeight || box.height;
  var placed = fitPopover({
    anchor: { left: ar.left, top: ar.top, right: ar.right, bottom: ar.bottom },
    bandTop: band.top, bandBottom: band.bottom,
    viewW: window.tcVW ? window.tcVW() : window.innerWidth,
    width: width, height: height, align: opt.align || "start", keepClear: keep,
    lockX: !opt.shiftX, lockLeft: box.left
  });
  if (opt.shiftX) { el.style.left = placed.left + "px"; el.style.right = "auto"; }
  el.style.top = placed.top + "px";
  el.style.bottom = "auto";
  el.style.maxHeight = placed.maxHeight + "px";
  if (opt.snapRows) snapRows(el, opt.snapRows, placed.maxHeight);
  pullInside(el, band.bottom);
  return placed;
}
// Whole rows only, measured from the row that is actually painted. A cut row would hang into the piano.
function snapRows(el, sel, room) {
  var rows = el.querySelectorAll(sel);
  if (!rows.length || !(room > 0)) return;
  var rowH = rows[0].offsetHeight;
  if (!(rowH > 0)) return;
  var cs = getComputedStyle(el);
  var pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
  var full = pad + rowH * rows.length;
  if (full <= room + 0.5) return;
  var n = Math.max(1, Math.floor((room - pad) / rowH));
  var h = Math.min(room, pad + rowH * n);
  el.style.maxHeight = Math.floor(h) + "px";
}
// A button whose centre is still inside the popover must not stick out of the band (the overlap check uses the layout box).
function pullInside(el, limit) {
  var pass, buttons, i, box, r, mid, spill, mh;
  for (pass = 0; pass < 4; pass++) {
    box = el.getBoundingClientRect();
    buttons = el.querySelectorAll("button");
    spill = 0;
    for (i = 0; i < buttons.length; i++) {
      r = buttons[i].getBoundingClientRect();
      mid = (r.top + r.bottom) / 2;
      if (mid >= box.top && mid <= box.bottom && r.bottom > limit) spill = Math.max(spill, r.bottom - limit);
    }
    if (spill <= 0.5) return;
    mh = Math.floor(box.height - spill);
    if (!(mh > 0)) return;
    el.style.maxHeight = mh + "px";
  }
}
function place() {
  // The How to menu has no scrim, so every control outside the chord grid stays tappable and must stay clear.
  placeInBand(menu, anchor, { cover: "content", align: "end", shiftX: true });
}
export function helpMenuOpen() { return !!menu && !menu.hidden; }
export function closeHelpMenu() {
  if (!menu || menu.hidden) return;
  menu.hidden = true;
  if (anchor) anchor.setAttribute("aria-expanded", "false");
}
export function toggleHelpMenu(btn) {
  if (!menu) build();
  if (!menu.hidden && anchor === btn) { closeHelpMenu(); return; }
  if (anchor && anchor !== btn) anchor.setAttribute("aria-expanded", "false");
  anchor = btn; btn.setAttribute("aria-haspopup", "menu"); btn.setAttribute("aria-expanded", "true");
  menu.hidden = false; helpLog.opens++;
  place();
  var f = menu.querySelector("button"); if (f) f.focus({ preventScroll: true });
}
if (typeof location !== "undefined" && /[?&]test=1(&|$)/.test(location.search)) window.__help = { log: helpLog, open: helpMenuOpen };
