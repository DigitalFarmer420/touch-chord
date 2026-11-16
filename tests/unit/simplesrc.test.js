// Simple's Song | Progressions toggle: Expert's #xTog and source reducer in a
// separate in-memory instance, plus the show/hide chrome. No storage of the tab.
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import './dom-stub.js';
const R = new URL('../../', import.meta.url);
const M = await import('../../js/expert/model.js');
const S = await import('../../js/ui/simplesrc.js');
const css = readFileSync(new URL('css/expert.css', R), 'utf8');
const srcJs = readFileSync(new URL('js/ui/simplesrc.js', R), 'utf8');
const ui = readFileSync(new URL('js/expert/ui.js', R), 'utf8');
const main = readFileSync(new URL('js/main.js', R), 'utf8');

test('Simple chrome: Song shows lyrics only when a song is selected; Progressions shows the picker', () => {
  assert.deepEqual(S.simpleSourceChrome('song', true), { showLyrics: true, showProgPicker: false, showEmptySong: false });
  assert.deepEqual(S.simpleSourceChrome('song', false), { showLyrics: false, showProgPicker: false, showEmptySong: true });
  assert.deepEqual(S.simpleSourceChrome('prog', true), { showLyrics: false, showProgPicker: true, showEmptySong: false });
  assert.deepEqual(S.simpleSourceChrome('prog', false), { showLyrics: false, showProgPicker: true, showEmptySong: false });
});

test('Simple reuses Expert sourceInit / sourceReduce: same tab behaviour, no storage key for the view', () => {
  const Rdc = (s, a, ctx) => M.sourceReduce(s, a, ctx);
  assert.deepEqual(M.sourceInit({ hasSong: true, songSelected: true }), { view: 'song', listOpen: false });
  assert.deepEqual(M.sourceInit({ hasSong: false, songSelected: false }), { view: 'prog', listOpen: false });
  assert.deepEqual(Rdc({ view: 'song', listOpen: false }, 'tapProg', { hasSong: true, songSelected: true }), { s: { view: 'prog', listOpen: true }, fx: null });
  assert.equal(Rdc({ view: 'song', listOpen: false }, 'tapSong', { hasSong: true, songSelected: true }).fx, 'openLibrary');
  assert.equal(Rdc({ view: 'prog', listOpen: true }, 'sync', { hasSong: true, songSelected: true }).s.view, 'song');
  assert.match(srcJs, /sourceInit\(srcCtx\(\)/);
  assert.match(srcJs, /sourceReduce\(src,/);
  assert.match(srcJs, /from "\.\.\/expert\/model\.js/);
  assert.doesNotMatch(srcJs, /localStorage/);
  const defaults = M.expertDefaults();
  assert.deepEqual(Object.keys(defaults).sort(), ['look', 'on', 'v']);
});

test('Simple reuses #xTog (not a second track); Kids and classic stay hidden', () => {
  assert.match(srcJs, /\$\("xTog"\)/);
  assert.doesNotMatch(srcJs, /sTog|#sTog/);
  assert.match(ui, /if \(state\.simple\) \{ tapSimpleSrc\(b\.dataset\.v\); return; \}/);
  assert.match(main, /bootSimpleSrc\(\)/);
  assert.match(css, /html:not\(\.expert\):not\(\.simple\) #xTog, html\.kv #xTog \{ display: none !important; \}/);
  assert.doesNotMatch(css, /html:not\(\.expert\) #xTop, html:not\(\.expert\) #xTog,/);
});

test('CSS: Simple #xTog uses --x-row / --x-fs on phones; lyrics hidden in Progressions', () => {
  assert.match(css, /html\.simple \{\n  --x-row: 44px; --x-fs: 15px;/);
  assert.match(css, /html\.simple\.lay-phone-land \{ --x-row: 36px; --x-fs: 13px; \}/);
  assert.match(css, /html\.simple #xTog \{/);
  assert.match(css, /height: var\(--x-row\)/);
  assert.match(css, /font: 700 calc\(var\(--x-fs\) - 1px\) Nunito/);
  assert.match(css, /html\.simple #xTog button\[data-v="song"\] \{ flex: 0\.72 1 0;/);
  assert.match(css, /html\.simple #xTog button\[data-v="prog"\] \{ flex: 1\.38 1 0;/);
  assert.match(css, /html\.expert\.lay-phone-port #xTog button\[data-v="song"\] \{ flex: 0\.72 1 0;/);
  assert.doesNotMatch(css, /html\.simple\.lay-pad-land #xTog/);
  assert.match(css, /html\.simple\.s-src-prog #songBar \{ display: none !important; \}/);
  assert.match(css, /html\.simple\.s-src-song #prog \.pg-sel \{ display: none; \}/);
});
