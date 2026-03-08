import * as THREE from "three";

const DEFAULT_LANGUAGE = "ja";
const DEFAULT_GAME = "minesweeper";
const DEFAULT_DIFFICULTY = "easy";
const LANGUAGE_STORAGE_KEY = "seetona-language";

const GAME_LIBRARY = {
  minesweeper: { available: true },
  tetris: { available: false },
  solitaire: { available: false },
};

const COPY = {
  ja: {
    pageTitle: "SEETONA のホーム",
    pageDescription: "短いロゴとゲーム棚を組み合わせた、SEETONA のホームページ。",
    navAria: "グローバルナビゲーション",
    navMotion: "動き",
    navSignal: "設計",
    navPlay: "ゲーム",
    navLaunch: "公開",
    languageGroupLabel: "言語切替",
    languageLabel: "LANGUAGE",
    heroEyebrow: "HOME / PLAYGROUND",
    heroTitle: "短いロゴと小さなゲーム棚。",
    heroLead: "長すぎる見た目は削り、回して触ってすぐ遊べる形に寄せたトップページです。",
    heroPrimaryAction: "ロゴを見る",
    heroSecondaryAction: "ゲーム棚へ",
    heroMetric1: "短い 3D ロゴ",
    heroMetric2: "上下左右に 360 度回転",
    heroMetric3: "ゲームを棚から選べる",
    sceneBadge: "FREE ROTATION",
    sceneNote: "drag / swipe / spin",
    orbitAria: "自由に回転する短い立体ロゴ",
    signalSectionLabel: "SIGNAL",
    signalSectionTitle: "やることを先に見せる。",
    signalSectionBody: "ロゴ、棚、ゲーム本体の順で視線が落ちるようにして、遊びたい人が迷わない構成にしています。",
    signalCard1Label: "LOGO",
    signalCard1Title: "横に伸びすぎない",
    signalCard1Body: "文字数を絞って、透明な付属物も外したので、最初に見える形が素直です。",
    signalCard2Label: "GAMES",
    signalCard2Title: "棚から選ぶ",
    signalCard2Body: "マインスイーパーを主役にしつつ、次の候補も同じ棚に並べて全体像を見せます。",
    signalCard3Label: "LOAD",
    signalCard3Title: "待ち時間を見せる",
    signalCard3Body: "Python 側の処理が終わるまで、読み込み表示を出して状態を明確にします。",
    playSectionLabel: "GAME SHELF",
    playSectionTitle: "たくさんあるゲームから選ぶ。",
    playSectionBody: "まずは小さいマインスイーパーを遊べる状態にして、テトリスとソリティアは予告として並べています。",
    gameLibraryAria: "ゲーム選択棚",
    gameMinesChip: "PLAYABLE",
    gameMinesTitle: "マインスイーパー",
    gameMinesBody: "小さい盤面でさっと遊べる、今すぐ起動できるゲーム。",
    gameTetrisChip: "COMING SOON",
    gameTetrisTitle: "テトリス",
    gameTetrisBody: "落ち物枠。棚には置いておいて、実装は次段階で入れる。",
    gameSolitaireChip: "COMING SOON",
    gameSolitaireTitle: "ソリティア",
    gameSolitaireBody: "落ち着いた一人遊び枠。後から入れても相性がいい。",
    gamePanelLabel: "NOW PLAYING",
    gameStatusLabel: "状態",
    gameFlagsLabel: "残り旗",
    gameClearedLabel: "クリア",
    gameDifficultyLabel: "DIFFICULTY",
    gameDifficultyEasy: "小",
    gameDifficultyMedium: "中",
    gameDifficultyHard: "大",
    gameControlReveal: "左クリックまたはタップで開く。",
    gameControlFlag: "右クリックまたは長押しで旗を置く。",
    gameStart: "ゲームを読み込む",
    gameStartAgain: "盤面を作り直す",
    gameRestart: "新しい盤面",
    gameLoading: "読み込み中...",
    gameLoadingDetail: "Python の処理が終わるまで少し待ってください。",
    gameBoardAria: "マインスイーパーの盤面",
    gameIdleStatus: "待機中",
    gameUnavailable: "準備中",
    launchLabel: "LAUNCH",
    launchTitle: "今は棚を作って、順番に足す。",
    launchBody: "マインスイーパーを先に成立させて、他のゲームは coming soon として並べると、次に何を入れるかが見えやすくなります。",
    flow1Label: "View",
    flow1Body: "短いロゴを触って、サイトの空気を掴む。",
    flow2Label: "Choose",
    flow2Body: "ゲーム棚から遊びたい要素を選ぶ。",
    flow3Label: "Play",
    flow3Body: "読み込み表示を見ながら、遊べる状態まで待てる。",
    footerLabel: "SEETONA",
    footerTitle: "ロゴ、棚、小さいゲームを一つの面にまとめたホーム。",
    footerLink: "先頭へ戻る",
    games: {
      minesweeper: {
        panelTitle: "マインスイーパー",
        panelBody: "説明と難易度を上に寄せて、盤面は小さく保ったまま遊べるようにしています。",
        promptTitle: "マインスイーパーを読み込む",
        promptBody: "棚から選んだあとに読み込むと、ここに小さい盤面が出ます。",
        badge: "PLAYABLE",
      },
      tetris: {
        panelTitle: "テトリス",
        panelBody: "棚には置いてありますが、まだ遊べません。次に増やす候補として見せています。",
        promptTitle: "テトリスは準備中",
        promptBody: "落ち物ゲーム枠は coming soon です。まずは棚と導線だけ置いています。",
        badge: "COMING SOON",
      },
      solitaire: {
        panelTitle: "ソリティア",
        panelBody: "静かなゲーム枠として置いてありますが、まだカード本体は実装していません。",
        promptTitle: "ソリティアは準備中",
        promptBody: "一人遊び枠は coming soon です。配置だけ先に決めています。",
        badge: "COMING SOON",
      },
    },
    statusLabels: {
      ready: "準備完了",
      playing: "走査中",
      won: "クリア",
      lost: "失敗",
    },
    errors: {
      "Request failed": "通信に失敗しました。",
      "Failed to load state": "盤面の読込に失敗しました。",
      "asset not found": "必要なファイルが見つかりません。",
      "POST required": "この操作には POST が必要です。",
      "unknown difficulty": "難易度が不正です。",
      "row or col out of bounds": "盤面の外を選択しています。",
      "invalid Content-Length": "通信サイズが不正です。",
      "request body too large": "通信データが大きすぎます。",
      "invalid JSON body": "送信データの形式が不正です。",
      "JSON body must be an object": "送信データはオブジェクトである必要があります。",
      "not found": "対象が見つかりません。",
    },
  },
  en: {
    pageTitle: "SEETONA home",
    pageDescription: "A SEETONA homepage built around a short logo and a small game shelf.",
    navAria: "Global navigation",
    navMotion: "Motion",
    navSignal: "Signal",
    navPlay: "Games",
    navLaunch: "Launch",
    languageGroupLabel: "Language switcher",
    languageLabel: "LANGUAGE",
    heroEyebrow: "HOME / PLAYGROUND",
    heroTitle: "A short logo and a compact game shelf.",
    heroLead: "The long look is gone. The page is now tuned to spin fast, read fast, and play fast.",
    heroPrimaryAction: "See the logo",
    heroSecondaryAction: "Go to games",
    heroMetric1: "Short 3D logo",
    heroMetric2: "Full 360-degree spin",
    heroMetric3: "Pick from a game shelf",
    sceneBadge: "FREE ROTATION",
    sceneNote: "drag / swipe / spin",
    orbitAria: "A short 3D logo that rotates freely",
    signalSectionLabel: "SIGNAL",
    signalSectionTitle: "Show the purpose first.",
    signalSectionBody: "The eye now drops from logo to shelf to active game, so the playable part is obvious.",
    signalCard1Label: "LOGO",
    signalCard1Title: "No more overlong silhouette",
    signalCard1Body: "The wordmark is shorter and the transparent side pieces are gone, so the first shape reads cleanly.",
    signalCard2Label: "GAMES",
    signalCard2Title: "Choose from a shelf",
    signalCard2Body: "Minesweeper is the first playable item, while the next candidates already sit beside it.",
    signalCard3Label: "LOAD",
    signalCard3Title: "Loading is visible",
    signalCard3Body: "A loading state stays on screen until the Python side is ready and playable.",
    playSectionLabel: "GAME SHELF",
    playSectionTitle: "Choose from several games.",
    playSectionBody: "Minesweeper is playable now. Tetris and Solitaire are listed as coming soon.",
    gameLibraryAria: "Game selection shelf",
    gameMinesChip: "PLAYABLE",
    gameMinesTitle: "Minesweeper",
    gameMinesBody: "A compact board you can launch right away.",
    gameTetrisChip: "COMING SOON",
    gameTetrisTitle: "Tetris",
    gameTetrisBody: "The falling-block slot is reserved, but the game comes later.",
    gameSolitaireChip: "COMING SOON",
    gameSolitaireTitle: "Solitaire",
    gameSolitaireBody: "A calm single-player slot that fits the shelf later.",
    gamePanelLabel: "NOW PLAYING",
    gameStatusLabel: "Status",
    gameFlagsLabel: "Flags Left",
    gameClearedLabel: "Cleared",
    gameDifficultyLabel: "DIFFICULTY",
    gameDifficultyEasy: "Small",
    gameDifficultyMedium: "Medium",
    gameDifficultyHard: "Large",
    gameControlReveal: "Left click or tap to reveal a tile.",
    gameControlFlag: "Right click or long press to place a flag.",
    gameStart: "Load game",
    gameStartAgain: "Build new board",
    gameRestart: "New board",
    gameLoading: "Loading...",
    gameLoadingDetail: "Wait a moment while the Python process prepares the board.",
    gameBoardAria: "Minesweeper board",
    gameIdleStatus: "Standby",
    gameUnavailable: "Coming soon",
    launchLabel: "LAUNCH",
    launchTitle: "Build the shelf now, add games in order.",
    launchBody: "Once Minesweeper is solid, the other cards can stay visible as coming soon without feeling empty.",
    flow1Label: "View",
    flow1Body: "Touch the short logo and understand the mood quickly.",
    flow2Label: "Choose",
    flow2Body: "Pick a game from the shelf instead of hunting for a separate page.",
    flow3Label: "Play",
    flow3Body: "A loading state stays visible until the game is actually ready.",
    footerLabel: "SEETONA",
    footerTitle: "A home screen that combines a short logo, a shelf, and a compact game.",
    footerLink: "Back to top",
    games: {
      minesweeper: {
        panelTitle: "Minesweeper",
        panelBody: "The description and difficulty controls stay above the board, while the board itself remains compact.",
        promptTitle: "Load Minesweeper",
        promptBody: "After choosing it from the shelf, load it here to reveal a compact board.",
        badge: "PLAYABLE",
      },
      tetris: {
        panelTitle: "Tetris",
        panelBody: "It is listed in the shelf, but it is not playable yet.",
        promptTitle: "Tetris is coming soon",
        promptBody: "The falling-block slot is reserved. Right now it is only a placeholder card.",
        badge: "COMING SOON",
      },
      solitaire: {
        panelTitle: "Solitaire",
        panelBody: "It is reserved as a calm solo slot, but the actual cards are not implemented yet.",
        promptTitle: "Solitaire is coming soon",
        promptBody: "The solo-game slot is defined now, while the real game arrives later.",
        badge: "COMING SOON",
      },
    },
    statusLabels: {
      ready: "Ready",
      playing: "Scanning",
      won: "Cleared",
      lost: "Failed",
    },
    errors: {
      "Request failed": "Request failed.",
      "Failed to load state": "Failed to load the board state.",
      "asset not found": "Required assets were not found.",
      "POST required": "This action requires POST.",
      "unknown difficulty": "Unknown difficulty.",
      "row or col out of bounds": "The selected tile is outside the board.",
      "invalid Content-Length": "Invalid Content-Length.",
      "request body too large": "The request body is too large.",
      "invalid JSON body": "Invalid JSON body.",
      "JSON body must be an object": "The JSON body must be an object.",
      "not found": "Not found.",
    },
  },
};

