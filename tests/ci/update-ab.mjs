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
//   5. code-only deploy (BUG-1): deploy copies are made on disk the way deploy-web.yml makes them
//      (copy, then tools/stamp-build.py <dir> <sha> when the tree has it). D1 = this tree, D2 = only
//      js/ui/next.js changed, same APP_VERSION, another sha. Served with max-age=600 like Pages.
//      Three reloads and two cold launches: no load mixes builds (HTML ?v= tags, every loaded js/css
//      ?v= and the next.js marker agree), and D2's code is live and in control by the first cold launch.
//   6. CSS-only deploy: the same with only css/base.css changed.
//   7. same-version HTML+JS change, deployed like deploy-web.yml (stamped), max-age=600 (BUG-2): the
//      first online reload must not pair the new HTML with an old same-URL JS file. Note: in Chromium a
//      reload reuses the renderer's memory cache for same-URL subresources without asking the worker
//      (workerStart 0, transferSize 0), so only a new ?v= per deploy fixes this; sw.js's
//      cache: "no-cache" covers the HTTP-cache half. tools/check-bump.py still makes every
//      release into main bump APP_VERSION; the deploy stamp is what changes ?v= for a same-version copy.
//   4. existing install from 971119a: A is served with tests/fixtures/offline/sw-971119a.js
//      (the worker PR #15 shipped at 971119a), then this tree's B. B's label, HTML and JS on
//      the first cold launch, and the controller is sw.js?v=B by the second cold launch.
//
//   node tests/ci/update-ab.mjs                       (this tree)
//   AB_ROOT=/path/to/other/tree node tests/ci/update-ab.mjs

