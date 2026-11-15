// v3.2 test.5 (Vinh): Simple shows the song's words like Expert's song card: three lines (phone landscape two), the line
// being sung first with its sung word on gold, and Expert's cue (gold underline + the chord name in a band above the
// line, or inline right of the word sideways / iPad). Replaces the one-line bar's inline-name cue for songs with words.
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import './dom-stub.js';
const R = new URL('../../', import.meta.url);
const V = readFileSync(new URL('js/version.js', R), 'utf8').match(/APP_VERSION = "([^"]+)"/)[1];
const cls = new Set();
globalThis.document = new Proxy(globalThis.document, { get: (t, k) => k === 'documentElement' ? { classList: { contains: c => cls.has(c), toggle() {}, add() {}, remove() {} } } : t[k] });
const S = await import(`../../js/ui/songbar.js?v=${V}`);
const dlg = readFileSync(new URL('css/dialogs.css', R), 'utf8'), src = readFileSync(new URL('js/ui/songbar.js', R), 'utf8');

test('without the CSS numbers: three rows upright and on iPad, two in phone landscape', () => {
  cls.clear(); cls.add('lay-phone-port'); assert.equal(S.slRowCount(), 3);
  cls.clear(); cls.add('lay-phone-land'); assert.equal(S.slRowCount(), 2);
  cls.clear(); cls.add('lay-pad-land'); assert.equal(S.slRowCount(), 3);
});
test('row 1: the sung word on gold, the cue word underlined, the name inline only when asked', () => {
  const r = { kind: 'lyric', before: 'Walking ', word: 'down', after: ' the empty street' };
  const cue = { a: 17, b: 22, chord: 'C/G' };   // "empty"
  const above = S.slRowHtml(r, 'cur', cue, false), inl = S.slRowHtml(r, 'cur', cue, true);
  assert.match(above, /^<span class="sl-row cur" data-cue-row><span class="sl-lin">Walking <span class="sl-now">down<\/span> the <span class="sl-cue">empty<\/span> street<\/span><\/span>$/);
  assert.doesNotMatch(above, /sl-cuetag/);
  assert.match(inl, /<span class="sl-cue">empty<\/span><span class="sl-cuetag sl-cuein" aria-hidden="true">C\/G<\/span> street/);
});
test('later rows: muted text with the section when it changes; a chord-only part lists its chords, the sounding one on gold', () => {
  assert.equal(S.slRowHtml({ kind: 'text', text: 'Every window', sec: 'Chorus' }, 'nxt', null, false),
    '<span class="sl-row nxt" data-cue-row><span class="sl-sec">Chorus \u00b7</span> Every window</span>');
  assert.equal(S.slRowHtml({ kind: 'chords', chords: [{ t: 'Am', on: false }, { t: 'F', on: true }] }, 'cur', null, false),
    '<span class="sl-row cur" data-cue-row><span class="sl-lin"><span class="sl-ch">Am</span> <span class="sl-ch sl-now">F</span></span></span>');
});
test('Simple uses its own rows for a song with words (phones and iPad); full mode keeps its two-row bar', () => {
  assert.match(src, /var slyr = on && state\.simple && upLyrMap\(\)\.any;/);
  assert.match(src, /var two = on && !state\.simple && upLyrMap\(\)\.any;/);
  assert.match(src, /if \(slyr\) \{\n    paintSimpleLyr\(bar, cur\);/);
});
test('CSS: three lines (two on short phones and sideways), inline names, gold sung word and underline, grid-coloured name', () => {
  assert.match(dlg, /html\.simple\.up-slyr #app \{ --sl-n: 3; --sl-cb: 0px; --sl-l1: 22px; --sl-l2: 19px;/);
  assert.match(dlg, /@media \(max-height: 819px\) \{\n  html\.simple\.up-slyr\.lay-phone-port #app \{ --sl-n: 2; --ss-rg: 3px; \}/);
  assert.match(dlg, /html\.simple\.up-slyr\.lay-phone-land #app \{ --sl-n: 2; --sl-cb: 0px;/);
  assert.match(dlg, /#songBar \.sl-row \{ display: block; box-sizing: border-box; padding-top: var\(--sl-cb\);/);
  assert.match(dlg, /#songBar \.sl-now \{ background: var\(--sb-gold\);/);
  assert.match(dlg, /#songBar \.sl-cue \{ text-decoration: underline 2px var\(--sb-gold\);/);
  assert.match(dlg, /#songBar \.sl-cuetag\.major \{[^}]*color: var\(--lk-e2b15a\);/);
  assert.match(dlg, /#songBar \.sl-cuetag\.minor \{[^}]*color: var\(--lk-7d6ea8\);/);
});
