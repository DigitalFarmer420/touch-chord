// Vinh 2026-11-21: the next-chord / pad-letter name sits inline, immediately right of its lyric word
// (~6 px gap), and the name box is the same height as that lyric line (top and bottom edges aligned).
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const R = new URL('../../', import.meta.url);

const ex = readFileSync(new URL('css/expert.css', R), 'utf8');
const dlg = readFileSync(new URL('css/dialogs.css', R), 'utf8');
const kids = readFileSync(new URL('css/kids.css', R), 'utf8');
const ui = readFileSync(new URL('js/expert/ui.js', R), 'utf8');
const kv = readFileSync(new URL('js/kids/view.js', R), 'utf8');
const sb = readFileSync(new URL('js/ui/songbar.js', R), 'utf8');
const cue = readFileSync(new URL('js/ui/chordcue.js', R), 'utf8');

test('JS: Expert, Kids and Simple always render the name inline beside its word', () => {
  assert.match(ui, /var inl = true;/);
  assert.doesNotMatch(ui, /var inl = !document\.documentElement\.classList\.contains\("lay-phone-port"\)/);
  assert.match(kv, /var inl = true;/);
  assert.doesNotMatch(kv, /var inl = document\.documentElement\.classList\.contains\("lay-pad-port"\)/);
  assert.match(ui, /x-cuetag x-cuein/);
  assert.match(kv, /kv-cuetag kv-cuein/);
  assert.match(sb, /sl-cuetag sl-cuein/);
  assert.match(cue, /export function fitNoteBox/);
  assert.match(cue, /fitNoteBox\(tag\);/);
});

test('CSS: 6px gap, same-height name box, no reserved band above the lyric', () => {
  for (const [name, css, sel] of [
    ['Expert', ex, 'html.expert .x-cuetag.x-cuein'],
    ['Simple', dlg, '#songBar .sl-cuetag.sl-cuein'],
    ['Kids', kids, '.kv-cuetag.kv-cuein']
  ]) {
    const re = new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\{([^}]*)\\}');
    const m = css.match(re);
    assert.ok(m, name + ' cuein rule missing');
    assert.match(m[1], /margin-left: 6px/, name + ' gap');
    assert.match(m[1], /height: 100%/, name + ' height');
    assert.match(m[1], /display: inline-flex/, name + ' inline-flex');
    assert.match(m[1], /align-items: center/, name + ' vertical centre');
    assert.match(m[1], /position: static/, name + ' in the text flow');
  }
  assert.match(ex, /html\.expert\.lay-phone-port #app \{ --x-cb: 0px;/);
  assert.doesNotMatch(kids, /padding-top: 19px;/);
  assert.doesNotMatch(kids, /padding-top: 14px;/);
});
