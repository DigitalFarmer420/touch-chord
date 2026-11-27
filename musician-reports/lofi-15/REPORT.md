# Touch Chord: Lofi to 15 major + 15 minor (data proposal, not integrated)

Musician, 2026-11-27 (PST). Asked by Vinh: "I only see 5 progressions for lofi. Can we make it 15 total?" Read-only on the repo: nothing pushed or changed in the app. Not played or listened to; no device test.

Source: deploy clone `/workspace/chord-touch/jam-2026.11.27.2/site` at `2176a5af1f1f1f3ba600201a84cfa97c033c2f39 Deploy touch-chord develop@6e8a151` (dev 2026.11.27.20).

## Cause

`PROG_MENU.lofi` has 10 major and 5 minor rows; the picker shows only the current mode's list, so a minor key shows 5. This adds 5 major + 10 minor, giving 15 each.

## Change

Data-only: replace the `lofi: { ... },` entry of `PROG_MENU` in `js/songs/presets.js` with `lofi-presets-block.js` (existing rows unchanged and first, new rows appended in rank order). No UI changes; Kids songs and saved user data untouched.

## New entries (ranked most popular first within each mode)

| # | Mode | Name | appSteps | Numerals | C / Am | Usage |
|---|---|---|---|---|---|---|
| 1 | major | Lofi Study Hall | `2 m9|5 13|1 maj9|6 7b9` | ii9–V13–Imaj9–VI7b9 | Dm9 G13 Cmaj9 A7b9 | The jazz-hop staple: ii9-V13-Imaj9 with a VI7b9 turnaround back to ii. |
| 2 | major | Lofi Soft Landing | `4 maj9|3 m7|2 m9|1 maj7` | IVmaj9–iii7–ii9–Imaj7 | Fmaj9 Em7 Dm9 Cmaj7 | Stepwise walk down IVmaj9-iii7-ii9-Imaj7: the gentle diatonic descent of chillhop keys loops. |
| 3 | major | Lofi Old Tape | `2 m7|4 m7|b7 9|1 maj9` | ii7–iv7–bVII9–Imaj9 | Dm7 Fm7 Bb9 Cmaj9 | Backdoor cadence: ii7 to borrowed iv7, then bVII9 resolving to Imaj9. |
| 4 | major | Lofi Warm Vinyl | `1 maj9|3 7|6 m9|4 m7` | Imaj9–III7–vi9–iv7 | Cmaj9 E7 Am9 Fm7 | Imaj9 to secondary dominant III7 into vi9, closing on the borrowed iv7 (minor plagal pull home). |
| 5 | major | Lofi Tram Ride | `1 maj9|b3 maj7|b6 maj7|b2 maj7` | Imaj9–bIIImaj7–bVImaj7–bIImaj7 | Cmaj9 Ebmaj7 Abmaj7 Dbmaj7 | Parallel maj7 planing through borrowed bIII, bVI and bII: the dreamy chromatic side-slip sound. |
| 1 | minor | Lofi Firefly Jar | `1 m9|6 maj7|3 maj7|7 9` | i9–bVImaj7–bIIImaj7–bVII9 | Am9 Fmaj7 Cmaj7 G9 | i-bVI-bIII-bVII, the most common minor pop/lo-fi loop, with m9, maj7 and dominant-9 colours. |
| 2 | minor | Lofi Blue Hour | `2 m7b5|5 7b9|1 m9|6 maj7` | iiø7–V7b9–i9–bVImaj7 | Bm7b5 E7b9 Am9 Fmaj7 | Minor ii-V-i (iiø7-V7b9-i9) resting on bVImaj7 before the next turn. |
| 3 | minor | Lofi Soft Focus | `1 m9|2 m7|3 maj7|4 9` | i9–ii7–bIIImaj7–IV9 | Am9 Bm7 Cmaj7 D9 | Dorian climb: i9-ii7-bIIImaj7-IV9; the major IV gives the Dorian lift. |
| 4 | minor | Lofi Night Bloom | `1 m9|7 13|6 maj7|4 m9` | i9–bVII13–bVImaj7–iv9 | Am9 G13 Fmaj7 Dm9 | Aeolian step-down i9-bVII13-bVImaj7 landing on iv9: a soft, unresolved minor loop. |
| 5 | minor | Lofi Hazy Moon | `1 m9|4 9|6 maj9|5 7#9` | i9–IV9–bVImaj9–V7#9 | Am9 D9 Fmaj9 E7#9 | i9 to the Dorian IV9, then bVImaj9 sliding down to a crunchy V7#9 back to the tonic. |
| 6 | minor | Lofi Tide Pool | `1 m9|5 m7|4 m9|7 13` | i9–v7–iv9–bVII13 | Am9 Em7 Dm9 G13 | Aeolian float: i9-v7-iv9-bVII13, no leading tone, very laid back. |
| 7 | minor | Lofi Sleepy Bus | `4 m9|7 13|1 m9|5 7#9` | iv9–bVII13–i9–V7#9 | Dm9 G13 Am9 E7#9 | Minor backdoor: iv9-bVII13 into i9, then V7#9 to pull back round. |
| 8 | minor | Lofi Ghost Town | `1 m9|3 maj7|7 13|4 9` | i9–bIIImaj7–bVII13–IV9 | Am9 Cmaj7 G13 D9 | Dorian loop: i9-bIIImaj7-bVII13-IV9. |
| 9 | minor | Lofi Lamp Light | `4 m9|3 maj7|2 m7b5|5 7b9|1 m9` | iv9–bIIImaj7–iiø7–V7b9–i9 | Dm9 Cmaj7 Bm7b5 E7b9 Am9 | Stepwise walk down iv9-bIIImaj7-iiø7, then V7b9 to i9. |
| 10 | minor | Lofi Neon Glow | `6 maj7|5 7#9|1 m9|b2 maj7` | bVImaj7–V7#9–i9–bIImaj7 | Fmaj7 E7#9 Am9 Bbmaj7 | bVImaj7-V7#9-i9 with a Phrygian bIImaj7 side slip above the tonic. |

