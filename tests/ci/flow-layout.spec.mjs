#!/usr/bin/env node
// Flow layout. Required on every pull request (the smoke job in pr-checks.yml and deploy-web.yml).
//
//   node tests/ci/flow-layout.spec.mjs
//   AUDIT=1 node tests/ci/flow-layout.spec.mjs     # print every hit and exit 0; writes tests/ci/out/flow-audit.json
//
// Matrix: Kids, Simple, Expert; Song and Progressions; Piano and Guitar; with lyrics (Anh Đã Ổn Hơn, Eb)
// and without; a long song (All I Ask) and a 6-row chord grid; menus and sheets open.
// Viewports: 360x640, 384x700, 412x760, 412x915, 780x360, 820x1180, 1180x820, plus 390x844 and 360x780.
//
// A hit fails the run unless it is listed in flow-layout.known.json. A known id that nothing hits
// also fails, so a fix has to drop its line.

import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'tests/ci/out');
const KNOWN_PATH = join(dirname(fileURLToPath(import.meta.url)), 'flow-layout.known.json');
const AUDIT = process.env.AUDIT === '1';
const VPS = [[360, 640], [384, 700], [412, 760], [412, 915], [780, 360], [820, 1180], [1180, 820], [390, 844], [360, 780]];
const ANH = readFileSync(join(ROOT, 'tests/fixtures/upload/anh-v13.json'), 'utf8');
const LONG = readFileSync(join(ROOT, 'tests/fixtures/songs/all-i-ask.json'), 'utf8');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.webp': 'image/webp', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json'
};

