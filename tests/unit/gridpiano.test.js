// Expert phone landscape (Vinh, 21 Nov 2026: Galaxy S25 in Brave, ~780x310-360): the chord grid must never spill over
// the piano. The geometry is checked for real in tests/ci/smoke.mjs ("GRID ..."); this guards the CSS rules behind it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const css = readFileSync(new URL('../../css/expert.css', import.meta.url), 'utf8');
const rule = sel => { const i = css.lastIndexOf(sel + ' {'); assert.ok(i >= 0, sel); return css.slice(i, css.indexOf('}', i)); };

test('phone-landscape chord grid rows have no fixed floor (they share the panel instead of spilling)', () => {
  const r = rule('html.expert.lay-phone-land #suggest.ss');
  assert.match(r, /grid-template-rows:/);
  assert.doesNotMatch(r, /minmax\(\s*[1-9]\d*px/, 'a px row floor lets 5 rows run past the panel on short screens');
});

test('phone-landscape piano gives way (down to 72px) before the grid rows drop under 32px', () => {
  const all = [...css.matchAll(/html\.expert\.lay-phone-land #app \{[^}]*--x-kb-h:\s*([^;]+);/g)].map(m => m[1]);
  assert.ok(all.some(v => /clamp\(72px, max\(min\(96px, calc\(calc\(100 \* var\(--tc-dvh\)\) - 257px\)\)/.test(v)), 'kb-h above 348px tall: ' + all.join(' | '));
  assert.ok(all.some(v => /clamp\(72px, calc\(calc\(100 \* var\(--tc-dvh\)\) - 251px\), 96px\)/.test(v)), 'kb-h at 348px tall and under: ' + all.join(' | '));
  assert.ok(!all.some(v => /^\s*96px\s*$/.test(v)), 'no fixed 96px piano in short landscape');
});
