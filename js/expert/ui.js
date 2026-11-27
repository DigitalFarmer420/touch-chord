// Expert screen set (decisions 1-11 from the user, Uiux mockups expert-v9 / expert-ipad-v2).
// html.expert re-lays out the Full-mode controls (the chord grid #suggest, the chord-type table #palette,
// #sustainBtn, the Sound / FX / Layout / Loop panel #ctl, the keys #pads) with css/expert.css and adds the
// Expert-only controls below. Every new control drives the existing code (same functions or the same
// buttons), so sound, timing and music theory are exactly the 351c02c ones.
import { unlock } from "../audio/unlock.js?v=2026.11.27.5";
import { api as ChordAudio } from "../audio/index.js?v=2026.11.27.5";
import { stopPlayback } from "../loop.js?v=2026.11.27.5";
import { activeKey } from "../keys.js?v=2026.11.27.5";
import { setKidKey } from "../kids.js?v=2026.11.27.5";
import { prog, progSet, placeBadges, setBadgeAvoid, magic, progStop, progWalkAt, progWalkTo, playButtonLabel, transportLabel } from "../songs/playback.js?v=2026.11.27.5";
import { magicQueue } from "../songs/magic.js?v=2026.11.27.5";
import { nextHintSpec } from "../ui/next.js?v=2026.11.27.5";
import { setHintAvoid } from "../ui/hints.js?v=2026.11.27.5";
import { progFeel, progSteps } from "../songs/presets.js?v=2026.11.27.5";
import { progLockPick } from "../songs/proghold.js?v=2026.11.27.5";
import { upSelected, upCurStep, upNextStep, upA, progLoopBar, songTempo } from "../songs/song.js?v=2026.11.27.5";
import { songCue, cueSoon, cueClock, cuePieces, placeCueTag, cueChipClass } from "../ui/chordcue.js?v=2026.11.27.5";
import { upSym, upSecName } from "../songs/upload.js?v=2026.11.27.5";
import { upLyrMap, lyrPad } from "../ui/lyrics.js?v=2026.11.27.5";
import { state, shared, fingers, loop, scheduleSave } from "../state.js?v=2026.11.27.5";
import { tapSimpleSrc, paintSimpleSrc } from "../ui/simplesrc.js?v=2026.11.27.5";
import { accSym } from "../theory/spelling.js?v=2026.11.27.5";
import { Theory } from "../theory/index.js?v=2026.11.27.5";
import { paintKeyChip, keyLabel } from "../ui/keychip.js?v=2026.11.27.5";
import { fitNowSymbol } from "../ui/nowbox.js?v=2026.11.27.5";
import { computeSpec, renderPads, refreshHeld, setWinKeys } from "../ui/pads.js?v=2026.11.27.5";
import { liftFinger } from "../ui/touch.js?v=2026.11.27.5";
import { stripRelease } from "../ui/strip.js?v=2026.11.27.5";
import { fitStrip, stripLabel, stripChips } from "../ui/strip.js?v=2026.11.27.5";
import { setExpert as setKidsViewOff, setModeHandler, kidsStartOver, setTheme as setKidsTheme } from "../kids/view.js?v=2026.11.27.5";
import { setSimple } from "../ui/layout.js?v=2026.11.27.5";
import { libSetVer } from "../songs/library.js?v=2026.11.27.5";
import { secLyrics } from "../songs/fullchart.js?v=2026.11.27.5";
import { KEYS_CHOICES, makeChip, configureSheet, openModeSheet, bootSheet, paintSheet, sheetOpen } from "../ui/modesheet.js?v=2026.11.27.5";
import { registerLook, lookApplyNow, lookShown } from "../ui/look.js?v=2026.11.27.5";
import { toggleHelpMenu } from "../ui/helpmenu.js?v=2026.11.27.5";   // redesign-dev: the Kids view (kids-build) is the switch's Kids
import { EXPERT_STORE, parsePref, prefFromUrl, modeOf, modeTarget, typeBarInit, typeBarReduce, typeBarLabel, TYPEBAR_HOLD_MS,
  sourceInit, sourceReduce, progDots, songCardRows, capLayout, cardHead, STYLE_MENU, styleName, expertWindowKeys, expertStyleFix, fullToExpert, chartFor, expertPlayFace } from "./model.js?v=2026.11.27.5";
// rd6: ?test=1&classic=1 keeps the legacy classic screens (Full layout, Kids style chip in Simple) for the sound-equivalence
// suites (audioeq / kvaudio replay the 351c02c taps). Users can no longer reach them.
const CLASSIC = /[?&]test=1(&|$)/.test(location.search) && /[?&]classic=1(&|$)/.test(location.search);

var pref, tb, src, lastStyle = "pop", active = false, built = false, lastSel = null, lastProg = 0;
export const xLog = { mode: [], src: [], tb: [], chart: [], cue: [] };   // read by the e2e suite (?test=1 hooks)
var $ = function (id) { return document.getElementById(id); };
function el(tag, cls, html, attrs) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
  if (tag === "button") e.type = "button";
  return e;
}
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]; }); }
// rd10: Simple's own Look (Auto · Day · Lamp, Auto by default as in Kids and Expert). The classic dark screen is Lamp;
// Day is css/simpleday.css (html.s-day), set only while Simple is the mode (never in the test-only classic hatch).
const SLOOK_KEY = "touchChord.simpleLook.v1";
var sLook = (function () { var v = null; try { v = JSON.parse(localStorage.getItem(SLOOK_KEY) || "null"); } catch (e) {} return v && (v.look === "day" || v.look === "lamp") ? v.look : "auto"; })();
function saveSLook() { try { localStorage.setItem(SLOOK_KEY, JSON.stringify({ v: 1, look: sLook })); } catch (e) {} }
function paintSimpleLook() {
  var de = document.documentElement, on = !CLASSIC && currentMode() === "simple", day = on && lookShown("simple") === "day";
  de.classList.toggle("s-day", day); de.classList.toggle("s-lamp", on && !day);
}
function savePref() { try { localStorage.setItem(EXPERT_STORE, JSON.stringify(pref)); } catch (e) {} }
function loadPref() { var raw = null; try { raw = localStorage.getItem(EXPERT_STORE); } catch (e) {} return raw ? parsePref(raw) : parsePref("{}"); }
function srcCtx() { return { hasSong: !!shared.U, songSelected: upSelected() }; }
function isLand() { var c = document.documentElement.classList; return c.contains("lay-phone-land") || c.contains("lay-pad-land"); }
function click(sel) { var b = typeof sel === "string" ? document.querySelector(sel) : sel; if (b) b.click(); return !!b; }

// ---------- rd13: Keys (Octave · Full · Buttons) ----------
// One pick per device: the saved keyboard layout (touchChord.settings.v1 "layout", which the old Layout tab also sets).
// octave / piano (the same one-octave window) = Octave, full = Full, fourths = Buttons. Kids and Simple ignore it
// (they always play the one-octave window, pads.js effectiveLayout), so it is kept across mode switches and reloads.
const KEYS_LAYOUT = { octave: "octave", full: "full", buttons: "fourths" };
export function keysPick() { return state.layout === "full" ? "full" : state.layout === "fourths" ? "buttons" : "octave"; }
function keysLabel(k) { for (var i = 0; i < KEYS_CHOICES.length; i++) if (KEYS_CHOICES[i][0] === k) return KEYS_CHOICES[i][1]; return k; }
export function setKeys(k) {
  if (!KEYS_LAYOUT[k]) return;
  xLog.keys = (xLog.keys || []).concat(k);
  if (keysPick() !== k) { click("#layouts button[data-layout=\"" + KEYS_LAYOUT[k] + "\"]"); scheduleSave(0); }
  paintKeysChip(); if (sheetOpen()) paintSheet();
  if (active) setTimeout(function () { placeBadges(); }, 0);
}
function nextKeys() { var i = 0; KEYS_CHOICES.forEach(function (c, j) { if (c[0] === keysPick()) i = j; }); return KEYS_CHOICES[(i + 1) % KEYS_CHOICES.length][0]; }
// rd15 (Uiux): in short landscape the keyboard has no header strip; the chip is a button in the right-hand column.
// rd17 (Uiux): the keyboard's top bar is the keyboard's own controls - "Type: Auto ▾" at its left, the Keys cycle at its
// right (upright phones and iPad). Short landscape (no bar) puts the two side by side, half width, in the right-hand
// column under All notes / Sound (CSS places them; the DOM order is Type, All notes, Sound, Keys).
function placeKeysChip() {
  var c = $("xKeysChip"), t = $("xType"), de = document.documentElement, ctl = $("xCtl");
  // Outside Expert both controls stay in #xCtl, which is hidden. Leaving Type in the keyboard panel
  // pushed the classic keys down (the ?classic=1 hatch and grownup).
  if (!de.classList.contains("expert")) {
    if (ctl && t && t.parentNode !== ctl) ctl.insertBefore(t, ctl.firstChild);
    if (ctl && c && c.parentNode !== ctl) ctl.appendChild(c);
    return;
  }
  var land = de.classList.contains("lay-phone-land");
  var to = land ? ctl : document.querySelector(".kb-wrap");
  if (!to) return;
  if (t && t.parentNode !== to) to.insertBefore(t, to.firstChild);
  if (c && c.parentNode !== to) to.appendChild(c);
  stashTypeTable();
}
function paintKeysChip() {
  var c = $("xKeysChip"); if (!c) return; var k = keysPick();
  c.dataset.keys = k; // rd16 (Uiux): the full-width column button reads "Keys: Octave ↻" (a setting you cycle); the chip keeps "↻ Octave"
  c.innerHTML = "<span class=\"x-kci x-kci-a\" aria-hidden=\"true\">↻</span><span class=\"x-kpre\">Keys: </span><span class=\"x-kv\">" + keysLabel(k) + "</span><span class=\"x-kci x-kci-b\" aria-hidden=\"true\">↻</span>";
  c.setAttribute("aria-label", "Keys: " + keysLabel(k) + ". Tap for " + keysLabel(nextKeys()));
}

