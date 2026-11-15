// v3.2 guide/tour refresh (after the UI polish, 112.13-ranked-v3.2-test.4): How to text and pictures, tour steps per mode.
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import './dom-stub.js';
const R = new URL('../../', import.meta.url);
const V = readFileSync(new URL('js/version.js', R), 'utf8').match(/APP_VERSION = "([^"]+)"/)[1];
const html = readFileSync(new URL('index.html', R), 'utf8');
const howto = html.slice(html.indexOf('<div id="howto"'), html.indexOf('id="htWordsH"'));
const T = await import(`../../js/ui/tour.js?v=${V}`);

test('How to: 13 pictures, all present, 1170x540, cache tag', () => {
  const imgs = [...howto.matchAll(/<img class="ht-shot" src="(images\/howto-[^"?]+\.webp)\?v=([^"]+)"[^>]*width="1170" height="540"/g)];
  assert.equal(imgs.length, 13);
  imgs.forEach(m => { assert.ok(existsSync(new URL(m[1], R)), m[1]); assert.equal(m[2], V); });
  assert.ok(howto.includes('images/howto-09c-lyrics.webp'));
});
test('How to: names the current modes and controls (no Full mode, chord table or Layout)', () => {
  assert.doesNotMatch(howto, /Full mode|Full Range|chord table|Open <b>Layout<\/b>/);
  for (const k of ['Expert</span></h3>', 'status bar hides', 'swipe down from the top edge', '<b>Copy</b>', 'Lock</b>', 'solid orange edge', 'softly faded',
    'use <b>Keyboard</b>', 'word being sung lit up', 'next line in a lighter color', 'press and hold <b>Kids</b>', 'pick a song from the list'])
    assert.ok(howto.includes(k), k);
});
test('Tour: one list per mode, the classic Kids-style targets gone, each step has text', () => {
  assert.deepEqual(Object.keys(T.TOURS).sort(), ['expert', 'kids', 'simple']);
  for (const [m, steps] of Object.entries(T.TOURS)) {
    assert.ok(steps.length >= 6, m);
    assert.equal(steps[0].sel, null, m + ' opens on the whole screen');
    steps.forEach(s => { assert.ok(s.text && s.text.length < 120, m + ' ' + s.text); if (s.sel) assert.doesNotMatch(s.sel, /ss-kidpad|#kidsLyr|pg-song|pg-sel/); });
  }
  assert.match(T.TOURS.kids[1].text, /next note/);   // the gold pad plays the song note (the screen-reader label says so too)
  assert.ok(T.TOURS.expert.some(s => s.land && /status bar/.test(s.text)), 'Expert: a sideways-only status bar step');
  assert.ok(T.TOURS.expert.some(s => s.sel === '#xKeysChip' && /Keyboard/.test(s.text)), 'Expert: sliding needs the Keyboard view');
});
test('First-launch tour: runs in whatever mode a fresh install opens in (Kids), once', () => {
  const main = readFileSync(new URL('js/main.js', R), 'utf8');
  const line = main.split('\n').find(l => /tourStart\(false\)/.test(l));
  assert.ok(line, 'main.js auto-starts the tour');
  assert.doesNotMatch(line, /expert/, 'the auto-start must not depend on Expert (a first visit opens Kids)');
  assert.match(line, /shared\.firstFresh/, 'only a fresh install (no saved settings)');
  assert.match(line, /!tourDone\(\)/, 'never after the tour was seen');
  const tour = readFileSync(new URL('js/ui/tour.js', R), 'utf8');
  assert.match(tour, /const TOUR_KEY = "touchChord\.tour\.v1"/, 'same seen key as before');
  const st = readFileSync(new URL('js/state.js', R), 'utf8');
  assert.match(st, /if \(!str\) \{[^\n]*shared\.firstFresh = true/, 'firstFresh is set only with no saved settings');
});
