# Touch Chord: 15 progressions per style (proposal, not integrated)

Musician, 2026-11-27 (PST). Read-only on the repo: nothing pushed, committed or changed in the app. Not played or listened to.

Source: deploy clone `/workspace/chord-touch/jam-2026.11.27.2/site`, version 2026.11.27.9, commit `0eb1f4d54fc129093fd9134b5fa7a1483587e363` (deployed 2026-11-27 01:35 PST), `js/songs/presets.js` PROG_MENU (sha256 55db4b62…0dc9).

Deliverable: `proposal.json` (sha256 `7a9e13d34347c0dc8e5889054a133dd6759f7c1f5f71328c4a8e4227d51b27a2`). One ranked list of 15 per style, existing + new, each marked `status`.

## Current live counts (named families; mode charts major/minor)

| Style | Families now | Major charts | Minor charts | Added | Total |
|---|---|---|---|---|---|
| Pop | 12 | 11 | 9 | 3 | 15 |
| Jazz | 14 | 10 | 10 | 1 | 15 |
| R&B | 12 | 9 | 10 | 3 | 15 |
| Ballad | 11 | 10 | 11 | 4 | 15 |
| Reggae | 12 | 8 | 10 | 3 | 15 |
| Funk | 10 | 8 | 8 | 5 | 15 |
| Yoga | 10 | 7 | 10 | 5 | 15 |
| Country | 14 | 9 | 12 | 1 | 15 |
| Lofi | 0 | 0 | 0 | 15 | 15 |

Family counts match the earlier v3.1 reference (pop 12, jazz 14, rnb 12, ballad 11, reggae 12, funk 10, yoga 10, country 14). The live menu has 152 mode charts (v3.1 handoff said 154 mode entries; the live menu is the v3.2 export). No style has exactly 10, so "5 more each" and "15 each" disagree: this proposal follows **15 each**, so additions are 3/1/3/4/3/5/5/1, plus 15 for the new Lofi style (40 new in total).

## Schema

```
{
  "steps": "Roman numerals relative to the tonic of the entry's mode; b = flat relative to the MAJOR scale (minor bVI = degree 6 of natural minor). Lower case = minor-family chord (min, m7, m9, madd9, m7b5 'ø7', dim '°'). 'x2' / 'x0.5' = bars (default 1). 'V/3' = 3rd in the bass (app over3), 'IV/V' = bass a whole step above the root (app overV).",
  "appSteps": "Exactly the app's PROG_MENU step strings for that mode (degree quality [xBars]); import these to avoid re-parsing.",
  "mode": "Primary mode of the entry (major when the family has a major chart). Existing families that also have the other mode carry it in otherMode; new entries are single-mode (the app leaves a family out of a mode it has no chart for).",
  "rank": "1 = most popular. Existing order kept from the live menu; new entries inserted by judgment (famous song-cited loops higher)."
}
```

Entry fields: `rank`, `name`, `status` (existing|new), `mode`, `steps` (roman), `appSteps` (exact PROG_MENU strings), `exampleInCAm` (C major / A minor), optional `otherMode` {mode, steps, appSteps, exampleInCAm} for existing two-mode families, `usage` on new entries. Lofi also has `newStyle: true` and `styleNote`.

## Pop (pop): 12 existing + 3 new

