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
// v112.13 read-as song (key C): [input, pitch classes it must play, root first]
const RA = [['C', [0, 4, 7]], ['Caug', [0, 4, 8]], ['F', [5, 9, 0]], ['Gaug7', [7, 11, 3, 5]], ['AmMaj7', [9, 0, 4, 8]], ['CmMaj7', [0, 3, 7, 11]], ['CMaj7', [0, 4, 7, 11]],
  ['CMa7', [0, 4, 7, 11]], ['C\u00f89', [0, 3, 6, 10, 2]], ['C-5', [0, 4, 6]], ['C+7', [0, 4, 8, 10]], ['Cm(Maj7)', [0, 3, 7, 11]], ['Bb', [10, 2, 5]], ['G', [7, 11, 2]]];   // Bb: out of C major, so Check before saving opens
const READAS = RA.map(x => x[0]), READAS_PCS = RA.map(x => x[1]);
const READAS_TIDY = ['AmMaj7', 'CmMaj7', 'CMaj7', 'CMa7', 'C\u00f89', 'C-5', 'C+7', 'Cm(Maj7)'];   // the ones that get a "read as" note (Caug, Gaug7 are native)
const READAS_JSON = JSON.stringify({ contractVersion: '1.2', song: { title: 'Read As Test', artist: 'Upload13', key: { tonic: 'C', mode: 'major' } }, timing: { bpm: 100, timeSignature: '4/4' },
  sections: [{ id: 'v', type: 'verse', chords: READAS.map((c, i) => ({ index: i, chord: c, position: { bar: i + 1, beat: 1 }, durationBeats: 4, confidence: 0.9 })) }] });
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
    F(JSON.stringify(sp) === JSON.stringify(['C', 'C6add9', 'CmM7', 'Bm7b5', 'Bdim7', 'Gaug', 'G7#9', 'Bb', 'F#m', 'Dsus4', 'D7sus2', 'Dm7', 'Fmaj7', 'Fmaj7', 'Fmaj7', 'G7b9']), tag + ' spelling ' + sp);
    // 6. v112.13 read-as: every note shown (grouped) in the Check-before-saving panel and after Save; aug / mMaj7 /
    // CMaj7 / ø9 / C-5 play the right notes (root lowest)
    await p.evaluate(() => { const x = document.querySelector('#uploadPick .up-x'); if (x && !document.getElementById('uploadPick').hidden) x.click(); }); await p.waitForTimeout(300);
    await p.click('#uploadBtn'); await p.waitForTimeout(300);
    await p.fill('#upPaste', READAS_JSON); await p.click('#upLoad'); await p.waitForTimeout(600);
    const pv = await p.evaluate(() => { const v = document.getElementById('upVal'), g = v.querySelector('.uv-g[data-layer="chords"]');
      return { shown: !v.hidden, n: g ? g.querySelectorAll('li').length : 0, text: g ? g.innerText : '', over: document.documentElement.scrollWidth - innerWidth }; });
    I.readAsPanel = pv;
    F(pv.shown && pv.n === READAS_TIDY.length, tag + ' read-as notes in Check before saving: ' + pv.n + ' ' + pv.text);
    for (const k of READAS_TIDY) F(pv.text.indexOf(k) >= 0, tag + ' panel misses ' + k);
    F(pv.over <= 0, tag + ' panel overflow ' + pv.over);
    await p.evaluate(() => document.getElementById('upVal').scrollIntoView({ block: 'center' })); await p.waitForTimeout(150);
    await p.screenshot({ path: path.join(SH, `v11213-panel-${tag}.png`) });
    if (pv.shown) { await p.click('#upValSave'); await p.waitForTimeout(600); }
    const pm = await p.evaluate(() => { const e = document.getElementById('upMsg'), n = e.querySelector('[data-notes="chords"]');
      return { shown: !e.hidden, text: e.innerText, notes: n ? n.innerText : '', over: document.documentElement.scrollWidth - innerWidth }; });
    I.readAsMsg = pm.text;
    F(pm.shown && new RegExp('Chords read as \\(' + READAS_TIDY.length + '\\)').test(pm.notes), tag + ' read-as notes after Save: ' + pm.notes);
    for (const k of READAS_TIDY) F(pm.notes.indexOf(k) >= 0, tag + ' message misses ' + k);
    F(!/augmented is played as a major|Cb5|C\u266d5/.test(pm.text), tag + ' misleading note: ' + pm.text);
    await p.evaluate(() => document.getElementById('upMsg').scrollIntoView({ block: 'center' })); await p.waitForTimeout(150);
    await p.screenshot({ path: path.join(SH, `v11213-notes-${tag}.png`) });
    await p.evaluate(() => { const x = document.querySelector('#uploadPick .up-x'); if (x) x.click(); }); await p.waitForTimeout(400);
    await p.evaluate(() => { const A = window.ChordAudio; window.__A = []; const f = A.playChord.bind(A); A.playChord = function (g, m, o) { window.__A.push(Array.isArray(m) ? m.slice() : m); return f(g, m, o); }; });
    const heard = {};
    for (let i = 0; i < READAS_PCS.length + 1; i++) { await p.evaluate(() => { window.__A = []; }); await p.tap('#prog .pg-step'); await p.waitForTimeout(200);
      const h = await p.evaluate(() => ({ i: __prog.cur, m: window.__A[window.__A.length - 1] || null })); if (h.m && h.i >= 0) heard[h.i] = h.m; }
    I.readAsHeard = heard;
    READAS_PCS.forEach((want, i) => { const m = heard[i]; if (!m) { F(false, tag + ' step ' + i + ' not heard'); return; }
      const got = [...new Set(m.map(x => x % 12))].sort((a, b) => a - b).join(','), w = [...new Set(want)].sort((a, b) => a - b).join(',');
      F(got === w, tag + ' ' + READAS[i] + ' plays ' + got + ', want ' + w);
      F(m[0] % 12 === want[0] && m.every((x, k) => !k || x > m[k - 1]), tag + ' ' + READAS[i] + ' not root lowest / rising: ' + m); });
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
