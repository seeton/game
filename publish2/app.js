import * as THREE from "three";
import { FontLoader } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/geometries/TextGeometry.js";

const DEFAULT_LANGUAGE = "ja";
const DEFAULT_GAME = "minesweeper";
const DEFAULT_DIFFICULTY = "easy";
const DEFAULT_BINARY_SYMBOL = "USD/JPY";
const DEFAULT_BINARY_DURATION = 10;
const DEFAULT_BINARY_STAKE = 5_000;
const BINARY_STAKE_PRESETS = [1_000, 3_000, 5_000, 10_000];
const BINARY_CHART_WINDOW_SECONDS = 30;
const LANGUAGE_STORAGE_KEY = "seetona-language";
const BINARY_POLL_MS = 1_000;
const BINARY_STARTING_BALANCE = 100_000;
const BINARY_TARGET_MULTIPLIER = 3;
const BINARY_DECIDE_MS = 5_000;
const BINARY_REVEAL_MS = 10_000;
const BINARY_SETTLED_MS = 1_800;
const BINARY_PAYOUT_RATE = 0.85;
const BINARY_MIN_STAKE = 1_000;
const BINARY_REVEAL_TICKS = 10;
const BINARY_PRIOR_TICKS = 30;
const BINARY_PRIOR_SECONDS_PER_TICK = 10;

// 10 bundled USD/JPY historical-style price series. Each entry has the entry
// tick at index 0 followed by 10 one-second reveal ticks (11 prices total).
// `priorPrices` is filled in below with a deterministic backward random walk
// so the user sees ~5 minutes of context leading up to the entry tick.
const BINARY_SERIES = [
  { id: "usdjpy-up-1", label: "USD/JPY", digits: 3, prices: [148.20, 148.27, 148.33, 148.36, 148.41, 148.45, 148.48, 148.52, 148.57, 148.61, 148.66] },
  { id: "usdjpy-down-1", label: "USD/JPY", digits: 3, prices: [149.85, 149.79, 149.74, 149.68, 149.61, 149.55, 149.48, 149.42, 149.37, 149.31, 149.24] },
  { id: "usdjpy-chop-up", label: "USD/JPY", digits: 3, prices: [150.10, 150.13, 150.09, 150.12, 150.16, 150.11, 150.15, 150.18, 150.14, 150.17, 150.21] },
  { id: "usdjpy-rev-up", label: "USD/JPY", digits: 3, prices: [151.60, 151.55, 151.49, 151.46, 151.50, 151.55, 151.61, 151.66, 151.71, 151.76, 151.80] },
  { id: "usdjpy-up-2", label: "USD/JPY", digits: 3, prices: [145.30, 145.36, 145.43, 145.49, 145.54, 145.60, 145.66, 145.71, 145.76, 145.81, 145.85] },
  { id: "usdjpy-down-2", label: "USD/JPY", digits: 3, prices: [152.40, 152.32, 152.25, 152.17, 152.10, 152.02, 151.95, 151.89, 151.84, 151.80, 151.78] },
  { id: "usdjpy-chop-down", label: "USD/JPY", digits: 3, prices: [147.55, 147.59, 147.54, 147.56, 147.52, 147.55, 147.50, 147.48, 147.51, 147.47, 147.43] },
  { id: "usdjpy-up-3", label: "USD/JPY", digits: 3, prices: [149.10, 149.16, 149.21, 149.27, 149.32, 149.37, 149.43, 149.49, 149.54, 149.60, 149.65] },
  { id: "usdjpy-down-3", label: "USD/JPY", digits: 3, prices: [146.80, 146.74, 146.68, 146.62, 146.56, 146.50, 146.43, 146.37, 146.31, 146.25, 146.20] },
  { id: "usdjpy-rev-down", label: "USD/JPY", digits: 3, prices: [144.90, 144.95, 145.01, 145.07, 145.12, 145.15, 145.13, 145.10, 145.07, 145.04, 145.00] },
];

function seededBinaryRng(seed) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let state = (h >>> 0) || 1;
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildBinaryPriorPrices(series, count) {
  const rng = seededBinaryRng(series.id);
  let stepSum = 0;
  for (let i = 1; i < series.prices.length; i++) {
    stepSum += Math.abs(series.prices[i] - series.prices[i - 1]);
  }
  const avgStep = (stepSum / Math.max(1, series.prices.length - 1)) || 0.05;
  const factor = Math.pow(10, series.digits);
  const reversed = [];
  let price = series.prices[0];
  for (let i = 0; i < count; i++) {
    const drift = (rng() - 0.5) * avgStep * 1.8;
    price = price - drift;
    reversed.push(Math.round(price * factor) / factor);
  }
  return reversed.reverse();
}

BINARY_SERIES.forEach((series) => {
  series.priorPrices = buildBinaryPriorPrices(series, BINARY_PRIOR_TICKS);
});
const FISHING_SCAN_MS = 1_400;

const FISHING_ZONES = [
  { id: "north-reef", ja: "北の暗礁帯", en: "North reef line" },
  { id: "east-current", ja: "東の潮目", en: "Eastern current seam" },
  { id: "south-shelf", ja: "南の大陸棚", en: "South shelf edge" },
  { id: "west-bank", ja: "西の浅瀬帯", en: "West shoal bank" },
  { id: "deep-channel", ja: "沖の深み筋", en: "Offshore deep channel" },
  { id: "harbor-mouth", ja: "湾口の流入帯", en: "Harbor mouth flow" },
];

const GAME_LIBRARY = {
  minesweeper: { available: true },
  binary: { available: true },
  fishing: { available: true },
  planet: { available: true },
  management: { available: true },
  solitaire: { available: true },
};

const GAME_PATHS = {
  minesweeper: "/minesweeper/",
  binary: "/binary/",
  planet: "/planet/",
  management: "/management/",
  fishing: "/fishing/",
  solitaire: "/solitaire/",
};

function gameFromLocationPath(pathname) {
  if (typeof pathname !== "string") {
    return null;
  }
  for (const [game, target] of Object.entries(GAME_PATHS)) {
    const withoutSlash = target.replace(/\/$/, "");
    if (pathname === target || pathname === withoutSlash) {
      return game;
    }
  }
  return null;
}

function pushGameUrl(gameId, replace = false) {
  const target = GAME_PATHS[gameId];
  if (!target || typeof window === "undefined" || !window.history) {
    return;
  }
  if (window.location.pathname === target) {
    return;
  }
  const fullTarget = target + window.location.search + window.location.hash;
  const method = replace ? "replaceState" : "pushState";
  try {
    window.history[method]({ game: gameId }, "", fullTarget);
  } catch {
    // history API unavailable (e.g. file:// preview) — ignore silently.
  }
}

