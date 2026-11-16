// Pause / resume rules for Play song. A second Play tap pauses; Stop is a separate path.
// Resume is checked through the note-log hook (attachNoteLog) with a stubbed audio clock.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import './dom-stub.js';

const listeners = {};
globalThis.addEventListener = (t, fn) => { (listeners[t] || (listeners[t] = [])).push(fn); };
globalThis.removeEventListener = (t, fn) => { if (listeners[t]) listeners[t] = listeners[t].filter(x => x !== fn); };
globalThis.dispatchEvent = (e) => { (listeners[e.type] || []).forEach(fn => fn(e)); return true; };
if (typeof globalThis.CustomEvent !== 'function') {
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init) { this.type = type; this.detail = init && init.detail; }
  };
}
if (typeof document.addEventListener !== 'function') document.addEventListener = globalThis.addEventListener;
if (typeof globalThis.getComputedStyle !== 'function') {
  globalThis.getComputedStyle = () => new Proxy({ getPropertyValue: () => '0', getPropertyPriority: () => '' }, { get: (o, k) => (k in o ? o[k] : () => '0') });
}
if (typeof document.getElementById !== 'function') { /* stubbed */ }
Object.defineProperty(document, 'hidden', { configurable: true, get: () => !!globalThis.__hidden });

const _st = setTimeout, _ct = clearTimeout, _si = setInterval, _ci = clearInterval;
const leftover = new Set();
globalThis.setTimeout = function (fn, ms, ...a) {
  const id = _st(function () { leftover.delete(id); return fn(...a); }, ms, ...a);
  leftover.add(id);
  return id;
};
globalThis.clearTimeout = function (id) { leftover.delete(id); return _ct(id); };
globalThis.setInterval = function (fn, ms, ...a) {
  const id = _si(fn, ms, ...a);
  leftover.add(id);
  return id;
};
globalThis.clearInterval = function (id) { leftover.delete(id); return _ci(id); };
function clearLeftoverTimers() {
  for (const id of leftover) { try { _ct(id); } catch (e) {} try { _ci(id); } catch (e2) {} }
  leftover.clear();
}
const R = new URL('../../', import.meta.url);
const V = readFileSync(new URL('js/version.js', R), 'utf8').match(/APP_VERSION = "([^"]+)"/)[1];

const { resumeRule, songIdentity, worldIdentity, barOffset } = await import(`../../js/songs/transport-policy.js?v=${V}`);
const S = await import(`../../js/state.js?v=${V}`); S.boot();
const PR = await import(`../../js/songs/presets.js?v=${V}`); PR.boot();
const E = await import(`../../js/audio/engine.js?v=${V}`);
const A = await import(`../../js/audio/index.js?v=${V}`);
const P = await import(`../../js/songs/playback.js?v=${V}`);
const Sus = await import(`../../js/ui/sustain.js?v=${V}`); Sus.boot();

const { state } = S;
let now = 10;
const strikes = [];
const bandLog = [];

function installAudioStub() {
  now = 10;
  strikes.length = 0;
  bandLog.length = 0;
  A.api.ctx = { state: 'running', get currentTime() { return now; } };
  A.api.currentTime = () => now;
  A.api.ensure = () => {};
  A.api.resume = () => Promise.resolve();
  A.api.wake = () => {};
  A.api.playChord = function (g, midis, opts) {
    opts = opts || {};
    const t = opts.time == null ? now : opts.time;
    const rec = { g, midis: (midis || []).slice(), bass: opts.bass, sound: opts.sound, t, step: opts.step };
    strikes.push(rec);
    (rec.midis).forEach(m => E.recordEngineNote('on', { t, midi: m, step: opts.step, velocity: 1 }));
    if (opts.bass != null) E.recordEngineNote('on', { t, midi: opts.bass, step: opts.step, velocity: 1 });
  };
  A.api.stopChord = function (g, when, tau, force) {
    strikes.push({ stop: true, g, t: when == null ? now : when, tau: tau == null ? null : tau, force: !!force });
  };
  A.api.cancelFuture = function (when) {
    const t = when == null ? now : when;
    strikes.forEach(ev => {
      if (ev.stop || ev.cancelled) return;
      if (ev.t > t + 0.001) {
        ev.cancelled = true;
        (ev.midis || []).forEach(m => E.recordEngineNote('off', { t, midi: m, step: ev.step, velocity: 1 }));
      }
    });
  };
  const band = A.api.band;
  band.running = false;
  band.beat = 0;
  band.nextBeat = 0;
  band._pauseSnap = null;
  band.resync = function (t) { this.running = true; this.beat = 0; this.nextBeat = t; bandLog.push({ type: 'resync', t }); };
  band.hush = function () { this.running = false; bandLog.push({ type: 'hush' }); };
  band.snapshot = function () { return { beat: this.beat || 0, remain: Math.max(0, (this.nextBeat || now) - now) }; };
  band.pause = function () { this._pauseSnap = this.snapshot(); this.hush(); bandLog.push({ type: 'pause', beat: this._pauseSnap.beat, remain: this._pauseSnap.remain }); };
  band.resumeFrom = function (t, snap) {
    snap = snap || this._pauseSnap || { beat: 0, remain: 0 };
    this.running = true;
    this.beat = snap.beat || 0;
    this.nextBeat = t + (snap.remain || 0);
    bandLog.push({ type: 'resumeFrom', t, beat: this.beat, remain: snap.remain || 0 });
  };
}

