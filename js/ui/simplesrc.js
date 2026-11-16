// Simple's Song | Progressions toggle. Reuses Expert's #xTog element and
// sourceInit / sourceReduce (decision 8) in a separate in-memory instance:
// Expert does not persist the tab, so Simple does not either, and the two
// modes do not share the selection.
import { sourceInit, sourceReduce } from "../expert/model.js?v=112.13";
import { placeBadges, prog, progSet } from "../songs/playback.js?v=112.13";
import { upSelected } from "../songs/song.js?v=112.13";
import { shared, state } from "../state.js?v=112.13";

var src = null, lastSel = false, after = function () {};

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
  var r = sourceReduce(src, v === "song" ? "tapSong" : "tapProg", srcCtx());
  src = r.s; lastSel = upSelected();
  if (r.fx === "openLibrary") click("#uploadBtn");
  else if (r.fx === "selectSong") { for (var i = 0; i < prog.list.length; i++) if (prog.list[i].up) { progSet(i); break; } }
  else if (r.fx && r.fx.pick != null) progSet(r.fx.pick);
  paintSimpleSrc();
  after();
}

export function bootSimpleSrc() {
  src = sourceInit(srcCtx());
  lastSel = upSelected();
  paintSimpleSrc();
  window.addEventListener("resize", function () { if (simpleOn()) placeSimpleTog(); });
}
