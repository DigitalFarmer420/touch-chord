// The current key: lock key, key spellings, key picker data (keyRootName, modeKey, setKeySpell...).
import { state, scheduleSave, shared } from "./state.js?v=112.11";
import { Theory } from "./theory/index.js?v=112.11";
import { wrap12 } from "./theory/quality.js?v=112.11";
import { accSym } from "./theory/spelling.js?v=112.11";
function keyFromChord(spec) {
  return { pc: spec.rootPc, mode: (spec.type === "minor" || spec.type === "dim") ? "minor" : "major" };
}
export function maybeLockKey(spec) {
  if (shared.lockKey || state.keyMode || !spec) return;
  shared.lockKey = keyFromChord(spec);
  shared.suggestSig = "";
}
export function activeKey() {
  if (state.keyMode) return { pc: state.keyRoot, mode: state.keyScale === "minor" ? "minor" : "major" };
  return shared.lockKey;
}
// v50: key root spelling (display). A key is still {pc, mode}; its spelling is
// the user's pick per pc+mode (popover / Layout dropdown, saved in settings),
// else a sensible default (D\u266d major, C\u266f minor, G\u266f minor; others as before).
export const SPELL_LI = "CDEFGAB";
// v52: only spellings that are real keys. First entry = default.
const KEY_SPELLINGS = {
  major: [["C"], ["Db", "C#"], ["D"], ["Eb"], ["E"], ["F"], ["F#", "Gb"], ["G"], ["Ab"], ["A"], ["Bb"], ["B"]],
  minor: [["C"], ["C#"], ["D"], ["Eb", "D#"], ["E"], ["F"], ["F#"], ["G"], ["G#", "Ab"], ["A"], ["Bb", "A#"], ["B"]]
};
export function keyMainNames(mode) { return KEY_SPELLINGS[mode === "minor" ? "minor" : "major"].map(function (a) { return a[0]; }); }
export function keyAltNames(mode) {
  var out = [];
  KEY_SPELLINGS[mode === "minor" ? "minor" : "major"].forEach(function (a) { for (var i = 1; i < a.length; i++) out.push(a[i]); });
  return out;
}
export function validKeyName(pc, mode, n) {
  var a = KEY_SPELLINGS[mode === "minor" ? "minor" : "major"][pc];
  return !!a && a.indexOf(n) >= 0;
}
function spellFromName(n) {
  var li = SPELL_LI.indexOf(String(n).charAt(0));
  if (li < 0) return null;
  var acc = 0;
  for (var i = 1; i < n.length; i++) { if (n.charAt(i) === "#") acc++; else if (n.charAt(i) === "b") acc--; }
  return { li: li, acc: acc };
}
export function namePc(n) {
  var sp = spellFromName(n);
  return sp ? wrap12([0, 2, 4, 5, 7, 9, 11][sp.li] + sp.acc) : -1;
}
export function defaultKeyName(pc, mode) {
  return KEY_SPELLINGS[mode === "minor" ? "minor" : "major"][pc][0];
}
export function keyRootName(k) {
  // v52: Simple always uses the plain spellings (major C D\u266d ... B\u266d B; minor C C\u266f ... G\u266f ...).
  if (state.simple) return defaultKeyName(k.pc, k.mode);
  var n = state.keySpell && state.keySpell[k.pc + k.mode];
  return (n && validKeyName(k.pc, k.mode, n)) ? n : defaultKeyName(k.pc, k.mode);
}
export function keyRootSpell(k) { return spellFromName(keyRootName(k)); }
export function keyDegrees(k) { return Theory.scaleDegrees(k.pc, k.mode, keyRootSpell(k)); }
export function buildKeySel() {
  var sel = document.getElementById("keyRoot");
  if (!sel) return;
  var mode = modeKey().mode;
  sel.innerHTML = "";
  keyMainNames(mode).concat(keyAltNames(mode)).forEach(function (name) {
    var opt = document.createElement("option");
    opt.value = name;
    opt.textContent = accSym(name);
    sel.appendChild(opt);
  });
  sel.dataset.mode = mode;
}
export function syncKeySel() {
  var sel = document.getElementById("keyRoot");
  if (!sel) return;
  if (sel.dataset.mode !== modeKey().mode) buildKeySel();
  sel.value = keyRootName(modeKey());
}
export function modeKey() { return { pc: state.keyRoot, mode: state.keyScale === "minor" ? "minor" : "major" }; }
export function setKeySpell(pc, mode, name) {
  if (!state.keySpell) state.keySpell = {};
  if (!validKeyName(pc, mode, name) || name === defaultKeyName(pc, mode)) delete state.keySpell[pc + mode];
  else state.keySpell[pc + mode] = name;
  shared.suggestSig = "";
  scheduleSave(0);
}
export function suggestionKey(spec) {
  var ak = activeKey();
  if (ak) return ak;
  if (spec.type === "minor") return { pc: spec.rootPc, mode: "minor" };
  if (spec.type === "dim") return { pc: wrap12(spec.rootPc + 1), mode: "major" };
  return { pc: spec.rootPc, mode: "major" };
}