function tapGap() { P.prog.playTapAt = 0; }

function setupSong() {
  clearLeftoverTimers();
  installAudioStub();
  P.progStop();
  tapGap();
  state.style = 'pop';
  state.sound = 'piano';
  state.keyRoot = 0;
  state.keyScale = 'major';
  state.bpm = 96;
  const key = { pc: 0, mode: 'major' };
  const list = PR.progList('pop', 'major');
  assert.ok(list.length >= 2, 'need at least two progressions');
  P.prog.list = list;
  P.prog.idx = 0;
  P.prog.style = 'pop';
  P.prog.mode = 'major';
  P.prog.key = key;
  P.prog.keySig = 0;
  P.prog.steps = PR.progSteps(key, list[0]);
  P.prog.cur = -1;
  P.prog.groups = [];
  P.prog.log = [];
  P.prog.lastItem = null;
  if (!P.magic) P.boot();
  P.magic.pos = 0;
  P.magic.lit = false;
}

test('resumeRule: remain, replay-step, from-zero', () => {
  const song = { idx: 0, name: 'Pop 1', up: false };
  const world = { style: 'pop', mode: 'major', keySig: 0, sound: 'piano' };
  const snap = { songIdx: 0, songName: 'Pop 1', up: false, style: 'pop', mode: 'major', keySig: 0, sound: 'piano' };
  assert.equal(resumeRule(snap, world, song), 'remain');
  assert.equal(resumeRule(snap, { ...world, keySig: 7 }, song), 'replay-step');
  assert.equal(resumeRule(snap, { ...world, style: 'folk' }, song), 'replay-step');
  assert.equal(resumeRule(snap, { ...world, mode: 'minor' }, song), 'replay-step');
  assert.equal(resumeRule(snap, { ...world, sound: 'epiano' }, song), 'replay-step');
  assert.equal(resumeRule(snap, world, { idx: 1, name: 'Other', up: false }), 'from-zero');
  // B1: the same loaded song can sit at a different list index after a style change (e.g. 11 in Pop, 10 in Jazz).
  assert.equal(
    resumeRule(
      { ...snap, songIdx: 11, songName: 'QA Chord Sheet', up: true, style: 'pop' },
      { ...world, style: 'jazz' },
      { idx: 10, name: 'QA Chord Sheet', up: true }
    ),
    'replay-step'
  );
  assert.equal(
    resumeRule(
      { ...snap, songIdx: 11, songName: 'QA Chord Sheet', up: true },
      world,
      { idx: 10, name: 'Other Song', up: true }
    ),
    'from-zero'
  );
  assert.equal(resumeRule(null, world, song), 'start');
  assert.equal(barOffset(10, 11, 3), 1);
  assert.equal(barOffset(10, 9, 3), 0);
  assert.equal(barOffset(10, 14, 3), 3);
});

test('getTransportState() is idle until Play, then playing, and emits tc:transport', () => {
  setupSong();
  const ev = [];
  window.addEventListener('tc:transport', e => ev.push(e.detail.state));
  P.boot();
  assert.equal(P.getTransportState().state, 'idle');
  assert.equal(P.transportLabel(), 'idle');
  const log = [];
  E.attachNoteLog(log);
  P.progPlay();
  assert.equal(P.getTransportState().state, 'playing');
  assert.equal(P.getTransportState().playing, true);
  assert.ok(log.some(x => x.type === 'on'));
  assert.ok(ev.includes('playing'));
  tapGap();
  P.progStop();
  assert.equal(P.getTransportState().state, 'idle');
  assert.ok(ev.includes('idle'));
  E.attachNoteLog(null);
});

