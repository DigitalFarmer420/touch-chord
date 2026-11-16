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
  assert.doesNotMatch(css, /s-src-song #prog \.pg-sel/);   // the picker (with the song name) stays in Song view
});

test('Simple source switch (N11): Progressions keeps the selection, Song picks the uploaded song', () => {
  const list = [
    { name: 'I V vi IV', up: false },
    { name: 'vi IV I V', up: false },
    { name: 'Anh Đã Ổn Hơn', up: true },
  ];
  // Like Expert: tapping Progressions never re-picks a row, so the song keeps its step and Play.
  assert.equal(S.simpleSourceIndex('prog', list, 2), 2);
  assert.equal(S.simpleSourceIndex('prog', list, 1), 1);
  // Song view always returns to the uploaded song.
  assert.equal(S.simpleSourceIndex('song', list, 0), 2);
  assert.equal(S.simpleSourceIndex('song', list, 2), 2);
  // No song in the list: both views leave the current row alone.
  const noSong = [{ name: 'I V vi IV' }, { name: 'vi IV I V' }];
  assert.equal(S.simpleSourceIndex('song', noSong, 1), 1);
  assert.equal(S.simpleSourceIndex('prog', noSong, 1), 1);
});

test('Simple toggle (N11): the song walk is saved before a pick and restored on Song', () => {
  const tap = srcJs.slice(srcJs.indexOf('export function tapSimpleSrc'), srcJs.indexOf('export function bootSimpleSrc'));
  // No progSet on the tapProg path: only fx pick / selectSong touch the selection.
  assert.doesNotMatch(tap, /lastProg/);
  assert.match(tap, /function selectSong\(\) \{[\s\S]*progSet\(i\);\s*if \(songWalk\) progWalkTo\(songWalk\);/);
  assert.match(srcJs, /export function noteSimpleSongWalk\(\) \{\s*if \(!simpleOn\(\) \|\| !upSelected\(\)\) return;\s*songWalk = progWalkAt\(\);/);
  const pb = readFileSync(new URL('js/ui/progbar.js', R), 'utf8');
  assert.match(pb, /noteSimpleSongWalk\(\);[^\n]*\n\s*progSet\(next\);/);
});

test('Simple Progressions stepping skips the uploaded song', () => {
  const list = [
    { name: 'I V vi IV' },
    { name: 'vi IV I V' },
    { name: 'Anh Đã Ổn Hơn', up: true },
  ];
  assert.equal(S.simpleProgStepIndex(list, 0, 1), 1);
  assert.equal(S.simpleProgStepIndex(list, 1, 1), 0); // wraps past the song
  assert.equal(S.simpleProgStepIndex(list, 0, -1), 1); // wraps back past the song
  assert.equal(S.simpleProgStepIndex(list, 2, 1), 0);
  assert.equal(S.simpleProgStepIndex(list, 2, -1), 1);
});

test('CSS: narrow Simple toggle tightens padding; the Now row is the same in both views', () => {
  assert.match(css, /@media \(max-width: 370px\) \{\s*html\.simple \{ --x-fs: 13px; \}/);
  assert.match(css, /html\.simple #xTog button\[data-v="song"\],\s*html\.simple #xTog button\[data-v="prog"\] \{ padding: 0 4px; \}/);
  assert.doesNotMatch(css, /s-src-prog #app \{ grid-template-rows/);
  // Expert's 360px split is unchanged (no Expert rule inside the 370px query).
  const narrow = css.match(/@media \(max-width: 370px\) \{([\s\S]*?)\n\}/);
  assert.ok(narrow, 'expected a 370px query');
  assert.doesNotMatch(narrow[1], /html\.expert/);
});

