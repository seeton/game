// Headless verification of the Genesis (planet) simulation.
//
// Mirrors the physics constants and step logic from
// publish/static/app.js so it can be run from Node without any DOM.
// The goal: prove that the game is clearable with a reasonable
// human-style strategy, and surface failures via exit code.
//
// Run: node scripts/verify_planet_sim.mjs

const PLANET_G = 200;
const PLANET_SOFTENING = 200;
const PLANET_MAX_BODIES = 80;

const PLANET_PHASE_INFLATION = 0;
const PLANET_PHASE_STARS = 1;
const PLANET_PHASE_SUPERNOVA = 2;
const PLANET_PHASE_PLANETS = 3;
const PLANET_PHASE_VICTORY = 4;

const INFLATION_MOTE_TARGET = 18;
const MOTE_TO_GAS_MASS = 30;
const GAS_TO_STAR_MASS = 80;
const STARS_PHASE_TARGET = 2;
const SUPERNOVA_TARGET = 1;
const ASTEROID_HABITABLE_BONUS = 1.6;
const LIFE_DURATION_TARGET = 5;

const PLANET_HEAT_FROZEN = 0.2;
const PLANET_HEAT_HOT = 5.5;
const PLANET_LIFE_DELAY = 3.0;

const PLANET_TYPE_PRIORITY = { star: 5, planet: 4, gas: 3, asteroid: 2, mote: 1 };
const PLANET_TYPES = {
  mote:     { massBase: 12,  massVariance: 8,   radiusFactor: 2.0, minRadius: 2,  speedRange: [4, 14] },
  gas:      { massBase: 25,  massVariance: 15,  radiusFactor: 3.6, minRadius: 4,  speedRange: [0, 0] },
  star:     { massBase: 240, massVariance: 100, radiusFactor: 3.6, minRadius: 12, speedRange: [0, 3] },
  planet:   { massBase: 8,   massVariance: 6,   radiusFactor: 4.5, minRadius: 5,  speedRange: [13, 22] },
  asteroid: { massBase: 1.6, massVariance: 1.4, radiusFactor: 4.0, minRadius: 3,  speedRange: [40, 70] },
};

// Mulberry32 PRNG so runs are reproducible.
function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function planetRadiusFor(type, mass) {
  const config = PLANET_TYPES[type] || PLANET_TYPES.planet;
  const minR = config.minRadius != null ? config.minRadius : 3;
  return Math.max(minR, Math.cbrt(Math.max(0.05, mass)) * config.radiusFactor);
}

function createPlanetBody(state, x, y, typeKey) {
  const type = PLANET_TYPES[typeKey] ? typeKey : "mote";
  const config = PLANET_TYPES[type];
  const rng = state.rng;
  const mass = config.massBase + rng() * config.massVariance;
  const cx = state.canvasW / 2;
  const cy = state.canvasH / 2;
  const dx = x - cx;
  const dy = y - cy;
  const r = Math.hypot(dx, dy);
  const [minSpeed, maxSpeed] = config.speedRange;
  const speed = minSpeed + rng() * Math.max(0, maxSpeed - minSpeed);

  let vx = 0;
  let vy = 0;
  if (type === "planet") {
    let anchorX = cx;
    let anchorY = cy;
    let anchorMass = 0;
    let nearestStar = null;
    let nearestD2 = Infinity;
    for (const body of state.bodies) {
      if (body.type !== "star") continue;
      const sdx = x - body.x;
      const sdy = y - body.y;
      const d2 = sdx * sdx + sdy * sdy;
      if (d2 < nearestD2) {
        nearestStar = body;
        nearestD2 = d2;
      }
    }
    if (nearestStar) {
      anchorX = nearestStar.x;
      anchorY = nearestStar.y;
      anchorMass = nearestStar.mass;
    }
    const adx = x - anchorX;
    const ady = y - anchorY;
    const ar = Math.hypot(adx, ady);
    const angle = Math.atan2(ady, adx) + Math.PI / 2 + (rng() - 0.5) * 0.18;
    let orbitSpeed = speed;
    if (anchorMass > 0 && ar > 0.5) {
      const ar2 = ar * ar;
      const v2 = (PLANET_G * anchorMass * ar) / (ar2 + PLANET_SOFTENING);
      orbitSpeed = Math.sqrt(Math.max(0, v2)) * (0.96 + rng() * 0.06);
      if (nearestStar) {
        vx = nearestStar.vx + Math.cos(angle) * orbitSpeed;
        vy = nearestStar.vy + Math.sin(angle) * orbitSpeed;
      } else {
        vx = Math.cos(angle) * orbitSpeed;
        vy = Math.sin(angle) * orbitSpeed;
      }
    } else {
      vx = Math.cos(angle) * orbitSpeed;
      vy = Math.sin(angle) * orbitSpeed;
    }
  } else if (type === "mote") {
    const baseAngle = r > 0.5 ? Math.atan2(dy, dx) : rng() * Math.PI * 2;
    const angle = baseAngle + (rng() - 0.5) * 1.6;
    vx = Math.cos(angle) * speed;
    vy = Math.sin(angle) * speed;
  } else if (type === "asteroid") {
    const angle = rng() * Math.PI * 2;
    vx = Math.cos(angle) * speed;
    vy = Math.sin(angle) * speed;
  }

  return {
    type,
    x, y, vx, vy,
    mass,
    radius: planetRadiusFor(type, mass),
    state: type === "planet" ? "barren" : null,
    habitableTime: 0,
    aliveTime: 0,
  };
}

