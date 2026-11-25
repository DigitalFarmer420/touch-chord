// Look v4 (Uiux mockups approved by Vinh, 24 Nov 2026): css/look.css restyles Simple, Expert, Settings and Sound.
// Kids must not change at all, so every selector in look.css is guarded against html.kv.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const read = f => readFileSync(ROOT + f, 'utf8');
const LOOK = read('css/look.css');
const HTML = read('index.html');

// Top-level selectors of every rule (comments stripped; commas inside :is()/:where()/:not() are not split points).
function selectors(css) {
  const out = [];
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const re = /([^{}]+)\{[^{}]*\}/g; let m;
  while ((m = re.exec(src))) {
    const sel = m[1].trim(); let depth = 0, cur = '';
    for (const ch of sel) { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ',' && !depth) { out.push(cur.trim()); cur = ''; } else cur += ch; }
    out.push(cur.trim());
  }
  return out.filter(Boolean);
}

test('look.css: every selector is guarded so it can never match Kids (html.kv)', () => {
  const sels = selectors(LOOK);
  assert.ok(sels.length > 150, `parsed ${sels.length} selectors`);
  const guard = /^(:where\(html:not\(\.kv\)[^)]*\)|html[\w.\-]*(:root)?(:is\([^)]*\))?[\w.\-]*:where\(:not\(\.kv\)[^)]*\))/;
  for (const s of sels) assert.match(s, guard, s);
  // nothing in it names a Kids element
  for (const s of sels) assert.doesNotMatch(s, /#kv\b|\.kv-|\.kv\b(?!\))/, s);
});

test('look.css loads last, with the cache tag, and is precached for offline', () => {
  const links = [...HTML.matchAll(/<link rel="stylesheet" href="(css\/[^"?]+)\?v=([^"]+)"/g)];
  assert.equal(links.at(-1)[1], 'css/look.css');
  assert.match(read('sw.js'), /"css\/look\.css",/);
});

