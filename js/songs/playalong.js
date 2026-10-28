// Play along: advance on the marked key / chip.
import { magicAdvance } from "./magic.js?v=112.12";
import { magic, prog, PROG_TEST } from "./playback.js?v=112.12";
import { sameChord } from "./presets.js?v=112.12";
import { upSelected, upNextStep } from "./song.js?v=112.12";
import { state, shared } from "../state.js?v=112.12";
import { wrap12 } from "../theory/quality.js?v=112.12";
import { nxNow } from "../ui/next.js?v=112.12";
import { kidsTapPulse } from "../ui/pulse.js?v=112.12";
// v108 Play along (outside Kids; Config > Play along enable, on by default): with a next chord marked
// (nxNow, the same chord Next plays), tapping one of its tones on the keyboard (pitch class, any octave;
// Full mode) or that chord's chip (Full and Simple) advances exactly like Next (magicAdvance). Never
// during Play song, never on an uploaded song's random tail (no next chord marked), never in Kids
// (Kids keeps its gold pad / key above). Off: taps only play sound.
export const paLog = { taps: [] };
export function playAlongNow() {
  if (state.playAlong === false || state.style === "kids" || prog.playing || !prog.steps.length || typeof magic === "undefined" || !magic) return null;
  if (upSelected() && upNextStep() < 0) return null;
  var cur = nxNow();
  return cur && cur.item ? cur : null;
}
// v109 (H1): only the next chord's ROOT key (its chord root, the key with the gold dot; any octave) advances,
// and never while a chord-table button is held (then the tap builds the held chord). Other keys: plain taps.
export function playAlongKey(pad) {
  if (!pad || state.simple || pad.dataset.midi == null || pad.dataset.midi === "") return false;
  for (var h in shared.paletteHolds) if (shared.paletteHolds[h]) return false;
  var cur = playAlongNow();
  if (!cur) return false;
  return wrap12(Number(pad.dataset.midi)) === wrap12(cur.item.rootPc);
}
export function playAlongChip(b, item) {
  if (!b || !item || b.classList.contains("ss-kidpad")) return false;
  var cur = playAlongNow();
  return !!(cur && (b === cur.el || sameChord(item, cur.item)));
}
// v111 (D6): key + chip within PA_TWIN_MS = one advance
const PA_TWIN_MS = 150;
var paLast;
function paEvNow() { return shared.paEvT || performance.now(); }
export function paTwin(kind, pc, item, b) {
  if (!paLast || paLast.kind === kind || Math.abs(paEvNow() - paLast.at) > PA_TWIN_MS) return false;
  if (state.playAlong === false || state.style === "kids" || prog.playing) return false;
  var cur = playAlongNow(), its = [paLast.item, cur && cur.item];
  var hit = its.some(function (it) { return it && (item ? sameChord(item, it) : wrap12(pc) === wrap12(it.rootPc)); }) || !!(b && cur && b === cur.el);
  if (hit && PROG_TEST) paLog.twins = (paLog.twins || 0) + 1;
  return hit;
}
export function playAlongGo(el, kind) {
  var cur = playAlongNow();
  if (!cur) return;
  paLast = { kind: kind, at: paEvNow(), item: cur.item };   // v111 (D6)
  magicAdvance();   // = Next: plays the marked chord, queues and marks the one after
  if (PROG_TEST) paLog.taps.push({ kind: kind, pos: magic.pos, cur: prog.cur, style: state.style, simple: !!state.simple });
  kidsTapPulse(el);
}

// Boot step (runs once, in the original v112.3 order, from main.js)
export function boot() {
paLast = null;   // paEvT: the input event's own time (not when it was handled)
}