const metaDescription = document.querySelector('meta[name="description"]');
const i18nNodes = Array.from(document.querySelectorAll("[data-i18n]"));
const languageButtons = Array.from(document.querySelectorAll("[data-language-option]"));
const gameButtons = Array.from(document.querySelectorAll("[data-game-select]"));
const difficultyButtons = Array.from(document.querySelectorAll("[data-difficulty]"));

const selectedGameTitle = document.getElementById("selected-game-title");
const selectedGameCopy = document.getElementById("selected-game-copy");
const selectedGameBadge = document.getElementById("selected-game-badge");
const gameToolbar = document.getElementById("game-toolbar");
const difficultyCluster = document.getElementById("difficulty-cluster");
const gamePlaceholder = document.getElementById("game-placeholder");
const gamePlaceholderTitle = document.getElementById("game-placeholder-title");
const gamePlaceholderCopy = document.getElementById("game-placeholder-copy");
const gameLoading = document.getElementById("game-loading");
const loadGameButton = document.getElementById("load-game-button");
const restartButton = document.getElementById("restart-button");
const boardWrap = document.getElementById("game-board-wrap");
const boardElement = document.getElementById("board");
const statusElement = document.getElementById("status-text");
const flagsElement = document.getElementById("flags-left");
const clearedElement = document.getElementById("cleared-count");

