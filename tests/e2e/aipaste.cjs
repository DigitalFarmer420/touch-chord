// v3.2-ai-paste: AI answers (ChatGPT / Grok style) pasted for real (clipboard + Ctrl+V) in the Upload dialog
// and loaded with one tap: answers with one slip (a lyric mark past its line, beat 0, confidence 85, form id
// "chorus" for "chorus1", "C Major", Python quotes, unescaped quotes, "> " quoting, invisible characters, CRLF,
// two answers in one paste) load; the paste reaches the box unchanged; the first tap works before the audio is
// unlocked; a double tap on Load keeps "Loaded ..." (it used to show "(paste) is empty"); the upload fixtures
// still load; a chord sheet gets a plain message. No console errors.
const { chromium } = require('playwright-core'); const fs = require('fs'); const path = require('path'); const { pathToFileURL } = require('url');
const URL = process.env.URL || (process.env.BASE || 'http://localhost:8080/index.html');
const ORIGIN = new globalThis.URL(URL).origin;
const FX = path.join(__dirname, '../fixtures/upload'); const fx = f => fs.readFileSync(path.join(FX, f), 'utf8');
const R = { fails: [], info: { cases: [], races: {}, fixtures: [] } }; const F = (c, m) => { if (!c) R.fails.push(m); };
const LOAD = ['c-charindex-past-end', 'c-charindex-len-plus1', 'c-beat-0', 'c-beats-not-ascending', 'c-confidence-85', 'c-confidence-missing', 'c-form-id-mismatch', 'c-form-id-case',
  'c-timesig-prose', 'c-tonic-with-mode', 'c-key-string', 'c-artist-missing', 'c-cv-1.3.1', 'unicode-minus', 'double-flat-sharp', 'chord-55-C Major', 'alt-22-Am7(add11)', 'chord-64-C7 (x2)',
  'unescaped-inner-quotes', 'single-quotes-python', 'python-literals', 'unquoted-keys', 'blockquote', 'zwj-wordjoiner', 'zwsp-inside-key', 'crlf', 'nbsp-indent', 'bom-start', 'fence-json', 'chatgpt-copy-header2'];