function computePlanetHeat(body, bodies) {
  let heat = 0;
  for (const star of bodies) {
    if (star === body || star.type !== "star") continue;
    const dx = star.x - body.x;
    const dy = star.y - body.y;
    const r2 = dx * dx + dy * dy;
    if (r2 < 25) {
      heat += star.mass / 25;
    } else {
      heat += star.mass / r2;
    }
  }
  return heat;
}

function stepPlanets(state, dt) {
  const bodies = state.bodies;
  const n = bodies.length;
  if (n === 0) return;

  const ax = new Float64Array(n);
  const ay = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = bodies[j].x - bodies[i].x;
      const dy = bodies[j].y - bodies[i].y;
      const r2 = dx * dx + dy * dy;
      const r = Math.sqrt(r2);
      if (r < 0.5) continue;
      const f = PLANET_G / (r2 + PLANET_SOFTENING);
      const fx = (f * dx) / r;
      const fy = (f * dy) / r;
      ax[i] += fx * bodies[j].mass;
      ay[i] += fy * bodies[j].mass;
      ax[j] -= fx * bodies[i].mass;
      ay[j] -= fy * bodies[i].mass;
    }
  }

  for (let i = 0; i < n; i++) {
    const body = bodies[i];
    body.vx += ax[i] * dt;
    body.vy += ay[i] * dt;
    body.x += body.vx * dt;
    body.y += body.vy * dt;
  }

  for (let i = 0; i < bodies.length; i++) {
    const body = bodies[i];
    if (body.type !== "planet") continue;
    const heat = computePlanetHeat(body, bodies);
    if (heat < PLANET_HEAT_FROZEN) {
      body.state = "frozen";
      body.habitableTime = Math.max(0, body.habitableTime - dt * 1.5);
      body.aliveTime = 0;
    } else if (heat > PLANET_HEAT_HOT) {
      body.state = "scorched";
      body.habitableTime = Math.max(0, body.habitableTime - dt * 1.5);
      body.aliveTime = 0;
    } else {
      body.habitableTime += dt;
      body.state = body.habitableTime >= PLANET_LIFE_DELAY ? "alive" : "habitable";
      if (body.state === "alive") {
        body.aliveTime = (body.aliveTime || 0) + dt;
      } else {
        body.aliveTime = 0;
      }
    }
  }

  const merged = new Uint8Array(bodies.length);
  for (let i = 0; i < bodies.length; i++) {
    if (merged[i]) continue;
    for (let j = i + 1; j < bodies.length; j++) {
      if (merged[j]) continue;
      const a = bodies[i];
      const b = bodies[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const r = Math.sqrt(dx * dx + dy * dy);
      if (r >= (a.radius + b.radius) * 0.85) continue;

      const aIsAsteroid = a.type === "asteroid";
      const bIsAsteroid = b.type === "asteroid";
      const aIsPlanet = a.type === "planet";
      const bIsPlanet = b.type === "planet";
      const aIsStar = a.type === "star";
      const bIsStar = b.type === "star";

      if ((aIsAsteroid && bIsPlanet) || (bIsAsteroid && aIsPlanet)) {
        const planetBody = aIsPlanet ? a : b;
        const asteroidIdx = aIsAsteroid ? i : j;
        planetBody.habitableTime = Math.min(
          PLANET_LIFE_DELAY * 2.5,
          planetBody.habitableTime + ASTEROID_HABITABLE_BONUS,
        );
        merged[asteroidIdx] = 1;
        continue;
      }

      if (state.phase >= PLANET_PHASE_PLANETS && (aIsStar || bIsStar)) {
        continue;
      }

      const tm = a.mass + b.mass;
      a.x = (a.x * a.mass + b.x * b.mass) / tm;
      a.y = (a.y * a.mass + b.y * b.mass) / tm;
      a.vx = (a.vx * a.mass + b.vx * b.mass) / tm;
      a.vy = (a.vy * a.mass + b.vy * b.mass) / tm;
      a.mass = tm;

      let resultType = (PLANET_TYPE_PRIORITY[b.type] || 0) > (PLANET_TYPE_PRIORITY[a.type] || 0)
        ? b.type
        : a.type;
      if (resultType === "mote" && a.mass >= MOTE_TO_GAS_MASS) resultType = "gas";
      if ((resultType === "mote" || resultType === "gas") && a.mass >= GAS_TO_STAR_MASS) {
        resultType = "star";
      }
      a.type = resultType;
      a.radius = planetRadiusFor(a.type, a.mass);
      if (a.type === "planet") {
        a.state = a.state || "barren";
      } else {
        a.state = null;
        a.habitableTime = 0;
        a.aliveTime = 0;
      }
      merged[j] = 1;
    }
  }
  if (merged.some((v) => v)) {
    state.bodies = bodies.filter((_, i) => !merged[i]);
  }

  maybeAdvancePhase(state);
}

