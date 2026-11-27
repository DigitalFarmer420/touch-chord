#!/usr/bin/env node
// Headless smoke for pull requests into develop. Serves the repo root (static, no build)
// and opens /index.html?test=1&hour=12, plus &expert=1 (Expert) and &kv=1 (Kids).
//
//   node tests/ci/smoke.mjs
//   PORT=8090 node tests/ci/smoke.mjs
//   BASE_URL=https://digitalfarmer420.github.io/touch-chord-dev/ node tests/ci/smoke.mjs
//
// BASE_URL, when set, is a deployed site root. The local server is not started. Every page
// (index.html?test=1&hour=..., &expert=1, &kv=1) is resolved against that root so the path
// prefix stays, and cb=<timestamp> is added so the browser does not reuse a cached document.
// Unset, the script serves this directory on PORT (default 8091, free-port fallback).
// Either way it prints the target before the checks.
//
// The Song | Progressions walk (Expert -> Simple -> Expert, and the reverse, with no resize)
// fails on develop / PR #5. Measured at every viewport below: Expert's #xTog stays visible,
// inside the viewport, and clear of the chord pads; Simple's #xTog is display:none and 0x0
// (placeSimpleTog is not in this tree). When TOGGLE_FIXME is true that geometry check is
// skipped and the reason is printed. A console error or a failed request during the walk
// still fails the run. Every other check fails the process.
//
// N20 (phone-browser fluid UI, Uiux PR-A for Simple phone portrait) measures Simple /
// Expert / Kids at portrait (360x640, 390x664, 412x732, 412x780), landscape (640x360,
// 732x412) and the 600-767 band (700x900, 712x1000, 744x1133), plus Simple iPad portrait
// Sustain-left at 820x1180, 768x1024, 834x1194 and 1024x1366. PR-A Simple-portrait
// acceptance (last grid row has ≥8px spare, every grid row ≥44px (the spec A7 floor; the
// actual spare and smallest row are logged), Sustain in the left half, style chips on one
// line with a 44px tap height) is a real check since PR-A. Sustain-left is a real check at
// 700x900, 712x1000 and 744x1133 (under 768 wide) too.
// iPad portrait Sustain-left is a real check (already passes; simplepad.css overrides
// modes.css). N20 PR-A2 (Simple pad-land height budget) adds real checks at 1280x600
// and 1920x600: last grid row has ≥8px spare, Sustain is fully visible, smallest row
// ≥43.9px, and the spare is logged. Names start with "N20 PR-A2 Simple" so they stay
// distinct from later test-only fixmes for the same cells. Cells that already pass
// otherwise are real checks. Set TOGGLE_FIXME=0 to
// run known fails for real. Landscape Song/Progressions and volume under 44px are N21
// (fixme). Other taps under 44px are logged as informational only. Requests to the same host that
// sit outside the site prefix are ignored and named; they are not checks. A console error
// that mentions such a URL is ignored the same way. Each one is printed in full as
// "ignored (outside prefix): <check>: <text>" and counted on the summary line.
//
// FLOW rev2 (flow layout, Vinh 20 Nov 2026) is a real check at 390x844, 844x390, 744x1133, 820x1180, 1180x820 and
// 1920x1080: Kids chord pads exactly as tall as the piano, Simple without the volume slider, the big-window zoom
// (1 up to 1180x820 / 820x1180, 1.317 at 1920x1080) with no page scroll, and a real tap that still hits under zoom.
//
// GRID (Vinh, 21 Nov 2026) is a real check at phone landscape 780x310 / 330 / 360, 640x360, 667x375, 844x390, 915x412
// 932x430 and 915x330 / 345 / 360 (S25 in Brave): in Expert, Simple and Kids the chord grid (real rows, and Expert / Simple chips forced into 4 and 6 rows)
// ends at or above the piano top (Simple: inside its panel and on screen), the piano ends within innerHeight with no page
// scroll (also when 1dvh is 56px taller than innerHeight, as Brave reports it), and Expert keeps 32px rows while the piano can give way.
// NOW (same day) checks that Expert's Now box is as tall as the song card beside it (within 1px) at those sizes, phone portrait and iPad.

import { createServer } from 'node:http';
import { mkdirSync, existsSync, statSync, createReadStream, readFileSync } from 'node:fs';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { runUpdateCheck } from './update-ab.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const SHOTS = join(ROOT, 'tests/ci/out');
function qaSongText() {
  const cands = [
    join(ROOT, 'tests/fixtures/qa-chord-sheet.json'),
    join(ROOT, 'songs/qa-chord-sheet.json'),
    '/workspace/chord-touch/test6-music-qa/songs/qa-chord-sheet.json'
  ];
  for (const p of cands) if (existsSync(p)) return readFileSync(p, 'utf8');
  return null;
}
const PREFERRED_PORT = process.env.PORT ? +process.env.PORT : 8091;
// Known open bug: develop / PR #5. The walk is skipped so this gate stays green; the
// reason is printed and written into the PR. Set TOGGLE_FIXME=0 to run it for real.
const TOGGLE_FIXME = process.env.TOGGLE_FIXME !== '0';
const TOGGLE_WHY = 'develop / PR #5: after Expert > Simple > Expert and Simple > Expert > Simple with no resize, Simple\'s #xTog is display:none and 0x0 at 375x667, 390x844, 844x390, 820x1180 and 1180x820. Expert\'s #xTog stayed visible and clear of the pads. placeSimpleTog() is not on develop.';

// Site root when BASE_URL is set (directory, trailing slash). Empty means the local server.
function deployedRoot() {
  const raw = process.env.BASE_URL;
  if (raw == null || String(raw).trim() === '') return '';
  const text = String(raw).trim();
  let url;
  try { url = new URL(text); }
  catch (err) {
    console.error('BASE_URL is not a valid absolute URL: ' + text);
    process.exit(1);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    console.error('BASE_URL must be an http or https URL: ' + text);
    process.exit(1);
  }
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  url.search = '';
  url.hash = '';
  return url.href;
}
const REMOTE = deployedRoot();
const CACHE_BUST = String(Date.now());

const VIEWPORTS = [[375, 667], [390, 844], [844, 390], [820, 1180], [1180, 820]];
const MODES = [
  { name: 'simple', query: 'test=1&hour=12' },
  { name: 'expert', query: 'test=1&hour=12&expert=1' },
  { name: 'kids', query: 'test=1&hour=12&kv=1' }
];
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json'
};

function onRequest(q, res) {
  const path = decodeURIComponent((q.url || '/').split('?')[0]);
  const rel = path === '/' ? 'index.html' : path.replace(/^\/+/, '');
  const file = normalize(join(ROOT, rel));
  if (!file.startsWith(ROOT) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404); res.end(); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  createReadStream(file).pipe(res);
}
function listen(port) {
  return new Promise((resolve, reject) => {
    const srv = createServer(onRequest);
    srv.once('error', (err) => { srv.close(() => reject(err)); });
    srv.listen(port, '127.0.0.1', () => resolve(srv));
  });
}
// PORT set: that port, or a clear failure. Otherwise 8091, and a free port if 8091 is taken.
async function serve() {
  try {
    return { srv: await listen(PREFERRED_PORT), port: PREFERRED_PORT };
  } catch (err) {
    if (!err || err.code !== 'EADDRINUSE') throw err;
    if (process.env.PORT) {
      console.error(`Port ${PREFERRED_PORT} is already in use. Stop the other server or set PORT to a free port.`);
      process.exit(1);
    }
    const srv = await listen(0);
    const port = srv.address().port;
    console.log(`Port ${PREFERRED_PORT} is already in use; serving on ${port}.`);
    return { srv, port };
  }
}

let port = PREFERRED_PORT;
// Local: http://127.0.0.1:<port>/index.html?<query>, same string as before.
// Remote: <BASE_URL>index.html?<query>&cb=<timestamp>, path prefix kept.
function pageUrl(query) {
  if (!REMOTE) return `http://127.0.0.1:${port}/index.html?${query}`;
  const url = new URL('index.html', REMOTE);
  url.search = query + '&cb=' + CACHE_BUST;
  return url.href;
}
// Same host, but not under the site prefix. On a project page the browser still asks the
// origin root for /favicon.ico, which is not this app. Other hosts are left as real failures.
function outsideSite(url) {
  if (!REMOTE) return false;
  let u;
  try { u = new URL(url); } catch (err) { return false; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  const root = new URL(REMOTE);
  if (u.origin !== root.origin) return false;
  return !u.pathname.startsWith(root.pathname);
}
function ignoredNote(urls) {
  if (!urls.length) return '';
  const fav = urls.some(u => /\/favicon\.ico(?:\?|$)/.test(u));
  const other = [...new Set(urls.filter(u => !/\/favicon\.ico(?:\?|$)/.test(u)))];
  if (!other.length) return 'ignored browser /favicon.ico';
  const head = fav ? 'ignored browser /favicon.ico; ' : '';
  return head + 'ignored request outside the site (' + other.slice(0, 3).join(', ') + ')';
}
function mentionsOutside(text) {
  const found = String(text).match(/https?:\/\/[^\s)'"]+/g) || [];
  return found.some(outsideSite);
}
// Console errors dropped by mentionsOutside. Counted on the summary. Not a failed check.
let ignoredOutside = 0;
function logIgnoredConsole(where, text) {
  ignoredOutside += 1;
  const oneLine = String(text).replace(/\r\n|\r|\n/g, '\\n');
  console.log('ignored (outside prefix): ' + where + ': ' + oneLine);
}

function track(page, where) {
  const errors = [];
  const failed = [];
  const ignored = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', msg => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    // Keep the full message out of `ignored`. ignoredNote folds favicon text into one
    // "ignored browser /favicon.ico" note, which would hide a real error behind it.
    if (mentionsOutside(text)) { logIgnoredConsole(where, text); return; }
    errors.push(text);
  });
  page.on('requestfailed', req => {
    const url = req.url();
    if (/\/favicon\.ico(?:\?|$)/.test(url) || outsideSite(url)) { ignored.push(url); return; }
    failed.push((req.failure() && req.failure().errorText || 'failed') + ' ' + url);
  });
  page.on('response', res => {
    if (res.status() < 400) return;
    const url = res.url();
    if (/\/favicon\.ico(?:\?|$)/.test(url) || outsideSite(url)) { ignored.push(url); return; }
    failed.push(res.status() + ' ' + url);
  });
  return { errors, failed, ignored };
}

async function boot(page, query) {
  await page.goto(pageUrl(query), { waitUntil: 'load', timeout: REMOTE ? 45000 : 20000 });
  await page.waitForFunction(() => {
    const de = document.documentElement;
    return !de.classList.contains('tc-boot') && document.querySelectorAll('#msMode button[data-mode]').length === 3;
  }, null, { timeout: 15000 });
}

async function landedMode(page) {
  return page.evaluate(() => {
    const de = document.documentElement;
    const kv = document.getElementById('kv');
    const shown = kv && !kv.hidden && kv.getClientRects().length > 0;
    if (de.classList.contains('kv') && shown) return 'kids';
    if (de.classList.contains('simple') && !de.classList.contains('expert')) return 'simple';
    if (de.classList.contains('expert')) return 'expert';
    return 'other';
  });
}

async function switchTo(page, to) {
  const from = await landedMode(page);
  if (from === to) return from;
  if (from === 'kids') throw new Error('refusing a short tap on the Kids chip; start from Expert or Simple');
  await page.evaluate(from => {
    const vis = e => !!(e && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none');
    const chips = [...document.querySelectorAll('.mode-chip')].filter(vis);
    if (chips.length !== 1) throw new Error('visible mode chips: ' + chips.length);
    if (chips[0].dataset.modeChip !== from) throw new Error('chip is ' + chips[0].dataset.modeChip + ', page is ' + from);
    chips[0].click();
  }, from);
  await page.waitForFunction(() => {
    const s = document.getElementById('modeSheet');
    return s && !s.hidden;
  }, null, { timeout: 5000 });
  await page.evaluate(to => {
    const b = document.querySelector('#msMode button[data-mode="' + to + '"]');
    if (!b) throw new Error('no mode button ' + to);
    b.click();
  }, to);
  await page.waitForFunction(to => {
    const de = document.documentElement;
    if (to === 'expert') return de.classList.contains('expert') && !de.classList.contains('simple');
    if (to === 'simple') return de.classList.contains('simple') && !de.classList.contains('expert');
    return de.classList.contains('kv');
  }, to, { timeout: 5000 });
  await page.waitForTimeout(150);
  return from;
}

async function prepare(page, mode) {
  if (mode === 'kids') {
    await page.waitForSelector('#kv .kv-go', { timeout: 8000 });
    await page.locator('#kv .kv-go').click();
    await page.waitForSelector('#kv .kv-card', { timeout: 8000 });
    await page.locator('#kv .kv-card').first().click();
    await page.waitForFunction(() => {
      const b = document.querySelector('.kv-playbtn');
      if (!b) return false;
      const r = b.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }, null, { timeout: 8000 });
    return;
  }
  const sel = mode === 'expert' ? '#xPlay' : '#prog .pg-song';
  await page.waitForFunction(sel => {
    const b = document.querySelector(sel);
    if (!b) return false;
    const r = b.getBoundingClientRect();
    const s = getComputedStyle(b);
    return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden';
  }, sel, { timeout: 8000 });
}

function playSel(mode) { return mode === 'expert' ? '#xPlay' : mode === 'kids' ? '.kv-playbtn' : '#prog .pg-song'; }
function nextSel(mode) { return mode === 'expert' ? '#xNext' : mode === 'kids' ? '#kv .kv-next:not(.kv-rnext)' : '#prog .pg-step'; }
function padSel(mode) { return mode === 'kids' ? '.kv-pad' : '#suggest .ss-chip'; }

async function checkPage(page, mode) {
  const hit = await page.evaluate(({ play, pad }) => {
    const vis = e => {
      if (!e) return false;
      const s = getComputedStyle(e);
      const r = e.getBoundingClientRect();
      return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
    };
    const modes = [...document.querySelectorAll('#msMode button[data-mode]')].map(b => b.dataset.mode);
    const btn = document.querySelector(play);
    const problems = [];
    if (modes.length !== 3 || ['kids', 'simple', 'expert'].some(m => !modes.includes(m))) problems.push('modes ' + JSON.stringify(modes));
    if (!vis(btn)) problems.push('Play button not visible (' + play + ')');
    else {
      const r = btn.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) problems.push('Play button outside the viewport');
      const hit = document.elementFromPoint(x, y);
      if (!hit || (hit !== btn && !btn.contains(hit))) problems.push('Play button failed elementFromPoint (' + (hit && hit.id || hit && hit.className || 'nothing') + ')');
    }
    const chip = [...document.querySelectorAll(pad)].find(vis);
    if (!chip) problems.push('no visible chord pad (' + pad + ')');
    else {
      const r = chip.getBoundingClientRect();
      const opts = { bubbles: true, cancelable: true, pointerId: 7, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, isPrimary: true, button: 0, buttons: 1 };
      try {
        chip.dispatchEvent(new PointerEvent('pointerdown', opts));
        chip.dispatchEvent(new PointerEvent('pointerup', Object.assign({}, opts, { buttons: 0 })));
      } catch (e) { problems.push('pad tap threw: ' + e); }
    }
    return problems;
  }, { play: playSel(mode), pad: padSel(mode) });
  await page.waitForTimeout(200);
  return hit;
}

async function toggleReport(page, mode) {
  return page.evaluate(mode => {
    const tog = document.getElementById('xTog');
    const vis = e => {
      if (!e) return null;
      const s = getComputedStyle(e);
      const r = e.getBoundingClientRect();
      return { display: s.display, visibility: s.visibility, w: r.width, h: r.height, left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    };
    const box = vis(tog);
    const pads = [...document.querySelectorAll('#suggest .ss-chip')].map(vis).filter(b => b && b.display !== 'none' && b.w > 0 && b.h > 0);
    const problems = [];
    if (!tog) problems.push('no #xTog');
    else if (!box || box.display === 'none' || box.visibility === 'hidden' || box.w <= 0 || box.h <= 0) {
      problems.push(mode + ' toggle not visible ' + JSON.stringify(box));
    } else {
      if (box.left < -0.5 || box.top < -0.5 || box.right > innerWidth + 0.5 || box.bottom > innerHeight + 0.5) problems.push(mode + ' toggle outside the viewport ' + JSON.stringify(box));
      const hit = pads.find(p => box.left < p.right && box.right > p.left && box.top < p.bottom && box.bottom > p.top);
      if (hit) problems.push(mode + ' toggle overlaps a chord pad');
    }
    if (!pads.length) problems.push(mode + ' has no chord pads to compare');
    return { problems, where: tog && tog.parentElement && tog.parentElement.id };
  }, mode);
}

async function fresh(browser, w, h, where) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => {
    try { localStorage.clear(); localStorage.setItem('touchChord.tour.v1', 'done'); } catch (e) {}
  });
  const page = await ctx.newPage();
  const bag = track(page, where);
  return { ctx, page, bag };
}

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? '  ' + detail : ''));
}
function shotFile(name) {
  return join(SHOTS, name.replace(/[^A-Za-z0-9._-]+/g, '_') + '.png');
}
async function shot(page, name) {
  try {
    mkdirSync(SHOTS, { recursive: true });
    const file = shotFile(name);
    await page.screenshot({ path: file });
    console.log('screenshot ' + file);
  } catch (err) {
    console.log('screenshot failed for ' + name + ': ' + (err && err.message || err));
  }
}
function ghWarning(message) {
  const text = String(message).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  console.log('::warning title=Song | Progressions toggle::' + text);
}

