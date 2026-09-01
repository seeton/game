(() => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduceMotion) {
    return;
  }

  const THEMES = ["street", "christmas", "space", "jackpot"];
  const NORMAL_THEMES = THEMES.slice(0, 3);
  const SECRET_CHANCE = 0.01;
  const DEBUG_STORAGE_KEY = "seeton-intro-debug-index-v2";
  const THEME_CONFIG = {
    street: {
      assets: ["street-paint-v2.png"],
      durationMs: 2000,
      kicker: "GAMES / CODE / EXPERIMENTS",
    },
    christmas: {
      assets: ["christmas-stage-v4.png", "christmas-flight-v3.png"],
      durationMs: 2000,
      kicker: "SANTA / REINDEER / BELLS",
    },
    space: {
      assets: ["space-moon-stage-v5.jpg", "space-rocket-v1.png"],
      durationMs: 2000,
      kicker: "LUNAR DESCENT / TOUCHDOWN",
    },
    jackpot: {
      assets: ["jackpot-machine-v4.png", "jackpot-party-cracker-v1.png"],
      durationMs: 5000,
      kicker: "SECRET / 1% / FEVER",
    },
  };

  const selectTheme = () => {
    const params = new URLSearchParams(window.location.search);
    const hostname = window.location.hostname;
    const isPrivateIpv4 = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname);
    const isLocal = ["127.0.0.1", "localhost", "::1"].includes(hostname) || isPrivateIpv4;
    const isPagesPoc = hostname === "seeton.github.io"
      && window.location.pathname.startsWith("/game/");
    const isDebug = isLocal || isPagesPoc;
    const forcedTheme = params.get("intro");
    if (isDebug && THEMES.includes(forcedTheme)) {
      return forcedTheme;
    }

    if (isDebug) {
      try {
        const storedIndex = Number.parseInt(window.sessionStorage.getItem(DEBUG_STORAGE_KEY), 10);
        const index = Number.isFinite(storedIndex) ? storedIndex : 0;
        window.sessionStorage.setItem(DEBUG_STORAGE_KEY, String((index + 1) % THEMES.length));
        return THEMES[index % THEMES.length];
      } catch (_error) {
        return THEMES[0];
      }
    }

    if (Math.random() < SECRET_CHANCE) {
      return "jackpot";
    }
    return NORMAL_THEMES[Math.floor(Math.random() * NORMAL_THEMES.length)];
  };

  const selectedTheme = selectTheme();
  const selectedConfig = THEME_CONFIG[selectedTheme];
  root.dataset.introTheme = selectedTheme;

  const currentScriptUrl = document.currentScript && document.currentScript.src;
  if (currentScriptUrl) {
    selectedConfig.assets.forEach((asset, index) => {
      const preload = document.createElement("link");
      preload.rel = "preload";
      preload.as = "image";
      preload.type = asset.endsWith(".png")
        ? "image/png"
        : asset.endsWith(".jpg")
          ? "image/jpeg"
          : "image/avif";
      preload.href = new URL(`./intro/${asset}`, currentScriptUrl).href;
      preload.setAttribute("fetchpriority", selectedTheme === "space" || index === 0 ? "high" : "auto");
      document.head.appendChild(preload);
    });
  }

  const start = () => {
    const intro = document.querySelector(".street-intro");
    if (!intro) {
      return;
    }

    intro.dataset.introTheme = selectedTheme;
    intro.style.setProperty("--intro-duration", `${selectedConfig.durationMs}ms`);

    const kicker = intro.querySelector("[data-intro-kicker]");
    if (kicker) {
      kicker.textContent = selectedConfig.kicker;
    }

    let finished = false;
    let timeoutId = 0;

    const finish = () => {
      if (finished) {
        return;
      }
      finished = true;
      window.clearTimeout(timeoutId);
      intro.removeEventListener("animationend", onAnimationEnd);
      root.classList.remove("street-intro-active");
    };

    const onAnimationEnd = (event) => {
      const curtainFinished = event.animationName === "street-intro-curtain"
        || event.animationName === "jackpot-intro-curtain";
      if (event.target === intro && curtainFinished) {
        finish();
      }
    };

    intro.addEventListener("animationend", onAnimationEnd);
    root.classList.add("street-intro-active");
    timeoutId = window.setTimeout(finish, selectedConfig.durationMs + 300);
    window.addEventListener("pagehide", finish, { once: true });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
