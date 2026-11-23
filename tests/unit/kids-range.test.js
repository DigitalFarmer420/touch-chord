import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  KIDS_HOME_LO, KIDS_HOME_HI, KIDS_HOME_MIDI, KIDS_MIN_WHITE_PX, KIDS_MAX_VISIBLE_WHITES,
  kidsNeededMidis, kidsPianoRange, kidsPianoLayout, kidsPadTriadMidis, kidsPadLitMidis,
  isKidsHomeKey, kidsWhiteMidis, kidsWhiteKeyWidth, kidsMaxVisibleWhites
} from '../../js/kids/range.js';

const SRC = readFileSync(new URL('../../js/songs/presets.js', import.meta.url), 'utf8');
const CSS = readFileSync(new URL('../../css/kids.css', import.meta.url), 'utf8');
const STEPS = {};
for (const m of SRC.matchAll(/P\("(Kids [^"]+)", "([^"]+)"\)/g)) {
  STEPS[m[1]] = m[2].split('|').map(s => {
    const off = +s.match(/@(-?\d+)$/)[1];
    const deg = parseInt(s, 10);
    return { item: { mel: off, rootPc: [0, 2, 4, 5, 7, 9, 11][deg - 1], type: 'major' }, bars: 1 };
  });
}
const TEN = ['Kids Twinkle', 'Kids Old MacDonald', 'Kids Itsy Bitsy Spider', 'Kids Row Your Boat', 'Kids Head Shoulders Knees and Toes', "Kids Mary's Lamb", 'Kids Happy Birthday', 'Kids Jingle Bells', 'Kids London Bridge', 'Kids This Old Man'];
const nameOf = m => ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
const INNER = 344; // measured 360-wide portrait piano inner width

const WANT = {
  'Kids Twinkle': { lo: 60, hi: 71, whites: 7, label: 'C4–B4' },
  'Kids Old MacDonald': { lo: 60, hi: 71, whites: 7, label: 'C4–B4' },
  'Kids Itsy Bitsy Spider': { lo: 55, hi: 67, whites: 8, label: 'G3–G4' },
  'Kids Row Your Boat': { lo: 60, hi: 71, whites: 7, label: 'C4–B4' },
  "Kids Mary's Lamb": { lo: 60, hi: 71, whites: 7, label: 'C4–B4' },
  'Kids Head Shoulders Knees and Toes': { lo: 60, hi: 74, whites: 9, label: 'C4–D5' },
  'Kids Happy Birthday': { lo: 55, hi: 67, whites: 8, label: 'G3–G4' },
  'Kids Jingle Bells': { lo: 60, hi: 71, whites: 7, label: 'C4–B4' },
  'Kids London Bridge': { lo: 60, hi: 71, whites: 7, label: 'C4–B4' },
  'Kids This Old Man': { lo: 60, hi: 71, whites: 7, label: 'C4–B4' }
};

test('ten Kids songs: range is the melody, padded to C4–B4 only when narrower than an octave', () => {
  assert.deepEqual(Object.keys(STEPS), TEN);
  for (const name of TEN) {
    const midis = kidsNeededMidis(STEPS[name], 60);
    const R = kidsPianoRange(midis);
    const want = WANT[name];
    assert.equal(R.lo, want.lo, `${name}: lo ${nameOf(R.lo)} want ${want.label}`);
    assert.equal(R.hi, want.hi, `${name}: hi ${nameOf(R.hi)} want ${want.label}`);
    assert.equal(R.whites, want.whites, `${name}: whites ${R.whites}`);
    assert.ok(midis.every(m => m >= R.lo && m <= R.hi), `${name}: a melody pitch sits outside the range`);
    const span = Math.max(...midis) - Math.min(...midis);
    if (span < 12) assert.ok(R.lo <= KIDS_HOME_LO && R.hi >= KIDS_HOME_HI, `${name}: must include C4–B4`);
    else assert.equal(R.lo, want.lo, `${name}: octave-spanning melody should not be padded`);
  }
});

test('Itsy Bitsy and Happy Birthday keep their own G3–G4 range (not padded to B4)', () => {
  for (const name of ['Kids Itsy Bitsy Spider', 'Kids Happy Birthday']) {
    const midis = kidsNeededMidis(STEPS[name], 60);
    assert.equal(Math.min(...midis), 55, name);
    assert.equal(Math.max(...midis), 67, name);
    const R = kidsPianoRange(midis);
    assert.equal(R.lo, 55, name);
    assert.equal(R.hi, 67, name);
    assert.equal(R.whites, 8, name);
    assert.equal(R.count, 13, name);
  }
});

test('min span: a song whose melody is only C4–G4 still gets C4–B4', () => {
  const row = kidsNeededMidis(STEPS['Kids Row Your Boat'], 60);
  const mary = kidsNeededMidis(STEPS["Kids Mary's Lamb"], 60);
  assert.equal(Math.max(...row), 67); // G4
  assert.equal(Math.max(...mary), 67);
  assert.equal(kidsPianoRange(row).hi, 71);
  assert.equal(kidsPianoRange(mary).hi, 71);
  assert.deepEqual(kidsPianoRange([]), { lo: 60, hi: 71, whites: 7, blacks: 5, count: 12 });
});