// ---------- mode ----------
export function expertActive() { return active; }
export function currentMode() { return modeOf({ kv: !!shared.kidsView, style: state.style, simple: state.simple, on: pref.on }); }
function modeState() { return { kv: !!shared.kidsView, style: state.style, simple: state.simple, on: pref && pref.on, classic: CLASSIC }; }
// rd2 (Noff, rd1 Low): a finger that went down before a mode switch must not act on the new screen when it lifts
// (hold a Kids pad, switch to Simple, lift on a chip: no chord). Its own release still runs (the held sound ends as
// before); only the click its lift would make on whatever is under it now is dropped.
var downs = {}, stale = {}, staleUp = {};
function guardTouches() {
  // rd3 (Noff rd2 Low): no time window. Only the click that belongs to a pointer which went down before the switch is
  // dropped (same pointerId). A click with no pointer id (keyboard, switch access, element.click(), older iOS) always works.
  window.addEventListener("pointerdown", function (e) { downs[e.pointerId] = true; delete stale[e.pointerId]; delete staleUp[e.pointerId]; }, true);
  function up(e) {
    delete downs[e.pointerId];
    if (!stale[e.pointerId]) return;
    delete stale[e.pointerId];
    stripRelease(e.pointerId); if (fingers[e.pointerId]) liftFinger(e.pointerId);   // the old screen's hold ends (no-ops when already done)
    staleUp[e.pointerId] = true;
    xLog.staleLift = (xLog.staleLift || 0) + 1;
  }
  window.addEventListener("pointerup", up, true); window.addEventListener("pointercancel", up, true);
  window.addEventListener("click", function (e) {
    var id = e.pointerId;
    if (id == null || id < 0 || !staleUp[id]) return;
    delete staleUp[id];
    e.stopImmediatePropagation(); e.preventDefault(); xLog.staleClick = (xLog.staleClick || 0) + 1;
  }, true);
}
export function setMode(target) {
  Object.keys(downs).forEach(function (id) { stale[id] = true; });   // fingers down now belong to the old screen
  var t = modeTarget({ style: state.style, simple: state.simple }, target, lastStyle);
  xLog.mode.push(target);
  closeAll(); openModeSheet(false); dropDenseNote();
  pref.on = t.on; savePref();
  if (t.kv) {   // Kids = the Kids view: leave the Expert screen first, then the Kids view takes over (it picks the Kids style)
    paintMode();
    setKidsViewOff(false);
    paintMode();
    return;
  }
  if (shared.kidsView) setKidsViewOff(true);   // back to the full app (the Kids view keeps its place in the song)
  if (t.style) click("#styles button[data-style=\"" + t.style + "\"]");
  if (t.simple !== null && !!state.simple !== t.simple) setSimple(t.simple);   // rd6: no Simple toggle button any more
  paintMode();
}
function paintMode() {
  if (fullToExpert(modeState())) { pref.on = true; savePref(); xLog.toExpert = (xLog.toExpert || 0) + 1; }   // rd6: no classic Full screen (a Start over outside Simple, ?expert=0)
  var fix = expertStyleFix(modeState());
  if (fix) { xLog.styleFix = (xLog.styleFix || 0) + 1; click("#styles button[data-style=\"" + fix + "\"]"); }   // rd4: Kids is not an Expert style; rd6: nor a Simple one
  if (state.style !== "kids") lastStyle = state.style;
  var de = document.documentElement, on = currentMode() === "expert";
  if (lookShown("expert") == null) lookApplyNow("expert");
  if (on !== active) {
    active = on;
    de.classList.toggle("expert", on);
    if (!on) closeAll();
    setWinKeys(on ? expertWindowKeys("octave") : 0);   // decision 10: C..B in the Octave / Piano window (Fourths / Full unchanged)
    renderPads(); refreshHeld(); paintKeyChip(computeSpec());
    setTimeout(function () { fitStrip(); placeBadges(); fitNowSymbol(); }, 0);
  }
  // PR #5 (Uiux): #xTog is shared with Simple's top bar, so every mode change puts it back in the active mode's slot
  // (Expert: placeTog's top-bar slot or the column; Simple: header.topbar). Each mode keeps its own Song | Progressions view.
  if (on) placeTog(); else paintSimpleSrc();
  paintModeSegs();
  paintSimpleLook();
  syncChart();
  if (sheetOpen()) paintSheet();
  if (on) { paint(); paintKeysChip(); placeKeysChip(); }
}
// rd6: uploaded songs: Simple plays the easy chart, Expert the Full chart (a one-chart song plays it in both). Set on every
// mode switch, load and song change; the per-song Simple / Full pick in My songs still works until the next one.
var chartAt = { id: null, mode: null }, chartAnchor = null;
function syncChart() {
  var U = shared.U, m = currentMode();
  if (!U || CLASSIC) return;
  if (chartAt.id === U.id && chartAt.mode === m) return;
  chartAt = { id: U.id, mode: m };
  var want = chartFor(m, !!U.two);
  if (want && U.ver !== want && U.id) {
    // rd7 (Noff rd6 #2): both charts share the form, so the position is kept by time (as 351c02c's Simple toggle kept
    // the step with progWalkAt / To).
    var w = upSelected() ? progWalkAt() : null;
    // rd9 (Noff rd8 #3): a round trip comes back to the same step. When the player has not moved since the last switch,
    // the beat they came from is used again (Abmaj7 @21.5 -> Simple Ab @21 -> Expert Abmaj7 @21.5, not Gm7 @21).
    var an = chartAnchor;
    if (w && !w.end && an && an.id === U.id && an.ver === U.ver && an.pos === magic.pos && !prog.playing) w.t = an.t;
    xLog.chart.push(m + ":" + want); try { libSetVer(U.id, want); } catch (e) { xLog.chart.push("err:" + e); }
    // rd8 (Noff rd7 Low): the exact beat, not the bar's start: the step that covers it in the other chart is next
    // (Bb13 at bar 3.5 -> Simple's Bb at 3.5, not Fm at 3), so the chord just played is never played again.
    if (w) { progWalkTo(w); xLog.chart.push("at:" + (w.end ? "end" : w.t) + ">" + magic.pos); }
    chartAnchor = w && !w.end && shared.U ? { id: shared.U.id, ver: shared.U.ver, pos: magic.pos, t: w.t } : null;
  }
}
export function chartState() { var U = shared.U; return U ? { id: U.id, two: !!U.two, ver: U.ver, events: U.events.length } : null; }
function paintModeSegs() {
  var m = currentMode();
  Array.prototype.forEach.call(document.querySelectorAll("#msMode button[data-mode]"), function (b) {
    var o = b.dataset.mode === m; b.classList.toggle("on", o); b.setAttribute("aria-checked", o ? "true" : "false");
  });
}

