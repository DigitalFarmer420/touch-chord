// fix/ai-paste-robust: pre-validator for AI song pastes (fences, prose, curly quotes,
// trailing commas, BOM / NBSP, version aliases). One test per case, plus a clean-JSON
// regression and an already-valid fixture so good input is unchanged.
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
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
const fx = f => readFileSync(new URL('tests/fixtures/upload/' + f, R), 'utf8');

function load(text) {
  const b = U.upLoadBegin(text, { defer: true });
  if (b.pending) return { ok: true, single: true, song: b.pending.song, warnings: b.pending.warnings || [] };
  if (b.done) return b.done;
  b.list.items.forEach((_, i) => U.upLoadCheck(b.list, i));
  return { ok: true, list: true, rows: b.list.rows, warnings: b.list.warnings };
}
const loaded = r => !!(r.ok && (r.song || (r.rows && r.rows.some(x => x.song))));
const hash = r => createHash('sha256').update(JSON.stringify(r)).digest('hex');
const BASE = fx('diag-v12-single.json');
const ANH = fx('anh-v13.json');

test('clean JSON is unchanged by normalizeAiPaste', () => {
  const n = A.normalizeAiPaste(BASE);
  assert.equal(n.error, null);
  assert.equal(n.repaired, false);
  assert.equal(n.extracted, false);
  assert.equal(n.text, BASE.trim() === BASE ? BASE : n.text);
  assert.deepEqual(JSON.parse(n.text), JSON.parse(BASE));
  // identity on a compact one-line object too
  const mini = '{"contractVersion":"1.2","songs":[]}';
  assert.equal(A.normalizeAiPaste(mini).text, mini);
  assert.equal(A.normalizeAiPaste(mini).repaired, false);
});

test('an already-valid file loads unchanged (anh-v13.json)', () => {
  const raw = load(ANH);
  const again = load(ANH);
  assert.ok(loaded(raw), JSON.stringify(raw.errors || raw.rows && raw.rows[0] && raw.rows[0].errors));
  assert.equal(hash(raw), hash(again));
  const n = A.normalizeAiPaste(ANH);
  assert.equal(n.repaired, false);
  assert.deepEqual(JSON.parse(n.text), JSON.parse(ANH));
  const fromNorm = load(n.text);
  assert.equal(hash(fromNorm), hash(raw));
});

test('```json / ``` code fences are stripped', () => {
  const t = 'Here you go:\n```json\n' + BASE + '\n```\n';
  const n = A.normalizeAiPaste(t);
  assert.equal(n.error, null);
  assert.ok(n.fenced);
  assert.deepEqual(JSON.parse(n.text), JSON.parse(BASE));
  const r = load(t);
  assert.ok(loaded(r), JSON.stringify(r.errors));
});

test('prose before or after the JSON is ignored (outermost balanced object)', () => {
  const t = 'Sure — here is { the song } you asked for:\n' + BASE + '\nEnjoy, and watch the} braces in this sentence.';
  const n = A.normalizeAiPaste(t);
  assert.equal(n.error, null);
  assert.ok(n.extracted);
  assert.deepEqual(JSON.parse(n.text), JSON.parse(BASE));
  const r = load(t);
  assert.ok(loaded(r), JSON.stringify(r.errors));
});

test('curly quotes used as delimiters are normalized; apostrophes inside strings survive', () => {
  const inner = 'Don\u2019t stop';
  const t = '{\u201ctitle\u201d: \u201c' + inner + '\u201d, \u2018n\u2019: 1,}';
  const n = A.normalizeAiPaste(t);
  assert.equal(n.error, null);
  assert.ok(n.repaired);
  assert.deepEqual(JSON.parse(n.text), { title: inner, n: 1 });
  // A real song paste with “ ” around every JSON string; the lyric apostrophe stays
  const song = BASE.replace('"Morning Light"', '"Don\u2019t stop"');
  const mixed = song.replace(/"([^"]*)"/g, '\u201c$1\u201d');
  const obj = JSON.parse(A.normalizeAiPaste(mixed).text);
  assert.equal(obj.song.title, 'Don\u2019t stop');
  const r = load(mixed);
  assert.ok(loaded(r), JSON.stringify(r.errors));
  const title = r.song ? r.song.song.title : r.rows[0].song.song.title;
  assert.equal(title, 'Don\u2019t stop');
});

