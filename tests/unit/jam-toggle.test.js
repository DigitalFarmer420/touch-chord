// Jam control: a dashed circle in the empty top cell above B, not the Jam +6 pill.
import './dom-stub.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const listeners = {};
globalThis.addEventListener = (t, fn) => { (listeners[t] || (listeners[t] = [])).push(fn); };
globalThis.removeEventListener = (t, fn) => { if (listeners[t]) listeners[t] = listeners[t].filter(x => x !== fn); };
globalThis.dispatchEvent = (e) => { (listeners[e.type] || []).forEach(fn => fn(e)); return true; };
if (typeof globalThis.CustomEvent !== 'function') {
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init) { this.type = type; this.detail = init && init.detail; }
  };
}
if (typeof globalThis.getComputedStyle !== 'function') {
  globalThis.getComputedStyle = () => new Proxy({ getPropertyValue: () => '0', getPropertyPriority: () => '' }, { get: (o, k) => (k in o ? o[k] : () => '0') });
}
if (typeof globalThis.requestAnimationFrame !== 'function') globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);

const R = new URL('../../', import.meta.url);
const V = readFileSync(new URL('js/version.js', R), 'utf8').match(/APP_VERSION = "([^"]+)"/)[1];
const LOOK = readFileSync(new URL('css/look.css', R), 'utf8');
const KIDS_CSS = readFileSync(new URL('css/kids.css', R), 'utf8');
const KIDS_JS = readFileSync(new URL('js/kids/view.js', R), 'utf8');

function makeEl(tag) {
  const node = {
    tagName: tag, type: '', className: '', _text: '', style: {}, attrs: {}, children: [], parentNode: null, listeners: {}
  };
  Object.defineProperty(node, 'textContent', {
    get() { return node.children.length ? node.children.map(c => c.textContent).join('') : node._text; },
    set(v) { node._text = String(v); node.children = []; }
  });
  node.classList = {
    contains(c) { return node.className.split(/\s+/).filter(Boolean).includes(c); },
    add(c) { if (!node.classList.contains(c)) node.className = (node.className + ' ' + c).trim(); },
    remove(c) { node.className = node.className.split(/\s+/).filter(x => x && x !== c).join(' '); },
    toggle(c, on) {
      const want = on == null ? !node.classList.contains(c) : !!on;
      if (want) node.classList.add(c); else node.classList.remove(c);
      return want;
    }
  };
  node.setAttribute = (k, v) => { node.attrs[k] = String(v); };
  node.getAttribute = (k) => (k in node.attrs ? node.attrs[k] : null);
  node.removeAttribute = (k) => { delete node.attrs[k]; };
  node.appendChild = (ch) => { ch.parentNode = node; node.children.push(ch); return ch; };
  node.removeChild = (ch) => { node.children = node.children.filter(x => x !== ch); ch.parentNode = null; };
  node.addEventListener = (t, fn) => { (node.listeners[t] || (node.listeners[t] = [])).push(fn); };
  node.click = () => { (node.listeners.click || []).forEach(fn => fn({ preventDefault() {}, stopPropagation() {} })); };
  node.setPointerCapture = () => {};
  node.querySelector = function (sel) {
    const cls = sel.startsWith('.') ? sel.slice(1) : sel;
    function walk(n, skip) {
      if (!skip && n.classList && n.classList.contains(cls)) return n;
      for (const c of n.children || []) { const h = walk(c, false); if (h) return h; }
      return null;
    }
    return walk(node, true);
  };
  node.querySelectorAll = function (sel) {
    const parts = sel.split(',').map(s => s.trim());
    const out = [];
    function walk(n, skip) {
      if (!skip && parts.some(p => p.startsWith('.') && n.classList && n.classList.contains(p.slice(1)))) out.push(n);
      (n.children || []).forEach(c => walk(c, false));
    }
    walk(node, true);
    return out;
  };
  Object.defineProperty(node, 'innerHTML', {
    configurable: true,
    set(html) {
      node.children = [];
      const re = /class="([^"]+)"/g;
      let m;
      while ((m = re.exec(String(html)))) {
        const child = makeEl('span');
        child.className = m[1];
        node.appendChild(child);
      }
    },
    get() { return ''; }
  });
  return node;
}

