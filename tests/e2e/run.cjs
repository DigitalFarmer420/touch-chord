#!/usr/bin/env node
// Smoke set of the v112.3 Playwright suites, run against the site served from the repo root.
//   node tests/e2e/run.cjs            (CHROME=/path/to/chrome to use a local Chrome; default: Playwright's Chromium)
// Exit code 1 if any test reports a fail, crashes, or times out. Results: tests/e2e/out/*.json + *.log.
const { spawn, spawnSync } = require('child_process'); const fs = require('fs'); const path = require('path'); const http = require('http');
const ROOT = path.resolve(__dirname, '../..'); const OUT = path.join(__dirname, 'out'); const PORT = +(process.env.PORT || 8080);
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(process.env.SHOTS || '/tmp/tc-shots/s111', { recursive: true }); fs.mkdirSync((process.env.SHOTS || '/tmp/tc-shots') + '/s111', { recursive: true });
const SUITE = [   // [name, file, args]  (both phone sizes each: the tests loop 360x780 + 780x360 themselves or take the size)
  ['howto112', 'howto112.cjs', []], ['tour112', 'tour112.cjs', []], ['lyrfit111', 'lyrfit111.cjs', []],
  ['hints112-360', 'hints112.cjs', ['360x780']], ['hints112-780', 'hints112.cjs', ['780x360']],
  ['hints1121-360', 'hints1121.cjs', ['360x780']], ['hints1121-780', 'hints1121.cjs', ['780x360']],
  ['test111', 'test111.cjs', []], ['keysplit', 'keysplit.cjs', []],
  ['validate', 'validate.cjs', []],
  ['labelfit', 'labelfit.cjs', []],
  ['kbfix', 'kbfix.cjs', []],   // kb-fix: key-tap pitch / quality / snap-back + the user's Jazz Full state
  ['kbaccept-360-octave', 'kbaccept.cjs', ['360x780', 'octave']], ['kbaccept-360-full', 'kbaccept.cjs', ['360x780', 'full']],
  ['kbaccept-780-octave', 'kbaccept.cjs', ['780x360', 'octave']], ['kbaccept-780-full', 'kbaccept.cjs', ['780x360', 'full']],   // kb-fix acceptance matrix
  ['kidsascend', 'kidsascend.cjs', []],   // v112.9: Kids pads root position, rising in reading order, lit = sounded, Twinkle advance
  ['kidsgold', 'kidsgold.cjs', []],   // v112.10: Kids gold always wins: a pad never slides the gold key off the keys
  ['playoff', 'playoff.cjs', []],   // v112.11: Play along off = no guide (dot / chip marks hidden), MIDI, lit and layout identical ON vs OFF
  ['upload13', 'upload13.cjs', []],
  ['aipaste', 'aipaste.cjs', []],   // v3.2-ai-paste: ChatGPT / Grok answers with one slip load (real clipboard paste), double tap on Load, fixtures   // v112.12: Song Contract v1.3 upload (form order, length warning, chord tidy, JSON repair, honest messages)
  ['kidsview-360', 'kidsview.cjs', ['360x780']], ['kidsview-780', 'kidsview.cjs', ['780x360']],   // Kids redesign: the Kids view (Simple) at the four sizes
  ['kidsview-768', 'kidsview.cjs', ['768x1024']], ['kidsview-1024', 'kidsview.cjs', ['1024x768']], ['kidsview-820', 'kidsview.cjs', ['820x1180']],   // rd2: + iPad Air portrait
  ['kvaudio', 'kvaudio.cjs', []],   // Kids redesign: the Kids view's pads / keys / Next / Play sound exactly like the Kids style
  ['expert', 'expert.cjs', []],
  ['modeswitch-360', 'modeswitch.cjs', ['360x780']], ['modeswitch-412', 'modeswitch.cjs', ['412x915']], ['modeswitch-780', 'modeswitch.cjs', ['780x360']],   // rd5.1: every mode switch (after a reload in each mode) leaves one Kids screen, one gear   // Expert redesign: html.expert screen set (decisions 1-11), 360x780 + 780x360 + 820x1180 + 1180x820
  ['rd6', 'rd6.cjs', []],   // rd6: one mode chip + one Settings sheet in every mode (Kids hold), Look Auto / Day / Lamp, Style menu, Kids step after a reload, upload chart, dense-layout note (the six rd6 sizes)
  ['rd7', 'rd7.cjs', []],   // rd7: Noff rd6 findings + Uiux Low (Start over stops, two-chart bar kept, v1.2 partial Full, Kids reload resume, pass-through toast, Simple sheet, Expert ? circle)
  ['rd8', 'rd8.cjs', []],   // rd8: switch lands on the chord covering the beat; dense banner on the chord panel (6 sizes); partial Full reuse
  ['rd9', 'rd9.cjs', []],   // rd9: reused-section lyrics follow their own beats; end of song kept on a switch; idempotent round trips; pass-through banner (6 sizes)
  ['rd10', 'rd10.cjs', []],   // rd10: lyrics parity per pass; Simple Day / Lamp / Auto, Look row in 3 modes, Simple Day contrast, Lamp = rd9 (RD9 env)
  ['rd11', 'rd11.cjs', []],   // rd11: Look helper line in 3 sheets, Day sus chip plum + AA, iPad lyric chip top-aligned, contrast 820x1180 + 1180x820, Lamp = rd10 outside the song bar (RD10 env)
  ['rd12', 'rd12.cjs', []],   // rd12: tablet lyric lines 16px (Simple + Expert, Day + Lamp), title as rd11, phones pixel-identical to rd11 (RD11 env)
  ['rd13', 'rd13.cjs', []],   // rd13: Expert Keys row + chip (cycle, persistence, defaults, panel height, slide / snap-back, root-left, same sound), Kids / Simple untouched; equal-height rows at 360x780 / 384x832 / 412x915
  ['rd14', 'rd14.cjs', []],   // rd14: Keys header strip - every key's area hit-tests to the key (never the chip / pill) in 3 views x 5 sizes; panel and pads = rd13 (RD13 env); track 44 = Next / Play
  ['rd15', 'rd15.cjs', []],   // rd15: short landscape - no keyboard header, Keys chip in the right column, Buttons rows >= 24 (2px gaps), hit tests, labels clipped, pill taps play the key; landscape top bar 36 + ? 44 tap area; upright / iPad = rd14 (RD14 env); eqh in short landscape
  ['rd17', 'rd17.cjs', []],   // rd17: keyboard bar Type + Keys, three equal buttons, All notes, no duplicate controls, Kids scrolling grid, help menu
];
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.json': 'application/json', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); const f = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(r); });
function runAsync(cmd, args, o) { return new Promise(res => { const p = spawn(cmd, args, o); let out = '', err = '';
  p.stdout.on('data', d => out += d); p.stderr.on('data', d => err += d);
  const t = setTimeout(() => p.kill('SIGKILL'), o.timeout); p.on('close', c => { clearTimeout(t); res({ status: c, stdout: out, stderr: err }); }); }); }
