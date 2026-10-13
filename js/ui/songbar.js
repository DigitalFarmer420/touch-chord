// Song bar (uploaded song sections) and the upload active state.
import { api as ChordAudio } from "../audio/index.js?v=112.4";
import { prog, placeBadges } from "../songs/playback.js?v=112.4";
import { paintUpNext, upSelected, upT, upA, upPlaceLock, upEsc, upCurStep } from "../songs/song.js?v=112.4";
import { upProgObj, upEv, upSym, upFlagged, upSecName } from "../songs/upload.js?v=112.4";
import { state, shared } from "../state.js?v=112.4";
import { upLyrMap, lyrState, paintLyr2 } from "./lyrics.js?v=112.4";
import { fitStrip } from "./strip.js?v=112.4";
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
  var two = on && !state.simple && upLyrMap().any;   // v95
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
  var cur = upCurStep(), e0 = shared.U.events[cur >= 0 ? cur : 0], si = e0.si, sec = shared.U.secs[si];
  var curCi = cur >= 0 ? e0.ci : -1;
  if (two) {
    paintLyr2(bar, cur);
    upPlaceLock();
    paintUpNext();
    bar.setAttribute("aria-label", "Song " + upProgObj.name + ", " + upSecName(si) + (curCi >= 0 ? ", now " + upT(upSym(si, curCi)) : "") + ". Open the song");
    paintUploadActive(cur >= 0 ? cur : -1);
    return;
  }
  function chTag(ci) { return "<span data-c=\"" + ci + "\" class=\"sb-ch" + (ci === curCi ? " on" : "") + (upFlagged(si, ci) ? " flag" : "") + "\">" + upEsc(upA(upSym(si, ci))) + "</span>"; }
  var html = "", line = null;
  (sec.lyrics || []).forEach(function (ln) {
    var has = ln.markers.some(function (m) { return m.chordIndex === Math.max(0, curCi); });
    if (has && !line) line = ln;
  });
  if (!line && sec.lyrics && sec.lyrics.length && curCi >= 0) {
    sec.lyrics.forEach(function (ln) { if (ln.markers.some(function (m) { return m.chordIndex <= curCi; })) line = ln; });
  }
  if (line) {
    var mk = line.markers.slice().sort(function (a, b) { return a.charIndex - b.charIndex; }), p = 0;
    mk.forEach(function (m) { html += upEsc(line.text.slice(p, m.charIndex)) + chTag(m.chordIndex); p = Math.max(p, m.charIndex); });
    html += upEsc(line.text.slice(p));
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
