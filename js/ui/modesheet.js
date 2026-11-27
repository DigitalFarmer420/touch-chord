// rd6 (Uiux mockup touchchord-review/modes/mock.html): one mode chip and one Settings sheet for Kids, Simple and Expert.
//   - The chip sits at the top right next to "?" in every mode and is labelled with the mode (★ Kids, ◐ Simple, ◆ Expert).
//     In Kids it opens only after a 1-second press-and-hold (a filling bar shows the progress; a short tap only shows a
//     small "hold" tip). In Simple and Expert one tap opens it.
//   - The sheet is the same in every mode, in this order: Mode (Kids / Simple / Expert, a short hint under each), then
//     Playing: Play along, Show hints, Chord numbers, Look (Auto · Day · Lamp), [Kids only (rd17): How to & tour],
//     Start over. Rows drive the app's own controls (#playAlongBtn, #paHintsBtn, #progNumsBtn, #tourBtn; How to opens
//     the How to dialog), so nothing behaves differently from before.
// The Expert view (js/expert/ui.js) configures it: the current mode, the switch, Start over and the looks.
import { state } from "../state.js?v=2026.11.27.17";
import { APP_VERSION, APP_BUILD } from "../version.js?v=2026.11.27.17";
import { LOOK_CHOICES, LOOK_LABELS } from "./lookmath.js?v=2026.11.27.17";
import { openHowto } from "./helpmenu.js?v=2026.11.27.17";

export const MODES = [["kids", "Kids", "big & easy", "\u2605"], ["simple", "Simple", "chords + key", "\u25D0"], ["expert", "Expert", "everything", "\u25C6"]];
// rd17 (Uiux, one home per control): no Keys row (the keyboard bar cycles it), no Upload row (the Song tab is its home),
// How to & tour only in Kids (Simple and Expert have the "?" menu).
export const SHEET_ROWS = ["mode", "playAlong", "hints", "nums", "look", "help", "reset"];   // the one order (help: Kids only)
export const KIDS_HOLD_MS = 1000;
export const msLog = { opens: [], shortTaps: 0, holds: 0, switches: [] };
var cfg = { mode: function () { return "expert"; }, setMode: null, startOver: null, lookGet: null, lookSet: null, isDay: null };
// rd13: the Keys views (Octave · Keyboard · Buttons), cycled by the Expert keyboard bar chip (expert/ui.js).
// rd17: "Full" is called "Keyboard" (the saved value stays "full"); the Settings Keys row is gone.
export const KEYS_CHOICES = [["octave", "Octave"], ["full", "Keyboard"], ["buttons", "Buttons"]];
export function configureSheet(o) { Object.keys(o).forEach(function (k) { cfg[k] = o[k]; }); }
var wrap = null, sheet = null, confirmEl = null, tipEl = null, tipT = 0;
// The sheet opens under the finger that held the Kids chip: the click its lift makes must not land on the sheet
// (the dim would close it at once, a row would act). Clicks are ignored until a moment after that finger lifts.
var guardUntil = 0, guardHeld = false;
function guarded() { return guardHeld || performance.now() < guardUntil; }
function $(id) { return document.getElementById(id); }
function h(tag, cls, html, attrs) {
  var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html;
  if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
  if (tag === "button") e.type = "button";
  return e;
}
function modeInfo(m) { for (var i = 0; i < MODES.length; i++) if (MODES[i][0] === m) return MODES[i]; return MODES[2]; }

