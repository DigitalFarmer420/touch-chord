"use strict";
const fs = require("fs");
const { chromium } = require("/workspace/node_modules/playwright-core");
const REV = JSON.parse(fs.readFileSync(require("path").join(__dirname, "../fixtures/six-choice-review.json"), "utf8"));
const ADULT = ["pop", "jazz", "rnb", "ballad", "reggae", "funk", "yogaDeep", "country"];
const by = {};
REV.items.forEach((it) => { by[it.style + "\0" + it.name] = it; });
function feel(name) { return name.replace(/^(Pop|Jazz|R&B|Ballad|Reggae|Funk|Yoga|Country)\s+/, ""); }
function expectRows(style, mode) {
  return REV.selected[style].filter((name) => by[style + "\0" + name].modes[mode]).map(feel);
}
const HOOK = `(() => { const A = window.ChordAudio; if (!A || A.__r27) return; const o = A.playChord.bind(A); window.__eng = []; A.playChord = function (g, m, opts) { window.__eng.push({ g: String(g), midis: (m||[]).map(Number), bass: opts && opts.bass != null ? opts.bass : null, time: opts && opts.time != null ? opts.time : null }); return o(g, m, opts); }; A.__r27 = true; })()`;
const CHROME = "/usr/local/bin/google-chrome";
const ARGS = ["--autoplay-policy=no-user-gesture-required", "--disable-background-timer-throttling", "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"];
const errors = [];
function check(cond, msg) { if (!cond) errors.push(msg); }

async function boot(browser, origin, surface) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await context.addInitScript(() => { try { localStorage.setItem("touchChord.tour.v1", "done"); } catch (e) {} });
  const page = await context.newPage();
  await page.goto(origin + "/index.html?test=1&expert=1&hour=12", { waitUntil: "domcontentloaded", timeout: 25000 });
  await page.waitForFunction(() => window.__prog && document.querySelector("#xNext"), { timeout: 20000 });
  await page.evaluate(HOOK);
  if (surface === "simple") {
    await page.locator("[data-mode-chip]:visible").click();
    await page.locator('#msMode button[data-mode="simple"]').click();
    await page.waitForFunction(() => document.documentElement.classList.contains("simple"));
  }
  return { context, page };
}
async function setKey(page, pc, mode) {
  await page.keyboard.press("Escape").catch(() => {});
  await page.locator("#xKey").click({ timeout: 8000 });
  await page.locator(`#xKeySheet .x-mk[data-pc="${pc}"]`).click();
  await page.locator(`#xKeySheet [data-km="${mode}"]`).click();
  await page.keyboard.press("Escape").catch(() => {});
}
async function setStyle(page, style) {
  await page.keyboard.press("Escape").catch(() => {});
  await page.locator("#xStyle").click();
  await page.locator(`#xStyleMenu button[data-style="${style}"]`).click();
}
async function readExpertMenu(page) {
  const bar = page.locator("#xSrc .x-pbar");
  const barBox = await bar.boundingBox().catch(() => null);
  if (!barBox || barBox.height < 2) await page.locator('#xTog button[data-v="prog"]').click({ timeout: 8000 });
  const hidden = await page.evaluate(() => { const n = document.getElementById("xPList"); return !n || n.hidden; });
  if (hidden) await page.locator("#xSrc .x-pbar").click({ timeout: 8000 });
  await page.waitForSelector("#xPList button[data-i]", { timeout: 5000 });
  const rows = await page.locator("#xPList button[data-i] b").allInnerTexts();
  return rows.map((s) => s.trim());
}
async function pickFeel(page, feelName) {
  const hidden = await page.evaluate(() => document.getElementById("xPList").hidden);
  if (hidden) await page.locator("#xSrc .x-pbar").click();
  const rows = page.locator("#xPList button[data-i]");
  const n = await rows.count();
  for (let i = 0; i < n; i++) {
    const t = (await rows.nth(i).locator("b").innerText()).trim();
    if (t === feelName) { await rows.nth(i).click(); return; }
  }
  throw new Error("no row " + feelName);
}
async function identity(page) {
  return page.evaluate(() => {
    const p = window.__prog;
    const item = p.list[p.idx];
    return {
      name: item && item.name, idx: p.idx, up: !!(item && item.up),
      key: p.key && { pc: p.key.pc, mode: p.key.mode },
      style: (document.querySelector("#styles button.on") || {}).dataset && document.querySelector("#styles button.on").dataset.style,
      bar: ((document.querySelector("#xSrc .x-pn") || {}).innerText || "").replace(/\s+/g, " ").trim().slice(0, 80),
      menu: [...document.querySelectorAll("#xPList button[data-i] b")].map((n) => n.textContent.trim())
    };
  });
}

