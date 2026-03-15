import argparse
import asyncio
import base64
import json
import os
from datetime import datetime, timedelta, timezone


JST = timezone(timedelta(hours=9))
DEFAULT_TEMPLATE = "SEETONA daily update {date}\n{url}"
DEFAULT_URL = "https://www.seetona.com/"

REQUIRED_LOGIN_ENV_VARS = (
    "TWIKIT_AUTH_INFO_1",
    "TWIKIT_PASSWORD",
)


def now_jst(now=None):
    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None:
        current = current.replace(tzinfo=timezone.utc)
    return current.astimezone(JST)


def build_post_text(template=None, url=None, now=None):
    current = now_jst(now)
    resolved_template = str(template or os.environ.get("X_POST_TEMPLATE") or DEFAULT_TEMPLATE).strip()
    resolved_url = str(url or os.environ.get("SEETONA_URL") or DEFAULT_URL).strip()
    text = resolved_template.format(
        date=current.strftime("%Y-%m-%d"),
        datetime=current.strftime("%Y-%m-%d %H:%M JST"),
        url=resolved_url,
    ).strip()
    if not text:
        raise ValueError("post text is empty")
    if len(text) > 280:
        raise ValueError("post text exceeds 280 characters")
    return text


def parse_bool(value, default=True):
    if value is None or value == "":
        return default
    text = str(value).strip().lower()
    if text in ("1", "true", "yes", "on"):
        return True
    if text in ("0", "false", "no", "off"):
        return False
    return default


def load_login_credentials():
    credentials = {}
    missing = []
    for name in REQUIRED_LOGIN_ENV_VARS:
        value = os.environ.get(name, "").strip()
        if not value:
            missing.append(name)
        credentials[name] = value
    if missing:
        raise ValueError("missing environment variables: %s" % ", ".join(missing))

    credentials["TWIKIT_AUTH_INFO_2"] = os.environ.get("TWIKIT_AUTH_INFO_2", "").strip()
    credentials["TWIKIT_TOTP_SECRET"] = os.environ.get("TWIKIT_TOTP_SECRET", "").strip()
    credentials["TWIKIT_LANGUAGE"] = os.environ.get("TWIKIT_LANGUAGE", "en-US").strip() or "en-US"
    credentials["TWIKIT_ENABLE_UI_METRICS"] = parse_bool(os.environ.get("TWIKIT_ENABLE_UI_METRICS"), True)
    return credentials


def load_cookies():
    raw_json = os.environ.get("TWIKIT_COOKIES_JSON", "").strip()
    raw_base64 = os.environ.get("TWIKIT_COOKIES_BASE64", "").strip()

    if raw_json:
        try:
            payload = json.loads(raw_json)
        except ValueError as exc:
            raise ValueError("TWIKIT_COOKIES_JSON is not valid JSON") from exc
        if not isinstance(payload, dict):
            raise ValueError("TWIKIT_COOKIES_JSON must decode to an object")
        return payload

    if raw_base64:
        try:
            decoded = base64.b64decode(raw_base64).decode("utf-8")
            payload = json.loads(decoded)
        except Exception as exc:
            raise ValueError("TWIKIT_COOKIES_BASE64 is not valid base64 JSON") from exc
        if not isinstance(payload, dict):
            raise ValueError("TWIKIT_COOKIES_BASE64 must decode to an object")
        return payload

    return None


def import_twikit_client():
    try:
        from twikit import Client
    except ImportError as exc:
        raise RuntimeError("twikit is not installed") from exc
    return Client


async def authenticate_twikit_client(client):
    cookies = load_cookies()
    if cookies is not None:
        client.set_cookies(cookies, clear_cookies=True)
        return "cookies"

    credentials = load_login_credentials()
    login_kwargs = {
        "auth_info_1": credentials["TWIKIT_AUTH_INFO_1"],
        "password": credentials["TWIKIT_PASSWORD"],
        "enable_ui_metrics": credentials["TWIKIT_ENABLE_UI_METRICS"],
    }
    if credentials["TWIKIT_AUTH_INFO_2"]:
        login_kwargs["auth_info_2"] = credentials["TWIKIT_AUTH_INFO_2"]
    if credentials["TWIKIT_TOTP_SECRET"]:
        login_kwargs["totp_secret"] = credentials["TWIKIT_TOTP_SECRET"]
    await client.login(**login_kwargs)
    return "login"


async def post_to_x_async(text, client_factory=None):
    client_class = client_factory or import_twikit_client()
    language = os.environ.get("TWIKIT_LANGUAGE", "en-US").strip() or "en-US"
    client = client_class(language=language)
    auth_mode = await authenticate_twikit_client(client)
    tweet = await client.create_tweet(text=text)
    tweet_id = str(getattr(tweet, "id", "") or getattr(tweet, "rest_id", "") or "")
    tweet_text = str(getattr(tweet, "text", "") or text)
    return {
        "id": tweet_id,
        "text": tweet_text,
        "auth_mode": auth_mode,
    }


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description="Post daily update to X with Twikit from GitHub Actions")
    parser.add_argument("--text", help="Override post text")
    parser.add_argument("--dry-run", action="store_true", help="Build and print the post text without posting")
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)
    text = args.text.strip() if args.text else build_post_text()
    if not text:
        raise ValueError("post text is empty")
    if len(text) > 280:
        raise ValueError("post text exceeds 280 characters")

    if args.dry_run:
        print(text)
        return 0

    result = asyncio.run(post_to_x_async(text))
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
