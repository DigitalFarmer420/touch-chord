// Deploy-update checks for the offline service worker (PR #15). Local server only.
//
// The app is served under /touch-chord/ (like the prod Pages path) on one origin. Builds are
// made in memory from this tree, nothing is written to disk:
//   A   the tree as it is
//   B   APP_VERSION and every ?v= tag bumped (vA -> vA.9), <meta name="tc-build" content="B">
//       in index.html and globalThis.__TC_BUILD = "B" in js/version.js. sw.js is served
//       byte-for-byte unchanged (it never hardcodes a version), and the check asserts that.
//   A2  same version as A, only index.html (meta A2) and js/boot-early.js
//       (window.__TC_ASSET_MARK = "A2") changed: an asset-only deploy.
// Checks:
//   1. update A->B, sw.js unchanged: within two reloads B's label, HTML and JS (no mix),
//      fetch('js/version.js?v=B') is B's file, sw.js?v=B installs; a cold launch is controlled
//      by sw.js?v=B; A's cache for this scope is gone and another site's cache
//      (touch-chord/touch-chord-dev/...) is kept.
//   2. offline after B is active: an offline reload boots B (label, HTML and JS).
//   3. asset-only change A->A2: the online reload shows A2's HTML with A2's JS, and once the
//      cache is refilled an offline reload shows A2's HTML with A2's JS (never mixed).
//   4. existing install from 971119a: A is served with tests/fixtures/offline/sw-971119a.js
//      (the worker PR #15 shipped at 971119a), then this tree's B. B's label, HTML and JS on
//      the first cold launch, and the controller is sw.js?v=B by the second cold launch.
//
//   node tests/ci/update-ab.mjs                       (this tree)
//   AB_ROOT=/path/to/other/tree node tests/ci/update-ab.mjs

import { createServer } from 'node:http';
import { existsSync, statSync, readFileSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OLD_SW = join(HERE, '../fixtures/offline/sw-971119a.js');
const PREFIX = '/touch-chord/';
const OTHER_CACHE = 'touch-chord/touch-chord-dev/0.0-other-site';
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2'
};
const TEXT = new Set(['.html', '.js', '.css', '.webmanifest', '.json']);
function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function makeServer(root, state) {
  const { vA, vB } = state;
  const tagA = new RegExp('\\?v=' + esc(vA) + '(?![0-9.])', 'g');
  return createServer((q, res) => {
    const path = decodeURIComponent((q.url || '/').split('?')[0]);
    if (!path.startsWith(PREFIX)) { res.writeHead(404); res.end(); return; }
    const rel = path === PREFIX ? 'index.html' : path.slice(PREFIX.length);
    let file = normalize(join(root, rel));
    if (rel === 'sw.js' && state.oldSw) file = OLD_SW;
    else if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    const ext = extname(file);
    let body = readFileSync(file);
    if (state.build !== 'A' && TEXT.has(ext)) {
      let text = body.toString('utf8');
      if (state.build === 'B') {
        text = text.replace(tagA, '?v=' + vB);
        if (rel === 'js/version.js') text = text.split('"' + vA + '"').join('"' + vB + '"') + '\nglobalThis.__TC_BUILD = "B";\n';
        if (rel === 'index.html') text = text.replace('<head>', '<head><meta name="tc-build" content="B">');
      } else if (state.build === 'A2') {
        if (rel === 'index.html') text = text.replace('<head>', '<head><meta name="tc-build" content="A2">');
        if (rel === 'js/boot-early.js') text += '\nwindow.__TC_ASSET_MARK = "A2";\n';
      }
      body = Buffer.from(text, 'utf8');
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  });
}

async function snap(page) {
  await page.waitForFunction(() => {
    const el = document.getElementById('appVersion');
    return el && /Version /.test(el.textContent || '');
  }, null, { timeout: 15000 });
  return page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    const q = w => (w ? new URL(w.scriptURL).search : null);
    const meta = document.querySelector('meta[name="tc-build"]');
    return {
      label: document.getElementById('appVersion').textContent.trim(),
      html: meta ? meta.content : 'A',
      js: globalThis.__TC_BUILD || 'A',
      mark: window.__TC_ASSET_MARK || 'A',
      controller: navigator.serviceWorker.controller ? new URL(navigator.serviceWorker.controller.scriptURL).search : null,
      active: reg ? q(reg.active) : null,
      waiting: reg ? q(reg.waiting) : null,
      caches: await caches.keys()
    };
  });
}

function waitWorker(page, v, ms, states) {
  return page.waitForFunction(async ([v, states]) => {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return false;
    return states.some(s => reg[s] && new URL(reg[s].scriptURL).searchParams.get('v') === v);
  }, [v, states], { timeout: ms, polling: 250 }).then(() => true, () => false);
}