// ---------- build ----------
function build() {
  var app = $("app"), nowCol = document.querySelector(".now-col");
  var top = el("div", "x-top", null, { id: "xTop" });
  top.appendChild(el("button", "x-b x-key", "<span class=\"x-kl\">C major</span><span class=\"x-car\">\u25be</span>", { id: "xKey", "aria-haspopup": "dialog", "aria-label": "Key" }));
  top.appendChild(el("button", "x-b x-style", "<span class=\"x-sl\">Pop</span><span class=\"x-car\">\u25be</span>", { id: "xStyle", "aria-haspopup": "listbox", "aria-expanded": "false", "aria-label": "Style" }));
  top.appendChild(el("span", "x-slot"));
  var chip = makeChip("expert", "xModeChip"); chip.classList.add("x-b"); top.appendChild(chip);   // rd6: the mode chip (was the gold Expert button)
  top.appendChild(el("button", "x-b x-help", HELP_SVG, { id: "xHelp", "aria-label": "How to" }));   // rd7 (Uiux): the same "?" circle as Simple
  var tog = el("div", "x-seg x-tog", "<button type=\"button\" data-v=\"song\" role=\"tab\">\u266c Song</button><button type=\"button\" data-v=\"prog\" role=\"tab\">\u25a6 Progressions</button>", { id: "xTog", role: "tablist", "aria-label": "Song or progressions" });
  var go = el("div", "x-go", null, { id: "xGo" });
  go.appendChild(el("button", "x-b x-next", "Next \u279c", { id: "xNext", "aria-label": "Next chord" }));
  go.appendChild(el("button", "x-b x-play", "\u25b6", { id: "xPlay", "aria-label": "Play song" }));
  var song = el("div", "x-src", null, { id: "xSrc" });
  var list = el("div", "x-plist", null, { id: "xPList", role: "listbox", "aria-label": "Progressions", hidden: "" });
  var ctl = el("div", "x-ctl", null, { id: "xCtl" });
  // rd17: one line "Type: Auto ▾" (it lives in the keyboard bar, or half width in the short-landscape column)
  ctl.appendChild(el("button", "x-b x-type", "<span class=\"x-tcol\"><span class=\"x-lbl\">Type</span><span class=\"x-tsep\">: </span><span class=\"x-tv\">Auto</span></span><span class=\"x-car\">\u25be</span>", { id: "xType", "aria-expanded": "false", "aria-controls": "chords", "aria-label": "Chord type table" }));
  // rd17 (Uiux): "Full Range" is called "All notes", with a state line under it as SUSTAIN's "hold": in key only / all 12
  ctl.appendChild(el("button", "x-b x-full", "<span>All notes</span><small class=\"x-fsub\">in key only</small>", { id: "xFull", "aria-pressed": "false", "aria-label": "All notes: in key only" }));
  ctl.appendChild(el("button", "x-b x-sound", "<span>Sound \u25b4</span><small>FX \u00b7 Loop</small>", { id: "xSound", "aria-expanded": "false", "aria-controls": "ctl" }));
  var scrim = el("div", "x-scrim", null, { id: "xScrim", hidden: "" });
  var smenu = el("div", "x-menu", null, { id: "xStyleMenu", role: "listbox", "aria-label": "Style", hidden: "" });
  STYLE_MENU.forEach(function (s) { var b = el("button", "x-mi", "<b>" + esc(s[1]) + "</b><span>" + esc(s[2]) + "</span>", { role: "option", "data-style": s[0] }); smenu.appendChild(b); });
  var ksheet = el("div", "x-sheet x-keysheet", "<div class=\"x-grab\"></div><div class=\"x-sh-h\"><span>Key</span><button type=\"button\" class=\"x-b x-close\" aria-label=\"Close\">\u2715</button></div><div class=\"x-mini\" role=\"radiogroup\" aria-label=\"Key note\"></div><div class=\"x-seg x-kmode\"><button type=\"button\" data-km=\"major\">Major</button><button type=\"button\" data-km=\"minor\">Minor</button></div>", { id: "xKeySheet", role: "dialog", "aria-label": "Key", hidden: "" });
  var mini = ksheet.querySelector(".x-mini"), whites = el("div", "x-mw"), blacks = el("div", "x-mbk");
  var BL = { 1: 1, 3: 1, 6: 1, 8: 1, 10: 1 }, wi = 0;
  for (var pc = 0; pc < 12; pc++) {
    var b = el("button", "x-mk " + (BL[pc] ? "bk" : "wk") + " n" + pc, "<span>" + accSym(Theory.NOTE_NAMES[pc]) + "</span>", { "data-pc": String(pc), role: "radio" });
    if (BL[pc]) { b.style.left = "calc(" + (wi / 7 * 100) + "% - 6.5%)"; blacks.appendChild(b); } else { whites.appendChild(b); wi++; }
  }
  mini.appendChild(whites); mini.appendChild(blacks);
  [top, tog, go, song, list, ctl, scrim, smenu, ksheet].forEach(function (n) { app.insertBefore(n, nowCol); });
  // rd13: the Keys chip on the play panel's top-right corner (one tap = the next of Octave / Full / Buttons)
  var kw = document.querySelector(".kb-wrap"); if (kw) kw.appendChild(el("button", "x-kchip", "", { id: "xKeysChip" }));
  placeKeysChip(); if (window.MutationObserver) new MutationObserver(placeKeysChip).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  // Sound sheet extras (inside the existing Sound pane; shown only in Expert): a Vol slider that drives #volume.
  var vol = el("label", "x-volrow", "<span>Vol</span><input id=\"xVol\" type=\"range\" min=\"0\" max=\"100\" step=\"1\" aria-label=\"Volume\"><b id=\"xVolVal\"></b>");
  $("paneSound").appendChild(vol);
  // rd6: Simple's chip sits in the classic top bar, next to "?" (it replaces the Simple toggle and the gear menu).
  var hb = $("howtoBtn"); if (hb && hb.parentNode) hb.parentNode.insertBefore(makeChip("simple", "modeChip"), hb);
  built = true;
}

// ---------- sheets / menus ----------
function openOnly(id) {
  closeAll(id);
  var n = $(id); if (!n) return;
  n.hidden = false; $("xScrim").hidden = false;
  document.documentElement.classList.add("x-sheet-on");
  if (id === "xStyleMenu") { $("xStyle").setAttribute("aria-expanded", "true"); $("xStyle").classList.add("open"); }
  placeSheets();
}
export function closeAll(except) {
  ["xStyleMenu", "xKeySheet"].forEach(function (id) { if (id !== except && $(id)) $(id).hidden = true; });
  if ($("xStyle")) { $("xStyle").setAttribute("aria-expanded", "false"); $("xStyle").classList.remove("open"); }
  if (except !== "ctl") setCtlSheet(false);
  if (src && src.listOpen && except !== "xPList") srcDo("close");
  if ($("xScrim")) $("xScrim").hidden = !except;
  document.documentElement.classList.toggle("x-sheet-on", !!except);
}
function setCtlSheet(on) {
  var de = document.documentElement;
  if (!!on === de.classList.contains("x-ctl-on")) return;
  de.classList.toggle("x-ctl-on", !!on);
  if ($("xSound")) { $("xSound").setAttribute("aria-expanded", on ? "true" : "false"); $("xSound").classList.toggle("open", !!on); }
  if (on) {
    var ctl = $("ctl");
    if (!ctl.dataset.open || (ctl.dataset.open === "key" && !de.classList.contains("tc-classic"))) click("#ctl .ctl-tabs button[data-tab=\"sound\"]");   // rd17: the Layout tab is gone (the keyboard bar cycles Keys); a saved "key" pane opens on Sound
    if (de.classList.contains("lay-phone-land") && !de.classList.contains("drawer-open")) click("#ctlToggle");   // phone landscape: the classic drawer shows the panes
    $("xScrim").hidden = false;
    placeSheets();
  } else if (de.classList.contains("drawer-open")) click("#ctlToggle");
}
// Sheets stop above the piano (decision 10: the keys are never squeezed or covered).
function placeSheets() {
  var kb = document.querySelector(".kb-wrap"), top = $("xTop");
  if (!kb || !top) return;
  var r = kb.getBoundingClientRect(), t = top.getBoundingClientRect();
  document.documentElement.style.setProperty("--x-kb-top", Math.round(r.top) + "px");
  document.documentElement.style.setProperty("--x-top-b", Math.round(t.bottom) + "px");
  var sb = $("xStyle").getBoundingClientRect();
  $("xStyleMenu").style.left = Math.round(sb.left) + "px";
  $("xStyleMenu").style.top = Math.round(sb.bottom + 6) + "px";
  fitStyleMenu(sb.bottom + 6);
  var s = $("xSrc").getBoundingClientRect();
  $("xPList").style.top = Math.round(s.bottom + 6) + "px";
  document.documentElement.style.setProperty("--x-pl-top", Math.round(s.bottom + 6) + "px");
  fitProgList();
}
// The open Progressions list stays above the piano. When it still scrolls, only complete rows are shown and the
// bottom fades, so the scroll is obvious and no row is left sitting under the keys.
function fitProgList() {
  var L = $("xPList"); if (!L || L.hidden) return;
  var kb = document.querySelector(".kb-wrap"); if (!kb) return;
  var top = L.getBoundingClientRect().top;
  var avail = Math.max(80, Math.floor(kb.getBoundingClientRect().top - top - 8));
  L.style.maxHeight = avail + "px";
  if (L.scrollHeight <= avail + 1) {
    L.style.maxHeight = Math.min(L.scrollHeight, avail) + "px";
    L.classList.remove("x-more");
    return;
  }
  var de = document.documentElement;
  if (de.classList.contains("lay-pad-land") || de.classList.contains("lay-pad-port")
      || de.classList.contains("lay-phone-land") || de.classList.contains("sz-medium")) {
    // N13: iPad keeps all the room above the piano. N17: phone landscape and sz-medium (744x1133) do the same.
    // The faded part row shows it scrolls. Whole-row trim stays for compact phone portrait only (390x844).
    paintProgMore();
    return;
  }
  var cs = getComputedStyle(L);
  var padBot = parseFloat(cs.paddingBottom) + parseFloat(cs.borderBottomWidth);
  var rows = L.querySelectorAll(".x-prow");
  var lastFit = 0, i, bottom, h;
  for (i = 0; i < rows.length; i++) {
    bottom = rows[i].offsetTop + rows[i].offsetHeight;
    if (bottom + padBot <= avail) lastFit = bottom;
    else break;
  }
  h = lastFit + padBot;
  if (h < 80) h = avail;
  L.style.maxHeight = Math.floor(h) + "px";
  paintProgMore();
}
// N13: when the list opens, the picked row is fully in view and clear of the bottom fade (centred when it was not).
function showProgPick() {
  var L = $("xPList"); if (!L || L.hidden) return;
  var on = L.querySelector(".x-prow.on"); if (!on) return;
  var lr = L.getBoundingClientRect(), br = on.getBoundingClientRect(), cs = getComputedStyle(L);
  var bt = parseFloat(cs.borderTopWidth) || 0;
  var top = br.top - lr.top - bt + L.scrollTop, bot = top + br.height;
  var fade = L.scrollHeight > L.clientHeight + 1 ? (parseFloat(cs.getPropertyValue("--x-pl-fade")) || 28) : 0;   // N17: fade height from --x-pl-fade (28 default, 16 in phone landscape)
  if (top >= L.scrollTop && bot <= L.scrollTop + L.clientHeight - fade) return;
  L.scrollTop = Math.max(0, Math.min(L.scrollHeight - L.clientHeight, top - (L.clientHeight - br.height) / 2));
  paintProgMore();
}
function paintProgMore() {
  var L = $("xPList"); if (!L) return;
  var last = L.querySelectorAll(".x-prow")[L.querySelectorAll(".x-prow").length - 1], more = false;
  if (last) more = last.getBoundingClientRect().bottom > L.getBoundingClientRect().bottom + 1;   // the footnote under the last row does not keep the fade on
  L.classList.toggle("x-more", more);
}
// rd5 (Uiux, landscape phone): the open Style list grows into the space below (8px safe margin) so it shows every row that
// fits; when it still scrolls, it stops half way through a row and fades at the bottom, so the scroll is obvious.
// Portrait and iPad keep the CSS max-height.
function fitStyleMenu(top) {
  var m = $("xStyleMenu"); if (!m) return;
  if (!document.documentElement.classList.contains("lay-phone-land")) { m.style.maxHeight = ""; m.classList.remove("x-more"); return; }
  var rows = m.querySelectorAll(".x-mi"), cs = getComputedStyle(m);
  var pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
  var rowH = rows.length ? (rows[0].offsetHeight || 46) : 46, full = pad + rowH * rows.length;
  var avail = Math.floor((window.tcVH ? window.tcVH() : window.innerHeight) - top - 8);
  if (full <= avail) { m.style.maxHeight = Math.ceil(full) + "px"; m.classList.remove("x-more"); return; }
  var head = parseFloat(cs.paddingTop) + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);   // the cut row reaches the bottom edge
  var n = Math.max(1, Math.floor((avail - head - rowH / 2) / rowH));
  m.style.maxHeight = Math.floor(head + rowH * n + rowH / 2) + "px";
  paintStyleMore();
}
// rd6 (Uiux): the open Style list scrolls so the selected style is fully in view (centred when it was not).
export function scrollStyleSel() {
  var m = $("xStyleMenu"); if (!m || m.hidden) return;
  var b = m.querySelector(".x-mi[data-style=\"" + state.style + "\"]"); if (!b) return;
  var mr = m.getBoundingClientRect(), br = b.getBoundingClientRect(), cs = getComputedStyle(m);
  var top = br.top - mr.top - parseFloat(cs.borderTopWidth) + m.scrollTop, bot = top + br.height;
  var fade = m.scrollHeight > m.clientHeight ? br.height / 2 : 0;   // the cut half row + fade at the bottom
  if (top >= m.scrollTop && bot <= m.scrollTop + m.clientHeight - fade) { paintStyleMore(); return; }
  m.scrollTop = Math.max(0, Math.min(m.scrollHeight - m.clientHeight, top - (m.clientHeight - br.height) / 2));
  paintStyleMore();
}
function paintStyleMore() {
  var m = $("xStyleMenu"); if (!m) return;
  m.classList.toggle("x-more", m.scrollHeight - m.clientHeight - m.scrollTop > 4);
}
function placeTog() {   // landscape: the Song | Progressions toggle sits in the top bar's free middle (iPad landscape mockup)
  if (state.simple && !active) return;   // Simple owns #xTog while that mode is on (header.topbar)
  var tog = $("xTog"), slot = document.querySelector("#xTop .x-slot");
  if (!tog || !slot) return;
  if (isLand()) { if (tog.parentNode !== slot) slot.appendChild(tog); }
  else if (tog.parentNode !== $("app")) $("app").insertBefore(tog, $("xGo"));
}

