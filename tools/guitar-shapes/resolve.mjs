// Resolve a guitar shape for a chord, and run the five verification checks.
import { wrap12, toneSets, formatFrets, formatFingers0 } from "./theory.mjs";
import { INSTRUMENT, OPEN_SHAPES, MOVABLE, SELECTION_RULES, TUNING } from "./shapes-lib.mjs";

const MAX_SPAN = 4;
const MAX_FINGERS = 4;
const MAX_FRET = 15;
const STRING_N = 6; // low E

export { INSTRUMENT, OPEN_SHAPES, MOVABLE, SELECTION_RULES, TUNING };

export function stringIndex(n) { return STRING_N - n; } // 6 -> 0

export function soundingMidis(frets, tuning = TUNING) {
  return frets.map((f, i) => (f < 0 ? null : tuning[i] + f));
}

export function usedFrets(frets) {
  // fretted notes excluding open (0) and muted (-1)
  return frets.filter((f) => f > 0);
}

export function fretSpan(frets) {
  const u = usedFrets(frets);
  if (!u.length) return 0;
  return Math.max(...u) - Math.min(...u);
}

export function fingerCount(fingers, barre) {
  const nums = new Set();
  let illegal = false;
  for (const f of fingers) {
    if (f >= 1 && f <= 4) nums.add(f);
    else if (f > 4) illegal = true;
  }
  if (barre && !nums.has(1)) nums.add(1);
  return illegal ? 99 : nums.size;
}

export function lowestMidi(midis) {
  const xs = midis.filter((m) => m != null);
  return xs.length ? Math.min(...xs) : null;
}

export function describeShape(s) {
  const fr = formatFrets(s.frets);
  const fi = formatFingers0(s.fingers);
  const barre = s.barre ? ` barre ${s.barre.fret}fr strings ${s.barre.fromString}–${s.barre.toString}` : "";
  const pos = s.position != null && s.name && !String(s.name).includes("fr") && s.position > 0
    ? ` · ${s.position}fr` : "";
  return `${s.name || "shape"}${pos} ${fr} fingers ${fi}${barre}${s.simplified ? " [simplified]" : ""}`;
}

function remapNutFingers(frets, fingers, barre) {
  if (!barre || barre.fret !== 0) return { fingers, barre };
  // Nut acts as the barre: drop finger 1 on open strings, drop the barre.
  const f = fingers.map((fi, i) => (frets[i] === 0 && fi === 1 ? 0 : fi));
  return { fingers: f, barre: null };
}

export function instantiateTemplate(t, barreFret) {
  const minBarre = t.minBarre || 0;
  if (barreFret < minBarre) return null;
  const frets = t.relFrets.map((f) => {
    if (f === -1 || f === "x" || f == null) return -1;
    if (typeof f === "string" && f.charAt(0) === "b") {
      const abs = barreFret - parseInt(f.slice(1), 10);
      return abs < 0 ? null : abs;
    }
    return barreFret + f;
  });
  if (frets.some((f) => f == null)) return null;
  if (frets.some((f) => f > MAX_FRET)) return null;
  let fingers = t.fingers.slice();
  let barre = null;
  if (t.barre) {
    barre = {
      fret: barreFret + (t.barre.fret || 0),
      fromString: t.barre.fromString,
      toString: t.barre.toString
    };
    if (barre.fret <= 0) {
      const r = remapNutFingers(frets, fingers, { fret: 0 });
      fingers = r.fingers;
      barre = r.barre;
    }
  } else if (barreFret === 0) {
    fingers = fingers.map((fi, i) => (frets[i] === 0 && fi === 1 ? 0 : fi));
  }
  const name = barreFret > 0 ? `${t.name} · ${barreFret}fr` : (t.name === "E-shape" || t.name === "A-shape" || t.name === "D-shape" ? `Open ${t.name}` : t.name);
  return {
    quality: t.quality,
    name,
    templateName: t.name,
    movable: true,
    position: barreFret,
    frets,
    fingers,
    barre,
    rootString: t.rootString,
    simplified: !!t.simplified,
    notes: t.notes || ""
  };
}

