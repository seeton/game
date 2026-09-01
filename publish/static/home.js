import { initLogoScene } from "./logo.js?v=20260901f";

const introDuration = document.documentElement.dataset.introTheme === "jackpot" ? 5 : 2;

initLogoScene({ introDuration });
