// Play along hint pill (placement, misses, timers).
import { playAlongKey, playAlongNow } from "../songs/playalong.js?v=112.6";
import { prog } from "../songs/playback.js?v=112.6";
import { state, loop, shared } from "../state.js?v=112.6";
import { nxKeyEl, nxBurst, kidsGoldStep } from "./next.js?v=112.6";
// v112 Play along hints (Config > Show hints, on by default). A tap that does not advance while a next chord is
// marked gets one small pill above the keyboard for 2 s: at most one every 4 s, the same hint not again until an
// advance, never during Play (song or loop) or with Play along off. The tap itself still sounds as before.
// a: outside Kids, a key that is not the next root (the marked key pulses once); b: outside Kids, another chip;
// c: a key or chip while a chord-table button is held; d: Kids, a pad or key that is not gold (a grayed key too);
// e: the 3rd miss in a row, once per song. Not-in-key taps are folded into a / b.
const PA_HINT_MS = 2000;
const PA_HINT_GAP = 4000;
var paHintAt;
var paHintSeen;
var paHintTimer;
var paLostSong;
export const paHintLog = { shown: [], skipped: [], misses: 0 };
const PA_HINT_TXT = { a: "Try the marked key next", b: "Tap the dot chord next", c: "Let go of the chord button to follow the song",
  d: "Tap the dot chord next", e: "Lost? Tap Next to hear the next chord", ek: "Tap the dot chord next",
  k: "That note isn't in this song's key", kc: "That chord isn't in this song's key" };   // v112.1 (M1)
