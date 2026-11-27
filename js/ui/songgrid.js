// Loaded song: the chord grid keeps today's spots. Song chords stay; the rest are hidden
// (the space stays). Jam, when on, fills up to 6 ranked extras into empty cells.
// Kids is not touched.
import { prog } from "../songs/playback.js?v=2026.11.27.4";
import { jamRank, takeJam, songChordList, sameSongChord, chordFamily, songGridOn } from "../songs/jam.js?v=2026.11.27.4";
import { upSelected } from "../songs/song.js?v=2026.11.27.4";
import { state, shared, scheduleSave } from "../state.js?v=2026.11.27.4";
import { STRIP_QUAL, styleDegreeQual, wireStripTap, prettyAcc } from "./strip.js?v=2026.11.27.4";

var ROWN = { bright: "b", happy: "h", sad: "s", tension: "t" };

function kidsOn() {
  if (state.style === "kids" || shared.kidsView) return true;
  try {
    var cl = document.documentElement.classList;
    return !!(cl && cl.contains("kv") === true);
  } catch (e) { return false; }
}

function cloneExt(src) {
  var e = { six: false, min7: false, maj7: false, nine: false, sus2: false, flat9: false, sharp9: false, thirteen: false, over: 0, sharp5: false, flat5: false };
  if (src) for (var k in src) if (Object.prototype.hasOwnProperty.call(src, k)) e[k] = src[k];
  return e;
}

// Where the style already names this diatonic degree (jazz ii → m7), use that name.
function voiceExtra(extra, mode) {
  if (!extra || extra.kind !== "diatonic") return extra;
  var q = styleDegreeQual(state.style, mode, extra.degree, false);
  var spec = q && STRIP_QUAL[q];
  if (!spec) return extra;
  var ext = cloneExt(spec.ext);
  if (chordFamily({ type: spec.type, extensions: ext }) !== extra.family) return extra;
  var qual = spec.label || "";
  return Object.assign({}, extra, { type: spec.type, extensions: ext, sym: extra.rootName + qual, voiced: q });
}

function chipItem(chip) { return chip && chip._tc && chip._tc.item; }

function findChip(chips, item) {
  for (var i = 0; i < chips.length; i++) if (sameSongChord(chipItem(chips[i]), item)) return chips[i];
  return null;
}

function cellTaken(chips, row, hc) {
  for (var i = 0; i < chips.length; i++) {
    var t = chips[i]._tc;
    if (t && t.row === row && Math.abs(t.hc - hc) < 2) return true;
  }
  return false;
}

function addChip(el, extra) {
  var color = extra.type === "minor" ? "minor" : extra.row === "tension" || extra.type === "sus4" ? "tension" : extra.row === "bright" ? "color" : "major";
  var b = document.createElement("button");
  b.type = "button";
  b.className = "ss-chip ss-jam ss-jamextra tmp " + color + " r-" + (ROWN[extra.row] || "h") + (color === "color" ? " borrowed" : "") + (extra.hc % 2 === 0 ? " half" : "");
  b.style.gridRow = ROWN[extra.row] || "h";
  b.style.gridColumn = (2 + extra.hc) + " / span 2";
  var root = prettyAcc(extra.rootName), sym = prettyAcc(extra.sym), qual = sym.slice(root.length);
  b.innerHTML = "<span class=\"nm\"><span class=\"r\"></span><span class=\"q\"></span></span><span class=\"rn\"></span>";
  b.querySelector(".r").textContent = root;
  b.querySelector(".q").textContent = qual;
  b.setAttribute("aria-label", sym + ", jam chord");
  var item = {
    rootPc: extra.rootPc, rootName: extra.rootName, type: extra.type, extensions: extra.extensions,
    qualityLabel: qual, chipLabel: qual, degree: extra.degree || null
  };
  b._tc = { item: item, hc: extra.hc, row: extra.row };
  wireStripTap(b, item);
  el.appendChild(b);
  return b;
}

function clearGrid(el) {
  Array.prototype.forEach.call(el.querySelectorAll(".ss-jamextra, .jam-pill"), function (n) { n.parentNode.removeChild(n); });
  Array.prototype.forEach.call(el.querySelectorAll(".ss-chip"), function (c) {
    c.classList.remove("ss-off", "ss-song", "ss-jam");
    c.removeAttribute("aria-hidden");
  });
  if (prog.badges) prog.badges.forEach(function (b) { if (b.el) { b.el.style.visibility = ""; b.el.removeAttribute("aria-hidden"); } });
}

function paintPill(el, on, n) {
  var b = document.createElement("button");
  b.type = "button";
  b.className = "jam-pill" + (on ? " on" : "");
  b.setAttribute("aria-pressed", on ? "true" : "false");
  b.setAttribute("aria-label", on ? "Jam on, " + n + " extra chords" : "Jam");
  b.innerHTML = "<span class=\"sw\" aria-hidden=\"true\"></span>Jam" + (on ? " <span class=\"ct\">+" + n + "</span>" : "");
  b.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    state.jam = !state.jam;
    scheduleSave();
    layoutSongGrid(el);
  });
  el.appendChild(b);
}

export function layoutSongGrid(el) {
  if (!el || !el.querySelectorAll || kidsOn()) return;
  var chips = el.querySelectorAll(".ss-chip");
  if (!chips || typeof chips.length !== "number") return;
  clearGrid(el);
  chips = el.querySelectorAll(".ss-chip");
  var want = songGridOn({ kids: false, kv: false, style: state.style, song: upSelected() });
  if (!want || !prog.model) return;
  var song = songChordList(prog.steps);
  var list = Array.prototype.slice.call(chips);
  list.forEach(function (c) {
    if (song.some(function (s) { return sameSongChord(s, chipItem(c)); })) c.classList.add("ss-song");
    else { c.classList.add("ss-off"); c.setAttribute("aria-hidden", "true"); }
  });
  var shown = 0;
  if (state.jam) {
    var ranked = jamRank(prog.model.key, song).map(function (c) { return voiceExtra(c, prog.model.key.mode); });
    var occupied = list.map(function (c) { return { row: c._tc && c._tc.row, hc: c._tc && c._tc.hc, item: chipItem(c) }; });
    takeJam(ranked, occupied, 6).forEach(function (extra) {
      var chip = findChip(list, extra);
      if (chip && !chip.classList.contains("ss-song")) {
        chip.classList.remove("ss-off");
        chip.classList.add("ss-jam");
        chip.removeAttribute("aria-hidden");
        shown++;
        return;
      }
      if (chip) return;
      if (cellTaken(list, extra.row, extra.hc)) return;
      var made = addChip(el, extra);
      list.push(made);
      shown++;
    });
  }
  if (prog.badges) prog.badges.forEach(function (b) {
    if (!b.el || !b.target) return;
    var hide = b.target.classList.contains("ss-off");
    b.el.style.visibility = hide ? "hidden" : "";
    if (hide) b.el.setAttribute("aria-hidden", "true");
  });
  paintPill(el, !!state.jam, shown);
}
