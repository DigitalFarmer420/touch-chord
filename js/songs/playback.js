// The progression player: walk, Play song, step state, song key, progSet.
import { api as ChordAudio } from "../audio/index.js?v=112.3";
import { activeKey, namePc, keyRootName, setKeySpell } from "../keys.js?v=112.3";
import { computeSpec, wrap12, unlock, renderPads, updateSymbol, highlightMidisFromSpec, paintNextHint, clearSuggestPreview, PERCUSSIVE_SOUNDS, refreshHeld, kbSound, kidsSoloSpec, STRIP_EXT, PREVIEW_MS, stripKey, applySuggestion, prettyAcc, stripLabel, wireStripTap, paintSuggestions, fitStrip, paintProg, paintProgActive, fxStepPulse, magicHintClear, paHintHide } from "../legacy.js?v=112.3";
import { stopPlayback } from "../loop.js?v=112.3";
import { KIDS_SONG_KEY } from "./kids-songs.js?v=112.3";
import { upSave } from "./library.js?v=112.3";
import { magicReset, progBadge } from "./magic.js?v=112.3";
import { PROG_BAR, PROGRESSIONS, progList, progSteps, sameChord } from "./presets.js?v=112.3";
import { upInList, songTempo, paintUpNext, progLoopBar, upKeyApply, upKeyNow } from "./song.js?v=112.3";
import { state, loop, scheduleSave, shared } from "../state.js?v=112.3";

