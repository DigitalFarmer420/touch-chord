// Chord types / extensions palette holds.
import { keyRootSpell, modeKey, keyDegrees } from "../keys.js?v=112.4";
import { state, shared } from "../state.js?v=112.4";
import { Theory } from "../theory/index.js?v=112.4";
import { releaseFingers, liftFinger, refreshHeld } from "./pads.js?v=112.4";
import { clearStripExt } from "./strip.js?v=112.4";

export function typeHeld(name) {
  for (var id in shared.paletteHolds) {
    if (shared.paletteHolds[id].kind === "type" && shared.paletteHolds[id].value === name) return true;
  }
  return false;
}

export function extStillHeld(name) {
  for (var id in shared.paletteHolds) {
    if (shared.paletteHolds[id].kind === "ext" && shared.paletteHolds[id].value === name) return true;
  }
  return false;
}

export function syncPalette() {
  var nextType = "major";
  for (var id in shared.paletteHolds) {
    if (shared.paletteHolds[id].kind === "type") nextType = shared.paletteHolds[id].value;
  }
  state.type = nextType;
  var keys = ["six", "min7", "maj7", "nine"];
  for (var i = 0; i < keys.length; i++) state.extensions[keys[i]] = extStillHeld(keys[i]);
  clearStripExt();
  if (shared.paletteTimer) clearTimeout(shared.paletteTimer);
  shared.paletteTimer = setTimeout(function () {
    shared.paletteTimer = 0;
    refreshHeld();
  }, 20);
}

function releasePalette(pointerId) {
  if (pointerId == null) {
    var any = false;
    for (var id in shared.paletteHolds) any = true;
    if (!any) return;
    shared.paletteHolds = {};
  } else {
    if (!shared.paletteHolds[pointerId]) return;
    delete shared.paletteHolds[pointerId];
  }
  syncPalette();
}

export function onPaletteDown(e) {
  if (e.button != null && e.button !== 0) return;
  var b = e.target.closest ? e.target.closest("button") : null;
  if (!b || b.disabled || !b.closest("#palette")) return;
  e.preventDefault();
  shared.paletteHolds[e.pointerId] = {
    kind: b.dataset.type ? "type" : "ext",
    value: b.dataset.type || b.dataset.ext
  };
  try { b.setPointerCapture(e.pointerId); } catch (err) {}
  shared.paletteStrike = true;
  syncPalette();
}

export function onPaletteUp(e) {
  releasePalette(e.pointerId);
}


export function onTouchGone(e) {
  var changed = e.changedTouches;
  if (changed) {
    for (var i = 0; i < changed.length; i++) {
      var tgt = changed[i].target;
      if (tgt && tgt.closest && tgt.closest("#sustainBtn")) continue;
      var id = changed[i].identifier;
      // Pointer path keys fingers by pointerId (often !== touch.identifier).
      // liftFinger no-ops on unknown ids; also try Chrome's identifier+2 map.
      liftFinger(id);
      if (typeof id === "number") liftFinger(id + 2);
      releasePalette(id);
      if (typeof id === "number") releasePalette(id + 2);
    }
  }
  // Only clear leftovers when every touch is gone. Soft lift respects Sustain.
  if (!e.touches || e.touches.length === 0) {
    releaseFingers();
    releasePalette(null);
  }
}

// Key mode on/off bookkeeping (shared by the Key button and Simple mode).
export function setKeyModeState(on) {
  state.keyMode = !!on;
  if (state.keyMode) {
    var degs = keyDegrees(modeKey());
    var found = 1;
    for (var i = 0; i < degs.length; i++) {
      if (degs[i].pc === state.rootPc) found = degs[i].degree;
    }
    state.degree = found;
  } else {
    var d = Theory.degreeChord(state.keyRoot, state.keyScale, state.degree, keyRootSpell(modeKey()));
    state.rootPc = d.rootPc;
  }
}