const appEndpoint = new URL("./app.xcg", window.location.href);

let currentLanguage = loadLanguage();
let selectedGame = DEFAULT_GAME;
let currentDifficulty = DEFAULT_DIFFICULTY;
let currentState = null;
let isGameLoading = false;
let hasLoadedGame = false;
let transientStatusMessage = null;

applyTranslations();
syncDifficultyButtons();
renderGameShell();
initLogoScene();

languageButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setLanguage(button.dataset.languageOption);
  });
});

gameButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectGame(button.dataset.gameSelect);
  });
});

difficultyButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    currentDifficulty = button.dataset.difficulty || DEFAULT_DIFFICULTY;
    syncDifficultyButtons();
    if (selectedGame === "minesweeper" && hasLoadedGame) {
      try {
        await loadSelectedGame();
      } catch (error) {
        showError(error);
      }
    } else {
      renderGameShell();
    }
  });
});

loadGameButton.addEventListener("click", async () => {
  if (selectedGame !== "minesweeper") {
    return;
  }
  try {
    await loadSelectedGame();
  } catch (error) {
    showError(error);
  }
});

restartButton.addEventListener("click", async () => {
  if (selectedGame !== "minesweeper") {
    return;
  }
  try {
    await loadSelectedGame();
  } catch (error) {
    showError(error);
  }
});

