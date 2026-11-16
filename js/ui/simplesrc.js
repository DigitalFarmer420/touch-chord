// Simple's Song | Progressions toggle. Reuses Expert's #xTog element and
// sourceInit / sourceReduce (decision 8) in a separate in-memory instance:
// Expert does not persist the tab, so Simple does not either, and the two
// modes do not share the selection.
import { sourceInit, sourceReduce } from "../expert/model.js?v=112.14";
import { placeBadges, prog, progSet } from "../songs/playback.js?v=112.14";
import { upSelected } from "../songs/song.js?v=112.14";
import { shared, state } from "../state.js?v=112.14";

var src = null, lastSel = false, lastProg = 0, after = function () {};

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
// Song view stays on the uploaded song; Progressions view stays on a style
// progression (the last one if the current row is the song). Expert's
// sourceReduce leaves the song selected until a progression is picked, but
// Simple's #prog picker always shows prog.list[prog.idx], so we switch here.
export function simpleSourceIndex(view, list, curIdx, lastProg) {
  list = list || [];
  function firstStyle() {
    for (var i = 0; i < list.length; i++) if (list[i] && !list[i].up) return i;
    return curIdx;
  }
  function songIdx() {
    for (var i = 0; i < list.length; i++) if (list[i] && list[i].up) return i;
    return -1;
  }
  if (view === "song") {
    var s = songIdx();
    return s >= 0 ? s : curIdx;
  }
  var cur = list[curIdx];
  if (cur && !cur.up) return curIdx;
  var lp = list[lastProg];
  if (lp && !lp.up) return lastProg;
  return firstStyle();
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

export function simpleSrcState() { return src ? { view: src.view, listOpen: src.listOpen } : null; }
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
  if (src.view === "prog" && prog.list[prog.idx] && !prog.list[prog.idx].up) lastProg = prog.idx;
  var r = sourceReduce(src, v === "song" ? "tapSong" : "tapProg", srcCtx());
  src = r.s;
  if (r.fx === "openLibrary") click("#uploadBtn");
  else if (r.fx === "selectSong") { for (var i = 0; i < prog.list.length; i++) if (prog.list[i].up) { progSet(i); break; } }
  else if (r.fx && r.fx.pick != null) progSet(r.fx.pick);
  var want = simpleSourceIndex(src.view, prog.list, prog.idx, lastProg);
  if (want != null && want !== prog.idx) progSet(want);
  if (src.view === "prog" && prog.list[prog.idx] && !prog.list[prog.idx].up) lastProg = prog.idx;
  lastSel = upSelected();
  paintSimpleSrc();
  after();
}

export function bootSimpleSrc() {
  src = sourceInit(srcCtx());
  lastSel = upSelected();
  paintSimpleSrc();
  window.addEventListener("resize", function () { if (simpleOn()) placeSimpleTog(); });
}
