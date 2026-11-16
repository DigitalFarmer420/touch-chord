// Offline service worker: every referenced runtime asset is precached, versions
// come from APP_VERSION (never hardcoded), ?test=1 does not change install/wait,
// and window.tc.applyUpdate() refuses or defers while transport is playing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { posix as pathPosix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { shouldApplyUpdate, makeApplyUpdate, isNativeWrapper, serviceWorkerScriptUrl, cacheNameFor, obsoleteCaches } from '../../js/offline-update.js';

const ROOT = new URL('../../', import.meta.url);
const rootPath = fileURLToPath(ROOT);

function read(rel) {
  return readFileSync(new URL(rel, ROOT), 'utf8');
}

function loadPrecache() {
  const sw = read('sw.js');
  const m = sw.match(/var PRECACHE = \[([\s\S]*?)\];/);
  assert.ok(m, 'PRECACHE list in sw.js');
  return { sw, paths: [...m[1].matchAll(/"([^"]+)"/g)].map(x => x[1]) };
}

function stripQuery(u) {
  return u.split('?')[0].split('#')[0];
}

function resolveFrom(fileRel, ref) {
  const baseDir = pathPosix.dirname(fileRel);
  let cleaned = stripQuery(ref.trim().replace(/['"]/g, ''));
  if (!cleaned || cleaned.startsWith('data:') || /^[a-z]+:/i.test(cleaned)) return null;
  if (cleaned.startsWith('/')) return cleaned.replace(/^\//, '');
  const joined = pathPosix.normalize(pathPosix.join(baseDir, cleaned));
  return joined.replace(/^\.\//, '').replace(/^(\.\.\/)+/, '');
}

function refsFromSource(fileRel, text, kind) {
  const found = new Set();
  const add = (raw) => {
    const r = resolveFrom(fileRel, raw);
    if (r && !r.startsWith('http') && r !== '.') found.add(r);
  };
  if (kind === 'js') {
    for (const m of text.matchAll(/(?:from|import)\s*\(?\s*["'](\.[^"']+)["']/g)) add(m[1]);
    for (const m of text.matchAll(/import\(\s*["'](\.[^"']+)["']\s*\)/g)) add(m[1]);
  }
  if (kind === 'html') {
    for (const m of text.matchAll(/(?:src|href)="([^"]+)"/g)) add(m[1]);
  }
  if (kind === 'css') {
    for (const m of text.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)) add(m[2]);
  }
  if (kind === 'manifest') {
    for (const m of text.matchAll(/"src"\s*:\s*"([^"]+)"/g)) add(m[1]);
    for (const m of text.matchAll(/"start_url"\s*:\s*"([^"]+)"/g)) add(m[1]);
  }
  return found;
}

function collectReferenced() {
  const refs = new Set();
  const idx = 'index.html';
  for (const r of refsFromSource(idx, read(idx), 'html')) refs.add(r);
  refs.add('index.html');
  refs.add('manifest.webmanifest');
  for (const r of refsFromSource('manifest.webmanifest', read('manifest.webmanifest'), 'manifest')) refs.add(r);

  // Walk JS/CSS reachable from index, plus every runtime module already in the tree that index pulls in.
  const queue = [...refs];
  const seen = new Set();
  while (queue.length) {
    const rel = queue.pop();
    if (seen.has(rel)) continue;
    seen.add(rel);
    const abs = new URL(rel, ROOT);
    if (!existsSync(fileURLToPath(abs))) continue;
    if (rel.endsWith('.js')) {
      for (const r of refsFromSource(rel, read(rel), 'js')) {
        refs.add(r);
        queue.push(r);
      }
    }
    if (rel.endsWith('.css')) {
      for (const r of refsFromSource(rel, read(rel), 'css')) {
        refs.add(r);
        queue.push(r);
      }
    }
  }
  // Register URL is constructed, not an import — still a runtime asset, but the
  // browser fetches sw.js for updates outside the precache on purpose.
  refs.delete('sw.js');
  refs.delete('./');
  refs.delete('.');
  return refs;
}

test('every asset referenced by index, JS, CSS or the manifest is in PRECACHE', () => {
  const { paths } = loadPrecache();
  const set = new Set(paths);
  const missing = [];
  for (const r of collectReferenced()) {
    if (!set.has(r)) missing.push(r);
  }
  assert.deepEqual(missing, [], 'referenced assets missing from PRECACHE');
});

test('every PRECACHE path exists on disk', () => {
  const { paths } = loadPrecache();
  const missing = paths.filter(p => !existsSync(fileURLToPath(new URL(p, ROOT))));
  assert.deepEqual(missing, [], 'PRECACHE entries with no file');
});

test('sw.js does not hardcode an APP_VERSION or a ?v= number', () => {
  const { sw, paths } = loadPrecache();
  assert.doesNotMatch(sw, /112\.\d+/);
  assert.doesNotMatch(sw, /\?v=\d/);
  for (const p of paths) {
    assert.doesNotMatch(p, /\?v=/);
    assert.doesNotMatch(p, /112\.\d+/);
  }
  // Suffix is appended from APP_VERSION at install time.
  assert.match(sw, /APP_VERSION/);
  assert.match(sw, /readAppVersion/);
  assert.match(sw, /\?v=" \+ version/);
});

test('?test=1 does not change service worker install or wait behaviour', () => {
  const { sw } = loadPrecache();
  const off = read('js/offline.js');
  const upd = read('js/offline-update.js');
  for (const [name, src] of [['sw.js', sw], ['js/offline.js', off], ['js/offline-update.js', upd]]) {
    assert.doesNotMatch(src, /[?&]test=1/, name + ' must not branch on the test query');
    assert.doesNotMatch(src, /location\.search/, name);
  }
  // skipWaiting only in the message handler, never on install or activate.
  const install = sw.slice(sw.indexOf('addEventListener("install"'), sw.indexOf('addEventListener("activate"'));
  const activate = sw.slice(sw.indexOf('addEventListener("activate"'), sw.indexOf('addEventListener("message"'));
  assert.doesNotMatch(install, /skipWaiting/);
  assert.doesNotMatch(activate, /skipWaiting/);
  assert.doesNotMatch(activate, /clients\.claim/);
  assert.match(sw, /type === "SKIP_WAITING"/);
  assert.match(sw, /self\.skipWaiting\(\)/);
});

test('the service worker is registered as sw.js?v=APP_VERSION', () => {
  const off = read('js/offline.js');
  assert.match(off, /import \{ APP_VERSION \} from "\.\/version\.js\?v=/);
  assert.match(off, /new URL\("sw\.js\?v=" \+ APP_VERSION/);
  assert.doesNotMatch(off, /new URL\("sw\.js"/);
  const { sw } = loadPrecache();
  assert.match(sw, /new URL\(self\.location\)\.searchParams\.get\("v"\)/);
  assert.match(sw, /fetchVersionJs/);
});

test('a version bump changes the registered script URL and the cache name', () => {
  assert.equal(serviceWorkerScriptUrl('112.13'), 'sw.js?v=112.13');
  assert.equal(serviceWorkerScriptUrl('112.14'), 'sw.js?v=112.14');
  assert.notEqual(serviceWorkerScriptUrl('112.13'), serviceWorkerScriptUrl('112.14'));
  const scope = '/touch-chord-dev/';
  assert.equal(cacheNameFor(scope, '112.13'), 'touch-chord/touch-chord-dev/112.13');
  assert.equal(cacheNameFor(scope, '112.14'), 'touch-chord/touch-chord-dev/112.14');
  assert.notEqual(cacheNameFor(scope, '112.13'), cacheNameFor(scope, '112.14'));
  const { sw } = loadPrecache();
  assert.match(sw, /"touch-chord" \+ scopePath\(\) \+ version/);
});

test('activate deletes only this scope\'s old cache after a version bump', () => {
  const keys = [
    'touch-chord/touch-chord-dev/112.13',
    'touch-chord/touch-chord-dev/112.14',
    'touch-chord/touch-chord/112.13',
    'touch-chord/touch-chord/112.14',
    'unrelated-cache'
  ];
  assert.deepEqual(obsoleteCaches(keys, '/touch-chord-dev/', '112.14'), ['touch-chord/touch-chord-dev/112.13']);
  assert.deepEqual(obsoleteCaches(keys, '/touch-chord/', '112.14'), ['touch-chord/touch-chord/112.13']);
  assert.deepEqual(obsoleteCaches(keys, '/touch-chord-dev/', '112.13'), ['touch-chord/touch-chord-dev/112.14']);
  const { sw } = loadPrecache();
  assert.match(sw, /obsoleteCaches\(keys, version\)/);
  assert.match(sw, /k\.indexOf\(prefix\) === 0 && k !== keep/);
});

test('shouldApplyUpdate: no waiting, playing defers, idle and paused apply', () => {
  assert.equal(shouldApplyUpdate('idle', false), 'none');
  assert.equal(shouldApplyUpdate('playing', false), 'none');
  assert.equal(shouldApplyUpdate('playing', true), 'deferred');
  assert.equal(shouldApplyUpdate('idle', true), 'apply');
  assert.equal(shouldApplyUpdate('paused', true), 'apply');
});

function makeIo(init) {
  const log = { skip: 0, reload: 0 };
  const io = {
    transport: init.transport || 'idle',
    waiting: init.waiting === undefined ? { id: 1 } : init.waiting,
    getTransport() { return io.transport; },
    getWaiting() { return io.waiting; },
    postSkipWaiting() { log.skip++; },
    reload() { log.reload++; }
  };
  return { io, log, api: makeApplyUpdate(io) };
}

test('applyUpdate() returns false and is a no-op when no worker is waiting', () => {
  const { api, log } = makeIo({ waiting: null, transport: 'idle' });
  assert.equal(api.applyUpdate(), false);
  assert.equal(log.skip, 0);
  assert.equal(log.reload, 0);
});

test('applyUpdate() does nothing and returns deferred while transport is playing', () => {
  const { api, log, io } = makeIo({ transport: 'playing' });
  assert.equal(api.applyUpdate(), 'deferred');
  assert.equal(log.skip, 0);
  assert.equal(log.reload, 0);
  assert.equal(api.isDeferred(), true);
  // A second call while still playing stays deferred.
  assert.equal(api.applyUpdate(), 'deferred');
  assert.equal(log.skip, 0);
  io.transport = 'playing';
  api.onTransport('playing');
  assert.equal(log.skip, 0);
  assert.equal(log.reload, 0);
});

test('applyUpdate() switches and reloads when transport is idle', () => {
  const { api, log } = makeIo({ transport: 'idle' });
  assert.equal(api.applyUpdate(), true);
  assert.equal(log.skip, 1);
  assert.equal(log.reload, 1);
  assert.equal(api.isDeferred(), false);
});

test('applyUpdate() switches and reloads when transport is paused', () => {
  const { api, log } = makeIo({ transport: 'paused' });
  assert.equal(api.applyUpdate(), true);
  assert.equal(log.skip, 1);
  assert.equal(log.reload, 1);
});

test('a deferred applyUpdate runs once transport becomes idle or paused', () => {
  const { api, log, io } = makeIo({ transport: 'playing' });
  assert.equal(api.applyUpdate(), 'deferred');
  io.transport = 'idle';
  api.onTransport('idle');
  assert.equal(log.skip, 1);
  assert.equal(log.reload, 1);
  assert.equal(api.isDeferred(), false);

  const b = makeIo({ transport: 'playing' });
  assert.equal(b.api.applyUpdate(), 'deferred');
  b.io.transport = 'paused';
  b.api.onTransport('paused');
  assert.equal(b.log.skip, 1);
  assert.equal(b.log.reload, 1);
});

test('onTransport does not apply when nothing was deferred', () => {
  const { api, log, io } = makeIo({ transport: 'playing' });
  io.transport = 'idle';
  api.onTransport('idle');
  assert.equal(log.skip, 0);
  assert.equal(log.reload, 0);
});

test('isNativeWrapper detects Capacitor, cordova, and wrapper protocols', () => {
  assert.equal(isNativeWrapper(null), false);
  assert.equal(isNativeWrapper({ location: { protocol: 'https:' } }), false);
  assert.equal(isNativeWrapper({ location: { protocol: 'http:' }, Capacitor: {} }), true);
  assert.equal(isNativeWrapper({ cordova: {}, location: { protocol: 'https:' } }), true);
  assert.equal(isNativeWrapper({ location: { protocol: 'capacitor:' } }), true);
  assert.equal(isNativeWrapper({ location: { protocol: 'ionic:' } }), true);
  assert.equal(isNativeWrapper({ location: { protocol: 'file:' } }), true);
});