function loadLanguage() {
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return stored === "en" ? "en" : DEFAULT_LANGUAGE;
}

function setLanguage(nextLanguage) {
  currentLanguage = nextLanguage === "en" ? "en" : "ja";
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, currentLanguage);
  applyTranslations();
  renderGameShell();
}

function currentCopy() {
  return COPY[currentLanguage] || COPY[DEFAULT_LANGUAGE];
}

function getText(key) {
  return currentCopy()[key];
}

function translateMessage(message) {
  const mapped = currentCopy().errors[message];
  return mapped || message || currentCopy().errors["Request failed"];
}

function applyTranslations() {
  document.documentElement.lang = currentLanguage;
  document.title = getText("pageTitle");
  metaDescription.setAttribute("content", getText("pageDescription"));

  i18nNodes.forEach((node) => {
    const key = node.dataset.i18n;
    const attr = node.dataset.i18nAttr;
    if (!key) {
      return;
    }
    if (attr) {
      node.setAttribute(attr, getText(key));
    } else {
      node.textContent = getText(key);
    }
  });

  languageButtons.forEach((button) => {
    const isActive = button.dataset.languageOption === currentLanguage;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function selectGame(gameId) {
  selectedGame = GAME_LIBRARY[gameId] ? gameId : DEFAULT_GAME;
  transientStatusMessage = null;
  renderGameShell();
}

function renderGameShell() {
  const gameCopy = currentCopy().games[selectedGame];
  const libraryEntry = GAME_LIBRARY[selectedGame];
  const isPlayable = Boolean(libraryEntry && libraryEntry.available);
  const showBoard = isPlayable && hasLoadedGame && currentState && !isGameLoading;

  selectedGameTitle.textContent = gameCopy.panelTitle;
  selectedGameCopy.textContent = gameCopy.panelBody;
  selectedGameBadge.textContent = gameCopy.badge;
  selectedGameBadge.className = `game-chip ${isPlayable ? "live" : "soon"}`;

  gameButtons.forEach((button) => {
    const isSelected = button.dataset.gameSelect === selectedGame;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });

  gameToolbar.hidden = !isPlayable;
  difficultyCluster.hidden = !isPlayable;
  loadGameButton.hidden = !isPlayable;
  restartButton.hidden = !isPlayable;
  loadGameButton.disabled = !isPlayable || isGameLoading;
  restartButton.disabled = !isPlayable || isGameLoading || !hasLoadedGame;
  loadGameButton.textContent = hasLoadedGame ? getText("gameStartAgain") : getText("gameStart");

  syncDifficultyButtons();

  if (isGameLoading) {
    gameLoading.hidden = false;
    gamePlaceholder.hidden = true;
    boardWrap.hidden = true;
    renderIdleStats();
    return;
  }

  gameLoading.hidden = true;

  if (!isPlayable) {
    gamePlaceholder.hidden = false;
    boardWrap.hidden = true;
    gamePlaceholderTitle.textContent = gameCopy.promptTitle;
    gamePlaceholderCopy.textContent = gameCopy.promptBody;
    statusElement.textContent = getText("gameUnavailable");
    flagsElement.textContent = "0";
    clearedElement.textContent = "0/0";
    return;
  }

  if (showBoard) {
    gamePlaceholder.hidden = true;
    boardWrap.hidden = false;
    renderGame();
    return;
  }

  gamePlaceholder.hidden = false;
  boardWrap.hidden = true;
  gamePlaceholderTitle.textContent = gameCopy.promptTitle;
  gamePlaceholderCopy.textContent = transientStatusMessage
    ? translateMessage(transientStatusMessage)
    : gameCopy.promptBody;
  renderIdleStats();
}

function renderIdleStats() {
  statusElement.textContent = transientStatusMessage
    ? translateMessage(transientStatusMessage)
    : getText("gameIdleStatus");
  flagsElement.textContent = "0";
  clearedElement.textContent = "0/0";
}

function syncDifficultyButtons() {
  difficultyButtons.forEach((button) => {
    const isActive = button.dataset.difficulty === currentDifficulty;
    const isDisabled = selectedGame !== "minesweeper" || isGameLoading;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
    button.disabled = isDisabled;
  });
}

function apiUrl(action) {
  const url = new URL(appEndpoint.toString());
  url.searchParams.set("action", action);
  return url.toString();
}

async function parseJson(response) {
  const raw = await response.text();
  if (!raw) {
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Request failed");
  }
}

async function requestState(action, payload = null) {
  let response;
  try {
    response = await fetch(apiUrl(action), {
      method: payload ? "POST" : "GET",
      headers: payload ? { "Content-Type": "application/json" } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
    });
  } catch {
    throw new Error("Request failed");
  }

  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

async function loadSelectedGame() {
  isGameLoading = true;
  transientStatusMessage = null;
  renderGameShell();

  try {
    currentState = await requestState("new", { difficulty: currentDifficulty });
    hasLoadedGame = true;
    transientStatusMessage = null;
  } finally {
    isGameLoading = false;
    renderGameShell();
  }
}

async function revealCell(row, col) {
  currentState = await requestState("reveal", { row, col });
  transientStatusMessage = null;
  renderGame();
}

async function toggleFlag(row, col) {
  currentState = await requestState("flag", { row, col });
  transientStatusMessage = null;
  renderGame();
}

function renderGame() {
  if (!currentState) {
    return;
  }

  const totalSafe = currentState.rows * currentState.cols - currentState.mines;
  const flagsLeft = Math.max(0, currentState.mines - currentState.flagsUsed);
  const labels = currentCopy().statusLabels;

  statusElement.textContent = labels[currentState.status] || currentState.status;
  flagsElement.textContent = String(flagsLeft);
  clearedElement.textContent = `${currentState.revealedSafeCells}/${totalSafe}`;

  boardElement.style.setProperty("--cols", String(currentState.cols));
  boardElement.innerHTML = "";

  currentState.board.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = `tile ${cell.state}`;
      tile.dataset.row = String(rowIndex);
      tile.dataset.col = String(colIndex);

      if (cell.state === "revealed" && cell.adjacent > 0) {
        tile.textContent = String(cell.adjacent);
        tile.classList.add(`n${cell.adjacent}`);
      } else if (cell.state === "flagged") {
        tile.textContent = "!";
      } else if (cell.state === "mine" || cell.state === "exploded") {
        tile.textContent = "*";
      } else if (cell.state === "wrong-flag") {
        tile.textContent = "x";
      }

      bindTileInteractions(tile, rowIndex, colIndex);
      boardElement.appendChild(tile);
    });
  });
}

