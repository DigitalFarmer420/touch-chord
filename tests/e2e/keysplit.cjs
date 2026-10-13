// Full keysplit (port of v113 item 5): Full shows Simple's key control (‹ root › + Major/Minor), the Key chip is gone.
// Every style in Full, 360x780 + 780x360 (emulate.cjs: DPR 3, isMobile, hasTouch). Adapted from test113/mm113.js.
//   node -r ./emulate.cjs keysplit.cjs      env: BASE (url), OUT, SHOTS, SIMPLE_SHOTS (dir for the Simple diff set),
//   KS_SIMPLE_ONLY=1 (only the Simple shots), KS_JSCLICK=1 (baseline run on v112.3: its Full hides the control, so click it by script for the state comparison)
const { chromium } = require('playwright-core'); const fs = require('fs'); const path = require('path');
const URL = process.env.BASE || 'http://127.0.0.1:8080/index.html'; const OUT = process.env.OUT || path.join(__dirname, 'out');
const SH = (process.env.SHOTS || '/tmp/tc-shots') + '/keysplit/'; const SS = process.env.SIMPLE_SHOTS || ''; const JS = process.env.KS_JSCLICK === '1'; const SO = process.env.KS_SIMPLE_ONLY === '1';
fs.mkdirSync(SH, { recursive: true }); fs.mkdirSync(OUT, { recursive: true }); if (SS) fs.mkdirSync(SS, { recursive: true });
const STYLES = ['pop', 'kids', 'jazz', 'rnb', 'ballad', 'reggae', 'funk', 'yogaDeep', 'country', 'blues'];
const R = { fails: [], rows: [], state: {} }; const F = (c, m) => { if (!c) R.fails.push(m); };
const rd = p => p.evaluate(() => { const b = document.getElementById('kidKey'), r = b.querySelector('.kk-root'), m = b.querySelector('.kk-mode');
  const vis = e => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  const pads = [...document.querySelectorAll('#pads .pad')].filter(vis).map(e => ({ pc: +e.dataset.pc, m: +e.dataset.midi, x: e.getBoundingClientRect().x }));
  const left = pads.length ? pads.reduce((a, k) => k.x < a.x ? k : a) : null;
  let saved = null; try { saved = JSON.parse(localStorage.getItem('touchChord.settings.v1')).settings.lockKey; } catch (e) {}
  return { pc: +r.getAttribute('aria-valuenow'), vt: r.getAttribute('aria-valuetext'), mode: m.querySelector('.kk-mtxt').textContent, vis: vis(b), chipVis: vis(document.getElementById('keyChip')),
    chips: [...document.querySelectorAll('#suggest .ss-chip, #suggest .ss-kidpad')].filter(vis).map(e => e.textContent.trim().replace(/\s+/g, '')),
    leftPc: left && left.pc, sym: document.getElementById('symbol').textContent.trim(), saved }; });
