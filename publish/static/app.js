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
  planet: { available: false },
  management: { available: false },
  solitaire: { available: false },
};

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
    gamePlanetChip: "COMING SOON",
    gamePlanetTitle: "惑星シミュレーション",
    gamePlanetBody: "重力や軌道を触って遊ぶ枠を先に置いています。",
    gameManagementChip: "COMING SOON",
    gameManagementTitle: "経営シミュレーション",
    gameManagementBody: "数字を伸ばしながら店や会社を回す枠です。",
    gameSolitaireChip: "COMING SOON",
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
    binaryBalanceLabel: "残高",
    binaryQuoteLabel: "現在値",
    binaryProviderLabel: "レート",
    binaryPairLabel: "PAIR",
    binaryDurationLabel: "DURATION",
    binaryStakeLabel: "STAKE",
    binaryStakeCustom: "カスタム金額",
    binaryActionUp: "上がる",
    binaryActionDown: "下がる",
    binaryStatusDefault: "通貨ペアごとに1日1ケースをチャートで再生します。",
    binaryProviderDefault: "昨日までの実データから作った疑似リアルタイムケースです。",
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
        badge: "SONAR ONLY",
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
        panelBody: "軌道や速度を触って遊ぶ枠です。いまは棚だけ先に置いています。",
        promptTitle: "惑星シミュレーションは準備中",
        promptBody: "重力と軌道の遊び場は次に追加します。",
        badge: "COMING SOON",
      },
      management: {
        panelTitle: "経営シミュレーション",
        panelBody: "お金と資源を回しながら伸ばしていく枠です。まだ未実装です。",
        promptTitle: "経営シミュレーションは準備中",
        promptBody: "数字を積み上げる系の遊び場は次の候補です。",
        badge: "COMING SOON",
      },
      solitaire: {
        panelTitle: "ソリティア",
        panelBody: "落ち着いて遊べる一人用ゲーム枠ですが、まだ未実装です。",
        promptTitle: "ソリティアは準備中",
        promptBody: "カードを使う穏やかなゲーム枠としてあとで入れます。",
        badge: "COMING SOON",
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
    gamePlanetChip: "COMING SOON",
    gamePlanetTitle: "Planet Simulation",
    gamePlanetBody: "A future slot for orbit and gravity play.",
    gameManagementChip: "COMING SOON",
    gameManagementTitle: "Management Simulation",
    gameManagementBody: "A future slot for building a company through numbers.",
    gameSolitaireChip: "COMING SOON",
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
    binaryBalanceLabel: "Balance",
    binaryQuoteLabel: "Quote",
    binaryProviderLabel: "Feed",
    binaryPairLabel: "PAIR",
    binaryDurationLabel: "DURATION",
    binaryStakeLabel: "STAKE",
    binaryStakeCustom: "Custom amount",
    binaryActionUp: "Higher",
    binaryActionDown: "Lower",
    binaryStatusDefault: "Each pair replays one daily case as a chart.",
    binaryProviderDefault: "This is a pseudo-real-time case built from historical data up to yesterday.",
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
        badge: "SONAR ONLY",
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
        panelBody: "A future slot for orbit and gravity play. The card is listed first, the game comes later.",
        promptTitle: "Planet Simulation is coming soon",
        promptBody: "The gravity playground is reserved but not built yet.",
        badge: "COMING SOON",
      },
      management: {
        panelTitle: "Management Simulation",
        panelBody: "A future slot for growing a company through money and resources.",
        promptTitle: "Management Simulation is coming soon",
        promptBody: "The management slot is reserved but not implemented yet.",
        badge: "COMING SOON",
      },
      solitaire: {
        panelTitle: "Solitaire",
        panelBody: "The calm solo slot is reserved but not built yet.",
        promptTitle: "Solitaire is coming soon",
        promptBody: "The card-game slot is defined and waiting for implementation.",
        badge: "COMING SOON",
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
const binaryMarketNote = document.getElementById("binary-market-note");
const binaryChartPath = document.getElementById("binary-chart-path");
const binaryChartFuture = document.getElementById("binary-chart-future");
const binaryChartProgress = document.getElementById("binary-chart-progress");
const binaryChartPoint = document.getElementById("binary-chart-point");
const binaryChartNow = document.getElementById("binary-chart-now");
const binaryChartRange = document.getElementById("binary-chart-range");
const binaryChartMin = document.getElementById("binary-chart-min");
const binaryChartMax = document.getElementById("binary-chart-max");
const binaryChartTicks = Array.from(document.querySelectorAll("[data-binary-chart-tick]"));
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

const appEndpoint = new URL("./app.xcg", window.location.href);

let currentLanguage = loadLanguage();
let selectedGame = DEFAULT_GAME;
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
let binaryPollTimer = null;
let binaryPlaybackFrame = null;
let binaryPreviousState = null;
let binaryStateTransitionStartedAt = 0;
let fishingState = createInitialFishingState();

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

binaryUpButton.addEventListener("click", async () => {
  try {
    await placeBinaryTrade("up");
  } catch (error) {
    showBinaryError(error);
  }
});

binaryDownButton.addEventListener("click", async () => {
  try {
    await placeBinaryTrade("down");
  } catch (error) {
    showBinaryError(error);
  }
});

binaryStartButton.addEventListener("click", async () => {
  try {
    await startBinaryCase();
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

function selectGame(gameId) {
  selectedGame = GAME_LIBRARY[gameId] ? gameId : DEFAULT_GAME;
  minesTransientMessage = null;
  binaryTransientMessage = null;
  if (selectedGame !== "binary") {
    stopBinaryPolling();
    stopBinaryPlaybackLoop();
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

  if (selectedGame === "binary" && hasLoadedBinary && shouldBinaryPollState()) {
    startBinaryPolling();
    return;
  }

  if (selectedGame === "binary") {
    stopBinaryPolling();
  }
}

function renderGameShell() {
  const gameCopy = currentCopy().games[selectedGame];
  const libraryEntry = GAME_LIBRARY[selectedGame];
  const isPlayable = Boolean(libraryEntry && libraryEntry.available);
  const isMinesweeper = selectedGame === "minesweeper";
  const isBinary = selectedGame === "binary";
  const isFishing = selectedGame === "fishing";

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
  difficultyCluster.hidden = !isMinesweeper;
  restartButton.hidden = !isMinesweeper;
  restartButton.disabled = isGameLoading || !hasLoadedMinesweeper;

  syncDifficultyButtons();

  if (!isPlayable) {
    stopBinaryPlaybackLoop();
    gameLoading.hidden = true;
    boardWrap.hidden = true;
    binaryPanel.hidden = true;
    fishingPanel.hidden = true;
    gamePlaceholder.hidden = false;
    renderPlaceholder(gameCopy.promptTitle, gameCopy.promptBody);
    renderIdleStats();
    return;
  }

  if (isFishing) {
    stopBinaryPlaybackLoop();
    gamePlaceholder.hidden = true;
    gameLoading.hidden = true;
    boardWrap.hidden = true;
    binaryPanel.hidden = true;
    fishingPanel.hidden = false;
    renderFishingPanel();
    return;
  }

  if (isGameLoading) {
    stopBinaryPlaybackLoop();
    gamePlaceholder.hidden = true;
    gameLoading.hidden = false;
    boardWrap.hidden = true;
    binaryPanel.hidden = true;
    fishingPanel.hidden = true;
    renderIdleStats();
    return;
  }

  gameLoading.hidden = true;

  if (isMinesweeper && hasLoadedMinesweeper && currentState) {
    stopBinaryPlaybackLoop();
    gamePlaceholder.hidden = true;
    boardWrap.hidden = false;
    binaryPanel.hidden = true;
    fishingPanel.hidden = true;
    renderMinesweeper();
    return;
  }

  if (isBinary && hasLoadedBinary && binaryState) {
    gamePlaceholder.hidden = true;
    boardWrap.hidden = true;
    binaryPanel.hidden = false;
    fishingPanel.hidden = true;
    renderBinaryPanel();
    return;
  }

  gamePlaceholder.hidden = false;
  boardWrap.hidden = true;
  binaryPanel.hidden = true;
  fishingPanel.hidden = true;
  stopBinaryPlaybackLoop();
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
  currentState = await requestJson("reveal", { row, col });
  minesTransientMessage = null;
  renderMinesweeper();
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
    applyBinaryState(await requestJson("binary_state", null, { symbol: binarySelectedSymbol }));
    if (Array.isArray(binaryState.durations) && !binaryState.durations.includes(binarySelectedDuration)) {
      binarySelectedDuration = binaryState.defaultDuration || DEFAULT_BINARY_DURATION;
    }
  } finally {
    isGameLoading = false;
    renderGameShell();
    if (selectedGame === "binary" && shouldBinaryPollState()) {
      startBinaryPolling();
    } else {
      stopBinaryPolling();
    }
  }
}

async function refreshBinaryState() {
  applyBinaryState(await requestJson("binary_state", null, { symbol: binarySelectedSymbol }));
  renderBinaryPanel();
}

async function placeBinaryTrade(direction) {
  if (selectedGame !== "binary") {
    return;
  }
  const stake = getCurrentStake();
  applyBinaryState(await requestJson("binary_trade", {
    symbol: binarySelectedSymbol,
    direction,
    stake,
    duration: binarySelectedDuration,
  }));
  binaryTransientMessage = "binaryTradePlaced";
  renderBinaryPanel();
}

async function startBinaryCase() {
  if (selectedGame !== "binary") {
    return;
  }
  applyBinaryState(await requestJson("binary_start", {}, { symbol: binarySelectedSymbol }));
  binaryTransientMessage = null;
  renderBinaryPanel();
}

function applyBinaryState(nextState) {
  const sameSymbol =
    Boolean(binaryState) &&
    Boolean(nextState) &&
    binaryState.selectedSymbol === nextState.selectedSymbol;
  binaryPreviousState = sameSymbol ? binaryState : null;
  binaryState = nextState;
  binaryStateTransitionStartedAt = performance.now();
  hasLoadedBinary = true;
  binarySelectedSymbol = binaryState.selectedSymbol || binarySelectedSymbol;
}

function renderBinarySummary() {
  const providerName = binaryState?.provider?.name || getText("binaryProviderNameUnavailable");
  const providerCode = binaryState?.provider?.code || "unavailable";
  const caseInfo = binaryState?.caseInfo || null;
  const playback = getBinaryPlaybackView();
  binaryBalance.textContent = formatYen(binaryState?.balance ?? 0);
  binaryQuote.textContent = playback
    ? formatBinaryPrice(playback.price, playback.digits)
    : binaryState?.quote?.displayPrice || "--";
  binaryProvider.textContent = providerLabel(providerName, providerCode);
  binaryStatusLine.textContent = binaryTransientMessage
    ? getText(binaryTransientMessage)
    : caseInfo && !caseInfo.started
      ? (
          getText("binaryStatusWaiting")
          || (currentLanguage === "ja"
            ? "PAIR を選んで開始を押すとケースが動きます。"
            : "Pick a pair and press Start to begin the case.")
        )
    : caseInfo
      ? template(getText("binaryCaseStatus"), {
          symbol: caseInfo.symbol,
          date: caseInfo.referenceDate,
          elapsed: playback ? formatBinaryElapsed(playback.elapsedExact) : caseInfo.elapsedSeconds,
          total: caseInfo.totalSeconds,
        })
      : getText("binaryStatusDefault");
  binaryProviderLine.textContent = composeBinaryNotice(binaryState);
  binaryMarketNote.textContent = composeBinaryNotice(binaryState);
}

function renderBinaryPanel() {
  if (!binaryState) {
    return;
  }

  renderBinarySummary();
  renderBinaryControls();
  renderBinaryChart();

  const tradingEnabled = Boolean(binaryState.tradingEnabled);
  binaryUpButton.disabled = isGameLoading || !tradingEnabled;
  binaryDownButton.disabled = isGameLoading || !tradingEnabled;

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
  if (shouldBinaryPlaybackRun()) {
    startBinaryPlaybackLoop();
  } else {
    stopBinaryPlaybackLoop();
  }
  if (shouldBinaryPollState()) {
    startBinaryPolling();
  } else {
    stopBinaryPolling();
  }
}

function renderBinaryControls() {
  const symbols = binaryState?.symbols || [binarySelectedSymbol];
  const durations = binaryState?.durations || [binarySelectedDuration];
  const caseInfo = binaryState?.caseInfo || null;
  const caseStarted = Boolean(caseInfo?.started);
  const caseCompleted = Boolean(caseInfo?.completed);

  binaryPairPicker.replaceChildren();
  symbols.forEach((symbol) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = symbol;
    button.classList.toggle("active", symbol === binarySelectedSymbol);
    button.setAttribute("aria-pressed", String(symbol === binarySelectedSymbol));
    button.disabled = isGameLoading;
    button.addEventListener("click", async () => {
      if (symbol === binarySelectedSymbol) {
        return;
      }
      binarySelectedSymbol = symbol;
      renderBinaryControls();
      try {
        await refreshBinaryState();
      } catch (error) {
        showBinaryError(error);
      }
    });
    binaryPairPicker.appendChild(button);
  });

  binaryStartButton.textContent = caseStarted && caseCompleted
    ? (
        getText("binaryRestartAction")
        || (currentLanguage === "ja" ? "もう一度開始" : "Restart")
      )
    : caseStarted
      ? (
          getText("binaryRunningAction")
          || (currentLanguage === "ja" ? "進行中" : "Running")
        )
      : (
          getText("binaryStartAction")
          || (currentLanguage === "ja" ? "開始" : "Start")
        );
  binaryStartButton.disabled = isGameLoading || (caseStarted && !caseCompleted);

  binaryDurationPicker.replaceChildren();
  durations.forEach((duration) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = template(getText("binarySeconds"), { seconds: duration });
    button.classList.toggle("active", duration === binarySelectedDuration);
    button.setAttribute("aria-pressed", String(duration === binarySelectedDuration));
    button.disabled = isGameLoading;
    button.addEventListener("click", () => {
      binarySelectedDuration = duration;
      renderBinaryControls();
    });
    binaryDurationPicker.appendChild(button);
  });

  binaryStakePresets.replaceChildren();
  BINARY_STAKE_PRESETS.forEach((stake) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = template(getText("binaryStakePreset"), { amount: formatInteger(stake) });
    button.classList.toggle("active", stake === getCurrentStake());
    button.setAttribute("aria-pressed", String(stake === getCurrentStake()));
    button.disabled = isGameLoading;
    button.addEventListener("click", () => {
      binaryStakeInput.value = String(stake);
      renderBinaryControls();
    });
    binaryStakePresets.appendChild(button);
  });
}

function renderBinaryChart() {
  const chart = binaryState?.chart;
  const playback = getBinaryPlaybackView();
  if (!chart || !playback || !Array.isArray(chart.history) || chart.history.length === 0) {
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

  const windowPoints = playback.windowPoints;
  const minPrice = Math.min(...windowPoints.map((point) => point.price));
  const maxPrice = Math.max(...windowPoints.map((point) => point.price));
  const spread = Math.max(maxPrice - minPrice, Number.EPSILON);
  const points = windowPoints.map((point) => {
    const x = playback.windowSpan <= 0
      ? 100
      : (((point.elapsed - playback.windowStartElapsed) / playback.windowSpan) * 100);
    const y = 30 - (((point.price - minPrice) / spread) * 24);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const currentPoint = points.length > 0 ? points[points.length - 1].split(",") : ["0", "0"];
  const progressX = currentPoint[0];
  const digits = playback.digits;

  binaryChartPath.setAttribute("d", buildPolylinePath(points));
  binaryChartFuture.setAttribute("d", "");
  binaryChartProgress.setAttribute("x1", progressX);
  binaryChartProgress.setAttribute("x2", progressX);
  binaryChartPoint.setAttribute("cx", currentPoint[0]);
  binaryChartPoint.setAttribute("cy", currentPoint[1]);
  binaryChartNow.textContent = template(getText("binaryChartNow"), {
    price: formatBinaryPrice(playback.price, digits),
  });
  binaryChartRange.textContent = template(getText("binaryChartRange"), {
    min: formatBinaryPrice(minPrice, digits),
    max: formatBinaryPrice(maxPrice, digits),
  });
  binaryChartMin.textContent = formatBinaryPrice(minPrice, digits);
  binaryChartMax.textContent = formatBinaryPrice(maxPrice, digits);
  renderBinaryChartTicks(playback.windowStartElapsed, playback.windowEndElapsed);
}

function buildPolylinePath(points) {
  if (!points || points.length === 0) {
    return "";
  }
  return `M ${points[0]}${points.slice(1).map((point) => ` L ${point}`).join("")}`;
}

function getBinaryPlaybackView() {
  const chart = binaryState?.chart;
  const caseInfo = binaryState?.caseInfo;
  if (!chart || !Array.isArray(chart.history) || chart.history.length === 0) {
    return null;
  }

  const history = chart.history.map((value) => Number(value));
  const totalSeconds = Number(chart.totalSeconds) || Math.max(0, history.length - 1);
  const currentElapsed = Math.max(0, Math.min(Number(chart.elapsedSeconds) || 0, totalSeconds));
  const previousElapsed =
    binaryPreviousState?.selectedSymbol === binaryState?.selectedSymbol
      ? Math.max(0, Math.min(Number(binaryPreviousState?.chart?.elapsedSeconds) || 0, currentElapsed))
      : currentElapsed;
  const transitionRange = Math.max(0, currentElapsed - previousElapsed);
  const transitionProgress = transitionRange > 0
    ? Math.min(1, Math.max(0, (performance.now() - binaryStateTransitionStartedAt) / 1000))
    : 1;
  const elapsedExact = previousElapsed + (transitionRange * transitionProgress);
  const lowerIndex = Math.min(Math.floor(elapsedExact), history.length - 1);
  const upperIndex = Math.min(lowerIndex + 1, history.length - 1);
  const progress = Math.max(0, Math.min(elapsedExact - lowerIndex, 1));
  const lowerPrice = history[lowerIndex];
  const upperPrice = history[upperIndex];
  const currentPrice = lowerPrice + ((upperPrice - lowerPrice) * progress);
  const visibleBase = history.slice(0, lowerIndex + 1).map((price, index) => ({
    elapsed: index,
    price,
  }));
  const animatedPoints =
    upperIndex > lowerIndex
      ? [...visibleBase, { elapsed: elapsedExact, price: currentPrice }]
      : visibleBase;
  const windowEndElapsed = elapsedExact <= BINARY_CHART_WINDOW_SECONDS
    ? BINARY_CHART_WINDOW_SECONDS
    : elapsedExact;
  const windowStartElapsed = Math.max(0, windowEndElapsed - BINARY_CHART_WINDOW_SECONDS);
  const windowSpan = Math.max(1, windowEndElapsed - windowStartElapsed);
  const windowPoints = [
    {
      elapsed: windowStartElapsed,
      price: interpolateBinaryPrice(history, windowStartElapsed),
    },
  ];
  animatedPoints.forEach((point) => {
    if (point.elapsed > windowStartElapsed && point.elapsed <= elapsedExact) {
      windowPoints.push(point);
    }
  });
  if (windowPoints[windowPoints.length - 1].elapsed < elapsedExact) {
    windowPoints.push({ elapsed: elapsedExact, price: currentPrice });
  }

  return {
    digits: Number(chart.priceDigits) || 3,
    elapsedExact,
    price: currentPrice,
    windowPoints,
    windowStartElapsed,
    windowEndElapsed,
    windowSpan,
  };
}

function interpolateBinaryPrice(history, elapsed) {
  if (!history.length) {
    return 0;
  }
  const boundedElapsed = Math.max(0, Math.min(elapsed, history.length - 1));
  const lowerIndex = Math.floor(boundedElapsed);
  const upperIndex = Math.min(lowerIndex + 1, history.length - 1);
  const progress = Math.max(0, Math.min(boundedElapsed - lowerIndex, 1));
  const lowerPrice = history[lowerIndex];
  const upperPrice = history[upperIndex];
  return lowerPrice + ((upperPrice - lowerPrice) * progress);
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

function startBinaryPolling() {
  if (binaryPollTimer !== null) {
    return;
  }
  binaryPollTimer = window.setInterval(async () => {
    if (selectedGame !== "binary" || isGameLoading) {
      return;
    }
    try {
      await refreshBinaryState();
    } catch (error) {
      showBinaryError(error);
    }
  }, BINARY_POLL_MS);
}

function stopBinaryPolling() {
  if (binaryPollTimer !== null) {
    window.clearInterval(binaryPollTimer);
    binaryPollTimer = null;
  }
}

function startBinaryPlaybackLoop() {
  if (binaryPlaybackFrame !== null) {
    return;
  }

  const tick = () => {
    if (selectedGame !== "binary" || !binaryState || isGameLoading) {
      binaryPlaybackFrame = null;
      return;
    }
    renderBinarySummary();
    renderBinaryChart();
    binaryPlaybackFrame = window.requestAnimationFrame(tick);
  };

  binaryPlaybackFrame = window.requestAnimationFrame(tick);
}

function stopBinaryPlaybackLoop() {
  if (binaryPlaybackFrame !== null) {
    window.cancelAnimationFrame(binaryPlaybackFrame);
    binaryPlaybackFrame = null;
  }
}

function shouldBinaryPollState() {
  if (selectedGame !== "binary" || !hasLoadedBinary || !binaryState) {
    return false;
  }
  if (Array.isArray(binaryState.openPositions) && binaryState.openPositions.length > 0) {
    return true;
  }
  return Boolean(binaryState.caseInfo?.started && !binaryState.caseInfo?.completed);
}

function shouldBinaryPlaybackRun() {
  if (selectedGame !== "binary" || !binaryState || isGameLoading) {
    return false;
  }
  return Boolean(binaryState.caseInfo?.started && !binaryState.caseInfo?.completed);
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