// ---------- Type bar (decisions 2, 3, 4, 9) ----------
// The Expert "Type: Auto" button (#xType) and the chord-type table (#chords > #palette,
// Major / Minor / Sus4 / Dim and 6 / min7 / maj7 / 9) are off the screen. That table is not
// the playable chord grid (#suggest). Re-enable the controls by setting this true.
// The hold-to-sound path stays in typeBarReduce / typeBarLabel (model.js) and palette.js.
// shared.paletteHolds is momentary and is not written to storage. With the buttons
// unreachable, nothing is held, so playback stays on the Auto path (a key's own chord).
export var TYPE_TABLE_UI = false;
function stashTypeTable() {
  var hide = document.documentElement.classList.contains("expert") && !TYPE_TABLE_UI;
  var t = $("xType"), ch = $("chords");
  if (t) {
    t.hidden = hide;
    t.setAttribute("aria-hidden", hide ? "true" : "false");
    if (hide) t.tabIndex = -1; else t.removeAttribute("tabindex");
  }
  if (ch) {
    ch.hidden = hide;
    ch.setAttribute("aria-hidden", hide ? "true" : "false");
  }
  if (hide && tb && tb.open) tb = typeBarInit(false);
}
function tbDo(a) {
  var before = tb.open;
  tb = typeBarReduce(tb, a, { paletteHeld: Object.keys(shared.paletteHolds || {}).length > 0 });
  xLog.tb.push(a + ":" + (tb.open ? "open" : "closed"));
  if (before !== tb.open) {
    document.documentElement.classList.toggle("x-types-open", tb.open);
    $("xType").setAttribute("aria-expanded", tb.open ? "true" : "false");
    setTimeout(function () { fitStrip(); placeBadges(); placeSheets(); }, 0);
  }
  paintType();
}
export function typeBarState() { return Object.assign({}, tb); }
function paintType() {
  var holds = shared.paletteHolds || {}, lab = typeBarLabel(holds);
  var tv = document.querySelector("#xType .x-tv");
  if (tv && tv.textContent !== lab.text) tv.textContent = lab.text;
  $("xType").classList.toggle("held", lab.held);
  $("xType").querySelector(".x-car").textContent = tb.open ? "\u25b4" : "\u25be";
  var held = {};
  Object.keys(holds).forEach(function (id) { var h = holds[id]; if (h) held[(h.kind === "type" ? "t:" : "e:") + h.value] = 1; });
  Array.prototype.forEach.call(document.querySelectorAll("#palette button"), function (b) {
    var k = b.dataset.type ? "t:" + b.dataset.type : "e:" + b.dataset.ext;
    b.classList.toggle("x-held", !!held[k]);
  });
  paintMarks();   // keys: the sounding chord's pitch classes (mockup h: F A C E on the C..B keys)
  // NOW box: the played-with-a-held-type cue (teal ring + \u266a))) on the notes)
  document.documentElement.classList.toggle("x-heldplay", lab.held && Object.keys(fingers).length > 0);
}