const geo = p => p.evaluate(() => { const vis = e => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  const k = document.getElementById('kidKey'), q = k.getBoundingClientRect(); const ov = [];
  document.querySelectorAll('button, select, input, #symbol, .now-card, #nowVol').forEach(e => { if (!vis(e) || k.contains(e) || e.contains(k) || e.id === 'volume') return; /* the range input's 28 px hit box also reached into the v112.3 Key chip slot; its visible track (#nowVol) is checked */ const r = e.getBoundingClientRect();
    if (r.width && r.height && r.left < q.right - 1 && r.right > q.left + 1 && r.top < q.bottom - 1 && r.bottom > q.top + 1) ov.push(e.id || e.className || e.tagName); });
  const parts = [...k.querySelectorAll('.kk-prev,.kk-next,.kk-mode,.kk-name')].map(e => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height }; });
  return { x: q.x, y: q.y, w: q.width, h: q.height, inView: q.left >= -0.5 && q.top >= -0.5 && q.right <= innerWidth + 0.5 && q.bottom <= innerHeight + 0.5, ov, parts }; });
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
  for (const [w, h] of [[360, 780], [780, 360]]) { const tag = `${w}x${h}`;
    const ctx = await b.newContext({ viewport: { width: w, height: h } }); const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push('' + e)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto(URL + '?test=1'); await p.waitForTimeout(1200);
    const tap = async (sel, ms) => { if (JS) await p.evaluate(s => document.querySelector(s).click(), sel); else await p.tap(sel); await p.waitForTimeout(ms || 250); };
    const style = async s => { await p.evaluate(s => { const x = document.querySelector(`#styles button[data-style="${s}"]`); if (x) x.click(); }, s); await p.waitForTimeout(500); };
    const isSimple = () => p.evaluate(() => document.documentElement.classList.contains('simple'));
    if (await isSimple()) { await p.tap('#simpleBtn'); await p.waitForTimeout(400); }
    const have = await p.evaluate(S => S.filter(s => document.querySelector(`#styles button[data-style="${s}"]`)), STYLES);
    for (const st of SO ? [] : have) { await style(st); if (await isSimple()) { F(false, `${tag} ${st} Full turned Simple`); continue; }
      const s0 = await rd(p), g = await geo(p);
      if (!JS) { F(s0.vis, `${tag} ${st} key control not visible in Full`); F(!s0.chipVis, `${tag} ${st} Key chip still visible`); F(g.inView, `${tag} ${st} key control off screen ${JSON.stringify(g)}`);
        F(!g.ov.length, `${tag} ${st} key control overlaps ${g.ov}`); F(g.parts.every(x => x.w > 0 && x.h > 0), `${tag} ${st} key control part collapsed`); }
      const seq = []; // next x2, prev x1, minor, major, minor, prev (wrap check from C later)
      const up1 = (await tap('#kidKey .kk-next'), await rd(p)); const up2 = (await tap('#kidKey .kk-next'), await rd(p)); const dn = (await tap('#kidKey .kk-prev'), await rd(p));
      F(up1.pc === (s0.pc + 1) % 12 && up2.pc === (s0.pc + 2) % 12 && dn.pc === up1.pc, `${tag} ${st} steps ${s0.pc}->${up1.pc}->${up2.pc}->${dn.pc}`);
      F(up1.mode === s0.mode && up2.mode === s0.mode, `${tag} ${st} step changed quality`);
      const mi = (await tap('#kidKey .kk-mode', 350), await rd(p)); const ma = (await tap('#kidKey .kk-mode', 350), await rd(p));
      // Kids keeps its v109 rule (Minor falls back to the song key, C major) in Simple and Full alike: v113 changed that with
      // kidsMinorPicked (item 1), which is out of scope here, so Kids only checks that the control shows and steps.
      if (st !== 'kids') { F(mi.pc === dn.pc && ma.pc === dn.pc, `${tag} ${st} toggle moved root ${dn.pc}/${mi.pc}/${ma.pc}`);
      F(mi.mode !== dn.mode && ma.mode === dn.mode && / (major|minor)$/.test(mi.vt), `${tag} ${st} toggle ${dn.mode}->${mi.mode}->${ma.mode}`);
      F(JSON.stringify(up1.chips) !== JSON.stringify(s0.chips) && JSON.stringify(mi.chips) !== JSON.stringify(dn.chips), `${tag} ${st} chord pads did not update`); }
      F(mi.saved && mi.saved.pc === mi.pc && mi.saved.mode === (mi.mode === 'Minor' ? 'minor' : 'major'), `${tag} ${st} saved lockKey ${JSON.stringify(mi.saved)}`);
      // tap the first chord pad: Now follows
      const pt = await p.evaluate(() => { const e = [...document.querySelectorAll('#suggest .ss-chip, #suggest .ss-kidpad')].find(e => e.getClientRects().length && e.getBoundingClientRect().width > 4);
        if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, t: e.textContent.trim() }; }); let symAfter = null;
      if (pt && !JS) { const sb = (await rd(p)).sym; await p.touchscreen.tap(pt.x, pt.y); await p.waitForTimeout(400); symAfter = (await rd(p)).sym; F(!!symAfter, `${tag} ${st} Now empty after pad tap`); }
      else if (!JS) F(st === 'kids', `${tag} ${st} no visible chord pad`);
      seq.push({ s0: [s0.pc, s0.mode, s0.leftPc, s0.chips], up1: [up1.pc, up1.mode, up1.leftPc, up1.chips], up2: [up2.pc, up2.leftPc, up2.chips], mi: [mi.pc, mi.mode, mi.leftPc, mi.chips], ma: [ma.pc, ma.mode, ma.leftPc, ma.chips] });
      R.state[`${tag}:${st}`] = seq[0]; R.rows.push({ tag, st, geo: g, sym: symAfter, chips: mi.chips.slice(0, 8).join(' ') });
      if (!JS) await p.screenshot({ path: SH + `full-${st}-${tag}.png` });
      if (st === 'pop' && !JS) { await tap('#kidKey .kk-mode', 350); await p.screenshot({ path: SH + `full-pop-minor-${tag}.png` }); await tap('#kidKey .kk-mode', 350); }
    }
    // persistence: F# minor in Full -> reload -> Simple -> Full
    if (!JS && !SO) { await style('pop'); let s = await rd(p), n = 0; while (s.pc !== 6 && n++ < 13) { await tap('#kidKey .kk-next', 120); s = await rd(p); } if (s.mode !== 'Minor') await tap('#kidKey .kk-mode', 300);
      await p.reload(); await p.waitForTimeout(1500); s = await rd(p); F(s.pc === 6 && s.mode === 'Minor' && !(await isSimple()), `${tag} reload F# minor ${s.vt}`);
      await p.tap('#simpleBtn'); await p.waitForTimeout(400); s = await rd(p); F(s.pc === 6 && s.mode === 'Minor', `${tag} Full->Simple key ${s.vt}`);
      await p.tap('#simpleBtn'); await p.waitForTimeout(400); s = await rd(p); F(s.pc === 6 && s.mode === 'Minor', `${tag} Simple->Full key ${s.vt}`); }
    F(!errs.length, `${tag} page errors ${errs.slice(0, 3)}`); R.rows.push({ tag, errs: errs.length });
    // Simple shots (screenshot diff vs v112.3), fresh context per style, fixed state
    if (SS) for (const st of have) { const c2 = await b.newContext({ viewport: { width: w, height: h } }); const q = await c2.newPage();
      await q.addInitScript(() => { try { if (!sessionStorage.getItem('ks')) { localStorage.clear(); sessionStorage.setItem('ks', '1'); } } catch (e) {} });
      await q.goto(URL + '?test=1'); await q.waitForTimeout(1200); if (!(await q.evaluate(() => document.documentElement.classList.contains('simple')))) { await q.tap('#simpleBtn'); await q.waitForTimeout(400); }
      await q.evaluate(s => document.querySelector(`#styles button[data-style="${s}"]`).click(), st); await q.waitForTimeout(600);
      await q.tap('#kidKey .kk-next'); await q.waitForTimeout(300); await q.tap('#kidKey .kk-mode'); await q.waitForTimeout(300);
      await q.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' }); await q.waitForTimeout(700);
      await q.screenshot({ path: path.join(SS, `simple-${st}-${tag}.png`) }); await c2.close(); }
    await ctx.close(); }
  await b.close(); if (!SO) fs.writeFileSync(path.join(OUT, JS ? 'keysplit-base.json' : 'keysplit.json'), JSON.stringify(R, null, 1));
  console.log(`keysplit: fails=${R.fails.length}`); R.fails.forEach(f => console.log('FAIL', f)); })().catch(e => { console.error(e); process.exit(1); });
