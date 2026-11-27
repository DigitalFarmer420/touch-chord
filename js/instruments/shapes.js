// Chord shapes as data. `null` is a muted string. Finger numbers are 1–4;
// 0 means the string is open or muted. A barre is one finger laid across
// fromString..toString (inclusive) at one fret.
//
// Movable shapes are stored relative to the root. Relative fret 0 is the
// root's fret on `rootString` (the barre, on these CAGED grips). The resolver
// adds the fret that puts that root on the chord's pitch. A fret of "b1" is
// one fret below that barre.
//
// Guitar's open grips and its E, A and D movable grips come from the
// musician's table. Ukulele keeps a small open list so a later curation is
// another array, not a change to the resolver.

import { GUITAR_OPEN, GUITAR_MOVABLE } from "./guitar-data.js?v=2026.11.27.22";

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
