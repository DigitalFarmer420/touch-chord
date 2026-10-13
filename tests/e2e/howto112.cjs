const APPV=require('fs').readFileSync(require('path').resolve(__dirname,'../../js/version.js'),'utf8').match(/APP_VERSION = "([^"]+)"/)[1];   // CI: version from js/version.js
// v111: How to dialog with the phone screenshots. 360x780 + 780x360, Full + Simple:
// opens, scrolls to the end, every picture loads (HTTP 200, naturalWidth > 0, no 404 anywhere), no horizontal
// overflow (page or dialog), each picture inside the box and no taller than the screen, text checks, no console errors.
const { chromium } = require('playwright-core'); const fs = require('fs');
const URL = process.env.URL || (process.env.BASE||'http://localhost:8080/index.html'); const SH = (process.env.SHOTS||'/tmp/tc-shots')+'/s111/howto-dialog-';
const R = { fails: [], info: {} }; const F = (c, m) => { if (!c) R.fails.push(m); };
const KIDS10 = ['Twinkle', 'Mary&#8217;s Lamb', 'Row Your Boat', 'Old MacDonald', 'Itsy Bitsy Spider', 'London Bridge', 'Hey Diddle Diddle', 'Head, Shoulders, Knees and Toes', 'Baa, Baa, Black Sheep', 'Hickory Dickory Dock'];
(async () => { const b = await chromium.launch({ executablePath:process.env.CHROME||undefined,});
  const html = await (await fetch(URL)).text();
  F(html.includes('Tap a song to play it.'), 'step 9 "Tap a song to play it" changed');
  const kidsCap = html.slice(html.indexOf('<span class="ht-num">10.</span> Kids'), html.indexOf('</section></li>', html.indexOf('<span class="ht-num">10.</span> Kids')));
  KIDS10.forEach(n => F(kidsCap.includes(n), 'How to Kids misses ' + n)); F(!/Wheels|You&#8217;re Happy/.test(html), 'dropped song still in page');
  F(/right of <b>Full Range<\/b>/.test(html), 'Upload wording');
  // v111 steering: no album anywhere the user can see (How to, Upload button labels, Upload form)
  const ht = html.slice(html.indexOf('id="howto"'), html.indexOf('</section>', html.indexOf('htWordsH')));
  F(!/album/i.test(ht), 'How to mentions album'); F(!/album/i.test(html.match(/<button[^>]*id="uploadBtn"[^>]*>/)[0]), 'upload button label album');
  F(!/album/i.test(html.slice(html.indexOf('<div id="uploadPick"'), html.indexOf('<script type="application/json" id="songSchemaJson"'))), 'upload form markup album');
  for (const [w, h] of [[360, 780], [780, 360]]) for (const simple of [false, true]) { const tag = `${w}x${h}-${simple ? 'simple' : 'full'}`;
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    await ctx.addInitScript(`try{localStorage.setItem('touchChord.settings.v1',JSON.stringify({v:1,settings:{simple:${simple}}}));}catch(e){}`);
    const p = await ctx.newPage(); const errs = [], bad = [], imgs = {};
    p.on('pageerror', e => errs.push('' + e)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    p.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); if (/\/images\//.test(r.url())) imgs[r.url()] = r.status(); });
    await p.goto(URL + '?test=1'); await p.waitForTimeout(1000);
    await p.click('#howtoBtn'); await p.waitForTimeout(500);
    const open = await p.evaluate(() => { const d = document.getElementById('howto'); return !d.hidden && getComputedStyle(d).display !== 'none'; }); F(open, tag + ' How to did not open');
    await p.screenshot({ path: SH + tag + '-top.png' });
    // scroll through, picture by picture
    const n = await p.evaluate(() => document.querySelectorAll('#howto img').length); F(n === 12, tag + ' pictures ' + n);
    for (let i = 0; i < n; i++) { await p.evaluate(i => document.querySelectorAll('#howto img')[i].scrollIntoView({ block: 'center' }), i); await p.waitForTimeout(250); }
    await p.waitForFunction(() => [...document.querySelectorAll('#howto img')].every(i => i.complete), null, { timeout: 8000 }).catch(() => F(0, tag + ' images not complete'));
    if (simple === false && w === 360) { await p.evaluate(() => [...document.querySelectorAll('#howto h3')].find(x => /Upload/.test(x.textContent)).scrollIntoView({ block: 'start' })); await p.waitForTimeout(300); await p.screenshot({ path: SH + tag + '-upload.png' }); }
    const g = await p.evaluate(() => { const box = document.querySelector('#howto .ht-box'); const bx = box.getBoundingClientRect();
      const before = box.scrollTop; box.scrollTop = box.scrollHeight; const after = box.scrollTop;
      const im = [...document.querySelectorAll('#howto img')].map(i => { i.scrollIntoView({ block: 'nearest' }); const r = i.getBoundingClientRect(); const B = box.getBoundingClientRect();
        return { src: i.getAttribute('src'), nw: i.naturalWidth, nh: i.naturalHeight, w: Math.round(r.width), h: Math.round(r.height), inX: r.left >= B.left - 1 && r.right <= B.right + 1, cls: i.className }; });
      return { scrollable: box.scrollHeight > box.clientHeight, scrolled: after > before, boxOver: box.scrollWidth - box.clientWidth, docOver: document.documentElement.scrollWidth - innerWidth, bw: Math.round(bx.width), im }; });
    F(g.scrollable && g.scrolled, tag + ' does not scroll'); F(g.boxOver <= 0, tag + ' dialog overflows x by ' + g.boxOver); F(g.docOver <= 0, tag + ' page overflows x by ' + g.docOver);
    g.im.forEach(i => { F(i.nw === 1170 && i.nh === 540, tag + ' not loaded ' + i.src); F(i.inX, tag + ' outside box ' + i.src); F(i.h <= h, tag + ' taller than screen ' + i.src + ' ' + i.h); F(Math.abs(i.w / i.h - 1170 / 540) < 0.02, tag + ' distorted ' + i.src); F(i.src.endsWith('?v='+APPV), tag + ' cache tag ' + i.src); });
    F(Object.keys(imgs).length === 12 && Object.values(imgs).every(s => s === 200 || s === 304), tag + ' image responses ' + JSON.stringify(imgs));
    F(!bad.length, tag + ' HTTP errors ' + bad); F(!errs.length, tag + ' console ' + errs);
    await p.screenshot({ path: SH + tag + '-end.png' });
    await p.click('#howto .ht-x'); await p.waitForTimeout(300); F(await p.evaluate(() => document.getElementById('howto').hidden), tag + ' did not close');
    if (!simple) { await p.click('#uploadBtn'); await p.waitForTimeout(300); for (const [t, a] of [['Hotel California', 'Eagles'], ['', 'Eagles'], ['Thriller', 'MJ']]) { await p.fill('#upTitle', t); await p.fill('#upArtist', a); await p.dispatchEvent('#upArtist', 'input'); await p.waitForTimeout(100);
      const v = await p.evaluate(() => ({ txt: document.getElementById('uploadPick').innerText, attrs: [...document.querySelectorAll('#uploadPick [aria-label], #uploadPick [title], #uploadPick [placeholder], #uploadBtn')].map(e => (e.getAttribute('aria-label') || '') + (e.getAttribute('title') || '') + (e.getAttribute('placeholder') || '')).join(' '), copy: __upload.copyText() }));
      F(!/album/i.test(v.txt + v.attrs), tag + ' upload UI shows album: ' + t); F(!/album/i.test(v.copy), tag + ' Copy for AI mentions album: ' + t); } }
    R.info[tag] = { n, sizes: g.im.map(i => i.w + 'x' + i.h).join(' '), bw: g.bw }; await ctx.close(); }
  R.info.bytes = fs.readdirSync(''+require('path').resolve(__dirname,'../../images')).map(f => f + ' ' + fs.statSync(''+require('path').resolve(__dirname,'../../images')+'/' + f).size);
  await b.close(); fs.writeFileSync((process.env.OUT||__dirname) + '/howto111.json', JSON.stringify(R, null, 1)); console.log(JSON.stringify(R, null, 1), R.fails.length); })();
