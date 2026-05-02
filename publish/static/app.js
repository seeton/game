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

// 10 bundled USD/JPY historical-style price series. Each entry has the entry
// tick at index 0 followed by 10 one-second reveal ticks (11 prices total).
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
    navSignal: "Signal",
    navLaunch: "Launch",
    languageGroupLabel: "言語切替",
    languageLabel: "LANGUAGE",
    playSectionLabel: "GAME SHELF",
    playSectionTitle: "遊ぶゲームを選ぶ。",
    playSectionBody: "いま遊べるものと、次に並べる予定のものを同じ棚に置いています。",
    gameLibraryAria: "ゲーム選択棚",
    sceneBadge: "FREE ROTATION",
    sceneNote: "drag / swipe / spin",
    orbitAria: "自由に回せる SEETON の 3D ロゴ",
    signalSectionLabel: "SIGNAL",
    signalSectionTitle: "何が遊べるかを先に見せる。",
    signalSectionBody: "上から棚、プレイ画面、ロゴの順で見えるので、触ってすぐ遊べる構成です。",
    signalCard1Label: "SHELF",
    signalCard1Title: "複数ゲームを最初から並べる",
    signalCard1Body: "プレイ中のものと、次に追加するものを同じ棚で見せます。",
    signalCard2Label: "LOAD",
    signalCard2Title: "選んだ時点で準備を始める",
    signalCard2Body: "サムネイルを押したら、その場で読み込みに入り、待ち時間を表示します。",
    signalCard3Label: "FX",
    signalCard3Title: "通貨連動の枠も同じ場所で遊ぶ",
    signalCard3Body: "バイナリシミュレーションはサーバー側でレートを取得して状態を持ちます。",
    launchLabel: "LAUNCH",
    launchTitle: "棚を増やしながらホームを育てる。",
    launchBody:
      "いまはマインスイーパーとバイナリが動き、他のゲームは次の追加候補として並べています。",
    flow1Label: "Choose",
    flow1Body: "棚からゲームを選ぶと、その場で準備が始まります。",
    flow2Label: "Watch",
    flow2Body: "読み込み中か、まだ未実装かを同じ画面で判断できます。",
    flow3Label: "Play",
    flow3Body: "プレイ画面は上部に説明と操作、下部にゲーム本体を置いています。",
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
    planetStateLabel: "状態",
    planetControlAdd: "クリックまたはタップで天体を追加。",
    planetControlNote: "天体同士は引き合い、近づきすぎると合体します。",
    planetPause: "一時停止",
    planetResume: "再開",
    planetReset: "リセット",
    planetHint: "キャンバスをクリックして天体を追加。最大20個まで。",
    planetStateRunning: "動作中",
    planetStatePaused: "一時停止",
    planetStateEmpty: "空",
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
        panelTitle: "惑星シミュレーション",
        panelBody: "クリックで天体を追加して重力軌道を観察できます。",
        promptTitle: "惑星シミュレーション",
        promptBody: "キャンバスをクリックして天体を追加してください。",
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
    navSignal: "Signal",
    navLaunch: "Launch",
    languageGroupLabel: "Language switcher",
    languageLabel: "LANGUAGE",
    playSectionLabel: "GAME SHELF",
    playSectionTitle: "Choose a game to play.",
    playSectionBody: "Playable games and the next planned slots sit on the same shelf.",
    gameLibraryAria: "Game selection shelf",
    sceneBadge: "FREE ROTATION",
    sceneNote: "drag / swipe / spin",
    orbitAria: "A freely rotatable 3D SEETON logo",
    signalSectionLabel: "SIGNAL",
    signalSectionTitle: "Show what is playable first.",
    signalSectionBody: "The page is ordered as shelf, active panel, then logo, so the playable area is obvious.",
    signalCard1Label: "SHELF",
    signalCard1Title: "Show several games from the start",
    signalCard1Body: "The live game and the next planned games sit together in the same shelf.",
    signalCard2Label: "LOAD",
    signalCard2Title: "Start preparing as soon as a card is chosen",
    signalCard2Body: "Clicking a thumbnail starts loading immediately and keeps the wait visible.",
    signalCard3Label: "FX",
    signalCard3Title: "Keep the currency-linked slot in the same place",
    signalCard3Body: "The binary simulation keeps account state on the server and fetches market rates there.",
    launchLabel: "LAUNCH",
    launchTitle: "Grow the homepage by extending the shelf.",
    launchBody: "Minesweeper and the binary simulation work now, while the other game slots wait beside them.",
    flow1Label: "Choose",
    flow1Body: "Picking a shelf card starts preparation immediately.",
    flow2Label: "Watch",
    flow2Body: "The same panel tells you whether the game is loading or simply not built yet.",
    flow3Label: "Play",
    flow3Body: "Instructions stay above and the game surface stays below.",
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
    planetStateLabel: "STATE",
    planetControlAdd: "Click or tap to add a body.",
    planetControlNote: "Bodies attract each other and merge when they get too close.",
    planetPause: "Pause",
    planetResume: "Resume",
    planetReset: "Clear",
    planetHint: "Click the canvas to add a body. Up to 20.",
    planetStateRunning: "Running",
    planetStatePaused: "Paused",
    planetStateEmpty: "Empty",
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
        panelTitle: "Planet Simulation",
        panelBody: "Click the canvas to add bodies and watch gravity pull them together.",
        promptTitle: "Planet Simulation",
        promptBody: "Click the canvas to add a body.",
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
const planetStateTextEl = document.getElementById("planet-state-text");
const planetPauseButton = document.getElementById("planet-pause-button");
const planetResetButton = document.getElementById("planet-reset-button");
const planetCanvas = document.getElementById("planet-canvas");
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
let planetRunning = false;
let planetAnimFrame = null;
let planetCtx = null;
let planetResizeFrame = null;
let planetPausedByUser = false;
let mgmtState = null;
let solitaireState = null;
let solitaireTimerInterval = null;