## Validation (`node validate.mjs`, exit 0)

- Rules: 3–8 steps, one mode each, name `Lofi <Two Words>`, names and phone labels unique vs all 158 names in presets.js, no chord twice in a row (incl. loop wrap), no chord repeated in a loop, every quality is a STRIP_QUAL key.
- Duplicates vs all 192 live PROG_MENU charts, key-agnostic and rotation-aware: no exact duplicates anywhere; no near-duplicate with any Lofi chart. Same-root/family matches in other styles (plain-triad Pop/Ballad/Reggae Axis, Jazz/R&B minor ii–V–i, etc.) are WARN: these are the coloured lo-fi versions of standard moves Vinh's style list asks for.
- App parser: each new chart run through the app's own `progSteps` (deploy-clone modules, unit-test dom stub) in all 12 keys; roots and chord tones match an independent interval table (the app's 13 = 1 3 b7 9 13, no 5th).
- Guitar: app `resolveVoicings("guitar")` returns a first shape for every chord in all 12 keys (732/732) with the root as the lowest sounding note.
- Patched copy (/tmp, not the repo): pasting the block gives `progList("lofi","major")` = 15 and `progList("lofi","minor")` = 15.

## Notes

- Eb major Lofi Tram Ride: the app spells bVI as Bmaj7 (not Cbmaj7) and bII as Emaj7 (not Fbmaj7). That is the app's existing out-of-key root spelling, not a data issue.
- Minor-mode degrees count from natural minor (3 = bIII, 6 = bVI, 7 = bVII); `b2` in minor = bII. No `b7` in any minor chart.
- Not listened to; the Rhodes preset sound with these voicings is untested by ear.

