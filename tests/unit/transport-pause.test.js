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
  A.api.stopChord = function (g, when) {
    strikes.push({ stop: true, g, t: when == null ? now : when });
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
  // Pause must not have issued a Stop-style force cut of the already-started chord.
  const stops = strikes.filter(s => s.stop);
  assert.equal(stops.length, 0);
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

test.after(() => { try { P.progStop(); } catch (e) {} clearLeftoverTimers(); });