export function rootFretOnString(rootPc, stringNum, tuning = TUNING) {
  // lowest non-negative fret on that string that yields rootPc, plus +12 octaves up to MAX_FRET
  const open = tuning[stringIndex(stringNum)];
  const openPc = wrap12(open);
  let f = wrap12(rootPc - openPc);
  const out = [];
  while (f <= MAX_FRET) {
    out.push(f);
    f += 12;
  }
  return out;
}

function sameQuality(a, b) {
  return a === b || (a === "11" && b === "9sus") || (a === "5" && b === "maj") || (a === "m11" && b === "m9") || (a === "dim6" && b === "dim7");
}

export function openShapesFor(quality, rootPc, bassPc) {
  return OPEN_SHAPES.filter((s) => {
    if (!sameQuality(s.quality, quality)) return false;
    if (s.rootPc !== wrap12(rootPc)) return false;
    const sb = s.bassPc == null ? null : wrap12(s.bassPc);
    const want = bassPc == null ? null : wrap12(bassPc);
    return sb === want;
  }).map((s) => ({ ...s, position: Math.min(...s.frets.filter((f) => f > 0), 0), from: "open" }));
}

export function movableShapesFor(quality, rootPc, bassPc) {
  const out = [];
  for (const t of MOVABLE) {
    if (!sameQuality(t.quality, quality)) continue;
    const frets = rootFretOnString(rootPc, t.rootString);
    for (const f of frets) {
      const inst = instantiateTemplate(t, f);
      if (!inst) continue;
      inst.from = "movable";
      out.push(inst);
    }
  }
  return out;
}

export function checkShape(shape, rootPc, type, ext, bassPc) {
  const issues = [];
  const midis = soundingMidis(shape.frets);
  const pcs = new Set(midis.filter((m) => m != null).map((m) => wrap12(m)));
  const tones = toneSets(rootPc, type, ext, bassPc);
  for (const pc of pcs) {
    if (!tones.allowed.has(pc)) issues.push(`foreign pc ${pc} not in chord tones [${[...tones.allowed].sort()}]`);
  }
  for (const m of tones.must) {
    if (!pcs.has(m.pc)) issues.push(`missing ${m.role} (pc ${m.pc})`);
  }
  const low = lowestMidi(midis);
  if (low == null) issues.push("no sounding notes");
  else {
    const lowPc = wrap12(low);
    const wantBass = tones.bass != null ? tones.bass : tones.rootPc;
    if (lowPc !== wantBass) issues.push(`lowest pc ${lowPc} is not ${tones.bass != null ? "slash bass" : "root"} ${wantBass}`);
  }
  const span = fretSpan(shape.frets);
  if (span > MAX_SPAN) issues.push(`span ${span} > ${MAX_SPAN}`);
  const fingers = fingerCount(shape.fingers, shape.barre);
  if (fingers > MAX_FINGERS) issues.push(`fingers ${fingers} > ${MAX_FINGERS}`);
  const maxF = Math.max(-1, ...shape.frets);
  if (maxF > MAX_FRET) issues.push(`fret ${maxF} > ${MAX_FRET}`);
  // full voicing? every allowed tone except a perfect 5th that is not altered
  const e = tones.ext;
  const fifth = wrap12(rootPc + 7);
  const fifthRequired = e.sharp5 || e.flat5 || type === "dim"; // altered/dim 5ths already in must
  const missingOptional = [];
  for (const pc of tones.allowed) {
    if (pc === fifth && !fifthRequired && !tones.must.some((x) => x.pc === pc)) continue;
    if (tones.bass != null && pc === tones.bass && !tones.must.some((x) => x.pc === pc) && pc !== tones.rootPc) {
      // slash bass is required in the bass already; if it's a chord tone it's fine
    }
    if (!pcs.has(pc) && !tones.must.some((x) => x.pc === pc)) {
      // allowed but not must and not present — only flag as incomplete if it's not the 5th
      if (!(pc === fifth && !fifthRequired)) missingOptional.push(pc);
    }
  }
  const complete = missingOptional.length === 0 && issues.length === 0;
  return { ok: issues.length === 0, issues, span, fingers, midis, pcs: [...pcs].sort((a, b) => a - b), complete, missingOptional };
}