| # | Name | Status | Mode | Numerals | Example (C / Am) | Usage |
|---|---|---|---|---|---|---|
| 1 | Pop Four-Chord | existing | major + minor | I–V–vi–IV<br>i–v–bVI–iv | C G Am F<br>Am Em F Dm |  |
| 2 | Pop Turnaround | existing | major + minor | I–vi–IV–V<br>i–bVI–iv–V | C Am F G<br>Am F Dm E |  |
| 3 | Pop Oldies | existing | major | I–vi–ii–V | C Am Dm G |  |
| 4 | Pop Electropop | existing | major + minor | vi–I–IV–V<br>i–bIII–bVI–bVII | Am C F G<br>Am C F G |  |
| 5 | Pop Sensitive | existing | major + minor | I–V–vi–iii<br>i–v–bVI–bIII | C G Am Em<br>Am Em F C |  |
| 6 | Pop Axis | existing | minor | i–bVI–bIII–bVII | Am F C G |  |
| 7 | Pop Plagal | existing | major + minor | I–IV–I–V<br>i–iv–i–V | C F C G<br>Am Dm Am E |  |
| 8 | Pop Wishing Well | **new** | major | vi7–I–Vsus4–II7sus4 | Am7 C Gsus4 D7sus4 | Oasis "Wonderwall" loop, commonly charted Em7-G-Dsus4-A7sus4 (key of G). |
| 9 | Pop Daydream | **new** | major | I–III–IV–iv | C E F Fm | Radiohead "Creep" (G-B-C-Cm): major III and borrowed minor iv. |
| 10 | Pop Climb | existing | major | IV–V–iii–vi | F G Em Am |  |
| 11 | Pop Rock | existing | major + minor | I–bVII–IV–V<br>i–bVII–bVI–V | C Bb F G<br>Am G F E |  |
| 12 | Pop Bounce | existing | major + minor | I–IV–vi–V<br>i–iv–bVI–V | C F Am G<br>Am Dm F E |  |
| 13 | Pop Canon | existing | major + minor | I–V–vi–iii–IV–V<br>i–v–bVI–bIII–iv–v | C G Am Em F G<br>Am Em F C Dm Em |  |
| 14 | Pop Garage | existing | major | I–bVII–IV–bVII | C Bb F Bb |  |
| 15 | Pop Hero | **new** | major | IV–bVI–bVII–I | F Ab Bb C | Genre: the bVI-bVII-I "victory" cadence of pop-rock anthems and game music. |

## Jazz (jazz): 14 existing + 1 new

| # | Name | Status | Mode | Numerals | Example (C / Am) | Usage |
|---|---|---|---|---|---|---|
| 1 | Jazz ii–V–I | existing | major | ii7–V7–Imaj7 | Dm7 G7 Cmaj7 |  |
| 2 | Jazz Minor ii–V–i | existing | minor | iiø7–V7b9–i7 | Bm7b5 E7b9 Am7 |  |
| 3 | Jazz Turnaround | existing | major + minor | Imaj7–vi7–ii7–V7<br>i7–bVImaj7–iiø7–V7b9 | Cmaj7 Am7 Dm7 G7<br>Am7 Fmaj7 Bm7b5 E7b9 |  |
| 4 | Jazz Rhythm | **new** | major | I6–VI7–ii7–V7 | C6 A7 Dm7 G7 | Rhythm changes A section (Gershwin "I Got Rhythm"): I6-VI7-ii7-V7. |
| 5 | Jazz Blues | existing | major | I7–IV7–V7–I7 | C7 F7 G7 C7 |  |
| 6 | Jazz Leaves | existing | major + minor | ii7–V7–Imaj7–IVmaj7–viiø7–III7–vi7 x2<br>iv7–bVII7–bIIImaj7–bVImaj7–iiø7–V7b9–i7 x2 | Dm7 G7 Cmaj7 Fmaj7 Bm7b5 E7 Am7<br>Dm7 G7 Cmaj7 Fmaj7 Bm7b5 E7b9 Am7 |  |
| 7 | Jazz Circle | existing | major + minor | iii7–vi7–ii7–V7–Imaj7<br>v7–i7–iv7–bVII7–bIIImaj7 | Em7 Am7 Dm7 G7 Cmaj7<br>Em7 Am7 Dm7 G7 Cmaj7 |  |
| 8 | Jazz Backdoor | existing | major + minor | iv7–bVII7–Imaj7<br>iv7–bVII7–i7 | Fm7 Bb7 Cmaj7<br>Dm7 G7 Am7 |  |
| 9 | Jazz Slide | existing | major + minor | ii7–bII7–Imaj7–vi7<br>iiø7–bII7–i7–iv7 | Dm7 Db7 Cmaj7 Am7<br>Bm7b5 Bb7 Am7 Dm7 |  |
| 10 | Jazz Lady | existing | major | ii7–V7–Imaj7–IVmaj7–iii7–VI7 | Dm7 G7 Cmaj7 Fmaj7 Em7 A7 |  |
| 11 | Jazz Andalusian | existing | minor | i7–bVIImaj7–bVImaj7–V7 | Am7 Gmaj7 Fmaj7 E7 |  |
| 12 | Jazz Minor Turn | existing | minor | i7–iv7–iiø7–V7b9 | Am7 Dm7 Bm7b5 E7b9 |  |
| 13 | Jazz Bossa | existing | major + minor | Imaj7 x2–II7 x2–ii7–bII7–Imaj7 x2<br>i7 x2–iv7 x2–iiø7–V7b9–i7 x2 | Cmaj7 D7 Dm7 Db7 Cmaj7<br>Am7 Dm7 Bm7b5 E7b9 Am7 |  |
| 14 | Jazz Chain | existing | major | VI7–II7–V7–Imaj7 | A7 D7 G7 Cmaj7 |  |
| 15 | Jazz Modal Vamp | existing | minor | i9 x2–iv9 x2–bii9 x2–i9 x2 | Am9 Dm9 Bbm9 Am9 |  |