test('a second Play tap pauses: keeps cur and offset, Band stops, tails are not force-cut', () => {
  setupSong();
  const log = [];
  E.attachNoteLog(log);
  P.progPlay();
  assert.equal(P.getTransportState().state, 'playing');
  const first = strikes.find(s => !s.stop);
  assert.ok(first, 'scheduled a chord');
  // Advance into the bar (PROG_BAR is 3s at default).
  now = first.t + 1.0;
  A.api.band.beat = 2;
  A.api.band.nextBeat = now + 0.4;
  A.api.band.running = true;
  tapGap();
  P.progPlay();
  const st = P.getTransportState();
  assert.equal(st.state, 'paused');
  assert.equal(st.paused, true);
  assert.equal(st.playing, false);
  assert.equal(st.cur, first.step);
  assert.ok(Math.abs(st.offset - 1.0) < 0.05, 'offset into bar ≈ 1s, got ' + st.offset);
  assert.ok(st.remaining > 1.5, 'remaining time of the bar, got ' + st.remaining);
  assert.equal(typeof st.lyricLine, 'number');
  assert.ok(bandLog.some(x => x.type === 'pause' || x.type === 'hush'), 'Band stops');
  // Pause must not have issued a Stop-style force cut of the already-started chord (N14: it gets
  // the normal release instead, checked in its own test below).
  const stops = strikes.filter(s => s.stop);
  stops.forEach(s => { assert.equal(s.force, false, 'no force cut'); assert.equal(s.tau, null, 'normal release envelope'); });
  const cancelled = strikes.filter(s => s.cancelled);
  // Only future (not-yet-started) events may be cancelled.
  cancelled.forEach(s => assert.ok(s.t > first.t + 0.9));
  E.attachNoteLog(null);
  tapGap();
  P.progStop();
});

test('resume (a) nothing changed: re-strikes the same voicing for the remaining time, Band from the paused beat', () => {
  setupSong();
  const log = [];
  E.attachNoteLog(log);
  P.progPlay();
  const first = strikes.find(s => !s.stop);
  const midis = first.midis.slice();
  now = first.t + 1.0;
  A.api.band.beat = 3;
  A.api.band.nextBeat = now + 0.25;
  A.api.band.running = true;
  tapGap();
  P.progPlay();
  assert.equal(P.getTransportState().state, 'paused');
  const remain = P.getTransportState().remaining;
  const onsBefore = log.filter(x => x.type === 'on').length;
  tapGap();
  P.progPlay();
  const st = P.getTransportState();
  assert.equal(st.state, 'playing');
  const resumeStrike = strikes.filter(s => !s.stop && !s.cancelled).at(-1);
  assert.ok(resumeStrike);
  assert.equal(resumeStrike.step, first.step);
  assert.deepEqual(resumeStrike.midis, midis);
  const added = log.filter(x => x.type === 'on').slice(onsBefore);
  assert.ok(added.length, 're-strike logged note-ons');
  added.forEach(ev => assert.equal(ev.step, first.step));
  const resumed = bandLog.findLast(x => x.type === 'resumeFrom');
  assert.ok(resumed, 'Band resumes from paused beat');
  assert.equal(resumed.beat, 3);
  // Next step is scheduled after the remaining time.
  assert.ok(Math.abs((P.prog.nextT - resumeStrike.t) - remain) < 0.05, 'remaining time kept, nextT-start=' + (P.prog.nextT - resumeStrike.t) + ' remain=' + remain);
  E.attachNoteLog(null);
  tapGap();
  P.progStop();
});