function score(shape, prevFret) {
  const fret = shape.position != null ? shape.position : Math.max(0, ...shape.frets);
  const openBonus = shape.from === "open" || shape.name === "Open" || (shape.movable === false) ? -1000 : 0;
  const close = prevFret == null ? fret : Math.abs(fret - prevFret);
  const nameRank = { "E-shape": 0, "A-shape": 1, "D-shape": 2 }[shape.templateName] ?? 3;
  const simp = shape.simplified ? 500 : 0;
  return openBonus + close * 10 + fret + nameRank + simp;
}

// Search a compact playable grip (used for leftover slashes and rare qualities).
export function searchVoicing(rootPc, type, ext, bassPc, preferLow = true) {
  const tones = toneSets(rootPc, type, ext, bassPc);
  const wantBass = tones.bass != null ? tones.bass : tones.rootPc;
  const must = tones.must.map((m) => m.pc);
  const candidates = [];
  // Bound the search: choose a bass string and bass fret, then fill higher strings within [f0, f0+4] or 0 (open).
  for (let bassStr = 0; bassStr <= 3; bassStr++) {
    for (let bf = 0; bf <= MAX_FRET; bf++) {
      const bassMidi = TUNING[bassStr] + bf;
      if (wrap12(bassMidi) !== wantBass) continue;
      const minF = bf === 0 ? 0 : bf;
      const maxF = Math.min(MAX_FRET, (bf === 0 ? 0 : bf) + MAX_SPAN);
      // For remaining strings, each may be muted, open (0) if 0 is in range logic, or a fret in [minF, maxF] union {0}.
      const higher = 5 - bassStr; // strings after bass
      // We iterate a compact set: for each string, possible frets that produce an allowed pc.
      const opts = [];
      for (let s = bassStr + 1; s < 6; s++) {
        const choices = [-1]; // mute
        const add = (fr) => {
          if (fr < 0 || fr > MAX_FRET) return;
          if (fr > 0 && (fr < (bf || 0) && !(bf === 0) ? false : false)) { /* noop */ }
          const pc = wrap12(TUNING[s] + fr);
          if (tones.allowed.has(pc)) choices.push(fr);
        };
        add(0);
        for (let fr = 1; fr <= MAX_FRET; fr++) {
          if (fr > 0) {
            const used = [bf, fr].filter((x) => x > 0);
            if (used.length && Math.max(...used) - Math.min(...used) > MAX_SPAN) continue;
          }
          add(fr);
        }
        // de-dup
        opts.push([...new Set(choices)]);
      }
      function rec(i, acc) {
        if (candidates.length > 40) return;
        if (i === opts.length) {
          const frets = Array(6).fill(-1);
          frets[bassStr] = bf;
          for (let k = 0; k < acc.length; k++) frets[bassStr + 1 + k] = acc[k];
          const midis = soundingMidis(frets);
          const pcs = new Set(midis.filter((m) => m != null).map((m) => wrap12(m)));
          if ([...pcs].some((p) => !tones.allowed.has(p))) return;
          if (must.some((p) => !pcs.has(p))) return;
          if (wrap12(lowestMidi(midis)) !== wantBass) return;
          if (fretSpan(frets) > MAX_SPAN) return;
          if (Math.max(...frets) > MAX_FRET) return;
          const fing = estimateFingers(frets);
          if (fing.count > MAX_FINGERS) return;
          const missingOptional = [...tones.allowed].filter((pc) => {
            if (pcs.has(pc)) return false;
            if (pc === wrap12(rootPc + 7) && !tones.must.some((x) => x.pc === pc)) return false;
            return !tones.must.some((x) => x.pc === pc);
          });
          candidates.push({
            quality: null,
            name: "Search",
            movable: false,
            from: "search",
            position: Math.min(...frets.filter((f) => f > 0), bf),
            frets,
            fingers: fing.fingers,
            barre: fing.barre,
            simplified: missingOptional.length > 0,
            notes: "fallback search grip"
          });
          return;
        }
        for (const fr of opts[i]) rec(i + 1, acc.concat(fr));
      }
      rec(0, []);
      if (candidates.length > 40) break;
    }
    if (candidates.length > 40) break;
  }
  // Prefer complete, then lower fret, then fewer mutes? more sounding strings
  candidates.sort((a, b) => {
    if (!!a.simplified !== !!b.simplified) return a.simplified ? 1 : -1;
    const fa = a.position, fb = b.position;
    if (fa !== fb) return fa - fb;
    const na = a.frets.filter((f) => f >= 0).length, nb = b.frets.filter((f) => f >= 0).length;
    return nb - na;
  });
  return candidates[0] || null;
}