import { createServer } from 'node:http';
import { existsSync, statSync, readFileSync, writeFileSync, appendFileSync, cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
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

function makeServer(baseRoot, state) {
  const { vA, vB } = state;
  const tagA = new RegExp('\\?v=' + esc(vA) + '(?![0-9.])', 'g');
  return createServer((q, res) => {
    const root = state.dir || baseRoot;
    const path = decodeURIComponent((q.url || '/').split('?')[0]);
    if (!path.startsWith(PREFIX)) { res.writeHead(404); res.end(); return; }
    const rel = path === PREFIX ? 'index.html' : path.slice(PREFIX.length);
    let file = normalize(join(root, rel));
    if (rel === 'sw.js' && state.oldSw) file = OLD_SW;
    else if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    const ext = extname(file);
    let body = readFileSync(file);
    if (!state.dir && state.build !== 'A' && TEXT.has(ext)) {
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
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': state.cacheControl || 'no-store' });
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
      next: globalThis.__TC_NEXT_MARK || 'A',
      css: getComputedStyle(document.documentElement).getPropertyValue('--tc-css-mark').replace(/["' ]/g, '') || 'A',
      htmlTags: [...new Set([...document.querySelectorAll('script[src],link[href]')].map(e => (e.getAttribute('src') || e.getAttribute('href') || '').split('?v=')[1]).filter(Boolean))],
      loadedTags: [...new Set(performance.getEntriesByType('resource').map(e => new URL(e.name)).filter(u => /\/(js|css)\//.test(u.pathname) && u.searchParams.get('v')).map(u => u.searchParams.get('v')))],
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

// Deploy copies, made like deploy-web.yml: copy the app files, change some, then stamp with the tree's own
// tools/stamp-build.py (a tree without it, like 14fc21e, deploys its files as they are).
const APP_FILES = ['index.html', 'sw.js', 'manifest.webmanifest', 'css', 'js', 'fonts', 'images'];
function makeDeploy(root, work, name, sha, change, stamp = true) {
  const dir = join(work, name);
  for (const f of APP_FILES) if (existsSync(join(root, f))) cpSync(join(root, f), join(dir, f), { recursive: true });
  if (change) change(dir);
  const script = join(root, 'tools/stamp-build.py');
  if (stamp && existsSync(script)) {
    const r = spawnSync('python3', [script, dir, sha], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error('stamp-build failed: ' + r.stderr + r.stdout);
  }
  const vt = readFileSync(join(dir, 'js/version.js'), 'utf8');
  const id = (/BUILD_ID\s*=\s*"([^"]+)"/.exec(vt) || /APP_VERSION\s*=\s*"([^"]+)"/.exec(vt))[1];
  return { dir, id };
}

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

  const work = mkdtempSync(join(tmpdir(), 'tc-update-ab-'));
  try {
    // 5 + 6. Code-only and CSS-only deploys, same APP_VERSION, served with Pages' max-age=600.
    const D1 = makeDeploy(root, work, 'd1', 'aaaaaaa1');
    const kinds = [
      ['offline code-only deploy (js/ui/next.js, same APP_VERSION)', 'next', d => appendFileSync(join(d, 'js/ui/next.js'), '\nglobalThis.__TC_NEXT_MARK = "D2";\n')],
      ['offline CSS-only deploy (css/base.css, same APP_VERSION)', 'css', d => appendFileSync(join(d, 'css/base.css'), '\n:root { --tc-css-mark: "D2"; }\n')]
    ];
    for (const [title, key, change] of kinds) {
      const D2 = makeDeploy(root, work, 'd2-' + key, 'ccccccc2', change);
      await scenario(title, async ({ ctx, box, url, state, notes }) => {
        state.dir = D1.dir; state.cacheControl = 'max-age=600';
        await box.page.goto(url, { waitUntil: 'load', timeout: 20000 });
        await box.page.evaluate(() => navigator.serviceWorker.ready);
        if (!(await snap(box.page)).controller) await box.page.reload({ waitUntil: 'load' });
        let s = await snap(box.page);
        if (s.controller !== '?v=' + D1.id || s[key] !== 'A') notes.push('D1 not installed: ' + JSON.stringify({ controller: s.controller, mark: s[key] }));
        state.dir = D2.dir;
        const isD2 = x => x[key] === 'D2';
        const htmlBuild = x => (x.htmlTags.length === 1 && x.htmlTags[0] === D2.id && D2.id !== D1.id) ? 'D2' : (D2.id === D1.id ? '?' : 'D1');
        function mixed(x, where) {
          if (x.htmlTags.length !== 1 || x.loadedTags.some(t => t !== x.htmlTags[0])) notes.push(where + ': mixed ?v= tags HTML ' + JSON.stringify(x.htmlTags) + ' loaded ' + JSON.stringify(x.loadedTags));
          const h = htmlBuild(x);
          if (h !== '?' && (h === 'D2') !== isD2(x)) notes.push(where + ': HTML ' + h + ' with code ' + x[key]);
        }
        const log = [];
        for (let i = 1; i <= 3; i++) {
          await box.page.reload({ waitUntil: 'load' });
          s = await snap(box.page); mixed(s, 'reload ' + i);
          log.push('r' + i + ' ' + s[key] + ' ctl ' + s.controller);
        }
        await waitWorker(box.page, D2.id, 15000, ['waiting', 'active']);
        for (let i = 1; i <= 2; i++) {
          box.page = await coldLaunch(ctx, box.page, url);
          s = await snap(box.page); mixed(s, 'cold launch ' + i);
          log.push('c' + i + ' ' + s[key] + ' ctl ' + s.controller);
          if (!isD2(s) || s.controller !== '?v=' + D2.id) notes.push('cold launch ' + i + ': code ' + s[key] + ', controller ' + s.controller + ' (expected D2 code under sw.js?v=' + D2.id + ')');
        }
        const keys = await box.page.evaluate(() => caches.keys());
        if (D1.id !== D2.id && keys.includes('touch-chord/touch-chord/' + D1.id)) notes.push("D1's cache not deleted: " + JSON.stringify(keys));
        await ctx.setOffline(true);
        await box.page.reload({ waitUntil: 'load', timeout: 20000 });
        const o = await snap(box.page);
        await ctx.setOffline(false);
        mixed(o, 'offline reload');
        if (!isD2(o)) notes.push('offline reload serves ' + o[key]);
        log.push('offline ' + o[key]);
        return D1.id + ' -> ' + D2.id + ': ' + log.join(', ');
      });
    }

    // 7. Same-version HTML + JS change, deployed (stamped) like deploy-web.yml, max-age=600.
    const U1 = makeDeploy(root, work, 'u1', 'aaaaaaa1');
    const U2 = makeDeploy(root, work, 'u2', 'ddddddd4', d => {
      const f = join(d, 'index.html');
      writeFileSync(f, readFileSync(f, 'utf8').replace('</head>', '<meta name="tc-html-mark" content="A2"></head>'));
      appendFileSync(join(d, 'js/boot-early.js'), '\nwindow.__TC_ASSET_MARK = "A2";\n');
    });
    await scenario('same-version HTML+JS deploy under max-age=600', async ({ ctx, box, url, state, notes }) => {
      state.dir = U1.dir; state.cacheControl = 'max-age=600';
      await box.page.goto(url, { waitUntil: 'load', timeout: 20000 });
      await box.page.evaluate(() => navigator.serviceWorker.ready);
      if (!(await snap(box.page)).controller) await box.page.reload({ waitUntil: 'load' });
      state.dir = U2.dir;
      const log = [];
      for (let i = 1; i <= 3; i++) {
        await box.page.reload({ waitUntil: 'load' });
        const s = await snap(box.page);
        const html = await box.page.evaluate(() => (document.querySelector('meta[name="tc-html-mark"]') || { content: 'A' }).content);
        log.push('r' + i + ' HTML ' + html + '/JS ' + s.mark);
        if (html !== s.mark) notes.push('reload ' + i + ' mixes HTML ' + html + ' with JS ' + s.mark);
        if (i === 1 && html !== 'A2') notes.push('reload 1 did not load the new HTML: ' + html);
      }
      return U1.id + ' -> ' + U2.id + ': ' + log.join(', ');
    });
  } finally {
    rmSync(work, { recursive: true, force: true });
  }

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