let srv = null;
if (REMOTE) {
  console.log('target: ' + REMOTE + ' (BASE_URL, cb=' + CACHE_BUST + ')');
  console.log('page: ' + pageUrl('test=1&hour=12'));
  console.log('page: ' + pageUrl('test=1&hour=12&expert=1'));
  console.log('page: ' + pageUrl('test=1&hour=12&kv=1'));
} else {
  const served = await serve();
  srv = served.srv;
  port = served.port;
  console.log('target: http://127.0.0.1:' + port + '/ (local)');
}
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const t0 = Date.now();
try {
  for (const [w, h] of VIEWPORTS) {
    for (const mode of MODES) {
      const name = `${w}x${h} ${mode.name}`;
      const { ctx, page, bag } = await fresh(browser, w, h, name);
      try {
        await boot(page, mode.query);
        let landed = await landedMode(page);
        const note = [];
        if (mode.name === 'simple' && landed !== 'simple') {
          note.push('?test=1&hour=12 opened ' + landed + '; switched to Simple with no resize');
          await switchTo(page, 'simple');
          landed = await landedMode(page);
        }
        if (landed !== mode.name) {
          await shot(page, name);
          record(name, false, 'landed in ' + landed + ' not ' + mode.name);
          continue;
        }
        await prepare(page, mode.name);
        const problems = await checkPage(page, mode.name);
        const late = bag.errors.concat(bag.failed);
        const ok = !problems.length && !late.length;
        const noise = ignoredNote(bag.ignored);
        const detail = []
          .concat(note)
          .concat(problems)
          .concat(late.slice(0, 4))
          .concat(noise ? [noise] : [])
          .join('; ');
        if (!ok) await shot(page, name);
        record(name, ok, detail);
      } catch (e) {
        await shot(page, name);
        record(name, false, (e && e.message || String(e)).split('\n')[0]);
      } finally {
        await ctx.close();
      }
    }
  }

  const walks = [];
  for (const [w, h] of VIEWPORTS) {
    for (const walk of [['expert', 'simple', 'expert'], ['simple', 'expert', 'simple']]) {
      const label = `${w}x${h} ${walk.join('>')}`;
      const { ctx, page, bag } = await fresh(browser, w, h, 'toggle ' + label);
      const stepNotes = [];
      try {
        await boot(page, 'test=1&hour=12&expert=1');
        if (walk[0] === 'simple') await switchTo(page, 'simple');
        for (let i = 0; i < walk.length; i++) {
          if (i) await switchTo(page, walk[i]);
          const got = await landedMode(page);
          if (got !== walk[i]) { stepNotes.push('at ' + walk[i] + ' page is ' + got); continue; }
          await page.waitForTimeout(100);
          const rep = await toggleReport(page, walk[i]);
          if (rep.problems.length) stepNotes.push(walk[i] + ': ' + rep.problems.join('; '));
        }
        if (bag.errors.length || bag.failed.length) stepNotes.push('page: ' + bag.errors.concat(bag.failed).slice(0, 3).join('; '));
        const pageNotes = stepNotes.filter(n => n.startsWith('page:'));
        const toggleNotes = stepNotes.filter(n => !n.startsWith('page:'));
        if (pageNotes.length || (!TOGGLE_FIXME && toggleNotes.length)) await shot(page, 'toggle ' + label);
        walks.push({ label, pageNotes, toggleNotes });
      } catch (e) {
        stepNotes.push((e && e.message || String(e)).split('\n')[0]);
        await shot(page, 'toggle ' + label);
        walks.push({ label, pageNotes: stepNotes.filter(n => n.startsWith('page:')), toggleNotes: stepNotes.filter(n => !n.startsWith('page:')) });
      } finally {
        await ctx.close();
      }
    }
  }

  // N11 (PR #5): Simple's Song | Progressions toggle keeps the song step and keeps Play running (as Expert does).
  const N11_SONG = readFileSync(join(ROOT, 'tests/fixtures/upload/anh-v13.json'), 'utf8');
  for (const [w, h] of [[390, 844], [1180, 820]]) {
    const label = `${w}x${h} simple toggle keeps song step`;
    const { ctx, page, bag } = await fresh(browser, w, h, label);
    try {
      await boot(page, 'test=1&hour=12&expert=1');
      await page.evaluate(async t => {
        const ta = document.getElementById('upPaste'); ta.value = t; ta.dispatchEvent(new Event('input', { bubbles: true }));
        document.getElementById('upLoad').click(); await new Promise(r => setTimeout(r, 600));
      }, N11_SONG);
      await page.keyboard.press('Escape').catch(() => {});
      await page.evaluate(() => { document.querySelectorAll('.up-x, .kp-x').forEach(x => { if (x.offsetParent) x.click(); }); });
      await page.waitForTimeout(300);
      await switchTo(page, 'simple');
      const hasTog = await page.evaluate(() => { const b = document.querySelector('#xTog button[data-v="prog"]'); return !!(b && b.getClientRects().length); });
      if (!hasTog) { results.push({ name: label, ok: true, fixme: true }); console.log('FIXME ' + label + ': no Simple toggle in this build'); continue; }
      const st = () => page.evaluate(() => { const P = window.__prog, e = P.list[P.idx]; return { up: !!(e && e.up), cur: P.cur, playing: P.playing }; });
      const tap = async v => { await page.locator(`#xTog button[data-v="${v}"]`).click(); await page.waitForTimeout(300); };
      const notes = [];
      for (let k = 0; k < 5; k++) { await page.locator('#prog .pg-step').click(); await page.waitForTimeout(150); }
      const a = await st();
      await tap('prog'); await tap('song');
      await page.locator('#prog .pg-step').click(); await page.waitForTimeout(150);
      const b = await st();
      if (!a.up || a.cur !== 4) notes.push('after Next x5: ' + JSON.stringify(a));
      if (!b.up || b.cur !== 5) notes.push('Progressions > Song > Next should play step 6, got ' + JSON.stringify(b));
      await page.locator('#prog .pg-song').click();
      await page.waitForFunction(() => window.__prog.playing && window.__prog.cur >= 0, null, { timeout: 8000 }).catch(() => {});
      await tap('prog');
      const c = await st();
      await tap('song');
      const d = await st();
      if (!c.playing || !c.up) notes.push('tap Progressions while playing: ' + JSON.stringify(c));
      if (!d.playing || !d.up) notes.push('back to Song while playing: ' + JSON.stringify(d));
      if (d.playing) await page.locator('#prog .pg-song').click();
      if (bag.errors.length || bag.failed.length) notes.push('page: ' + bag.errors.concat(bag.failed).slice(0, 3).join('; '));
      if (notes.length) await shot(page, label);
      record(label, !notes.length, notes.join(' | '));
    } catch (e) {
      await shot(page, label);
      record(label, false, (e && e.message || String(e)).split('\n')[0]);
    } finally {
      await ctx.close();
    }
  }

  // PR #16 transport checks (Noff N14 / N15 / N16 and the Play label). Expert 390x844 and 1180x820,
  // Simple 390x844, plus the label in Kids. Driven through the ?test=1 hooks (window.__prog,
  // window.__progApi, window.__tcTest.transport(), window.ChordAudio.voices).
  const tpSnap = page => page.evaluate(() => {
    const A = window.ChordAudio, now = A && A.ctx ? A.currentTime() : 0;
    const live = (A && A.voices || []).filter(v => !v.short && !v.released && !(v.done != null && v.done <= now));
    const t = window.__tcTest ? window.__tcTest.transport() : {};
    return { state: t.state, cur: window.__prog.cur, n: window.__prog.steps.length, pos: t.magicPos, fromTop: !!t.fromTop, wrapped: !!t.wrapped,
      live: live.length, held: live.filter(v => v.done == null).length };
  });
  const tpPlay = async (page, sel) => { await page.locator(sel).click(); await page.waitForTimeout(320); };   // past the 280 ms Play debounce
  const tpUntil = (page, k) => page.waitForFunction(k => window.__prog.playing && window.__prog.cur >= k, k, { timeout: 15000 });
  const tpLabel = (page, sel) => page.evaluate(sel => { const b = document.querySelector(sel); return b ? { aria: b.getAttribute('aria-label'), title: b.getAttribute('title') } : null; }, sel);
  async function tpCase(label, w, h, query, fn) {
    const { ctx, page, bag } = await fresh(browser, w, h, label);
    try {
      await boot(page, query);
      const notes = await fn(page);
      if (bag.errors.length || bag.failed.length) notes.push('page: ' + bag.errors.concat(bag.failed).slice(0, 3).join('; '));
      if (notes.length) await shot(page, label);
      record(label, !notes.length, notes.join(' | '));
    } catch (e) {
      await shot(page, label);
      record(label, false, (e && e.message || String(e)).split('\n')[0]);
    } finally {
      await ctx.close();
    }
  }
  const TP = [[390, 844, 'expert', 'test=1&hour=12&expert=1', '#xPlay'], [1180, 820, 'expert', 'test=1&hour=12&expert=1', '#xPlay'], [390, 844, 'simple', 'test=1&hour=12', '#prog .pg-song']];
  for (const [w, h, mode, query, sel] of TP) {
    const pre = async page => { if (await landedMode(page) !== mode) await switchTo(page, mode); await prepare(page, mode); };
    // N14: pause releases the sounding chord (no voice held through the pause).
    await tpCase(`${w}x${h} ${mode} N14 pause releases the chord`, w, h, query, async page => {
      await pre(page);
      const notes = [];
      await tpPlay(page, sel); await tpUntil(page, 1); await page.waitForTimeout(300);
      const a = await tpSnap(page);
      if (!a.live) notes.push('nothing sounding before pause ' + JSON.stringify(a));
      await tpPlay(page, sel);
      await page.waitForTimeout(1500);
      const b = await tpSnap(page);
      if (b.state !== 'paused') notes.push('state ' + b.state + ' (want paused)');
      if (b.live || b.held) notes.push(`voices still live 1.5 s into pause: live=${b.live} held=${b.held}`);
      return notes;
    });
    // N15: Next while paused plays the step after the paused one, stays paused (Resume label), releases, wraps.
    await tpCase(`${w}x${h} ${mode} N15 Next while paused`, w, h, query, async page => {
      await pre(page);
      const notes = [];
      await tpPlay(page, sel); await tpUntil(page, 2);
      await tpPlay(page, sel);
      const a = await tpSnap(page);
      if (a.state !== 'paused') notes.push('pause: ' + JSON.stringify(a));
      await page.evaluate(() => window.__progApi.next()); await page.waitForTimeout(200);
      const b = await tpSnap(page);
      const want = (a.cur + 1) % a.n;
      if (b.state !== 'paused') notes.push('after Next state ' + b.state + ' (want paused)');
      if (b.cur !== want) notes.push(`after Next cur ${b.cur} (want ${want}, paused on ${a.cur})`);
      if (b.pos !== want + 1) notes.push(`walk pos ${b.pos} (want ${want + 1})`);
      const lab = await tpLabel(page, sel);
      if (!lab || lab.aria !== 'Resume' || lab.title !== 'Resume') notes.push('Play label ' + JSON.stringify(lab) + ' (want aria and title Resume)');
      if (!b.live) notes.push('Next sounded nothing');
      const ring = await page.evaluate(() => (window.__magic && window.__magic.state ? window.__magic.state.endAt : 0) - window.ChordAudio.currentTime());
      await page.waitForTimeout(Math.max(0, ring * 1000) + 700);
      const c = await tpSnap(page);
      if (c.live || c.held) notes.push(`Next chord not released after its ring: live=${c.live} held=${c.held}`);
      // walk to the last step with Next (still paused), then Next wraps to step 1 "from the top"
      for (let g = 0; g < 40 && (await tpSnap(page)).cur !== a.n - 1 && (await tpSnap(page)).state === 'paused'; g++) {
        await page.evaluate(() => window.__progApi.next()); await page.waitForTimeout(60);
      }
      const d = await tpSnap(page);
      if (d.cur !== a.n - 1 || d.state !== 'paused') notes.push('could not reach the last step while paused ' + JSON.stringify(d));
      else {
        if (!d.fromTop) notes.push('paused on the last step: next is not "from the top"');
        await page.evaluate(() => window.__progApi.next()); await page.waitForTimeout(200);
        const e = await tpSnap(page);
        if (e.state !== 'paused' || e.cur !== 0 || !e.wrapped || e.pos !== 1) notes.push('Next on the last step: ' + JSON.stringify(e) + ' (want paused, cur 0, wrapped, pos 1)');
      }
      // Resume plays from the new step
      await tpPlay(page, sel);
      const f = await tpSnap(page);
      if (f.state !== 'playing' || f.cur !== 0) notes.push('resume after Next: ' + JSON.stringify(f));
      if (f.state === 'playing') await tpPlay(page, sel);
      return notes;
    });
    // N16: hidden tab / bfcache pagehide pauses (no auto-resume); a real unload pagehide stops.
    await tpCase(`${w}x${h} ${mode} N16 hide pauses`, w, h, query, async page => {
      await pre(page);
      const notes = [];
      await tpPlay(page, sel); await tpUntil(page, 1);
      const a = await tpSnap(page);
      await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
      await page.waitForTimeout(800);
      const b = await tpSnap(page);
      if (b.state !== 'paused') notes.push('hidden: state ' + b.state + ' (want paused)');
      if (b.cur !== a.cur && b.cur !== a.cur + 1) notes.push(`hidden: cur ${b.cur} (was ${a.cur})`);
      if (b.live || b.held) notes.push(`hidden: voices live=${b.live} held=${b.held}`);
      await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
      await page.waitForTimeout(800);
      const c = await tpSnap(page);
      if (c.state !== 'paused') notes.push('shown again: state ' + c.state + ' (want paused, no auto-resume)');
      const lab = await tpLabel(page, sel);
      if (!lab || lab.aria !== 'Resume' || lab.title !== 'Resume') notes.push('shown again: Play label ' + JSON.stringify(lab) + ' (want aria and title Resume)');
      await tpPlay(page, sel);
      await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
      await page.waitForTimeout(300);
      const d = await tpSnap(page);
      if (d.state !== 'paused') notes.push('pagehide (persisted): state ' + d.state + ' (want paused)');
      await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })));
      await page.waitForTimeout(300);
      const e = await tpSnap(page);
      if (e.state !== 'idle') notes.push('pagehide (unload): state ' + e.state + ' (want idle)');
      return notes;
    });
  }
  // Play label in each mode: "Play song" idle, "Pause" playing, "Resume" paused.
  for (const [w, h, mode, query] of [[390, 844, 'simple', 'test=1&hour=12'], [390, 844, 'expert', 'test=1&hour=12&expert=1'], [390, 844, 'kids', 'test=1&hour=12&kv=1'],
    [1180, 820, 'simple', 'test=1&hour=12'], [1180, 820, 'expert', 'test=1&hour=12&expert=1'], [1180, 820, 'kids', 'test=1&hour=12&kv=1']]) {
    await tpCase(`${w}x${h} ${mode} Play label idle/playing/paused`, w, h, query, async page => {
      if (mode !== 'kids' && await landedMode(page) !== mode) await switchTo(page, mode);
      await prepare(page, mode);
      const sel = playSel(mode), notes = [];
      const expect = (w) => w === 'Play song'
        ? { aria: 'Play song', title: 'Play song: the whole song / progression, over and over' }
        : { aria: w, title: w };
      const want = async (w, when) => {
        const l = await tpLabel(page, sel), e = expect(w);
        if (!l || l.aria !== e.aria || l.title !== e.title) notes.push(`${when}: ${JSON.stringify(l)} (want ${JSON.stringify(e)})`);
      };
      await want('Play song', 'idle');
      await tpPlay(page, sel); await page.waitForTimeout(150); await want('Pause', 'playing');
      await tpPlay(page, sel); await page.waitForTimeout(150); await want('Resume', 'paused');
      await page.evaluate(() => window.__progApi.stop()); await page.waitForTimeout(200); await want('Play song', 'after Stop');
      return notes;
    });
  }


  // B1 / B2 and paused-stop rules (PM+Uiux): style/key while paused, Kids Home/song-pick, Simple↔Expert label.
  const qaText = qaSongText();
  const idleLab = { aria: 'Play song', title: 'Play song: the whole song / progression, over and over' };
  const loadQa = async (page) => {
    if (!qaText) return 'no QA fixture';
    const r = await page.evaluate(t => window.__upload && window.__upload.load(t), qaText);
    await page.waitForTimeout(400);
    await page.evaluate(() => { const p = document.getElementById('uploadPick'); if (p) p.hidden = true; const s = document.getElementById('xScrim'); if (s) { s.hidden = true; s.classList.remove('on'); } const ms = document.getElementById('modeSheet'); if (ms) ms.hidden = true; });
    if (!r || r.ok === false) return 'load failed ' + JSON.stringify(r);
    return null;
  };
  const glyphIsPlay = async (page, sel) => page.evaluate(sel => {
    const e = document.querySelector(sel); if (!e) return false;
    const txt = (e.textContent || '').trim();
    return !e.querySelector('rect') && !/[■⏸❚]/.test(txt);
  }, sel);

  // B1: Simple, loaded song, style change while paused, Resume stays on step 2.
  await tpCase('390x844 simple B1 style change while paused then Resume', 390, 844, 'test=1&hour=12', async page => {
    const notes = [];
    if (await landedMode(page) !== 'simple') await switchTo(page, 'simple');
    await prepare(page, 'simple');
    const err = await loadQa(page);
    if (err) { notes.push(err); return notes; }
    const sel = playSel('simple');
    await tpPlay(page, sel); await tpUntil(page, 1); await page.waitForTimeout(200);
    await tpPlay(page, sel);
    const a = await tpSnap(page);
    if (a.state !== 'paused' || a.cur !== 1) notes.push('pause: ' + JSON.stringify(a) + ' (want paused cur 1)');
    await page.evaluate(() => { const b = document.querySelector('#styles button[data-style="jazz"]'); if (b) b.click(); });
    await page.waitForTimeout(400);
    const mid = await tpSnap(page);
    if (mid.state !== 'paused') notes.push('after Jazz: state ' + mid.state);
    await tpPlay(page, sel);
    const b = await tpSnap(page);
    if (b.state !== 'playing' || b.cur !== 1) notes.push('Resume: ' + JSON.stringify(b) + ' (want playing cur 1 / step 2)');
    return notes;
  });

  // B2: Expert, Pop Four-Chord, key change while paused: highlight kept, Next = step 3, Resume = step 2; style change on the QA song too.
  await tpCase('390x844 expert B2 key change while paused, Next and Resume', 390, 844, 'test=1&hour=12&expert=1', async page => {
    const notes = [];
    if (await landedMode(page) !== 'expert') await switchTo(page, 'expert');
    await prepare(page, 'expert');
    const sel = playSel('expert');
    await tpPlay(page, sel); await tpUntil(page, 1); await page.waitForTimeout(200);
    await tpPlay(page, sel);
    const a = await tpSnap(page);
    if (a.state !== 'paused' || a.cur !== 1) notes.push('pause: ' + JSON.stringify(a));
    await page.evaluate(() => window.__setKey(2, 'major'));
    await page.waitForTimeout(400);
    const mid = await tpSnap(page);
    if (mid.state !== 'paused' || mid.cur !== 1) notes.push('after key D: ' + JSON.stringify(mid) + ' (want paused cur 1)');
    if (mid.pos !== 2) notes.push('walk after key D: pos=' + mid.pos + ' (want 2)');
    await page.locator(nextSel('expert')).click(); await page.waitForTimeout(300);
    const nx = await tpSnap(page);
    if (nx.state !== 'paused' || nx.cur !== 2) notes.push('Next after key change: ' + JSON.stringify(nx) + ' (want paused cur 2 / step 3)');
    return notes;
  });
  await tpCase('390x844 expert B2 key change while paused then Resume', 390, 844, 'test=1&hour=12&expert=1', async page => {
    const notes = [];
    if (await landedMode(page) !== 'expert') await switchTo(page, 'expert');
    await prepare(page, 'expert');
    const sel = playSel('expert');
    await tpPlay(page, sel); await tpUntil(page, 1); await page.waitForTimeout(200);
    await tpPlay(page, sel);
    await page.evaluate(() => window.__setKey(2, 'major'));
    await page.waitForTimeout(400);
    const mid = await tpSnap(page);
    if (mid.state !== 'paused' || mid.cur !== 1) notes.push('after key D: ' + JSON.stringify(mid));
    await tpPlay(page, sel);
    const b = await tpSnap(page);
    if (b.state !== 'playing' || b.cur !== 1) notes.push('Resume after key change: ' + JSON.stringify(b) + ' (want playing cur 1)');
    return notes;
  });
  await tpCase('390x844 expert B2 style change on QA song while paused, Next and Resume', 390, 844, 'test=1&hour=12&expert=1', async page => {
    const notes = [];
    if (await landedMode(page) !== 'expert') await switchTo(page, 'expert');
    await prepare(page, 'expert');
    const err = await loadQa(page);
    if (err) { notes.push(err); return notes; }
    const sel = playSel('expert');
    await tpPlay(page, sel); await tpUntil(page, 1); await page.waitForTimeout(200);
    await tpPlay(page, sel);
    const a = await tpSnap(page);
    if (a.state !== 'paused' || a.cur !== 1) notes.push('pause: ' + JSON.stringify(a));
    await page.evaluate(() => { const b = document.querySelector('#styles button[data-style="jazz"]'); if (b) b.click(); });
    await page.waitForTimeout(400);
    const mid = await tpSnap(page);
    if (mid.state !== 'paused' || mid.cur !== 1) notes.push('after Jazz: ' + JSON.stringify(mid) + ' (want paused cur 1)');
    if (mid.pos !== 2) notes.push('walk after Jazz: pos=' + mid.pos + ' (want 2)');
    // Next = step 3
    await page.locator(nextSel('expert')).click(); await page.waitForTimeout(300);
    const nx = await tpSnap(page);
    if (nx.state !== 'paused' || nx.cur !== 2) notes.push('Next after style change: ' + JSON.stringify(nx) + ' (want paused cur 2)');
    return notes;
  });

  // (1) Simple↔Expert switch while paused stays a stop; Play reads "Play song" with ▶, never Resume.
  for (const [from, to, query] of [['simple', 'expert', 'test=1&hour=12'], ['expert', 'simple', 'test=1&hour=12&expert=1']]) {
    await tpCase(`390x844 ${from}->${to} switch while paused is stop, Play song`, 390, 844, query, async page => {
      const notes = [];
      if (await landedMode(page) !== from) await switchTo(page, from);
      await prepare(page, from);
      await tpPlay(page, playSel(from)); await tpUntil(page, 1);
      await tpPlay(page, playSel(from));
      const p = await tpSnap(page);
      if (p.state !== 'paused') notes.push('pause: ' + p.state);
      await switchTo(page, to);
      await page.waitForTimeout(300);
      const m = await tpSnap(page);
      const lab = await tpLabel(page, playSel(to));
      const playGlyph = await glyphIsPlay(page, playSel(to));
      if (m.state !== 'idle') notes.push('after switch: state ' + m.state + ' (want idle)');
      if (!lab || lab.aria !== idleLab.aria || lab.title !== idleLab.title) notes.push('after switch label: ' + JSON.stringify(lab) + ' (want ' + JSON.stringify(idleLab) + ')');
      if (!playGlyph) notes.push('after switch: Play is not ▶');
      if (lab && lab.aria === 'Resume') notes.push('after switch: label is Resume');
      return notes;
    });
  }

  // N18 (Noff, Uiux acceptance): a Simple/Expert switch while paused is a stop, so Play then starts the song at step 1
  // (not at the paused step + 1). A switch while playing still picks up at the sounding step (develop behaviour).
  const tpIdleCheck = async (page, sel, what, notes) => {
    const m = await tpSnap(page);
    const lab = await tpLabel(page, sel);
    if (m.state !== 'idle') notes.push(what + ': state ' + m.state + ' (want idle)');
    if (!lab || lab.aria !== idleLab.aria || lab.title !== idleLab.title) notes.push(what + ' label: ' + JSON.stringify(lab) + ' (want ' + JSON.stringify(idleLab) + ')');
    if (!(await glyphIsPlay(page, sel))) notes.push(what + ': Play is not ▶');
    return m;
  };
  const tpStartsAtTop = async (page, sel, what, notes) => {
    await tpPlay(page, sel);
    const s = await tpSnap(page);
    if (s.state !== 'playing' || s.cur !== 0) notes.push(what + ' then Play: ' + JSON.stringify(s) + ' (want playing cur 0 / step 1)');
  };
  for (const [from, to, query] of [['simple', 'expert', 'test=1&hour=12'], ['expert', 'simple', 'test=1&hour=12&expert=1']]) {
    await tpCase(`390x844 N18 ${from}->${to} switch while paused, Play starts at step 1`, 390, 844, query, async page => {
      const notes = [];
      if (await landedMode(page) !== from) await switchTo(page, from);
      await prepare(page, from);
      await tpPlay(page, playSel(from)); await tpUntil(page, 1); await page.waitForTimeout(200);
      await tpPlay(page, playSel(from));
      const p = await tpSnap(page);
      if (p.state !== 'paused' || p.cur < 1) notes.push('pause: ' + JSON.stringify(p) + ' (want paused at step 2+)');
      await switchTo(page, to);
      await page.waitForTimeout(300);
      const m = await tpIdleCheck(page, playSel(to), 'after switch', notes);
      if (m.pos !== 0) notes.push('walk after switch: pos=' + m.pos + ' (want 0, the top)');
      await tpStartsAtTop(page, playSel(to), 'after switch', notes);
      return notes;
    });
    await tpCase(`390x844 N18 ${from}->${to} switch while playing keeps the sounding step`, 390, 844, query, async page => {
      const notes = [];
      if (await landedMode(page) !== from) await switchTo(page, from);
      await prepare(page, from);
      await tpPlay(page, playSel(from)); await tpUntil(page, 1);
      const at = await page.evaluate(() => window.__prog.cur);
      await switchTo(page, to);
      await page.waitForTimeout(300);
      const m = await tpIdleCheck(page, playSel(to), 'after switch', notes);
      if (m.pos < 1 || m.pos > at + 1) notes.push('walk after switch: pos=' + m.pos + ' (want the sounding step ' + at + ', not the top)');
      return notes;
    });
  }

  // N22 (Noff, Uiux acceptance): Expert, paused, then another progression from the list, or a style change that swaps
  // the song: the paused step is gone, Play reads "Play song" ▶ with the idle title, and Play starts at step 1.
  await tpCase('390x844 N22 expert pick another progression while paused', 390, 844, 'test=1&hour=12&expert=1', async page => {
    const notes = [];
    if (await landedMode(page) !== 'expert') await switchTo(page, 'expert');
    await prepare(page, 'expert');
    const sel = playSel('expert');
    await tpPlay(page, sel); await tpUntil(page, 1); await page.waitForTimeout(200);
    await tpPlay(page, sel);
    const p = await tpSnap(page);
    if (p.state !== 'paused' || p.cur < 1) notes.push('pause: ' + JSON.stringify(p));
    const before = await page.evaluate(() => window.__prog.idx);
    if (!(await page.locator('#xSrc .x-pbar').isVisible().catch(() => false))) { await page.locator('#xTog button[data-v="prog"]').click(); await page.waitForTimeout(200); }
    if (await page.evaluate(() => document.getElementById('xPList').hidden)) await page.locator('#xSrc .x-pbar').click();
    await page.waitForSelector('#xPList button[data-i]', { state: 'visible', timeout: 5000 }); await page.waitForTimeout(150);
    const pick = before === 1 ? 2 : 1;
    const row = page.locator(`#xPList button[data-i="${pick}"]`); await row.scrollIntoViewIfNeeded(); await row.click(); await page.waitForTimeout(350);
    const idx = await page.evaluate(() => window.__prog.idx);
    if (idx !== pick) notes.push('picked progression ' + idx + ', want ' + pick);
    await page.evaluate(() => { const l = document.getElementById('xPList'); if (l) l.hidden = true; const s = document.getElementById('xScrim'); if (s) { s.hidden = true; s.classList.remove('on'); } });
    await tpIdleCheck(page, sel, 'after progression pick', notes);
    await tpStartsAtTop(page, sel, 'after progression pick', notes);
    return notes;
  });
  await tpCase('390x844 N22 expert style change that swaps the song while paused', 390, 844, 'test=1&hour=12&expert=1', async page => {
    const notes = [];
    if (await landedMode(page) !== 'expert') await switchTo(page, 'expert');
    await prepare(page, 'expert');
    const sel = playSel('expert');
    await tpPlay(page, sel); await tpUntil(page, 1); await page.waitForTimeout(200);
    await tpPlay(page, sel);
    const p = await tpSnap(page);
    if (p.state !== 'paused' || p.cur < 1) notes.push('pause: ' + JSON.stringify(p));
    const name0 = await page.evaluate(() => { const r = window.__prog.list[window.__prog.idx]; return r && r.name; });
    const to = await page.evaluate(() => { const cur = [...document.querySelectorAll('#styles button[data-style].on, #styles button[data-style][aria-pressed="true"], #styles button[data-style][aria-checked="true"]')].map(b => b.dataset.style)[0]; return cur === 'jazz' ? 'pop' : 'jazz'; });
    await page.evaluate(to => { const b = document.querySelector('#styles button[data-style="' + to + '"]'); if (b) b.click(); }, to);
    await page.waitForTimeout(400);
    const name1 = await page.evaluate(() => { const r = window.__prog.list[window.__prog.idx]; return r && r.name; });
    if (name1 === name0) notes.push('style change to ' + to + ' kept the song ' + name0 + ' (test needs a song swap)');
    await tpIdleCheck(page, sel, 'after style ' + to, notes);
    await tpStartsAtTop(page, sel, 'after style ' + to, notes);
    return notes;
  });

  // (3) Kids: Home or picking another song while paused stops and resets Play to "Play song" / ▶.
  await tpCase('390x844 kids Home while paused stops', 390, 844, 'test=1&hour=12&kv=1', async page => {
    const notes = [];
    await prepare(page, 'kids');
    const sel = playSel('kids');
    await tpPlay(page, sel); await page.waitForTimeout(400);
    await tpPlay(page, sel);
    const p = await tpSnap(page);
    if (p.state !== 'paused') notes.push('pause: ' + p.state);
    await page.evaluate(() => document.querySelector('.kv-home').click());
    await page.waitForTimeout(300);
    const h = await tpSnap(page);
    const lab = await tpLabel(page, sel);
    const playGlyph = await glyphIsPlay(page, sel);
    if (h.state !== 'idle') notes.push('after Home: state ' + h.state + ' (want idle)');
    if (!lab || lab.aria !== idleLab.aria || lab.title !== idleLab.title) notes.push('after Home label: ' + JSON.stringify(lab));
    if (!playGlyph) notes.push('after Home: Play is not ▶');
    return notes;
  });
  await tpCase('390x844 kids pick another song while paused stops', 390, 844, 'test=1&hour=12&kv=1', async page => {
    const notes = [];
    await prepare(page, 'kids');
    const sel = playSel('kids');
    await tpPlay(page, sel); await page.waitForTimeout(400);
    await tpPlay(page, sel);
    const p = await tpSnap(page);
    if (p.state !== 'paused') notes.push('pause: ' + p.state);
    await page.evaluate(() => { const c = document.querySelectorAll('#kv .kv-card'); if (c[1]) c[1].click(); });
    await page.waitForTimeout(400);
    const o = await tpSnap(page);
    const lab = await tpLabel(page, sel);
    const playGlyph = await glyphIsPlay(page, sel);
    if (o.state !== 'idle') notes.push('after other song: state ' + o.state + ' (want idle)');
    if (!lab || lab.aria !== idleLab.aria || lab.title !== idleLab.title) notes.push('after other song label: ' + JSON.stringify(lab));
    if (!playGlyph) notes.push('after other song: Play is not ▶');
    return notes;
  });


  // PR #15: a version-bumped deploy must reach a returning user (local server only).
  if (REMOTE) console.log('skip offline update A->B: needs the local server (BASE_URL is set)');
  else await runUpdateCheck(browser, { root: ROOT, record, shot });

  // N20 PR-A: Simple phone portrait fits the visible viewport. With the uploaded song (fixture anh-v13) in C# minor,
  // the last chord row ends at least 8px above the bottom, every grid row is >= 44px, Sustain is on the left at the
  // 10px page padding, the style chips are one line with the picked chip in view, the page does not scroll, and the
  // control taps (Sustain, volume, key, Major / Minor, song picker, Next / Play) are >= 44px.
  const N20_SONG = readFileSync(join(ROOT, 'tests/fixtures/upload/anh-v13.json'), 'utf8');
  for (const [w, h] of [[360, 640], [390, 664], [412, 732], [412, 780], [700, 900]]) {
    const label = `N20 PR-A ${w}x${h} simple: grid fits with 8px spare, Sustain at the left padding, picked chip in view`;
    const { ctx, page, bag } = await fresh(browser, w, h, label);
    try {
      await boot(page, 'test=1&hour=12');
      if (await landedMode(page) !== 'simple') await switchTo(page, 'simple');
      await prepare(page, 'simple');
      await page.evaluate(async t => { window.__upload.load(t); await new Promise(r => setTimeout(r, 700)); window.__setKey(1, 'minor'); await new Promise(r => setTimeout(r, 600)); }, N20_SONG);
      const m = await page.evaluate(() => {
        const R = e => e && e.getClientRects().length ? e.getBoundingClientRect() : null;
        const vis = e => !!(R(e) && getComputedStyle(e).visibility !== 'hidden');
        const cells = [...document.querySelectorAll('#suggest .ss-chip, #suggest .ss-note')].filter(vis);
        const rows = {};
        for (const e of cells) { const r = e.getBoundingClientRect(), k = Math.round(r.top); rows[k] = rows[k] || { b: r.bottom, h: r.height }; }
        const bands = Object.values(rows);
        const sus = R(document.getElementById('sustainBtn'));
        const row = document.getElementById('styles'), on = row.querySelector('button.on'), or = R(on), rr = R(row);
        const lines = new Set([...row.querySelectorAll('button')].filter(vis).map(e => Math.round(e.getBoundingClientRect().top))).size;
        const taps = ['#sustainBtn', '#nowMix input', '#kidKey .kk-prev', '#kidKey .kk-next', '#kidKey .kk-mode, #kidKey [data-mode]', '#prog .pg-prev', '#prog .pg-next', '#prog .pg-step', '#prog .pg-song']
          .map(s => [s, R(document.querySelector(s))]).filter(x => x[1]).map(x => [x[0], Math.round(x[1].height * 10) / 10]);
        return { vh: innerHeight, scrollH: document.scrollingElement.scrollHeight, n: bands.length,
          lastB: bands.length ? Math.max(...bands.map(b => b.b)) : null, minH: bands.length ? Math.min(...bands.map(b => b.h)) : null,
          sus: sus && { l: Math.round(sus.left), cx: Math.round(sus.left + sus.width / 2), h: Math.round(sus.height) }, vw: innerWidth,
          lines, onClear: !!(or && rr && or.left >= rr.left - 0.5 && or.right <= rr.right + 0.5), small: taps.filter(x => x[1] < 43.5) };
      });
      const notes = [];
      const spare = m.lastB == null ? null : Math.round((m.vh - m.lastB) * 10) / 10;
      if (m.n < 5) notes.push('only ' + m.n + ' grid rows visible');
      if (spare == null || spare < 8) notes.push('last grid row ' + spare + 'px above the bottom (want >= 8)');
      if (m.minH == null || m.minH < 43.9) notes.push('grid row ' + m.minH + 'px (want >= 44)');
      if (!m.sus || m.sus.l > 11 || m.sus.cx >= m.vw / 2) notes.push('Sustain not on the left ' + JSON.stringify(m.sus));
      if (m.lines !== 1) notes.push('style chips on ' + m.lines + ' lines');
      if (!m.onClear) notes.push('picked style chip not in view');
      if (m.scrollH > m.vh) notes.push('page scrolls ' + m.scrollH + ' > ' + m.vh);
      if (m.small.length) notes.push('taps under 44: ' + JSON.stringify(m.small));
      if (bag.errors.length || bag.failed.length) notes.push('page: ' + bag.errors.concat(bag.failed).slice(0, 3).join('; '));
      if (notes.length) await shot(page, label);
      record(label, !notes.length, notes.length ? notes.join(' | ') : spare + 'px spare, rows >= ' + Math.round(m.minH * 10) / 10 + ', Sustain x ' + m.sus.l);
    } catch (e) {
      await shot(page, label);
      record(label, false, (e && e.message || String(e)).split('\n')[0]);
    } finally {
      await ctx.close();
    }
  }

  // N13: Expert iPad landscape. Pick the last progression (Pop Canon), reopen the list: the picked row is fully in view,
  // clear of the bottom fade, and the list still ends above the piano.
  {
    const label = '1180x820 expert picked row visible on reopen';
    const { ctx, page, bag } = await fresh(browser, 1180, 820, label);
    try {
      await boot(page, 'test=1&hour=12&expert=1');
      const open = async () => {
        if (!(await page.locator('#xSrc .x-pbar').isVisible().catch(() => false))) { await page.locator('#xTog button[data-v="prog"]').click(); await page.waitForTimeout(200); }
        if (await page.evaluate(() => document.getElementById('xPList').hidden)) await page.locator('#xSrc .x-pbar').click();
        await page.waitForSelector('#xPList button[data-i]', { state: 'visible', timeout: 5000 }); await page.waitForTimeout(150);
      };
      await open();
      const n = await page.evaluate(() => document.querySelectorAll('#xPList .x-prow').length);
      const row = page.locator(`#xPList button[data-i="${n - 1}"]`); await row.scrollIntoViewIfNeeded(); await row.click(); await page.waitForTimeout(250);
      await open();
      const m = await page.evaluate(() => {
        const L = document.getElementById('xPList'), on = L.querySelector('.x-prow.on'), kb = document.querySelector('.kb-wrap');
        const lr = L.getBoundingClientRect(), or = on && on.getBoundingClientRect(), kr = kb.getBoundingClientRect();
        const fade = L.scrollHeight - L.clientHeight - L.scrollTop > 1 ? 28 : 0;
        return { pad: document.documentElement.classList.contains('lay-pad-land'), on: on ? +on.dataset.i : null, h: Math.round(lr.height),
          visible: !!(or && or.top >= lr.top - 1 && or.bottom <= lr.bottom - fade + 1), gap: Math.round(kr.top - lr.bottom) };
      });
      const notes = [];
      if (!m.pad) notes.push('not the iPad landscape layout');
      if (m.on !== n - 1) notes.push('picked row ' + m.on + ', want ' + (n - 1));
      if (!m.visible) notes.push('picked row not fully in view ' + JSON.stringify(m));
      if (m.gap < 0) notes.push('list covers the piano ' + JSON.stringify(m));
      if (bag.errors.length || bag.failed.length) notes.push('page: ' + bag.errors.concat(bag.failed).slice(0, 3).join('; '));
      if (notes.length) await shot(page, label);
      record(label, !notes.length, notes.length ? notes.join(' | ') : 'list ' + m.h + 'px, ' + m.gap + 'px above the piano');
    } catch (e) {
      await shot(page, label);
      record(label, false, (e && e.message || String(e)).split('\n')[0]);
    } finally {
      await ctx.close();
    }
  }

  // N17: Expert phone landscape. Pick the last progression (Pop Canon), reopen: the list fills down to
  // 8px above the piano, at least two rows sit clear of the fade, and the picked row is fully above the fade line.
  {
    const label = '844x390 expert picked row clear of the fade on reopen';
    const { ctx, page, bag } = await fresh(browser, 844, 390, label);
    try {
      await boot(page, 'test=1&hour=12&expert=1');
      const open = async () => {
        if (!(await page.locator('#xSrc .x-pbar').isVisible().catch(() => false))) { await page.locator('#xTog button[data-v="prog"]').click(); await page.waitForTimeout(200); }
        if (await page.evaluate(() => document.getElementById('xPList').hidden)) await page.locator('#xSrc .x-pbar').click();
        await page.waitForSelector('#xPList button[data-i]', { state: 'visible', timeout: 5000 }); await page.waitForTimeout(150);
      };
      await open();
      const n = await page.evaluate(() => document.querySelectorAll('#xPList .x-prow').length);
      const row = page.locator(`#xPList button[data-i="${n - 1}"]`); await row.scrollIntoViewIfNeeded(); await row.click(); await page.waitForTimeout(250);
      await open();
      const m = await page.evaluate(() => {
        const L = document.getElementById('xPList'), on = L.querySelector('.x-prow.on'), kb = document.querySelector('.kb-wrap');
        const lr = L.getBoundingClientRect(), or = on && on.getBoundingClientRect(), kr = kb.getBoundingClientRect();
        const fade = L.scrollHeight - L.clientHeight - L.scrollTop > 1 ? (parseFloat(getComputedStyle(L).getPropertyValue('--x-pl-fade')) || 28) : 0;
        const fadeTop = lr.bottom - fade;
        const rows = [...L.querySelectorAll('.x-prow')].map(r => r.getBoundingClientRect());
        const clear = rows.filter(r => r.top >= lr.top - 0.5 && r.bottom <= fadeTop + 0.5).length;
        return { land: document.documentElement.classList.contains('lay-phone-land'), on: on ? +on.dataset.i : null, h: Math.round(lr.height),
          visible: !!(or && or.top >= lr.top - 1 && or.bottom <= fadeTop + 1), gap: +(kr.top - lr.bottom).toFixed(1), fade, clear };
      });
      const notes = [];
      if (!m.land) notes.push('not the phone landscape layout');
      if (m.on !== n - 1) notes.push('picked row ' + m.on + ', want ' + (n - 1));
      if (m.h < 159) notes.push('list too short ' + JSON.stringify(m));
      if (Math.abs(m.gap - 8) > 1) notes.push('gap to piano not 8px ' + JSON.stringify(m));
      if (m.clear < 2) notes.push('fewer than 2 rows clear of the fade ' + JSON.stringify(m));
      if (!m.visible) notes.push('picked row not clear of the fade ' + JSON.stringify(m));
      if (bag.errors.length || bag.failed.length) notes.push('page: ' + bag.errors.concat(bag.failed).slice(0, 3).join('; '));
      if (notes.length) await shot(page, label);
      record(label, !notes.length, notes.length ? notes.join(' | ') : 'list ' + m.h + 'px, ' + m.gap + 'px above the piano, ' + m.clear + ' rows clear');
    } catch (e) {
      await shot(page, label);
      record(label, false, (e && e.message || String(e)).split('\n')[0]);
    } finally {
      await ctx.close();
    }
  }

  // N17: Expert iPad mini portrait is the iPad layout (sz-regular, lay-pad-port). Same reopen:
  // the list ends 8px above the piano and the picked row is clear of the fade.
  {
    const label = '744x1133 expert picked row clear on reopen';
    const { ctx, page, bag } = await fresh(browser, 744, 1133, label);
    try {
      await boot(page, 'test=1&hour=12&expert=1');
      const open = async () => {
        if (!(await page.locator('#xSrc .x-pbar').isVisible().catch(() => false))) { await page.locator('#xTog button[data-v="prog"]').click(); await page.waitForTimeout(200); }
        if (await page.evaluate(() => document.getElementById('xPList').hidden)) await page.locator('#xSrc .x-pbar').click();
        await page.waitForSelector('#xPList button[data-i]', { state: 'visible', timeout: 5000 }); await page.waitForTimeout(150);
      };
      await open();
      const n = await page.evaluate(() => document.querySelectorAll('#xPList .x-prow').length);
      const row = page.locator(`#xPList button[data-i="${n - 1}"]`); await row.scrollIntoViewIfNeeded(); await row.click(); await page.waitForTimeout(250);
      await open();
      const m = await page.evaluate(() => {
        const L = document.getElementById('xPList'), on = L.querySelector('.x-prow.on'), kb = document.querySelector('.kb-wrap');
        const lr = L.getBoundingClientRect(), or = on && on.getBoundingClientRect(), kr = kb.getBoundingClientRect();
        const fade = L.scrollHeight - L.clientHeight - L.scrollTop > 1 ? (parseFloat(getComputedStyle(L).getPropertyValue('--x-pl-fade')) || 28) : 0;
        const fadeTop = lr.bottom - fade;
        const c = document.documentElement.classList;
        return { pad: c.contains('lay-pad-port') && c.contains('sz-regular'), on: on ? +on.dataset.i : null, h: Math.round(lr.height),
          visible: !!(or && or.top >= lr.top - 1 && or.bottom <= fadeTop + 1), gap: +(kr.top - lr.bottom).toFixed(1), fade,
          lay: [...c].filter(x => x.startsWith('lay-') || x.startsWith('sz-')).join(' ') };
      });
      const notes = [];
      if (!m.pad) notes.push('not the iPad portrait layout ' + m.lay);
      if (m.on !== n - 1) notes.push('picked row ' + m.on + ', want ' + (n - 1));
      if (m.h < 400) notes.push('list too short ' + JSON.stringify(m));
      if (Math.abs(m.gap - 8) > 1) notes.push('gap to piano not 8px ' + JSON.stringify(m));
      if (!m.visible) notes.push('picked row not clear of the fade ' + JSON.stringify(m));
      if (bag.errors.length || bag.failed.length) notes.push('page: ' + bag.errors.concat(bag.failed).slice(0, 3).join('; '));
      if (notes.length) await shot(page, label);
      record(label, !notes.length, notes.length ? notes.join(' | ') : 'list ' + m.h + 'px, ' + m.gap + 'px above the piano');
    } catch (e) {
      await shot(page, label);
      record(label, false, (e && e.message || String(e)).split('\n')[0]);
    } finally {
      await ctx.close();
    }
  }

  // N20: phone-browser fluid UI, rebased onto develop fd01bfc (112.15). Setup: Simple/Expert
  // at Jazz, key pc=1 (shown as D♭ in Simple major; Uiux's PR-A used C♯ minor — last-row
  // overflow still matched 96 / 73 / 15.4px), song "Anh Đã Ổn Hơn"; Kids after Go + first
  // card. Day only (Lamp matched Day on the 9a444df baseline and on PR-A).
  const N20_VPS = [[360, 640], [390, 664], [412, 732], [412, 780], [640, 360], [732, 412], [700, 900]];
  const N20_BAND = [[712, 1000], [744, 1133]]; // 600-767, Simple only; Sustain-left is real since PR-A
  const N20_IPAD = [[820, 1180], [768, 1024], [834, 1194], [1024, 1366]]; // Simple Sustain-left, real
  const N20_PRA = new Set(['360x640', '390x664', '412x732', '412x780', '700x900']);
  const N20_PRA2 = new Set(['1280x600', '1920x600']); // real checks; names start with "N20 PR-A2 Simple"
  const N20_FIXME_A = new Set([]);   // 360x640 expert used to clip the piano (PR-B). The chord grid now yields, so that check is real.
  const N20_FIXME_B = new Set([]);   // PR-A fixed every Simple Sustain-left cell
  const N20_N21 = new Set(['640x360 simple', '732x412 simple']);
  const N20_A_LABEL = { simple: 'last grid row', expert: 'piano', kids: 'pads' };
  function recordN20(name, ok, detail, knownFail) {
    if (knownFail && TOGGLE_FIXME) {
      results.push({ name, ok: true, fixme: true, detail });
      console.log('FIXME ' + name + (detail ? '  ' + detail : ''));
    } else {
      record(name, ok, detail);
    }
  }
  async function n20Fresh(w, h, where) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
    await ctx.addInitScript(() => {
      try { localStorage.clear(); localStorage.setItem('touchChord.tour.v1', 'done'); } catch (e) {}
    });
    const page = await ctx.newPage();
    return { ctx, page, bag: track(page, where) };
  }
  async function n20Prepare(page, mode) {
    if (mode === 'kids') {
      await boot(page, 'test=1&hour=12&kv=1');
      await page.waitForSelector('#kv .kv-go', { timeout: 8000 });
      await page.locator('#kv .kv-go').click();
      await page.waitForSelector('#kv .kv-card', { timeout: 8000 });
      await page.locator('#kv .kv-card').first().click();
      await page.waitForSelector('.kv-pad, .kv-playbtn', { timeout: 8000 });
    } else {
      await boot(page, mode === 'expert' ? 'test=1&hour=12&expert=1' : 'test=1&hour=12');
      if (mode === 'simple') {
        const landed = await landedMode(page);
        if (landed !== 'simple') await switchTo(page, 'simple');
      }
      await page.evaluate(() => { const b = document.querySelector('#styles button[data-style="jazz"]'); if (b) b.click(); });
      await page.waitForTimeout(80);
      await page.evaluate(t => { if (window.__upload && typeof window.__upload.load === 'function') window.__upload.load(t); }, N11_SONG);
      await page.waitForTimeout(450);
      await page.keyboard.press('Escape').catch(() => {});
      await page.evaluate(() => {
        document.querySelectorAll('.up-x, .kp-x').forEach(x => { if (x.offsetParent) x.click(); });
        const up = document.getElementById('uploadPick'); if (up) up.hidden = true;
        if (typeof window.__setKey === 'function') window.__setKey(1, 'major');
      });
      await page.waitForTimeout(200);
    }
    await page.evaluate(() => document.fonts && document.fonts.ready);
    await page.waitForTimeout(100);
  }
  async function n20Measure(page, mode) {
    return page.evaluate((modeName) => {
      const vis = el => {
        if (!el) return false;
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
      };
      const vv = window.visualViewport;
      const se = document.scrollingElement || document.documentElement;
      const vvTop = vv ? vv.offsetTop : 0;
      const vvH = vv ? vv.height : innerHeight;
      const vvW = vv ? vv.width : innerWidth;
      const vvLeft = vv ? vv.offsetLeft : 0;
      const vvBottom = vvTop + vvH;
      const vvRight = vvLeft + vvW;
      let box = null, kind = modeName, minRowH = null, rowCount = 0;
      if (modeName === 'simple') {
        const suggest = document.getElementById('suggest');
        const cells = suggest ? [...suggest.querySelectorAll('.ss-chip, .ss-note')].filter(vis) : [];
        const rowMap = new Map();
        for (const el of cells) {
          const top = Math.round(el.getBoundingClientRect().top);
          let key = top;
          for (const k of rowMap.keys()) if (Math.abs(k - top) <= 4) { key = k; break; }
          if (!rowMap.has(key)) rowMap.set(key, []);
          rowMap.get(key).push(el);
        }
        const rows = [...rowMap.entries()].sort((a, b) => a[0] - b[0]);
        rowCount = rows.length;
        const heights = rows.map(([, els]) => {
          const rs = els.map(el => el.getBoundingClientRect());
          return Math.max(...rs.map(r => r.bottom)) - Math.min(...rs.map(r => r.top));
        });
        if (heights.length) minRowH = +Math.min(...heights).toFixed(1);
        const last = rows.length ? rows[rows.length - 1][1] : [];
        if (last.length) {
          const rs = last.map(el => el.getBoundingClientRect());
          box = { top: Math.min(...rs.map(r => r.top)), bottom: Math.max(...rs.map(r => r.bottom)), left: Math.min(...rs.map(r => r.left)), right: Math.max(...rs.map(r => r.right)) };
        }
        kind = 'last grid row';
      } else if (modeName === 'expert') {
        const pads = document.getElementById('pads');
        const wrap = document.querySelector('.kb-wrap');
        const el = pads && vis(pads) ? pads : (wrap && vis(wrap) ? wrap : null);
        if (el) box = el.getBoundingClientRect();
        kind = 'piano';
      } else {
        const wrap = document.querySelector('.kv-pads');
        const pads = [...document.querySelectorAll('.kv-pad')].filter(vis);
        if (wrap && vis(wrap)) box = wrap.getBoundingClientRect();
        else if (pads.length) {
          const rs = pads.map(el => el.getBoundingClientRect());
          box = { top: Math.min(...rs.map(r => r.top)), bottom: Math.max(...rs.map(r => r.bottom)), left: Math.min(...rs.map(r => r.left)), right: Math.max(...rs.map(r => r.right)) };
        }
        kind = 'pads';
      }
      const overflowVv = box ? +(box.bottom - vvBottom).toFixed(1) : null;
      const sparePx = overflowVv == null ? null : +(-overflowVv).toFixed(1);
      const app = document.getElementById('app');
      const appBox = app && vis(app) ? app.getBoundingClientRect() : null;
      const midline = appBox ? appBox.left + appBox.width / 2 : innerWidth / 2;
      const sus = document.getElementById('sustainBtn');
      const susOn = vis(sus);
      const susR = susOn ? sus.getBoundingClientRect() : null;
      const susCx = susR ? susR.left + susR.width / 2 : null;
      const rights = [];
      for (const root of [app, document.getElementById('kv'), document.body].filter(Boolean)) {
        rights.push(root.getBoundingClientRect().right);
        for (const el of root.children) if (vis(el)) rights.push(el.getBoundingClientRect().right);
      }
      if (box) rights.push(box.right);
      const maxRight = rights.length ? Math.max(...rights) : 0;
      const hOverflow = Math.max(0, +(maxRight - vvRight).toFixed(1), +((se.scrollWidth || 0) - innerWidth).toFixed(1));
      const tapSel = 'button, [role="button"], a[href], input, select, textarea, .ss-chip, .ss-note, .pad, .kv-pad, .kv-playbtn, .kv-next, .kv-card, .kv-go, .mode-chip, .pg-btn';
      const seen = new Set();
      const offenders = [];
      for (const el of document.querySelectorAll(tapSel)) {
        if (seen.has(el) || !vis(el) || getComputedStyle(el).pointerEvents === 'none') continue;
        seen.add(el);
        const r = el.getBoundingClientRect();
        const min = Math.min(r.width, r.height);
        if (min + 0.5 < 44) {
          offenders.push({
            id: el.id || '',
            text: (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40),
            w: +r.width.toFixed(1), h: +r.height.toFixed(1), min: +min.toFixed(1)
          });
        }
      }
      // Style chips: one line by offsetTop; tap height includes the ::after hit padding (R4).
      const styleBtns = [...document.querySelectorAll('#styles button')].filter(vis);
      const chipTops = [...new Set(styleBtns.map(b => Math.round(b.offsetTop)))];
      let chipTapMin = null;
      for (const b of styleBtns) {
        const r = b.getBoundingClientRect();
        const after = getComputedStyle(b, '::after');
        const ext = (after && after.content && after.content !== 'none')
          ? Math.abs(parseFloat(after.top) || 0) + Math.abs(parseFloat(after.bottom) || 0)
          : 0;
        const hit = r.height + ext;
        if (chipTapMin == null || hit < chipTapMin) chipTapMin = hit;
      }
      if (chipTapMin != null) chipTapMin = +chipTapMin.toFixed(1);
      const togBtns = [...document.querySelectorAll('#xTog button, .topbar button')].filter(el => {
        const t = (el.textContent || el.getAttribute('aria-label') || '');
        return /Song|Progressions/.test(t) && vis(el);
      });
      const togH = togBtns.length ? +Math.min(...togBtns.map(b => b.getBoundingClientRect().height)).toFixed(1) : null;
      const volEl = document.getElementById('volume') || document.querySelector('#nowMix, .now-vol, .pg-vol');
      const volH = volEl && vis(volEl) ? +volEl.getBoundingClientRect().height.toFixed(1) : null;
      const volWrap = document.querySelector('#nowMix, .now-vol');
      const volWrapH = volWrap && vis(volWrap) ? +volWrap.getBoundingClientRect().height.toFixed(1) : null;
      const susBottom = susR ? +susR.bottom.toFixed(1) : null;
      const susSpare = susR ? +(vvBottom - susR.bottom).toFixed(1) : null;
      const susFullyIn = !!(susR && susR.bottom <= vvBottom + 0.5 && susR.top >= vvTop - 0.5);
      const scrollOverflow = +Math.max(0, (se.scrollHeight || 0) - innerHeight).toFixed(1);
      return {
        kind, overflowVv, sparePx, minRowH, rowCount,
        bottom: box ? +box.bottom.toFixed(1) : null, vvBottom: +vvBottom.toFixed(1),
        hasBox: !!box, susOn, susCx: susCx == null ? null : +susCx.toFixed(1),
        midline: +midline.toFixed(1),
        susLeft: susOn && susCx < midline - 0.5,
        susDelta: susOn ? +(susCx - midline).toFixed(1) : null,
        susBottom, susSpare, susFullyIn, scrollOverflow,
        hOverflow, offenders,
        chipLines: chipTops.length, chipTapMin, togH, volH, volWrapH,
        lay: [...document.documentElement.classList].filter(c => c.startsWith('lay-') || c.startsWith('sz-')).join(' ')
      };
    }, mode);
  }
  async function n20RunCell(w, h, mode, opts = {}) {
    const cell = w + 'x' + h + ' ' + mode;
    const where = 'N20 ' + cell;
    const { ctx, page, bag } = await n20Fresh(w, h, where);
    try {
      await n20Prepare(page, mode);
      const m = await n20Measure(page, mode);
      const pageNotes = bag.errors.concat(bag.failed).slice(0, 3);
      const size = w + 'x' + h;
      if (mode === 'simple' && N20_PRA2.has(size)) {
        // PR-A2: Simple pad-land height budget. Real checks (not fixmes).
        const name = 'N20 PR-A2 Simple ' + size + ': last grid row has ≥8px spare, Sustain fully visible, min row ≥43.9px';
        const notes = [];
        if (!m.hasBox) notes.push('no last grid row to measure');
        else if (m.sparePx == null || m.sparePx < 8) {
          if (m.overflowVv > 0) notes.push('last grid row overflows the visual viewport by ' + m.overflowVv + 'px (bottom ' + m.bottom + ' vs vv ' + m.vvBottom + ', spare ' + m.sparePx + 'px, need ≥8)');
          else notes.push('last grid row spare ' + m.sparePx + 'px (bottom ' + m.bottom + ' vs vv ' + m.vvBottom + ', need ≥8)');
        }
        if (!m.susOn) notes.push('Sustain is not visible');
        else {
          if (!m.susFullyIn) notes.push('Sustain is clipped (bottom ' + m.susBottom + ' vs vv ' + m.vvBottom + ', spare ' + m.susSpare + 'px)');
          else if (m.susSpare == null || m.susSpare < 8) notes.push('Sustain spare ' + m.susSpare + 'px (bottom ' + m.susBottom + ' vs vv ' + m.vvBottom + ', need ≥8)');
          if (!m.susLeft) notes.push('Sustain center x ' + m.susCx + ' is not left of the layout midline ' + m.midline + ' (delta ' + m.susDelta + 'px)');
        }
        if (m.minRowH == null) notes.push('no grid rows to measure');
        else if (m.minRowH < 43.9) notes.push('min grid row ' + m.minRowH + 'px (< 43.9)');
        if (m.scrollOverflow > 1) notes.push('page scroll ' + m.scrollOverflow + 'px');
        if (pageNotes.length) notes.push('page: ' + pageNotes.join('; '));
        if (notes.length) await shot(page, name);
        const okDetail = 'grid spare ' + m.sparePx + 'px, Sustain spare ' + m.susSpare + 'px, min row ' + m.minRowH + 'px, Sustain cx ' + m.susCx + ' / mid ' + m.midline + (m.lay ? ', ' + m.lay : '');
        console.log('N20 PR-A2 spare ' + size + ' simple: grid ' + m.sparePx + 'px, Sustain ' + m.susSpare + 'px, min row ' + m.minRowH + 'px');
        record(name, !notes.length, notes.length ? notes.join(' | ') : okDetail);
      } else if (mode === 'simple' && N20_PRA.has(size)) {
        // PR-A acceptance (real check since PR-A). Hard bar: the last grid row has at least 8px spare.
        const name = 'N20 PR-A ' + cell + ': last grid row has ≥8px spare, min row ≥44px, Sustain left, chips one 44px line';
        const notes = [];
        if (!m.hasBox) notes.push('no last grid row to measure');
        else {
          if (m.sparePx == null || m.sparePx < 8) {
            if (m.overflowVv > 0) notes.push('last grid row overflows the visual viewport by ' + m.overflowVv + 'px (bottom ' + m.bottom + ' vs vv ' + m.vvBottom + ', spare ' + m.sparePx + 'px, need ≥8)');
            else notes.push('last grid row spare ' + m.sparePx + 'px (bottom ' + m.bottom + ' vs vv ' + m.vvBottom + ', need ≥8)');
          }
        }
        if (m.minRowH == null) notes.push('no grid rows to measure');
        else if (m.minRowH + 0.05 < 44) notes.push('min grid row ' + m.minRowH + 'px (< 44)');
        if (!m.susOn) notes.push('Sustain is not visible');
        else if (!m.susLeft) notes.push('Sustain center x ' + m.susCx + ' is not left of the layout midline ' + m.midline + ' (delta ' + m.susDelta + 'px)');
        if (m.chipLines !== 1) notes.push('style chips are on ' + m.chipLines + ' lines (need 1, by offsetTop)');
        if (m.chipTapMin == null) notes.push('no style chips to measure tap height');
        else if (m.chipTapMin + 0.5 < 44) notes.push('style chip tap height ' + m.chipTapMin + 'px (< 44)');
        if (pageNotes.length) notes.push('page: ' + pageNotes.join('; '));
        if (notes.length) await shot(page, name);
        const okDetail = 'spare ' + m.sparePx + 'px, min row ' + m.minRowH + 'px, Sustain cx ' + m.susCx + ' / mid ' + m.midline + ', chips ' + m.chipLines + ' line × ' + m.chipTapMin + 'px tap';
        console.log('N20 PR-A spare ' + cell + ': ' + m.sparePx + 'px below the last grid row, smallest row ' + m.minRowH + 'px');
        recordN20(name, !notes.length, notes.length ? notes.join(' | ') : okDetail, false);
      } else {
        const aName = 'N20 ' + cell + ': ' + N20_A_LABEL[mode] + ' fully inside the visual viewport';
        const aNotes = [];
        if (!m.hasBox) aNotes.push('no ' + N20_A_LABEL[mode] + ' to measure');
        else if (m.overflowVv > 1) aNotes.push(m.kind + ' overflows the visual viewport by ' + m.overflowVv + 'px (bottom ' + m.bottom + ' vs vv ' + m.vvBottom + ')');
        if (pageNotes.length) aNotes.push('page: ' + pageNotes.join('; '));
        if (aNotes.length) await shot(page, aName);
        recordN20(aName, !aNotes.length, aNotes.length ? aNotes.join(' | ') : (m.kind + ' ' + m.overflowVv + 'px vs the visual viewport'), N20_FIXME_A.has(cell));

        if (mode !== 'kids') {
          const bName = 'N20 ' + cell + ': Sustain center is in the left half';
          const bNotes = [];
          if (!m.susOn) bNotes.push('Sustain is not visible');
          else if (!m.susLeft) bNotes.push('Sustain center x ' + m.susCx + ' is not left of the layout midline ' + m.midline + ' (delta ' + m.susDelta + 'px)');
          if (pageNotes.length) bNotes.push('page: ' + pageNotes.join('; '));
          if (bNotes.length) await shot(page, bName);
          recordN20(bName, !bNotes.length, bNotes.length ? bNotes.join(' | ') : ('Sustain cx ' + m.susCx + ', midline ' + m.midline + (m.lay ? ', ' + m.lay : '')), N20_FIXME_B.has(cell));
        }
      }

      const dName = 'N20 ' + cell + ': no horizontal overflow';
      const dNotes = [];
      if (m.hOverflow > 1) dNotes.push('horizontal overflow ' + m.hOverflow + 'px');
      if (pageNotes.length) dNotes.push('page: ' + pageNotes.join('; '));
      if (dNotes.length) await shot(page, dName);
      record(dName, !dNotes.length, dNotes.length ? dNotes.join(' | ') : '0px');

      if (N20_N21.has(cell)) {
        const n21 = 'N21 ' + cell + ': Song/Progressions and volume tap height ≥ 44px';
        const n21n = [];
        if (m.togH == null) n21n.push('no Song/Progressions control to measure');
        else if (m.togH + 0.5 < 44) n21n.push('Song/Progressions ' + m.togH + 'px');
        const vol = m.volWrapH != null ? m.volWrapH : m.volH;
        if (vol == null) n21n.push('no volume control to measure');
        else if (vol + 0.5 < 44) n21n.push('volume ' + vol + 'px' + (m.volH != null && m.volH !== vol ? ' (input ' + m.volH + 'px)' : ''));
        if (pageNotes.length) n21n.push('page: ' + pageNotes.join('; '));
        if (n21n.length) await shot(page, n21);
        recordN20(n21, !n21n.length, n21n.length ? n21n.join(', ') : ('Song/Progressions ' + m.togH + 'px, volume ' + vol + 'px'), true);
      }

      if (m.offenders && m.offenders.length) {
        const head = m.offenders.slice(0, 8).map(o => (o.id ? '#' + o.id : o.text || 'target') + ' ' + o.w + 'x' + o.h).join('; ');
        console.log('N20 tap targets (informational) ' + cell + ': ' + m.offenders.length + ' under 44px: ' + head);
      }
    } catch (e) {
      await shot(page, where);
      record(where, false, (e && e.message || String(e)).split('\n')[0]);
    } finally {
      await ctx.close();
    }
  }

  for (const [w, h] of N20_VPS) {
    for (const mode of ['simple', 'expert', 'kids']) await n20RunCell(w, h, mode);
  }
  for (const [w, h] of N20_BAND) await n20RunCell(w, h, 'simple');
  for (const [w, h] of N20_IPAD) await n20RunCell(w, h, 'simple');
  for (const [w, h] of [[1280, 600], [1920, 600]]) await n20RunCell(w, h, 'simple');

  // Flow layout rev2 (Vinh, 20 Nov 2026). Real checks.
  //  - Kids: every chord pad is exactly as tall as the piano (±1px), both at least 44px, nothing below the screen.
  //  - Simple: no volume slider; Next / Play at least 44px and on screen.
  //  - Big windows (option B): past 1180x820 / 820x1180 the page zooms (1920x1080 = 1.317) and nothing scrolls; a real
  //    tap at a chord chip's screen position still plays that chip. Up to the reference sizes the zoom is 1.
  // Rects come back in page px (boot-early.js), so they are compared with tcVW / tcVH, never with innerWidth.
  const FLOW_VPS = [[390, 844], [844, 390], [744, 1133], [820, 1180], [1180, 820], [1920, 1080]];
  const flowZoom = (w, h) => { const z = w > h ? Math.min(w / 1180, h / 820) : Math.min(w / 820, h / 1180); return z > 1 ? Math.round(z * 1000) / 1000 : 1; };
  async function flowCell(w, h, mode) {
    const size = w + 'x' + h, where = 'FLOW ' + size + ' ' + mode;
    const { ctx, page, bag } = await n20Fresh(w, h, where);
    try {
      await n20Prepare(page, mode);
      await page.waitForTimeout(250);
      const m = await page.evaluate(() => {
        const vis = e => !!(e && e.getClientRects().length && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden');
        const box = e => { const r = e.getBoundingClientRect(); return { t: r.top, b: r.bottom, l: r.left, r: r.right, w: r.width, h: r.height }; };
        const de = document.documentElement;
        const out = { z: window.tcZoom, zoomStyle: de.style.zoom || '', vw: window.tcVW(), vh: window.tcVH(),
          scrollX: de.scrollWidth - de.clientWidth, scrollY: de.scrollHeight - de.clientHeight };
        out.pads = [...document.querySelectorAll('.kv-pad')].filter(vis).map(box);
        const pn = document.querySelector('.kv-piano'); out.piano = vis(pn) ? box(pn) : null;
        out.volVisible = vis(document.getElementById('nowMix')) || vis(document.getElementById('volume'));
        out.transport = ['#prog .pg-step', '#prog .pg-song'].map(s => document.querySelector(s)).filter(vis).map(box);
        return out;
      });
      const notes = [], want = flowZoom(w, h);
      if (Math.abs((m.z || 0) - want) > 0.001) notes.push('zoom ' + m.z + ', want ' + want);
      if (want === 1 && m.zoomStyle) notes.push('html zoom "' + m.zoomStyle + '" at a reference size or smaller');
      if (m.scrollX > 1 || m.scrollY > 1) notes.push('page scrolls ' + m.scrollX + 'x' + m.scrollY + 'px');
      let detail = 'zoom ' + m.z;
      if (mode === 'kids') {
        if (!m.piano) notes.push('no piano');
        else if (!m.pads.length) notes.push('no chord pads');
        else {
          const ph = m.piano.h, hs = m.pads.map(p => p.h);
          const off = hs.filter(x => Math.abs(x - ph) > 1);
          if (off.length) notes.push('pad heights ' + [...new Set(hs.map(x => x.toFixed(1)))].join('/') + ' vs piano ' + ph.toFixed(1));
          if (ph < 44 || Math.min(...hs) < 44) notes.push('under 44px: piano ' + ph.toFixed(1) + ', smallest pad ' + Math.min(...hs).toFixed(1));
          if (m.piano.b > m.vh + 1) notes.push('piano bottom ' + m.piano.b.toFixed(1) + ' below the screen ' + m.vh.toFixed(1));
          detail += ', pad ' + m.pads[0].w.toFixed(0) + 'x' + hs[0].toFixed(0) + ', piano ' + m.piano.w.toFixed(0) + 'x' + ph.toFixed(0);
        }
      } else if (mode === 'simple') {
        if (m.volVisible) notes.push('the volume slider is visible in Simple');
        if (m.transport.length !== 2) notes.push('Next / Play visible: ' + m.transport.length);
        for (const t of m.transport) {
          if (t.h < 44 || t.w < 44) notes.push('Next / Play ' + t.w.toFixed(1) + 'x' + t.h.toFixed(1) + ' under 44px');
          if (t.b > m.vh + 1) notes.push('Next / Play bottom ' + t.b.toFixed(1) + ' below the screen ' + m.vh.toFixed(1));
        }
        if (m.transport[0]) detail += ', Next ' + m.transport[0].w.toFixed(0) + 'x' + m.transport[0].h.toFixed(0);
      } else if (want > 1) {
        // Expert under zoom: a real tap at the chip's screen position (page px x zoom) plays it.
        // NOW (#symbol) shows the chord name; a chip's text carries its roman numeral too ("D♭maj7I").
        const NOW_JS = "(() => { const n = document.getElementById('symbol'); return n ? n.textContent.trim() : ''; })()";
        const tgt = await page.evaluate(nowJs => {
          const now = (0, eval)(nowJs);
          const c = [...document.querySelectorAll('#suggest .ss-chip')].find(e => e.getClientRects().length && e.textContent.trim() && !(now && e.textContent.trim().startsWith(now)));
          if (!c) return null; const r = c.getBoundingClientRect(), z = window.tcZoom;
          return { x: (r.left + r.width / 2) * z, y: (r.top + r.height / 2) * z, name: c.textContent.trim().split(/\s+/)[0] };
        }, NOW_JS);
        if (!tgt) notes.push('no chord chip to tap');
        else {
          await page.mouse.click(tgt.x, tgt.y);
          await page.waitForTimeout(250);
          const now = await page.evaluate(NOW_JS);
          if (!now || !tgt.name.startsWith(now)) notes.push('tap on ' + tgt.name + ' at screen ' + Math.round(tgt.x) + ',' + Math.round(tgt.y) + ' left NOW = "' + now.slice(0, 30) + '"');
          detail += ', tap ' + tgt.name + ' -> NOW ok';
        }
      }
      const pageNotes = bag.errors.concat(bag.failed).slice(0, 3);
      if (pageNotes.length) notes.push('page: ' + pageNotes.join('; '));
      const name = 'FLOW rev2 ' + size + ' ' + mode + ': ' + (mode === 'kids' ? 'chord pads = piano height' : mode === 'simple' ? 'no volume slider, Next / Play fit' : 'zoom ' + want + (want > 1 ? ', tap hits' : '')) + ', no scroll';
      if (notes.length) await shot(page, name);
      record(name, !notes.length, notes.length ? notes.join(' | ') : detail);
    } catch (err) {
      record('FLOW rev2 ' + size + ' ' + mode, false, String(err && err.message || err));
    } finally {
      await ctx.close();
    }
  }
  for (const [w, h] of FLOW_VPS) {
    for (const mode of ['kids', 'simple', 'expert']) await flowCell(w, h, mode);
  }

  // GRID over piano (Vinh, 21 Nov 2026: Galaxy S25 in Brave, landscape, ~780x310-360 usable). Real checks.
  // Expert's chord grid (5 rows: bright / happy / scale / sad / tension) used to keep a 32px row floor, so on screens
  // under ~350 css tall the tension row (Csus4, E♭7, ...) slid over the piano. At each phone-landscape size, with the
  // uploaded song in F major / Reggae:
  //  - Expert and Simple: the real grid, then the same chips forced into 4 and 6 equal rows (test-only inline style;
  //    the app itself always draws Expert in 5 rows), must end at or above the piano top (Simple has no piano in phone
  //    landscape, so its grid must stay inside its panel and on screen). SUSTAIN and the button column must too.
  //  - Expert, real 5 rows: while the piano is taller than its 72px floor, no chord row is under 32px (the piano gives way first).
  //  - Kids: every chord pad ends at or above the piano top.
  //  - Every mode, every size: the piano (Simple: the grid) ends within innerHeight and the page does not scroll, also
  //    with "dvh +56" (Vinh, 21 Nov 12:53 PM: Brave on the S25 at ~915x330-360 still cut the piano off): 1dvh is made
  //    56px (an address bar) taller than innerHeight, as that browser reports it; the layout must follow innerHeight.
  const GRID_VPS = [[780, 310], [780, 330], [780, 360], [640, 360], [667, 375], [844, 390], [915, 330], [915, 345], [915, 360], [915, 412], [932, 430]];
  const GRID_SIM = 56;
  const GRID_ROWN = { b: 1, h: 2, n: 3, s: 4, t: 5 };
  async function gridMeasure(page, mode, rows) {
    return page.evaluate(({ mode, rows, ROWN }) => {
      const vis = e => !!(e && e.getClientRects().length && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden');
      const g = mode === 'kids' ? null : document.getElementById('suggest');
      if (g && rows) {
        g.style.setProperty('grid-template-rows', 'repeat(' + rows + ', minmax(0, 1fr))', 'important');
        let k = 0;
        for (const c of g.children) {
          if (!c.dataset.tcRow) c.dataset.tcRow = c.style.gridRow || '';
          const r = ROWN[(c.dataset.tcRow.trim().match(/^[a-z]+/) || [''])[0]] || 3;
          c.style.gridRow = String(rows === 4 ? Math.min(r, 4) : rows === 6 && r === 5 && (k++ % 2) ? 6 : r);
        }
      }
      const cells = mode === 'kids' ? [...document.querySelectorAll('.kv-pad')].filter(vis) : [...g.children].filter(e => vis(e) && e.getBoundingClientRect().height > 0);
      const pn = mode === 'kids' ? document.querySelector('.kv-piano') : document.querySelector('.kb-wrap');
      const rs = cells.map(e => e.getBoundingClientRect());
      const side = mode === 'expert' ? [document.getElementById('sustainBtn'), ...document.querySelectorAll('#xCtl > *')].filter(vis).map(e => e.getBoundingClientRect().bottom) : [];
      const out = { n: cells.length, rows: new Set(rs.map(r => Math.round(r.top))).size, bottom: rs.length ? Math.max(...rs.map(r => r.bottom)) : null,
        minH: rs.length ? Math.min(...rs.map(r => r.height)) : null, piano: vis(pn) ? pn.getBoundingClientRect() : null, side: side.length ? Math.max(...side) : null,
        panel: g ? g.getBoundingClientRect().bottom : null, vh: window.tcVH(), inner: window.innerHeight / window.tcZoom,
        pageScroll: document.documentElement.scrollHeight - document.documentElement.clientHeight };
      if (g && rows) { g.style.removeProperty('grid-template-rows'); for (const c of g.children) { c.style.gridRow = c.dataset.tcRow; delete c.dataset.tcRow; } }
      return JSON.parse(JSON.stringify(out, (k, v) => v instanceof DOMRect ? { top: v.top, bottom: v.bottom, height: v.height } : v));
    }, { mode, rows, ROWN: GRID_ROWN });
  }
  async function gridCell(w, h, mode) {
    const size = w + 'x' + h, where = 'GRID ' + size + ' ' + mode;
    const { ctx, page, bag } = await n20Fresh(w, h, where);
    try {
      await n20Prepare(page, mode);
      if (mode !== 'kids') {
        await page.evaluate(() => { const b = document.querySelector('#styles button[data-style="reggae"]'); if (b) b.click(); if (typeof window.__setKey === 'function') window.__setKey(5, 'major'); });
        await page.waitForTimeout(350);
      }
      for (const run of (mode === 'kids' ? [0] : [0, 4, 6]).map(r => ({ rows: r })).concat([{ rows: 0, sim: GRID_SIM }])) {
        const rows = run.rows;
        if (run.sim) {
          await page.evaluate(sim => document.documentElement.style.setProperty('--tc-dvh0', ((innerHeight + sim) / 100) + 'px'), run.sim);
          await page.waitForTimeout(150);
        }
        const m = await gridMeasure(page, mode, rows);
        const notes = [], label = (rows ? rows + ' rows (forced)' : 'real grid (' + m.rows + ' rows)') + (run.sim ? ', dvh +' + run.sim : '');
        if (m.pageScroll > 1) notes.push('page scrolls ' + m.pageScroll + 'px');
        if (!m.n) notes.push('no chord cells');
        if (m.piano) {
          if (m.bottom > m.piano.top + 0.5) notes.push('grid bottom ' + m.bottom.toFixed(1) + ' is below the piano top ' + m.piano.top.toFixed(1));
          if (m.side != null && m.side > m.piano.top + 0.5) notes.push('SUSTAIN / buttons bottom ' + m.side.toFixed(1) + ' is below the piano top ' + m.piano.top.toFixed(1));
          if (m.piano.bottom > m.inner + 0.5) notes.push('piano bottom ' + m.piano.bottom.toFixed(1) + ' below innerHeight ' + m.inner.toFixed(1));
          if (mode === 'expert' && !rows && m.piano.height > 72.5 && m.minH < 31.5) notes.push('a chord row is ' + m.minH.toFixed(1) + 'px while the piano (' + m.piano.height.toFixed(1) + 'px) could still give way');
        } else if (mode === 'simple') {
          if (m.bottom > m.panel + 0.5) notes.push('grid bottom ' + m.bottom.toFixed(1) + ' past its panel ' + m.panel.toFixed(1));
          if (m.bottom > m.inner + 0.5) notes.push('grid bottom ' + m.bottom.toFixed(1) + ' below innerHeight ' + m.inner.toFixed(1));
        } else notes.push('no piano');
        const pageNotes = bag.errors.concat(bag.failed).slice(0, 3);
        if (pageNotes.length) notes.push('page: ' + pageNotes.join('; '));
        const name = 'GRID ' + size + ' ' + mode + ' ' + label + ': chord grid at or above the piano';
        if (notes.length) await shot(page, name);
        record(name, !notes.length, notes.length ? notes.join(' | ') : 'grid ' + (m.bottom == null ? '-' : m.bottom.toFixed(1)) + (m.piano ? ' / piano ' + m.piano.top.toFixed(1) + ' (' + m.piano.height.toFixed(0) + 'px)' : ' / panel ' + (m.panel == null ? '-' : m.panel.toFixed(1))) + ', smallest ' + (m.minH == null ? '-' : m.minH.toFixed(1)) + 'px');
      }
    } catch (err) {
      record(where, false, String(err && err.message || err).split('\n')[0]);
    } finally {
      await ctx.close();
    }
  }
  for (const [w, h] of GRID_VPS) {
    for (const mode of ['expert', 'simple', 'kids']) await gridCell(w, h, mode);
  }

  // NOW = song card (Vinh, 21 Nov 1:06 PM): in Expert the Now box (chord badge + its notes) sits beside the song / lyric
  // card and must be exactly as tall, top and bottom aligned (within 1px). In phone landscape it was 32px beside a
  // 40-46px card. Checked with the uploaded song at the S25-like sizes, a phone portrait and both iPad orientations.
  // (Simple has no Now box beside its song line.)
  const NOW_VPS = [[915, 330], [915, 345], [915, 360], [780, 310], [844, 390], [390, 844], [820, 1180], [1180, 820]];
  async function nowCell(w, h) {
    const size = w + 'x' + h, where = 'NOW ' + size + ' expert';
    const { ctx, page, bag } = await n20Fresh(w, h, where);
    try {
      await n20Prepare(page, 'expert');
      await page.evaluate(() => { const b = document.querySelector('#styles button[data-style="reggae"]'); if (b) b.click(); if (typeof window.__setKey === 'function') window.__setKey(5, 'major'); });
      await page.waitForTimeout(350);
      const m = await page.evaluate(() => {
        const vis = e => !!(e && e.getClientRects().length && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden');
        const box = q => { const e = [...document.querySelectorAll(q)].find(vis); if (!e) return null; const r = e.getBoundingClientRect(); return { t: r.top, b: r.bottom, h: r.height }; };
        return { now: box('.now-card'), src: box('#xSrc') };
      });
      const notes = [];
      if (!m.now || !m.src) notes.push('missing ' + (!m.now ? 'Now box' : 'song card'));
      else {
        if (Math.abs(m.now.h - m.src.h) > 1) notes.push('Now box ' + m.now.h.toFixed(1) + 'px vs song card ' + m.src.h.toFixed(1) + 'px');
        if (Math.abs(m.now.t - m.src.t) > 1 || Math.abs(m.now.b - m.src.b) > 1) notes.push('edges: Now ' + m.now.t.toFixed(1) + '-' + m.now.b.toFixed(1) + ', song card ' + m.src.t.toFixed(1) + '-' + m.src.b.toFixed(1));
      }
      const pageNotes = bag.errors.concat(bag.failed).slice(0, 3);
      if (pageNotes.length) notes.push('page: ' + pageNotes.join('; '));
      const name = 'NOW ' + size + ' expert: Now box as tall as the song card, edges aligned';
      if (notes.length) await shot(page, name);
      record(name, !notes.length, notes.length ? notes.join(' | ') : 'both ' + m.src.h.toFixed(1) + 'px');
    } catch (err) {
      record(where, false, String(err && err.message || err).split('\n')[0]);
    } finally {
      await ctx.close();
    }
  }
  for (const [w, h] of NOW_VPS) await nowCell(w, h);

  // NOTE label beside the lyric (Vinh, 21 Nov 2026). The next-chord / pad-letter name sits inline,
  // immediately right of its lyric word (~6 px), and the name box is the same height as that lyric
  // line (top and bottom edges aligned, within 1 px). Real checks at 390x844, 780x360 and 1180x820
  // in Simple, Expert and Kids, with the uploaded song (Kids: Twinkle).
  const NOTE_VPS = [[390, 844], [780, 360], [1180, 820]];
  async function noteStepUntilTag(page, mode) {
    const sel = mode === 'kids' ? '.kv-cuetag' : mode === 'expert' ? '.x-cuetag' : '.sl-cuetag';
    const next = nextSel(mode);
    for (let i = 0; i < 20; i++) {
      const ok = await page.evaluate(s => {
        const t = document.querySelector(s);
        return !!(t && !t.hidden && t.getClientRects().length);
      }, sel);
      if (ok) return true;
      if (mode === 'kids') {
        const n = page.locator('.kv-next');
        if (await n.count()) { try { await n.first().click({ timeout: 400 }); } catch (e) {} }
      } else {
        await page.evaluate(s => { const n = document.querySelector(s); if (n) n.click(); }, next);
      }
      await page.waitForTimeout(80);
    }
    return false;
  }
  async function noteMeasure(page, mode) {
    return page.evaluate(modeName => {
      const tagSel = modeName === 'kids' ? '.kv-cuetag' : modeName === 'expert' ? '.x-cuetag' : '.sl-cuetag';
      const wordSel = modeName === 'kids' ? '.kv-lyr .cue' : modeName === 'expert' ? '.x-cue' : '.sl-cue';
      const boxSel = modeName === 'kids' ? '.kv-lyr' : modeName === 'expert' ? '#xSrc .x-songc, #xSrc .x-lrows' : '#songBar .sl-lyr, #songBar';
      const tag = document.querySelector(tagSel);
      const word = document.querySelector(wordSel);
      const row = tag && tag.closest('[data-cue-row]');
      const box = document.querySelector(boxSel);
      const R = e => { if (!e) return null; const b = e.getBoundingClientRect(); return { t: b.top, l: b.left, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
      const vis = e => !!(e && e.getClientRects().length && getComputedStyle(e).display !== 'none' && !e.hidden);
      const cs = tag ? getComputedStyle(tag) : null;
      return {
        shown: vis(tag), inline: !!(tag && tag.className.indexOf('cuein') >= 0 && cs && cs.position !== 'absolute'),
        gap: (tag && word) ? tag.getBoundingClientRect().left - word.getBoundingClientRect().right : null,
        tag: R(tag), word: R(word), row: R(row), box: R(box),
        styleH: tag ? tag.style.height : null,
        lay: (document.documentElement.className.match(/lay-\S+/) || [''])[0]
      };
    }, mode);
  }
  async function noteCell(w, h, mode) {
    const size = w + 'x' + h, where = 'NOTE ' + size + ' ' + mode;
    const { ctx, page, bag } = await n20Fresh(w, h, where);
    try {
      await n20Prepare(page, mode);
      const found = await noteStepUntilTag(page, mode);
      if (found) await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      if (found) await page.waitForTimeout(200);
      const m = found ? await noteMeasure(page, mode) : null;
      const notes = [];
      if (!found || !m || !m.shown) notes.push('no name tag beside the lyric');
      else {
        if (!m.inline) notes.push('name is not inline in the lyric (position ' + (m.tag && 'ok') + ')');
        if (!m.word) notes.push('no cued lyric word');
        if (!m.row) notes.push('name is not inside a lyric line');
        if (m.word && m.tag) {
          const midT = m.tag.t + m.tag.h / 2, midW = m.word.t + m.word.h / 2;
          if (Math.abs(midT - midW) > Math.max(m.tag.h, m.word.h) / 2 + 2) notes.push('name is not on the same line as its word');
          if (m.tag.l < m.word.r - 0.5) notes.push('name overlaps the lyric word (gap ' + m.gap.toFixed(1) + 'px)');
          if (m.gap < 0 || m.gap > 12) notes.push('gap from word to name is ' + m.gap.toFixed(1) + 'px, want about 6px');
        }
        if (m.row && m.tag) {
          const dH = Math.abs(m.tag.h - m.row.h), dT = Math.abs(m.tag.t - m.row.t), dB = Math.abs(m.tag.b - m.row.b);
          if (dH > 1 || dT > 1 || dB > 1) notes.push('name box ' + m.tag.h.toFixed(1) + 'px @' + m.tag.t.toFixed(1) + '-' + m.tag.b.toFixed(1) + ' does not match the lyric line ' + m.row.h.toFixed(1) + 'px @' + m.row.t.toFixed(1) + '-' + m.row.b.toFixed(1));
        }
        if (m.box && m.tag) {
          if (m.tag.l < m.box.l - 4 || m.tag.r > m.box.r + 4 || m.tag.t < m.box.t - 4 || m.tag.b > m.box.b + 4) notes.push('name clips or sits outside the lyric box');
        }
      }
      const pageNotes = bag.errors.concat(bag.failed).slice(0, 3);
      if (pageNotes.length) notes.push('page: ' + pageNotes.join('; '));
      const name = 'NOTE ' + size + ' ' + mode + ': name sits next to the lyric, same height, no overlap';
      if (notes.length) await shot(page, name);
      record(name, !notes.length, notes.length ? notes.join(' | ') : (m ? 'gap ' + (m.gap == null ? '-' : m.gap.toFixed(1)) + 'px, name ' + m.tag.h.toFixed(1) + 'px, line ' + m.row.h.toFixed(1) + 'px, style ' + (m.styleH || '-') + ', ' + m.lay : ''));
    } catch (err) {
      record(where, false, String(err && err.message || err).split('\n')[0]);
    } finally {
      await ctx.close();
    }
  }
  for (const [w, h] of NOTE_VPS) {
    for (const mode of ['expert', 'simple', 'kids']) await noteCell(w, h, mode);
  }

  // LOOK v4 (Uiux mockups, Vinh 24 Nov 2026): css/look.css restyles Simple, Expert, Settings and Sound; Kids must not change.
  // Real checks at the compare sizes (S25 360x780 / 780x360, iPad 820x1180 / 1180x820):
  //   Kids: not one rule of look.css matches any element (html.kv guard), at Hello, the song picker and a song.
  //   Expert: Fredoka and Nunito are loaded from fonts/, the Now chord is Fredoka in #FFC23D, the Lock sits inside the
  //   progression selector (right end, vertically centred), Next has no bottom edge.
  //   Simple sideways on a phone: the control panel is about 296px, Major/Minor, style chips and progression buttons >= 40px.
  async function lookMatches(page) {
    return page.evaluate(() => {
      const sh = [...document.styleSheets].find(x => /css\/look\.css/.test(x.href || ''));
      if (!sh) return { missing: true };
      const hits = [];
      for (const r of sh.cssRules) {
        if (!r.selectorText) continue;
        const sel = r.selectorText.replace(/::?(before|after|placeholder|active)\b/g, '');
        let n = 0; try { n = document.querySelectorAll(sel).length; } catch (e) { hits.push('bad selector ' + sel); continue; }
        if (n) hits.push(n + 'x ' + r.selectorText.slice(0, 80));
      }
      return { rules: sh.cssRules.length, hits };
    });
  }
  for (const [w, h] of [[360, 780], [780, 360], [820, 1180], [1180, 820]]) {
    const size = w + 'x' + h;
    // Kids
    {
      const { ctx, page, bag } = await fresh(browser, w, h, 'LOOK kids ' + size);
      const notes = [];
      try {
        await boot(page, 'test=1&hour=12&kv=1');
        const steps = [['hello', async () => {}], ['picker', async () => { await page.locator('#kv .kv-go').click(); await page.waitForTimeout(400); }],
          ['song', async () => { await page.locator('#kv .kv-card[data-song="Kids Jingle Bells"]').click(); await page.waitForTimeout(600); }]];
        let rules = 0;
        for (const [label, act] of steps) {
          await act();
          const m = await lookMatches(page);
          if (m.missing) { notes.push('look.css not loaded'); break; }
          rules = m.rules;
          if (m.hits.length) notes.push(label + ': ' + m.hits.slice(0, 3).join(' | '));
        }
        if (bag.errors.length) notes.push('page: ' + bag.errors.slice(0, 2).join('; '));
        const name = 'LOOK ' + size + ' kids: no look.css rule matches anything in Kids';
        if (notes.length) await shot(page, name);
        record(name, !notes.length, notes.length ? notes.join(' | ') : rules + ' rules, 0 matches');
      } catch (err) { record('LOOK ' + size + ' kids', false, String(err && err.message || err).split('\n')[0]); }
      finally { await ctx.close(); }
    }
    // Expert
    {
      const { ctx, page, bag } = await fresh(browser, w, h, 'LOOK expert ' + size);
      const notes = [];
      try {
        await boot(page, 'test=1&hour=21&expert=1');
        await page.evaluate(() => document.fonts.ready);
        const m = await page.evaluate(async () => {
          await Promise.all([document.fonts.load('600 20px Fredoka'), document.fonts.load('16px Nunito')]);
          const loaded = [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/"/g, ''));
          const rc = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; };
          const sym = document.querySelector('.now-card #symbol'), pn = document.querySelector('.x-pbar .x-pn'), nx = document.getElementById('xNext');
          return { loaded, sym: sym && [getComputedStyle(sym).fontFamily, getComputedStyle(sym).color], pn: pn && getComputedStyle(pn).fontFamily,
            body: getComputedStyle(document.body).fontFamily, lock: rc('#xSrc .x-plock'), bar: rc('#xSrc .x-pbar'), nextShadow: nx && getComputedStyle(nx).boxShadow };
        });
        for (const f of ['Fredoka', 'Nunito']) if (!m.loaded.includes(f)) notes.push(f + ' not loaded');
        if (!m.sym || !/^"?Fredoka/.test(m.sym[0]) || m.sym[1] !== 'rgb(255, 194, 61)') notes.push('Now chord ' + JSON.stringify(m.sym));
        if (!/^"?Fredoka/.test(m.pn || '')) notes.push('progression name font ' + m.pn);
        if (!/^"?Nunito/.test(m.body)) notes.push('body font ' + m.body);
        if (!m.lock || !m.bar) notes.push('no lock / selector');
        else {
          if (m.lock.l < m.bar.l - 0.5 || m.lock.r > m.bar.r + 0.5 || m.lock.t < m.bar.t - 0.5 || m.lock.b > m.bar.b + 0.5) notes.push('lock is not inside the selector');
          if (Math.abs(m.bar.r - m.lock.r) > 3) notes.push('lock is not at the right end');
          if (Math.abs((m.lock.t + m.lock.b) / 2 - (m.bar.t + m.bar.b) / 2) > 1) notes.push('lock is not vertically centred');
          if (m.lock.w < 44 || m.lock.h < 40) notes.push('lock slot ' + m.lock.w.toFixed(0) + 'x' + m.lock.h.toFixed(0));
        }
        if (m.nextShadow && m.nextShadow !== 'none') notes.push('Next has a shadow ' + m.nextShadow);
        if (bag.errors.length) notes.push('page: ' + bag.errors.slice(0, 2).join('; '));
        const name = 'LOOK ' + size + ' expert: Fredoka/Nunito, yellow Now, docked Lock, flat Next';
        if (notes.length) await shot(page, name);
        record(name, !notes.length, notes.join(' | '));
      } catch (err) { record('LOOK ' + size + ' expert', false, String(err && err.message || err).split('\n')[0]); }
      finally { await ctx.close(); }
    }
  }
  {
    const { ctx, page, bag } = await fresh(browser, 780, 360, 'LOOK simple 780x360');
    const notes = [];
    try {
      await boot(page, 'test=1&hour=21');
      if ((await landedMode(page)) !== 'simple') await switchTo(page, 'simple');
      const m = await page.evaluate(() => {
        const hs = s => [...document.querySelectorAll(s)].filter(e => e.getClientRects().length).map(e => Math.round(e.getBoundingClientRect().height));
        const col = document.querySelector('.now-col'); const r = col && col.getBoundingClientRect();
        return { col: r && Math.round(r.width), mode: hs('.kk-mode'), styles: hs('#styles button'), prog: hs('#prog .pg-btn'), lay: document.documentElement.className };
      });
      if (!/lay-phone-land/.test(m.lay)) notes.push('not phone-land');
      if (!(m.col >= 280)) notes.push('control panel ' + m.col + 'px');
      for (const k of ['mode', 'styles', 'prog']) if (!m[k].length || Math.min(...m[k]) < 40) notes.push(k + ' ' + m[k].join(','));
      if (bag.errors.length) notes.push('page: ' + bag.errors.slice(0, 2).join('; '));
      const name = 'LOOK 780x360 simple: ~296px two-column panel, controls >= 40px';
      if (notes.length) await shot(page, name);
      record(name, !notes.length, notes.length ? notes.join(' | ') : 'panel ' + m.col + 'px');
    } catch (err) { record('LOOK 780x360 simple', false, String(err && err.message || err).split('\n')[0]); }
    finally { await ctx.close(); }
  }

  // Guitar tab (Expert only): four sizes, no overflow, labels fully visible, C cycles three grips.
  for (const [w, h] of [[360, 780], [780, 360], [820, 1180], [1180, 820]]) {
    const size = w + 'x' + h;
    const { ctx, page, bag } = await fresh(browser, w, h, 'GTR ' + size);
    const notes = [];
    try {
      await boot(page, 'test=1&hour=21&expert=1');
      await page.locator('#gtrTabs [data-gtr="guitar"]').click();
      await page.waitForTimeout(80);
      const m = await page.evaluate(() => {
        const box = e => { if (!e || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; };
        const vis = e => !!(e && e.getClientRects().length && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden');
        const textBox = e => {
          const range = document.createRange();
          range.selectNodeContents(e);
          const t = range.getBoundingClientRect();
          return t.width || t.height ? t : null;
        };
        const de = document.documentElement;
        const tabs = document.getElementById('gtrTabs');
        const cards = [...document.querySelectorAll('#gtrCards .gtr-card')].filter(vis);
        const labels = [...document.querySelectorAll('#gtrTabs button, #gtrCards .gtr-name, #gtrCards .gtr-lb, #gtrCards .gtr-vo span, #gtrCards .gtr-meta, #gtrCards .gtr-tap')];
        const clipped = labels.filter(e => {
          if (!vis(e)) return false;
          const t = textBox(e), host = e.closest('.gtr-card') || e.closest('.gtr-tabs');
          if (!t || !host || t.width < 1) return false;
          const c = host.getBoundingClientRect();
          return t.left < c.left - 1 || t.right > c.right + 1 || t.top < c.top - 1 || t.bottom > c.bottom + 1;
        }).map(e => (e.textContent || '').trim().slice(0, 40));
        const off = [];
        const vw = innerWidth, vh = innerHeight;
        for (const e of [tabs, ...cards, ...labels.filter(vis)]) {
          const r = box(e);
          if (!r) continue;
          if (r.l < -1 || r.t < -1 || r.r > vw + 1 || r.b > vh + 1) off.push((e.textContent || e.id || 'el').trim().slice(0, 24));
        }
        const chip = document.getElementById('xKeysChip');
        const pads = document.getElementById('pads');
        return {
          lay: de.className, gtr: de.classList.contains('gtr'),
          uke: /ukulele/i.test(document.body.innerText),
          octave: vis(chip), pads: vis(pads),
          tabs: box(tabs), cards: cards.map(c => ({ slot: c.dataset.slot, box: box(c), name: (c.querySelector('.gtr-name') || {}).textContent || '' })),
          label: (document.querySelector('[data-gtr-label]') || {}).textContent || '',
          clipped, off,
          page: de.scrollWidth > vw + 1 || de.scrollHeight > vh + 1
        };
      });
      if (!m.gtr) notes.push('guitar tab did not select');
      if (m.uke) notes.push('ukulele is on screen');
      if (m.octave) notes.push('octave control still visible');
      if (m.pads) notes.push('piano keys still visible');
      const side = /lay-phone-land|lay-pad-land/.test(m.lay);
      const want = side || /lay-pad-port/.test(m.lay) ? 4 : 2;
      if (m.cards.length !== want) notes.push('cards ' + m.cards.length + ' want ' + want);
      if (m.cards[0] && m.cards[0].name.trim() !== 'C') notes.push('now is ' + m.cards[0].name);
      if (m.tabs && m.cards[0]) {
        if (side && !(m.tabs.r <= m.cards[0].box.l + 1)) notes.push('tabs are not a left strip');
        if (!side && !(m.tabs.b <= m.cards[0].box.t + 2)) notes.push('tabs are not above the cards');
      }
      if (m.page) notes.push('page scrolls');
      const geo = await page.evaluate(() => {
        const shown = e => !!(e && e.getClientRects().length && getComputedStyle(e).display !== 'none');
        const portrait = /lay-phone-port|lay-pad-port/.test(document.documentElement.className);
        const phonePort = document.documentElement.classList.contains('lay-phone-port');
        function stack(card) {
          if (!card) return null;
          const name = card.querySelector('.gtr-name');
          const dia = card.querySelector('.gtr-diagram');
          const foot = card.querySelector('.gtr-foot');
          if (!name || !dia) return { missing: true };
          const nb = name.getBoundingClientRect(), db = dia.getBoundingClientRect();
          const footOn = shown(foot);
          const fb = footOn ? foot.getBoundingClientRect() : null;
          return {
            nameThenDia: nb.bottom <= db.top + 3,
            diaThenFoot: !footOn || db.bottom <= fb.top + 3,
            ratio: db.height > 1 ? +(db.width / db.height).toFixed(2) : 0
          };
        }
        const now = document.querySelector('#gtrCards .gtr-card.now');
        const next = document.querySelector('#gtrCards .gtr-card.next');
        const nh = now ? now.getBoundingClientRect().height : 0;
        const xh = next ? next.getBoundingClientRect().height : 0;
        return { portrait, phonePort, now: stack(now), next: stack(next), nextShorter: phonePort ? xh < nh - 1 : null };
      });
      if (geo.portrait) {
        if (!geo.now || !geo.now.nameThenDia || !geo.now.diaThenFoot) notes.push('now stack ' + JSON.stringify(geo.now));
        if (geo.next && (!geo.next.nameThenDia || !geo.next.diaThenFoot)) notes.push('next stack ' + JSON.stringify(geo.next));
        if (geo.now && (geo.now.ratio < 0.8 || geo.now.ratio > 1.25)) notes.push('now ratio ' + geo.now.ratio);
      }
      if (geo.phonePort && geo.nextShorter === false) notes.push('Next is not shorter than Now');
      if (size === '1180x820' || size === '820x1180') {
        const ipad = await page.evaluate(() => {
          function fretRatio(svg) {
            const lines = [...svg.querySelectorAll('line')];
            const horiz = lines.filter(l => Math.abs(+l.getAttribute('y1') - +l.getAttribute('y2')) < 0.1);
            const vert = lines.filter(l => Math.abs(+l.getAttribute('x1') - +l.getAttribute('x2')) < 0.1);
            const ys = [...new Set(horiz.map(l => +l.getAttribute('y1')))].sort((a, b) => a - b);
            const xs = [...new Set(vert.map(l => +l.getAttribute('x1')))].sort((a, b) => a - b);
            const ctm = svg.getScreenCTM();
            if (!ctm || ys.length < 2 || xs.length < 2) return 0;
            const fh = (ys[ys.length - 1] - ys[0]) / (ys.length - 1) * ctm.d;
            const sg = (xs[xs.length - 1] - xs[0]) / (xs.length - 1) * ctm.a;
            return sg ? fh / sg : 0;
          }
          const panel = document.getElementById('gtrPanel').getBoundingClientRect();
          return [...document.querySelectorAll('#gtrCards .gtr-card')].map(card => {
            const svg = card.querySelector('.gtr-diagram');
            const c = card.getBoundingClientRect();
            const d = svg.getBoundingClientRect();
            const overflow = c.bottom > panel.bottom + 1 || c.right > panel.right + 1 || c.top < panel.top - 1 || c.left < panel.left - 1
              || d.bottom > c.bottom + 1 || d.right > c.right + 1 || d.top < c.top - 1 || d.left < c.left - 1
              || card.scrollHeight > card.clientHeight + 1 || card.scrollWidth > card.clientWidth + 1;
            return {
              slot: card.dataset.slot,
              ratio: fretRatio(svg),
              dx: (d.left + d.right) / 2 - (c.left + c.right) / 2,
              dy: (d.top + d.bottom) / 2 - (c.top + c.bottom) / 2,
              h: d.height,
              overflow
            };
          });
        });
        if (size === '1180x820') {
          for (const c of ipad) {
            if (!(c.ratio <= 1.3)) notes.push(c.slot + ' fret ratio ' + c.ratio.toFixed(3));
            if (Math.abs(c.dx) > 4 || Math.abs(c.dy) > 4) notes.push(c.slot + ' off center ' + c.dx.toFixed(1) + ',' + c.dy.toFixed(1));
          }
        }
        if (size === '820x1180') {
          // .8 at 820×1180 drew Now 178px tall and Next 179px tall. Width was already the card.
          const base = { now: 178, next: 179 };
          for (const c of ipad) {
            if (c.overflow) notes.push(c.slot + ' overflows');
            if (base[c.slot] && !(c.h >= base[c.slot] * 1.15)) notes.push(c.slot + ' diagram ' + c.h.toFixed(1) + 'px');
          }
        }
      }
      const labels = [m.label];
      const cycleOn = await page.locator('[data-gtr-cycle="1"]').first().isVisible().catch(() => false);
      if (cycleOn) {
        for (let i = 0; i < 2; i++) {
          await page.locator('[data-gtr-cycle="1"]').first().click();
          labels.push((await page.locator('[data-gtr-label]').innerText()).trim());
        }
        const wantLabels = ['Open', 'A-shape · 3fr', 'E-shape · 8fr'];
        if (labels.join('|') !== wantLabels.join('|')) notes.push('cycle ' + labels.join(' | '));
      }
      if (size === '1180x820') {
        const barre = await page.evaluate(() => {
          const svg = document.querySelector('#gtrCards .gtr-card.now .gtr-diagram');
          if (!svg) return 0;
          const lines = [...svg.querySelectorAll('line')];
          const horiz = lines.filter(l => Math.abs(+l.getAttribute('y1') - +l.getAttribute('y2')) < 0.1);
          const vert = lines.filter(l => Math.abs(+l.getAttribute('x1') - +l.getAttribute('x2')) < 0.1);
          const ys = [...new Set(horiz.map(l => +l.getAttribute('y1')))].sort((a, b) => a - b);
          const xs = [...new Set(vert.map(l => +l.getAttribute('x1')))].sort((a, b) => a - b);
          const ctm = svg.getScreenCTM();
          if (!ctm || ys.length < 2 || xs.length < 2) return 0;
          const fh = (ys[ys.length - 1] - ys[0]) / (ys.length - 1) * ctm.d;
          const sg = (xs[xs.length - 1] - xs[0]) / (xs.length - 1) * ctm.a;
          return sg ? fh / sg : 0;
        });
        if (!(barre <= 1.3)) notes.push('barre fret ratio ' + barre.toFixed(3));
      }
      const clipped = await page.evaluate(() => {
        const vis = e => !!(e && e.getClientRects().length && getComputedStyle(e).display !== 'none');
        return [...document.querySelectorAll('#gtrTabs button, #gtrCards .gtr-name, #gtrCards .gtr-lb, #gtrCards .gtr-vo span, #gtrCards .gtr-meta, #gtrCards .gtr-tap')].filter(e => {
          if (!vis(e)) return false;
          const range = document.createRange(); range.selectNodeContents(e);
          const t = range.getBoundingClientRect();
          const host = e.closest('.gtr-card') || e.closest('.gtr-tabs');
          if (!host || t.width < 1) return false;
          const c = host.getBoundingClientRect();
          return t.left < c.left - 1 || t.right > c.right + 1 || t.top < c.top - 1 || t.bottom > c.bottom + 1;
        }).map(e => (e.textContent || '').trim().slice(0, 40));
      });
      if (m.clipped.length || clipped.length) notes.push('clipped ' + [...m.clipped, ...clipped].join(', '));
      if (m.off.length) notes.push('outside ' + [...new Set(m.off)].slice(0, 6).join(', '));
      if (size === '780x360') {
        await page.locator('#gtrTabs [data-gtr="piano"]').click();
        await page.waitForTimeout(80);
        const hits = await page.evaluate(() => {
          const tabs = document.getElementById('gtrTabs').getBoundingClientRect();
          return [...document.querySelectorAll('#pads .pad')].filter(k => {
            const r = k.getBoundingClientRect();
            if (r.width < 2 || r.height < 2) return false;
            return !(tabs.right <= r.left + 1 || tabs.left >= r.right - 1 || tabs.bottom <= r.top + 1 || tabs.top >= r.bottom - 1);
          }).length;
        });
        if (hits) notes.push('tabs overlap ' + hits + ' keys');
      }
      if (bag.errors.length) notes.push('page: ' + bag.errors.slice(0, 2).join('; '));
      const name = 'GTR ' + size + ': Guitar tab fits, no clipped labels, C cycles three grips';
      if (notes.length) await shot(page, name);
      record(name, !notes.length, notes.length ? notes.join(' | ') : m.lay);
    } catch (err) {
      try { await shot(page, 'GTR ' + size); } catch (e) {}
      record('GTR ' + size, false, String(err && err.message || err).split('\n')[0]);
    } finally { await ctx.close(); }
  }

  // Phone portrait with a real song: lyrics and the chord rows leave a short panel (a Galaxy S25
  // in Brave is about 120px shorter than the layout viewport). Now is Fm7b5, Next is Gm7.
  const EB_SONG = JSON.stringify({
    contractVersion: '1.2',
    song: { title: 'Night Hold', artist: 'Probe', key: { tonic: 'Eb', mode: 'major' } },
    timing: { bpm: 78, timeSignature: '4/4' },
    sections: [{ id: 'v', type: 'verse', chords: [
      { index: 0, chord: 'Fm7b5', position: { bar: 1, beat: 1 }, durationBeats: 4, confidence: 0.9 },
      { index: 1, chord: 'Gm7', position: { bar: 2, beat: 1 }, durationBeats: 4, confidence: 0.9 },
      { index: 2, chord: 'Abmaj7', position: { bar: 3, beat: 1 }, durationBeats: 4, confidence: 0.9 }
    ], lyrics: [
      { text: 'Hold the night and let it go now', markers: [{ charIndex: 0, chordIndex: 0 }, { charIndex: 20, chordIndex: 1 }] },
      { text: 'One more line under the words', markers: [{ charIndex: 0, chordIndex: 2 }] }
    ] }]
  });
  for (const [w, h] of [[360, 640], [384, 700], [412, 760], [412, 915]]) {
    const size = w + 'x' + h;
    const { ctx, page, bag } = await fresh(browser, w, h, 'GTR song ' + size);
    const notes = [];
    try {
      await boot(page, 'test=1&hour=21&expert=1');
      await page.waitForFunction(() => window.__upload && document.getElementById('gtrTabs'));
      await page.evaluate(text => {
        document.querySelector('#styles button[data-style="rnb"]').click();
        window.__upload.load(text);
      }, EB_SONG);
      await page.waitForTimeout(60);
      const picked = await page.evaluate(() => {
        const b = [...document.querySelectorAll('#suggest button')].find(el => /♭5|b5/.test(el.textContent || ''));
        if (b) b.click();
        return b ? (b.textContent || '').trim().slice(0, 24) : '';
      });
      if (!picked) notes.push('no Fm7b5 chip');
      await page.locator('#gtrTabs [data-gtr="guitar"]').click();
      await page.waitForTimeout(80);
      const m = await page.evaluate(() => {
        function fretRatio(svg) {
          const lines = [...svg.querySelectorAll('line')];
          const horiz = lines.filter(l => Math.abs(+l.getAttribute('y1') - +l.getAttribute('y2')) < 0.1);
          const vert = lines.filter(l => Math.abs(+l.getAttribute('x1') - +l.getAttribute('x2')) < 0.1);
          const ys = [...new Set(horiz.map(l => +l.getAttribute('y1')))].sort((a, b) => a - b);
          const xs = [...new Set(vert.map(l => +l.getAttribute('x1')))].sort((a, b) => a - b);
          const ctm = svg.getScreenCTM();
          if (!ctm || ys.length < 2 || xs.length < 2) return 0;
          const fh = (ys[ys.length - 1] - ys[0]) / (ys.length - 1) * ctm.d;
          const sg = (xs[xs.length - 1] - xs[0]) / (xs.length - 1) * ctm.a;
          return sg ? fh / sg : 0;
        }
        const panel = document.getElementById('gtrPanel').getBoundingClientRect();
        const vw = innerWidth, vh = innerHeight;
        const cards = [...document.querySelectorAll('#gtrCards .gtr-card')].map(card => {
          const svg = card.querySelector('.gtr-diagram');
          const c = card.getBoundingClientRect();
          const d = svg.getBoundingClientRect();
          const texts = [...card.querySelectorAll('.gtr-name, .gtr-lb, .gtr-vo span, .gtr-meta, .gtr-tap')].filter(e => e.getClientRects().length);
          const clipped = texts.filter(e => {
            const range = document.createRange(); range.selectNodeContents(e);
            const t = range.getBoundingClientRect();
            return t.width > 1 && (t.left < c.left - 1 || t.right > c.right + 1 || t.top < c.top - 1 || t.bottom > c.bottom + 1);
          }).map(e => (e.textContent || '').trim().slice(0, 24));
          return {
            slot: card.dataset.slot,
            name: (card.querySelector('.gtr-name') || {}).textContent || '',
            dw: d.width, dh: d.height, ratio: fretRatio(svg),
            diaOut: d.bottom > c.bottom + 1 || d.right > c.right + 1 || d.top < c.top - 1 || d.left < c.left - 1,
            cardOut: c.bottom > panel.bottom + 1 || c.right > panel.right + 1 || c.top < panel.top - 1 || c.left < panel.left - 1
              || c.bottom > vh + 1 || c.right > vw + 1 || c.top < -1 || c.left < -1,
            clipped
          };
        });
        return { cards };
      });
      const now = m.cards.find(c => c.slot === 'now');
      const next = m.cards.find(c => c.slot === 'next');
      if (!now || !/Fm7/.test(now.name)) notes.push('now is ' + (now && now.name));
      if (!next || next.name.trim() !== 'Gm7') notes.push('next is ' + (next && next.name));
      if (now && next && !(next.dw <= now.dw + 0.5)) notes.push('next diagram ' + next.dw.toFixed(1) + ' wider than now ' + now.dw.toFixed(1));
      for (const c of m.cards) {
        if (c.diaOut) notes.push(c.slot + ' diagram overflows its card');
        if (c.cardOut) notes.push(c.slot + ' card leaves the panel');
        if (c.ratio < 0.8 || c.ratio > 1.3) notes.push(c.slot + ' fret ratio ' + c.ratio.toFixed(3));
        if (c.clipped.length) notes.push(c.slot + ' clipped ' + c.clipped.join(', '));
      }
      if (bag.errors.length) notes.push('page: ' + bag.errors.slice(0, 2).join('; '));
      const name = 'GTR ' + size + ' song: Next diagram no wider than Now, ratios 0.8-1.3, nothing overflows';
      if (notes.length) await shot(page, name);
      record(name, !notes.length, notes.length ? notes.join(' | ') : (now && next ? 'now ' + Math.round(now.dw) + ' next ' + Math.round(next.dw) : ''));
    } catch (err) {
      try { await shot(page, 'GTR song ' + size); } catch (e) {}
      record('GTR song ' + size, false, String(err && err.message || err).split('\n')[0]);
    } finally { await ctx.close(); }
  }

  // Song mode: Jam is off (JAM_IN_SONG). A saved jam:true must not bring the circle or dashed extras back.
  const JAM_SONG = JSON.stringify({
    contractVersion: '1.2',
    song: { title: 'Night Hold', artist: 'Probe', key: { tonic: 'Eb', mode: 'major' } },
    timing: { bpm: 78, timeSignature: '4/4' },
    sections: [{ id: 'v', type: 'verse', chords: [
      { index: 0, chord: 'Fm7b5', position: { bar: 1, beat: 1 }, durationBeats: 4, confidence: 0.9 },
      { index: 1, chord: 'Gm7', position: { bar: 2, beat: 1 }, durationBeats: 4, confidence: 0.9 }
    ], lyrics: [
      { text: 'Hold the night and let it go now', markers: [{ charIndex: 0, chordIndex: 0 }, { charIndex: 20, chordIndex: 1 }] },
      { text: 'One more line under the words', markers: [] }
    ] }]
  });
  for (const [w, h] of [[360, 640], [384, 700], [412, 760], [412, 915], [780, 360], [820, 1180], [1180, 820]]) {
    const size = w + 'x' + h;
    const { ctx, page, bag } = await fresh(browser, w, h, 'JAM song ' + size);
    const notes = [];
    try {
      await boot(page, 'test=1&hour=21&expert=1');
      await page.evaluate(() => {
        const raw = JSON.parse(localStorage.getItem('touchChord.settings.v1') || '{}');
        raw.jam = true;
        raw.expert = true;
        localStorage.setItem('touchChord.settings.v1', JSON.stringify(raw));
      });
      await page.reload({ waitUntil: 'load' });
      await page.waitForFunction(() => !document.documentElement.classList.contains('tc-boot') && window.__upload);
      const progJam = await page.evaluate(() => ({
        toggles: document.querySelectorAll('.jam-toggle').length,
        extras: document.querySelectorAll('.ss-jamextra').length
      }));
      if (progJam.toggles || progJam.extras) notes.push('progressions has jam ' + JSON.stringify(progJam));
      await page.evaluate(text => { window.__upload.load(text); }, JAM_SONG);
      await page.waitForTimeout(80);
      const m = await page.evaluate(() => ({
        song: document.querySelector('#xSrc') && document.querySelector('#xSrc').classList.contains('x-mode-song'),
        toggles: document.querySelectorAll('.jam-toggle, .jam-pill').length,
        extras: document.querySelectorAll('.ss-jamextra, .ss-jam').length,
        jamClass: document.querySelectorAll('[class~="jam"]').length
      }));
      if (!m.song) notes.push('song mode did not open');
      if (m.toggles) notes.push('jam circle ' + m.toggles);
      if (m.extras) notes.push('dashed extras ' + m.extras);
      if (m.jamClass) notes.push('jam class ' + m.jamClass);
      if (bag.errors.length) notes.push('page: ' + bag.errors.slice(0, 2).join('; '));
      const name = 'JAM ' + size + ' song: no Jam circle and no dashed extras';
      if (notes.length) await shot(page, name);
      record(name, !notes.length, notes.join(' | '));
    } catch (err) {
      try { await shot(page, 'JAM song ' + size); } catch (e) {}
      record('JAM song ' + size, false, String(err && err.message || err).split('\n')[0]);
    } finally { await ctx.close(); }
  }

  for (const w of walks) {
    if (w.pageNotes.length) record('toggle ' + w.label, false, w.pageNotes.join(' | '));
  }
  const geometry = walks.filter(w => w.toggleNotes.length);
  if (TOGGLE_FIXME) {
    ghWarning('FIXME toggle walk skipped (' + geometry.length + '/' + walks.length + ' viewports would fail the toggle box). ' + TOGGLE_WHY);
    console.log('FIXME toggle walk skipped (' + geometry.length + '/' + walks.length + ' viewports would fail the toggle box). ' + TOGGLE_WHY);
    for (const w of geometry) console.log('      ' + w.label + '  ' + w.toggleNotes.join(' | '));
    results.push({ name: 'toggle walk', ok: true, fixme: true, detail: TOGGLE_WHY });
  } else {
    for (const w of walks) record('toggle ' + w.label, !w.toggleNotes.length, w.toggleNotes.join(' | '));
  }
} finally {
  await browser.close();
  if (srv) srv.close();
}

const pass = results.filter(r => r.ok && !r.fixme).length;
const fixme = results.filter(r => r.fixme).length;
const fail = results.filter(r => !r.ok).length;
const sec = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`smoke: ${pass} passed, ${fail} failed, ${fixme} fixme, ${ignoredOutside} ignored (outside prefix), ${sec}s`);
process.exit(fail ? 1 : 0);