## R&B (rnb): 12 existing + 3 new

| # | Name | Status | Mode | Numerals | Example (C / Am) | Usage |
|---|---|---|---|---|---|---|
| 1 | R&B DooWop | existing | major + minor | I–vi–IV–V<br>i–bVI–iv–V | C Am F G<br>Am F Dm E |  |
| 2 | R&B Classic | existing | major + minor | Imaj7–vi7–IVmaj7–V7<br>i7–bVImaj7–iv7–V7 | Cmaj7 Am7 Fmaj7 G7<br>Am7 Fmaj7 Dm7 E7 |  |
| 3 | R&B Together | **new** | minor | bVImaj7–V7–i7–bvii7–bIII7 | Fmaj7 E7 Am7 Gm7 C7 | Grover Washington Jr. & Bill Withers "Just the Two of Us" loop (Dbmaj7-C7-Fm7-Ebm7-Ab7 in F minor). |
| 4 | R&B Neo | existing | major | ii9–V9–Imaj9–vi9 | Dm9 G9 Cmaj9 Am9 |  |
| 5 | R&B Slow Jam | existing | major + minor | IVmaj7–iii7–ii7–Imaj7<br>iv9–bIIImaj9–iiø7–i9 | Fmaj7 Em7 Dm7 Cmaj7<br>Dm9 Cmaj9 Bm7b5 Am9 |  |
| 6 | R&B Church | existing | major + minor | IVmaj9–iii7–vi9–ii9–V9sus–Imaj9<br>bVImaj9–bVII13–i9–iv9–V7#9–i9 | Fmaj9 Em7 Am9 Dm9 G9sus4 Cmaj9<br>Fmaj9 G13 Am9 Dm9 E7#9 Am9 |  |
| 7 | R&B Float | existing | minor | iv9–bVII13–bIIImaj9–bVImaj9 | Dm9 G13 Cmaj9 Fmaj9 |  |
| 8 | R&B Quiet | existing | major + minor | Imaj7–iii7–IVmaj7–V7<br>i7–bIIImaj7–iv7–V7 | Cmaj7 Em7 Fmaj7 G7<br>Am7 Cmaj7 Dm7 E7 |  |
| 9 | R&B Sway | existing | major + minor | Imaj9–IVmaj9–Imaj9–V9<br>i9–iv9–i9–V9 | Cmaj9 Fmaj9 Cmaj9 G9<br>Am9 Dm9 Am9 E9 |  |
| 10 | R&B Ladder | existing | major | vi7–V7–IVmaj7–iii7 | Am7 G7 Fmaj7 Em7 |  |
| 11 | R&B Smooth | existing | major + minor | Imaj9–iii7–vi9–ii9–V13<br>i9–bIIImaj9–bVImaj9–iiø7–V7#9 | Cmaj9 Em7 Am9 Dm9 G13<br>Am9 Cmaj9 Fmaj9 Bm7b5 E7#9 |  |
| 12 | R&B Groove | existing | minor | i9–bVII13–bVImaj9–v7 | Am9 G13 Fmaj9 Em7 |  |
| 13 | R&B ii–V–I | existing | minor | iiø7–V7#9–i9–bVImaj9 | Bm7b5 E7#9 Am9 Fmaj9 |  |
| 14 | R&B Stepping Stones | **new** | major | ii9–iii7–IVmaj7–V13 | Dm9 Em7 Fmaj7 G13 | Genre: stepwise ii-iii-IV-V climb used in neo-soul / R&B grooves. |
| 15 | R&B Soul Light | **new** | major | Imaj7–III7–vi7–IVmaj7 | Cmaj7 E7 Am7 Fmaj7 | Genre: soul/R&B secondary dominant III7 resolving to vi. |

## Ballad (ballad): 11 existing + 4 new

