import argparse
import os
import time
from pathlib import Path

try:
    from scripts.post_to_x import build_post_text
except ImportError:
    from post_to_x import build_post_text


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PROFILE_DIR = REPO_ROOT / "local" / "x-playwright-profile"
DEFAULT_BROWSER_CHANNEL = os.environ.get("PLAYWRIGHT_CHANNEL", "msedge").strip() or "msedge"
LOGIN_URL_PREFIXES = (
    "https://x.com/i/flow/login",
    "https://twitter.com/i/flow/login",
    "https://x.com/login",
    "https://twitter.com/login",
)
COMPOSER_SELECTORS = (
    '[data-testid="tweetTextarea_0"]',
    '[role="textbox"][data-testid*="tweetTextarea"]',
    '[role="textbox"]',
)
POST_BUTTON_SELECTORS = (
    'button[data-testid="tweetButton"]',
    'button[data-testid="tweetButtonInline"]',
    '[data-testid="tweetButtonInline"]',
    '[data-testid="tweetButton"]',
)


def resolve_profile_dir(profile_dir=None):
    raw = (profile_dir or "").strip()
    if raw:
        return Path(raw).expanduser().resolve()
    return DEFAULT_PROFILE_DIR


def is_login_url(url):
    normalized = (url or "").strip().lower()
    for prefix in LOGIN_URL_PREFIXES:
        if normalized.startswith(prefix):
            return True
    return False


def import_playwright():
    try:
        from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        raise RuntimeError(
            "playwright is not installed. Run `python -m pip install playwright` first."
        ) from exc
    return sync_playwright, PlaywrightTimeoutError


def launch_context(playwright, profile_dir, *, channel, headless):
    profile_dir.mkdir(parents=True, exist_ok=True)
    return playwright.chromium.launch_persistent_context(
        user_data_dir=str(profile_dir),
        channel=channel,
        headless=headless,
        viewport={"width": 1440, "height": 960},
        args=["--disable-blink-features=AutomationControlled"],
    )


def wait_for_first(page, selectors, timeout_error_class, timeout_ms=8000):
    last_error = None
    for selector in selectors:
        locator = page.locator(selector).first
        try:
            locator.wait_for(state="visible", timeout=timeout_ms)
            return locator
        except timeout_error_class as exc:
            last_error = exc
    if last_error is not None:
        raise last_error
    raise RuntimeError("no selector candidates were provided")


def wait_for_enabled_post_button(page, selectors, timeout_error_class, timeout_ms=8000):
    deadline = time.time() + (timeout_ms / 1000.0)
    last_error = None
    while time.time() < deadline:
        for selector in selectors:
            locator = page.locator(selector)
            count = locator.count()
            for index in range(count):
                candidate = locator.nth(index)
                try:
                    if not candidate.is_visible():
                        continue
                    if candidate.get_attribute("aria-disabled") == "true":
                        continue
                    return candidate
                except timeout_error_class as exc:
                    last_error = exc
        page.wait_for_timeout(100)
    if last_error is not None:
        raise last_error
    raise RuntimeError("enabled post button was not found")


def open_compose_page(page):
    page.goto("https://x.com/compose/post", wait_until="domcontentloaded")
    if is_login_url(page.url):
        raise RuntimeError(
            "X へのログインが必要です。先に `python scripts/post_to_x_browser.py login` を実行してください。"
        )


def run_login(profile_dir, channel):
    sync_playwright, _ = import_playwright()
    with sync_playwright() as playwright:
        context = launch_context(
            playwright,
            profile_dir,
            channel=channel,
            headless=False,
        )
        page = context.pages[0] if context.pages else context.new_page()
        page.goto("https://x.com/home", wait_until="domcontentloaded")
        print("ブラウザで X に手動ログインしてください。ログイン完了後にこのターミナルで Enter を押します。")
        input()
        context.close()
    print("ログイン状態を保存しました: %s" % profile_dir)
    return 0


def post_with_browser(text, profile_dir, *, channel, headless, preview_seconds):
    sync_playwright, timeout_error_class = import_playwright()
    with sync_playwright() as playwright:
        context = launch_context(
            playwright,
            profile_dir,
            channel=channel,
            headless=headless,
        )
        page = context.pages[0] if context.pages else context.new_page()
        open_compose_page(page)
        composer = wait_for_first(page, COMPOSER_SELECTORS, timeout_error_class)
        composer.click()
        page.keyboard.insert_text(text)
        post_button = wait_for_enabled_post_button(page, POST_BUTTON_SELECTORS, timeout_error_class)
        post_button.click()
        time.sleep(max(0.5, preview_seconds))
        context.close()
    return {
        "text": text,
        "profile_dir": str(profile_dir),
        "channel": channel,
        "headless": bool(headless),
    }


def parse_args(argv=None):
    parser = argparse.ArgumentParser(
        description="Post to X for free with a local browser profile and Playwright"
    )
    parser.add_argument(
        "--profile-dir",
        default=str(DEFAULT_PROFILE_DIR),
        help="Path to the persistent browser profile directory",
    )
    parser.add_argument(
        "--channel",
        default=DEFAULT_BROWSER_CHANNEL,
        help="Chromium channel to use, for example msedge or chrome",
    )

    subparsers = parser.add_subparsers(dest="command", required=True)

    login_parser = subparsers.add_parser("login", help="Open the browser and save a logged-in X session")
    login_parser.set_defaults(command="login")

    post_parser = subparsers.add_parser("post", help="Open the browser and submit a post")
    post_parser.add_argument("--text", help="Override post text")
    post_parser.add_argument("--dry-run", action="store_true", help="Build and print text without posting")
    post_parser.add_argument("--headless", action="store_true", help="Run the browser in headless mode")
    post_parser.add_argument(
        "--preview-seconds",
        type=float,
        default=2.0,
        help="Seconds to keep the browser open after clicking Post",
    )
    post_parser.set_defaults(command="post")

    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)
    profile_dir = resolve_profile_dir(args.profile_dir)

    if args.command == "login":
        return run_login(profile_dir, args.channel)

    text = args.text.strip() if args.text else build_post_text()
    if args.dry_run:
        print(text)
        return 0

    result = post_with_browser(
        text,
        profile_dir,
        channel=args.channel,
        headless=args.headless,
        preview_seconds=args.preview_seconds,
    )
    print(result)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