test('resume (b) key/style/mode changed, same song: replays that step from its start in the new sound', () => {
  setupSong();
  const log = [];
  E.attachNoteLog(log);
  P.progPlay();
  const first = strikes.find(s => !s.stop);
  now = first.t + 1.0;
  tapGap();
  P.progPlay();
  assert.equal(P.getTransportState().state, 'paused');
  const pausedCur = P.getTransportState().cur;
  // Change key, stay on the same song.
  state.keyRoot = 7;
  P.prog.key = { pc: 7, mode: 'major' };
  P.prog.keySig = 7;
  tapGap();
  const onsBefore = log.filter(x => x.type === 'on').length;
  P.progPlay();
  assert.equal(P.getTransportState().state, 'playing');
  const replay = strikes.filter(s => !s.stop && !s.cancelled && s.t >= now).find(s => s.step === pausedCur);
  assert.ok(replay, 'the paused step is scheduled again from its start');
  assert.equal(replay.step, pausedCur);
  // A fresh step start: nextT is a full bar after this strike, not the leftover remainder.
  const bar = (P.prog.steps[pausedCur].bars || 1) * 3; // default PROG_BAR ≈ 3s; use actual nextT span
  const span = P.prog.nextT - replay.t;
  assert.ok(span > 1.5, 'replayed from the start of the step, span=' + span);
  const added = log.filter(x => x.type === 'on').slice(onsBefore);
  assert.ok(added.some(ev => ev.step === pausedCur));
  E.attachNoteLog(null);
  tapGap();
  P.progStop();
});

test('resume (c) different song/progression: starts at step 0', () => {
  setupSong();
  const log = [];
  E.attachNoteLog(log);
  P.progPlay();
  const first = strikes.find(s => !s.stop);
  now = first.t + 1.0;
  tapGap();
  P.progPlay();
  assert.equal(P.getTransportState().state, 'paused');
  const other = 1;
  P.progSet(other);
  assert.equal(P.prog.idx, other);
  assert.equal(P.getTransportState().state, 'paused', 'changing song while paused stays paused until Play');
  tapGap();
  const onsBefore = log.filter(x => x.type === 'on').length;
  P.progPlay();
  assert.equal(P.getTransportState().state, 'playing');
  const fresh = strikes.filter(s => !s.stop && !s.cancelled && s.t >= now);
  assert.ok(fresh.length, 'scheduled the new song');
  assert.equal(fresh[0].step, 0);
  const added = log.filter(x => x.type === 'on').slice(onsBefore);
  assert.ok(added.some(ev => ev.step === 0));
  E.attachNoteLog(null);
  tapGap();
  P.progStop();
});

test('Stop from playing or paused always returns to idle and clears the snapshot', () => {
  setupSong();
  P.progPlay();
  tapGap();
  P.progPlay();
  assert.equal(P.getTransportState().state, 'paused');
  tapGap();
  P.progStop();
  assert.equal(P.getTransportState().state, 'idle');
  assert.equal(P.prog.cur, -1);
  assert.equal(P.prog.pauseSnap, null);
  assert.equal(P.prog.paused, false);
  // Stop is a no-op when already idle (does not throw).
  P.progStop();
  assert.equal(P.getTransportState().state, 'idle');
  // Stop from playing:
  tapGap();
  P.progPlay();
  assert.equal(P.getTransportState().state, 'playing');
  tapGap();
  P.progStop();
  assert.equal(P.getTransportState().state, 'idle');
  assert.equal(P.prog.cur, -1);
});

test('Play ignores a second tap inside the debounce window', () => {
  setupSong();
  P.progPlay();
  assert.equal(P.getTransportState().state, 'playing');
  // No tapGap: immediate second tap is ignored.
  P.progPlay();
  assert.equal(P.getTransportState().state, 'playing');
  tapGap();
  P.progPlay();
  assert.equal(P.getTransportState().state, 'paused');
  tapGap();
  P.progStop();
});

test('tab backgrounding pauses a playing song and does not auto-resume', () => {
  setupSong();
  P.progPlay();
  assert.equal(P.getTransportState().state, 'playing');
  globalThis.__hidden = true;
  P.onTransportVisibility();
  assert.equal(P.getTransportState().state, 'paused');
  globalThis.__hidden = false;
  P.onTransportVisibility();
  assert.equal(P.getTransportState().state, 'paused');
  tapGap();
  P.progStop();
});