| # | Name | Status | Mode | Numerals | Example (C / Am) | Usage |
|---|---|---|---|---|---|---|
| 1 | Ballad Axis | existing | major + minor | vi–IV–I–V<br>i–bVI–bIII–bVII | Am F C G<br>Am F C G |  |
| 2 | Ballad 50s | existing | major + minor | I–vi–IV–V<br>i–bVI–iv–V | C Am F G<br>Am F Dm E |  |
| 3 | Ballad Steps | existing | major + minor | Iadd9–V/3–vi7–IVadd9<br>i7–bVII–bVIadd9–V | Cadd9 G/B Am7 Fadd9<br>Am7 G Fadd9 E |  |
| 4 | Ballad Lament | existing | minor | i–bVII–bVI–V | Am G F E |  |
| 5 | Ballad Piano | existing | major + minor | I–iii–IV–V<br>i–bIII–iv–V | C Em F G<br>Am C Dm E |  |
| 6 | Ballad Candle | **new** | major | I–iii–vi–V | C Em Am G | Coldplay "Fix You" verse, commonly charted Eb-Gm-Cm-Bb (I-iii-vi-V). |
| 7 | Ballad Echo | **new** | minor | i–bIII–bVII–bVI | Am C G F | Adele "Hello" loop, commonly charted Fm-Ab-Eb-Db (i-bIII-bVII-bVI). |
| 8 | Ballad Tender | existing | major + minor | Iadd9–IVadd9–iv–Iadd9<br>i7–iv7–i7–V | Cadd9 Fadd9 Fm Cadd9<br>Am7 Dm7 Am7 E |  |
| 9 | Ballad Rising | existing | major + minor | IV–V–iii–vi<br>iv–V–bIII–bVI | F G Em Am<br>Dm E C F |  |
| 10 | Ballad Home | existing | major + minor | vi7–ii7–V–Iadd9<br>bVIadd9–iv7–V–i7 | Am7 Dm7 G Cadd9<br>Fadd9 Dm7 E Am7 |  |
| 11 | Ballad Hymn | existing | major + minor | I–IV–I/3–V<br>i–iv–i/3–V | C F C/E G<br>Am Dm Am/C E |  |
| 12 | Ballad Gentle | existing | major + minor | Iadd9–iii–vi7–IVadd9<br>i7–bIIIadd9–bVIadd9–bVII | Cadd9 Em Am7 Fadd9<br>Am7 Cadd9 Fadd9 G |  |
| 13 | Ballad Big Finish | existing | major + minor | IV–IV/V–iii–vi–ii–V–I<br>iv–iv/V–bIII–bVI–ii°–V–i | F F/G Em Am Dm G C<br>Dm Dm/E C F Bdim E Am |  |
| 14 | Ballad Walkdown | **new** | major | I–V/3–vi–V–IV | C G/B Am G F | Genre: descending-bass ballad line (C-G/B-Am-G-F). |
| 15 | Ballad Uphill | **new** | major | I–ii–I/3–IV–V | C Dm C/E F G | Genre: rising-bass hymn/ballad line (C-Dm-C/E-F-G). |

## Reggae (reggae): 12 existing + 3 new

| # | Name | Status | Mode | Numerals | Example (C / Am) | Usage |
|---|---|---|---|---|---|---|
| 1 | Reggae Island Skank | existing | major | I–IV–V–IV | C F G F |  |
| 2 | Reggae Lovers | existing | major + minor | I–vi–IV–V<br>i–bVI–bIII–bVII | C Am F G<br>Am F C G |  |
| 3 | Reggae One Drop | existing | major | I–bVII–IV–I | C Bb F C |  |
| 4 | Reggae Skank I | existing | minor | i–iv–V–iv | Am Dm E Dm |  |
| 5 | Reggae Drop | existing | minor | i–bVII–iv–i | Am G Dm Am |  |
| 6 | Reggae Easy | existing | major + minor | I–IV–V–bVII<br>bVI–bVII–i–iv | C F G Bb<br>F G Am Dm |  |
| 7 | Reggae Roots | existing | major + minor | vi–V–IV–V<br>i–bVII–bVI–bVII | Am G F G<br>Am G F G |  |
| 8 | Reggae Rocksteady | existing | major + minor | I–V–vi–IV<br>i–V–bVI–iv | C G Am F<br>Am E F Dm |  |
| 9 | Reggae Lover | existing | minor | i–bVI–iv–V | Am F Dm E |  |
| 10 | Reggae Sway | existing | major + minor | I–ii–I–IV<br>i–ii7–i–iv | C Dm C F<br>Am Bm7 Am Dm |  |
| 11 | Reggae Ska | existing | major + minor | I x0.5–vi x0.5–ii x0.5–V x0.5<br>i x0.5–iv x0.5–V x0.5–i x0.5 | C Am Dm G<br>Am Dm E Am |  |
| 12 | Reggae Minor Riddim | existing | minor | i–iv–v–iv | Am Dm Em Dm |  |
| 13 | Reggae Sunny | **new** | major | I–iii–IV–ii | C Em F Dm | Genre: I-iii-IV-ii lovers-rock style loop. |
| 14 | Reggae Lazy Day | **new** | major | I–V–ii–IV | C G Dm F | Genre: I-V-ii-IV easy skank loop. |
| 15 | Reggae Night Riddim | **new** | minor | i–bVII–bVI–iv | Am G F Dm | Genre: minor roots riddim stepping down i-bVII-bVI-iv. |

