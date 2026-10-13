// The loaded uploaded song: steps, key, lock, next step.
import { unlock } from "../audio/unlock.js?v=112.6";
import { keyDegrees, SPELL_LI, namePc, keyRootName } from "../keys.js?v=112.6";
import { upSave, LIB_MAX, libFind, libId } from "./library.js?v=112.6";
import { progBadge } from "./magic.js?v=112.6";
import { magic, progStop, prog, progSet, applySongKey, progRedecorate } from "./playback.js?v=112.6";
import { PROG_BAR } from "./presets.js?v=112.6";
import { upStep, upCheck, upBuild, upEv, upSym } from "./upload.js?v=112.6";
import { state, shared } from "../state.js?v=112.6";
import { wrap12 } from "../theory/quality.js?v=112.6";
import { accSym } from "../theory/spelling.js?v=112.6";
import { nxMarkSoon } from "../ui/next.js?v=112.6";
import { computeSpec } from "../ui/pads.js?v=112.6";
import { paintProg } from "../ui/progbar.js?v=112.6";
import { paintSongBar } from "../ui/songbar.js?v=112.6";
import { paintSuggestions } from "../ui/strip.js?v=112.6";
import { paintUpload } from "../ui/upload-dialog.js?v=112.6";
// Shown in full mode only, never for Kids (Kids plays its own songs).
// v73: a LOCKED song also stays in Simple (Next / Play keep walking it; the song bar / Upload stay hidden there).
export function upInList() { return !!shared.U && state.style !== "kids" && (!state.simple || !!shared.U.locked); }
export function upSelected() { var p = prog.list[prog.idx]; return !!(p && p.up && shared.U); }
export function songTempo() { return upSelected() ? { bpm: shared.U.bpm, bpb: shared.U.bpb, ts: shared.U.ts } : null; }
// Bar length for the Play autoplay (factory progressions: PROG_BAR, 80 BPM 4/4).
export function progLoopBar() { var t = songTempo(); return t ? t.bpb * 60 / t.bpm : PROG_BAR; }
// Ring length per bar for Next (factory progressions: the style / loop BPM, 4 beats).
export function progRingSec() { var t = songTempo(); return t ? t.bpb * 60 / t.bpm : 240 / (state.bpm || 96); }
// v73 Lock: while locked, the song's chords follow the key: every chord moves by (live key tonic -
// song key tonic), keeping quality and slash bass; U.key stays the reference, U.liveKey the target.
export function upTr(key) { return shared.U && shared.U.locked && key ? wrap12(key.pc - namePc(shared.U.key.tonic)) : 0; }
export function upLiveKeyObj() { return shared.U && shared.U.locked && shared.U.liveKey ? { pc: namePc(shared.U.liveKey.tonic), mode: shared.U.liveKey.mode === "minor" ? "minor" : "major" } : null; }
function upSpellPc(pc, key) {
  var kd = key ? keyDegrees(key) : [], flat = false, nat = [0, 2, 4, 5, 7, 9, 11];
  for (var i = 0; i < kd.length; i++) {
    var rs = kd[i].rootSpell;
    if (rs && rs.acc < 0) flat = true;
    if (kd[i].pc === pc && rs && Math.abs(rs.acc) <= 1) return SPELL_LI.charAt(rs.li) + (rs.acc > 0 ? "#" : rs.acc < 0 ? "b" : "");
  }
  var j = nat.indexOf(pc);
  if (j >= 0) return SPELL_LI.charAt(j);
  return flat ? SPELL_LI.charAt(nat.indexOf(wrap12(pc + 1))) + "b" : SPELL_LI.charAt(nat.indexOf(wrap12(pc - 1))) + "#";
}
function upTransSym(sym, tr, key) {
  if (!tr) return sym;
  var m = /^([A-G])(#|b)?(.*)$/.exec(String(sym));
  if (!m) return sym;
  var rest = m[3], bass = "", sl = rest.lastIndexOf("/");
  if (sl >= 0 && /^[A-G](#|b)?$/.test(rest.slice(sl + 1))) { bass = rest.slice(sl + 1); rest = rest.slice(0, sl); }
  var out = upSpellPc(wrap12(namePc(m[1] + (m[2] || "")) + tr), key) + rest;
  if (bass) out += "/" + upSpellPc(wrap12(namePc(bass) + tr), key);
  return out;
}
export function upT(sym) { var k = upLiveKeyObj(); return upTransSym(sym, upTr(k), k); }   // display (transposed when locked)
export function upA(sym) { return accSym(upT(sym)); }
export function upSteps(key) { var tr = upTr(key); return shared.U.events.map(function (e, i) { return upStep(key, upTransSym(upSym(e.si, e.ci), tr, key), e.dur / shared.U.bpb, i); }); }
export function upKeyNow() { return shared.U.locked && shared.U.liveKey ? shared.U.liveKey : shared.U.key; }   // the key the song plays in
export function upSetLock(on) {
  if (!shared.U) return;
  shared.U.locked = !!on;
  shared.U.liveKey = null;   // locking / unlocking starts from the song's own key
  if (upSelected()) { progStop(); upKeyApply(shared.U.key.tonic, shared.U.key.mode); shared.suggestSig = ""; paintSuggestions(computeSpec()); }
  upSave();
  paintUpload();
  paintSongBar();
}
export function upPlaceLock() {
  var bar = document.getElementById("songBar"), lk = document.getElementById("sbLock");
  if (!bar || !lk) return;
  var on = !bar.hidden && !!shared.U;
  lk.hidden = !on;
  if (!on) { bar.style.paddingRight = ""; return; }
  var lock = !!shared.U.locked;
  lk.setAttribute("aria-pressed", lock ? "true" : "false");
  lk.title = lock ? "Song chords locked: tap to unlock" : "Lock the song chords";
  lk.style.top = bar.offsetTop + "px";
  lk.style.height = bar.offsetHeight + "px";
  lk.style.right = Math.max(0, bar.offsetParent ? bar.offsetParent.clientWidth - bar.offsetLeft - bar.offsetWidth : 0) + "px";
  bar.style.paddingRight = (lk.offsetWidth + 6) + "px";
}

// Key from song.key: applySongKey(tonic, mode) (added with Kids v71; reused here). Tonic spellings
// that are not keys in the app (A# major, Gb minor) fall back to its default spelling (Bb, F#).
export function upKeyApply(tonic, mode) {
  applySongKey(tonic, mode);
  var k = { pc: namePc(tonic), mode: mode === "minor" ? "minor" : "major" };
  return { pc: k.pc, mode: k.mode, name: keyRootName(k) };
}
export function upSelect() {
  shared.suggestSig = "";
  paintSuggestions(computeSpec());
  for (var i = 0; i < prog.list.length; i++) if (prog.list[i].up) { progSet(i); break; }
  upSave();
}
// v89: stored song = a copy stamped 1.1 (so v77-v88 builds read it); entry.album from song.album
export function upStoreCopy(song) { var c = JSON.parse(JSON.stringify(song)); c.contractVersion = "1.1"; return c; }
function upLoad(text) {
  var r = upCheck(text);
  if (!r.ok) return r;
  return upLoadOne(r);
}
export function upLoadOne(r) {
  // v77: same title + artist updates that song (same id); a new one needs room (never evict).
  var ent = libFind(r.song.song.title, r.song.song.artist);
  if (!ent && shared.LIB.songs.length >= LIB_MAX) { r.ok = false; r.full = true; r.errors = [{ path: "My songs", msg: "is full" }]; return r; }
  progStop();
  if (state.style === "kids") { var pb = document.querySelector("#styles button[data-style=\"pop\"]"); if (pb) pb.click(); }
  if (ent) { ent.title = String(r.song.song.title).trim(); ent.artist = String(r.song.song.artist).trim(); ent.song = upStoreCopy(r.song); ent.choice = {}; ent.reviewed = {}; ent.locked = true; ent.liveKey = null; delete ent.ver; r.updated = true; }
  else { ent = { id: libId(), title: String(r.song.song.title).trim(), artist: String(r.song.song.artist).trim(), added: Date.now(), song: upStoreCopy(r.song), choice: {}, reviewed: {}, locked: true, liveKey: null }; shared.LIB.songs.push(ent); }
  if (r.song.song.album) ent.album = r.song.song.album;
  shared.U = upBuild(r.song, {}, {});
  shared.U.id = ent.id;
  shared.U.locked = true; shared.U.liveKey = null; shared.U.keep = true;   // v73: Lock is ON the moment a song loads
  r.key = upKeyApply(r.song.song.key.tonic, r.song.song.key.mode);
  upSelect();
  return r;
}
// Step index of the first walk step for chord (si, ci).
export function upStepOf(si, ci) {
  for (var i = 0; i < shared.U.events.length; i++) if (shared.U.events[i].si === si && shared.U.events[i].ci === ci) return i;
  return -1;
}
var upLastStep;
export function upCurStep() {
  if (!upSelected()) return -1;
  if (prog.cur >= 0) upLastStep = prog.cur;
  return upLastStep;
}
export function upPickAlt(si, ci, sym) {
  if (shared.U.locked) return;
  if (sym === upEv(si, ci).chord) delete shared.U.choice[si + ":" + ci]; else shared.U.choice[si + ":" + ci] = sym;
  shared.U.reviewed[si + ":" + ci] = true;
  upSave();
  if (upSelected()) {
    magic.next = null;
    progRedecorate();
    paintProg();
    var i = upStepOf(si, ci);
    if (i >= 0) { unlock(); progBadge([i]); }
  }
  paintUpload();
}

// --- main screen: song bar over the strip (section, current lyric line / chords, flags) ---
export function upEsc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]; }); }
export function upNextStep() {
  if (!upSelected() || shared.upNxOff || !prog.steps.length) return -1;
  var n = prog.steps.length;
  if (prog.playing) return prog.cur >= 0 ? (prog.cur + 1) % n : prog.si % n;   // v111: Play loops
  return magic.pos < n ? magic.pos : 0;   // v111: Next loops back to the first chord
}
export function paintUpNext() {
  nxMarkSoon();   // v105
  Array.prototype.forEach.call(document.querySelectorAll(".upnx"), function (n) { n.classList.remove("upnx"); });
  var i = upNextStep();
  if (i < 0) return;
  var t = prog.targets[i];
  if (t) t.classList.add("upnx");
  var e = shared.U.events[i];
  if (!e) return;
  Array.prototype.forEach.call(document.querySelectorAll("#upSecs .up-ch[data-s=\"" + e.si + "\"][data-c=\"" + e.ci + "\"]"), function (n) { n.classList.add("upnx"); });
  var bar = document.getElementById("songBar");
  if (bar && !bar.hidden && +bar.dataset.si === e.si) Array.prototype.forEach.call(bar.querySelectorAll(".sb-ch[data-c=\"" + e.ci + "\"]"), function (n) { n.classList.add("upnx"); });
}

// Boot step (runs once, in the original v112.3 order, from main.js)
export function boot() {
upLastStep = -1;
}
