// The progression player: walk, Play song, step state, song key, progSet.
import { api as ChordAudio } from "../audio/index.js?v=2026.11.27.16";
import { unlock } from "../audio/unlock.js?v=2026.11.27.16";
import { activeKey, namePc, keyRootName, setKeySpell } from "../keys.js?v=2026.11.27.16";
import { stopPlayback } from "../loop.js?v=2026.11.27.16";
import { KIDS_SONG_KEY } from "./kids-songs.js?v=2026.11.27.16";
import { upSave } from "./library.js?v=2026.11.27.16";
import { magicReset, progBadge } from "./magic.js?v=2026.11.27.16";
import { PROG_BAR, PROGRESSIONS, progList, progSteps, sameChord, progIndexFor } from "./presets.js?v=2026.11.27.16";
import { progHold, progLockPick } from "./proghold.js?v=2026.11.27.16";
import { upInList, songTempo, paintUpNext, progLoopBar, upKeyApply, upKeyNow } from "./song.js?v=2026.11.27.16";
import { state, loop, scheduleSave, shared } from "../state.js?v=2026.11.27.16";
import { wrap12 } from "../theory/quality.js?v=2026.11.27.16";
import { paHintHide } from "../ui/hints.js?v=2026.11.27.16";
import { kbSound, kidsSoloSpec, kbScheduleReset } from "../ui/keyboard.js?v=2026.11.27.16";
import { paintNextHint, paintProgActive, magicHintClear } from "../ui/next.js?v=2026.11.27.16";
import { updateSymbol } from "../ui/nowbox.js?v=2026.11.27.16";
import { computeSpec, renderPads, highlightMidisFromSpec, PERCUSSIVE_SOUNDS, refreshHeld } from "../ui/pads.js?v=2026.11.27.16";
import { paintProg } from "../ui/progbar.js?v=2026.11.27.16";
import { fxStepPulse } from "../ui/pulse.js?v=2026.11.27.16";
import { clearSuggestPreview, STRIP_EXT, PREVIEW_MS, stripKey, applySuggestion, prettyAcc, stripLabel, wireStripTap, paintSuggestions, fitStrip } from "../ui/strip.js?v=2026.11.27.16";
import { layoutSongGrid } from "../ui/songgrid.js?v=2026.11.27.16";
import { BADGE_SLOTS, badgeCenter, badgeInset } from "../ui/badgeslots.js?v=2026.11.27.16";
import { sustainPool } from "../ui/sustain.js?v=2026.11.27.16";
import { songIdentity, worldIdentity, resumeRule, barOffset, sameSong } from "./transport-policy.js?v=2026.11.27.16";

export const prog = { style: null, mode: null, keySig: null, key: null, idx: 0, list: [], steps: [], targets: [], badges: [], badgeOverflow: [], badgeReport: null,
  cur: -1, playing: false, paused: false, pauseSnap: null, walkHome: null, playTapAt: 0, timer: 0, si: 0, nextT: 0, groups: [], gid: 0, uiT: [], flashT: 0, log: [], tmp: 0, unplaced: 0, model: null,
  lock: false, lockPick: null };   // Expert progression lock (session only, not saved)
// Test hooks only with ?test=1 (not in normal use).
export var PROG_TEST;
// v68: magic Next (state; logic after progNext).
export var magic;