function bindTileInteractions(tile, rowIndex, colIndex) {
  let pressTimer = null;
  let longPressTriggered = false;

  const clearPressTimer = () => {
    if (pressTimer !== null) {
      window.clearTimeout(pressTimer);
      pressTimer = null;
    }
  };

  tile.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse") {
      return;
    }
    clearPressTimer();
    longPressTriggered = false;
    pressTimer = window.setTimeout(async () => {
      longPressTriggered = true;
      try {
        await toggleFlag(rowIndex, colIndex);
      } catch (error) {
        showError(error);
      }
    }, 360);
  });

  tile.addEventListener("pointerup", clearPressTimer);
  tile.addEventListener("pointercancel", clearPressTimer);
  tile.addEventListener("pointerleave", clearPressTimer);

  tile.addEventListener("click", async (event) => {
    if (longPressTriggered) {
      longPressTriggered = false;
      event.preventDefault();
      return;
    }
    try {
      await revealCell(rowIndex, colIndex);
    } catch (error) {
      showError(error);
    }
  });

  tile.addEventListener("contextmenu", async (event) => {
    event.preventDefault();
    clearPressTimer();
    try {
      await toggleFlag(rowIndex, colIndex);
    } catch (error) {
      showError(error);
    }
  });
}

function showError(error) {
  transientStatusMessage = error && error.message ? error.message : "Request failed";
  if (currentState) {
    statusElement.textContent = translateMessage(transientStatusMessage);
  } else {
    renderGameShell();
  }
}