test('Fredoka and Nunito are bundled (no CDN) under the SIL OFL, and look.css uses only them', () => {
  const fonts = read('css/fonts.css');
  for (const [fam, file, lic] of [['Fredoka', 'fredoka-variable.woff2', 'OFL-Fredoka.txt'], ['Nunito', 'nunito-variable.woff2', 'OFL-Nunito.txt']]) {
    assert.match(fonts, new RegExp(`font-family: ${fam};\\s*src: url\\("\\.\\./fonts/${file}"\\) format\\("woff2"\\)`));
    assert.ok(existsSync(ROOT + 'fonts/' + file), file);
    assert.equal(readFileSync(ROOT + 'fonts/' + file).toString('latin1', 0, 4), 'wOF2');
    assert.match(read('fonts/' + lic), /SIL Open Font License, Version 1\.1/);
  }
  assert.doesNotMatch(HTML + fonts + LOOK, /fonts\.googleapis|fonts\.gstatic|https?:\/\/[^"')\s]*\.woff2/);
  assert.match(LOOK, /--tc-font-display: Fredoka, Nunito, system-ui, sans-serif;/);
  assert.match(LOOK, /--tc-font-ui: Nunito, system-ui, sans-serif;/);
  const fams = [...LOOK.matchAll(/font-family:\s*([^;!]+)/g)].map(m => m[1].trim());
  for (const f of fams) assert.ok(/^var\(--tc-font-(display|ui)\)$|^inherit$/.test(f), f);
  assert.doesNotMatch(LOOK, /Palatino|Avenir|Georgia|[^-]serif\b/);
  // the Now chord: Fredoka in the hint yellow, in Simple and Expert
  assert.match(LOOK, /html\.simple:where\(:not\(\.kv\)\) #symbol \{ color: var\(--tc-gold\)/);
  assert.match(LOOK, /html\.expert:where\(:not\(\.kv\)\) \.now-card #symbol \{ font-family: var\(--tc-font-display\) !important;[^}]*color: var\(--tc-gold\) !important/);
});

test('one hint yellow #FFC23D for badges, next outline / dot, step dots and the piano dot', () => {
  assert.match(LOOK, /--tc-gold: #FFC23D;/);
  assert.match(LOOK, /--lk-c4853f: #FFC23D !important;/);
  assert.match(LOOK, /--x-gold: #FFC23D !important;/);
  assert.match(LOOK, /\.pg-badge \{ background: var\(--tc-gold\) !important;/);
  assert.match(LOOK, /\.x-dots i\.next, [^{]*\.x-dots i\.cur \{ background: var\(--tc-gold\) !important;/);
  assert.match(LOOK, /#suggest \.nxd, [^{]*\.kb \.pad\.nx-root::before \{ background: var\(--tc-gold\) !important;/);
  assert.match(LOOK, /\.ss-chip\.nxdot \{ outline: 3px solid var\(--tc-gold\);/);
});

test('flat colours: no bottom edge on Next, chord chips, selected mode and selected instrument', () => {
  assert.match(LOOK, /#xNext, html\.expert:where\(:not\(\.kv\)\) #xNext:active \{ box-shadow: none !important; \}/);
  assert.match(LOOK, /html\.simple:where\(:not\(\.kv\)\) \.ss \.ss-chip \{[^}]*box-shadow: none !important;/);
  assert.match(LOOK, /#suggest \.ss-chip, [^{]*#suggest \.ss-note,\s*[^{]*\.ss-chip\.pg-on, [^{]*\.ss-note\.pg-on \{ box-shadow: none !important; \}/);
  assert.match(LOOK, /#msMode button\.on \{ background: #F7EEDF !important; box-shadow: none !important; \}/);
  assert.match(LOOK, /#engines button\.on \{[^}]*box-shadow: none !important;/);
  // no 3D "0 Npx 0" edges anywhere in the file
  assert.doesNotMatch(LOOK.replace(/\/\*[\s\S]*?\*\//g, ''), /box-shadow:\s*0 \dpx 0 /);
});

test('Lock is docked inside the progression and song selectors (same buttons, same handlers)', () => {
  const UI = read('js/expert/ui.js');
  assert.match(UI, /class=\\"x-b x-lock\\" aria-pressed=\\"" \+ locked \+ "\\" aria-label=\\"Lock the song chords\\"><span class=\\"x-lki\\">[^<]*<\/span><span class=\\"x-lkt\\">Lock<\/span><\/button>/);
  assert.match(UI, /class=\\"x-b x-plock\\" aria-pressed=\\"" \+ plk \+ "\\" aria-label=\\"Keep this progression when the style changes\\"><span class=\\"x-lki\\">[^<]*<\/span><span class=\\"x-lkt\\">Lock<\/span><\/button>/);
  assert.match(UI, /if \(e\.target\.closest\("\.x-plock"\)\) \{ progLockTap\(\); return; \}/);
  assert.match(UI, /if \(e\.target\.closest\("\.x-lock"\)\) \{ click\("#sbLock"\); schedule\(\); return; \}/);
  assert.match(LOOK, /#xSrc :is\(\.x-plock, \.x-lock\) \{\s*position: absolute !important; right: 1\.5px !important;/);
  assert.match(LOOK, /#xSrc :is\(\.x-plock, \.x-lock\) \.x-lkt \{ display: none !important; \}/);
  assert.match(LOOK, /#xSrc :is\(\.x-plock, \.x-lock\)\[aria-pressed="true"\] \{ background-color: var\(--tc-gold\) !important; \}/);
});

test('Simple sideways: 296px two-column panel, controls at least 40px; Upload hints are neutral', () => {
  assert.match(LOOK, /html\.simple\.lay-phone-land:where\(:not\(\.kv\)\) #app \{ grid-template-columns: 296px minmax\(0, 1fr\) auto !important;/);
  assert.match(LOOK, /\.now-col \{ display: grid !important; grid-template-columns: 96px minmax\(0, 1fr\);/);
  for (const [sel, px] of [['.kk-mode', 40], ['#prog .pg-btn', 48], ['#styles button', 40], ['.kk-root', 44]]) {
    const m = new RegExp(`html\\.simple\\.lay-phone-land:where\\(:not\\(\\.kv\\)\\) ${sel.replace(/[.#]/g, '\\$&')} \\{ (min-)?height: (\\d+)px`).exec(LOOK);
    assert.ok(m && +m[2] >= px, sel);
  }
  assert.match(HTML, /id="upTitle"[^>]*placeholder="Song title"/);
  assert.match(HTML, /id="upArtist"[^>]*placeholder="Artist"/);
  assert.doesNotMatch(HTML, /Hotel California|Eagles/);
});

test('Kids stylesheet and Kids view are untouched by v4 (no look v4 tokens leak into them)', () => {
  const kids = read('css/kids.css') + read('js/kids/view.js');
  assert.doesNotMatch(kids, /--tc-gold|--tc-font-|look\.css|x-lkt/);
});
