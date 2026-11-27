// Jam: song chords only, then up to 6 ranked extras. Pure list, no DOM.
import './dom-stub.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { chordFamily, songChordList, jamRank, jamExtras, takeJam, songGridOn, JAM_CAP } from '../../js/songs/jam.js?v=2026.11.27.3';
import { state } from '../../js/state.js?v=2026.11.27.3';

const ext = (min7) => ({ six: false, min7: !!min7, maj7: false, nine: false });
const C = (pc, type, min7) => ({ rootPc: pc, type: type, extensions: ext(min7) });
const syms = (list) => list.map((c) => c.sym);
const G = { pc: 7, mode: 'major' };
const Cmaj = { pc: 0, mode: 'major' };
const Amin = { pc: 9, mode: 'minor' };

test('family match is root plus triad, so a 7th or sus4 counts as the plain chord', () => {
  assert.equal(chordFamily(C(7, 'major', true)), 'major');
  assert.equal(chordFamily({ rootPc: 7, type: 'sus4', extensions: ext(false) }), 'major');
  assert.equal(chordFamily(C(9, 'minor', true)), 'minor');
  assert.notEqual(chordFamily(C(7, 'major', true)), chordFamily(C(7, 'minor', false)));
});

test('song chords stay in first-appearance order and keep exact variants', () => {
  const steps = [C(7, 'major'), C(0, 'major'), C(7, 'major'), C(7, 'major', true), C(2, 'major'), C(0, 'major')].map((item) => ({ item }));
  const list = songChordList(steps);
  assert.deepEqual(list.map((c) => c.rootPc + c.type + (c.extensions.min7 ? '7' : '')), ['7major', '0major', '7major7', '2major']);
});

test('Amazing Grace in G: Em, Am, Bm, A7, Cm, F — no D7, G7 or Dsus4', () => {
  const song = [C(7, 'major'), C(7, 'major', true), C(0, 'major'), C(2, 'major')];
  const jam = jamExtras(G, song);
  assert.equal(JAM_CAP, 6);
  assert.deepEqual(syms(jam), ['Em', 'Am', 'Bm', 'A7', 'Cm', 'F']);
  assert.ok(!syms(jamRank(G, song)).includes('D7'));
  assert.ok(!syms(jamRank(G, song)).includes('G7'));
  assert.ok(!syms(jamRank(G, song)).includes('Dsus4'));
  assert.ok(!syms(jamRank(G, song)).includes('Gsus4'));
  const by = Object.fromEntries(jam.map((c) => [c.sym, c]));
  assert.equal(by.Cm.row, 'sad');
  assert.equal(by.Cm.hc, by.Em.hc - 4); // C is two notes left of E (C D E)
  assert.equal(by.A7.row, 'bright');
  assert.equal(by.A7.hc, by.Am.hc);
  assert.equal(by.A7.rootPc, by.Am.rootPc);
  assert.equal(by.Em.row, 'sad');
  assert.equal(by.F.row, 'bright');
});

test('a taken cell is skipped and the next ranked chord is placed instead', () => {
  const song = [C(7, 'major'), C(7, 'major', true), C(0, 'major'), C(2, 'major')];
  const ranked = jamRank(G, song);
  const a7 = ranked.find((c) => c.sym === 'A7');
  const placed = takeJam(ranked, [{ row: a7.row, hc: a7.hc, item: C(0, 'major') }]);
  assert.ok(!syms(placed).includes('A7'));
  assert.ok(syms(placed).includes('Cm'));
  assert.ok(syms(placed).includes('F'));
  assert.ok(placed.length <= 6);
});

test('pads that already exist are reused, including Cm under C and A7 above A', () => {
  const song = [C(7, 'major'), C(7, 'major', true), C(0, 'major'), C(2, 'major')];
  const ranked = jamRank(G, song);
  const em = ranked.find((c) => c.sym === 'Em');
  const am = ranked.find((c) => c.sym === 'Am');
  const bm = ranked.find((c) => c.sym === 'Bm');
  const f = ranked.find((c) => c.sym === 'F');
  const occupied = [em, am, bm, f].map((c) => ({ row: c.row, hc: c.hc, item: c }));
  const placed = takeJam(ranked, occupied);
  assert.deepEqual(syms(placed), ['Em', 'Am', 'Bm', 'A7', 'Cm', 'F']);
});

test('C major song C F G offers Am, Dm, Em, then D7, and not E7', () => {
  const song = [C(0, 'major'), C(5, 'major'), C(7, 'major')];
  const jam = jamExtras(Cmaj, song);
  assert.deepEqual(syms(jam), ['Am', 'Dm', 'Em', 'D7', 'Fm', 'Bb']);
  assert.ok(!syms(jamRank(Cmaj, song)).includes('E7'));
  assert.ok(!syms(jamRank(Cmaj, song)).includes('C7'));
  assert.ok(!syms(jamRank(Cmaj, song)).includes('G7'));
});

