# Shape table changes 2026-11-27 (Musician)
- N38: all 17 D-shape movable templates now use movable fingerings (index 1 on the D-string root, rel-0 strings), so moved D-shapes (e.g. E♭maj7 xx1333 = 1-3-3-3) get correct finger numbers. Open-position chords still compact to standard open fingerings via placeMovable.
- N37: Dm7 xx0211 barre fret 1 s2–1; A13 barre fret 2 s2–1.
- verify.mjs: 315/315, 480/480, 0 failed. shapes.json SHA256 3af903f011d1ac1f0b5ca5ec0313b78642710f16058c5b6ca18d3c5816196ebf
- App sim (.16/.17 resolver, patched guitar-data.js D-shape rows): frets identical for every chord; 166 voicings change fingers only (165 moved D-shapes + open Ddim7 xx0101 G=1,e=2); 0 missing fingers in 480 first + 875 alternates.
- Ready-to-port rows: /workspace/chord-touch/prog15-dev17/scripts/guitar-data.N38-patched.js lines 247–263.
