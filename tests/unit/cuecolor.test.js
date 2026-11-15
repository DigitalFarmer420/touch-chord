// v3.2 test.5: the lyric chord-name label uses the same colour as that chord on the grid (Expert / Simple chip
// class, Kids pad letter), not teal, and the name is a little smaller (not below about 11px on a phone).
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const R = new URL('../../', import.meta.url);
const V = readFileSync(new URL('js/version.js', R), 'utf8').match(/APP_VERSION = "([^"]+)"/)[1];
const C = await import(`../../js/ui/chordcue.js?v=${V}`);
const css = f => readFileSync(new URL('css/' + f, R), 'utf8');
const ex = css('expert.css'), kids = css('kids.css'), dlg = css('dialogs.css'), strip = css('strip.css');
const rule = (src, sel) => { const i = src.indexOf(sel + ' {'); assert.ok(i >= 0, 'missing rule ' + sel); return src.slice(i, src.indexOf('}', i) + 1); };
const item = (pc, type, ext = {}) => ({ rootPc: pc, type, extensions: ext });

test('cueChipClass: a chord on the grid takes that chip\'s class (and borrowed when the chip is dashed)', () => {
  const chips = [
    { item: item(0, 'major'), cls: 'major', borrowed: false },
    { item: item(9, 'minor', { min7: true }), cls: 'minor', borrowed: false },
    { item: item(7, 'major', { min7: true }), cls: 'tension', borrowed: false },
    { item: item(10, 'major'), cls: 'color', borrowed: true }
  ];
  assert.equal(C.cueChipClass(item(0, 'major'), chips), 'major');
  assert.equal(C.cueChipClass(item(9, 'minor', { min7: true }), chips), 'minor');
  assert.equal(C.cueChipClass(item(7, 'major', { min7: true }), chips), 'tension');
  assert.equal(C.cueChipClass(item(10, 'major'), chips), 'color borrowed');
  assert.equal(C.cueChipClass(item(0, 'major', { maj7: true }), chips, 'happy'), 'major', 'a quality not on the grid falls back');
});
test('cueChipClass: with no matching chip, the row or the item type uses the strip\'s row-to-class map', () => {
  assert.equal(C.cueRowClass('happy'), 'major');
  assert.equal(C.cueRowClass('sad'), 'minor');
  assert.equal(C.cueRowClass('tension'), 'tension');
  assert.equal(C.cueRowClass('bright', true), 'color borrowed');
  assert.equal(C.cueChipClass(item(2, 'minor'), [], 'sad'), 'minor');
  assert.equal(C.cueChipClass(item(2, 'minor'), []), 'minor', 'minor triad');
  assert.equal(C.cueChipClass(item(11, 'dim'), []), 'tension');
  assert.equal(C.cueChipClass(item(5, 'sus4'), []), 'tension');
  assert.equal(C.cueChipClass(item(0, 'major', { over: 7 }), []), 'tension', 'a slash chord');
  assert.equal(C.cueChipClass(item(0, 'major'), []), 'major');
  assert.equal(C.cueLetterClass('G'), 'kv-padc kv-cueG');
  assert.equal(C.cueLetterClass('C\u266F'), 'kv-padc kv-cueC');
  assert.equal(C.cueLetterClass(''), '');
});
test('Expert / Simple / Kids CSS: the name uses the grid tokens, not teal, and the yellow underline is unchanged', () => {
  assert.match(rule(ex, 'html.expert .x-cuetag.major, html.expert .x-cuetag.color'), /color: var\(--x-happy\)/);
  assert.match(rule(ex, 'html.expert .x-cuetag.minor'), /color: var\(--x-sad\)/);
  assert.match(rule(ex, 'html.expert .x-cuetag.tension, html.expert .x-cuetag.dim'), /color: var\(--x-tension\)/);
  assert.match(rule(ex, 'html.expert .x-cuetag.borrowed'), /color: var\(--x-borrow\)/);
  assert.match(ex, /html\.expert\.x-day \.x-cuetag\.major:not\(\.soon\), html\.expert\.x-day \.x-cuetag\.color:not\(\.soon\) \{ color: color-mix\(in srgb, var\(--x-happy\) 55%, #22180f\); \}/);
  assert.match(ex, /html\.expert\.x-day \.x-cuetag\.minor:not\(\.soon\) \{ color: color-mix\(in srgb, var\(--x-sad\) 60%, #22180f\); \}/);
  assert.match(ex, /html\.expert\.x-lamp \.x-cuetag\.tension:not\(\.soon\), html\.expert\.x-lamp \.x-cuetag\.dim:not\(\.soon\) \{ color: color-mix\(in srgb, var\(--x-tension\) 60%, #F4EAD9\); \}/);
  assert.doesNotMatch(rule(ex, 'html.expert .x-cuetag'), /--x-next/);
  assert.match(rule(ex, 'html.expert .x-lrow .x-cue'), /underline 2px var\(--x-gold\)/);
  assert.match(rule(strip, '.ss .ss-chip.major'), /background: var\(--lk-e2b15a\)/);
  assert.match(rule(dlg, '#songBar .sl-cuetag.major'), /color: var\(--lk-e2b15a\)/);
  assert.match(rule(dlg, '#songBar .sl-cuetag.minor'), /color: var\(--lk-7d6ea8\)/);
  assert.match(rule(dlg, '#songBar .sl-cuetag.tension'), /color: var\(--lk-2a1f45\)/);
  assert.match(rule(dlg, '#songBar .sl-cuetag.color'), /color: var\(--lk-6a8f7e\)/);
  assert.doesNotMatch(rule(dlg, '#songBar .sl-cuetag'), /--sb-cue/);
  assert.match(rule(kids, '.kv-cuetag.kv-cueC'), /--cue-fill: var\(--C\)/);
  assert.match(rule(kids, '.kv-cuetag.kv-padc'), /color: var\(--cue-fill\)/);
  assert.match(kids, /html:not\(\.kv-lamp\) \.kv-cuetag\.kv-padc:not\(\.soon\) \{ color: color-mix\(in srgb, var\(--cue-fill\) 50%, #2E2016\); \}/);
  assert.match(rule(kids, '.kv-lyr .cue'), /underline 3px var\(--gold\)/);
  const ui = readFileSync(new URL('js/expert/ui.js', R), 'utf8');
  const sb = readFileSync(new URL('js/ui/songbar.js', R), 'utf8');
  const kv = readFileSync(new URL('js/kids/view.js', R), 'utf8');
  assert.match(ui, /cueChipClass\(st && st\.item, stripChips\(activeKey\(\)\), st && st\.row\)/);
  assert.match(sb, /cueChipClass\(st && st\.item, stripChips\(activeKey\(\)\), st && st\.row\)/);
  assert.match(kv, /cueLetterClass\(cue\.chord\)/);
});
test('the lyric chord name is smaller, and not below about 11px on a phone', () => {
  assert.match(rule(ex, 'html.expert .x-cuetag'), /font: 700 10px\/11px/);          // already at the floor
  assert.match(rule(ex, 'html.expert.lay-pad-port .x-cuetag, html.expert.lay-pad-land .x-cuetag'), /font-size: 11px/); // was 14px
  assert.match(rule(ex, 'html.expert.lay-pad-port .x-cuetag.x-cuein, html.expert.lay-pad-land .x-cuetag.x-cuein'), /font-size: 11px/); // was 13px
  assert.match(rule(kids, '.kv-cuetag'), /font: 700 13px\/15px/);                   // was 16/18
  assert.match(rule(kids, 'html.lay-phone-land .kv-cuetag'), /font-size: 11px/);     // was 12px
  assert.match(rule(kids, 'html.lay-pad-port .kv-cuetag, html.lay-pad-land .kv-cuetag'), /font-size: 14px/); // was 18px
  assert.match(rule(dlg, '#songBar .sl-cuetag'), /font: 700 11px\/12px/);            // already at the floor
  assert.match(rule(dlg, 'html.lay-pad-port #songBar .sl-cuetag, html.lay-pad-land #songBar .sl-cuetag'), /font-size: 12px/); // was 15px
});