const MEASURE = () => {
  const TOL = 1;
  const vw = innerWidth, vh = innerHeight;
  const clipOf = s => /(auto|scroll|hidden|clip)/.test(s.overflowX) || /(auto|scroll|hidden|clip)/.test(s.overflowY);
  function shown(e) {
    if (!e || e.nodeType !== 1) return false;
    if (e.hidden || (e.closest && e.closest('[hidden]'))) return false;
    const s = getComputedStyle(e);
    if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
    const r = e.getBoundingClientRect();
    return r.width >= 1 && r.height >= 1;
  }
  // The painted box: intersect with every ancestor that clips.
  function painted(e) {
    const b = e.getBoundingClientRect();
    let left = b.left, top = b.top, right = b.right, bottom = b.bottom;
    let n = e.parentElement;
    while (n && n !== document.documentElement) {
      const s = getComputedStyle(n);
      if (clipOf(s)) {
        const c = n.getBoundingClientRect();
        left = Math.max(left, c.left); top = Math.max(top, c.top);
        right = Math.min(right, c.right); bottom = Math.min(bottom, c.bottom);
        if (right - left < 0.5 || bottom - top < 0.5) return null;
      }
      n = n.parentElement;
    }
    return { left, top, right, bottom };
  }
  function label(e) {
    const id = e.id ? '#' + e.id : '';
    const cls = typeof e.className === 'string' && e.className.trim()
      ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    const t = (e.innerText || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 28);
    return (e.tagName.toLowerCase() + id + cls + (t ? ' "' + t + '"' : '')).slice(0, 90);
  }
  const PANEL = [
    '#suggest', '.kb-wrap', '#gtrPanel', '.gtr-card', '#xSrc', '#xCtl', '#ctl', '#sustainBtn',
    '#xTop', 'header.topbar', '.now-card', '.next-card', '#xGo', '#styles', '#chords',
    '#kv', '.kv-pads', '.kv-piano', '.kv-top', '.kv-lyr',
    '#xStyleMenu', '#xKeySheet', '#modeSheet', '#configMenu', '#helpMenu', '#howto', '#xPList', '#uploadPick'
  ].join(',');
  function panelOf(e) {
    const p = e.parentElement && e.parentElement.closest(PANEL);
    return p || null;
  }
  const issues = [];
  const seen = new Set();
  const roots = document.querySelectorAll('#app *, #kv *, #helpMenu *, #modeSheet *, #xStyleMenu *, #xKeySheet *, #configMenu *, #howto *, #uploadPick *, #xPList *');
  roots.forEach(e => {
    if (seen.has(e) || !shown(e)) return;
    if (e.closest('svg') && e.tagName !== 'svg') return;
    seen.add(e);
    const box = painted(e);
    if (!box) return;
    const bits = [];
    if (box.left < -TOL) bits.push('left ' + box.left.toFixed(1));
    if (box.top < -TOL) bits.push('top ' + box.top.toFixed(1));
    if (box.right > vw + TOL) bits.push('right +' + (box.right - vw).toFixed(1));
    if (box.bottom > vh + TOL) bits.push('bottom +' + (box.bottom - vh).toFixed(1));
    if (bits.length) issues.push({ kind: 'viewport', el: label(e), detail: bits.join(', ') });
    const host = panelOf(e);
    if (!host) return;
    const h = host.getBoundingClientRect();
    const over = [];
    // Compare the painted box, so a line clipped by an ancestor is not an overflow.
    // 4px covers overflow-clip-margin and a 1.5px border. Step badges are centred
    // on the chip border (badgeslots.js) and may cross the grid edge by half a badge.
    const slack = e.classList && e.classList.contains('pg-badge') ? 12 : 4;
    if (box.left < h.left - slack) over.push('left ' + (h.left - box.left).toFixed(1));
    if (box.top < h.top - slack) over.push('top ' + (h.top - box.top).toFixed(1));
    if (box.right > h.right + slack) over.push('right +' + (box.right - h.right).toFixed(1));
    if (box.bottom > h.bottom + slack) over.push('bottom +' + (box.bottom - h.bottom).toFixed(1));
    if (over.length) issues.push({ kind: 'panel', el: label(e), detail: over.join(', ') + ' outside ' + label(host) });
  });

  const labelSel = 'button, .gtr-name, .gtr-lb, .gtr-meta, .gtr-tap, .ss-chip .nm, .pg-t, .pg-nm, .x-pn, .x-kl, .x-sl, .x-stitle, .kk-name, .kv-title, .kv-h, .kv-ct, .kv-n, #symbol, .style-row button span';
  document.querySelectorAll(labelSel).forEach(e => {
    if (!shown(e)) return;
    if (e.closest('svg')) return;
    const sw = e.scrollWidth, cw = e.clientWidth;
    // A 1px box is the visually-hidden song title on phones. A few px is the border, not clipped text.
    if (cw > 2 && sw > cw + 4) issues.push({ kind: 'clip', el: label(e), detail: 'scrollWidth ' + sw + ' > clientWidth ' + cw });
  });

  const taps = [...document.querySelectorAll('button, a[href], input, [role="tab"], [role="option"], [role="menuitem"], [role="menuitemcheckbox"]')].filter(shown);
  const live = taps.map(e => {
    const r = e.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const top = !!(hit && (hit === e || e.contains(hit)));
    return { e, r, top };
  }).filter(x => x.top);
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i], b = live[j];
      if (a.e.contains(b.e) || b.e.contains(a.e)) continue;
      const keys = e => !!(e.closest && e.closest('.kb-wrap, .kv-piano, #pads, .x-mini'));
      if (keys(a.e) && keys(b.e)) continue;
      // The Lock sits inside the progression bar and inside the song bar on purpose.
      const dock = e => (e.closest && e.closest('.x-pbar, .x-plock')) || e.id === 'songBar' || e.id === 'sbLock';
      if (dock(a.e) && dock(b.e)) continue;
      // A popover may cover the chord grid it opens over. The piano, the opener, and other controls still count.
      const pop = e => !!(e.closest && e.closest('#helpMenu, #xStyleMenu, #xKeySheet'));
      const grid = e => !!(e.closest && e.closest('#suggest'));
      if ((pop(a.e) && grid(b.e)) || (pop(b.e) && grid(a.e))) continue;
      const l = Math.max(a.r.left, b.r.left), t = Math.max(a.r.top, b.r.top);
      const r = Math.min(a.r.right, b.r.right), btm = Math.min(a.r.bottom, b.r.bottom);
      if (r - l > 6 && btm - t > 6) issues.push({ kind: 'overlap', el: label(a.e) + ' ∩ ' + label(b.e), detail: Math.round(r - l) + '×' + Math.round(btm - t) });
    }
  }
  // Guitar fret number ("3fr") must be fully inside its diagram. A clipped label reads ":fr".
  document.querySelectorAll('svg.gtr-diagram text.gtr-fr').forEach(t => {
    if (!shown(t)) return;
    const svg = t.ownerSVGElement;
    if (!svg) return;
    const r = t.getBoundingClientRect();
    const s = svg.getBoundingClientRect();
    const text = (t.textContent || '').trim();
    if (!/^[0-9]+fr$/.test(text) || r.left < s.left - 0.5 || r.right > s.right + 0.5 || r.top < s.top - 0.5 || r.bottom > s.bottom + 0.5) {
      issues.push({ kind: 'fret', el: label(t), detail: 'fret label "' + text + '" is not inside the diagram' });
    }
  });
  // The lyric line ends before the song Lock. It must not paint underneath that button.
  const lock = document.querySelector('#xSrc .x-lock');
  if (lock && shown(lock)) {
    const L = lock.getBoundingClientRect();
    document.querySelectorAll('#xSrc .x-sline, #xSrc .x-lin').forEach(line => {
      if (!shown(line)) return;
      const box = painted(line);
      if (!box) return;
      if (box.right > L.left + 1 && box.bottom > L.top + 1 && box.top < L.bottom - 1) {
        issues.push({ kind: 'lyric', el: label(line), detail: 'lyric runs under the lock' });
      }
    });
  }
  // Popovers (How to, Style, Key) stay in the measured band between the top bar and the piano.
  // They may cover the chord grid. They must not cover the piano or the control that opened them,
  // and a menu taller than that band scrolls inside itself.
  const popovers = [
    ['#helpMenu', '#xHelp, #howtoBtn'],
    ['#xStyleMenu', '#xStyle'],
    ['#xKeySheet', '#xKey']
  ];
  const bandBar = [...document.querySelectorAll('#xTop, header.topbar')].find(shown);
  const bandTop = bandBar ? bandBar.getBoundingClientRect().bottom : 0;
  const pianoEl = document.querySelector('.kb-wrap');
  const pianoTop = pianoEl && shown(pianoEl) ? pianoEl.getBoundingClientRect().top : null;
  function crosses(a, b) {
    return Math.min(a.right, b.right) - Math.max(a.left, b.left) > 6 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 6;
  }
  popovers.forEach(([sel, openSel]) => {
    const pop = document.querySelector(sel);
    if (!pop || !shown(pop)) return;
    const box = pop.getBoundingClientRect();
    const name = label(pop);
    if (box.top < bandTop - 1) issues.push({ kind: 'popover', el: name, detail: 'starts above the top bar' });
    if (pianoTop != null && box.bottom > pianoTop + 1) issues.push({ kind: 'popover', el: name, detail: 'crosses the piano' });
    const opener = [...document.querySelectorAll(openSel)].find(shown);
    if (opener && crosses(box, opener.getBoundingClientRect())) issues.push({ kind: 'popover', el: name, detail: 'covers the control that opened it' });
    const oy = getComputedStyle(pop).overflowY;
    if (pop.scrollHeight > pop.clientHeight + 1 && oy !== 'auto' && oy !== 'scroll') {
      issues.push({ kind: 'popover', el: name, detail: 'taller than the band and does not scroll inside' });
    }
  });
  // Out-of-key piano notes use the key's accidental. Eb major is Db and Gb, not C# and F#.
  const keyName = ((document.querySelector('#xKey .x-kl') || {}).textContent || '');
  if (/E♭|Eb/.test(keyName) && document.documentElement.classList.contains('expert')) {
    const blacks = [...document.querySelectorAll('#pads .pad.black .nm')].filter(shown).map(e => (e.textContent || '').trim());
    const bad = blacks.filter(n => n === 'F♯' || n === 'C♯' || n === 'F#' || n === 'C#');
    if (bad.length) issues.push({ kind: 'spell', el: 'pad.black', detail: 'Eb piano shows ' + bad.join(' ') });
  }
  return issues;
};