function maybeAdvancePhase(state) {
  const bodies = state.bodies;
  if (state.phase === PLANET_PHASE_INFLATION) {
    if (state.motesPlaced >= INFLATION_MOTE_TARGET) {
      state.phase = PLANET_PHASE_STARS;
    }
  }
  if (state.phase === PLANET_PHASE_STARS) {
    const starCount = bodies.filter((b) => b.type === "star").length;
    if (starCount >= STARS_PHASE_TARGET) state.phase = PLANET_PHASE_SUPERNOVA;
  }
  if (state.phase === PLANET_PHASE_SUPERNOVA) {
    if (state.supernovas >= SUPERNOVA_TARGET) state.phase = PLANET_PHASE_PLANETS;
  }
  if (state.phase === PLANET_PHASE_PLANETS) {
    if (bodies.some((b) => b.type === "planet" && (b.aliveTime || 0) >= LIFE_DURATION_TARGET)) {
      state.phase = PLANET_PHASE_VICTORY;
    }
  }
}

function detonateOneStar(state) {
  const star = state.bodies.find((b) => b.type === "star");
  if (!star) return false;
  const idx = state.bodies.indexOf(star);
  state.bodies.splice(idx, 1);
  const cx = star.x;
  const cy = star.y;
  const count = 7 + Math.floor(state.rng() * 4);
  const config = PLANET_TYPES.asteroid;
  for (let k = 0; k < count; k++) {
    const angle = (k / count) * Math.PI * 2 + state.rng() * 0.4;
    const speed = config.speedRange[0]
      + state.rng() * Math.max(0, config.speedRange[1] - config.speedRange[0]);
    const mass = config.massBase + state.rng() * config.massVariance;
    const offset = star.radius * 1.1;
    state.bodies.push({
      type: "asteroid",
      x: cx + Math.cos(angle) * offset,
      y: cy + Math.sin(angle) * offset,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      mass,
      radius: planetRadiusFor("asteroid", mass),
      state: null,
      habitableTime: 0,
      aliveTime: 0,
    });
  }
  state.supernovas++;
  return true;
}

