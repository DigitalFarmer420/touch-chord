// Key chip / key row (Full mode key picker).
import { activeKey, keyDegrees, keyMainNames, keyAltNames, namePc, keyRootName, setKeySpell } from "../keys.js?v=112.6";
import { paintKidKey } from "../kids.js?v=112.6";
import { state, scheduleSave, shared } from "../state.js?v=112.6";
import { Theory } from "../theory/index.js?v=112.6";
import { accSym } from "../theory/spelling.js?v=112.6";
import { kidsKeyNow } from "./keyboard.js?v=112.6";
import { updateSymbol } from "./nowbox.js?v=112.6";
import { refreshHeld } from "./pads.js?v=112.6";
import { typeHeld, extStillHeld } from "./palette.js?v=112.6";

export function keyLabel(k) {
  return accSym(keyRootName(k)) + (k.mode === "minor" ? " minor" : " major");
}
export function paintKeyChip(spec) {
  var chip = document.getElementById("keyChip");
  var row = document.getElementById("keyRow");
  var k = activeKey();
  chip.textContent = k ? "Key: " + keyLabel(k) : "Key: play a chord";
  paintKidKey();
  var inKey = {};
  var spellPc = {};
  if (!k && state.style === "kids") k = kidsKeyNow();   // v111 (K): Kids dims against the song key even before a key is picked
  if (k) keyDegrees(k).forEach(function (d) { inKey[d.pc] = true; spellPc[d.pc] = d.name; });
  Array.prototype.forEach.call(document.querySelectorAll("#pads .pad, .kb .pad"), function (pd) {
    pd.classList.toggle("nokey", !pd.dataset.borrow && !state.allKeys && !!k && !inKey[Number(pd.dataset.pc)]);   // v111 (K): Kids dims out-of-key keys again with Full Range off
    var nmEl = pd.querySelector(".nm");
    if (nmEl) {
      var nmT = accSym(spellPc[Number(pd.dataset.pc)] || Theory.NOTE_NAMES[Number(pd.dataset.pc)]);
      if (nmEl.textContent !== nmT) nmEl.textContent = nmT;
    }
  });
  // v31: chord buttons follow Full Range. A chord "fits" when every note of
  // it (same buildChord spelling as playback) is in the key's scale.
  var gate = false; // v35: chord gating removed; every chord button always plays
  function fits(rootPc, type, ext) {
    try {
      var c = Theory.buildChord({ rootPc: rootPc, type: type, extensions: ext || {} });
      for (var q = 0; q < c.pcs.length; q++) if (!inKey[((c.pcs[q] % 12) + 12) % 12]) return false;
      return true;
    } catch (err) { return true; }
  }
  var anyHeld = false;
  for (var hid in shared.paletteHolds) { anyHeld = true; break; }
  var heldExt = {
    six: !!state.extensions.six, min7: !!state.extensions.min7,
    maj7: !!state.extensions.maj7, nine: !!state.extensions.nine
  };
  Array.prototype.forEach.call(document.querySelectorAll(".kb .pad"), function (pd) {
    var bad = gate && anyHeld && !pd.classList.contains("nokey") && !fits(Number(pd.dataset.pc), state.type, heldExt);
    pd.classList.toggle("nochord", bad);
  });
  var root = spec && !state.forceChord ? state.rootPc : (spec ? spec.rootPc : 0);
  var rootIn = gate && inKey[root];
  var typeIsHeld = false;
  for (var hid2 in shared.paletteHolds) if (shared.paletteHolds[hid2].kind === "type") typeIsHeld = true;
  var baseType = "major";
  if (typeIsHeld) baseType = state.type;
  else if (k) keyDegrees(k).forEach(function (d) { if (d.pc === root) baseType = d.type; });
  Array.prototype.forEach.call(document.querySelectorAll("#palette button[data-type], #palette button[data-ext]"), function (cb) {
    var bad = false;
    if (rootIn) {
      if (cb.dataset.type) {
        bad = !(typeIsHeld && typeHeld(cb.dataset.type)) && !fits(root, cb.dataset.type, heldExt);
      } else {
        var e1 = {}; e1[cb.dataset.ext] = true;
        bad = !extStillHeld(cb.dataset.ext) && !fits(root, baseType, e1);
      }
    }
    cb.classList.toggle("nofit", bad);
    cb.setAttribute("aria-disabled", bad ? "true" : "false");
  });
  var ak = document.getElementById("allKeys");
  ak.classList.toggle("on", !!state.allKeys);
  ak.setAttribute("aria-pressed", state.allKeys ? "true" : "false");
  row.innerHTML = "";
  if (!k) return;
  keyDegrees(k).forEach(function (d) {
    var s = document.createElement("span");
    var b = document.createElement("b");
    b.textContent = d.roman + (d.type === "dim" ? "\u00b0" : "");
    s.appendChild(b);
    var r = document.createElement("i"); r.className = "r";
    var nm = accSym(d.name);
    r.textContent = nm.charAt(0);
    if (nm.length > 1) { var ac = document.createElement("i"); ac.className = "acc"; ac.textContent = nm.slice(1); r.appendChild(ac); }
    var q = document.createElement("i"); q.className = "q"; q.textContent = d.type === "minor" ? "m" : d.type === "dim" ? "\u00b0" : "";
    s.appendChild(r); s.appendChild(q);
    if (spec && d.pc === spec.rootPc && (d.type === spec.type || (spec.type === "sus4"))) s.className = "on";
    row.appendChild(s);
  });
  fitKeyRow();
}
// v49: 7-chord row: one line when it fits, else root stacked over quality.
export function fitKeyRow() {
  var row = document.getElementById("keyRow");
  if (!row || !row.firstChild) return;
  row.classList.remove("stack");
  var spans = row.children;
  function over() {
    for (var i = 0; i < spans.length; i++) if (spans[i].scrollWidth > spans[i].clientWidth + 0.5) return true;
    return false;
  }
  var i;
  for (i = 0; i < spans.length; i++) spans[i].style.fontSize = "";
  // v63: iPad / desktop: stay on one line (fixed-height row), shrinking the font down to 9 px.
  // v64: and keep >= 3 px of air each side of the text in every cell (G#m, C#m, D#m at 820 wide).
  if (document.documentElement.className.indexOf("lay-pad") >= 0) {
    var tight = function () {
      if (over()) return true;
      for (var j = 0; j < spans.length; j++) {
        var rg = document.createRange(); rg.selectNodeContents(spans[j]);
        var q = rg.getBoundingClientRect(), sr = spans[j].getBoundingClientRect();
        if (Math.min(q.left - sr.left, sr.right - q.right) < 3) return true;
      }
      return false;
    };
    var f1 = parseFloat(getComputedStyle(spans[0]).fontSize) || 13;
    while (f1 > 9 && tight()) { f1 -= 0.5; for (i = 0; i < spans.length; i++) spans[i].style.fontSize = f1 + "px"; }
    return;
  }
  if (!over()) return;
  row.classList.add("stack");
  var fs = parseFloat(getComputedStyle(spans[0]).fontSize) || 9;
  var floor = 11;
  while (fs > floor && over()) {
    fs -= 0.5;
    for (i = 0; i < spans.length; i++) spans[i].style.fontSize = fs + "px";
  }
}
export function setLockKey(k) {
  shared.lockKey = k;
  shared.suggestSig = "";
  refreshHeld();
}
export function wireKeyPick() {
  var pick = document.getElementById("keyPick");
  var roots = pick.querySelector(".kp-roots");
  var sel = null;
  function paint() {
    var k = sel || activeKey() || { pc: 0, mode: "major" };
    var kn = keyRootName(k);
    if (alts.dataset.mode !== k.mode) buildRoots(k.mode);
    // Simple hides the spelling row, so its picker highlights by pitch.
    Array.prototype.forEach.call(pick.querySelectorAll(".kp-roots button, .kp-alts button"), function (b) {
      var on = state.simple ? (b.parentNode === roots && Number(b.dataset.pc) === k.pc) : b.dataset.name === kn;
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    Array.prototype.forEach.call(pick.querySelectorAll(".kp-modes button"), function (b) { b.classList.toggle("on", b.dataset.mode === k.mode); });
  }
  // v50: 12 keys plus the enharmonic spellings (C\u266f D\u266f G\u266d G\u266f A\u266f); the pick sets the spelling.
  function addRoot(name, parent) {
    var i = namePc(name);
    var b = document.createElement("button");
    b.type = "button"; b.dataset.pc = String(i); b.dataset.name = name; b.textContent = accSym(name);
    b.addEventListener("click", function () {
      var k = sel || activeKey() || { pc: 0, mode: "major" };
      setKeySpell(i, k.mode, name);
      sel = { pc: i, mode: k.mode }; setLockKey(sel); paint();
    });
    parent.appendChild(b);
  }
  var alts = document.createElement("div");
  alts.className = "kp-alts";
  alts.setAttribute("aria-label", "Other spellings");
  roots.parentNode.insertBefore(alts, roots.nextSibling);
  // Rows follow the quality: major offers C\u266f and G\u266d; minor D\u266f, A\u266d, A\u266f.
  function buildRoots(mode) {
    roots.innerHTML = ""; alts.innerHTML = "";
    keyMainNames(mode).forEach(function (n) { addRoot(n, roots); });
    keyAltNames(mode).forEach(function (n) { addRoot(n, alts); });
    alts.dataset.mode = mode;
  }
  Array.prototype.forEach.call(pick.querySelectorAll(".kp-modes button"), function (b) {
    b.addEventListener("click", function () {
      var k = sel || activeKey() || { pc: 0, mode: "major" };
      sel = { pc: k.pc, mode: b.dataset.mode }; setLockKey(sel); paint();
    });
  });
  function close() { pick.hidden = true; sel = null; }
  pick.querySelector(".kp-auto").addEventListener("click", function () { setLockKey(null); close(); });
  pick.querySelector(".kp-x").addEventListener("click", close);
  pick.addEventListener("click", function (e) { if (e.target === pick) close(); });
  document.getElementById("allKeys").addEventListener("click", function () {
    state.allKeys = !state.allKeys;
    updateSymbol();
    scheduleSave(0);
  });
  // v113 (5) port: the Key chip picker flow is retired (the chip is hidden); every mode uses the root + Major/Minor control.
  var ht = document.getElementById("howto");
  function closeHt() { ht.hidden = true; }
  document.getElementById("howtoBtn").addEventListener("click", function () { ht.hidden = false; ht.querySelector(".ht-x").focus(); });
  ht.querySelector(".ht-x").addEventListener("click", closeHt);
  // v65: yellow words scroll the dialog (not the page, no hash change) to their entry in
  // "Little words to know" and light it briefly. Works the same on phones (touch) and desktop.
  var htBox = ht.querySelector(".ht-box"), htHitT = 0;
  ht.addEventListener("click", function (e) {
    var a = e.target.closest ? e.target.closest("a.ht-term") : null;
    if (!a) return;
    e.preventDefault();
    var id = (a.getAttribute("href") || "").slice(1), tgt = id && document.getElementById(id);
    if (!tgt) return;
    var top = htBox.scrollTop + tgt.getBoundingClientRect().top - htBox.getBoundingClientRect().top - 12;
    top = Math.max(0, Math.min(top, htBox.scrollHeight - htBox.clientHeight));
    try { htBox.scrollTo({ top: top, behavior: "smooth" }); } catch (err) { htBox.scrollTop = top; }
    var hits = ht.querySelectorAll(".ht-words .ht-hit");
    for (var i = 0; i < hits.length; i++) hits[i].classList.remove("ht-hit");
    tgt.classList.add("ht-hit");
    try { tgt.focus({ preventScroll: true }); } catch (err) {}
    clearTimeout(htHitT);
    htHitT = setTimeout(function () { tgt.classList.remove("ht-hit"); }, 1600);
  });
  ht.addEventListener("click", function (e) { if (e.target === ht) closeHt(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { closeHt(); close(); } });
}

// Boot step (runs once, in the original v112.3 order, from main.js)
export function boot() {
  window.addEventListener("resize", function () { fitKeyRow(); });
}