// ---------- key marks by pitch class (rd3, Noff rd2 Med) ----------
// The Expert piano shows one 12-key window (7 white keys, decision 10). A sounding or next-chord note outside it is
// marked on its same-name key inside the window, in its normal gold / teal, with a small up / down arrow (as the Kids
// arrows). Visual only: nothing here changes what sounds.
var pc12 = function (m) { return ((m % 12) + 12) % 12; };
function soundingMidis() {
  var out = {};
  Object.keys(fingers).forEach(function (id) { (fingers[id].midis || []).forEach(function (m) { out[m] = 1; }); });
  var sp = shared.suggestPreview, raw = sp && sp.raw, pv = sp && sp.midis;
  if (raw) raw.forEach(function (m) { out[m] = 1; });   // the true sounding notes (pv.midis are moved onto the drawn keys)
  else if (pv) Object.keys(pv).forEach(function (m) { if (pv[m]) out[m] = 1; });
  return Object.keys(out).map(Number).filter(isFinite);
}
function nextMidis() {   // the same gate as the classic next-chord hint (next.js paintNextHint)
  try {
    if (!magic || state.simple || prog.playing || state.style === "kids" || !prog.steps.length) return [];
    var d = magicQueue(); if (!d) return [];
    if (upSelected() && upNextStep() < 0) return [];
    var sp = nextHintSpec(d.item); return (sp && sp.midis || []).map(Number).filter(isFinite);
  } catch (e) { return []; }
}
export function markPlan(keys, sounding, next) {   // keys: [{midi, pc}] in the window; returns { midi: { gold, teal, up, down } }
  var lo = Infinity, hi = -Infinity, byPc = {}, plan = {};
  keys.forEach(function (k) { lo = Math.min(lo, k.midi); hi = Math.max(hi, k.midi); byPc[k.pc] = k.midi; plan[k.midi] = {}; });
  function mark(list, kind) {
    var inWin = {}, out = {};
    list.forEach(function (m) { if (m >= lo && m <= hi) inWin[pc12(m)] = 1; else (out[pc12(m)] = out[pc12(m)] || []).push(m); });
    list.forEach(function (m) { if (m >= lo && m <= hi && plan[m]) plan[m][kind] = true; });
    Object.keys(out).forEach(function (pc) {
      if (inWin[pc] || byPc[pc] == null) return;   // the same note name already sounds in the window
      var k = plan[byPc[pc]]; k[kind] = true;
      if (out[pc].some(function (m) { return m > hi; })) k[kind + "Up"] = true; else k[kind + "Down"] = true;
    });
  }
  mark(sounding, "gold"); mark(next, "teal");
  return plan;
}
function paintMarks() {
  var pads = Array.prototype.slice.call(document.querySelectorAll("#pads .pad")).filter(function (k) { return isFinite(+k.dataset.midi); });
  if (!active || !pads.length) { pads.forEach(function (k) { k.classList.remove("x-pclit", "x-pcnx", "x-up", "x-down"); }); return; }
  var plan = markPlan(pads.map(function (k) { return { midi: +k.dataset.midi, pc: pc12(+k.dataset.midi) }; }), soundingMidis(), nextMidis());
  pads.forEach(function (k) {
    var p = plan[+k.dataset.midi] || {}, held = k.classList.contains("held");
    var gold = !!p.gold && !held, teal = !!p.teal && !p.gold && !held && !k.classList.contains("nx");
    var up = p.gold ? !!p.goldUp : (p.teal ? !!p.tealUp : false), down = p.gold ? !!p.goldDown : (p.teal ? !!p.tealDown : false);
    if (k.classList.contains("x-pclit") !== gold) k.classList.toggle("x-pclit", gold);
    if (k.classList.contains("x-pcnx") !== teal) k.classList.toggle("x-pcnx", teal);
    if (k.classList.contains("x-up") !== up) k.classList.toggle("x-up", up);
    if (k.classList.contains("x-down") !== down) k.classList.toggle("x-down", down);
    var at = !p.gold && !!p.teal && (up || down); if (k.classList.contains("x-arrow-teal") !== at) k.classList.toggle("x-arrow-teal", at);
  });
}
if (/[?&]test=1\b/.test(location.search)) window.__xMarks = { sounding: soundingMidis, next: nextMidis, plan: markPlan, paint: paintMarks };
var marksMo = null, marksT = 0;
function watchMarks() {   // the classic code repaints the keys often (held / nx / window moves): repaint the marks right after
  if (marksMo || !window.MutationObserver) return;
  marksMo = new MutationObserver(function () { if (!marksT) marksT = setTimeout(function () { marksT = 0; paintMarks(); }, 0); });
  marksMo.observe($("pads"), { attributes: true, attributeFilter: ["class"], subtree: true, childList: true });
  setInterval(function () { if (active) paintMarks(); }, 120);   // preview ends / playback steps that touch no key class
}