applyTranslations();
syncDifficultyButtons();
renderGameShell();
maybeAutoLoadSelectedGame();
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
  if (planetBodies.length >= PLANET_MAX_BODIES) return;
  const rect = planetCanvas.getBoundingClientRect();
  const scaleX = planetCanvas.width / rect.width;
  const scaleY = planetCanvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;
  planetBodies.push(createPlanetBody(x, y));
  planetPausedByUser = false;
  if (!planetRunning) startPlanetLoop();
  renderPlanetToolbar();
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
  planetPausedByUser = false;
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

const PLANET_G = 180;
const PLANET_MAX_BODIES = 20;

function initPlanetCanvas() {
  if (!planetCtx) {
    planetCtx = planetCanvas.getContext("2d");
  }
  resizePlanetCanvas(true);
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

function createPlanetBody(x, y) {
  const mass = 3 + Math.random() * 7;
  const radius = Math.max(4, Math.cbrt(mass) * 2.5);
  const hue = Math.floor(Math.random() * 360);
  const cx = (planetCanvas.width || 600) / 2;
  const cy = (planetCanvas.height || 400) / 2;
  const dx = x - cx;
  const dy = y - cy;
  const speed = 25 + Math.random() * 45;
  const angle = Math.atan2(dy, dx) + Math.PI / 2 + (Math.random() - 0.5) * 0.8;
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    mass,
    radius,
    hue,
    color: `hsl(${hue}, 70%, 65%)`,
    trailColor: `hsla(${hue}, 70%, 45%, 0.25)`,
    trail: [],
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
      const f = PLANET_G / r2;
      const fx = (f * dx) / r;
      const fy = (f * dy) / r;
      ax[i] += fx * planetBodies[j].mass;
      ay[i] += fy * planetBodies[j].mass;
      ax[j] -= fx * planetBodies[i].mass;
      ay[j] -= fy * planetBodies[i].mass;
    }
  }

  for (let i = 0; i < n; i++) {
    planetBodies[i].vx += ax[i] * dt;
    planetBodies[i].vy += ay[i] * dt;
    planetBodies[i].trail.push({ x: planetBodies[i].x, y: planetBodies[i].y });
    if (planetBodies[i].trail.length > 28) {
      planetBodies[i].trail.shift();
    }
    planetBodies[i].x += planetBodies[i].vx * dt;
    planetBodies[i].y += planetBodies[i].vy * dt;
  }

  const merged = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (merged[i]) continue;
    for (let j = i + 1; j < n; j++) {
      if (merged[j]) continue;
      const dx = planetBodies[j].x - planetBodies[i].x;
      const dy = planetBodies[j].y - planetBodies[i].y;
      const r = Math.sqrt(dx * dx + dy * dy);
      if (r < (planetBodies[i].radius + planetBodies[j].radius) * 0.85) {
        const tm = planetBodies[i].mass + planetBodies[j].mass;
        planetBodies[i].x =
          (planetBodies[i].x * planetBodies[i].mass + planetBodies[j].x * planetBodies[j].mass) / tm;
        planetBodies[i].y =
          (planetBodies[i].y * planetBodies[i].mass + planetBodies[j].y * planetBodies[j].mass) / tm;
        planetBodies[i].vx =
          (planetBodies[i].vx * planetBodies[i].mass + planetBodies[j].vx * planetBodies[j].mass) / tm;
        planetBodies[i].vy =
          (planetBodies[i].vy * planetBodies[i].mass + planetBodies[j].vy * planetBodies[j].mass) / tm;
        planetBodies[i].mass = tm;
        planetBodies[i].radius = Math.max(4, Math.cbrt(tm) * 2.5);
        planetBodies[i].trail = [];
        merged[j] = 1;
      }
    }
  }

  if (merged.some((v) => v)) {
    planetBodies = planetBodies.filter((_, i) => !merged[i]);
    renderPlanetToolbar();
  }
}

