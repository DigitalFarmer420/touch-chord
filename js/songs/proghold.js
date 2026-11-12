// Expert progression lock: keep the chosen chord sequence (degrees and steps) when the style changes.
// Pure helpers (no DOM, no state) so they can be unit tested.
export function progSameSteps(a, b) {
  return !!(a && b && a.steps && b.steps && a.steps.join("|") === b.steps.join("|"));
}
// list: the new menu (a loaded song, if any, is last). pick: { name, steps, from }.
// Returns { list, idx }: the row with the same name, else a row with the same steps,
// else the pick added as a held row just before the loaded song (voiced in the new style).
export function progHold(list, pick) {
  if (!pick || !pick.steps || !pick.steps.length) return { list: list, idx: -1 };
  var i;
  for (i = 0; i < list.length; i++) if (!list[i].up && list[i].name === pick.name) return { list: list, idx: i };
  for (i = 0; i < list.length; i++) if (!list[i].up && progSameSteps(list[i], pick)) return { list: list, idx: i };
  var at = list.length;
  while (at > 0 && list[at - 1].up) at--;
  var held = { name: pick.name, steps: pick.steps.slice(), held: true, from: pick.from || null };
  return { list: list.slice(0, at).concat([held], list.slice(at)), idx: at };
}
// The pick to keep: the current factory row (a held row keeps where it came from).
export function progLockPick(row, style) {
  if (!row || row.up || !row.steps) return null;
  return { name: row.name, steps: row.steps.slice(), from: row.held ? row.from : style };
}