## Funk (funk): 10 existing + 5 new

| # | Name | Status | Mode | Numerals | Example (C / Am) | Usage |
|---|---|---|---|---|---|---|
| 1 | Funk OneFour | existing | major + minor | I9–IV9–I9–V9<br>i7–iv7–i7–V9 | C9 F9 C9 G9<br>Am7 Dm7 Am7 E9 |  |
| 2 | Funk Disco | **new** | minor | i7–bIII–v7–IV | Am7 C Em7 D | Daft Punk "Get Lucky" loop, commonly charted Bm7-D-F#m7-E (B Dorian). |
| 3 | Funk Vamp | existing | major | I7–IV7–I7–V7 | C7 F7 C7 G7 |  |
| 4 | Funk Dorian | existing | minor | i7–IV7–i7–bVII9 | Am7 D7 Am7 G9 |  |
| 5 | Funk Mixo | existing | major | I9–bVII9–IV9–I9 | C9 Bb9 F9 C9 |  |
| 6 | Funk Strut | existing | major + minor | I9–bVII9–IV9–V9<br>i7–bVII9–iv7–V9 | C9 Bb9 F9 G9<br>Am7 G9 Dm7 E9 |  |
| 7 | Funk Breakdown | existing | minor | i9–bVII9–IV9–i9 | Am9 G9 D9 Am9 |  |
| 8 | Funk iiV | existing | major + minor | ii7–V9–I9–IV9<br>iiø7–V9–i7–iv7 | Dm7 G9 C9 F9<br>Bm7b5 E9 Am7 Dm7 |  |
| 9 | Funk Chrome | existing | major + minor | I9–ii7–IV9–V9<br>i7–iiø7–iv7–V9 | C9 Dm7 F9 G9<br>Am7 Bm7b5 Dm7 E9 |  |
| 10 | Funk Cool | existing | major + minor | vi7–ii7–vi7–V9<br>i7–bIIImaj7–iv7–V7#9 | Am7 Dm7 Am7 G9<br>Am7 Cmaj7 Dm7 E7#9 |  |
| 11 | Funk Party | existing | major + minor | I9–IV9–V9–IV9<br>i7–bVImaj7–bVII9–i7 | C9 F9 G9 F9<br>Am7 Fmaj7 G9 Am7 |  |
| 12 | Funk Stomp | **new** | major | I7#9–bIII7–IV7–bVII7 | C7#9 Eb7 F7 Bb7 | Genre: blues-rock/funk riff on I7#9-bIII7-IV7-bVII7. |
| 13 | Funk Elevator | **new** | minor | i7–ii7–bIIImaj7–IV7 | Am7 Bm7 Cmaj7 D7 | Genre: Dorian stepwise climb i7-ii7-bIIImaj7-IV7. |
| 14 | Funk Glide | **new** | minor | i7–IV7–bVII9–bIIImaj7 | Am7 D7 G9 Cmaj7 | Genre: Dorian i7-IV7 moving round the circle to bVII9-bIIImaj7. |
| 15 | Funk Clav Slide | **new** | major | I7–bVII7–bVI7–V7#9 | C7 Bb7 Ab7 G7#9 | Genre: descending dominant-7 line I7-bVII7-bVI7-V7#9 (soul/funk). |

## Yoga (yogaDeep): 10 existing + 5 new

