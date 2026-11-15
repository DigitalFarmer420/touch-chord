// Song bar (uploaded song sections) and the upload active state.
import { api as ChordAudio } from "../audio/index.js?v=112.13";
import { prog, placeBadges } from "../songs/playback.js?v=112.13";
import { paintUpNext, upSelected, upT, upA, upPlaceLock, upEsc, upCurStep } from "../songs/song.js?v=112.13";
import { upProgObj, upEv, upSym, upFlagged, upSecName } from "../songs/upload.js?v=112.13";
import { state, shared } from "../state.js?v=112.13";
import { secLyrics } from "../songs/fullchart.js?v=112.13";
import { upLyrMap, lyrState, paintLyr2, lyrPad } from "./lyrics.js?v=112.13";
import { fitStrip } from "./strip.js?v=112.13";
import { nextChange, songCue, cueSoon, cueClock, cueWord } from "./chordcue.js?v=112.13";
import { progLoopBar, songTempo } from "../songs/song.js?v=112.13";
// v3.2 test.5: the next-chord cue in Simple's song bar. Its lyrics already print each chord name inline, right before
// its word, so the cue colours that chord name teal and underlines its word (no second name above it); it brightens
// one beat before the change (Play) or when the change is the next tap. Phone Simple = the one-line bar; iPad = the
// two-row lyrics (lyrics.js paintLyr2, which takes the same cue).
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
  Array.prototype.forEach.call(bar.querySelectorAll(".sb-cue, .sb-cuew"), function (n) { n.classList.toggle("soon", soon); });
  if (soon !== sbCue.soon) { sbCue.log.push({ j: sbCue.j, cur: cur, soon: soon, playing: !!prog.playing }); if (sbCue.log.length > 200) sbCue.log.shift(); }
  sbCue.soon = soon;
}
var sbCueT = 0;   // started by the first song bar paint (not at import: unit tests import this file)
export function paintSongBar() {
  document.documentElement.classList.toggle("up-nonum", upSelected());   // v73: no sequence numbers on an uploaded song's grid
  var bar = document.getElementById("songBar");
  if (!bar) return;
  var el = document.getElementById("suggest");
  if (el) Array.prototype.forEach.call(el.querySelectorAll(".up-flag"), function (n) { n.classList.remove("up-flag"); });
  var on = upSelected();   // v73: Simple shows the song bar too (lyrics + chords); the Upload panel stays full-mode only
  ChordAudio.grooveBpm = upSelected() ? shared.U.bpm : null;   // v73: style grooves follow the song tempo
  if (bar.hidden === on) {
    bar.hidden = !on;
    document.documentElement.classList.toggle("up-on", on);   // CSS: the strip rows give the bar its room
    setTimeout(function () { fitStrip(); placeBadges(); }, 0);
  }
  var two = on && (!state.simple || lyrPad()) && upLyrMap().any;   // v95; iPad: Simple gets the lyric rows too
  if (document.documentElement.classList.contains("up-lyr2") !== two) {
    document.documentElement.classList.toggle("up-lyr2", two);
    bar._html = null; lyrState.k = -1;
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
