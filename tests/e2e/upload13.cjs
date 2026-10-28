// v112.12 Song Contract v1.3 upload, 360x780 + 780x360 (DPR 3, touch via emulate.cjs):
// Noff's v1.3 answer (pretty + minified) pasted in the Upload dialog loads with the gentle length warning (+8%)
// shown in the dialog; the song plays its form in order (Simple and Full cover the same bars, lyrics map, Next
// walks the steps, the song bar shows it); v1.2 samples, diag samples, chord-spelling and JSON-repair answers
// load; an unknown contract version and a cut-off answer get honest messages. No console errors, no overflow.
const { chromium } = require('playwright-core'); const fs = require('fs'); const path = require('path');
const URL = process.env.URL || (process.env.BASE || 'http://localhost:8080/index.html');
const SH = process.env.V13SHOTS || ((process.env.SHOTS || '/tmp/tc-shots') + '/upload13'); fs.mkdirSync(SH, { recursive: true });
const FX = path.join(__dirname, '../fixtures/upload'); const fx = f => fs.readFileSync(path.join(FX, f), 'utf8');
const R = { fails: [], info: {} }; const F = (c, m) => { if (!c) R.fails.push(m); };
const SPELL = JSON.stringify({ contractVersion: '1.2', song: { title: 'Spelling Test', artist: 'Upload13', key: { tonic: 'C', mode: 'major' } }, timing: { bpm: 100, timeSignature: '4/4' },
  sections: [{ id: 'v', type: 'verse', chords: ['C', 'C6/9', 'Cm(maj7)', 'Bø7', 'B°7', 'G+', 'G7alt', 'B♭', 'F♯m', 'Dsus', 'D7sus2', 'D-7', 'FΔ7', 'N.C.', 'unknown', 'G7(b9)'].map((c, i) => ({ index: i, chord: c, position: { bar: i + 1, beat: 1 }, durationBeats: 4, confidence: 0.8 })) }] });
