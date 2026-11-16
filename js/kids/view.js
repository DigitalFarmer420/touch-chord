// Kids view (the Kids redesign, "Simple" mode): its own screens on top of the shared logic.
//   Hello (its tap unlocks audio) -> Song picker (6 picture cards) -> Play (lyrics, 7 major chord pads, Play song,
//   Next, a fixed one-octave C..B piano) -> Reward when a song is finished. Settings sheet (no grown-up gate: the
//   Simple / Expert switch is in it), Daylight / Lamplight looks.
// Nothing here makes sound itself: a pad press goes through strip.js stripPress (the Kids pad path, with its hidden twin
// pad in #suggest), a piano key through touch.js soundFinger / liftFinger, a gold tap through next.js kidsGoldGo,
// Next / Play song through magic.js progNext / playback.js progPlay. So sound and timing are those of the Kids style.
import { unlock } from "../audio/unlock.js?v=112.14";
import { activeKey, keyDegrees } from "../keys.js?v=112.14";
import { KIDS_SONG_KEY } from "../songs/kids-songs.js?v=112.14";
import { KIDS_LYRICS } from "../songs/kids-songs.js?v=112.14";
import { magicQueue, progNext } from "../songs/magic.js?v=112.14";
import { magic, prog, progSet, progPlay, progStop, applySongKey, progWalkAt, progWalkTo, playButtonLabel } from "../songs/playback.js?v=112.14";
import { progLoopBar } from "../songs/song.js?v=112.14";
import { nextChange, cueSoon, cueClock, cueWord, cuePieces, placeCueTag, cueLetterClass } from "../ui/chordcue.js?v=112.14";
import { state, fingers, shared, scheduleSave } from "../state.js?v=112.14";
import { wrap12 } from "../theory/quality.js?v=112.14";
import { APP_VERSION } from "../version.js?v=112.14";
import { playAlongKeyOk, paHintMiss, paHintHide } from "../ui/hints.js?v=112.14";
import { kidsTonic, kidsKeyNow } from "../ui/keyboard.js?v=112.14";
import { kidsHintItem, kidsGoldStep, kidsGoldGo, kidsGoldPad } from "../ui/next.js?v=112.14";
import { renderPads, keyHaptic, padKey } from "../ui/pads.js?v=112.14";
import { stripPress, stripRelease } from "../ui/strip.js?v=112.14";
import { keyOf, soundFinger, liftFinger, resoundHeldFinger } from "../ui/touch.js?v=112.14";
import { api as ChordAudio } from "../audio/index.js?v=112.14";
import { makeChip, openModeSheet } from "../ui/modesheet.js?v=112.14";
import { kidsRowPlan, KIDS_ROWS, kidsPadLabel } from "./grid.js?v=112.14";
import { registerLook, lookApplyNow } from "../ui/look.js?v=112.14";

// The six Kids songs (presets.js order): picture, title for parents, short chip name.
export const KV_SONGS = {
  "Kids Twinkle": { pic: "\u2B50", title: "Twinkle Twinkle Little Star", chip: "Twinkle" },
  "Kids Old MacDonald": { pic: "\uD83D\uDC04", title: "Old MacDonald", chip: "Old MacDonald" },
  "Kids Itsy Bitsy Spider": { pic: "\uD83D\uDD77\uFE0F", title: "Itsy Bitsy Spider", chip: "Itsy Bitsy" },
  "Kids Row Your Boat": { pic: "\uD83D\uDEA3", title: "Row Your Boat", chip: "Row Your Boat" },
  "Kids Head Shoulders Knees and Toes": { pic: "\uD83D\uDE46", title: "Head, Shoulders, Knees & Toes", chip: "Head Shoulders" },
  "Kids Mary's Lamb": { pic: "\uD83D\uDC11", title: "Mary's Lamb", chip: "Mary's Lamb" }
};
const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const WHITE_PC = [0, 2, 4, 5, 7, 9, 11];
const BLACKS = [{ pc: 1, after: 1 }, { pc: 3, after: 2 }, { pc: 6, after: 4 }, { pc: 8, after: 5 }, { pc: 10, after: 6 }];   // after = white keys to its left
const TEST = /[?&]test=1(&|$)/.test(location.search);

export const kv = { on: false, screen: "hello", reward: false, endT: 0, rewardT: 0, sig: "", timer: 0, resume: null, log: [], tip: null };
var root, els = {};

