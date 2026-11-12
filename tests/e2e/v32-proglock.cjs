"use strict";
// Expert progression lock on the ranked v3.2 menus (Vinh Nov 7) + the base behaviour when unlocked.
// ORIGIN=http://127.0.0.1:PORT [SHOTS=dir] node tests/e2e/v32-proglock.cjs   (exit 0 = pass)
const fs = require("fs"), path = require("path");
const { chromium } = require(process.env.PW || "playwright-core");
const ORIGIN = process.env.ORIGIN, SHOTS = process.env.SHOTS;
const V13 = fs.readFileSync(path.join(__dirname, "../fixtures/upload/anh-v13.json"), "utf8");
const HOOK = `(() => { const A = window.ChordAudio; if (!A || A.__pl) return; const o = A.playChord.bind(A); window.__eng = []; A.playChord = function (g, m, opts) { window.__eng.push({ g: String(g), midis: (m||[]).map(Number), bass: opts && opts.bass != null ? opts.bass : null }); return o(g, m, opts); }; A.__pl = true; })()`;
const fails = [], notes = {};
const check = (c, m) => { if (!c) fails.push(m); };
async function boot(b, vp) {
  const ctx = await b.newContext({ viewport: vp, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { try { localStorage.setItem("touchChord.tour.v1", "done"); } catch (e) {} });
  const page = await ctx.newPage(); page.__errs = [];
  page.on("pageerror", (e) => page.__errs.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") page.__errs.push("console: " + m.text()); });
  await page.goto(ORIGIN + "/index.html?test=1&expert=1&hour=12", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__prog && document.querySelector("#xNext"), { timeout: 20000 });
  await page.evaluate(HOOK);
  return { ctx, page };
}
const esc = (p) => p.keyboard.press("Escape").catch(() => {});
async function setStyle(p, s) { await esc(p); await p.locator("#xStyle").click(); await p.locator(`#xStyleMenu button[data-style="${s}"]`).click(); await p.waitForTimeout(150); }
async function setKey(p, pc, mode) { await esc(p); await p.locator("#xKey").click(); await p.locator(`#xKeySheet .x-mk[data-pc="${pc}"]`).click(); await p.locator(`#xKeySheet [data-km="${mode}"]`).click(); await esc(p); await p.waitForTimeout(200); }
async function progView(p) { const on = await p.evaluate(() => document.querySelector('#xTog button[data-v="prog"]').classList.contains("on")); if (!on) await p.locator('#xTog button[data-v="prog"]').click(); await p.waitForTimeout(80); await closeList(p); }
async function openList(p) { await progView(p); if (await p.evaluate(() => document.getElementById("xPList").hidden)) await p.locator("#xSrc .x-pbar").click(); await p.waitForSelector("#xPList button[data-i]"); }
async function pick(p, name) { await openList(p); const i = await p.evaluate((n) => window.__prog.list.findIndex((r) => r.name === n && !r.up), name); if (i < 0) throw new Error("no row " + name); await p.locator(`#xPList button[data-i="${i}"]`).click(); await p.waitForTimeout(150); await esc(p); }
async function closeList(p) { if (!(await p.evaluate(() => document.getElementById("xPList").hidden))) { const bb = await p.locator("#xSrc .x-pbar").boundingBox(); await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); } await p.waitForTimeout(120); check(await p.evaluate(() => document.getElementById("xPList").hidden), "list closed"); }
const lockOn = (p) => p.locator("#xSrc .x-plock").getAttribute("aria-pressed").then((v) => v === "true");
async function setLock(p, on) { await progView(p); if ((await lockOn(p)) !== on) await p.locator("#xSrc .x-plock").click(); await p.waitForTimeout(60); check((await lockOn(p)) === on, "lock aria " + on); }
const cur = (p) => p.evaluate(() => { const P = window.__prog, r = P.list[P.idx]; return { style: P.style, idx: P.idx, name: r && r.name, held: !!(r && r.held), up: !!(r && r.up), steps: r && r.steps && r.steps.join("|"), chords: P.steps.map((s) => s.item.rootName + ":" + s.item.type + ":" + s.item.qualityLabel), labels: P.steps.map((s) => s.item.rootName + s.item.qualityLabel), bar: ((document.querySelector("#xSrc .x-pn") || {}).innerText || "").replace(/\s+/g, " ").trim() }; });
async function nextPlays(p) { await p.evaluate(() => { window.__eng = []; }); await p.locator("#xNext").click(); await p.waitForTimeout(260); return p.evaluate(() => window.__eng.slice()); }

(async () => {
  const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox", "--disable-gpu", "--autoplay-policy=no-user-gesture-required"] });
  const { ctx, page } = await boot(b, { width: 360, height: 780 });
  await setKey(page, 0, "major");
  const CASES = [["jazz", "Jazz ii–V–I", "rnb"], ["jazz", "Jazz Blues", "rnb"], ["country", "Country Rag", "funk"], ["ballad", "Ballad Hymn", "pop"],
    ["reggae", "Reggae Sway", "rnb"], ["pop", "Pop Turnaround", "jazz"], ["rnb", "R&B Sway", "reggae"], ["jazz", "Jazz Turnaround", "pop"]];
  notes.unlocked = []; notes.locked = [];
  for (const [from, name, to] of CASES) {   // unlocked: today's rule (style change -> first row)
    await setStyle(page, from); await pick(page, name); await setLock(page, false);
    await setStyle(page, to); const a = await cur(page);
    const row0 = await page.evaluate(() => window.__prog.list[0].name);
    check(a.idx === 0 && a.name === row0, `unlocked ${name} -> ${to}: ${a.name}`);
    notes.unlocked.push(`${name} -> ${to}: ${a.name}`);
  }
  for (const [from, name, to] of CASES) {   // locked: same steps in the new style, same row back
    await setStyle(page, from); await pick(page, name); const a = await cur(page); await setLock(page, true);
    await setStyle(page, to); const bb = await cur(page);
    check(bb.steps === a.steps, `locked ${name} -> ${to}: steps ${bb.steps} != ${a.steps}`);
    check(JSON.stringify(bb.chords) === JSON.stringify(a.chords), `locked ${name} -> ${to}: chords ${bb.chords}`);
    check(bb.style === to, `style ${bb.style}`);
    const e = await nextPlays(page); check(e.length > 0, `locked ${name} in ${to}: Next did not play`);
    await setStyle(page, from); const c = await cur(page);
    check(c.name === name && !c.held, `locked ${name} back in ${from}: ${c.name}`);
    notes.locked.push(`${name} -> ${to}: ${bb.name}${bb.held ? " (held)" : ""} [${bb.steps}] bar "${bb.bar}"; back: ${c.name}`);
    await setLock(page, false);
  }
  // A locked pick whose steps are on the new menu uses that row
  await setStyle(page, "pop"); await pick(page, "Pop Turnaround"); await setLock(page, true); await setStyle(page, "rnb");
  let s = await cur(page); check(s.name === "R&B DooWop" && !s.held, "same-steps row: " + s.name); notes.sameSteps = s.name;
  await setLock(page, false);
  // Locked through a key and a mode change
  await setStyle(page, "jazz"); await pick(page, "Jazz Blues"); await setLock(page, true); await setStyle(page, "rnb");
  await setKey(page, 7, "major"); s = await cur(page);
  check(s.name === "Jazz Blues" && s.labels.join(" ") === "G7 C7 D7 G7", "locked key change: " + JSON.stringify(s)); notes.keyChange = s;
  await setKey(page, 7, "minor"); s = await cur(page); check(s.name === "Jazz Blues", "locked mode change: " + s.name); notes.modeChange = s.name;
  await setKey(page, 0, "major");
  // Unlock on a held row: it stays; the next style change is today's rule
  await setLock(page, false); s = await cur(page); check(s.name === "Jazz Blues" && s.held, "unlock keeps held row: " + s.name);
  await setStyle(page, "funk"); s = await cur(page); check(s.idx === 0, "after unlock style change: " + s.name);
  // The list shows the held row with its style
  await setStyle(page, "jazz"); await pick(page, "Jazz Leaves"); await setLock(page, true); await setStyle(page, "country"); await openList(page);
  notes.listHeld = await page.evaluate(() => { const on = document.querySelector("#xPList .x-prow.on"); return on && on.innerText.replace(/\s+/g, " ").trim(); });
  check(/Leaves\s*Jazz/.test(notes.listHeld || ""), "held row in list: " + notes.listHeld);
  await closeList(page); await setLock(page, false); await setStyle(page, "pop");
  // A selected song keeps the song route (its own Lock is separate)
  const r = await page.evaluate((t) => window.__upload.load(t), V13); await page.waitForTimeout(600); await esc(page);
  check(r.ok, "song load");
  await progView(page); await setLock(page, true);
  const songLock0 = await page.evaluate(() => window.__upload.lock());
  await setStyle(page, "jazz"); s = await cur(page); check(s.up, "song stays selected with progression lock: " + s.name);
  const songLock1 = await page.evaluate(() => window.__upload.lock());
  check(JSON.stringify(songLock0) === JSON.stringify(songLock1), "song Lock untouched");
  await progView(page); await setLock(page, false);
  await page.evaluate(() => window.__upload.remove()); await page.waitForTimeout(300);
  // Simple keeps today's rule even if the Expert lock is on
  await setStyle(page, "jazz"); await pick(page, "Jazz Blues"); await setLock(page, true);
  await page.locator("[data-mode-chip]:visible").click(); await page.locator('#msMode button[data-mode="simple"]').click();
  await page.waitForFunction(() => document.documentElement.classList.contains("simple"));
  await page.evaluate(() => document.querySelector('#styles button[data-style="rnb"]').click()); await page.waitForTimeout(300);
  s = await cur(page); check(s.idx === 0 && s.style === "rnb", "Simple style change: " + JSON.stringify(s)); notes.simple = s.name;
  // Kids: no held row
  await page.locator("[data-mode-chip]:visible").click(); await page.locator('#msMode button[data-mode="kids"]').click(); await page.waitForTimeout(600);
  s = await cur(page); check(!s.held && s.style === "kids", "Kids: " + JSON.stringify(s)); notes.kids = s.name;
  notes.errors = page.__errs.slice(); check(!page.__errs.length, "page errors " + page.__errs.join(" | "));
  await ctx.close();
  // Sizes: 44 x 44 tap area, inside the screen, not over the progression bar
  notes.sizes = {};
  for (const [nm, vp] of [["360x780", { width: 360, height: 780 }], ["780x360", { width: 780, height: 360 }], ["768x1024", { width: 768, height: 1024 }], ["1024x768", { width: 1024, height: 768 }]]) {
    const { ctx: c2, page: p2 } = await boot(b, vp);
    await setKey(p2, 0, "major"); await setStyle(p2, "jazz"); await pick(p2, "Jazz Blues"); await setLock(p2, true); await setStyle(p2, "rnb");
    const m = await p2.evaluate(() => {
      const L = document.querySelector("#xSrc .x-plock"), B = document.querySelector("#xSrc .x-pbar"), r = L.getBoundingClientRect(), br = B.getBoundingClientRect(), af = getComputedStyle(L, "::after");
      // the real tap area: probe along the centre lines with elementFromPoint
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2, onL = (x, y) => { const e = document.elementFromPoint(x, y); return !!e && (e === L || L.contains(e)); };
      let t = cy, bt = cy, lf = cx, rt = cx;
      while (onL(cx, t - 0.5)) t -= 0.5; while (onL(cx, bt + 0.5)) bt += 0.5; while (onL(lf - 0.5, cy)) lf -= 0.5; while (onL(rt + 0.5, cy)) rt += 0.5;
      const hit = { left: lf, right: rt, top: t, bottom: bt }, hw = rt - lf, hh = bt - t;
      const others = [...document.querySelectorAll("button, [role=button], input, select, .ss-chip, .ss-note")].filter((n) => n !== L && !L.contains(n) && n.offsetParent !== null).map((n) => ({ n, rr: n.getBoundingClientRect() }))
        .filter(({ rr }) => rr.width > 0 && rr.left < hit.right - 0.5 && rr.right > hit.left + 0.5 && rr.top < hit.bottom - 0.5 && rr.bottom > hit.top + 0.5).map(({ n }) => n.id || n.className);
      return { w: Math.round(r.width), h: Math.round(r.height), hitW: hw, hitH: hh, inView: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, overBar: !(r.left >= br.right - 0.5 || r.right <= br.left + 0.5 || r.top >= br.bottom - 0.5 || r.bottom <= br.top + 0.5),
        hitOverlaps: others, centerHit: onL(cx, cy), bar: B.innerText.replace(/\s+/g, " ").trim(), docScroll: document.scrollingElement.scrollHeight > innerHeight + 1 };
    });
    notes.sizes[nm] = m;
    check(m.hitW >= 44 && m.hitH >= (nm === "780x360" ? 40 : 44), `${nm} hit ${m.hitW}x${m.hitH}`);   // 780x360: the whole row is 32px with 4px / 7px gaps; 40px is all the free height
    check(m.w >= 44, `${nm} width ${m.w}`);
    check(m.inView && !m.overBar && m.centerHit, `${nm} placement ${JSON.stringify(m)}`);
    check(!m.hitOverlaps.length, `${nm} tap area overlaps ${m.hitOverlaps}`);
    if (SHOTS) {
      await p2.screenshot({ path: path.join(SHOTS, `lock-after-${nm}-locked-jazz-blues-in-rnb.png`) });
      await openList(p2); await p2.screenshot({ path: path.join(SHOTS, `lock-after-${nm}-list-open.png`) }); await closeList(p2);
    }
    check(!p2.__errs.length, `${nm} page errors ${p2.__errs}`);
    await c2.close();
  }
  await b.close();
  console.log(JSON.stringify({ origin: ORIGIN, fails, notes }, null, 1));
  process.exit(fails.length ? 2 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