const COPY = {
  ja: {
    pageTitle: "SEETONA ホーム",
    pageDescription:
      "3Dロゴを触って回し、そのままゲーム棚からマインスイーパーやバイナリシミュレーションを選べる SEETONA のホームページです。",
    navAria: "グローバルナビゲーション",
    navPlay: "Games",
    navMotion: "Motion",
    languageGroupLabel: "言語切替",
    languageLabel: "LANGUAGE",
    playSectionLabel: "GAME SHELF",
    playSectionTitle: "GAMES",
    gameLibraryAria: "ゲーム選択棚",
    sceneBadge: "FREE ROTATION",
    sceneNote: "drag / swipe / spin",
    orbitAria: "自由に回せる SEETON の 3D ロゴ",
    footerLabel: "SEETONA",
    footerTitle: "ロゴ、ゲーム棚、実際に遊べる画面を一つにまとめたホーム。",
    footerLink: "先頭へ戻る",
    gamePanelLabel: "NOW PLAYING",
    gameStatusLabel: "状態",
    gameFlagsLabel: "旗残り",
    gameClearedLabel: "クリア",
    gameDifficultyLabel: "DIFFICULTY",
    gameDifficultyEasy: "小",
    gameDifficultyMedium: "中",
    gameDifficultyHard: "大",
    gameControlReveal: "左クリックまたはタップで開く。",
    gameControlFlag: "右クリックまたは長押しで旗を置く。",
    gameRestart: "新しい盤面",
    gameLoading: "読み込み中...",
    gameLoadingDetail: "Python 側の処理が整うまで少し待ってください。",
    gameBoardAria: "マインスイーパーの盤面",
    gameIdleStatus: "待機中",
    gameUnavailable: "準備中",
    gameMinesChip: "PLAYABLE",
    gameMinesTitle: "マインスイーパー",
    gameMinesBody: "そのまま読み込んで遊べる、最初の常設ゲームです。",
    gameBinaryChip: "PLAYABLE",
    gameBinaryTitle: "バイナリシミュレーション",
    gameBinaryBody: "10万円から始めて、昨日までの為替データを1秒ごとに再生する練習用バイナリです。",
    gameFishingChip: "SONAR ONLY",
    gameFishingTitle: "漁業シミュレーション",
    gameFishingBody: "ソナーで魚群を探し、向かうか別海域を探すかを決める探索ゲームです。",
    gamePlanetChip: "PLAYABLE",
    gamePlanetTitle: "惑星シミュレーション",
    gamePlanetBody: "重力や軌道を触って遊ぶ枠を先に置いています。",
    gameManagementChip: "PLAYABLE",
    gameManagementTitle: "経営シミュレーション",
    gameManagementBody: "数字を伸ばしながら店や会社を回す枠です。",
    gameSolitaireChip: "PLAYABLE",
    gameSolitaireTitle: "ソリティア",
    gameSolitaireBody: "落ち着いて遊べる一人用ゲームの枠です。",
    fishingSweepsLabel: "SWEEPS",
    fishingSignalLabel: "SIGNAL",
    fishingDecisionLabel: "DECISION",
    fishingControlScan: "ソナーで海域を走査して魚群反応を探す。",
    fishingControlDecision: "反応が出たら向かうか、別の場所を探すかを決める。",
    fishingScanAction: "ソナーを走らせる",
    fishingGoAction: "この群れに向かう",
    fishingSearchAction: "別の場所を探す",
    fishingPanelLabel: "SONAR",
    fishingPanelTitle: "魚群探知",
    fishingPanelAria: "漁業シミュレーションのソナー画面",
    fishingSignalScaleLabel: "SIGNAL SCALE",
    fishingSignalScaleTitle: "魚群の見え方 5段階",
    fishingLogLabel: "SCAN LOG",
    fishingLogTitle: "直近の探知",
    fishingLogEmpty: "まだ探知記録はありません。",
    fishingTargetNone: "まだ魚群は見つかっていません。",
    fishingTargetPending: "海底地形と反応波形を照合しています。",
    fishingTargetCommitted: "この群れへ向かうルートを確保しました。漁は次の工程で実装します。",
    fishingTargetTemplate: "{zone} / {distance} km / {signal}",
    fishingStatusCopyIdle: "ソナーを走らせて最初の魚群反応を探してください。",
    fishingStatusCopyScanning: "魚群探知中です。波形が固まるまで少し待ってください。",
    fishingStatusCopyDetected: "魚群反応を捕捉しました。向かうか、別の場所を探すかを選んでください。",
    fishingStatusCopyCommitted: "目的海域を固定しました。実際の漁アクションは次の実装で追加します。",
    fishingDecisionStandby: "待機",
    fishingDecisionScanning: "走査中",
    fishingDecisionPending: "判断待ち",
    fishingDecisionGo: "向かう",
    fishingDecisionSearch: "再探索",
    fishingStatusIdle: "未探知",
    fishingStatusScanning: "走査中",
    fishingStatusDetected: "探知済み",
    fishingStatusCommitted: "進路確保",
    fishingSignalNone: "未探知",
    fishingSignalStage1: "少量に見える",
    fishingSignalStage2: "少なめに見える",
    fishingSignalStage3: "中くらいに見える",
    fishingSignalStage4: "多めに見える",
    fishingSignalStage5: "大量に見える",
    planetBodiesLabel: "天体数",
    planetLifeLabel: "生命",
    planetPhaseLabel: "段階",
    planetProgressLabel: "進行",
    planetPhaseInflation: "インフレーション",
    planetPhaseStars: "恒星形成",
    planetPhaseSupernova: "超新星",
    planetPhasePlanets: "惑星形成",
    planetPhaseVictory: "地球誕生",
    planetControlNote: "創世記のシナリオ。インフレ → 恒星 → 超新星 → 惑星 と進めて地球を誕生させよう。",
    planetPause: "一時停止",
    planetResume: "再開",
    planetReset: "やり直し",
    planetHintInflation: "クリックで真空のゆらぎを撒く。膨張する宇宙の中で素粒子が陽子や中性子になり、水素やヘリウムの原子核が生まれる。",
    planetHintStars: "重力で物質が集まり、最初の星が灯る瞬間を待つ。粒が足りなければ追加してもいい。",
    planetHintSupernova: "星の中心で炭素・酸素・鉄などの重い元素が作られた。膨らんだ恒星をクリックして超新星にし、重元素と小惑星を宇宙へばら撒こう。",
    planetHintPlanets: "小惑星のディスクが集まって原始惑星になる。惑星にリングが収縮して重なる瞬間にタップ。3回タイミングよく当てると 火山 → 雨 → 生命 と進み地球が完成する。",
    planetHintVictory: "地球が誕生し、生命が安定して根付いた。クリア！",
    planetVictoryTitle: "地球誕生",
    planetVictorySub: "生命が宿る惑星が安定しました。",
    planetTimelineAria: "宇宙史タイムライン",
    planetTimelineStep0: "インフレ",
    planetTimelineStep1: "星と銀河",
    planetTimelineStep2: "超新星",
    planetTimelineStep3: "太陽系",
    planetTimelineStep4: "地球",
    planetEraInflationClock: "10⁻³⁶ 秒",
    planetEraInflationName: "インフレーションと素粒子",
    planetEraStarsClock: "宇宙 38 万年 → 数億年",
    planetEraStarsName: "原子と最初の星",
    planetEraSupernovaClock: "数十億年",
    planetEraSupernovaName: "重元素と超新星",
    planetEraPlanetsClock: "46 億年前",
    planetEraPlanetsName: "太陽系と惑星形成",
    planetEraVictoryClock: "今",
    planetEraVictoryName: "地球と生命",
    planetIntroInflationTitle: "宇宙誕生",
    planetIntroInflationBody: "高温・高密度の宇宙が一瞬で猛烈に膨張する。エネルギーが冷えて素粒子になり、陽子・中性子・軽い原子核ができる。",
    planetIntroStarsTitle: "原子と最初の星",
    planetIntroStarsBody: "宇宙 38 万年で電子が原子核と結びつき光がまっすぐ進めるようになる(CMB)。やがて密度のむらからガスが集まり最初の星が灯る。",
    planetIntroSupernovaTitle: "重い元素の誕生",
    planetIntroSupernovaBody: "星の中心で炭素・酸素・鉄・ケイ素が作られる。星が寿命を迎えて超新星爆発を起こすと、重元素が宇宙空間にばら撒かれる。",
    planetIntroPlanetsTitle: "太陽系の誕生と地球の進化",
    planetIntroPlanetsBody: "原始惑星にリングが収縮する。重なる瞬間に3回タップ。火山 → 雨 → 生命の順で地球が誕生する。",
    planetIntroVictoryTitle: "地球誕生",
    planetIntroVictoryBody: "重い元素と水が揃い、生命が根付いた惑星が安定した。",
    mgmtDayLabel: "日",
    mgmtBalanceLabel: "残高",
    mgmtCustomersLabel: "来客",
    mgmtControlBuy: "仕入れボタンで在庫を補充する。",
    mgmtControlServe: "営業開始で当日の客を迎える。",
    mgmtServeAction: "営業開始",
    mgmtResetAction: "リセット",
    mgmtStockLabel: "STOCK",
    mgmtStockTitle: "在庫補充",
    mgmtMenuLabel: "MENU",
    mgmtMenuTitle: "商品一覧",
    mgmtLogLabel: "LOG",
    mgmtLogTitle: "営業記録",
    mgmtLogEmpty: "まだ営業記録はありません。",
    mgmtBuyButton: "+{count}個 ({cost})",
    mgmtStockCount: "在庫: {count}個",
    mgmtSellPrice: "売値: {price}",
    mgmtLogDay: "{day}日目",
    mgmtLogServed: "{served}/{customers}人",
    solitaireMovesLabel: "手数",
    solitaireTimeLabel: "TIME",
    solitaireStockLabel: "山札",
    solitaireControl1: "山札をクリックしてめくる。カードをクリックして選択・移動。",
    solitaireControl2: "全カードを組み札に積んだらクリア。",
    solitaireRestart: "新しいゲーム",
    solitaireWin: "クリア！おめでとうございます。",
    binaryBalanceLabel: "残高",
    binaryQuoteLabel: "現在値",
    binaryProviderLabel: "ラウンド",
    binaryPairLabel: "PAIR",
    binaryDurationLabel: "DURATION",
    binaryStakeLabel: "STAKE",
    binaryStakeCustom: "カスタム金額",
    binaryActionUp: "上がる",
    binaryActionDown: "下がる",
    binaryStatusDefault: "残高3倍でクリア。5秒で売買を選び、10秒かけて答え合わせします。",
    binaryStatusDeciding: "{seconds}秒以内に上がる / 下がる を選んでください。",
    binaryStatusRevealing: "答え合わせまで残り{seconds}秒…",
    binaryStatusSettledWon: "勝ち！ {profit}",
    binaryStatusSettledLost: "負け…次のラウンドへ。",
    binaryStatusSettledDraw: "引き分け。掛け金は戻ります。",
    binaryStatusSkipped: "見送り。次のラウンドへ。",
    binaryStatusCleared: "残高3倍達成！クリアです。",
    binaryStatusGameOver: "残高不足でゲームオーバー。",
    binaryProgressLine: "ラウンド {round} / 目標残高 {target}",
    binaryObjectiveLabel: "勝利条件",
    binaryObjectiveTarget: "残高を3倍 ({target}) にする",
    binaryObjectiveDetail: "現在 {current} / 残り {remaining}",
    binaryObjectiveCleared: "達成！残高3倍をクリアしました。",
    binaryObjectiveFailed: "残高不足でゲームオーバー。",
    binaryAxisEntry: "判定",
    binaryEntryMarker: "エントリー {price}",
    binaryMarketNote: "",
    binaryDecidingTimer: "決断 残り{seconds}秒",
    binaryRevealingTimer: "判定まで{seconds}秒",
    binarySettledLabel: "判定中",
    binaryClearedLabel: "クリア",
    binaryGameOverLabel: "ゲームオーバー",
    binaryProviderDefault: "",
    binaryCaseStatus: "{symbol} / 元データ {date} / {elapsed}秒 / {total}秒",
    binaryChartLabel: "CHART",
    binaryChartTitle: "ケースグラフ",
    binaryChartAria: "バイナリシミュレーションの価格グラフ",
    binaryChartNow: "現在 {price}",
    binaryChartRange: "安値 {min} / 高値 {max}",
    binaryChartPending: "グラフ準備中",
    binaryOpenLabel: "OPEN",
    binaryOpenTitle: "進行中ポジション",
    binaryHistoryLabel: "HISTORY",
    binaryHistoryTitle: "直近の結果",
    binaryStakePreset: "¥{amount}",
    binaryStakeMin: "最低金額は {amount}",
    binarySeconds: "{seconds}秒",
    binaryOpenEmpty: "まだポジションはありません。",
    binaryHistoryEmpty: "まだ約定結果はありません。",
    binaryTradeReady: "判定方向を押すと、現在のレートでポジションを作ります。",
    binaryTradePlaced: "ポジションを追加しました。",
    binaryDirectionUp: "UP",
    binaryDirectionDown: "DOWN",
    binaryResultWon: "勝ち",
    binaryResultLost: "負け",
    binaryResultDraw: "ドロー",
    binaryOpenCountdown: "残り {seconds}秒",
    binaryOpenedAt: "開始 {time}",
    binarySettledAt: "判定 {time}",
    binaryEntryPrice: "エントリー {price}",
    binaryExitPrice: "判定値 {price}",
    binaryProfit: "損益 {amount}",
    binaryPayout: "払戻 {amount}",
    binaryProviderNameLive: "Twelve Data",
    binaryProviderNameDaily: "Frankfurter",
    binaryProviderNameHistorical: "Historical Replay",
    binaryProviderNameUnavailable: "Unavailable",
    games: {
      minesweeper: {
        panelTitle: "マインスイーパー",
        panelBody: "盤面の上に状態と難易度を置き、小さめの盤面をすぐ遊べる形にしています。",
        promptTitle: "マインスイーパーを読み込み中",
        promptBody: "棚から選ぶと同時に盤面の準備を始めます。",
        badge: "PLAYABLE",
      },
      binary: {
        panelTitle: "バイナリシミュレーション",
        panelBody: "10万円から始めて、昨日までの為替データを再生した1日3ケースで上下判定を試せます。",
        promptTitle: "バイナリシミュレーションを読み込み中",
        promptBody: "通貨ペアと口座状態を読み込みます。",
        badge: "PLAYABLE",
      },
      fishing: {
        panelTitle: "漁業シミュレーション",
        panelBody: "まずはソナーで魚群を探し、向かうか再探索するかを決める最初の工程を遊べます。",
        promptTitle: "漁業シミュレーションを準備中",
        promptBody: "ソナー画面を立ち上げています。",
        badge: "PLAYABLE",
      },
      planet: {
        panelTitle: "創世記シミュレーション",
        panelBody: "インフレーションから始めて、恒星・超新星・惑星を経て地球を誕生させます。",
        promptTitle: "創世記シミュレーション",
        promptBody: "クリックで宇宙の種をばら撒いて始めてください。",
        badge: "PLAYABLE",
      },
      management: {
        panelTitle: "経営シミュレーション",
        panelBody: "材料を仕入れて営業開始し、お店の残高を伸ばしていきます。",
        promptTitle: "経営シミュレーション",
        promptBody: "仕入れをして営業開始ボタンを押してください。",
        badge: "PLAYABLE",
      },
      solitaire: {
        panelTitle: "ソリティア",
        panelBody: "山札から配って全カードを組み札へ積むクロンダイクです。",
        promptTitle: "ソリティア",
        promptBody: "新しいゲームを始めてください。",
        badge: "PLAYABLE",
      },
    },
    statusLabels: {
      ready: "待機中",
      playing: "探索中",
      won: "クリア",
      lost: "失敗",
    },
    binaryNoticeCodes: {
      binaryProviderLive: "Twelve Data のライブレートで判定できます。",
      binaryProviderDailyDisabled:
        "現在は Frankfurter の日次参照レートだけ表示しています。ライブ売買は API キー設定後に有効になります。",
      binaryProviderDailyEnabled:
        "現在は Frankfurter の日次参照レートです。遅延があるので練習用途として扱ってください。",
      binaryProviderHistorical: "昨日までの実データから作った本日のケースを1秒ごとに再生しています。",
      binaryProviderHistoricalStale:
        "最新ケース生成に失敗したため、直近の履歴ケースをそのまま再利用しています。",
      binaryProviderUnavailable: "レート取得に失敗しました。",
      binaryProviderStale: "新しいレート取得に失敗したため、直近のキャッシュを表示しています。",
      binarySettlementPending: "判定時のレート取得に失敗したため、一部ポジションは次回更新で確定します。",
    },
    errors: {
      "Request failed": "通信に失敗しました。",
      "Failed to load state": "状態の読み込みに失敗しました。",
      "asset not found": "必要なファイルが見つかりません。",
      "POST required": "この操作には POST が必要です。",
      "unknown difficulty": "難易度が不正です。",
      "row or col out of bounds": "盤面の外を選択しています。",
      "invalid Content-Length": "通信サイズが不正です。",
      "request body too large": "通信データが大きすぎます。",
      "invalid JSON body": "JSON が不正です。",
      "JSON body must be an object": "JSON はオブジェクトで送ってください。",
      "not found": "見つかりません。",
      "unknown symbol": "通貨ペアが不正です。",
      "unknown direction": "判定方向が不正です。",
      "unknown duration": "判定時間が不正です。",
      "stake too small": "掛け金が小さすぎます。",
      "insufficient balance": "残高が不足しています。",
      "live quote required": "ライブレートが使えないため売買できません。",
      "live fx api key missing": "ライブ用 API キーが未設定です。",
      "live fx quote failed": "ライブレート取得に失敗しました。",
      "daily fx quote failed": "参照レート取得に失敗しました。",
      "fx quote unavailable": "レート取得に失敗しました。",
      "quote provider request failed": "外部レートAPIへの接続に失敗しました。",
      "historical case unavailable": "履歴ケースを作るための十分なデータがありません。",
      "historical case fetch failed": "履歴データの取得に失敗しました。",
    },
  },
  en: {
    pageTitle: "SEETONA home",
    pageDescription:
      "A SEETONA homepage where you can spin the 3D logo and jump straight into Minesweeper or a binary simulation from the game shelf.",
    navAria: "Global navigation",
    navPlay: "Games",
    navMotion: "Motion",
    languageGroupLabel: "Language switcher",
    languageLabel: "LANGUAGE",
    playSectionLabel: "GAME SHELF",
    playSectionTitle: "GAMES",
    gameLibraryAria: "Game selection shelf",
    sceneBadge: "FREE ROTATION",
    sceneNote: "drag / swipe / spin",
    orbitAria: "A freely rotatable 3D SEETON logo",
    footerLabel: "SEETONA",
    footerTitle: "A single home that combines the logo, the game shelf, and playable screens.",
    footerLink: "Back to top",
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
    gameRestart: "New board",
    gameLoading: "Loading...",
    gameLoadingDetail: "Wait a moment while the Python side prepares the state.",
    gameBoardAria: "Minesweeper board",
    gameIdleStatus: "Standby",
    gameUnavailable: "Coming soon",
    gameMinesChip: "PLAYABLE",
    gameMinesTitle: "Minesweeper",
    gameMinesBody: "The first permanent game and ready to launch immediately.",
    gameBinaryChip: "PLAYABLE",
    gameBinaryTitle: "Binary Simulation",
    gameBinaryBody: "A 100,000 JPY practice wallet that replays historical FX data second by second.",
    gameFishingChip: "SONAR ONLY",
    gameFishingTitle: "Fishing Simulation",
    gameFishingBody: "Sweep with sonar, find a school, then decide whether to head there or search elsewhere.",
    gamePlanetChip: "PLAYABLE",
    gamePlanetTitle: "Planet Simulation",
    gamePlanetBody: "A future slot for orbit and gravity play.",
    gameManagementChip: "PLAYABLE",
    gameManagementTitle: "Management Simulation",
    gameManagementBody: "A future slot for building a company through numbers.",
    gameSolitaireChip: "PLAYABLE",
    gameSolitaireTitle: "Solitaire",
    gameSolitaireBody: "A calm single-player slot that will come later.",
    fishingSweepsLabel: "SWEEPS",
    fishingSignalLabel: "SIGNAL",
    fishingDecisionLabel: "DECISION",
    fishingControlScan: "Run sonar to scan a new patch of water.",
    fishingControlDecision: "Once a school appears, choose whether to head there or keep searching.",
    fishingScanAction: "Run sonar",
    fishingGoAction: "Head to this school",
    fishingSearchAction: "Search elsewhere",
    fishingPanelLabel: "SONAR",
    fishingPanelTitle: "School detection",
    fishingPanelAria: "Sonar screen for the fishing simulation",
    fishingSignalScaleLabel: "SIGNAL SCALE",
    fishingSignalScaleTitle: "Five signal levels",
    fishingLogLabel: "SCAN LOG",
    fishingLogTitle: "Recent detections",
    fishingLogEmpty: "No sonar detections yet.",
    fishingTargetNone: "No fish school is locked yet.",
    fishingTargetPending: "Matching seabed echoes and fish marks...",
    fishingTargetCommitted: "The route to this school is locked. The actual catch flow comes next.",
    fishingTargetTemplate: "{zone} / {distance} km / {signal}",
    fishingStatusCopyIdle: "Run sonar to look for the first fish school.",
    fishingStatusCopyScanning: "The sonar is sweeping. Wait for the waveform to settle.",
    fishingStatusCopyDetected: "A school was found. Decide whether to head there or search somewhere else.",
    fishingStatusCopyCommitted: "The route is fixed. The actual fishing action will be added next.",
    fishingDecisionStandby: "Standby",
    fishingDecisionScanning: "Scanning",
    fishingDecisionPending: "Awaiting choice",
    fishingDecisionGo: "Heading there",
    fishingDecisionSearch: "Search again",
    fishingStatusIdle: "No mark",
    fishingStatusScanning: "Scanning",
    fishingStatusDetected: "Detected",
    fishingStatusCommitted: "Route locked",
    fishingSignalNone: "No mark",
    fishingSignalStage1: "Very light marks",
    fishingSignalStage2: "Light marks",
    fishingSignalStage3: "Moderate marks",
    fishingSignalStage4: "Heavy marks",
    fishingSignalStage5: "Dense school",
    planetBodiesLabel: "BODIES",
    planetLifeLabel: "LIFE",
    planetPhaseLabel: "PHASE",
    planetProgressLabel: "PROGRESS",
    planetPhaseInflation: "Inflation",
    planetPhaseStars: "Star formation",
    planetPhaseSupernova: "Supernova",
    planetPhasePlanets: "Planet formation",
    planetPhaseVictory: "Earth born",
    planetControlNote: "A Genesis arc — Inflation → Stars → Supernova → Planets. Bring Earth to life to win.",
    planetPause: "Pause",
    planetResume: "Resume",
    planetReset: "Restart",
    planetHintInflation: "Click to scatter quantum fluctuations. As the universe expands and cools, particles become protons, neutrons, and light nuclei (H, He).",
    planetHintStars: "Gravity pulls matter together. Wait for the first stars to ignite — add more motes if needed.",
    planetHintSupernova: "Heavy elements like carbon, oxygen, and iron are forged in stellar cores. Click a swollen star to detonate a supernova and scatter them.",
    planetHintPlanets: "The asteroid disk accretes into protoplanets. Tap when the ring closes onto a planet — three on-time hits cycle volcano → rain → life and birth Earth.",
    planetHintVictory: "Earth has been born and life is stable. Cleared!",
    planetVictoryTitle: "Earth Born",
    planetVictorySub: "A living world has stabilized.",
    planetTimelineAria: "Cosmic timeline",
    planetTimelineStep0: "Inflation",
    planetTimelineStep1: "Stars",
    planetTimelineStep2: "Supernova",
    planetTimelineStep3: "Solar system",
    planetTimelineStep4: "Earth",
    planetEraInflationClock: "10⁻³⁶ s",
    planetEraInflationName: "Inflation & particles",
    planetEraStarsClock: "380k yr → 100M yr",
    planetEraStarsName: "Atoms & first stars",
    planetEraSupernovaClock: "Billions of years",
    planetEraSupernovaName: "Heavy elements & supernovae",
    planetEraPlanetsClock: "4.6 billion years ago",
    planetEraPlanetsName: "Solar system & planets",
    planetEraVictoryClock: "Today",
    planetEraVictoryName: "Earth & life",
    planetIntroInflationTitle: "The universe begins",
    planetIntroInflationBody: "A hot, dense universe inflates explosively. As it cools, energy condenses into particles — protons, neutrons, and the first light nuclei (H, He).",
    planetIntroStarsTitle: "Atoms & first stars",
    planetIntroStarsBody: "At 380,000 years, electrons bind with nuclei into atoms — light streams free (the CMB). Later, density ripples pull gas together until the first stars ignite.",
    planetIntroSupernovaTitle: "Forging heavy elements",
    planetIntroSupernovaBody: "Stars fuse carbon, oxygen, iron, and silicon in their cores. When they die in supernovae, those elements scatter across the cosmos.",
    planetIntroPlanetsTitle: "Solar system & a young Earth",
    planetIntroPlanetsBody: "A ring contracts onto each protoplanet. Tap during the overlap three times — volcano, rain, and life cycle into Earth.",
    planetIntroVictoryTitle: "Earth is born",
    planetIntroVictoryBody: "With heavy elements and water in place, a stable, living world has emerged.",
    mgmtDayLabel: "DAY",
    mgmtBalanceLabel: "Balance",
    mgmtCustomersLabel: "Customers",
    mgmtControlBuy: "Use the stock buttons to restock.",
    mgmtControlServe: "Press Start Day to serve customers.",
    mgmtServeAction: "Start Day",
    mgmtResetAction: "Reset",
    mgmtStockLabel: "STOCK",
    mgmtStockTitle: "Restock",
    mgmtMenuLabel: "MENU",
    mgmtMenuTitle: "Menu",
    mgmtLogLabel: "LOG",
    mgmtLogTitle: "Business log",
    mgmtLogEmpty: "No log entries yet.",
    mgmtBuyButton: "+{count} ({cost})",
    mgmtStockCount: "Stock: {count}",
    mgmtSellPrice: "Price: {price}",
    mgmtLogDay: "Day {day}",
    mgmtLogServed: "{served}/{customers} served",
    solitaireMovesLabel: "MOVES",
    solitaireTimeLabel: "TIME",
    solitaireStockLabel: "STOCK",
    solitaireControl1: "Click stock to deal. Click a card to select, click destination to move.",
    solitaireControl2: "Move all cards to the foundations to win.",
    solitaireRestart: "New game",
    solitaireWin: "You win! Congratulations.",
    binaryBalanceLabel: "Balance",
    binaryQuoteLabel: "Quote",
    binaryProviderLabel: "Round",
    binaryPairLabel: "PAIR",
    binaryDurationLabel: "DURATION",
    binaryStakeLabel: "STAKE",
    binaryStakeCustom: "Custom amount",
    binaryActionUp: "Higher",
    binaryActionDown: "Lower",
    binaryStatusDefault: "Triple your balance to clear. 5s to pick, then a 10s reveal.",
    binaryStatusDeciding: "Pick UP or DOWN within {seconds}s.",
    binaryStatusRevealing: "{seconds}s until the reveal…",
    binaryStatusSettledWon: "Won! {profit}",
    binaryStatusSettledLost: "Lost. Next round coming.",
    binaryStatusSettledDraw: "Draw. Your stake is returned.",
    binaryStatusSkipped: "Skipped. Next round coming.",
    binaryStatusCleared: "Balance tripled — cleared!",
    binaryStatusGameOver: "Balance too low. Game over.",
    binaryProgressLine: "Round {round} / target balance {target}",
    binaryObjectiveLabel: "Goal",
    binaryObjectiveTarget: "Triple your balance ({target})",
    binaryObjectiveDetail: "Now {current} / {remaining} to go",
    binaryObjectiveCleared: "Cleared — balance tripled!",
    binaryObjectiveFailed: "Out of funds. Game over.",
    binaryAxisEntry: "Entry",
    binaryEntryMarker: "Entry {price}",
    binaryMarketNote: "",
    binaryDecidingTimer: "Decide {seconds}s",
    binaryRevealingTimer: "Reveal {seconds}s",
    binarySettledLabel: "Settling",
    binaryClearedLabel: "Cleared",
    binaryGameOverLabel: "Game over",
    binaryProviderDefault: "",
    binaryCaseStatus: "{symbol} / source {date} / {elapsed}s / {total}s",
    binaryChartLabel: "CHART",
    binaryChartTitle: "Case chart",
    binaryChartAria: "Price chart for the binary simulation",
    binaryChartNow: "Now {price}",
    binaryChartRange: "Low {min} / High {max}",
    binaryChartPending: "Preparing chart",
    binaryOpenLabel: "OPEN",
    binaryOpenTitle: "Open positions",
    binaryHistoryLabel: "HISTORY",
    binaryHistoryTitle: "Recent results",
    binaryStakePreset: "¥{amount}",
    binaryStakeMin: "Minimum stake is {amount}",
    binarySeconds: "{seconds}s",
    binaryOpenEmpty: "No open positions yet.",
    binaryHistoryEmpty: "No settled trades yet.",
    binaryTradeReady: "Press a direction to open a position at the current quote.",
    binaryTradePlaced: "A new position was placed.",
    binaryDirectionUp: "UP",
    binaryDirectionDown: "DOWN",
    binaryResultWon: "Won",
    binaryResultLost: "Lost",
    binaryResultDraw: "Draw",
    binaryOpenCountdown: "{seconds}s left",
    binaryOpenedAt: "Opened {time}",
    binarySettledAt: "Settled {time}",
    binaryEntryPrice: "Entry {price}",
    binaryExitPrice: "Exit {price}",
    binaryProfit: "P/L {amount}",
    binaryPayout: "Payout {amount}",
    binaryProviderNameLive: "Twelve Data",
    binaryProviderNameDaily: "Frankfurter",
    binaryProviderNameHistorical: "Historical Replay",
    binaryProviderNameUnavailable: "Unavailable",
    games: {
      minesweeper: {
        panelTitle: "Minesweeper",
        panelBody: "Status and difficulty stay above the board so the board itself can stay compact.",
        promptTitle: "Loading Minesweeper",
        promptBody: "Choosing it from the shelf starts the board request immediately.",
        badge: "PLAYABLE",
      },
      binary: {
        panelTitle: "Binary Simulation",
        panelBody: "Start with 100,000 JPY and try higher/lower positions inside three daily replay cases built from historical FX data.",
        promptTitle: "Loading Binary Simulation",
        promptBody: "The panel is fetching the account state and quote feed.",
        badge: "PLAYABLE",
      },
      fishing: {
        panelTitle: "Fishing Simulation",
        panelBody: "The first playable step is sonar detection: find a school, then decide whether to head there or search again.",
        promptTitle: "Loading Fishing Simulation",
        promptBody: "Preparing the sonar view.",
        badge: "PLAYABLE",
      },
      planet: {
        panelTitle: "Genesis Simulation",
        panelBody: "Begin at cosmic inflation and shepherd matter through stars, supernovae, and planets until Earth is born.",
        promptTitle: "Genesis Simulation",
        promptBody: "Click to scatter motes and ignite the universe.",
        badge: "PLAYABLE",
      },
      management: {
        panelTitle: "Management Simulation",
        panelBody: "Restock the café and open for business each day.",
        promptTitle: "Management Simulation",
        promptBody: "Buy stock then press Start Day.",
        badge: "PLAYABLE",
      },
      solitaire: {
        panelTitle: "Solitaire",
        panelBody: "Klondike: deal from stock and move all cards to the foundations.",
        promptTitle: "Solitaire",
        promptBody: "Start a new card game.",
        badge: "PLAYABLE",
      },
    },
    statusLabels: {
      ready: "Ready",
      playing: "Scanning",
      won: "Cleared",
      lost: "Failed",
    },
    binaryNoticeCodes: {
      binaryProviderLive: "Live rates from Twelve Data are active.",
      binaryProviderDailyDisabled:
        "Only Frankfurter daily reference rates are available right now. Live trading stays disabled until a live API key is configured.",
      binaryProviderDailyEnabled:
        "Frankfurter daily reference rates are active. Treat this as delayed practice mode.",
      binaryProviderHistorical: "Today’s three replay cases are running from historical market data up to yesterday.",
      binaryProviderHistoricalStale:
        "Fresh case generation failed, so the most recent historical replay cases are being reused.",
      binaryProviderUnavailable: "The quote feed could not be loaded.",
      binaryProviderStale: "Fresh quotes failed, so the most recent cached quote is shown.",
      binarySettlementPending:
        "Some positions could not settle because the settlement quote failed to load. They will settle on the next successful refresh.",
    },
    errors: {
      "Request failed": "Request failed.",
      "Failed to load state": "Failed to load state.",
      "asset not found": "Required assets were not found.",
      "POST required": "This action requires POST.",
      "unknown difficulty": "Unknown difficulty.",
      "row or col out of bounds": "The selected tile is outside the board.",
      "invalid Content-Length": "Invalid Content-Length.",
      "request body too large": "The request body is too large.",
      "invalid JSON body": "Invalid JSON body.",
      "JSON body must be an object": "The JSON body must be an object.",
      "not found": "Not found.",
      "unknown symbol": "Unknown currency pair.",
      "unknown direction": "Unknown trade direction.",
      "unknown duration": "Unknown duration.",
      "stake too small": "Stake is too small.",
      "insufficient balance": "Not enough balance.",
      "live quote required": "A live quote feed is required before trading.",
      "live fx api key missing": "The live FX API key is missing.",
      "live fx quote failed": "Failed to fetch a live FX quote.",
      "daily fx quote failed": "Failed to fetch the daily reference quote.",
      "fx quote unavailable": "The quote feed is unavailable.",
      "quote provider request failed": "The external quote provider request failed.",
      "historical case unavailable": "There is not enough historical data to build replay cases.",
      "historical case fetch failed": "Failed to fetch historical data for replay cases.",
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

const minesToolbar = document.getElementById("mines-toolbar");
const binaryToolbar = document.getElementById("binary-toolbar");
const fishingToolbar = document.getElementById("fishing-toolbar");
const difficultyCluster = document.getElementById("difficulty-cluster");
const restartButton = document.getElementById("restart-button");

const gamePlaceholder = document.getElementById("game-placeholder");
const gamePlaceholderThumb = document.getElementById("game-placeholder-thumb");
const gamePlaceholderTitle = document.getElementById("game-placeholder-title");
const gamePlaceholderCopy = document.getElementById("game-placeholder-copy");
const gameLoading = document.getElementById("game-loading");
const boardWrap = document.getElementById("game-board-wrap");
const boardElement = document.getElementById("board");

const statusElement = document.getElementById("status-text");
const flagsElement = document.getElementById("flags-left");
const clearedElement = document.getElementById("cleared-count");

const binaryPanel = document.getElementById("binary-panel");
const fishingPanel = document.getElementById("fishing-panel");
const binaryBalance = document.getElementById("binary-balance");
const binaryQuote = document.getElementById("binary-quote");
const binaryProvider = document.getElementById("binary-provider");
const binaryStatusLine = document.getElementById("binary-status-line");
const binaryProviderLine = document.getElementById("binary-provider-line");
const binaryPairPicker = document.getElementById("binary-pair-picker");
const binaryStartButton = document.getElementById("binary-start-button");
const binaryDurationPicker = document.getElementById("binary-duration-picker");
const binaryStakePresets = document.getElementById("binary-stake-presets");
const binaryStakeInput = document.getElementById("binary-stake-input");
const binaryUpButton = document.getElementById("binary-up-button");
const binaryDownButton = document.getElementById("binary-down-button");
const binaryMarketNote = document.getElementById("binary-market-note") || document.createElement("span");
const binaryChartPath = document.getElementById("binary-chart-path");
const binaryChartFuture = document.getElementById("binary-chart-future");
const binaryChartProgress = document.getElementById("binary-chart-progress");
const binaryChartPoint = document.getElementById("binary-chart-point");
const binaryChartNow = document.getElementById("binary-chart-now");
const binaryChartRange = document.getElementById("binary-chart-range");
const binaryChartMin = document.getElementById("binary-chart-min");
const binaryChartMax = document.getElementById("binary-chart-max");
const binaryChartTicks = Array.from(document.querySelectorAll("[data-binary-chart-tick]"));
const binaryChartOverlay = document.getElementById("binary-chart-overlay");
const binaryChartTimer = document.getElementById("binary-chart-timer");
const binaryOpenList = document.getElementById("binary-open-list");
const binaryHistoryList = document.getElementById("binary-history-list");
const binaryObjectiveCard = document.getElementById("binary-objective");
const binaryObjectiveLabelEl = document.getElementById("binary-objective-label");
const binaryObjectiveTargetEl = document.getElementById("binary-objective-target");
const binaryObjectiveFill = document.getElementById("binary-objective-fill");
const binaryObjectiveDetailEl = document.getElementById("binary-objective-detail");
const fishingSweeps = document.getElementById("fishing-sweeps");
const fishingSignal = document.getElementById("fishing-signal");
const fishingDecision = document.getElementById("fishing-decision");
const fishingScanButton = document.getElementById("fishing-scan-button");
const fishingGoButton = document.getElementById("fishing-go-button");
const fishingSearchButton = document.getElementById("fishing-search-button");
const fishingPanelCopy = document.getElementById("fishing-panel-copy");
const fishingSonarStage = document.getElementById("fishing-sonar-stage");
const fishingSonarBlips = document.getElementById("fishing-sonar-blips");
const fishingTargetTitle = document.getElementById("fishing-target-title");
const fishingTargetMeta = document.getElementById("fishing-target-meta");
const fishingSignalScale = document.getElementById("fishing-signal-scale");
const fishingLogList = document.getElementById("fishing-log-list");

const planetToolbar = document.getElementById("planet-toolbar");
const mgmtToolbar = document.getElementById("mgmt-toolbar");
const solitaireToolbar = document.getElementById("solitaire-toolbar");
const planetPanel = document.getElementById("planet-panel");
const mgmtPanel = document.getElementById("mgmt-panel");
const solitairePanel = document.getElementById("solitaire-panel");
const planetBodyCountEl = document.getElementById("planet-body-count");
const planetLifeCountEl = document.getElementById("planet-life-count");
const planetPhaseTextEl = document.getElementById("planet-phase-text");
const planetProgressTextEl = document.getElementById("planet-progress-text");
const planetPauseButton = document.getElementById("planet-pause-button");
const planetResetButton = document.getElementById("planet-reset-button");
const planetCanvas = document.getElementById("planet-canvas");
const planetHintEl = document.getElementById("planet-hint");
const planetVictoryEl = document.getElementById("planet-victory");
const planetTimelineEl = document.getElementById("planet-timeline");
const planetEraClockEl = document.getElementById("planet-era-clock");
const planetEraNameEl = document.getElementById("planet-era-name");
const planetOverlayEl = document.getElementById("planet-overlay");
const planetOverlayTitleEl = document.getElementById("planet-overlay-title");
const planetOverlayBodyEl = document.getElementById("planet-overlay-body");
const planetTimelineSteps = planetTimelineEl
  ? Array.from(planetTimelineEl.querySelectorAll(".planet-timeline-step"))
  : [];
const mgmtDayEl = document.getElementById("mgmt-day");
const mgmtBalanceEl = document.getElementById("mgmt-balance");
const mgmtCustomersEl = document.getElementById("mgmt-customers");
const mgmtServeButton = document.getElementById("mgmt-serve-button");
const mgmtResetButton = document.getElementById("mgmt-reset-button");
const mgmtStockListEl = document.getElementById("mgmt-stock-list");
const mgmtMenuListEl = document.getElementById("mgmt-menu-list");
const mgmtLogListEl = document.getElementById("mgmt-log-list");
const solitaireMovesEl = document.getElementById("solitaire-moves");
const solitaireTimeEl = document.getElementById("solitaire-time");
const solitaireStockEl = document.getElementById("solitaire-stock");
const solitaireRestartButton = document.getElementById("solitaire-restart-button");
const solitaireStockPileEl = document.getElementById("solitaire-stock-pile");
const solitaireWastePileEl = document.getElementById("solitaire-waste-pile");
const solitaireFoundationsEl = document.getElementById("solitaire-foundations");
const solitaireTableauEl = document.getElementById("solitaire-tableau");
const solitaireWinMessageEl = document.getElementById("solitaire-win-message");

const appEndpoint = new URL("/app.xcg", window.location.origin);

let currentLanguage = loadLanguage();
let selectedGame = gameFromLocationPath(window.location.pathname) || DEFAULT_GAME;
let currentDifficulty = DEFAULT_DIFFICULTY;
let currentState = null;
let binaryState = null;
let isGameLoading = false;
let hasLoadedMinesweeper = false;
let hasLoadedBinary = false;
let minesTransientMessage = null;
let binaryTransientMessage = null;
let binarySelectedSymbol = DEFAULT_BINARY_SYMBOL;
let binarySelectedDuration = DEFAULT_BINARY_DURATION;
let binaryTickInterval = null;
let binaryGame = null;
let fishingState = createInitialFishingState();
let planetBodies = [];
let planetSupernovaFlashes = [];
let planetParticles = [];
let planetRunning = false;
let planetAnimFrame = null;
let planetCtx = null;
let planetResizeFrame = null;
let planetPausedByUser = false;
let planetPhase = 0;
let planetMotesPlaced = 0;
let planetSupernovas = 0;
let planetOverlayTimer = null;
let planetOverlayShownPhase = -1;
// Camera state: world-to-canvas transform that lets the supernova phase
// dolly in on the surviving star so several orbits fit comfortably.
let planetCamX = 0;
let planetCamY = 0;
let planetCamZoom = 1;
let planetCamTargetX = 0;
let planetCamTargetY = 0;
let planetCamTargetZoom = 1;
let mgmtState = null;
let solitaireState = null;
let solitaireTimerInterval = null;

applyTranslations();
syncDifficultyButtons();
// Defer the initial render until the rest of the module has finished
// executing. renderGameShell() can call into renderPlanetToolbar, which
// reaches for planet sim constants declared later in this file. If we
// rendered synchronously here, those `const`s would still be in the
// temporal dead zone and the call would throw, which left clicks dead.
queueMicrotask(() => {
  renderGameShell();
  maybeAutoLoadSelectedGame();
});
initLogoScene();

// Debug hook for end-to-end probes (Playwright). Returns a snapshot of the
// planet sim's current bodies and camera so a test can drive the new stage
// machine without reading pixels. Intentionally read-only.
window.__planetDebug = () => ({
  phase: planetPhase,
  motesPlaced: planetMotesPlaced,
  supernovas: planetSupernovas,
  cam: { x: planetCamX, y: planetCamY, zoom: planetCamZoom },
  canvas: { w: planetCanvas.width, h: planetCanvas.height },
  bodies: planetBodies.map((b) => ({
    type: b.type,
    x: b.x,
    y: b.y,
    mass: b.mass,
    radius: b.radius,
    state: b.state,
    stage: b.stage,
    stageTime: b.stageTime,
    habitableTime: b.habitableTime,
    aliveTime: b.aliveTime,
    ring: b.ring
      ? {
          radius: b.ring.radius,
          inHitZone: b.ring.inHitZone,
          hits: b.ring.hits,
          cycleProgress: b.ring.cycleProgress,
        }
      : null,
  })),
});

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

window.addEventListener("popstate", () => {
  const fromUrl = gameFromLocationPath(window.location.pathname);
  const target = fromUrl || DEFAULT_GAME;
  if (target !== selectedGame) {
    selectGame(target, { skipUrl: true });
  }
});

difficultyButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    currentDifficulty = button.dataset.difficulty || DEFAULT_DIFFICULTY;
    syncDifficultyButtons();
    if (selectedGame === "minesweeper" && hasLoadedMinesweeper) {
      try {
        await loadMinesweeper();
      } catch (error) {
        showMinesError(error);
      }
    } else {
      renderGameShell();
    }
  });
});

