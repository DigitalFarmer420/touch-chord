// Pure Play/Pause resume policy. No DOM, no audio.
// (a) nothing changed: re-strike the current chord for the remaining bar time.
// (b) key / style / mode / sound changed, same song: replay that step from its start.
// (c) different song or progression: start at step 0.
// (d) Stop always returns to idle (handled by progStop, not here).

export function songIdentity(prog) {
  var row = prog && prog.list ? prog.list[prog.idx] : null;
  return { idx: prog ? prog.idx | 0 : 0, name: row ? row.name : null, up: !!(row && row.up) };
}

export function worldIdentity(state, prog) {
  var mode = (prog && prog.key && prog.key.mode) || (state && state.keyScale) || "major";
  var keySig = prog && prog.keySig != null ? prog.keySig : (state ? state.keyRoot : 0);
  return {
    style: state ? state.style : null,
    mode: mode,
    keySig: keySig,
    sound: state ? state.sound : null
  };
}

export function resumeRule(snap, world, song) {
  if (!snap) return "start";
  if (!song || snap.songIdx !== song.idx || snap.songName !== song.name || !!snap.up !== !!song.up) return "from-zero";
  if (!world || snap.style !== world.style || snap.mode !== world.mode || snap.keySig !== world.keySig || snap.sound !== world.sound) return "replay-step";
  return "remain";
}

export function barOffset(stepStart, now, barDur) {
  if (!(barDur > 0)) return 0;
  var off = now - stepStart;
  if (off < 0) return 0;
  if (off > barDur) return barDur;
  return off;
}