| # | Name | Status | Mode | Numerals | Example (C / Am) | Usage |
|---|---|---|---|---|---|---|
| 1 | Yoga Om | existing | major + minor | Isus2–IVsus2–Isus2–Vsus2<br>i7–iv7–i7–Vsus2 | Csus2 Fsus2 Csus2 Gsus2<br>Am7 Dm7 Am7 Esus2 |  |
| 2 | Yoga Path | existing | major + minor | Isus2–Vsus2–vi7–IVsus2<br>i7–Vsus2–bVIsus2–iv7 | Csus2 Gsus2 Am7 Fsus2<br>Am7 Esus2 Fsus2 Dm7 |  |
| 3 | Yoga Open | existing | major + minor | Isus2–bVIIsus2–IVsus2<br>Isus2–bVIIsus2–IVsus2 | Csus2 Bbsus2 Fsus2<br>Asus2 Gsus2 Dsus2 |  |
| 4 | Yoga Rise | existing | major + minor | IVsus2–Vsus2–Isus2–vi7<br>iv7–Vsus2–i7–bVIsus2 | Fsus2 Gsus2 Csus2 Am7<br>Dm7 Esus2 Am7 Fsus2 |  |
| 5 | Yoga Float | existing | major + minor | Isus2 x2–IVsus2 x2–Vsus2 x2–Isus2 x2<br>i7 x2–iv7 x2–Vsus2 x2–i7 x2 | Csus2 Fsus2 Gsus2 Csus2<br>Am7 Dm7 Esus2 Am7 |  |
| 6 | Yoga Breathe | existing | major + minor | Isus2 x2–Iadd9 x2–IVsus2 x2–Vsus2 x2<br>i7 x2–i9 x2–iv7 x2–Vsus2 x2 | Csus2 Cadd9 Fsus2 Gsus2<br>Am7 Am9 Dm7 Esus2 |  |
| 7 | Yoga Moon | existing | major + minor | ii7 x2–Vsus2 x2–IVsus2 x2–Isus2 x2<br>iv7 x2–bVIIsus2 x2–bIIIsus2 x2–i7 x2 | Dm7 Gsus2 Fsus2 Csus2<br>Dm7 Gsus2 Csus2 Am7 |  |
| 8 | Yoga Still | existing | minor | i9–bVImaj7–bVII6–i9 | Am9 Fmaj7 G6 Am9 |  |
| 9 | Yoga Glow | existing | minor | bVIsus2 x2–bVIIsus2 x2–i7 x4 | Fsus2 Gsus2 Am7 |  |
| 10 | Yoga Sky | existing | minor | i7 x2–bIIIsus2 x2–bVIsus2 x2–bVIIsus2 x2 | Am7 Csus2 Fsus2 Gsus2 |  |
| 11 | Yoga Lotus | **new** | major | Imaj7 x2–IIsus2 x2–vi7 x2–Vsus2 x2 | Cmaj7 Dsus2 Am7 Gsus2 | Genre: Lydian-flavoured ambient pad (major II). |
| 12 | Yoga River | **new** | major | Isus2 x2–vi7 x2–iii7 x2–IVmaj7 x2 | Csus2 Am7 Em7 Fmaj7 | Genre: slow diatonic ambient/meditation pad. |
| 13 | Yoga Dawn | **new** | minor | i9 x2–bIIImaj7 x2–iv7 x2–bVIIsus2 x2 | Am9 Cmaj7 Dm7 Gsus2 | Genre: Aeolian ambient pad. |
| 14 | Yoga Cloud | **new** | minor | i7 x2–bVImaj7 x2–iv9 x2–bIIImaj7 x2 | Am7 Fmaj7 Dm9 Cmaj7 | Genre: Aeolian ambient pad. |
| 15 | Yoga Earth | **new** | minor | i9 x2–ii7 x2–IVsus2 x2–v7 x2 | Am9 Bm7 Dsus2 Em7 | Genre: Dorian ambient pad (major IV colour). |

## Country (country): 14 existing + 1 new

