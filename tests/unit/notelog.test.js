// fix/transport-pause: the ?test=1 note log must be absent by default (no window.__tcTest,
// no sink attached, recordEngineNote is a no-op). test-hooks.js is only loaded with ?test=1.
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import './dom-stub.js';
// dom-stub sets location.search to '' (no ?test=1) before any app module loads.
assert.equal(globalThis.location.search, '');
assert.equal(globalThis.__tcTest, undefined);

const R = new URL('../../', import.meta.url);
const V = readFileSync(new URL('js/version.js', R), 'utf8').match(/APP_VERSION = "([^"]+)"/)[1];
const E = await import(`../../js/audio/engine.js?v=${V}`);

test('the note-log hook is absent by default (no ?test=1)', () => {
  assert.equal(globalThis.__tcTest, undefined);
  assert.equal(E.noteLogAttached(), false);
  // A record call is a no-op and does not create a window hook or a log.
  E.recordEngineNote('on', { t: 0, midi: 60, step: 0, velocity: 1 });
  assert.equal(globalThis.__tcTest, undefined);
  assert.equal(E.noteLogAttached(), false);
});

test('attachNoteLog only records while a sink is attached, and detaching is a no-op again', () => {
  const log = [];
  E.attachNoteLog(log);
  assert.equal(E.noteLogAttached(), true);
  assert.equal(globalThis.__tcTest, undefined); // still nothing on window unless test-hooks install() ran
  E.recordEngineNote('on', { t: 1.25, midi: 67, step: 2, velocity: 0.5 });
  E.recordEngineNote('off', { t: 1.5, midi: 67, step: 2, velocity: 0.5 });
  assert.equal(log.length, 2);
  assert.deepEqual(log[0].type, 'on');
  assert.equal(log[0].midi, 67);
  assert.equal(log[0].step, 2);
  assert.equal(log[0].velocity, 0.5);
  assert.equal(log[0].t, 1.25);
  assert.equal(typeof log[0].wallMs, 'number');
  assert.equal(log[1].type, 'off');
  E.attachNoteLog(null);
  assert.equal(E.noteLogAttached(), false);
  E.recordEngineNote('on', { t: 2, midi: 60, step: 0, velocity: 1 });
  assert.equal(log.length, 2);
  assert.equal(globalThis.__tcTest, undefined);
});
