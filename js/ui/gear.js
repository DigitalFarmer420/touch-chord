// Gear (Config) menu: volume, band, toggles, factory reset.
import { api as ChordAudio } from "../audio/index.js?v=112.13";
import { applySettings, showToast } from "../settings.js?v=112.13";
import { progStop, progRedecorate } from "../songs/playback.js?v=112.13";
import { state, scheduleSave, factoryDefaults, storageClear, collectSettings, saveNow, shared } from "../state.js?v=112.13";
import { paHintHide } from "./hints.js?v=112.13";
import { updateSymbol } from "./nowbox.js?v=112.13";
import { renderPads, refreshHeld } from "./pads.js?v=112.13";
import { clearSuggestPreview } from "./strip.js?v=112.13";
import { tourStart } from "./tour.js?v=112.13";

// v68: master Volume (Config). 0..100, gain = (v/100)^2 (perceptual), 100 = the old level.
export function setVolume(v) {
  v = Math.round(Number(v));
  if (!isFinite(v)) v = 100;
  v = Math.max(0, Math.min(100, v));
  state.volume = v;
  var el = document.getElementById("volume");
  if (el && el.value !== String(v)) el.value = String(v);
  if (el) el.setAttribute("aria-valuetext", String(v));
  var out = document.getElementById("volVal");
  if (out) out.textContent = String(v);
  ChordAudio.setVolume((v / 100) * (v / 100));
}
// v75 Band level (0 = no scheduler, no nodes). v86: Sound box toggle + level slider. The level
// Band fix: no toggle any more. One slider 0..100 (0 = off), saved as bandLvl. Band audio = level / 100.
export function setBand(v) {
  v = Math.round(Number(v));
  if (!isFinite(v) || v < 0) v = 0;
  state.band = Math.min(100, v);
  state.bandOn = state.band > 0;   // Band fix: no toggle; the slider above 0 is on
  applyBand();
}
function applyBand() {
  ChordAudio.band.setLevel(state.bandOn ? (state.band | 0) / 100 : 0);
  paintBand();
}
export function paintBand() {
  var el = document.getElementById("band");
  if (!el) return;
  var v = state.band | 0, on = !!ChordAudio.band && !!{ pop: 1, country: 1, jazz: 1, kids: 1, ballad: 1, rnb: 1 }[state.style];
  var live = !!state.bandOn;
  if (el.value !== String(v)) el.value = String(v);
  el.setAttribute("aria-valuetext", (live ? String(v) : "Off") + (on ? "" : ", no band for this style yet"));
  document.getElementById("bandVal").textContent = live ? String(v) : "Off";
  el.disabled = !on;
  var box = document.getElementById("bandWrap");
  box.classList.toggle("dim", !on);
  box.classList.toggle("on", live);
  box.classList.toggle("off", !live);
  box.title = on ? "" : "No band on this style yet";
}
export function paintProgNumsBtn() {
  var b = document.getElementById("progNumsBtn");
  if (b) { b.setAttribute("aria-checked", state.progNums ? "true" : "false"); b.classList.toggle("on", !!state.progNums); }
}
export function paintPlayAlongBtn() {   // v108
  var b = document.getElementById("playAlongBtn");
  if (b) { b.setAttribute("aria-checked", state.playAlong !== false ? "true" : "false"); b.classList.toggle("on", state.playAlong !== false); }
  document.documentElement.classList.toggle("pa-off", state.playAlong === false);   // v112.11: Play along off = no guide (the next-chord dot / chip marks are hidden by CSS; nothing else changes)
  var h = document.getElementById("paHintsBtn");   // v112: Show hints
  if (h) { h.setAttribute("aria-checked", state.paHints !== false ? "true" : "false"); h.classList.toggle("on", state.paHints !== false); }
}
function factoryReset() {
  if (shared.saveTimer) {
    clearTimeout(shared.saveTimer);
    shared.saveTimer = 0;
  }
  storageClear();
  clearSuggestPreview();
  var d = factoryDefaults();
  applySettings(d);
  renderPads();
  refreshHeld();
  updateSymbol();
  if (shared.saveTimer) {
    clearTimeout(shared.saveTimer);
    shared.saveTimer = 0;
  }
  // Storage stays empty until the user changes something again.
  shared.lastSaved = JSON.stringify(collectSettings());
  showToast("Settings reset to factory defaults");
  var btn = document.getElementById("configBtn");
  btn.classList.add("flash");
  setTimeout(function () { btn.classList.remove("flash"); }, 450);
}