function placeMotesNearCenter(state, count) {
  // Scatter motes across two clusters so they coalesce into multiple stars
  // (mirroring how a thinking player would scatter their clicks).
  const cx = state.canvasW / 2;
  const cy = state.canvasH / 2;
  const clusters = [
    { x: cx - 90, y: cy - 30 },
    { x: cx + 90, y: cy + 30 },
  ];
  for (let i = 0; i < count; i++) {
    if (state.bodies.length >= PLANET_MAX_BODIES) break;
    const cluster = clusters[i % clusters.length];
    const angle = state.rng() * Math.PI * 2;
    const radius = 8 + state.rng() * 24;
    const x = cluster.x + Math.cos(angle) * radius;
    const y = cluster.y + Math.sin(angle) * radius;
    state.bodies.push(createPlanetBody(state, x, y, "mote"));
    state.motesPlaced++;
    maybeAdvancePhase(state);
  }
}

function placeMotesFarFromStars(state, count) {
  const cx = state.canvasW / 2;
  const cy = state.canvasH / 2;
  const stars = state.bodies.filter((b) => b.type === "star");
  let target = { x: cx + (state.rng() < 0.5 ? -1 : 1) * 120, y: cy };
  // Prefer the spot farthest from any existing star.
  if (stars.length > 0) {
    const candidates = [
      { x: cx - 140, y: cy },
      { x: cx + 140, y: cy },
      { x: cx, y: cy - 100 },
      { x: cx, y: cy + 100 },
    ];
    let best = null;
    let bestD = -Infinity;
    for (const c of candidates) {
      let minD = Infinity;
      for (const s of stars) {
        const d = Math.hypot(c.x - s.x, c.y - s.y);
        if (d < minD) minD = d;
      }
      if (minD > bestD) { bestD = minD; best = c; }
    }
    if (best) target = best;
  }
  for (let i = 0; i < count; i++) {
    if (state.bodies.length >= PLANET_MAX_BODIES) break;
    const angle = state.rng() * Math.PI * 2;
    const radius = 6 + state.rng() * 18;
    const x = target.x + Math.cos(angle) * radius;
    const y = target.y + Math.sin(angle) * radius;
    state.bodies.push(createPlanetBody(state, x, y, "mote"));
    state.motesPlaced++;
    maybeAdvancePhase(state);
  }
}

function placePlanetInHabitableZone(state) {
  const star = state.bodies.find((b) => b.type === "star");
  if (!star) return false;
  // habitable zone: heat in [0.2, 5.5]; for star mass 240-340: r in ~[6.6, ~41]
  const r = 16 + state.rng() * 8; // sweet spot ~16-24
  const ang = state.rng() * Math.PI * 2;
  const x = star.x + Math.cos(ang) * r;
  const y = star.y + Math.sin(ang) * r;
  state.bodies.push(createPlanetBody(state, x, y, "planet"));
  return true;
}

