// Simple mode, controls drawer / tabs, size-class changes.
import { api as ChordAudio } from "../audio/index.js?v=2026.11.27.6";
import { activeKey } from "../keys.js?v=2026.11.27.6";
import { stopPlayback } from "../loop.js?v=2026.11.27.6";
import { prog, progStop, progWalkAt, progWalkTo } from "../songs/playback.js?v=2026.11.27.6";
import { state, loop, fingers, scheduleSave, shared } from "../state.js?v=2026.11.27.6";
import { magicHintClear } from "./next.js?v=2026.11.27.6";
import { fitNowSymbol } from "./nowbox.js?v=2026.11.27.6";
import { computeSpec, padSpan, octaveSpan, effectiveLayout, renderPads, liftFinger, refreshHeld } from "./pads.js?v=2026.11.27.6";
import { syncPalette, setKeyModeState } from "./palette.js?v=2026.11.27.6";
import { placeProg } from "./progbar.js?v=2026.11.27.6";
import { paintSimpleSrc } from "./simplesrc.js?v=2026.11.27.6";
import { paintSuggestions } from "./strip.js?v=2026.11.27.6";
import { paintSustainBtn, setSustain } from "./sustain.js?v=2026.11.27.6";
import { upPlaceLock } from "../songs/song.js?v=2026.11.27.6";

// ---- Simple mode + responsive controls (v20) ----
export function paintSimple() {
  var de = document.documentElement;
  de.classList.toggle("simple", !!state.simple);
  var btn = document.getElementById("simpleBtn");
  if (btn) btn.setAttribute("aria-checked", state.simple ? "true" : "false");
  if (state.simple) setDrawer(false);
  placeProg();
  paintSimpleSrc();
}

// rd6: no Simple toggle any more; the Kids / Simple / Expert switch (expert/ui.js setMode) calls this.
// One switch. ON: hide Sound/FX/Key/Loop/Layout controls (CSS: html.simple),
// force the Octave layout, stop any loop recording/playback, and force Key
// mode off. Hidden values are kept; OFF restores the chosen layout and Key mode.
export function setSimple(on) {
  on = !!on;
  if (on === state.simple) return;
  var keep = progWalkAt();   // v111 (D5): the matching step after the switch
  // N18: a switch while Play song is paused counts as a stop: Play reads "Play song" and starts at step 1
  // (progWalkAt reads the Next walk, which is one past the paused step while paused). Playing / idle unchanged.
  if (prog.paused && keep) keep = { name: keep.name, t: 0 };
  progStop(); ChordAudio.band.hush();   // v104: a mode switch stops Play song and silences the Band
  if (on) {
    if (loop.recording || loop.playing || loop.transport) stopPlayback();
    state.keyModeBeforeSimple = !!state.keyMode;
    if (state.keyMode) setKeyModeState(false);
    // Simple has no keyboard or chord buttons; let go of anything held there.
    Object.keys(fingers).forEach(function (id) { liftFinger(id); });
    if (Object.keys(shared.paletteHolds).length) { shared.paletteHolds = {}; syncPalette(); }
    if (!activeKey()) shared.lockKey = { pc: 0, mode: "major" };
    state.simple = true;
    magicHintClear();   // v68: the next-chord hint is full mode only
  } else {
    var restoreKey = state.keyModeBeforeSimple;
    state.keyModeBeforeSimple = false;
    state.simple = false;
    if (restoreKey) setKeyModeState(true);
  }
  paintSimple();
  shared.suggestSig = "";
  paintSuggestions(computeSpec());
  progWalkTo(keep);   // v111 (D5)
  // Pads DOM is rebuilt; dump pooled rings like a layout change does.
  setSustain(false);
  paintSustainBtn();
  renderPads();
  refreshHeld();
  fitNowSymbol();
  scheduleSave(0);
}

// v43: drawer opens below the top bar so Simple / gear / ? stay tappable.
function syncTopbarH() { var t = document.querySelector("header.topbar"); if (t) document.documentElement.style.setProperty("--topbar-h", Math.ceil(t.getBoundingClientRect().bottom) + "px"); }
function isDrawerLayout() {
  return document.documentElement.classList.contains("lay-phone-land");
}

function paintCtl() {
  var ctl = document.getElementById("ctl");
  var open = ctl.dataset.open || "";
  var tabs = ctl.querySelectorAll(".ctl-tabs button[data-tab]");
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].setAttribute("aria-selected", tabs[i].dataset.tab === open ? "true" : "false");
  }
  var fold = document.getElementById("ctlFold");
  if (isDrawerLayout()) {
    fold.textContent = "\u2715";
    fold.setAttribute("aria-label", "Close controls");
  } else {
    fold.textContent = open ? "\u25B4" : "\u25BE";
    fold.setAttribute("aria-label", open ? "Collapse controls" : "Expand controls");
  }
  var toggle = document.getElementById("ctlToggle");
  toggle.setAttribute("aria-expanded", document.documentElement.classList.contains("drawer-open") ? "true" : "false");
}

var lastTab;
function setOpenTab(tab) {
  var ctl = document.getElementById("ctl");
  ctl.dataset.open = tab || "";
  if (tab) lastTab = tab;
  paintCtl();
}

function setDrawer(open) {
  var de = document.documentElement;
  open = !!open && isDrawerLayout() && !state.simple;
  syncTopbarH();
  de.classList.toggle("drawer-open", open);
  if (open && !document.getElementById("ctl").dataset.open) setOpenTab(lastTab);
  else paintCtl();
}

function onSizeChange() {
  if (typeof window.tcApplySizeClass === "function") window.tcApplySizeClass();
  if (!isDrawerLayout()) document.documentElement.classList.remove("drawer-open");
  // Re-render only when the Octave span changes (Simple on iPad = 2 octaves).
  if (effectiveLayout() === "octave" && padSpan !== octaveSpan()) {
    setSustain(false);
    paintSustainBtn();
    renderPads();
    refreshHeld();
  }
  paintCtl();
  placeProg();
  fitNowSymbol();
  upPlaceLock();   // the song lock follows the lyrics once the new size class is on (the resize listener runs before it)
}

export function wireLayoutUi() {
  document.querySelector("#ctl .ctl-tabs").addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("button") : null;
    if (!b) return;
    var ctl = document.getElementById("ctl");
    if (b.id === "ctlFold") {
      if (isDrawerLayout()) setDrawer(false);
      else setOpenTab(ctl.dataset.open ? "" : lastTab);
      return;
    }
    var tab = b.dataset.tab;
    if (!tab) return;
    // Strip: tapping the open tab collapses it. Drawer: always shows a pane.
    if (!isDrawerLayout() && ctl.dataset.open === tab) setOpenTab("");
    else setOpenTab(tab);
  });
  document.getElementById("ctlToggle").addEventListener("click", function () {
    setDrawer(!document.documentElement.classList.contains("drawer-open"));
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && document.documentElement.classList.contains("drawer-open")) setDrawer(false);
  });
  var sizeTimer = 0;
  function queueSize() {
    if (sizeTimer) clearTimeout(sizeTimer);
    sizeTimer = setTimeout(function () { sizeTimer = 0; onSizeChange(); }, 60);
  }
  window.addEventListener("resize", queueSize);
  window.addEventListener("orientationchange", queueSize);
  paintCtl();
}

// Boot step (runs once, in the original v112.3 order, from main.js)
export function boot() {
lastTab = "sound";
}