| # | Name | Status | Mode | Numerals | Example (C / Am) | Usage |
|---|---|---|---|---|---|---|
| 1 | Country Three-Chord | existing | major | I–IV–V7–I | C F G7 C |  |
| 2 | Country Story | existing | major + minor | I–vi–IV–V<br>i–bVI–iv–V | C Am F G<br>Am F Dm E |  |
| 3 | Country Back Roads | **new** | major | I–vi–V–IV | C Am G F | John Denver "Take Me Home, Country Roads" verse (G-Em-D-C). |
| 4 | Country Outlaw | existing | minor | i–bVII–bVI–bVII | Am G F G |  |
| 5 | Country Wagon | existing | major + minor | I–V–vi–IV<br>i–V–bVI–iv | C G Am F<br>Am E F Dm |  |
| 6 | Country Train | existing | major + minor | I–IV–V7–vi<br>i–iv–V7–bVII | C F G7 Am<br>Am Dm E7 G |  |
| 7 | Country Classic | existing | minor | i–iv–V–i | Am Dm E Am |  |
| 8 | Country Honky | existing | major + minor | I–IV–V7–IV<br>i–iv–V7–iv | C F G7 F<br>Am Dm E7 Dm |  |
| 9 | Country Holler | existing | minor | i–bIII–bVII–iv | Am C G Dm |  |
| 10 | Country Ramble | existing | major + minor | I–bVII–IV–V<br>i–IV–i–bVII | C Bb F G<br>Am D Am G |  |
| 11 | Country Rag | existing | major + minor | I–VI7–II7–V7<br>i–bVI–ii°–V7 | C A7 D7 G7<br>Am F Bdim E7 |  |
| 12 | Country Sunset | existing | major + minor | I–iii–IV–V7<br>i–bIII–bVI–V7 | C Em F G7<br>Am C F E7 |  |
| 13 | Country Two-Step | existing | major | I–IV–I–V7 | C F C G7 |  |
| 14 | Country Hoedown | existing | minor | i–bVII–V7–i | Am G E7 Am |  |
| 15 | Country Minor Three-Chord | existing | minor | i–iv–i–v | Am Dm Am Em |  |

## Lofi (lofi): 0 existing + 15 new

**Style note (for the default sound):**

- sound: Warm Rhodes-like electric piano (closest existing voice: "epiano"), dark/soft filter, tape-style warmth; rich 7th/9th chords in close or drop voicings, not bright triads.
- tempo: Slow and laid-back: about 70-90 BPM, default ~80 (swung/behind-the-beat feel if the engine supports swing; otherwise straight at ~80).
- drums: Soft, dusty boom-bap: muted kick, gentle snare/rim, light swung hats; low volume under the keys.
- bass: Round, soft sub/electric bass on roots, not busy.
- fx: More reverb and a little delay than Pop (in the range of the R&B preset), warmth around 50-60.
- suggestedPreset: `{"sound":"epiano","bass":true,"voicing":"close","cutoff":0.4,"reverb":0.34,"delay":0.2,"bpm":80,"warmth":60}`
- caveat: Suggested numbers are a starting point modelled on the existing jazz/rnb presets; not listened to. Loudness trim (STYLE_TRIM) must be measured by Crash.

| # | Name | Status | Mode | Numerals | Example (C / Am) | Usage |
|---|---|---|---|---|---|---|
| 1 | Lofi Rainy Day | **new** | major | IVmaj9–iii7–vi9–Imaj7 | Fmaj9 Em7 Am9 Cmaj7 | Genre: IVmaj7-iii7-vi7 lofi/J-pop staple, landing on Imaj7. |
| 2 | Lofi Coffee Shop | **new** | major | ii9–V13–iii7–vi9 | Dm9 G13 Em7 Am9 | Genre: ii-V that dodges to iii-vi, common lofi/neo-soul loop. |
| 3 | Lofi Snow Globe | **new** | minor | i9–bVImaj9–bIIImaj7–V7b9 | Am9 Fmaj9 Cmaj7 E7b9 | Genre: minor lofi loop i9-bVImaj9-bIIImaj7 with V7b9 pull back to i. |
| 4 | Lofi Night Drive | **new** | major | Imaj9–vi9–IVmaj7–iv7 | Cmaj9 Am9 Fmaj7 Fm7 | Genre: borrowed minor iv7 after IVmaj7 (lofi/neo-soul). |
| 5 | Lofi Pillow | **new** | minor | bVImaj7–bVII13–i9–v7 | Fmaj7 G13 Am9 Em7 | Genre: bVI-bVII-i lift with minor v7 (lofi/anime style). |
| 6 | Lofi Rain Window | **new** | major | IVmaj9–iv9–iii7–VI7b9–ii9–V13 | Fmaj9 Fm9 Em7 A7b9 Dm9 G13 | Genre: neo-soul walk-down IV-iv-iii-VI7-ii-V. |
| 7 | Lofi Stargaze | **new** | major | Imaj7–ii7–iii7–IVmaj7 | Cmaj7 Dm7 Em7 Fmaj7 | Genre: stepwise diatonic 7th-chord climb. |
| 8 | Lofi Late Night | **new** | minor | i9–iv9–v7–bVImaj7 | Am9 Dm9 Em7 Fmaj7 | Genre: minor 9th loop i-iv-v-bVI. |
| 9 | Lofi Side Step | **new** | major | ii9–bII7–Imaj9–VI7b9 | Dm9 Db7 Cmaj9 A7b9 | Genre: tritone-sub ii-bII7-I with VI7b9 turnaround (jazz/lofi). |
| 10 | Lofi Slinky | **new** | major | iii7–bIII7–ii7–bII7–Imaj7 | Em7 Eb7 Dm7 Db7 Cmaj7 | Genre: chromatic descending ii-V chain into Imaj7. |
| 11 | Lofi Cat Nap | **new** | major | Imaj7–v7–I9–IVmaj7–iv7 | Cmaj7 Gm7 C9 Fmaj7 Fm7 | Genre: v7-I9 (ii-V of IV) into IVmaj7-iv7, neo-soul/J Dilla-style move. |
| 12 | Lofi Ripple | **new** | major | vi9–II9–v7–I9–IVmaj7 | Am9 D9 Gm7 C9 Fmaj7 | Genre: chain of ii-V moves (vi9-II9, v7-I9) landing on IVmaj7. |
| 13 | Lofi Back Porch | **new** | major | IVmaj7–bVII9–Imaj7–vi7 | Fmaj7 Bb9 Cmaj7 Am7 | Genre: backdoor bVII9 to Imaj7. |
| 14 | Lofi Paper Boat | **new** | minor | i9–IV9–bIIImaj7–bVImaj7 | Am9 D9 Cmaj7 Fmaj7 | Genre: Dorian i9-IV9 into bIIImaj7-bVImaj7. |
| 15 | Lofi Midnight Snack | **new** | minor | iv9–v7–i9–bIIImaj7 | Dm9 Em7 Am9 Cmaj7 | Genre: minor iv9-v7-i9 with bIIImaj7 colour. |

