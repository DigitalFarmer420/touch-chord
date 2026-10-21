// Tap flashes (Kids gold tap, full-mode tap pulse).
import { PROG_TEST } from "../songs/playback.js?v=112.8";
import { state } from "../state.js?v=112.8";
export function kidsTapPulse(el) {
  if (!el) return;
  el.classList.remove("kgtap");
  void el.offsetWidth;   // restart the flash on a repeated tap
  el.classList.add("kgtap");
  clearTimeout(el._kgT);
  el._kgT = setTimeout(function () { el.classList.remove("kgtap", "nxb"); }, 450);   // v112.4: an overlapping next-chord burst ends with the flash (no second flash)
  if (PROG_TEST) kidsTapLog.pulses++;
}
// v93: the same flash for full mode (not Simple, not Kids): a tapped chip, and the chip Next / Play song lights
export const fxTapLog = { n: 0, last: "" };
function fxOn() { return !state.simple && state.style !== "kids"; }
export function fxTapPulse(el) {
  if (!el || !fxOn()) return;
  el.classList.remove("fxtap");
  void el.offsetWidth;   // restart on a repeated tap / step
  el.classList.add("fxtap");
  clearTimeout(el._fxT);
  el._fxT = setTimeout(function () { el.classList.remove("fxtap"); }, 380);
  if (PROG_TEST) { fxTapLog.n++; fxTapLog.last = el.textContent; }
}
export function fxStepPulse() { if (fxOn()) fxTapPulse(document.querySelector("#suggest .pg-on")); }
export const kidsTapLog = { taps: [], pulses: 0 };
