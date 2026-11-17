// Song bar (uploaded song sections) and the upload active state.
import { api as ChordAudio } from "../audio/index.js?v=112.15";
import { prog, placeBadges } from "../songs/playback.js?v=112.15";
import { paintUpNext, upSelected, upT, upA, upPlaceLock, upEsc, upCurStep } from "../songs/song.js?v=112.15";
import { upProgObj, upEv, upSym, upFlagged, upSecName } from "../songs/upload.js?v=112.15";
import { state, shared } from "../state.js?v=112.15";
import { activeKey } from "../keys.js?v=112.15";
import { secLyrics } from "../songs/fullchart.js?v=112.15";
import { upLyrMap, lyrState, paintLyr2, lyrPad } from "./lyrics.js?v=112.15";
import { fitStrip, stripChips } from "./strip.js?v=112.15";
import { nextChange, songCue, cueSoon, cueClock, cueWord, cuePieces, placeCueTag, cueChipClass } from "./chordcue.js?v=112.15";
import { songCardRows } from "../expert/model.js?v=112.15";
import { paintSimpleSrc } from "./simplesrc.js?v=112.15";
import { progLoopBar, songTempo } from "../songs/song.js?v=112.15";
// v3.2 test.5: the next-chord cue in the song bar. Full (classic) mode's rows print each chord name inline, right
// before its word, so there the cue colours that chord name in its grid colour and underlines its word; it brightens one beat
// before the change (Play) or when the change is the next tap. Simple (Vinh, test.5) shows the words like Expert's
// song card instead (paintSimpleLyr below), with Expert's cue. A song without words keeps the one-line chord bar.
export const sbCue = { j: -1, pc: -2, cur: -2, t: 0, soon: null, log: [] };
export function sbCueFor(cur, rows, idx) {   // rows/idx: the two-row map window; rows 0 = the one-line bar (same line)
  var U = shared.U, names = U.events.map(function (e) { return upA(upSym(e.si, e.ci)); });
  if (rows) return songCue(upLyrMap(), idx, rows, U.events, names, cur, function (si, rep) { return secLyrics(U.secs[si], rep); });
  var j = nextChange(names, cur);
  return j >= 0 ? { j: j, ev: U.events[j], chord: names[j] } : null;
}
// A lyric line with its chord names inline; cueCi = the chord whose name and word get the cue (-1 none).
export function sbChipLine(line, tag, cueCi) {
  var mk = line.markers.slice().sort(function (a, b) { return a.charIndex - b.charIndex; }), q = 0, html = "", t = line.text;
  mk.forEach(function (m, k) {
    html += upEsc(t.slice(q, m.charIndex)) + tag(m.chordIndex, m.chordIndex === cueCi); q = Math.max(q, m.charIndex);
    if (m.chordIndex === cueCi) {
      var w = cueWord(t, m.charIndex), end = k + 1 < mk.length ? mk[k + 1].charIndex : t.length;
      var wa = w ? Math.max(q, w[0]) : 0, wb = w ? Math.min(end, w[1]) : 0;   // a mark mid-word: the part after the chord name
      if (wb > wa) { html += upEsc(t.slice(q, wa)) + "<span class=\"sb-cuew\">" + upEsc(t.slice(wa, wb)) + "</span>"; q = wb; }
    }
  });
  return html + upEsc(t.slice(q));
}
function sbCueTick() {
  var bar = document.getElementById("songBar");
  if (!bar || bar.hidden || sbCue.j < 0 || !upSelected()) return;
  var cur = upCurStep();
  if (cur !== sbCue.pc) { paintSongBar(); return; }
  var t = songTempo(), soon = cueSoon({ j: sbCue.j, cur: cur, playing: !!prog.playing, bars: prog.steps.map(function (st) { return st.bars; }), barSec: progLoopBar(), bpb: t && t.bpb || 4, since: cueClock(sbCue, cur, performance.now()) });
  Array.prototype.forEach.call(bar.querySelectorAll(".sb-cue, .sb-cuew, .sl-cue, .sl-cuetag"), function (n) { n.classList.toggle("soon", soon); });
  slPlace(bar);
  if (soon !== sbCue.soon) { sbCue.log.push({ j: sbCue.j, cur: cur, soon: soon, playing: !!prog.playing }); if (sbCue.log.length > 200) sbCue.log.shift(); }
  sbCue.soon = soon;
}
var sbCueT = 0;   // started by the first song bar paint (not at import: unit tests import this file)
// ---------- v3.2 test.5 (Vinh): Simple shows the song's words like Expert's song card ----------
// Up to three lines (phone landscape: two; no room for a third at a readable size): the line being sung on top, in
// ink, with its sung word on gold (a chord-only part: its chords, the sounding one on gold), then the next lines,
// muted. The next-chord cue is Expert's: a gold underline on the word where the next chord change lands and the
// chord's name in small teal text, inline right of its word (Simple's grid leaves no height for a band above each
// line; dialogs.css --sl-cb). Rows (--sl-n: 3, short phones 2) come from the same line map as playback (songCardRows).
export const slState = { k: -1, ev: null, anim: 0, log: [] };
function slVar(n) {   // the CSS numbers (dialogs.css): rows shown (--sl-n), band above each line (--sl-cb)
  try { var a = document.getElementById("app"), v = a && window.getComputedStyle ? getComputedStyle(a).getPropertyValue(n) : ""; return v ? parseFloat(v) : NaN; } catch (e) { return NaN; }
}
export function slRowCount() { var v = slVar("--sl-n"); return v >= 2 ? v : document.documentElement.classList.contains("lay-phone-land") ? 2 : 3; }
function slInline() { var cb = slVar("--sl-cb"); return isNaN(cb) ? !document.documentElement.classList.contains("lay-phone-port") : cb < 1; }
export function slRowHtml(r, cls, cue, inl) {
  var h = "";
  if (r.sec) h += "<span class=\"sl-sec\">" + upEsc(r.sec) + " \u00b7</span> ";
  if (r.kind === "lyric" || r.kind === "text") {
    var text = r.kind === "lyric" ? r.before + r.word + r.after : r.text, rg = [];
    if (r.kind === "lyric" && r.word) rg.push({ a: r.before.length, b: r.before.length + r.word.length, cls: "sl-now" });
    if (cue) rg.push({ a: cue.a, b: cue.b, cls: "sl-cue" });
    h += cuePieces(text, rg).map(function (p) {
      return (p.cls ? "<span class=\"" + p.cls + "\">" + upEsc(p.t) + "</span>" : upEsc(p.t))
        + (inl && cue && p.cls === "sl-cue" ? "<span class=\"sl-cuetag sl-cuein" + (cue.cls ? " " + cue.cls : "") + "\" aria-hidden=\"true\">" + upEsc(cue.chord) + "</span>" : "");
    }).join("");
  } else if (r.kind === "chords") h += r.chords.map(function (c) { return "<span class=\"sl-ch" + (c.on ? " sl-now" : "") + "\">" + upEsc(c.t) + "</span>"; }).join(" ");
  var lin = cls === "cur" || (inl && cue);   // rows that may slide: the sung line, and a line holding an inline name
  return "<span class=\"sl-row " + cls + (lin && cls !== "cur" ? " sl-slide" : "") + "\" data-cue-row>" + (lin ? "<span class=\"sl-lin\">" + h + "</span>" : h) + "</span>";
}
function slFit(bar) {   // a long line never wraps: slide it so the sung word and an inline chord name stay in view (Expert's fitLyrRow)
  Array.prototype.forEach.call(bar.querySelectorAll(".sl-row"), function (row) {
    var lin = row.querySelector(".sl-lin"); if (!lin) return;
    lin.style.transform = ""; row.classList.remove("sl-shift");
    var keep = [row.querySelector(".sl-now"), row.querySelector(".sl-cuein")].filter(Boolean);
    if (!keep.length) return;
    var rr = row.getBoundingClientRect(), lo = Infinity, hi = -Infinity, dx = 0;
    keep.forEach(function (e) { var r = e.getBoundingClientRect(); lo = Math.min(lo, r.left); hi = Math.max(hi, r.right); });
    if (hi > rr.right - 4) dx = Math.max(0, Math.min(lo - rr.left - 24, hi - rr.right + 8));
    if (dx > 0) { lin.style.transform = "translateX(" + (-Math.round(dx)) + "px)"; row.classList.add("sl-shift"); }
  });
}
function slPlace(bar) {
  var host = bar.querySelector(".sl-lyr"); if (!host) return;
  var tag = host.querySelector(".sl-cuetag"); if (!tag) return;
  placeCueTag(host, host.querySelector(".sl-cue"), tag, host.querySelector(".sl-row.cur .sl-now"));
}
function paintSimpleLyr(bar, cur) {
  var U = shared.U, M = upLyrMap(), n = slRowCount(), inl = slInline();
  var e0 = U.events[cur >= 0 ? cur : 0] || U.events[0], ci = cur >= 0 && e0 ? e0.ci : -1;
  var lines = function (si, rep) { return secLyrics(U.secs[si], rep); };
  var card = songCardRows(M, cur, n, ci, lines, function (si) { return U.secs[si].chords.map(function (c, k) { return upA(upSym(si, k)); }); }, upSecName);
  var cue = sbCueFor(cur, n, card.idx), r0 = card.rows[0];
  if (cue) { var st = prog.steps[cue.j]; cue.cls = cueChipClass(st && st.item, stripChips(activeKey()), st && st.row); }
  if (cue && cue.k === 0 && r0.kind === "lyric" && r0.word) {   // never on the sung (gold) word itself
    var na = r0.before.length, nb = na + r0.word.length;
    if (cue.a < nb && cue.b > na) cue = null;
  }
  sbCue.j = cue ? cue.j : -1;
  var ent = M.seq[card.idx] || { si: e0 ? e0.si : 0 };
  var alts = ci >= 0 && !U.locked && (upEv(e0.si, ci).alternates || []).length;
  var rows = card.rows.map(function (r, k) { return slRowHtml(r, k === 0 ? "cur" : "nxt", cue && cue.k === k ? cue : null, inl); }).join("");
  var tag = cue && !inl ? "<span class=\"sl-cuetag" + (cue.cls ? " " + cue.cls : "") + "\" aria-hidden=\"true\" hidden>" + upEsc(cue.chord) + "</span>" : "";
  // Vinh 2026-11-17: no section chip ("Verse 1 (Second Half)") in Simple's lyric box; the lines get its width. The
  // section name stays in the bar's aria-label and in the later rows' "Chorus ·" prefix when a new section starts.
  var tail = alts ? "<span class=\"sb-alt\">alt \u25be</span>" : "";
  var key = "<span class=\"sl-lyr\" data-n=\"" + n + "\"><span class=\"sl-roll\">" + rows + "</span>" + tag + "</span>" + tail;
  var same = slState.ev === U.events;
  if (slState.anim && same) return;   // finish the roll first; its timer repaints
  var calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var step = same && slState.k >= 0 && card.idx === slState.k + 1 && bar._html && bar.querySelector(".sl-row.cur");
  slState.ev = U.events;
  if (step && !calm) {   // the line being sung rolls up one row (300 ms, as Expert); none with reduced motion
    var old = bar.querySelector(".sl-row.cur"), oldHtml = old.outerHTML.replace(/<span class="sl-cuetag[^"]*" aria-hidden="true">[^<]*<\/span>/g, "").replace(/<span class="sl-(?:now|cue)[^"]*">([^<]*)<\/span>/g, "$1").replace(/ style="[^"]*"/g, "");
    bar.innerHTML = key.replace("<span class=\"sl-roll\">", "<span class=\"sl-roll\">" + oldHtml);
    bar._html = null;
    var roll = bar.querySelector(".sl-roll");
    void roll.offsetWidth;
    roll.classList.add("go");
    slState.anim = setTimeout(function () { slState.anim = 0; bar._html = null; paintSongBar(); }, 300);
    slState.log.push({ idx: card.idx, anim: true });
  } else {
    if (bar._html !== key) { bar.innerHTML = key; bar._html = key; slFit(bar); }
    if (card.idx !== slState.k) slState.log.push({ idx: card.idx, anim: false });
  }
  if (slState.log.length > 200) slState.log.shift();
  slState.k = card.idx;
  bar.dataset.si = ent.si;
  slPlace(bar);
}
if (typeof location !== "undefined" && /[?&]test=1\b/.test(location.search)) window.__simpleLyr = function () {   // tests: Simple's rows and cue
  var bar = document.getElementById("songBar"), w = bar && bar.querySelector(".sl-cue"), tag = bar && bar.querySelector(".sl-cuetag");
  return { on: document.documentElement.classList.contains("up-slyr"), j: sbCue.j, rows: bar ? bar.querySelectorAll(".sl-lyr > .sl-roll > .sl-row").length : 0,
    word: w ? w.textContent : null, row: w ? Array.prototype.indexOf.call(bar.querySelectorAll(".sl-roll > .sl-row"), w.closest(".sl-row")) : -1,
    chord: tag ? tag.textContent : null, tagShown: !!(tag && !tag.hidden), inline: !!(tag && tag.classList.contains("sl-cuein")),
    soon: !!(w && w.classList.contains("soon")), now: (function () { var n = bar && bar.querySelector(".sl-row.cur .sl-now"); return n ? n.textContent : null; })(), log: slState.log.slice(-40) };
};
if (typeof window !== "undefined" && window.addEventListener) window.addEventListener("resize", function () { var bar = document.getElementById("songBar"); if (bar && document.documentElement.classList.contains("up-slyr")) { bar._html = null; setTimeout(paintSongBar, 90); } });
export function paintSongBar() {
  document.documentElement.classList.toggle("up-nonum", upSelected());   // v73: no sequence numbers on an uploaded song's grid
  if (state.simple) paintSimpleSrc();   // sync Simple's Song | Progressions tab when a song is loaded or cleared
  var bar = document.getElementById("songBar");
  if (!bar) return;
  var el = document.getElementById("suggest");
  if (el) Array.prototype.forEach.call(el.querySelectorAll(".up-flag"), function (n) { n.classList.remove("up-flag"); });
  var on = upSelected();   // v73: Simple shows the song bar too (lyrics + chords); the Upload panel stays full-mode only
  ChordAudio.grooveBpm = upSelected() ? shared.U.bpm : null;   // v73: style grooves follow the song tempo
  var showBar = on && !document.documentElement.classList.contains("s-src-prog");   // Simple Progressions view hides the lyric / chord bar
  if (bar.hidden === showBar) {
    bar.hidden = !showBar;
    document.documentElement.classList.toggle("up-on", on);   // CSS: the strip rows give the bar its room
    setTimeout(function () { fitStrip(); placeBadges(); }, 0);
  } else {
    document.documentElement.classList.toggle("up-on", on);
  }
  var slyr = showBar && state.simple && upLyrMap().any;   // v3.2 test.5: Simple shows the words like Expert (phones and iPad)
  var two = on && !state.simple && upLyrMap().any;   // v95: full mode's two-row lyrics
  if (document.documentElement.classList.contains("up-lyr2") !== two || document.documentElement.classList.contains("up-slyr") !== slyr) {
    document.documentElement.classList.toggle("up-lyr2", two);
    document.documentElement.classList.toggle("up-slyr", slyr);
    bar._html = null; lyrState.k = -1; slState.k = -1;
    setTimeout(function () { fitStrip(); placeBadges(); upPlaceLock(); }, 0);
  }
  if (!on) { paintUploadActive(-1); upPlaceLock(); paintUpNext(); return; }
  prog.steps.forEach(function (s, i) {
    var e = shared.U.events[i];
    if (e && upFlagged(e.si, e.ci) && prog.targets[i]) prog.targets[i].classList.add("up-flag");
  });
  var cur = upCurStep(), e0 = shared.U.events[cur >= 0 ? cur : 0] || shared.U.events[0], si = e0 ? e0.si : 0, sec = shared.U.secs[si];   // rd9: never a missing event
  var curCi = cur >= 0 ? e0.ci : -1;
  sbCue.j = -1; sbCue.pc = cur;
  if (!sbCueT) sbCueT = setInterval(sbCueTick, 60);
  if (slyr) {
    paintSimpleLyr(bar, cur);
    upPlaceLock();
    paintUpNext();
    bar.setAttribute("aria-label", "Song " + upProgObj.name + ", " + upSecName(si) + (curCi >= 0 ? ", now " + upT(upSym(si, curCi)) : "") + ". Open the song");
    paintUploadActive(cur >= 0 ? cur : -1);
    return;
  }
  if (two) {
    paintLyr2(bar, cur);
    upPlaceLock();
    paintUpNext();
    bar.setAttribute("aria-label", "Song " + upProgObj.name + ", " + upSecName(si) + (curCi >= 0 ? ", now " + upT(upSym(si, curCi)) : "") + ". Open the song");
    paintUploadActive(cur >= 0 ? cur : -1);
    return;
  }
  function chTag(ci, cue) { return "<span data-c=\"" + ci + "\" class=\"sb-ch" + (ci === curCi ? " on" : "") + (upFlagged(si, ci) ? " flag" : "") + (cue ? " sb-cue" : "") + "\">" + upEsc(upA(upSym(si, ci))) + "</span>"; }
  var html = "", line = null, LY = secLyrics(sec, e0 ? e0.rep : 0);   // rd10: this pass's lines
  LY.forEach(function (ln) {
    var has = ln.markers.some(function (m) { return m.chordIndex === Math.max(0, curCi); });
    if (has && !line) line = ln;
  });
  if (!line && LY.length && curCi >= 0) {
    LY.forEach(function (ln) { if (ln.markers.some(function (m) { return m.chordIndex <= curCi; })) line = ln; });
  }
  if (line) {
    var cue = sbCueFor(cur, 0), cueCi = -1;   // v3.2 test.5: only a change on this same line (section pass) gets the cue
    if (cue && cue.ev.si === si && cue.ev.rep === (e0 ? e0.rep : 0) && cue.ev.ci !== curCi && line.markers.some(function (m) { return m.chordIndex === cue.ev.ci; })) { cueCi = cue.ev.ci; sbCue.j = cue.j; }
    html = sbChipLine(line, chTag, cueCi);
  } else {
    sec.chords.forEach(function (c, ci) { html += chTag(ci); });
  }
  var alts = curCi >= 0 && !shared.U.locked && (upEv(si, curCi).alternates || []).length;
  var key = "<span class=\"sb-sec\">" + upEsc(upSecName(si)) + "</span><span class=\"sb-line\">" + html + "</span>" + (alts ? "<span class=\"sb-alt\">alt \u25be</span>" : "");
  if (bar._html !== key) { bar.innerHTML = key; bar._html = key; }
  bar.dataset.si = si;
  upPlaceLock();
  paintUpNext();
  bar.setAttribute("aria-label", "Song " + upProgObj.name + ", " + upSecName(si) + (curCi >= 0 ? ", now " + upT(upSym(si, curCi)) : "") + ". Open the song");
  paintUploadActive(cur >= 0 ? cur : -1);
}
export function paintUploadActive(step) {
  var box = document.getElementById("upSecs");
  if (!box) return;
  var e = step >= 0 && shared.U ? shared.U.events[step] : null;
  Array.prototype.forEach.call(box.querySelectorAll(".up-ch"), function (b) {
    b.classList.toggle("on", !!e && +b.dataset.s === e.si && +b.dataset.c === e.ci);
  });
}
export function upLyricHtml(sec, ln) {
  var mk = ln.markers.slice().sort(function (a, b) { return a.charIndex - b.charIndex; });
  var top = "", col = 0, marks = {};
  mk.forEach(function (m, k) {
    var nm = upA(upSym(shared.U.secs.indexOf(sec), m.chordIndex));
    var at = Math.max(m.charIndex, col);
    while (top.length < at) top += " ";
    top += nm + " ";
    col = top.length;
    marks[m.charIndex] = true;
  });
  var t = "";
  for (var i = 0; i < ln.text.length; i++) t += marks[i] ? "<span class=\"mk\">" + upEsc(ln.text.charAt(i)) + "</span>" : upEsc(ln.text.charAt(i));
  return "<div class=\"up-ly\"><div class=\"ly-c\">" + upEsc(top.replace(/\s+$/, "")) + "</div><div class=\"ly-t\">" + t + "</div></div>";
}
