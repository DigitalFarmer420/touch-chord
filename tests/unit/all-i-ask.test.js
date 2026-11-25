// Adele "All I Ask" (a real failing v1.3 paste): loads with no errors, and the final
// chorus / outro modulation to F major is not reported as out of E major.
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import './dom-stub.js';
const R = new URL('../../', import.meta.url);
const V = readFileSync(new URL('js/version.js', R), 'utf8').match(/APP_VERSION = "([^"]+)"/)[1];
const html = readFileSync(new URL('index.html', R), 'utf8');
const schemaOf = id => html.match(new RegExp('<script type="application/json" id="' + id + '">([\\s\\S]*?)</script>'))[1];
const realDoc = globalThis.document;
globalThis.document = new Proxy(realDoc, { get: (t, k) => k === 'getElementById' ? (id => /^songSchema(13)?Json$/.test(id) ? { textContent: schemaOf(id) } : t.getElementById(id)) : t[k] });
const S = await import(`../../js/state.js?v=${V}`); S.boot();
const U = await import(`../../js/songs/upload.js?v=${V}`); U.boot();
const { validateSong } = await import(`../../js/songs/validate.js?v=${V}`);
const fx = readFileSync(new URL('tests/fixtures/songs/all-i-ask.json', R), 'utf8');

function load(text) {
  const b = U.upLoadBegin(text, { defer: true });
  if (b.pending) return { ok: true, single: true, song: b.pending.song, warnings: b.pending.warnings || [], errors: [] };
  if (b.done) return b.done;
  b.list.items.forEach((_, i) => U.upLoadCheck(b.list, i));
  const row = b.list.rows[0];
  return { ok: !row.errors, song: row.song, warnings: row.warnings || [], errors: row.errors || [], title: row.title };
}

test('All I Ask fixture loads with 0 errors and keeps title/artist from the JSON', () => {
  const r = load(fx);
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal((r.errors || []).length, 0);
  assert.ok(!(r.errors || []).some(e => /is empty: type it so the AI/.test(e.msg || '')), 'Artist-empty must not fire when the JSON has an artist');
  assert.equal(r.song.song.title, 'All I Ask');
  assert.equal(r.song.song.artist, 'Adele');
  assert.equal(r.song.song.key.tonic, 'E');
  assert.equal(r.song.song.key.mode, 'major');
});

test('All I Ask chorus3 / outro are not flagged as out of E major', () => {
  const r = load(fx);
  assert.ok(r.ok && r.song);
  const flags = validateSong(r.song).flags.filter(f => f.layer === 'key');
  const bad = flags.filter(f => /chorus 3|outro/i.test(f.where.sectionName || f.message));
  assert.equal(bad.length, 0, bad.map(f => f.message).join('\n'));
  assert.equal(flags.length, 0, flags.map(f => f.message).join('\n'));
  // notes survived from13 so the checker can read the key change
  const chorus3 = r.song.sections.find(s => /chorus3/.test(s.id) || (s.type === 'chorus' && /3/.test(s.id)));
  assert.ok(chorus3, 'chorus3 missing');
  assert.match(chorus3.notes || '', /F major/);
});

test('Copy for AI prompt states the tightened song-request rules', () => {
  const p = U.UP_PROMPT;
  assert.match(p, /song\.title/);
  assert.match(p, /song\.artist/);
  assert.match(p, /TITLE AND ARTIST/);
  assert.match(p, /KEY AND MODULATION/);
  assert.match(p, /"key": \{"tonic"/);
  assert.match(p, /borrowed/);
  assert.match(p, /STRICT JSON ONLY/);
  assert.match(p, /No prose outside the JSON/);
  assert.match(p, /exact field names and types/);
  assert.match(p, /use null for those unknowns/i);
  assert.match(p, /Bar-sum check/);
  assert.match(p, /exactly that one song/);
});

test('All I Ask without chorus3 notes suggests F once, instead of a flag per chord', () => {
  const r = load(fx);
  assert.ok(r.ok && r.song);
  const chorus3 = r.song.sections.find(s => /chorus3/.test(s.id) || (s.type === 'chorus' && /3/.test(s.id || '')));
  const outro = r.song.sections.find(s => s.id === 'outro' || s.type === 'outro');
  assert.ok(chorus3, 'chorus3 missing');
  delete chorus3.notes; delete chorus3.key;
  if (outro) { delete outro.notes; delete outro.key; }
  const flags = validateSong(r.song).flags.filter(f => f.layer === 'key');
  const about = flags.filter(f => /chorus 3|outro/i.test(f.where.sectionName || f.message));
  assert.equal(about.length, 1, about.map(f => f.message).join('\n'));
  assert.match(about[0].message, /looks like F from bar /);
  assert.ok(!about.some(f => /outro/i.test(f.message)), about.map(f => f.message).join('\n'));
});
