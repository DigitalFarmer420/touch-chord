// Flow layout rev2 (Vinh, 20 Nov 2026): the approved mockups in code.
//  - boot-early.js: size class (744 = iPad mini portrait is iPad), big-window zoom past 1180x820 / 820x1180 (option B),
//    rect functions in page px while zoomed, tcVW / tcVH
//  - CSS: every viewport length goes through --tc-* (so zoom does not double them), no upper caps in the iPad layers
//    (Sound / All notes included), Kids chord pads as tall as the piano, Simple without the volume slider
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
const R = new URL('../../', import.meta.url);
const read = p => readFileSync(new URL(p, R), 'utf8');
const BOOT = read('js/boot-early.js');

// A tiny window / document for boot-early.js. Rects are in screen px, as a browser reports them under zoom.
function boot(w, h) {
  const classes = new Set(), props = {}, style = { zoom: '', setProperty: (k, v) => { props[k] = v; } };
  class DOMRect { constructor(x, y, width, height) { Object.assign(this, { x, y, width, height, left: x, top: y, right: x + width, bottom: y + height }); } }
  class Element { getBoundingClientRect() { return new DOMRect(10, 20, 300, 100); } getClientRects() { return [new DOMRect(10, 20, 300, 100)]; } }
  class Range { getBoundingClientRect() { return new DOMRect(0, 0, 50, 10); } getClientRects() { return [new DOMRect(0, 0, 50, 10)]; } }
  const de = { className: '', clientWidth: w, clientHeight: h, style,
    classList: { contains: k => classes.has(k), toggle: (k, on) => (on ? classes.add(k) : classes.delete(k)), add: k => classes.add(k), remove: k => classes.delete(k) } };
  const win = { innerWidth: w, innerHeight: h, addEventListener() {}, Element, Range, localStorage: { getItem: () => null } };
  const ctx = { window: win, document: { documentElement: de }, navigator: {}, location: { search: '?test=1' }, setTimeout() {}, DOMRect, Date };
  win.window = win;
  vm.runInNewContext(BOOT, ctx);
  return { win, classes, props, style, Element, Range };
}
const lay = c => [...c].find(k => k.startsWith('lay-'));

test('size class: 744x1133 (iPad mini portrait) is the iPad layout; phones and 700x900 are not', () => {
  assert.equal(lay(boot(744, 1133).classes), 'lay-pad-port');
  assert.equal(lay(boot(1133, 744).classes), 'lay-pad-land');
  assert.equal(lay(boot(700, 900).classes), 'lay-phone-port');
  assert.equal(lay(boot(390, 844).classes), 'lay-phone-port');
  assert.equal(lay(boot(844, 390).classes), 'lay-phone-land');
});

test('big-window zoom: 1 up to the reference sizes, then min(w/1180, h/820) landscape and min(w/820, h/1180) portrait', () => {
  const z = (w, h) => boot(w, h).win.tcZoom;
  for (const [w, h] of [[390, 844], [844, 390], [744, 1133], [820, 1180], [1180, 820], [1024, 768], [1920, 600], [1440, 800]]) assert.equal(z(w, h), 1, `${w}x${h}`);
  assert.equal(z(1920, 1080), 1.317);
  assert.equal(z(1366, 1024), 1.158);
  assert.equal(z(1024, 1366), 1.158);
  assert.equal(z(2560, 1440), 1.756);
  const b = boot(1920, 1080);
  assert.equal(b.style.zoom, '1.317'); assert.equal(b.props['--tcz'], '1.317');
  const p = boot(820, 1180);
  assert.equal(p.style.zoom, ''); assert.equal(p.props['--tcz'], undefined, 'nothing is written at zoom 1');
});

test('while zoomed, rects and tcVW / tcVH are in page px; at zoom 1 they are untouched', () => {
  const b = boot(1920, 1080), z = 1.317;
  const r = new b.Element().getBoundingClientRect();
  assert.ok(Math.abs(r.width - 300 / z) < 1e-9 && Math.abs(r.top - 20 / z) < 1e-9 && Math.abs(r.bottom - 120 / z) < 1e-9);
  const l = new b.Element().getClientRects();
  assert.equal(l.length, 1); assert.ok(Math.abs(l[0].width - 300 / z) < 1e-9); assert.equal(l.item(0), l[0]);
  assert.ok(Math.abs(new b.Range().getBoundingClientRect().width - 50 / z) < 1e-9);
  assert.ok(Math.abs(b.win.tcVW() - 1920 / z) < 1e-9 && Math.abs(b.win.tcVH() - 1080 / z) < 1e-9);
  const p = boot(1180, 820);
  assert.equal(new p.Element().getBoundingClientRect().width, 300);
  assert.equal(p.win.tcVW(), 1180);
});