// v111 (D5): the walk position as a time in the song (bars from the start), and back to a step.
export function progWalkAt() {
  var p = prog.list[prog.idx], n = prog.steps.length;
  if (!p || !n || typeof magic === "undefined" || !magic) return null;
  var i = prog.playing ? (prog.cur >= 0 ? prog.cur : prog.si % n) : magic.pos;
  if (i >= n) return { name: p.name, end: true };
  var t = 0;
  for (var k = 0; k < i; k++) t += prog.steps[k].bars || 1;
  return { name: p.name, t: t };
}
export function progWalkTo(w) {
  var p = prog.list[prog.idx], n = prog.steps.length;
  if (!w || !p || p.name !== w.name || !n) return;
  var pos = n, t = 0;
  if (!w.end) for (var k = 0; k < n; k++) { var b = prog.steps[k].bars || 1; if (w.t < t + b - 1e-6) { pos = k; break; } t += b; }
  magic.pos = pos;
  magic.last = pos > 0 ? prog.steps[pos - 1].item : null;
  magic.next = null;
  if (PROG_TEST) magic.log.push({ walkTo: pos, t: w.t, end: !!w.end });
  paintNextHint();
  if (typeof paintUpNext === "function") paintUpNext();
  paintProg();
}
// Called when the strip is rebuilt: a style change goes back to the style's first
// progression; a key or style change stops the progression loop.
export function progSync(key) {
  var sig = key.pc + key.mode + keyRootName(key);
  var styleChanged = prog.style !== null && prog.style !== state.style;
  var keyChanged = prog.keySig !== null && prog.keySig !== sig;
  if ((styleChanged || keyChanged) && prog.playing) progStop();   // paused: keep the snapshot so resume can replay the step in the new sound
  var prevSong = songIdentity(prog), wasPaused = !!prog.paused, keepCur = prog.cur | 0;
  var oldName = prog.list[prog.idx] ? prog.list[prog.idx].name : null;
  var wasUp = !!(prog.list[prog.idx] && prog.list[prog.idx].up);   // Upload: a style change keeps the song
  var oldRow = prog.list[prog.idx];
  // Expert progression lock: the chosen sequence stays through a style (or key) change, voiced in the new style.
  // Not in Kids or Simple, and never for a loaded song (the song has its own Lock).
  var held = prog.lock && document.documentElement.classList.contains("expert") && state.style !== "kids";
  if (held && prog.style !== "kids") prog.lockPick = progLockPick(oldRow, prog.style) || prog.lockPick;
  prog.list = progList(state.style, key.mode);
  // A loaded song stays on the song route. A factory name that is no longer on the
  // menu (held chart, or no chart in this mode) cannot stay selected: the label,
  // the steps and the next chord all come from the visible row, or the first one.
  if (wasUp) {
    for (var uj = 0; uj < prog.list.length; uj++) if (prog.list[uj].up) prog.idx = uj;
  } else if (held && prog.lockPick) {
    var hk = progHold(prog.list, prog.lockPick);
    prog.list = hk.list; prog.idx = hk.idx;
  } else if (oldRow && oldRow.held && !styleChanged && !keyChanged) {
    var hr = progHold(prog.list, oldRow);   // unlocked: a held row stays until the next style or key change
    prog.list = hr.list; prog.idx = hr.idx;
  } else if (styleChanged) {
    prog.idx = 0;
  } else if (oldName) {
    prog.idx = progIndexFor(prog.list, oldName);
  }
  if (prog.idx >= prog.list.length) prog.idx = 0;
  if (shared.U && shared.U.locked && prog.list[prog.idx] && prog.list[prog.idx].up) {   // v73 Lock: the key change is the transpose target
    var lk0 = shared.U.liveKey, nk = { tonic: keyRootName(key), mode: key.mode };
    if (!lk0 || lk0.tonic !== nk.tonic || lk0.mode !== nk.mode) { shared.U.liveKey = nk; upSave(); }
  }
  prog.style = state.style; prog.mode = key.mode; prog.keySig = sig; prog.key = key;
  // B2: paused on the same song (stable name+source, not list index): keep the step, Next walk and highlight.
  if (wasPaused && sameSong(prevSong, songIdentity(prog))) {
    var keepRow = prog.list[prog.idx];
    if (keepRow) prog.steps = progSteps(key, keepRow);
    if (keepCur >= 0 && keepCur < prog.steps.length) {
      prog.cur = keepCur;
      walkFollow(prog.cur);
    } else {
      prog.cur = -1;
      magicReset();
    }
  } else {
    if (wasPaused) progStop();   // N22: paused, and the style change swapped the song: the paused step is gone (Play song, step 1)
    prog.cur = -1;
    magicReset();   // v68: key / mode / style change: the walk starts again
  }
  // v109: Kids has no minor songs: a minor key (Minor tap, an old saved minor Kids song) goes back to the
  // picked song's own key, or Twinkle's (C major) when the name is unknown.
  if (state.style === "kids" && key.mode === "minor" && !PROGRESSIONS.kids.minor.length && !kidsKeyFixT) {
    kidsKeyFixT = setTimeout(function () {
      kidsKeyFixT = 0;
      if (state.style !== "kids" || !prog.key || prog.key.mode !== "minor") return;
      var cur = prog.list[prog.idx], sk = (cur && KIDS_SONG_KEY[cur.name]) || KIDS_SONG_KEY["Kids Twinkle"];
      if (!cur || !KIDS_SONG_KEY[cur.name]) { prog.idx = 0; }
      applySongKey(sk[0], sk[1]);
    }, 0);
  }
}
var kidsKeyFixT;

