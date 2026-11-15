// v3.2 test.5: the next-chord cue on the two-line lyrics (js/ui/chordcue.js, used by the Expert song card and Kids view).
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const R = new URL('../../', import.meta.url);
const V = readFileSync(new URL('js/version.js', R), 'utf8').match(/APP_VERSION = "([^"]+)"/)[1];
const C = await import(`../../js/ui/chordcue.js?v=${V}`);

test('nextChange: the first later step with a different chord; not started = the first chord; none = -1', () => {
  const k = ['C', 'C', 'G', 'G', 'Am', 'Am', 'G'];
  assert.equal(C.nextChange(k, -1), 0);
  assert.equal(C.nextChange(k, 0), 2);
  assert.equal(C.nextChange(k, 1), 2);
  assert.equal(C.nextChange(k, 2), 4);
  assert.equal(C.nextChange(k, 5), 6);
  assert.equal(C.nextChange(k, 6), -1);
  assert.equal(C.nextChange(['F', 'F', 'F'], 0), -1, 'no change left: no cue');
  assert.equal(C.nextChange([], -1), -1);
});
test('cueSoon: about one beat before the change while Play runs; next tap without beat timing', () => {
  const bars = [1, 1, 0.5, 0.5, 1], barSec = 2, bpb = 4;   // 1 beat = 0.5 s
  const o = (cur, j, since, playing = true) => C.cueSoon({ j, cur, playing, bars, barSec, bpb, since });
  assert.equal(C.secsToChange(bars, 0, 2, barSec, 0.5), 3.5);
  assert.equal(o(0, 2, 0.5), false, '3.5 s left');
  assert.equal(o(1, 2, 1.0), false, '1 s left = 2 beats');
  assert.equal(o(1, 2, 1.5), true, 'one beat left');
  assert.equal(o(1, 2, 1.9), true);
  assert.equal(o(1, 3, 0), false, 'two steps away');
  assert.equal(o(0, 2, 0, false), false, 'tapping: 2 taps away');
  assert.equal(o(1, 2, 99, false), true, 'tapping: the next tap plays the change');
  assert.equal(C.cueSoon({ j: -1, cur: 0, playing: true, bars, barSec, bpb, since: 0 }), false, 'no change, no cue');
});
test('cueWord: the whole word at a mark; a mark on a space moves to the next word; a trailing mark takes the last word', () => {
  const t = 'Walking down the empty street';
  assert.deepEqual(C.cueWord(t, 0), [0, 7]);
  assert.deepEqual(C.cueWord(t, 3), [0, 7], 'mid-word mark = the whole word');
  assert.deepEqual(C.cueWord(t, 7), [8, 12], 'space before a word');
  assert.deepEqual(C.cueWord(t + '  ', 31), [23, 29]);
  assert.equal(C.cueWord('   ', 1), null);
  const kid = c => /[A-Za-z'\u2019]/.test(c);
  assert.deepEqual(C.cueWord('Twinkle, twinkle, little star,', 9, kid), [9, 16], 'Kids: letters only (no comma)');
  assert.deepEqual(C.cueWord('Twinkle, twinkle, little star,', 13, kid), [9, 16], 'Kids: a 2nd-syllable mark = the whole word');
});
test('cuePieces: splits a line around the cue and sung word, never drops text', () => {
  const t = 'Walking down the street';
  const p = C.cuePieces(t, [{ a: 8, b: 12, cls: 'x-cue' }, { a: 0, b: 7, cls: 'x-now' }]);
  assert.deepEqual(p, [{ t: 'Walking', cls: 'x-now' }, { t: ' ', cls: '' }, { t: 'down', cls: 'x-cue' }, { t: ' the street', cls: '' }]);
  assert.equal(p.map(x => x.t).join(''), t);
  assert.deepEqual(C.cuePieces(t, []), [{ t, cls: '' }]);
  assert.equal(C.cuePieces(t, [{ a: 0, b: 7, cls: 'a' }, { a: 3, b: 9, cls: 'b' }]).map(x => x.t).join(''), t, 'an overlapping range is dropped');
});
test('songCue: the change on a shown line gets its word; a change on a hidden line, between words or none = no cue', () => {
  const lines = { '0:0': [{ text: 'Walking down the street', markers: [{ charIndex: 0, chordIndex: 0 }, { charIndex: 8, chordIndex: 1 }] },
    { text: 'Every window shining', markers: [{ charIndex: 0, chordIndex: 2 }, { charIndex: 13, chordIndex: 4 }] },
    { text: 'Last line here', markers: [{ charIndex: 5, chordIndex: 5 }] }] };
  const L = (si, rep) => lines[si + ':' + rep];
  const events = [0, 1, 2, 3, 4, 5].map(ci => ({ si: 0, ci, rep: 0 }));
  const M = { seq: [{ si: 0, rep: 0, li: 0 }, { si: 0, rep: 0, li: 1 }, { si: 0, rep: 0, li: 2 }], at: [0, 0, 1, 1, 1, 2] };
  const names = ['Am', 'C/G', 'G', 'G', 'F', 'Am'];
  assert.deepEqual(C.songCue(M, 0, 2, events, names, 0, L), { j: 1, k: 0, a: 8, b: 12, chord: 'C/G' }, 'on the sung line');
  assert.deepEqual(C.songCue(M, 0, 2, events, names, 1, L), { j: 2, k: 1, a: 0, b: 5, chord: 'G' }, 'first word of the next line');
  assert.deepEqual(C.songCue(M, 1, 2, events, names, 2, L), { j: 4, k: 0, a: 13, b: 20, chord: 'F' }, 'G -> G is no change: skips to F');
  assert.equal(C.songCue(M, 0, 1, events, names, 1, L), null, 'the change is on a line not shown');
  const noMark = events.slice(); noMark[4] = { si: 0, ci: 9, rep: 0 };
  assert.equal(C.songCue(M, 1, 2, noMark, names, 2, L), null, 'the change falls between words');
  assert.equal(C.songCue(M, 1, 2, events, ['A', 'A', 'A', 'A', 'A', 'A'], 0, L), null, 'one chord all through: no cue');
});
test('wired into the Expert song card and the Kids view, with the tag placed absolutely (the lines never move)', () => {
  const ui = readFileSync(new URL('js/expert/ui.js', R), 'utf8'), kv = readFileSync(new URL('js/kids/view.js', R), 'utf8');
  const xc = readFileSync(new URL('css/expert.css', R), 'utf8'), kc = readFileSync(new URL('css/kids.css', R), 'utf8');
  assert.match(ui, /songCue\(upLyrMap\(\)/); assert.match(ui, /x-cuetag/); assert.match(kv, /kv-cuetag/); assert.match(kv, /nextChange\(names, cur\)/);
  assert.match(xc, /\.x-cuetag \{ position: absolute;/); assert.match(kc, /\.kv-cuetag \{ position: absolute;/);
  assert.doesNotMatch(xc.slice(xc.indexOf('next-chord cue')), /\.x-cue(?:\.soon)? \{[^}]*(margin|padding|line-height|[^-]height|font-size)\s*:/, 'the cue word changes no box size');
  assert.doesNotMatch(kc.slice(kc.indexOf('next-chord cue')), /\.cue(?:\.soon)? \{[^}]*(margin|padding|line-height|[^-]height|font-size)\s*:/);
});