test('Row Your Boat and Mary\'s Lamb: every pad can light its in-range triad tones', () => {
  for (const name of ['Kids Row Your Boat', "Kids Mary's Lamb"]) {
    const R = kidsPianoRange(kidsNeededMidis(STEPS[name], 60));
    const keys = [];
    for (let m = R.lo; m <= R.hi; m++) keys.push(m);
    const letters = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    for (const [L, pc] of Object.entries(letters)) {
      const triad = kidsPadTriadMidis(pc);
      const lit = kidsPadLitMidis(pc, keys);
      const inRange = triad.filter(m => m >= R.lo && m <= R.hi);
      assert.deepEqual(lit, inRange, `${name} ${L} pad ${triad} lit ${lit}`);
      assert.ok(lit.includes(60 + pc), `${name} ${L} pad does not light its root`);
    }
    // the mockup C4–G4 range would have dropped A4 and B4
    assert.ok(keys.includes(69) && keys.includes(71), `${name} is missing A4/B4`);
  }
});

test('Head Shoulders keeps the full C4–D5 span (15 keys, 9 whites) and fits 360 portrait above 34px', () => {
  const R = kidsPianoRange(kidsNeededMidis(STEPS['Kids Head Shoulders Knees and Toes'], 60));
  assert.equal(R.lo, 60); assert.equal(R.hi, 74);
  assert.equal(R.whites, 9); assert.equal(R.blacks, 6); assert.equal(R.count, 15);
  const L = kidsPianoLayout(R, { innerWidth: INNER, clamp: true, goldMidi: 74 });
  assert.equal(L.clamp, false, 'Head Shoulders must not clamp');
  assert.ok(L.whiteW >= KIDS_MIN_WHITE_PX, `white key ${L.whiteW}px < ${KIDS_MIN_WHITE_PX}`);
  assert.ok(L.whiteW > 36 && L.whiteW < 37, `expected ~36.4px, got ${L.whiteW}`);
});

test('uploaded song wider than 9 whites: clamp keeps keys >= 34px and auto-scrolls to gold, never transposes', () => {
  const midis = [48, 52, 55, 60, 67, 72, 79, 84]; // C3 .. C6
  const R = kidsPianoRange(midis);
  assert.equal(R.lo, 48); assert.equal(R.hi, 84);
  assert.ok(R.whites > KIDS_MAX_VISIBLE_WHITES, `expected a wide span, got ${R.whites} whites`);
  const low = kidsPianoLayout(R, { innerWidth: INNER, clamp: true, goldMidi: 48 });
  const high = kidsPianoLayout(R, { innerWidth: INNER, clamp: true, goldMidi: 84 });
  assert.equal(low.lo, 48); assert.equal(low.hi, 84);
  assert.equal(high.lo, 48); assert.equal(high.hi, 84);
  assert.equal(low.clamp, true); assert.equal(high.clamp, true);
  assert.ok(low.whiteW >= KIDS_MIN_WHITE_PX - 1e-6, `low ${low.whiteW}`);
  assert.ok(high.whiteW >= KIDS_MIN_WHITE_PX - 1e-6, `high ${high.whiteW}`);
  assert.equal(low.scrollLeft, 0);
  assert.ok(high.scrollLeft > 0, 'high gold should scroll right');
  assert.ok(high.scrollLeft <= high.scrollMax + 1e-6);
  const goldLeft = (kidsWhiteMidis(R.lo, R.hi).length - 1) * (high.whiteW + 2);
  assert.ok(goldLeft - high.scrollLeft < high.inner + 1e-6, 'high C6 should stay in view');
  assert.ok(goldLeft + high.whiteW - high.scrollLeft > -1e-6);
  // without clamp (built-in path) the same span is not scrolled
  const raw = kidsPianoLayout(R, { innerWidth: INNER, clamp: false, goldMidi: 84 });
  assert.equal(raw.clamp, false);
  assert.equal(raw.scrollLeft, 0);
});

test('home dot is C4 (MIDI 60) in every song, and the CSS mark uses theme colors', () => {
  for (const name of TEN) {
    const R = kidsPianoRange(kidsNeededMidis(STEPS[name], 60));
    assert.ok(R.lo <= KIDS_HOME_MIDI && R.hi >= KIDS_HOME_MIDI, `${name} does not include C4`);
  }
  assert.equal(isKidsHomeKey(60), true);
  assert.equal(isKidsHomeKey(72), false);
  assert.equal(isKidsHomeKey(55), false);
  assert.match(CSS, /\.kv-wk\.home::after/);
  assert.match(CSS, /border-radius:\s*50%/);
  assert.match(CSS, /background:\s*var\(--ink\)/);
  assert.match(CSS, /var\(--gold-deep\)/);
});

test('max visible whites at 360 portrait is 9, matching Head Shoulders', () => {
  assert.equal(kidsMaxVisibleWhites(INNER), 9);
  assert.equal(KIDS_MAX_VISIBLE_WHITES, 9);
  const w9 = kidsWhiteKeyWidth(9, INNER);
  assert.ok(w9 >= KIDS_MIN_WHITE_PX);
  const w10 = kidsWhiteKeyWidth(10, INNER);
  assert.ok(w10 < KIDS_MIN_WHITE_PX);
});