// N29: after Next, the guitar Now and Next cards stay square, Next is not bigger than Now,
// and the chord name stays inside its card. Phone portrait used to key those sizes off the
// hint class "nx", which the Next highlight removes.
const GUITAR_NEXT = () => {
  const issues = [];
  function marksOutside(svg) {
    const s = svg.getBoundingClientRect();
    const ctm = svg.getScreenCTM();
    if (!ctm) return ['no ctm'];
    const bad = [];
    const tol = 0.75;
    function pt(x, y) {
      const p = new DOMPoint(x, y).matrixTransform(ctm);
      return { x: p.x, y: p.y };
    }
    function box(x, y, w, h, name) {
      const a = pt(x, y), b = pt(x + w, y + h);
      const left = Math.min(a.x, b.x), right = Math.max(a.x, b.x);
      const top = Math.min(a.y, b.y), bot = Math.max(a.y, b.y);
      if (left < s.left - tol || top < s.top - tol || right > s.right + tol || bot > s.bottom + tol) bad.push(name);
    }
    svg.querySelectorAll('circle').forEach(c => {
      const r = +c.getAttribute('r') || 0;
      const sw = c.getAttribute('fill') === 'none' ? (parseFloat(c.getAttribute('stroke-width')) || 0) / 2 : 0;
      const rr = r + sw;
      box(+c.getAttribute('cx') - rr, +c.getAttribute('cy') - rr, rr * 2, rr * 2, 'dot');
    });
    svg.querySelectorAll('rect').forEach(rc => {
      box(+rc.getAttribute('x'), +rc.getAttribute('y'), +rc.getAttribute('width'), +rc.getAttribute('height'), 'barre');
    });
    svg.querySelectorAll('text.gtr-mark, text.gtr-fr').forEach(t => {
      const bb = t.getBBox();
      box(bb.x, bb.y, bb.width, bb.height, (t.textContent || '').trim().slice(0, 12) || 'mark');
    });
    return bad;
  }
  const now = document.querySelector('#gtrCards .gtr-card[data-slot="now"]');
  const next = document.querySelector('#gtrCards .gtr-card[data-slot="next"]');
  if (!now || !next || now.getBoundingClientRect().width < 2 || next.getBoundingClientRect().width < 2) {
    issues.push({ kind: 'guitar', el: 'gtr-card', detail: 'Now or Next card is missing' });
    return issues;
  }
  function square(card, name) {
    const d = card.querySelector('.gtr-diagram');
    if (!d) { issues.push({ kind: 'guitar', el: name, detail: 'diagram missing' }); return null; }
    const r = d.getBoundingClientRect();
    const ratio = r.height > 1 ? r.width / r.height : 0;
    if (ratio < 0.8 || ratio > 1.25) issues.push({ kind: 'guitar', el: name + ' diagram', detail: 'ratio ' + ratio.toFixed(2) + ' (' + Math.round(r.width) + '×' + Math.round(r.height) + ')' });
    return r;
  }
  square(now, 'now');
  square(next, 'next');
  const nb = now.getBoundingClientRect();
  const xb = next.getBoundingClientRect();
  if (xb.width > nb.width + 4 || xb.height > nb.height + 2) {
    issues.push({ kind: 'guitar', el: 'next card', detail: Math.round(xb.width) + '×' + Math.round(xb.height) + ' bigger than Now ' + Math.round(nb.width) + '×' + Math.round(nb.height) });
  }
  const panel = document.getElementById('gtrPanel');
  const pb = panel ? panel.getBoundingClientRect() : null;
  for (const card of [now, next]) {
    const name = card.querySelector('.gtr-name');
    const cb = card.getBoundingClientRect();
    if (name) {
      if (name.clientWidth > 2 && name.scrollWidth > name.clientWidth + 4) {
        issues.push({ kind: 'clip', el: '.gtr-name "' + (name.textContent || '').trim() + '"', detail: 'scrollWidth ' + name.scrollWidth + ' > clientWidth ' + name.clientWidth });
      }
      const range = document.createRange();
      range.selectNodeContents(name);
      const t = range.getBoundingClientRect();
      if (t.width > 1 && (t.left < cb.left - 1 || t.right > cb.right + 1 || t.top < cb.top - 1 || t.bottom > cb.bottom + 1)) {
        issues.push({ kind: 'clip', el: '.gtr-name "' + (name.textContent || '').trim() + '"', detail: 'name paints outside the ' + card.dataset.slot + ' card' });
      }
    }
    if (pb && (cb.bottom > pb.bottom + 1 || cb.top < pb.top - 1 || cb.right > pb.right + 1 || cb.left < pb.left - 1)) {
      issues.push({ kind: 'panel', el: card.dataset.slot, detail: 'card leaves the guitar panel' });
    }
    if (cb.bottom > innerHeight + 1 || cb.right > innerWidth + 1 || cb.top < -1 || cb.left < -1) {
      issues.push({ kind: 'viewport', el: card.dataset.slot, detail: 'card leaves the screen' });
    }
    const svg = card.querySelector('.gtr-diagram');
    if (svg) marksOutside(svg).forEach(bit => issues.push({ kind: 'guitar', el: card.dataset.slot + ' ' + bit, detail: 'mark is clipped by the diagram' }));
  }
  const label = now.querySelector('[data-gtr-label]');
  const fr = now.querySelector('.gtr-fr');
  if (label) {
    const text = (label.textContent || '').replace(/\s+/g, ' ').trim();
    if (/\u2026|\.\.\./.test(text) || label.scrollWidth > label.clientWidth + 1) {
      issues.push({ kind: 'clip', el: 'voicing "' + text + '"', detail: 'fret label is cut (' + label.scrollWidth + '>' + label.clientWidth + ')' });
    }
    const fret = fr ? (fr.textContent || '').trim() : '';
    if (fret && text.indexOf(fret) < 0) issues.push({ kind: 'guitar', el: 'voicing "' + text + '"', detail: 'missing fret ' + fret });
  }
  return issues;
};

