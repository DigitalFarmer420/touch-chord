import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const V = readFileSync(new URL('../../js/version.js', import.meta.url), 'utf8').match(/APP_VERSION = "([^"]+)"/)[1];
const { Theory: T } = await import(`../../js/theory/index.js?v=${V}`);   // same URL the app uses

test('note names for all 12 pitch classes', () => {
  assert.equal([...Array(12).keys()].map(p => T.noteName(T.spellRoot(p))).join(' '), 'C C# D Eb E F F# G Ab A Bb B');
  assert.deepEqual(T.NOTE_NAMES, ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']);
});
test('chord intervals', () => {
  assert.deepEqual(T.chordIntervals('major', {}), [0, 4, 7]);
  assert.deepEqual(T.chordIntervals('minor', {}), [0, 3, 7]);
  assert.deepEqual(T.chordIntervals('dim', {}), [0, 3, 6]);
  assert.deepEqual(T.chordIntervals('sus4', {}), [0, 5, 7]);
  assert.deepEqual(T.chordIntervals('minor', { min7: true }), [0, 3, 7, 10]);
  assert.deepEqual(T.chordIntervals('major', { maj7: true }), [0, 4, 7, 11]);
});
test('chord tones are spelled', () => { assert.deepEqual(T.tones(9, 'minor', {}), ['A', 'C', 'E']); });
test('chord symbols', () => {
  assert.equal(T.chordSymbol('C', 'minor', { min7: true }), 'Cm7');
  assert.equal(T.chordSymbol('G', 'major', { min7: true }), 'G7');
  assert.equal(T.chordSymbol('F', 'major', { maj7: true }), 'Fmaj7');
  assert.equal(T.chordSymbol('B', 'dim', {}), 'B\u00b0');
  assert.equal(T.chordSymbol('D', 'sus4', {}), 'Dsus4');
});
test('C major scale degrees', () => {
  const d = T.scaleDegrees(0, 'major');
  assert.equal(d.map(x => x.name).join(' '), 'C D E F G A B');
  assert.equal(d.map(x => x.roman).join(' '), 'I ii iii IV V vi vii');
  assert.equal(d.map(x => x.type).join(' '), 'major minor minor major major minor dim');
});
test('degree chord ii in C is D minor', () => {
  const c = T.degreeChord(0, 'major', 2); assert.equal(c.rootName, 'D'); assert.equal(c.type, 'minor'); assert.equal(c.rootPc, 2);
});
test('every voicing keeps the chord pitch classes, for every root', () => {
  for (let pc = 0; pc < 12; pc++) for (const v of ['drop', 'low', 'close', 'high', 'bright']) for (const [ty, ex] of [['major', {}], ['minor', { min7: true }], ['major', { maj7: true }], ['dim', {}]]) {
    const want = [...new Set(T.chordIntervals(ty, ex).map(i => (pc + i) % 12))].sort((a, b) => a - b);
    assert.deepEqual(T.pitchClasses(T.voicedMidis(pc, ty, ex, v)), want, `${pc} ${ty} ${JSON.stringify(ex)} ${v}`);
  }
  assert.deepEqual(T.voicedMidis(0, 'major', {}, 'close'), [60, 64, 67]);
});
