# Touch Chord Expert Guitar — chord-shape table

Approved by Vinh on 2026-11-26 for the planned Expert Guitar tab. Ukulele uses the same data model (G4 C4 E4 A4, reentrant) but is out of scope here.

Source: `DigitalFarmer420/touch-chord`, production **2026.11.24.1** (`5d51e9d`), checkout `/workspace/tc-uiux-v4/base`.

## Instrument profile

| Field | Value |
|---|---|
| Name | guitar |
| Tuning (MIDI) | E2 A2 D3 G3 B3 E4 = 40 45 50 55 59 64 |
| Strings | 6, written low E → high E. String 6 = low E, string 1 = high E. |
| Frets | 21 (verified shapes stay at 15 or under) |

A shape holds frets per string (−1 = muted), fingers 0–4, an optional barre `{fret, fromString, toString}`, a root string, a name (`Open`, `E-shape`, `A-shape`, `D-shape`), and whether it is movable.

## Inventory

- **v3.2 progression menus:** 152 entries (exact). By style/mode:
  - pop: major 11, minor 9
  - jazz: major 10, minor 10
  - rnb: major 9, minor 10
  - ballad: major 10, minor 11
  - reggae: major 8, minor 10
  - funk: major 8, minor 8
  - yogaDeep: major 7, minor 10
  - country: major 9, minor 12
  Menu qualities: 13, 6, 7, 7#9, 7b9, 9, 9sus, add9, dim, m7, m7b5, m9, maj, maj7, maj9, min, mover3, moverV, over3, overV, sus2. Unique symbols across all 12 major and 12 minor keys: 294.
