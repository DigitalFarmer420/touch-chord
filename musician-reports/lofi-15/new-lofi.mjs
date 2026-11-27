// New Lofi charts (Musician, 2026-11-27). App step format "degree quality"; degrees count from the MODE's own scale
// (minor = natural minor: 3 = bIII, 6 = bVI, 7 = bVII). A leading b lowers that degree a half step.
// Order = rank within the new additions (most popular first). Usage notes are genre descriptions, not song claims
// unless the standard is named.
export const NEW = {
  major: [
    { name: "Lofi Study Hall", steps: "2 m9|5 13|1 maj9|6 7b9",
      use: "The jazz-hop staple: ii9-V13-Imaj9 with a VI7b9 turnaround back to ii." },
    { name: "Lofi Soft Landing", steps: "4 maj9|3 m7|2 m9|1 maj7",
      use: "Stepwise walk down IVmaj9-iii7-ii9-Imaj7: the gentle diatonic descent of chillhop keys loops." },
    { name: "Lofi Old Tape", steps: "2 m7|4 m7|b7 9|1 maj9",
      use: "Backdoor cadence: ii7 to borrowed iv7, then bVII9 resolving to Imaj9." },
    { name: "Lofi Warm Vinyl", steps: "1 maj9|3 7|6 m9|4 m7",
      use: "Imaj9 to secondary dominant III7 into vi9, closing on the borrowed iv7 (minor plagal pull home)." },
    { name: "Lofi Tram Ride", steps: "1 maj9|b3 maj7|b6 maj7|b2 maj7",
      use: "Parallel maj7 planing through borrowed bIII, bVI and bII: the dreamy chromatic side-slip sound." }
  ],
  minor: [
    { name: "Lofi Firefly Jar", steps: "1 m9|6 maj7|3 maj7|7 9",
      use: "i-bVI-bIII-bVII, the most common minor pop/lo-fi loop, with m9, maj7 and dominant-9 colours." },
    { name: "Lofi Blue Hour", steps: "2 m7b5|5 7b9|1 m9|6 maj7",
      use: "Minor ii-V-i (iiø7-V7b9-i9) resting on bVImaj7 before the next turn." },
    { name: "Lofi Soft Focus", steps: "1 m9|2 m7|3 maj7|4 9",
      use: "Dorian climb: i9-ii7-bIIImaj7-IV9; the major IV gives the Dorian lift." },
    { name: "Lofi Night Bloom", steps: "1 m9|7 13|6 maj7|4 m9",
      use: "Aeolian step-down i9-bVII13-bVImaj7 landing on iv9: a soft, unresolved minor loop." },
    { name: "Lofi Hazy Moon", steps: "1 m9|4 9|6 maj9|5 7#9",
      use: "i9 to the Dorian IV9, then bVImaj9 sliding down to a crunchy V7#9 back to the tonic." },
    { name: "Lofi Tide Pool", steps: "1 m9|5 m7|4 m9|7 13",
      use: "Aeolian float: i9-v7-iv9-bVII13, no leading tone, very laid back." },
    { name: "Lofi Sleepy Bus", steps: "4 m9|7 13|1 m9|5 7#9",
      use: "Minor backdoor: iv9-bVII13 into i9, then V7#9 to pull back round." },
    { name: "Lofi Ghost Town", steps: "1 m9|3 maj7|7 13|4 9",
      use: "Dorian loop: i9-bIIImaj7-bVII13-IV9." },
    { name: "Lofi Lamp Light", steps: "4 m9|3 maj7|2 m7b5|5 7b9|1 m9",
      use: "Stepwise walk down iv9-bIIImaj7-iiø7, then V7b9 to i9." },
    { name: "Lofi Neon Glow", steps: "6 maj7|5 7#9|1 m9|b2 maj7",
      use: "bVImaj7-V7#9-i9 with a Phrygian bIImaj7 side slip above the tonic." }
  ]
};
