// Main event wiring (wire()): style row, sound tiles, sliders, controls.
import { api as ChordAudio } from "../audio/index.js?v=112.7";
import { unlock } from "../audio/unlock.js?v=112.7";
import { modeKey, namePc, buildKeySel, setKeySpell } from "../keys.js?v=112.7";
import { killLoopVoices, onRecord, onPlay, onClear, setBpm } from "../loop.js?v=112.7";
import { magic, progStop, prog, progSet } from "../songs/playback.js?v=112.7";
import { upInList } from "../songs/song.js?v=112.7";
import { VOICINGS, state, loop, padsEl, shared } from "../state.js?v=112.7";
import { applyStylePreset, enforceYogaDeepPaletteGate, setWarmth } from "../styles.js?v=112.7";
import { paintKeyChip } from "./keychip.js?v=112.7";
import { computeSpec, eatMove, renderPads, releaseFingers, onPadUp, refreshHeld } from "./pads.js?v=112.7";
import { onPaletteDown, onPaletteUp, onTouchGone, setKeyModeState } from "./palette.js?v=112.7";
import { paintSuggestions } from "./strip.js?v=112.7";
import { paintSustainBtn, setSustain, wireSustain } from "./sustain.js?v=112.7";

export function wire() {
  var keySel = document.getElementById("keyRoot");
  buildKeySel();

  var palette = document.getElementById("palette");
  palette.addEventListener("pointerdown", onPaletteDown);
  palette.addEventListener("pointerup", onPaletteUp);
  palette.addEventListener("pointercancel", onPaletteUp);
  window.addEventListener("pointerup", onPaletteUp);
  window.addEventListener("pointercancel", onPaletteUp);

  document.getElementById("engines").addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    state.sound = b.dataset.sound;
    ChordAudio.setSound(state.sound);
    refreshHeld();
  });

  document.getElementById("bass").addEventListener("click", function () {
    state.bass = !state.bass;
    refreshHeld();
  });

  document.getElementById("keyMode").addEventListener("click", function () {
    setKeyModeState(!state.keyMode);
    renderPads();
    refreshHeld();
  });

  keySel.addEventListener("change", function () {
    var pcSel = namePc(keySel.value);
    if (pcSel < 0) return;
    state.keyRoot = pcSel;
    setKeySpell(pcSel, modeKey().mode, keySel.value);
    renderPads();
    refreshHeld();
  });

  document.getElementById("keyMajor").addEventListener("click", function () {
    state.keyScale = "major";
    if (state.keyMode) renderPads();
    refreshHeld();
  });
  document.getElementById("keyMinor").addEventListener("click", function () {
    state.keyScale = "minor";
    if (state.keyMode) renderPads();
    refreshHeld();
  });

  document.getElementById("styles").addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b || !b.dataset.style) return;
    var changed = b.dataset.style !== state.style;
    var leftKids = state.style === "kids" && b.dataset.style !== "kids";
    state.style = b.dataset.style;
    if (leftKids && magic) magic.hint = false;   // v71: leaving Kids clears its next-note hint
    if (state.style === "kids") {
      // v70: picking Kids always starts in C major (other styles keep the current key).
      state.keyRoot = 0;
      state.keyScale = "major";
      shared.lockKey = { pc: 0, mode: "major" };
      if (state.keyMode) renderPads();
    }
    if (changed && (leftKids || state.style === "kids")) renderPads();   // v83: same one-octave window in every style
    var all = document.querySelectorAll("#styles button");
    for (var i = 0; i < all.length; i++) all[i].classList.toggle("on", all[i] === b);
    shared.suggestSig = "";
    // A new Style pick loads that style's factory sound row; tweaks made
    // afterwards stick until the next Style pick or Factory reset.
    if (changed && applyStylePreset(state.style)) {
      refreshHeld();
    } else {
      enforceYogaDeepPaletteGate();
      paintSuggestions(computeSpec());
    }
    if (state.style === "kids" && prog.idx !== 0) progSet(0);   // v71: picking Kids starts on Twinkle
    if (leftKids && shared.U && shared.U.locked && shared.U.keep && upInList()) { for (var ui = 0; ui < prog.list.length; ui++) if (prog.list[ui].up) { progSet(ui); break; } }   // v73 Lock
  });

  document.getElementById("layouts").addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b || !b.dataset.layout) return;
    state.layout = b.dataset.layout;
    var all = document.querySelectorAll("#layouts button[data-layout]");
    for (var i = 0; i < all.length; i++) all[i].classList.toggle("on", all[i] === b);
    // Pads DOM is rebuilt below; dump any pooled rings so stale groups die.
    setSustain(false);
    paintSustainBtn();
    renderPads();
    paintKeyChip(computeSpec());   // v111 (K): the new keys get the in-key dimming at once (a layout switch left them undimmed)
  });

  wireSustain();

  document.getElementById("voicing").addEventListener("input", function (e) {
    state.voicing = VOICINGS[Number(e.target.value)];
    refreshHeld();
  });

  document.getElementById("cutoff").addEventListener("input", function (e) {
    ChordAudio.setCutoff(Number(e.target.value));
  });
  document.getElementById("reverb").addEventListener("input", function (e) {
    ChordAudio.setReverb(Number(e.target.value));
  });
  document.getElementById("delay").addEventListener("input", function (e) {
    ChordAudio.setDelay(Number(e.target.value));
  });
  document.getElementById("warmth").addEventListener("input", function (e) {
    setWarmth(e.target.value);
  });
  document.getElementById("bpm").addEventListener("input", function (e) {
    setBpm(e.target.value);
  });

  document.getElementById("rec").addEventListener("click", onRecord);
  document.getElementById("play").addEventListener("click", onPlay);
  document.getElementById("clear").addEventListener("click", onClear);

  eatMove(padsEl);

  document.addEventListener("pointerdown", function () { unlock(); }, true);
  window.addEventListener("pointerup", function (e) { onPadUp(e); });
  window.addEventListener("pointercancel", function (e) { onPadUp(e); });

  document.addEventListener("touchend", onTouchGone, true);
  document.addEventListener("touchcancel", onTouchGone, true);
  document.addEventListener("contextmenu", function (e) {
    if (e.target.closest && e.target.closest("#pads")) e.preventDefault();
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      progStop(); ChordAudio.band.hush();   // v104: hidden page = stopped, Band silent
      killLoopVoices();
      releaseFingers(true);
      setSustain(false);
    } else if (loop.transport && ChordAudio.ctx) {
      var s = 60 / loop.bpm / 4;
      var elapsed = (ChordAudio.currentTime() - loop.startTime) / s;
      loop.nextIndex = Math.max(0, Math.ceil(elapsed));
    }
  });
}
