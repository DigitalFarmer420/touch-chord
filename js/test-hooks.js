// window.__* helpers for the Playwright suites. Loaded only with ?test=1 (dynamic import from main.js).
import { api as ChordAudio } from "./audio/index.js?v=112.6";
import { KIDS_LYRICS } from "./songs/kids-songs.js?v=112.6";
import { upSave, libSaveErr, libOpen, libSetVer, libDelete } from "./songs/library.js?v=112.6";
import { progNext, magicReset, magicHome, magicPool } from "./songs/magic.js?v=112.6";
import { paLog } from "./songs/playalong.js?v=112.6";
import { magic, progStop, progPlay, prog, PROG_TEST, progSet, applySongKey } from "./songs/playback.js?v=112.6";
import { PROG_BAR, PROGRESSIONS, progSteps, progNumerals } from "./songs/presets.js?v=112.6";
import { songTempo, upSelected, upNextStep, progRingSec, progLoopBar, upKeyApply, upSetLock, upPickAlt } from "./songs/song.js?v=112.6";
import { UP_ARTIST_MAX, UP_SKIP_MAX, UP_LIST_MAX, upListSchemaText, upParseChord, upParseAnswer, upCheck, upSym, upFlagList, upLoadAll, upRemove } from "./songs/upload.js?v=112.6";
import { state, shared } from "./state.js?v=112.6";
import { wrap12 } from "./theory/quality.js?v=112.6";
import { paHintLog } from "./ui/hints.js?v=112.6";
import { kbChord } from "./ui/keyboard.js?v=112.6";
import { upLyrMap, lyrState, klState } from "./ui/lyrics.js?v=112.6";
import { laTarget, paintLookahead, nxNow, nxKeyEl, nxSigLast, nxBursts, paintNxMark, nextHintSpec } from "./ui/next.js?v=112.6";
import { hapLog, hapTest } from "./ui/pads.js?v=112.6";
import { kidsTapLog, fxTapLog } from "./ui/pulse.js?v=112.6";
import { stripLabel } from "./ui/strip.js?v=112.6";
import { tourI, tourLog, tourDone, tourStart } from "./ui/tour.js?v=112.6";
import { paintUpload, upMode, upPromptFor, upShowErrors, upCopyText, upSetPrompt } from "./ui/upload-dialog.js?v=112.6";