// Badges (1, 2, 3...) on the chips / notes that play each step; a step chord that is not on
// the strip gets a temporary dashed chip in its root's column (or half column).
export function progDecorate(el, model) {
  prog.model = model;
  Array.prototype.forEach.call(el.querySelectorAll(".pg-badge, .ss-chip.tmp"), function (n) { n.parentNode.removeChild(n); });
  prog.targets = []; prog.badges = []; prog.badgeOverflow = []; prog.badgeReport = null; prog.tmp = 0; prog.unplaced = 0;
  var p = prog.list[prog.idx];
  prog.steps = p ? progSteps(model.key, p) : [];
  magic.next = null;   // v68: the queued chord is recomputed against the new strip
  var ROWN = { bright: "b", happy: "h", scale: "n", sad: "s", tension: "t" };
  var PARTNER = { bright: "happy", happy: "bright", sad: "tension", tension: "sad" };
  var chipEls = Array.prototype.slice.call(el.querySelectorAll(".ss-chip"));
  var noteEls = Array.prototype.slice.call(el.querySelectorAll(".ss-note"));
  var occ = model.chips.map(function (c) { return { row: c.row, hc: c.hc }; });
  function free(row, hc) { return !occ.some(function (o) { return o.row === row && Math.abs(o.hc - hc) < 2; }); }
  var groups = [];   // { el, steps: [i...] }
  prog.steps.forEach(function (s, i) {
    for (var g = 0; g < groups.length; g++) {
      if (sameChord(groups[g].item, s.item)) { groups[g].steps.push(i); prog.targets[i] = groups[g].el; return; }
    }
    var tgt = null;
    for (var c = 0; c < chipEls.length && !tgt; c++) if (sameChord(chipEls[c]._tc && chipEls[c]._tc.item, s.item)) tgt = chipEls[c];
    for (var n = 0; n < noteEls.length && !tgt; n++) if (sameChord(noteEls[n]._tc && noteEls[n]._tc.item, s.item)) tgt = noteEls[n];
    if (!tgt) {
      var order = [s.row, PARTNER[s.row]].concat(["happy", "bright", "sad", "tension"].filter(function (r) { return r !== s.row && r !== PARTNER[s.row]; }));
      var row = null, hc = s.hc;
      for (var o = 0; o < order.length; o++) if (free(order[o], s.hc)) { row = order[o]; break; }
      for (var dh = 1; !row && dh <= 14; dh++) {   // v111 (D1): never on top of another chip; the nearest free column
        for (var sg = -1; sg <= 1 && !row; sg += 2) {
          var h2 = s.hc + sg * dh;
          if (h2 < 0 || h2 > 14) continue;
          for (var o2 = 0; o2 < order.length; o2++) if (free(order[o2], h2)) { row = order[o2]; hc = h2; break; }
        }
      }
      if (!row) { row = s.row; prog.unplaced++; }
      occ.push({ row: row, hc: hc });
      var cls = s.row === "bright" ? "color" : s.row === "happy" ? "major" : s.row === "sad" ? "minor" : "tension";
      var b = document.createElement("button");
      b.type = "button";
      b.className = "ss-chip tmp borrowed " + cls + " r-" + ROWN[row] + (hc % 2 === 0 ? " half" : "");
      b.style.gridRow = ROWN[row];
      b.style.gridColumn = (2 + hc) + " / span 2";
      var lab = stripLabel(s.item), rn = prettyAcc(s.item.rootName);
      b.innerHTML = "<span class=\"nm\"><span class=\"r\"></span><span class=\"q\"></span></span><span class=\"rn\"></span>";
      b.querySelector(".r").textContent = rn;
      b.querySelector(".q").textContent = lab.slice(rn.length);
      b.querySelector(".rn").textContent = s.rn;
      if (lab.length - rn.length >= 5) b.classList.add("long");
      b.setAttribute("aria-label", lab + (state.simple ? "" : ", " + s.roman) + " (progression chord, not on the strip)");
      b._tc = { item: s.item, hc: hc, row: row };
      wireStripTap(b, s.item);
      el.appendChild(b);
      prog.tmp++;
      tgt = b;
    }
    groups.push({ el: tgt, item: s.item, steps: [i] });
    prog.targets[i] = tgt;
  });
  el.classList.toggle("gutl", occ.some(function (o) { return o.hc === 0; }));
  el.classList.toggle("gutr", occ.some(function (o) { return o.hc === 14; }));
  // v60: order badges only with Config > Progression numbers on (both modes; off by default).
  if (state.progNums) {
    groups.forEach(function (g) {
      // One badge per actual step. Slot 0 is the first time this chord plays, not the label "1".
      g.steps.forEach(function (step, ord) {
        var n = step + 1, slot = ord < BADGE_SLOTS.length ? BADGE_SLOTS[ord] : "over";
        var bd = document.createElement("span");
        bd.className = "pg-badge" + (g.el.classList.contains("ss-note") ? " on-note" : "") + (n >= 10 ? " dd" : "") + " slot-" + slot;
        bd.dataset.step = String(n); bd.dataset.slot = slot; bd.dataset.ord = String(ord);
        bd.textContent = String(n);
        bd.setAttribute("role", "button");
        bd.setAttribute("aria-label", "Progression step " + n);
        bd.title = "Step " + n;
        bd.addEventListener("pointerdown", function (e) { e.preventDefault(); e.stopPropagation(); progBadge([step]); });
        bd.addEventListener("click", function (e) { e.stopPropagation(); });
        el.appendChild(bd);
        prog.badges.push({ el: bd, target: g.el, steps: [step], n: n, ord: ord, slot: slot });
      });
      if (g.steps.length > BADGE_SLOTS.length) prog.badgeOverflow.push({ steps: g.steps.map(function (i) { return i + 1; }) });
    });
  }
  paintProgActive();
  layoutSongGrid(el);
}
// Each step number sits on its own border slot (badgeslots.js). The old "1·5" / "3+4" fold is gone:
// a chord that plays at steps 1, 5 and 9 shows those three numbers, in that order, on TL, TR, BR.
// v56: badges sit just OUTSIDE their chip, on a corner or edge, never on any chord name,
// numeral or note name: each badge takes the first spot (corners, then along the edges) that
// covers no text, stays inside the panel and misses the other badges.
var badgeAvoid = null;   // Expert redesign (rd2): extra boxes a badge should not sit on (the other chips' tiles); set by js/expert/ui.js, none in the classic app
export function setBadgeAvoid(fn) { badgeAvoid = fn; }
export function placeBadges() {
  var el = document.getElementById("suggest");
  if (!el || !prog.badges.length) return;
  var sr = el.getBoundingClientRect();
  function ov(a, b) {
    var w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    return w > 0 && h > 0 ? w * h : 0;
  }
  var names = [];
  Array.prototype.forEach.call(el.querySelectorAll(".ss-chip .nm, .ss-note .nn"), function (n) {
    if (!n.textContent || getComputedStyle(n).display === "none") return;
    var q = n.getBoundingClientRect();
    if (q.width > 0 && q.height > 0) names.push({ el: n, left: q.left, top: q.top, right: q.right, bottom: q.bottom });
  });
  function layout() {
    prog.badges.forEach(function (b) {
      if (b.n != null) b.el.textContent = String(b.n);
      var t = b.target.getBoundingClientRect();
      var bq = b.el.getBoundingClientRect();
      var bw = bq.width || 16, bh = bq.height || 16;
      var box = { left: t.left, top: t.top, width: t.width, height: t.height };
      var c = badgeCenter(box, b.ord || 0, bw, bh);
      // Expert only: a wide gutter was shrinking the chip's own hit box. Keep the chip
      // at its normal margin and slide a badge inward on X when it would cross the gutter.
      if (document.documentElement.classList.contains("expert") && !c.ring) {
        var gap = parseFloat(getComputedStyle(el).getPropertyValue("--ss-cgap")) || 0;
        c = badgeInset(c, box, bw, bh, gap);
      }
      b.el.style.left = Math.round(c.x - bw / 2 - sr.left) + "px";
      b.el.style.top = Math.round(c.y - bh / 2 - sr.top) + "px";
    });
  }
  layout();   // second pass uses the badge's real width (a double-digit step is wider than the first measure)
  layout();
  // Rounding can leave a 1px graze. Nudge the outer badge toward its own chip, never the label.
  if (document.documentElement.classList.contains("expert")) {
    var namesNow = [];
    Array.prototype.forEach.call(el.querySelectorAll(".ss-chip .nm, .ss-note .nn"), function (n) {
      if (!n.textContent || getComputedStyle(n).display === "none") return;
      var q = n.getBoundingClientRect();
      if (q.width > 0 && q.height > 0) namesNow.push(q);
    });
    function nameArea(rect, target) {
      var a = 0;
      namesNow.forEach(function (n) {
        if (n.left < target.left - 1 || n.right > target.right + 1) return;
        var w = Math.min(rect.right, n.right) - Math.max(rect.left, n.left);
        var h = Math.min(rect.bottom, n.bottom) - Math.max(rect.top, n.top);
        if (w > 0 && h > 0) a += w * h;
      });
      return a;
    }
    for (var pass = 0; pass < 4; pass++) {
      var moved = false;
      for (var i = 0; i < prog.badges.length; i++) {
        for (var j = i + 1; j < prog.badges.length; j++) {
          var A = prog.badges[i], B = prog.badges[j];
          if ((A.ord || 0) >= 8 || (B.ord || 0) >= 8) continue;
          var ra = A.el.getBoundingClientRect(), rb = B.el.getBoundingClientRect();
          var iw = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
          var ih = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
          if (iw <= 1 || ih <= 1) continue;
          var pick = A, horiz = iw <= ih;
          var ac = A.target.getBoundingClientRect(), bc = B.target.getBoundingClientRect();
          var ad = Math.abs((ra.left + ra.width / 2) - (ac.left + ac.width / 2));
          var bd = Math.abs((rb.left + rb.width / 2) - (bc.left + bc.width / 2));
          if (bd > ad) pick = B;
          var chip = pick.target.getBoundingClientRect();
          var q = pick.el.getBoundingClientRect();
          var dir = horiz
            ? Math.sign((chip.left + chip.width / 2) - (q.left + q.width / 2))
            : Math.sign((chip.top + chip.height / 2) - (q.top + q.height / 2));
          if (!dir) continue;
          var prop = horiz ? "left" : "top";
          var prev = pick.el.style[prop];
          pick.el.style[prop] = (parseFloat(prev) + dir) + "px";
          var nxt = pick.el.getBoundingClientRect();
          if (nameArea(nxt, chip) > nameArea(q, chip) + 1) { pick.el.style[prop] = prev; continue; }
          moved = true;
        }
      }
      if (!moved) break;
    }
  }
  var placed = [], collisions = [], nameHits = [];
  prog.badges.forEach(function (b) {
    var t = b.target.getBoundingClientRect(), q = b.el.getBoundingClientRect();
    var r = { left: q.left, top: q.top, right: q.right, bottom: q.bottom };
    placed.forEach(function (o) { var a = ov(r, o.r); if (a > 1) collisions.push({ a: o.n, b: b.n, area: Math.round(a) }); });
    names.forEach(function (n) {
      if (!b.target.contains(n.el)) return;
      var a = ov(r, n);
      if (a > 1) nameHits.push({ step: b.n, slot: b.slot, area: Math.round(a) });
    });
    placed.push({ n: b.n, r: r, target: t });
  });
  prog.badgeReport = { overflow: prog.badgeOverflow.slice(), collisions: collisions, nameHits: nameHits };
}
export function progRedecorate() {
  var el = document.getElementById("suggest");
  if (!el || !prog.model) return;
  progDecorate(el, prog.model);
  fitStrip();
  paintNextHint();
}

