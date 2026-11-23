// Kids redesign: the Kids view (Simple). At each size (default 360x780, 780x360, 768x1024, 1024x768; phone emulation
// via -r emulate.cjs): a real first visit (?test=1&kv=1) opens Hello with the full app hidden; Hello -> the ten songs in
// order (Twinkle first, the default); the play screen has 7 root-position pads C..B rising in reading order and one
// piano covering the song's melody (padded to C4..B4 only when narrower than an octave; edges on white keys) rising left to right; every step of a song: the
// keyboard does not move (same keys, same rects, same pitches), exactly one gold key and it is on screen at the real
// melody pitch (no shift arrow when the range covers the note), and a tap on it sounds 60 + the preset's @note; C4 has
// a home dot; the reward shows
// after the last gold tap, after Next on the last step and after Play song's last step (Play stops); every free pad is a major triad (no Happy / Sad);
// Kids -> Expert -> Kids keeps the song and the step; Play along off hides the gold marks while Next and Play song
// still move the song on; Daylight / Lamplight and Simple / Expert survive a reload. No page errors.
// node -r ./emulate.cjs kidsview.cjs [WxH]   env BASE, OUT, KV_SHOTS (dir: a screenshot per screen)
const { chromium } = require('playwright-core'); const fs = require('fs'); const path = require('path');
const URL = process.env.URL || process.env.BASE || 'http://localhost:8080/index.html';
const OUT = process.env.OUT || path.join(__dirname, 'out'); fs.mkdirSync(OUT, { recursive: true });
const SHOTS = process.env.KV_SHOTS || ''; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const SIZES = process.argv[2] ? [process.argv[2].split('x').map(Number)] : [[360, 780], [780, 360], [768, 1024], [1024, 768], [820, 1180]];
const w12 = n => ((n % 12) + 12) % 12;
const TEN = ['Kids Twinkle', 'Kids Old MacDonald', 'Kids Itsy Bitsy Spider', 'Kids Row Your Boat', 'Kids Head Shoulders Knees and Toes', "Kids Mary's Lamb", 'Kids Happy Birthday', 'Kids Jingle Bells', 'Kids London Bridge', 'Kids This Old Man'];
const SRC = fs.readFileSync(path.join(__dirname, '../../js/songs/presets.js'), 'utf8');
const MEL = {}; for (const m of SRC.matchAll(/P\("(Kids [^"]+)", "([^"]+)"\)/g)) MEL[m[1]] = m[2].split('|').map(s => +s.match(/@(-?\d+)$/)[1]);

const WHITE = new Set([0, 2, 4, 5, 7, 9, 11]);
const snapLo = m => { while (!WHITE.has(((m % 12) + 12) % 12)) m--; return m; };
const snapHi = m => { while (!WHITE.has(((m % 12) + 12) % 12)) m++; return m; };
function songRange(mel) {
  const midis = mel.map(o => 60 + o);
  const span = midis.length ? Math.max(...midis) - Math.min(...midis) : 0;
  const xs = span >= 12 ? midis.slice() : midis.concat([60, 71]);
  const lo = snapLo(Math.min(...xs)), hi = snapHi(Math.max(...xs));
  const wk = [], bk = [];
  for (let m = lo; m <= hi; m++) (WHITE.has(((m % 12) + 12) % 12) ? wk : bk).push(m);
  return { lo, hi, wk, bk };
}
const R = { fails: [], data: {} }; const F = (c, m) => { if (!c) R.fails.push(m); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
async function open(b, w, h, fresh) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript(`try{if(!sessionStorage.getItem('x')){sessionStorage.setItem('x',1);localStorage.clear();localStorage.setItem('touchChord.tour.v1','done');}}catch(e){}`);
  const p = await ctx.newPage(); p.__errs = [];
  p.on('pageerror', e => p.__errs.push('' + e)); p.on('console', m => { if (m.type() === 'error') p.__errs.push(m.text()); });
  await p.goto(URL + '?test=1&kv=1&hour=12'); await p.waitForTimeout(1200); await rec(p);   // rd6: hour=12 = the Auto look is Day
  return p;
}
const rec = p => p.evaluate(() => { const A = window.ChordAudio; window.__L = []; if (A.__kvw) return; A.__kvw = 1; const pc = A.playChord.bind(A);
  A.playChord = function (g, m, o) { window.__L.push({ g, m: (m || []).filter(isFinite).map(Number).sort((a, b) => a - b) }); return pc(g, m, o); }; });
