// Proposed additions (Musician, 2026-11-27). App step format: "degree quality" (b = lowered a half step), degrees
// counted from the mode's own scale (minor: natural minor, so minor "6 maj" = bVI, "7 maj" = bVII).
// after: rank position (insert after this existing/new name; null = end of list). use: usage note (verified song or genre only).
export const NEW = {
  pop: [
    { name: "Pop Wishing Well", mode: "major", steps: "6 m7|1 maj|5 sus4|2 7sus4", after: "Pop Plagal",
      use: "Oasis \"Wonderwall\" loop, commonly charted Em7-G-Dsus4-A7sus4 (key of G)." },
    { name: "Pop Daydream", mode: "major", steps: "1 maj|3 maj|4 maj|4 min", after: "Pop Wishing Well",
      use: "Radiohead \"Creep\" (G-B-C-Cm): major III and borrowed minor iv." },
    { name: "Pop Hero", mode: "major", steps: "4 maj|b6 maj|b7 maj|1 maj", after: null,
      use: "Genre: the bVI-bVII-I \"victory\" cadence of pop-rock anthems and game music." }
  ],
  jazz: [
    { name: "Jazz Rhythm", mode: "major", steps: "1 6|6 7|2 m7|5 7", after: "Jazz Turnaround",
      use: "Rhythm changes A section (Gershwin \"I Got Rhythm\"): I6-VI7-ii7-V7." }
  ],
  rnb: [
    { name: "R&B Together", mode: "minor", steps: "6 maj7|5 7|1 m7|7 m7|3 7", after: "R&B Classic",
      use: "Grover Washington Jr. & Bill Withers \"Just the Two of Us\" loop (Dbmaj7-C7-Fm7-Ebm7-Ab7 in F minor)." },
    { name: "R&B Stepping Stones", mode: "major", steps: "2 m9|3 m7|4 maj7|5 13", after: null,
      use: "Genre: stepwise ii-iii-IV-V climb used in neo-soul / R&B grooves." },
    { name: "R&B Soul Light", mode: "major", steps: "1 maj7|3 7|6 m7|4 maj7", after: null,
      use: "Genre: soul/R&B secondary dominant III7 resolving to vi." }
  ],
  ballad: [
    { name: "Ballad Candle", mode: "major", steps: "1 maj|3 min|6 min|5 maj", after: "Ballad Piano",
      use: "Coldplay \"Fix You\" verse, commonly charted Eb-Gm-Cm-Bb (I-iii-vi-V)." },
    { name: "Ballad Echo", mode: "minor", steps: "1 min|3 maj|7 maj|6 maj", after: "Ballad Candle",
      use: "Adele \"Hello\" loop, commonly charted Fm-Ab-Eb-Db (i-bIII-bVII-bVI)." },
    { name: "Ballad Walkdown", mode: "major", steps: "1 maj|5 over3|6 min|5 maj|4 maj", after: null,
      use: "Genre: descending-bass ballad line (C-G/B-Am-G-F)." },
    { name: "Ballad Uphill", mode: "major", steps: "1 maj|2 min|1 over3|4 maj|5 maj", after: null,
      use: "Genre: rising-bass hymn/ballad line (C-Dm-C/E-F-G)." }
  ],
  reggae: [
    { name: "Reggae Sunny", mode: "major", steps: "1 maj|3 min|4 maj|2 min", after: null,
      use: "Genre: I-iii-IV-ii lovers-rock style loop." },
    { name: "Reggae Lazy Day", mode: "major", steps: "1 maj|5 maj|2 min|4 maj", after: null,
      use: "Genre: I-V-ii-IV easy skank loop." },
    { name: "Reggae Night Riddim", mode: "minor", steps: "1 min|7 maj|6 maj|4 min", after: null,
      use: "Genre: minor roots riddim stepping down i-bVII-bVI-iv." }
  ],
  funk: [
    { name: "Funk Disco", mode: "minor", steps: "1 m7|3 maj|5 m7|4 maj", after: "Funk OneFour",
      use: "Daft Punk \"Get Lucky\" loop, commonly charted Bm7-D-F#m7-E (B Dorian)." },
    { name: "Funk Stomp", mode: "major", steps: "1 7#9|b3 7|4 7|b7 7", after: null,
      use: "Genre: blues-rock/funk riff on I7#9-bIII7-IV7-bVII7." },
    { name: "Funk Elevator", mode: "minor", steps: "1 m7|2 m7|3 maj7|4 7", after: null,
      use: "Genre: Dorian stepwise climb i7-ii7-bIIImaj7-IV7." },
    { name: "Funk Glide", mode: "minor", steps: "1 m7|4 7|7 9|3 maj7", after: null,
      use: "Genre: Dorian i7-IV7 moving round the circle to bVII9-bIIImaj7." },
    { name: "Funk Clav Slide", mode: "major", steps: "1 7|b7 7|b6 7|5 7#9", after: null,
      use: "Genre: descending dominant-7 line I7-bVII7-bVI7-V7#9 (soul/funk)." }
  ],
  yogaDeep: [
    { name: "Yoga Lotus", mode: "major", steps: "1 maj7 x2|2 sus2 x2|6 m7 x2|5 sus2 x2", after: null,
      use: "Genre: Lydian-flavoured ambient pad (major II)." },
    { name: "Yoga River", mode: "major", steps: "1 sus2 x2|6 m7 x2|3 m7 x2|4 maj7 x2", after: null,
      use: "Genre: slow diatonic ambient/meditation pad." },
    { name: "Yoga Dawn", mode: "minor", steps: "1 m9 x2|3 maj7 x2|4 m7 x2|7 sus2 x2", after: null,
      use: "Genre: Aeolian ambient pad." },
    { name: "Yoga Cloud", mode: "minor", steps: "1 m7 x2|6 maj7 x2|4 m9 x2|3 maj7 x2", after: null,
      use: "Genre: Aeolian ambient pad." },
    { name: "Yoga Earth", mode: "minor", steps: "1 m9 x2|2 m7 x2|4 sus2 x2|5 m7 x2", after: null,
      use: "Genre: Dorian ambient pad (major IV colour)." }
  ],
  country: [
    { name: "Country Back Roads", mode: "major", steps: "1 maj|6 min|5 maj|4 maj", after: "Country Story",
      use: "John Denver \"Take Me Home, Country Roads\" verse (G-Em-D-C)." }
  ],
  lofi: [
    { name: "Lofi Rainy Day", mode: "major", steps: "4 maj9|3 m7|6 m9|1 maj7", use: "Genre: IVmaj7-iii7-vi7 lofi/J-pop staple, landing on Imaj7." },
    { name: "Lofi Coffee Shop", mode: "major", steps: "2 m9|5 13|3 m7|6 m9", use: "Genre: ii-V that dodges to iii-vi, common lofi/neo-soul loop." },
    { name: "Lofi Snow Globe", mode: "minor", steps: "1 m9|6 maj9|3 maj7|5 7b9", use: "Genre: minor lofi loop i9-bVImaj9-bIIImaj7 with V7b9 pull back to i." },
    { name: "Lofi Night Drive", mode: "major", steps: "1 maj9|6 m9|4 maj7|4 m7", use: "Genre: borrowed minor iv7 after IVmaj7 (lofi/neo-soul)." },
    { name: "Lofi Pillow", mode: "minor", steps: "6 maj7|7 13|1 m9|5 m7", use: "Genre: bVI-bVII-i lift with minor v7 (lofi/anime style)." },
    { name: "Lofi Rain Window", mode: "major", steps: "4 maj9|4 m9|3 m7|6 7b9|2 m9|5 13", use: "Genre: neo-soul walk-down IV-iv-iii-VI7-ii-V." },
    { name: "Lofi Stargaze", mode: "major", steps: "1 maj7|2 m7|3 m7|4 maj7", use: "Genre: stepwise diatonic 7th-chord climb." },
    { name: "Lofi Late Night", mode: "minor", steps: "1 m9|4 m9|5 m7|6 maj7", use: "Genre: minor 9th loop i-iv-v-bVI." },
    { name: "Lofi Side Step", mode: "major", steps: "2 m9|b2 7|1 maj9|6 7b9", use: "Genre: tritone-sub ii-bII7-I with VI7b9 turnaround (jazz/lofi)." },
    { name: "Lofi Slinky", mode: "major", steps: "3 m7|b3 7|2 m7|b2 7|1 maj7", use: "Genre: chromatic descending ii-V chain into Imaj7." },
    { name: "Lofi Cat Nap", mode: "major", steps: "1 maj7|5 m7|1 9|4 maj7|4 m7", use: "Genre: v7-I9 (ii-V of IV) into IVmaj7-iv7, neo-soul/J Dilla-style move." },
    { name: "Lofi Ripple", mode: "major", steps: "6 m9|2 9|5 m7|1 9|4 maj7", use: "Genre: chain of ii-V moves (vi9-II9, v7-I9) landing on IVmaj7." },
    { name: "Lofi Back Porch", mode: "major", steps: "4 maj7|b7 9|1 maj7|6 m7", use: "Genre: backdoor bVII9 to Imaj7." },
    { name: "Lofi Paper Boat", mode: "minor", steps: "1 m9|4 9|3 maj7|6 maj7", use: "Genre: Dorian i9-IV9 into bIIImaj7-bVImaj7." },
    { name: "Lofi Midnight Snack", mode: "minor", steps: "4 m9|5 m7|1 m9|3 maj7", use: "Genre: minor iv9-v7-i9 with bIIImaj7 colour." }
  ]
};
export const LOFI_NOTE = {
  sound: "Warm Rhodes-like electric piano (closest existing voice: \"epiano\"), dark/soft filter, tape-style warmth; rich 7th/9th chords in close or drop voicings, not bright triads.",
  tempo: "Slow and laid-back: about 70-90 BPM, default ~80 (swung/behind-the-beat feel if the engine supports swing; otherwise straight at ~80).",
  drums: "Soft, dusty boom-bap: muted kick, gentle snare/rim, light swung hats; low volume under the keys.",
  bass: "Round, soft sub/electric bass on roots, not busy.",
  fx: "More reverb and a little delay than Pop (in the range of the R&B preset), warmth around 50-60.",
  suggestedPreset: { sound: "epiano", bass: true, voicing: "close", cutoff: 0.40, reverb: 0.34, delay: 0.20, bpm: 80, warmth: 60 },
  caveat: "Suggested numbers are a starting point modelled on the existing jazz/rnb presets; not listened to. Loudness trim (STYLE_TRIM) must be measured by Crash."
};
