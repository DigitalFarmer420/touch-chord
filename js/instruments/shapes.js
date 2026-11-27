// Chord shapes as data. `null` is a muted string. Finger numbers are 1–4;
// 0 means the string is open or muted. A barre is one finger laid across
// fromString..toString (inclusive) at one fret.
//
// Movable shapes are stored relative to the root. Relative fret 0 is the
// root's fret on `rootString` (the barre, on these CAGED grips). The resolver
// adds the fret that puts that root on the chord's pitch.

function barre(finger, fret, fromString, toString) {
  return { finger: finger, fret: fret, fromString: fromString, toString: toString };
}

// Musician-supplied open grips, then the other standard open grips (D, E, Em,
// A, Dm, E7, A7, D7, B7, and the common sus / add9 / 7 forms around them).
var GUITAR_OPEN = [
  { name: "Open", frets: [null, 3, 2, 0, 1, 0], fingers: [0, 3, 2, 0, 1, 0], barres: [] },
  { name: "Open", frets: [null, 0, 2, 2, 1, 0], fingers: [0, 0, 2, 3, 1, 0], barres: [] },
  { name: "Open", frets: [3, 2, 0, 0, 0, 3], fingers: [2, 1, 0, 0, 0, 3], barres: [] },
  { name: "Open", frets: [null, 3, 2, 0, 0, 0], fingers: [0, 3, 2, 0, 0, 0], barres: [] },
  { name: "Open", frets: [null, 0, 2, 0, 1, 0], fingers: [0, 0, 2, 0, 1, 0], barres: [] },
  { name: "Open", frets: [null, null, 0, 2, 1, 1], fingers: [0, 0, 0, 2, 1, 1], barres: [barre(1, 1, 4, 5)] },
  { name: "Open", frets: [3, 2, 0, 0, 0, 1], fingers: [3, 2, 0, 0, 0, 1], barres: [] },
  { name: "Open", frets: [null, null, 3, 2, 1, 0], fingers: [0, 0, 3, 2, 1, 0], barres: [] },
  { name: "Open", frets: [null, null, 0, 2, 3, 2], fingers: [0, 0, 0, 1, 3, 2], barres: [] },
  { name: "Open", frets: [0, 2, 2, 1, 0, 0], fingers: [0, 2, 3, 1, 0, 0], barres: [] },
  { name: "Open", frets: [0, 2, 2, 0, 0, 0], fingers: [0, 2, 3, 0, 0, 0], barres: [] },
  { name: "Open", frets: [null, 0, 2, 2, 2, 0], fingers: [0, 0, 1, 2, 3, 0], barres: [] },
  { name: "Open", frets: [null, null, 0, 2, 3, 1], fingers: [0, 0, 0, 2, 3, 1], barres: [] },
  { name: "Open", frets: [0, 2, 0, 1, 0, 0], fingers: [0, 2, 0, 1, 0, 0], barres: [] },
  { name: "Open", frets: [null, 0, 2, 0, 2, 0], fingers: [0, 0, 1, 0, 2, 0], barres: [] },
  { name: "Open", frets: [null, null, 0, 2, 1, 2], fingers: [0, 0, 0, 2, 1, 3], barres: [] },
  { name: "Open", frets: [null, 2, 1, 2, 0, 2], fingers: [0, 2, 1, 3, 0, 4], barres: [] },
  { name: "Open", frets: [null, 3, 2, 3, 1, 0], fingers: [0, 3, 2, 4, 1, 0], barres: [] },
  { name: "Open", frets: [0, 2, 0, 0, 0, 0], fingers: [0, 2, 0, 0, 0, 0], barres: [] },
  { name: "Open", frets: [null, 0, 2, 1, 2, 0], fingers: [0, 0, 2, 1, 3, 0], barres: [] },
  { name: "Open", frets: [null, null, 0, 2, 2, 2], fingers: [0, 0, 0, 1, 1, 1], barres: [barre(1, 2, 3, 5)] },
  { name: "Open", frets: [0, 2, 2, 2, 0, 0], fingers: [0, 2, 3, 4, 0, 0], barres: [] },
  { name: "Open", frets: [null, 0, 2, 2, 3, 0], fingers: [0, 0, 1, 2, 3, 0], barres: [] },
  { name: "Open", frets: [null, 0, 2, 2, 0, 0], fingers: [0, 0, 1, 2, 0, 0], barres: [] },
  { name: "Open", frets: [null, null, 0, 2, 3, 3], fingers: [0, 0, 0, 1, 3, 4], barres: [] },
  { name: "Open", frets: [null, null, 0, 2, 3, 0], fingers: [0, 0, 0, 1, 2, 0], barres: [] },
  { name: "Open", frets: [null, 3, 2, 0, 3, 0], fingers: [0, 3, 2, 0, 4, 0], barres: [] },
  { name: "Open", frets: [3, 2, 0, 2, 0, 3], fingers: [2, 1, 0, 3, 0, 4], barres: [] },
  { name: "Open", frets: [3, null, 0, 0, 1, 3], fingers: [2, 0, 0, 0, 1, 3], barres: [] },
  { name: "Open", frets: [null, 3, 0, 0, 1, 3], fingers: [0, 3, 0, 0, 1, 4], barres: [] },
  { name: "Open", frets: [null, 3, 3, 0, 1, 1], fingers: [0, 3, 4, 0, 1, 1], barres: [barre(1, 1, 4, 5)] },
  { name: "Open", frets: [0, 2, 0, 2, 0, 0], fingers: [0, 2, 0, 3, 0, 0], barres: [] },
  { name: "Open", frets: [null, 0, 2, 0, 3, 0], fingers: [0, 0, 1, 0, 3, 0], barres: [] }
];

