// Expert keyboard marks: teal dashed outlines stay off, decorative octave up/down glyphs stay off,
// the root preview dot stays, the off-screen navigation arrow (#nxArrow) stays in the page.
// Audio of the same Next taps is compared with BASE2 (the frozen tree) when that URL is set.
// node -r ./emulate.cjs expertmarks.cjs
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const URL = process.env.BASE || 'http://127.0.0.1:8080/index.html';
const BASE2 = process.env.BASE2 || '';
const OUT = process.env.OUT || '/tmp/expertmarks';
fs.mkdirSync(OUT, { recursive: true });
const SIZES = [[360, 780], [384, 832], [412, 915], [780, 360], [844, 390], [800, 330], [820, 1180], [1180, 820]];
const R = { fails: [], data: {} };
const F = (c, m) => { if (!c) R.fails.push(m); };
async function shot(p, name) {
  const kb = await p.locator('.kb-wrap').boundingBox();
  if (!kb) return;
  const vp = p.viewportSize();
  await p.screenshot({ path: path.join(OUT, name + '.png'), clip: { x: Math.max(0, kb.x), y: Math.max(0, kb.y), width: Math.min(kb.width, vp.width - kb.x), height: Math.min(kb.height, vp.height - kb.y) } });
}
async function readMarks(p) {
  return p.evaluate(() => {
    const keys = [...document.querySelectorAll('#pads .pad')].map(e => {
      const st = getComputedStyle(e), b = getComputedStyle(e, '::before'), a = getComputedStyle(e, '::after');
      return {
        nx: e.classList.contains('nx'), root: e.classList.contains('nx-root'), held: e.classList.contains('held') || e.classList.contains('x-pclit'), up: e.classList.contains('x-up'), down: e.classList.contains('x-down'),
        os: st.outlineStyle, ow: st.outlineWidth,
        dot: b.display !== 'none' && b.content !== 'none' && parseFloat(b.width) >= 6 && /50%/.test(b.borderRadius),
        dotBg: b.backgroundColor, arrow: a.display !== 'none' && a.content !== 'none' && /[\u2191\u2193]/.test(a.content)
      };
    });
    const nav = document.getElementById('nxArrow');
    const chip = document.getElementById('xKeysChip');
    return {
      nx: keys.filter(k => k.nx).length,
      roots: keys.filter(k => k.root && k.dot).length,
      dash: keys.filter(k => k.nx && !k.held && k.os !== 'none' && parseFloat(k.ow) > 0).length,
      arrows: keys.filter(k => k.arrow).length,
      up: keys.filter(k => k.up).length,
      dotBg: (keys.find(k => k.root && k.dot) || {}).dotBg || null,
      nav: !!nav, navPointer: nav ? getComputedStyle(nav).pointerEvents : null,
      keysChip: !!(chip && chip.getBoundingClientRect().width > 0)
    };
  });
}
async function playSample(p) {
  return p.evaluate(async () => {
    const A = window.ChordAudio; const L = [];
    const pc = A.playChord.bind(A);
    A.playChord = function (g, m, o) { L.push((m || []).filter(Number.isFinite).map(Number).join(',')); return pc.apply(this, arguments); };
    const before = __kbWin().lo;
    document.querySelector('#xNext').click();
    await new Promise(r => setTimeout(r, 80));
    document.querySelector('#xNext').click();
    await new Promise(r => setTimeout(r, 80));
    const key = [...document.querySelectorAll('#pads .pad.white')].find(k => !k.classList.contains('nokey'));
    const r = key.getBoundingClientRect();
    key.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 4, clientX: r.x + r.width / 2, clientY: r.y + r.height * 0.8, button: 0 }));
    await new Promise(res => setTimeout(res, 60));
    const held = __kbWin().lo;
    key.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 4, button: 0 }));
    await new Promise(res => setTimeout(res, 350));
    return { heard: L, before, held, after: __kbWin().lo };
  });
}
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/local/bin/google-chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
  for (const [w, h] of SIZES) {
    const tag = w + 'x' + h;
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    await ctx.addInitScript(`try{localStorage.clear();localStorage.setItem('touchChord.tour.v1','done');}catch(e){}`);
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(String(e)));
    await p.goto(URL + '?test=1&expert=1&hour=12');
    await p.waitForTimeout(800);
    await p.evaluate(() => { const n = document.querySelector('#xNext'); if (n) n.click(); });
    await p.waitForTimeout(250);
    const m = await readMarks(p);
    if (w === 360 || w === 780 || w === 820 || w === 1180) await shot(p, 'after-' + tag);
    // A note outside the window still gets the x-up / x-down class. The glyph itself must not paint.
    const forced = await p.evaluate(() => {
      if (window.__setKey) __setKey(6, 'major');
      const n = document.querySelector('#xNext'); if (n) n.click();
      return new Promise(res => setTimeout(() => {
        const row = [...document.querySelectorAll('#pads .pad')].filter(e => e.classList.contains('x-up') || e.classList.contains('x-down')).map(e => {
          const a = getComputedStyle(e, '::after');
          return { up: e.classList.contains('x-up'), down: e.classList.contains('x-down'), display: a.display, content: a.content };
        });
        res(row);
      }, 250));
    });
    R.data[tag] = { m, forced };
    F(m.nx > 0 && m.dash === 0, tag + ': teal dashed outline still on a next key ' + JSON.stringify(m));
    F(m.roots > 0 && m.dotBg && m.dotBg.indexOf('255, 194, 26') >= 0, tag + ': root dot missing / not gold (test.5: --x-gold) ' + JSON.stringify(m));
    F(m.arrows === 0, tag + ': decorative octave arrow still drawn ' + JSON.stringify(m));
    F(forced.length > 0 && forced.every(x => x.display === 'none' || x.content === 'none'), tag + ': displacement glyph still painted ' + JSON.stringify(forced));
    F(m.nav && m.keysChip, tag + ': navigation arrow node or Keys chip missing');
    F(!errs.length, tag + ': ' + errs.join(' | '));
    await ctx.close();
  }
  if (BASE2) {
    const ctx = await b.newContext({ viewport: { width: 360, height: 780 } });
    await ctx.addInitScript(`try{localStorage.clear();localStorage.setItem('touchChord.tour.v1','done');}catch(e){}`);
    const a = await ctx.newPage();
    const c = await b.newContext({ viewport: { width: 360, height: 780 } });
    await c.addInitScript(`try{localStorage.clear();localStorage.setItem('touchChord.tour.v1','done');}catch(e){}`);
    const d = await c.newPage();
    await a.goto(URL + '?test=1&expert=1&hour=12');
    await d.goto(BASE2 + '?test=1&expert=1&hour=12');
    await a.waitForTimeout(800); await d.waitForTimeout(800);
    const A = await playSample(a), B = await playSample(d);
    R.data.audio = { now: A, base: B };
    F(JSON.stringify(A.heard) === JSON.stringify(B.heard), 'audio events differ from the frozen tree ' + JSON.stringify(A.heard) + ' vs ' + JSON.stringify(B.heard));
    F(A.before === B.before && A.held === B.held && A.after === B.after, 'sliding window differs from the frozen tree ' + JSON.stringify({ A, B }));
    await d.evaluate(() => { const n = document.querySelector('#xNext'); if (n) n.click(); });
    await d.waitForTimeout(250);
    await shot(d, 'before-360x780');
    await ctx.close(); await c.close();
  }
  fs.writeFileSync(path.join(OUT, 'expertmarks.json'), JSON.stringify(R, null, 2));
  console.log((R.fails.length ? 'FAIL ' : 'PASS ') + R.fails.length);
  R.fails.forEach(f => console.log(f));
  await b.close();
  process.exit(R.fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