const rootEl = makeEl('html');
globalThis.document = {
  createElement: makeEl,
  documentElement: rootEl,
  body: makeEl('body'),
  hidden: false,
  addEventListener: globalThis.addEventListener,
  removeEventListener: globalThis.removeEventListener,
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => []
};

const { layoutSongGrid, jamToggleSlot, JAM_TOGGLE } = await import(`../../js/ui/songgrid.js?v=${V}`);
const { state, shared } = await import(`../../js/state.js?v=${V}`);
const { prog } = await import(`../../js/songs/playback.js?v=${V}`);
const { jamRank } = await import(`../../js/songs/jam.js?v=${V}`);

const ext = () => ({ six: false, min7: false, maj7: false, nine: false });
const chord = (pc, type) => ({ rootPc: pc, type, extensions: ext() });

function songOn(steps) {
  state.style = 'pop';
  state.jam = false;
  shared.kidsView = false;
  shared.U = { title: 'Amazing Grace' };
  prog.list = [{ up: true, name: 'Amazing Grace' }];
  prog.idx = 0;
  prog.model = { key: { pc: 0, mode: 'major' } };
  prog.steps = steps.map(item => ({ item }));
  prog.badges = [];
  const grid = makeEl('div');
  layoutSongGrid(grid);
  return grid;
}
function toggleOf(grid) { return grid.querySelectorAll('.jam-toggle')[0] || null; }
function extras(grid) {
  return grid.querySelectorAll('.ss-jamextra').map(n => ({
    row: n._tc && n._tc.row, hc: n._tc && n._tc.hc, label: n.getAttribute('aria-label')
  }));
}

test('the circle sits in the top cell above B and exposes jam aria', () => {
  assert.deepEqual(JAM_TOGGLE, { row: 'bright', hc: 13, gridRow: 'b', gridColumn: '15 / span 2' });
  assert.equal(jamToggleSlot('bright', 13), true);
  assert.equal(jamToggleSlot('bright', 12), true, 'the half-column between A and B overlaps the circle');
  assert.equal(jamToggleSlot('bright', 14), true);
  assert.equal(jamToggleSlot('sad', 13), false);
  assert.equal(jamToggleSlot('bright', 11), false);
  const grid = songOn([chord(0, 'major'), chord(5, 'major'), chord(7, 'major')]);
  const b = toggleOf(grid);
  assert.ok(b, 'toggle is in the grid');
  assert.equal(b.style.gridRow, 'b');
  assert.equal(b.style.gridColumn, '15 / span 2');
  assert.equal(b.getAttribute('aria-label'), 'Jam: show extra chords');
  assert.equal(b.getAttribute('aria-pressed'), 'false');
  assert.equal(b.textContent, '+');
  assert.equal(b.classList.contains('is-on'), false);
  assert.equal(grid.querySelectorAll('.jam-pill').length, 0);
  assert.equal(extras(grid).length, 0, 'off hides the dashed extras');
  b.click();
  const on = toggleOf(grid);
  assert.equal(state.jam, true);
  assert.equal(on.getAttribute('aria-pressed'), 'true');
  assert.equal(on.getAttribute('aria-label'), 'Jam: show extra chords');
  assert.equal(on.textContent, '\u2212');
  assert.equal(on.classList.contains('is-on'), true);
  const shown = extras(grid);
  assert.ok(shown.length > 0, 'on shows the dashed extras');
  assert.equal(shown.some(c => c.row === 'bright' && Math.abs(c.hc - 13) < 2), false, 'nothing is drawn on the circle');
  assert.ok(shown.some(c => c.label && c.label.startsWith('Am')));
  on.click();
  const off = toggleOf(grid);
  assert.equal(state.jam, false);
  assert.equal(off.getAttribute('aria-pressed'), 'false');
  assert.equal(off.textContent, '+');
  assert.equal(extras(grid).length, 0);
});

