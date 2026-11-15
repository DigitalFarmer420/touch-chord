// Uncommitted cleanup, bound to the working tree (not to 4ee84e8 and not to an older audioeq run).
// Expert: eight actual-step badges, top-centre root dot (gold since v3.2 test.5) on white and black keys, no per-key
// colour bars, no decorative octave arrows, warm gold press kept. No 40-pack song data.
// node -r ./emulate.cjs preclean.cjs
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const URL = process.env.BASE || 'http://127.0.0.1:8080/index.html';
const OUT = process.env.OUT || '/tmp/preclean';
fs.mkdirSync(OUT, { recursive: true });
const R = { fails: [], data: {} };
const F = (c, m) => { if (!c) R.fails.push(m); };
const near = (a, b, e) => Math.abs(a - b) <= e;
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/local/bin/google-chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
  const sizes = [[360, 780], [780, 360], [800, 330]];
  for (const [w, h] of sizes) {
    const tag = w + 'x' + h;
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    await ctx.addInitScript(`try{localStorage.clear();localStorage.setItem('touchChord.tour.v1','done');}catch(e){}`);
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push('' + e));
    await p.goto(URL + '?test=1&expert=1&hour=12');
    await p.waitForTimeout(1000);
    const probe = await p.evaluate(() => {
      const steps = [];
      for (let i = 0; i < 17; i++) steps.push(i % 4 === 1 ? '5 maj' : i % 4 === 3 ? '4 maj' : '1 maj');
      __prog.list.push({ name: 'Slot Probe', steps: steps });
      __progApi.set(__prog.list.length - 1);
      return __prog.list[__prog.idx].name;
    });
    await p.waitForTimeout(450);
    const badges = await p.evaluate(() => {
      const hit = (el, x, y) => { const n = document.elementFromPoint(x, y); return n ? (n.classList && n.classList.contains('pg-badge') ? 'badge' : (el.contains(n) ? 'chip' : (n.className || n.tagName))) : 'none'; };
      return {
        song: __prog.list[__prog.idx] && __prog.list[__prog.idx].name,
        report: __prog.badgeReport,
        rows: __prog.badges.map(b => {
          const t = b.target.getBoundingClientRect(), q = b.el.getBoundingClientRect();
          const cx = t.left + t.width / 2, cy = t.top + t.height / 2;
          return {
            n: b.n, slot: b.slot, ord: b.ord, text: b.el.textContent,
            fs: parseFloat(getComputedStyle(b.el).fontSize),
            dx: +(((q.left + q.width / 2 - t.left) / t.width).toFixed(3)),
            dy: +(((q.top + q.height / 2 - t.top) / t.height).toFixed(3)),
            tw: +t.width.toFixed(1), th: +t.height.toFixed(1),
            center: hit(b.target, cx, cy)
          };
        })
      };
    });
    R.data[tag] = { probe: probe, song: badges.song, n: badges.rows.length, report: badges.report };
    F(badges.song === 'Slot Probe', tag + ': probe song ' + badges.song);
    const bySlot = {};
    badges.rows.forEach(r => { (bySlot[r.ord] = bySlot[r.ord] || []).push(r); });
    const want = { 0: ['tl', 0, 0], 1: ['tr', 1, 0], 2: ['br', 1, 1], 3: ['bl', 0, 1], 4: ['tc', 0.5, 0], 5: ['rc', 1, 0.5], 6: ['bc', 0.5, 1], 7: ['lc', 0, 0.5] };
    Object.keys(want).forEach(k => {
      const rows = bySlot[k] || [];
      F(rows.length >= 1, tag + ': no badge in slot ' + k);
      rows.forEach(r => {
        F(r.slot === want[k][0] && r.text === String(r.n), tag + ': slot ' + k + ' text ' + r.text + ' slot ' + r.slot + ' n ' + r.n);
        F(near(r.dx, want[k][1], 0.22) && near(r.dy, want[k][2], 0.28), tag + ': slot ' + r.slot + ' step ' + r.n + ' at ' + r.dx + ',' + r.dy);
        F(r.fs >= 11, tag + ': step ' + r.n + ' font ' + r.fs);
        F(r.center !== 'badge', tag + ': step ' + r.n + ' covers the chord centre (' + r.center + ')');
      });
    });
    const over = badges.rows.filter(r => r.ord >= 8);
    F(over.length >= 1 && over.every(r => r.slot === 'over' && r.text === String(r.n) && Number(r.text) > 8), tag + ': 9th step dropped or renumbered ' + JSON.stringify(over));
    const tens = badges.rows.filter(r => r.n >= 10);
    F(tens.length >= 1 && tens.every(r => r.text === String(r.n) && r.fs >= 11), tag + ': double-digit steps ' + JSON.stringify(tens.map(r => r.text)));
    // I plays at steps 1,3,5,7,9,11,13,15,17. The labels are those numbers, not 1..9.
    const ones = badges.rows.filter(r => r.ord < 9 && [1, 3, 5, 7, 9, 11, 13, 15, 17].indexOf(r.n) >= 0);
    F(ones.some(r => r.n === 1 && r.slot === 'tl') && ones.some(r => r.n === 5 && r.slot === 'br') && ones.some(r => r.n === 9 && r.slot === 'tc'), tag + ': steps 1,5,9 are not TL, BR, TC');
    if (badges.report && (badges.report.overflow.length || badges.report.collisions.length || badges.report.nameHits.length)) {
      R.data[tag].reported = badges.report;
    }
    // Dot, colour bars, arrows, warm press. Walk the key until both a white and a black root exist.
    await p.evaluate(() => { const n = document.querySelector('#xNext'); if (n) n.click(); });
    await p.waitForTimeout(300);
    let dots = [];
    for (let pc = 0; pc < 12; pc++) {
      await p.evaluate(n => { if (window.__setKey) __setKey(n, 'major'); const b = document.querySelector('#xNext'); if (b) b.click(); }, pc);
      await p.waitForTimeout(120);
      const got = await p.evaluate(() => [...document.querySelectorAll('#pads .pad.nx-root')].map(k => {
        const r = k.getBoundingClientRect(), b = getComputedStyle(k, '::before');
        const bw = parseFloat(b.width) || 0, bh = parseFloat(b.height) || 0;
        const ml = parseFloat(b.marginLeft) || 0, mt = parseFloat(b.marginTop) || 0;
        const bl = parseFloat(getComputedStyle(k).borderLeftWidth) || 0, bt = parseFloat(getComputedStyle(k).borderTopWidth) || 0;
        const left = bl + (parseFloat(b.left) || 0) + ml, top = bt + (parseFloat(b.top) || 0) + mt;
        return { black: k.classList.contains('black'), kw: r.width, kh: r.height, w: bw, h: bh, left: left, top: top, radius: b.borderRadius, bg: b.backgroundColor, display: b.display };
      }));
      got.forEach(d => { if (!dots.some(o => o.black === d.black)) dots.push(d); });
      if (dots.some(d => d.black) && dots.some(d => !d.black)) break;
    }
    R.data[tag].dots = dots;
    const white = dots.find(d => !d.black), black = dots.find(d => d.black);
    F(!!white && !!black, tag + ': need a white and a black root dot ' + JSON.stringify(dots));
    for (const d of [white, black]) if (d) {
      const name = d.black ? 'black' : 'white';
      const cx = d.left + d.w / 2, insetR = d.kw - (d.left + d.w), insetB = d.kh - (d.top + d.h);
      F(d.display !== 'none' && d.w >= 6 && d.w <= 10 && near(d.w, d.h, 0.6) && /50%/.test(d.radius), tag + ': ' + name + ' dot is not a circle ' + JSON.stringify(d));
      F(near(cx, d.kw / 2, 2.5), tag + ': ' + name + ' dot not centred (cx ' + cx.toFixed(1) + ' key ' + d.kw.toFixed(1) + ')');
      F(d.top >= 3 && d.top <= 12 && insetR >= 2 && insetB >= 8, tag + ': ' + name + ' dot not inside the top of the key ' + JSON.stringify(d));
      F(/255,\s*194,\s*26|FFC21A/i.test(d.bg), tag + ': ' + name + ' dot colour (test.5: gold --x-gold) ' + d.bg);
    }
    const deco = await p.evaluate(() => {
      const w = [...document.querySelectorAll('#pads .pad.white')].find(k => !k.classList.contains('nx-root')) || document.querySelector('#pads .pad.white');
      if (w) w.classList.add('x-up');
      const bar = w ? getComputedStyle(w, '::before') : null;
      const arrow = w ? getComputedStyle(w, '::after') : null;
      const mini = document.querySelector('.x-mk.wk');
      const mb = mini ? getComputedStyle(mini, '::before').content : null;
      if (w) w.classList.add('held');
      const held = w ? { bg: getComputedStyle(w).backgroundColor, outline: getComputedStyle(w).outlineColor } : null;
      if (w) w.classList.remove('held');
      return {
        bar: bar && { content: bar.content, bg: bar.backgroundColor, h: bar.height, w: bar.width },
        arrow: arrow && { content: arrow.content, display: arrow.display },
        mini: mb, held: held
      };
    });
    R.data[tag].deco = deco;
    const barOn = deco.bar && deco.bar.content !== 'none' && parseFloat(deco.bar.h) > 3 && !/0,\s*0,\s*0,\s*0/.test(deco.bar.bg) && deco.bar.bg !== 'rgba(0, 0, 0, 0)';
    F(!barOn, tag + ': per-key colour bar still drawn ' + JSON.stringify(deco.bar));
    F(deco.arrow && (deco.arrow.display === 'none' || deco.arrow.content === 'none'), tag + ': octave arrow still drawn ' + JSON.stringify(deco.arrow));
    F(!deco.mini || deco.mini === 'none', tag + ': key-sheet colour bar still drawn ' + deco.mini);
    F(deco.held && /255,\s*231,\s*166|255,\s*194,\s*26|227,\s*154,\s*0/.test(deco.held.bg + deco.held.outline), tag + ': warm press missing ' + JSON.stringify(deco.held));
    F(!errs.length, tag + ': page errors ' + errs.join(' | '));
    const kb = await p.locator('.kb-wrap').boundingBox();
    if (kb) await p.screenshot({ path: path.join(OUT, 'after-dot-' + tag + '.png'), clip: { x: Math.max(0, kb.x), y: Math.max(0, kb.y), width: Math.min(kb.width, w), height: Math.min(kb.height, h - Math.max(0, kb.y)) } });
    const grid = await p.locator('#suggest').boundingBox();
    if (grid) await p.screenshot({ path: path.join(OUT, 'badges-' + tag + '.png'), clip: { x: Math.max(0, grid.x - 8), y: Math.max(0, grid.y - 8), width: Math.min(grid.width + 16, w), height: Math.min(grid.height + 16, h - Math.max(0, grid.y - 8)) } });
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, 'preclean.json'), JSON.stringify(R, null, 2));
  console.log((R.fails.length ? 'FAIL ' : 'PASS ') + R.fails.length);
  R.fails.slice(0, 40).forEach(f => console.log(f));
  await b.close();
  process.exit(R.fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