- **Grid chips (Expert strip, all styles including Kids) plus borrowed / extra chips:** 136 chip definitions. Grid qualities: 13, 7, 7#9, 7b9, 9, 9sus, add9, m7, m7b5, m9, maj, maj7, maj9, min, moverV, overV, sus2, sus4. Unique symbols in all keys: 251. Borrowed-chip symbols (dashed / bright): 64.
- **Kids songs (10):** Kids Twinkle, Kids Old MacDonald, Kids Itsy Bitsy Spider, Kids Row Your Boat, Kids Head Shoulders Knees and Toes, Kids Mary's Lamb, Kids Happy Birthday, Kids Jingle Bells, Kids London Bridge, Kids This Old Man. Written qualities: 7, dim, maj, min (52 symbols in 12 major keys). Kids playback rewrites every step to a major triad on the melody note (v103 `kidsMajorStep`); those shown symbols are also 18 (the scale's major triads).
- **Upload parser:** 43 canonical qualities (maj, m, 7, maj7, m7, 9, add9, sus2, sus4, dim, dim7, m7b5, aug, aug7, 6, m6, maj9, m9, 11→9sus, 13, m13, 7b9, 7#9, 7b5, maj7#5, (b5), m(maj7), m(maj9), 7sus4, 9sus, plus slash bass). `#11` and `b13` are accepted then left out. Power-chord `5` is played as major. Slash chords use a bass note on the lowest sounding string.
- **Expert type × extension buttons:** Major / Minor / Sus4 / Dim combined with 6 / min7 / maj7 / 9: maj, min, sus4, dim, 6, m6, 6sus4, dim7, 7, m7, 7sus4, m7b5, maj7, mmaj7, maj7sus4, dimMaj7, add9, madd9, sus4add9, dimAdd9, 9, m9, 9sus, m9b5, maj9, mmaj9, 69, m69.
- **Union of concrete shown symbols** (menus + grid + Kids, all keys): 315.

## Selection rules

1. Prefer a curated open shape when one exists for that exact chord (root, quality, and slash bass).
2. Otherwise instantiate the movable E-shape (root on string 6), A-shape (root on string 5) and D-shape (root on string 4) at every fret where the root string plays the root, and pick the valid shape with the lowest fret. If a previous chord is known, pick the one closest to that fret (ties go to the lower fret, then E, A, D).
3. If a slash chord is not in the curated list, use a voicing of the upper chord whose lowest sounding note is the named bass. Prefer a familiar open inversion when one exists (3rd in the bass: C/E, G/B, D/F#, A/C#, E/G#, F/A, Am/C, Dm/F, Em/G; 5th in the bass: C/G, G/D, D/A, F/C, A/E). For other keys, start from the E-shape of the upper chord at fret R (the fret where the low E string plays the root): major /3 is x (R-1) (R+2) (R+1) R R; minor /3 is (R+3) x (R+2) R R R; major /2 (IV/V) is (R+2) x (R+2) (R+1) R R (F/G = 3x3211 or 333211); minor /2 is (R+2) x (R+2) R R R; /5 is x (R+2) plus the rest of the E-shape (F/C = x33211). Otherwise place the named bass under an existing open or movable shape, muting skipped strings. Keep span <= 4 and fingers <= 4 (a barre counts as one). If the bass cannot sit under a full voicing, keep the bass, the 3rd or sus tone, and the 7th/extension, and mark the grip simplified.
4. A grip is marked simplified when the full set of chord tones (except an omitted perfect 5th) cannot be played under the span/finger/fret limits. The 3rd (or sus tone) and the 7th, when the symbol has one, are never dropped. Altered 5ths (b5, #5) and the dim 5th stay in the grip.

## Open shapes

Strings are low E → high E. `x` = muted, `0` = open. Finger `1`–`4` = index to pinky; `0` = open or muted.

| Chord | Frets | Fingers | Barre | Name | Notes |
|---|---|---|---|---|---|
| C | x32010 | x32010 | — | Open | x32010 |
| D | xx0232 | xx0132 | — | Open |  |
| E | 022100 | 023100 | — | Open |  |
| F | 133211 | 134211 | 1fr s6–1 | Open | E-shape at 1, 134211 |
| G | 320003 | 210003 | — | Open | 320003 / 210003 |
| A | x02220 | x01230 | — | Open |  |
| B | x24442 | x13331 | 2fr s5–1 | A-shape | A-shape at 2; also available as a movable template |
| Am | x02210 | x02310 | — | Open | x02210 / x02310 |
| Dm | xx0231 | xx0231 | — | Open |  |
| Em | 022000 | 023000 | — | Open |  |
| Fm | 133111 | 134111 | 1fr s6–1 | Open |  |
| Bm | x24432 | x13421 | 2fr s5–1 | A-shape |  |
| C7 | x32310 | x32410 | — | Open |  |
| D7 | xx0212 | xx0213 | — | Open |  |
| E7 | 020100 | 020100 | — | Open |  |
| F7 | 131211 | 131211 | 1fr s6–1 | Open |  |
| G7 | 320001 | 320001 | — | Open | 320001 |
| A7 | x02020 | x01030 | — | Open |  |
| B7 | x21202 | x21304 | — | Open |  |
| Am7 | x02010 | x02010 | — | Open | x02010 |
| Dm7 | xx0211 | xx0211 | — | Open | xx0211, finger 1 covers the top two strings |
| Em7 | 020000 | 020000 | — | Open |  |
| Fm7 | 131111 | 131111 | 1fr s6–1 | Open |  |
| Cmaj7 | x32000 | x32000 | — | Open | x32000 |
| Dmaj7 | xx0222 | xx0111 | 2fr s3–1 | Open |  |
| Emaj7 | 021100 | 031200 | — | Open | open 021100; template 0x110x is the movable form |
| Fmaj7 | xx3210 | xx3210 | — | Open | xx3210 |
| Gmaj7 | 320002 | 210003 | — | Open |  |
| Amaj7 | x02120 | x02130 | — | Open |  |
| Cadd9 | x32030 | x21030 | — | Open |  |
| Dadd9 | x54230 | x43120 | — | Open | x54230: root and 3rd on A/D, 9th on the open E |
| Dsus4 | xx0233 | xx0134 | — | Open |  |
| Dsus2 | xx0230 | xx0130 | — | Open |  |
| Asus2 | x02200 | x01200 | — | Open |  |
| Asus4 | x02230 | x01240 | — | Open |  |
| Esus4 | 022200 | 023400 | — | Open |  |
| Esus2 | 024400 | 013400 | — | Open |  |
| Cmaj9 | x32430 | x21430 | — | Open | root, 3, 7, 9; 5th omitted |
| Am9 | x02413 | x02413 | — | Open |  |
| A9 | x0x423 | x0x423 | — | Open | x0x423, 5th omitted so the 9, 3 and b7 all fit |
| Em9 | 020002 | 020003 | — | Open |  |
| E9 | 020102 | 020104 | — | Open |  |
| A13 | x0x422 | x0x411 | — | Open | x0x422: 3, 9, 13; 5th omitted |
| C6 | x32210 | x32410 | — | Open |  |
| Am6 | x02212 | x02314 | — | Open |  |
| Eaug | 032110 | 043120 | — | Open |  |
| Edim | 0120xx | 0120xx | — | Open |  |
| Adim | x0121x | x0132x | — | Open |  |
| Edim7 | 012020 | 012030 | — | Open |  |
| Bdim | x2343x | x1243x | — | A-shape |  |
| G/B | x20003 | x10003 | — | Open | x20003 |
| C/E | 032010 | 032010 | — | Open | 032010 |
| D/F# | 2x0232 | 1x0132 | — | Open | 2x0232 |
| A/C# | x42220 | x31110 | 2fr s4–2 | Open |  |
| E/G# | 422100 | 423100 | — | Open |  |
| F/A | x03211 | x04312 | 1fr s2–1 | Open |  |
| Am/C | x32210 | x32410 | — | Open |  |
| Dm/F | 1x0231 | 1x0231 | — | Open |  |
| Em/G | 322000 | 312000 | — | Open |  |
| C/G | 332010 | 342010 | — | Open |  |
| G/D | xx0003 | xx0003 | — | Open |  |
| F/C | x33211 | x34211 | 1fr s2–1 | Open |  |
| A/E | 002220 | 001230 | — | Open |  |
| D/A | x00232 | x00132 | — | Open |  |

### Pop Four-Chord and Jazz Turnaround (open shapes in C)

Pop Four-Chord (C–G–Am–F) and Jazz Turnaround (Cmaj7–Am7–Dm7–G7), plus Fmaj7 from R&B Classic:

| Chord | Frets | Fingers | Notes |
|---|---|---|---|
| C | x32010 | x32010 | open |
| G | 320003 | 210003 | open |
| Am | x02210 | x02310 | open |
| F | 133211 | 134211 | barre at fret 1 |
| Cmaj7 | x32000 | x32000 | open |
| Am7 | x02010 | x02010 | open |
| Dm7 | xx0211 | xx0211 | finger 1 covers the top two strings |
| G7 | 320001 | 320001 | open |
| Fmaj7 | xx3210 | xx3210 | open |

## Movable templates

Frets are relative to the barre (or nut) fret. E-shape root is on string 6; A-shape on string 5; D-shape on string 4. The nut acts as the barre at fret 0 (no barre finger). Each fret up raises the chord by one half step.

| Quality | Shape | Rel. frets | Fingers | Root string | Notes |
|---|---|---|---|---|---|
| 13 | E-shape | 0x0122 | 101234 | 6 | 0x0122, 5th omitted, has 9 and 13 |
| 13 | A-shape | x0x422 | 010422 | 5 | x0x422, has 9 and 13, 5th omitted; finger 2 bars B+E |
| 13 | D-shape | xx0412 | 000412 | 4 | xx0412 = root, 13, b7, 3; 5th and 9th omitted — marked simplified if no fuller shape exists |
| 6 | E-shape | 0x2120 | 103241 | 6 | 0x2120; 5th on the D string is omitted so the grip stays at 4 fingers when moved |
| 6 | A-shape | x02222 | 013334 | 5 | x02222; finger 3 bars D-G-B, 4 on high E |
| 6 | D-shape | xx0202 | 000102 | 4 | xx0202 = D A B F# |
| 69 | E-shape | 0x2122 | 103244 | 6 | 0x2122, 5th omitted; finger 4 covers 13 and 9 |
| 69 | A-shape | x0x422 | 010422 | 5 | x0x422 = 9th+6th+3rd (A6/9 without 5th) |
| 6sus4 | E-shape | 022220 | 133341 | 6 | 022220; finger 3 bars A-G-B? B is +2, yes 3 bars A,D,G and 4 on B... A D G at +2, B at +2 too. Finger 3 can bar A–B at +2 (4 strings). 2 fingers. |
| 6sus4 | A-shape | x02232 | 012342 | 5 | x02232; finger 2 cannot cover D and E easily. Use 1 2 3 4 2 — 4 fingers if 2 only on one string. D+2 and E+2 can use finger 2 as a jump? No. Finger 3 bars D+G, 4 on B, 2 on E? 4 fingers. |
| 7 | E-shape | 020100 | 131211 | 6 | 020100 |
| 7 | A-shape | x02020 | 012131 | 5 | x02020 |
| 7 | D-shape | xx0212 | 000213 | 4 | xx0212 |
| 7#9 | E-shape | 020103 | 131214 | 6 | 020103 Hendrix |
| 7b5 | E-shape | 010130 | 121341 | 6 | 010130 |
| 7b5 | A-shape | x01023 | 012134 | 5 | x01023 |
| 7b9 | E-shape | 020101 | 131214 | 6 | 020101 |
| 7b9 | A-shape | x0x323 | 010324 | 5 | x0x323 |
| 7sus2 | E-shape | 020400 | 121411 | 6 | 020400; 4 is a stretch of 4 frets |
| 7sus2 | A-shape | x02400 | 012411 | 5 | x02400; has 9/2, b7? G at 0 is b7 of A. Yes. |
| 7sus4 | E-shape | 020200 | 121311 | 6 | 020200 |
| 7sus4 | A-shape | x02030 | 012141 | 5 | x02030 |
| 7sus4 | D-shape | xx0213 | 000214 | 4 | xx0213 |
| 9 | E-shape | 020102 | 131214 | 6 | 020102 |
| 9 | A-shape | x0x423 | 010423 | 5 | x0x423, 5th omitted |
| 9 | A-shape | x0b1000 | 012111 | 5 | C9-grip: D string one fret below the barre. Valid when barre >= 1 (C9 = x32333). |
| 9sus | E-shape | 020202 | 121314 | 6 | 020202 |
| 9sus | A-shape | x02433 | 012433 | 5 | x02433; finger 3 bars B+E |
| add9 | E-shape | 0x2102 | 103214 | 6 | 0x2102 |
| add9 | A-shape | x02420 | 012431 | 5 | x02420 |
| add9 | D-shape | xx0432 | 000432 | 4 | xx0432, has 3rd and 9, 5th as the high D |
| aug | E-shape | 032110 | 143221 | 6 | 032110; finger 2 covers G and B at +1 |
| aug | A-shape | x03221 | 014332 | 5 | x03221; finger 3 covers G+B |
| aug7 | E-shape | 030110 | 141231 | 6 | 030110 |
| aug7 | A-shape | x03021 | 014132 | 5 | x03021 |
| dim | E-shape | 0120xx | 123100 | 6 | 0120xx |
| dim | A-shape | x0121x | 012430 | 5 | x0121x |
| dim | D-shape | xx0131 | 000142 | 4 | xx0131 = D, Ab, D, F |
| dim7 | E-shape | 012020 | 123141 | 6 | 012020 |
| dim7 | A-shape | x01212 | 012324 | 5 | x01212; finger 2 covers D+B? no D is +1, B is +1. Yes finger 2 bars D and B? G is between at +2. Not adjacent. Use 1 0 2 3 2 4 and 2 only on one — 4 fingers: 1,2,3,4. |
| dim7 | D-shape | xx0101 | 000201 | 4 | xx0101 |
| dimAdd9 | E-shape | 0120x2 | 123104 | 6 | 0120x2 |
| dimMaj7 | E-shape | 0110xx | 132100 | 6 | 0110xx (maj7 + dim triad) |
| m13 | E-shape | 0x0022 | 101134 | 6 | 0x0022 |
| m13 | A-shape | x0x412 | 010423 | 5 | x0x412 |
| m6 | E-shape | 0x2020 | 103141 | 6 | 0x2020 |
| m6 | A-shape | x02212 | 013424 | 5 | x02212; pinky covers 6, or 1 3 3 2 4 with 3 on D+G |
| m6 | D-shape | xx0201 | 000201 | 4 | xx0201 |
| m69 | E-shape | 0x2022 | 103144 | 6 | 0x2022 |
| m69 | A-shape | x0x412 | 010423 | 5 | x0x412 |
| m7 | E-shape | 020000 | 131111 | 6 | 020000 |
| m7 | A-shape | x02010 | 013121 | 5 | x02010 |
| m7 | D-shape | xx0211 | 000211 | 4 | xx0211 |
| m7b5 | E-shape | 010030 | 121141 | 6 | 010030 |
| m7b5 | A-shape | x0101x | 012130 | 5 | x0101x |
| m7b5 | D-shape | xx0111 | 000111 | 4 | xx0111 = D, Ab, C, F |
| m9 | E-shape | 020002 | 131114 | 6 | 020002 |
| m9 | A-shape | x0x413 | 010423 | 5 | x0x413 |
| m9 | D-shape | xx0411 | 000411 | 4 | xx0411 = D, B, C, F; finger 1 bars B+E |
| m9b5 | E-shape | 010002 | 121114 | 6 | 010002 |
| m9b5 | A-shape | x01003 | 012114 | 5 | x01003 |
| madd9 | E-shape | 022002 | 134112 | 6 | 022002; finger 2 on the 9, or 1-3-4-1-1-2 |
| madd9 | A-shape | x02410 | 013421 | 5 | x02410 |
| maj | E-shape | 022100 | 134211 | 6 | 022100 |
| maj | A-shape | x02220 | 013331 | 5 | x02220; one finger bars D-G-B |
| maj | D-shape | xx0232 | 000132 | 4 | xx0232 |
| maj7 | E-shape | 0x110x | 102310 | 6 | 0x110x |
| maj7 | A-shape | x02120 | 013241 | 5 | x02120 |
| maj7 | D-shape | xx0222 | 000111 | 4 | xx0222 |
| maj7#5 | E-shape | 0x1110 | 102221 | 6 | 0x1110 |
| maj7#5 | A-shape | x03121 | 014232 | 5 | x03121 |
| maj7sus2 | E-shape | 0x1400 | 102411 | 6 | 0x1400 |
| maj7sus2 | A-shape | x02100 | 013211 | 5 | x02100 = root, 5, maj7, 9 (sus2) |
| maj7sus4 | E-shape | 0x1200 | 102311 | 6 | 0x1200 |
| maj7sus4 | A-shape | x02130 | 013241 | 5 | x02130 |
| maj9 | E-shape | 0x1102 | 102314 | 6 | 0x1102 |
| maj9 | A-shape | x0x424 | 010324 | 5 | x0x424 |
| maj9 | D-shape | xx0422 | 000422 | 4 | xx0422 = D, B, C#, F# |
| majb5 | E-shape | 0121xx | 124300 | 6 | 0121xx |
| majb5 | A-shape | x0122x | 012340 | 5 | x0122x |
| min | E-shape | 022000 | 134111 | 6 | 022000 |
| min | A-shape | x02210 | 013421 | 5 | x02210 |
| min | D-shape | xx0231 | 000231 | 4 | xx0231 |
| mmaj7 | E-shape | 021000 | 132111 | 6 | 021000 |
| mmaj7 | A-shape | x02110 | 014231 | 5 | x02110 |
| mmaj9 | E-shape | 021002 | 132114 | 6 | 021002 |
| mmaj9 | A-shape | x0x414 | 010324 | 5 | x0x414 |
| sus2 | E-shape | 024400 | 123411 | 6 | 024400 |
| sus2 | A-shape | x02200 | 013411 | 5 | x02200 |
| sus2 | D-shape | xx0230 | 000130 | 4 | xx0230 |
| sus4 | E-shape | 022200 | 123411 | 6 | 022200 |
| sus4 | A-shape | x02230 | 012341 | 5 | x02230 |
| sus4 | D-shape | xx0233 | 000134 | 4 | xx0233 |
| sus4add9 | E-shape | 024200 | 124311 | 6 | 024200; has 2 and 4, no 3rd |
| sus4add9 | A-shape | x02430 | 012431 | 5 | x02430 |

Required base set (relative to the barre): E-shape maj 022100, min 022000, 7 020100, m7 020000, maj7 0x110x. A-shape maj x02220, min x02210, 7 x02020, m7 x02010, maj7 x02120.

## Slash-chord rules

If a slash chord is not in the curated list, use a voicing of the upper chord whose lowest sounding note is the named bass. Prefer a familiar open inversion when one exists (3rd in the bass: C/E, G/B, D/F#, A/C#, E/G#, F/A, Am/C, Dm/F, Em/G; 5th in the bass: C/G, G/D, D/A, F/C, A/E). For other keys, start from the E-shape of the upper chord at fret R (the fret where the low E string plays the root): major /3 is x (R-1) (R+2) (R+1) R R; minor /3 is (R+3) x (R+2) R R R; major /2 (IV/V) is (R+2) x (R+2) (R+1) R R (F/G = 3x3211 or 333211); minor /2 is (R+2) x (R+2) R R R; /5 is x (R+2) plus the rest of the E-shape (F/C = x33211). Otherwise place the named bass under an existing open or movable shape, muting skipped strings. Keep span <= 4 and fingers <= 4 (a barre counts as one). If the bass cannot sit under a full voicing, keep the bass, the 3rd or sus tone, and the 7th/extension, and mark the grip simplified.

Curated inversions include G/B x20003, C/E 032010, D/F# 2x0232, plus A/C#, E/G#, F/A, Am/C, Dm/F, Em/G, C/G, G/D, F/C, A/E, D/A.

## Verification

Required open-shape check: PASS.
Inventory symbols resolved: 315/315 passed (0 simplified).
Qualities × 12 roots resolved: 480/480 passed (0 simplified).
Slash chords in the inventory: 49/49 passed (0 simplified).

No exceptions: every inventoried symbol and every quality in all 12 keys received a playable, legal grip.

## Files

See `SHA256SUMS` for hashes of `shapes.json`, `verify.mjs`, `verify-output.txt`, and this table.

