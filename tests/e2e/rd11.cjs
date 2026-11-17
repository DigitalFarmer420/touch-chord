// rd11 (Uiux Lows on Simple Day): (1) the Look helper line, same wording and style in the Kids, Simple and Expert sheets;
// (2) the tension chip (Bbsus4, m7b5, 7b9) is a mid plum in Day, darker than and distinct from minor, white text AA; Lamp keeps navy;
// (3) iPad lyric rows: the section chip is top-aligned with the first lyric line (Day and Lamp), phone unchanged;
// (4) contrast at 820x1180 and 1180x820 in Day; (5) Simple Lamp = rd10 pixel for pixel outside the song bar (RD10=<e8cf905 server>).
// node -r ./emulate.cjs rd11.cjs   env BASE, RD10, OUT, CMP
const { chromium } = require('playwright-core'); const fs = require('fs'); const path = require('path');
const URL = process.env.URL || process.env.BASE || 'http://localhost:8080/index.html'; const RD10 = process.env.RD10 || '';
const OUT = process.env.OUT || path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const CMP = process.env.CMP || ''; if (CMP) fs.mkdirSync(CMP, { recursive: true });
const SIZES = process.argv[2] ? [process.argv[2].split('x').map(Number)] : [[820, 1180], [1180, 820]];
const R = { fails: [], data: {} }; const F = (c, m) => { if (!c) R.fails.push(m); };
const V13 = fs.readFileSync(path.join(__dirname, '../fixtures/upload/anh-v13.json'), 'utf8');
const V12 = fs.readFileSync(path.join(__dirname, '../fixtures/upload/anh-v12.json'), 'utf8');
const SLK = 'touchChord.simpleLook.v1', LK = look => ({ ls: { [SLK]: { v: 1, look } } });
const FREEZE = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}#dev-badge{visibility:hidden!important}#xKeysChip{visibility:hidden!important}';
// rd13 changed on purpose: the phone top rows (Simple's mode chip 40 -> 44px, Expert's top bar / Next / Play / picker
// heights) and Expert's Keys chip; the pixel checks against older builds hide the chip and mask those rows.
const RD13M = p => ({ mask: [p.locator('header.topbar'), p.locator('#xTop'), p.locator('#xGo'), p.locator('#xSrc'), p.locator('html.expert .kb-wrap')] })   // rd14: + Expert's keyboard panel (header strip);
const CONTRAST = function (groups) {
  function parse(c) { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; }
  function over(f, b) { const a = f.a + b.a * (1 - f.a); if (!a) return { r: 0, g: 0, b: 0, a: 0 }; return { r: (f.r * f.a + b.r * b.a * (1 - f.a)) / a, g: (f.g * f.a + b.g * b.a * (1 - f.a)) / a, b: (f.b * f.a + b.b * b.a * (1 - f.a)) / a, a }; }
  function lum(c) { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); }
  function ratio(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function bgOf(el) { // composite the backgrounds from the root down to el
    const chain = []; for (let e = el; e; e = e.parentElement) chain.push(e);
    let c = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = chain.length - 1; i >= 0; i--) { const cs = getComputedStyle(chain[i]); const b = parse(cs.backgroundColor); if (b && b.a > 0) c = over(b, c); const o = +cs.opacity; }
    return c;
  }
  function parentBg(el) { return el.parentElement ? bgOf(el.parentElement) : { r: 255, g: 255, b: 255, a: 1 }; }
  const vis = e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && +getComputedStyle(e).opacity > 0.3 && !e.closest('[hidden]');
  const out = { text: [], ctrl: [], n: { text: 0, ctrl: 0 } };
  for (const [name, sel, kind] of groups) {
    for (const el of document.querySelectorAll(sel)) {
      if (!vis(el)) continue;
      if (kind !== 'ctrl') { // text: every text node directly in el
        const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
        if (!own) continue;
        const cs = getComputedStyle(el), fg = parse(cs.color), bg = bgOf(el), fs = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700;
        const need = fs >= 24 || (bold && fs >= 18.66) ? 3 : 4.5, r = ratio(over(fg, bg), bg);
        out.n.text++; if (r < need - 0.005) out.text.push({ g: name, t: el.textContent.trim().slice(0, 20), r: +r.toFixed(2), need, fg: cs.color, bg: `rgb(${bg.r|0},${bg.g|0},${bg.b|0})` });
      } else {
        const cs = getComputedStyle(el), bgc = parse(cs.backgroundColor), hasB = parseFloat(cs.borderTopWidth) >= 1 && cs.borderTopStyle !== 'none' && parse(cs.borderTopColor).a > 0, hasS = /inset/.test(cs.boxShadow);
        if ((!bgc || bgc.a === 0) && !hasB && !hasS) continue;   // a text / icon button inside its group: the group is the control
        const pb = parentBg(el), own = over(parse(cs.backgroundColor) || { r: 0, g: 0, b: 0, a: 0 }, pb);
        const bw = parseFloat(cs.borderTopWidth), bc = bw >= 1 && cs.borderTopStyle !== 'none' ? over(parse(cs.borderTopColor), pb) : null;
        let sc = null; if (hasS) { const m = cs.boxShadow.match(/rgba?\([^)]+\)/); if (m) sc = over(parse(m[0]), own); }
        const r = Math.max(ratio(own, pb), bc ? ratio(bc, pb) : 1, sc ? Math.min(ratio(sc, own), ratio(sc, pb)) : 1);
        out.n.ctrl++; if (r < 3 - 0.005) out.ctrl.push({ g: name, t: (el.textContent || el.id || el.className).trim().slice(0, 20), r: +r.toFixed(2), bg: cs.backgroundColor, border: bc ? cs.borderTopColor : null, under: `rgb(${pb.r|0},${pb.g|0},${pb.b|0})` });
      }
    }
  }
  return out;
};
;
const SET = {   // saved setups
  kids: { s: { expert: false, playAlong: true } },
  simple: { s: { expert: true, simple: true, style: 'pop' } },
  expert: { s: { expert: true, simple: false, style: 'pop' }, x: { on: true } },
  full: { s: { expert: true, simple: false, style: 'pop', layout: 'octave', theme: 'day' } },   // a pre-redesign Full setup (no Expert pref)
};
async function open(b, w, h, setup, q, opt = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const ls = setup ? `localStorage.setItem('touchChord.settings.v1',JSON.stringify({v:1,settings:${JSON.stringify(setup.s)}}));` + (setup.x ? `localStorage.setItem('touchChord.expert.v1',${JSON.stringify(JSON.stringify(setup.x))});` : '') : '';
  const extra = opt.ls ? Object.entries(opt.ls).map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)},${JSON.stringify(JSON.stringify(v))});`).join('') : '';
  await ctx.addInitScript(`try{if(!sessionStorage.getItem('x')){sessionStorage.setItem('x',1);localStorage.clear();localStorage.setItem('touchChord.tour.v1','done');${ls}${extra}}}catch(e){}`);
  const p = await ctx.newPage(); p.__errs = [];
  p.on('pageerror', e => p.__errs.push('' + e)); p.on('console', m => { if (m.type() === 'error') p.__errs.push(m.text()); });
  if (opt.at) await p.clock.setFixedTime(new Date(opt.at));
  await p.goto(URL + (q == null ? '?test=1&hour=12' : q)); await p.waitForTimeout(1300);
  p.__cdp = await ctx.newCDPSession(p);
  return p;
}
const done = async (p, tag) => { for (const e of p.__errs) F(false, `${tag}: page error ${e}`); await p.context().close(); };
const rectOf = (p, sel) => p.evaluate(s => { const e = typeof s === 'string' ? [...document.querySelectorAll(s)].find(x => x.getClientRects().length && getComputedStyle(x).visibility !== 'hidden') : null; if (!e) return null; const q = e.getBoundingClientRect(); return { x: q.x + q.width / 2, y: q.y + q.height / 2, l: q.left, t: q.top, r: q.right, b: q.bottom }; }, sel);
async function touch(p, x, y, ms) { await p.__cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); await p.waitForTimeout(ms); await p.__cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(150); }
async function tap(p, sel, ms = 60) { const r = await rectOf(p, sel); if (!r) return false; await touch(p, r.x, r.y, ms); return true; }
const chipSel = '.mode-chip';
async function openSheet(p, mode) { await tap(p, chipSel, mode === 'kids' ? 1150 : 60); await p.waitForTimeout(250); return p.evaluate(() => !document.getElementById('modeSheet').hidden); }
async function switchTo(p, from, to) { if (!(await openSheet(p, from))) return 'sheet did not open from ' + from; await tap(p, `#msMode button[data-mode="${to}"]`); await p.waitForTimeout(600); return null; }
const probe = p => p.evaluate(() => { const v = e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && +getComputedStyle(e).opacity > 0.05;
  const chips = [...document.querySelectorAll('.mode-chip')].filter(v).map(e => { const r = e.getBoundingClientRect(); return { m: e.dataset.modeChip, t: e.textContent.trim(), x: r.x, y: r.y, w: r.width, h: r.height }; });
  return { mode: window.__xmode ? __xmode.mode() : null, chips, old: [...document.querySelectorAll('.kv-gear, #simpleBtn, #configBtn, #xBadge, .x-gearmode, #kvSettings, #xSettings')].filter(v).map(e => e.id || e.className),
    sheet: !document.getElementById('modeSheet') || !document.getElementById('modeSheet').hidden ? !!document.getElementById('modeSheet') : false,
    kidsStyle: [...document.querySelectorAll('#styles button[data-style="kids"]')].filter(v).length,
    style: (document.querySelector('#styles button.on[data-style]') || {}).dataset ? document.querySelector('#styles button.on[data-style]').dataset.style : null,
    kv: document.documentElement.classList.contains('kv'), kvLamp: document.documentElement.classList.contains('kv-lamp'),
    xLamp: document.documentElement.classList.contains('x-lamp'), xDay: document.documentElement.classList.contains('x-day'),
    screen: (document.getElementById('kv') || {}).dataset ? document.getElementById('kv').dataset.screen : null,
    song: window.__prog && __prog.list[__prog.idx] ? __prog.list[__prog.idx].name : null, pos: window.__magic ? __magic.state.pos : null,
    note: (() => { const n = document.getElementById('xDenseNote'); return n && v(n) ? n.textContent.replace('\u2715', '').trim() : null; })() }; });