// ---------- the chip ----------
export function chipHtml(mode) { var m = modeInfo(mode); return "<span class=\"mc-fill\" aria-hidden=\"true\"></span><span class=\"mc-ic\" aria-hidden=\"true\">" + m[3] + "</span><span class=\"mc-t\">" + m[1] + "</span>"; }
export function makeChip(mode, id) {
  var b = h("button", "mode-chip mc-" + mode, chipHtml(mode), { "aria-haspopup": "dialog", "data-mode-chip": mode,
    "aria-label": mode === "kids" ? "Mode: Kids. Grown-ups: press and hold 1 second for settings" : "Mode: " + modeInfo(mode)[1] + ". Settings" });
  if (id) b.id = id;
  wireChip(b, mode === "kids");
  return b;
}
export function wireChip(b, hold) {
  if (!hold) { b.addEventListener("click", function () { openModeSheet(true); }); return; }
  var t = 0, pid = null;
  function start(e) {
    if (t) return;
    b.classList.remove("holding"); void b.offsetWidth; b.classList.add("holding");
    t = setTimeout(function () { t = 0; b.classList.remove("holding"); msLog.holds++; hideTip(); guardHeld = true; openModeSheet(true); }, KIDS_HOLD_MS);
  }
  function stop(short) {
    if (!t) return;
    clearTimeout(t); t = 0; pid = null; b.classList.remove("holding");
    if (short) { msLog.shortTaps++; showTip(b); }
  }
  b.addEventListener("pointerdown", function (e) {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault(); pid = e.pointerId;
    try { b.setPointerCapture(e.pointerId); } catch (err) {}
    start(e);
  });
  function lift() { if (guardHeld) { guardHeld = false; guardUntil = performance.now() + 250; } pid = null; }
  b.addEventListener("pointerup", function (e) { if (pid == null || e.pointerId === pid) { stop(true); lift(); } });
  b.addEventListener("pointercancel", function () { stop(false); lift(); });
  b.addEventListener("lostpointercapture", function () { if (t) stop(true); lift(); });
  b.addEventListener("click", function (e) { e.preventDefault(); });   // a tap alone never opens the grown-up settings
  b.addEventListener("keydown", function (e) { if ((e.key === "Enter" || e.key === " ") && !e.repeat) { e.preventDefault(); start(e); } });
  b.addEventListener("keyup", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); stop(true); lift(); } });
  b.addEventListener("contextmenu", function (e) { e.preventDefault(); });
}
function showTip(b) {
  if (!tipEl) { tipEl = h("div", "mc-tip", "Grown-ups: hold 1 second", { role: "status", id: "mcTip" }); document.body.appendChild(tipEl); }
  var r = b.getBoundingClientRect();
  tipEl.hidden = false;
  tipEl.style.top = Math.round(r.bottom + 8) + "px";
  tipEl.style.right = Math.max(6, Math.round((window.tcVW ? window.tcVW() : window.innerWidth) - r.right)) + "px";
  clearTimeout(tipT); tipT = setTimeout(hideTip, 1600);
}
function hideTip() { clearTimeout(tipT); if (tipEl) tipEl.hidden = true; }