// ---------- Song | Progressions (decision 8) ----------
function srcDo(a) {
  var r = sourceReduce(src, a, srcCtx());
  var opened = r.s.listOpen && !src.listOpen;   // N13: this action opens the list
  src = r.s; lastSel = upSelected();
  xLog.src.push((typeof a === "string" ? a : a.type) + ":" + src.view + (src.listOpen ? "+list" : ""));
  if (r.fx === "openLibrary") { closeAll(); click("#uploadBtn"); }
  else if (r.fx === "selectSong") { for (var i = 0; i < prog.list.length; i++) if (prog.list[i].up) { progSet(i); break; } }
  else if (r.fx && r.fx.pick != null) progSet(r.fx.pick);
  $("xScrim").classList.toggle("x-clear", src.listOpen && !document.documentElement.classList.contains("x-sheet-on"));
  if (src.listOpen) $("xScrim").hidden = false;
  else if ($("xScrim") && !document.documentElement.classList.contains("x-sheet-on")) $("xScrim").hidden = true;
  paintSrc();
  if (src.listOpen) placeSheets();   // after paint: the bar height is final, then the list is sized to sit above the piano
  if (opened) showProgPick();
}
export function sourceState() { return Object.assign({}, src); }
function paintSrc() {
  if (!active) return;
  var sel = upSelected();
  if (sel !== lastSel) { lastSel = sel; src = sourceReduce(src, "sync", srcCtx()).s; }   // only when the selection changed elsewhere (load / open / pick)
  Array.prototype.forEach.call($("xTog").querySelectorAll("button"), function (b) { var o = b.dataset.v === src.view; b.classList.toggle("on", o); b.setAttribute("aria-selected", o ? "true" : "false"); });
  var box = $("xSrc"), html, sig, card = null, rowsHtml = "";
  if (src.view === "song") {
    var U = shared.U;
    if (U && upSelected()) {
      var cur = upCurStep(), e0 = U.events[cur >= 0 ? cur : 0] || U.events[0];
      // P4 (v3.2 UI polish): the song card rows come from the classic song bar's line map (same steps as playback).
      // The chord names follow the locked key (same upA path as playback). c.chord in the saved chart is not rewritten.
      var nRows = lyrPad() ? 3 : 2, ci = cur >= 0 && e0 ? e0.ci : -1;
      card = songCardRows(upLyrMap(), cur, nRows, ci, function (si, rep) { return secLyrics(U.secs[si], rep); },
        function (si) { return U.secs[si].chords.map(function (c, k) { return upA(upSym(si, k)); }); }, upSecName);
      // v3.2 test.5: the next-chord cue (gold underline + the chord name above the word where the next change lands)
      var names = U.events.map(function (e) { return upA(upSym(e.si, e.ci)); });
      var cue = songCue(upLyrMap(), card.idx, nRows, U.events, names, cur, function (si, rep) { return secLyrics(U.secs[si], rep); });
      if (cue) { var st = prog.steps[cue.j]; cue.cls = cueChipClass(st && st.item, stripChips(activeKey()), st && st.row); }
      if (cue && cue.k === 0 && card.rows[0].kind === "lyric" && card.rows[0].word) {   // never on the sung (gold) word itself
        var na = card.rows[0].before.length, nb = na + card.rows[0].word.length;
        if (cue.a < nb && cue.b > na) cue = null;
      }
      // N20 (Vinh 2026-11-17): section name on its own caption line; on phones it uses the hidden title's line (xCapFree)
      var capFree = xCapFree(), lay = capLayout(card.rows, capFree, cardHead(upLyrMap(), card.idx, upSecName)), hasCap = lay.some(function (it) { return it.cap != null; });
      if (cue && !lay.some(function (it) { return it.row && it.k === cue.k; })) cue = null;   // its row dropped for a caption
      xCue.j = cue ? cue.j : -1; xCue.pc = cur;
      // Vinh 2026-11-21: the chord name always sits inline, immediately right of its word (same height as that lyric
      // line). The old phone-portrait band above the line is no longer used.
      var inl = true;
      rowsHtml = lay.map(function (it, i) {
        // x-lcap-b: the line under the caption holds no cue name, so (phone portrait) its band moves above the caption and
        // the caption sits right on its line; with the cue there, the band stays between them for the chord name.
        var nx = lay[i + 1], b = nx && nx.row && !(cue && cue.k === nx.k) ? " x-lcap-b" : "";
        return it.cap != null ? "<span class=\"x-lcap" + b + "\">" + esc(it.cap) + "</span>" : lyrRowHtml(it.row, it.k === 0 ? "cur" : "nxt", cue && cue.k === it.k ? cue : null, inl); }).join("");
      var locked = !!U.locked;
      html = "<div class=\"x-songc\"><div class=\"x-stitle\">" + esc(U.title) + (U.artist ? " \u00b7 " + esc(U.artist) : "") + "</div><div class=\"x-lrows" + (capFree && hasCap ? " x-hascap" : "") + "\"><span class=\"x-lroll\">" + rowsHtml + "</span></div></div>"
        + (cue && !inl ? "<span class=\"x-cuetag" + (cue.cls ? " " + cue.cls : "") + "\" aria-hidden=\"true\" hidden>" + esc(cue.chord) + "</span>" : "")
        + "<button type=\"button\" class=\"x-b x-lock\" aria-pressed=\"" + locked + "\" aria-label=\"Lock the song chords\"><span class=\"x-lki\">" + (locked ? "\ud83d\udd12" : "\ud83d\udd13") + "</span><span class=\"x-lkt\">Lock</span></button>";
    } else {
      html = "<div class=\"x-songc x-empty\"><div class=\"x-stitle\">No song loaded</div><div class=\"x-sline\">Tap Song to open My songs and Upload</div></div>";
    }
    box.className = "x-src x-mode-song";
  } else {
    var songOn = upSelected();
    if (!songOn) lastProg = prog.idx;
    else if (!prog.list[lastProg] || prog.list[lastProg].up) lastProg = firstProg();
    var p = prog.list[songOn ? lastProg : prog.idx], n = songOn ? (p && p.steps ? p.steps.length : 0) : prog.steps.length;
    var dots = progDots(n, songOn ? -1 : prog.cur).map(function (d) { return "<i class=\"" + d + "\"></i>"; }).join("");
    var plk = !!prog.lock;
    html = "<button type=\"button\" class=\"x-pbar" + (src.listOpen ? " open" : "") + "\" aria-expanded=\"" + src.listOpen + "\" aria-controls=\"xPList\"><span class=\"x-pcol\"><span class=\"x-pn\">" + esc(p ? progFeel(p.name) : "") + heldTag(p) + "</span><span class=\"x-dots\">" + dots + "</span></span><span class=\"x-car\">" + (src.listOpen ? "\u25b4" : "\u25be") + "</span></button>"
      // Progression lock (not the song Lock): keep this sequence when the style changes.
      + "<button type=\"button\" class=\"x-b x-plock\" aria-pressed=\"" + plk + "\" aria-label=\"Keep this progression when the style changes\"><span class=\"x-lki\">" + (plk ? "\ud83d\udd12" : "\ud83d\udd13") + "</span><span class=\"x-lkt\">Lock</span></button>";
    box.className = "x-src x-mode-prog";
  }
  sig = src.view + "|" + html;
  if (src.view === "song" && card) { if (songCardPaint(box, html, sig, card, rowsHtml)) { paintList(); return; } }
  else xLyr.k = -1;
  if (box._sig !== sig) { box.innerHTML = html; box._sig = sig; if (card) fitLyrRow(box); }
  if (src.view !== "song") xCue.j = -1;
  paintCue();
  paintList();
}
// v3.2 test.5: brighten the cue about one beat before the change (Play), or when the change is the next step (Next /
// taps: no beat timing), and keep the name tag above its word (the row slides / rolls). Runs every 60 ms while shown.
var xCue = { j: -1, pc: -2, cur: -2, t: 0, soon: null };
function paintCue() {
  var box = $("xSrc"); if (!box) return;
  var w = box.querySelector(".x-cue"), tag = box.querySelector(".x-cuetag");
  if (!w || !tag || xCue.j < 0) { if (tag) tag.hidden = true; xCue.soon = null; return; }
  var cur = upCurStep(), t = songTempo();
  var soon = cueSoon({ j: xCue.j, cur: cur, playing: !!prog.playing, bars: prog.steps.map(function (s) { return s.bars; }),
    barSec: progLoopBar(), bpb: t && t.bpb || 4, since: cueClock(xCue, cur, performance.now()) });
  w.classList.toggle("soon", soon); tag.classList.toggle("soon", soon);
  if (soon !== xCue.soon) { xLog.cue.push({ j: xCue.j, cur: cur, soon: soon, playing: !!prog.playing }); if (xLog.cue.length > 200) xLog.cue.shift(); }
  xCue.soon = soon;
  placeCueTag(box, w, tag, box.querySelector(".x-lrow.cur .x-now"));
}
export function cueState() {
  var box = $("xSrc"), w = box && box.querySelector(".x-cue"), tag = box && box.querySelector(".x-cuetag");
  return { j: xCue.j, word: w ? w.textContent : null, row: w ? (w.closest(".x-lrow").classList.contains("cur") ? 0 : 1) : -1, chord: tag ? tag.textContent : null,
    soon: !!(w && w.classList.contains("soon")), tagShown: !!(tag && !tag.hidden), log: xLog.cue.slice(-40) };
}
// ---------- P4 song card rows (v3.2 UI polish) ----------
// Expert phones (the song title line is hidden there, expert.css): the same test as that CSS rule.
var XCAP_MQ = "(max-width: 599.98px), (max-height: 599.98px)";
function xCapFree() {
  var c = document.documentElement.classList;
  return (c.contains("lay-phone-port") || c.contains("lay-phone-land")) && !!(window.matchMedia && window.matchMedia(XCAP_MQ).matches);
}
function lyrRowHtml(r, cls, cue, inl) {
  var h = "";
  if ((r.kind === "lyric" || r.kind === "text") && cue) {   // v3.2 test.5: the cue word (and the sung word on row 1)
    var text = r.kind === "lyric" ? r.before + r.word + r.after : r.text, rg = [{ a: cue.a, b: cue.b, cls: "x-cue" }];
    if (r.kind === "lyric" && r.word) rg.push({ a: r.before.length, b: r.before.length + r.word.length, cls: "x-now" });
    h += cuePieces(text, rg).map(function (p) { return (p.cls ? "<span class=\"" + p.cls + "\">" + esc(p.t) + "</span>" : esc(p.t))
      + (inl && p.cls === "x-cue" ? "<span class=\"x-cuetag x-cuein" + (cue.cls ? " " + cue.cls : "") + "\" aria-hidden=\"true\">" + esc(cue.chord) + "</span>" : ""); }).join("");
  }
  else if (r.kind === "lyric") h += esc(r.before) + (r.word ? "<span class=\"x-now\">" + esc(r.word) + "</span>" : "") + esc(r.after);
  else if (r.kind === "text") h += esc(r.text);
  else if (r.kind === "chords") h += r.chords.map(function (c) { return "<span class=\"" + (c.on ? "x-now" : "") + "\">" + esc(c.t) + "</span>"; }).join(" ");
  return "<span class=\"x-lrow " + cls + "\" data-cue-row>" + (cls === "cur" ? "<span class=\"x-lin\"><span class=\"x-sline\">" + h + "</span></span>" : h) + "</span>";
}
// One-row roll when playback moves on to the next line (the classic bar's 300 ms roll); none with reduced motion.
var xLyr = { k: -1, ev: null, anim: 0, log: [] };
export function songCardState() { return { k: xLyr.k, anim: !!xLyr.anim, log: xLyr.log.slice() }; }
function songCardPaint(box, html, sig, card, rowsHtml) {
  var U = shared.U, same = xLyr.ev === U.events;
  if (xLyr.anim && same) return true;   // finish the roll first; the timer repaints
  var calm = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var step = same && xLyr.k >= 0 && card.idx === xLyr.k + 1 && box._sig && box.querySelector(".x-lrow.cur");
  xLyr.ev = U.events;
  if (step && !calm) {
    var old = box.querySelector(".x-lrow.cur"), oldHtml = old.outerHTML.replace(/<span class="x-cuetag[^"]*" aria-hidden="true">[^<]*<\/span>/g, "").replace(/<span class="x-(?:now|cue)[^"]*">([^<]*)<\/span>/g, "$1").replace(" x-shift", "");
    box.innerHTML = html.replace("<span class=\"x-lroll\">", "<span class=\"x-lroll\">" + oldHtml);
    box._sig = null;
    var roll = box.querySelector(".x-lroll");
    void roll.offsetWidth;
    roll.classList.add("go");
    xLyr.anim = setTimeout(function () { xLyr.anim = 0; box._sig = null; paintSrc(); }, 300);
    xLyr.log.push({ idx: card.idx, anim: true });
    xLyr.k = card.idx;
    return true;
  }
  if (card.idx !== xLyr.k) xLyr.log.push({ idx: card.idx, anim: false });
  if (xLyr.log.length > 200) xLyr.log.shift();
  xLyr.k = card.idx;
  return false;
}
// A long current line never wraps: if the sung word would fall past the edge, slide the row left so the word sits
// 24 css from the left, with a 16 css fade at the left edge.
function fitLyrRow(box) {
  var row = box.querySelector(".x-lrow.cur"), lin = row && row.querySelector(".x-lin"), w = lin && lin.querySelector(".x-now");
  if (!lin) return;
  lin.style.transform = ""; row.classList.remove("x-shift"); row.classList.remove("x-ovr");
  var rr = row.getBoundingClientRect(), lr = lin.getBoundingClientRect(), dx = 0;
  if (w) {
    var wr = w.getBoundingClientRect();
    if (wr.right > rr.right - 4) dx = Math.max(0, Math.min(wr.left - rr.left - 24, wr.right - rr.right + 8));
  }
  if (dx > 0) { lin.style.transform = "translateX(" + (-Math.round(dx)) + "px)"; row.classList.add("x-shift"); }
  if (lr.right - dx > rr.right + 0.5) row.classList.add("x-ovr");   // more text past the right edge: fade it out
}
function heldTag(p) { return p && p.held && p.from ? " <small>" + esc(styleName(p.from)) + "</small>" : ""; }   // a locked pick carried into another style
function progLockTap() {
  prog.lock = !prog.lock;
  prog.lockPick = prog.lock ? progLockPick(prog.list[upSelected() ? lastProg : prog.idx], state.style) : null;
  xLog.src.push("progLock:" + prog.lock);
  paintSrc();
}
function firstProg() { for (var i = 0; i < prog.list.length; i++) if (!prog.list[i].up) return i; return 0; }
function paintList() {
  var L = $("xPList");
  L.hidden = !(src.view === "prog" && src.listOpen);
  if (L.hidden) return;
  var k = prog.key || activeKey() || { pc: 0, mode: "major" };
  var sig = prog.idx + "|" + lastProg + "|" + prog.list.length + "|" + k.pc + k.mode + state.style;
  if (L._sig === sig) return;
  L._sig = sig;
  var h = "<div class=\"x-lbl\">" + esc(styleName(state.style)) + " progressions \u00b7 " + esc(keyLabel(k)) + "</div>";
  prog.list.forEach(function (p, i) {
    if (p.up) return;
    var steps = progSteps(k, p);
    var chips = steps.map(function (s) { return "<i class=\"x-pc " + esc(s.item.type) + "\">" + esc(accSym(stripLabel(s.item))) + "</i>"; }).join("");
    h += "<button type=\"button\" role=\"option\" class=\"x-prow" + (i === (upSelected() ? lastProg : prog.idx) ? " on" : "") + "\" data-i=\"" + i + "\" aria-selected=\"" + (i === prog.idx && !upSelected()) + "\"><span class=\"x-pcol\"><b>" + esc(progFeel(p.name)) + heldTag(p) + "</b></span><span class=\"x-pchips\">" + chips + "</span></button>";
  });
  h += "<p class=\"x-pnote\">Picking one unloads the song and folds this list to the bar above.</p>";
  L.innerHTML = h;
  var onRow = L.querySelector(".x-prow.on");   // open at the current pick
  if (onRow) L.scrollTop = Math.max(0, onRow.offsetTop - 40);
}

