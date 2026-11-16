// v3.2 UI polish (Uiux ux-expert-layout-fixes.md P1-P10): the pure parts.
//  - P4: the Expert song card rows (songCardRows) from the classic song bar's line map, through a real uploaded song
//  - P8: APP_BUILD in js/version.js and tools/write-build.py
//  - Kids: the gold pad's screen-reader label
//  - P1-P7: the CSS values the spec asks for
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import './dom-stub.js';
const R = new URL('../../', import.meta.url), root = R.pathname;
const V = readFileSync(new URL('js/version.js', R), 'utf8').match(/APP_VERSION = "([^"]+)"/)[1];
const html = readFileSync(new URL('index.html', R), 'utf8');
const schemaOf = id => html.match(new RegExp('<script type="application/json" id="' + id + '">([\\s\\S]*?)</script>'))[1];
const realDoc = globalThis.document;
globalThis.document = new Proxy(realDoc, { get: (t, k) => k === 'getElementById' ? (id => /^songSchema(13)?Json$/.test(id) ? { textContent: schemaOf(id) } : t.getElementById(id)) : t[k] });
const M = await import(`../../js/expert/model.js?v=${V}`);
const G = await import(`../../js/kids/grid.js?v=${V}`);

// ---------- P4 (pure) ----------
const SEC = [
  { lyrics: [{ text: 'Hello my friend', markers: [{ charIndex: 0, chordIndex: 0 }, { charIndex: 9, chordIndex: 1 }] }, { text: 'Goodbye now', markers: [{ charIndex: 0, chordIndex: 2 }] }], chords: ['C', 'G', 'Am'], name: 'Verse' },
  { lyrics: [], chords: ['F', 'G'], name: 'Bridge' }
];
const MAP = { seq: [{ si: 0, rep: 0, li: 0 }, { si: 0, rep: 0, li: 1 }, { si: 1, rep: 0, li: -1 }], at: [0, 0, 1, 2, 2] };
const CI = [0, 1, 2, 0, 1];
const rows = (cur, n) => M.songCardRows(MAP, cur, n, cur >= 0 ? CI[cur] : -1, si => SEC[si].lyrics, si => SEC[si].chords, si => SEC[si].name);
test('P4: row 1 = the line being sung with the sung word, row 2 = the next line', () => {
  assert.deepEqual(rows(1, 2), { idx: 0, rows: [{ kind: 'lyric', before: 'Hello my ', word: 'friend', after: '', si: 0 }, { kind: 'text', text: 'Goodbye now', sec: null, si: 0 }] });
  assert.equal(rows(0, 2).rows[0].word, 'Hello');
  assert.equal(rows(-1, 2).rows[0].word, 'Hello', 'not started: the first word, as before');
});
test('P4: the next section with no lyric line shows its chords, prefixed by its name; past the end = empty rows', () => {
  const r = rows(2, 2);
  assert.equal(r.rows[0].kind, 'lyric'); assert.equal(r.rows[0].word, 'Goodbye');
  assert.deepEqual(r.rows[1], { kind: 'chords', chords: [{ t: 'F', on: false }, { t: 'G', on: false }], sec: 'Bridge', si: 1 });
  const last = rows(4, 2);
  assert.deepEqual(last.rows[0], { kind: 'chords', chords: [{ t: 'F', on: false }, { t: 'G', on: true }], sec: null, si: 1 }, 'current chord on the pill');
  assert.deepEqual(last.rows[1], { kind: 'empty' });
});
test('P4: a mark on a space highlights the next word, or the last word when the line ends there', () => {
  const L = [{ text: 'Anh không biết là mơ hay thật ', markers: [{ charIndex: 3, chordIndex: 0 }, { charIndex: 29, chordIndex: 1 }] }];
  const one = ci => M.songCardRows({ seq: [{ si: 0, rep: 0, li: 0 }], at: [0, 0] }, ci, 1, ci, () => L, () => [], () => '').rows[0];
  assert.equal(one(0).word, 'không'); assert.equal(one(0).before + one(0).word + one(0).after, L[0].text);
  assert.equal(one(1).word, 'thật'); assert.equal(one(1).before + one(1).word + one(1).after, L[0].text);
});
test('P4: iPad gets three rows (current + next two)', () => {
  const r = rows(0, 3);
  assert.equal(r.rows.length, 3); assert.equal(r.rows[1].text, 'Goodbye now'); assert.equal(r.rows[2].sec, 'Bridge');
});