function listen(port) {
  const srv = createServer((q, res) => {
    const path = decodeURIComponent((q.url || '/').split('?')[0]);
    const rel = path === '/' ? 'index.html' : path.replace(/^\/+/, '');
    const file = normalize(join(ROOT, rel));
    if (!file.startsWith(ROOT) || !existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    createReadStream(file).pipe(res);
  });
  return new Promise((resolve, reject) => {
    srv.once('error', reject);
    srv.listen(port, '127.0.0.1', () => resolve(srv));
  });
}

async function boot(page, query) {
  const port = page.context()._flowPort;
  await page.goto(`http://127.0.0.1:${port}/index.html?${query}`, { waitUntil: 'load', timeout: 20000 });
  await page.waitForFunction(() => {
    const de = document.documentElement;
    return !de.classList.contains('tc-boot') && document.querySelectorAll('#msMode button[data-mode]').length === 3;
  }, null, { timeout: 15000 });
  await page.evaluate(() => document.fonts && document.fonts.ready);
}

async function closeSheets(page) {
  await page.keyboard.press('Escape').catch(() => {});
  await page.evaluate(() => {
    ['uploadPick', 'howto', 'configMenu', 'modeSheet', 'xStyleMenu', 'xKeySheet', 'xPList', 'helpMenu', 'xScrim'].forEach(id => {
      const n = document.getElementById(id);
      if (n) n.hidden = true;
    });
    document.documentElement.classList.remove('x-sheet-on', 'x-ctl-on', 'drawer-open');
    const sound = document.getElementById('xSound');
    if (sound) sound.setAttribute('aria-expanded', 'false');
  });
  await page.waitForTimeout(40);
}

async function loadSong(page, text) {
  const r = await page.evaluate(t => window.__upload && window.__upload.load(t), text);
  await page.waitForTimeout(350);
  await closeSheets(page);
  return r && r.ok !== false;
}

async function clickIf(page, sel) {
  const ok = await page.evaluate(sel => {
    const e = document.querySelector(sel);
    if (!e || e.closest('[hidden]')) return false;
    const s = getComputedStyle(e);
    const r = e.getBoundingClientRect();
    if (s.display === 'none' || s.visibility === 'hidden' || r.width < 2 || r.height < 2) return false;
    e.click();
    return true;
  }, sel);
  if (ok) await page.waitForTimeout(160);
  return !!ok;
}

async function closeUpload(page) {
  await page.evaluate(() => {
    const p = document.getElementById('uploadPick');
    if (p) p.hidden = true;
  });
}

// Song tab: the first tap selects Song; a second tap opens the library. Only tap when Song is not already on.
async function showSong(page) {
  const on = await page.evaluate(() => {
    const b = document.querySelector('#xTog button[data-v="song"]');
    return !!(b && (b.classList.contains('on') || b.getAttribute('aria-selected') === 'true'));
  });
  if (!on) await clickIf(page, '#xTog button[data-v="song"]');
  await closeUpload(page);
  await page.waitForTimeout(80);
}

async function shot(page, name) {
  try {
    mkdirSync(OUT, { recursive: true });
    await page.screenshot({ path: join(OUT, name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 80) + '.png') });
  } catch (e) { /* a missing shot is not the result */ }
}

