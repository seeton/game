// Full playthrough probe: scatter motes, wait for ignition, fire the
// supernova, then watch whether the asteroid disk self-aggregates into a
// living planet without further user input.
import { chromium } from "playwright";

const url = process.argv[2] || "http://127.0.0.1:8000/planet/";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

const errors = [];
page.on("pageerror", (err) => errors.push(`${err.message}\n${err.stack || ""}`));

await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
await page.evaluate(() => document.getElementById("planet-canvas").scrollIntoView({ block: "center" }));
await page.waitForTimeout(200);

const canvas = page.locator("#planet-canvas");
const rect = await canvas.evaluate((el) => {
  const r = el.getBoundingClientRect();
  return { w: r.width, h: r.height };
});
console.log(`canvas rect: ${rect.w}x${rect.h}`);

async function snapshot() {
  return await page.evaluate(() => ({
    phase: document.getElementById("planet-phase-text")?.textContent,
    progress: document.getElementById("planet-progress-text")?.textContent,
    bodies: document.getElementById("planet-body-count")?.textContent,
    life: document.getElementById("planet-life-count")?.textContent,
    victory: !document.getElementById("planet-victory")?.hidden,
  }));
}

// Phase 1: scatter 22 motes around the centre.
for (let i = 0; i < 22; i++) {
  const px = rect.w / 2 + (Math.random() - 0.5) * 220;
  const py = rect.h / 2 + (Math.random() - 0.5) * 140;
  await canvas.click({ position: { x: px, y: py }, force: true });
  await page.waitForTimeout(70);
}
console.log("after motes:", await snapshot());

// Wait up to 12s for ignition.
for (let i = 0; i < 60 && !(await snapshot()).phase?.includes("超新星"); i++) {
  await page.waitForTimeout(200);
}
console.log("after ignition wait:", await snapshot());

// Phase 2: click on the surviving star at canvas centre to detonate.
for (let i = 0; i < 10 && !(await snapshot()).phase?.includes("惑星"); i++) {
  await canvas.click({ position: { x: rect.w / 2, y: rect.h / 2 }, force: true });
  await page.waitForTimeout(300);
}
console.log("after detonation click:", await snapshot());

// Wire up an introspection helper from page-side. It walks the canvas
// position via getImageData isn't useful — we need the JS state. Hack: dispatch
// a synthetic event to read internal counts. Easiest: since app.js is a module
// without exports, hook into any global the tests set. None exist, so we just
// rely on the toolbar text. Provide more detail via a click no-op and read
// trail data... actually let's just read the toolbar plus the chart-less.
const start = Date.now();
let lastSnap = null;
let tick = 0;
while (Date.now() - start < 30000) {
  await page.waitForTimeout(2000);
  lastSnap = await snapshot();
  tick++;
  console.log(`t=${(tick*2).toFixed(0)}s`, lastSnap);
  if (lastSnap.victory) break;
}
console.log("final:", lastSnap);

if (errors.length) {
  console.log("\n=== page errors ===");
  errors.forEach((e) => console.log(e));
}
await browser.close();
process.exit(lastSnap?.victory ? 0 : 1);