## Validation (`node validate.mjs`)

Checks: 15 per style, ranks 1..15, existing charts byte-identical to live PROG_MENU and none missing; new: 4–8 steps, single mode, every quality in the app's STRIP_QUAL set, no chord twice in a row (incl. loop wrap), no exact chord repeated inside a loop, names and phone labels (feel) unique vs every live family and each other; duplicates vs all 152 live charts (all styles, both modes) and each other, key-agnostic and rotation-aware, both exact and near (same roots with major/minor/dim family, so sus/7/9/slash count as major). WARN lines are informational.

```
WARN pop/Pop Daydream: root +5 semitones appears 2 times (different chord quality/bass)
WARN ballad/Ballad Walkdown: root +7 semitones appears 2 times (different chord quality/bass)
WARN ballad/Ballad Uphill: root +0 semitones appears 2 times (different chord quality/bass)
WARN lofi/Lofi Night Drive: root +5 semitones appears 2 times (different chord quality/bass)
WARN lofi/Lofi Rain Window: root +5 semitones appears 2 times (different chord quality/bass)
WARN lofi/Lofi Cat Nap: root +0 semitones appears 2 times (different chord quality/bass)
WARN lofi/Lofi Cat Nap: root +5 semitones appears 2 times (different chord quality/bass)
WARN subsequence overlap (one loop is a contiguous part of the other): ballad/Ballad Uphill vs existing reggae/Reggae Sway (major)

RESULT: 0 fail, 8 warn; new charts checked: 40; live charts compared: 152; supported qualities: maj min 7 maj7 m7 m7b5 sus4 sus2 add9 madd9 9 maj9 m9 9sus 13 7b9 7#9 7sus4 overV moverV 6 dim over3 mover3
```

## Uncertain / for Crash and Vinh

- Ranking of new entries among existing ones is my judgment (song-cited loops placed higher); existing order is the live menu order.
- Song citations are from widely published chord charts ("commonly charted"); keys/voicings vary by source. Entries without a song say "Genre" only.
- New entries are single-mode (the app leaves a family out of a mode it has no chart for). So each style's major or minor menu alone will show fewer than 15. If Vinh wants 15 in each mode, every new family needs a second chart.
- Lofi needs code beyond data: STYLE_PRESETS/STYLE_TRIM in js/styles.js, a STRIP_SETS palette in js/ui/strip.js, the progFeel prefix regex in presets.js (add Lofi), and the style picker. The preset numbers are a starting point, not listened to.
- sus4 and 7sus4 (Pop Wishing Well) are not used by any live menu chart yet. Both are STRIP_QUAL keys and have guitar shapes in shapes.json; I did not rerun the guitar harness.
- Some new loops overlap existing ones as a contiguous part (see WARN lines), e.g. Ballad Uphill vs Reggae Sway. They are not duplicates under the rules.
- Nothing was played or listened to; no device test.