const hits = [];
function add(vp, state, issues) {
  for (const issue of issues) hits.push({ vp, state, ...issue });
}

async function measure(page, vp, state) {
  const issues = await page.evaluate(MEASURE);
  add(vp, state, issues);
  if (issues.length) await shot(page, vp + ' ' + state);
}

async function guard(page, vp, state, fn) {
  try { await fn(); }
  catch (err) {
    add(vp, state, [{ kind: 'thrown', el: 'runner', detail: String(err && err.message || err).split('\n')[0].slice(0, 180) }]);
    await shot(page, vp + ' ' + state);
    await closeSheets(page);
  }
}

async function pickProgression(page, style, name) {
  if (style) {
    const ok = await page.evaluate(s => {
      const b = document.querySelector('#styles button[data-style="' + s + '"]');
      if (!b) return false;
      b.click();
      return true;
    }, style);
    if (!ok) return false;
    await page.waitForTimeout(200);
  }
  const onProg = await page.evaluate(() => {
    const b = document.querySelector('#xTog button[data-v="prog"]');
    return !!(b && (b.classList.contains('on') || b.getAttribute('aria-selected') === 'true'));
  });
  if (!onProg) await clickIf(page, '#xTog button[data-v="prog"]');
  await closeSheets(page);
  await clickIf(page, '#xSrc .x-pbar');
  await page.waitForSelector('#xPList:not([hidden]) .x-prow', { timeout: 5000 });
  const picked = await page.evaluate(want => {
    const row = [...document.querySelectorAll('#xPList .x-prow')].find(r => (r.textContent || '').indexOf(want) >= 0);
    if (!row) return false;
    row.scrollIntoView();
    row.click();
    return true;
  }, name);
  await closeSheets(page);
  return picked;
}

