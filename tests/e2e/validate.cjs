// Pre-save validation in the Upload dialog (js/songs/validate.js), 360x780 + 780x360:
// bad AI data (out-of-key Bb, a short bar, 200 BPM) -> #upVal lists flags grouped by layer and nothing is saved;
// Go back and fix -> panel gone, dialog open, paste kept, still nothing saved; Save anyway -> saved and loaded;
// clean data -> no panel, saved straight away. No console errors, no horizontal overflow.
const { chromium } = require('playwright-core'); const fs = require('fs'); const path = require('path');
const URL = process.env.URL || (process.env.BASE || 'http://localhost:8080/index.html');
const SH = process.env.VSHOTS || ((process.env.SHOTS || '/tmp/tc-shots') + '/validate'); fs.mkdirSync(SH, { recursive: true });
const R = { fails: [], info: {} }; const F = (c, m) => { if (!c) R.fails.push(m); };
const ch = (chord, bar, beat, d, i) => ({ index: i, chord, position: { bar, beat }, durationBeats: d, confidence: 0.9 });
const mk = (title, bpm, chords) => JSON.stringify({ contractVersion: '1.2', song: { title, artist: 'Validate Test', key: { tonic: 'C', mode: 'major' } }, timing: { bpm, timeSignature: '4/4' },
  sections: [{ id: 'verse1', type: 'verse', chords: chords.map((c, i) => ch(...c, i)) }] });
const BAD = mk('Bad Data Song', 200, [['C', 1, 1, 4], ['Bb', 2, 1, 4], ['F', 3, 1, 3]]);
const GOOD = mk('Good Data Song', 96, [['C', 1, 1, 4], ['F', 2, 1, 2], ['G7', 2, 3, 2], ['Am', 3, 1, 4]]);
(async () => { const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  for (const [w, h] of [[360, 780], [780, 360]]) { const tag = `${w}x${h}`;
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    await ctx.addInitScript(`try{if(!sessionStorage.getItem('x')){sessionStorage.setItem('x',1);localStorage.clear();localStorage.setItem('touchChord.settings.v1',JSON.stringify({v:1,settings:{simple:false,tourDone:true}}));}}catch(e){}`);
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push('' + e)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto(URL + '?test=1'); await p.waitForTimeout(1000);
    await p.evaluate(() => { const t = document.getElementById('tour'); if (t && !t.hidden) { const x = t.querySelector('button[class*=x], .tr-skip'); if (x) x.click(); } });
    const libN = () => p.evaluate(() => { try { return (JSON.parse(localStorage.getItem('touchChord.library.v1')) || { songs: [] }).songs.length; } catch (e) { return -1; } });
    const n0 = await libN();
    await p.click('#uploadBtn'); await p.waitForTimeout(300);
    await p.fill('#upPaste', BAD); await p.click('#upLoad'); await p.waitForTimeout(300);
    const v = await p.evaluate(() => { const e = document.getElementById('upVal'); const r = e.getBoundingClientRect(); const box = document.querySelector('#uploadPick .kp-box');
      return { shown: !e.hidden && r.height > 0, layers: [...e.querySelectorAll('.uv-g')].map(g => g.dataset.layer), text: e.innerText,
        btns: [...e.querySelectorAll('button')].map(x => x.textContent), over: box.scrollWidth - box.clientWidth, docOver: document.documentElement.scrollWidth - innerWidth,
        inView: r.left >= 0 && r.right <= innerWidth, msg: !document.getElementById('upMsg').hidden }; });
    R.info[tag] = v;
    F(v.shown, tag + ' flags panel not shown'); F(JSON.stringify(v.layers) === '["key","timing","bpm"]', tag + ' layers ' + v.layers);
    F(/Bb is not in C major/.test(v.text), tag + ' key message'); F(/bar 3: 1 beat missing/.test(v.text), tag + ' timing message'); F(/200 BPM/.test(v.text), tag + ' bpm message');
    F(JSON.stringify(v.btns) === '["Go back and fix","Save anyway"]', tag + ' buttons ' + v.btns);
    F(v.over <= 0 && v.docOver <= 0, tag + ' overflow ' + v.over + '/' + v.docOver); F(v.inView, tag + ' panel off screen'); F(!v.msg, tag + ' loaded message shown before choice');
    F(await libN() === n0, tag + ' saved before the choice');
    await p.evaluate(() => document.getElementById('upVal').scrollIntoView({ block: 'center' })); await p.waitForTimeout(150);
    await p.screenshot({ path: path.join(SH, `flags-${tag}.png`) });
    await p.click('#upValBack'); await p.waitForTimeout(200);
    const g = await p.evaluate(() => ({ val: document.getElementById('upVal').hidden, open: !document.getElementById('uploadPick').hidden, paste: document.getElementById('upPaste').value.length, focus: document.activeElement && document.activeElement.id }));
    F(g.val && g.open, tag + ' Go back: ' + JSON.stringify(g)); F(g.paste === BAD.length, tag + ' Go back lost the paste'); F(g.focus === 'upPaste', tag + ' Go back focus ' + g.focus);
    F(await libN() === n0, tag + ' Go back saved');
    await p.screenshot({ path: path.join(SH, `goback-${tag}.png`) });
    await p.click('#upLoad'); await p.waitForTimeout(300); await p.click('#upValSave'); await p.waitForTimeout(400);
    const s = await p.evaluate(() => ({ val: document.getElementById('upVal').hidden, msg: document.getElementById('upMsg').innerText, lib: (JSON.parse(localStorage.getItem('touchChord.library.v1')) || { songs: [] }).songs.map(x => x.title) }));
    F(s.val, tag + ' panel still shown after Save anyway'); F(s.lib.includes('Bad Data Song'), tag + ' Save anyway did not save ' + s.lib); F(/Loaded Bad Data Song/.test(s.msg), tag + ' msg ' + s.msg);
    await p.screenshot({ path: path.join(SH, `saved-${tag}.png`) });
    await p.fill('#upPaste', GOOD); await p.click('#upLoad'); await p.waitForTimeout(400);
    const c = await p.evaluate(() => ({ val: document.getElementById('upVal').hidden, lib: (JSON.parse(localStorage.getItem('touchChord.library.v1')) || { songs: [] }).songs.map(x => x.title) }));
    F(c.val, tag + ' clean data showed flags'); F(c.lib.includes('Good Data Song'), tag + ' clean data not saved');
    F(!errs.length, tag + ' console ' + errs);
    await ctx.close(); }
  await b.close();
  fs.writeFileSync(path.join(process.env.OUT || '/tmp', 'validate.json'), JSON.stringify(R, null, 1)); console.log(JSON.stringify(R.fails)); process.exit(R.fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