// ---------- paint ----------
var paintT = 0;
export function paint() {
  if (!active || !built) return;
  var k = activeKey() || { pc: 0, mode: "major" };
  var kl = keyLabel(k);
  var q = document.querySelector("#xKey .x-kl"); if (q.textContent !== kl) q.textContent = kl;
  q = document.querySelector("#xStyle .x-sl"); var sn = styleName(state.style); if (q.textContent !== sn) q.textContent = sn;
  Array.prototype.forEach.call(document.querySelectorAll("#xStyleMenu .x-mi"), function (b) { var o = b.dataset.style === state.style; b.classList.toggle("on", o); b.setAttribute("aria-selected", o ? "true" : "false"); });
  Array.prototype.forEach.call(document.querySelectorAll("#xKeySheet .x-mk"), function (b) { var o = +b.dataset.pc === k.pc; b.classList.toggle("on", o); b.setAttribute("aria-checked", o ? "true" : "false"); });
  Array.prototype.forEach.call(document.querySelectorAll("#xKeySheet .x-kmode button"), function (b) { b.classList.toggle("on", b.dataset.km === k.mode); });
  $("xFull").setAttribute("aria-pressed", state.allKeys ? "true" : "false");
  $("xFull").classList.toggle("on", !!state.allKeys);
  var fs = $("xFull").querySelector(".x-fsub"), ft = state.allKeys ? "all 12" : "in key only";
  if (fs.textContent !== ft) { fs.textContent = ft; $("xFull").setAttribute("aria-label", "All notes: " + ft); }
  paintPlayFace();
  var v = $("volume"); if (v) { $("xVol").value = v.value; $("xVolVal").textContent = v.value; }
  paintType();
  paintSrc();
}
// Playing: a stop square, immediately. Paused keeps the place in the song, so the glyph is Play
// again and the next tap resumes. Idle (the song or progression has ended, or Stop cleared it)
// is Play too. Cream / ink colours stay as they are; only the glyph changes. Kids is not this button.
function paintPlayFace() {
  var b = $("xPlay"); if (!b) return;
  var face = expertPlayFace(transportLabel()), xl = playButtonLabel();
  b.textContent = face.glyph;
  b.classList.toggle("is-stop", face.stop);
  b.removeAttribute("aria-pressed");
  b.setAttribute("aria-label", xl.aria); b.title = xl.title;
}
function schedule() { if (paintT) return; paintT = requestAnimationFrame(function () { paintT = 0; paintMode(); }); }
export function expertPaintNow() { paintMode(); }

// ---------- wire ----------
function wireAll() {
  $("xKey").addEventListener("click", function () { openOnly("xKeySheet"); paint(); });
  $("xStyle").addEventListener("click", function () { if ($("xStyleMenu").hidden) { openOnly("xStyleMenu"); paint(); scrollStyleSel(); } else closeAll(); });
  $("xStyleMenu").addEventListener("scroll", paintStyleMore, { passive: true });
  $("xStyleMenu").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-style]"); if (!b) return;
    unlock(); closeAll(); click("#styles button[data-style=\"" + b.dataset.style + "\"]"); schedule();
  });
  $("xHelp").addEventListener("click", function (e) { closeAll(); toggleHelpMenu(e.currentTarget); });   // rd17: How to / Tour menu
  $("xNext").addEventListener("click", function () { click("#prog .pg-step"); schedule(); });
  $("xPlay").addEventListener("click", function () { click("#prog .pg-song"); paintPlayFace(); schedule(); });
  window.addEventListener("tc:transport", function () { paintPlayFace(); schedule(); });   // glyph follows pause / resume / end from any path
  $("xTog").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-v]"); if (!b) return;
    if (state.simple) { tapSimpleSrc(b.dataset.v); return; }
    srcDo(b.dataset.v === "song" ? "tapSong" : "tapProg");
  });
  $("xSrc").addEventListener("click", function (e) {
    if (e.target.closest(".x-pbar")) { srcDo("tapBar"); return; }
    if (e.target.closest(".x-plock")) { progLockTap(); return; }
    if (e.target.closest(".x-lock")) { click("#sbLock"); schedule(); return; }
    if (e.target.closest(".x-mode-song .x-songc")) click("#songBar");   // the song strip opens the song, as the classic song bar does
  });
  $("xPList").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-i]"); if (!b) return;
    unlock(); srcDo({ type: "pick", i: +b.dataset.i });
  });
  $("xPList").addEventListener("scroll", paintProgMore, { passive: true });
  $("xScrim").addEventListener("click", function () { closeAll(); });
  $("xFull").addEventListener("click", function () { click("#allKeys"); schedule(); });
  $("xKeysChip").addEventListener("click", function () { closeAll(); setKeys(nextKeys()); });
  $("layouts").addEventListener("click", function () { setTimeout(paintKeysChip, 0); });   // the hidden Layout segment (setKeys drives it; the test-only classic screen shows it)
  $("xSound").addEventListener("click", function () {
    if (document.documentElement.classList.contains("x-ctl-on")) closeAll(); else { closeAll("ctl"); setCtlSheet(true); }
  });
  // Type bar: one tap opens / folds the table; holding it 0.3 s peeks it open until let go (mockup h).
  var tbt = 0, tbHeld = false, tbPid = null;
  $("xType").addEventListener("pointerdown", function (e) {
    if (e.button != null && e.button !== 0) return;
    tbPid = e.pointerId; tbHeld = false; clearTimeout(tbt);
    tbt = setTimeout(function () { tbt = 0; tbHeld = true; tbDo("hold"); }, TYPEBAR_HOLD_MS);
  });
  function tbUp(e) {
    if (e.pointerId !== tbPid) return;
    tbPid = null;
    if (tbt) { clearTimeout(tbt); tbt = 0; tbDo("tap"); } else if (tbHeld) tbDo("release");
    tbHeld = false;
  }
  $("xType").addEventListener("pointerup", tbUp);
  $("xType").addEventListener("pointercancel", function (e) { if (e.pointerId === tbPid) { clearTimeout(tbt); tbt = 0; if (tbHeld) tbDo("release"); tbPid = null; tbHeld = false; } });
  $("xType").addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tbDo("tap"); } });
  $("xType").addEventListener("contextmenu", function (e) { e.preventDefault(); });
  // Held chord types (decision 9): label + HELD marks follow the palette holds; when the last one is let go, a peeked table folds.
  function afterPointer() { setTimeout(function () { if (!active) return; paintType(); if (!Object.keys(shared.paletteHolds || {}).length) { if (tb.foldWhenFree) tbDo("paletteFree"); } }, 0); }
  ["pointerdown", "pointerup", "pointercancel"].forEach(function (t) { document.addEventListener(t, afterPointer, true); });
  document.addEventListener("touchend", afterPointer, true);
  // Key sheet
  $("xKeySheet").addEventListener("click", function (e) {
    var k = activeKey() || { pc: 0, mode: "major" };
    var m = e.target.closest(".x-mk"); if (m) { unlock(); setKidKey(+m.dataset.pc, k.mode); schedule(); return; }
    var md = e.target.closest("[data-km]"); if (md) { setKidKey(k.pc, md.dataset.km); schedule(); return; }
    if (e.target.closest(".x-close")) closeAll();
  });
  $("xVol").addEventListener("input", function () { var v = $("volume"); v.value = $("xVol").value; v.dispatchEvent(new Event("input", { bubbles: true })); $("xVolVal").textContent = v.value; });
  $("xVol").addEventListener("change", function () { var v = $("volume"); v.value = $("xVol").value; v.dispatchEvent(new Event("change", { bubbles: true })); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && active) closeAll(); });
  // Repaint when the app changes underneath (style / Simple / song / step / key / Play state).
  document.addEventListener("click", function () { setTimeout(schedule, 0); }, true);
  if (window.MutationObserver) {
    var mo = new MutationObserver(schedule);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    ["symbol", "songBar", "styles", "prog", "kidKey"].forEach(function (id) { var n = $(id); if (n) mo.observe(n, { attributes: true, childList: true, subtree: true, characterData: true }); });
  }
  setInterval(function () { if (active && prog.playing) paintSrc(); }, 400);
  setInterval(function () { if (!active || xCue.j < 0) return; if (upCurStep() !== xCue.pc) paintSrc(); else paintCue(); }, 60);   // v3.2 test.5: the cue moves on once its chord plays
  window.addEventListener("resize", function () { if (active && $("xSrc")) fitLyrRow($("xSrc")); });   // P4: re-fit the sung word after a rotation
  var rz = 0;
  function onResize() { clearTimeout(rz); rz = setTimeout(function () { if (!active) return; placeTog(); placeSheets(); fitStrip(); placeBadges(); fitNowSymbol(); paintSrc(); if (src.listOpen) showProgPick(); }, 80); }   // test.5: the cue name is inline / above by layout
  window.addEventListener("resize", onResize); window.addEventListener("orientationchange", onResize);
}