```
live lofi: major 10, minor 5; new: major 5, minor 10
WARN near-duplicate (same roots + major/minor families; other style, different chord colours): Lofi Study Hall vs existing jazz/Jazz Rhythm (major)
WARN near-duplicate (same roots + major/minor families; other style, different chord colours): Lofi Soft Landing vs existing rnb/R&B Slow Jam (major)
WARN near-duplicate (same roots + major/minor families; other style, different chord colours): Lofi Firefly Jar vs existing pop/Pop Axis (minor)
WARN near-duplicate (same roots + major/minor families; other style, different chord colours): Lofi Firefly Jar vs existing ballad/Ballad Axis (minor)
WARN near-duplicate (same roots + major/minor families; other style, different chord colours): Lofi Firefly Jar vs existing reggae/Reggae Lovers (minor)
WARN near-duplicate (same roots + major/minor families; other style, different chord colours): Lofi Blue Hour vs existing jazz/Jazz Turnaround (minor)
WARN near-duplicate (same roots + major/minor families; other style, different chord colours): Lofi Blue Hour vs existing rnb/R&B ii–V–I (minor)
WARN near-duplicate (same roots + major/minor families; other style, different chord colours): Lofi Soft Focus vs existing funk/Funk Elevator (minor)
WARN near-duplicate (same roots + major/minor families; other style, different chord colours): Lofi Night Bloom vs existing reggae/Reggae Night Riddim (minor)
WARN subsequence overlap: Lofi Lamp Light vs existing funk/Funk iiV (minor)
guitar tuning midi [40,45,50,55,59,64]
app parser: 732 step spellings checked (15 charts x 12 keys), tones match expected interval table unless FAIL above
guitar: 732/732 first shapes resolve with the root as lowest sounding note
patched copy: js/songs/presets.js | 15 +++++++++++++++
 1 file changed, 15 insertions(+)
patched progList("lofi","major"): 15 rows: Lofi Rainy Day, Lofi Coffee Shop, Lofi Night Drive, Lofi Rain Window, Lofi Stargaze, Lofi Side Step, Lofi Slinky, Lofi Cat Nap, Lofi Ripple, Lofi Back Porch, Lofi Study Hall, Lofi Soft Landing, Lofi Old Tape, Lofi Warm Vinyl, Lofi Tram Ride
patched progList("lofi","minor"): 15 rows: Lofi Snow Globe, Lofi Pillow, Lofi Late Night, Lofi Paper Boat, Lofi Midnight Snack, Lofi Firefly Jar, Lofi Blue Hour, Lofi Soft Focus, Lofi Night Bloom, Lofi Hazy Moon, Lofi Tide Pool, Lofi Sleepy Bus, Lofi Ghost Town, Lofi Lamp Light, Lofi Neon Glow

Spellings (app progSteps -> Theory.chordSymbol [chordToneNames]), C / Eb major, A / C minor:
Lofi Study Hall      C    ii9=Dm9[D F A C E]  V13=G13[G B F A E]  Imaj9=Cmaj9[C E G B D]  VI7♭9=A7b9[A C# E G Bb]
Lofi Study Hall      Eb   ii9=Fm9[F Ab C Eb G]  V13=Bb13[Bb D Ab C G]  Imaj9=Ebmaj9[Eb G Bb D F]  VI7♭9=C7b9[C E G Bb Db]
Lofi Soft Landing    C    IVmaj9=Fmaj9[F A C E G]  iii7=Em7[E G B D]  ii9=Dm9[D F A C E]  Imaj7=Cmaj7[C E G B]
Lofi Soft Landing    Eb   IVmaj9=Abmaj9[Ab C Eb G Bb]  iii7=Gm7[G Bb D F]  ii9=Fm9[F Ab C Eb G]  Imaj7=Ebmaj7[Eb G Bb D]
Lofi Old Tape        C    ii7=Dm7[D F A C]  iv7=Fm7[F Ab C Eb]  ♭VII9=Bb9[Bb D F Ab C]  Imaj9=Cmaj9[C E G B D]
Lofi Old Tape        Eb   ii7=Fm7[F Ab C Eb]  iv7=Abm7[Ab Cb Eb Gb]  ♭VII9=Db9[Db F Ab Cb Eb]  Imaj9=Ebmaj9[Eb G Bb D F]
Lofi Warm Vinyl      C    Imaj9=Cmaj9[C E G B D]  III7=E7[E G# B D]  vi9=Am9[A C E G B]  iv7=Fm7[F Ab C Eb]
Lofi Warm Vinyl      Eb   Imaj9=Ebmaj9[Eb G Bb D F]  III7=G7[G B D F]  vi9=Cm9[C Eb G Bb D]  iv7=Abm7[Ab Cb Eb Gb]
Lofi Tram Ride       C    Imaj9=Cmaj9[C E G B D]  ♭IIImaj7=Ebmaj7[Eb G Bb D]  ♭VImaj7=Abmaj7[Ab C Eb G]  ♭IImaj7=Dbmaj7[Db F Ab C]
Lofi Tram Ride       Eb   Imaj9=Ebmaj9[Eb G Bb D F]  ♭IIImaj7=Gbmaj7[Gb Bb Db F]  ♭VImaj7=Bmaj7[B D# F# A#]  ♭IImaj7=Emaj7[E G# B D#]
Lofi Firefly Jar     Am   i9=Am9[A C E G B]  VImaj7=Fmaj7[F A C E]  IIImaj7=Cmaj7[C E G B]  VII9=G9[G B D F A]
Lofi Firefly Jar     Cm   i9=Cm9[C Eb G Bb D]  VImaj7=Abmaj7[Ab C Eb G]  IIImaj7=Ebmaj7[Eb G Bb D]  VII9=Bb9[Bb D F Ab C]
Lofi Blue Hour       Am   iiø7=Bm7b5[B D F A]  V7♭9=E7b9[E G# B D F]  i9=Am9[A C E G B]  VImaj7=Fmaj7[F A C E]
Lofi Blue Hour       Cm   iiø7=Dm7b5[D F Ab C]  V7♭9=G7b9[G B D F Ab]  i9=Cm9[C Eb G Bb D]  VImaj7=Abmaj7[Ab C Eb G]
Lofi Soft Focus      Am   i9=Am9[A C E G B]  ii7=Bm7[B D F# A]  IIImaj7=Cmaj7[C E G B]  IV9=D9[D F# A C E]
Lofi Soft Focus      Cm   i9=Cm9[C Eb G Bb D]  ii7=Dm7[D F A C]  IIImaj7=Ebmaj7[Eb G Bb D]  IV9=F9[F A C Eb G]
Lofi Night Bloom     Am   i9=Am9[A C E G B]  VII13=G13[G B F A E]  VImaj7=Fmaj7[F A C E]  iv9=Dm9[D F A C E]
Lofi Night Bloom     Cm   i9=Cm9[C Eb G Bb D]  VII13=Bb13[Bb D Ab C G]  VImaj7=Abmaj7[Ab C Eb G]  iv9=Fm9[F Ab C Eb G]
Lofi Hazy Moon       Am   i9=Am9[A C E G B]  IV9=D9[D F# A C E]  VImaj9=Fmaj9[F A C E G]  V7♯9=E7#9[E G# B D G]
Lofi Hazy Moon       Cm   i9=Cm9[C Eb G Bb D]  IV9=F9[F A C Eb G]  VImaj9=Abmaj9[Ab C Eb G Bb]  V7♯9=G7#9[G B D F A#]
Lofi Tide Pool       Am   i9=Am9[A C E G B]  v7=Em7[E G B D]  iv9=Dm9[D F A C E]  VII13=G13[G B F A E]
Lofi Tide Pool       Cm   i9=Cm9[C Eb G Bb D]  v7=Gm7[G Bb D F]  iv9=Fm9[F Ab C Eb G]  VII13=Bb13[Bb D Ab C G]
Lofi Sleepy Bus      Am   iv9=Dm9[D F A C E]  VII13=G13[G B F A E]  i9=Am9[A C E G B]  V7♯9=E7#9[E G# B D G]
Lofi Sleepy Bus      Cm   iv9=Fm9[F Ab C Eb G]  VII13=Bb13[Bb D Ab C G]  i9=Cm9[C Eb G Bb D]  V7♯9=G7#9[G B D F A#]
Lofi Ghost Town      Am   i9=Am9[A C E G B]  IIImaj7=Cmaj7[C E G B]  VII13=G13[G B F A E]  IV9=D9[D F# A C E]
Lofi Ghost Town      Cm   i9=Cm9[C Eb G Bb D]  IIImaj7=Ebmaj7[Eb G Bb D]  VII13=Bb13[Bb D Ab C G]  IV9=F9[F A C Eb G]
Lofi Lamp Light      Am   iv9=Dm9[D F A C E]  IIImaj7=Cmaj7[C E G B]  iiø7=Bm7b5[B D F A]  V7♭9=E7b9[E G# B D F]  i9=Am9[A C E G B]
Lofi Lamp Light      Cm   iv9=Fm9[F Ab C Eb G]  IIImaj7=Ebmaj7[Eb G Bb D]  iiø7=Dm7b5[D F Ab C]  V7♭9=G7b9[G B D F Ab]  i9=Cm9[C Eb G Bb D]
Lofi Neon Glow       Am   VImaj7=Fmaj7[F A C E]  V7♯9=E7#9[E G# B D G]  i9=Am9[A C E G B]  ♭IImaj7=Bbmaj7[Bb D F A]
Lofi Neon Glow       Cm   VImaj7=Abmaj7[Ab C Eb G]  V7♯9=G7#9[G B D F A#]  i9=Cm9[C Eb G Bb D]  ♭IImaj7=Dbmaj7[Db F Ab C]

RESULT: 0 fail, 10 warn; new charts 15; live charts compared 192; names checked vs 158 in presets.js
```