function runScenario(seed, opts = {}) {
  const verbose = opts.verbose === true;
  const state = {
    bodies: [],
    phase: PLANET_PHASE_INFLATION,
    motesPlaced: 0,
    supernovas: 0,
    canvasW: 600,
    canvasH: 400,
    rng: makeRng(seed),
  };

  const dt = 1 / 60;
  const maxFrames = 60 * 90; // 90 simulated seconds budget
  let phaseHistory = [state.phase];

  // Inflation: place initial 18 motes near center
  placeMotesNearCenter(state, INFLATION_MOTE_TARGET);

  for (let frame = 0; frame < maxFrames; frame++) {
    stepPlanets(state, dt);

    // STARS phase: if too few motes around, top up at a fresh location.
    if (state.phase === PLANET_PHASE_STARS) {
      const starCount = state.bodies.filter((b) => b.type === "star").length;
      const moteCount = state.bodies.filter((b) => b.type === "mote" || b.type === "gas").length;
      if (starCount < STARS_PHASE_TARGET && moteCount < 4 && (frame % 60) === 30) {
        placeMotesFarFromStars(state, 6);
      }
    }

    // SUPERNOVA: detonate exactly one star (after 1.5s of pause to let the
    // user see the swollen stars; here we just wait briefly).
    if (state.phase === PLANET_PHASE_SUPERNOVA) {
      // Choose to wait a few frames for stars to settle, then click the smaller one.
      if (state.supernovas === 0 && state.bodies.filter((b) => b.type === "star").length >= 2) {
        // Pick the more central star to detonate so the surviving one stays
        // close to the canvas center where we will place a planet.
        const cx = state.canvasW / 2;
        const cy = state.canvasH / 2;
        const stars = state.bodies.filter((b) => b.type === "star");
        stars.sort((a, b) => {
          const da = (a.x - cx) ** 2 + (a.y - cy) ** 2;
          const db = (b.x - cx) ** 2 + (b.y - cy) ** 2;
          return db - da; // farther one first → detonate the further-out one
        });
        const target = stars[0];
        const targetIdx = state.bodies.indexOf(target);
        if (targetIdx >= 0) {
          // Inline detonate for the chosen star.
          const star = state.bodies.splice(targetIdx, 1)[0];
          const count = 7 + Math.floor(state.rng() * 4);
          const config = PLANET_TYPES.asteroid;
          for (let k = 0; k < count; k++) {
            const angle = (k / count) * Math.PI * 2 + state.rng() * 0.4;
            const speed = config.speedRange[0]
              + state.rng() * Math.max(0, config.speedRange[1] - config.speedRange[0]);
            const mass = config.massBase + state.rng() * config.massVariance;
            const offset = star.radius * 1.1;
            state.bodies.push({
              type: "asteroid",
              x: star.x + Math.cos(angle) * offset,
              y: star.y + Math.sin(angle) * offset,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              mass,
              radius: planetRadiusFor("asteroid", mass),
              state: null,
              habitableTime: 0,
              aliveTime: 0,
            });
          }
          state.supernovas++;
          maybeAdvancePhase(state);
        }
      }
    }

    // PLANETS phase: place planets in habitable zone if none alive.
    if (state.phase === PLANET_PHASE_PLANETS) {
      const hasPlanet = state.bodies.some((b) => b.type === "planet");
      if (!hasPlanet) {
        const placed = placePlanetInHabitableZone(state);
        if (verbose && placed) {
          const planet = state.bodies[state.bodies.length - 1];
          const star = state.bodies.find((b) => b.type === "star");
          const dx = planet.x - star.x;
          const dy = planet.y - star.y;
          const r = Math.hypot(dx, dy);
          console.log(`  placed planet at r=${r.toFixed(2)} from star (mass=${star.mass.toFixed(1)})  v=(${planet.vx.toFixed(2)},${planet.vy.toFixed(2)})  star.v=(${star.vx.toFixed(2)},${star.vy.toFixed(2)})`);
        }
      } else if (frame % 240 === 0) {
        const aliveOrHabitable = state.bodies.some(
          (b) => b.type === "planet" && (b.state === "alive" || b.state === "habitable"),
        );
        if (!aliveOrHabitable) {
          // Existing planet got scorched/frozen — replace.
          state.bodies = state.bodies.filter((b) => b.type !== "planet");
          placePlanetInHabitableZone(state);
        }
      }
      if (verbose && (frame % 60) === 0) {
        const planet = state.bodies.find((b) => b.type === "planet");
        if (planet) {
          const star = state.bodies.find((b) => b.type === "star");
          if (star) {
            const r = Math.hypot(planet.x - star.x, planet.y - star.y);
            const heat = computePlanetHeat(planet, state.bodies);
            console.log(`  t=${(frame * dt).toFixed(1)}s r=${r.toFixed(1)} heat=${heat.toFixed(2)} state=${planet.state} habT=${(planet.habitableTime || 0).toFixed(2)} aliveT=${(planet.aliveTime || 0).toFixed(2)}`);
          }
        }
      }
    }

    if (state.phase !== phaseHistory[phaseHistory.length - 1]) {
      phaseHistory.push(state.phase);
      if (verbose) {
        console.log(`  frame ${frame} (${(frame * dt).toFixed(1)}s): phase → ${state.phase}`);
      }
    }

    if (state.phase === PLANET_PHASE_VICTORY) {
      return { cleared: true, frames: frame, seconds: frame * dt, phaseHistory };
    }
  }

  return { cleared: false, frames: maxFrames, seconds: maxFrames * dt, phaseHistory, state };
}