async function expertPass(page, vp) {
  await boot(page, 'test=1&hour=12&expert=1');
  await measure(page, vp, 'expert-prog-piano');
  await guard(page, vp, 'guitar tab after Next (1 and 3 taps)', async () => {
    async function run(style, progName) {
      const state = 'guitar tab after Next (1 and 3 taps) ' + progName;
      if (!(await pickProgression(page, style, progName))) {
        add(vp, state, [{ kind: 'load', el: progName, detail: 'progression not in the list' }]);
        return;
      }
      if (!(await clickIf(page, '#gtrTabs [data-gtr="guitar"]'))) {
        add(vp, state, [{ kind: 'guitar', el: 'gtrTabs', detail: 'guitar tab did not open' }]);
        return;
      }
      async function after(taps) {
        const extra = await page.evaluate(GUITAR_NEXT);
        const layout = await page.evaluate(MEASURE);
        const tagged = extra.concat(layout).map(issue => ({ ...issue, detail: progName + ' ' + taps + ' tap' + (taps === 1 ? '' : 's') + ': ' + issue.detail }));
        add(vp, state, tagged);
        if (tagged.length) await shot(page, vp + ' ' + state + ' ' + taps);
      }
      await clickIf(page, '#xNext');
      await page.waitForTimeout(200);
      await after(1);
      await clickIf(page, '#xNext');
      await clickIf(page, '#xNext');
      await page.waitForTimeout(200);
      await after(3);
    }
    await run(null, 'Wishing Well');
    await run('lofi', 'Rain Window');
    await clickIf(page, '#gtrTabs [data-gtr="piano"]');
    await closeSheets(page);
    await boot(page, 'test=1&hour=12&expert=1');
  });
  await guard(page, vp, 'expert-upload', async () => {
    await clickIf(page, '#xTog button[data-v="song"]');
    await measure(page, vp, 'expert-upload-empty');
    await closeUpload(page);
  });
  await guard(page, vp, 'expert-anh-song-piano', async () => {
    if (!(await loadSong(page, ANH))) add(vp, 'expert-anh', [{ kind: 'load', el: 'anh-v13', detail: 'upload failed' }]);
    await showSong(page);
    await measure(page, vp, 'expert-anh-song-piano');
  });
  await guard(page, vp, 'expert-anh-guitar', async () => {
    if (await clickIf(page, '#gtrTabs [data-gtr="guitar"]')) await measure(page, vp, 'expert-anh-guitar');
    await clickIf(page, '#gtrTabs [data-gtr="piano"]');
  });
  await guard(page, vp, 'expert-anh-prog', async () => {
    await clickIf(page, '#xTog button[data-v="prog"]');
    await closeSheets(page);
    await measure(page, vp, 'expert-anh-prog');
  });
  await guard(page, vp, 'expert-long-song', async () => {
    if (!(await loadSong(page, LONG))) {
      add(vp, 'expert-long', [{ kind: 'load', el: 'all-i-ask', detail: 'upload failed' }]);
      return;
    }
    await showSong(page);
    await measure(page, vp, 'expert-long-song');
  });
  await guard(page, vp, 'expert-style-menu', async () => {
    if (await clickIf(page, '#xStyle')) { await measure(page, vp, 'expert-style-menu'); await closeSheets(page); }
  });
  await guard(page, vp, 'expert-key-sheet', async () => {
    if (await clickIf(page, '#xKey')) { await measure(page, vp, 'expert-key-sheet'); await closeSheets(page); }
  });
  await guard(page, vp, 'expert-sound-sheet', async () => {
    if (await clickIf(page, '#xSound')) { await measure(page, vp, 'expert-sound-sheet'); await closeSheets(page); }
  });
  await guard(page, vp, 'expert-help-menu', async () => {
    if (await clickIf(page, '#xHelp')) { await measure(page, vp, 'expert-help-menu'); await closeSheets(page); }
  });
  await guard(page, vp, 'expert-mode-sheet', async () => {
    if (await clickIf(page, '#xModeChip')) { await measure(page, vp, 'expert-mode-sheet'); await closeSheets(page); }
  });
}