export function wireConfig() {
  var btn = document.getElementById("configBtn");
  var menu = document.getElementById("configMenu");
  var wrap = document.getElementById("configWrap");
  function setOpen(open) {
    menu.hidden = !open;
    if (!open) { var pt = document.getElementById("playAlongTip"); if (pt) pt.hidden = true; var pq = document.getElementById("playAlongQ"); if (pq) pq.setAttribute("aria-expanded", "false"); }   // v108
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  }
  btn.addEventListener("click", function (e) {
    e.stopPropagation();
    setOpen(menu.hidden);
    if (!menu.hidden) document.getElementById("factoryReset").focus({ preventScroll: true });
  });
  document.getElementById("factoryReset").addEventListener("click", function () {
    setOpen(false);
    factoryReset();
  });
  var bandEl = document.getElementById("band");
  bandEl.addEventListener("input", function () { setBand(bandEl.value); scheduleSave(150); });
  bandEl.addEventListener("change", function () { setBand(bandEl.value); scheduleSave(0); });
  var volEl = document.getElementById("volume");
  volEl.addEventListener("input", function () { setVolume(volEl.value); scheduleSave(150); });
  volEl.addEventListener("change", function () { setVolume(volEl.value); scheduleSave(0); });
  // v60: order badges on the strip (full mode only). Saved like the other settings.
  document.getElementById("progNumsBtn").addEventListener("click", function () {
    state.progNums = !state.progNums;
    paintProgNumsBtn();
    progRedecorate();
    scheduleSave();
  });
  // v108: Play along enable (saved), and its ? explanation (opens / closes under the switch)
  document.getElementById("playAlongBtn").addEventListener("click", function () {
    state.playAlong = state.playAlong === false;
    paintPlayAlongBtn();
    scheduleSave();
  });
  document.getElementById("paHintsBtn").addEventListener("click", function () {   // v112
    state.paHints = state.paHints === false;
    if (state.paHints === false) paHintHide();
    paintPlayAlongBtn();
    scheduleSave();
  });
  document.getElementById("tourBtn").addEventListener("click", function () {   // v112: Help > Tour (replay)
    setOpen(false);
    tourStart(true);
  });
  document.getElementById("playAlongQ").addEventListener("click", function (e) {
    e.stopPropagation();
    var tip = document.getElementById("playAlongTip"), q = e.currentTarget;
    tip.hidden = !tip.hidden;
    q.setAttribute("aria-expanded", tip.hidden ? "false" : "true");
    if (!tip.hidden && tip.scrollIntoView) tip.scrollIntoView({ block: "nearest" });   // v112: the menu can scroll in landscape
  });
  document.addEventListener("pointerdown", function (e) {
    if (!menu.hidden && !wrap.contains(e.target)) setOpen(false);
  }, true);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !menu.hidden) {
      setOpen(false);
      btn.focus({ preventScroll: true });
    }
  });

  // Every sticky control saves on change (sliders debounced).
  ["engines", "bass", "keyMode", "keyMajor", "keyMinor", "styles", "layouts"].forEach(function (id) {
    document.getElementById(id).addEventListener("click", function () { scheduleSave(0); });
  });
  document.getElementById("keyRoot").addEventListener("change", function () { scheduleSave(0); });
  ["voicing", "cutoff", "reverb", "delay", "warmth", "bpm"].forEach(function (id) {
    var el = document.getElementById(id);
    el.addEventListener("input", function () { scheduleSave(150); });
    el.addEventListener("change", function () { scheduleSave(0); });
  });
  window.addEventListener("pagehide", saveNow);
  window.addEventListener("pagehide", function () { progStop(); ChordAudio.band.hush(); });   // v104
  document.addEventListener("visibilitychange", function () { if (document.hidden) saveNow(); });
}
