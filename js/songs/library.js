// My songs library (touchChord.library.v1): storage, open, versions, delete, list.
import { progStop } from "./playback.js?v=112.12";
import { upSelected, upKeyApply, upKeyNow, upSelect, upEsc } from "./song.js?v=112.12";
import { UP_STORE, upCheck, upBuild, upRemove } from "./upload.js?v=112.12";
import { state, shared } from "../state.js?v=112.12";
import { computeSpec } from "../ui/pads.js?v=112.12";
import { paintSongBar } from "../ui/songbar.js?v=112.12";
import { paintSuggestions } from "../ui/strip.js?v=112.12";
// v77: My songs. touchChord.library.v1 = { v: 1, active: id|null, sel, songs: [{ id, title, artist, added,
// song: <raw JSON>, choice, reviewed, locked, liveKey }] }, max 50. U is the active song (or null).
// Saving never fails silently (upSaveErr in the panel); a full library never evicts.
const LIB_STORE = "touchChord.library.v1";
export const LIB_MAX = 50;
export var libSaveErr;
export function libKey(t, a) { return String(t || "").trim().toLowerCase() + "\u0000" + String(a || "").trim().toLowerCase(); }
export function libGet(id) { for (var i = 0; i < shared.LIB.songs.length; i++) if (shared.LIB.songs[i].id === id) return shared.LIB.songs[i]; return null; }
export function libFind(t, a) { var k = libKey(t, a); for (var i = 0; i < shared.LIB.songs.length; i++) if (libKey(shared.LIB.songs[i].title, shared.LIB.songs[i].artist) === k) return shared.LIB.songs[i]; return null; }
export function libId() { var id; do { id = "s" + Date.now().toString(36) + Math.floor(Math.random() * 1679616).toString(36); } while (libGet(id)); return id; }
export function libWrite() {
  var ok = true;
  try {
    if (!window.localStorage) throw new Error("no storage");
    window.localStorage.setItem(LIB_STORE, JSON.stringify(shared.LIB));
  } catch (err) { ok = false; }
  libSaveErr = ok ? "" : "Couldn't save, storage is full";
  paintLibErr();
  return ok;
}
function paintLibErr() {
  var el = document.getElementById("upSaveErr");
  if (!el) return;
  el.textContent = libSaveErr;
  el.hidden = !libSaveErr;
}
export function upSave() {
  if (!shared.U) { shared.LIB.active = null; shared.LIB.sel = false; }
  else {
    var e = libGet(shared.U.id);
    if (e && shared.U.two) { e.choice = { simple: shared.U.choiceAll.simple, full: shared.U.choiceAll.full }; e.reviewed = { simple: shared.U.reviewedAll.simple, full: shared.U.reviewedAll.full }; e.ver = shared.U.ver; e.locked = !!shared.U.locked; e.liveKey = shared.U.liveKey || null; }
    else if (e) { e.choice = shared.U.choice; e.reviewed = shared.U.reviewed; e.locked = !!shared.U.locked; e.liveKey = shared.U.liveKey || null; }   // sections only: stored as in v77
    shared.LIB.active = e ? e.id : null;
    shared.LIB.sel = !!e && upSelected();
  }
  libWrite();
  paintLib();
}
// v80: choice / reviewed of a two-version entry are { simple: {...}, full: {...} }; a v77 entry (or a
// sections-only song) keeps the flat {"si:ci": ...} map, which is the simple version.
function libVerMaps(o, two) {
  o = o && typeof o === "object" ? o : {};
  var split = two && (Object.prototype.hasOwnProperty.call(o, "simple") || Object.prototype.hasOwnProperty.call(o, "full")) && !Object.keys(o).some(function (k) { return k.indexOf(":") >= 0; });
  return split ? { simple: o.simple || {}, full: o.full || {} } : { simple: o, full: {} };
}
export function libEntryToU(e) {
  var chk = upCheck(JSON.stringify(e.song));
  if (!chk.ok) return null;
  var two = !!(chk.song.sectionsFull && chk.song.sectionsFull.length), ver = two && e.ver === "full" ? "full" : "simple";
  var cm = libVerMaps(e.choice, two), rm = libVerMaps(e.reviewed, two);
  var u = upBuild(chk.song, cm[ver], rm[ver], ver);
  u.choiceAll = cm; u.reviewedAll = rm;
  u.id = e.id; u.locked = e.locked !== false; u.liveKey = e.liveKey || null;
  return u;
}
export var upRestoreSel;
// v77: open a saved song: same path as Load (key + Lock restored, selected in the picker).
export function libOpen(id) {
  var e = libGet(id);
  if (!e) return false;
  var u = libEntryToU(e);
  if (!u) return false;
  progStop();
  if (state.style === "kids") { var pb = document.querySelector("#styles button[data-style=\"pop\"]"); if (pb) pb.click(); }
  shared.U = u; shared.U.keep = true;
  upKeyApply(upKeyNow().tonic, upKeyNow().mode);
  upSelect();
  return true;
}
// v80: the per-song Simple / Full pick (two-version songs). The active song is rebuilt in its saved
// key and Lock (liveKey) and stays selected if it was; another row just saves the pick.
export function libSetVer(id, ver) {
  var e = libGet(id);
  if (!e || !(e.song && e.song.sectionsFull && e.song.sectionsFull.length)) return false;
  ver = ver === "full" ? "full" : "simple";
  if (shared.U && shared.U.id === id) {
    if (shared.U.ver === ver) return true;
    upSave();   // the entry has this version's picks
    var was = upSelected(), keep = shared.U.keep, locked = shared.U.locked, live = shared.U.liveKey;
    e.ver = ver;
    var u = libEntryToU(e);
    if (!u) return false;
    progStop();
    u.locked = locked; u.liveKey = live; u.keep = keep;
    shared.U = u;
    if (was) { upKeyApply(upKeyNow().tonic, upKeyNow().mode); upSelect(); }
    else { shared.suggestSig = ""; paintSuggestions(computeSpec()); upSave(); }
    paintSongBar();
  } else {
    if ((e.ver || "simple") === ver) return true;
    e.choice = libVerMaps(e.choice, true); e.reviewed = libVerMaps(e.reviewed, true);   // a v77 flat map = the simple picks
    e.ver = ver;
    libWrite();
    paintLib();
  }
  return true;
}
export function libDelete(id) {
  var i = -1;
  for (var k = 0; k < shared.LIB.songs.length; k++) if (shared.LIB.songs[k].id === id) i = k;
  if (i < 0) return false;
  shared.LIB.songs.splice(i, 1);
  if (shared.U && shared.U.id === id) upRemove();   // the active song: deselect it in the picker (saves)
  else upSave();
  return true;
}
export function libConfirm(e) { return window.confirm("Remove " + (e ? e.title : "this song") + "?"); }
const TRASH_SVG = "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6\"/></svg>";
function upLibAlbum(e) { var a = e.album || (e.song && e.song.song && typeof e.song.song.album === "string" ? e.song.song.album : ""); return String(a || "").trim(); }
function upLibSub(e) {
  return "<span class=\"ul-sub\"><span class=\"ul-art\">" + upEsc(e.artist) + "</span></span>";   // v110: no album line
}
const CLOSE_SVG = "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\"><path d=\"M6 6l12 12M18 6L6 18\"/></svg>";   // v107
const PENCIL_SVG = "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M4 20h4L18.5 9.5a2.1 2.1 0 0 0-4-4L4 16v4z\"/><path d=\"M13.5 6.5l4 4\"/></svg>";
export function paintLib() {
  var box = document.getElementById("upLib"), list = document.getElementById("upLibList");
  if (!box || !list) return;
  paintLibErr();
  var det = document.getElementById("upDetail"), home = document.querySelector("#uploadPick .up-detail-home");
  if (det && home && det.parentNode !== home) home.appendChild(det);   // v105: kept while the list is rebuilt
  if (shared.upEdit && !libGet(shared.upEdit)) shared.upEdit = null;
  var emp = document.getElementById("upLibEmpty");
  if (emp) emp.hidden = !!shared.LIB.songs.length;
  list.hidden = !shared.LIB.songs.length;
  list.classList.toggle("editing", !!shared.upEdit);
  document.getElementById("upLibN").textContent = shared.LIB.songs.length ? "(" + shared.LIB.songs.length + (shared.LIB.songs.length >= LIB_MAX ? ", full" : "") + ")" : "";
  var rows = shared.LIB.songs.slice().sort(function (a, b) { return (b.added || 0) - (a.added || 0); });
  var act = shared.U ? shared.U.id : null, h = "";
  rows.forEach(function (e) {
    var on = e.id === act;
    var ed = e.id === shared.upEdit;   // v105: the per-song Simple / Full pick moved into the details (pencil)
    h += "<li class=\"ul-row" + (on ? " on" : "") + (ed ? " edit" : "") + "\" data-id=\"" + upEsc(e.id) + "\"><button type=\"button\" class=\"ul-open\" data-lib=\"open\"" + (on ? " aria-current=\"true\"" : "") + "><b>" + upEsc(e.title) + "</b>" + upLibSub(e) + "</button>" +
      "<button type=\"button\" class=\"ul-edit\" data-lib=\"edit\" aria-label=\"" + (ed ? "Close" : "Edit") + "\" title=\"" + (ed ? "Close" : "Edit") + "\" aria-expanded=\"" + ed + "\">" + (ed ? CLOSE_SVG : PENCIL_SVG) + "</button>" +
      "<button type=\"button\" class=\"ul-del\" data-lib=\"del\" aria-label=\"Remove " + upEsc(e.title) + "\" title=\"Remove\">" + TRASH_SVG + "</button></li>" +
      (ed ? "<li class=\"ul-detrow\" data-id=\"" + upEsc(e.id) + "\"></li>" : "");
  });
  list.innerHTML = h;
  var dr = list.querySelector(".ul-detrow");
  if (dr && det) dr.appendChild(det);
}