// CAGED movable grips the musician supplied: E-shape (root on the low E
// string) and A-shape (root on the A string). Frets are steps above the barre.
var GUITAR_MOVABLE = [
  { name: "E-shape", rootString: 0, rootFret: 0, frets: [0, 2, 2, 1, 0, 0], fingers: [1, 3, 4, 2, 1, 1], barres: [barre(1, 0, 0, 5)] },
  { name: "E-shape", rootString: 0, rootFret: 0, frets: [0, 2, 2, 0, 0, 0], fingers: [1, 3, 4, 1, 1, 1], barres: [barre(1, 0, 0, 5)] },
  { name: "E-shape", rootString: 0, rootFret: 0, frets: [0, 2, 0, 1, 0, 0], fingers: [1, 3, 1, 2, 1, 1], barres: [barre(1, 0, 0, 5)] },
  { name: "E-shape", rootString: 0, rootFret: 0, frets: [0, 2, 0, 0, 0, 0], fingers: [1, 3, 1, 1, 1, 1], barres: [barre(1, 0, 0, 5)] },
  { name: "E-shape", rootString: 0, rootFret: 0, frets: [0, null, 1, 1, 0, null], fingers: [1, 0, 3, 2, 1, 0], barres: [barre(1, 0, 0, 4)] },
  { name: "A-shape", rootString: 1, rootFret: 0, frets: [null, 0, 2, 2, 2, 0], fingers: [0, 1, 3, 3, 3, 1], barres: [barre(1, 0, 1, 5)] },
  { name: "A-shape", rootString: 1, rootFret: 0, frets: [null, 0, 2, 2, 1, 0], fingers: [0, 1, 3, 4, 2, 1], barres: [barre(1, 0, 1, 5)] },
  { name: "A-shape", rootString: 1, rootFret: 0, frets: [null, 0, 2, 0, 2, 0], fingers: [0, 1, 3, 1, 4, 1], barres: [barre(1, 0, 1, 5)] },
  { name: "A-shape", rootString: 1, rootFret: 0, frets: [null, 0, 2, 0, 1, 0], fingers: [0, 1, 3, 1, 2, 1], barres: [barre(1, 0, 1, 5)] },
  { name: "A-shape", rootString: 1, rootFret: 0, frets: [null, 0, 2, 1, 2, 0], fingers: [0, 1, 3, 2, 4, 1], barres: [barre(1, 0, 1, 5)] }
];

// The four open grips the ukulele sanity check asks for. Not a full library.
var UKULELE_OPEN = [
  { name: "Open", frets: [0, 0, 0, 3], fingers: [0, 0, 0, 3], barres: [] },
  { name: "Open", frets: [2, 0, 0, 0], fingers: [2, 0, 0, 0], barres: [] },
  { name: "Open", frets: [2, 0, 1, 0], fingers: [2, 0, 1, 0], barres: [] },
  { name: "Open", frets: [0, 2, 3, 2], fingers: [0, 1, 3, 2], barres: [] }
];

var BY_ID = {
  guitar: { open: GUITAR_OPEN, movable: GUITAR_MOVABLE },
  ukulele: { open: UKULELE_OPEN, movable: [] }
};

function shapesFor(id) {
  return BY_ID[id] || { open: [], movable: [] };
}

export { shapesFor, GUITAR_OPEN, GUITAR_MOVABLE, UKULELE_OPEN };
