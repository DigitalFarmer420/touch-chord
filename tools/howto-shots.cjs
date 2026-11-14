// How to pictures (v3.2 guide refresh, from the 112.13-ranked-v3.2-test.4 web code): 13 spotlight screenshots,
// 1170x540 WebP, the v110/v111 look (dimmed screen, dashed #c4853f outline, gold step numbers).
// usage: NODE_PATH=<dir with playwright-core> CHROME=/usr/bin/google-chrome ORIGIN=http://127.0.0.1:8080 OUT=<dir> node tools/howto-shots.cjs
// Writes OUT/<name>.png (844x390 at DPR 2, raw) for each picture; tools/howto-webp.py turns them into images/*.webp.
const { chromium } = require("playwright-core");
const fs = require("fs"), path = require("path");
const ORIGIN = process.env.ORIGIN || "http://127.0.0.1:8080", OUT = process.env.OUT || "/tmp/howto-shots";
fs.mkdirSync(OUT, { recursive: true });
const SONG = fs.readFileSync(path.join(__dirname, "../tests/fixtures/upload/diag-v12-clean.json"), "utf8");   // "Morning Light" (Test Band): English words
// Draw the spotlight: dim everything, cut out each mark's box, dashed outline, gold number at its top-left corner.
function overlay(marks) {
  const old = document.getElementById("__htov"); if (old) old.remove();
  const W = innerWidth, H = innerHeight, d = devicePixelRatio || 1;
  const c = document.createElement("canvas"); c.id = "__htov"; c.width = W * d; c.height = H * d;
  Object.assign(c.style, { position: "fixed", left: 0, top: 0, width: W + "px", height: H + "px", zIndex: 2147483647, pointerEvents: "none" });
  const g = c.getContext("2d"); g.scale(d, d);
  const boxes = marks.map(m => { const els = (Array.isArray(m.sel) ? m.sel : [m.sel]).map(s => [...document.querySelectorAll(s)].find(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.closest("[hidden]"); })).filter(Boolean);
    if (!els.length) return null; const rs = els.map(e => e.getBoundingClientRect()); const P = m.pad == null ? 4 : m.pad;
    return { n: m.n, l: Math.max(2, Math.min(...rs.map(r => r.left)) - P), t: Math.max(2, Math.min(...rs.map(r => r.top)) - P), r: Math.min(W - 2, Math.max(...rs.map(r => r.right)) + P), b: Math.min(H - 2, Math.max(...rs.map(r => r.bottom)) + P), at: m.at || "tl" }; });
  const rr = (x, y, w, h, rad) => { g.beginPath(); g.moveTo(x + rad, y); g.arcTo(x + w, y, x + w, y + h, rad); g.arcTo(x + w, y + h, x, y + h, rad); g.arcTo(x, y + h, x, y, rad); g.arcTo(x, y, x + w, y, rad); g.closePath(); };
  g.fillStyle = "rgba(0,0,0,0.55)"; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = "destination-out";
  boxes.forEach(b => { if (!b) return; rr(b.l, b.t, b.r - b.l, b.b - b.t, 10); g.fill(); });
  g.globalCompositeOperation = "source-over";
  boxes.forEach(b => { if (!b) return; g.setLineDash([5, 4]); g.lineWidth = 2; g.strokeStyle = "#c4853f"; rr(b.l - 2, b.t - 2, b.r - b.l + 4, b.b - b.t + 4, 11); g.stroke(); g.setLineDash([]); });
  boxes.forEach(b => { if (!b || b.n == null) return; const R = 10; let x = b.at === "tr" ? b.r : b.at === "br" ? b.r : b.l, y = b.at === "br" || b.at === "bl" ? b.b : b.t;
    x = Math.max(R + 2, Math.min(W - R - 2, x)); y = Math.max(R + 2, Math.min(H - R - 2, y));
    g.beginPath(); g.arc(x, y, R + 2, 0, 7); g.fillStyle = "rgba(20,12,4,0.6)"; g.fill(); g.beginPath(); g.arc(x, y, R, 0, 7); g.fillStyle = "#c4853f"; g.fill();
    g.fillStyle = "#1d140b"; g.font = "800 13px Nunito, system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(String(b.n), x, y + 0.5); });
  document.body.appendChild(c);
  return boxes.map(b => b ? [b.l, b.t, b.r, b.b].map(Math.round) : null);
}
async function page(b, w, h, mode) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { try { localStorage.setItem("touchChord.tour.v1", "done"); } catch (e) {} });
  const p = await ctx.newPage(); p.errs = []; p.on("pageerror", e => p.errs.push("" + e));
  await p.goto(ORIGIN + "/index.html?test=1&expert=1&hour=12"); await p.waitForFunction(() => window.__xmode && window.__ms); await p.waitForTimeout(900);
  await p.mouse.click(Math.round(w / 2), 2); await p.waitForTimeout(200);   // the first tap unlocks sound and clears "Tap anywhere to enable sound"
  if (mode !== "expert") { await p.evaluate(() => window.__ms.open(true)); await p.waitForTimeout(400); await p.evaluate(m => document.querySelector(`#msMode button[data-mode="${m}"]`).click(), mode); await p.waitForTimeout(1000); }
  p.ctx = ctx; return p;
}
const tapEl = async (p, sel, yf = 0.5) => { const r = await p.evaluate(([s, yf]) => { const e = [...document.querySelectorAll(s)].find(x => x.getBoundingClientRect().width > 0); if (!e) return null; const q = e.getBoundingClientRect(); return { x: q.x + q.width / 2, y: q.y + q.height * yf }; }, [sel, yf]); if (r) await p.touchscreen.tap(r.x, r.y); await p.waitForTimeout(350); return !!r; };
const LOG = {};
async function shot(p, name, marks) { await p.waitForTimeout(300); await p.evaluate(() => document.querySelectorAll(".pa-hint").forEach(e => { e.hidden = true; })); /* the Play along tip is not part of the picture */ LOG[name] = { marks: await p.evaluate(overlay, marks) }; await p.screenshot({ path: path.join(OUT, name + ".png") }); await p.evaluate(() => { const o = document.getElementById("__htov"); if (o) o.remove(); }); }
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ["--no-sandbox", "--disable-gpu", "--autoplay-policy=no-user-gesture-required"] });
  // 00 intro: Expert upright and sideways (no marks), composed side by side by howto-webp.py
  for (const [w, h] of [[390, 844], [844, 390]]) { const p = await page(b, w, h, "expert"); await p.screenshot({ path: path.join(OUT, `howto-00-intro-${w}x${h}.png`) }); LOG["intro-" + w] = { errs: p.errs }; await p.ctx.close(); }
  // Simple: 01 progressions, 02 sustain
  { const p = await page(b, 844, 390, "simple");
    await p.evaluate(() => { const c = [...document.querySelectorAll("#suggest .ss-chip")].find(e => /^Dm /.test(e.getAttribute("aria-label") || "")); if (c) c.classList.add("__dm"); });
    await shot(p, "howto-01-progressions", [{ n: 1, sel: "#kidKey .kk-root" }, { n: 2, sel: "#kidKey .kk-mode" }, { n: 3, sel: "#prog" }, { n: 4, sel: "#suggest .ss-chip.__dm" }]);
    await p.evaluate(() => { const c = [...document.querySelectorAll("#suggest .ss-chip")].find(e => /^Am /.test(e.getAttribute("aria-label") || "")); if (c) c.classList.add("__am"); });
    await tapEl(p, "#suggest .ss-chip.__am");
    await shot(p, "howto-02-sustain", [{ n: 1, sel: "#suggest .ss-chip.__am" }, { n: 2, sel: "#sustainBtn" }]);
    LOG.simple = { errs: p.errs }; await p.ctx.close(); }
  // Expert (sideways)
  { const p = await page(b, 844, 390, "expert");
    await shot(p, "howto-03-style", [{ n: 1, sel: "#xStyle" }, { n: 2, sel: "#xSrc .x-plock", at: "tr" }]);
    await shot(p, "howto-04-grid", [{ n: 1, sel: "#app .next-card", pad: 2 }, { n: 2, sel: "#suggest .ss-chip.borrowed", at: "tr" }]);
    await p.evaluate(() => { const k = [...document.querySelectorAll("#pads .pad.white")].find(e => e.innerText.trim() === "A"); if (k) k.classList.add("__a"); });
    await tapEl(p, "#pads .pad.__a", 0.8);
    await shot(p, "howto-05-make-chord", [{ n: 1, sel: "#pads .pad.__a" }, { n: 2, sel: "#app .now-col" }]);
    await shot(p, "howto-06-fullrange", [{ n: 1, sel: "#xFull" }, { n: 2, sel: "#pads .pad.black.nokey" }]);
    await p.evaluate(() => window.__xmode.setKeys("full")); await p.waitForTimeout(500);
    await shot(p, "howto-07-keyboard", [{ n: 1, sel: "#xKeysChip" }, { n: 2, sel: "#app .kb-wrap", pad: 0 }]);
    await p.evaluate(() => window.__xmode.setKeys("octave")); await p.waitForTimeout(400);
    await p.click("#xSound"); await p.waitForTimeout(600);
    LOG.bandScroll = await p.evaluate(() => { const e = document.getElementById("bandWrap"); e.scrollIntoView({ block: "nearest" }); const r = e.getBoundingClientRect(), hit = document.elementFromPoint(r.x + 20, r.y + r.height / 2); return { rect: [r.x, r.y, r.width, r.height], visible: !!hit && e.contains(hit) }; });
    await shot(p, "howto-08-band", [{ n: 1, sel: "#xSound" }, { n: 2, sel: "#bandWrap" }]);
    if (await p.evaluate(() => document.getElementById("xSound").getAttribute("aria-expanded") === "true")) { await p.evaluate(() => document.getElementById("xScrim").click()); await p.waitForTimeout(400); }   // a tap outside closes the panel
    LOG.soundClosed = await p.evaluate(() => document.getElementById("xSound").getAttribute("aria-expanded"));
    await shot(p, "howto-09-upload", [{ n: 1, sel: "#xModeChip" }, { n: 2, sel: '#xTog button[data-v="song"]' }]);
    await p.evaluate(() => document.getElementById("uploadBtn").click()); await p.waitForTimeout(500);
    await p.fill("#upTitle", "Morning Light"); await p.fill("#upArtist", "Test Band"); await p.dispatchEvent("#upArtist", "input"); await p.waitForTimeout(200);
    await p.evaluate(() => document.getElementById("upLoad").scrollIntoView({ block: "nearest" })); await p.waitForTimeout(200);   // short landscape: the form scrolls so Load shows
    await shot(p, "howto-09b-upload-form", [{ n: 1, sel: ["#upTitle", "#upArtist"] }, { n: 2, sel: "#upCopy" }, { n: 3, sel: "#upPaste" }, { n: 4, sel: "#upLoad" }]);
    await p.evaluate(() => { const x = document.querySelector("#uploadPick .up-x, #uploadPick .kp-x"); if (x) x.click(); }); await p.waitForTimeout(300);
    // 09c: the two lyric lines (P4) with a song loaded
    await p.evaluate(t => window.__upload.load(t), SONG); await p.waitForTimeout(400);
    await p.evaluate(() => { const b = document.querySelector('#xTog button[data-v="song"]'); if (b && !b.classList.contains("on")) b.click(); }); await p.waitForTimeout(300);
    for (let i = 0; i < 40; i++) { const ok = await p.evaluate(() => { const n = document.querySelector("#xSrc .x-now"), rows = document.querySelectorAll("#xSrc .x-lrow"); return !!(n && rows.length >= 2 && /[a-z]{3,}/i.test(rows[0].textContent) && /[a-z]{3,}/i.test(rows[1].textContent) && !/·/.test(rows[1].textContent)); }); if (ok) break; await p.evaluate(() => document.getElementById("xNext").click()); await p.waitForTimeout(350); }
    await p.waitForTimeout(500);
    LOG.lyrics = await p.evaluate(() => ({ rows: [...document.querySelectorAll("#xSrc .x-lrow")].map(e => e.textContent), now: (document.querySelector("#xSrc .x-now") || {}).textContent }));
    await shot(p, "howto-09c-lyrics", [{ n: 1, sel: "#xSrc .x-now", pad: 1 }, { n: 2, sel: "#xSrc .x-lrow:nth-child(2)", at: "bl", pad: 0 }, { n: 3, sel: "#xSrc .x-lock", at: "tr" }]);
    LOG.expert = { errs: p.errs }; await p.ctx.close(); }
  // Kids view: 10
  { const p = await page(b, 844, 390, "kids");
    await p.evaluate(() => { const kv = document.getElementById("kv"); if (kv.dataset.screen === "hello") kv.querySelector(".kv-go").click(); if (kv.dataset.screen === "songs") kv.querySelector('.kv-card[data-song*="Twinkle"]').click(); }); await p.waitForTimeout(700);
    await shot(p, "howto-10-kids", [{ n: 1, sel: "#kv .kv-play .mode-chip", at: "tr" }, { n: 2, sel: "#kv .kv-pad.gold" }, { n: 3, sel: "#kv .kv-piano .gold" }]);
    LOG.kidsLabels = await p.evaluate(() => [...document.querySelectorAll("#kv .kv-pad")].map(e => e.getAttribute("aria-label")));
    LOG.kids = { errs: p.errs }; await p.ctx.close(); }
  await b.close();
  fs.writeFileSync(path.join(OUT, "howto-shots.json"), JSON.stringify(LOG, null, 1)); console.log(JSON.stringify(LOG, null, 0).slice(0, 3000));
})().catch(e => { console.error(e); process.exit(1); });