// ---------- N14 / N15 / N16 / resume log / Play labels ----------
const M = await import(`../../js/songs/magic.js?v=${V}`);
(await import(`../../js/ui/strip.js?v=${V}`)).boot1();   // chip icons (Next repaints the key chip through kbSound)
const Sh = S.shared;
const sleep = ms => new Promise(r => _st(r, ms));
// Play, then move the stub clock until step `k` is the sounding step.
async function playTo(k) {
  P.prog.keySig = null;   // test setup uses a dummy keySig; let the first progSync take the real one (no key-change Stop)
  P.progPlay();
  for (let guard = 0; guard < 200; guard++) {
    const e = P.prog.log.find(x => x.i === k);
    if (e && e.t <= now) { now = e.t + 0.5; await sleep(5); return e; }
    now += 0.25;
    await sleep(30);
  }
  throw new Error('never reached step ' + k + ' state=' + P.transportLabel() + ' log=' + JSON.stringify(P.prog.log.map(x => [x.i, x.t])) + ' now=' + now + ' timer=' + P.prog.timer);
}
function liveGroups() {
  // groups that were struck and have no stop at or before `now`
  const started = strikes.filter(s => !s.stop && !s.cancelled && s.t <= now + 0.001);
  return started.filter(s => !strikes.some(x => x.stop && x.g === s.g && x.t <= now + 0.001)).map(s => s.g);
}

test('N14: pause gives the sounding chord its normal release (nothing held through the pause)', async () => {
  setupSong();
  await playTo(1);
  const before = liveGroups();
  assert.ok(before.length >= 1, 'a chord is sounding before pause');
  tapGap();
  P.progPlay();
  assert.equal(P.getTransportState().state, 'paused');
  const rel = strikes.filter(s => s.stop && before.includes(s.g));
  assert.ok(rel.length >= 1, 'the sounding group got a stopChord on pause');
  rel.forEach(s => {
    assert.ok(Math.abs(s.t - now) < 0.002, 'released now, not later');
    assert.equal(s.tau, null, 'engine default release envelope (REL_TAU), not a custom cut');
    assert.equal(s.force, false, 'not a force (Stop) cut');
  });
  assert.deepEqual(liveGroups(), [], 'no group left held during the pause');
  assert.equal(P.prog.groups.length, 0);
  // Resume still re-strikes once, same step.
  const ons = strikes.filter(s => !s.stop).length;
  tapGap();
  P.progPlay();
  const added = strikes.filter(s => !s.stop).slice(ons);
  assert.equal(added.length >= 1, true);
  assert.equal(added[0].step, 1);
  assert.equal(added.filter(s => s.t <= now + 0.07).length, 1, 'exactly one re-strike at resume');
  tapGap(); P.progStop();
});

test('resume re-strike is written to prog.log; a second pause measures from the real bar start', async () => {
  setupSong();
  await playTo(1);
  tapGap(); P.progPlay();
  const snap1 = { ...P.prog.pauseSnap };
  tapGap(); P.progPlay();
  const e = P.prog.log.at(-1);
  assert.equal(e.resume, true);
  assert.equal(e.i, 1);
  assert.ok(Math.abs(e.t - (now + 0.06)) < 0.002, 'log time = re-strike time');
  assert.deepEqual(e.midis, snap1.midis);
  assert.ok(Math.abs(e.remaining - snap1.remaining) < 1e-9);
  // Pause again 0.3 s after the re-strike: offset = first offset + 0.3.
  now = e.t + 0.3;
  tapGap(); P.progPlay();
  const st = P.getTransportState();
  assert.equal(st.cur, 1);
  assert.ok(Math.abs(st.offset - (snap1.offset + 0.3)) < 0.01, 'offset ' + st.offset + ' vs ' + (snap1.offset + 0.3));
  tapGap(); P.progStop();
});

test('N15: Next while paused plays the step after the paused one, stays paused, walk in sync', async () => {
  setupSong();
  const n = P.prog.steps.length;
  assert.ok(n >= 4);
  await playTo(2);
  tapGap(); P.progPlay();
  assert.equal(P.getTransportState().state, 'paused');
  assert.equal(P.getTransportState().cur, 2);
  assert.equal(P.magic.pos, 3, 'walk follows the paused step');
  assert.equal(P.getTransportState().nextStep, 3);
  M.progNext();
  const st = P.getTransportState();
  assert.equal(st.state, 'paused', 'stays paused');
  assert.equal(st.cur, 3, 'moved to the step after the paused one');
  assert.equal(P.magic.pos, 4, 'walk in sync');
  assert.deepEqual(P.magic.item, P.prog.steps[3].item, 'Next sounded step 3');
  assert.equal(st.offset, 0);
  assert.ok(Math.abs(st.remaining - (P.prog.steps[3].bars || 1) * P.prog.pauseSnap.barDur / (P.prog.steps[3].bars || 1)) < 1e-9);
  // The Next chord ends with its normal ring + release (magicEnd timer armed on the audio clock).
  assert.ok(Sh.suggestTimer, 'ring-end release timer armed');
  assert.ok(P.magic.endAt > now, 'release scheduled after the ring');
  // Resume plays from the new step: the Next chord gets the normal release, one re-strike of step 3.
  const ons = strikes.length;
  tapGap(); P.progPlay();
  assert.equal(P.getTransportState().state, 'playing');
  const added = strikes.slice(ons);
  const sug = added.find(s => s.stop && s.g === 'suggest');
  assert.ok(sug, 'Next chord released at resume');
  assert.equal(sug.force, false); assert.equal(sug.tau, null);
  const re = added.filter(s => !s.stop);
  assert.equal(re[0].step, 3);
  assert.deepEqual(re[0].midis, P.prog.log.at(-1).midis);
  assert.equal(P.prog.log.at(-1).i, 3);
  tapGap(); P.progStop();
});

