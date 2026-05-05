// Playwright probe: open /planet/, click the canvas, and report whether the
// inflation phase actually accepts mote clicks (i.e., planetBodies grows and
// motes get drawn).
import { chromium } from "playwright";

const url = process.argv[2] || "http://127.0.0.1:8000/planet/";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

const consoleMsgs = [];
const errors = [];
page.on("console", (msg) => consoleMsgs.push(`[${msg.type()}] ${msg.text()}`));
page.on("pageerror", (err) => errors.push(`PAGEERROR: ${err.message}\n${err.stack || ""}`));

await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);

// Scroll the canvas into view.
await page.evaluate(() => document.getElementById("planet-canvas").scrollIntoView({ block: "center" }));
await page.waitForTimeout(200);

const probeBefore = await page.evaluate(() => {
  const canvas = document.getElementById("planet-canvas");
  if (!canvas) return { error: "no canvas" };
  const rect = canvas.getBoundingClientRect();
  return {
    canvasW: canvas.width,
    canvasH: canvas.height,
    rectW: rect.width,
    rectH: rect.height,
    rectX: rect.x,
    rectY: rect.y,
    panelHidden: document.getElementById("planet-panel").hidden,
    overlayHidden: document.getElementById("planet-overlay").hidden,
  };
});
console.log("probeBefore:", probeBefore);

// Click at the canvas center using Playwright's locator (which handles scroll
// and pointer events more like a real user).
const canvas = page.locator("#planet-canvas");
// Place 18 motes near the centre to trip the inflation -> stars threshold.
for (let i = 0; i < 18; i++) {
  const px = probeBefore.rectW / 2 + (Math.random() - 0.5) * 200;
  const py = probeBefore.rectH / 2 + (Math.random() - 0.5) * 120;
  await canvas.click({ position: { x: px, y: py }, force: true });
  await page.waitForTimeout(60);
}
await page.waitForTimeout(2000);

const probeAfter = await page.evaluate(() => {
  return {
    bodyCount: document.getElementById("planet-body-count")?.textContent,
    progress: document.getElementById("planet-progress-text")?.textContent,
    phase: document.getElementById("planet-phase-text")?.textContent,
    overlayHidden: document.getElementById("planet-overlay").hidden,
  };
});
console.log("probeAfter (after 18 clicks + 2s wait):", probeAfter);

if (errors.length) {
  console.log("\n=== page errors ===");
  errors.forEach((e) => console.log(e));
}
const interesting = consoleMsgs.filter((m) => /error|warn|planet|canvas/i.test(m));
if (interesting.length) {
  console.log("\n=== console (filtered) ===");
  interesting.forEach((m) => console.log(m));
}

await browser.close();