test('a jam extra that would occupy the B cell is not drawn, and the others stay put', () => {
  const song = [chord(4, 'minor')];
  const ranked = jamRank({ pc: 0, mode: 'major' }, song);
  const b7 = ranked.find(c => c.rootPc === 11 && c.row === 'bright');
  assert.ok(b7, 'B7 is a ranked extra when Em is in the song');
  assert.equal(b7.hc, 13);
  assert.equal(jamToggleSlot(b7.row, b7.hc), true);
  state.jam = true;
  const grid = songOn(song);
  state.jam = true;
  layoutSongGrid(grid);
  const placed = extras(grid);
  assert.ok(placed.length >= 4, 'the other extras are still placed');
  assert.equal(placed.some(c => c.row === 'bright' && Math.abs(c.hc - 13) < 2), false, 'B7 is not drawn on the circle');
  assert.ok(placed.some(c => c.label && c.label.startsWith('Am')), 'Am stays where takeJam put it');
  const b = toggleOf(grid);
  assert.equal(b.style.gridColumn, '15 / span 2');
  assert.equal(b.getAttribute('aria-pressed'), 'true');
});

test('Kids never gets the circle', () => {
  state.style = 'kids';
  shared.kidsView = true;
  const grid = makeEl('div');
  layoutSongGrid(grid);
  assert.equal(toggleOf(grid), null);
  state.style = 'pop';
  shared.kidsView = false;
  rootEl.classList.add('kv');
  layoutSongGrid(grid);
  assert.equal(toggleOf(grid), null);
  rootEl.classList.remove('kv');
  assert.doesNotMatch(KIDS_CSS, /jam-toggle|jam-pill/);
  assert.doesNotMatch(KIDS_JS, /jam-toggle|jamToggleSlot/);
});

test('the circle is 30 / 28 / 48px, dashed, with a 44px tap that does not grow it', () => {
  assert.match(LOOK, /--jam-d: 48px;/);
  assert.match(LOOK, /html\.expert\.lay-phone-port:where\(:not\(\.kv\)\) #suggest \.jam-toggle,\s*html\.simple\.lay-phone-port:where\(:not\(\.kv\)\) #suggest \.jam-toggle \{ --jam-d: 30px; \}/);
  assert.match(LOOK, /html\.expert\.lay-phone-land:where\(:not\(\.kv\)\) #suggest \.jam-toggle,\s*html\.simple\.lay-phone-land:where\(:not\(\.kv\)\) #suggest \.jam-toggle \{ --jam-d: 28px; \}/);
  assert.match(LOOK, /lay-pad-port:where\(:not\(\.kv\)\) #suggest \.jam-toggle,\s*html\.expert\.lay-pad-land:where\(:not\(\.kv\)\) #suggest \.jam-toggle,\s*html\.simple\.lay-pad-port:where\(:not\(\.kv\)\) #suggest \.jam-toggle,\s*html\.simple\.lay-pad-land:where\(:not\(\.kv\)\) #suggest \.jam-toggle \{ --jam-d: 48px; \}/);
  assert.match(LOOK, /border: 2px dashed currentColor !important;/);
  assert.match(LOOK, /\.jam-toggle\.is-on \{ color: #FFC23D !important;/);
  assert.match(LOOK, /width: 44px; height: 44px;/);
  assert.match(LOOK, /jam-toggle::before[\s\S]*width: var\(--jam-d\) !important; height: var\(--jam-d\) !important;/);
  assert.match(LOOK, /min-height: 0 !important;/);
  assert.doesNotMatch(LOOK, /jam-pill/);
});