const take = p => p.evaluate(() => { const l = window.__L; window.__L = []; return l; });
const vis = (r, W, H) => r && r.w > 0 && r.h > 0 && r.x >= -0.5 && r.y >= -0.5 && r.x + r.w <= W + 0.5 && r.y + r.h <= H + 0.5;
const st = p => p.evaluate(() => { const rc = e => { const r = e.getBoundingClientRect(); return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; };
  const kv = document.getElementById('kv'), wk = [...kv.querySelectorAll('.kv-wk')], bk = [...kv.querySelectorAll('.kv-bk')], keys = wk.concat(bk);
  const gold = keys.filter(k => k.classList.contains('gold'));
  return { on: document.documentElement.classList.contains('kv'), app: getComputedStyle(document.getElementById('app')).display, screen: kv.dataset.screen,
    song: __prog.list[__prog.idx] && __prog.list[__prog.idx].name, cur: __prog.cur, pos: __magic.state.pos, playing: !!__prog.playing, n: __prog.steps.length,
    wk: wk.map(k => ({ pc: +k.dataset.pc, m: +k.dataset.midi, home: k.classList.contains('home'), r: rc(k) })), bk: bk.map(k => ({ pc: +k.dataset.pc, m: +k.dataset.midi, r: rc(k) })),
    gold: gold.map(k => ({ pc: +k.dataset.pc, m: +k.dataset.midi, up: k.classList.contains('oct-up'), down: k.classList.contains('oct-down'), arrow: k.querySelector('.kv-oct').textContent,
      star: getComputedStyle(k, '::before').display !== 'none' && getComputedStyle(k, '::before').content !== 'none', arrowShown: getComputedStyle(k.querySelector('.kv-oct')).display !== 'none', r: rc(k) })),
    pads: [...kv.querySelectorAll('.kv-pad')].map(e => ({ pc: +e.dataset.pc, l: e.dataset.letter, gold: e.classList.contains('gold'), r: rc(e) })),
    reward: !kv.querySelector('.kv-reward').hidden, lyr: kv.querySelector('.kv-lyr').textContent, paOff: kv.classList.contains('pa-off'),
    lamp: document.documentElement.classList.contains('kv-lamp'), bg: getComputedStyle(kv).backgroundColor, kbWin: __kbWin().lo }; });
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
  for (const [w, h] of SIZES) { const tag = `${w}x${h}`, D = R.data[tag] = {};
    const p = await open(b, w, h); const cdp = await p.context().newCDPSession(p);
    const touch = async (x, y, ms = 90) => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); await p.waitForTimeout(ms); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(40); };
    const tapEl = async (sel, fy = 0.5, ms = 90) => { const r = await p.evaluate(s => { const e = document.querySelector(s); if (!e || !e.getClientRects().length) return null; if (e.closest('.ms-sheet')) e.scrollIntoView({ block: 'center' }); const q = e.getBoundingClientRect(); return { x: q.x, y: q.y, w: q.width, h: q.height }; }, sel); if (!r) { R.fails.push(`${tag}: no ${sel}`); return; } await touch(r.x + r.w / 2, r.y + r.h * fy, ms); };
    const holdChip = async () => { await tapEl('#kv .kv-play .mode-chip', 0.5, 1150); await p.waitForTimeout(350); };   // rd6: the Kids chip opens Settings after a 1 s hold
    const shot = async n => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `${tag}-${n}.png`) }); };
    // 1. first visit: Hello over a hidden full app
    let s = await st(p); F(s.on && s.app === 'none' && s.screen === 'hello', `${tag}: first visit is not the Kids Hello (on ${s.on}, #app ${s.app}, screen ${s.screen})`); await shot('hello');
    F(s.song === 'Kids Twinkle', `${tag}: default song ${s.song}`);
    // 2. song picker: ten, in order, Twinkle marked
    await tapEl('#kv .kv-go'); await p.waitForTimeout(250);
    const cards = await p.evaluate(() => [...document.querySelectorAll('#kv .kv-card')].map(c => { const r = c.getBoundingClientRect(); return { s: c.dataset.song, last: c.classList.contains('last'), x: r.x, y: r.y, w: r.width, h: r.height }; }));
    F(same(cards.map(c => c.s), TEN), `${tag}: song cards ${cards.map(c => c.s)}`); F(cards[0] && cards[0].last && cards.filter(c => c.last).length === 1, `${tag}: Twinkle not the marked default`);
    F(same(await p.evaluate(() => __kv.songs()), TEN), `${tag}: prog.list is not the ten`);
    const onScreen = cards.filter(c => vis(c, w, h)); F(onScreen.length >= 2, `${tag}: no song cards on screen (${onScreen.length})`);
    if (onScreen.length < cards.length) { const lastOn = await p.evaluate(() => { const sc = document.querySelector('#kv .kv-songs'); sc.scrollTop = sc.scrollHeight; const r = document.querySelector('#kv .kv-card:last-child').getBoundingClientRect(), v = sc.getBoundingClientRect(); return { in: r.bottom <= v.bottom + 2 && r.top < v.bottom }; }); F(lastOn.in, `${tag}: last song card does not scroll into view`); await p.evaluate(() => { document.querySelector('#kv .kv-songs').scrollTop = 0; }); }
    for (let i = 1; i < cards.length; i++) F(cards[i].y > cards[i - 1].y + 1 || (Math.abs(cards[i].y - cards[i - 1].y) <= 1 && cards[i].x > cards[i - 1].x), `${tag}: card ${i} out of reading order`);
    await shot('songs');
    // 3. play screen geometry
    await tapEl('#kv .kv-card[data-song="Kids Twinkle"]'); await p.waitForTimeout(300); s = await st(p); await shot('play');
    F(s.screen === 'play' && s.song === 'Kids Twinkle', `${tag}: Twinkle card did not open play (${s.screen} ${s.song})`);
    F(same(s.pads.map(q => q.l), ['C', 'D', 'E', 'F', 'G', 'A', 'B']), `${tag}: pads ${s.pads.map(q => q.l)}`);
    for (let i = 1; i < 7; i++) { const a = s.pads[i - 1].r, c = s.pads[i].r; F(c.y > a.y + 1 || (Math.abs(c.y - a.y) <= 1 && c.x > a.x), `${tag}: pad ${s.pads[i].l} not after ${s.pads[i - 1].l} in reading order`); }
    F(s.pads.every(q => vis(q.r, w, h)), `${tag}: a pad is off screen`);
    F(s.wk.length === 7 && s.bk.length === 5, `${tag}: piano has ${s.wk.length} white / ${s.bk.length} black keys`);
    F(same(s.wk.map(k => k.m), [60, 62, 64, 65, 67, 69, 71]) && same(s.bk.map(k => k.m), [61, 63, 66, 68, 70]), `${tag}: key pitches ${s.wk.map(k => k.m)} / ${s.bk.map(k => k.m)}`);
    F(s.wk.some(k => k.m === 60 && k.home) && s.wk.filter(k => k.home).length === 1, `${tag}: C4 should be the one home-dot key`);
    for (let i = 1; i < 7; i++) F(s.wk[i].r.x > s.wk[i - 1].r.x, `${tag}: white keys not rising left to right`);
    for (const k of s.bk) { const L = s.wk.filter(q => q.m < k.m).pop(), Rr = s.wk.find(q => q.m > k.m); F(k.r.x > L.r.x && k.r.x + k.r.w < Rr.r.x + Rr.r.w, `${tag}: black ${k.m} not between its whites`); }
    F(s.wk.concat(s.bk).every(k => vis(k.r, w, h)), `${tag}: a key is off screen`);
    D.whiteKey = { w: s.wk[0].r.w, h: s.wk[0].r.h }; D.blackKey = { w: s.bk[0].r.w, h: s.bk[0].r.h };
    // rd2 (Uiux #1): the piano starts right under Play / Next (no empty band); on iPad portrait the white keys are tall (>= 262)
    const geo = await p.evaluate(() => { const r = s => document.querySelector(s).getBoundingClientRect(); return { ctlB: r('#kv .kv-play .kv-ctl').bottom, piaT: r('#kv .kv-piano').top, piaB: r('#kv .kv-piano').bottom, port: document.documentElement.classList.contains('lay-pad-port') }; });
    D.pianoGap = Math.round(geo.piaT - geo.ctlB); F(D.pianoGap >= 0 && D.pianoGap <= 24, `${tag}: ${D.pianoGap}px gap between Play / Next and the piano`);
    F(geo.piaB >= h - 40, `${tag}: the piano stops ${Math.round(h - geo.piaB)}px above the bottom`);
    if (geo.port) F(s.wk[0].r.h >= 262, `${tag}: iPad portrait white keys only ${s.wk[0].r.h}px tall`);
    // rd2 (Uiux #2): every lyric word is readable (>= 4.5:1 on the lyric card, no see-through fade); the current word sits on gold
    const lyr = await p.evaluate(() => { const lum = c => { const m = c.match(/[\d.]+/g).map(Number); const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(m[0]) + .7152 * f(m[1]) + .0722 * f(m[2]); };
      const card = document.querySelector('#kv .kv-lyr'), bg = lum(getComputedStyle(card).backgroundColor);
      return [...card.querySelectorAll('.kv-l1 span, .kv-l2')].filter(e => e.textContent.trim()).map(e => { let o = 1; for (let n = e; n && n !== card; n = n.parentElement) o *= +getComputedStyle(n).opacity;
        const st = getComputedStyle(e), now = e.classList.contains('now'), b2 = now ? lum(st.backgroundColor) : bg, fg = lum(st.color), cr = (Math.max(fg, b2) + .05) / (Math.min(fg, b2) + .05);
        return { t: e.textContent.trim().slice(0, 16), cls: e.className, o, cr: +cr.toFixed(2), gold: now ? st.backgroundColor : null }; }); });
    D.lyrics = lyr; F(lyr.length > 0, `${tag}: no lyric words`);
    for (const x of lyr) F(x.o >= 0.99 && x.cr >= 4.5, `${tag}: lyric "${x.t}" (${x.cls}) hard to read: contrast ${x.cr}, opacity ${x.o}`);
    for (const x of lyr.filter(q => q.cls === 'now')) F(x.gold === 'rgb(255, 194, 26)', `${tag}: current word not on gold (${x.gold})`);
    const keyRects = JSON.stringify(s.wk.concat(s.bk).map(k => k.r)), kbWin0 = s.kbWin;
    // 4. rd17: no Happy / Sad. Every free pad is the major kidTriad (root lowest). The gold pad is still the melody note, not a chord.
    const moodGone = await p.evaluate(() => ({ ui: document.querySelectorAll('#kv .kv-mood, #kv .kv-md, #kv .kv-f').length, mood: Object.prototype.hasOwnProperty.call(__kv.kv, 'mood'), faces: [...document.querySelectorAll('#kv .kv-pad')].some(e => /happy|sad/i.test(e.getAttribute('aria-label') || '')) }));
    F(!moodGone.ui && !moodGone.mood && !moodGone.faces, `${tag}: Kids mood still present ${JSON.stringify(moodGone)}`);
    const padSnd = {};
    await take(p);
    for (const q of s.pads) { const pos0 = (await st(p)).pos; await touch(q.r.x + q.r.w / 2, q.r.y + q.r.h / 2, 150); await p.waitForTimeout(250); const L = await take(p); const m = (L.find(x => x.m.length >= 3) || {}).m || [];
      if ((await st(p)).pos !== pos0) { padSnd[q.l] = 'gold'; continue; }
      padSnd[q.l] = m; const rel = m.map(x => x - m[0]);
      F(m.length >= 3 && w12(m[0]) === q.pc, `${tag}: pad ${q.l} lowest note ${m[0]} (pc ${w12(m[0])}), want the root ${q.pc}`);
      F(rel.includes(4) && rel.includes(7) && !rel.includes(3), `${tag}: pad ${q.l} not a major triad ${m}`); }
    D.pads = padSnd;
    // Expert minor (key + a real minor chip) must not make a Kids pad or a non-gold Kids key minor.
    // The assertion is the notes that sounded. state.type is allowed to stay whatever Simple / Expert last set,
    // so a Kids key does not have to overwrite it. Simple's own Major / Minor control must still flip.
    // A missed mode-sheet control is recorded here and Kids is put back on the play screen before the melody walk,
    // so a covered button is not counted again as hundreds of gold-key failures.
    if (w === 360) {
      const major = m => { const rel = m.map(x => x - m[0]); return m.length >= 3 && rel.includes(4) && rel.includes(7) && !rel.includes(3); };
      await holdChip(); await tapEl('#msMode button[data-mode="expert"]'); await p.waitForTimeout(500);
      await tapEl('#xKey'); await p.waitForTimeout(200); await tapEl('#xKeySheet [data-km="minor"]'); await p.waitForTimeout(250);
      await tapEl('#xKeySheet .x-close'); await p.waitForTimeout(200);
      await take(p);
      const minorChip = await p.evaluate(() => { const b = document.querySelector('#suggest .ss-chip.minor'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width }; });
      if (minorChip && minorChip.w > 0) { await touch(minorChip.x, minorChip.y, 150); await p.waitForTimeout(250); }
      const expertHeard = ((await take(p)).find(x => x.m.length >= 3) || {}).m || [];
      const expertRel = expertHeard.map(x => x - expertHeard[0]);
      F(expertRel.includes(3) && !expertRel.includes(4), `${tag}: Expert minor chip did not sound a minor triad ${expertHeard}`);
      await tapEl('#xModeChip'); await p.waitForTimeout(250); await tapEl('#msMode button[data-mode="kids"]'); await p.waitForTimeout(500);
      s = await st(p);
      if (!(s.on && s.screen === 'play')) {
        F(false, `${tag}: mode sheet did not return to Kids (on ${s.on} screen ${s.screen}); melody walk continues from a restored Kids play screen`);
        await p.evaluate(() => { if (window.__kv && __kv.setExpert) __kv.setExpert(false); if (window.__kv) __kv.show('play'); });
        await p.waitForTimeout(400); s = await st(p);
      } else {
        const wk = s.wk.find(k => !(s.gold[0] && s.gold[0].m === k.m)) || s.wk[0];
        if (wk) { await take(p); await touch(wk.r.x + wk.r.w / 2, wk.r.y + wk.r.h * 0.85, 140); await p.waitForTimeout(200);
          const km = ((await take(p)).find(x => x.m.length >= 1) || {}).m || [];
          F(major(km), `${tag}: Kids key inherited Expert minor ${km}`); }
        const d = s.pads.find(q => q.l === 'D' && !q.gold) || s.pads.find(q => !q.gold);
        F(!!d, `${tag}: no free pad after returning from minor Expert`);
        if (d) { await take(p); await touch(d.r.x + d.r.w / 2, d.r.y + d.r.h / 2, 150); await p.waitForTimeout(250);
          const m = ((await take(p)).find(x => x.m.length >= 3) || {}).m || [];
          F(major(m) && w12(m[0]) === d.pc, `${tag}: Kids pad inherited Expert minor ${m}`); }
      }
      await holdChip(); await tapEl('#msMode button[data-mode="simple"]'); await p.waitForTimeout(500);
      const sim = await p.evaluate(() => {
        const b = document.querySelector('#kidKey .kk-mode');
        const before = b ? b.getAttribute('aria-label') : null;
        if (b) b.click();
        const after = b ? b.getAttribute('aria-label') : null;
        return { gone: !document.querySelector('#kv .kv-mood'), before, after, kids: document.documentElement.classList.contains('kv') };
      });
      const flipped = sim.before && sim.after && sim.before !== sim.after && /major|minor/i.test(sim.after);
      F(!sim.kids && flipped, `${tag}: Simple Major/Minor did not stay its own control (${JSON.stringify(sim)})`);
      await tapEl('#modeChip'); await p.waitForTimeout(200); await tapEl('#msMode button[data-mode="kids"]'); await p.waitForTimeout(500);
      if (!(await st(p)).on) { await p.evaluate(() => { if (window.__kv && __kv.setExpert) __kv.setExpert(false); if (window.__kv) __kv.show('play'); }); await p.waitForTimeout(300); }
    }
    // 5. reload Twinkle fresh, then every song: gold walk
    D.songs = {};
    for (const name of TEN) {
      if ((await st(p)).reward) await tapEl('#kv .kv-again');
      await p.evaluate(n => { const i = __prog.list.findIndex(q => q.name === n); __progApi.set(i); __kv.show('play'); }, name); await p.waitForTimeout(350); await take(p);
      const mel = MEL[name], wantR = songRange(mel), E = D.songs[name] = { steps: mel.length, arrows: [], soundFails: 0 };
      s = await st(p);
      const songRects = JSON.stringify(s.wk.concat(s.bk).map(k => k.r));
      F(same(s.wk.map(k => k.m), wantR.wk) && same(s.bk.map(k => k.m), wantR.bk), `${tag} ${name}: key pitches ${s.wk.map(k => k.m)} / ${s.bk.map(k => k.m)}, want ${wantR.wk} / ${wantR.bk}`);
      F(s.wk.some(k => k.m === 60 && k.home), `${tag} ${name}: no home dot on C4`);
      for (let i = 0; i < mel.length; i++) {
        s = await st(p);
        F(JSON.stringify(s.wk.concat(s.bk).map(k => k.r)) === songRects, `${tag} ${name} step ${i}: the piano moved`);
        F(same(s.wk.map(k => k.m), wantR.wk), `${tag} ${name} step ${i}: key pitches changed`);
        F(s.kbWin === kbWin0, `${tag} ${name} step ${i}: hidden keyboard window moved ${kbWin0} -> ${s.kbWin}`);
        F(s.gold.length === 1, `${tag} ${name} step ${i}: ${s.gold.length} gold keys`);
        const g = s.gold[0]; if (!g) continue;
        F(vis(g.r, w, h) && g.star, `${tag} ${name} step ${i}: gold key not visible`);
        F(g.m === 60 + mel[i] && g.pc === w12(mel[i]), `${tag} ${name} step ${i}: gold key ${g.m} pc ${g.pc}, melody @${mel[i]}`);
        F(!g.up && !g.down && !g.arrowShown, `${tag} ${name} step ${i}: unexpected shift arrow for @${mel[i]}`);
        await touch(g.r.x + g.r.w / 2, g.r.y + g.r.h * (s.wk.some(k => k.m === g.m) ? 0.85 : 0.5), 120); await p.waitForTimeout(140);
        const L = await take(p), hit = L.some(x => x.m.includes(60 + mel[i]));
        if (!hit) { E.soundFails++; R.fails.push(`${tag} ${name} step ${i}: gold tap did not sound ${60 + mel[i]} (heard ${JSON.stringify(L.map(x => x.m))})`); }
        if (i < mel.length - 1) { const s2 = await st(p); F(!s2.reward, `${tag} ${name} step ${i}: reward too early`); }
      }
      await p.waitForTimeout(1100); s = await st(p); F(s.reward, `${tag} ${name}: no reward after the last gold tap`);
      if (name === 'Kids Twinkle') await shot('reward');
      F(!E.arrows.length, `${tag} ${name}: unexpected shift arrows ${JSON.stringify(E.arrows)}`);
    }
    // 6. reward after Next on the last step, and after Play song's last step
    if ((await st(p)).reward) await tapEl('#kv .kv-again');
    await p.evaluate(() => { __progApi.set(__prog.list.findIndex(q => q.name === "Kids Mary's Lamb")); __kv.show('play'); }); await p.waitForTimeout(300);
    s = await st(p); for (let i = 0; i < s.n - 1; i++) await p.evaluate(() => document.querySelector('#kv .kv-next').click());
    F(!(await st(p)).reward, `${tag}: reward before the last Next`);
    await tapEl('#kv .kv-ctl .kv-next'); await p.waitForTimeout(1100); F((await st(p)).reward, `${tag}: no reward after Next on the last step`);
    await tapEl('#kv .kv-again'); await p.waitForTimeout(250); s = await st(p); F(!s.reward && s.pos === 0, `${tag}: Again did not restart (reward ${s.reward}, pos ${s.pos})`);
    for (let i = 0; i < s.n - 3; i++) await p.evaluate(() => document.querySelector('#kv .kv-next').click());
    await tapEl('#kv .kv-playbtn'); await p.waitForTimeout(200); F((await st(p)).playing, `${tag}: Play song did not start`);
    let t0 = Date.now(); while (Date.now() - t0 < 9000 && !(await st(p)).reward) await p.waitForTimeout(100);
    s = await st(p); F(s.reward && !s.playing, `${tag}: Play song end: reward ${s.reward}, still playing ${s.playing}`); D.playEndMs = Date.now() - t0;
    await tapEl('#kv .kv-again'); await p.waitForTimeout(200);
    // 7. Simple -> Expert -> Simple resume
    await p.evaluate(() => { __progApi.set(__prog.list.findIndex(q => q.name === 'Kids Old MacDonald')); __kv.show('play'); }); await p.waitForTimeout(250);
    for (let i = 0; i < 7; i++) await p.evaluate(() => document.querySelector('#kv .kv-next').click());
    await p.waitForTimeout(300); const before = await st(p);
    await holdChip(); await p.waitForTimeout(100); await shot('settings');
    // redesign-dev: one Kids / Simple / Expert switch. Expert = the Expert screen (it plays the grown-up styles, so it
    // leaves the Kids style); Kids from the Expert settings comes back to the Kids song at the same step.
    F(await p.evaluate(() => document.querySelectorAll('#msMode button').length === 3 && !document.getElementById('modeSheet').hidden), `${tag}: Kids view mode switch is not Kids / Simple / Expert`);
    await tapEl('#msMode button[data-mode="expert"]'); await p.waitForTimeout(500); s = await st(p);
    F(!s.on && s.app !== 'none' && await p.evaluate(() => document.documentElement.classList.contains('expert')), `${tag}: Expert did not open the Expert screen`);
    await p.evaluate(() => __progApi.next()); await p.waitForTimeout(200);
    await tapEl('#xModeChip'); await p.waitForTimeout(250); await tapEl('#msMode button[data-mode="kids"]'); await p.waitForTimeout(500); s = await st(p);
    F(s.on && s.app === 'none' && s.screen === 'play' && s.song === before.song && s.pos === before.pos, `${tag}: back to Kids: on ${s.on} screen ${s.screen} ${s.song} @${s.pos} (want ${before.song} @${before.pos})`);
    // 8. Play along off: gold marks hide, Next / Play song still move on
    await holdChip(); await tapEl('#msPlayAlong'); await p.waitForTimeout(250); await tapEl('#modeSheet .ms-x'); await p.waitForTimeout(200);
    s = await st(p); F(s.paOff && await p.evaluate(() => document.documentElement.classList.contains('pa-off')), `${tag}: Play along off not set (kv ${s.paOff})`);
    F(s.gold.every(g => !g.star && !g.arrowShown) && !(await p.evaluate(() => [...document.querySelectorAll('#kv .kv-pad.gold')].some(e => getComputedStyle(e).outlineStyle !== 'none' && parseFloat(getComputedStyle(e).outlineWidth) > 0))), `${tag}: gold marks still shown with Play along off`);
    await shot('pa-off');
    const p0 = s.pos; await tapEl('#kv .kv-ctl .kv-next'); await p.waitForTimeout(250); F((await st(p)).pos === p0 + 1, `${tag}: Next did not advance with Play along off`);
    await take(p); await tapEl('#kv .kv-playbtn'); await p.waitForTimeout(1500); s = await st(p); const pl = await take(p);
    F(s.playing && pl.length > 0, `${tag}: Play song did not play with Play along off`); await tapEl('#kv .kv-playbtn'); await p.waitForTimeout(250);
    await holdChip(); await tapEl('#msPlayAlong'); await p.waitForTimeout(200); await tapEl('#modeSheet .ms-x'); await p.waitForTimeout(200);
    F(!(await st(p)).paOff, `${tag}: Play along did not come back on`);
    // 9. theme persists
    const dayBg = (await st(p)).bg;
    await holdChip(); await tapEl('#msLook button[data-look="lamp"]'); await p.waitForTimeout(300); await tapEl('#modeSheet .ms-x');
    await p.reload(); await p.waitForTimeout(1300); await rec(p); s = await st(p);
    F(s.lamp && s.on && s.bg !== dayBg, `${tag}: Lamplight lost on reload (lamp ${s.lamp}, bg ${s.bg} vs ${dayBg})`);
    F(s.screen === 'hello', `${tag}: reload did not start at Hello`);
    await tapEl('#kv .kv-go'); await p.waitForTimeout(300); s = await st(p); F(s.screen === 'play' && s.song === 'Kids Old MacDonald', `${tag}: Hello after reload did not resume the last song (${s.screen} ${s.song})`);
    await shot('lamp');
    await holdChip(); await tapEl('#msLook button[data-look="day"]'); await p.waitForTimeout(300); await tapEl('#modeSheet .ms-x');
    await p.reload(); await p.waitForTimeout(1300); s = await st(p); F(!s.lamp && s.bg === dayBg, `${tag}: Daylight lost on reload`);
    // 10. Simple / Expert persists
    await p.evaluate(() => __kv.setExpert(true)); await p.waitForTimeout(400); await p.reload(); await p.waitForTimeout(1300); s = await st(p);
    F(!s.on && s.app !== 'none' && !(await p.evaluate(() => document.documentElement.classList.contains('kv'))), `${tag}: Expert lost on reload`);
    F(await p.evaluate(() => JSON.parse(localStorage.getItem('touchChord.settings.v1')).settings.expert === true), `${tag}: expert not saved`);
    await tapEl('#xModeChip'); await p.waitForTimeout(250); await tapEl('#msMode button[data-mode="kids"]'); await p.waitForTimeout(400); await p.reload(); await p.waitForTimeout(1300); s = await st(p);
    F(s.on && s.app === 'none', `${tag}: Simple lost on reload`);
    // 11. rd2 (Noff rd1 Low): hold a pad, switch to Simple with another finger, lift on the new screen: no chord from the
    // lift (351c02c: silent), and the held pad's own release still runs
    await p.evaluate(() => { const g = document.querySelector('#kv .kv-go'); if (g && g.getClientRects().length) g.click(); }); await p.waitForTimeout(400);
    if ((await st(p)).screen !== 'play') { await p.evaluate(() => __kv.show('play')); await p.waitForTimeout(300); }
    await rec(p); await p.evaluate(() => { const A = window.ChordAudio; window.__S = 0; if (A.__kvs) return; A.__kvs = 1; const sc = A.stopChord.bind(A); A.stopChord = function () { window.__S++; return sc.apply(null, arguments); }; });
    const fr = await p.evaluate(() => { const e = [...document.querySelectorAll('#kv .kv-pad')].find(x => x.textContent.trim().startsWith('F')); const q = e.getBoundingClientRect(); return { x: q.x + q.width / 2, y: q.y + q.height / 2 }; });
    await take(p); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: fr.x, y: fr.y, id: 7 }] }); await p.waitForTimeout(300);
    const held = await take(p); F(held.length >= 1, `${tag}: holding F made no sound`);
    await p.evaluate(() => document.querySelector('#msMode [data-mode="simple"]').click()); await p.waitForTimeout(500);
    D.staleUnder = await p.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? (e.closest('.ss-chip, .ss-note, button') || e).textContent.trim().slice(0, 12) : null; }, [fr.x, fr.y]);
    F(await p.evaluate(() => document.documentElement.classList.contains('simple') && !document.documentElement.classList.contains('kv')), `${tag}: Simple did not open`);
    const s0 = await p.evaluate(() => window.__S);
    // rd3 (Noff rd2 Low): slide the pre-switch finger first, then lift
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: fr.x + 24, y: fr.y + 18, id: 7 }] }); await p.waitForTimeout(120);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(30);
    // rd3: right after the lift (no time window any more) Next works by keyboard and by a synthetic click (no pointer id)
    const nx0 = await p.evaluate(() => { const n = document.querySelector('#prog .pg-step'); window.__nxSel = !!(n && n.getClientRects().length); return { vis: window.__nxSel, cur: __prog.cur, magic: __magic.state.pos }; });
    F(nx0.vis, `${tag}: no visible Next (#prog .pg-step) on Simple`);
    await p.evaluate(() => { window.__stale0 = Object.assign({}, window.__xLog || {}); document.querySelector('#prog .pg-step').focus(); });
    await take(p); await p.keyboard.press('Enter'); await p.waitForTimeout(250);
    const kNext = await take(p), nx1 = await p.evaluate(() => ({ cur: __prog.cur, magic: __magic.state.pos }));
    F(kNext.length >= 1 && JSON.stringify(nx1) !== JSON.stringify({ cur: nx0.cur, magic: nx0.magic }), `${tag}: Next by keyboard right after the stale lift did nothing (${JSON.stringify(nx0)} -> ${JSON.stringify(nx1)}, ${kNext.length} sounds)`);
    await p.evaluate(() => document.querySelector('#prog .pg-step').click()); await p.waitForTimeout(250);
    const cNext = await take(p), nx2 = await p.evaluate(() => ({ cur: __prog.cur, magic: __magic.state.pos }));
    F(cNext.length >= 1 && JSON.stringify(nx2) !== JSON.stringify(nx1), `${tag}: Next by a synthetic click right after the stale lift did nothing (${JSON.stringify(nx1)} -> ${JSON.stringify(nx2)}, ${cNext.length} sounds)`);
    D.staleNext = { key: kNext.length, click: cNext.length, cur: [nx0, nx1, nx2] };
    await p.waitForTimeout(600);
    const lift = await take(p), s1 = await p.evaluate(() => window.__S);
    D.staleLift = { under: D.staleUnder, played: lift, stops: s1 - s0 };
    F(lift.length === 0, `${tag}: lifting the pre-switch finger on "${D.staleUnder}" played ${JSON.stringify(lift)}`);
    F(s1 > s0, `${tag}: the held pad was not released on lift`);
    F(!p.__errs.length, `${tag}: page errors ${p.__errs.slice(0, 3)}`); D.errs = p.__errs.slice(0, 5);
    await p.context().close();
    // 12. rd3 (Noff rd2 Low 3): Kids Twinkle, out-of-key black keys are silent, the very first tap and every later one
    {
      const q = await open(b, w, h); const cq = await q.context().newCDPSession(q);
      const tq = async (x, y) => { await cq.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); await q.waitForTimeout(120); await cq.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await q.waitForTimeout(200); };
      const at = sel => q.evaluate(s => { const e = document.querySelector(s); if (!e || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height * 0.4]; }, sel);
      let r0 = await at('#kv .kv-go'); if (r0) { await tq(...r0); await q.waitForTimeout(250); }
      r0 = await at('#kv .kv-card[data-song="Kids Twinkle"]'); if (r0) { await tq(...r0); await q.waitForTimeout(400); }
      F((await st(q)).screen === 'play', `${tag}: black keys: Twinkle did not open`);
      await take(q); const bl = [];
      for (const round of [0, 1]) for (const pc of [1, 3, 6, 8, 10]) { const xy = await at(`#kv .kv-bk[data-pc="${pc}"]`); if (!xy) { F(false, `${tag}: no black key ${pc}`); continue; } await tq(...xy); const L = await take(q); bl.push([pc, L.length]);
        F(L.length === 0, `${tag}: ${round || pc !== 1 ? 'later' : 'first'} black key tap (pc ${pc}, round ${round + 1}) sounded ${JSON.stringify(L)}`); }
      const wxy = await at('#kv .kv-wk[data-pc="0"]'); if (wxy) { await tq(...wxy); F((await take(q)).length >= 1, `${tag}: white key C after the black keys made no sound`); }
      const xy1 = await at('#kv .kv-bk[data-pc="1"]'); if (xy1) { await tq(...xy1); F((await take(q)).length === 0, `${tag}: black key after a white key sounded`); }
      D.blackKeys = bl; F(!q.__errs.length, `${tag}: black keys: page errors ${q.__errs.slice(0, 3)}`);
      await q.context().close();
    }
  }
  await b.close();
  fs.writeFileSync(path.join(OUT, 'kidsview.json'), JSON.stringify(R, null, 1));
  console.log(R.fails.length ? 'FAIL ' + R.fails.length + '\n' + R.fails.slice(0, 40).join('\n') : 'PASS', JSON.stringify(Object.fromEntries(Object.entries(R.data).map(([k, v]) => [k, { white: v.whiteKey, black: v.blackKey, playEndMs: v.playEndMs }]))));
})();
