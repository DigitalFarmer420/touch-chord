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
    const js = fs.readdirSync(OUT).filter(f => f.endsWith('.json') && fs.statSync(path.join(OUT, f)).mtimeMs >= s - 1000);
    let fails = 0; for (const j of js) { try { fails += failsOf(JSON.parse(fs.readFileSync(path.join(OUT, j), 'utf8'))); } catch (e) { fails++; } }
    const crashed = r.status !== 0 || r.error || /^(TypeError|ReferenceError|Error|.*TimeoutError)/m.test(log) || !js.length;
    const ok = !crashed && fails === 0; if (!ok) bad++;
    rows.push(`${ok ? 'PASS' : 'FAIL'} ${name.padEnd(14)} fails=${fails}${crashed ? ' (crashed/no result: exit ' + r.status + ')' : ''} ${((Date.now() - s) / 1000).toFixed(0)}s`); console.log(rows[rows.length - 1]);
    if (!ok) console.log(log.slice(-1500)); }
  console.log(`smoke: ${rows.length - bad}/${rows.length} passed in ${((Date.now() - t0) / 60e3).toFixed(1)} min`);
  srv.close(); process.exit(bad ? 1 : 0); });