export function progLockKey() {
  if (!activeKey() && stripKey) shared.lockKey = { pc: stripKey.pc, mode: stripKey.mode };
}
// Manual step (Next button / badge): play one step like a chip tap, lit while it rings.
function progJump(i) {
  if (!prog.steps.length) return;
  progStop();
  progLockKey();
  prog.cur = ((i % prog.steps.length) + prog.steps.length) % prog.steps.length;
  applySuggestion(prog.steps[prog.cur].item);
  paintProgActive();
  fxStepPulse();   // v93
  if (prog.flashT) clearTimeout(prog.flashT);
  prog.flashT = setTimeout(function () {
    prog.flashT = 0;
    if (!prog.playing) Array.prototype.forEach.call(document.querySelectorAll("#suggest .pg-on"), function (n) { n.classList.remove("pg-on"); });
  }, PREVIEW_MS);
  paintProg();
}

// v111: where Play starts: the Next walk position, or step 0 when the walk is at / after the end
export function progPlayStart() { var n = prog.steps.length, p = magic ? magic.pos | 0 : 0; return p > 0 && p < n ? p : 0; }

export function transportLabel() {
  if (prog.playing) return "playing";
  if (prog.paused) return "paused";
  return "idle";
}

// Play button label and title for each transport state (Kids, Simple and Expert use the same words).
export function playButtonLabel(st) {
  st = st || transportLabel();
  if (st === "playing") return { aria: "Pause", title: "Pause" };
  if (st === "paused") return { aria: "Resume", title: "Resume" };
  return { aria: "Play song", title: "Play song: the whole song / progression, over and over" };
}

