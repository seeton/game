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

// Inject a tiny debug helper into the page so we can read planet state.
await page.addInitScript(() => {
  // Wait until app.js has populated module-level globals on window via patched
  // setters. We can't reach into closures, so this script does nothing on its
  // own — we just rely on toolbar state. This stub keeps a hook open for
  // future diagnostics.
});

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

// Phase 3: watch the asteroid disk accrete over 8 seconds.
for (let s = 1; s <= 8; s++) {
  await page.waitForTimeout(1000);
  const dbg = await page.evaluate(() => window.__planetDebug());
  const counts = {};
  let asteroidMassTotal = 0;
  let maxAsteroidMass = 0;
  for (const b of dbg.bodies) {
    counts[b.type] = (counts[b.type] || 0) + 1;
    if (b.type === "asteroid") {
      asteroidMassTotal += b.mass;
      if (b.mass > maxAsteroidMass) maxAsteroidMass = b.mass;
    }
  }
  console.log(`t=+${s}s counts=${JSON.stringify(counts)} asteroidTotal=${asteroidMassTotal.toFixed(1)} maxAsteroidMass=${maxAsteroidMass.toFixed(1)}`);
}
const accretion = await page.evaluate(() => window.__planetDebug());
const planetsAfter = accretion.bodies.filter((b) => b.type === "planet");
console.log(`planets formed: ${planetsAfter.length}`);

async function targetClickByStage(stageNeeded, label) {
  // The planet is on a fast orbit, so its position has moved since the
  // last debug read. Instead of remembering coordinates, locate any
  // planet that is currently at the expected stage and click where it is
  // right now.
  const dbg = await page.evaluate(() => window.__planetDebug());
  const candidate = dbg.bodies
    .filter((b) => b.type === "planet" && (b.stage || 0) === stageNeeded)
    .sort((a, b) => (a.stageTime || 0) - (b.stageTime || 0))[0];
  if (!candidate) {
    console.log(`${label}: no planet at stage ${stageNeeded}`);
    return false;
  }
  const sx = (candidate.x - dbg.cam.x) * dbg.cam.zoom + dbg.canvas.w / 2;
  const sy = (candidate.y - dbg.cam.y) * dbg.cam.zoom + dbg.canvas.h / 2;
  console.log(`${label}: world=(${candidate.x.toFixed(0)},${candidate.y.toFixed(0)}) screen=(${sx.toFixed(0)},${sy.toFixed(0)}) stage=${candidate.stage} stageTime=${(candidate.stageTime || 0).toFixed(2)}`);
  await canvas.click({ position: { x: sx, y: sy }, force: true });
  return true;
}

if (planetsAfter.length === 0) {
  console.log("no planets formed via accretion — skipping ring clicks");
} else {
  // Ring rhythm: poll the debug hook fast, click whenever any planet has its
  // ring inside the hit zone. Three timed hits clear the game.
  const stageDeadline = Date.now() + 25000;
  let lastHitsSeen = 0;
  while (Date.now() < stageDeadline) {
    const dbg = await page.evaluate(() => window.__planetDebug());
    if (dbg.phase === 4) break; // victory
    const hot = dbg.bodies
      .filter((b) => b.type === "planet" && b.ring && b.ring.inHitZone && (b.stage || 0) < 3)
      .sort((a, b) => (b.ring.hits || 0) - (a.ring.hits || 0))[0];
    if (hot) {
      const sx = (hot.x - dbg.cam.x) * dbg.cam.zoom + dbg.canvas.w / 2;
      const sy = (hot.y - dbg.cam.y) * dbg.cam.zoom + dbg.canvas.h / 2;
      const hits = hot.ring.hits || 0;
      if (hits !== lastHitsSeen) {
        lastHitsSeen = hits;
      }
      console.log(`ring tap stage=${hot.stage} hits=${hits} ringR=${hot.ring.radius.toFixed(1)} planetR=${hot.radius.toFixed(1)}`);
      await canvas.click({ position: { x: sx, y: sy }, force: true });
      // Wait for next ring cycle so we don't spam clicks before the
      // next contraction puts the ring back into the hit zone.
      await page.waitForTimeout(900);
    } else {
      await page.waitForTimeout(80);
    }
  }
}

const start = Date.now();
let lastSnap = null;
let tick = 0;
while (Date.now() - start < 25000) {
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