export function estimateFingers(frets) {
  const used = frets.map((f, i) => ({ f, i })).filter((x) => x.f > 0);
  if (!used.length) return { fingers: frets.map((f) => 0), barre: null, count: 0 };
  const minF = Math.min(...used.map((x) => x.f));
  // If 2+ notes sit at minF and they form a contiguous block from some string, call it a barre.
  const atMin = used.filter((x) => x.f === minF).map((x) => x.i).sort((a, b) => a - b);
  let barre = null;
  const fingers = frets.map((f) => (f <= 0 ? 0 : -1));
  if (atMin.length >= 2) {
    // largest contiguous run
    let best = [atMin[0], atMin[0]];
    let a = atMin[0], prev = atMin[0];
    for (let k = 1; k < atMin.length; k++) {
      if (atMin[k] === prev + 1) { prev = atMin[k]; if (prev - a >= best[1] - best[0]) best = [a, prev]; }
      else { a = prev = atMin[k]; }
    }
    if (best[1] - best[0] >= 1) {
      barre = { fret: minF, fromString: STRING_N - best[0], toString: STRING_N - best[1] };
      for (let i = best[0]; i <= best[1]; i++) if (frets[i] === minF) fingers[i] = 1;
    }
  }
  // Assign 2,3,4 to remaining fretted notes, grouping same-fret adjacent strings.
  let next = 2;
  const leftover = used.filter((_, i) => true).filter((x) => fingers[x.i] === -1);
  leftover.sort((a, b) => a.f - b.f || a.i - b.i);
  const taken = new Set();
  for (const n of leftover) {
    if (fingers[n.i] !== -1) continue;
    if (next > 4) {
      let reused = false;
      for (let i = 0; i < 6; i++) {
        if (frets[i] === n.f && fingers[i] >= 1 && Math.abs(i - n.i) === 1) {
          fingers[n.i] = fingers[i];
          reused = true;
          break;
        }
      }
      if (!reused) {
        return { fingers, barre, count: 99 };
      }
    } else {
      // group adjacent same fret
      fingers[n.i] = next;
      for (let j = n.i + 1; j < 6; j++) {
        if (frets[j] === n.f && fingers[j] === -1) fingers[j] = next;
        else if (frets[j] !== n.f && frets[j] > 0) break;
        else if (frets[j] < 0) break;
      }
      for (let j = n.i - 1; j >= 0; j--) {
        if (frets[j] === n.f && fingers[j] === -1) fingers[j] = next;
        else if (frets[j] !== n.f && frets[j] > 0) break;
        else if (frets[j] < 0) break;
      }
      next++;
    }
  }
  for (let i = 0; i < 6; i++) if (fingers[i] === -1) fingers[i] = 0;
  const count = fingerCount(fingers, barre);
  return { fingers, barre, count };
}

