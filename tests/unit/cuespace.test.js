// v3.2 test.5 crowding fix: the next-chord name never touches the line above or the song title, and the rows don't move.
// placeCueTag puts the name in the band its row reserves above the text (phone portrait), and leaves an inline name
// (right of its word: phone landscape, iPad) to the text flow. The CSS reserves the band on every line, always.
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const R = new URL('../../', import.meta.url);
const V = readFileSync(new URL('js/version.js', R), 'utf8').match(/APP_VERSION = "([^"]+)"/)[1];
const C = await import(`../../js/ui/chordcue.js?v=${V}`);
const ex = readFileSync(new URL('css/expert.css', R), 'utf8'), kids = readFileSync(new URL('css/kids.css', R), 'utf8');
const rect = (l, t, w, h) => ({ left: l, top: t, width: w, height: h, right: l + w, bottom: t + h });
function fake({ band, inline }) {
  const styles = new Map();
  const host = { getBoundingClientRect: () => rect(100, 100, 300, 100), clientLeft: 1, clientTop: 1, clientWidth: 298 };
  const row = { getBoundingClientRect: () => rect(110, 130, 280, 20 + band) };
  const word = { getBoundingClientRect: () => rect(200, 130 + band - 1, 40, 22), closest: () => row };
  const tag = { hidden: true, offsetWidth: 24, offsetHeight: 11, style: {}, closest: s => (inline && s === '[data-cue-row]' ? row : null) };
  styles.set(row, { paddingTop: band + 'px', fontSize: '16px' }); styles.set(word, { fontSize: '16px', paddingTop: '0px' });
  globalThis.getComputedStyle = e => styles.get(e) || { paddingTop: '0px', fontSize: '16px' };
  return { host, row, word, tag };
}
test('placeCueTag: a row with a band puts the name 0.5 px under the row top, inside the band, centred on the word', () => {
  const { host, word, tag } = fake({ band: 15 });
  C.placeCueTag(host, word, tag, null);
  assert.equal(tag.hidden, false);
  const [, x, y] = tag.style.transform.match(/translate\((-?[\d.]+)px,(-?[\d.]+)px\)/).map(Number);
  // the containing block starts inside the 1 px border: row top 130 -> 29 + 0.5 inside the host's padding box
  assert.equal(y, 29.5); assert.ok(y + 11 <= 29 + 15 - 3, 'the name ends above the text (3 px for tall marks)');
  assert.equal(x, Math.round(220 - 12 - 101));
});
test('placeCueTag: an inline name (inside its row) is only shown, not moved', () => {
  const { host, word, tag } = fake({ band: 0, inline: true });
  C.placeCueTag(host, word, tag, null);
  assert.equal(tag.hidden, false); assert.equal(tag.style.transform, undefined);
});
test('CSS: phone portrait reserves the band on every Expert line and Kids line; landscape Expert names are inline', () => {
  assert.match(ex, /html\.expert\.lay-phone-port #app \{ --x-cb: 15px; --x-src-h: 92px; \}/);
  assert.match(ex, /html\.expert\.lay-phone-port \.x-lrow \{ padding-top: var\(--x-cb\); \}/);
  assert.match(ex, /\.x-lrows \{ height: calc\(var\(--x-lh1\) \+ var\(--x-lh2\) \* var\(--x-lrn, 1\) \+ var\(--x-cb\) \* \(1 \+ var\(--x-lrn, 1\)\)\); \}/);
  assert.match(ex, /\.x-lroll\.go \{ transform: translateY\(calc\(-1 \* \(var\(--x-lh1\) \+ var\(--x-cb\)\)\)\); \}/);
  assert.match(ex, /html\.expert \.x-cuetag\.x-cuein \{ position: static;/);
  assert.match(kids, /html\.lay-phone-port \.kv-lyr \.kv-l1, html\.lay-phone-port \.kv-lyr \.kv-l2 \{ padding-top: 19px; \}/);
  assert.match(kids, /html\.lay-phone-land \.kv-top \.kv-lyr \.kv-l1 \{ padding-top: 14px; \}/);
  const ui = readFileSync(new URL('js/expert/ui.js', R), 'utf8');
  assert.match(ui, /var inl = !document\.documentElement\.classList\.contains\("lay-phone-port"\);/);
});
