import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs'; import { execFileSync } from 'node:child_process';
const root = new URL('../../', import.meta.url).pathname;
const V = readFileSync(root + 'js/version.js', 'utf8').match(/APP_VERSION = "([^"]+)"/)[1];
const walk = d => readdirSync(d).flatMap(f => statSync(d + '/' + f).isDirectory() ? walk(d + '/' + f) : [d + '/' + f]);
test('tools/check-version.py passes', () => { execFileSync('python3', ['tools/check-version.py'], { cwd: root }); });
test('APP_VERSION is a version number', () => assert.match(V, /^\d+(\.\d+)*$/));
test('every relative import, link, script and image carries ?v=APP_VERSION', () => {
  const bad = [];
  for (const f of [root + 'index.html', ...walk(root + 'js'), ...walk(root + 'css')]) {
    const s = readFileSync(f, 'utf8');
    for (const m of s.matchAll(/(?:from|import)\s*\(?\s*"(\.[^"]+)"|(?:src|href)="((?:js|css|images)\/[^"]+)"/g)) { const u = m[1] || m[2]; if (!u.endsWith('?v=' + V)) bad.push(f.slice(root.length) + ': ' + u); }
  }
  assert.deepEqual(bad, []);
});
test('index.html loads boot-early.js (classic) and main.js (module) only', () => {
  const h = readFileSync(root + 'index.html', 'utf8');
  assert.ok(h.includes(`<script src="js/boot-early.js?v=${V}"></script>`));
  assert.ok(h.includes(`<script type="module" src="js/main.js?v=${V}"></script>`));
  assert.equal((h.match(/<script(?![^>]*application\/json)[^>]*>/g) || []).length, 2, 'no other scripts in index.html');
});
test('the DEV badge script still finds </head>, <title>, </body>', () => {
  const h = readFileSync(root + 'index.html', 'utf8'); for (const t of ['</head>', '<title>', '</body>']) assert.ok(h.includes(t), t);
});
