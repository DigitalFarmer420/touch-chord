// N20 2026-11-17 (Vinh): the section name of a later lyric line is a caption line of its own above that line (no " ·"),
// in Simple and Expert. capLayout keeps the song card's height: a caption takes one row slot, except on Expert phones
// where the hidden title's line holds one caption. No name = no caption line.
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const R = new URL('../../', import.meta.url);
const V = readFileSync(new URL('js/version.js', R), 'utf8').match(/APP_VERSION = "([^"]+)"/)[1];
const M = await import(`../../js/expert/model.js?v=${V}`);
const rows = secs => secs.map((sec, i) => ({ kind: i ? 'text' : 'lyric', text: 't' + i, sec }));
const shape = L => L.map(it => it.cap != null ? 'cap:' + it.cap : 'r' + it.k);
test('a caption goes right above the line that starts the section and takes one slot (last line drops)', () => {
  assert.deepEqual(shape(M.capLayout(rows([null, 'Chorus', null]), false)), ['r0', 'cap:Chorus', 'r1']);
  assert.deepEqual(shape(M.capLayout(rows([null, null, 'Chorus']), false)), ['r0', 'r1', 'cap:Chorus']);
  assert.deepEqual(shape(M.capLayout(rows([null, 'Chorus']), false)), ['r0', 'cap:Chorus']);
});
test('Expert phones: the freed title line holds one caption, nothing drops', () => {
  assert.deepEqual(shape(M.capLayout(rows([null, 'Chorus']), true)), ['r0', 'cap:Chorus', 'r1']);
  assert.deepEqual(shape(M.capLayout(rows([null, 'A', 'B']), true)), ['r0', 'cap:A', 'r1', 'cap:B']);
});
test('no name: no caption line, all rows kept; slot count never grows', () => {
  assert.deepEqual(shape(M.capLayout(rows([null, '', null]), false)), ['r0', 'r1', 'r2']);
  assert.deepEqual(shape(M.capLayout(rows([null, null]), true)), ['r0', 'r1']);
  for (const free of [false, true]) for (const s of [[null, 'A', 'B'], [null, 'A'], [null, null, 'B']]) {
    const L = M.capLayout(rows(s), free), caps = L.filter(x => x.cap != null).length, n = L.length - caps;
    assert.ok(n + Math.max(0, caps - (free ? 1 : 0)) <= s.length, JSON.stringify([s, free]));
  }
});
test('renderers: no inline " ·" section prefix left; captions are plain text (no button, no hit target)', () => {
  const ui = readFileSync(new URL('js/expert/ui.js', R), 'utf8'), sb = readFileSync(new URL('js/ui/songbar.js', R), 'utf8');
  assert.doesNotMatch(ui, /x-lsec/); assert.doesNotMatch(sb, /sl-sec/);
  assert.match(ui, /capLayout\(card\.rows, capFree\)/); assert.match(sb, /capLayout\(card\.rows, false\)/);
  const css = readFileSync(new URL('css/expert.css', R), 'utf8') + readFileSync(new URL('css/dialogs.css', R), 'utf8');
  assert.match(css, /\.x-lcap \{[^}]*text-overflow: ellipsis;[^}]*pointer-events: none;/);
  assert.match(css, /#songBar \.sl-cap \{[^}]*text-overflow: ellipsis;[^}]*pointer-events: none;/);
});