export const prog = { style: null, mode: null, keySig: null, key: null, idx: 0, list: [], steps: [], targets: [], badges: [],
  cur: -1, playing: false, timer: 0, si: 0, nextT: 0, groups: [], gid: 0, uiT: [], flashT: 0, log: [], tmp: 0, unplaced: 0, model: null };
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
  if (styleChanged || keyChanged) progStop();
  var oldName = prog.list[prog.idx] ? prog.list[prog.idx].name : null;
  var wasUp = !!(prog.list[prog.idx] && prog.list[prog.idx].up);   // Upload: a style change keeps the song
  prog.list = progList(state.style, key.mode);
  if (styleChanged) prog.idx = 0;
  else if (prog.mode !== null && prog.mode !== key.mode) {
    var ix = -1;
    prog.list.forEach(function (p, i) { if (p.name === oldName) ix = i; });
    prog.idx = Math.max(0, ix);
  }
  if (wasUp) for (var uj = 0; uj < prog.list.length; uj++) if (prog.list[uj].up) prog.idx = uj;
  if (prog.idx >= prog.list.length) prog.idx = 0;
  if (shared.U && shared.U.locked && prog.list[prog.idx] && prog.list[prog.idx].up) {   // v73 Lock: the key change is the transpose target
    var lk0 = shared.U.liveKey, nk = { tonic: keyRootName(key), mode: key.mode };
    if (!lk0 || lk0.tonic !== nk.tonic || lk0.mode !== nk.mode) { shared.U.liveKey = nk; upSave(); }
  }
  prog.style = state.style; prog.mode = key.mode; prog.keySig = sig; prog.key = key;
  prog.cur = -1;
  magicReset();   // v68: key / mode / style change: the walk starts again
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
  prog.targets = []; prog.badges = []; prog.tmp = 0; prog.unplaced = 0;
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
      var t = g.el, bd = document.createElement("span");
      var nums = g.steps.map(function (i) { return i + 1; });
      bd.className = "pg-badge" + (t.classList.contains("ss-note") ? " on-note" : "") + (nums.length > 1 ? " multi" : "");
      bd.setAttribute("role", "button");
      bd.setAttribute("aria-label", "Progression step " + nums.join(", "));
      bd.title = "Step " + nums.join(", ");
      bd.addEventListener("pointerdown", function (e) { e.preventDefault(); e.stopPropagation(); progBadge(g.steps); });
      bd.addEventListener("click", function (e) { e.stopPropagation(); });
      el.appendChild(bd);
      prog.badges.push({ el: bd, target: t, steps: g.steps });
    });
  }
  paintProgActive();
}
// v56: badge text. Up to 2 steps: all of them ("1\u00b76"). More (Blues C7 = 1, 3, 4, 7, 11): the
// current or next step for that chip and how many more ("3 +4"); the full list is in the label.
function badgeText(b) {
  var nums = b.steps.map(function (i) { return i + 1; });
  if (nums.length <= 2) return nums.join("\u00b7");
  var at = b.steps.indexOf(prog.cur) >= 0 ? prog.cur : null;
  if (at === null) {
    for (var i = 0; i < b.steps.length; i++) if (b.steps[i] > prog.cur) { at = b.steps[i]; break; }
    if (at === null) at = b.steps[0];
  }
  return (at + 1) + "<small>+" + (nums.length - 1) + "</small>";
}
// v56: badges sit just OUTSIDE their chip, on a corner or edge, never on any chord name,
// numeral or note name: each badge takes the first spot (corners, then along the edges) that
// covers no text, stays inside the panel and misses the other badges.
export function placeBadges() {
  var el = document.getElementById("suggest");
  if (!el || !prog.badges.length) return;
  var sr = el.getBoundingClientRect();
  var pc = el.parentNode.getBoundingClientRect();
  // v62: inside the strip on every side, and at least 2px clear of the card's border.
  var pr = { left: Math.max(pc.left + 2, sr.left), right: Math.min(pc.right - 2, sr.right), top: Math.max(pc.top + 2, sr.top), bottom: Math.min(pc.bottom - 2, sr.bottom) };
  var texts = [];
  Array.prototype.forEach.call(el.querySelectorAll(".ss-chip .r, .ss-chip .q, .ss-chip .rn, .ss-note .nn, .ss-note small"), function (n) {
    if (!n.textContent || getComputedStyle(n).display === "none") return;
    var q = n.getBoundingClientRect();
    // v58: keep at least 1.5px clear of any text.
    if (q.width > 0 && q.height > 0) texts.push({ left: q.left - 1.5, top: q.top - 1.5, right: q.right + 1.5, bottom: q.bottom + 1.5 });
  });
  // v64: also the chip name as one block (root over quality, glyph boxes), so a badge corner
  // never sits in the empty corner of that block next to a narrow root letter.
  Array.prototype.forEach.call(el.querySelectorAll(".ss-chip .nm"), function (n) {
    var rg = document.createRange(); rg.selectNodeContents(n); var q = rg.getBoundingClientRect();
    if (q.width > 0 && q.height > 0) texts.push({ left: q.left - 0.5, top: q.top - 0.5, right: q.right + 0.5, bottom: q.bottom + 0.5 });
  });
  // Never over the buttons above the panel either (a badge may poke a little above it).
  Array.prototype.forEach.call(document.querySelectorAll("button, .prog"), function (n) {
    if (el.contains(n)) return;
    var q = n.getBoundingClientRect();
    if (q.width > 0 && q.bottom > pr.top - 12 && q.top < pr.top) texts.push(q);
  });
  var placed = [];
  function ov(a, b) {
    var w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    return w > 0 && h > 0 ? w * h : 0;
  }
  function place(b) {
    var t = b.target.getBoundingClientRect();
    var bq = b.el.getBoundingClientRect();
    var bw = bq.width, bh = bq.height, k = 3;
    var L = t.left - bw + k, R = t.right - k, T = t.top - bh + k, B = t.bottom - k, ym = t.top + (t.height - bh) / 2, f;
    // Corners on top, then the sides, then along the top edge, then the bottom (reads as the
    // chip below, so last), then just inside a corner as a fallback.
    var cands = [[L, T], [R, T], [t.left - bw + 1, ym], [t.right - 1, ym]];
    for (f = 0.25; f < 1; f += 0.25) cands.push([t.left + (t.width - bw) * f, t.top - bh + 2]);
    cands.push([t.left - bw + 1, t.top - bh / 2], [t.right - 1, t.top - bh / 2], [t.left - bw + 1, t.bottom - bh / 2], [t.right - 1, t.bottom - bh / 2]);
    cands.push([L, B], [R, B]);
    for (f = 0.25; f < 1; f += 0.25) cands.push([t.left + (t.width - bw) * f, t.bottom - 2]);
    cands.push([L, t.top + 1], [R, t.top + 1], [t.left - bw * 0.3, t.top - bh * 0.38], [t.right - bw * 0.7, t.top - bh * 0.38]);
    // v58: corners just touching, when tight (portrait phones).
    cands.push([t.left - bw, t.top - bh + 1], [t.right, t.top - bh + 1], [t.left - bw, t.bottom - 1], [t.right, t.bottom - 1], [t.left - bw, ym], [t.right, ym]);
    // v62: each spot also clamped inside the strip, so a spot that would stick out flips inward.
    var nc = cands.length;
    for (var ci0 = 0; ci0 < nc; ci0++) {
      var cx = Math.min(Math.max(cands[ci0][0], pr.left), pr.right - bw), cy = Math.min(Math.max(cands[ci0][1], pr.top), pr.bottom - bh);
      if (cx !== cands[ci0][0] || cy !== cands[ci0][1]) cands.push([cx, cy]);
    }
    var best = null;
    cands.forEach(function (c, ci) {
      var r = { left: c[0], top: c[1], right: c[0] + bw, bottom: c[1] + bh };
      var sc = 0;
      texts.forEach(function (q) { sc += ov(r, q) * 100; });
      placed.forEach(function (q) { sc += ov(r, q) * 50; });
      // v62: never outside the strip (no poking over the top edge any more).
      var out = Math.max(0, pr.left - r.left) + Math.max(0, r.right - pr.right) + Math.max(0, pr.top - r.top) + Math.max(0, r.bottom - pr.bottom);
      sc += out * 1e6 + ci * 0.01;
      if (!best || sc < best.sc) best = { sc: sc, r: r };
    });
    // Last resort: clamp (only if every spot was outside, e.g. a strip smaller than the badge).
    var cl = Math.min(Math.max(best.r.left, pr.left), pr.right - bw), ct = Math.min(Math.max(best.r.top, pr.top), pr.bottom - bh);
    best.r = { left: cl, top: ct, right: cl + bw, bottom: ct + bh };
    best.sc = 0;
    texts.forEach(function (q) { best.sc += ov(best.r, q) * 100; });
    placed.forEach(function (q) { best.sc += ov(best.r, q) * 50; });
    best.bw = bw; best.bh = bh;
    return best;
  }
  prog.badges.forEach(function (b) {
    b.el.innerHTML = badgeText(b);
    b.el.classList.remove("cmp");
    var best = place(b);
    // v63: crowded (a 10+ step progression on a tablet): when every spot still touches text or
    // another badge, try a compact badge (still >= 11 px text) and keep it if it fits better.
    if (best.sc > 0.5) {
      b.el.classList.add("cmp");
      var b2 = place(b);
      if (b2.sc < best.sc) best = b2; else b.el.classList.remove("cmp");
    }
    var bw = best.bw, bh = best.bh;
    placed.push(best.r);
    var px = Math.round(best.r.left - sr.left), py = Math.round(best.r.top - sr.top);
    px = Math.max(Math.ceil(pr.left - sr.left), Math.min(px, Math.floor(pr.right - bw - sr.left)));
    py = Math.max(Math.ceil(pr.top - sr.top), Math.min(py, Math.floor(pr.bottom - bh - sr.top)));
    b.el.style.left = px + "px";
    b.el.style.top = py + "px";
  });
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
// Loop: its own lookahead scheduler on the Web Audio clock (like the phrase loop's).
export function progPlay() {
  if (prog.playing) { progStop(); return; }
  paHintHide();   // v112: never during Play
  magicHintClear();   // v68: the loop player takes over from the Next walk
  if (!prog.steps.length) return;
  if (shared.suggestPreview) clearSuggestPreview();   // v84: a chip preview's timer must not clear Play's lit keys
  else if (shared.suggestTimer) { clearTimeout(shared.suggestTimer); shared.suggestTimer = 0; }
  unlock();
  if (loop.transport || loop.recording || loop.playing) stopPlayback();   // one loop at a time
  progLockKey();
  if (prog.flashT) { clearTimeout(prog.flashT); prog.flashT = 0; }
  shared.upNxOff = false;
  shared.kbKeyStay = false;   // v102
  prog.playing = true;
  prog.si = progPlayStart();   // v111: resume from the Next walk position (magic.pos); 0 at / after the end. magic.pos is not changed by Play.
  prog.log = [];
  prog.nextT = ChordAudio.currentTime() + 0.06;
  prog.bandSync = true;   // v75/v76: band beat 1 = the first scheduled step (set once the context runs)
  prog.timer = setInterval(progTick, 25);
  progTick();
  paintProg();
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
    ChordAudio.playChord(g, spec.midis, { bass: spec.bassOut, sound: state.sound, time: t });
    prog.groups.forEach(function (o) { ChordAudio.stopChord(o.g, Math.max(t, o.t)); });
    prog.prevG = prog.groups;   // v111 (D4): the chord sounding until t; Stop cuts it now, not at t
    prog.groups = [{ g: g, t: t }];
  }
  prog.lastItem = st.item;
  prog.log.push({ i: i, t: t, sym: spec.symbol, tied: tied, bars: st.bars, n: spec.midis.length, bass: spec.bassOut });
  if (prog.log.length > 64) prog.log.shift();
  var tid = setTimeout(function () {
    prog.uiT = prog.uiT.filter(function (x) { return x !== tid; });
    if (!prog.playing) return;
    prog.cur = i;
    magic.lit = false;
    setItemState(st.item);
    kbSound(spec.midis, spec, st.item);   // v83
    shared.suggestPreview = { type: spec.type, extensions: { six: !!state.extensions.six, min7: !!state.extensions.min7, maj7: !!state.extensions.maj7, nine: !!state.extensions.nine }, midis: highlightMidisFromSpec(spec.midis) };
    updateSymbol();
    paintProgActive();
    fxStepPulse();   // v93: Play song
  }, Math.max(0, (t - ChordAudio.currentTime()) * 1000));
  prog.uiT.push(tid);
}
export function progStop() {
  if (!prog.playing) return;
  // v111 (D2): Stop keeps an uploaded song's next-chord marks (no upNxOff here any more)
  prog.playing = false;
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
  paintProgActive();
  if (shared.suggestPreview) clearSuggestPreview();
  paintProg();
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
  if (state.keyMode) renderPads();
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
  progStop();
  ChordAudio.band.hush();   // v104: a new song starts without the old Band tail
  prog.idx = ((i % n) + n) % n;
  prog.cur = -1;
  shared.upNxOff = false;   // v73: a (re)selected song points at its first chord
  magicReset();   // v68
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
kidsKeyFixT = 0;
}
