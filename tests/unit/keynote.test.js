// Out-of-key piano notes take the key's accidental side. Eb major writes Db and Gb, not C# and F#.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import './dom-stub.js';

const V = readFileSync(new URL('../../js/version.js', import.meta.url), 'utf8').match(/APP_VERSION = "([^"]+)"/)[1];
const { keyNoteName } = await import(`../../js/keys.js?v=${V}`);

const eb = { pc: 3, mode: 'major' };
const fs = { pc: 6, mode: 'major' };
const c = { pc: 0, mode: 'major' };

test('Eb major spells scale notes as flats and chromatic notes on the flat side', () => {
  assert.equal(keyNoteName(eb, 3), 'Eb');
  assert.equal(keyNoteName(eb, 8), 'Ab');
  assert.equal(keyNoteName(eb, 10), 'Bb');
  assert.equal(keyNoteName(eb, 1), 'Db');
  assert.equal(keyNoteName(eb, 6), 'Gb');
  assert.equal(keyNoteName(eb, 1).includes('#'), false);
  assert.equal(keyNoteName(eb, 6).includes('#'), false);
});

test('F# major spells chromatic notes on the sharp side', () => {
  assert.equal(keyNoteName(fs, 6), 'F#');
  assert.equal(keyNoteName(fs, 1), 'C#');
  assert.equal(keyNoteName(fs, 8), 'G#');
  assert.equal(keyNoteName(fs, 0), 'C');
});

test('C major keeps the usual names', () => {
  assert.equal(keyNoteName(c, 1), 'C#');
  assert.equal(keyNoteName(c, 3), 'Eb');
  assert.equal(keyNoteName(c, 6), 'F#');
  assert.equal(keyNoteName(c, 10), 'Bb');
});
