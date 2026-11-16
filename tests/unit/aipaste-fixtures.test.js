// Fixture files under tests/fixtures/upload/ai-paste/: messy AI pastes and the
// parsed result of each (normalized JSON + the loaded song).
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import './dom-stub.js';
const R = new URL('../../', import.meta.url);
const V = readFileSync(new URL('js/version.js', R), 'utf8').match(/APP_VERSION = "([^"]+)"/)[1];
const html = readFileSync(new URL('index.html', R), 'utf8');
const schemaOf = id => html.match(new RegExp('<script type="application/json" id="' + id + '">([\\s\\S]*?)</script>'))[1];
const realDoc = globalThis.document;
globalThis.document = new Proxy(realDoc, { get: (t, k) => k === 'getElementById' ? (id => /^songSchema(13)?Json$/.test(id) ? { textContent: schemaOf(id) } : t.getElementById(id)) : t[k] });
const S = await import(`../../js/state.js?v=${V}`); S.boot();
const U = await import(`../../js/songs/upload.js?v=${V}`); U.boot();
const A = await import(`../../js/songs/aipaste.js?v=${V}`);

const DIR = new URL('tests/fixtures/upload/ai-paste/', R);
const NAMES = readdirSync(DIR).filter(f => f.endsWith('.paste.txt')).map(f => f.replace(/\.paste\.txt$/, '')).sort();

function load(text) {
  const b = U.upLoadBegin(text, { defer: true });
  if (b.pending) return { ok: true, song: b.pending.song, warnings: b.pending.warnings || [], errors: [] };
  if (b.done) return { ok: !!b.done.ok, errors: b.done.errors || [], warnings: b.done.warnings || [], song: b.done.song || null };
  b.list.items.forEach((_, i) => U.upLoadCheck(b.list, i));
  const row = (b.list.rows || []).find(x => x.song) || (b.list.rows || [])[0] || {};
  return { ok: !!row.song, song: row.song || null, warnings: (b.list.warnings || []).concat(row.warnings || []), errors: row.errors || [] };
}

test('tests/fixtures/upload/ai-paste has the agreed messy-paste cases', () => {
  assert.deepEqual(NAMES, ['bom-nbsp', 'curly-quotes', 'fenced', 'lyric-safety', 'prose', 'trailing-commas', 'version-alias']);
  for (const name of NAMES) {
    assert.ok(readdirSync(DIR).includes(name + '.expected.json'), name + '.expected.json');
  }
});

for (const name of NAMES) {
  test('fixture ' + name + ' loads and matches its expected JSON', () => {
    const paste = readFileSync(new URL(name + '.paste.txt', DIR));
    const text = paste.toString('utf8');
    const expected = JSON.parse(readFileSync(new URL(name + '.expected.json', DIR), 'utf8'));
    if (name === 'bom-nbsp') {
      assert.equal(paste[0], 0xef);
      assert.equal(paste[1], 0xbb);
      assert.equal(paste[2], 0xbf);
      assert.ok(text.includes('\u00a0'), 'NBSP in the paste');
    }
    const n = A.normalizeAiPaste(text);
    assert.equal(n.error, null, name + ' normalize: ' + n.error);
    assert.deepEqual(JSON.parse(n.text), expected.normalized);
    const r = load(text);
    assert.equal(r.ok, true, name + ' load errors: ' + JSON.stringify(r.errors));
    assert.deepEqual({ ok: r.ok, warnings: r.warnings, errors: r.errors, song: r.song }, expected.load);
  });
}

test('lyric-safety: a mark past the end of the line is moved to the end', () => {
  const expected = JSON.parse(readFileSync(new URL('lyric-safety.expected.json', DIR), 'utf8'));
  const ln = expected.load.song.sections[0].lyrics[0];
  assert.equal(ln.text, 'Hello world');
  assert.equal(ln.markers[1].charIndex, ln.text.length);
  assert.ok(expected.load.warnings.some(w => /moved to the end/.test(w)));
});

test('curly-quotes: the lyric/title apostrophe is kept', () => {
  const expected = JSON.parse(readFileSync(new URL('curly-quotes.expected.json', DIR), 'utf8'));
  assert.equal(expected.load.song.song.title, 'Don\u2019t stop');
});