// N15: while Play song is playing or paused, the Next walk follows the play position, so Next
// (and the next-chord hint) means "the step after the one that is sounding / paused".
// The walk from before Play (walkHome) comes back on Stop, so Pause, Stop, Play still starts
// where it did before Play.
function walkFollow(cur) {
  if (!magic) return;
  var n = prog.steps.length;
  if (!n || cur == null || cur < 0) return;
  magic.pos = Math.min(n, cur + 1);
  magic.last = prog.steps[Math.min(cur, n - 1)].item;
  magic.next = null;
}
export function progWalkFollow(cur) { walkFollow(cur); }

function emitTransport() {
  if (typeof window === "undefined" || !window.dispatchEvent) return;
  try { window.dispatchEvent(new CustomEvent("tc:transport", { detail: { state: transportLabel() } })); } catch (err) {}
}

function currentLyricLine() {
  try { if (shared && shared.lyrK != null) return shared.lyrK; } catch (err) {}
  return prog.cur;
}

export function getTransportState() {
  var ctx = ChordAudio && ChordAudio.ctx;
  var snap = prog.pauseSnap;
  return {
    state: transportLabel(),
    playing: !!prog.playing,
    paused: !!prog.paused,
    si: prog.si | 0,
    cur: prog.cur,
    nextT: prog.nextT || 0,
    offset: snap ? snap.offset : 0,
    remaining: snap ? snap.remaining : 0,
    lyricLine: snap ? snap.lyricLine : currentLyricLine(),
    stepCount: prog.steps ? prog.steps.length : 0,
    ctxState: ctx ? ctx.state : null,
    currentTime: ctx ? ChordAudio.currentTime() : null,
    magicPos: magic ? magic.pos | 0 : 0,
    // N15 / N2: the step the next Next tap plays while paused, and whether that is "from the top".
    nextStep: prog.paused && magic && prog.steps.length ? (magic.pos < prog.steps.length ? magic.pos : 0) : -1,
    fromTop: !!(prog.paused && magic && prog.steps.length && magic.pos >= prog.steps.length),
    wrapped: !!(snap && snap.wrapped),
    groups: prog.groups ? prog.groups.length : 0,
    bandBeat: snap && snap.bandBeat != null ? snap.bandBeat : (ChordAudio && ChordAudio.band ? ChordAudio.band.beat : 0)
  };
}

var PLAY_DEBOUNCE_MS = 280;
function playDebounced() {
  var now = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
  if (prog.playTapAt && now - prog.playTapAt < PLAY_DEBOUNCE_MS) return true;
  prog.playTapAt = now;
  return false;
}

function soundingLog(now) {
  var i, e, last = null;
  for (i = 0; i < (prog.log || []).length; i++) {
    e = prog.log[i];
    if (e.t <= now + 0.001) last = e;
  }
  return last;
}

function beginPlay(from, opts) {
  opts = opts || {};
  paHintHide();
  magicHintClear();
  if (!prog.steps.length) return false;
  if (shared.suggestPreview) clearSuggestPreview();
  else if (shared.suggestTimer) { clearTimeout(shared.suggestTimer); shared.suggestTimer = 0; }
  unlock();
  if (loop.transport || loop.recording || loop.playing) stopPlayback();
  progLockKey();
  if (prog.flashT) { clearTimeout(prog.flashT); prog.flashT = 0; }
  shared.upNxOff = false;
  shared.kbKeyStay = false;
  if (prog.walkHome == null && magic) prog.walkHome = magic.pos | 0;
  prog.paused = false;
  prog.pauseSnap = null;
  prog.playing = true;
  prog.si = from;
  prog.log = opts.keepLog ? prog.log : [];
  prog.nextT = ChordAudio.currentTime() + 0.06;
  prog.bandSync = opts.bandSync !== false;
  if (prog.timer) clearInterval(prog.timer);
  prog.timer = setInterval(progTick, 25);
  progTick();
  paintProg();
  emitTransport();
  return true;
}

// A second Play tap pauses (does not Stop). Stop is a separate path (progStop).
export function progPlay() {
  if (playDebounced()) return;
  if (prog.playing) { progPause(); return; }
  if (prog.paused) { progResume(); return; }
  beginPlay(progPlayStart());   // v111: cold start from the Next walk position (magic.pos); 0 at / after the end
}

export function onTransportVisibility() {
  if (typeof document !== "undefined" && document.hidden && prog.playing) progPause();
}

