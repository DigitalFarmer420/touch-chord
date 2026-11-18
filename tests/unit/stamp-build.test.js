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
  for (const f of ['index.html', 'sw.js', 'css', 'js', 'manifest.webmanifest']) cpSync(join(ROOT, f), join(dir, f), { recursive: true });
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
    for (const f of [join(dir, 'index.html'), join(dir, 'manifest.webmanifest'), ...walk(join(dir, 'js')), ...walk(join(dir, 'css'))]) {
      for (const m of readFileSync(f, 'utf8').matchAll(/\?v=([0-9A-Za-z.\-]+)["']/g)) tags.add(m[1]);
    }
    assert.deepEqual([...tags], [id]);
    assert.ok(readFileSync(join(dir, 'manifest.webmanifest'), 'utf8').includes('?v=' + id));
    assert.ok(!readFileSync(join(dir, 'manifest.webmanifest'), 'utf8').includes('?v=' + V + '"'));
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

function workflowJob(wf, id) {
  const marker = `\n  ${id}:\n`;
  const start = wf.indexOf(marker);
  assert.ok(start >= 0, id);
  const rest = wf.slice(start + 1);
  const next = rest.slice(1).search(/\n  [a-z0-9-]+:\n/);
  return next === -1 ? rest : rest.slice(0, next + 1);
}

test('the dev deploy workflow stamps the site copy with the deployed commit', () => {
  const wf = readFileSync(join(ROOT, '.github/workflows/deploy-web.yml'), 'utf8');
  const dev = workflowJob(wf, 'deploy-dev');
  assert.match(dev, /python3 src\/tools\/stamp-build\.py site "\$\(git -C src rev-parse HEAD\)"/);
  assert.ok(dev.indexOf('stamp-build.py') > dev.indexOf('rsync -a'), 'stamps after copying the tree');
  assert.ok(dev.indexOf('stamp-build.py') < dev.indexOf('git add -A'), 'stamps before committing the site');
  assert.match(dev, /inject-dev-badge\.py/);
});

test('a failed gate skips both publishes, and production has no DEV badge', () => {
  const wf = readFileSync(join(ROOT, '.github/workflows/deploy-web.yml'), 'utf8');
  for (const id of ['unit', 'version', 'smoke']) assert.ok(workflowJob(wf, id).length > 0);
  const dev = workflowJob(wf, 'deploy-dev');
  const stage = workflowJob(wf, 'stage-prod');
  const prod = workflowJob(wf, 'deploy-prod');
  const bump = workflowJob(wf, 'bump');
  assert.match(dev, /needs: \[unit, version, smoke\]/);
  assert.match(dev, /needs\.unit\.result == 'success'/);
  assert.match(dev, /needs\.version\.result == 'success'/);
  assert.match(dev, /needs\.smoke\.result == 'success'/);
  assert.match(dev, /refs\/heads\/develop/);
  assert.equal(dev.includes('needs.bump'), false, 'develop may publish a same-version app change');
  assert.match(dev, /git push origin HEAD:main/);
  assert.match(stage, /needs: \[unit, version, smoke, bump\]/);
  assert.match(stage, /needs\.smoke\.result == 'success'/);
  assert.match(stage, /needs\.bump\.result == 'success'/);
  assert.match(stage, /refs\/heads\/main/);
  assert.match(stage, /python3 src\/tools\/stamp-build\.py site "\$\(git -C src rev-parse HEAD\)"/);
  assert.equal(stage.includes('inject-dev-badge'), false);
  assert.equal(stage.includes('git push'), false);
  assert.match(prod, /needs: \[unit, version, smoke, bump, stage-prod\]/);
  assert.match(prod, /needs\.stage-prod\.result == 'success'/);
  assert.match(prod, /actions\/deploy-pages@v4/);
  assert.match(prod, /environment:\n\s+name: github-pages/);
  assert.equal(prod.includes('inject-dev-badge'), false);
  assert.equal(prod.includes('git push'), false);
  assert.match(bump, /tools\/check-bump\.py/);
  assert.match(bump, /refs\/heads\/main/);
  for (const job of [dev, stage, prod]) {
    assert.equal(job.includes('if: always()'), false);
    assert.equal(job.includes('if: failure()'), false);
  }
  assert.match(wf, /branches: \[develop, main/);
});

test('the repo itself is unstamped (BUILD_ID === APP_VERSION) so local runs and the APK use APP_VERSION', () => {
  const ver = readFileSync(join(ROOT, 'js/version.js'), 'utf8');
  assert.equal(/BUILD_ID = "([^"]+)"/.exec(ver)[1], V);
  assert.ok(!readFileSync(join(ROOT, 'index.html'), 'utf8').includes('name="tc-build"'));
  assert.ok(existsSync(join(ROOT, 'tools/check-bump.py')));
});
