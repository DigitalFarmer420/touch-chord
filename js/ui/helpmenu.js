// rd17 (Uiux, one home per control): in Simple and Expert the "?" circle (#howtoBtn, #xHelp) is the one home for help.
// A tap opens a tiny menu under it with "How to" (the How to dialog) and "Tour" (the first-launch tour, #tourBtn).
// Kids has no "?": its Settings sheet keeps "How to & tour" (modesheet.js calls openHowto directly).
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
function place() {
  var r = anchor.getBoundingClientRect();
  menu.style.top = Math.round(r.bottom + 6) + "px";
  menu.style.right = Math.max(6, Math.round((window.tcVW ? window.tcVW() : window.innerWidth) - r.right)) + "px";
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