// ---------- P4 through the real modules: the card follows the classic song bar's map step by step ----------
const S = await import(`../../js/state.js?v=${V}`); S.boot();
(await import(`../../js/songs/presets.js?v=${V}`)).boot();
const U = await import(`../../js/songs/upload.js?v=${V}`); U.boot();
const FC = await import(`../../js/songs/fullchart.js?v=${V}`);
const SG = await import(`../../js/songs/song.js?v=${V}`);
let LY = null; try { LY = await import(`../../js/ui/lyrics.js?v=${V}`); } catch (e) { LY = null; }
test('P4: with a real uploaded song (anh-v13), every step\'s card row 1 is the classic map\'s line for that step', { skip: !LY && 'lyrics.js needs a DOM here' }, () => {
  // the song as upLoadOne builds it (upBuild), without the UI side effects of a commit (key change, repaint)
  const b = U.upLoadBegin(readFileSync(new URL('tests/fixtures/upload/anh-v13.json', R), 'utf8'), { defer: true });
  const song = b.pending ? b.pending.song : (U.upLoadCheck(b.list, 0), b.list.rows[0].song);
  assert.ok(song, 'fixture checks');
  const { shared } = S; shared.U = U.upBuild(song, {}, {}); shared.U.locked = true; shared.U.liveKey = null;
  const Uo = shared.U, Mp = LY.upLyrMap();
  assert.ok(Uo && Uo.events.length > 10);
  let lyricRows = 0, chordRows = 0, sungWords = 0;
  Uo.events.forEach((e, step) => {
    const card = M.songCardRows(Mp, step, 2, e.ci, (si, rep) => FC.secLyrics(Uo.secs[si], rep), si => Uo.secs[si].chords.map((c, k) => SG.upA(U.upSym(si, k))), U.upSecName);
    const ent = Mp.seq[Mp.at[step]];
    assert.equal(card.idx, Mp.at[step]);
    const r0 = card.rows[0];
    if (ent.li >= 0) {
      lyricRows++;
      const line = FC.secLyrics(Uo.secs[ent.si], ent.rep)[ent.li];
      assert.equal(r0.kind, 'lyric'); assert.equal(r0.before + r0.word + r0.after, line.text, 'row 1 is the whole line, step ' + step);
      if (line.markers.some(m => m.chordIndex === e.ci)) { sungWords++; assert.ok(r0.word.length > 0, 'a sung word on the pill, step ' + step + ' ' + JSON.stringify({ line, ci: e.ci, r0 })); }
    } else {
      chordRows++;
      assert.equal(r0.kind, 'chords'); assert.equal(r0.chords.filter(c => c.on).length, 1);
      assert.equal(r0.chords.find(c => c.on).t, SG.upA(U.upSym(e.si, e.ci)), 'the pill is the chord that plays, step ' + step);
    }
    const nx = Mp.seq[Mp.at[step] + 1];
    if (!nx) assert.equal(card.rows[1].kind, 'empty'); else assert.equal(card.rows[1].si, nx.si);
  });
  assert.ok(lyricRows > 0 && sungWords > 0, `lyric rows ${lyricRows}, sung words ${sungWords}, chord rows ${chordRows}`);
});
test('P4: ui.js builds the card from upLyrMap + songCardRows, with chord names through upA(upSym())', () => {
  const ui = readFileSync(new URL('js/expert/ui.js', R), 'utf8');
  assert.match(ui, /songCardRows\(upLyrMap\(\), cur, nRows, ci,/);
  assert.match(ui, /return upA\(upSym\(si, k\)\);/);
  assert.match(ui, /prefers-reduced-motion: reduce/);
});

// ---------- P8 ----------
test('P8: APP_BUILD defaults to "<APP_VERSION>-web" and the Settings sheet shows it with Copy', () => {
  const vs = readFileSync(new URL('js/version.js', R), 'utf8');
  assert.equal(vs.match(/var APP_BUILD = "([^"]+)";/)[1], V + '-web');
  const ms = readFileSync(new URL('js/ui/modesheet.js', R), 'utf8');
  assert.match(ms, /Build <code id=\\"msBuild\\">" \+ buildEsc\(APP_BUILD\)/);
  assert.match(ms, /data-act=\\"copybuild\\"/);
  assert.match(ms, /navigator\.clipboard\.writeText\(APP_BUILD\)/);
  assert.match(ms, /"Copied"/);
  assert.doesNotMatch(ms, /RC testing/);
});
test('P8: tools/write-build.py rewrites only APP_BUILD (from a name or build.gradle) and rejects bad names', () => {
  const d = mkdtempSync(tmpdir() + '/wb-'); mkdirSync(d + '/js'); mkdirSync(d + '/tools');
  copyFileSync(root + 'js/version.js', d + '/js/version.js'); copyFileSync(root + 'tools/write-build.py', d + '/tools/write-build.py');
  const before = readFileSync(d + '/js/version.js', 'utf8');
  execFileSync('python3', ['tools/write-build.py', '112.13-ranked-v3.2-test.4'], { cwd: d });
  const after = readFileSync(d + '/js/version.js', 'utf8');
  assert.equal(after, before.replace(/var APP_BUILD = "[^"]+";/, 'var APP_BUILD = "112.13-ranked-v3.2-test.4";'));
  writeFileSync(d + '/build.gradle', 'android {\n defaultConfig {\n  versionCode 11\n  versionName "112.13-ranked-v3.2-test.5"\n }\n}\n');
  execFileSync('python3', ['tools/write-build.py', '--gradle', d + '/build.gradle'], { cwd: d });
  assert.match(readFileSync(d + '/js/version.js', 'utf8'), /var APP_BUILD = "112\.13-ranked-v3\.2-test\.5";/);
  assert.equal(execFileSync('python3', ['tools/write-build.py', '--check'], { cwd: d }).toString().trim(), '112.13-ranked-v3.2-test.5');
  assert.throws(() => execFileSync('python3', ['tools/write-build.py', 'bad"name'], { cwd: d, stdio: 'pipe' }));
  assert.ok(readFileSync(d + '/js/version.js', 'utf8').includes('APP_VERSION = "' + V + '"'), 'APP_VERSION untouched');
});

// ---------- Kids ----------
test('Kids: a pad says "major chord"; the gold (next) pad says it plays the song note', () => {
  assert.equal(G.kidsPadLabel('C', false), 'C, major chord');
  assert.equal(G.kidsPadLabel('G', true), 'G, next: plays the song note');
  assert.doesNotMatch(G.kidsPadLabel('G', true), /major chord/);
});

// ---------- P1-P7 CSS ----------
const CSS = readFileSync(new URL('css/expert.css', R), 'utf8');
const tail = CSS.slice(CSS.indexOf('v3.2 UI polish'));
const tailRules = tail.replace(/\/\*[\s\S]*?\*\//g, '');
test('P1-P7: the spec\'s CSS values', () => {
  assert.match(tail, /lay-phone-port #app \{\s*--x-ctl-h: 48px; --x-src-h: 64px; --x-kb-h: clamp\(200px, 30dvh, 260px\);/);
  assert.match(tail, /minmax\(200px, 1fr\) var\(--x-ctl-h\) var\(--x-kb-h\) !important/);
  assert.match(tail, /lay-phone-land #app \{ --x-side: 148px; --x-sus-h: 56px; --x-src-h: 46px; --x-kb-h: clamp\(96px, calc\(100dvh - 270px\), 126px\); \}/);
  assert.match(tail, /lay-phone-land #xCtl \{ grid-template-rows: minmax\(48px, 1fr\) minmax\(48px, 1fr\); \}/);
  assert.match(tail, /\.x-lock::after \{[^}]*width: max\(100%, 48px\); height: max\(100%, 48px\)/);
  assert.match(tail, /html\.expert \.x-lock \{ width: 52px;/); assert.match(tail, /lay-phone-land \.x-lock \{ width: 48px;/);
  assert.match(tail, /\.ss-chip\.borrowed \{ background: rgba\(163, 75, 28, \.07\); border: 1\.5px solid/);
  assert.match(CSS, /--x-wkey-nokey: #E0D8CE;/);
  assert.match(CSS, /--x-wkey-nokey-ink: #6B543E;/);
  assert.match(CSS, /--x-bkey-nokey: #4A4036;/);
  assert.match(CSS, /--x-bkey-nokey-ink: #D7C4AE;/);
  assert.match(tail, /\.pad\.white\.nokey \{ background: var\(--x-wkey-nokey\); color: var\(--x-wkey-nokey-ink\);/);
  assert.match(tail, /\.pad\.black\.nokey \{ background: var\(--x-bkey-nokey\); color: var\(--x-bkey-nokey-ink\); border-color: #A34B1C; box-shadow: none !important; \}/);
  assert.doesNotMatch(tailRules, /env\(safe-area/, 'P2: no new env() padding (native padding is the only inset source)');
});
test('P10: the boot background is the splash colour', () => {
  assert.match(readFileSync(new URL('css/base.css', R), 'utf8'), /html\.tc-boot, html\.tc-boot body \{ background: #F6EFE3; \}/);
});
