// Version scheme (tools/tcversion.py): APP_VERSION is YYYY.MM.DD.N, the release date plus a counter from 1.
// bump-version.py, check-version.py and check-bump.py use it; legacy 112.x versions sort before any date.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const TOOLS = join(ROOT, 'tools');
const py = code => spawnSync('python3', ['-c', 'import sys; sys.path.insert(0, ' + JSON.stringify(TOOLS) + '); import tcversion as t, datetime as d\n' + code], { encoding: 'utf8' });
const out = code => { const r = py(code); assert.equal(r.status, 0, r.stderr); return r.stdout.trim(); };

test('valid and invalid YYYY.MM.DD.N versions', () => {
  for (const v of ['2026.11.21.1', '2026.11.21.2', '2026.11.21.12', '2027.01.01.1', '2028.02.29.1']) assert.equal(out(`print(t.is_valid(${JSON.stringify(v)}))`), 'True', v);
  for (const v of ['112.16', '112.17', '2026.11.21', '2026.11.21.0', '2026.11.21.01', '2026.1.21.1', '2026.11.1.1', '2026.13.01.1', '2026.02.30.1', '2027.02.29.1', '2026.11.21.1-web', ''])
    assert.equal(out(`print(t.is_valid(${JSON.stringify(v)}))`), 'False', v);
});

test('ordering: legacy 112.x < date versions, then by date, then by counter (numerically)', () => {
  const order = ['112.9', '112.16', '112.17', '2026.11.21.1', '2026.11.21.2', '2026.11.21.10', '2026.11.22.1', '2026.12.01.1', '2027.01.01.1'];
  const sorted = JSON.parse(out(`import json; v=${JSON.stringify(order)}; print(json.dumps(sorted(reversed(v), key=t.key)))`));
  assert.deepEqual(sorted, order);
  assert.notEqual(py('t.key("1.2.3")').status, 0, 'a version in neither scheme is an error');
});

test('next version: .1 on a new day, the next counter on the same day, never backwards', () => {
  assert.equal(out('print(t.next_version("112.16", d.date(2026, 11, 21)))'), '2026.11.21.1');
  assert.equal(out('print(t.next_version("2026.11.21.1", d.date(2026, 11, 21)))'), '2026.11.21.2');
  assert.equal(out('print(t.next_version("2026.11.21.9", d.date(2026, 11, 21)))'), '2026.11.21.10');
  assert.equal(out('print(t.next_version("2026.11.21.3", d.date(2026, 11, 22)))'), '2026.11.22.1');
  assert.notEqual(py('t.next_version("2026.11.22.1", d.date(2026, 11, 21))').status, 0);
});

function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'tc-ver-'));
  for (const f of ['index.html', 'sw.js', 'css', 'js', 'manifest.webmanifest', 'tools']) cpSync(join(ROOT, f), join(dir, f), { recursive: true });
  const git = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' });
  git('init', '-q'); git('-c', 'user.email=t@t', '-c', 'user.name=t', 'add', '-A'); git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'base');
  return { dir, git, run: (tool, ...a) => spawnSync('python3', [join(dir, 'tools', tool), ...a], { cwd: dir, encoding: 'utf8' }) };
}
const V = /APP_VERSION = "([^"]+)"/.exec(readFileSync(join(ROOT, 'js/version.js'), 'utf8'))[1];
const ver = dir => /APP_VERSION = "([^"]+)"/.exec(readFileSync(join(dir, 'js/version.js'), 'utf8'))[1];

test('bump-version.py takes a later YYYY.MM.DD.N, refuses a bad or older one, and check-version / check-bump agree', () => {
  const r = repo();
  try {
    assert.notEqual(r.run('bump-version.py', '112.99').status, 0, 'legacy numbers are no longer accepted');
    assert.notEqual(r.run('bump-version.py', '2026.11.21.0').status, 0, 'counter starts at 1');
    assert.notEqual(r.run('bump-version.py', '2026.02.30.1').status, 0, 'not a real date');
    assert.notEqual(r.run('bump-version.py', V).status, 0, 'same version');
    assert.notEqual(r.run('bump-version.py', '2026.11.20.1').status, 0, 'an earlier date');
    assert.equal(ver(r.dir), V, 'refused bumps change nothing');
    const next = out(`p=t.parse_date_version(${JSON.stringify(V)}); print('%04d.%02d.%02d.%d' % (p[0].year, p[0].month, p[0].day, p[1] + 1))`);
    const b = r.run('bump-version.py', next); assert.equal(b.status, 0, b.stdout + b.stderr);
    assert.equal(ver(r.dir), next);
    assert.match(readFileSync(join(r.dir, 'index.html'), 'utf8'), new RegExp('\\?v=' + next.replace(/\./g, '\\.') + '"'));
    assert.equal(r.run('check-version.py').status, 0);
    const c = r.run('check-bump.py', 'HEAD'); assert.equal(c.status, 0, c.stdout);
    // An app change after a bump that goes backwards fails check-bump.
    r.git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qam', 'bump');
    const vf = join(r.dir, 'js/version.js');
    writeFileSync(vf, readFileSync(vf, 'utf8').replace(/APP_VERSION = "[^"]+"/, 'APP_VERSION = "' + V + '"'));
    const back = r.run('check-bump.py', 'HEAD'); assert.equal(back.status, 1, back.stdout); assert.match(back.stdout, /must go up/);
  } finally { rmSync(r.dir, { recursive: true, force: true }); }
});

test('check-bump.py accepts 112.16 (production before the date scheme) -> the repo version', () => {
  const r = repo();
  try {
    const vf = join(r.dir, 'js/version.js');
    // Make the base commit look like main at 112.16, then restore the repo version on top.
    const cur = readFileSync(vf, 'utf8');
    writeFileSync(vf, cur.replace(/APP_VERSION = "[^"]+"/, 'APP_VERSION = "112.16"'));
    r.git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qam', 'pretend 112.16');
    writeFileSync(vf, cur);
    r.git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qam', 'date version');
    const c = r.run('check-bump.py', 'HEAD~1'); assert.equal(c.status, 0, c.stdout); assert.match(c.stdout, new RegExp('112\\.16 -> ' + V.replace(/\./g, '\\.')));
  } finally { rmSync(r.dir, { recursive: true, force: true }); }
});

test('check-version.py fails a non YYYY.MM.DD.N APP_VERSION', () => {
  const r = repo();
  try {
    const vf = join(r.dir, 'js/version.js');
    writeFileSync(vf, readFileSync(vf, 'utf8').replace(/APP_VERSION = "[^"]+"/, 'APP_VERSION = "2026.11.21.0"').replace(/BUILD_ID = "[^"]+"/, 'BUILD_ID = "2026.11.21.0"'));
    const c = r.run('check-version.py'); assert.equal(c.status, 1); assert.match(c.stdout, /not YYYY\.MM\.DD\.N/);
  } finally { rmSync(r.dir, { recursive: true, force: true }); }
});
