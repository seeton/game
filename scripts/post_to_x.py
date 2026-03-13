import argparse
import base64
import hashlib
import hmac
import json
import os
import time
import uuid
from datetime import datetime, timedelta, timezone
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen


JST = timezone(timedelta(hours=9))
X_POST_URL = "https://api.x.com/2/tweets"
DEFAULT_TEMPLATE = "SEETONA daily update {date}\n{url}"
DEFAULT_URL = "https://www.seetona.com/"
DEFAULT_TIMEOUT_SECONDS = 15

REQUIRED_ENV_VARS = (
    "X_CONSUMER_KEY",
    "X_CONSUMER_SECRET",
    "X_ACCESS_TOKEN",
    "X_ACCESS_TOKEN_SECRET",
)


def percent_encode(value):
    return quote(str(value), safe="~-._")


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


def load_credentials():
    credentials = {}
    missing = []
    for name in REQUIRED_ENV_VARS:
        value = os.environ.get(name, "").strip()
        if not value:
            missing.append(name)
        credentials[name] = value
    if missing:
        raise ValueError("missing environment variables: %s" % ", ".join(missing))
    return credentials


def build_oauth_header(method, url, consumer_key, consumer_secret, access_token, access_token_secret):
    oauth_params = {
        "oauth_consumer_key": consumer_key,
        "oauth_nonce": uuid.uuid4().hex,
        "oauth_signature_method": "HMAC-SHA1",
        "oauth_timestamp": str(int(time.time())),
        "oauth_token": access_token,
        "oauth_version": "1.0",
    }
    sorted_items = sorted(oauth_params.items(), key=lambda item: (item[0], item[1]))
    parameter_string = "&".join(
        "%s=%s" % (percent_encode(key), percent_encode(value))
        for key, value in sorted_items
    )
    signature_base_string = "&".join(
        [
            percent_encode(method.upper()),
            percent_encode(url),
            percent_encode(parameter_string),
        ]
    )
    signing_key = "%s&%s" % (percent_encode(consumer_secret), percent_encode(access_token_secret))
    signature = base64.b64encode(
        hmac.new(
            signing_key.encode("utf-8"),
            signature_base_string.encode("utf-8"),
            hashlib.sha1,
        ).digest()
    ).decode("ascii")
    oauth_params["oauth_signature"] = signature
    header_items = sorted(oauth_params.items(), key=lambda item: item[0])
    return "OAuth " + ", ".join(
        '%s="%s"' % (percent_encode(key), percent_encode(value))
        for key, value in header_items
    )


def post_to_x(text, timeout_seconds=DEFAULT_TIMEOUT_SECONDS):
    credentials = load_credentials()
    auth_header = build_oauth_header(
        "POST",
        X_POST_URL,
        credentials["X_CONSUMER_KEY"],
        credentials["X_CONSUMER_SECRET"],
        credentials["X_ACCESS_TOKEN"],
        credentials["X_ACCESS_TOKEN_SECRET"],
    )
    request_body = json.dumps({"text": text}).encode("utf-8")
    request = Request(
        X_POST_URL,
        data=request_body,
        headers={
            "Authorization": auth_header,
            "Content-Type": "application/json",
            "User-Agent": "SEETONA-GitHubActions/1.0",
        },
        method="POST",
    )
    try:
        response = urlopen(request, timeout=int(timeout_seconds))
        payload = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError("X API error %s: %s" % (exc.code, body))
    except URLError as exc:
        raise RuntimeError("X API connection failed: %s" % exc.reason)

    post_data = payload.get("data") if isinstance(payload, dict) else None
    if not isinstance(post_data, dict) or not post_data.get("id"):
        raise RuntimeError("X API response did not include a post id")
    return {
        "id": str(post_data["id"]),
        "text": str(post_data.get("text") or text),
    }


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description="Post daily update to X from GitHub Actions")
    parser.add_argument("--text", help="Override post text")
    parser.add_argument("--dry-run", action="store_true", help="Build and print the post text without posting")
    parser.add_argument("--timeout-seconds", type=int, default=DEFAULT_TIMEOUT_SECONDS)
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

    result = post_to_x(text, timeout_seconds=args.timeout_seconds)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
