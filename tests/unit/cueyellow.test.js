// v3.2 test.5 (Vinh, Nov 14): exactly two colour changes, both to the gold the chord grid already uses for the sounding
// chord (Expert --x-gold, defined for Daylight and Lamplight; Kids --gold): the piano's next-key root dot, and the lyric
// next-chord underline. The cue word keeps its own text colour; the small chord name keeps its teal.
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const R = new URL('../../', import.meta.url);
const css = f => readFileSync(new URL('css/' + f, R), 'utf8');
const ex = css('expert.css'), kids = css('kids.css'), dlg = css('dialogs.css');
const rule = (src, sel) => { const i = src.indexOf(sel + ' {'); assert.ok(i >= 0, 'missing rule ' + sel); return src.slice(i, src.indexOf('}', i) + 1); };

test('the grid gold token exists in both Expert looks and is the grid\'s sounding-chord colour', () => {
  assert.match(ex, /html\.expert\.x-lamp \{[^}]*--x-gold: #FFC21A;/);
  assert.match(ex, /html\.expert\.x-day \{[^}]*--x-gold: #FFC21A;/);
  assert.match(ex, /#suggest \.ss-chip\.pg-on, html\.expert #suggest \.ss-note\.pg-on \{ background: var\(--x-gold\)/);
});
test('the Expert piano next-key dot uses --x-gold (was teal --x-next-l)', () => {
  const r = rule(ex, 'html.expert .kb.piano .pad.nx-root::before, html.expert .kb.piano .pad.white.nx-root::before');
  assert.match(r, /background: var\(--x-gold\) !important/);
  assert.doesNotMatch(r, /x-next/);
});
test('the lyric cue underline is gold; the word text is not recoloured; the chord name stays teal', () => {
  assert.match(rule(ex, 'html.expert .x-lrow .x-cue'), /underline 2px var\(--x-gold\)/);
  const soon = rule(ex, 'html.expert .x-lrow .x-cue.soon');
  assert.doesNotMatch(soon, /(^|[^-])color:/); assert.doesNotMatch(soon, /x-next/);
  assert.match(rule(ex, 'html.expert .x-cuetag'), /color: var\(--x-next\)/);
  assert.match(rule(kids, '.kv-lyr .cue'), /underline 3px var\(--gold\)/);
  assert.doesNotMatch(rule(kids, '.kv-lyr .cue.soon'), /(^|[^-])color:/);
  assert.match(rule(kids, '.kv-cuetag'), /color: var\(--cue\)/);
  assert.match(dlg, /#songBar \{ --sb-gold: #FFC21A; \}/);
});