async function installA(page, url, notes, vA) {
  await page.goto(url, { waitUntil: 'load', timeout: 20000 });
  await page.evaluate(() => navigator.serviceWorker.ready);
  let s = await snap(page);
  if (!s.controller) { await page.reload({ waitUntil: 'load' }); s = await snap(page); }
  if (s.label !== 'Version ' + vA || s.controller !== '?v=' + vA) notes.push('A not installed: ' + JSON.stringify(s));
  return s;
}

async function coldLaunch(ctx, page, url) {
  await page.close();
  // Let the browser drop the closed client so a waiting worker can activate.
  await new Promise(r => setTimeout(r, 2000));
  const p = await ctx.newPage();
  await p.goto(url, { waitUntil: 'load', timeout: 20000 });
  return p;
}

const brief = s => JSON.stringify({ label: s.label, html: s.html, js: s.js, controller: s.controller, waiting: s.waiting });

export async function runUpdateCheck(browser, opts = {}) {
  const root = resolve(opts.root || process.env.AB_ROOT || join(HERE, '../..'));
  const record = opts.record || ((n, ok, d) => console.log((ok ? 'PASS' : 'FAIL') + '  ' + n + (d ? '  ' + d : '')));
  const shot = opts.shot || (async () => {});
  const vA = /APP_VERSION\s*=\s*"([^"]+)"/.exec(readFileSync(join(root, 'js/version.js'), 'utf8'))[1];
  const vB = vA + '.9';
  const LB = 'Version ' + vB;

  async function scenario(name, fn) {
    const state = { build: 'A', vA, vB, oldSw: false };
    const srv = makeServer(root, state);
    await new Promise(r => srv.listen(0, '127.0.0.1', r));
    const url = 'http://127.0.0.1:' + srv.address().port + PREFIX + 'index.html?test=1&hour=12';
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, deviceScaleFactor: 1 });
    await ctx.addInitScript(() => { try { localStorage.setItem('touchChord.tour.v1', 'done'); } catch (e) {} });
    const notes = [];
    const box = { page: await ctx.newPage() };
    try {
      const detail = await fn({ ctx, box, url, state, notes });
      if (notes.length) await shot(box.page, name);
      record(name, !notes.length, notes.length ? notes.join(' | ') : detail);
    } catch (e) {
      await shot(box.page, name).catch(() => {});
      record(name, false, notes.concat([(e && e.message || String(e)).split('\n')[0]]).join(' | '));
    } finally {
      await ctx.close();
      srv.close();
    }
  }

  // 1 + 2. A -> B with sw.js unchanged, cache cleanup, then offline on B.
  await scenario('offline update A->B (sw.js unchanged)', async ({ ctx, box, url, state, notes }) => {
    await installA(box.page, url, notes, vA);
    const swA = await box.page.evaluate(async () => (await fetch('sw.js', { cache: 'no-store' })).text());
    await box.page.evaluate(async n => { const c = await caches.open(n); await c.put('/touch-chord-dev/index.html', new Response('other site')); }, OTHER_CACHE);
    state.build = 'B';
    const swB = await box.page.evaluate(async () => (await fetch('sw.js', { cache: 'no-store' })).text());
    if (swA !== swB) notes.push('sw.js bytes differ between A and B (harness)');
    let s;
    for (let i = 0; i < 2; i++) {
      await box.page.reload({ waitUntil: 'load' });
      s = await snap(box.page);
      if (s.label === LB) break;
    }
    if (s.label !== LB || s.html !== 'B' || s.js !== 'B') notes.push('after 2 reloads on B: ' + brief(s) + ' (expected label, HTML and JS all B)');
    const vjs = await box.page.evaluate(async v => (await (await fetch('js/version.js?v=' + v)).text()), vB);
    if (!vjs.includes('"' + vB + '"')) notes.push("fetch('js/version.js?v=" + vB + "') returned another version's file");
    if (!(await waitWorker(box.page, vB, 15000, ['waiting', 'active']))) notes.push('no sw.js?v=' + vB + ' installed: ' + brief(await snap(box.page)));
    box.page = await coldLaunch(ctx, box.page, url);
    s = await snap(box.page);
    if (s.label !== LB || s.html !== 'B' || s.js !== 'B' || s.controller !== '?v=' + vB) notes.push('cold launch: ' + brief(s) + ', expected B with controller ?v=' + vB);
    await box.page.waitForFunction(async v => !(await caches.keys()).some(k => k === 'touch-chord/touch-chord/' + v), vA, { timeout: 5000 }).catch(() => {});
    const keys = await box.page.evaluate(() => caches.keys());
    if (keys.includes('touch-chord/touch-chord/' + vA)) notes.push("A's cache not deleted: " + JSON.stringify(keys));
    if (!keys.includes(OTHER_CACHE)) notes.push("the other site's cache was deleted: " + JSON.stringify(keys));
    if (!keys.includes('touch-chord/touch-chord/' + vB)) notes.push("no B cache: " + JSON.stringify(keys));
    const result = 'A ' + vA + ' -> B ' + vB + ', sw.js identical, controller ' + s.controller + ', caches ' + JSON.stringify(keys);
    // 2. offline reload on B.
    await ctx.setOffline(true);
    await box.page.reload({ waitUntil: 'load', timeout: 20000 });
    const o = await snap(box.page);
    await ctx.setOffline(false);
    const offOk = o.label === LB && o.html === 'B' && o.js === 'B' && o.controller === '?v=' + vB;
    record('offline reload after B is active', offOk, brief(o));
    return result;
  });

  // 3. Asset-only change, same APP_VERSION, same sw.js.
  await scenario('offline asset-only change A->A2', async ({ ctx, box, url, state, notes }) => {
    await installA(box.page, url, notes, vA);
    state.build = 'A2';
    await box.page.reload({ waitUntil: 'load' });
    const on = await snap(box.page);
    if (on.html !== on.mark) notes.push('online reload mixes HTML ' + on.html + ' with JS ' + on.mark);
    if (on.html !== 'A2') notes.push('online reload did not load A2 HTML: ' + on.html);
    // Wait for the refill to land in this version's live cache (the staging cache is gone).
    const filled = await box.page.waitForFunction(async live => {
      const keys = await caches.keys();
      if (keys.some(k => k.indexOf('~') >= 0)) return false;
      const c = await caches.open(live);
      const tag = document.querySelector('script[src*="boot-early"]').src.split('?v=')[1];
      const h = await c.match(new URL('index.html', location.href).href);
      const root = await c.match(new URL('./', location.href).href);
      if (!root || !(await root.text()).includes('content="A2"')) return false;
      const j = await c.match(new URL('js/boot-early.js?v=' + tag, location.href).href);
      return !!(h && j && (await h.text()).includes('content="A2"') && (await j.text()).includes('__TC_ASSET_MARK'));
    }, 'touch-chord/touch-chord/' + vA, { timeout: 15000, polling: 300 }).then(() => true, () => false);
    await box.page.waitForTimeout(500);
    if (!filled) notes.push('cache never refilled with A2');
    await ctx.setOffline(true);
    await box.page.reload({ waitUntil: 'load', timeout: 20000 });
    const off = await snap(box.page);
    await ctx.setOffline(false);
    if (off.html !== off.mark) notes.push('offline reload mixes HTML ' + off.html + ' with JS ' + off.mark);
    else if (off.html !== 'A2') notes.push('offline reload serves stale ' + off.html);
    return 'online HTML ' + on.html + '/JS ' + on.mark + ', offline HTML ' + off.html + '/JS ' + off.mark;
  });

  // 4. A profile installed by the 971119a worker gets this tree's B.
  await scenario('offline existing 971119a install picks up B', async ({ ctx, box, url, state, notes }) => {
    state.oldSw = true;
    await installA(box.page, url, notes, vA);
    state.build = 'B'; state.oldSw = false;
    await box.page.reload({ waitUntil: 'load' });
    await box.page.waitForFunction(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      return !!(reg && reg.waiting);
    }, null, { timeout: 15000, polling: 250 }).catch(() => {});
    const r = await snap(box.page);
    box.page = await coldLaunch(ctx, box.page, url);
    const c1 = await snap(box.page);
    if (c1.label !== LB || c1.html !== 'B' || c1.js !== 'B') notes.push('first cold launch: ' + brief(c1) + ' (expected label, HTML and JS all B)');
    let c2 = c1;
    if (c1.controller !== '?v=' + vB) {
      await waitWorker(box.page, vB, 15000, ['waiting', 'active']);
      box.page = await coldLaunch(ctx, box.page, url);
      c2 = await snap(box.page);
    }
    if (c2.controller !== '?v=' + vB || c2.label !== LB || c2.js !== 'B') notes.push('second cold launch: ' + brief(c2) + ', expected controller ?v=' + vB);
    return 'reload under old worker ' + brief(r) + '; cold launch 1 ' + brief(c1) + '; cold launch 2 ' + brief(c2);
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch();
  let failed = 0;
  try {
    await runUpdateCheck(browser, { record: (n, ok, d) => { if (!ok) failed++; console.log((ok ? 'PASS' : 'FAIL') + '  ' + n + (d ? '  ' + d : '')); } });
  } finally { await browser.close(); }
  process.exit(failed ? 1 : 0);
}