// One-planet diagnostic: place a single planet next to a fixed star and trace
// its orbit to see whether the integrator keeps it stable.
function diagnosticOneOrbit() {
  const state = {
    bodies: [],
    phase: PLANET_PHASE_PLANETS,
    motesPlaced: 18,
    supernovas: 1,
    canvasW: 600,
    canvasH: 400,
    rng: makeRng(7),
  };
  state.bodies.push({
    type: "star", x: 300, y: 200, vx: 0, vy: 0, mass: 240,
    radius: planetRadiusFor("star", 240), state: null, habitableTime: 0, aliveTime: 0,
  });
  state.bodies.push(createPlanetBody(state, 300 + 20, 200, "planet"));
  const planet = state.bodies[1];
  console.log(`diag: initial r=${Math.hypot(planet.x-300, planet.y-200).toFixed(2)} v=(${planet.vx.toFixed(2)},${planet.vy.toFixed(2)}) speed=${Math.hypot(planet.vx,planet.vy).toFixed(2)}`);
  const dt = 1 / 60;
  let minR = Infinity, maxR = 0;
  for (let f = 0; f < 600; f++) {
    stepPlanets(state, dt);
    const r = Math.hypot(planet.x - state.bodies[0].x, planet.y - state.bodies[0].y);
    minR = Math.min(minR, r);
    maxR = Math.max(maxR, r);
    if (f % 30 === 0) {
      const heat = computePlanetHeat(planet, state.bodies);
      console.log(`  diag f=${f} t=${(f*dt).toFixed(2)}s r=${r.toFixed(2)} heat=${heat.toFixed(3)} state=${planet.state} habT=${planet.habitableTime.toFixed(2)} aliveT=${planet.aliveTime.toFixed(2)}`);
    }
  }
  console.log(`diag: orbit r range [${minR.toFixed(2)}, ${maxR.toFixed(2)}]`);
}
console.log("=== diagnostic one-orbit (placed at r=20, star mass 240) ===");
diagnosticOneOrbit();
console.log("=== end diagnostic ===\n");

// First, run a verbose trace for seed=1 so we can debug.
console.log("=== verbose trace seed=1 ===");
runScenario(1, { verbose: true });
console.log("=== end verbose trace ===\n");

const seeds = [1, 7, 19, 42, 101, 256, 1024, 9001, 12345, 65535];
let cleared = 0;
let totalSeconds = 0;
const failures = [];
for (const seed of seeds) {
  const result = runScenario(seed);
  if (result.cleared) {
    cleared++;
    totalSeconds += result.seconds;
    console.log(`seed=${seed}: cleared in ${result.seconds.toFixed(1)}s`);
  } else {
    failures.push({ seed, lastPhase: result.phaseHistory[result.phaseHistory.length - 1], history: result.phaseHistory });
    const planets = result.state ? result.state.bodies.filter((b) => b.type === "planet") : [];
    const stars = result.state ? result.state.bodies.filter((b) => b.type === "star") : [];
    const heatNow = planets.map((p) => computePlanetHeat(p, result.state.bodies).toFixed(2)).join(",");
    const stateNow = planets.map((p) => p.state).join(",");
    const habT = planets.map((p) => (p.habitableTime || 0).toFixed(2)).join(",");
    const aliveT = planets.map((p) => (p.aliveTime || 0).toFixed(2)).join(",");
    console.log(
      `seed=${seed}: NOT CLEARED, last phase=${result.phaseHistory[result.phaseHistory.length - 1]}, history=${JSON.stringify(result.phaseHistory)}, stars=${stars.length}, planets=${planets.length}, planetStates=[${stateNow}], heat=[${heatNow}], habT=[${habT}], aliveT=[${aliveT}]`,
    );
  }
}

console.log("");
console.log(`Cleared ${cleared}/${seeds.length} runs`);
if (cleared > 0) {
  console.log(`Average clear time: ${(totalSeconds / cleared).toFixed(1)}s`);
}

if (failures.length === seeds.length) {
  console.error("All scenarios failed — game is not clearable.");
  process.exit(1);
}

if (cleared >= Math.ceil(seeds.length * 0.7)) {
  console.log("PASS — game is reliably clearable.");
  process.exit(0);
} else {
  console.log("WARN — game clears but not reliably; tune further.");
  process.exit(2);
}