async function main() {
  const origin = process.env.ORIGIN;
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ARGS });
  const out = { menus: [], deferred: [], play: null, simple: [], settings: null, upload: null, grid: null, errors };
  const b = await boot(browser, origin, "expert");
  const page = b.page;
  const ver = await page.evaluate(() => ({
    title: document.title,
    badge: !!document.getElementById("dev-badge"),
    ver: document.getElementById("msVer") ? document.getElementById("msVer").innerText.replace(/\s+/g, " ").trim() : null
  }));
  await page.locator("[data-mode-chip]:visible").click();
  const sheet = await page.evaluate(() => ({
    ver: document.getElementById("msVer") ? document.getElementById("msVer").innerText.replace(/\s+/g, " ").trim() : null,
    badge: !!document.getElementById("dev-badge")
  }));
  await page.keyboard.press("Escape");
  out.settings = { title: ver.title, sheet, badge: ver.badge };
  check(ver.title === "Touch Chord", "title " + ver.title);
  check(!ver.badge && !sheet.badge, "floating badge present");
  check(sheet.ver && sheet.ver.indexOf("Version") >= 0 && sheet.ver.indexOf("Build") >= 0 && sheet.ver.indexOf("RC testing") < 0, "settings version " + sheet.ver);

  for (const style of ADULT) {
    await setStyle(page, style);
    for (const mode of ["major", "minor"]) {
      await setKey(page, 0, mode);
      const rows = await readExpertMenu(page);
      const want = expectRows(style, mode);
      out.menus.push({ style, mode, rows, want });
      check(JSON.stringify(rows) === JSON.stringify(want), style + " " + mode + " menu " + rows.join(",") + " != " + want.join(","));
      await page.keyboard.press("Escape").catch(() => {});
      if (mode === "major") {
        await setKey(page, 7, "major");
        const again = await readExpertMenu(page);
        check(JSON.stringify(again) === JSON.stringify(want), style + " reopen after G " + again.join(","));
        await page.keyboard.press("Escape").catch(() => {});
      }
    }
  }

  await setStyle(page, "jazz");
  await setKey(page, 0, "major");
  await pickFeel(page, "Blues");
  const blues = await identity(page);
  check(blues.name === "Jazz Blues", "blues name " + blues.name);
  await setKey(page, 0, "minor");
  await page.waitForFunction(() => ((document.querySelector("#xSrc .x-pn") || {}).innerText || "").indexOf("Turnaround") >= 0, { timeout: 3000 }).catch(() => {});
  const after = await identity(page);
  const minorMenu = await readExpertMenu(page);
  after.menu = minorMenu;
  out.deferred.push({ from: blues, to: after });
  check(after.name === "Jazz Turnaround", "minor fallback " + after.name);
  check(after.bar.indexOf("Turnaround") >= 0, "bar " + after.bar);
  check(after.name !== "Jazz Blues" && minorMenu.indexOf("Blues") < 0, "blues still offered in minor " + minorMenu.join(","));
  const played = await page.evaluate(() => window.__prog.list[window.__prog.idx].name);
  check(played === after.name, "playback name " + played + " != bar " + after.name);

  await setStyle(page, "country");
  await setKey(page, 0, "major");
  await pickFeel(page, "Three-Chord");
  await setKey(page, 0, "minor");
  await page.waitForFunction(() => ((document.querySelector("#xSrc .x-pn") || {}).innerText || "").indexOf("Outlaw") >= 0, { timeout: 3000 }).catch(() => {});
  const country = await identity(page);
  out.deferred.push({ country });
  check(country.name === "Country Outlaw", "country minor " + country.name);
  check(country.bar.indexOf("Outlaw") >= 0, "country bar " + country.bar);

  await setStyle(page, "pop");
  await setKey(page, 0, "major");
  await pickFeel(page, "Rock");
  await setStyle(page, "jazz");
  await setStyle(page, "pop");
  await page.waitForFunction(() => ((document.querySelector("#xSrc .x-pn") || {}).innerText || "").indexOf("Four-Chord") >= 0, { timeout: 3000 }).catch(() => {});
  const back = await identity(page);
  out.deferred.push({ backToPop: back });
  check(back.name === "Pop Four-Chord", "style return " + back.name);
  check(back.bar.indexOf("Four-Chord") >= 0, "style bar " + back.bar);

  await setStyle(page, "ballad");
  await setKey(page, 0, "major");
  await pickFeel(page, "Steps");
  await page.evaluate(() => { window.__eng = []; });
  const t0 = Date.now();
  await page.locator("#xPlay").click();
  await page.waitForFunction((n) => window.__prog.log.length >= n, 5, { timeout: 20000 });
  const wall = Date.now() - t0;
  const snap = await page.evaluate(() => ({
    name: window.__prog.list[window.__prog.idx].name,
    log: window.__prog.log.map((e) => ({ i: e.i, t: e.t, sym: e.sym })),
    eng: window.__eng.filter((e) => e.g.charAt(0) === "P")
  }));
  await page.locator("#xPlay").click();
  await page.waitForTimeout(150);
  const stopped = await page.evaluate(() => window.__prog.playing);
  out.play = { wall, stopped, name: snap.name, log: snap.log, notes: snap.eng.map((e) => e.midis) };
  check(snap.name === "Ballad Steps", "play name");
  check(JSON.stringify(snap.log.map((e) => e.i)) === JSON.stringify([0, 1, 2, 3, 0]), "play order " + snap.log.map((e) => e.i));
  for (let i = 1; i < snap.log.length; i++) check(Math.abs((snap.log[i].t - snap.log[i - 1].t) - 3) < 0.05, "delta " + i);
  check(snap.eng[1] && snap.eng[1].midis.join(",") === "59,67,71,74", "G/B " + (snap.eng[1] && snap.eng[1].midis));
  check(stopped === false, "stop " + stopped);
  check(wall >= 11000, "wall " + wall);
  await b.context.close();

  const s = await boot(browser, origin, "simple");
  for (const style of ADULT) {
    await s.page.locator(`#styles button[data-style="${style}"]`).click();
    for (const mode of ["major", "minor"]) {
      const nowMode = await s.page.evaluate(() => window.__prog.key.mode);
      if (nowMode !== mode) await s.page.locator("#kidKey .kk-mode").click();
      const want = REV.selected[style].filter((n) => by[style + "\0" + n].modes[mode]);
      for (let i = 0; i < 8; i++) {
        const name = await s.page.evaluate(() => window.__prog.list[window.__prog.idx].name);
        if (name === want[0]) break;
        await s.page.locator("#prog .pg-prev").click();
      }
      const names = [];
      for (let i = 0; i < 8; i++) {
        const name = await s.page.evaluate(() => window.__prog.list[window.__prog.idx].name);
        if (names[0] === name) break;
        names.push(name);
        const shown = await s.page.evaluate(() => ((document.querySelector("#prog .pg-t") || {}).innerText || "").replace(/\s+/g, " ").trim());
        if (shown && name.indexOf(shown) < 0 && shown.indexOf(name.replace(/^(Pop|Jazz|R&B|Ballad|Reggae|Funk|Yoga|Country)\s+/, "")) < 0) {
          errors.push("simple label " + shown + " != " + name);
        }
        await s.page.locator("#prog .pg-next").click();
      }
      out.simple.push({ style, mode, names, want });
      check(JSON.stringify(names) === JSON.stringify(want), "simple " + style + " " + mode + " " + names.join("|"));
    }
  }
  await s.context.close();

  const u = await boot(browser, origin, "expert");
  const up = u.page;
  await up.locator('#xTog button[data-v="song"]').click();
  await up.waitForSelector("#uploadPick:not([hidden]) #upPaste", { timeout: 8000 });
  await up.fill("#upPaste", fs.readFileSync("/workspace/tests/fixtures/upload/anh-v13.json", "utf8"));
  await up.locator("#upLoad").click();
  await up.waitForFunction(() => { const m = document.getElementById("upMsg"); return m && !m.hidden; }, { timeout: 20000 });
  await up.keyboard.press("Escape");
  const before = await up.evaluate(() => ({
    raw: localStorage.getItem("touchChord.library.v1"),
    song: window.__upload.song()
  }));
  const parsed = JSON.parse(before.raw);
  const rec = parsed.songs[0];
  await up.reload({ waitUntil: "domcontentloaded" });
  await up.waitForFunction(() => window.__upload, { timeout: 20000 });
  const afterSave = await up.evaluate(() => ({
    raw: localStorage.getItem("touchChord.library.v1"),
    song: window.__upload.song()
  }));
  const parsed2 = JSON.parse(afterSave.raw);
  out.upload = {
    beforeId: rec.id, afterId: parsed2.songs[0] && parsed2.songs[0].id,
    beforeHash: JSON.stringify(rec.song), afterHash: parsed2.songs[0] && JSON.stringify(parsed2.songs[0].song),
    beforeLocked: rec.locked, afterLocked: parsed2.songs[0] && parsed2.songs[0].locked,
    beforeLive: rec.liveKey, afterLive: parsed2.songs[0] && parsed2.songs[0].liveKey,
    songBefore: before.song && before.song.title, songAfter: afterSave.song && afterSave.song.title
  };
  check(out.upload.beforeId && out.upload.beforeId === out.upload.afterId, "library id changed");
  check(out.upload.beforeHash === out.upload.afterHash, "song bytes changed");
  check(out.upload.beforeLocked === out.upload.afterLocked, "lock changed");
  check(JSON.stringify(out.upload.beforeLive) === JSON.stringify(out.upload.afterLive), "liveKey changed");
  check(out.upload.songAfter === "Anh Đã Ổn Hơn", "song not restored " + out.upload.songAfter);
  const menu = await readExpertMenu(up);
  out.upload.menuAfterSong = menu;
  check(menu.length === 6 && menu.indexOf("Anh Đã Ổn Hơn") < 0, "upload became a factory row " + menu.join(","));
  await up.keyboard.press("Escape").catch(() => {});
  await u.context.close();

  async function chips(page) {
    await setStyle(page, "jazz");
    await setKey(page, 0, "major");
    await pickFeel(page, "ii–V–I");
    return page.evaluate(() => ({
      name: window.__prog.list[window.__prog.idx].name,
      chips: document.querySelectorAll("#suggest .ss-chip").length,
      tmp: document.querySelectorAll("#suggest .ss-chip.tmp").length
    }));
  }
  const g1 = await boot(browser, origin, "expert");
  out.grid = { fresh: await chips(g1.page) };
  await g1.context.close();
  const g2 = await boot(browser, origin, "expert");
  await g2.page.locator('#xTog button[data-v="song"]').click();
  await g2.page.waitForSelector("#upPaste", { timeout: 8000 });
  await g2.page.fill("#upPaste", fs.readFileSync("/workspace/tests/fixtures/upload/anh-v13.json", "utf8"));
  await g2.page.locator("#upLoad").click();
  await g2.page.waitForFunction(() => document.getElementById("upMsg") && !document.getElementById("upMsg").hidden, { timeout: 20000 });
  await g2.page.keyboard.press("Escape");
  await g2.page.locator('#xTog button[data-v="prog"]').click();
  out.grid.afterSong = await chips(g2.page);
  await g2.context.close();
  await browser.close();
  out.errors = errors;
  fs.writeFileSync(process.env.OUT, JSON.stringify(out, null, 2));
  console.log("checks", errors.length);
  errors.forEach((e) => console.log("FAIL", e));
  process.exitCode = errors.length ? 1 : 0;
}
main().catch((e) => { console.error(e); process.exitCode = 3; });