async function simplePass(page, vp) {
  await boot(page, 'test=1&hour=12');
  const mode = await page.evaluate(() => document.documentElement.classList.contains('simple') && !document.documentElement.classList.contains('expert') ? 'simple' : 'other');
  if (mode !== 'simple') {
    await page.evaluate(() => {
      const chips = [...document.querySelectorAll('.mode-chip')].filter(e => e.getClientRects().length);
      if (chips[0]) chips[0].click();
    });
    await page.waitForSelector('#modeSheet:not([hidden])', { timeout: 5000 });
    await page.locator('#msMode button[data-mode="simple"]').click();
    await page.waitForFunction(() => {
      const de = document.documentElement;
      return de.classList.contains('simple') && !de.classList.contains('expert');
    }, null, { timeout: 5000 });
    await page.waitForTimeout(150);
  }
  await measure(page, vp, 'simple-prog');
  await guard(page, vp, 'simple-anh-song', async () => {
    if (!(await loadSong(page, ANH))) return;
    await showSong(page);
    await measure(page, vp, 'simple-anh-song');
    await clickIf(page, '#xTog button[data-v="prog"]');
    await closeSheets(page);
    await measure(page, vp, 'simple-anh-prog');
  });
  if (await clickIf(page, '#howtoBtn, #xHelp')) {
    await measure(page, vp, 'simple-help-menu');
    await closeSheets(page);
  }
  if (await clickIf(page, '.mode-chip')) {
    await measure(page, vp, 'simple-mode-sheet');
    await closeSheets(page);
  }
}