var paMissSong;
function paTableHeld() { for (var h in shared.paletteHolds) if (shared.paletteHolds[h]) return true; return false; }
export function playAlongKeyOk(pad) {   // the tap is an advance (Kids gold key handled earlier; root key outside Kids)
  return playAlongKey(pad);
}
function paHintOk() {
  return state.paHints !== false && state.playAlong !== false && !prog.playing && !(typeof loop !== "undefined" && loop && loop.playing);
}
export function paHintMiss(kind, el) {
  if (!paHintOk()) return;
  var id, pulse = null;
  if (state.style === "kids") {
    if (!kidsGoldStep()) return;
    if (kind === "chip" && !(el && el.classList.contains("ss-kidpad"))) return;
    id = "d";
  } else {
    var cur = playAlongNow();
    if (!cur) return;
    if (kind === "key" && state.simple) return;
    if (paTableHeld()) id = "c";
    else if (kind === "key" && el && el.classList.contains("nokey")) id = "k";   // v112.1 (M1): out-of-key key (Full Range off)
    else if (kind === "chip" && el && el.classList.contains("borrowed")) id = "kc";   // v112.1 (M1): out-of-key chip
    else if (kind === "key") { id = "a"; pulse = nxKeyEl(cur.item); }
    else id = "b";
  }
  var song = state.style + "|" + ((prog.list[prog.idx] || {}).name || "");
  if (song !== paMissSong) { paMissSong = song; shared.paMiss = 0; paHintSeen = {}; }   // v112.1 (L2)
  shared.paMiss++;
  paHintLog.misses++;
  if (shared.paMiss >= 3 && paLostSong !== song && paHintShow(state.style === "kids" ? "ek" : "e", kind)) { paLostSong = song; return; }
  if (paHintShow(id, kind) && pulse) nxBurst(pulse);   // a: the marked key pulses once (v105 burst)
}
function paHintShow(id, kind) {
  var now = (window.performance && performance.now) ? performance.now() : Date.now();
  if (now - paHintAt < PA_HINT_GAP) { paHintLog.skipped.push({ id: id, why: "rate" }); return false; }
  if (paHintSeen[id]) { paHintLog.skipped.push({ id: id, why: "repeat" }); return false; }
  var el = document.getElementById("paHint");
  if (!el) return false;
  paHintSeen[id] = true; paHintAt = now;
  el.textContent = PA_HINT_TXT[id];
  el.hidden = false;
  paHintPlace(el);
  void el.offsetWidth;
  el.classList.add("on");
  clearTimeout(paHintTimer);
  paHintTimer = setTimeout(paHintHide, PA_HINT_MS);
  paHintLog.shown.push({ id: id, text: PA_HINT_TXT[id], kind: kind, t: Math.round(now), style: state.style });
  return true;
}
const PA_HINT_AVOID = "#pads .pad, #suggest button, #suggest .ss-chip, #suggest .ss-note, #suggest .ss-kidpad, #palette button, button, input, select, [role=button], #kidsLyr .sb-row";
function paHintPlace(el) {   // v112.3: as high as possible (top area or empty space), every style, Simple and Full
  var vw = window.innerWidth, vh = window.innerHeight, av = [];
  function add(r) { if (r && r.width > 0 && r.height > 0) av.push(r); }
  Array.prototype.forEach.call(document.querySelectorAll(PA_HINT_AVOID + ", #styles, .now-card, #symbol, #tones, #nowMix"), function (b) {
    if (b.closest("#paHint, #tour") || b.matches("#kidsLyr .sb-row")) return;
    add(b.getBoundingClientRect());
  });
  Array.prototype.forEach.call(document.querySelectorAll("#kidsLyr .sb-row"), function (row) {   // lyric lines: the words themselves
    if (!row.getBoundingClientRect().width) return;
    try { var rg = document.createRange(); rg.selectNodeContents(row); Array.prototype.forEach.call(rg.getClientRects(), add); } catch (e) { add(row.getBoundingClientRect()); }
  });
  var cfgs = [[0, 0], [0, 240], [0, 200], [1, 0], [1, 200], [1, 160], [1, 130], [1, 110]], best = null;
  for (var c = 0; c < cfgs.length; c++) {
    el.classList.toggle("compact", !!cfgs[c][0]);
    el.style.width = cfgs[c][1] ? Math.min(cfgs[c][1], vw - 16) + "px" : "";
    var h = el.offsetHeight || 32, w = el.offsetWidth || 200, found = null;
    for (var y = 2; y <= vh - h - 2 && (!best || y < best.y); y += 2) {
      var bx = null;
      for (var x = 4; x <= vw - w - 4; x += 4) {
        var ok = true;
        for (var k = 0; k < av.length; k++) { var r = av[k]; if (x < r.right + 2 && x + w > r.left - 2 && y < r.bottom + 2 && y + h > r.top - 2) { ok = false; break; } }
        if (ok && (bx === null || Math.abs(x + w / 2 - vw / 2) < Math.abs(bx + w / 2 - vw / 2))) bx = x;
      }
      if (bx !== null) { found = { x: bx, y: y, c: c }; break; }
    }
    if (found && (!best || found.y < best.y)) best = found;
    if (best && best.y <= 4) break;
  }
  if (!best) best = { x: 4, y: 2, c: cfgs.length - 1 };
  el.classList.toggle("compact", !!cfgs[best.c][0]);
  el.style.width = cfgs[best.c][1] ? Math.min(cfgs[best.c][1], vw - 16) + "px" : "";
  el.style.left = best.x + "px"; el.style.transform = "none";
  el.style.top = Math.round(best.y) + "px";
}
export function paHintHide() {
  clearTimeout(paHintTimer); paHintTimer = 0;
  var el = document.getElementById("paHint");
  if (!el) return;
  el.classList.remove("on");
  el.hidden = true;
}
export function paHintAdvanced() { shared.paMiss = 0; paHintSeen = {}; }

// Boot step (runs once, in the original v112.3 order, from main.js)
export function boot() {
paHintAt = -1e9;
  paHintSeen = {};
  paHintTimer = 0;
  paLostSong = null;
paMissSong = null;   // v112.1 (L2)
}