test('N15: Next while paused on the last step wraps to step 1 (index 0), "from the top"', async () => {
  setupSong();
  const n = P.prog.steps.length;
  await playTo(n - 1);
  tapGap(); P.progPlay();
  assert.equal(P.getTransportState().cur, n - 1);
  assert.equal(P.getTransportState().fromTop, true, 'the next chord is from the top');
  assert.equal(P.getTransportState().nextStep, 0);
  M.progNext();
  const st = P.getTransportState();
  assert.equal(st.state, 'paused');
  assert.equal(st.cur, 0);
  assert.equal(st.wrapped, true);
  assert.equal(P.magic.pos, 1);
  assert.deepEqual(P.magic.item, P.prog.steps[0].item, 'Next sounded step 1');
  tapGap(); P.progStop();
});

test('N15: Stop after Pause (and after Next while paused) puts the walk back: Play starts where it did', async () => {
  setupSong();
  await playTo(2);
  tapGap(); P.progPlay();
  M.progNext();
  tapGap(); P.progStop();
  assert.equal(P.getTransportState().state, 'idle');
  assert.equal(P.magic.pos, 0, 'walk restored to before Play');
  assert.equal(P.progPlayStart(), 0);
});

test('N15: idle Next is unchanged (walks from magic.pos, no transport change)', () => {
  setupSong();
  P.magic.next = null;   // no queued decision left over from an earlier test
  M.progNext();
  assert.equal(P.getTransportState().state, 'idle');
  assert.deepEqual(P.magic.item, P.prog.steps[0].item);
  assert.equal(P.magic.pos, 1);
  M.progNext();
  assert.deepEqual(P.magic.item, P.prog.steps[1].item);
  assert.equal(P.magic.pos, 2);
});

test('N16: hidden tab pauses (not idle) and keeps the step; gear pagehide pauses when persisted, stops on unload', async () => {
  const G = await import(`../../js/ui/gear.js?v=${V}`);
  setupSong();
  await playTo(2);
  globalThis.__hidden = true;
  P.onTransportVisibility();
  assert.equal(P.getTransportState().state, 'paused');
  assert.equal(P.getTransportState().cur, 2);
  assert.deepEqual(liveGroups(), [], 'released, nothing held while hidden');
  globalThis.__hidden = false;
  P.onTransportVisibility();
  assert.equal(P.getTransportState().state, 'paused', 'no auto-resume');
  tapGap(); P.progStop();
  setupSong();
  await playTo(1);
  G.onPageHide({ persisted: true });
  assert.equal(P.getTransportState().state, 'paused');
  G.onPageHide({ persisted: false });
  assert.equal(P.getTransportState().state, 'idle', 'a real unload stops');
  // wire.js visibility handler pauses rather than stops
  const wire = readFileSync(new URL('js/ui/wire.js', R), 'utf8');
  const vis = wire.slice(wire.indexOf('addEventListener("visibilitychange"'));
  const body = vis.slice(0, vis.indexOf('} else'));
  assert.ok(/progPause\(\)/.test(body) && !/progStop\(\)/.test(body), 'wire.js hidden handler pauses');
});

