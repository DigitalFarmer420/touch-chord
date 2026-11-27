// Fretted-instrument profiles. A new instrument (bass, mandolin) is another
// object in this list: tuning is MIDI note numbers, low string to high string,
// plus how many frets the board has and how far one hand can stretch.
// maxSpan is the inclusive fret count the hand covers. The shape table allows a
// four-fret gap (fret 1 through fret 5), so this is 5. Open strings are not part
// of the span. maxFingers counts a barre as one finger.

var guitar = {
  id: "guitar",
  name: "Guitar",
  tuning: [40, 45, 50, 55, 59, 64], // E2 A2 D3 G3 B3 E4
  stringNames: ["E", "A", "D", "G", "B", "e"],
  frets: 15, // the shape table's grips stay at fret 15 or under
  maxSpan: 5,
  maxFingers: 4,
  curated: true
};

// Re-entrant soprano tuning (the G string sounds higher than the C string).
// A few open grips are seeded so the resolver can be checked; the library is
// not a finished ukulele curation.
var ukulele = {
  id: "ukulele",
  name: "Ukulele",
  tuning: [67, 60, 64, 69], // G4 C4 E4 A4
  stringNames: ["G", "C", "E", "A"],
  frets: 12,
  maxSpan: 4,
  maxFingers: 4,
  curated: false
};

var instruments = [guitar, ukulele];

function getInstrument(id) {
  for (var i = 0; i < instruments.length; i++) if (instruments[i].id === id) return instruments[i];
  return null;
}

export { guitar, ukulele, instruments, getInstrument };
