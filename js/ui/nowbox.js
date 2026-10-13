// Now box: chord symbol and its fitting.
import { modeKey, syncKeySel } from "../keys.js?v=112.4";
import { paintLoop } from "../loop.js?v=112.4";
import { VOICINGS, state, scheduleSave, shared } from "../state.js?v=112.4";
import { accSym } from "../theory/spelling.js?v=112.4";
import { kbUpdate } from "./keyboard.js?v=112.4";
import { paintKeyChip, fitKeyRow, keyLabel } from "./keychip.js?v=112.4";
import { computeSpec, paintPads } from "./pads.js?v=112.4";
import { typeHeld, extStillHeld } from "./palette.js?v=112.4";
import { paintSuggestions } from "./strip.js?v=112.4";

// Shrink the Now symbol only when a long name (e.g. F#6sus4(add9)) would
// overflow its card; short ones like Cmaj7 keep the full display size.
export function fitNowSymbol() {
  fitKeyRow();
  var sym = document.getElementById("symbol");
  var card = sym && sym.parentNode;
  if (!card) return;
  sym.style.fontSize = "";
  var cs = getComputedStyle(card);
  var avail = card.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  var tones = document.getElementById("tones");
  if (tones) tones.style.fontSize = "";
  var w = sym.getBoundingClientRect().width;
  var base = parseFloat(getComputedStyle(sym).fontSize) || 48;
  if (avail > 0 && w > avail) sym.style.fontSize = Math.max(14, Math.floor(base * (avail / w) * 0.98)) + "px";
  // v64: HEIGHT too, measured on the TEXT (not line boxes): every line in the card (NOW label, name,
  // notes, key row) must sit at least 1.25 px inside the card's border. Start from the full CSS size
  // and shrink only as far as needed; the name never goes below the Simple key note's size unless
  // the note row and the padding have already given way.
  card.style.paddingTop = card.style.paddingBottom = "";
  var cr = card.getBoundingClientRect(), bTop = card.clientTop;
  function gap() {
    var m = 1e9;
    for (var c = 0; c < card.children.length; c++) {
      var ch = card.children[c];
      if (ch.offsetParent === null || getComputedStyle(ch).display === "none") continue;
      var q;
      if (ch.id === "keyRow") { if (!ch.children.length && ch.offsetHeight === 0) continue; q = ch.getBoundingClientRect(); }
      else { var rg = document.createRange(); rg.selectNodeContents(ch); q = rg.getBoundingClientRect(); }
      if (!q.height) continue;
      m = Math.min(m, q.top - (cr.top + bTop), (cr.bottom - bTop) - q.bottom);
    }
    return m;
  }
  var NEED = 1.25;
  if (!(card.clientHeight > 0) || gap() >= NEED) return;
  var kn = document.querySelector(".kk-name");
  var floor = state.simple && kn && kn.offsetParent ? Math.max(14, parseFloat(getComputedStyle(kn).fontSize) || 14) : 14;
  var fsS = parseFloat(getComputedStyle(sym).fontSize);
  // 1) the name, down to the floor
  for (var k = 0; k < 80 && gap() < NEED && fsS > floor; k++) { fsS = Math.max(floor, fsS - 0.5); sym.style.fontSize = fsS + "px"; }
  if (gap() >= NEED) return;
  // 2) the note row, down to 10 px
  var fsT = tones ? parseFloat(getComputedStyle(tones).fontSize) : 0;
  for (k = 0; k < 20 && gap() < NEED && fsT > 10; k++) { fsT -= 0.5; tones.style.fontSize = fsT + "px"; }
  if (gap() >= NEED) return;
  // 3) the padding
  card.style.paddingTop = card.style.paddingBottom = "2px";
  if (gap() >= NEED) return;
  // 4) last resort: the name below the floor
  for (k = 0; k < 80 && gap() < NEED && fsS > 14; k++) { fsS -= 0.5; sym.style.fontSize = fsS + "px"; }
}

export function updateSymbol() {
  kbUpdate();   // v83: key change / walk: keep the window on the root (or the tonic before any chord)
  var spec = computeSpec();
  document.getElementById("symbol").textContent = accSym(spec.symbol);
  document.getElementById("tones").textContent = spec.names.map(accSym).join(" ");
  fitNowSymbol();
  document.getElementById("vname").textContent = state.voicing;
  var slider = document.getElementById("voicing");
  slider.setAttribute("aria-valuetext", state.voicing);
  var ticks = document.querySelectorAll(".vticks span");
  for (var i = 0; i < ticks.length; i++) ticks[i].classList.toggle("on", VOICINGS[i] === state.voicing);
  document.body.classList.toggle("is-key", state.keyMode);
  var keyBtn = document.getElementById("keyMode");
  keyBtn.classList.toggle("on", state.keyMode);
  keyBtn.setAttribute("aria-pressed", state.keyMode ? "true" : "false");
  var types = document.querySelectorAll("#types button");
  for (var t = 0; t < types.length; t++) {
    var typeBtn = types[t];
    var onType = typeHeld(typeBtn.dataset.type) || (shared.suggestPreview && shared.suggestPreview.type === typeBtn.dataset.type);
    typeBtn.classList.toggle("on", onType);
    typeBtn.setAttribute("aria-pressed", onType ? "true" : "false");
  }
  var exts = document.querySelectorAll("#exts button");
  var previewExt = shared.suggestPreview && shared.suggestPreview.extensions;
  // Momentary like type pads: light only while finger-held or during Next preview.
  // (applySuggestion writes state.extensions for sounding/quality, but must not
  // leave min7/maj7/etc. lit after the preview ends.)
  var litMin7 = extStillHeld("min7") || !!(previewExt && previewExt.min7);
  var litMaj7 = extStillHeld("maj7") || !!(previewExt && previewExt.maj7);
  var has7 = !!(litMin7 || litMaj7);
  for (var x = 0; x < exts.length; x++) {
    var extBtn = exts[x];
    var extName = extBtn.dataset.ext;
    var onExt = extStillHeld(extName) || !!(previewExt && previewExt[extName]);
    var dormant = (extName === "six" && has7) || (extName === "min7" && litMaj7);
    extBtn.classList.toggle("on", onExt);
    extBtn.classList.toggle("dormant", dormant && !onExt);
    extBtn.setAttribute("aria-pressed", onExt ? "true" : "false");
  }
  var engines = document.querySelectorAll("#engines button");
  for (var n = 0; n < engines.length; n++) {
    engines[n].classList.toggle("on", engines[n].dataset.sound === state.sound);
    engines[n].setAttribute("aria-pressed", engines[n].dataset.sound === state.sound ? "true" : "false");
  }
  var bass = document.getElementById("bass");
  bass.classList.toggle("on", state.bass);
  bass.setAttribute("aria-pressed", state.bass ? "true" : "false");
  document.getElementById("keyMajor").classList.toggle("on", state.keyScale === "major");
  document.getElementById("keyMinor").classList.toggle("on", state.keyScale === "minor");
  syncKeySel();
  document.getElementById("keyReadout").textContent = state.keyMode
    ? "Key of " + keyLabel(modeKey())
    : "Chromatic";
  paintKeyChip(spec);
  paintSuggestions(spec);
  paintPads();
  paintLoop();
  scheduleSave(200);
}

// Boot step (runs once, in the original v112.3 order, from main.js)
export function boot() {

  window.addEventListener("resize", function () { fitNowSymbol(); });
}