const REPAIR = fx('diag-v12-single.json').replace(/"title": "([^"]*)"/, '"title": "Repair Test"').replace(/"/g, (m, i) => (i % 2 ? '\u201c' : '\u201d')).replace(/\n {2}/g, '\n\u00a0\u00a0').replace(/\}(\s*)\]/g, '},$1]');
(async () => { const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  for (const [w, h] of [[360, 780], [780, 360]]) { const tag = `${w}x${h}`; const I = R.info[tag] = {};
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    await ctx.addInitScript(`try{if(!sessionStorage.getItem('x')){sessionStorage.setItem('x',1);localStorage.clear();localStorage.setItem('touchChord.tour.v1','done');localStorage.setItem('touchChord.settings.v1',JSON.stringify({v:1,settings:{simple:false,tourDone:true}}));}}catch(e){}`);
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push('' + e)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto(URL + '?test=1'); await p.waitForTimeout(1000);
    await p.evaluate(() => { const t = document.getElementById('tour'); if (t && !t.hidden) { const x = t.querySelector('button[class*=x], .tr-skip'); if (x) x.click(); } });
    // 1. the in-app prompt is the v1.3 prompt, with the v1.3 schema
    const pr = await p.evaluate(() => ({ prompt: __upload.promptFor('artist'), copy: __upload.copyText ? __upload.copyText() : '' }));
    F(/Song List Contract v1\.3/.test(pr.prompt) && /Bar-sum check/.test(pr.prompt), tag + ' prompt is not v1.3');
    F(/"const":"1\.3"/.test(pr.copy) && !/album/i.test(pr.copy), tag + ' copy text schema');
    // 2. paste Noff's v1.3 answer in the dialog: the length warning is shown, nothing rejected
    await p.click('#uploadBtn'); await p.waitForTimeout(300);
    await p.fill('#upPaste', fx('noff-v13.json')); await p.click('#upLoad'); await p.waitForTimeout(500);
    if (await p.evaluate(() => !document.getElementById('upVal').hidden)) { I.flagsPanel = true; await p.click('#upValSave'); await p.waitForTimeout(500); }
    const m = await p.evaluate(() => { const e = document.getElementById('upMsg'), r = e.getBoundingClientRect(), box = document.querySelector('#uploadPick .kp-box');
      return { shown: !e.hidden && r.height > 0, text: e.innerText, err: document.getElementById('upErr').hidden ? '' : document.getElementById('upErr').innerText,
        over: box.scrollWidth - box.clientWidth, docOver: document.documentElement.scrollWidth - innerWidth }; });
    I.msg = m.text; F(m.shown && !m.err, tag + ' v1.3 not loaded: ' + m.err);
    F(/Length check: 62 bars at 71 BPM/.test(m.text) && /\+8\.0%/.test(m.text) && /still plays/.test(m.text), tag + ' length warning not shown: ' + m.text);
    F(m.over <= 0 && m.docOver <= 0, tag + ' overflow ' + m.over + '/' + m.docOver);
    await p.evaluate(() => document.getElementById('upMsg').scrollIntoView({ block: 'center' })); await p.waitForTimeout(150);
    await p.screenshot({ path: path.join(SH, `v13-warning-${tag}.png`) });
    // 3. the loaded song: form order, Simple/Full, lyrics, steps, song bar, Next
    await p.evaluate(() => { const x = document.querySelector('#uploadPick .up-x'); if (x) x.click(); }); await p.waitForTimeout(400);
    const src = JSON.parse(fx('noff-v13.json')).songs[0];
    const bars = src.form.reduce((a, id) => a + src.sections.find(s => s.id === id).bars.length, 0);
    const s = await p.evaluate(() => ({ song: __upload.song(), steps: __upload.steps(), lyr: __lyr2.map(), bar: (document.getElementById('songBar') || {}).innerText || '', barShown: !!document.getElementById('songBar') && !document.getElementById('songBar').hidden }));
    I.song = s.song; I.bar = s.bar;
    F(s.song && s.song.sections.length === src.form.length, tag + ' sections ' + (s.song && s.song.sections.join(',')));
    F(s.song && s.song.two, tag + ' no Full version');
    F(Math.abs(s.steps.reduce((a, x) => a + x.bars, 0) - bars) < 1e-6, tag + ' steps cover ' + s.steps.reduce((a, x) => a + x.bars, 0) + ' bars, form has ' + bars);
    F(s.steps.every(x => x.sym && x.sym.length), tag + ' an empty step');
    F(s.lyr && s.lyr.any, tag + ' lyrics not mapped');
    F(s.barShown && /^Intro/.test(s.bar) && /Verse 1/.test(s.bar), tag + ' song bar: ' + s.bar);   // the bar shows the form's sections in order
    const seen = []; for (let i = 0; i < 4; i++) { seen.push(await p.evaluate(() => __prog.idx)); await p.click('#prog .pg-next'); await p.waitForTimeout(250); }
    F(new Set(seen).size === 4, tag + ' Next did not walk the steps ' + seen);
    await p.screenshot({ path: path.join(SH, `v13-loaded-${tag}.png`) });
    const full = await p.evaluate(() => { const L = JSON.parse(localStorage.getItem('touchChord.library.v1')); const e = L.songs[L.songs.length - 1]; __upload.setVer(e.id, 'full'); return { song: __upload.song(), steps: __upload.steps() }; });
    F(full.song && full.song.ver === 'full' && full.song.sections.length === src.form.length, tag + ' Full ' + JSON.stringify(full.song && full.song.sections));
    F(Math.abs(full.steps.reduce((a, x) => a + x.bars, 0) - bars) < 1e-6, tag + ' Full steps cover ' + full.steps.reduce((a, x) => a + x.bars, 0));
    // 4. the other answers through the real loader
    const cases = { 'noff-v13.min': fx('noff-v13.min.json'), 'noff-v12': fx('noff-v12.json'), 'noff-v12.min': fx('noff-v12.min.json'),
      'diag-clean': fx('diag-v12-clean.json'), 'diag-single': fx('diag-v12-single.json'), 'diag-bare': fx('diag-bare-array.json'), 'diag-extras': fx('diag-v12-grok-extras.json'), 'diag-nulls': fx('diag-v12-nulls.json'),
      spelling: SPELL, repair: REPAIR };
    I.loads = {};
    for (const [k, t] of Object.entries(cases)) { const r = await p.evaluate(t => __upload.load(t), t); I.loads[k] = { ok: r.ok, warnings: r.warnings, rows: r.rows.map(x => x.status || 'ok'), errors: r.errors };
      F(r.ok && r.rows.every(x => !x.status || /^(new|loaded|updated)$/.test(x.status)), tag + ' ' + k + ' did not load: ' + JSON.stringify(r.errors || r.rows)); }
    const sp = await p.evaluate(() => { const L = JSON.parse(localStorage.getItem('touchChord.library.v1')); const e = L.songs.find(x => x.title === 'Spelling Test'); return e && e.song.sections[0].chords.map(c => c.chord); });
    F(JSON.stringify(sp) === JSON.stringify(['C', 'C6add9', 'Cm', 'Bm7b5', 'Bdim7', 'Gaug', 'G7#9', 'Bb', 'F#m', 'Dsus4', 'D7sus2', 'Dm7', 'Fmaj7', 'Fmaj7', 'Fmaj7', 'G7b9']), tag + ' spelling ' + sp);
    // 5. honest failures
    const bad = await p.evaluate(t => __upload.load(t), fx('diag-v12-clean.json').replace('"1.2"', '"2.0"'));
    F(!bad.ok && /can't read \(it reads 1\.2 and 1\.3\)/.test(JSON.stringify(bad.errors)), tag + ' version msg ' + JSON.stringify(bad.errors));
    const t0 = fx('noff-v13.json'), cut = await p.evaluate(t => __upload.load(t), t0.slice(0, Math.floor(t0.length * 0.5)));
    F(!cut.ok && /cut off/.test(JSON.stringify(cut.errors)), tag + ' cut-off msg ' + JSON.stringify(cut.errors));
    F(!errs.length, tag + ' console ' + errs);
    await ctx.close(); }
  await b.close();
  fs.writeFileSync(path.join(process.env.OUT || '/tmp', 'upload13.json'), JSON.stringify(R, null, 1)); console.log(JSON.stringify(R.fails)); process.exit(R.fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