// Boot step (runs once, in the original v112.3 order, from main.js)
export function boot() {
libSaveErr = "";
upRestoreSel = false;
  (function () {
    var ls = null;
    try { ls = window.localStorage || null; } catch (err) { ls = null; }
    if (!ls) return;
    var raw = null;
    try { raw = ls.getItem(LIB_STORE); } catch (err) { raw = null; }
    if (raw != null) {
      try {
        var st = JSON.parse(raw);
        if (st && st.v === 1 && Array.isArray(st.songs)) {
          shared.LIB = { v: 1, active: st.active || null, sel: !!st.sel, songs: st.songs.filter(function (x) { return x && x.id && x.song; }).slice(0, LIB_MAX) };
        }
      } catch (err) {}
    } else {
      // v77: one-time migration from the v72-v76 single song (touchChord.settings.v1 is never touched).
      try {
        var old = JSON.parse(ls.getItem(UP_STORE) || "null");
        if (old && old.song && upCheck(JSON.stringify(old.song)).ok) {
          var id = libId();
          shared.LIB.songs.push({ id: id, title: old.song.song.title, artist: old.song.song.artist, added: Date.now(), song: old.song,
            choice: old.choice || {}, reviewed: old.reviewed || {}, locked: old.locked !== false, liveKey: old.liveKey || null });
          if (old.sel) { shared.LIB.active = id; shared.LIB.sel = true; }
          if (libWrite()) ls.removeItem(UP_STORE);
        }
      } catch (err) {}
    }
    var e = shared.LIB.active ? libGet(shared.LIB.active) : null;
    if (shared.LIB.active && !e) shared.LIB.active = null;
    if (e) {
      try { shared.U = libEntryToU(e); } catch (err) { shared.U = null; }
      if (shared.U) { upRestoreSel = !!shared.LIB.sel; shared.U.keep = upRestoreSel; }
      else shared.LIB.active = null;
    }
  })();
}