function h(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
function btn(cls, html, label) { var b = h("button", cls, html); b.type = "button"; if (label) b.setAttribute("aria-label", label); return b; }
function emo(s) { return "<span class=\"kv-emo\" aria-hidden=\"true\">" + s + "</span>"; }
function songName() { var p = prog.list[prog.idx]; return p ? p.name : null; }
function meta(name) { return KV_SONGS[name] || { pic: "\uD83C\uDFB5", title: String(name || "").replace(/^Kids\s+/, ""), chip: String(name || "").replace(/^Kids\s+/, "") }; }
// rd6: the mode chip (★ Kids, top right) replaces the Kids gear; it opens the shared Settings sheet after a 1 s hold.
function chipBtn() { return makeChip("kids"); }

// ---------- build ----------
function build() {
  root = h("div", "kv"); root.id = "kv"; root.hidden = true;
  // a. Hello
  var hello = h("section", "kv-scr kv-hello"); hello.setAttribute("aria-label", "Hello");
  hello.appendChild(chipBtn());
  hello.appendChild(h("h1", "kv-title", "Touch&nbsp;Chord"));
  hello.appendChild(h("div", "kv-notes", emo("\uD83C\uDFB5\uD83C\uDFB9\uD83C\uDFB5")));
  var go = btn("kv-go", "<span class=\"kv-tri\"></span>", "Start");
  go.addEventListener("click", function () { unlock(); kv.log.push("hello"); var p = state.kidsSong && KV_SONGS[state.kidsSong] && songName() === state.kidsSong; if (p) bootResume(); show(p ? "play" : "songs"); });
  hello.appendChild(go);
  hello.appendChild(h("div", "kv-tip", emo("\uD83D\uDD08") + "<span>No sound? Turn the volume up. Touch Chord plays even with the iPhone silent switch on.</span>"));
  // b. Songs
  var songs = h("section", "kv-scr kv-songs"); songs.setAttribute("aria-label", "Songs");
  var sh = h("div", "kv-shead"); sh.appendChild(h("h2", "kv-h", emo("\uD83C\uDFB6") + " Songs")); sh.appendChild(chipBtn()); songs.appendChild(sh);
  els.cards = h("div", "kv-cards"); els.cards.setAttribute("role", "list"); songs.appendChild(els.cards);
  // c. Play
  var play = h("section", "kv-scr kv-play"); play.setAttribute("aria-label", "Play");
  var top = h("div", "kv-top");
  var home = btn("kv-home", emo("\uD83C\uDFE0"), "Songs"); home.addEventListener("click", function () { if (prog.playing || prog.paused) progStop(); hideReward(); show("songs"); });
  els.chip = h("div", "kv-chip");
  els.lyr = h("div", "kv-lyr"); els.lyr.setAttribute("aria-live", "off");
  top.appendChild(home); top.appendChild(els.chip); top.appendChild(h("span", "kv-sp")); top.appendChild(chipBtn());
  els.top = top; play.appendChild(top); play.appendChild(els.lyr);
  var mid = h("div", "kv-mid");
  els.pads = h("div", "kv-pads"); els.pads.setAttribute("role", "group"); els.pads.setAttribute("aria-label", "Seven chords");
  LETTERS.forEach(function (L, i) {
    var p = btn("kv-pad kv-c" + L, "<span class=\"kv-n\">" + L + "</span>", L + ", major chord");
    p.dataset.pc = String(WHITE_PC[i]); p.dataset.letter = L;
    wirePad(p);
    els.pads.appendChild(p);
  });
  var ctl = h("div", "kv-ctl");
  els.play = btn("kv-playbtn", "<span class=\"kv-tri\"></span>", "Play song");
  els.play.addEventListener("click", function () { unlock(); hideReward(); progPlay(); kv.log.push("play"); paint(true); });
  els.next = btn("kv-next", "<span class=\"kv-arrow\" aria-hidden=\"true\">\u279C</span>", "Next");
  els.next.addEventListener("click", onNext);
  ctl.appendChild(els.play); ctl.appendChild(els.next);
  els.ctl = ctl; mid.appendChild(els.pads); mid.appendChild(ctl); play.appendChild(mid);
  els.piano = h("div", "kv-piano"); els.piano.setAttribute("aria-label", "Piano, C to B");
  var whites = h("div", "kv-whites");
  WHITE_PC.forEach(function (pc, i) {
    var k = btn("kv-wk kv-c" + LETTERS[i], "<i aria-hidden=\"true\"></i><span class=\"kv-kl\">" + LETTERS[i] + "</span><b class=\"kv-oct\" aria-hidden=\"true\"></b>", LETTERS[i]);
    k.dataset.pc = String(pc); k.dataset.ix = String(i); wireKey(k); whites.appendChild(k);
  });
  els.piano.appendChild(whites);
  BLACKS.forEach(function (bk) {
    var k = btn("kv-bk", "<b class=\"kv-oct\" aria-hidden=\"true\"></b>", ["C sharp", "D sharp", "F sharp", "G sharp", "A sharp"][BLACKS.indexOf(bk)]);
    k.dataset.pc = String(bk.pc); k.style.left = "calc(var(--kpad) + (100% - 2 * var(--kpad)) * " + (bk.after / 7) + " - var(--bkw) / 2)";
    wireKey(k); els.piano.appendChild(k);
  });
  play.appendChild(els.piano);
  // f. Reward
  els.reward = h("div", "kv-reward"); els.reward.hidden = true;
  els.reward.appendChild(h("div", "kv-glow"));
  els.reward.appendChild(h("div", "kv-star", "\u2605"));
  var rb = h("div", "kv-rbtns");
  var again = btn("kv-again", "\u21BB", "Again"); again.addEventListener("click", function () { unlock(); hideReward(); progSet(prog.idx); paint(true); });
  els.rnext = btn("kv-next kv-rnext", "", "Next song"); els.rnext.addEventListener("click", function () { unlock(); hideReward(); pickSong((prog.idx + 1) % prog.list.length, true); });
  rb.appendChild(again); rb.appendChild(els.rnext); els.reward.appendChild(rb);
  play.appendChild(els.reward);
  hello.hidden = songs.hidden = play.hidden = true;   // rd5.1: no Kids screen shows until show() picks exactly one
  root.appendChild(hello); root.appendChild(songs); root.appendChild(play);
  els.hello = hello; els.songs = songs; els.playScr = play;
  document.body.appendChild(root);
}

function buildCards() {
  els.cards.innerHTML = "";
  prog.list.forEach(function (p, i) {
    var m = meta(p.name), last = state.kidsSong ? state.kidsSong === p.name : i === 0;
    var c = btn("kv-card" + (last ? " last" : ""), "<span class=\"kv-pic\">" + m.pic + "</span><span class=\"kv-ct\">" + m.title + "</span>" + (last ? "<span class=\"kv-last\">\u25B6 last</span>" : ""), m.title);
    c.setAttribute("role", "listitem"); c.dataset.song = p.name;
    c.addEventListener("click", function () { unlock(); pickSong(i, false); });
    els.cards.appendChild(c);
  });
  fitCards();
}
// rd17 (Uiux): the song list fills the width and, when it scrolls, the next row peeks in (js/kids/grid.js).
export function fitCards() {
  var c = els.cards, sc = els.songs;
  if (!c || !sc || sc.hidden || !c.children.length) return null;
  var de = document.documentElement, lay = ["phone-port", "phone-land", "pad-port", "pad-land"].filter(function (l) { return de.classList.contains("lay-" + l); })[0] || "phone-port";
  var cs = getComputedStyle(c), cols = cs.gridTemplateColumns.split(" ").filter(Boolean).length || 1, g = parseFloat(cs.rowGap) || 0;
  var top = c.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop;
  var plan = kidsRowPlan(sc.clientHeight - top, c.children.length, cols, g, KIDS_ROWS[lay]);
  c.style.gridAutoRows = plan.r + "px";
  kv.grid = { lay: lay, cols: cols, n: c.children.length, r: plan.r, full: plan.full, peek: plan.peek };
  return kv.grid;
}
// rd7 (Noff rd6 #4): a reload in Kids opens Hello as before; Start (or picking the same song) then resumes the saved step.
function bootResume() {
  var w = kv.bootWalk; kv.bootWalk = null;
  if (w && !w.end && w.name === songName()) { progWalkTo(w); kv.log.push("resume:" + w.t); }
}
function pickSong(i, fresh) {
  hideReward();
  if (prog.playing || prog.paused) progStop();
  if (!fresh && i === prog.idx) bootResume(); else kv.bootWalk = null;
  if (fresh || i !== prog.idx) progSet(i);
  state.kidsSong = songName(); scheduleSave();
  kv.log.push("song:" + state.kidsSong);
  show("play");
}

// ---------- settings (rd6: the shared sheet, js/ui/modesheet.js) ----------
// Start over in Kids: the grown-up factory reset, then the Kids view from Hello (as before rd6).
export function kidsStartOver() {
  document.getElementById("factoryReset").click();   // the grown-up factory reset (settings to defaults)
  state.expert = false; state.theme = "auto"; state.kidsSong = null; state.kidsWalk = null;
  lookApplyNow("kids");
  enter(true);
  scheduleSave(0);
  show("hello");
}
export function openSettings(open) { openModeSheet(!!open); }
// rd6 Look: "auto" (the clock), "day" or "lamp"; the resolved look is html.kv-lamp (js/ui/look.js).
export function setTheme(t) {
  state.theme = t === "lamp" || t === "day" ? t : "auto";
  lookApplyNow("kids");
  scheduleSave(0);
}

// ---------- mode switch (redesign-dev: one Kids / Simple / Expert switch; js/expert/ui.js setMode drives it) ----------
var modeHandler = null;   // set by js/expert/ui.js (setModeHandler(setMode)); kept as a hook so this module does not import the Expert view
export function setModeHandler(fn) { modeHandler = fn; }
// setExpert(false) = open the Kids view, setExpert(true) = leave it for the full app (settings key "expert" kept from kids-build)
export function setExpert(on) {
  on = !!on;
  if (on === !!state.expert && kv.on === !on) return;
  state.expert = on;
  if (on) leave(); else enter(false);
  scheduleSave(0);
}
function enter(boot) {
  var walked = false;   // rd5.1: a Kids song was being played in the mode we come from
  kv.on = true; shared.kidsView = true;
  document.documentElement.classList.add("kv");
  paHintHide();
  if (state.style !== "kids") {
    var w = progWalkAt(), kb = document.querySelector('#styles button[data-style="kids"]');
    if (w && /^Kids /.test(w.name)) { kv.resume = w; walked = true; }   // (else: the place saved when Simple was left)
    if (kb) kb.click();   // the style row's own Kids pick (sound preset, C major, Twinkle)
  } else if (!boot) kv.resume = null;   // still in Kids in Expert: the song is where Expert left it
  if (!boot && !kv.resume && state.kidsWalk && state.kidsWalk.name && (!state.kidsSong || state.kidsWalk.name === state.kidsSong)) kv.resume = state.kidsWalk;   // rd6 (Noff Low): the saved step survives a reload in another mode
  var want = kv.resume && kv.resume.name ? kv.resume.name : (state.kidsSong || null), ix = -1;   // rd5.1: a switch also reopens the saved Kids song (was boot-only)
  if (want) prog.list.forEach(function (p, i) { if (p.name === want) ix = i; });
  if (ix >= 0 && ix !== prog.idx) progSet(ix);
  var kept = ix >= 0 && (walked || !!state.kidsSong);   // rd5.1: a song the child played (or was playing in Simple) is kept
  if (kv.resume && ix >= 0) progWalkTo(kv.resume);   // mode switch: the song picks up where it left off
  kv.bootWalk = boot && ix >= 0 && state.kidsWalk && state.kidsWalk.name === want && !state.kidsWalk.end ? state.kidsWalk : null;   // rd7: kept for Start
  kv.resume = null;
  var sk = KIDS_SONG_KEY[songName()], ak = activeKey();
  if (sk && (!ak || ak.pc !== 0 || ak.mode !== "major")) applySongKey(sk[0], sk[1]);   // the Kids piano is C..B: the song's own key
  renderPads();   // the hidden keyboard follows the Kids view rules (one octave on the tonic)
  root.hidden = false;
  // rd5.1 (Uiux): every entry goes through show(). Opening the app = Hello; a mode switch = the kept song's play screen
  // (song, key and step kept), else the song list. Never Hello on a switch. (rd5: only boot called show(), so a switch
  // in a page that loaded in Expert / Simple left Hello, Songs and Play all showing, with a blank chip and lyrics.)
  show(boot ? "hello" : kept ? "play" : "songs");
  startPaint();
}
function leave() {
  if (kv.on && state.style === "kids") { kv.resume = progWalkAt(); saveWalk(kv.resume); }
  kv.on = false; shared.kidsView = false;
  hideReward();
  openModeSheet(false);
  document.documentElement.classList.remove("kv");
  root.hidden = true;
  stopPaint();
  renderPads();
}
function saveWalk(w) {
  if (!w || !w.name || !KV_SONGS[w.name]) return;
  var o = state.kidsWalk;
  if (o && o.name === w.name && !!o.end === !!w.end && (w.end || o.t === w.t)) return;
  state.kidsWalk = w.end ? { name: w.name, end: true } : { name: w.name, t: w.t };
  scheduleSave();
}
export function show(scr) {
  if (scr === "play" && !KV_SONGS[songName()]) scr = "songs";   // rd5.1 guard: no Kids song loaded = the song list, never a blank play screen
  kv.screen = scr; kv.sig = "";
  root.dataset.screen = scr;
  [["hello", els.hello], ["songs", els.songs], ["play", els.playScr]].forEach(function (x) { x[1].hidden = x[0] !== scr; });
  if (scr === "songs") { buildCards(); requestAnimationFrame(function () { if (kv.screen === "songs") fitCards(); }); }   // rd17: measure after layout (the first pass can run before the list has a height)
  kv.log.push("screen:" + scr);
  if (scr !== "play") { paint(true); return; }
  try { paint(true); } catch (err) { kv.log.push("play-failed"); show("songs"); return; }   // rd5.1 guard: finish the play screen or go back to the list
  if (!els.chip.textContent.trim()) { kv.log.push("play-blank"); show("songs"); return; }
  if (!els.lyr.textContent.trim()) { kv.log.push("play-nolyrics"); show("songs"); }   // rd6 (Noff Info): no blank lyrics box either
}

// ---------- input ----------
function twinPad(pc) {
  var pads = document.querySelectorAll("#suggest .ss-kidpad");
  for (var i = 0; i < pads.length; i++) if (pads[i]._tc && wrap12(pads[i]._tc.item.rootPc) === wrap12(pc)) return pads[i];
  return null;
}
function lastStepNext() { var d = !prog.playing && prog.steps.length ? magicQueue() : null; return !!(d && d.step === prog.steps.length - 1); }
function wirePad(p) {
  p.addEventListener("pointerdown", function (e) {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    var tw = twinPad(Number(p.dataset.pc));
    if (!tw) return;
    try { p.setPointerCapture(e.pointerId); } catch (err) {}
    p.classList.add("down");
    var fin = kidsGoldPad(tw) && lastStepNext();
    stripPress(tw, tw._tc.item, e);   // rd17: the twin is already the major kidTriad; gold still returns inside stripPress as the melody note
    if (fin) rewardSoon();
    paint(true);
  });
  function up(e) { p.classList.remove("down"); stripRelease(e.pointerId); paint(true); }
  p.addEventListener("pointerup", up); p.addEventListener("pointercancel", up);
  p.addEventListener("contextmenu", function (e) { e.preventDefault(); });
}
function goldMidi() {
  var it = kidsHintItem();
  if (!it) return null;
  var ak = activeKey(), k = ak ? ak.pc : 0;
  return kidsTonic() + (it.mel != null ? it.mel : wrap12(it.rootPc - k));   // the song pitch (keyboard.js kidsNatural; Octave kidsPlace = itself)
}
function keyMidi(pc) { return kidsTonic() + wrap12(pc - wrap12(kidsTonic())); }   // C..B on the Kids tonic octave (C major: C4..B4)
// rd3 (Noff rd2 Low 3): an out-of-key key is silent in the Kids view (Full Range off), the same rule paintKeyChip paints as
// "nokey" and padPlayable reads. Root cause of the first-tap chord: enter() rebuilds the hidden twin pads with renderPads(),
// which (unlike kbRebuild) does not run paintKeyChip, so the twins have no "nokey" until the first tap repaints them and the
// first out-of-key tap read as playable (C# / Bb major). The old Kids style (351c02c) paints them on load: no bug there.
function keyOutOfKey(twin, pc) {
  if (state.allKeys || (twin && twin.dataset.borrow)) return false;
  var k = activeKey() || kidsKeyNow();
  if (!k) return false;
  return !keyDegrees(k).some(function (d) { return wrap12(d.pc) === wrap12(pc); });
}
function wireKey(k) {
  k.dataset.midi = String(keyMidi(Number(k.dataset.pc)));
  k.dataset.id = "kv" + k.dataset.pc;
  k.addEventListener("pointerdown", function (e) {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    keyHaptic();
    k.dataset.midi = String(keyMidi(Number(k.dataset.pc)));
    var g = kidsGoldStep() ? goldMidi() : null;
    if (g != null && wrap12(g) === wrap12(Number(k.dataset.pc))) {   // the gold note's key (any octave: the arrow shows where it really is)
      var fin = lastStepNext();
      shared.kbKeyGo = true; shared.kbKeyStay = true;   // as a gold key tap on the grown-up keyboard
      try { kidsGoldGo(k, "key"); } finally { shared.kbKeyGo = false; }
      if (fin) rewardSoon();
      paint(true);
      return;
    }
    shared.paEvT = e.timeStamp || performance.now();
    if (!playAlongKeyOk(k)) paHintMiss("key", k);
    var needReplay = !(ChordAudio.ctx && ChordAudio.ctx.state === "running");
    var pending = unlock();
    try { k.setPointerCapture(e.pointerId); } catch (err) {}
    var twin = document.querySelector('#pads .pad[data-midi="' + k.dataset.midi + '"]');   // the hidden Kids keyboard's own key (same id, degree, in-key rule: out-of-key black keys stay silent as in the Kids style)
    var kk = twin ? padKey(twin) : keyOf(k.dataset.id, k.dataset.pc, k.dataset.midi, null, false, false);
    if (kk.playable && keyOutOfKey(twin, Number(k.dataset.pc))) kk.playable = false;   // rd3: decided from the key itself, not from the twin's "nokey" paint (unpainted on the first tap after a song opens)
    soundFinger(e.pointerId, kk);
    if (needReplay && pending && typeof pending.then === "function") pending.then(function () { resoundHeldFinger(e.pointerId); });
    paint(true);
  });
  function up(e) { if (fingers[e.pointerId]) liftFinger(e.pointerId); paint(true); }   // (pads.js also lifts on window pointerup)
  k.addEventListener("pointerup", up); k.addEventListener("pointercancel", up);
  k.addEventListener("contextmenu", function (e) { e.preventDefault(); });
}
function onNext() {
  unlock();
  var fin = lastStepNext();
  hideReward();
  progNext();
  kv.log.push("next");
  if (fin) rewardSoon();
  paint(true);
}

// ---------- reward ----------
function rewardSoon() {
  clearTimeout(kv.rewardT);
  var st = prog.steps[prog.steps.length - 1], ms = Math.min(900, Math.max(250, (st ? st.bars : 0.5) * progLoopBar() * 1000 * 0.6));
  kv.rewardT = setTimeout(showReward, ms);
}
export function showReward() {
  kv.rewardT = 0;
  if (!kv.on) return;
  var n = prog.list.length, nx = n ? prog.list[(prog.idx + 1) % n] : null;
  els.rnext.innerHTML = emo(nx ? meta(nx.name).pic : "") + "<span class=\"kv-arrow\" aria-hidden=\"true\">\u279C</span>";
  els.rnext.setAttribute("aria-label", "Next song: " + (nx ? meta(nx.name).title : ""));
  kv.reward = true; els.reward.hidden = false; els.playScr.classList.add("rewarding");
  els.reward.classList.remove("pop"); void els.reward.offsetWidth; els.reward.classList.add("pop");
  kv.log.push("reward:" + songName());
}
function hideReward() {
  clearTimeout(kv.rewardT); kv.rewardT = 0; clearTimeout(kv.endT); kv.endT = 0;
  if (!kv.reward) return;
  kv.reward = false; els.reward.hidden = true; els.playScr.classList.remove("rewarding");
}

// ---------- paint ----------
// v3.2 test.5: the next-chord cue. Each Kids step is one sung note on its own major chord (the pad letter), so the cue
// marks the word where the pad changes: a gold underline and the pad letter above it, brighter one beat before the
// change (Play song) or when it is the very next note (taps: no beat timing). Shown lines only (sideways: one line).
export const kvCue = { j: -1, chord: null, soon: false, cur: -2, t: 0, log: [] };
function padName(st) {
  var it = st && (st.item || st), pc = it && it.rootPc != null ? wrap12(it.rootPc) : null, i = pc == null ? -1 : WHITE_PC.indexOf(pc);
  return i >= 0 ? LETTERS[i] : pc == null ? "" : ["C", "C\u266F", "D", "E\u266D", "E", "F", "F\u266F", "G", "A\u266D", "A", "B\u266D", "B"][pc];
}
function kidsCue(L, cur, li, rows) {
  var names = prog.steps.map(padName), j = nextChange(names, cur);
  if (j < 0 || !names[j]) return null;
  for (var r = 0; r < rows; r++) {
    var ln = L[li + r]; if (!ln) break;
    for (var k = 0; k < ln.markers.length; k++) if (ln.markers[k].chordIndex === j) {
      var w = cueWord(ln.text, ln.markers[k].charIndex, function (c) { return /[A-Za-z\u00C0-\u024F'\u2019]/.test(c); });
      return w ? { j: j, r: r, a: w[0], b: w[1], chord: names[j] } : null;
    }
  }
  return null;   // the change is on a line not shown yet
}
function lyrHtml() {
  var L = KIDS_LYRICS[songName()];
  kvCue.j = -1; kvCue.chord = null;
  if (!L || !L.length) return "";
  var cur = prog.cur >= 0 ? prog.cur : (magic ? magic.pos - 1 : -1), li = 0;
  if (cur >= prog.steps.length) cur = prog.steps.length - 1;
  if (cur >= 0) L.forEach(function (ln, i) { if (ln.markers.some(function (m) { return m.chordIndex <= cur; })) li = i; });
  function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
  var land = document.documentElement.classList.contains("lay-phone-land");   // sideways: the next line is hidden
  var cue = kidsCue(L, cur, li, land ? 1 : 2);
  if (cue) cue.cls = cueLetterClass(cue.chord);
  // test.5 crowding fix: phones keep a band above each line for the letter (kids.css); an iPad's big lines leave no
  // room for one, so there the letter is inline, right of its word.
  var inl = document.documentElement.classList.contains("lay-pad-port") || document.documentElement.classList.contains("lay-pad-land");
  function paintRange(segs, R) {   // segs [{a, b, cls}] covering the line; the cue word gets "cue" on top
    var out = "";
    segs.forEach(function (sg) {
      if (sg.b <= sg.a) return;
      var rg = [];
      if (cue && cue.r === R.i) { var a = Math.max(sg.a, cue.a), b = Math.min(sg.b, cue.b); if (b > a) rg.push({ a: a - sg.a, b: b - sg.a, cls: "cue" }); }
      cuePieces(R.t.slice(sg.a, sg.b), rg).forEach(function (p) { var c = (sg.cls + " " + p.cls).trim(); out += c ? "<span class=\"" + c + "\">" + esc(p.t) + "</span>" : esc(p.t);
        if (inl && p.cls === "cue" && sg.b >= cue.b) out += "<span class=\"kv-cuetag kv-cuein" + (cue.cls ? " " + cue.cls : "") + "\" aria-hidden=\"true\">" + esc(cue.chord) + "</span>"; });
    });
    return out;
  }
  function line(ln) {   // sung words solid, the current word (whole word, even when the note is its 2nd syllable) on gold, the rest faint
    var t = ln.text, mk = ln.markers, m = null;
    mk.forEach(function (x) { if (x.chordIndex === cur) m = x; });
    if (!m) return paintRange([{ a: 0, b: t.length, cls: cur >= mk[mk.length - 1].chordIndex ? "done" : "w" }], { t: t, i: 0 });
    var Lr = /[A-Za-z\u00C0-\u024F'\u2019-]/, ws = m.charIndex, we = m.charIndex;
    while (ws > 0 && Lr.test(t.charAt(ws - 1)) && t.charAt(ws - 1) !== "-") ws--;
    while (we < t.length && Lr.test(t.charAt(we)) && t.charAt(we) !== "-") we++;
    if (cue && cue.r === 0 && cue.a < we && cue.b > ws) cue = null;   // never on the gold (sung) word itself
    return paintRange([{ a: 0, b: ws, cls: "done" }, { a: ws, b: we, cls: "now" }, { a: we, b: t.length, cls: "w" }], { t: t, i: 0 });
  }
  var l1 = line(L[li]);
  var l2 = L[li + 1] ? paintRange([{ a: 0, b: L[li + 1].text.length, cls: "" }], { t: L[li + 1].text, i: 1 }) : "&nbsp;";
  if (cue) { kvCue.j = cue.j; kvCue.chord = cue.chord; }
  return "<div class=\"kv-l1\" data-cue-row>" + l1 + "</div><div class=\"kv-l2\" data-cue-row>" + l2 + "</div>"
    + (cue && !inl ? "<span class=\"kv-cuetag" + (cue.cls ? " " + cue.cls : "") + "\" aria-hidden=\"true\" hidden>" + esc(cue.chord) + "</span>" : "");
}
function kidsCueSoon() {
  if (kvCue.j < 0) return false;
  var cur = prog.cur >= 0 ? prog.cur : (magic ? magic.pos - 1 : -1);
  return cueSoon({ j: kvCue.j, cur: cur, playing: !!prog.playing, bars: prog.steps.map(function (s) { return s.bars; }), barSec: progLoopBar(), bpb: 4,
    since: cueClock(kvCue, cur, performance.now()) });
}
function paintKidsCue(soon) {
  var w = els.lyr.querySelectorAll(".cue"), tag = els.lyr.querySelector(".kv-cuetag");
  Array.prototype.forEach.call(w, function (e) { e.classList.toggle("soon", soon); });
  if (tag) tag.classList.toggle("soon", soon);
  if (soon !== kvCue.soon) { kvCue.log.push({ j: kvCue.j, soon: soon, playing: !!prog.playing }); if (kvCue.log.length > 200) kvCue.log.shift(); }
  kvCue.soon = soon;
  placeCueTag(els.lyr, w[0] || null, tag, els.lyr.querySelector(".kv-l1 .now"));
}
function layoutSlots() {   // phone landscape: the lyric line moves into the top bar
  var de = document.documentElement, land = de.classList.contains("lay-phone-land");
  var sp = els.top.querySelector(".kv-sp");
  if (land) { if (els.lyr.parentNode !== els.top) els.top.insertBefore(els.lyr, sp); }
  else if (els.lyr.parentNode !== els.playScr) els.playScr.insertBefore(els.lyr, els.top.nextSibling);
}
export function paint(force) {
  if (!kv.on || !root) return;
  layoutSlots();
  // Play song: one pass in the Kids view, then the reward (stops where the next pass would begin)
  if (prog.playing && kv.screen === "play" && prog.cur === prog.steps.length - 1 && !kv.endT && prog.steps.length) {
    var st = prog.steps[prog.cur];
    kv.endT = setTimeout(function () { kv.endT = 0; if (prog.playing) progStop(); showReward(); }, Math.max(0, st.bars * progLoopBar() * 1000 - 30));
  } else if (!prog.playing && kv.endT) { clearTimeout(kv.endT); kv.endT = 0; }
  var g = goldMidi(), lo = keyMidi(0), paOff = state.playAlong === false;
  var gi = kidsHintItem(), goldPad = gi ? wrap12(gi.rootPc) : null;
  var lit = {};
  Object.keys(fingers).forEach(function (id) { (fingers[id].midis || []).forEach(function (m) { lit[m] = 1; }); });
  if (shared.suggestPreview && shared.suggestPreview.midis) Object.keys(shared.suggestPreview.midis).forEach(function (m) { lit[m] = 1; });
  var name = songName();
  if (kv.screen === "play" && name && KV_SONGS[name] && state.kidsSong !== name) { state.kidsSong = name; scheduleSave(); }   // Hello opens the last song played
  if (kv.screen === "play" && name && KV_SONGS[name]) saveWalk(progWalkAt());   // rd6: the step is saved with the song
  var cueOn = kidsCueSoon();   // v3.2 test.5: the cue brightens by time while Play runs
  var sig = [kv.screen, name, prog.cur, magic ? magic.pos : -1, prog.playing, g, goldPad, paOff, Object.keys(lit).join(","), state.theme, kv.reward, cueOn].join("|");
  if (!force && sig === kv.sig) return;
  kv.sig = sig;
  root.classList.toggle("pa-off", paOff);
  // Keep Play's label current even after Home leaves the play screen (paused -> idle = "Play song").
  els.play.classList.toggle("on", !!prog.playing);
  var kl = playButtonLabel();
  els.play.removeAttribute("aria-pressed");
  els.play.setAttribute("aria-label", kl.aria);
  els.play.title = kl.title;
  if (kv.screen !== "play") return;
  var m = meta(name);
  els.chip.innerHTML = "<span class=\"kv-pic\">" + m.pic + "</span><span class=\"kv-cn\">" + m.chip + "</span>";
  var lh = lyrHtml(); if (els.lyr._h !== lh) { els.lyr.innerHTML = lh; els.lyr._h = lh; }
  paintKidsCue(kidsCueSoon());
  var goldNote = !!kidsGoldStep();   // the gold pad plays the single song note only while play-along waits for it
  Array.prototype.forEach.call(els.pads.children, function (p) {
    var gold = goldPad != null && Number(p.dataset.pc) === goldPad;
    p.classList.toggle("gold", gold);
    p.setAttribute("aria-label", kidsPadLabel(p.dataset.letter, gold && !paOff && goldNote));
  });
  Array.prototype.forEach.call(els.piano.querySelectorAll(".kv-wk, .kv-bk"), function (k) {
    var midi = keyMidi(Number(k.dataset.pc)), gold = g != null && wrap12(g) === wrap12(midi);
    k.dataset.midi = String(midi);
    k.classList.toggle("gold", gold);
    var dir = gold ? (g > lo + 11 ? "up" : g < lo ? "down" : "") : "";
    k.classList.toggle("oct-up", dir === "up"); k.classList.toggle("oct-down", dir === "down");
    k.querySelector(".kv-oct").textContent = dir === "up" ? "\u25B2" : dir === "down" ? "\u25BC" : "";
    k.classList.toggle("lit", !!lit[midi]);
  });
  // Play stays ▶ while a song plays (never ■ Stop), at every size. Label already set above.
}
function startPaint() { if (!kv.timer) kv.timer = setInterval(function () { paint(false); }, 50); }
function stopPaint() { if (kv.timer) { clearInterval(kv.timer); kv.timer = 0; } }

// Boot: after the saved settings and the first render (main.js boot).
export function boot() {
  build();
  registerLook("kids", function () { return state.theme; }, function (l) { document.documentElement.classList.toggle("kv-lamp", l === "lamp"); });
  window.addEventListener("resize", function () { paint(true); if (kv.on && kv.screen === "songs") fitCards(); });
  if (!state.expert) enter(true);
  if (TEST) window.__kv = { kv: kv, show: show, setExpert: setExpert, setTheme: setTheme, paint: paint, reward: showReward, gold: goldMidi, songs: function () { return prog.list.map(function (p) { return p.name; }); }, fitCards: fitCards, cue: function () { var w = els.lyr.querySelector('.cue'), t = els.lyr.querySelector('.kv-cuetag'); return { j: kvCue.j, chord: kvCue.chord, word: w ? w.textContent : null, row: w ? (w.closest('.kv-l1') ? 0 : 1) : -1, soon: !!(w && w.classList.contains('soon')), tagShown: !!(t && !t.hidden), log: kvCue.log.slice(-40) }; } };
}