async function kidsPass(page, vp) {
  await boot(page, 'test=1&hour=12&kv=1');
  await page.waitForSelector('#kv .kv-go', { timeout: 8000 });
  await measure(page, vp, 'kids-hello');
  await page.locator('#kv .kv-go').click();
  await page.waitForSelector('#kv .kv-card', { timeout: 8000 });
  await measure(page, vp, 'kids-songs');
  await page.locator('#kv .kv-card').first().click();
  await page.waitForSelector('.kv-pad, .kv-playbtn', { timeout: 8000 });
  await page.waitForTimeout(200);
  await measure(page, vp, 'kids-play');
  if (await clickIf(page, '#kv .mode-chip, #kv .kv-chip button')) {
    await measure(page, vp, 'kids-mode-sheet');
    await closeSheets(page);
  }
}

const known = existsSync(KNOWN_PATH) ? JSON.parse(readFileSync(KNOWN_PATH, 'utf8')) : [];

let srv;
try {
  srv = await listen(0);
} catch (err) {
  console.error(err);
  process.exit(1);
}
const port = srv.address().port;
const browser = await chromium.launch();
const t0 = Date.now();
try {
  for (const [w, h] of VPS) {
    const vp = w + 'x' + h;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
    ctx._flowPort = port;
    await ctx.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('touchChord.tour.v1', 'done'); } catch (e) {} });
    const page = await ctx.newPage();
    page.context()._flowPort = port;
    page.on('pageerror', e => add(vp, 'pageerror', [{ kind: 'pageerror', el: 'window', detail: String(e).split('\n')[0].slice(0, 160) }]));
    for (const pass of [expertPass, simplePass, kidsPass]) {
      try { await pass(page, vp); }
      catch (err) {
        add(vp, pass.name, [{ kind: 'thrown', el: 'runner', detail: String(err && err.message || err).split('\n')[0].slice(0, 180) }]);
        await shot(page, vp + ' ' + pass.name);
      }
    }
    await ctx.close();
    console.log(vp + '  ' + hits.filter(x => x.vp === vp).length + ' hits');
  }
} finally {
  await browser.close();
  srv.close();
}

function covers(k, hit) {
  if (k.vp && k.vp !== hit.vp) return false;
  if (k.state && k.state !== hit.state) return false;
  if (k.kind && k.kind !== hit.kind) return false;
  if (k.el && hit.el.indexOf(k.el) < 0) return false;
  if (k.detail && hit.detail.indexOf(k.detail) < 0) return false;
  return true;
}
const fresh = hits.filter(h => !known.some(k => covers(k, h)));
const stale = known.filter(k => !hits.some(h => covers(k, h))).map(k => k.id);

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'flow-audit.json'), JSON.stringify({ hits, fresh, stale }, null, 2));

const sec = ((Date.now() - t0) / 1000).toFixed(1);
console.log(`flow-layout: ${hits.length} hits, ${fresh.length} new, ${stale.length} stale known, ${known.length} known, ${sec}s`);
const show = list => {
  for (const h of list.slice(0, 80)) console.log('  ' + h.vp + '  ' + h.state + '  ' + h.kind + '  ' + h.el + '  ' + h.detail);
  if (list.length > 80) console.log('  … ' + (list.length - 80) + ' more in tests/ci/out/flow-audit.json');
};
if (AUDIT) {
  console.log('AUDIT all hits:');
  show(hits);
  process.exit(0);
}
if (fresh.length || stale.length) {
  if (fresh.length) { console.log('NEW'); show(fresh); }
  if (stale.length) console.log('STALE ' + stale.join(', '));
  process.exit(1);
}
console.log('flow-layout: pass');