const CSSFILES = readdirSync(new URL('css/', R)).filter(f => f.endsWith('.css'));
test('CSS: every viewport length goes through --tc-* (zoom would otherwise double it)', () => {
  for (const f of CSSFILES) {
    read('css/' + f).split('\n').forEach((line, i) => {
      if (/^\s*@media/.test(line) || /--tc-(vw|vmin):/.test(line)) return;   // media queries, and base.css's unit definitions
      assert.doesNotMatch(line, /(?<![\w.-])\d*\.?\d+(dvh|svh|lvh|vh|vw|vmin|vmax)\b/, `css/${f}:${i + 1}`);
    });
  }
  const base = read('css/base.css');
  for (const u of ['vw', 'vh', 'dvh', 'svh', 'lvh', 'vmin', 'vmax']) assert.match(base, new RegExp(`--tc-${u}: calc\\(1${u} / var\\(--tcz\\)\\)`));
  assert.match(base, /:root \{ --tcz: 1;/);
});

test('UI code reads the viewport through tcVW / tcVH (page px), not innerWidth / innerHeight', () => {
  const walk = d => readdirSync(new URL(d, R), { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(d + e.name + '/') : e.name.endsWith('.js') ? [d + e.name] : []);
  for (const f of walk('js/')) {
    if (f === 'js/boot-early.js') continue;
    for (const m of read(f).matchAll(/window\.inner(Width|Height)/g)) {
      const at = read(f).slice(Math.max(0, m.index - 40), m.index);
      assert.match(at, /window\.tcV[WH] \? window\.tcV[WH]\(\) : $/, `${f}: innerWidth / innerHeight only as the fallback`);
    }
  }
});

test('iPad layers: floors only, no upper caps (big windows keep growing; Sound / All notes uncapped)', () => {
  const ex = read('css/expert.css'), sp = read('css/simplepad.css');
  const layer = ex.slice(ex.indexOf('@media (min-width: 744px) and (min-height: 600px)'));
  const portRules = ex.split('\n').filter(l => /^html\.expert\.lay-pad-port/.test(l)).join('\n');
  assert.doesNotMatch(layer.slice(0, layer.indexOf('\n}\n')), /clamp\(/);
  assert.doesNotMatch(portRules, /clamp\(/);
  assert.match(ex, /--xl-ctl-max: max\(88px, calc\(102\.3 \/ 820 \* calc\(100 \* var\(--tc-dvh\)\)\)\);/);
  assert.doesNotMatch(ex, /--xl-(row|go|next)-max/);
  assert.doesNotMatch(sp, /clamp\(/);
  assert.match(sp, /--sh: max\(0\.75px, calc\(calc\(100 \* var\(--tc-dvh\)\) \/ 820\)\)/);
});

test('Kids: the chord pads and the piano share the free height, one pad row = the piano', () => {
  const k = read('css/kids.css'), tail = k.slice(k.indexOf('/* Chord pads at least as tall as the piano'));
  assert.ok(tail.length > 100, 'rule block present at the end of kids.css');
  assert.match(tail, /html:not\(\.lay-phone-land\) \.kv-mid \{ display: contents; \}/);
  assert.match(tail, /html:not\(\.lay-phone-land\) \.kv-pads \{ --kr: 1; flex: var\(--kr\) 1 calc\(\(var\(--kr\) - 1\) \* var\(--kgap, 12px\)\); min-height: 0; grid-auto-rows: 1fr;/);
  assert.match(tail, /html\.lay-phone-port \.kv-pads \{ --kr: 2; --kgap: 8px;/);
  assert.match(tail, /html:not\(\.lay-phone-land\) \.kv-piano \{ flex: 1 1 0; min-height: 44px;/);
  assert.match(tail, /html\.lay-phone-land \.kv-mid \{ flex: 1 1 0;/);
  assert.match(tail, /html\.lay-phone-land \.kv-piano \{ flex: 1 1 0; min-height: 44px;/);
  assert.doesNotMatch(tail, /(color|background|font-family|border-radius|box-shadow)\s*:/, 'sizes and flow only');
});

test('Simple: no volume slider; its rows go to the neighbours (Expert keeps the slider)', () => {
  const sp = read('css/simplepad.css'), fit = read('css/fit.css');
  assert.match(sp, /html\.simple #nowMix \{ display: none !important; \}/);
  assert.match(sp, /html\.simple\.lay-pad-port #app \{ grid-template-areas: "top top" "sty sty" "key now" "sus prog" "sus prog" "sus prog" "nxt nxt"; \}/);
  assert.match(fit, /html\.simple\.lay-phone-port:not\(\.expert\):not\(\.kv\) #app \{ grid-template-areas: "top top" "sty sty" "sus now" "sus now" "prg key" "nxt nxt"; \}/);
  assert.doesNotMatch(sp + fit, /html(\.expert)?:not\(\.simple\) #nowMix \{ display: none/);
  assert.match(read('index.html'), /id="nowMix"[\s\S]*id="volume"/, 'the slider stays in the page for Expert');
});