function eRootFret(rootPc) {
  return rootFretOnString(rootPc, 6)[0];
}

function makeSlashShape(name, frets) {
  if (frets.some((f) => f > MAX_FRET || (f < 0 && f !== -1))) return null;
  if (fretSpan(frets) > MAX_SPAN) return null;
  const fing = estimateFingers(frets);
  if (fing.count > MAX_FINGERS) return null;
  const pos = Math.min(...frets.filter((f) => f > 0).concat([0]));
  return {
    quality: null,
    name,
    movable: true,
    from: "slash",
    position: pos,
    frets,
    fingers: fing.fingers,
    barre: fing.barre,
    simplified: false,
    notes: "slash voicing from the E-shape / open shape of the upper chord"
  };
}

// First-inversion, IV/V-style and second-inversion grips derived from the E-shape.
export function eShapeSlashShapes(rootPc, type, bassPc) {
  const R = eRootFret(rootPc);
  const rel = wrap12(bassPc - rootPc);
  const out = [];
  const add = (name, frets) => { const s = makeSlashShape(name, frets); if (s) out.push(s); };
  if (type === "major") {
    if (rel === 4 && R >= 1) add("E-shape /3", [-1, R - 1, R + 2, R + 1, R, R]);
    if (rel === 4 && R === 0) add("E-shape /3", [4, 2, 2, 1, 0, 0]); // E/G#
    if (rel === 2) add("E-shape /2", [R + 2, -1, R + 2, R + 1, R, R]);
    if (rel === 7 && R + 2 <= MAX_FRET) add("E-shape /5", [-1, R + 2, R + 2, R + 1, R, R]);
    if (rel === 7 && R + 7 <= MAX_FRET) add("E-shape /5 bass-6", [R + 7, R + 2, R + 2, R + 1, R, R]);
  }
  if (type === "minor") {
    if (rel === 3) add("E-shape /3", [R + 3, -1, R + 2, R, R, R]);
    if (rel === 2) add("E-shape /2", [R + 2, -1, R + 2, R, R, R]);
    if (rel === 7 && R + 2 <= MAX_FRET) add("E-shape /5", [-1, R + 2, R + 2, R, R, R]);
  }
  return out;
}

// Place the slash bass under a known shape of the upper chord (mute skipped strings).
export function placeBassUnder(shape, bassPc) {
  const out = [];
  for (let s = 0; s <= 3; s++) {
    const openPc = wrap12(TUNING[s]);
    let f = wrap12(bassPc - openPc);
    while (f <= MAX_FRET) {
      const frets = shape.frets.slice();
      for (let i = 0; i < s; i++) frets[i] = -1;
      frets[s] = f;
      const midis = soundingMidis(frets);
      const low = lowestMidi(midis);
      if (low == null || wrap12(low) !== wrap12(bassPc)) { f += 12; continue; }
      if (fretSpan(frets) > MAX_SPAN || Math.max(...frets) > MAX_FRET) { f += 12; continue; }
      const fing = estimateFingers(frets);
      if (fing.count > MAX_FINGERS) { f += 12; continue; }
      const pos = Math.min(...frets.filter((x) => x > 0).concat([0]));
      out.push({
        quality: shape.quality,
        name: (shape.name || "shape") + " + bass",
        movable: !!shape.movable,
        from: "slash",
        position: pos,
        frets,
        fingers: fing.fingers,
        barre: fing.barre,
        simplified: false,
        notes: "named bass placed under a shape of the upper chord"
      });
      f += 12;
    }
  }
  return out;
}

