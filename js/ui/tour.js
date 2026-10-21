// First-launch Kids tour.
import { progStop, prog, progSet } from "../songs/playback.js?v=112.8";
import { state } from "../state.js?v=112.8";
import { paHintHide } from "./hints.js?v=112.8";

// v112 first-launch Kids tour: 6 steps in the v110 spotlight look. Runs once after the fresh Kids + Twinkle load,
// saved as done on Skip / Done (its own storage key: Factory reset keeps it); Help > Tour (gear menu) replays it.
const TOUR_KEY = "touchChord.tour.v1";
const TOUR = [
  { sel: null, text: "Hi! Let's play Twinkle Twinkle Little Star." },
  { sel: "#suggest .ss-kidpad.nx-root", text: "Tap the gold pad to play the next chord." },
  { sel: "#pads .pad.nx-root", text: "Or tap the gold key on the piano. This works too." },
  { sel: "#kidsLyr", text: "The words light up as you go." },
  { sel: "#prog .pg-song", text: "Tap Play to hear the whole song." },
  { sel: "#prog .pg-sel", text: "Pick another song here. There are 11!" }
];
export var tourI;
export const tourLog = { runs: 0, done: 0, skipped: 0, steps: [] };
export function tourDone() { try { return window.localStorage && window.localStorage.getItem(TOUR_KEY) === "done"; } catch (err) { return false; } }
function tourSave() { try { if (window.localStorage) window.localStorage.setItem(TOUR_KEY, "done"); } catch (err) { /* quiet */ } }
export function tourStart(replay) {
  var box = document.getElementById("tour");
  if (!box) return;
  tourWire();
  if (replay) {   // Help > Tour: the tour is about Kids + Twinkle, so it opens there
    if (prog.playing) progStop();
    if (state.style !== "kids") { var kb = document.querySelector('#styles button[data-style="kids"]'); if (kb) kb.click(); }
    var tw = -1; prog.list.forEach(function (x, i) { if (tw < 0 && /Twinkle/.test(x.name)) tw = i; });
    if (tw >= 0 && prog.idx !== tw) progSet(tw);
  }
  paHintHide();
  tourI = 0; tourLog.runs++;
  box.hidden = false;
  tourShow();
}
function tourEnd(how) {
  var box = document.getElementById("tour");
  if (box) box.hidden = true;
  tourI = -1;
  tourSave();
  tourLog[how]++;
}
function tourShow() {
  var box = document.getElementById("tour");
  if (!box || tourI < 0) return;
  var st = TOUR[tourI], last = tourI === TOUR.length - 1;
  box.querySelector(".tour-text").textContent = st.text;
  box.querySelector(".tour-step").textContent = (tourI + 1) + " / " + TOUR.length;
  var nx = box.querySelector(".tour-next");
  nx.textContent = last ? "Done" : "Next";
  box.querySelector(".tour-skip").hidden = last;
  tourPlace();
  tourLog.steps.push(tourI + 1);
  try { nx.focus({ preventScroll: true }); } catch (err) { /* quiet */ }
}
function tourPlace() {
  var box = document.getElementById("tour");
  if (!box || tourI < 0) return;
  var st = TOUR[tourI], el = st.sel ? document.querySelector(st.sel) : null, r = el ? el.getBoundingClientRect() : null;
  var hole = box.querySelector(".tour-hole"), num = box.querySelector(".tour-num"), dim = box.querySelector(".tour-dim"), card = box.querySelector(".tour-card");
  var W = window.innerWidth, H = window.innerHeight, P = 6, M = 12;
  var cw = card.offsetWidth, ch = card.offsetHeight, top, left;
  if (r && r.width > 0 && r.height > 0) {
    var hr = { l: Math.max(2, r.left - P), t: Math.max(2, r.top - P), r: Math.min(W - 2, r.right + P), b: Math.min(H - 2, r.bottom + P) };
    hole.hidden = false; dim.hidden = true;
    hole.style.left = hr.l + "px"; hole.style.top = hr.t + "px"; hole.style.width = (hr.r - hr.l) + "px"; hole.style.height = (hr.b - hr.t) + "px";
    num.hidden = false; num.textContent = String(tourI + 1);
    num.style.left = Math.max(2, hr.l - 10) + "px"; num.style.top = Math.max(2, hr.t - 10) + "px";
    var gap = 14;
    if (H - hr.b >= ch + gap + M) { top = hr.b + gap; left = (W - cw) / 2; }
    else if (hr.t >= ch + gap + M) { top = hr.t - gap - ch; left = (W - cw) / 2; }
    else if (W - hr.r >= cw + gap + M) { left = hr.r + gap; top = (H - ch) / 2; }
    else if (hr.l >= cw + gap + M) { left = hr.l - gap - cw; top = (H - ch) / 2; }
    else { top = (H - hr.b > hr.t) ? H - ch - M : M; left = (W - cw) / 2; }
  } else {
    hole.hidden = true; num.hidden = true; dim.hidden = false;
    top = (H - ch) / 2; left = (W - cw) / 2;
  }
  card.style.left = Math.round(Math.max(M, Math.min(W - cw - M, left))) + "px";
  card.style.top = Math.round(Math.max(M, Math.min(H - ch - M, top))) + "px";
}
var tourWired;
function tourWire() {   // the tour box comes after this script in the page: wired on first use
  var box = document.getElementById("tour");
  if (!box || tourWired) return;
  tourWired = true;
  box.querySelector(".tour-next").addEventListener("click", function () {
    if (tourI < 0) return;
    if (tourI >= TOUR.length - 1) { tourEnd("done"); return; }
    tourI++; tourShow();
  });
  box.querySelector(".tour-skip").addEventListener("click", function () { if (tourI >= 0) tourEnd("skipped"); });
  box.addEventListener("keydown", function (e) { if (e.key === "Escape" && tourI >= 0) { e.preventDefault(); tourEnd("skipped"); } });
  window.addEventListener("resize", function () { setTimeout(tourPlace, 60); });
}

// Boot step (runs once, in the original v112.3 order, from main.js)
export function boot() {
tourI = -1;
tourWired = false;
}
