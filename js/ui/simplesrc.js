// Simple's Song | Progressions toggle. Reuses Expert's #xTog element and
// sourceInit / sourceReduce (decision 8) in a separate in-memory instance:
// Expert does not persist the tab, so Simple does not either, and the two
// modes do not share the selection.
// N11/N12 (PR #5): like Expert, tapping Progressions only switches the view. The song stays selected (its step and
// Play are kept) until a progression is picked with the picker arrows. The song's walk position is saved when the
// picker leaves the song and restored when Song re-selects it, separately from any progression's own state.
import { sourceInit, sourceReduce } from "../expert/model.js?v=2026.11.21.1";
import { placeBadges, prog, progSet, progWalkAt, progWalkTo } from "../songs/playback.js?v=2026.11.21.1";
import { upSelected } from "../songs/song.js?v=2026.11.21.1";
import { shared, state } from "../state.js?v=2026.11.21.1";

var src = null, lastSel = false, songWalk = null, after = function () {};

function $(id) { return document.getElementById(id); }
function srcCtx() { return { hasSong: !!shared.U, songSelected: upSelected() }; }
function click(sel) { var b = document.querySelector(sel); if (b) b.click(); return !!b; }
function simpleOn() {
  var c = document.documentElement.classList;
  return !!state.simple && !c.contains("tc-classic") && !c.contains("expert") && !c.contains("kv");
}

// Pure: what Song vs Progressions should show. Used by unit tests and paint().
export function simpleSourceChrome(view, songSelected) {
  return { showLyrics: view === "song" && !!songSelected, showProgPicker: view === "prog", showEmptySong: view === "song" && !songSelected };
}

// Pure: which list index Simple should select for the current tab.
// Song view selects the uploaded song. Progressions view keeps the current selection, as Expert's sourceReduce does
// (the song keeps its step and keeps playing until a progression is picked with the picker arrows), so the toggle
// never re-picks a progression on its own (N11).
export function simpleSourceIndex(view, list, curIdx) {
  list = list || [];
  if (view === "song") {
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].up) return i;
  }
  return curIdx;
}

// Pure: next/prev index in Progressions view, skipping the uploaded song.
export function simpleProgStepIndex(list, from, dir) {
  var n = (list || []).length;
  if (!n) return from;
  var i = from, step = dir < 0 ? -1 : 1;
  for (var k = 0; k < n; k++) {
    i = ((i + step) % n + n) % n;
    if (!list[i] || !list[i].up) return i;
  }
  return from;
}

export function simpleSrcState() { return src ? { view: src.view, listOpen: src.listOpen, songWalk: songWalk } : null; }
// Called by the picker (progbar.js) right before it changes the selection: if the song is selected, save its walk
// position so tapping Song brings it back at the same step (N11). Simple only.
export function noteSimpleSongWalk() {
  if (!simpleOn() || !upSelected()) return;
  songWalk = progWalkAt();
}
export function setSimpleSrcAfter(fn) { after = fn || function () {}; }

export function placeSimpleTog() {
  var tog = $("xTog"); if (!tog || !simpleOn()) return;
  var bar = document.querySelector("header.topbar");
  var chip = bar && bar.querySelector(".mode-chip");
  if (chip && tog.nextElementSibling !== chip) bar.insertBefore(tog, chip);
}

export function paintSimpleSrc() {
  var de = document.documentElement, on = simpleOn(), tog = $("xTog");
  if (!on) { de.classList.remove("s-src-song", "s-src-prog"); return; }
  if (!src) { src = sourceInit(srcCtx()); lastSel = upSelected(); }
  var sel = upSelected();
  if (sel !== lastSel) { lastSel = sel; src = sourceReduce(src, "sync", srcCtx()).s; }
  de.classList.toggle("s-src-song", src.view === "song");
  de.classList.toggle("s-src-prog", src.view === "prog");
  if (tog) {
    Array.prototype.forEach.call(tog.querySelectorAll("button"), function (b) {
      var o = b.dataset.v === src.view; b.classList.toggle("on", o); b.setAttribute("aria-selected", o ? "true" : "false");
    });
  }
  placeSimpleTog();
}

export function tapSimpleSrc(v) {
  if (!simpleOn()) return;
  if (!src) src = sourceInit(srcCtx());
  var r = sourceReduce(src, v === "song" ? "tapSong" : "tapProg", srcCtx());
  src = r.s;
  if (r.fx === "openLibrary") click("#uploadBtn");
  else if (r.fx === "selectSong") selectSong();
  else if (r.fx && r.fx.pick != null) progSet(r.fx.pick);
  var want = simpleSourceIndex(src.view, prog.list, prog.idx);
  if (want != null && want !== prog.idx) selectSong();
  lastSel = upSelected();
  paintSimpleSrc();
  after();
}
// Back to the song after a progression was picked: re-select it and put its walk back where it was.
function selectSong() {
  for (var i = 0; i < prog.list.length; i++) if (prog.list[i].up) {
    progSet(i);
    if (songWalk) progWalkTo(songWalk);
    break;
  }
  songWalk = null;
}

export function bootSimpleSrc() {
  src = sourceInit(srcCtx());
  lastSel = upSelected();
  paintSimpleSrc();
  window.addEventListener("resize", function () { if (simpleOn()) placeSimpleTog(); });
}