restartButton.addEventListener("click", async () => {
  if (selectedGame !== "minesweeper") {
    return;
  }
  try {
    await loadMinesweeper();
  } catch (error) {
    showMinesError(error);
  }
});

binaryStakeInput.addEventListener("change", () => {
  normalizeStakeInput();
  renderBinaryControls();
});

binaryStakeInput.addEventListener("blur", () => {
  normalizeStakeInput();
  renderBinaryControls();
});

binaryUpButton.addEventListener("click", () => {
  try {
    placeBinaryDecision("up");
  } catch (error) {
    showBinaryError(error);
  }
});

binaryDownButton.addEventListener("click", () => {
  try {
    placeBinaryDecision("down");
  } catch (error) {
    showBinaryError(error);
  }
});

binaryStartButton.addEventListener("click", () => {
  try {
    restartBinaryGame();
  } catch (error) {
    showBinaryError(error);
  }
});

fishingScanButton.addEventListener("click", () => {
  void runFishingScan();
});

fishingGoButton.addEventListener("click", () => {
  lockFishingTarget();
});

fishingSearchButton.addEventListener("click", () => {
  void runFishingScan(true);
});

planetCanvas.addEventListener("click", (e) => {
  if (selectedGame !== "planet") return;
  if (!planetCtx) initPlanetCanvas();
  if (planetPhase === PLANET_PHASE_VICTORY) return;
  const rect = planetCanvas.getBoundingClientRect();
  const scaleX = planetCanvas.width / rect.width;
  const scaleY = planetCanvas.height / rect.height;
  const px = (e.clientX - rect.left) * scaleX;
  const py = (e.clientY - rect.top) * scaleY;
  // Reverse the camera transform so clicks land on the same point in world
  // space the user sees on screen.
  const world = planetCanvasToWorld(px, py);
  const x = world.x;
  const y = world.y;

  let acted = false;
  if (planetPhase === PLANET_PHASE_INFLATION || planetPhase === PLANET_PHASE_STARS) {
    if (planetBodies.length < PLANET_MAX_BODIES) {
      planetBodies.push(createPlanetBody(x, y, "mote"));
      planetMotesPlaced += 1;
      acted = true;
    }
  } else if (planetPhase === PLANET_PHASE_SUPERNOVA) {
    const star = findPlanetBodyAt(x, y, "star");
    if (star) {
      acted = triggerPlanetSupernova(star);
    }
  } else if (planetPhase === PLANET_PHASE_PLANETS) {
    // Click during a planet's "ring overlap" window scores a hit. Three
    // timed hits walk the world from barren → volcanic → ocean → alive,
    // and the third hit clears the game. Clicks that miss the window
    // still register (visual flash) but don't count.
    const existing = findPlanetBodyAt(x, y, "planet");
    if (existing) {
      acted = tryHitPlanetRing(existing);
    } else if (planetBodies.length < PLANET_MAX_BODIES) {
      planetBodies.push(createPlanetBody(x, y, "planet"));
      acted = true;
    }
  }

  if (acted) {
    planetPausedByUser = false;
    if (!planetRunning) startPlanetLoop();
    maybeAdvancePlanetPhase();
    renderPlanetToolbar();
  }
});

planetPauseButton.addEventListener("click", () => {
  if (planetRunning) {
    stopPlanetLoop();
    planetPausedByUser = true;
  } else if (planetBodies.length > 0) {
    planetPausedByUser = false;
    startPlanetLoop();
  }
  renderPlanetToolbar();
});

planetResetButton.addEventListener("click", () => {
  stopPlanetLoop();
  planetBodies = [];
  planetSupernovaFlashes = [];
  planetParticles = [];
  planetPhase = PLANET_PHASE_INFLATION;
  planetMotesPlaced = 0;
  planetSupernovas = 0;
  planetPausedByUser = false;
  planetOverlayShownPhase = -1;
  hidePlanetIntroOverlay();
  resetPlanetCamera();
  if (planetCtx) {
    planetCtx.fillStyle = "rgb(3, 8, 20)";
    planetCtx.fillRect(0, 0, planetCanvas.width, planetCanvas.height);
  }
  renderPlanetToolbar();
});

mgmtServeButton.addEventListener("click", () => {
  if (mgmtState) mgmtServeDay();
});

mgmtResetButton.addEventListener("click", () => {
  mgmtState = createInitialMgmtState();
  renderMgmtPanel();
  renderMgmtToolbar();
});

solitaireRestartButton.addEventListener("click", () => {
  newSolitaireGame();
});

