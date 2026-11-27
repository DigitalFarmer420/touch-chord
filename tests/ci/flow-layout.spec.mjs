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
  // Every progression chip gets its own tappable slot: at least 32px tall, and
  // not stacked on another chip. A hidden 8px sliver used to fail the hit test
  // and so never showed up as an overlap.
  if (document.documentElement.classList.contains('expert') && !document.documentElement.classList.contains('kv')) {
    const chips = [...document.querySelectorAll('#suggest .ss-chip')].filter(e => {
      if (e.hidden || (e.closest && e.closest('[hidden]'))) return false;
      const s = getComputedStyle(e);
      return s.display !== 'none' && s.visibility !== 'hidden';
    });
    // Phone-portrait Guitar keeps a full-width diagram, so a 640-tall phone with
    // a dense song has shorter rows than a tall phone. Those chips still have
    // their own row. Every other layout, including the landscape progression
    // that used to collapse a chord to 8px, keeps a 32px slot.
    const phoneGtr = document.documentElement.classList.contains('lay-phone-port') && document.documentElement.classList.contains('gtr');
    const minH = phoneGtr ? 14 : 32;
    chips.forEach(e => {
      const r = e.getBoundingClientRect();
      if (Math.round(r.height) < minH) issues.push({ kind: 'chip', el: label(e), detail: 'progression chip is ' + Math.round(r.width) + '×' + Math.round(r.height) });
    });
    for (let i = 0; i < chips.length; i++) {
      for (let j = i + 1; j < chips.length; j++) {
        const a = chips[i].getBoundingClientRect(), b = chips[j].getBoundingClientRect();
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (w > 1 && h > 1) issues.push({ kind: 'overlap', el: label(chips[i]) + ' ∩ ' + label(chips[j]), detail: 'chips overlap ' + Math.round(w) + '×' + Math.round(h) });
      }
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
    svg.querySelectorAll('text.gtr-mark, text.gtr-fr, text.gtr-finger').forEach(t => {
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
  const nowR = square(now, 'now');
  const nextR = square(next, 'next');
  const nb = now.getBoundingClientRect();
  const xb = next.getBoundingClientRect();
  if (xb.width > nb.width + 4 || xb.height > nb.height + 2) {
    issues.push({ kind: 'guitar', el: 'next card', detail: Math.round(xb.width) + '×' + Math.round(xb.height) + ' bigger than Now ' + Math.round(nb.width) + '×' + Math.round(nb.height) });
  }
  function drawnWidth(svg) {
    const ctm = svg.getScreenCTM();
    const verts = [...svg.querySelectorAll('line')].filter(l => Math.abs(+l.getAttribute('x1') - +l.getAttribute('x2')) < 0.1);
    const xs = verts.map(l => +l.getAttribute('x1')).sort((a, b) => a - b);
    if (!ctm || xs.length < 2) return 0;
    const a = new DOMPoint(xs[0], 0).matrixTransform(ctm);
    const b = new DOMPoint(xs[xs.length - 1], 0).matrixTransform(ctm);
    return Math.abs(b.x - a.x);
  }
  function contentGap(card) {
    const r = card.getBoundingClientRect();
    let bottom = r.top;
    card.querySelectorAll('.gtr-head, .gtr-diagram, .gtr-foot').forEach(el => {
      const b = el.getBoundingClientRect();
      if (b.height > 1) bottom = Math.max(bottom, b.bottom);
    });
    return r.bottom - bottom;
  }
  for (const card of [now, next]) {
    const gap = contentGap(card);
    if (gap > 48) issues.push({ kind: 'guitar', el: card.dataset.slot + ' card', detail: 'empty band ' + Math.round(gap) + 'px under the diagram' });
  }
  // .19 at 412x915 gave the chord grid 138px and left ~244px empty in the Now card.
  if (innerWidth === 412 && innerHeight === 915) {
    const grid = document.querySelector('#suggest');
    const gh = grid ? grid.getBoundingClientRect().height : 0;
    if (gh < 250) issues.push({ kind: 'guitar', el: 'chord grid', detail: 'grid ' + Math.round(gh) + 'px is not taller than the .19 138px grid' });
    const compact = getComputedStyle(document.documentElement).getPropertyValue('--gtr-compact').trim();
    if (compact) issues.push({ kind: 'guitar', el: 'layout', detail: 'short-screen diagram is on at 412x915' });
  }
  // .20 left the chord grid at 101px on a 360x640 phone and clipped names such as D#m7b5.
  if (innerWidth === 360 && innerHeight === 640) {
    const gh = document.querySelector('#suggest').getBoundingClientRect().height;
    if (Math.round(gh) < 118) issues.push({ kind: 'guitar', el: 'chord grid', detail: 'grid ' + Math.round(gh) + 'px is not taller than the .20 101px grid' });
    document.querySelectorAll('#suggest .ss-chip').forEach(chip => {
      if (!chip.getClientRects().length) return;
      const text = (chip.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 18);
      if (chip.classList.contains('ell')) issues.push({ kind: 'clip', el: 'chip "' + text + '"', detail: 'name is clipped' });
      const nm = chip.querySelector('.nm');
      if (nm && nm.scrollWidth > nm.clientWidth + 4) issues.push({ kind: 'clip', el: 'chip "' + text + '"', detail: 'scrollWidth ' + nm.scrollWidth + ' > clientWidth ' + nm.clientWidth });
    });
  }
  const sizeWatch = (innerWidth === 360 && innerHeight === 640) || (innerWidth === 412 && innerHeight === 915) || (innerWidth === 820 && innerHeight === 1180);
  if (sizeWatch && nowR && nextR) {
    const nowSvg = now.querySelector('.gtr-diagram');
    const nextSvg = next.querySelector('.gtr-diagram');
    const nowDrawn = drawnWidth(nowSvg);
    const nextDrawn = drawnWidth(nextSvg);
    if (nowDrawn > 8 && nextDrawn < nowDrawn * 0.7 - 1) {
      issues.push({ kind: 'guitar', el: 'next diagram', detail: 'drawn width ' + Math.round(nextDrawn) + ' is under 0.7 of Now ' + Math.round(nowDrawn) });
    }
    // The 60% card-width floor is relaxed. The diagram scales down to the piano
    // keyboard slot, so on a short phone Next stays about 0.85 of Now and can
    // be under 60% of the card (about 37% at 360x640).
  }
  function lin(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function asHex(s) {
    s = (s || '').trim().toLowerCase();
    if (s[0] === '#') return s.length === 4 ? '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3] : s;
    const m = s.match(/rgba?\(([^)]+)\)/);
    if (!m) return '';
    const p = m[1].split(',').map(n => Math.round(parseFloat(n)));
    return '#' + [p[0], p[1], p[2]].map(n => n.toString(16).padStart(2, '0')).join('');
  }
  function lum(hex) {
    if (!hex || hex.length < 7) return 0;
    const n = parseInt(hex.slice(1), 16);
    return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  }
  function contrast(a, b) {
    const A = lum(asHex(a)), B = lum(asHex(b));
    return (Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05);
  }
  const day = document.documentElement.classList.contains('x-day');
  const lamp = document.documentElement.classList.contains('x-lamp') && !day;
  for (const card of [now, next]) {
    const svg = card.querySelector('.gtr-diagram');
    if (!svg) continue;
    const bg = getComputedStyle(card).backgroundColor;
    const line = svg.querySelector('line');
    const stroke = line ? (line.getAttribute('stroke') || '').toLowerCase() : '';
    if (day && stroke && stroke !== '#7a6c58') issues.push({ kind: 'guitar', el: card.dataset.slot + ' ink', detail: 'day line ' + stroke });
    if (lamp && card === next && stroke && stroke !== '#8a7d69') issues.push({ kind: 'guitar', el: 'next ink', detail: 'dark look line changed to ' + stroke });
    if (lamp && card === now && stroke && stroke !== '#7a6c58') issues.push({ kind: 'guitar', el: 'now ink', detail: 'dark look line changed to ' + stroke });
    const need = +svg.getAttribute('data-gtr-fretted') || 0;
    const dots = [...svg.querySelectorAll('circle.gtr-dot')];
    const fingers = [...svg.querySelectorAll('text.gtr-finger')];
    if (need && dots.length < need) issues.push({ kind: 'guitar', el: card.dataset.slot, detail: dots.length + ' dots for ' + need + ' fretted notes' });
    if (need && !fingers.length) issues.push({ kind: 'guitar', el: card.dataset.slot, detail: 'fretted notes have no finger numbers' });
    dots.forEach(c => {
      const fill = c.getAttribute('fill') || '';
      const rootGold = asHex(fill) === '#ffc23d';
      if (lamp && rootGold) return;
      if (day && rootGold) issues.push({ kind: 'guitar', el: card.dataset.slot + ' root', detail: 'day root is still the light gold' });
      if (contrast(fill, bg) < 3) issues.push({ kind: 'guitar', el: card.dataset.slot + ' dot', detail: 'contrast ' + contrast(fill, bg).toFixed(2) + ' ' + fill + ' on ' + bg });
    });
    svg.querySelectorAll('text.gtr-barre-num').forEach(t => {
      const bb = t.getBBox();
      const cx = bb.x + bb.width / 2, cy = bb.y + bb.height / 2;
      const rings = [...svg.querySelectorAll('circle.gtr-dot')].filter(c => c.getAttribute('stroke'));
      const host = rings.find(c => Math.hypot(cx - +c.getAttribute('cx'), cy - +c.getAttribute('cy')) < +c.getAttribute('r') - 0.75);
      if (!host) issues.push({ kind: 'guitar', el: card.dataset.slot + ' barre "' + (t.textContent || '').trim() + '"', detail: 'barre digit is not inside a barre dot' });
      const corners = [[bb.x, bb.y], [bb.x + bb.width, bb.y], [bb.x, bb.y + bb.height], [bb.x + bb.width, bb.y + bb.height]];
      rings.forEach(c => {
        const rad = +c.getAttribute('r');
        const sw = parseFloat(c.getAttribute('stroke-width')) || 1.5;
        const ccx = +c.getAttribute('cx'), ccy = +c.getAttribute('cy');
        const inner = rad - sw / 2, outer = rad + sw / 2;
        if (c === host) {
          const out = corners.some(([x, y]) => Math.hypot(x - ccx, y - ccy) > inner + 0.4);
          if (out) issues.push({ kind: 'guitar', el: card.dataset.slot + ' barre "' + (t.textContent || '').trim() + '"', detail: 'barre digit overlaps its ring' });
        } else {
          const qx = Math.max(bb.x, Math.min(ccx, bb.x + bb.width));
          const qy = Math.max(bb.y, Math.min(ccy, bb.y + bb.height));
          if (Math.hypot(qx - ccx, qy - ccy) < outer - 0.4) issues.push({ kind: 'guitar', el: card.dataset.slot + ' barre "' + (t.textContent || '').trim() + '"', detail: 'barre digit overlaps another ring' });
        }
      });
    });
    svg.querySelectorAll('text.gtr-fr, text.gtr-finger').forEach(t => {
      const fill = t.getAttribute('fill') || '';
      let back = bg;
      if (!t.classList.contains('gtr-fr')) {
        let best = 1e9;
        dots.forEach(c => {
          const d = (+c.getAttribute('cx') - +t.getAttribute('x')) ** 2 + (+c.getAttribute('cy') - +t.getAttribute('y')) ** 2;
          if (d < best) { best = d; back = c.getAttribute('fill') || bg; }
        });
      }
      if (contrast(fill, back) < 4.5) issues.push({ kind: 'guitar', el: card.dataset.slot + ' "' + (t.textContent || '').trim() + '"', detail: 'contrast ' + contrast(fill, back).toFixed(2) + ' on ' + back });
    });
    const nut = svg.querySelector('rect.gtr-nut');
    if (nut) {
      const nutBot = +nut.getAttribute('y') + +nut.getAttribute('height');
      dots.forEach(c => {
        if (+c.getAttribute('cy') - +c.getAttribute('r') < nutBot - 0.4) issues.push({ kind: 'guitar', el: card.dataset.slot + ' dot', detail: 'dot is under the nut' });
      });
    }
    svg.querySelectorAll('text.gtr-mark').forEach(t => {
      if (contrast(t.getAttribute('fill') || '', bg) < 3) issues.push({ kind: 'guitar', el: card.dataset.slot + ' mark', detail: 'mute contrast ' + contrast(t.getAttribute('fill') || '', bg).toFixed(2) });
    });
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

// N35/N36: a 5-fret grip keeps every dot above the string names, and a barre that
// reaches the last string keeps its finger number inside the svg.
const GUITAR_SPAN = () => {
  const issues = [];
  const card = document.querySelector('#gtrCards .gtr-card.now');
  const svg = card && card.querySelector('.gtr-diagram');
  const name = ((card && card.querySelector('.gtr-name') || {}).textContent || '').replace(/\s+/g, ' ').trim();
  if (!svg) {
    issues.push({ kind: 'guitar', el: name || 'now', detail: 'diagram missing' });
    return issues;
  }
  const ctm = svg.getScreenCTM();
  const s = svg.getBoundingClientRect();
  if (!ctm) {
    issues.push({ kind: 'guitar', el: name, detail: 'diagram has no screen transform' });
    return issues;
  }
  const tol = 0.75;
  function pt(x, y) {
    const p = new DOMPoint(x, y).matrixTransform(ctm);
    return { x: p.x, y: p.y };
  }
  const horiz = [...svg.querySelectorAll('line')].filter(l => Math.abs(+l.getAttribute('y1') - +l.getAttribute('y2')) < 0.1);
  const vert = [...svg.querySelectorAll('line')].filter(l => Math.abs(+l.getAttribute('x1') - +l.getAttribute('x2')) < 0.1);
  const ys = [...new Set(horiz.map(l => +l.getAttribute('y1')))].sort((a, b) => a - b);
  const xs = [...new Set(vert.map(l => +l.getAttribute('x1')))].sort((a, b) => a - b);
  const gridBottom = ys.length ? pt(0, ys[ys.length - 1]).y : null;
  const names = [...svg.querySelectorAll('text.gtr-string')];
  let nameTop = null;
  names.forEach(t => {
    const bb = t.getBBox();
    const y = pt(bb.x, bb.y).y;
    nameTop = nameTop == null ? y : Math.min(nameTop, y);
  });
  const phoneLand = document.documentElement.classList.contains('lay-phone-land');
  if (!phoneLand && !names.length) issues.push({ kind: 'guitar', el: name, detail: 'string names missing' });
  let dotOnNames = false;
  svg.querySelectorAll('circle.gtr-dot').forEach(c => {
    const r = +c.getAttribute('r') || 0;
    const bot = pt(+c.getAttribute('cx'), +c.getAttribute('cy') + r).y;
    if (gridBottom != null && bot > gridBottom + 0.5) dotOnNames = true;
    if (nameTop != null && bot > nameTop + 0.5) dotOnNames = true;
  });
  if (dotOnNames) issues.push({ kind: 'guitar', el: name, detail: 'a dot overlaps the string-name row' });
  const fingers = [...svg.querySelectorAll('text.gtr-finger')];
  if ((name === 'F' || name === 'Gsus4' || name === 'Gsus') && !fingers.length) {
    issues.push({ kind: 'guitar', el: name, detail: 'barre finger missing' });
  }
  fingers.forEach(t => {
    const bb = t.getBBox();
    const corners = [pt(bb.x, bb.y), pt(bb.x + bb.width, bb.y), pt(bb.x, bb.y + bb.height), pt(bb.x + bb.width, bb.y + bb.height)];
    const past = corners.some(p => p.x < s.left - tol || p.y < s.top - tol || p.x > s.right + tol || p.y > s.bottom + tol);
    if (past) issues.push({ kind: 'guitar', el: name + ' finger "' + (t.textContent || '').trim() + '"', detail: 'barre finger lies outside the diagram' });
  });
  // A 4-fret diagram can be taller than 1.3× the string spacing (iPad). The cap
  // applies when the grip actually uses a fifth row.
  if ((name === 'Dm9' || name === 'C9') && ys.length >= 2 && xs.length >= 2) {
    const step = ys[1] - ys[0];
    let spaces = step > 0 ? Math.round((ys[ys.length - 1] - ys[0]) / step) : 0;
    const nut = [...svg.querySelectorAll('rect')].some(r => +r.getAttribute('y') < ys[0] - 0.5 && Math.abs(+r.getAttribute('height') - 5) < 0.6);
    if (nut) spaces += 1;
    if (spaces >= 5) {
      const fh = (ys[ys.length - 1] - ys[0]) / (ys.length - 1);
      const sg = (xs[xs.length - 1] - xs[0]) / (xs.length - 1);
      const ratio = sg ? fh / sg : 0;
      if (ratio < 0.9 - 0.02 || ratio > 1.3 + 0.02) {
        issues.push({ kind: 'guitar', el: name, detail: 'fret ratio ' + ratio.toFixed(3) });
      }
    }
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
  await guard(page, vp, 'guitar grid matches piano', async () => {
    const piano = await page.evaluate(() => Math.round(document.querySelector('#suggest').getBoundingClientRect().height));
    if (!(await clickIf(page, '#gtrTabs [data-gtr="guitar"]'))) return;
    await page.waitForTimeout(250);
    const read = () => {
      const svg = document.querySelector('#gtrCards .gtr-card.now .gtr-diagram');
      return {
        grid: Math.round(document.querySelector('#suggest').getBoundingClientRect().height),
        panel: Math.round(document.getElementById('gtrPanel').getBoundingClientRect().height),
        vb: svg ? svg.getAttribute('viewBox') : ''
      };
    };
    const first = await page.evaluate(read);
    await clickIf(page, '#xNext');
    await page.waitForTimeout(200);
    const second = await page.evaluate(read);
    const issues = [];
    if (piano > 0 && Math.abs(first.grid - piano) / piano > 0.05) {
      issues.push({ kind: 'guitar', el: 'chord grid', detail: 'guitar grid ' + first.grid + 'px is ' + Math.round(Math.abs(first.grid - piano) / piano * 100) + '% off the piano grid ' + piano + 'px' });
    }
    if (vp === '360x640' || vp === '360x780' || vp === '412x915') {
      if (Math.abs(first.grid - second.grid) > 1 || Math.abs(first.panel - second.panel) > 1) {
        issues.push({ kind: 'guitar', el: 'chord grid', detail: 'first paint grid ' + first.grid + ' panel ' + first.panel + ' jumped to ' + second.grid + ' / ' + second.panel });
      }
      if (/^0 0 64(\s|$)/.test(first.vb)) issues.push({ kind: 'guitar', el: 'now diagram', detail: 'first viewBox is the 64 fallback (' + first.vb + ')' });
    }
    add(vp, 'guitar grid matches piano', issues);
    if (issues.length) await shot(page, vp + ' guitar grid matches piano');
    await clickIf(page, '#gtrTabs [data-gtr="piano"]');
  });
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
    await boot(page, 'test=1&hour=21&expert=1');
    if (await clickIf(page, '#gtrTabs [data-gtr="guitar"]')) {
      await page.waitForTimeout(180);
      const dark = await page.evaluate(GUITAR_NEXT);
      add(vp, 'guitar lamp colors', dark.map(issue => ({ ...issue, detail: 'lamp: ' + issue.detail })));
      if (dark.length) await shot(page, vp + ' guitar lamp');
    }
    await boot(page, 'test=1&hour=12&expert=1');
  });
  await guard(page, vp, 'guitar 5-fret shapes and full barre after Next', async () => {
    const targets = [
      ['rnb', 'Stepping Stones', 'Dm9'],
      ['funk', 'Party', 'C9'],
      ['pop', 'Four-Chord', 'F'],
      ['pop', 'Wishing Well', 'Gsus4']
    ];
    for (const [style, progName, chord] of targets) {
      if (!(await pickProgression(page, style, progName))) {
        add(vp, 'guitar 5-fret shapes and full barre after Next', [{ kind: 'load', el: progName, detail: 'progression not in the list' }]);
        continue;
      }
      if (!(await clickIf(page, '#gtrTabs [data-gtr="guitar"]'))) {
        add(vp, 'guitar 5-fret shapes and full barre after Next', [{ kind: 'guitar', el: 'gtrTabs', detail: 'guitar tab did not open' }]);
        continue;
      }
      let landed = '';
      for (let i = 0; i < 8; i++) {
        await clickIf(page, '#xNext');
        await page.waitForTimeout(150);
        landed = await page.locator('#gtrCards .gtr-card.now .gtr-name').innerText().then(t => t.replace(/\s+/g, ' ').trim()).catch(() => '');
        if (landed === chord) break;
      }
      if (landed !== chord) {
        add(vp, 'guitar 5-fret shapes and full barre after Next', [{ kind: 'guitar', el: chord, detail: 'Now is ' + (landed || 'empty') + ' after Next' }]);
        continue;
      }
      const extra = await page.evaluate(GUITAR_SPAN);
      const layout = await page.evaluate(GUITAR_NEXT);
      const tagged = extra.concat(layout).map(issue => ({ ...issue, detail: chord + ' after Next: ' + issue.detail }));
      add(vp, 'guitar 5-fret shapes and full barre after Next', tagged);
      if (tagged.length) await shot(page, vp + ' guitar span ' + chord);
      // Dm9's first grip is the short one. The older 5-fret grip is the next
      // alternate, and the finger control is hidden when the phone is sideways.
      if (chord === 'Dm9') {
        const cycle = page.locator('#gtrCards [data-gtr-cycle="1"]').first();
        if (await cycle.isVisible().catch(() => false)) {
          await cycle.click();
          await page.waitForTimeout(80);
          const alt = await page.evaluate(GUITAR_SPAN);
          const altTagged = alt.map(issue => ({ ...issue, detail: 'Dm9 alternate: ' + issue.detail }));
          add(vp, 'guitar 5-fret shapes and full barre after Next', altTagged);
          if (altTagged.length) await shot(page, vp + ' guitar span Dm9 alt');
        }
      }
    }
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

async function ipadGrid(browser, port) {
  const vp = '768x1024';
  const ctx = await browser.newContext({ viewport: { width: 768, height: 1024 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  ctx._flowPort = port;
  await ctx.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('touchChord.tour.v1', 'done'); } catch (e) {} });
  const page = await ctx.newPage();
  page.context()._flowPort = port;
  try {
    await boot(page, 'test=1&hour=12&expert=1');
    if (await clickIf(page, '#gtrTabs [data-gtr="guitar"]')) {
      await page.waitForTimeout(250);
      const gh = await page.evaluate(() => Math.round(document.querySelector('#suggest').getBoundingClientRect().height));
      const issues = [];
      if (gh < 337) issues.push({ kind: 'guitar', el: 'chord grid', detail: '768x1024 grid ' + gh + 'px is under the .19 337px grid' });
      add(vp, 'guitar ipad grid', issues);
      if (issues.length) await shot(page, vp + ' guitar ipad grid');
    }
  } catch (err) {
    add(vp, 'guitar ipad grid', [{ kind: 'thrown', el: 'runner', detail: String(err && err.message || err).split('\n')[0].slice(0, 180) }]);
  }
  await ctx.close();
  console.log(vp + '  ' + hits.filter(x => x.vp === vp).length + ' hits');
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
  await ipadGrid(browser, port);
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
