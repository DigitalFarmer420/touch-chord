// rd6 Look (Auto · Day · Lamp) at run time: Kids (state.theme) and Expert (the Expert pref's look) register here.
// Auto re-checks the clock every 15 s (and when the page comes back); at the 7:00 / 19:00 boundary it waits for a
// pause in playing (no notes for LOOK_PAUSE_MS) and cross-fades, so the screen never changes in the middle of a strum.
import { fingers, loop } from "../state.js?v=112.17";
import { prog } from "../songs/playback.js?v=112.17";
import { lookFor, lookQuiet, LOOK_PAUSE_MS } from "./lookmath.js?v=112.17";

const views = {};   // name -> { pick: () => "auto" | "day" | "lamp", apply: (look) => void, shown }
export const lookLog = { switches: [], waits: 0 };
var lastNote = -1e9, pauseMs = LOOK_PAUSE_MS, retryT = 0, wired = false;
// Tests only (?test=1&hour=H): a fixed hour for Auto, so the suites see the same look at any time of day (the real-clock
// path is covered by the rd6 suite with Playwright's mocked clock). __look.setHour(h) moves it (null = the real clock).
const TEST = /[?&]test=1(&|$)/.test(location.search);
var hourAt = TEST && /[?&]hour=(\d{1,2})(&|$)/.test(location.search) ? +/[?&]hour=(\d{1,2})/.exec(location.search)[1] : null;
function clock() { var d = new Date(); if (hourAt != null) d.setHours(hourAt, 30, 0, 0); return d; }
function now() { return performance.now(); }
function busy() { return Object.keys(fingers).length > 0 || !!prog.playing || !!loop.playing || !!loop.transport; }
export function noteActivity() { lastNote = now(); }
export function registerLook(name, pick, apply) {
  views[name] = { pick: pick, apply: apply, shown: null };
  wire();
  lookApplyNow(name);
}
// A pick changed (or boot): show it right away (the user asked for it).
export function lookApplyNow(name) {
  var v = views[name]; if (!v) return null;
  v.shown = lookFor(v.pick(), clock());
  v.apply(v.shown);
  return v.shown;
}
export function lookShown(name) { var v = views[name]; return v ? (v.shown || lookApplyNow(name)) : null; }
function fade(fn) {
  var de = document.documentElement;
  if (document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    de.classList.add("look-vt");
    try { var t = document.startViewTransition(fn); t.finished.then(function () { de.classList.remove("look-vt"); }, function () { de.classList.remove("look-vt"); }); return; }
    catch (e) { de.classList.remove("look-vt"); }
  }
  de.classList.add("look-fade");
  fn();
  setTimeout(function () { de.classList.remove("look-fade"); }, 900);
}
// The clock check: returns what it did ("same", "wait" or "switch").
export function lookCheck() {
  var due = [];
  Object.keys(views).forEach(function (n) { var v = views[n], want = lookFor(v.pick(), clock()); if (v.shown !== want) due.push([v, want, n]); });
  if (!due.length) return "same";
  if (busy()) noteActivity();
  if (!lookQuiet({ busy: busy(), now: now(), lastNote: lastNote }, pauseMs)) {
    lookLog.waits++;
    if (!retryT) retryT = setTimeout(function () { retryT = 0; lookCheck(); }, 1000);
    return "wait";
  }
  fade(function () { due.forEach(function (d) { d[0].shown = d[1]; d[0].apply(d[1]); lookLog.switches.push(d[2] + ":" + d[1]); }); });
  return "switch";
}
function wire() {
  if (wired) return; wired = true;
  ["pointerdown", "pointerup", "keydown"].forEach(function (t) { window.addEventListener(t, noteActivity, true); });
  setInterval(lookCheck, 15000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) lookCheck(); });
}
if (TEST) window.__look = { setHour: function (h) { hourAt = h; }, check: lookCheck, log: lookLog, shown: lookShown, setPause: function (ms) { pauseMs = ms; }, idle: function () { lastNote = -1e9; } };