(async () => {
  const CASES = Object.fromEntries((await import(pathToFileURL(path.join(__dirname, '../fixtures/aipaste/corpus.mjs')).href)).default.map(c => [c.id, c]));
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  async function fresh(vp) {
    const ctx = await b.newContext({ viewport: vp || { width: 360, height: 780 } });
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ORIGIN });
    await ctx.addInitScript(`try{if(!sessionStorage.getItem('x')){sessionStorage.setItem('x',1);localStorage.clear();localStorage.setItem('touchChord.tour.v1','done');localStorage.setItem('touchChord.settings.v1',JSON.stringify({v:1,settings:{simple:false,tourDone:true}}));}}catch(e){}`);
    const p = await ctx.newPage(); p.errs = [];
    p.on('pageerror', e => p.errs.push('' + e)); p.on('console', m => { if (m.type() === 'error') p.errs.push(m.text()); });
    await p.goto(URL + '?test=1'); await p.waitForFunction(() => window.__upload && document.getElementById('uploadBtn'));
    return { ctx, p };
  }
  const st = p => p.evaluate(() => { const v = id => { const n = document.getElementById(id); return n && !n.hidden ? n.innerText.replace(/\s+/g, ' ').trim() : ''; };
    const s = window.__upload.song(); return { msg: v('upMsg'), err: v('upErr'), val: v('upVal'), title: s && s.title, lib: window.__upload.lib().n, paste: document.getElementById('upPaste').value }; });
  async function pasteLoad(p, text, opts) {
    await p.evaluate(() => { if (document.getElementById('uploadPick').hidden) document.getElementById('uploadBtn').click(); });
    await p.locator('#upPaste').click();
    await p.evaluate(t => navigator.clipboard.writeText(t), text); await p.keyboard.press('Control+V');
    const got = await p.evaluate(() => document.getElementById('upPaste').value);
    if (opts && opts.dbl) await p.evaluate(() => { const l = document.getElementById('upLoad'); l.click(); l.click(); });
    else await p.locator('#upLoad').click();
    for (let i = 0; i < 40; i++) { const s = await st(p); if (s.val) { await p.locator('#upValSave').click(); } if (/^Loaded|loaded|songs? (added|saved)/i.test(s.msg) || s.err) break; await p.waitForTimeout(100); }
    return { pasted: got, s: await st(p) };
  }
  // 1. answers with one slip load (each on a fresh page, the first tap on the page = audio not unlocked yet)
  for (const id of LOAD) {
    const c = CASES[id]; F(c, 'no case ' + id); if (!c) continue;
    const { ctx, p } = await fresh();
    const r = await pasteLoad(p, c.text);
    const ok = !!r.s.title && !r.s.err && /Loaded/.test(r.s.msg);
    R.info.cases.push({ id, ok, title: r.s.title, msg: r.s.msg.slice(0, 240), err: r.s.err.slice(0, 240), pasteSame: r.pasted === c.text.replace(/\r\n?/g, '\n') });
    F(ok, id + ' did not load: ' + (r.s.err || r.s.msg).slice(0, 300));
    F(r.pasted === c.text.replace(/\r\n?/g, '\n'), id + ' paste changed in the box');
    F(!p.errs.length, id + ' console ' + p.errs.join(' | '));
    await ctx.close();
  }
  // 2. two answers in one paste: both songs are saved
  for (const id of ['two-envelopes-two-fences', 'two-envelopes-bare']) {
    const { ctx, p } = await fresh(); const lib0 = (await st(p)).lib;
    const r = await pasteLoad(p, CASES[id].text);
    R.info.cases.push({ id, lib0, lib: r.s.lib, msg: r.s.msg.slice(0, 240), err: r.s.err });
    F(r.s.lib >= lib0 + 2 && !r.s.err, id + ' songs saved ' + (r.s.lib - lib0) + ' ' + r.s.err);
    F(!p.errs.length, id + ' console ' + p.errs.join(' | ')); await ctx.close();
  }
  // 3. double tap on Load, then one more tap: still "Loaded ...", no "(paste) is empty" (both sizes)
  for (const vp of [{ width: 360, height: 780 }, { width: 780, height: 360 }]) {
    const tag = vp.width + 'x' + vp.height, { ctx, p } = await fresh(vp);
    const r = await pasteLoad(p, CASES['clean-small'].text, { dbl: true });
    await p.waitForTimeout(300); const s1 = await st(p);
    await p.locator('#upLoad').click(); await p.waitForTimeout(300); const s2 = await st(p);
    R.info.races['double-' + tag] = { after: r.s.msg.slice(0, 120), s1: { msg: s1.msg.slice(0, 120), err: s1.err }, s2: { msg: s2.msg.slice(0, 120), err: s2.err } };
    F(/^Loaded Let It Be/.test(s1.msg) && !s1.err, tag + ' double tap: ' + s1.err);
    F(/^Loaded Let It Be/.test(s2.msg) && !s2.err, tag + ' a later tap: ' + s2.err);
    // reopening the dialog starts clean, and Load with nothing pasted then says so
    await p.evaluate(() => { document.querySelector('#uploadPick .kp-x, #uploadPick [data-close], #upClose') ? document.querySelector('#uploadPick .kp-x, #uploadPick [data-close], #upClose').click() : (document.getElementById('uploadPick').hidden = true); });
    await p.evaluate(() => document.getElementById('uploadBtn').click()); await p.locator('#upLoad').click(); await p.waitForTimeout(200);
    const s3 = await st(p); R.info.races['reopen-' + tag] = s3.err;
    F(/is empty/.test(s3.err), tag + ' empty Load after reopening: ' + s3.err);
    // a 20-song answer: Load taps during the check are ignored, all songs load
    const lib0 = s3.lib;
    await p.locator('#upPaste').fill(CASES['very-long-20-songs'].text);
    await p.locator('#upLoad').click(); await p.locator('#upLoad').click({ noWaitAfter: true });
    for (let i = 0; i < 60; i++) { const s = await st(p); if (s.val) await p.locator('#upValSave').click(); if (s.lib >= lib0 + 19 || s.err) break; await p.waitForTimeout(150); }
    const s4 = await st(p); R.info.races['list20-' + tag] = { added: s4.lib - lib0, err: s4.err };
    F(s4.lib - lib0 === 19 && !s4.err, tag + ' 20-song answer added ' + (s4.lib - lib0) + ' ' + s4.err);   // 19 new + Let It Be (already saved above, updated)
    F(!p.errs.length, tag + ' console ' + p.errs.join(' | ')); await ctx.close();
  }
  // 4. the upload fixtures still load the same song
  for (const f of ['noff-v13.min.json', 'noff-v13.json', 'anh-v13.json', 'noff-v12.json', 'anh-v12.json']) {
    const { ctx, p } = await fresh(); const src = JSON.parse(fx(f)), t = (src.songs ? src.songs[0] : src).song.title;
    const want = await p.evaluate(x => { const r = __upload.load(x); return r && r.ok; }, fx(f));
    const r = await pasteLoad(p, fx(f));
    R.info.fixtures.push({ f, title: r.s.title, want, msg: r.s.msg.slice(0, 160), err: r.s.err });
    F(r.s.title === t && !r.s.err, f + ' ' + r.s.title + ' ' + r.s.err);
    F(!p.errs.length, f + ' console ' + p.errs.join(' | ')); await ctx.close();
  }
  // 5. a chord sheet (no JSON): a plain message that says what to do
  { const { ctx, p } = await fresh(); const r = await pasteLoad(p, CASES['chord-over-lyric'].text);
    R.info.sheet = r.s.err; F(/chord sheet/.test(r.s.err) && !r.s.title, 'chord sheet message: ' + r.s.err); await ctx.close(); }
  await b.close();
  fs.writeFileSync(path.join(process.env.OUT || '/tmp', 'aipaste.json'), JSON.stringify(R, null, 1)); console.log(JSON.stringify(R.fails)); process.exit(R.fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