export function resolveChord(spec, prevFret = null) {
  const { quality, rootPc, type, ext, bassPc } = spec;
  const opens = openShapesFor(quality, rootPc, bassPc);
  const movs = movableShapesFor(quality, rootPc, bassPc);
  let all = [...opens, ...movs];
  if (bassPc != null && wrap12(bassPc) !== wrap12(rootPc)) {
    all = all.concat(eShapeSlashShapes(rootPc, type, bassPc));
    const uppers = [
      ...openShapesFor(quality, rootPc, null),
      ...movableShapesFor(quality, rootPc, null)
    ];
    for (const u of uppers) all.push(...placeBassUnder(u, bassPc));
  }
  const passed = [];
  for (const sh of all) {
    const c = checkShape(sh, rootPc, type, ext, bassPc);
    sh._check = c;
    if (c.ok) {
      if (!c.complete) sh.simplified = true;
      passed.push(sh);
    }
  }
  passed.sort((a, b) => score(a, prevFret) - score(b, prevFret));
  if (passed.length) {
    const chosen = passed[0];
    return { ok: true, shape: chosen, check: chosen._check, alternatives: passed.slice(1, 4).map(describeShape), via: chosen.from };
  }
  // Fallback search, including slash-bass placement
  const found = searchVoicing(rootPc, type, ext, bassPc);
  if (found) {
    const c = checkShape(found, rootPc, type, ext, bassPc);
    if (c.ok) {
      if (!c.complete) found.simplified = true;
      return { ok: true, shape: found, check: c, alternatives: [], via: "search" };
    }
  }
  return { ok: false, shape: null, check: { ok: false, issues: ["no playable shape"] }, alternatives: all.slice(0, 3).map((s) => describeShape(s) + (s._check ? " :: " + s._check.issues.join("; ") : "")), via: "none" };
}

export function qualityKeyFromTypeExt(type, ext, slash) {
  // Map type+ext to a shapes quality key
  const e = ext || {};
  const hasMaj7 = !!e.maj7;
  const hasMin7 = !!e.min7 && !hasMaj7;
  const nine = !!e.nine;
  const six = !!e.six && !hasMaj7 && !hasMin7;
  if (e.thirteen && hasMin7) return type === "minor" ? "m13" : "13";
  if (e.flat9 && hasMin7 && type === "major") return "7b9";
  if (e.sharp9 && hasMin7 && type === "major") return "7#9";
  if (e.sharp5 && type === "major" && hasMin7) return "aug7";
  if (e.sharp5 && type === "major" && hasMaj7) return "maj7#5";
  if (e.sharp5 && type === "major") return "aug";
  if (e.flat5 && type === "major" && hasMin7) return "7b5";
  if (e.flat5 && type === "major") return "majb5";
  if (e.sus2 && (type === "major" || type === "minor")) {
    if (hasMaj7) return "maj7sus2";
    if (hasMin7) return "7sus2";
    return "sus2";
  }
  if (type === "sus4") {
    if (hasMin7 && nine) return "9sus";
    if (hasMaj7) return "maj7sus4";
    if (hasMin7) return "7sus4";
    if (six) return "6sus4";
    if (nine) return "sus4add9";
    return "sus4";
  }
  if (hasMaj7 && nine) return type === "minor" ? "mmaj9" : type === "dim" ? "dimMaj9" : "maj9";
  if (hasMin7 && nine) return type === "minor" ? "m9" : type === "dim" ? "m9b5" : "9";
  if (nine) {
    if (six && type === "minor") return "m69";
    if (six) return "69";
    if (type === "minor") return "madd9";
    if (type === "dim") return "dimAdd9";
    return "add9";
  }
  if (hasMaj7) return type === "minor" ? "mmaj7" : type === "dim" ? "dimMaj7" : "maj7";
  if (hasMin7) return type === "minor" ? "m7" : type === "dim" ? "m7b5" : "7";
  if (six) return type === "minor" ? "m6" : type === "dim" ? "dim7" : "6";
  if (type === "minor") return "min";
  if (type === "dim") return "dim";
  return "maj";
}