export function progPause() {
  if (!prog.playing) return;
  var now = ChordAudio && ChordAudio.ctx ? ChordAudio.currentTime() : 0;
  var log = soundingLog(now);
  var cur = log && log.i != null ? log.i : (prog.cur >= 0 ? prog.cur : 0);
  if (cur < 0) cur = 0;
  var st = prog.steps[cur];
  var barDur = ((st && st.bars) || 1) * progLoopBar();
  var stepStart = log && log.t != null ? log.t : now;
  // A resume re-strike covers only the rest of its bar: count from where that bar really began.
  if (log && log.resume && log.remaining != null) stepStart = log.t - Math.max(0, barDur - log.remaining);
  var offset = barOffset(stepStart, now, barDur);
  var remaining = Math.max(0.02, barDur - offset);
  var song = songIdentity(prog);
  var world = worldIdentity({ style: state.style, keyScale: state.keyScale, keyRoot: state.keyRoot, sound: state.sound }, prog);
  var midis = (log && log.midis) ? log.midis.slice() : [];
  var bass = log && log.bass != null ? log.bass : null;
  var bandSnap = ChordAudio && ChordAudio.band && ChordAudio.band.snapshot ? ChordAudio.band.snapshot() : { beat: 0, remain: 0 };
  prog.pauseSnap = {
    cur: cur,
    offset: offset,
    remaining: remaining,
    barDur: barDur,
    stepStart: stepStart,
    midis: midis,
    bass: bass,
    sym: log && log.sym ? log.sym : null,
    style: world.style,
    mode: world.mode,
    keySig: world.keySig,
    sound: world.sound,
    songIdx: song.idx,
    songName: song.name,
    up: song.up,
    bandBeat: bandSnap.beat,
    bandRemain: bandSnap.remain,
    lyricLine: currentLyricLine()
  };
  prog.playing = false;
  prog.paused = true;
  prog.cur = cur;
  clearInterval(prog.timer); prog.timer = 0;
  // Drop UI timeouts for steps that have not sounded yet; keep the current line lit.
  prog.uiT.forEach(clearTimeout); prog.uiT = [];
  if (ChordAudio && ChordAudio.cancelFuture) ChordAudio.cancelFuture(now);
  // Future (not-yet-started) groups leave the sounding set. N14: the chord that is sounding gets
  // the normal release (the same envelope as a chord change), so nothing is held through the pause.
  // cancelFuture() dropped the stopChord that the next step would have sent.
  var sounding = (prog.groups || []).concat(prog.prevG || []);
  sounding.forEach(function (o) { if (o.t <= now + 0.001 && ChordAudio && ChordAudio.stopChord) ChordAudio.stopChord(o.g, now); });
  prog.groups = [];
  prog.prevG = [];
  if (ChordAudio && ChordAudio.band && ChordAudio.band.pause) ChordAudio.band.pause();
  else if (ChordAudio && ChordAudio.band) ChordAudio.band.hush();
  walkFollow(cur);   // N15: Next while paused plays the step after the paused one
  paintProgActive();
  paintProg();
  paintNextHint();
  if (typeof paintUpNext === "function") paintUpNext();
  emitTransport();
}

// N15: Next while paused moved to step `step` (magic.js has sounded it once, with its normal
// release). The pause point moves there: a later Play resumes from the start of that step.
export function progPauseMoveTo(step) {
  if (!prog.paused || !prog.pauseSnap) return;
  var n = prog.steps.length, st = prog.steps[step];
  if (!st) return;
  var snap = prog.pauseSnap;
  snap.wrapped = step < (snap.cur | 0);   // Next on the last step went back to the first chord
  setItemState(st.item);
  var spec = computeSpec();
  if (state.style === "kids") spec = kidsSoloSpec(spec, st.item.rootPc, st.item.mel);
  var barDur = (st.bars || 1) * progLoopBar();
  snap.cur = step;
  snap.offset = 0;
  snap.remaining = barDur;
  snap.barDur = barDur;
  snap.stepStart = ChordAudio && ChordAudio.ctx ? ChordAudio.currentTime() : 0;
  snap.midis = (spec.midis || []).slice();
  snap.bass = spec.bassOut != null ? spec.bassOut : null;
  snap.sym = spec.symbol;
  snap.bandBeat = 0;
  snap.bandRemain = 0;
  snap.lyricLine = currentLyricLine();
  snap.moved = true;
  prog.cur = step;
  prog.lastItem = st.item;
  paintProg();
  emitTransport();
}