test('Play button label: "Play song" idle, "Pause" playing, "Resume" paused (Kids, Simple, Expert)', () => {
  setupSong();
  assert.deepEqual(P.playButtonLabel(), { aria: 'Play song', title: 'Play song: the whole song / progression, over and over' });
  P.progPlay();
  assert.deepEqual(P.playButtonLabel(), { aria: 'Pause', title: 'Pause' });
  tapGap(); P.progPlay();
  assert.deepEqual(P.playButtonLabel(), { aria: 'Resume', title: 'Resume' });
  tapGap(); P.progStop();
  assert.equal(P.playButtonLabel().aria, 'Play song');
  for (const f of ['js/ui/progbar.js', 'js/expert/ui.js', 'js/kids/view.js']) {
    const src = readFileSync(new URL(f, R), 'utf8');
    assert.ok(src.includes('playButtonLabel('), f + ' uses playButtonLabel');
    assert.ok(!src.includes('"Stop song"'), f + ' no longer says Stop song');
    assert.ok(/setAttribute\("aria-label", \w+\.aria\)/.test(src), f + ' sets aria-label from playButtonLabel');
    assert.ok(/\.title\s*=\s*\w+\.title/.test(src) || /setAttribute\("title", \w+\.title\)/.test(src), f + ' sets title from playButtonLabel');
  }
});

// Adapted from the Test Engineer's PR #16 regression drafts
// (/workspace/tc-test/out/pr16/regression/n14-pause-releases-voices.test.js and n15-next-while-paused.test.js).
test('TE N14: a pause releases every sounding voice within 50 ms (note-off per note-on)', async () => {
  const RELEASE_WITHIN_S = 0.05;
  setupSong();
  const log = [];
  E.attachNoteLog(log);
  const origStop = A.api.stopChord;
  A.api.stopChord = function (g, when, tau, force) {   // the stub records offs like the engine does
    const t = when == null ? now : when;
    strikes.filter(s => !s.stop && s.g === g).forEach(s => s.midis.forEach(m => log.push({ type: 'off', t, midi: m, step: s.step, velocity: 1 })));
    return origStop.call(A.api, g, when, tau, force);
  };
  try {
    await playTo(1);
    tapGap();
    P.progPlay();
    assert.equal(P.getTransportState().state, 'paused');
    const pauseAt = now;
    const sounding = log.filter(e => e.type === 'on' && e.step === P.getTransportState().cur && e.t <= pauseAt + 0.001);
    assert.ok(sounding.length >= 2, 'a voicing was sounding at pause, got ' + sounding.length);
    const missing = sounding.filter(on => !log.some(e => e.type === 'off' && e.midi === on.midi && e.t >= on.t - 0.001 && e.t <= pauseAt + RELEASE_WITHIN_S + 0.001));
    assert.equal(missing.length, 0, 'voices still held after 50 ms: ' + JSON.stringify(missing));
  } finally {
    A.api.stopChord = origStop;
    E.attachNoteLog(null);
    tapGap(); P.progStop();
  }
});

test('TE N15: Next while paused plays the paused step + 1', async () => {
  setupSong();
  const n = P.prog.steps.length;
  assert.ok(n >= 3, 'need a progression of 3+ steps');
  await playTo(1);
  tapGap();
  P.progPlay();
  assert.equal(P.getTransportState().state, 'paused');
  const pausedCur = P.getTransportState().cur;
  const magicPos = P.magic.pos;
  M.progNext();
  const st = P.getTransportState();
  const expected = pausedCur + 1;
  assert.equal(st.state, 'paused', 'stays paused');
  assert.equal(st.cur, expected, 'Next while paused should play step ' + expected + ' (paused ' + pausedCur + ' + 1); got ' + st.cur + ' (transport ' + st.state + ', magic.pos was ' + magicPos + ')');
  assert.deepEqual(P.magic.item, P.prog.steps[expected].item, 'the chord Next sounded is that step');
  tapGap(); P.progStop();
});

test.after(() => { try { P.progStop(); } catch (e) {} clearLeftoverTimers(); });


test('B1: style change while paused, same song at a new list index, Resume replays the paused step', async () => {
  setupSong();
  await playTo(1);
  tapGap(); P.progPlay();
  assert.equal(P.getTransportState().state, 'paused');
  assert.equal(P.getTransportState().cur, 1);
  // The uploaded song moved from idx 11 (Pop) to idx 10 (Jazz); only the index changed.
  P.prog.pauseSnap.songIdx = P.prog.idx + 11;
  state.style = 'jazz';
  tapGap();
  const onsBefore = strikes.filter(s => !s.stop).length;
  P.progPlay();
  assert.equal(P.getTransportState().state, 'playing');
  const added = strikes.filter(s => !s.stop).slice(onsBefore);
  assert.ok(added.length, 'Resume scheduled a step');
  assert.equal(added[0].step, 1, 'Resume must replay step 2 (index 1), not restart at step 1');
  tapGap(); P.progStop();
});