window.addEventListener("resize", () => {
  if (selectedGame !== "planet") {
    return;
  }
  if (planetResizeFrame) {
    cancelAnimationFrame(planetResizeFrame);
  }
  planetResizeFrame = requestAnimationFrame(() => {
    planetResizeFrame = null;
    resizePlanetCanvas();
  });
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

function getBinaryNotice(code) {
  if (code === "binaryAwaitingStart") {
    return currentLanguage === "ja"
      ? "PAIR を選んで開始を押すまで、ケースは静止したままです。"
      : "The case stays still until you choose a pair and press Start.";
  }
  return currentCopy().binaryNoticeCodes[code] || code;
}

function getErrorText(message) {
  if (message === "binary case not started") {
    return currentLanguage === "ja" ? "開始を押してから取引してください。" : "Press Start before placing a trade.";
  }
  return currentCopy().errors[message] || message || currentCopy().errors["Request failed"];
}

function template(text, values) {
  return text.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""));
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
    const value = getText(key);
    if (value == null) {
      return;
    }
    if (attr) {
      node.setAttribute(attr, value);
    } else {
      node.textContent = value;
    }
  });

  languageButtons.forEach((button) => {
    const isActive = button.dataset.languageOption === currentLanguage;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function selectGame(gameId, options = {}) {
  if (selectedGame === "planet" && gameId !== "planet") {
    stopPlanetLoop();
  }
  if (selectedGame === "solitaire" && gameId !== "solitaire" && solitaireTimerInterval) {
    clearInterval(solitaireTimerInterval);
    solitaireTimerInterval = null;
  }
  selectedGame = GAME_LIBRARY[gameId] ? gameId : DEFAULT_GAME;
  minesTransientMessage = null;
  binaryTransientMessage = null;
  if (selectedGame !== "binary") {
    stopBinaryTick();
  }
  if (!options.skipUrl) {
    pushGameUrl(selectedGame);
  }
  renderGameShell();
  maybeAutoLoadSelectedGame();
}

function maybeAutoLoadSelectedGame() {
  if (isGameLoading) {
    return;
  }

  if (selectedGame === "minesweeper" && !hasLoadedMinesweeper) {
    void loadMinesweeper().catch(showMinesError);
    return;
  }

  if (selectedGame === "binary" && !hasLoadedBinary) {
    void loadBinaryState().catch(showBinaryError);
    return;
  }

  if (selectedGame === "binary" && hasLoadedBinary) {
    startBinaryTick();
    return;
  }
}

function renderGameShell() {
  const gameCopy = currentCopy().games[selectedGame];
  const libraryEntry = GAME_LIBRARY[selectedGame];
  const isPlayable = Boolean(libraryEntry && libraryEntry.available);
  const isMinesweeper = selectedGame === "minesweeper";
  const isBinary = selectedGame === "binary";
  const isFishing = selectedGame === "fishing";
  const isPlanet = selectedGame === "planet";
  const isManagement = selectedGame === "management";
  const isSolitaire = selectedGame === "solitaire";

  selectedGameTitle.textContent = gameCopy.panelTitle;
  selectedGameCopy.textContent = gameCopy.panelBody;
  selectedGameBadge.textContent = gameCopy.badge;
  selectedGameBadge.className = `game-chip ${isPlayable ? "live" : "soon"}`;

  gameButtons.forEach((button) => {
    const isSelected = button.dataset.gameSelect === selectedGame;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  });

  minesToolbar.hidden = !isMinesweeper;
  binaryToolbar.hidden = !isBinary;
  fishingToolbar.hidden = !isFishing;
  planetToolbar.hidden = !isPlanet;
  mgmtToolbar.hidden = !isManagement;
  solitaireToolbar.hidden = !isSolitaire;
  difficultyCluster.hidden = !isMinesweeper;
  restartButton.hidden = !isMinesweeper;
  restartButton.disabled = isGameLoading || !hasLoadedMinesweeper;

  syncDifficultyButtons();

  if (!isPlayable) {
    stopBinaryTick();
    gameLoading.hidden = true;
    boardWrap.hidden = true;
    binaryPanel.hidden = true;
    fishingPanel.hidden = true;
    planetPanel.hidden = true;
    mgmtPanel.hidden = true;
    solitairePanel.hidden = true;
    gamePlaceholder.hidden = false;
    renderPlaceholder(gameCopy.promptTitle, gameCopy.promptBody);
    renderIdleStats();
    return;
  }

  if (isFishing) {
    stopBinaryTick();
    gamePlaceholder.hidden = true;
    gameLoading.hidden = true;
    boardWrap.hidden = true;
    binaryPanel.hidden = true;
    fishingPanel.hidden = false;
    planetPanel.hidden = true;
    mgmtPanel.hidden = true;
    solitairePanel.hidden = true;
    renderFishingPanel();
    return;
  }

  if (isPlanet) {
    stopBinaryTick();
    gamePlaceholder.hidden = true;
    gameLoading.hidden = true;
    boardWrap.hidden = true;
    binaryPanel.hidden = true;
    fishingPanel.hidden = true;
    planetPanel.hidden = false;
    mgmtPanel.hidden = true;
    solitairePanel.hidden = true;
    requestAnimationFrame(() => {
      initPlanetCanvas();
      if (planetBodies.length > 0 && !planetRunning && !planetPausedByUser) {
        startPlanetLoop();
      } else if (!planetRunning) {
        drawPlanets();
      }
    });
    renderPlanetToolbar();
    return;
  }

  if (isManagement) {
    stopBinaryTick();
    gamePlaceholder.hidden = true;
    gameLoading.hidden = true;
    boardWrap.hidden = true;
    binaryPanel.hidden = true;
    fishingPanel.hidden = true;
    planetPanel.hidden = true;
    mgmtPanel.hidden = false;
    solitairePanel.hidden = true;
    if (!mgmtState) {
      mgmtState = createInitialMgmtState();
    }
    renderMgmtPanel();
    renderMgmtToolbar();
    return;
  }

  if (isSolitaire) {
    stopBinaryTick();
    gamePlaceholder.hidden = true;
    gameLoading.hidden = true;
    boardWrap.hidden = true;
    binaryPanel.hidden = true;
    fishingPanel.hidden = true;
    planetPanel.hidden = true;
    mgmtPanel.hidden = true;
    solitairePanel.hidden = false;
    if (!solitaireState) {
      newSolitaireGame();
    } else {
      renderSolitairePanel();
      renderSolitaireToolbar();
      if (!solitaireTimerInterval && !solitaireState.won) {
        solitaireTimerInterval = setInterval(renderSolitaireToolbar, 1000);
      }
    }
    return;
  }

  if (isGameLoading) {
    stopBinaryTick();
    gamePlaceholder.hidden = true;
    gameLoading.hidden = false;
    boardWrap.hidden = true;
    binaryPanel.hidden = true;
    fishingPanel.hidden = true;
    planetPanel.hidden = true;
    mgmtPanel.hidden = true;
    solitairePanel.hidden = true;
    renderIdleStats();
    return;
  }

  gameLoading.hidden = true;

  if (isMinesweeper && hasLoadedMinesweeper && currentState) {
    stopBinaryTick();
    gamePlaceholder.hidden = true;
    boardWrap.hidden = false;
    binaryPanel.hidden = true;
    fishingPanel.hidden = true;
    planetPanel.hidden = true;
    mgmtPanel.hidden = true;
    solitairePanel.hidden = true;
    renderMinesweeper();
    return;
  }

  if (isBinary && hasLoadedBinary && binaryState) {
    gamePlaceholder.hidden = true;
    boardWrap.hidden = true;
    binaryPanel.hidden = false;
    fishingPanel.hidden = true;
    planetPanel.hidden = true;
    mgmtPanel.hidden = true;
    solitairePanel.hidden = true;
    renderBinaryPanel();
    return;
  }

  gamePlaceholder.hidden = false;
  boardWrap.hidden = true;
  binaryPanel.hidden = true;
  fishingPanel.hidden = true;
  planetPanel.hidden = true;
  mgmtPanel.hidden = true;
  solitairePanel.hidden = true;
  stopBinaryTick();
  renderPlaceholder(
    gameCopy.promptTitle,
    isMinesweeper && minesTransientMessage
      ? getErrorText(minesTransientMessage)
      : isBinary && binaryTransientMessage
        ? getErrorText(binaryTransientMessage)
        : gameCopy.promptBody,
  );

  if (isBinary) {
    renderBinarySummary();
  } else {
    renderIdleStats();
  }
}

function renderPlaceholder(title, copy) {
  const cardThumb = document.querySelector(`[data-game-select="${selectedGame}"] .thumb`);
  gamePlaceholderThumb.replaceChildren();
  if (cardThumb) {
    gamePlaceholderThumb.appendChild(cardThumb.cloneNode(true));
  }
  gamePlaceholderTitle.textContent = title;
  gamePlaceholderCopy.textContent = copy;
}

function renderIdleStats() {
  statusElement.textContent = minesTransientMessage
    ? getErrorText(minesTransientMessage)
    : getText("gameIdleStatus");
  flagsElement.textContent = "0";
  clearedElement.textContent = "0/0";
}

function createInitialFishingState() {
  return {
    status: "idle",
    sweeps: 0,
    decision: "standby",
    detection: null,
    log: [],
  };
}

async function runFishingScan(forceNewZone = false) {
  if (fishingState.status === "scanning") {
    return;
  }

  fishingState = {
    ...fishingState,
    status: "scanning",
    decision: "scanning",
  };
  renderGameShell();

  await sleep(FISHING_SCAN_MS);

  const detection = generateFishingDetection(forceNewZone);
  fishingState = {
    ...fishingState,
    status: "detected",
    sweeps: fishingState.sweeps + 1,
    decision: "pending",
    detection,
    log: [
      {
        id: `${Date.now()}-${fishingState.sweeps + 1}`,
        zoneId: detection.zoneId,
        signalLevel: detection.signalLevel,
        distanceKm: detection.distanceKm,
      },
      ...fishingState.log,
    ].slice(0, 5),
  };
  renderGameShell();
}

function lockFishingTarget() {
  if (!fishingState.detection || fishingState.status === "scanning") {
    return;
  }

  fishingState = {
    ...fishingState,
    status: "committed",
    decision: "go",
  };
  renderGameShell();
}

function generateFishingDetection(forceNewZone) {
  const currentZoneId = fishingState.detection?.zoneId || null;
  const availableZones = forceNewZone
    ? FISHING_ZONES.filter((zone) => zone.id !== currentZoneId)
    : FISHING_ZONES;
  const zonePool = availableZones.length > 0 ? availableZones : FISHING_ZONES;
  const zone = zonePool[Math.floor(Math.random() * zonePool.length)];
  const signalLevel = rollFishingSignalLevel();
  const distanceKm = Number((0.8 + (Math.random() * 4.4)).toFixed(1));

  return {
    zoneId: zone.id,
    signalLevel,
    distanceKm,
    blips: createFishingBlips(signalLevel),
  };
}

function rollFishingSignalLevel() {
  const roll = Math.random();
  if (roll < 0.08) {
    return 5;
  }
  if (roll < 0.24) {
    return 4;
  }
  if (roll < 0.56) {
    return 3;
  }
  if (roll < 0.82) {
    return 2;
  }
  return 1;
}

function createFishingBlips(signalLevel) {
  const countMap = { 1: 2, 2: 4, 3: 6, 4: 8, 5: 11 };
  const clusterAngle = Math.random() * Math.PI * 2;
  const clusterRadius = 14 + (Math.random() * 20);
  const clusterX = 50 + (Math.cos(clusterAngle) * clusterRadius);
  const clusterY = 50 + (Math.sin(clusterAngle) * clusterRadius);
  const count = countMap[signalLevel] || 3;

  return Array.from({ length: count }, () => {
    const offsetAngle = Math.random() * Math.PI * 2;
    const offsetRadius = Math.random() * (8 + (signalLevel * 2));
    const x = clamp(clusterX + (Math.cos(offsetAngle) * offsetRadius), 12, 88);
    const y = clamp(clusterY + (Math.sin(offsetAngle) * offsetRadius), 12, 88);
    return {
      x,
      y,
      size: 7 + signalLevel + (Math.random() * 5),
      alpha: 0.4 + (signalLevel * 0.08) + (Math.random() * 0.16),
    };
  });
}

function renderFishingPanel() {
  const isScanning = fishingState.status === "scanning";
  const detection = fishingState.detection;
  const signalLevel = detection?.signalLevel || 0;
  const zoneLabel = detection ? getFishingZoneLabel(detection.zoneId) : "";

  fishingSweeps.textContent = formatInteger(fishingState.sweeps);
  fishingSignal.textContent = isScanning
    ? getText("fishingStatusScanning")
    : signalLevel
      ? getFishingSignalLabel(signalLevel)
      : getText("fishingSignalNone");
  fishingDecision.textContent = getFishingDecisionLabel();
  fishingScanButton.disabled = isScanning;
  fishingGoButton.disabled = isScanning || !detection;
  fishingSearchButton.disabled = isScanning || !detection;

  if (isScanning) {
    fishingPanelCopy.textContent = getText("fishingStatusCopyScanning");
    fishingTargetTitle.textContent = getText("fishingTargetPending");
    fishingTargetMeta.textContent = getText("fishingControlDecision");
  } else if (detection) {
    fishingTargetTitle.textContent = zoneLabel;
    fishingTargetMeta.textContent = template(getText("fishingTargetTemplate"), {
      zone: zoneLabel,
      distance: formatDistanceKm(detection.distanceKm),
      signal: getFishingSignalLabel(signalLevel),
    });
    fishingPanelCopy.textContent =
      fishingState.status === "committed"
        ? getText("fishingStatusCopyCommitted")
        : getText("fishingStatusCopyDetected");
  } else {
    fishingPanelCopy.textContent = getText("fishingStatusCopyIdle");
    fishingTargetTitle.textContent = getText("fishingTargetNone");
    fishingTargetMeta.textContent = getText("fishingControlScan");
  }

  if (fishingState.status === "committed") {
    fishingTargetMeta.textContent = `${fishingTargetMeta.textContent}  ${getText("fishingTargetCommitted")}`;
  }

  fishingSonarStage.classList.toggle("is-scanning", isScanning);
  fishingSonarStage.classList.toggle("has-target", Boolean(detection));
  fishingSonarStage.classList.toggle("is-committed", fishingState.status === "committed");

  renderFishingSignalScale();
  renderFishingSonarBlips();
  renderFishingLog();
}

function renderFishingSignalScale() {
  fishingSignalScale.replaceChildren();
  [5, 4, 3, 2, 1].forEach((level) => {
    const item = document.createElement("li");
    item.className = "fishing-signal-item";
    if (fishingState.detection?.signalLevel === level) {
      item.classList.add("is-active");
    }

    const rank = document.createElement("span");
    rank.className = "fishing-signal-rank";
    rank.textContent = String(level).padStart(2, "0");

    const bar = document.createElement("div");
    bar.className = "fishing-signal-bar";
    const fill = document.createElement("span");
    fill.style.width = `${level * 20}%`;
    bar.appendChild(fill);

    const label = document.createElement("strong");
    label.textContent = getFishingSignalLabel(level);

    item.append(rank, bar, label);
    fishingSignalScale.appendChild(item);
  });
}

function renderFishingSonarBlips() {
  fishingSonarBlips.replaceChildren();

  if (fishingState.status === "scanning") {
    for (let index = 0; index < 4; index += 1) {
      const ghost = document.createElement("span");
      ghost.className = "sonar-blip is-ghost";
      ghost.style.left = `${22 + (index * 16)}%`;
      ghost.style.top = `${28 + ((index % 2) * 18)}%`;
      ghost.style.width = "10px";
      ghost.style.height = "10px";
      ghost.style.animationDelay = `${index * 180}ms`;
      fishingSonarBlips.appendChild(ghost);
    }
    return;
  }

  const blips = fishingState.detection?.blips || [];
  blips.forEach((blip, index) => {
    const node = document.createElement("span");
    node.className = "sonar-blip";
    node.style.left = `${blip.x}%`;
    node.style.top = `${blip.y}%`;
    node.style.width = `${blip.size}px`;
    node.style.height = `${blip.size}px`;
    node.style.opacity = String(blip.alpha);
    node.style.animationDelay = `${index * 140}ms`;
    fishingSonarBlips.appendChild(node);
  });
}

function renderFishingLog() {
  fishingLogList.replaceChildren();
  if (fishingState.log.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "binary-empty";
    emptyItem.textContent = getText("fishingLogEmpty");
    fishingLogList.appendChild(emptyItem);
    return;
  }

  fishingState.log.forEach((entry, index) => {
    const item = document.createElement("li");

    const top = document.createElement("div");
    top.className = "fishing-log-top";

    const zone = document.createElement("strong");
    zone.textContent = getFishingZoneLabel(entry.zoneId);

    const signal = document.createElement("span");
    signal.className = "fishing-log-signal";
    signal.textContent = getFishingSignalLabel(entry.signalLevel);

    top.append(zone, signal);

    const bottom = document.createElement("div");
    bottom.className = "fishing-log-bottom";
    bottom.textContent = `#${String(fishingState.sweeps - index).padStart(2, "0")} / ${formatDistanceKm(entry.distanceKm)} km`;

    item.append(top, bottom);
    fishingLogList.appendChild(item);
  });
}

// ── Planet Simulation ──────────────────────────────────────────────────────

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
const STARS_PHASE_TARGET = 1;
const SUPERNOVA_TARGET = 1;
const ASTEROID_HABITABLE_BONUS = 1.6;
const ASTEROID_TO_PLANET_MASS = 7;
const LIFE_DURATION_TARGET = 5;

// Planet evolution stages. The ring rhythm carries the player from
// barren → volcanic → ocean → alive over three timed hits.
const PLANET_STAGE_BARREN = 0;
const PLANET_STAGE_VOLCANIC = 1;
const PLANET_STAGE_OCEAN = 2;
const PLANET_STAGE_LIFE = 3;
const PLANET_RING_HITS_TARGET = 3;
const PLANET_RING_CYCLE_SEC = 2.5; // outer→inner contraction time
const PLANET_RING_OUTER_MULT = 4.5;
const PLANET_RING_INNER_MULT = 0.55;
const PLANET_RING_TOLERANCE_MULT = 1.5; // generous timing window — "判定はゆるく"

const PLANET_TYPE_PRIORITY = { star: 5, planet: 4, gas: 3, asteroid: 2, mote: 1 };
const PLANET_TYPES = {
  mote: {
    massBase: 12,
    massVariance: 8,
    radiusFactor: 2.0,
    minRadius: 2,
    speedRange: [4, 14],
    trailColor: "rgba(220, 220, 255, 0.16)",
  },
  gas: {
    massBase: 25,
    massVariance: 15,
    radiusFactor: 3.6,
    minRadius: 4,
    speedRange: [0, 0],
    trailColor: "rgba(180, 200, 255, 0.20)",
  },
  star: {
    massBase: 240,
    massVariance: 100,
    radiusFactor: 2.6,
    minRadius: 10,
    speedRange: [0, 3],
    trailColor: "rgba(255, 210, 130, 0.18)",
  },
  planet: {
    massBase: 8,
    massVariance: 6,
    radiusFactor: 4.5,
    minRadius: 5,
    speedRange: [13, 22],
    trailColor: "rgba(120, 190, 255, 0.22)",
  },
  asteroid: {
    massBase: 3,
    massVariance: 2,
    radiusFactor: 4.0,
    minRadius: 4,
    speedRange: [40, 70],
    trailColor: "rgba(200, 170, 130, 0.22)",
  },
};

const PLANET_HEAT_FROZEN = 0.2;
const PLANET_HEAT_HOT = 5.5;
const PLANET_LIFE_DELAY = 3.0;

function initPlanetCanvas() {
  if (!planetCtx) {
    planetCtx = planetCanvas.getContext("2d");
  }
  resizePlanetCanvas(true);
  // Centre the camera on the canvas centre at 1x zoom whenever we (re)init.
  const cw = planetCanvas.width || 600;
  const ch = planetCanvas.height || 400;
  planetCamX = cw / 2;
  planetCamY = ch / 2;
  planetCamZoom = 1;
  planetCamTargetX = planetCamX;
  planetCamTargetY = planetCamY;
  planetCamTargetZoom = planetCamZoom;
}

function startPlanetCameraZoom(targetX, targetY, zoom) {
  planetCamTargetX = targetX;
  planetCamTargetY = targetY;
  planetCamTargetZoom = zoom;
}

function resetPlanetCamera() {
  const cw = planetCanvas.width || 600;
  const ch = planetCanvas.height || 400;
  planetCamX = cw / 2;
  planetCamY = ch / 2;
  planetCamZoom = 1;
  planetCamTargetX = planetCamX;
  planetCamTargetY = planetCamY;
  planetCamTargetZoom = 1;
}

function stepPlanetCamera(dt) {
  // Critically-damped-ish lerp toward the target.
  const k = Math.min(1, dt * 3.5);
  planetCamX += (planetCamTargetX - planetCamX) * k;
  planetCamY += (planetCamTargetY - planetCamY) * k;
  planetCamZoom += (planetCamTargetZoom - planetCamZoom) * k;
}

function planetCanvasToWorld(px, py) {
  const cw = planetCanvas.width || 600;
  const ch = planetCanvas.height || 400;
  return {
    x: (px - cw / 2) / planetCamZoom + planetCamX,
    y: (py - ch / 2) / planetCamZoom + planetCamY,
  };
}

function resizePlanetCanvas(force = false) {
  if (!planetCtx) {
    return;
  }
  const w = Math.max(planetCanvas.offsetWidth, 300);
  const h = Math.max(planetCanvas.offsetHeight, 300);
  const prevW = planetCanvas.width || w;
  const prevH = planetCanvas.height || h;
  if (!force && prevW === w && prevH === h) {
    return;
  }
  planetCanvas.width = w;
  planetCanvas.height = h;

  if (planetBodies.length > 0 && prevW > 0 && prevH > 0) {
    const scaleX = w / prevW;
    const scaleY = h / prevH;
    for (const body of planetBodies) {
      body.x *= scaleX;
      body.y *= scaleY;
      body.trail = body.trail.map((point) => ({
        x: point.x * scaleX,
        y: point.y * scaleY,
      }));
    }
  }

  planetCtx.fillStyle = "rgb(3, 8, 20)";
  planetCtx.fillRect(0, 0, w, h);
  if (!planetRunning) {
    drawPlanets();
  }
}

function spawnVolcanicBurst(planet) {
  const n = 14 + Math.floor(Math.random() * 6);
  for (let i = 0; i < n; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 35 + Math.random() * 35;
    const r = planet.radius * (0.85 + Math.random() * 0.15);
    planetParticles.push({
      kind: "volcanic",
      x: planet.x + Math.cos(angle) * r,
      y: planet.y + Math.sin(angle) * r,
      vx: planet.vx + Math.cos(angle) * speed,
      vy: planet.vy + Math.sin(angle) * speed,
      life: 1.1 + Math.random() * 0.7,
      age: 0,
      size: 1.4 + Math.random() * 1.6,
    });
  }
}

function spawnLifeBurst(planet) {
  const n = 30 + Math.floor(Math.random() * 8);
  for (let i = 0; i < n; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 28 + Math.random() * 22;
    const r = planet.radius * (1.0 + Math.random() * 0.4);
    planetParticles.push({
      kind: "life",
      x: planet.x + Math.cos(angle) * r,
      y: planet.y + Math.sin(angle) * r,
      vx: planet.vx + Math.cos(angle) * speed * 0.6,
      vy: planet.vy + Math.sin(angle) * speed * 0.6,
      life: 1.6 + Math.random() * 0.8,
      age: 0,
      size: 1.0 + Math.random() * 1.2,
    });
  }
}

function spawnRainBurst(planet) {
  const n = 24 + Math.floor(Math.random() * 8);
  for (let i = 0; i < n; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = planet.radius * (1.8 + Math.random() * 0.7);
    const fallSpeed = 18 + Math.random() * 14;
    planetParticles.push({
      kind: "rain",
      x: planet.x + Math.cos(angle) * r,
      y: planet.y + Math.sin(angle) * r,
      vx: planet.vx - Math.cos(angle) * fallSpeed * 0.4,
      vy: planet.vy - Math.sin(angle) * fallSpeed * 0.4,
      life: r / Math.max(8, fallSpeed),
      age: 0,
      size: 0.9 + Math.random() * 0.8,
      planet,
    });
  }
}

function stepPlanetParticles(dt) {
  // Continuous emission: lava sparks while volcanic, rain drops while in
  // ocean stage (until life takes hold so the rain visually stops).
  for (const body of planetBodies) {
    if (body.type !== "planet") continue;
    if (body.stage === PLANET_STAGE_VOLCANIC) {
      if (Math.random() < 0.55) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 22 + Math.random() * 28;
        const r = body.radius * (0.85 + Math.random() * 0.15);
        planetParticles.push({
          kind: "volcanic",
          x: body.x + Math.cos(angle) * r,
          y: body.y + Math.sin(angle) * r,
          vx: body.vx + Math.cos(angle) * speed,
          vy: body.vy + Math.sin(angle) * speed,
          life: 0.9 + Math.random() * 0.5,
          age: 0,
          size: 1.2 + Math.random() * 1.2,
        });
      }
    } else if (body.stage === PLANET_STAGE_OCEAN && body.state !== "alive") {
      if (Math.random() < 0.6) {
        const angle = Math.random() * Math.PI * 2;
        const startR = body.radius * (1.7 + Math.random() * 0.6);
        const fallSpeed = 14 + Math.random() * 10;
        planetParticles.push({
          kind: "rain",
          x: body.x + Math.cos(angle) * startR,
          y: body.y + Math.sin(angle) * startR,
          vx: body.vx - Math.cos(angle) * fallSpeed,
          vy: body.vy - Math.sin(angle) * fallSpeed,
          life: (startR - body.radius) / Math.max(8, fallSpeed),
          age: 0,
          size: 0.8 + Math.random() * 0.7,
          planet: body,
        });
      }
    }
  }
  for (const p of planetParticles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.age += dt;
    if (p.kind === "volcanic") {
      // gentle drag so sparks slow down before they fade
      p.vx *= 0.985;
      p.vy *= 0.985;
    }
  }
  if (planetParticles.length > 800) {
    // Cap to avoid runaway memory if the player camps on a stage.
    planetParticles.splice(0, planetParticles.length - 800);
  }
  planetParticles = planetParticles.filter((p) => p.age < p.life);
}

function drawPlanetParticles(ctx) {
  for (const p of planetParticles) {
    const t = 1 - p.age / p.life;
    if (t <= 0) continue;
    if (p.kind === "volcanic") {
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2.2);
      grad.addColorStop(0, `hsla(28, 100%, 70%, ${0.85 * t})`);
      grad.addColorStop(0.6, `hsla(10, 100%, 55%, ${0.45 * t})`);
      grad.addColorStop(1, "rgba(80, 20, 0, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 2.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === "rain") {
      ctx.fillStyle = `hsla(210, 100%, 80%, ${0.78 * t})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === "life") {
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2.4);
      grad.addColorStop(0, `hsla(140, 100%, 80%, ${0.95 * t})`);
      grad.addColorStop(0.55, `hsla(160, 100%, 60%, ${0.55 * t})`);
      grad.addColorStop(1, "rgba(40, 100, 60, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function planetRadiusFor(type, mass) {
  const config = PLANET_TYPES[type] || PLANET_TYPES.planet;
  const minR = config.minRadius != null ? config.minRadius : 3;
  return Math.max(minR, Math.cbrt(Math.max(0.05, mass)) * config.radiusFactor);
}

function planetHueFor(type) {
  if (type === "star") return 30 + Math.random() * 25;
  if (type === "asteroid") return 28 + Math.random() * 18;
  if (type === "gas") return 200 + Math.random() * 30;
  if (type === "mote") return 210 + Math.random() * 50;
  return 210;
}

function createPlanetBody(x, y, typeKey) {
  const type = PLANET_TYPES[typeKey] ? typeKey : "mote";
  const config = PLANET_TYPES[type];
  const mass = config.massBase + Math.random() * config.massVariance;
  const cx = (planetCanvas.width || 600) / 2;
  const cy = (planetCanvas.height || 400) / 2;
  const dx = x - cx;
  const dy = y - cy;
  const r = Math.hypot(dx, dy);
  const [minSpeed, maxSpeed] = config.speedRange;
  const speed = minSpeed + Math.random() * Math.max(0, maxSpeed - minSpeed);

  let vx = 0;
  let vy = 0;
  if (type === "planet") {
    let anchorX = cx;
    let anchorY = cy;
    let anchorMass = 0;
    let nearestStar = null;
    let nearestD2 = Infinity;
    for (const body of planetBodies) {
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
    const angle = Math.atan2(ady, adx) + Math.PI / 2 + (Math.random() - 0.5) * 0.18;
    let orbitSpeed = speed;
    if (anchorMass > 0 && ar > 0.5) {
      const ar2 = ar * ar;
      const v2 = (PLANET_G * anchorMass * ar) / (ar2 + PLANET_SOFTENING);
      orbitSpeed = Math.sqrt(Math.max(0, v2)) * (0.96 + Math.random() * 0.06);
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
    // Drift each mote gently toward the canvas center so scattered clicks
    // converge into a clump that can collapse into a star (gravitational
    // instability). Without this, motes fly outward and never coalesce.
    const baseAngle = r > 0.5 ? Math.atan2(dy, dx) + Math.PI : Math.random() * Math.PI * 2;
    const angle = baseAngle + (Math.random() - 0.5) * 0.8;
    const driftSpeed = speed * 0.6;
    vx = Math.cos(angle) * driftSpeed;
    vy = Math.sin(angle) * driftSpeed;
  } else if (type === "asteroid") {
    const angle = Math.random() * Math.PI * 2;
    vx = Math.cos(angle) * speed;
    vy = Math.sin(angle) * speed;
  }

  return {
    type,
    x,
    y,
    vx,
    vy,
    mass,
    radius: planetRadiusFor(type, mass),
    hue: planetHueFor(type),
    seed: Math.random(),
    pulse: Math.random() * Math.PI * 2,
    state: type === "planet" ? "barren" : null,
    stage: type === "planet" ? PLANET_STAGE_BARREN : 0,
    stageTime: 0,
    habitableTime: 0,
    aliveTime: 0,
    trailColor: config.trailColor,
    trail: [],
    flash: 0,
    ring: type === "planet" ? createPlanetRing() : null,
  };
}

function createPlanetRing() {
  return {
    cycleProgress: Math.random() * 0.4, // stagger so multiple planets aren't perfectly in sync
    radius: 0,
    inHitZone: false,
    hits: 0,
  };
}

function startPlanetLoop() {
  if (planetAnimFrame) return;
  planetRunning = true;
  let lastTime = performance.now();

  function loop(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.033);
    lastTime = now;
    stepPlanets(dt);
    stepPlanetParticles(dt);
    stepPlanetRings(dt);
    stepPlanetCamera(dt);
    drawPlanets();
    planetAnimFrame = requestAnimationFrame(loop);
  }

  planetAnimFrame = requestAnimationFrame(loop);
}

function stopPlanetLoop() {
  if (planetAnimFrame) {
    cancelAnimationFrame(planetAnimFrame);
    planetAnimFrame = null;
  }
  planetRunning = false;
}

function stepPlanets(dt) {
  const n = planetBodies.length;
  if (n === 0) return;

  const ax = new Float64Array(n);
  const ay = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = planetBodies[j].x - planetBodies[i].x;
      const dy = planetBodies[j].y - planetBodies[i].y;
      const r2 = dx * dx + dy * dy;
      const r = Math.sqrt(r2);
      if (r < 0.5) continue;
      const f = PLANET_G / (r2 + PLANET_SOFTENING);
      const fx = (f * dx) / r;
      const fy = (f * dy) / r;
      ax[i] += fx * planetBodies[j].mass;
      ay[i] += fy * planetBodies[j].mass;
      ax[j] -= fx * planetBodies[i].mass;
      ay[j] -= fy * planetBodies[i].mass;
    }
  }

  for (let i = 0; i < n; i++) {
    const body = planetBodies[i];
    // Stars are treated as fixed gravity wells: they hold their position so
    // the user always knows where the system's centre is. Other bodies still
    // feel their pull (the acceleration loop above already used star.mass).
    if (body.type !== "star") {
      body.vx += ax[i] * dt;
      body.vy += ay[i] * dt;
      body.x += body.vx * dt;
      body.y += body.vy * dt;
    } else {
      body.vx = 0;
      body.vy = 0;
    }
    body.trail.push({ x: body.x, y: body.y });
    const trailLimit = body.type === "star"
      ? 8
      : body.type === "mote"
        ? 12
        : body.type === "gas"
          ? 16
          : 28;
    if (body.trail.length > trailLimit) body.trail.shift();
    body.pulse += dt * 1.4;
    if (body.flash > 0) body.flash = Math.max(0, body.flash - dt * 2.0);
  }

  let lifeChanged = false;
  for (let i = 0; i < planetBodies.length; i++) {
    const body = planetBodies[i];
    if (body.type !== "planet") continue;
    body.stageTime = (body.stageTime || 0) + dt;
    const stage = body.stage || 0;
    const wasAlive = body.state === "alive";
    if (stage === PLANET_STAGE_BARREN) {
      // No atmosphere yet. Player must trigger volcanism by clicking.
      body.state = "barren";
      body.habitableTime = 0;
      body.aliveTime = 0;
    } else if (stage === PLANET_STAGE_VOLCANIC) {
      // Outgassing builds up the early atmosphere.
      body.state = "volcanic";
      body.habitableTime = 0;
      body.aliveTime = 0;
    } else {
      // Stage OCEAN: water has arrived, life can take hold if the orbit
      // sits in the habitable band.
      const heat = computePlanetHeat(body, planetBodies);
      if (heat < PLANET_HEAT_FROZEN) {
        body.state = "frozen";
        body.habitableTime = Math.max(0, body.habitableTime - dt * 1.5);
        body.aliveTime = Math.max(0, (body.aliveTime || 0) - dt * 0.5);
      } else if (heat > PLANET_HEAT_HOT) {
        body.state = "scorched";
        body.habitableTime = Math.max(0, body.habitableTime - dt * 1.5);
        body.aliveTime = Math.max(0, (body.aliveTime || 0) - dt * 0.5);
      } else {
        body.habitableTime += dt;
        body.state = body.habitableTime >= PLANET_LIFE_DELAY ? "alive" : "habitable";
        if (body.state === "alive") {
          body.aliveTime = (body.aliveTime || 0) + dt;
        } else if (!body.aliveTime) {
          body.aliveTime = 0;
        }
      }
    }
    if (wasAlive !== (body.state === "alive")) lifeChanged = true;
  }

  const merged = new Uint8Array(planetBodies.length);
  for (let i = 0; i < planetBodies.length; i++) {
    if (merged[i]) continue;
    for (let j = i + 1; j < planetBodies.length; j++) {
      if (merged[j]) continue;
      const a = planetBodies[i];
      const b = planetBodies[j];
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
        planetBody.flash = 1.0;
        merged[asteroidIdx] = 1;
        lifeChanged = true;
        continue;
      }

      // Once the solar system is forming, the star is treated as a fixed
      // gravity well: it never accretes anything and never absorbs the planet.
      // This keeps planet orbits stable so the player can actually clear.
      if (planetPhase >= PLANET_PHASE_PLANETS && (aIsStar || bIsStar)) {
        continue;
      }
      // Sibling planets in the same system shouldn't physically merge on
      // gameplay timescales — the merge just produces a wildly elliptical
      // orbit that swings the survivor through the scorched/frozen bands.
      if (planetPhase >= PLANET_PHASE_PLANETS && aIsPlanet && bIsPlanet) {
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
      // Asteroids that accrete enough mass become protoplanets. This is what
      // turns the supernova debris ring into a proper solar system without
      // the player needing to manually click each planet into place.
      let promotedFromAsteroid = false;
      if (resultType === "asteroid" && a.mass >= ASTEROID_TO_PLANET_MASS) {
        resultType = "planet";
        promotedFromAsteroid = true;
      }
      if (resultType !== a.type) {
        a.type = resultType;
        a.hue = planetHueFor(resultType);
        a.trailColor = PLANET_TYPES[resultType].trailColor;
      }
      a.radius = planetRadiusFor(a.type, a.mass);
      a.trail = [];
      if (a.type === "planet") {
        a.state = a.state || "barren";
        // Accreted protoplanets arrive barren — the player has to land
        // three timed ring hits to walk it from barren → life.
        if (promotedFromAsteroid) {
          a.stage = PLANET_STAGE_BARREN;
          a.stageTime = 0;
          a.habitableTime = 0;
          a.aliveTime = 0;
          a.ring = createPlanetRing();
        }
        // Re-circularise the protoplanet's orbit around the dominant star.
        // Pure mass-weighted COM velocities from accretion are usually not
        // circular, which sends new planets into wildly elliptical orbits
        // that swing through the scorched and frozen bands. A clean tangent
        // velocity at the current radius keeps the orbit livable.
        if (planetPhase >= PLANET_PHASE_PLANETS) {
          let bestStar = null;
          let bestD2 = Infinity;
          for (const body of planetBodies) {
            if (body.type !== "star") continue;
            const ddx = a.x - body.x;
            const ddy = a.y - body.y;
            const dd2 = ddx * ddx + ddy * ddy;
            if (dd2 < bestD2) {
              bestD2 = dd2;
              bestStar = body;
            }
          }
          if (bestStar) {
            const ddx = a.x - bestStar.x;
            const ddy = a.y - bestStar.y;
            const dr = Math.hypot(ddx, ddy);
            if (dr > 1) {
              const orbitV = Math.sqrt(
                (PLANET_G * bestStar.mass * dr) / (dr * dr + PLANET_SOFTENING),
              );
              const tx = -ddy / dr;
              const ty = ddx / dr;
              const radialDot = (a.vx * ddx + a.vy * ddy) / dr; // outward radial component
              const tangentDot = a.vx * tx + a.vy * ty;
              const desiredSpin = tangentDot >= 0 ? 1 : -1;
              a.vx = bestStar.vx + tx * orbitV * desiredSpin + (radialDot * 0.3) * (ddx / dr);
              a.vy = bestStar.vy + ty * orbitV * desiredSpin + (radialDot * 0.3) * (ddy / dr);
            }
          }
        }
      } else if (a.type === "star") {
        // A newborn star locks onto the canvas centre so the player has a
        // dependable anchor to orbit. Velocity is zeroed permanently.
        a.x = (planetCanvas.width || 600) / 2;
        a.y = (planetCanvas.height || 400) / 2;
        a.vx = 0;
        a.vy = 0;
        a.state = null;
        a.habitableTime = 0;
        a.aliveTime = 0;
      } else {
        a.state = null;
        a.habitableTime = 0;
        a.aliveTime = 0;
      }
      merged[j] = 1;
      lifeChanged = true;
    }
  }

  if (merged.some((v) => v)) {
    planetBodies = planetBodies.filter((_, i) => !merged[i]);
    lifeChanged = true;
  }

  const phaseAdvanced = maybeAdvancePlanetPhase();

  if (lifeChanged || phaseAdvanced) {
    renderPlanetToolbar();
  }
}

function maybeAdvancePlanetPhase() {
  if (planetPhase === PLANET_PHASE_INFLATION) {
    if (planetMotesPlaced >= INFLATION_MOTE_TARGET) {
      planetPhase = PLANET_PHASE_STARS;
      return true;
    }
  }
  if (planetPhase === PLANET_PHASE_STARS) {
    const starCount = planetBodies.filter((b) => b.type === "star").length;
    if (starCount >= STARS_PHASE_TARGET) {
      planetPhase = PLANET_PHASE_SUPERNOVA;
      return true;
    }
  }
  if (planetPhase === PLANET_PHASE_SUPERNOVA) {
    if (planetSupernovas >= SUPERNOVA_TARGET) {
      planetPhase = PLANET_PHASE_PLANETS;
      return true;
    }
  }
  if (planetPhase === PLANET_PHASE_PLANETS) {
    if (planetBodies.some((b) => b.type === "planet" && (b.aliveTime || 0) >= LIFE_DURATION_TARGET)) {
      planetPhase = PLANET_PHASE_VICTORY;
      return true;
    }
  }
  return false;
}

function triggerPlanetSupernova(star) {
  const idx = planetBodies.indexOf(star);
  if (idx < 0) return false;
  // Lock the surviving star to the canvas centre so the user can rely on a
  // fixed sun to navigate around. Other bodies will still orbit it.
  const cw = planetCanvas.width || 600;
  const ch = planetCanvas.height || 400;
  const cx = cw / 2;
  const cy = ch / 2;
  star.x = cx;
  star.y = cy;
  star.vx = 0;
  star.vy = 0;
  // The detonated star is "our" sun. Drop everything else from the
  // pre-supernova era — sibling stars (galactic neighbours), leftover
  // motes/gas (which would otherwise re-collapse into a second star), and
  // earlier asteroid debris. The clean slate is then seeded with a fresh
  // dust ring below.
  planetBodies = planetBodies.filter((b) => b === star);

  // Supernova leaves a remnant (white-dwarf / neutron-star-style core) so
  // there is always a sun for the planets phase. The remnant is plumped up
  // and the visual radius factor was reduced separately, so the habitable
  // band sits well past the star's photosphere with plenty of empty space
  // for orbits to be obviously distinct from the surface of the sun.
  const originalRadius = star.radius;
  const remnantMass = Math.max(2400, Math.min(3400, star.mass * 1.9 + 1100));
  star.mass = remnantMass;
  star.radius = planetRadiusFor("star", remnantMass);
  if (star.trail) star.trail.length = 0;

  // Spawn a dust+rock disk on near-circular orbits. With low radial jitter
  // and orbital tangential velocity, asteroids settle, cross paths, and
  // accrete into protoplanets without further user input.
  const config = PLANET_TYPES.asteroid;
  const count = 14 + Math.floor(Math.random() * 5);
  // Bias the dust ring deep into the outer cool band of the habitable zone
  // so the protoplanets land clearly far from the sun, like Earth at 1 AU
  // around a cool yellow star — not crammed against the photosphere.
  const habInner = Math.sqrt(remnantMass / PLANET_HEAT_HOT);
  const habOuter = Math.sqrt(remnantMass / PLANET_HEAT_FROZEN);
  const baseR = habInner + (habOuter - habInner) * 0.82;
  const halfBand = (habOuter - habInner) * 0.18;
  for (let k = 0; k < count; k++) {
    const angle = (k / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
    const offsetR = baseR + (Math.random() - 0.5) * halfBand * 2;
    const r2 = offsetR * offsetR;
    const orbitV = Math.sqrt((PLANET_G * star.mass * offsetR) / (r2 + PLANET_SOFTENING));
    // All prograde — keeps angular momentum aligned so head-on collisions
    // don't sap the system's rotation and dump everything into the star.
    const tangentX = -Math.sin(angle);
    const tangentY = Math.cos(angle);
    const radialJitter = (Math.random() - 0.5) * 4;
    const vmag = orbitV * (0.94 + Math.random() * 0.08);
    const mass = config.massBase + Math.random() * config.massVariance;
    planetBodies.push({
      type: "asteroid",
      x: cx + Math.cos(angle) * offsetR,
      y: cy + Math.sin(angle) * offsetR,
      vx: tangentX * vmag + Math.cos(angle) * radialJitter,
      vy: tangentY * vmag + Math.sin(angle) * radialJitter,
      mass,
      radius: planetRadiusFor("asteroid", mass),
      hue: planetHueFor("asteroid"),
      seed: Math.random(),
      pulse: Math.random() * Math.PI * 2,
      state: null,
      habitableTime: 0,
      aliveTime: 0,
      trailColor: config.trailColor,
      trail: [],
      flash: 0,
    });
  }
  planetSupernovaFlashes.push({ x: cx, y: cy, t: 0, life: 0.9, radius: originalRadius });
  planetSupernovas++;
  // Pull the camera back a hair so the orbit ring at high outer-band r
  // still fits comfortably and the sun looks like a sun, not a wall.
  startPlanetCameraZoom(cx, cy, 1.05);
  return true;
}

function stepPlanetRings(dt) {
  for (const body of planetBodies) {
    if (body.type !== "planet") continue;
    if (!body.ring) continue;
    if ((body.stage || 0) >= PLANET_STAGE_LIFE) continue;
    body.ring.cycleProgress += dt / PLANET_RING_CYCLE_SEC;
    if (body.ring.cycleProgress >= 1) body.ring.cycleProgress = 0;
    const outer = body.radius * PLANET_RING_OUTER_MULT;
    const inner = body.radius * PLANET_RING_INNER_MULT;
    body.ring.radius = outer - (outer - inner) * body.ring.cycleProgress;
    const tolerance = body.radius * PLANET_RING_TOLERANCE_MULT;
    body.ring.inHitZone = Math.abs(body.ring.radius - body.radius) <= tolerance;
  }
}

function tryHitPlanetRing(planet) {
  if (!planet || !planet.ring) return false;
  if ((planet.stage || 0) >= PLANET_STAGE_LIFE) return false;
  if (!planet.ring.inHitZone) {
    // Visible "miss" feedback so the player understands the timing matters.
    planet.flash = 0.25;
    return false;
  }
  planet.ring.hits = (planet.ring.hits || 0) + 1;
  planet.flash = 1.0;
  if (planet.ring.hits === 1) {
    planet.stage = PLANET_STAGE_VOLCANIC;
    planet.stageTime = 0;
    planet.state = "volcanic";
    spawnVolcanicBurst(planet);
  } else if (planet.ring.hits === 2) {
    planet.stage = PLANET_STAGE_OCEAN;
    planet.stageTime = 0;
    planet.state = "ocean";
    spawnRainBurst(planet);
  } else if (planet.ring.hits >= PLANET_RING_HITS_TARGET) {
    planet.stage = PLANET_STAGE_LIFE;
    planet.stageTime = 0;
    // Stabilise the orbit and grant life immediately on the third timed hit.
    let bestStar = null;
    let bestD2 = Infinity;
    for (const body of planetBodies) {
      if (body.type !== "star") continue;
      const ddx = planet.x - body.x;
      const ddy = planet.y - body.y;
      const d2 = ddx * ddx + ddy * ddy;
      if (d2 < bestD2) {
        bestD2 = d2;
        bestStar = body;
      }
    }
    if (bestStar) {
      const dx = planet.x - bestStar.x;
      const dy = planet.y - bestStar.y;
      const dr = Math.hypot(dx, dy);
      if (dr > 1) {
        const orbitV = Math.sqrt(
          (PLANET_G * bestStar.mass * dr) / (dr * dr + PLANET_SOFTENING),
        );
        const tx = -dy / dr;
        const ty = dx / dr;
        const tangentDot = planet.vx * tx + planet.vy * ty;
        const spin = tangentDot >= 0 ? 1 : -1;
        planet.vx = bestStar.vx + tx * orbitV * spin;
        planet.vy = bestStar.vy + ty * orbitV * spin;
      }
    }
    spawnLifeBurst(planet);
    planet.state = "alive";
    planet.habitableTime = PLANET_LIFE_DELAY;
    planet.aliveTime = LIFE_DURATION_TARGET;
  }
  // Restart the ring cycle so the next hit needs a fresh tap.
  planet.ring.cycleProgress = 0;
  planet.ring.inHitZone = false;
  return true;
}

function findPlanetBodyAt(x, y, typeFilter) {
  let best = null;
  let bestDist = Infinity;
  for (const body of planetBodies) {
    if (typeFilter && body.type !== typeFilter) continue;
    const dx = body.x - x;
    const dy = body.y - y;
    const d2 = dx * dx + dy * dy;
    // For planets, expand the click hitbox to include the ring's outer
    // radius — that way a tap anywhere from the planet itself out to
    // where the ring sits still resolves to "this planet" for the rhythm
    // mechanic. Without this the small planet sprite would be the only
    // legal click target.
    let reachR = body.radius + 10;
    if (body.type === "planet" && body.ring) {
      reachR = Math.max(reachR, body.radius * (PLANET_RING_OUTER_MULT + 0.5));
    }
    const reach = reachR * reachR;
    if (d2 <= reach && d2 < bestDist) {
      best = body;
      bestDist = d2;
    }
  }
  return best;
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

function countPlanetLife() {
  let count = 0;
  for (const body of planetBodies) {
    if (body.type === "planet" && body.state === "alive") count++;
  }
  return count;
}

const PLANET_STATE_PALETTE = {
  barren: { base: "#7a6a55", glow: "rgba(140, 120, 90, 0.20)", accent: "#5d503e" },
  volcanic: { base: "#a14322", glow: "rgba(255, 130, 50, 0.45)", accent: "#ffb347" },
  ocean: { base: "#2c7ab5", glow: "rgba(80, 160, 220, 0.40)", accent: "#9adcff" },
  frozen: { base: "#cde2ee", glow: "rgba(190, 220, 240, 0.32)", accent: "#fdfdff" },
  habitable: { base: "#3a86c4", glow: "rgba(70, 150, 220, 0.36)", accent: "#5b8a4b" },
  alive: { base: "#2d9bd0", glow: "rgba(70, 220, 130, 0.40)", accent: "#3acb6a" },
  scorched: { base: "#cc3a1a", glow: "rgba(220, 80, 30, 0.40)", accent: "#ffd76a" },
};

function drawPlanets() {
  if (!planetCtx) return;
  const ctx = planetCtx;
  const w = planetCanvas.width;
  const h = planetCanvas.height;

  ctx.fillStyle = "rgba(3, 8, 20, 0.22)";
  ctx.fillRect(0, 0, w, h);

  // Apply the camera transform: world (planetCamX, planetCamY) maps to the
  // canvas centre, scaled by planetCamZoom.
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(planetCamZoom, planetCamZoom);
  ctx.translate(-planetCamX, -planetCamY);

  for (const body of planetBodies) {
    if (body.trail.length > 1) {
      ctx.beginPath();
      ctx.moveTo(body.trail[0].x, body.trail[0].y);
      for (let i = 1; i < body.trail.length; i++) {
        ctx.lineTo(body.trail[i].x, body.trail[i].y);
      }
      ctx.strokeStyle = body.trailColor;
      ctx.lineWidth = 1.5 / planetCamZoom;
      ctx.stroke();
    }

    if (body.type === "star") {
      drawStarBody(ctx, body);
    } else if (body.type === "asteroid") {
      drawAsteroidBody(ctx, body);
    } else if (body.type === "mote") {
      drawMoteBody(ctx, body);
    } else if (body.type === "gas") {
      drawGasBody(ctx, body);
    } else {
      drawPlanetBody(ctx, body);
    }
  }

  drawSupernovaFlashes(ctx);
  drawPlanetParticles(ctx);
  drawPlanetRings(ctx);
  ctx.restore();
}

function drawPlanetRings(ctx) {
  for (const body of planetBodies) {
    if (body.type !== "planet") continue;
    if (!body.ring) continue;
    if ((body.stage || 0) >= PLANET_STAGE_LIFE) continue;
    const inZone = body.ring.inHitZone;
    const lineWidth = (inZone ? 2.6 : 1.8) / planetCamZoom;
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = inZone
      ? `hsla(150, 100%, 70%, ${0.85 + Math.sin(body.pulse * 6) * 0.15})`
      : "hsla(40, 80%, 75%, 0.45)";
    ctx.beginPath();
    ctx.arc(body.x, body.y, body.ring.radius, 0, Math.PI * 2);
    ctx.stroke();
    // Hit count beads above the planet so the player can see progress.
    const total = PLANET_RING_HITS_TARGET;
    const beadR = 2 / planetCamZoom;
    const spacing = body.radius * 0.7;
    const baseY = body.y - body.radius * 1.9;
    for (let i = 0; i < total; i++) {
      const beadX = body.x + (i - (total - 1) / 2) * spacing;
      ctx.fillStyle = i < (body.ring.hits || 0)
        ? "hsla(140, 100%, 70%, 0.95)"
        : "hsla(220, 35%, 55%, 0.45)";
      ctx.beginPath();
      ctx.arc(beadX, baseY, beadR, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawSupernovaFlashes(ctx) {
  if (planetSupernovaFlashes.length === 0) return;
  const dt = 1 / 60;
  const remaining = [];
  for (const flash of planetSupernovaFlashes) {
    flash.t += dt;
    const k = flash.t / flash.life;
    if (k >= 1) continue;
    const radius = flash.radius * (1 + k * 8);
    const alpha = (1 - k) * 0.8;
    const grad = ctx.createRadialGradient(flash.x, flash.y, 0, flash.x, flash.y, radius);
    grad.addColorStop(0, `rgba(255, 240, 200, ${alpha})`);
    grad.addColorStop(0.5, `rgba(255, 160, 90, ${alpha * 0.6})`);
    grad.addColorStop(1, "rgba(120, 30, 10, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(flash.x, flash.y, radius, 0, Math.PI * 2);
    ctx.fill();
    remaining.push(flash);
  }
  planetSupernovaFlashes = remaining;
}

function drawMoteBody(ctx, body) {
  const halo = ctx.createRadialGradient(body.x, body.y, 0, body.x, body.y, body.radius * 2.6);
  halo.addColorStop(0, `hsla(${body.hue}, 90%, 92%, 0.85)`);
  halo.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(body.x, body.y, body.radius * 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `hsla(${body.hue}, 100%, 96%, 0.95)`;
  ctx.beginPath();
  ctx.arc(body.x, body.y, body.radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawGasBody(ctx, body) {
  const halo = ctx.createRadialGradient(body.x, body.y, 0, body.x, body.y, body.radius * 2.8);
  halo.addColorStop(0, `hsla(${body.hue}, 55%, 70%, 0.55)`);
  halo.addColorStop(0.6, `hsla(${body.hue}, 50%, 55%, 0.25)`);
  halo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(body.x, body.y, body.radius * 2.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `hsla(${body.hue}, 45%, 65%, 0.7)`;
  ctx.beginPath();
  ctx.arc(body.x, body.y, body.radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawStarBody(ctx, body) {
  const novaReady = planetPhase === PLANET_PHASE_SUPERNOVA;
  const pulseAmp = novaReady ? 0.16 : 0.06;
  const pulse = 1 + Math.sin(body.pulse) * pulseAmp;
  const haloRadius = body.radius * (novaReady ? 4.6 : 4);
  const halo = ctx.createRadialGradient(body.x, body.y, 0, body.x, body.y, haloRadius);
  halo.addColorStop(0, `hsla(${body.hue}, 100%, 78%, 0.9)`);
  halo.addColorStop(0.4, novaReady
    ? `hsla(${body.hue + 15}, 100%, 55%, 0.42)`
    : `hsla(${body.hue}, 100%, 60%, 0.35)`);
  halo.addColorStop(1, `hsla(${body.hue}, 100%, 50%, 0)`);
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(body.x, body.y, haloRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `hsl(${body.hue}, 100%, 78%)`;
  ctx.beginPath();
  ctx.arc(body.x, body.y, body.radius * pulse, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 240, 0.9)";
  ctx.beginPath();
  ctx.arc(body.x, body.y, body.radius * 0.45 * pulse, 0, Math.PI * 2);
  ctx.fill();

  if (novaReady) {
    ctx.strokeStyle = `hsla(${(body.hue + 30) % 60}, 100%, 70%, ${0.4 + Math.sin(body.pulse * 1.6) * 0.25})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(body.x, body.y, body.radius * 1.5 * pulse, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawAsteroidBody(ctx, body) {
  const halo = ctx.createRadialGradient(body.x, body.y, 0, body.x, body.y, body.radius * 1.8);
  halo.addColorStop(0, `hsla(${body.hue}, 28%, 55%, 0.45)`);
  halo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(body.x, body.y, body.radius * 1.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `hsl(${body.hue}, 22%, 55%)`;
  ctx.beginPath();
  ctx.arc(body.x, body.y, body.radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlanetBody(ctx, body) {
  const palette = PLANET_STATE_PALETTE[body.state] || PLANET_STATE_PALETTE.barren;

  if (body.flash > 0) {
    const flashGrad = ctx.createRadialGradient(body.x, body.y, 0, body.x, body.y, body.radius * 4);
    flashGrad.addColorStop(0, `rgba(255, 230, 180, ${body.flash * 0.55})`);
    flashGrad.addColorStop(1, "rgba(255, 230, 180, 0)");
    ctx.fillStyle = flashGrad;
    ctx.beginPath();
    ctx.arc(body.x, body.y, body.radius * 4, 0, Math.PI * 2);
    ctx.fill();
  }

  const glow = ctx.createRadialGradient(body.x, body.y, body.radius, body.x, body.y, body.radius * 2.6);
  glow.addColorStop(0, palette.glow);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(body.x, body.y, body.radius * 2.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = palette.base;
  ctx.beginPath();
  ctx.arc(body.x, body.y, body.radius, 0, Math.PI * 2);
  ctx.fill();

  if (body.state === "habitable" || body.state === "alive") {
    drawPlanetContinents(ctx, body, palette);
  } else if (body.state === "frozen") {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
    ctx.lineWidth = Math.max(1, body.radius * 0.18);
    ctx.beginPath();
    ctx.arc(body.x, body.y, body.radius * 0.92, 0, Math.PI * 2);
    ctx.stroke();
  } else if (body.state === "scorched") {
    ctx.strokeStyle = "rgba(255, 220, 120, 0.55)";
    ctx.lineWidth = Math.max(1, body.radius * 0.12);
    ctx.beginPath();
    const cracks = 3;
    for (let k = 0; k < cracks; k++) {
      const a = body.seed * Math.PI * 2 + (k * Math.PI * 2) / cracks;
      ctx.moveTo(body.x + Math.cos(a) * body.radius * 0.2, body.y + Math.sin(a) * body.radius * 0.2);
      ctx.lineTo(body.x + Math.cos(a) * body.radius * 0.85, body.y + Math.sin(a) * body.radius * 0.85);
    }
    ctx.stroke();
  } else if (body.state === "volcanic") {
    // Glowing magma fissures across the surface.
    ctx.strokeStyle = `hsla(20, 100%, 60%, ${0.55 + Math.sin(body.pulse * 1.6) * 0.3})`;
    ctx.lineWidth = Math.max(1, body.radius * 0.16);
    ctx.beginPath();
    const fissures = 4;
    for (let k = 0; k < fissures; k++) {
      const a = body.seed * Math.PI * 2 + (k * Math.PI * 2) / fissures + body.pulse * 0.05;
      ctx.moveTo(body.x + Math.cos(a) * body.radius * 0.15, body.y + Math.sin(a) * body.radius * 0.15);
      ctx.lineTo(body.x + Math.cos(a) * body.radius * 0.9, body.y + Math.sin(a) * body.radius * 0.9);
    }
    ctx.stroke();
  } else if (body.state === "ocean") {
    // Reflective bands suggesting a planet-wide ocean.
    ctx.strokeStyle = "rgba(220, 240, 255, 0.55)";
    ctx.lineWidth = Math.max(1, body.radius * 0.1);
    for (let k = 0; k < 3; k++) {
      const yoff = body.radius * (-0.55 + k * 0.45);
      const halfW = Math.sqrt(Math.max(0, body.radius * body.radius - yoff * yoff)) * 0.85;
      ctx.beginPath();
      ctx.moveTo(body.x - halfW, body.y + yoff);
      ctx.lineTo(body.x + halfW, body.y + yoff);
      ctx.stroke();
    }
  }
}

function drawPlanetContinents(ctx, body, palette) {
  const isAlive = body.state === "alive";
  ctx.fillStyle = palette.accent;
  const spots = isAlive ? 3 : 2;
  for (let k = 0; k < spots; k++) {
    const seed = (body.seed + k * 0.37) % 1;
    const angle = seed * Math.PI * 2;
    const radial = 0.25 + ((body.seed * (k + 1) * 1.7) % 1) * 0.45;
    const ox = Math.cos(angle) * body.radius * radial;
    const oy = Math.sin(angle) * body.radius * radial;
    const blob = body.radius * (isAlive ? 0.32 : 0.26);
    ctx.beginPath();
    ctx.arc(body.x + ox, body.y + oy, blob, 0, Math.PI * 2);
    ctx.fill();
  }
}

const PLANET_PHASE_TEXT_KEYS = [
  "planetPhaseInflation",
  "planetPhaseStars",
  "planetPhaseSupernova",
  "planetPhasePlanets",
  "planetPhaseVictory",
];

const PLANET_PHASE_HINT_KEYS = [
  "planetHintInflation",
  "planetHintStars",
  "planetHintSupernova",
  "planetHintPlanets",
  "planetHintVictory",
];

const PLANET_ERA_CLOCK_KEYS = [
  "planetEraInflationClock",
  "planetEraStarsClock",
  "planetEraSupernovaClock",
  "planetEraPlanetsClock",
  "planetEraVictoryClock",
];

const PLANET_ERA_NAME_KEYS = [
  "planetEraInflationName",
  "planetEraStarsName",
  "planetEraSupernovaName",
  "planetEraPlanetsName",
  "planetEraVictoryName",
];

const PLANET_INTRO_TITLE_KEYS = [
  "planetIntroInflationTitle",
  "planetIntroStarsTitle",
  "planetIntroSupernovaTitle",
  "planetIntroPlanetsTitle",
  "planetIntroVictoryTitle",
];

const PLANET_INTRO_BODY_KEYS = [
  "planetIntroInflationBody",
  "planetIntroStarsBody",
  "planetIntroSupernovaBody",
  "planetIntroPlanetsBody",
  "planetIntroVictoryBody",
];

function showPlanetIntroOverlay(phase, opts = {}) {
  if (!planetOverlayEl || !planetOverlayTitleEl || !planetOverlayBodyEl) return;
  const titleKey = PLANET_INTRO_TITLE_KEYS[phase];
  const bodyKey = PLANET_INTRO_BODY_KEYS[phase];
  if (!titleKey || !bodyKey) return;
  planetOverlayTitleEl.textContent = getText(titleKey);
  planetOverlayBodyEl.textContent = getText(bodyKey);
  planetOverlayEl.hidden = false;
  if (planetOverlayTimer) {
    clearTimeout(planetOverlayTimer);
    planetOverlayTimer = null;
  }
  const dur = opts.persist ? 6000 : 4500;
  planetOverlayTimer = setTimeout(() => {
    planetOverlayEl.hidden = true;
    planetOverlayTimer = null;
  }, dur);
}

function hidePlanetIntroOverlay() {
  if (!planetOverlayEl) return;
  if (planetOverlayTimer) {
    clearTimeout(planetOverlayTimer);
    planetOverlayTimer = null;
  }
  planetOverlayEl.hidden = true;
}

function renderPlanetTimeline() {
  if (!planetTimelineSteps.length) return;
  planetTimelineSteps.forEach((step) => {
    const idx = Number(step.dataset.step);
    step.classList.toggle("is-active", idx === planetPhase);
    step.classList.toggle("is-done", idx < planetPhase);
  });
}

function renderPlanetEra() {
  if (planetEraClockEl) {
    planetEraClockEl.textContent = getText(PLANET_ERA_CLOCK_KEYS[planetPhase]);
  }
  if (planetEraNameEl) {
    planetEraNameEl.textContent = getText(PLANET_ERA_NAME_KEYS[planetPhase]);
  }
}

function planetProgressText() {
  if (planetPhase === PLANET_PHASE_INFLATION) {
    return `${Math.min(planetMotesPlaced, INFLATION_MOTE_TARGET)} / ${INFLATION_MOTE_TARGET}`;
  }
  if (planetPhase === PLANET_PHASE_STARS) {
    const stars = planetBodies.filter((b) => b.type === "star").length;
    return `${Math.min(stars, STARS_PHASE_TARGET)} / ${STARS_PHASE_TARGET} ★`;
  }
  if (planetPhase === PLANET_PHASE_SUPERNOVA) {
    return `${planetSupernovas} / ${SUPERNOVA_TARGET}`;
  }
  if (planetPhase === PLANET_PHASE_PLANETS) {
    const best = planetBodies.reduce(
      (m, b) => (b.type === "planet" ? Math.max(m, b.aliveTime || 0) : m),
      0,
    );
    return `${best.toFixed(1)} / ${LIFE_DURATION_TARGET}s`;
  }
  return "✓";
}

function renderPlanetToolbar() {
  planetBodyCountEl.textContent = String(planetBodies.length);
  if (planetLifeCountEl) {
    planetLifeCountEl.textContent = String(countPlanetLife());
  }

  if (planetPhaseTextEl) {
    planetPhaseTextEl.textContent = getText(PLANET_PHASE_TEXT_KEYS[planetPhase]);
  }
  if (planetProgressTextEl) {
    planetProgressTextEl.textContent = planetProgressText();
  }
  if (planetHintEl) {
    planetHintEl.textContent = getText(PLANET_PHASE_HINT_KEYS[planetPhase]);
  }
  if (planetVictoryEl) {
    planetVictoryEl.hidden = planetPhase !== PLANET_PHASE_VICTORY;
  }
  renderPlanetTimeline();
  renderPlanetEra();
  if (planetPhase !== planetOverlayShownPhase) {
    showPlanetIntroOverlay(planetPhase, { persist: planetPhase === PLANET_PHASE_VICTORY });
    planetOverlayShownPhase = planetPhase;
  }

  if (planetBodies.length === 0 && planetPhase !== PLANET_PHASE_VICTORY) {
    planetPauseButton.textContent = getText("planetPause");
    planetPauseButton.disabled = true;
  } else {
    planetPauseButton.disabled = false;
    planetPauseButton.textContent = planetRunning
      ? getText("planetPause")
      : getText("planetResume");
  }
}

// ── Management Simulation ──────────────────────────────────────────────────

const MGMT_ITEMS = [
  { id: "coffee", ja: "コーヒー", en: "Coffee", buyCost: 200, sellPrice: 400, batch: 5 },
  { id: "cake", ja: "ケーキ", en: "Cake", buyCost: 300, sellPrice: 600, batch: 3 },
];

function createInitialMgmtState() {
  return {
    day: 1,
    balance: 50000,
    stock: { coffee: 0, cake: 0 },
    totalCustomers: 0,
    log: [],
  };
}

function mgmtItemName(item) {
  return currentLanguage === "ja" ? item.ja : item.en;
}

function mgmtBuyItem(itemId) {
  const item = MGMT_ITEMS.find((i) => i.id === itemId);
  if (!item) return;
  const cost = item.buyCost * item.batch;
  if (mgmtState.balance < cost) return;
  mgmtState.balance -= cost;
  mgmtState.stock[itemId] = (mgmtState.stock[itemId] || 0) + item.batch;
  renderMgmtPanel();
  renderMgmtToolbar();
}

function mgmtServeDay() {
  const customers = 8 + Math.floor(Math.random() * 15);
  let revenue = 0;
  let served = 0;
  const soldItems = {};
  MGMT_ITEMS.forEach((i) => (soldItems[i.id] = 0));

  for (let c = 0; c < customers; c++) {
    const available = MGMT_ITEMS.filter((item) => (mgmtState.stock[item.id] || 0) > 0);
    if (available.length === 0) break;
    const chosen = available[Math.floor(Math.random() * available.length)];
    mgmtState.stock[chosen.id] -= 1;
    revenue += chosen.sellPrice;
    soldItems[chosen.id] += 1;
    served++;
  }

  mgmtState.balance += revenue;
  mgmtState.totalCustomers += served;

  mgmtState.log.unshift({
    day: mgmtState.day,
    customers,
    served,
    revenue,
    soldItems: { ...soldItems },
  });

  mgmtState.day++;
  renderMgmtPanel();
  renderMgmtToolbar();
}

function renderMgmtToolbar() {
  mgmtDayEl.textContent = String(mgmtState.day);
  mgmtBalanceEl.textContent = formatYen(mgmtState.balance);
  mgmtCustomersEl.textContent = String(mgmtState.totalCustomers);
}

function renderMgmtPanel() {
  mgmtStockListEl.replaceChildren();
  for (const item of MGMT_ITEMS) {
    const li = document.createElement("li");
    li.className = "mgmt-item-row";

    const info = document.createElement("div");
    info.className = "mgmt-item-info";

    const name = document.createElement("strong");
    name.textContent = mgmtItemName(item);

    const stockSpan = document.createElement("span");
    stockSpan.textContent = template(getText("mgmtStockCount"), { count: mgmtState.stock[item.id] || 0 });

    info.append(name, stockSpan);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "button button-ghost mgmt-buy-button";
    btn.textContent = template(getText("mgmtBuyButton"), {
      count: item.batch,
      cost: formatYen(item.buyCost * item.batch),
    });
    btn.disabled = mgmtState.balance < item.buyCost * item.batch;
    const itemId = item.id;
    btn.addEventListener("click", () => mgmtBuyItem(itemId));

    li.append(info, btn);
    mgmtStockListEl.appendChild(li);
  }

  mgmtMenuListEl.replaceChildren();
  for (const item of MGMT_ITEMS) {
    const li = document.createElement("li");
    li.className = "mgmt-item-row";

    const name = document.createElement("strong");
    name.textContent = mgmtItemName(item);

    const priceSpan = document.createElement("span");
    priceSpan.textContent = template(getText("mgmtSellPrice"), { price: formatYen(item.sellPrice) });

    li.append(name, priceSpan);
    mgmtMenuListEl.appendChild(li);
  }

  mgmtLogListEl.replaceChildren();
  if (mgmtState.log.length === 0) {
    const empty = document.createElement("li");
    empty.className = "binary-empty";
    empty.textContent = getText("mgmtLogEmpty");
    mgmtLogListEl.appendChild(empty);
    return;
  }

  mgmtState.log.slice(0, 10).forEach((entry) => {
    const li = document.createElement("li");
    li.className = "mgmt-log-item";

    const top = document.createElement("div");
    top.className = "mgmt-log-top";

    const dayLabel = document.createElement("strong");
    dayLabel.textContent = template(getText("mgmtLogDay"), { day: entry.day });

    const revLabel = document.createElement("span");
    revLabel.className = entry.revenue > 0 ? "mgmt-revenue-pos" : "";
    revLabel.textContent = formatYen(entry.revenue, true);

    top.append(dayLabel, revLabel);

    const bottom = document.createElement("div");
    bottom.className = "mgmt-log-bottom";
    const soldText = MGMT_ITEMS.map((item) => `${mgmtItemName(item)}: ${entry.soldItems[item.id] || 0}`).join(" / ");
    bottom.textContent = `${template(getText("mgmtLogServed"), {
      served: entry.served,
      customers: entry.customers,
    })} / ${soldText}`;

    li.append(top, bottom);
    mgmtLogListEl.appendChild(li);
  });
}

// ── Solitaire ─────────────────────────────────────────────────────────────

const SOL_SUITS = ["♠", "♥", "♦", "♣"];
const SOL_RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function solIsRed(card) {
  return card.suit === 1 || card.suit === 2;
}

function solCanPlaceOnTableau(card, pile) {
  if (pile.length === 0) return card.rank === 13;
  const top = pile[pile.length - 1];
  if (!top.faceUp) return false;
  return top.rank === card.rank + 1 && solIsRed(card) !== solIsRed(top);
}

function solCanPlaceOnFoundation(card, foundIdx) {
  const found = solitaireState.foundations[foundIdx];
  if (found.length === 0) return card.rank === 1;
  const top = found[found.length - 1];
  return top.suit === card.suit && top.rank === card.rank - 1;
}

function newSolitaireGame() {
  if (solitaireTimerInterval) {
    clearInterval(solitaireTimerInterval);
    solitaireTimerInterval = null;
  }

  const deck = [];
  for (let suit = 0; suit < 4; suit++) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({ suit, rank, faceUp: false });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  const tableau = [];
  let idx = 0;
  for (let col = 0; col < 7; col++) {
    const pile = [];
    for (let row = 0; row <= col; row++) {
      pile.push({ ...deck[idx++], faceUp: row === col });
    }
    tableau.push(pile);
  }

  solitaireState = {
    tableau,
    foundations: [[], [], [], []],
    stock: deck.slice(idx).map((c) => ({ ...c, faceUp: false })),
    waste: [],
    selected: null,
    moves: 0,
    startTime: Date.now(),
    won: false,
  };

  solitaireTimerInterval = setInterval(() => {
    if (solitaireState && !solitaireState.won && selectedGame === "solitaire") {
      solitaireTimeEl.textContent = solFormatTime(Date.now() - solitaireState.startTime);
    }
  }, 1000);

  renderSolitairePanel();
  renderSolitaireToolbar();
}

function solFormatTime(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function renderSolitaireToolbar() {
  if (!solitaireState) return;
  solitaireMovesEl.textContent = String(solitaireState.moves);
  solitaireTimeEl.textContent = solFormatTime(Date.now() - solitaireState.startTime);
  solitaireStockEl.textContent = String(solitaireState.stock.length);
}

function solRemoveSelection() {
  const sel = solitaireState.selected;
  if (!sel) return;
  if (sel.source === "waste") {
    solitaireState.waste.pop();
  } else if (sel.source === "tableau") {
    solitaireState.tableau[sel.col] = solitaireState.tableau[sel.col].slice(0, sel.startIdx);
  } else if (sel.source === "foundation") {
    solitaireState.foundations[sel.col].pop();
  }
}

function solFlipTops() {
  for (const pile of solitaireState.tableau) {
    if (pile.length > 0 && !pile[pile.length - 1].faceUp) {
      pile[pile.length - 1].faceUp = true;
    }
  }
}

function solCheckWin() {
  if (solitaireState.foundations.every((f) => f.length === 13)) {
    solitaireState.won = true;
    if (solitaireTimerInterval) {
      clearInterval(solitaireTimerInterval);
      solitaireTimerInterval = null;
    }
    solitaireWinMessageEl.textContent = getText("solitaireWin");
    solitaireWinMessageEl.hidden = false;
  }
}

function solClickStock() {
  if (solitaireState.won) return;
  if (solitaireState.stock.length === 0) {
    solitaireState.stock = solitaireState.waste.reverse().map((c) => ({ ...c, faceUp: false }));
    solitaireState.waste = [];
    solitaireState.moves++;
  } else {
    const card = solitaireState.stock.pop();
    card.faceUp = true;
    solitaireState.waste.push(card);
    solitaireState.moves++;
  }
  solitaireState.selected = null;
  renderSolitairePanel();
  renderSolitaireToolbar();
}

function solClickWaste() {
  if (solitaireState.won || solitaireState.waste.length === 0) return;
  const sel = solitaireState.selected;
  if (sel && sel.source === "waste") {
    solitaireState.selected = null;
  } else {
    solitaireState.selected = {
      source: "waste",
      col: null,
      startIdx: null,
      cards: [solitaireState.waste[solitaireState.waste.length - 1]],
    };
  }
  renderSolitairePanel();
}

function solClickFoundation(fi) {
  if (solitaireState.won) return;
  const sel = solitaireState.selected;
  if (sel) {
    if (sel.cards.length !== 1) {
      solitaireState.selected = null;
      renderSolitairePanel();
      return;
    }
    const card = sel.cards[0];
    const targetFi = [0, 1, 2, 3].find((i) => solCanPlaceOnFoundation(card, i));
    if (targetFi !== undefined) {
      solRemoveSelection();
      solitaireState.foundations[targetFi].push(card);
      solitaireState.moves++;
      solitaireState.selected = null;
      solFlipTops();
      renderSolitairePanel();
      renderSolitaireToolbar();
      solCheckWin();
    } else {
      solitaireState.selected = null;
      renderSolitairePanel();
    }
    return;
  }
  const found = solitaireState.foundations[fi];
  if (found.length > 0) {
    solitaireState.selected = { source: "foundation", col: fi, startIdx: found.length - 1, cards: [found[found.length - 1]] };
    renderSolitairePanel();
  }
}

function solClickTableau(ci, cardIdx) {
  if (solitaireState.won) return;
  const pile = solitaireState.tableau[ci];
  const sel = solitaireState.selected;

  if (pile.length === 0) {
    if (sel) {
      if (!solTryMoveToTableau(ci)) {
        solitaireState.selected = null;
        renderSolitairePanel();
      }
    }
    return;
  }

  const card = pile[cardIdx];

  if (!card.faceUp) {
    if (cardIdx === pile.length - 1) {
      card.faceUp = true;
      solitaireState.moves++;
      solitaireState.selected = null;
      renderSolitairePanel();
      renderSolitaireToolbar();
    }
    return;
  }

  if (sel && sel.source === "tableau" && sel.col === ci && sel.startIdx === cardIdx) {
    solitaireState.selected = null;
    renderSolitairePanel();
    return;
  }

  if (sel) {
    if (solTryMoveToTableau(ci)) return;
  }

  const cards = pile.slice(cardIdx);
  if (!cards.every((c) => c.faceUp)) return;
  solitaireState.selected = { source: "tableau", col: ci, startIdx: cardIdx, cards };
  renderSolitairePanel();
}

function solAutoMoveToFoundation(source, col) {
  if (!solitaireState || solitaireState.won) return;
  let card = null;
  if (source === "waste") {
    if (solitaireState.waste.length === 0) return;
    card = solitaireState.waste[solitaireState.waste.length - 1];
  } else {
    const pile = solitaireState.tableau[col];
    if (!pile || pile.length === 0) return;
    card = pile[pile.length - 1];
    if (!card.faceUp) return;
  }
  const fi = [0, 1, 2, 3].find((i) => solCanPlaceOnFoundation(card, i));
  if (fi === undefined) return;
  solitaireState.selected = { source, col, startIdx: source === "waste" ? null : solitaireState.tableau[col].length - 1, cards: [card] };
  solRemoveSelection();
  solitaireState.foundations[fi].push(card);
  solitaireState.moves++;
  solitaireState.selected = null;
  solFlipTops();
  renderSolitairePanel();
  renderSolitaireToolbar();
  solCheckWin();
}

function solTryMoveToTableau(destCol) {
  const sel = solitaireState.selected;
  if (!sel) return false;
  const destPile = solitaireState.tableau[destCol];
  if (!solCanPlaceOnTableau(sel.cards[0], destPile)) return false;
  solRemoveSelection();
  for (const card of sel.cards) {
    solitaireState.tableau[destCol].push(card);
  }
  solitaireState.moves++;
  solitaireState.selected = null;
  solFlipTops();
  renderSolitairePanel();
  renderSolitaireToolbar();
  return true;
}

function makeSolCard(card, isSelected) {
  const el = document.createElement("div");
  el.className = `sol-card${solIsRed(card) ? " sol-red" : " sol-black"}${isSelected ? " sol-selected" : ""}`;
  if (!card.faceUp) {
    el.classList.add("sol-face-down");
  } else {
    const rankEl = document.createElement("span");
    rankEl.className = "sol-rank";
    rankEl.textContent = SOL_RANKS[card.rank - 1];
    const suitEl = document.createElement("span");
    suitEl.className = "sol-suit";
    suitEl.textContent = SOL_SUITS[card.suit];
    el.append(rankEl, suitEl);
  }
  return el;
}

function makeSolEmpty(label) {
  const el = document.createElement("div");
  el.className = "sol-card sol-empty";
  if (label) {
    const span = document.createElement("span");
    span.textContent = label;
    el.appendChild(span);
  }
  return el;
}

function renderSolitairePanel() {
  if (!solitaireState) return;
  const sel = solitaireState.selected;

  solitaireStockPileEl.replaceChildren();
  if (solitaireState.stock.length === 0) {
    const el = makeSolEmpty("↺");
    el.style.cursor = "pointer";
    el.addEventListener("click", solClickStock);
    solitaireStockPileEl.appendChild(el);
  } else {
    const el = document.createElement("div");
    el.className = "sol-card sol-face-down";
    el.style.cursor = "pointer";
    el.addEventListener("click", solClickStock);
    solitaireStockPileEl.appendChild(el);
  }

  solitaireWastePileEl.replaceChildren();
  if (solitaireState.waste.length === 0) {
    solitaireWastePileEl.appendChild(makeSolEmpty(""));
  } else {
    const topCard = solitaireState.waste[solitaireState.waste.length - 1];
    const isSelected = sel && sel.source === "waste";
    const el = makeSolCard(topCard, isSelected);
    el.addEventListener("click", solClickWaste);
    el.addEventListener("dblclick", () => {
      solitaireState.selected = null;
      solAutoMoveToFoundation("waste", null);
    });
    solitaireWastePileEl.appendChild(el);
  }

  solitaireFoundationsEl.replaceChildren();
  for (let fi = 0; fi < 4; fi++) {
    const found = solitaireState.foundations[fi];
    const isSelected = sel && sel.source === "foundation" && sel.col === fi;
    const el = found.length === 0 ? makeSolEmpty(SOL_SUITS[fi]) : makeSolCard(found[found.length - 1], isSelected);
    const foundIdx = fi;
    el.style.cursor = "pointer";
    el.addEventListener("click", () => solClickFoundation(foundIdx));
    solitaireFoundationsEl.appendChild(el);
  }

  solitaireTableauEl.replaceChildren();
  for (let ci = 0; ci < 7; ci++) {
    const pile = solitaireState.tableau[ci];
    const colEl = document.createElement("div");
    colEl.className = "sol-col";
    const colIdx = ci;

    if (pile.length === 0) {
      const empty = makeSolEmpty("");
      empty.addEventListener("click", () => solClickTableau(colIdx, 0));
      colEl.appendChild(empty);
    } else {
      pile.forEach((card, cardIdx) => {
        const isCardSelected = sel && sel.source === "tableau" && sel.col === colIdx && cardIdx >= sel.startIdx;
        const el = makeSolCard(card, isCardSelected);
        if (cardIdx > 0) {
          const cs = getComputedStyle(document.documentElement);
          el.style.marginTop = card.faceUp
            ? cs.getPropertyValue("--sol-overlap-up").trim()
            : cs.getPropertyValue("--sol-overlap-down").trim();
        }
        const idx = cardIdx;
        el.addEventListener("click", () => solClickTableau(colIdx, idx));
        el.addEventListener("dblclick", () => {
          if (card.faceUp && idx === pile.length - 1) {
            solitaireState.selected = null;
            solAutoMoveToFoundation("tableau", colIdx);
          }
        });
        colEl.appendChild(el);
      });
    }
    solitaireTableauEl.appendChild(colEl);
  }

  solitaireWinMessageEl.hidden = !solitaireState.won;
  if (solitaireState.won) {
    solitaireWinMessageEl.textContent = getText("solitaireWin");
  }
}

function getFishingSignalLabel(level) {
  return getText(`fishingSignalStage${level}`) || getText("fishingSignalNone");
}

function getFishingDecisionLabel() {
  if (fishingState.status === "scanning") {
    return getText("fishingDecisionScanning");
  }
  if (fishingState.status === "committed") {
    return getText("fishingDecisionGo");
  }
  if (fishingState.detection) {
    return getText("fishingDecisionPending");
  }
  if (fishingState.decision === "search") {
    return getText("fishingDecisionSearch");
  }
  return getText("fishingDecisionStandby");
}

function getFishingZoneLabel(zoneId) {
  const zone = FISHING_ZONES.find((entry) => entry.id === zoneId);
  if (!zone) {
    return zoneId;
  }
  return currentLanguage === "ja" ? zone.ja : zone.en;
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

function apiUrl(action, extraQuery = {}) {
  const url = new URL(appEndpoint.toString());
  url.searchParams.set("action", action);
  Object.entries(extraQuery).forEach(([key, value]) => {
    if (value != null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
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

async function requestJson(action, payload = null, extraQuery = {}) {
  let response;
  const requestQuery = payload ? extraQuery : { ...extraQuery, _: Date.now() };
  try {
    response = await fetch(apiUrl(action, requestQuery), {
      method: payload ? "POST" : "GET",
      headers: payload ? { "Content-Type": "application/json" } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
      cache: "no-store",
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

function isBinaryBusy() {
  return isGameLoading;
}

async function loadMinesweeper() {
  if (isGameLoading) {
    return;
  }
  isGameLoading = true;
  minesTransientMessage = null;
  renderGameShell();
  try {
    currentState = await requestJson("new", { difficulty: currentDifficulty });
    hasLoadedMinesweeper = true;
  } finally {
    isGameLoading = false;
    renderGameShell();
  }
}

async function revealCell(row, col) {
  const previousStatus = currentState?.status;
  currentState = await requestJson("reveal", { row, col });
  minesTransientMessage = null;
  renderMinesweeper();
  if (currentState?.status === "won" && previousStatus !== "won") {
    celebrateWithFireworks();
  }
}

async function toggleFlag(row, col) {
  currentState = await requestJson("flag", { row, col });
  minesTransientMessage = null;
  renderMinesweeper();
}

function renderMinesweeper() {
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
        showMinesError(error);
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
      showMinesError(error);
    }
  });

  tile.addEventListener("contextmenu", async (event) => {
    event.preventDefault();
    clearPressTimer();
    try {
      await toggleFlag(rowIndex, colIndex);
    } catch (error) {
      showMinesError(error);
    }
  });
}

async function loadBinaryState() {
  if (isGameLoading) {
    return;
  }
  isGameLoading = true;
  binaryTransientMessage = null;
  renderGameShell();
  try {
    if (!binaryGame || binaryGame.status === "won" || binaryGame.status === "lost") {
      initBinaryGame();
    }
    rebuildBinaryViewState();
    hasLoadedBinary = true;
  } finally {
    isGameLoading = false;
    renderGameShell();
    startBinaryTick();
  }
}

function placeBinaryDecision(direction) {
  if (!binaryGame || binaryGame.status !== "deciding") {
    return;
  }
  const stake = getCurrentStake();
  if (!Number.isFinite(stake) || stake < BINARY_MIN_STAKE) {
    return;
  }
  if (stake > binaryGame.balance) {
    return;
  }
  binaryGame.decision = direction;
  binaryGame.stake = stake;
  binaryGame.balance -= stake;
  binaryGame.phaseStart = performance.now();
  binaryGame.revealEndsAt = binaryGame.phaseStart + BINARY_REVEAL_MS;
  binaryGame.revealedTicks = 1;
  binaryGame.status = "revealing";
  binaryTransientMessage = "binaryTradePlaced";
  rebuildBinaryViewState();
  renderBinaryPanel();
}

function restartBinaryGame() {
  initBinaryGame();
  rebuildBinaryViewState();
  renderBinaryPanel();
  startBinaryTick();
}

function initBinaryGame() {
  binaryGame = {
    balance: BINARY_STARTING_BALANCE,
    startingBalance: BINARY_STARTING_BALANCE,
    targetBalance: BINARY_STARTING_BALANCE * BINARY_TARGET_MULTIPLIER,
    status: "idle",
    round: 0,
    series: null,
    decision: null,
    stake: DEFAULT_BINARY_STAKE,
    profit: 0,
    result: null,
    history: [],
    phaseStart: 0,
    decisionEndsAt: 0,
    revealEndsAt: 0,
    settledEndsAt: 0,
    revealedTicks: 0,
  };
  startNextBinaryRound();
}

function startNextBinaryRound() {
  if (!binaryGame) return;
  if (binaryGame.balance >= binaryGame.targetBalance) {
    binaryGame.status = "won";
    return;
  }
  if (binaryGame.balance < BINARY_MIN_STAKE) {
    binaryGame.status = "lost";
    return;
  }
  binaryGame.round += 1;
  binaryGame.series = pickBinarySeries();
  binaryGame.decision = null;
  binaryGame.result = null;
  binaryGame.profit = 0;
  binaryGame.revealedTicks = 1;
  binaryGame.phaseStart = performance.now();
  binaryGame.decisionEndsAt = binaryGame.phaseStart + BINARY_DECIDE_MS;
  binaryGame.status = "deciding";
  binarySelectedSymbol = binaryGame.series.label;
}

function pickBinarySeries() {
  const lastId = binaryGame?.series?.id || null;
  let candidate = BINARY_SERIES[Math.floor(Math.random() * BINARY_SERIES.length)];
  for (let attempts = 0; attempts < 4 && candidate.id === lastId; attempts++) {
    candidate = BINARY_SERIES[Math.floor(Math.random() * BINARY_SERIES.length)];
  }
  return candidate;
}

function tickBinaryGame() {
  if (!binaryGame) return;
  const now = performance.now();
  let dirty = false;

  if (binaryGame.status === "deciding") {
    if (now >= binaryGame.decisionEndsAt) {
      binaryGame.decision = null;
      binaryGame.result = "skipped";
      binaryGame.profit = 0;
      binaryGame.revealedTicks = binaryGame.series ? binaryGame.series.prices.length : 0;
      binaryGame.settledEndsAt = now + BINARY_SETTLED_MS;
      binaryGame.status = "settled";
      dirty = true;
    }
  } else if (binaryGame.status === "revealing") {
    const elapsed = now - binaryGame.phaseStart;
    const totalReveal = binaryGame.series.prices.length - 1;
    const progress = Math.max(0, Math.min(1, elapsed / BINARY_REVEAL_MS));
    const next = 1 + Math.floor(totalReveal * progress);
    if (next !== binaryGame.revealedTicks) {
      binaryGame.revealedTicks = next;
      dirty = true;
    }
    if (now >= binaryGame.revealEndsAt) {
      settleBinaryRound();
      dirty = true;
    }
  } else if (binaryGame.status === "settled") {
    if (now >= binaryGame.settledEndsAt) {
      const previousStatus = binaryGame.status;
      startNextBinaryRound();
      if (binaryGame.status === "won" && previousStatus !== "won") {
        celebrateWithFireworks(5200);
      }
      dirty = true;
    }
  }

  rebuildBinaryViewState();
  if (dirty) {
    renderBinaryPanel();
  } else {
    renderBinarySummary();
    renderBinaryChart();
    renderBinaryControls();
  }
}

function settleBinaryRound() {
  const series = binaryGame.series;
  binaryGame.revealedTicks = series.prices.length;
  const entry = series.prices[0];
  const exit = series.prices[series.prices.length - 1];
  const decision = binaryGame.decision;
  let result = "draw";
  if (exit > entry) result = decision === "up" ? "won" : "lost";
  else if (exit < entry) result = decision === "down" ? "won" : "lost";
  let payout = 0;
  if (result === "won") {
    payout = Math.round(binaryGame.stake * (1 + BINARY_PAYOUT_RATE));
  } else if (result === "draw") {
    payout = binaryGame.stake;
  }
  binaryGame.balance += payout;
  binaryGame.profit = payout - binaryGame.stake;
  binaryGame.result = result;
  binaryGame.history.unshift({
    id: `${binaryGame.round}-${series.id}`,
    round: binaryGame.round,
    symbol: series.label,
    direction: decision,
    stake: binaryGame.stake,
    entryPrice: formatBinaryPrice(entry, series.digits),
    exitPrice: formatBinaryPrice(exit, series.digits),
    result,
    payout,
    profit: binaryGame.profit,
    settledAt: Math.floor(Date.now() / 1000),
  });
  binaryGame.history = binaryGame.history.slice(0, 12);
  binaryGame.settledEndsAt = performance.now() + BINARY_SETTLED_MS;
  binaryGame.status = "settled";
}

function rebuildBinaryViewState() {
  if (!binaryGame || !binaryGame.series) {
    binaryState = {
      balance: binaryGame?.balance ?? BINARY_STARTING_BALANCE,
      startingBalance: BINARY_STARTING_BALANCE,
      targetBalance: BINARY_STARTING_BALANCE * BINARY_TARGET_MULTIPLIER,
      currency: "JPY",
      selectedSymbol: binarySelectedSymbol,
      symbols: [DEFAULT_BINARY_SYMBOL],
      durations: [DEFAULT_BINARY_DURATION],
      defaultDuration: DEFAULT_BINARY_DURATION,
      minStake: BINARY_MIN_STAKE,
      payoutRate: BINARY_PAYOUT_RATE,
      tradingEnabled: false,
      notices: [],
      openPositions: [],
      history: [],
      provider: { name: "Local Replay", code: "local" },
      quote: null,
      chart: null,
      caseInfo: null,
      game: { status: binaryGame?.status || "idle", round: binaryGame?.round || 0 },
    };
    return;
  }

  const series = binaryGame.series;
  const priorPrices = Array.isArray(series.priorPrices) ? series.priorPrices : [];
  const revealedTicks = binaryGame.status === "deciding"
    ? 1
    : Math.max(1, binaryGame.revealedTicks);
  const liveRevealed = series.prices.slice(0, revealedTicks);
  const chartHistory = priorPrices.concat(liveRevealed);
  const totalChartTicks = priorPrices.length + (series.prices.length - 1);
  const entryPrice = series.prices[0];
  const currentPrice = liveRevealed[liveRevealed.length - 1];

  const openPositions = (binaryGame.status === "revealing" || (binaryGame.status === "settled" && binaryGame.decision))
    ? [
        {
          id: `round-${binaryGame.round}`,
          symbol: series.label,
          direction: binaryGame.decision,
          stake: binaryGame.stake,
          entryPrice: formatBinaryPrice(entryPrice, series.digits),
          openedAt: Math.floor(Date.now() / 1000) - 5,
          expiresAt: Math.floor(Date.now() / 1000) + 10,
          secondsLeft: binaryGame.status === "revealing"
            ? Math.max(0, Math.ceil((binaryGame.revealEndsAt - performance.now()) / 1000))
            : 0,
        },
      ]
    : [];

  const notices = [];
  if (binaryGame.status === "won") notices.push("binaryGameCleared");
  if (binaryGame.status === "lost") notices.push("binaryGameOver");

  binaryState = {
    balance: binaryGame.balance,
    startingBalance: binaryGame.startingBalance,
    targetBalance: binaryGame.targetBalance,
    currency: "JPY",
    selectedSymbol: series.label,
    symbols: [DEFAULT_BINARY_SYMBOL],
    durations: [DEFAULT_BINARY_DURATION],
    defaultDuration: DEFAULT_BINARY_DURATION,
    minStake: BINARY_MIN_STAKE,
    payoutRate: BINARY_PAYOUT_RATE,
    tradingEnabled: binaryGame.status === "deciding",
    notices,
    openPositions,
    history: binaryGame.history,
    provider: { name: "Local Replay", code: "local" },
    quote: {
      symbol: series.label,
      price: currentPrice,
      displayPrice: formatBinaryPrice(currentPrice, series.digits),
    },
    chart: {
      symbol: series.label,
      history: chartHistory.slice(),
      elapsedSeconds: chartHistory.length - 1,
      totalSeconds: totalChartTicks,
      priceDigits: series.digits,
      currentPrice: formatBinaryPrice(currentPrice, series.digits),
      entryIndex: priorPrices.length,
      entryPrice: formatBinaryPrice(entryPrice, series.digits),
      priorTickSeconds: BINARY_PRIOR_SECONDS_PER_TICK,
    },
    caseInfo: {
      symbol: series.label,
      referenceDate: "",
      startedAt: null,
      started: binaryGame.status !== "idle",
      elapsedSeconds: liveRevealed.length - 1,
      totalSeconds: series.prices.length - 1,
      completed: binaryGame.status === "won" || binaryGame.status === "lost",
    },
    game: {
      status: binaryGame.status,
      round: binaryGame.round,
      decisionMsLeft: Math.max(0, binaryGame.decisionEndsAt - performance.now()),
      revealMsLeft: Math.max(0, binaryGame.revealEndsAt - performance.now()),
      decision: binaryGame.decision,
      result: binaryGame.result,
      profit: binaryGame.profit,
      stake: binaryGame.stake,
    },
  };
}

function renderBinarySummary() {
  const game = binaryState?.game || null;
  binaryBalance.textContent = formatYen(binaryState?.balance ?? BINARY_STARTING_BALANCE);
  binaryQuote.textContent = binaryState?.quote?.displayPrice || "--";
  binaryProvider.textContent = String(game?.round ?? 0);

  let line = "";
  if (!game || game.status === "idle") {
    line = getText("binaryStatusDefault");
  } else if (game.status === "deciding") {
    const seconds = Math.max(0, Math.ceil(game.decisionMsLeft / 1000));
    line = template(getText("binaryStatusDeciding"), { seconds });
  } else if (game.status === "revealing") {
    const seconds = Math.max(0, Math.ceil(game.revealMsLeft / 1000));
    line = template(getText("binaryStatusRevealing"), { seconds });
  } else if (game.status === "settled") {
    if (game.result === "won") {
      line = template(getText("binaryStatusSettledWon"), { profit: formatYen(game.profit, true) });
    } else if (game.result === "lost") {
      line = getText("binaryStatusSettledLost");
    } else if (game.result === "skipped") {
      line = getText("binaryStatusSkipped");
    } else {
      line = getText("binaryStatusSettledDraw");
    }
  } else if (game.status === "won") {
    line = getText("binaryStatusCleared");
  } else if (game.status === "lost") {
    line = getText("binaryStatusGameOver");
  }
  binaryStatusLine.textContent = line;

  const target = binaryState?.targetBalance ?? BINARY_STARTING_BALANCE * BINARY_TARGET_MULTIPLIER;
  binaryProviderLine.textContent = template(getText("binaryProgressLine"), {
    round: game?.round ?? 0,
    target: formatYen(target),
  });

  renderBinaryObjective();
}

function renderBinaryObjective() {
  if (!binaryObjectiveCard) return;
  const balance = binaryState?.balance ?? BINARY_STARTING_BALANCE;
  const target = binaryState?.targetBalance ?? BINARY_STARTING_BALANCE * BINARY_TARGET_MULTIPLIER;
  const status = binaryState?.game?.status || "idle";

  if (binaryObjectiveLabelEl) {
    binaryObjectiveLabelEl.textContent = getText("binaryObjectiveLabel");
  }
  if (binaryObjectiveTargetEl) {
    binaryObjectiveTargetEl.textContent = template(getText("binaryObjectiveTarget"), {
      target: formatYen(target),
    });
  }

  const progress = Math.max(0, Math.min(1, target > 0 ? balance / target : 0));
  if (binaryObjectiveFill) {
    binaryObjectiveFill.style.width = `${(progress * 100).toFixed(1)}%`;
  }
  if (binaryObjectiveDetailEl) {
    if (status === "won") {
      binaryObjectiveDetailEl.textContent = getText("binaryObjectiveCleared");
    } else if (status === "lost") {
      binaryObjectiveDetailEl.textContent = getText("binaryObjectiveFailed");
    } else {
      binaryObjectiveDetailEl.textContent = template(getText("binaryObjectiveDetail"), {
        current: formatYen(balance),
        remaining: formatYen(Math.max(0, target - balance)),
      });
    }
  }

  binaryObjectiveCard.dataset.status = status;
}

function renderBinaryPanel() {
  if (!binaryState) {
    return;
  }

  renderBinarySummary();
  renderBinaryControls();
  renderBinaryChart();

  const tradingEnabled = Boolean(binaryState.tradingEnabled);
  binaryUpButton.disabled = isBinaryBusy() || !tradingEnabled;
  binaryDownButton.disabled = isBinaryBusy() || !tradingEnabled;

  renderBinaryList(
    binaryOpenList,
    binaryState.openPositions,
    getText("binaryOpenEmpty"),
    renderOpenPositionItem,
  );
  renderBinaryList(
    binaryHistoryList,
    binaryState.history,
    getText("binaryHistoryEmpty"),
    renderHistoryItem,
  );
  if (selectedGame === "binary") {
    startBinaryTick();
  } else {
    stopBinaryTick();
  }
}

function renderBinaryControls() {
  const game = binaryState?.game || null;
  const status = game?.status || "idle";
  const busy = isBinaryBusy();

  binaryPairPicker.replaceChildren();
  const pairLabel = document.createElement("span");
  pairLabel.className = "binary-current-symbol";
  pairLabel.textContent = binaryState?.selectedSymbol || DEFAULT_BINARY_SYMBOL;
  binaryPairPicker.appendChild(pairLabel);

  binaryStartButton.textContent = (status === "won" || status === "lost")
    ? getText("binaryRestartAction")
    : getText("binaryRunningAction");
  binaryStartButton.disabled = busy || (status !== "won" && status !== "lost");

  binaryDurationPicker.replaceChildren();
  const durLabel = document.createElement("span");
  durLabel.className = "binary-current-duration";
  if (status === "deciding") {
    durLabel.textContent = template(getText("binaryDecidingTimer"), {
      seconds: Math.max(0, Math.ceil((game?.decisionMsLeft || 0) / 1000)),
    });
  } else if (status === "revealing") {
    durLabel.textContent = template(getText("binaryRevealingTimer"), {
      seconds: Math.max(0, Math.ceil((game?.revealMsLeft || 0) / 1000)),
    });
  } else if (status === "settled") {
    durLabel.textContent = getText("binarySettledLabel");
  } else if (status === "won") {
    durLabel.textContent = getText("binaryClearedLabel");
  } else if (status === "lost") {
    durLabel.textContent = getText("binaryGameOverLabel");
  } else {
    durLabel.textContent = template(getText("binarySeconds"), { seconds: BINARY_DECIDE_MS / 1000 });
  }
  binaryDurationPicker.appendChild(durLabel);

  binaryStakePresets.replaceChildren();
  const decidingActive = status === "deciding";
  binaryStakeInput.disabled = busy || !decidingActive;
  BINARY_STAKE_PRESETS.forEach((stake) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = template(getText("binaryStakePreset"), { amount: formatInteger(stake) });
    button.classList.toggle("active", stake === getCurrentStake());
    button.setAttribute("aria-pressed", String(stake === getCurrentStake()));
    button.disabled = busy || !decidingActive;
    button.addEventListener("click", () => {
      binaryStakeInput.value = String(stake);
      renderBinaryControls();
    });
    binaryStakePresets.appendChild(button);
  });
}

function renderBinaryChart() {
  const chart = binaryState?.chart;
  if (!chart || !Array.isArray(chart.history) || chart.history.length === 0) {
    binaryChartPath.setAttribute("d", "");
    binaryChartFuture.setAttribute("d", "");
    binaryChartProgress.setAttribute("x1", "0");
    binaryChartProgress.setAttribute("x2", "0");
    binaryChartPoint.setAttribute("cx", "0");
    binaryChartPoint.setAttribute("cy", "0");
    binaryChartNow.textContent = getText("binaryChartPending");
    binaryChartRange.textContent = getText("binaryChartPending");
    binaryChartMin.textContent = "--";
    binaryChartMax.textContent = "--";
    binaryChartTicks.forEach((tick) => {
      tick.textContent = "--:--";
    });
    return;
  }

  const totalSeconds = Math.max(1, Number(chart.totalSeconds) || (chart.history.length - 1));
  const digits = Number(chart.priceDigits) || 3;
  const revealedPrices = chart.history.slice();
  const minPrice = Math.min(...revealedPrices);
  const maxPrice = Math.max(...revealedPrices);
  const spread = Math.max(maxPrice - minPrice, Number.EPSILON);
  const padding = spread * 0.4;
  const visualMin = minPrice - padding;
  const visualMax = maxPrice + padding;
  const visualSpread = Math.max(visualMax - visualMin, Number.EPSILON);

  const revealedPoints = revealedPrices.map((price, index) => {
    const x = (index / totalSeconds) * 100;
    const y = 30 - (((price - visualMin) / visualSpread) * 24);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const currentPoint = revealedPoints.length > 0 ? revealedPoints[revealedPoints.length - 1].split(",") : ["0", "0"];
  const entryIndexRaw = Number(chart.entryIndex);
  const entryIndex = Number.isFinite(entryIndexRaw) ? Math.max(0, Math.min(totalSeconds, entryIndexRaw)) : 0;
  const entryX = ((entryIndex / totalSeconds) * 100).toFixed(2);

  binaryChartPath.setAttribute("d", buildPolylinePath(revealedPoints));
  binaryChartFuture.setAttribute("d", "");
  binaryChartProgress.setAttribute("x1", entryX);
  binaryChartProgress.setAttribute("x2", entryX);
  binaryChartPoint.setAttribute("cx", currentPoint[0]);
  binaryChartPoint.setAttribute("cy", currentPoint[1]);
  binaryChartNow.textContent = template(getText("binaryChartNow"), {
    price: formatBinaryPrice(revealedPrices[revealedPrices.length - 1], digits),
  });
  binaryChartRange.textContent = template(getText("binaryChartRange"), {
    min: formatBinaryPrice(minPrice, digits),
    max: formatBinaryPrice(maxPrice, digits),
  });
  binaryChartMin.textContent = formatBinaryPrice(minPrice, digits);
  binaryChartMax.textContent = formatBinaryPrice(maxPrice, digits);
  renderBinaryChartTicks(entryIndex, totalSeconds, Number(chart.priorTickSeconds) || 1);
  renderBinaryChartOverlay();
}

function renderBinaryChartOverlay() {
  if (!binaryChartTimer || !binaryChartOverlay) return;
  const game = binaryState?.game || null;
  const status = game?.status || "idle";
  if (status === "deciding") {
    binaryChartTimer.textContent = String(Math.max(0, Math.ceil((game?.decisionMsLeft || 0) / 1000)));
    binaryChartOverlay.dataset.phase = "deciding";
  } else if (status === "revealing") {
    binaryChartTimer.textContent = String(Math.max(0, Math.ceil((game?.revealMsLeft || 0) / 1000)));
    binaryChartOverlay.dataset.phase = "revealing";
  } else if (status === "settled") {
    binaryChartTimer.textContent = game?.result === "won"
      ? getText("binaryResultWon")
      : game?.result === "lost"
        ? getText("binaryResultLost")
        : game?.result === "draw"
          ? getText("binaryResultDraw")
          : getText("binaryStatusSkipped");
    binaryChartOverlay.dataset.phase = "settled";
  } else if (status === "won") {
    binaryChartTimer.textContent = getText("binaryClearedLabel");
    binaryChartOverlay.dataset.phase = "won";
  } else if (status === "lost") {
    binaryChartTimer.textContent = getText("binaryGameOverLabel");
    binaryChartOverlay.dataset.phase = "lost";
  } else {
    binaryChartTimer.textContent = "--";
    binaryChartOverlay.dataset.phase = "idle";
  }
}

function buildPolylinePath(points) {
  if (!points || points.length === 0) {
    return "";
  }
  return `M ${points[0]}${points.slice(1).map((point) => ` L ${point}`).join("")}`;
}

function renderBinaryChartTicks(entryIndex, totalIndex, priorTickSeconds) {
  if (!binaryChartTicks.length) {
    return;
  }

  const tickCount = binaryChartTicks.length;
  binaryChartTicks.forEach((tick, index) => {
    const ratio = tickCount === 1 ? 1 : index / (tickCount - 1);
    const positionIndex = ratio * totalIndex;
    let seconds;
    if (positionIndex <= entryIndex) {
      seconds = -(entryIndex - positionIndex) * (priorTickSeconds || 1);
    } else {
      seconds = positionIndex - entryIndex;
    }
    tick.textContent = formatBinaryAxisLabel(seconds);
  });
}

function formatBinaryAxisLabel(seconds) {
  if (!Number.isFinite(seconds)) return "--:--";
  if (Math.abs(seconds) < 0.5) {
    return getText("binaryAxisEntry");
  }
  if (seconds < 0) {
    const abs = Math.round(Math.abs(seconds));
    const minutes = Math.floor(abs / 60);
    const secs = abs % 60;
    if (currentLanguage === "ja") {
      if (minutes === 0) return `${secs}秒前`;
      if (secs === 0) return `${minutes}分前`;
      return `${minutes}分${secs}秒前`;
    }
    if (minutes === 0) return `-${secs}s`;
    return `-${minutes}:${String(secs).padStart(2, "0")}`;
  }
  const rounded = Math.round(seconds);
  if (currentLanguage === "ja") return `判定+${rounded}秒`;
  return `+${rounded}s`;
}

function renderBinaryList(target, items, emptyText, renderItem) {
  target.replaceChildren();
  if (!items || items.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "binary-empty";
    emptyItem.textContent = emptyText;
    target.appendChild(emptyItem);
    return;
  }

  items.forEach((item) => {
    target.appendChild(renderItem(item));
  });
}

function renderOpenPositionItem(position) {
  const item = document.createElement("li");
  const top = document.createElement("div");
  top.className = "binary-line-top";
  const bottom = document.createElement("div");
  bottom.className = "binary-line-bottom";

  const symbol = document.createElement("span");
  symbol.className = "binary-symbol";
  symbol.textContent = position.symbol;

  const direction = document.createElement("span");
  direction.className = `binary-direction ${position.direction}`;
  direction.textContent = position.direction === "up" ? getText("binaryDirectionUp") : getText("binaryDirectionDown");

  const stake = document.createElement("strong");
  stake.textContent = formatYen(position.stake);

  const countdown = document.createElement("span");
  countdown.textContent = template(getText("binaryOpenCountdown"), { seconds: position.secondsLeft });

  const opened = document.createElement("span");
  opened.textContent = template(getText("binaryOpenedAt"), { time: formatTime(position.openedAt) });

  const entry = document.createElement("span");
  entry.textContent = template(getText("binaryEntryPrice"), { price: position.entryPrice });

  top.append(symbol, direction, stake);
  bottom.append(countdown, entry, opened);
  item.append(top, bottom);
  return item;
}

function renderHistoryItem(position) {
  const item = document.createElement("li");
  const top = document.createElement("div");
  top.className = "binary-line-top";
  const bottom = document.createElement("div");
  bottom.className = "binary-line-bottom";

  const symbol = document.createElement("span");
  symbol.className = "binary-symbol";
  symbol.textContent = position.symbol;

  const result = document.createElement("span");
  result.className = `binary-result ${position.result}`;
  result.textContent =
    position.result === "won"
      ? getText("binaryResultWon")
      : position.result === "lost"
        ? getText("binaryResultLost")
        : getText("binaryResultDraw");

  const payout = document.createElement("strong");
  payout.textContent = formatYen(position.payout);

  const settled = document.createElement("span");
  settled.textContent = template(getText("binarySettledAt"), { time: formatTime(position.settledAt) });

  const exit = document.createElement("span");
  exit.textContent = template(getText("binaryExitPrice"), { price: position.exitPrice });

  const profit = document.createElement("span");
  profit.textContent = template(getText("binaryProfit"), { amount: formatYen(position.profit, true) });

  top.append(symbol, result, payout);
  bottom.append(profit, exit, settled);
  item.append(top, bottom);
  return item;
}

function getCurrentStake() {
  normalizeStakeInput();
  const parsed = Number(binaryStakeInput.value);
  return Number.isFinite(parsed) ? parsed : DEFAULT_BINARY_STAKE;
}

function normalizeStakeInput() {
  const minimum = binaryState?.minStake || 1_000;
  const parsed = Number(binaryStakeInput.value);
  if (!Number.isFinite(parsed) || parsed < minimum) {
    binaryStakeInput.value = String(Math.max(minimum, DEFAULT_BINARY_STAKE));
    return;
  }
  binaryStakeInput.value = String(Math.round(parsed / 1000) * 1000);
}

function formatInteger(value) {
  return new Intl.NumberFormat(currentLanguage === "ja" ? "ja-JP" : "en-US").format(value);
}

function formatDistanceKm(value) {
  return Number(value || 0).toLocaleString(currentLanguage === "ja" ? "ja-JP" : "en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function formatYen(value, signed = false) {
  const locale = currentLanguage === "ja" ? "ja-JP" : "en-US";
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
    signDisplay: signed ? "always" : "auto",
  });
  return formatter.format(value || 0);
}

function formatBinaryPrice(value, digits) {
  return Number(value || 0).toLocaleString(currentLanguage === "ja" ? "ja-JP" : "en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatBinaryElapsed(value) {
  const locale = currentLanguage === "ja" ? "ja-JP" : "en-US";
  const rounded = Math.floor((Number(value) || 0) * 10) / 10;
  const hasFraction = Math.abs(rounded - Math.round(rounded)) > 0.001;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: hasFraction ? 1 : 0,
    maximumFractionDigits: 1,
  }).format(rounded);
}

function formatElapsedClock(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return "--:--";
  }
  const rounded = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatTime(epochSeconds) {
  return new Intl.DateTimeFormat(currentLanguage === "ja" ? "ja-JP" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(epochSeconds * 1000));
}

function providerLabel(providerName, providerCode) {
  if (providerCode === "live") {
    return getText("binaryProviderNameLive");
  }
  if (providerCode === "daily") {
    return getText("binaryProviderNameDaily");
  }
  if (providerCode === "historical") {
    return getText("binaryProviderNameHistorical");
  }
  return providerName || getText("binaryProviderNameUnavailable");
}

function composeBinaryNotice(state) {
  const notices = [];
  if (binaryTransientMessage) {
    notices.push(getText(binaryTransientMessage));
  }
  if (state?.notices) {
    state.notices.forEach((code) => notices.push(getBinaryNotice(code)));
  }
  if (notices.length === 0) {
    notices.push(getText("binaryProviderDefault"));
  }
  return Array.from(new Set(notices)).join(" ");
}

function startBinaryTick() {
  if (binaryTickInterval !== null) {
    return;
  }
  binaryTickInterval = window.setInterval(() => {
    if (selectedGame !== "binary") {
      stopBinaryTick();
      return;
    }
    try {
      tickBinaryGame();
    } catch (error) {
      showBinaryError(error);
    }
  }, 100);
}

function stopBinaryTick() {
  if (binaryTickInterval !== null) {
    window.clearInterval(binaryTickInterval);
    binaryTickInterval = null;
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function showMinesError(error) {
  minesTransientMessage = error && error.message ? error.message : "Request failed";
  if (currentState) {
    statusElement.textContent = getErrorText(minesTransientMessage);
  } else {
    renderGameShell();
  }
}

function showBinaryError(error) {
  binaryTransientMessage = error && error.message ? error.message : "Request failed";
  renderGameShell();
}

// ── Fireworks Celebration ─────────────────────────────────────────────────

const FIREWORKS_COLORS = [
  "#ff5d6c", "#ffc857", "#7afcff", "#a8ff60", "#ff9efb", "#ffffff", "#ffae42",
];

let fireworksCanvas = null;
let fireworksCtx = null;
let fireworksParticles = [];
let fireworksRafId = null;
let fireworksEndAt = 0;
let fireworksLastShotAt = 0;
let fireworksHideTimer = null;

function ensureFireworksCanvas() {
  if (fireworksCanvas) return;
  fireworksCanvas = document.createElement("canvas");
  fireworksCanvas.className = "fireworks-canvas";
  fireworksCanvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(fireworksCanvas);
  fireworksCtx = fireworksCanvas.getContext("2d");
  resizeFireworksCanvas();
  window.addEventListener("resize", resizeFireworksCanvas);
}

function resizeFireworksCanvas() {
  if (!fireworksCanvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  fireworksCanvas.width = Math.floor(window.innerWidth * dpr);
  fireworksCanvas.height = Math.floor(window.innerHeight * dpr);
  fireworksCanvas.style.width = `${window.innerWidth}px`;
  fireworksCanvas.style.height = `${window.innerHeight}px`;
  if (fireworksCtx) {
    fireworksCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}

function spawnFireworkBurst(x, y) {
  const color = FIREWORKS_COLORS[Math.floor(Math.random() * FIREWORKS_COLORS.length)];
  const count = 60 + Math.floor(Math.random() * 30);
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.12;
    const speed = 2 + Math.random() * 4;
    fireworksParticles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      decay: 0.011 + Math.random() * 0.012,
      color,
      size: 1.6 + Math.random() * 1.6,
    });
  }
}

function tickFireworks(now) {
  if (!fireworksCtx || !fireworksCanvas) return;
  const ctx = fireworksCtx;
  const w = window.innerWidth;
  const h = window.innerHeight;

  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "lighter";

  if (now < fireworksEndAt && now - fireworksLastShotAt > 260) {
    fireworksLastShotAt = now;
    const x = w * (0.15 + Math.random() * 0.7);
    const y = h * (0.15 + Math.random() * 0.4);
    spawnFireworkBurst(x, y);
  }

  for (let i = fireworksParticles.length - 1; i >= 0; i--) {
    const p = fireworksParticles[i];
    p.vy += 0.045;
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.99;
    p.vy *= 0.99;
    p.life -= p.decay;
    if (p.life <= 0) {
      fireworksParticles.splice(i, 1);
      continue;
    }
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (fireworksParticles.length > 0 || now < fireworksEndAt) {
    fireworksRafId = requestAnimationFrame(tickFireworks);
  } else {
    fireworksRafId = null;
    if (fireworksCanvas) {
      fireworksCanvas.classList.remove("active");
      fireworksHideTimer = window.setTimeout(() => {
        if (fireworksCtx) {
          fireworksCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        }
        fireworksHideTimer = null;
      }, 400);
    }
  }
}

function celebrateWithFireworks(durationMs = 3200) {
  ensureFireworksCanvas();
  resizeFireworksCanvas();
  fireworksCanvas.classList.add("active");
  if (fireworksHideTimer) {
    window.clearTimeout(fireworksHideTimer);
    fireworksHideTimer = null;
  }
  const now = performance.now();
  fireworksEndAt = Math.max(fireworksEndAt, now + durationMs);
  spawnFireworkBurst(window.innerWidth * 0.5, window.innerHeight * 0.35);
  fireworksLastShotAt = now;
  if (!fireworksRafId) {
    fireworksRafId = requestAnimationFrame(tickFireworks);
  }
}

function initLogoScene() {
  const stage = document.getElementById("orbit-stage");
  const canvasHost = document.getElementById("seeton-canvas");
  if (!stage || !canvasHost) {
    return;
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  const logoRoot = new THREE.Group();
  const clock = new THREE.Clock();

  let logoContent = null;
  const intro = {
    active: true,
    duration: 4.0,
    interval: 8.0,
    elapsed: 0,
    idleElapsed: 0,
    startRotationX: -Math.PI * 1.06,
    startRotationY: -Math.PI * 3.15,
    startRotationZ: Math.PI * 0.38,
    fromRotationX: -Math.PI * 1.06,
    fromRotationY: -Math.PI * 3.15,
    fromRotationZ: Math.PI * 0.38,
    targetRotationX: 0,
    targetRotationY: 0,
    targetRotationZ: 0,
  };

  const drag = {
    active: false,
    pointerId: null,
    lastX: 0,
    lastY: 0,
    velocityX: 0,
    velocityY: 0,
  };

  const motion = {
    rotationX: intro.startRotationX,
    rotationY: intro.startRotationY,
    rotationZ: intro.startRotationZ,
    idleSpinX: 0.0024,
    idleSpinY: 0.0073,
    idleSpinZ: -0.00088,
  };

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.domElement.setAttribute("aria-hidden", "true");

  canvasHost.replaceWith(renderer.domElement);

  scene.add(logoRoot);
  camera.position.set(0, 0.16, 18.8);

  createLights(scene);
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

  function createLights(targetScene) {
    const ambient = new THREE.AmbientLight(0xe8eef5, 1.4);
    const key = new THREE.DirectionalLight(0xffffff, 2.8);
    const rim = new THREE.DirectionalLight(0x89b7ff, 1.3);
    const fill = new THREE.PointLight(0x10243d, 8, 32, 2);

    key.position.set(7, 9, 10);
    rim.position.set(-9, 4, -8);
    fill.position.set(0, -1.8, 8);

    targetScene.add(ambient);
    targetScene.add(key);
    targetScene.add(rim);
    targetScene.add(fill);
  }

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

  function loadLogo() {
    const loader = new FontLoader();

    loader.load(
      "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/fonts/helvetiker_bold.typeface.json",
      (font) => {
        const geometry = new TextGeometry("SEETON", {
          font,
          size: 4.8,
          depth: 0.18,
          curveSegments: 10,
          bevelEnabled: true,
          bevelThickness: 0.012,
          bevelSize: 0.01,
          bevelOffset: 0,
          bevelSegments: 3,
        });
        const faceMaterial = new THREE.MeshStandardMaterial({
          color: 0xf3f6fb,
          emissive: 0x0a1120,
          emissiveIntensity: 0.05,
          metalness: 0.12,
          roughness: 0.28,
        });
        const sideMaterial = new THREE.MeshStandardMaterial({
          color: 0x1b3955,
          emissive: 0x08111d,
          emissiveIntensity: 0.04,
          metalness: 0.16,
          roughness: 0.42,
        });
        const mesh = new THREE.Mesh(geometry, [faceMaterial, sideMaterial]);

        geometry.computeBoundingBox();
        geometry.center();
        geometry.computeVertexNormals();

        mesh.userData.depthScale = 0.16;

        logoContent = mesh;
        logoRoot.add(mesh);
        measureLogo();
        updateLogoScale();
        stage.classList.add("is-ready");
      },
      undefined,
      () => {
        stage.classList.add("is-ready");
      },
    );
  }

  function normalizeAngle(angle) {
    const fullTurn = Math.PI * 2;
    return ((angle + Math.PI) % fullTurn + fullTurn) % fullTurn - Math.PI;
  }

  function beginIntro(fromCurrent = false) {
    intro.active = true;
    intro.elapsed = 0;
    intro.idleElapsed = 0;

    if (fromCurrent) {
      const currentX = logoRoot.rotation.x;
      const currentY = logoRoot.rotation.y;
      const currentZ = logoRoot.rotation.z;
      const normalizedY = THREE.MathUtils.euclideanModulo(currentY, Math.PI * 2);
      const extraTurns = Math.PI * 4;
      const forwardToFront = normalizedY === 0 ? 0 : (Math.PI * 2) - normalizedY;

      intro.fromRotationX = currentX;
      intro.fromRotationY = currentY;
      intro.fromRotationZ = currentZ;
      intro.targetRotationX = 0;
      intro.targetRotationY = currentY + extraTurns + forwardToFront;
      intro.targetRotationZ = 0;
      return;
    }

    intro.fromRotationX = intro.startRotationX;
    intro.fromRotationY = intro.startRotationY;
    intro.fromRotationZ = intro.startRotationZ;
    intro.targetRotationX = 0;
    intro.targetRotationY = 0;
    intro.targetRotationZ = 0;
  }

  function resize() {
    const rect = stage.getBoundingClientRect();
    camera.aspect = rect.width / rect.height;
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
    const distance = camera.position.z - logoRoot.position.z;
    const verticalFov = THREE.MathUtils.degToRad(camera.fov);
    const visibleHeight = 2 * Math.tan(verticalFov / 2) * distance;
    const visibleWidth = visibleHeight * camera.aspect;
    const targetWidth = visibleWidth * 0.82;
    const targetHeight = visibleHeight * 0.46;
    const scale = Math.min(
      targetWidth / logoContent.userData.baseWidth,
      targetHeight / logoContent.userData.baseHeight,
    );
    const depthScale = logoContent.userData.depthScale || 1;
    logoContent.scale.set(scale, scale, scale * depthScale);
  }

  function onPointerDown(event) {
    cancelIntro();
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

  function cancelIntro() {
    if (!intro.active) {
      return;
    }
    intro.active = false;
    intro.idleElapsed = 0;
    motion.rotationX = logoRoot.rotation.x;
    motion.rotationY = logoRoot.rotation.y;
    motion.rotationZ = logoRoot.rotation.z;
  }

  function renderFrame() {
    const delta = Math.min(clock.getDelta(), 0.033);
    const bob = Math.sin(clock.elapsedTime * 1.05) * 0.06;

    if (intro.active) {
      intro.elapsed = Math.min(intro.elapsed + delta, intro.duration);
      const progress = intro.elapsed / intro.duration;
      const eased = 1 - ((1 - progress) ** 4);
      const diagonalArc = Math.sin(progress * Math.PI);
      motion.rotationX = THREE.MathUtils.lerp(intro.fromRotationX, intro.targetRotationX, eased) + diagonalArc * 0.16;
      motion.rotationY = THREE.MathUtils.lerp(intro.fromRotationY, intro.targetRotationY, eased);
      motion.rotationZ = THREE.MathUtils.lerp(intro.fromRotationZ, intro.targetRotationZ, eased) + diagonalArc * 0.08;
      drag.velocityY = 0;
      drag.velocityX = 0;
      logoRoot.rotation.x = motion.rotationX;
      logoRoot.rotation.y = motion.rotationY;
      logoRoot.rotation.z = motion.rotationZ;

      if (progress >= 1) {
        intro.active = false;
        intro.idleElapsed = 0;
        motion.rotationX = normalizeAngle(intro.targetRotationX);
        motion.rotationY = normalizeAngle(intro.targetRotationY);
        motion.rotationZ = normalizeAngle(intro.targetRotationZ);
        logoRoot.rotation.x = motion.rotationX;
        logoRoot.rotation.y = motion.rotationY;
        logoRoot.rotation.z = motion.rotationZ;
      }
    } else if (!drag.active) {
      intro.idleElapsed += delta;
      if (intro.idleElapsed >= intro.interval) {
        beginIntro(true);
      } else {
        drag.velocityY += (motion.idleSpinY - drag.velocityY) * 0.04;
        drag.velocityX += (motion.idleSpinX - drag.velocityX) * 0.04;
        motion.rotationZ += motion.idleSpinZ;
      }
    } else {
      drag.velocityY *= 0.98;
      drag.velocityX *= 0.98;
    }

    motion.rotationY += drag.velocityY;
    motion.rotationX += drag.velocityX;

    if (!intro.active) {
      logoRoot.rotation.x += (motion.rotationX - logoRoot.rotation.x) * Math.min(1, delta * 10);
      logoRoot.rotation.y += (motion.rotationY - logoRoot.rotation.y) * Math.min(1, delta * 9);
      logoRoot.rotation.z += (motion.rotationZ - logoRoot.rotation.z) * Math.min(1, delta * 7);
    }
    logoRoot.position.y = bob;

    renderer.render(scene, camera);
  }
}