export function progResume() {
  if (!prog.paused) return;
  var snap = prog.pauseSnap;
  var song = songIdentity(prog);
  var world = worldIdentity({ style: state.style, keyScale: state.keyScale, keyRoot: state.keyRoot, sound: state.sound }, prog);
  var rule = resumeRule(snap, world, song);
  var n = prog.steps.length;
  if (!n) { progStop(); return; }
  if (rule === "from-zero") {
    beginPlay(0);
    return;
  }
  if (rule === "replay-step") {
    var at = snap && snap.cur >= 0 ? snap.cur : 0;
    if (at >= n) at = 0;
    beginPlay(at);
    return;
  }
  // (a) nothing changed: re-strike the current chord, same voicing, for the remaining time.
  paHintHide();
  magicHintClear();
  if (shared.suggestPreview) clearSuggestPreview();
  else if (shared.suggestTimer) { clearTimeout(shared.suggestTimer); shared.suggestTimer = 0; }
  unlock();
  if (loop.transport || loop.recording || loop.playing) stopPlayback();
  progLockKey();
  if (prog.flashT) { clearTimeout(prog.flashT); prog.flashT = 0; }
  shared.upNxOff = false;
  shared.kbKeyStay = false;
  var now = ChordAudio.currentTime() + 0.06;
  var cur = snap.cur >= 0 ? snap.cur : 0;
  if (cur >= n) cur = 0;
  var st = prog.steps[cur];
  if (st) setItemState(st.item);
  var spec0 = (snap.midis && snap.midis.length) ? null : computeSpec();
  var midis = spec0 ? (spec0.midis || []) : snap.midis.slice();
  var bass = snap.bass;
  // A chord that Next sounded while paused gives way with the normal release (not held under the resume).
  if (ChordAudio.ctx && !sustainPool["suggest"]) ChordAudio.stopChord("suggest", now);
  var g = "P" + (++prog.gid);
  ChordAudio.playChord(g, midis, { bass: bass, sound: snap.sound || state.sound, time: now, step: cur });
  (prog.groups || []).forEach(function (o) { ChordAudio.stopChord(o.g, now); });
  prog.groups = [{ g: g, t: now }];
  // The resume re-strike goes into prog.log like any scheduled step (log-based timing stays right).
  prog.log.push({ i: cur, t: now, sym: snap.sym || (spec0 ? spec0.symbol : (st ? stripLabel(st.item) : "")), tied: false, bars: st ? st.bars : 1, n: midis.length, bass: bass, midis: midis.slice(), resume: true, remaining: snap.remaining });
  if (prog.log.length > 64) prog.log.shift();
  prog.lastItem = st ? st.item : prog.lastItem;
  prog.cur = cur;
  prog.si = (cur + 1) % n;
  prog.nextT = now + (snap.remaining > 0 ? snap.remaining : 0.02);
  prog.playing = true;
  prog.paused = false;
  prog.pauseSnap = null;
  prog.bandSync = false;
  if (ChordAudio.band && ChordAudio.band.resumeFrom) {
    ChordAudio.band.resumeFrom(now, { beat: snap.bandBeat, remain: snap.bandRemain });
  }
  if (prog.timer) clearInterval(prog.timer);
  prog.timer = setInterval(progTick, 25);
  paintProgActive();
  paintProg();
  emitTransport();
}
function progTick() {
  if (!prog.playing || !ChordAudio.ctx) return;
  // v76: iOS first tap: wait until the context is running before the first note.
  if (ChordAudio.ctx.state !== "running") { prog.nextT = ChordAudio.currentTime() + 0.06; return; }
  if (prog.bandSync) { prog.bandSync = false; ChordAudio.band.resync(prog.nextT); }   // Play song starts on the band's beat 1
  var now = ChordAudio.currentTime();
  if (prog.nextT < now - 0.3) prog.nextT = now + 0.05;   // fell behind (tab asleep): carry on from now
  var guard = 0;
  while (prog.nextT < now + 0.12 && guard++ < 4) {
    var i = prog.si, st = prog.steps[i];
    progSchedule(i, prog.nextT);
    prog.nextT += st.bars * progLoopBar();   // Upload: song BPM when a song is selected
    prog.si = i + 1;
    if (prog.si >= prog.steps.length) prog.si = 0;   // v82 Kids; v111 every style: Play song loops (no random tail)
  }
}
export function setItemState(item) {
  state.extensions.six = !!(item.extensions && item.extensions.six);
  state.extensions.min7 = !!(item.extensions && item.extensions.min7);
  state.extensions.maj7 = !!(item.extensions && item.extensions.maj7);
  state.extensions.nine = !!(item.extensions && item.extensions.nine);
  STRIP_EXT.forEach(function (k) { state.extensions[k] = (item.extensions && item.extensions[k]) || (k === "over" ? 0 : false); });
  state.rootPc = item.rootPc;
  state.type = item.type;
  state.stripSpell = item.rootSpell ? { pc: item.rootPc, type: item.type, rs: item.rootSpell, keep: !!item.keepSpell } : null;
  // The name the song or pad wrote (Cdim7), so the Now box and Guitar cards
  // do not rename it to the shape the theory layer would print (Cdim6).
  state.writtenChord = (state.style !== "kids" && item && (item.chipLabel != null || item.qualityLabel))
    ? { rootPc: item.rootPc, type: item.type, ext: item.extensions || {}, name: stripLabel(item) }
    : null;
  if (item.degree) {
    state.forceChord = null;
    if (state.keyMode) state.degree = item.degree;
  } else {
    state.forceChord = { rootPc: item.rootPc, type: item.type };
  }
}
function progSchedule(i, t) {
  var st = prog.steps[i];
  setItemState(st.item);
  var spec = computeSpec();
  if (state.style === "kids") spec = kidsSoloSpec(spec, st.item.rootPc, st.item.mel);   // v70: Kids loop = root only
  // v56: the same chord again (Yoga Drone, Blues C7 C7) is held through, not struck again.
  // v76: Kids and short percussive sounds strike a repeated note again (Twinkle C C).
  var tied = !!(prog.lastItem && prog.groups.length && sameChord(prog.lastItem, st.item)) && state.style !== "kids" && !PERCUSSIVE_SOUNDS[state.sound];
  if (!tied) {
    var g = "P" + (++prog.gid);
    ChordAudio.playChord(g, spec.midis, { bass: spec.bassOut, sound: state.sound, time: t, step: i });
    prog.groups.forEach(function (o) { ChordAudio.stopChord(o.g, Math.max(t, o.t)); });
    prog.prevG = prog.groups;   // v111 (D4): the chord sounding until t; Stop cuts it now, not at t
    prog.groups = [{ g: g, t: t }];
  }
  prog.lastItem = st.item;
  prog.log.push({ i: i, t: t, sym: spec.symbol, tied: tied, bars: st.bars, n: spec.midis.length, bass: spec.bassOut, midis: spec.midis.slice() });
  if (prog.log.length > 64) prog.log.shift();
  var tid = setTimeout(function () {
    prog.uiT = prog.uiT.filter(function (x) { return x !== tid; });
    if (!prog.playing) return;
    prog.cur = i;
    magic.lit = false;
    setItemState(st.item);
    kbSound(spec.midis, spec, st.item);   // v83
    shared.suggestPreview = { type: spec.type, extensions: { six: !!state.extensions.six, min7: !!state.extensions.min7, maj7: !!state.extensions.maj7, nine: !!state.extensions.nine }, midis: highlightMidisFromSpec(spec.midis), raw: spec.midis.slice() };   // rd3: raw = every sounding note (Expert marks)
    updateSymbol();
    paintProgActive();
    fxStepPulse();   // v93: Play song
  }, Math.max(0, (t - ChordAudio.currentTime()) * 1000));
  prog.uiT.push(tid);
}
export function progStop() {
  if (!prog.playing && !prog.paused) return;
  // v111 (D2): Stop keeps an uploaded song's next-chord marks (no upNxOff here any more)
  prog.playing = false;
  prog.paused = false;
  prog.pauseSnap = null;
  clearInterval(prog.timer); prog.timer = 0;
  ChordAudio.band.hush();   // v104 (M4)
  prog.uiT.forEach(clearTimeout); prog.uiT = [];
  var now = ChordAudio.ctx ? ChordAudio.currentTime() : 0;
  prog.groups.forEach(function (o) {   // v111 (D4): nothing sounds after Stop
    if (o.t > now - 0.05) ChordAudio.stopChord(o.g, now, o.t > now ? 0.002 : 0.006, true);   // scheduled by the lookahead (or started under 50 ms ago): silenced at once
    else ChordAudio.stopChord(o.g, now, null, true);
  });
  (prog.prevG || []).forEach(function (o) { if (o.t <= now) ChordAudio.stopChord(o.g, now, null, true); });
  prog.prevG = [];
  prog.groups = [];
  prog.lastItem = null;
  prog.cur = -1;
  magic.lit = false;
  if (prog.walkHome != null) {   // N15: Stop puts the Next walk back where it was before Play
    magic.pos = prog.walkHome; magic.next = null;
    magic.last = magic.pos > 0 && prog.steps[magic.pos - 1] ? prog.steps[magic.pos - 1].item : null;
    prog.walkHome = null;
  }
  paintProgActive();
  if (shared.suggestPreview) clearSuggestPreview();
  kbScheduleReset();   // kb-fix: Play song stopped: the window goes back to the tonic
  paintProg();
  emitTransport();
}
// v71: song.key -> app key. Same shape as the song contract's key {tonic, mode}; a future
// song Upload should call applySongKey(song.key.tonic, song.key.mode) too (not built yet).
export function applySongKey(tonic, mode) {
  var pc = typeof tonic === "number" ? wrap12(tonic) : namePc(String(tonic || ""));
  if (!(pc >= 0)) return false;
  mode = mode === "minor" ? "minor" : "major";
  var ak = activeKey();
  if (ak && ak.pc === pc && ak.mode === mode && state.keyRoot === pc && state.keyScale === mode) return true;
  state.keyRoot = pc;
  state.keyScale = mode;
  shared.lockKey = { pc: pc, mode: mode };
  if (typeof tonic === "string") setKeySpell(pc, mode, tonic);
  // Repaint key names for the new spelling. Kids hides #app, so its own piano is left alone.
  if (state.keyMode || !shared.kidsView) renderPads();
  shared.suggestSig = "";
  refreshHeld();
  paintSuggestions(computeSpec());
  scheduleSave();
  return true;
}
export function progSet(i) {
  var n = prog.list.length;
  if (!n) return;
  shared.paMiss = 0;   // v112: a new song starts a new miss run
  progStop();   // N22: picking a song while paused is a stop too (Play song, step 1), as in Kids
  ChordAudio.band.hush();   // v104: a new song starts without the old Band tail
  prog.idx = ((i % n) + n) % n;
  prog.cur = -1;
  shared.upNxOff = false;   // v73: a (re)selected song points at its first chord
  magicReset();   // v68
  prog.walkHome = null;   // a new song: Stop goes back to its first chord
  if (state.style === "kids") {
    var sk = KIDS_SONG_KEY[prog.list[prog.idx].name];
    if (sk) applySongKey(sk[0], sk[1]);   // v71: a Kids song picks its own key
  }
  if (shared.U && upInList()) shared.U.keep = !!(prog.list[prog.idx] && prog.list[prog.idx].up);   // v73: the song stays picked across Kids
  if (prog.list[prog.idx] && prog.list[prog.idx].up && shared.U) upKeyApply(upKeyNow().tonic, upKeyNow().mode);   // Upload: the song picks its key (Lock: the live key)
  progRedecorate();
  paintProg();
}