test('trailing commas before } or ] are removed', () => {
  const t = BASE.replace(/\}(\s*)\]/g, '},$1]').replace(/"(\s*)\}/g, '",$1}');
  assert.throws(() => JSON.parse(t));
  const n = A.normalizeAiPaste(t);
  assert.ok(n.repaired);
  assert.deepEqual(JSON.parse(n.text), JSON.parse(BASE));
  assert.ok(loaded(load(t)));
});

test('BOM and non-breaking spaces are cleaned', () => {
  const t = '\ufeff' + BASE.replace(/\n {2}/g, '\n\u00a0\u00a0');
  assert.ok(t.charCodeAt(0) === 0xfeff);
  const n = A.normalizeAiPaste(t);
  assert.ok(n.repaired);
  assert.deepEqual(JSON.parse(n.text), JSON.parse(BASE));
  assert.ok(loaded(load(t)));
});

test('a missing version field defaults to the current format (v1.3 shape) or 1.2', () => {
  const env = JSON.parse(BASE);
  delete env.contractVersion;
  const d = A.defaultAiVersion(JSON.parse(JSON.stringify(env)));
  assert.equal(d.contractVersion, '1.2'); // v1.2 shape
  const r = load(JSON.stringify(env));
  assert.ok(loaded(r), JSON.stringify(r.errors));
  assert.ok((r.warnings || []).some(w => /contractVersion is missing; read as 1\.2/.test(w)));
  // a v1.3-shaped form with no version defaults to 1.3
  const s13 = { song: { title: 'T', artist: 'A', key: { tonic: 'C', mode: 'major' } },
    timing: { bpm: 120, timeSignature: '4/4' }, form: ['v'],
    sections: [{ id: 'v', type: 'verse', bars: [{ bar: 1, chords: [{ beat: 1, chord: 'C', confidence: 1 }] }] }] };
  assert.equal(A.defaultAiVersion(JSON.parse(JSON.stringify(s13))).contractVersion, '1.3');
  const r13 = load(JSON.stringify(s13));
  assert.ok(loaded(r13), JSON.stringify(r13.errors));
});

test('version aliases "1.3", 1.3 and "v1.3" are accepted; a wrong version is a clear error', () => {
  const env = JSON.parse(fx('diag-v13-envelope.json'));
  // numeric and v-prefix on a v1.2-shaped envelope still go through aliasing
  const v12 = JSON.parse(BASE);
  for (const alias of ['1.2', 1.2, 'v1.2']) {
    const o = { ...v12, contractVersion: alias };
    const n = A.normalizeAiVersion(o);
    assert.equal(n.error, null, String(alias));
    assert.equal(n.value.contractVersion, '1.2');
    assert.ok(loaded(load(JSON.stringify({ ...v12, contractVersion: alias }))), String(alias));
  }
  for (const alias of ['1.3', 1.3, 'v1.3']) {
    const n = A.aliasVersion(alias);
    assert.equal(n.ok, true);
    assert.equal(n.value, '1.3');
  }
  // a `version` field (not contractVersion) is mapped
  const named = { ...v12 }; delete named.contractVersion; named.version = 'v1.2';
  const mapped = A.normalizeAiVersion(named);
  assert.equal(mapped.value.contractVersion, '1.2');
  assert.ok(mapped.warnings.some(w => /version .* read as contractVersion/.test(w)));
  const paste = { ...v12 }; delete paste.contractVersion; paste.version = 'v1.2';
  assert.ok(loaded(load(JSON.stringify(paste))));
  const bad = A.normalizeAiVersion({ ...v12, contractVersion: '2.0' });
  assert.match(bad.error, /can't read \(it reads 1\.2 and 1\.3\)/);
  const rbad = load(JSON.stringify({ ...v12, contractVersion: '2.0' }));
  assert.ok(!loaded(rbad));
  const msg = (rbad.errors || [])[0] ? rbad.errors[0].msg : (rbad.rows && rbad.rows[0] && rbad.rows[0].errors[0].msg);
  assert.match(msg, /can't read \(it reads 1\.2 and 1\.3\)/);
});
