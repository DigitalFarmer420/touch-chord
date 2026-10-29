// Magic Next (one chord per tap).
import { api as ChordAudio } from "../audio/index.js?v=112.13";
import { magic, progStop, prog, PROG_TEST, progLockKey } from "./playback.js?v=112.13";
import { sameChord } from "./presets.js?v=112.13";
import { progRingSec } from "./song.js?v=112.13";
import { state, shared } from "../state.js?v=112.13";
import { wrap12 } from "../theory/quality.js?v=112.13";
import { paHintAdvanced } from "../ui/hints.js?v=112.13";
import { paintNextHint, paintProgActive, magicHintClear } from "../ui/next.js?v=112.13";
import { paintProg } from "../ui/progbar.js?v=112.13";
import { fxStepPulse } from "../ui/pulse.js?v=112.13";
import { clearSuggestPreview, applySuggestion, stripLabel } from "../ui/strip.js?v=112.13";
import { sustainPool } from "../ui/sustain.js?v=112.13";
// v68: magic Next. Each tap plays ONE chord: the first N taps walk the progression in order
// (1 bar each at the style's BPM), then each tap is a random chord from the board (never the
// same twice in a row, weighted toward strong moves), every 4th or 8th one the home chord for
// 2 bars. A tap cuts the ringing chord (gate ramp, no click); otherwise it ends after its bars.
// One timer owner (suggestTimer), cleared before each new one; the release is set on the
// AudioContext clock. With Sustain down the chord joins the pedal pool exactly like a chip tap.
const MAGIC_LOOK = 0.04;   // s: the ring-end release is scheduled this far ahead on the audio clock
function magicCycle() { return magic.rng() < 0.5 ? 4 : 8; }
export function magicReset() { if (!magic) return; magic.pos = 0; magic.last = null; magic.since = 0; magic.cycle = magicCycle(); magic.next = null; magic.item = null; }
export function magicPool() {
  var m = prog.model, out = [];
  if (!m) return out;
  function add(it) { if (!it) return; for (var i = 0; i < out.length; i++) if (sameChord(out[i], it)) return; out.push(it); }
  m.chips.forEach(function (c) { add(c.item); });   // chord chips (incl. dashed borrowed ones)
  m.notes.forEach(function (n) { add(n.item); });   // scale-row notes (their triads)
  return out;
}
export function magicHome() {
  var m = prog.model;
  if (!m) return null;
  var k = m.key, home = null;
  m.chips.forEach(function (c) { if (!home && wrap12(c.item.rootPc) === wrap12(k.pc) && (c.row === "happy" || c.row === "sad")) home = c.item; });
  if (!home) m.notes.forEach(function (n) { if (!home && n.home) home = n.item; });
  return home;
}
export function magicTarget(item) {
  var el = document.getElementById("suggest");
  if (!el || !item) return null;
  var groups = [el.querySelectorAll(".ss-chip:not(.tmp)"), el.querySelectorAll(".ss-note"), el.querySelectorAll(".ss-chip.tmp")];
  for (var g = 0; g < groups.length; g++)
    for (var i = 0; i < groups[g].length; i++) if (groups[g][i]._tc && sameChord(groups[g][i]._tc.item, item)) return groups[g][i];
  return null;
}
function magicEnd() {
  shared.suggestTimer = 0;
  // Ring end: release on the audio clock (a chord the Sustain pedal adopted keeps ringing, as before).
  if (ChordAudio.ctx && !sustainPool["suggest"]) ChordAudio.stopChord("suggest", Math.max(ChordAudio.currentTime(), magic.endAt));
  magic.lit = false;
  magicHintClear();
  if (!prog.playing) Array.prototype.forEach.call(document.querySelectorAll("#suggest .pg-on"), function (n) { n.classList.remove("pg-on"); });
  clearSuggestPreview();
}
function magicPlay(item, bars, step) {
  // Cut the chord still ringing, even when its release is already scheduled (gate ramp, no click).
  if (ChordAudio.ctx && !sustainPool["suggest"]) ChordAudio.stopChord("suggest", null, null, true);
  if (prog.flashT) { clearTimeout(prog.flashT); prog.flashT = 0; }
  prog.cur = step;   // -1 in the random part: no progression badge lit
  magic.item = item; magic.lit = true; magic.last = item;
  shared.kidsSolo = state.style === "kids";
  try { applySuggestion(item); } finally { shared.kidsSolo = false; }
  var ring = bars * progRingSec();   // Upload: the song BPM when a song is selected
  magic.endAt = (ChordAudio.ctx ? ChordAudio.currentTime() : 0) + ring;
  if (shared.suggestTimer) clearTimeout(shared.suggestTimer);
  shared.suggestTimer = setTimeout(magicEnd, Math.max(0, (ring - MAGIC_LOOK) * 1000));
  paintProgActive();
  fxStepPulse();   // v93
  paintProg();
  if (PROG_TEST) { magic.log.push({ step: step, sym: stripLabel(item), bars: bars, home: !!magic.wasHome, at: magic.endAt - ring }); if (magic.log.length > 5000) magic.log.shift(); }
}
// v68: what the next Next tap will play, decided ONE TAP AHEAD (a one-item queue) so the
// "next chord" hint is always the chord the tap really plays. Same RNG order as deciding at
// tap time: the decision for tap k+1 is made right after tap k, from the same committed state.
function magicDecide() {
  if (!prog.steps.length) return null;
  var n = prog.steps.length;
  var d = { item: null, bars: 1, step: -1, home: false, pos: magic.pos + 1, since: magic.since, cycle: magic.cycle };
  var at = magic.pos;
  if (at >= n) at = 0;   // v81 Kids; v111 every style and uploaded songs: Next loops back to the first chord (no random part)
  d.step = at;
  d.pos = at + 1;
  d.item = prog.steps[d.step].item;
  return d;
}
export function magicQueue() {
  if (!magic.next && prog.steps.length) magic.next = magicDecide();
  return magic.next;
}
// The ONE advance entry point (Next button in both modes, test hook). A future auto-advance
// should call this too. It commits the queued chord, plays it, queues the one after and
// repaints the next-chord hint.
export function magicAdvance() {
  if (!prog.steps.length) return;
  paHintAdvanced();   // v112: an advance resets the miss run and lets every hint show again
  progStop();
  shared.upNxOff = false;
  progLockKey();
  var d = magicQueue();
  magic.next = null;
  if (!d) return;
  magic.pos = d.pos; magic.since = d.since; magic.cycle = d.cycle; magic.wasHome = d.home;
  magicPlay(d.item, d.bars, d.step);
  magic.hint = true;
  magicQueue();
  paintNextHint();
}
export function progNext() { magicAdvance(); }
// Badge: plays that step (1 bar) and the walk carries on from it.
export function progBadge(steps) {
  var s = steps[0];
  for (var i = 0; i < steps.length; i++) if (steps[i] > prog.cur) { s = steps[i]; break; }
  progStop();
  progLockKey();
  magic.pos = s + 1;
  magic.next = null;
  shared.upNxOff = false;
  magicPlay(prog.steps[s].item, 1, s);
  magic.hint = true;
  magicQueue();
  paintNextHint();
}