test('B2: key change while paused keeps the step and Next walk; Next plays paused step+1; Resume replays the paused step', async () => {
  setupSong();
  await playTo(1);
  tapGap(); P.progPlay();
  let st = P.getTransportState();
  assert.equal(st.state, 'paused');
  assert.equal(st.cur, 1);
  assert.equal(st.magicPos, 2);
  assert.equal(st.nextStep, 2);
  const pausedCur = st.cur;
  const key = { pc: 2, mode: 'major' };
  state.keyRoot = 2;
  P.progSync(key);
  st = P.getTransportState();
  assert.equal(st.state, 'paused', 'stays paused after a key change');
  assert.equal(st.cur, pausedCur, 'step highlight / cur kept');
  assert.equal(st.magicPos, pausedCur + 1, 'Next walk kept');
  assert.equal(st.nextStep, pausedCur + 1);
  M.progNext();
  st = P.getTransportState();
  assert.equal(st.state, 'paused');
  assert.equal(st.cur, pausedCur + 1, 'Next plays paused step+1 (step 3)');
  tapGap(); P.progStop();

  // Fresh run: key change then Resume (no Next) replays the paused step.
  setupSong();
  await playTo(1);
  tapGap(); P.progPlay();
  state.keyRoot = 2;
  P.progSync({ pc: 2, mode: 'major' });
  assert.equal(P.getTransportState().cur, 1);
  const onsBefore = strikes.filter(s => !s.stop).length;
  tapGap(); P.progPlay();
  assert.equal(P.getTransportState().state, 'playing');
  const added = strikes.filter(s => !s.stop).slice(onsBefore);
  assert.ok(added.length);
  assert.equal(added[0].step, 1, 'Resume after a key change replays step 2');
  tapGap(); P.progStop();
});

test('B2: style change while paused on a different built-in progression still resets the walk', async () => {
  setupSong();
  const firstName = P.prog.list[P.prog.idx].name;
  await playTo(1);
  tapGap(); P.progPlay();
  state.style = 'jazz';
  P.progSync({ pc: 0, mode: 'major' });
  const st = P.getTransportState();
  const newName = P.prog.list[P.prog.idx] && P.prog.list[P.prog.idx].name;
  assert.notEqual(newName, firstName, 'style change picked a different progression');
  assert.equal(st.state, 'paused');
  assert.equal(st.cur, -1, 'a genuinely different song still resets the step');
  assert.equal(st.magicPos, 0);
  tapGap(); P.progStop();
});

test('Kids Home and song-select stop playback when paused; Simple/Expert mode switch still stops', () => {
  const kids = readFileSync(new URL('js/kids/view.js', R), 'utf8');
  const home = kids.slice(kids.indexOf('kv-home'), kids.indexOf('kv-home') + 400);
  assert.ok(/prog\.playing \|\| prog\.paused/.test(home) && home.includes('progStop()'), 'Kids Home stops when paused');
  const pick = kids.slice(kids.indexOf('function pickSong'), kids.indexOf('function pickSong') + 500);
  assert.ok(pick.includes('if (prog.playing || prog.paused) progStop()'), 'Kids pickSong stops when paused');
  const layout = readFileSync(new URL('js/ui/layout.js', R), 'utf8');
  const setS = layout.slice(layout.indexOf('export function setSimple'), layout.indexOf('export function setSimple') + 800);
  assert.ok(setS.includes('progStop()'), 'setSimple still stops on a Simple/Expert switch');
  const play = readFileSync(new URL('js/songs/playback.js', R), 'utf8');
  assert.ok(/PLAY_DEBOUNCE_MS = 280/.test(play), '280 ms Play debounce is unchanged');
  setupSong();
  P.progPlay();
  tapGap(); P.progPlay();
  assert.equal(P.getTransportState().state, 'paused');
  P.progStop();
  assert.equal(P.getTransportState().state, 'idle');
  const lab = P.playButtonLabel();
  assert.equal(lab.aria, 'Play song');
  assert.equal(lab.title, 'Play song: the whole song / progression, over and over');
});
