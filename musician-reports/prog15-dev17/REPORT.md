# Touch Chord .17 (PR #68, develop d5707c5, BUILD 2026.11.27.17-d5707c5) guitar diagram check — Musician
Matrix: .17 vs .16 × Day/Night × 360x780, 384x832, 412x915, 780x360, 820x1180 × C cases (pop:6, pop:0, lofi:3, funk:8, rnb:9, jazz:4, jazz:2, rnb:9:1) and E♭ cases (jazz:0, jazz:1, jazz:4, lofi:3, pop:0). Headless Chromium; no device, no listening.

## Pass
- Data unchanged vs .16 (guitar-data/resolve/shapes/presets identical except ?v).
- Day Next: dark #2a231c dots + #8C620C root on white, contrast 5.43 (was cream on white 1.2 in .16). Night Next unchanged (9.62). Live look switch 12→22→12 repaints, no errors.
- Partial barres: .16 had 16–20 barre-end problems per run; .17 has 0 at every size/look. Dm9 x5355x, Bm7♭5, B♭7, Dm7 correct. Fm9 131113 full barre, "1" centered, no clipping. E♭maj7 xx1333 barre ends on dots.
- 0 geometry fails, 0 console errors, all runs (780x360 C rerun without rnb:9:1 clean).
## Findings
- N38 (Musician, fixed in table): moved D-shapes had open fingerings — E♭maj7 xx1333 root unnumbered and barre "1"; 13/480 first shapes + 152/875 alternates. Fixed in shapes-lib; port rows 247–263 from scripts/guitar-data.N38-patched.js. Sim: 0 missing fingers, frets unchanged.
- N39 (Crash): Next shows no finger numbers in Day or Night (guitar.js diaOpts still fing: now).
- N40 (Crash, minor): "Next bigger / fret label easier" barely measurable: Next card 165x149→165x151 at 360, 191x171→191x173 at 412, identical on iPad; fret label 9→9.2px phones, 12.79 iPad unchanged, 7.86 at 780x360 (Next dot r 3.4–4.0px there).
- N41 (Crash/Uiux, minor, pre-existing): Night Now root stays #FFC23D on the cream Now card (1.35:1); Day now uses #8C620C on the same card (4.54).
- Observation: Fm9 barre runs to the e string past the last barre dot with a square end (e is at fret 3); data barres over muted strings (Fmaj9 1x2213, G13, A♭maj7) unchanged.
