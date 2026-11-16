// Self-hosted fonts (css/fonts.css) and Vietnamese: reads the cmap of the exact woff2 files that ship.
// Nunito and Andika cover all of Vietnamese. Fredoka has no Vietnamese upstream (Google Fonts ships it
// as latin, latin-ext and hebrew only), so every Fredoka stack must fall back to Nunito, which does.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { brotliDecompressSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const TAGS = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill'];

// WOFF2 (single font): table directory, then one brotli stream with the tables back to back.
// cmap is never transformed, so its bytes are the plain sfnt table.
function woff2Cmap(buf) {
  assert.equal(buf.toString('latin1', 0, 4), 'wOF2');
  const numTables = buf.readUInt16BE(12);
  const compressedLen = buf.readUInt32BE(20);
  let p = 48;
  const base128 = () => { let v = 0; for (let i = 0; i < 5; i++) { const b = buf[p++]; v = v * 128 + (b & 0x7f); if (!(b & 0x80)) return v; } throw new Error('bad UIntBase128'); };
  const tables = [];
  for (let i = 0; i < numTables; i++) {
    const flags = buf[p++];
    let tag = TAGS[flags & 0x3f];
    if ((flags & 0x3f) === 63) { tag = buf.toString('latin1', p, p + 4); p += 4; }
    const version = flags >> 6;
    const orig = base128();
    const transformed = (tag === 'glyf' || tag === 'loca') ? version === 0 : version !== 0;
    const len = transformed ? base128() : orig;
    tables.push({ tag, len });
  }
  const data = brotliDecompressSync(buf.subarray(p, p + compressedLen));
  let off = 0;
  for (const t of tables) { if (t.tag === 'cmap') return data.subarray(off, off + t.len); off += t.len; }
  throw new Error('no cmap');
}

function codepoints(cmap) {
  const out = new Set();
  const n = cmap.readUInt16BE(2);
  for (let i = 0; i < n; i++) {
    const pid = cmap.readUInt16BE(4 + i * 8), eid = cmap.readUInt16BE(6 + i * 8), o = cmap.readUInt32BE(8 + i * 8);
    if (!(pid === 0 || (pid === 3 && (eid === 1 || eid === 10)))) continue;
    const fmt = cmap.readUInt16BE(o);
    if (fmt === 4) {
      const segX2 = cmap.readUInt16BE(o + 6), ends = o + 14, starts = ends + segX2 + 2, deltas = starts + segX2, ro = deltas + segX2;
      for (let s = 0; s < segX2 / 2; s++) {
        const end = cmap.readUInt16BE(ends + s * 2), start = cmap.readUInt16BE(starts + s * 2);
        const delta = cmap.readInt16BE(deltas + s * 2), rangeOff = cmap.readUInt16BE(ro + s * 2);
        for (let c = start; c <= end && c !== 0xffff; c++) {
          let g;
          if (!rangeOff) g = (c + delta) & 0xffff;
          else { const at = ro + s * 2 + rangeOff + (c - start) * 2; g = cmap.readUInt16BE(at); if (g) g = (g + delta) & 0xffff; }
          if (g) out.add(c);
        }
      }
    } else if (fmt === 12) {
      const groups = cmap.readUInt32BE(o + 12);
      for (let g = 0; g < groups; g++) {
        const a = cmap.readUInt32BE(o + 16 + g * 12), b = cmap.readUInt32BE(o + 20 + g * 12);
        for (let c = a; c <= b; c++) out.add(c);
      }
    }
  }
  return out;
}

const fontFiles = Object.fromEntries(readdirSync(join(ROOT, 'fonts')).filter(f => f.endsWith('.woff2')).map(f => [f, codepoints(woff2Cmap(readFileSync(join(ROOT, 'fonts', f))))]));
const SAMPLE = 'Anh đã ổn hơn'.normalize('NFC');
const VIET = (() => {
  const s = new Set('ĐđĂăÂâÊêÔôƠơƯư');
  for (const b of 'aăâeêioôơuưyAĂÂEÊIOÔƠUƯY') for (const t of ['', '\u0300', '\u0301', '\u0309', '\u0303', '\u0323']) s.add((b + t).normalize('NFC'));
  return [...s];
})();
const missing = (cps, str) => [...str].filter(ch => !cps.has(ch.codePointAt(0)));

test('the shipped fonts are the ones css/fonts.css loads', () => {
  const css = readFileSync(join(ROOT, 'css/fonts.css'), 'utf8');
  for (const f of ['nunito-variable.woff2', 'fredoka-variable.woff2', 'andika-400.woff2', 'andika-700.woff2']) {
    assert.ok(css.includes('../fonts/' + f), f);
    assert.ok(fontFiles[f], f);
  }
  assert.equal(VIET.length, 146);
});

for (const f of ['nunito-variable.woff2', 'andika-400.woff2', 'andika-700.woff2']) {
  test(f + ' covers "Anh đã ổn hơn" and every Vietnamese letter with each tone', () => {
    assert.deepEqual(missing(fontFiles[f], SAMPLE), []);
    assert.deepEqual(missing(fontFiles[f], VIET.join('')), []);
    assert.deepEqual(missing(fontFiles[f], '\u0300\u0301\u0303\u0309\u0323'), [], 'combining tone marks for NFD text');
  });
}

test('Fredoka lacks Vietnamese, and every Fredoka stack falls back to Nunito, which covers it', () => {
  const fred = fontFiles['fredoka-variable.woff2'], nun = fontFiles['nunito-variable.woff2'];
  assert.deepEqual(missing(fred, SAMPLE), ['đ', 'ổ', 'ơ'], 'upstream Fredoka has no Vietnamese; update this if a Vietnamese Fredoka ships');
  const both = new Set([...fred, ...nun]);
  assert.deepEqual(missing(both, SAMPLE), []);
  assert.deepEqual(missing(both, VIET.join('')), []);
  const stacks = [];
  for (const f of readdirSync(join(ROOT, 'css')).filter(x => x.endsWith('.css') && x !== 'fonts.css')) {
    for (const m of readFileSync(join(ROOT, 'css', f), 'utf8').matchAll(/Fredoka\s*,\s*([A-Za-z-]+)/g)) stacks.push(f + ':' + m[1]);
  }
  assert.ok(stacks.length > 0);
  assert.deepEqual(stacks.filter(s => !s.endsWith(':Nunito')), []);
});
