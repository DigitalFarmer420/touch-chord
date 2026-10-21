// Kids style: the one-chip Kids strip, Kids key control (kidKey / wireKidKey).
import { unlock } from "./audio/unlock.js?v=112.7";
import { activeKey, defaultKeyName, keyRootName } from "./keys.js?v=112.7";
import { magicHome } from "./songs/magic.js?v=112.7";
import { magic, prog } from "./songs/playback.js?v=112.7";
import { state, scheduleSave } from "./state.js?v=112.7";
import { wrap12 } from "./theory/quality.js?v=112.7";
import { accSym } from "./theory/spelling.js?v=112.7";
import { setLockKey } from "./ui/keychip.js?v=112.7";
import { updateSymbol } from "./ui/nowbox.js?v=112.7";
import { STRIP_ICONS, prettyAcc, wireStripTap } from "./ui/strip.js?v=112.7";
// v70: Kids strip = ONE big basic triad chip: the chord now current in the walk / loop
// (or the home triad before anything plays). The full board is still built underneath
// (hidden) so the progression, badges logic and magic Next pool are exactly as before.
function kidTriad(item) {
  if (!item) return null;
  var t = {}, k;   // v103: every Kids chord is a plain major triad
  for (k in item) t[k] = item[k];
  t.type = "major";
  t.qualityLabel = "";
  t.chipLabel = "";
  t.extensions = {};
  return t;
}
function kidCurrent() {
  if (prog.playing && prog.cur >= 0 && prog.steps[prog.cur]) return prog.steps[prog.cur].item;
  if (typeof magic !== "undefined" && magic && magic.item) return magic.item;
  return magicHome();
}
function kidName(item) { return prettyAcc(item.rootName); }   // v103: the root only
function kidCls(item) { return "major"; }   // v103: one pad colour (no minor / dim marking)
// v71: Kids = the big Now chip + the key's seven basic chords as tappable pads.
// v103: the seven scale-degree roots as plain MAJOR triads (C D E F G A B in C, all major). A pad tap plays its full triad (like a chip tap).
export function paintKidChip() {
  var el = document.getElementById("suggest");
  if (!el) return;
  var kids = state.style === "kids";
  el.classList.toggle("kids1", kids);
  var wrap = el.querySelector(".ss-kidwrap");
  if (!kids) { if (wrap) wrap.parentNode.removeChild(wrap); return; }
  var m = prog.model;
  var ksig = m ? m.key.pc + m.key.mode + keyRootName(m.key) : "";
  if (wrap && wrap._ksig !== ksig) { wrap.parentNode.removeChild(wrap); wrap = null; }
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = "ss-kidwrap";
    wrap._ksig = ksig;
    var now = document.createElement("div");
    now.className = "ss-kidnow";
    wrap.appendChild(now);
    var row = document.createElement("div");
    row.className = "ss-kidpads";
    row.setAttribute("role", "group");
    row.setAttribute("aria-label", "Seven major chords on the notes of the key");
    var notes = m ? m.notes.slice().sort(function (x, y) { return (x.item.degree || 0) - (y.item.degree || 0); }) : [];
    notes.forEach(function (n) {
      var it = kidTriad(n.item);
      var pb = document.createElement("button");
      pb.type = "button";
      pb.className = "ss-chip ss-kidpad " + kidCls(it);
      pb.textContent = kidName(it);
      pb.setAttribute("aria-label", kidName(it) + ", play");
      pb._tc = { item: it, hc: 1, row: "scale" };
      wireStripTap(pb, it);
      row.appendChild(pb);
    });
    wrap.appendChild(row);
    el.appendChild(wrap);
  }
  // v73: no big Now chip any more: Kids shows only the seven pads. Next / Play still walk
  // prog.steps (kidCurrent() feeds the walk), the gold next-note outline stays on the pads.
}
// v52: Simple key control. Drag/swipe right = up a semitone, left = down (wraps);
// the arrows do the same; the mode button flips Major/Minor. Sets the key lock.
export function kidKey() { return activeKey() || { pc: 0, mode: "major" }; }
function setKidKey(pc, mode) {
  // v112.5 (#2): in Simple the Now box follows a key change: it shows the new key's home chord
  // (I or i) instead of the last chord played before the switch (e.g. a Full-mode A). No sound.
  if (state.simple) {
    state.rootPc = wrap12(pc); state.type = mode === "minor" ? "minor" : "major";
    state.extensions = { six: false, min7: false, maj7: false, nine: false };
    state.forceChord = null; state.stripSpell = null; state.rootMidi = null;
  }
  setLockKey({ pc: wrap12(pc), mode: mode });
  if (state.simple) updateSymbol();
  scheduleSave(0);
}
export function paintKidKey() {
  var box = document.getElementById("kidKey");
  if (!box) return;
  var k = kidKey();
  var nm = accSym(defaultKeyName(k.pc, k.mode));
  var root = box.querySelector(".kk-root");
  box.querySelector(".kk-name").textContent = nm;
  root.setAttribute("aria-valuenow", String(k.pc));
  root.setAttribute("aria-valuetext", nm + (k.mode === "minor" ? " minor" : " major"));
  var mb = box.querySelector(".kk-mode");
  var minor = k.mode === "minor";
  mb.classList.toggle("major", !minor); mb.classList.toggle("minor", minor);
  mb.setAttribute("aria-label", (minor ? "Minor" : "Major") + " key, tap for " + (minor ? "major" : "minor"));
  mb.querySelector(".kk-mtxt").textContent = minor ? "Minor" : "Major";
  var face = minor ? STRIP_ICONS[1] : STRIP_ICONS[0];
  var fs = face.svg.replace(/<svg class="ss-arrow"[\s\S]*?<\/svg>/, "");
  if (mb.dataset.face !== k.mode) { mb.querySelector(".kk-face").innerHTML = fs; mb.dataset.face = k.mode; }
}
export function wireKidKey() {
  var box = document.getElementById("kidKey");
  if (!box) return;
  var root = box.querySelector(".kk-root"), name = box.querySelector(".kk-name");
  function step(d) {
    var k = kidKey();
    setKidKey(k.pc + d, k.mode);
    name.classList.remove("nudge-l", "nudge-r");
    void name.offsetWidth;
    name.classList.add(d > 0 ? "nudge-r" : "nudge-l");
    setTimeout(function () { name.classList.remove("nudge-l", "nudge-r"); }, 140);
  }
  // v112.5 (#7): each arrow's tap area covers its half of the box (CSS ::after); a swipe that starts there still
  // steps by drag, and then its click is ignored.
  var swiped = false;
  box.querySelector(".kk-prev").addEventListener("click", function (e) { e.stopPropagation(); if (swiped) { swiped = false; return; } unlock(); step(-1); });
  box.querySelector(".kk-next").addEventListener("click", function (e) { e.stopPropagation(); if (swiped) { swiped = false; return; } unlock(); step(1); });
  var drag = null;
  root.addEventListener("pointerdown", function (e) {
    var onArrow = !!e.target.closest(".kk-arrow");
    swiped = false;
    if (!onArrow) e.preventDefault();
    unlock();
    // One step per ~quarter of the box (at least 36 px) so a small wobble does nothing.
    drag = { id: e.pointerId, x: e.clientX, unit: Math.max(36, root.clientWidth / 4), cap: false };
    // On an arrow the capture waits for real movement, so a plain tap still clicks the arrow.
    if (!onArrow) { drag.cap = true; try { root.setPointerCapture(e.pointerId); } catch (err) {} }
  });
  root.addEventListener("pointermove", function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    e.preventDefault();
    var dx = e.clientX - drag.x;
    if (!drag.cap && Math.abs(dx) > 8) { drag.cap = true; try { root.setPointerCapture(e.pointerId); } catch (err) {} }
    while (Math.abs(dx) >= drag.unit) {
      var d = dx > 0 ? 1 : -1;
      swiped = true;
      step(d);
      drag.x += d * drag.unit;
      dx = e.clientX - drag.x;
    }
  });
  function end(e) { if (drag && e.pointerId === drag.id) drag = null; }
  root.addEventListener("pointerup", end);
  root.addEventListener("pointercancel", end);
  root.addEventListener("touchmove", function (e) { e.preventDefault(); }, { passive: false });
  root.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); step(1); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); step(-1); }
  });
  box.querySelector(".kk-mode").addEventListener("click", function () {
    unlock();
    var k = kidKey();
    setKidKey(k.pc, k.mode === "minor" ? "major" : "minor");
  });
  paintKidKey();
}
