import asyncio
import os
import sys
import unittest
from datetime import datetime, timedelta, timezone
from unittest import mock

TEST_ROOT = os.path.dirname(os.path.abspath(__file__))
PUBLISH_ROOT = os.path.dirname(TEST_ROOT)
REPO_ROOT = os.path.dirname(PUBLISH_ROOT)

if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from scripts.post_to_x import (
    authenticate_twikit_client,
    build_post_text,
    load_cookies,
    load_login_credentials,
    post_to_x_async,
)


JST = timezone(timedelta(hours=9))


class FakeTweet:
    def __init__(self, tweet_id="123", text="hello"):
        self.id = tweet_id
        self.text = text


class FakeClient:
    def __init__(self, language="en-US"):
        self.language = language
        self.cookies = None
        self.login_kwargs = None
        self.created_text = None

    def set_cookies(self, cookies, clear_cookies=True):
        self.cookies = {"cookies": cookies, "clear_cookies": clear_cookies}

    async def login(self, **kwargs):
        self.login_kwargs = kwargs

    async def create_tweet(self, text):
        self.created_text = text
        return FakeTweet(text=text)


class PostToXTests(unittest.TestCase):
    def test_build_post_text_uses_template_variables(self):
        text = build_post_text(
            template="SEETONA {date} {url}",
            url="https://www.seetona.com/",
            now=datetime(2026, 3, 13, 9, 0, tzinfo=JST),
        )
        self.assertEqual(text, "SEETONA 2026-03-13 https://www.seetona.com/")

    def test_load_login_credentials_requires_required_fields(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(ValueError):
                load_login_credentials()

    def test_load_cookies_reads_json_secret(self):
        with mock.patch.dict(os.environ, {"TWIKIT_COOKIES_JSON": '{"auth_token":"abc"}'}, clear=True):
            payload = load_cookies()
        self.assertEqual(payload, {"auth_token": "abc"})

    def test_authenticate_uses_cookie_secret_when_present(self):
        client = FakeClient()
        with mock.patch.dict(os.environ, {"TWIKIT_COOKIES_JSON": '{"auth_token":"abc"}'}, clear=True):
            auth_mode = asyncio.run(authenticate_twikit_client(client))

        self.assertEqual(auth_mode, "cookies")
        self.assertEqual(client.cookies["cookies"], {"auth_token": "abc"})
        self.assertIsNone(client.login_kwargs)

    def test_authenticate_uses_login_when_no_cookie_secret(self):
        client = FakeClient()
        with mock.patch.dict(
            os.environ,
            {
                "TWIKIT_AUTH_INFO_1": "seetona_user",
                "TWIKIT_PASSWORD": "password",
                "TWIKIT_AUTH_INFO_2": "mail@example.com",
                "TWIKIT_TOTP_SECRET": "totp-secret",
                "TWIKIT_ENABLE_UI_METRICS": "true",
            },
            clear=True,
        ):
            auth_mode = asyncio.run(authenticate_twikit_client(client))

        self.assertEqual(auth_mode, "login")
        self.assertEqual(client.login_kwargs["auth_info_1"], "seetona_user")
        self.assertEqual(client.login_kwargs["auth_info_2"], "mail@example.com")
        self.assertEqual(client.login_kwargs["password"], "password")
        self.assertEqual(client.login_kwargs["totp_secret"], "totp-secret")
        self.assertTrue(client.login_kwargs["enable_ui_metrics"])

    def test_post_to_x_async_uses_client_factory(self):
        with mock.patch.dict(os.environ, {"TWIKIT_COOKIES_JSON": '{"auth_token":"abc"}'}, clear=True):
            result = asyncio.run(post_to_x_async("hello", client_factory=FakeClient))

        self.assertEqual(result["id"], "123")
        self.assertEqual(result["text"], "hello")
        self.assertEqual(result["auth_mode"], "cookies")


if __name__ == "__main__":
    unittest.main()
