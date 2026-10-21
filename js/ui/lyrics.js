// Two-row lyrics (uploaded songs) and Kids lyrics.
import { KIDS_LYRICS } from "../songs/kids-songs.js?v=112.7";
import { prog, PROG_TEST, placeBadges } from "../songs/playback.js?v=112.7";
import { upA, upEsc } from "../songs/song.js?v=112.7";
import { upEv, upSym, upFlagged, upSecName } from "../songs/upload.js?v=112.7";
import { state, shared } from "../state.js?v=112.7";
import { paintSongBar } from "./songbar.js?v=112.7";
import { fitStrip } from "./strip.js?v=112.7";
// v95: full-mode two-row lyrics. Lines in play order from the song's chord / section / lyric-line map (no
// word timing): event i is on the line the one-line bar would show for it (first line with a marker on
// that chord, else the last line with a marker before it; -1 = the section's chords). A new entry starts
// whenever (section, repeat, line) changes, so the bar moves on once playback passes the line's last chord.
function upLineOf(sec, ci) {
  var L = sec.lyrics || [], r = -1, i;
  for (i = 0; i < L.length; i++) if (L[i].markers.some(function (m) { return m.chordIndex === ci; })) return i;
  for (i = 0; i < L.length; i++) if (L[i].markers.some(function (m) { return m.chordIndex <= ci; })) r = i;
  return r;
}
export function upLyrMap() {
  if (shared.U._lyr && shared.U._lyr.secs === shared.U.secs) return shared.U._lyr;
  var seq = [], at = [], last = null;
  var any = shared.U.secs.some(function (sec) { return (sec.lyrics || []).some(function (ln) { return ln.markers && ln.markers.length && ln.text; }); });
  shared.U.events.forEach(function (e, i) {
    var li = upLineOf(shared.U.secs[e.si], e.ci), k = e.si + ":" + e.rep + ":" + li;
    if (!last || last.k !== k) { last = { k: k, si: e.si, li: li, start: i }; seq.push(last); }
    at.push(seq.length - 1);
  });
  shared.U._lyr = { secs: shared.U.secs, seq: seq, at: at, any: any };
  return shared.U._lyr;
}
function upLyrRow(ent, curCi, cls, sec2) {
  if (!ent) return "<span class=\"sb-row " + cls + "\"></span>";
  var si = ent.si, sec = shared.U.secs[si], html = sec2 ? "<span class=\"sb-sec2\">" + upEsc(upSecName(si)) + "</span>" : "";
  function tag(ci) {   // row 2: no data-c, so the next-chord outline stays on row 1
    return "<span" + (cls === "r1" ? " data-c=\"" + ci + "\"" : "") + " class=\"sb-ch" + (ci === curCi ? " on" : "") + (upFlagged(si, ci) ? " flag" : "") + "\">" + upEsc(upA(upSym(si, ci))) + "</span>";
  }
  var line = ent.li >= 0 ? sec.lyrics[ent.li] : null;
  if (line) {
    var mk = line.markers.slice().sort(function (a, b) { return a.charIndex - b.charIndex; }), q = 0;
    mk.forEach(function (m) { html += upEsc(line.text.slice(q, m.charIndex)) + tag(m.chordIndex); q = Math.max(q, m.charIndex); });
    html += upEsc(line.text.slice(q));
  } else sec.chords.forEach(function (c, ci) { html += tag(ci); });
  return "<span class=\"sb-row " + cls + "\">" + html + "</span>";
}
// iPad (pad layouts): three lyric rows (the line being sung + the next two) when the screen is tall enough,
// else the usual two (v112.5: see below). html.lyr3 switches the CSS row count (--lr-n / --kl-n).
export function lyrRows(kids) {
  var de = document.documentElement, pad = de.classList.contains("lay-pad-port") || de.classList.contains("lay-pad-land");
  // v112.5 (#3): every iPad size gets three rows (1024x768 too); phone portrait gets three Kids lyric rows
  // (the uploaded-song bar stays at two there); phone landscape keeps two (no room at a readable size).
  var n = pad || (kids && de.classList.contains("lay-phone-port")) ? 3 : 2;
  var cls = kids ? "klyr3" : "lyr3";   // Kids lyrics and the uploaded-song bar keep separate classes (no flip-flop)
  if (de.classList.contains(cls) !== (n === 3)) de.classList.toggle(cls, n === 3);
  return n;
}
export function lyrPad() {
  var c = document.documentElement.classList;
  return c.contains("lay-pad-port") || c.contains("lay-pad-land");
}
export const lyrState = { k: -1, anim: 0, log: [] };
export function paintLyr2(bar, cur) {
  var M = upLyrMap(), idx = M.at[cur >= 0 ? cur : 0], ent = M.seq[idx], nxt = M.seq[idx + 1] || null;
  var e0 = shared.U.events[cur >= 0 ? cur : 0], curCi = cur >= 0 ? e0.ci : -1;
  var alts = curCi >= 0 && !shared.U.locked && (upEv(e0.si, curCi).alternates || []).length;
  var r1 = upLyrRow(ent, curCi, "r1", false), r2 = upLyrRow(nxt, -1, "r2", !!nxt && nxt.si !== ent.si);
  if (lyrRows() === 3) { var nx2 = M.seq[idx + 2] || null; r2 += upLyrRow(nx2, -1, "r2 r3", !!nx2 && !!nxt && nx2.si !== nxt.si); }
  var head = "<span class=\"sb-sec\">" + upEsc(upSecName(ent.si)) + "</span>", tail = alts ? "<span class=\"sb-alt\">alt \u25be</span>" : "";
  var key = head + "<span class=\"sb-lyr\"><span class=\"sb-roll\">" + r1 + r2 + "</span></span>" + tail;
  var step = idx === lyrState.k + 1 && lyrState.k >= 0 && bar._html && bar._html.indexOf("sb-lyr") >= 0;
  var calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (lyrState.anim) { lyrState.pend = true; bar.dataset.si = ent.si; return; }   // finish the scroll first
  if (step && !calm) {
    // old row 1 on top, then the new rows; scroll up one row, then settle on the plain two rows
    var old = bar.querySelector(".sb-row.r1"), oldHtml = old ? old.outerHTML.replace(/ data-c="\d+"/g, "").replace(" on\"", "\"") : "";
    bar.innerHTML = head + "<span class=\"sb-lyr\"><span class=\"sb-roll\">" + oldHtml + r1 + r2 + "</span></span>" + tail;
    bar._html = null;
    var roll = bar.querySelector(".sb-roll");
    void roll.offsetWidth;
    roll.classList.add("go");
    lyrState.anim = setTimeout(function () { lyrState.anim = 0; lyrState.pend = false; bar._html = null; paintSongBar(); }, 300);
    if (PROG_TEST) lyrState.log.push({ idx: idx, anim: true });
  } else {
    if (bar._html !== key) { bar.innerHTML = key; bar._html = key; }
    if (PROG_TEST && idx !== lyrState.k) lyrState.log.push({ idx: idx, anim: false });
  }
  lyrState.k = idx;
  bar.dataset.si = ent.si;
}
// v97: Kids lyrics in two rows. Row 1 = the line holding the current step (its sung word lit), row 2 = the
// next line (muted, empty after the last). Moving on to the next line scrolls the rows up (as v95).
export const klState = { name: null, k: -1, anim: 0, log: [] };
function kidsLyrLines() {
  var it = state.style === "kids" && prog.list[prog.idx], L = it && KIDS_LYRICS[it.name];
  return L && L.length ? L : null;
}
function kidsLyrRow(ln, step, cls) {
  if (!ln) return "<span class=\"sb-row " + cls + "\"></span>";
  var mk = ln.markers, h = upEsc(ln.text.slice(0, mk[0].charIndex));
  mk.forEach(function (m, j) {
    var seg = ln.text.slice(m.charIndex, j + 1 < mk.length ? mk[j + 1].charIndex : ln.text.length);
    if (m.chordIndex === step) { var w = seg.match(/^([^\s,.!?;:]*)([\s\S]*)$/); h += "<span class=\"kl-on\">" + upEsc(w[1]) + "</span>" + upEsc(w[2]); }
    else h += upEsc(seg);
  });
  return "<span class=\"sb-row " + cls + "\">" + h + "</span>";
}
export function paintKidsLyr() {
  var box = document.getElementById("kidsLyr");
  if (!box) return;
  var L = kidsLyrLines(), on = !!L;
  if (box.hidden === on) {
    box.hidden = !on;
    document.documentElement.classList.toggle("kly-on", on);
    setTimeout(function () { fitStrip(); placeBadges(); }, 0);
  }
  if (!on) { klState.name = null; klState.k = -1; box._html = null; return; }
  var name = prog.list[prog.idx].name, step = prog.cur, li = 0;
  if (name !== klState.name) { klState.name = name; klState.k = -1; box._html = null; }
  if (step >= 0) L.forEach(function (ln, i) { if (ln.markers.some(function (m) { return m.chordIndex <= step; })) li = i; });
  var r1 = kidsLyrRow(L[li], step, "r1"), r2 = kidsLyrRow(L[li + 1] || null, -1, "r2");
  if (lyrRows(true) === 3) r2 += kidsLyrRow(L[li + 2] || null, -1, "r2 r3");
  var key = "<span class=\"sb-roll\">" + r1 + r2 + "</span>";
  box.setAttribute("aria-label", "Lyrics: " + L[li].text);
  if (klState.anim) { clearTimeout(klState.anim); klState.anim = 0; box._html = null; }
  var calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (li === klState.k + 1 && klState.k >= 0 && !calm) {
    var old = box.querySelector(".sb-row.r1"), oldHtml = old ? old.outerHTML.replace(/<span class="kl-on">([^<]*)<\/span>/g, "$1") : "";
    box.innerHTML = "<span class=\"sb-roll\">" + oldHtml + r1 + r2 + "</span>";
    box._html = null;
    var roll = box.firstChild;
    void roll.offsetWidth;
    roll.classList.add("go");
    klState.anim = setTimeout(function () { klState.anim = 0; box.innerHTML = key; box._html = key; }, 300);
    if (PROG_TEST) klState.log.push({ li: li, anim: true });
  } else {
    if (box._html !== key) { box.innerHTML = key; box._html = key; }
    if (PROG_TEST && li !== klState.k) klState.log.push({ li: li, anim: false });
  }
  klState.k = li;
}