function initLogoScene() {
  const stage = document.getElementById("orbit-stage");
  const canvasHost = document.getElementById("seeton-canvas");
  if (!stage || !canvasHost) {
    return;
  }

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  const ORTHO_FRUSTUM_HEIGHT = 9.4;
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  const logoRoot = new THREE.Group();
  const clock = new THREE.Clock();

  let logoContent = null;

  const drag = {
    active: false,
    pointerId: null,
    lastX: 0,
    lastY: 0,
    velocityX: 0,
    velocityY: 0,
  };

  const motion = {
    rotationX: 0.08,
    rotationY: -0.28,
    idleSpinX: 0,
    idleSpinY: 0.0011,
  };

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.domElement.setAttribute("aria-hidden", "true");

  canvasHost.replaceWith(renderer.domElement);

  scene.add(logoRoot);
  camera.position.set(0, 0.2, 16);

  createStage(scene);
  loadLogo();
  resize();

  window.addEventListener("resize", resize);
  stage.addEventListener("pointerdown", onPointerDown);
  stage.addEventListener("pointermove", onPointerMove);
  stage.addEventListener("pointerup", onPointerEnd);
  stage.addEventListener("pointercancel", onPointerEnd);
  stage.addEventListener("pointerleave", onPointerEnd);

  renderer.setAnimationLoop(renderFrame);

  function createStage(targetScene) {
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(7, 64),
      new THREE.MeshBasicMaterial({
        color: 0x04131b,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
      }),
    );
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(5.1, 6.9, 64),
      new THREE.MeshBasicMaterial({
        color: 0x6f94bb,
        transparent: true,
        opacity: 0.08,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );

    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.35;
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -2.34;
    targetScene.add(floor);
    targetScene.add(ring);
  }

  function measureSpacedText(ctx, text, tracking) {
    let width = 0;
    for (let index = 0; index < text.length; index += 1) {
      width += ctx.measureText(text[index]).width;
      if (index < text.length - 1) {
        width += tracking;
      }
    }
    return width;
  }

  function drawSpacedText(ctx, text, x, y, tracking) {
    let cursor = x;
    for (let index = 0; index < text.length; index += 1) {
      const glyph = text[index];
      ctx.fillText(glyph, cursor, y);
      cursor += ctx.measureText(glyph).width + tracking;
    }
  }

  function createLogoTexture(options = {}) {
    const {
      mode = "face",
    } = options;
    const text = "SEETON";
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const width = 2048;
    const height = 768;
    const fontSize = 344;
    const tracking = 18;
    const centerY = 392;

    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = `700 ${fontSize}px "Space Grotesk", "Arial Black", sans-serif`;

    const textWidth = measureSpacedText(ctx, text, tracking);
    const startX = (width - textWidth) / 2;

    if (mode === "mask") {
      ctx.fillStyle = "#ffffff";
      drawSpacedText(ctx, text, startX, centerY, tracking);
    } else {
      const gradient = ctx.createLinearGradient(320, 140, 1728, 612);
      gradient.addColorStop(0, "#f6fbff");
      gradient.addColorStop(0.4, "#d5e4f1");
      gradient.addColorStop(1, "#9cb6cf");
      ctx.fillStyle = gradient;
      drawSpacedText(ctx, text, startX, centerY, tracking);

      ctx.lineWidth = 8;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
      let strokeX = startX;
      for (let index = 0; index < text.length; index += 1) {
        const glyph = text[index];
        ctx.strokeText(glyph, strokeX, centerY);
        strokeX += ctx.measureText(glyph).width + tracking;
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = mode === "mask" ? THREE.NoColorSpace : THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return {
      texture,
      aspectRatio: width / height,
    };
  }

  function loadLogo() {
    const build = () => {
      const faceTexture = createLogoTexture({ mode: "face" });
      const maskTexture = createLogoTexture({ mode: "mask" });
      const baseWidth = 13.8;
      const baseHeight = baseWidth / faceTexture.aspectRatio;
      const depthLayerCount = 12;
      const depthStep = 0.058;
      const totalDepth = depthStep * (depthLayerCount - 1);
      const logoGroup = new THREE.Group();
      const shadowMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(baseWidth * 1.02, baseHeight * 1.05),
        new THREE.MeshBasicMaterial({
          alphaMap: maskTexture.texture,
          color: 0x030913,
          transparent: true,
          opacity: 0.24,
          side: THREE.DoubleSide,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      shadowMesh.position.set(0.16, -0.16, -0.24 - totalDepth / 2);
      logoGroup.add(shadowMesh);

      for (let index = 0; index < depthLayerCount; index += 1) {
        const progress = index / (depthLayerCount - 1);
        const layerColor = new THREE.Color().lerpColors(
          new THREE.Color(0x07131f),
          new THREE.Color(0x21405b),
          progress * 0.72,
        );
        const depthMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(baseWidth, baseHeight),
          new THREE.MeshBasicMaterial({
            alphaMap: maskTexture.texture,
            alphaTest: 0.42,
            color: layerColor,
            side: THREE.DoubleSide,
            toneMapped: false,
          }),
        );

        depthMesh.position.z = -totalDepth / 2 + (index * depthStep);
        depthMesh.position.x = -0.01 * (1 - progress);
        depthMesh.position.y = 0.006 * (1 - progress);
        logoGroup.add(depthMesh);
      }

      const faceMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(baseWidth, baseHeight),
        new THREE.MeshBasicMaterial({
          map: faceTexture.texture,
          transparent: true,
          alphaTest: 0.04,
          side: THREE.DoubleSide,
          toneMapped: false,
        }),
      );

      faceMesh.position.z = totalDepth / 2 + 0.03;
      logoGroup.add(faceMesh);
      logoGroup.userData.baseWidth = baseWidth * 1.03;
      logoGroup.userData.baseHeight = baseHeight * 1.05;

      logoContent = logoGroup;
      logoRoot.add(logoGroup);
      measureLogo();
      updateLogoScale();
      stage.classList.add("is-ready");
    };

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(build, build);
      return;
    }

    build();
  }

  function resize() {
    const rect = stage.getBoundingClientRect();
    const aspect = rect.width / rect.height;
    const halfHeight = ORTHO_FRUSTUM_HEIGHT / 2;
    const halfWidth = halfHeight * aspect;
    camera.left = -halfWidth;
    camera.right = halfWidth;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(rect.width, rect.height, false);
    updateLogoScale();
  }

  function measureLogo() {
    if (!logoContent) {
      return;
    }
    if (logoContent.userData.baseWidth && logoContent.userData.baseHeight) {
      return;
    }
    const bounds = new THREE.Box3().setFromObject(logoContent);
    logoContent.userData.baseWidth = bounds.max.x - bounds.min.x;
    logoContent.userData.baseHeight = bounds.max.y - bounds.min.y;
  }

  function updateLogoScale() {
    if (!logoContent) {
      return;
    }
    const visibleHeight = camera.top - camera.bottom;
    const visibleWidth = camera.right - camera.left;
    const targetWidth = visibleWidth * 0.58;
    const targetHeight = visibleHeight * 0.28;
    const scale = Math.min(
      targetWidth / logoContent.userData.baseWidth,
      targetHeight / logoContent.userData.baseHeight,
    );
    logoContent.scale.setScalar(scale);
  }

  function onPointerDown(event) {
    drag.active = true;
    drag.pointerId = event.pointerId;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    drag.velocityX = 0;
    drag.velocityY = 0;
    stage.classList.add("is-dragging");
    stage.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event) {
    if (!drag.active || event.pointerId !== drag.pointerId) {
      return;
    }

    const width = Math.max(stage.clientWidth, 1);
    const height = Math.max(stage.clientHeight, 1);
    const dx = (event.clientX - drag.lastX) / width;
    const dy = (event.clientY - drag.lastY) / height;

    motion.rotationY += dx * Math.PI * 2.4;
    motion.rotationX += dy * Math.PI * 2.1;
    drag.velocityY = dx * 0.34;
    drag.velocityX = dy * 0.3;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
  }

  function onPointerEnd(event) {
    if (drag.pointerId !== null && event.pointerId !== drag.pointerId) {
      return;
    }
    drag.active = false;
    drag.pointerId = null;
    stage.classList.remove("is-dragging");
  }

  function renderFrame() {
    const delta = Math.min(clock.getDelta(), 0.033);
    const bob = Math.sin(clock.elapsedTime * 1.05) * 0.06;

    if (!drag.active) {
      drag.velocityY += (motion.idleSpinY - drag.velocityY) * 0.04;
      drag.velocityX += (motion.idleSpinX - drag.velocityX) * 0.04;
    } else {
      drag.velocityY *= 0.98;
      drag.velocityX *= 0.98;
    }

    motion.rotationY += drag.velocityY;
    motion.rotationX += drag.velocityX;

    logoRoot.rotation.x += (motion.rotationX - logoRoot.rotation.x) * Math.min(1, delta * 10);
    logoRoot.rotation.y += (motion.rotationY - logoRoot.rotation.y) * Math.min(1, delta * 9);
    logoRoot.rotation.z = 0;
    logoRoot.position.y = bob;

    renderer.render(scene, camera);
  }
}