function drawPlanets() {
  if (!planetCtx) return;
  const ctx = planetCtx;
  const w = planetCanvas.width;
  const h = planetCanvas.height;

  ctx.fillStyle = "rgba(3, 8, 20, 0.22)";
  ctx.fillRect(0, 0, w, h);

  for (const body of planetBodies) {
    if (body.trail.length > 1) {
      ctx.beginPath();
      ctx.moveTo(body.trail[0].x, body.trail[0].y);
      for (let i = 1; i < body.trail.length; i++) {
        ctx.lineTo(body.trail[i].x, body.trail[i].y);
      }
      ctx.strokeStyle = body.trailColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    const grd = ctx.createRadialGradient(body.x, body.y, 0, body.x, body.y, body.radius * 2.5);
    grd.addColorStop(0, body.color);
    grd.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(body.x, body.y, body.radius * 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = body.color;
    ctx.beginPath();
    ctx.arc(body.x, body.y, body.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function renderPlanetToolbar() {
  planetBodyCountEl.textContent = String(planetBodies.length);
  if (planetBodies.length === 0) {
    planetStateTextEl.textContent = getText("planetStateEmpty");
    planetPauseButton.textContent = getText("planetPause");
    planetPauseButton.disabled = true;
  } else {
    planetPauseButton.disabled = false;
    if (planetRunning) {
      planetStateTextEl.textContent = getText("planetStateRunning");
      planetPauseButton.textContent = getText("planetPause");
    } else {
      planetStateTextEl.textContent = getText("planetStatePaused");
      planetPauseButton.textContent = getText("planetResume");
    }
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
  const revealed = binaryGame.status === "deciding"
    ? series.prices.slice(0, 1)
    : series.prices.slice(0, Math.max(1, binaryGame.revealedTicks));
  const currentPrice = revealed[revealed.length - 1];
  const entryPrice = series.prices[0];

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
      history: revealed.slice(),
      elapsedSeconds: revealed.length - 1,
      totalSeconds: series.prices.length - 1,
      priceDigits: series.digits,
      currentPrice: formatBinaryPrice(currentPrice, series.digits),
    },
    caseInfo: {
      symbol: series.label,
      referenceDate: "",
      startedAt: null,
      started: binaryGame.status !== "idle",
      elapsedSeconds: revealed.length - 1,
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
  const progressX = currentPoint[0];

  binaryChartPath.setAttribute("d", buildPolylinePath(revealedPoints));
  binaryChartFuture.setAttribute("d", "");
  binaryChartProgress.setAttribute("x1", progressX);
  binaryChartProgress.setAttribute("x2", progressX);
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
  renderBinaryChartTicks(0, totalSeconds);
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

function renderBinaryChartTicks(windowStartElapsed, windowEndElapsed) {
  if (!binaryChartTicks.length) {
    return;
  }

  const tickCount = binaryChartTicks.length;
  binaryChartTicks.forEach((tick, index) => {
    const ratio = tickCount === 1 ? 1 : index / (tickCount - 1);
    const elapsed = windowStartElapsed + ((windowEndElapsed - windowStartElapsed) * ratio);
    tick.textContent = formatElapsedClock(elapsed);
  });
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