test('a secondary dominant is added only when its target is in the song, most-used target first', () => {
  const bare = jamRank(Cmaj, [C(0, 'major'), C(5, 'major')]);
  assert.ok(!syms(bare).includes('D7'), 'no G, so no D7');
  assert.ok(!syms(bare).includes('C7'), 'C is already a song chord, so no C7');
  const withAm = [C(9, 'minor'), C(9, 'minor'), C(9, 'minor'), C(7, 'major')];
  const jam = jamExtras(Cmaj, withAm);
  assert.ok(syms(jam).includes('E7'));
  assert.ok(syms(jam).indexOf('E7') < syms(jam).indexOf('D7'));
});

test('G7 or Gsus4 blocks plain G, and Am7 blocks Am', () => {
  const g7 = jamRank(Cmaj, [C(0, 'major'), C(5, 'major'), C(7, 'major', true)]);
  assert.ok(!g7.some((c) => c.sym === 'G'));
  const gsus = jamRank(Cmaj, [C(0, 'major'), { rootPc: 7, type: 'sus4', extensions: ext(false) }]);
  assert.ok(!gsus.some((c) => c.sym === 'G'));
  const am7 = jamRank(Cmaj, [C(9, 'minor', true), C(5, 'major'), C(7, 'major')]);
  assert.ok(!am7.some((c) => c.sym === 'Am'));
  assert.ok(am7.some((c) => c.sym === 'Dm'));
});

test('the list is capped at 6', () => {
  const onlyG = jamRank(G, [C(7, 'major')]);
  assert.ok(onlyG.length > 6);
  assert.equal(jamExtras(G, [C(7, 'major')]).length, 6);
  assert.deepEqual(syms(jamExtras(G, [C(7, 'major')])), syms(onlyG).slice(0, 6));
});

test('minor key: iv v III, then V7, then bVII bVI, then secondary dominants', () => {
  const song = [C(9, 'minor'), C(2, 'minor')];
  const jam = jamExtras(Amin, song);
  assert.deepEqual(syms(jam).slice(0, 5), ['Em', 'C', 'E7', 'G', 'F']);
  assert.ok(syms(jam).includes('A7'));
  assert.ok(!syms(jam).includes('Dm'));
  assert.ok(!syms(jamRank(Amin, song)).some((c) => c.type === 'dim'));
});

test('the song grid is off for progressions and for Kids, so extras cannot carry over', () => {
  assert.equal(songGridOn({ song: true, style: 'pop' }), true);
  assert.equal(songGridOn({ song: false, style: 'jazz' }), false);
  assert.equal(songGridOn({ song: true, style: 'kids' }), false);
  assert.equal(songGridOn({ song: true, kv: true, style: 'pop' }), false);
});

test('flat keys spell extras with the key spelling; a sharp key stays sharp', () => {
  const prevSimple = state.simple, prevSpell = state.keySpell;
  state.simple = false;
  state.keySpell = {};
  try {
    // Db major, same shape as Amazing Grace (I, I7, IV, V): Bbm Ebm Fm, then Eb7, Gbm, Cb.
    const db = [C(1, 'major'), C(1, 'major', true), C(6, 'major'), C(8, 'major')];
    assert.deepEqual(syms(jamExtras({ pc: 1, mode: 'major' }, db)), ['Bbm', 'Ebm', 'Fm', 'Eb7', 'Gbm', 'Cb']);
    // Gb is the alternate spelling of pc 6 (the default name is F#). The key picker stores Gb.
    state.keySpell = { '6major': 'Gb' };
    const gb = [C(6, 'major'), C(6, 'major', true), C(11, 'major'), C(1, 'major')];
    assert.deepEqual(syms(jamExtras({ pc: 6, mode: 'major' }, gb)), ['Ebm', 'Abm', 'Bbm', 'Ab7', 'Cbm', 'Fb']);
    state.keySpell = {};
    const d = [C(2, 'major'), C(2, 'major', true), C(7, 'major'), C(9, 'major')];
    assert.deepEqual(syms(jamExtras({ pc: 2, mode: 'major' }, d)), ['Bm', 'Em', 'F#m', 'E7', 'Gm', 'C']);
  } finally {
    state.simple = prevSimple;
    state.keySpell = prevSpell;
  }
});

test('no viio, and no bVI or bIII in major', () => {
  const all = jamRank(Cmaj, [C(0, 'major')]);
  assert.ok(!all.some((c) => c.sym === 'Bdim' || c.type === 'dim'));
  assert.ok(!all.some((c) => c.rootPc === 8 || c.rootPc === 3));
});