// rd6: Start over (the shared sheet, after its 2 s hold): Kids as before (reset, then Kids from Hello); Simple / Expert
// reset every setting (the Expert look back to Auto) and stay in the same mode.
function startOver(m) {
  if (m === "kids") { kidsStartOver(); return; }
  progStop(); ChordAudio.band.hush(); if (loop.recording || loop.playing || loop.transport) stopPlayback();   // rd7 (Noff rd6 #1): Start over stops Play song and silences everything, as in Kids / Simple
  click("#factoryReset");
  pref.look = "auto"; pref.on = m === "expert"; savePref(); lookApplyNow("expert");
  if (m === "simple" && !state.simple) setSimple(true);
  paintMode();
}
// rd6 (Uiux): one-time note when an old Full-layout setup opens in Expert. Seen = saved in its own key (once per device;
// Start over keeps it); new setups never see it.
export const NOTE_KEY = "touchChord.notes.v1";
function notes() { try { var o = JSON.parse(localStorage.getItem(NOTE_KEY) || "{}"); return o && typeof o === "object" ? o : {}; } catch (e) { return {}; } }
function showDenseNote() {
  var o = notes(); if (o.denseMoved) { xLog.denseNote = "seen"; return; }
  o.denseMoved = true; try { localStorage.setItem(NOTE_KEY, JSON.stringify(o)); } catch (e) {}
  var n = el("div", "x-note", "<span class=\"x-note-t\">" + NOTE_TEXT + "</span>", { id: "xDenseNote", role: "status" });
  document.body.appendChild(n); xLog.denseNote = "shown"; placeDenseNote(); setTimeout(placeDenseNote, 300);   // again once the strip has fitted
  window.addEventListener("resize", placeDenseNote);
  // rd7: it never blocks play: taps pass through it, and it fades out after NOTE_MS or on the first tap anywhere
  noteT = setTimeout(function () { fadeDenseNote("time"); }, NOTE_MS);
  window.addEventListener("pointerdown", noteTap, true);
}
export const NOTE_MS = 6000;
export const NOTE_TEXT = "Dense layout is here now";
// rd9: along the top edge of the chord panel (the strip above the pads), inset 6px, ending left of any chip in that
// strip (the bVII chip at the top right); 28px tall under 400px of height, so it clips step badges, not chord names.
// If that leaves too little room for the line, it spans the panel (it is pass-through either way).
function placeDenseNote() {
  var n = $("xDenseNote"), c = document.querySelector(".next-card"); if (!n || !c) return;
  var r = c.getBoundingClientRect(); if (!r.width) return;
  var slim = (window.tcVH ? window.tcVH() : window.innerHeight) < 400, H = slim ? 28 : 30, top = Math.round(r.top + 4), left = Math.round(r.left + 6), right = Math.round(r.right - 6);
  Array.prototype.forEach.call(document.querySelectorAll("#suggest .ss-chip, #suggest .ss-note"), function (e) {
    if (!e.getClientRects().length || getComputedStyle(e).visibility === "hidden") return;
    var q = e.getBoundingClientRect();
    if (q.top < top + H && q.bottom > top && q.right > left) right = Math.min(right, Math.floor(q.left - 6));
  });
  if (right - left < 180) right = Math.round(r.right - 6);
  n.classList.toggle("slim", slim);
  n.style.left = left + "px"; n.style.top = top + "px"; n.style.width = (right - left) + "px";
  xLog.denseAt = [left, top, right - left, H];
}
var noteT = 0;
function noteTap() { fadeDenseNote("tap"); }   // rd9: no ✕; the tap still reaches the control under the banner
function fadeDenseNote(why) {
  var n = $("xDenseNote"); clearTimeout(noteT); noteT = 0; window.removeEventListener("pointerdown", noteTap, true); window.removeEventListener("resize", placeDenseNote);
  if (!n || n.classList.contains("out")) return;
  xLog.denseGone = why; n.classList.add("out"); setTimeout(function () { n.remove(); }, 400);
}
function dropDenseNote() { clearTimeout(noteT); noteT = 0; window.removeEventListener("pointerdown", noteTap, true); window.removeEventListener("resize", placeDenseNote); var n = $("xDenseNote"); if (n) { xLog.denseGone = xLog.denseGone || "x"; n.remove(); } }

// rd7: the classic top bar's "?" icon (index.html #howtoBtn), so Expert's matches it
const HELP_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r="0.6" fill="currentColor"/></svg>';
// Boot (from main.js, after the app's own boot: saved settings applied, first song set).
export function boot() {
  pref = prefFromUrl(location.search, loadPref());
  var urlOn = /[?&]expert=1(&|$)/.test(location.search);
  if (/[?&]expert=[01](&|$)/.test(location.search)) savePref();
  guardTouches();
  watchMarks();
  setModeHandler(setMode);
  // rd2 (Uiux #3): in Expert a step badge keeps off the other chips' tiles (e.g. the 3 on Am no longer sits on A / vi)
  setBadgeAvoid(function (strip) {
    if (!active) return [];
    return Array.prototype.map.call(strip.querySelectorAll(".ss-chip, .ss-note"), function (n) { var q = n.getBoundingClientRect(); return { el: n, left: q.left, top: q.top, right: q.right, bottom: q.bottom }; });
  });   // the Kids view's own Kids / Simple / Expert row goes through the same switch
  // rd4 (Uiux rd3): the play-along hint never covers an Expert block (top bar, Song | Progressions, Next / Play, the source
  // bar with its dots, Now, the controls, the keys); inside the chord grid it sits only in empty space, clear of its border
  setHintAvoid(function () {
    if (!active) return [];
    var out = [];
    Array.prototype.forEach.call(document.querySelectorAll("#xTop, #xTog, #xGo, #xSrc, #xPList, .now-card, #xCtl, .kb-wrap, #dev-badge, .pg-badge, #xStyleMenu, #xDenseNote"), function (n) {
      if (n.closest("[hidden]") || getComputedStyle(n).display === "none") return; out.push(n.getBoundingClientRect()); });
    var g = document.querySelector(".next-card"), q = g && g.getBoundingClientRect(), B = 8;
    if (q && q.width) out.push({ left: q.left, right: q.right, top: q.top, bottom: q.top + B, width: q.width, height: B }, { left: q.left, right: q.right, top: q.bottom - B, bottom: q.bottom, width: q.width, height: B },
      { left: q.left, right: q.left + B, top: q.top, bottom: q.bottom, width: B, height: q.height }, { left: q.right - B, right: q.right, top: q.top, bottom: q.bottom, width: B, height: q.height });
    return out;
  });
  tb = typeBarInit(false);
  src = sourceInit(srcCtx());
  if (CLASSIC) document.documentElement.classList.add("tc-classic");
  registerLook("simple", function () { return sLook; }, function () { paintSimpleLook(); });
  registerLook("expert", function () { return pref.look; }, function (l) { var de = document.documentElement; de.classList.toggle("x-lamp", l !== "day"); de.classList.toggle("x-day", l === "day"); });
  build();
  wireAll();
  bootSheet();
  configureSheet({
    mode: currentMode,
    setMode: setMode,
    lookGet: function (m) { return m === "kids" ? state.theme : m === "simple" ? sLook : pref.look; },
    lookSet: function (m, v) {
      if (m === "kids") setKidsTheme(v);
      else if (m === "simple") { sLook = v === "day" || v === "lamp" ? v : "auto"; saveSLook(); lookApplyNow("simple"); paintMode(); }
      else { pref.look = v; savePref(); lookApplyNow("expert"); paintMode(); }
    },
    isDay: function (m) { return lookShown(m) === "day"; },
    startOver: startOver
  });
  placeTog();
  // rd6: an old saved setup in the classic Full layout opens in Expert (once per device a note says where it went)
  var oldFull = fullToExpert(modeState()) && !shared.firstFresh && !/[?&]expert=[01](&|$)/.test(location.search);
  if (urlOn && currentMode() !== "expert") setMode("expert");   // ?expert=1 opens Expert, also on a first visit (else the Kids view)
  paintMode();
  if (oldFull) { xLog.oldFull = true; showDenseNote(); }
  setTimeout(function () { if (active) { placeTog(); placeSheets(); fitStrip(); placeBadges(); fitNowSymbol(); } }, 60);
}
if (/[?&]test=1(&|$)/.test(location.search)) window.__xmode = { log: xLog, mode: function () { return currentMode(); }, chart: chartState, scrollSel: scrollStyleSel, pref: function () { return Object.assign({}, pref); }, keys: keysPick, setKeys: setKeys, cue: cueState };