// Test hooks (loaded only with ?test=1)
export function install() {
  if (hapTest) window.__haptic = hapLog;
  if (PROG_TEST) window.__prog = prog;
  if (PROG_TEST) window.__band = ChordAudio.band;
  if (PROG_TEST) window.__progApi = { data: PROGRESSIONS, steps: function (k, p) { return progSteps(k, p); }, numerals: function (st) { return progNumerals(st); }, set: function (i) { progSet(i); }, play: function () { progPlay(); }, stop: function () { progStop(); }, next: function () { progNext(); }, bar: PROG_BAR };
  if (PROG_TEST) window.__nx = function () {
    paintNxMark();
    var cur = nxNow(), lab = function (e) { return e ? (e.getAttribute("aria-label") || e.textContent || "").trim() : null; };
    return { sig: nxSigLast, grid: cur && cur.el ? lab(cur.el) : null, item: cur ? { rootPc: cur.item.rootPc, type: cur.item.type, ext: Object.keys(cur.item.extensions || {}).filter(function (k) { return cur.item.extensions[k]; }) } : null,
      dots: Array.prototype.map.call(document.querySelectorAll(".nxdot"), function (e) { return (e.closest("#palette") ? "table:" : "grid:") + lab(e); }),
      key: (function () { var k = cur ? nxKeyEl(cur.item) : null; return k ? +k.dataset.midi : null; })(), bursts: nxBursts,
      burstEls: Array.prototype.map.call(document.querySelectorAll(".nxb"), function (e) { return (e.closest("#palette") ? "table:" : e.closest("#pads") ? "key:" + e.dataset.midi : "grid:") + lab(e); }) };
  };

  if (PROG_TEST) window.__la = function () { var t = laTarget(); paintLookahead(); var all = document.querySelectorAll("#suggest .la-play");
    return { n: all.length, label: t ? (t.getAttribute("aria-label") || t.textContent) : null, step: t ? prog.targets.indexOf(t) : -1, playing: prog.playing, cur: prog.cur, si: prog.si }; };
  if (PROG_TEST) { window.__playAlong = paLog; paLog.tones = function () { var c = nxNow(); if (!c || !c.item) return null; var sp = nextHintSpec(c.item), o = {}; (sp.midis || []).forEach(function (m) { if (isFinite(m)) o[wrap12(Number(m))] = 1; }); return Object.keys(o).map(Number); }; }
  if (PROG_TEST) window.__paHint = paHintLog;
  if (PROG_TEST) window.__tour = { start: function (r) { tourStart(r !== false); }, log: tourLog, step: function () { return tourI; }, done: tourDone };
  if (PROG_TEST) window.__fxTap = fxTapLog;
  if (PROG_TEST) window.__kidsTap = kidsTapLog;
  if (PROG_TEST) window.__kidsPads = function () { return Array.prototype.map.call(document.querySelectorAll("#suggest .ss-kidpad"), function (b) { var it = b._tc && b._tc.item; return { label: b.textContent, cls: b.className, rootPc: it && it.rootPc, type: it && it.type, gold: b.classList.contains("nx-root") }; }); };   // v103
  if (PROG_TEST) window.__kbWin = function () { return { lo: shared.kbWinLow, stay: shared.kbKeyStay, chord: kbChord && { rootPc: kbChord.rootPc, root: kbChord.root, type: kbChord.type } }; };   // v102

  if (PROG_TEST) window.__magic = {
    state: magic,
    seed: function (n) { var a = n >>> 0; magic.rng = function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; magicReset(); magic.log = []; },
    pool: function () { return magicPool().map(stripLabel); },
    home: function () { var h = magicHome(); return h ? stripLabel(h) : null; },
    tap: function () { progNext(); },
    timer: function () { return shared.suggestTimer; }
  };
  if (PROG_TEST) window.__applySongKey = function (t, m) { return applySongKey(t, m); };
  if (PROG_TEST) window.__lyr2 = { state: lyrState, map: function () { if (!shared.U) return null; var M = upLyrMap(); return { any: M.any, seq: M.seq.map(function (x) { return { si: x.si, li: x.li, start: x.start }; }), at: M.at.slice() }; } };
  if (PROG_TEST) window.__kidsLyr = { state: klState, data: function () { return KIDS_LYRICS; } };
  if (PROG_TEST) window.__upload = {
    check: function (t) { return upCheck(t); },
    load: function (t) { var r = upLoadAll(t); upShowErrors(r); paintUpload(); return { ok: r.ok, errors: r.errors, warnings: r.warnings, list: !!r.list, loaded: r.loaded, updated: r.updated, skipped: r.skipped, truncated: !!r.truncated,
      rows: (r.rows || []).map(function (x) { return { i: x.i, title: x.title, status: x.status, reason: x.reason, albumNow: x.albumNow, flags: x.flags, errors: x.errors }; }) }; },
    parseAnswer: function (t) { var p = upParseAnswer(t); return { kind: p.kind, n: p.items ? p.items.length : 0, truncated: !!p.truncated, error: p.error || null }; },
    mode: function (t, a) { return upMode(t, a); },
    promptFor: function (md, ver, have) { return upPromptFor(md, ver, have); },
    listSchema: function () { return upListSchemaText; },
    caps: function () { return { artist: UP_ARTIST_MAX, skip: UP_SKIP_MAX, list: UP_LIST_MAX }; },   // v105; v110 no album
    remove: function () { upRemove(); paintUpload(); },
    song: function () { return shared.U ? { title: shared.U.title, artist: shared.U.artist, key: shared.U.key, bpm: shared.U.bpm, ts: shared.U.ts, events: shared.U.events.length, sections: shared.U.secs.map(function (s) { return s.id; }), selected: upSelected(), two: !!shared.U.two, ver: shared.U.ver } : null; },
    setVer: function (id, v) { var r = libSetVer(id, v); paintUpload(); return r; },
    setPrompt: function (v) { upSetPrompt(v); return shared.upPromptVer; },
    prompt: function () { return shared.upPromptVer; },
    steps: function () { return prog.steps.map(function (s) { return { sym: stripLabel(s.item), roman: s.roman, bars: s.bars }; }); },
    tempo: function () { return { song: songTempo(), loopBar: progLoopBar(), ringSec: progRingSec(), stateBpm: state.bpm }; },
    flagged: function () { return upFlagList().map(function (f) { return shared.U.secs[f.si].id + "#" + f.ci + ":" + upSym(f.si, f.ci); }); },
    alternates: function () { var o = []; if (shared.U) shared.U.secs.forEach(function (s) { s.chords.forEach(function (c, ci) { (c.alternates || []).forEach(function (a) { o.push(s.id + "#" + ci + ":" + c.chord + "->" + a.chord); }); }); }); return o; },
    copyText: function () { return upCopyText(); },
    parse: function (s) { return upParseChord(s); },
    applySongKey: function (t, m) { return upKeyApply(t, m); },
    lock: function () { return shared.U ? { locked: !!shared.U.locked, liveKey: shared.U.liveKey, key: shared.U.key } : null; },
    setLock: function (on) { upSetLock(on); },
    next: function () { return upNextStep(); },
    lib: function () { return JSON.parse(JSON.stringify({ active: shared.LIB.active, sel: shared.LIB.sel, n: shared.LIB.songs.length, songs: shared.LIB.songs.map(function (e) { return { id: e.id, title: e.title, artist: e.artist, album: e.album, cv: e.song && e.song.contractVersion, added: e.added, locked: e.locked, liveKey: e.liveKey, choice: e.choice, reviewed: e.reviewed, ver: e.ver }; }), err: libSaveErr, uid: shared.U ? shared.U.id : null })); },
    libOpen: function (id) { return libOpen(id); },
    libDelete: function (id) { return libDelete(id); },
    pickAlt: function (si, ci, sym) { upPickAlt(si, ci, sym); },
    accept: function (si, ci) { shared.U.reviewed[si + ":" + ci] = true; upSave(); }
  };
}
