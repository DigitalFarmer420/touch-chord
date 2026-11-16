// tools/stamp-build.py: the Pages deploy stamps BUILD_ID = APP_VERSION-<short sha> into a copy of the site.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, cpSync, mkdtempSync, rmSync, readdirSync, statSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const V = /APP_VERSION = "([^"]+)"/.exec(readFileSync(join(ROOT, 'js/version.js'), 'utf8'))[1];
const walk = d => readdirSync(d).flatMap(f => statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]);

function site() {
  const dir = mkdtempSync(join(tmpdir(), 'tc-stamp-'));
  for (const f of ['index.html', 'sw.js', 'css', 'js']) cpSync(join(ROOT, f), join(dir, f), { recursive: true });
  return dir;
}
const stamp = (dir, sha) => spawnSync('python3', [join(ROOT, 'tools/stamp-build.py'), dir, sha], { encoding: 'utf8' });

test('stamping sets BUILD_ID, the tc-build meta and every ?v= tag to APP_VERSION-<short sha>', () => {
  const dir = site();
  try {
    const r = stamp(dir, 'C7A4694ABCDEF0123456789');
    assert.equal(r.status, 0, r.stderr);
    const id = V + '-c7a4694';
    const ver = readFileSync(join(dir, 'js/version.js'), 'utf8');
    assert.match(ver, new RegExp('BUILD_ID = "' + id.replace(/\./g, '\\.') + '"'));
    assert.match(ver, new RegExp('APP_VERSION = "' + V.replace(/\./g, '\\.') + '"'), 'APP_VERSION (the label) is unchanged');
    const html = readFileSync(join(dir, 'index.html'), 'utf8');
    assert.ok(html.includes('<meta name="tc-build" content="' + id + '">'));
    const tags = new Set();
    for (const f of [join(dir, 'index.html'), ...walk(join(dir, 'js')), ...walk(join(dir, 'css'))]) {
      for (const m of readFileSync(f, 'utf8').matchAll(/\?v=([0-9A-Za-z.\-]+)["']/g)) tags.add(m[1]);
    }
    assert.deepEqual([...tags], [id]);
    assert.equal(readFileSync(join(dir, 'sw.js'), 'utf8'), readFileSync(join(ROOT, 'sw.js'), 'utf8'), 'sw.js bytes are not stamped');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('two deploys of the same files with different commits differ in index.html and BUILD_ID', () => {
  const a = site(), b = site();
  try {
    assert.equal(stamp(a, 'aaaaaaa').status, 0);
    assert.equal(stamp(b, 'bbbbbbb').status, 0);
    assert.notEqual(readFileSync(join(a, 'index.html'), 'utf8'), readFileSync(join(b, 'index.html'), 'utf8'));
    assert.notEqual(readFileSync(join(a, 'js/ui/next.js'), 'utf8'), readFileSync(join(b, 'js/ui/next.js'), 'utf8'));
  } finally { rmSync(a, { recursive: true, force: true }); rmSync(b, { recursive: true, force: true }); }
});

test('stamping refuses a bad sha and an already stamped copy', () => {
  const dir = site();
  try {
    assert.notEqual(stamp(dir, 'not-a-sha').status, 0);
    assert.notEqual(stamp(dir, '').status, 0);
    assert.equal(stamp(dir, 'abcdef1').status, 0);
    const again = stamp(dir, 'abcdef2');
    assert.notEqual(again.status, 0);
    assert.match(again.stderr + again.stdout, /already stamped/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('the dev deploy workflow stamps the site copy with the deployed commit', () => {
  const wf = readFileSync(join(ROOT, '.github/workflows/deploy-dev.yml'), 'utf8');
  assert.match(wf, /python3 src\/tools\/stamp-build\.py site "\$\(git -C src rev-parse HEAD\)"/);
  assert.ok(wf.indexOf('stamp-build.py') > wf.indexOf('rsync -a'), 'stamps after copying the tree');
  assert.ok(wf.indexOf('stamp-build.py') < wf.indexOf('git add -A'), 'stamps before committing the site');
});

test('the repo itself is unstamped (BUILD_ID === APP_VERSION) so local runs and the APK use APP_VERSION', () => {
  const ver = readFileSync(join(ROOT, 'js/version.js'), 'utf8');
  assert.equal(/BUILD_ID = "([^"]+)"/.exec(ver)[1], V);
  assert.ok(!readFileSync(join(ROOT, 'index.html'), 'utf8').includes('name="tc-build"'));
  assert.ok(existsSync(join(ROOT, 'tools/check-bump.py')));
});