// ---------- the sheet ----------
function build() {
  wrap = h("div", "ms-wrap", null, { id: "modeSheet" }); wrap.hidden = true;
  var dim = h("div", "ms-dim"); dim.addEventListener("click", function () { if (guarded()) return; openModeSheet(false); });
  sheet = h("div", "ms-sheet", null, { role: "dialog", "aria-modal": "true", "aria-label": "Settings" });
  var html = "<div class=\"ms-grab\"></div><div class=\"ms-head\"><h2>Settings</h2><button type=\"button\" class=\"ms-x\" aria-label=\"Close\">\u2715</button></div>"
    + "<div class=\"ms-body\">"
    + "<div class=\"ms-ver\" id=\"msVer\"><div class=\"ms-ver-n\">Version " + APP_VERSION + "</div>"
    // v3.2 UI polish (Uiux P8): the full build name (APP_BUILD, written at packaging time), selectable, with Copy
    + "<div class=\"ms-ver-b\">Build <code id=\"msBuild\">" + buildEsc(APP_BUILD) + "</code> <button type=\"button\" class=\"ms-ver-copy\" data-act=\"copybuild\" id=\"msBuildCopy\" aria-label=\"Copy the build name\">Copy</button></div></div>"
    + "<div class=\"ms-lbl\" data-row=\"mode\">Mode</div><div class=\"ms-mode\" id=\"msMode\" role=\"radiogroup\" aria-label=\"Mode\">"
    + MODES.map(function (m) { return "<button type=\"button\" role=\"radio\" data-mode=\"" + m[0] + "\"><b>" + m[1] + "</b><small>" + m[2] + "</small></button>"; }).join("") + "</div>"
    + "<div class=\"ms-lbl\">Playing</div>"
    + "<button type=\"button\" class=\"ms-row ms-sw\" role=\"switch\" data-row=\"playAlong\" data-proxy=\"playAlongBtn\" id=\"msPlayAlong\"><span class=\"ms-t\">Play along<small>Tap the marked chord to move on</small></span><span class=\"ms-tg\" aria-hidden=\"true\"></span></button>"
    + "<button type=\"button\" class=\"ms-row ms-sw\" role=\"switch\" data-row=\"hints\" data-proxy=\"paHintsBtn\" id=\"msHints\"><span class=\"ms-t\">Show hints<small class=\"ms-hsub\">A tip when a tap misses the marked chord</small></span><span class=\"ms-tg\" aria-hidden=\"true\"></span></button>"
    + "<button type=\"button\" class=\"ms-row ms-sw\" role=\"switch\" data-row=\"nums\" data-proxy=\"progNumsBtn\" id=\"msNums\"><span class=\"ms-t\">Chord numbers<small>Step numbers on the song's chords</small></span><span class=\"ms-tg\" aria-hidden=\"true\"></span></button>"
    + "<div class=\"ms-row ms-look\" data-row=\"look\"><span class=\"ms-t\">Look<small class=\"ms-lsub\"></small></span><span class=\"ms-seg\" id=\"msLook\" role=\"radiogroup\" aria-label=\"Look\">"
    + LOOK_CHOICES.map(function (l) { return "<button type=\"button\" role=\"radio\" data-look=\"" + l + "\">" + LOOK_LABELS[l] + "</button>"; }).join("") + "</span></div>"
    + "<div class=\"ms-row ms-help\" data-row=\"help\"><span class=\"ms-t\">How to &amp; tour</span><span class=\"ms-pair\"><button type=\"button\" data-act=\"howto\" id=\"msHowto\">How to</button><button type=\"button\" data-act=\"tour\" id=\"msTour\">Tour</button></span></div>"
    + "<button type=\"button\" class=\"ms-row ms-go ms-danger\" data-row=\"reset\" data-act=\"reset\" id=\"msReset\"><span class=\"ms-t\">Start over<small>Asks first; your songs stay</small></span><span class=\"ms-chev\" aria-hidden=\"true\">\u203a</span></button>"
    + "<div class=\"ms-note\" id=\"msNote\"></div></div>";
  sheet.innerHTML = html;
  confirmEl = h("div", "ms-confirm", null, { id: "msConfirm" }); confirmEl.hidden = true;
  confirmEl.innerHTML = "<div class=\"ms-cdim\"></div><div class=\"ms-ccard\" role=\"alertdialog\" aria-label=\"Start over?\"><div class=\"ms-broom\" aria-hidden=\"true\">\uD83E\uDDF9</div><div class=\"ms-ch\">Start over?</div>"
    + "<div class=\"ms-cs\">This resets all settings. It can't be undone. Your saved songs stay.</div>"
    + "<button type=\"button\" class=\"ms-keep\">Keep everything</button><button type=\"button\" class=\"ms-erase\"><span class=\"ms-efill\"></span><span class=\"ms-et\">Hold 2 s to erase</span></button></div>";
  wrap.appendChild(dim); wrap.appendChild(sheet); wrap.appendChild(confirmEl);
  document.body.appendChild(wrap);
  sheet.addEventListener("click", onClick);
  confirmEl.querySelector(".ms-keep").addEventListener("click", function () { confirmEl.hidden = true; });
  confirmEl.querySelector(".ms-cdim").addEventListener("click", function () { confirmEl.hidden = true; });
  wireErase(confirmEl.querySelector(".ms-erase"));
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && wrap && !wrap.hidden) { if (!confirmEl.hidden) confirmEl.hidden = true; else openModeSheet(false); } });
}
function wireErase(b) {
  var t = 0, fill = b.querySelector(".ms-efill");
  function stop() { clearTimeout(t); t = 0; b.classList.remove("holding"); fill.style.transition = "none"; fill.style.width = "0"; }
  b.addEventListener("pointerdown", function (e) {
    e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (err) {}
    b.classList.add("holding"); void fill.offsetWidth; fill.style.transition = "width 2s linear"; fill.style.width = "100%";
    t = setTimeout(function () { t = 0; stop(); var m = cfg.mode(); confirmEl.hidden = true; openModeSheet(false); if (cfg.startOver) cfg.startOver(m); }, 2000);
  });
  b.addEventListener("pointerup", stop); b.addEventListener("pointercancel", stop); b.addEventListener("pointerleave", function () { if (t) stop(); });
}
function onClick(e) {
  if (guarded()) { msLog.guarded = (msLog.guarded || 0) + 1; return; }
  var b = e.target.closest("button"); if (!b) return;
  if (b.classList.contains("ms-x")) { openModeSheet(false); return; }
  if (b.dataset.mode) {
    var to = b.dataset.mode, from = cfg.mode();
    openModeSheet(false);
    if (to !== from && cfg.setMode) { msLog.switches.push(from + ">" + to); cfg.setMode(to); modeFadeIn(); }
    return;
  }
  if (b.dataset.proxy) {
    if (b.disabled) return;
    var p = $(b.dataset.proxy); if (p) p.click();
    paintSheet(); return;
  }
  if (b.dataset.look) { var m = cfg.mode(); if (!cfg.lookSet) return; cfg.lookSet(m, b.dataset.look); paintSheet(); return; }
  var act = b.dataset.act;
  if (act === "copybuild") { copyBuild(b); return; }
  if (act === "reset") { confirmEl.hidden = false; return; }
  if (act === "howto" || act === "tour") {
    openModeSheet(false);
    if (act === "howto") openHowto(); else { var n = $("tourBtn"); if (n) n.click(); }
  }
}
function buildEsc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]; }); }
// Copy the build name; the button says "Copied" for 1.5 s (or "Copy failed" when the clipboard refuses).
var copyT = 0;
export function copyBuild(b) {
  function say(t) { clearTimeout(copyT); b.textContent = t; copyT = setTimeout(function () { b.textContent = "Copy"; }, 1500); }
  function fallback() {
    try {
      var ta = document.createElement("textarea"); ta.value = APP_BUILD; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); var ok = document.execCommand && document.execCommand("copy"); document.body.removeChild(ta);
      say(ok ? "Copied" : "Copy failed");
    } catch (e) { say("Copy failed"); }
  }
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(APP_BUILD).then(function () { say("Copied"); }, fallback);
  else fallback();
}
function setSw(b, on, dis) { b.classList.toggle("on", !!on); b.setAttribute("aria-checked", on ? "true" : "false"); b.disabled = !!dis; b.classList.toggle("dis", !!dis); }
export function paintSheet() {
  if (!wrap) return;
  var m = cfg.mode(); wrap.dataset.mode = m;
  var day = cfg.isDay ? !!cfg.isDay(m) : false;
  wrap.classList.toggle("ms-day", day); wrap.classList.toggle("ms-lamp", !day);
  Array.prototype.forEach.call(sheet.querySelectorAll("#msMode button"), function (b) { var o = b.dataset.mode === m; b.classList.toggle("on", o); b.setAttribute("aria-checked", o ? "true" : "false"); });
  var paOff = state.playAlong === false;
  setSw($("msPlayAlong"), !paOff);
  setSw($("msHints"), !paOff && state.paHints !== false, paOff);
  sheet.querySelector(".ms-hsub").textContent = paOff ? "Turn on Play along to use hints" : "A tip when a tap misses the marked chord";
  setSw($("msNums"), !!state.progNums);
  var pick = cfg.lookGet ? cfg.lookGet(m) : null;   // rd10: Simple has a Look too (its Lamp = the classic screen)
  Array.prototype.forEach.call(sheet.querySelectorAll("#msLook button"), function (b) {
    var o = b.dataset.look === pick; b.classList.toggle("on", o); b.setAttribute("aria-checked", o ? "true" : "false"); b.disabled = false;
  });
  sheet.querySelector(".ms-look").hidden = false;
  sheet.querySelector(".ms-lsub").textContent = pick === "auto" ? "Auto: Day 7:00\u201319:00, Lamp at night" : "";
  sheet.querySelector(".ms-help").hidden = m !== "kids";   // rd17: Simple / Expert use the "?" menu
  $("msNote").textContent = m === "kids" ? "Kids: hold the chip 1 second to open (grown-up step)" : "";   // rd7 (Uiux): no permanent Simple footer
}
export function sheetOpen() { return !!wrap && !wrap.hidden; }
export function openModeSheet(open) {
  if (!wrap) build();
  if (open) { paintSheet(); msLog.opens.push(cfg.mode()); }
  else if (confirmEl) confirmEl.hidden = true;
  wrap.hidden = !open;
  document.documentElement.classList.toggle("ms-open", !!open);
  if (open) { var c = sheet.querySelector(".ms-x"); if (c) c.focus({ preventScroll: true }); sheet.scrollTop = 0; }
}
// The new mode fades in after a switch.
export function modeFadeIn() {
  var de = document.documentElement;
  de.classList.remove("mode-in"); void de.offsetWidth; de.classList.add("mode-in");
  clearTimeout(modeFadeIn._t); modeFadeIn._t = setTimeout(function () { de.classList.remove("mode-in"); }, 420);
}
export function bootSheet() { if (!wrap) build(); }
if (/[?&]test=1(&|$)/.test(location.search)) window.__ms = { log: msLog, open: openModeSheet, rows: SHEET_ROWS, isOpen: sheetOpen };
