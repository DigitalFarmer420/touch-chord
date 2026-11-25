// The tour (Help > Tour): one short tour per mode, in the v110 spotlight look.
import { progStop, prog } from "../songs/playback.js?v=2026.11.24.1";
import { paHintHide } from "./hints.js?v=2026.11.24.1";

// v112 first-launch tour, saved as done on Skip / Done (its own storage key: Factory reset keeps it); the "?" menu
// (Simple / Expert) or Settings > How to & tour (Kids) replays it.
// v3.2 guide/tour (after the UI polish, 112.13-ranked-v3.2-test.4): the old single Kids tour pointed at the classic
// Kids style (#suggest .ss-kidpad, #kidsLyr, #prog), which the Kids view, Simple and Expert no longer show, so every
// spotlight but two missed. Now each mode has its own steps. A step's "sel" lists targets in order of preference; the
// first one that is on screen gets the spotlight (portrait and landscape place some controls differently). A step whose
// target is not on screen is left out; "land" steps only show on a phone held sideways (html.lay-phone-land).
const TOUR_KEY = "touchChord.tour.v1";
export const TOURS = {
  kids: [
    { sel: null, text: "Hi! Let's play Twinkle Twinkle Little Star." },
    { sel: "#kv .kv-pads .kv-pad.gold", text: "Tap the gold pad to play the next note of the song." },
    { sel: "#kv .kv-piano .kv-wk.gold, #kv .kv-piano .kv-bk.gold", text: "Or tap the gold key on the piano. This works too." },
    { sel: "#kv .kv-lyr", text: "The words light up as you go. The letter above a word is the next pad to play." },
    { sel: "#kv .kv-playbtn", text: "Tap Play to hear the whole song." },
    { sel: "#kv .kv-home", text: "Tap the house to pick another song." },
    { sel: "#kv .kv-play .mode-chip", text: "Grown-ups: press and hold Kids for Settings." }
  ],
  simple: [
    { sel: null, text: "This is Simple: pick a key and a progression, then tap the chords." },
    { sel: "#styles", text: "Tap a style. It changes the sound and the chords." },
    { sel: "#kidKey", text: "Swipe or tap the arrows to pick your key, then Major or Minor." },
    { sel: "#prog", text: "Pick a progression. Tap Next for one chord at a time, or Play for all of them." },
    { sel: "#app .next-card", text: "Tap any chord. The numbers show the order, and the gold outline marks the next one." },
    { sel: "#sustainBtn", text: "Hold Sustain to let the notes ring." },
    { sel: "#modeChip", text: "Tap Simple for Settings, or to switch to Kids or Expert." }
  ],
  expert: [
    { sel: null, text: "This is Expert: every chord in your key and a piano. Hold your phone upright or sideways." },
    { sel: null, land: true, text: "Sideways, the status bar hides to give the chords more room. Swipe down from the top edge to see it." },
    { sel: "#xKey", text: "Tap here to change the key. The style is right next to it." },
    { sel: "#xSrc", text: "Pick a progression here. Tap Lock to keep it when you change the style." },
    { sel: "#xGo", text: "Next plays one chord at a time. \u25B6 plays them all." },
    { sel: "#app .next-card", text: "Tap any chord: they all fit your key. An orange edge means it is borrowed from a nearby key." },
    { sel: "#app .kb-wrap", text: "Tap a key to play its chord. Faded keys are outside your key: tap All notes to use them." },
    { sel: "#xKeysChip", text: "Switch the keys here: Octave, Keyboard or Buttons. To slide a finger across the keys, use Keyboard." },
    { sel: "#xTog", text: "Song opens your songs. The sung word lights up, and the next chord's name marks that word in its grid colour." },
    { sel: "#xModeChip", text: "Tap Expert for Settings: modes, Play along, and the version and build, with Copy." }
  ]
};
export var tourI;
export const tourLog = { runs: 0, done: 0, skipped: 0, steps: [], mode: null };
var steps = [];
export function tourSteps() { return steps.slice(); }
export function tourDone() { try { return window.localStorage && window.localStorage.getItem(TOUR_KEY) === "done"; } catch (err) { return false; } }
function tourSave() { try { if (window.localStorage) window.localStorage.setItem(TOUR_KEY, "done"); } catch (err) { /* quiet */ } }
export function tourMode() {
  var c = document.documentElement.classList;
  return c.contains("kv") ? "kids" : c.contains("expert") ? "expert" : "simple";   // the classic full screen (old saved setups) uses the Simple steps it has
}
function shown(el) {
  if (!el || el.closest("[hidden]")) return false;
  var r = el.getBoundingClientRect(), cs = getComputedStyle(el);
  return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && r.right > 0 && r.bottom > 0 && r.left < (window.tcVW ? window.tcVW() : window.innerWidth) && r.top < (window.tcVH ? window.tcVH() : window.innerHeight);
}
export function tourTarget(st) {
  if (!st || !st.sel) return null;
  var all = document.querySelectorAll(st.sel);
  for (var i = 0; i < all.length; i++) if (shown(all[i])) return all[i];
  return null;
}
function landPhone() { return document.documentElement.classList.contains("lay-phone-land"); }
function stepOn(st) { return (!st.land || landPhone()) && (!st.sel || !!tourTarget(st)); }
// Kids: the tour is about Twinkle on the play screen, so it opens there (the same taps a child would make).
function kidsToTwinkle() {
  var kv = document.getElementById("kv"); if (!kv) return;
  var cur = prog.list[prog.idx], tw = cur && /Twinkle/.test(cur.name);
  if (kv.dataset.screen === "play" && tw) return;
  if (kv.dataset.screen === "hello") { var go = kv.querySelector(".kv-go"); if (go) go.click(); }
  if (kv.dataset.screen === "play" && !tw) { var home = kv.querySelector(".kv-home"); if (home) home.click(); }
  if (kv.dataset.screen === "songs") { var card = kv.querySelector('.kv-card[data-song*="Twinkle"]'); if (card) card.click(); }
}
export function tourStart(replay) {
  var box = document.getElementById("tour");
  if (!box) return;
  tourWire();
  if (prog.playing) progStop();
  var mode = tourMode();
  if (mode === "kids") kidsToTwinkle();
  paHintHide();
  tourLog.mode = mode; tourLog.runs++;
  tourI = 0; steps = [];
  box.hidden = false;
  box.querySelector(".tour-text").textContent = "";
  setTimeout(function () {   // after the Kids view paints its gold pad and key (50 ms paint loop)
    steps = TOURS[mode].filter(stepOn);
    if (!steps.length) { tourEnd("skipped"); return; }
    tourShow();
  }, mode === "kids" ? 160 : 0);
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
  if (!box || tourI < 0 || !steps.length) return;
  var st = steps[tourI], last = tourI === steps.length - 1;
  box.querySelector(".tour-text").textContent = st.text;
  box.querySelector(".tour-step").textContent = (tourI + 1) + " / " + steps.length;
  var nx = box.querySelector(".tour-next");
  nx.textContent = last ? "Done" : "Next";
  box.querySelector(".tour-skip").hidden = last;
  tourPlace();
  tourLog.steps.push(tourI + 1);
  try { nx.focus({ preventScroll: true }); } catch (err) { /* quiet */ }
}
// The card goes below, above, right or left of the spotlight, whichever has room. On a short landscape screen a big
// target (the chord grid) can leave no strip tall enough: the card then goes beside it, narrower, or gets wider and
// tighter (.tight) so it still sits clear of the spotlight.
function tourPlace() {
  var box = document.getElementById("tour");
  if (!box || tourI < 0 || !steps.length) return;
  var st = steps[tourI], el = tourTarget(st), r = el ? el.getBoundingClientRect() : null;
  var hole = box.querySelector(".tour-hole"), num = box.querySelector(".tour-num"), dim = box.querySelector(".tour-dim"), card = box.querySelector(".tour-card");
  var W = (window.tcVW ? window.tcVW() : window.innerWidth), H = (window.tcVH ? window.tcVH() : window.innerHeight), P = 6, M = 12, gap = 14;
  card.classList.remove("tight"); card.style.width = "";
  var cw = card.offsetWidth, ch = card.offsetHeight, top, left;
  if (r && r.width > 0 && r.height > 0) {
    var hr = { l: Math.max(2, r.left - P), t: Math.max(2, r.top - P), r: Math.min(W - 2, r.right + P), b: Math.min(H - 2, r.bottom + P) };
    hole.hidden = false; dim.hidden = true;
    hole.style.left = hr.l + "px"; hole.style.top = hr.t + "px"; hole.style.width = (hr.r - hr.l) + "px"; hole.style.height = (hr.b - hr.t) + "px";
    num.hidden = false; num.textContent = String(tourI + 1);
    num.style.left = Math.max(2, hr.l - 10) + "px"; num.style.top = Math.max(2, hr.t - 10) + "px";
    var placed = false;
    var fit = function () {
      if (H - hr.b >= ch + gap + M) { top = hr.b + gap; left = (W - cw) / 2; return true; }
      if (hr.t >= ch + gap + M) { top = hr.t - gap - ch; left = (W - cw) / 2; return true; }
      if (W - hr.r >= cw + gap + M) { left = hr.r + gap; top = Math.min(Math.max(M, (hr.t + hr.b - ch) / 2), H - ch - M); return true; }
      if (hr.l >= cw + gap + M) { left = hr.l - gap - cw; top = Math.min(Math.max(M, (hr.t + hr.b - ch) / 2), H - ch - M); return true; }
      return false;
    };
    placed = fit();
    if (!placed) {   // a narrower card beside a tall spotlight (Simple's grid in landscape)
      var sg = 8, sm = 6, sideR = W - hr.r - sg - sm, sideL = hr.l - sg - sm, side = Math.max(sideR, sideL);
      if (side >= 160) {
        card.style.width = Math.floor(side) + "px"; cw = card.offsetWidth; ch = card.offsetHeight;
        if (ch <= H - 2 * sm) { M = sm; left = sideR >= sideL ? hr.r + sg : hr.l - sg - cw; top = Math.min(Math.max(M, (hr.t + hr.b - ch) / 2), H - ch - M); placed = true; }
        else { card.style.width = ""; cw = card.offsetWidth; ch = card.offsetHeight; }
      }
    }
    if (!placed) {   // tight: wider, less padding, smaller gaps
      card.classList.add("tight"); M = 4; gap = 6;
      card.style.width = Math.min(560, W - 2 * M) + "px";
      cw = card.offsetWidth; ch = card.offsetHeight;
      placed = fit();
    }
    if (!placed) { top = (H - hr.b > hr.t) ? H - ch - M : M; left = (W - cw) / 2; }
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
    if (tourI >= steps.length - 1) { tourEnd("done"); return; }
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