// Boot step (runs once, in the original v112.3 order, from main.js)
export function boot() {
PROG_TEST = /[?&]test=1(&|$)/.test(location.search);
magic = { pos: 0, last: null, since: 0, cycle: 4, item: null, lit: false, endAt: 0, rng: Math.random, log: [], next: null, hint: false };
  // v75 Band clock = the app's clock: the selected song (BPM, beats per bar), else the Play song
  // bar while it runs, else the Config (style / loop) BPM. keepAlive: Play song / the phrase loop.
  ChordAudio.band.clock = function () {
    var t = songTempo();
    if (t) return { bpm: t.bpm, bpb: t.bpb };
    if (prog.playing) return { bpm: 240 / PROG_BAR, bpb: 4 };
    return { bpm: state.bpm || 96, bpb: 4 };
  };
  ChordAudio.band.keepAlive = function () { return !!(prog.playing || (typeof loop !== "undefined" && loop.playing)); };
  ChordAudio.band.peek = function () {   // next chord root, for the Jazz walking-bass approach note
    if (prog.playing) return prog.steps.length ? prog.steps[prog.si % prog.steps.length].item.rootPc : null;   // v111: Play loops
    return magic && magic.next && magic.next.step >= 0 && magic.next.item ? magic.next.item.rootPc : null;
  };
  if (typeof document !== "undefined" && document.addEventListener) {
    document.addEventListener("visibilitychange", onTransportVisibility);
  }
kidsKeyFixT = 0;
}