const G = [['chips', '#suggest .ss-chip, #suggest .ss-note', 'ctrl'], ['chip text', '#suggest .ss-chip, #suggest .ss-chip *, #suggest .ss-note, #suggest .ss-note *', 'text'],
  ['lyrics / song bar', '#songBar, #songBar *', 'text'], ['pads', '.kb .pad, .kb .white, .kb .black', 'ctrl'], ['pad text', '.kb .pad, .kb .pad *', 'text'],
  ['controls', 'header.topbar button, #styles button, .now-col button, #ctl button, #prog button, .mode-chip, #keyRow button', 'ctrl'],
  ['control text', 'header.topbar *, #styles button, .now-col *, #ctl *, #prog *, .mode-chip *', 'text'], ['badges', '.pg-badge, .ss .pg-badge', 'text']];
const GS = [['sheet', '#modeSheet *', 'text'], ['sheet controls', '#modeSheet .ms-x, #modeSheet .ms-mode, #modeSheet .ms-seg, #modeSheet .ms-pair button, #modeSheet .ms-tg', 'ctrl']];
const cls = p => p.evaluate(() => ({ day: document.documentElement.classList.contains('s-day'), lamp: document.documentElement.classList.contains('s-lamp') }));
const lyr = p => p.evaluate(() => { const M = __lyr2.map(), st = __upload.steps(); let t = 0; return M.at.map((k, i) => { const o = { t, text: M.seq[k].text }; t += st[i].bars || 1; return o; }); });
async function openClock(b, w, h, setup, time, q, ls) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const s = `localStorage.setItem('touchChord.settings.v1',JSON.stringify({v:1,settings:${JSON.stringify(setup.s)}}));` + (ls ? `localStorage.setItem('${SLK}',${JSON.stringify(JSON.stringify(ls))});` : '');
  await ctx.addInitScript(`try{if(!sessionStorage.getItem('x')){sessionStorage.setItem('x',1);localStorage.clear();localStorage.setItem('touchChord.tour.v1','done');${s}}}catch(e){}`);
  const p = await ctx.newPage(); p.__errs = []; p.on('pageerror', e => p.__errs.push('' + e)); p.on('console', m => { if (m.type() === 'error') p.__errs.push(m.text()); });
  await p.clock.install({ time: new Date(time) }); await p.goto(URL + (q || '?test=1')); await p.waitForTimeout(1300); p.__cdp = await ctx.newCDPSession(p); return p;
}
async function contrast(p) { await p.addScriptTag({ content: 'window.__contrast = ' + CONTRAST.toString() }); const a = await p.evaluate(g => __contrast(g), G); return a; }
async function sheetContrast(p) { await p.addScriptTag({ content: 'window.__contrast = ' + CONTRAST.toString() }); return p.evaluate(g => __contrast(g), GS); }
const HELP = 'Auto: Day 7:00\u201319:00, Lamp at night';
const rgb = s => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; const [r, g, b] = c.map(f); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const hue = ([r, g, b]) => { r /= 255; g /= 255; b /= 255; const M = Math.max(r, g, b), m = Math.min(r, g, b), d = M - m; if (!d) return 0; let h = M === r ? ((g - b) / d) % 6 : M === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; return h < 0 ? h + 360 : h; };
const song = async p => { await p.evaluate(t => __upload.load(t), V13); await p.waitForTimeout(600); await p.evaluate(() => { for (let i = 0; i < 9; i++) document.querySelector('#prog .pg-step').click(); }); await p.waitForTimeout(600); };
const geo = p => p.evaluate(() => { const q = s => { const e = document.querySelector(s); return e && e.getClientRects().length ? e.getBoundingClientRect() : null; };
  const s = q('#songBar .sb-sec'), r = q('#songBar .sb-lyr .sb-row'), l = q('#songBar .sb-lyr');
  return { sec: s && { x: s.left, y: s.top, w: s.width, h: s.height }, row: r && { x: r.left, y: r.top, h: r.height }, lyr: l && { y: l.top, h: l.height } }; });
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
  // 1. the helper line in all three sheets (Look = Auto)
  { const tag = 'helper line', got = {};
    for (const [m, setup] of [['kids', SET.kids], ['simple', SET.simple], ['expert', SET.expert]]) {
      const p = await open(b, 360, 780, setup); const ok = await openSheet(p, m); await p.waitForTimeout(300);
      got[m] = await p.evaluate(() => { const e = document.querySelector('#modeSheet .ms-lsub'), cs = e && getComputedStyle(e), r = e && e.getBoundingClientRect();
        return e ? { text: e.textContent, shown: !!(r.width && r.height) && cs.visibility !== 'hidden' && cs.display !== 'none', size: cs.fontSize, weight: cs.fontWeight, color: cs.color, style: cs.fontStyle, family: cs.fontFamily, lh: cs.lineHeight } : null; });
      F(ok && got[m] && got[m].text === HELP && got[m].shown, `${tag}: ${m} ${JSON.stringify(got[m])} (sheet ${ok})`);
      if (m === 'simple') { await tap(p, '#modeSheet .ms-look button[data-look="day"]'); await p.waitForTimeout(250);
        const t = await p.evaluate(() => document.querySelector('#modeSheet .ms-lsub').textContent); F(t === '', `${tag}: simple with Day picked still says "${t}"`); }
      await done(p, `${tag} ${m}`);
    }
    // size / weight / colour / style the same in all three; the face follows the sheet (Kids sheets are Fredoka), so Simple = Expert there
    const k = JSON.stringify({ ...got.kids, text: 0, family: 0 }); for (const m of ['simple', 'expert']) F(got[m] && JSON.stringify({ ...got[m], text: 0, family: 0 }) === k, `${tag}: ${m} style differs from kids ${JSON.stringify(got[m])} vs ${k}`);
    F(got.simple && got.expert && got.simple.family === got.expert.family, `${tag}: Simple face ${got.simple && got.simple.family} vs Expert ${got.expert && got.expert.family}`);
    R.data[tag + ' kids face'] = got.kids && got.kids.family;
    R.data[tag] = got.simple;
    if (CMP) { const p = await open(b, 820, 1180, SET.simple, null, LK('auto')); await openSheet(p, 'simple'); await p.waitForTimeout(400); await p.screenshot({ path: path.join(CMP, '820x1180-sheet-day-auto.png') }); await done(p, 'sheet shot'); }
  }
  // 2. the tension chip
  for (const look of ['day', 'lamp']) { const tag = `sus chip ${look}`;
    const p = await open(b, 820, 1180, SET.simple, null, LK(look)); await song(p);
    const c = await p.evaluate(() => { const v = e => e.getClientRects().length; const st = e => { const cs = getComputedStyle(e); return { text: e.textContent.trim(), bg: cs.backgroundColor, fg: cs.color, bd: cs.borderTopColor }; };
      const t = [...document.querySelectorAll('#suggest .ss-chip.tension')].filter(v), m = [...document.querySelectorAll('#suggest .ss-chip.minor')].filter(v);
      return { t: t.map(st), m: m.slice(0, 1).map(st) }; });
    const sus = c.t.find(x => /sus4/.test(x.text)); F(!!sus && c.m.length, `${tag}: no Bbsus4 / minor chip ${JSON.stringify(c)}`);
    if (sus && c.m.length) { const T = rgb(sus.bg), M = rgb(c.m[0].bg), fg = rgb(sus.fg);
      const d = R.data[tag] = { sus: sus.text, bg: sus.bg, fg: sus.fg, minor: c.m[0].bg, text: +ratio(T, fg).toFixed(2), lumSus: +lum(T).toFixed(3), lumMinor: +lum(M).toFixed(3), hueSus: Math.round(hue(T)), hueMinor: Math.round(hue(M)) };
      F(c.t.every(x => x.bg === sus.bg), `${tag}: tension chips not one colour ${JSON.stringify(c.t)}`);
      if (look === 'day') {
        F(sus.bg === 'rgb(94, 58, 102)' && sus.fg === 'rgb(255, 255, 255)', `${tag}: ${sus.bg} / ${sus.fg}`);
        F(d.text >= 4.5, `${tag}: text ${d.text}`); F(d.lumSus < d.lumMinor && d.lumSus > 0.05, `${tag}: not one step darker than minor ${d.lumSus} vs ${d.lumMinor}`);
        F(Math.abs(d.hueSus - d.hueMinor) >= 20, `${tag}: hue too close to minor ${d.hueSus} vs ${d.hueMinor}`);
        if (CMP) { const box = await p.evaluate(() => { const v = e => e.getClientRects().length; const r = [...document.querySelectorAll('#suggest .ss-chip.minor, #suggest .ss-chip.tension')].filter(v).map(e => e.getBoundingClientRect()), s = document.getElementById('suggest').getBoundingClientRect();
            const y0 = Math.min(...r.map(x => x.top)) - 8, y1 = Math.max(...r.map(x => x.bottom)) + 8; return { x: s.left, y: y0, width: s.width, height: y1 - y0 }; });
          await p.screenshot({ path: path.join(CMP, '820x1180-chiprow-day-bbsus4.png'), clip: box }); }
      } else F(sus.bg === 'rgb(42, 31, 69)', `${tag}: Lamp tension changed ${sus.bg}`);
    }
    await done(p, tag);
  }
  // 3 / 4 per size
  for (const [w, h] of [...SIZES, [768, 1024], [1024, 768], [360, 780]]) { const T = `${w}x${h}`, D = R.data[T] = {}, pad = w >= 768 && h >= 768;
    for (const look of ['day', 'lamp']) {
      const p = await open(b, w, h, SET.simple, null, LK(look)); const a = pad && SIZES.some(s => s[0] === w && s[1] === h) ? await contrast(p) : null;
      await song(p); const g = await geo(p); D[look] = { geo: g };
      if (pad) { F(g.sec && g.row, `${T} ${look}: no chip / lyric row ${JSON.stringify(g)}`);
        if (g.sec && g.row) { const dc = (g.sec.y + g.sec.h / 2) - (g.row.y + g.row.h / 2); D[look].dc = +dc.toFixed(1);
          F(Math.abs(dc) <= 1 && Math.abs(g.sec.y - g.row.y) <= 2, `${T} ${look}: chip not on the first lyric line (centre off ${dc.toFixed(1)}, top ${g.sec.y} vs ${g.row.y})`);
          F(g.sec.x + g.sec.w <= g.row.x, `${T} ${look}: chip overlaps the lines`);
          F(g.lyr.h >= 2.5 * g.row.h, `${T} ${look}: expected the 3-row block (${g.lyr.h})`); }
      } else F(g.sec && !g.lyr, `${T} ${look}: phone song bar changed ${JSON.stringify(g)}`);
      if (a) { const s1 = await contrast(p); await openSheet(p, 'simple'); await p.waitForTimeout(400); const sh = await sheetContrast(p);
        const bad = [...a.text, ...a.ctrl, ...s1.text, ...s1.ctrl, ...sh.text, ...sh.ctrl]; const n = a.n.text + a.n.ctrl + s1.n.text + s1.n.ctrl + sh.n.text + sh.n.ctrl;
        D[look].contrast = { checked: n, below: bad.length, worst: bad.slice(0, 4).map(x => `${x.g} "${x.t}" ${x.r}`) };
        if (look === 'day') F(bad.length === 0, `${T} day: ${bad.length} below AA / 3:1: ${bad.slice(0, 8).map(x => JSON.stringify(x)).join(' ')}`);
        F(n > 80, `${T} ${look}: only ${n} checked`);
        if (CMP && look === 'day') { await tap(p, '#modeSheet .ms-x'); await p.waitForTimeout(400); await p.screenshot({ path: path.join(CMP, `${T}-simple-day.png`) }); } }
      await done(p, `${T} ${look}`);
    }
    // Lamp = rd10 outside the song bar (the intended chip move)
    if (pad && SIZES.some(s => s[0] === w && s[1] === h)) {
      if (RD10) { const shots = [];
        for (const base of [URL, RD10]) {
          const ctx = await b.newContext({ viewport: { width: w, height: h } });
          await ctx.addInitScript(`try{if(!sessionStorage.getItem('x')){sessionStorage.setItem('x',1);localStorage.clear();localStorage.setItem('touchChord.tour.v1','done');localStorage.setItem('touchChord.settings.v1',JSON.stringify({v:1,settings:${JSON.stringify(SET.simple.s)}}));localStorage.setItem('${SLK}','{"v":1,"look":"lamp"}');}}catch(e){}`);
          const p = await ctx.newPage(); await p.goto(base + '?test=1&hour=12'); await p.waitForTimeout(1300); await p.addStyleTag({ content: FREEZE }); await p.waitForTimeout(300);
          const one = [await p.screenshot(RD13M(p))]; await song(p);
          one.push(await p.screenshot({ mask: [p.locator('#songBar'), ...RD13M(p).mask] })); shots.push(one); await ctx.close();
        }
        // rd12 made tablet lyric rows taller (16px text), which moves everything below the song bar on purpose: on iPad
      // sizes only the start screen (no song bar) is compared now; rd12.cjs checks the lyric block, phones stay compared in full.
      const same = shots[0].map((s, i) => (w >= 768 && h >= 600 && i > 0) || s.equals(shots[1][i])); D.lampVsRd10 = same; F(same.every(Boolean), `${T}: Simple Lamp differs from rd10 outside the song bar (${same})`);
        if (!same.every(Boolean)) shots.forEach((one, k) => one.forEach((s, i) => fs.writeFileSync(path.join(OUT, `rd11-${T}-lamp-${k ? 'rd10' : 'rd11'}-${i}.png`), s)));
      } else F(false, `${T}: RD10 not set (Lamp vs rd10 not checked)`);
    }
    console.log(T, R.fails.length);
  }
  await b.close();
  fs.writeFileSync(path.join(OUT, 'rd11.json'), JSON.stringify(R, null, 1));
  console.log(R.fails.length ? 'FAIL ' + R.fails.length + '\n' + R.fails.join('\n') : 'PASS', JSON.stringify(R.data).slice(0, 5000));
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