function failsOf(o) { let n = 0; (function w(x, k) { if (Array.isArray(x)) { if (/^(fails?|errs)$/i.test(k)) n += x.length; else x.forEach(e => w(e)); } else if (x && typeof x === 'object') for (const kk in x) w(x[kk], kk); })(o); return n; }
srv.listen(PORT, '127.0.0.1', async () => {
  const t0 = Date.now(); let bad = 0; const rows = [];
  for (const [name, file, args] of SUITE) { if (only && !only.includes(name)) continue;
    const s = Date.now(); const before = new Set(fs.readdirSync(OUT));
    const r = await runAsync(process.execPath, ['-r', path.join(__dirname, 'emulate.cjs'), path.join(__dirname, file), ...args], { cwd: __dirname, timeout: 25 * 60e3,
      env: Object.assign({}, process.env, { BASE: `http://127.0.0.1:${PORT}/index.html`, OUT, SHOTS: process.env.SHOTS || '/tmp/tc-shots' }) });
    const log = (r.stdout || '') + (r.stderr || ''); fs.writeFileSync(path.join(OUT, name + '.log'), log);
    const js = fs.readdirSync(OUT).filter(f => f.endsWith('.json') && fs.statSync(path.join(OUT, f)).mtimeMs >= s);
    let fails = 0; for (const j of js) { try { fails += failsOf(JSON.parse(fs.readFileSync(path.join(OUT, j), 'utf8'))); } catch (e) { fails++; } }
    const crashed = r.status !== 0 || r.error || /^(TypeError|ReferenceError|Error|.*TimeoutError)/m.test(log) || !js.length;
    const ok = !crashed && fails === 0; if (!ok) bad++;
    rows.push(`${ok ? 'PASS' : 'FAIL'} ${name.padEnd(14)} fails=${fails}${crashed ? ' (crashed/no result: exit ' + r.status + ')' : ''} ${((Date.now() - s) / 1000).toFixed(0)}s`); console.log(rows[rows.length - 1]);
    if (!ok) console.log(log.slice(-1500)); }
  console.log(`smoke: ${rows.length - bad}/${rows.length} passed in ${((Date.now() - t0) / 60e3).toFixed(1)} min`);
  srv.close(); process.exit(bad ? 1 : 0); });
