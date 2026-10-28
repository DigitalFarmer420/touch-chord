// Upload song dialog: prompt copy, paste, check, load, library list.
import { unlock } from "../audio/unlock.js?v=112.12";
import { namePc, keyRootName } from "../keys.js?v=112.12";
import { upSave, libGet, paintLib, libEntryToU, upRestoreSel, libOpen, libSetVer, libDelete, libConfirm } from "../songs/library.js?v=112.12";
import { progBadge } from "../songs/magic.js?v=112.12";
import { progRedecorate } from "../songs/playback.js?v=112.12";
import { upInList, paintUpNext, upSelected, upKeyApply, upKeyNow, upTr, upLiveKeyObj, upT, upA, upSetLock, upPlaceLock, upSelect, upEsc, upStepOf, upCurStep, upPickAlt, upLoadOne } from "../songs/song.js?v=112.12";
import { validateSong, LAYER_NAMES } from "../songs/validate.js?v=112.12";
import { UP_PROMPT, UP_ARTIST_MAX, UP_SKIP_MAX, upListSchema13Text, upEv, upSym, upFlagged, upFlagList, upSecName, upLoadBegin, upLoadCheck, upLoadCommit } from "../songs/upload.js?v=112.12";
import { state, shared } from "../state.js?v=112.12";
import { accSym } from "../theory/spelling.js?v=112.12";
import { paintUploadActive, upLyricHtml } from "./songbar.js?v=112.12";
// v88: the empty-state hint shortens once both title and artist are filled in (live on input)
// v89: "ready" = the Artist box is filled (an empty title asks for songs by the artist)
const UP_EMPTY_FULL = "No song yet. Fill in the artist, and a song title if you like. Tap Copy for AI, paste it into any AI, then paste its answer and tap Load.";
const UP_EMPTY_READY = "Tap Copy for AI. Paste it into any AI, then paste its answer and tap Load.";
function upEmptyText() {
  var ti = document.getElementById("upTitle"), ar = document.getElementById("upArtist");
  return (ar && ar.value.trim()) ? UP_EMPTY_READY : UP_EMPTY_FULL;
}
function upEmptyRefresh() {
  var e = document.querySelector("#upSecs .up-empty");
  if (!shared.U && e) { var t = upEmptyText(); if (e.textContent !== t) e.textContent = t; }
  upAskRefresh();
}
// v89: the mode comes from the two fields (artist required; empty title = artist mode)
// v110: song or artist only (no album mode)
export function upMode(text, artist) {
  var a = String(artist || "").trim(), x = String(text || "").trim();
  if (!a) return { mode: "none", x: x, artist: "" };
  return x ? { mode: "song", x: x, artist: a } : { mode: "artist", x: "", artist: a };
}
function upModeNow() { return upMode(document.getElementById("upTitle").value, document.getElementById("upArtist").value); }
function upAskRefresh() {
  var el = document.getElementById("upAsk");
  if (!el) return;
  var md = upModeNow(), t = md.mode === "song" ? "Asks for: this song" : md.mode === "artist" ? "Asks for: up to " + UP_ARTIST_MAX + " songs by " + md.artist : "";
  if (el.textContent !== t) el.textContent = t;
  el.title = t;
  el.hidden = !t;
}
function upAskLine(md) {
  function q(v) { return "\"" + v + "\""; }
  if (md.mode === "song") return "What I want: " + q(md.x) + " by " + md.artist + ". Return just that one song.";
  return "What I want: up to " + UP_ARTIST_MAX + " of the best-known songs by " + md.artist + ", the ones whose chords you know best.";
}
function upSkipLine(md, have) {
  if (md.mode !== "artist") return "";
  var k = function (v) { return String(v || "").trim().toLowerCase(); };
  var t = have.filter(function (e) { return k(e.artist) === k(md.artist); }).map(function (e) { return e.title; }).slice(0, UP_SKIP_MAX);
  return t.length ? " Leave out these songs, I already have them: " + t.join("; ") + "." : "";
}
export function upPromptFor(md, ver, have) {
  return UP_PROMPT + "\n\n" + upAskLine(md) + upSkipLine(md, have || []);   // v112.12: the Contract v1.3 prompt (one text for Simple and Full)
}
function upViewSong() {
  if (!shared.upEdit) return null;
  if (shared.U && shared.U.id === shared.upEdit) return shared.U;
  var e = libGet(shared.upEdit), v = null;
  if (e) { try { v = libEntryToU(e); } catch (err) { v = null; } }
  return v;
}
export function paintUpload() {
  var pick = document.getElementById("uploadPick");
  if (!pick) return;
  paintLib();
  var V = upViewSong(), ro = !!V && V !== shared.U, U0 = shared.U, det = document.getElementById("upDetail");
  det.classList.toggle("ro", ro);
  var hd = document.getElementById("upDHead");
  hd.hidden = !V;   // v107: any song in the details (was: two-version songs only, and a CSS rule beat [hidden])
  if (V) {
    var one = !V.two, cur = one ? "simple" : V.ver;   // v107: always repainted, so no stale pick from another row
    Array.prototype.forEach.call(hd.querySelectorAll("[data-ver]"), function (b) {
      var off = one && b.dataset.ver === "full";
      b.setAttribute("aria-checked", b.dataset.ver === cur ? "true" : "false");
      b.disabled = off;
      if (off) { b.setAttribute("aria-disabled", "true"); b.title = "Only Simple chords. Load this song again to get Full."; } else { b.removeAttribute("aria-disabled"); b.removeAttribute("title"); }
    });
    document.getElementById("upDNote").hidden = !one;
  }
  shared.U = V;
  try { upPaintDetail(ro); } finally { shared.U = U0; }
  document.documentElement.classList.toggle("up-locked", !!(shared.U && shared.U.locked));
  if (!ro) { paintUploadActive(upSelected() ? upCurStep() : -1); paintUpNext(); }
}
function upPaintDetail(ro) {
  var keyEl = document.getElementById("upKey"), tEl = document.getElementById("upTempo"), secs = document.getElementById("upSecs");
  var rev = document.getElementById("upReview");
  var lrow = document.getElementById("upLockRow");
  lrow.hidden = !shared.U || ro;   // v105: a saved (not playing) song's details are read-only
  if (shared.U) {
    document.getElementById("upLock").setAttribute("aria-pressed", shared.U.locked ? "true" : "false");
    document.getElementById("upLockHint").textContent = shared.U.locked ? "Chords locked: styles change the sound only, a key change moves every chord. Unlock to review or change chords." : "Unlocked: you can review and change chords.";
  }
  if (!shared.U) {
    keyEl.textContent = "\u2014";
    tEl.textContent = "No song loaded";
    secs.innerHTML = "<div class=\"up-empty\">" + upEmptyText() + "</div>";
    rev.hidden = true;
    return;
  }
  var k = { pc: namePc(shared.U.key.tonic), mode: shared.U.key.mode === "minor" ? "minor" : "major" };
  keyEl.textContent = accSym(keyRootName(k)) + " " + k.mode;
  var lko = upLiveKeyObj();
  if (lko && upTr(lko)) keyEl.innerHTML = upEsc(accSym(keyRootName(lko)) + " " + lko.mode) + " <small style=\"font-size:.4em\">song: " + upEsc(accSym(keyRootName(k)) + " " + k.mode) + "</small>";
  tEl.innerHTML = upEsc(shared.U.title) + " \u2014 " + upEsc(shared.U.artist) + "<br>" + shared.U.bpm + " BPM \u00b7 " + upEsc(shared.U.ts);
  var fl = upFlagList();
  if (fl.length && !shared.U.locked && !ro) {
    var h = "<b>" + fl.length + " chord" + (fl.length > 1 ? "s" : "") + " need" + (fl.length > 1 ? "" : "s") + " review</b> (the AI was not sure). Keep it or pick another:";
    fl.forEach(function (f) {
      var c = upEv(f.si, f.ci);
      h += "<div class=\"ur-row\"><span>" + upEsc(upSecName(f.si)) + " #" + (f.ci + 1) + ": <b>" + upEsc(upA(c.chord)) + "</b> (" + Math.round(c.confidence * 100) + "%)</span>" +
        "<button type=\"button\" data-act=\"accept\" data-s=\"" + f.si + "\" data-c=\"" + f.ci + "\">Keep " + upEsc(upA(c.chord)) + "</button>";
      (c.alternates || []).forEach(function (a) { h += "<button type=\"button\" data-act=\"alt\" data-s=\"" + f.si + "\" data-c=\"" + f.ci + "\" data-sym=\"" + upEsc(a.chord) + "\">" + upEsc(upA(a.chord)) + "</button>"; });
      h += "</div>";
    });
    rev.innerHTML = h;
    rev.hidden = false;
  } else { rev.hidden = true; rev.innerHTML = ""; }
  var html = "";
  shared.U.secs.forEach(function (sec, si) {
    html += "<div class=\"up-sec\" data-s=\"" + si + "\"><div class=\"us-h\"><span>" + upEsc(upSecName(si)) + "</span>" + (sec.repeat > 1 ? "<small>\u00d7" + sec.repeat + "</small>" : "") +
      "<small>" + sec.chords.length + " chord" + (sec.chords.length > 1 ? "s" : "") + "</small></div><div class=\"up-chs\">";
    sec.chords.forEach(function (c, ci) {
      var alts = (c.alternates || []).length;
      html += "<button type=\"button\" class=\"up-ch" + (upFlagged(si, ci) ? " flag" : "") + "\" data-act=\"play\" data-s=\"" + si + "\" data-c=\"" + ci + "\" aria-label=\"" +
        upEsc(upT(upSym(si, ci)) + (upFlagged(si, ci) ? ", needs review" : "") + (alts ? ", has alternates" : "")) + "\">" + upEsc(upA(upSym(si, ci))) +
        (alts ? "<span class=\"alt\" data-act=\"alts\">alt\u25be</span>" : "") + "</button>";
    });
    html += "</div>";
    if (shared.upOpenAlt && +shared.upOpenAlt.split(":")[0] === si) {
      var ci0 = +shared.upOpenAlt.split(":")[1], c0 = sec.chords[ci0], cur = upSym(si, ci0);
      html += "<div class=\"up-alts\"><span>#" + (ci0 + 1) + ":</span><button type=\"button\" data-act=\"alt\" data-s=\"" + si + "\" data-c=\"" + ci0 + "\" data-sym=\"" + upEsc(c0.chord) + "\"" + (cur === c0.chord ? " class=\"on\"" : "") + ">" + upEsc(upA(c0.chord)) + " (original)</button>";
      (c0.alternates || []).forEach(function (a) {
        html += "<button type=\"button\" data-act=\"alt\" data-s=\"" + si + "\" data-c=\"" + ci0 + "\" data-sym=\"" + upEsc(a.chord) + "\"" + (cur === a.chord ? " class=\"on\"" : "") + ">" + upEsc(upA(a.chord)) + (a.reason ? " \u00b7 " + upEsc(a.reason) : "") + "</button>";
      });
      html += "</div>";
    }
    (sec.lyrics || []).forEach(function (ln) { html += upLyricHtml(sec, ln); });
    html += "</div>";
  });
  secs.innerHTML = html;
}
// v89: the multi-song summary in #upMsg (no key anywhere, per v87)
function upSummaryHtml(r) {
  var L = ["Loaded " + r.loaded + ", updated " + r.updated + ", skipped " + r.skipped + "."];
  if (r.active) L.push("Now playing: " + r.active + ".");
  if (r.truncated) { L.push("The answer was cut off: " + r.rows.length + " song" + (r.rows.length > 1 ? "s" : "") + " arrived complete."); }
  if (r.capSkipped) L.push("My songs is full: " + r.capSkipped + " song" + (r.capSkipped > 1 ? "s" : "") + " not saved. Remove some with the trash can and tap Load again.");
  var nf = r.rows.filter(function (x) { return x.status !== "skipped" && x.flags; }).length;
  if (nf) L.push(nf + " song" + (nf > 1 ? "s have" : " has") + " chords to review: play a song, then tap its pencil.");
  if (r.notes) L.push(r.notes.length > 140 ? r.notes.slice(0, 139) + "\u2026" : r.notes);
  var h = L.map(function (t) { return "<span class=\"us-l\">" + upEsc(t) + "</span>"; }).join("");
  h += "<details" + (r.skipped ? " open" : "") + "><summary>Show songs (" + r.rows.length + ")</summary><ul class=\"us-list\">";
  r.rows.forEach(function (x) {
    var nm = upEsc(x.title || "Song " + (x.i + 1));
    if (x.status === "skipped") {
      h += "<li class=\"sk\">\u2717 " + nm + " \u00b7 skipped: " + upEsc(x.reason) + ((x.errors || []).slice(0, 3).map(function (e) { return "<br><code>songs[" + x.i + "]" + (e.path.charAt(0) === "(" ? " " : ".") + upEsc(e.path) + "</code>: " + upEsc(e.msg); }).join("")) + "</li>";
    } else if (x.note) {   // v112.12: the length check / unknown tempo (a warning only; the song is saved)
      h += "<li class=\"fl\">\u26a0 " + nm + " \u00b7 " + x.status + (x.flags ? " \u00b7 " + x.flags + " chord" + (x.flags > 1 ? "s" : "") + " to review" : "") + "<br><small>" + upEsc(x.note) + "</small></li>";
    } else if (x.flags) {
      h += "<li class=\"fl\">\u26a0 " + nm + " \u00b7 " + x.status + " \u00b7 " + x.flags + " chord" + (x.flags > 1 ? "s" : "") + " to review</li>";
    } else {
      h += "<li>\u2713 " + nm + " \u00b7 " + x.status + "</li>";
    }
  });
  return h + "</ul></details>";
}
export function upShowErrors(r) {
  var box = document.getElementById("upErr"), msg = document.getElementById("upMsg");
  msg.hidden = true;
  if (r.ok) { box.hidden = true; box.innerHTML = ""; return; }
  var h = "<b>Could not load " + (r.list ? "any songs" : "the song") + ": " + r.errors.length + " problem" + (r.errors.length > 1 ? "s" : "") + "</b><ul>";
  r.errors.slice(0, 5).forEach(function (e) { h += "<li><code>" + upEsc(e.path) + "</code>: " + upEsc(e.msg) + "</li>"; });
  if (r.errors.length > 5) h += "<li>and " + (r.errors.length - 5) + " more</li>";
  box.innerHTML = h + "</ul>Ask the AI to fix these and paste its new answer.";
  box.hidden = false;
}
export function upCopyText() {
  var md = upModeNow(), have = shared.LIB.songs.map(function (e) { return { title: e.title, artist: e.artist }; });
  if (md.mode === "none") md = { mode: "artist", x: "", artist: "ARTIST" };
  return upPromptFor(md, "full", have) + "\n\nThe contract (JSON Schema):\n" + upListSchema13Text;   // v107: always Simple and Full; v112.12: contract v1.3
}
export function upSetPrompt(v) {
  shared.upPromptVer = "full";   // v107: hardcoded, the request is always Simple and Full
}
function upCopy() {
  var txt = upCopyText(), ok = document.getElementById("upCopied"), fb = document.getElementById("upFallback"), fbt = document.getElementById("upFallbackTxt");
  var t = (document.getElementById("upTitle").value || "").trim(), a = (document.getElementById("upArtist").value || "").trim();
  var err = document.getElementById("upErr");
  if (!a) {   // v89: the title is optional (empty = songs by the artist)
    upShowErrors({ ok: false, errors: [{ path: "Artist", msg: "is empty: type it so the AI knows whose songs to look up" }] });
    document.getElementById("upArtist").focus();
    var eb = document.getElementById("upErr"); if (eb.scrollIntoView) eb.scrollIntoView({ block: "nearest" });   // v91: the error is near the top
    return;
  }
  err.hidden = true;
  function done() { ok.hidden = false; ok.textContent = "Copied"; fb.hidden = true; clearTimeout(upCopy.t); upCopy.t = setTimeout(function () { ok.hidden = true; }, 2500); }
  function legacy() {
    var ta = document.createElement("textarea");
    ta.value = txt; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
    document.body.appendChild(ta); ta.select();
    var good = false;
    try { good = document.execCommand("copy"); } catch (e2) { good = false; }
    document.body.removeChild(ta);
    if (good) done();
    else { fbt.value = txt; fb.hidden = false; ok.hidden = true; fbt.focus(); fbt.select(); }
  }
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, legacy);
  else legacy();
}
function openUpload() {
  var pick = document.getElementById("uploadPick");
  // v105: opens as a clean list: the form is cleared, no details open, no status; playback is untouched
  ["upTitle", "upArtist", "upPaste", "upFallbackTxt"].forEach(function (id) { document.getElementById(id).value = ""; });
  ["upMsg", "upErr", "upFallback", "upCopied", "upVal"].forEach(function (id) { document.getElementById(id).hidden = true; });
  shared.upEdit = null; shared.upOpenAlt = null;
  paintUpload();
  upAskRefresh();
  upEmptyRefresh();
  pick.hidden = false;
  pick.querySelector(".kp-box").scrollTop = 0;
  var ul = document.getElementById("upLibList"), on = ul && ul.querySelector(".ul-row.on");   // v77: the active song in view
  if (on) ul.scrollTop = Math.max(0, on.offsetTop - ul.offsetTop - 4);
}
export function wireUpload() {
  var pick = document.getElementById("uploadPick"), btn = document.getElementById("uploadBtn");
  ["upTitle", "upArtist"].forEach(function (id) { var el = document.getElementById(id); if (el) el.addEventListener("input", upEmptyRefresh); });
  if (!pick || !btn) return;
  btn.addEventListener("click", function () { openUpload(); });
  document.getElementById("songBar").addEventListener("click", function () { if (!state.simple) openUpload(); });
  function close() { pick.hidden = true; }
  pick.querySelector(".up-x").addEventListener("click", close);
  pick.addEventListener("click", function (e) { if (e.target === pick) close(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !pick.hidden) close(); });
  document.getElementById("upCopy").addEventListener("click", upCopy);
  var upLoading = false;
  // v105: the summary / errors sit right under Load; bring them into view
  function upStatusIntoView() {
    var st = document.getElementById("upStatus"), lb = document.getElementById("upLoad");
    try { (st.offsetHeight ? st : lb).scrollIntoView({ block: "nearest" }); } catch (e) {}
  }
  function loadDone(r) {
    upLoading = false;
    var msg = document.getElementById("upMsg");
    upShowErrors(r);
    if (r.full) { var fe = document.getElementById("upErr"); fe.textContent = "My songs is full, remove one first"; fe.hidden = false; }
    if (r.saveFail) { var se = document.getElementById("upErr"); se.textContent = "Couldn't save, storage is full"; se.hidden = false; }
    if (!r.ok) { upStatusIntoView(); return; }
    if (!r.list) {
      var n = shared.U.events.length, fl = upFlagList().length;
      var lw = r.warnings.filter(function (w) { return /^(Length check|Tempo unknown)/.test(w); }), ow = r.warnings.filter(function (w) { return lw.indexOf(w) < 0; });   // v112.12
      msg.textContent = "Loaded " + shared.U.title + ": " + shared.U.secs.length + " sections, " + n + " chords, " + shared.U.bpm + " BPM." +   // v87: no key on the Upload form
        (lw.length ? " \u26a0 " + lw.join(" ") : "") +
        (fl ? " " + fl + " need review: tap the pencil on its row." : "") + (shared.U.two ? " Simple and Full versions: switch with the pencil on the song in My songs." : "") + (ow.length ? " Note: " + ow.slice(0, 3).join("; ") + (ow.length > 3 ? "\u2026" : "") : "") + " Close this and tap Next or Play.";
      msg.hidden = false;
      document.getElementById("upPaste").value = "";
    } else {
      msg.innerHTML = upSummaryHtml(r);
      msg.hidden = false;
      if (!r.skipped) document.getElementById("upPaste").value = "";   // kept so Load can run again after making room
    }
    ["upTitle", "upArtist"].forEach(function (id) { document.getElementById(id).value = ""; });   // v105: the form clears after Load
    shared.upOpenAlt = null; shared.upEdit = null;
    paintUpload();
    upAskRefresh();
    upEmptyRefresh();
    upStatusIntoView();
  }
  // Pre-save validation (validate.js): flags -> the #upVal panel; nothing is saved until Save anyway.
  var upValPending = null;
  function upValHide() { var v = document.getElementById("upVal"); v.hidden = true; v.innerHTML = ""; upValPending = null; }
  function upValGate(items, commit) {   // items: [{ title, song }]
    var groups = { key: [], timing: [], bpm: [] }, n = 0;
    items.forEach(function (it) {
      validateSong(it.song).flags.forEach(function (f) { groups[f.layer].push({ f: f, title: items.length > 1 ? it.title : "" }); n++; });
    });
    if (!n) { commit(); return; }
    var v = document.getElementById("upVal"), h = "<b>Check before saving: " + n + " thing" + (n > 1 ? "s look" : " looks") + " off</b>";
    ["key", "timing", "bpm"].forEach(function (L) {
      var g = groups[L];
      if (!g.length) return;
      h += "<div class=\"uv-g\" data-layer=\"" + L + "\"><div class=\"uv-h\">" + upEsc(LAYER_NAMES[L]) + " <small>" + g.length + "</small></div><ul>";
      g.slice(0, 6).forEach(function (x) { h += "<li class=\"uv-" + x.f.severity + "\">" + (x.title ? "<i>" + upEsc(x.title) + ":</i> " : "") + upEsc(x.f.message) + "</li>"; });
      if (g.length > 6) h += "<li>and " + (g.length - 6) + " more</li>";
      h += "</ul></div>";
    });
    h += "<div class=\"uv-btns\"><button type=\"button\" id=\"upValBack\">Go back and fix</button><button type=\"button\" id=\"upValSave\">Save anyway</button></div>";
    v.innerHTML = h; v.hidden = false;
    document.getElementById("upErr").hidden = true; document.getElementById("upMsg").hidden = true;
    upValPending = commit;
    upStatusIntoView();
    var bk = document.getElementById("upValBack"); if (bk) bk.focus();
  }
  document.getElementById("upVal").addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("button") : null;
    if (!t) return;
    if (t.id === "upValSave") { var c = upValPending; upValHide(); if (c) c(); }
    else if (t.id === "upValBack") { upValHide(); var pa = document.getElementById("upPaste"); pa.focus(); try { pa.scrollIntoView({ block: "nearest" }); } catch (err) {} }
  });
  document.getElementById("upLoad").addEventListener("click", function () {
    if (upLoading) return;   // v89: a Load tap during a run is ignored (Load itself stays tappable)
    unlock();
    upValHide();
    var b = upLoadBegin(document.getElementById("upPaste").value, { defer: true });
    if (b.done) { loadDone(b.done); return; }
    if (b.pending) { var r = b.pending; upValGate([{ title: r.song.song.title, song: r.song }], function () { loadDone(upLoadOne(r)); }); return; }
    var L = b.list, N = L.items.length, msg = document.getElementById("upMsg");
    function gate() {
      var ok = L.rows.filter(function (row) { return row.song; }).map(function (row) { return { title: row.title || row.song.song.title, song: row.song }; });
      upValGate(ok, function () { loadDone(upLoadCommit(L)); });
    }
    if (N <= 3) { for (var i = 0; i < N; i++) upLoadCheck(L, i); gate(); return; }
    upLoading = true;
    document.getElementById("upErr").hidden = true;
    var k = 0;
    (function step() {
      if (k >= N) { upLoading = false; msg.hidden = true; gate(); return; }
      msg.textContent = "Checking song " + (k + 1) + " of " + N + "\u2026"; msg.hidden = false;
      if (k === 0) upStatusIntoView();
      upLoadCheck(L, k++);
      setTimeout(step, 0);
    })();
  });
  // v105: no New song button: the form clears when the panel opens and after Load.
  // v92: no Remove song button; the trash icon on each My songs row removes a song (with a confirm)
  function act(e) {
    var t = e.target.closest ? e.target.closest("[data-act]") : null;
    if (!t || !shared.U) return;
    if (shared.upEdit && shared.U.id !== shared.upEdit) return;   // v105: read-only details of a saved song
    var a = t.dataset.act, b = t.closest("[data-s]"), si = +(t.dataset.s != null ? t.dataset.s : b.dataset.s), ci = +(t.dataset.c != null ? t.dataset.c : (t.closest(".up-ch") || {}).dataset.c);
    if (shared.U.locked && (a === "alts" || a === "alt" || a === "accept")) { e.stopPropagation(); return; }   // v73: Lock = no chord edits
    if (a === "alts") { e.stopPropagation(); shared.upOpenAlt = shared.upOpenAlt === si + ":" + ci ? null : si + ":" + ci; paintUpload(); return; }
    if (a === "play") {
      if (!upSelected()) upSelect();
      var i = upStepOf(si, ci);
      if (i >= 0) { unlock(); progBadge([i]); }
      if (!shared.U.locked && (upEv(si, ci).alternates || []).length) { shared.upOpenAlt = si + ":" + ci; paintUpload(); }
      return;
    }
    if (a === "accept") { shared.U.reviewed[si + ":" + ci] = true; upSave(); if (upSelected()) progRedecorate(); paintUpload(); return; }
    if (a === "alt") { upPickAlt(si, ci, t.dataset.sym); return; }
  }
  document.getElementById("upLibList").addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("[data-lib]") : null, row = b && b.closest("[data-id]");
    if (!b || !row) return;
    var id = row.dataset.id, ent = libGet(id);
    if (!ent) return;
    ["upMsg", "upErr", "upFallback", "upCopied"].forEach(function (x) { document.getElementById(x).hidden = true; });
    shared.upOpenAlt = null;
    if (b.dataset.lib === "edit" || b.dataset.lib === "done") {   // v105: details only via the pencil; playback untouched
      shared.upEdit = b.dataset.lib === "edit" && shared.upEdit !== id ? id : null;
      paintUpload();
      var eb = document.querySelector("#upLibList .ul-row[data-id=\"" + id + "\"] .ul-edit");   // v107: the rebuilt row
      if (shared.upEdit) { var dd = document.getElementById("upDetail"); try { (dd.offsetHeight ? dd : eb).scrollIntoView({ block: "nearest" }); } catch (err) {} }
      if (eb) eb.focus();
      return;
    }
    if (b.dataset.lib === "ver") { unlock(); libSetVer(id, b.dataset.ver); paintUpload(); return; }   // v80
    if (b.dataset.lib === "del") {
      if (!libConfirm(ent)) return;
      if (shared.upEdit === id) shared.upEdit = null;
      libDelete(id);
      document.getElementById("upMsg").textContent = "Song removed.";
      document.getElementById("upMsg").hidden = false;
      paintUpload();
      return;
    }
    unlock();
    if (!libOpen(id)) { var ne = document.getElementById("upErr"); ne.textContent = "This song needs a newer app"; ne.hidden = false; return; }   // v89: kept, never erased
    document.getElementById("upMsg").textContent = shared.U.title + " is ready. Close this and tap Next or Play.";
    document.getElementById("upMsg").hidden = false;
    paintUpload();
  });
  document.getElementById("upSecs").addEventListener("click", act);
  document.getElementById("upReview").addEventListener("click", act);
  // Reload: the saved song comes back selected, in its own key (full-mode key locks are not saved).
  if (upRestoreSel) setTimeout(function () { if (shared.U && upInList()) { upKeyApply(upKeyNow().tonic, upKeyNow().mode); upSelect(); } }, 0);
  document.getElementById("upLock").addEventListener("click", function () { upSetLock(!shared.U || !shared.U.locked); });
  document.getElementById("sbLock").addEventListener("click", function (e) { e.stopPropagation(); upSetLock(!shared.U || !shared.U.locked); });
  window.addEventListener("resize", function () { setTimeout(upPlaceLock, 0); });
}
