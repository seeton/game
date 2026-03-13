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

from scripts.post_to_x import build_post_text, load_credentials, post_to_x


JST = timezone(timedelta(hours=9))


class PostToXTests(unittest.TestCase):
    def test_build_post_text_uses_template_variables(self):
        text = build_post_text(
            template="SEETONA {date} {url}",
            url="https://www.seetona.com/",
            now=datetime(2026, 3, 13, 9, 0, tzinfo=JST),
        )
        self.assertEqual(text, "SEETONA 2026-03-13 https://www.seetona.com/")

    def test_load_credentials_requires_all_fields(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(ValueError):
                load_credentials()

    def test_post_to_x_uses_response_id(self):
        mock_response = mock.Mock()
        mock_response.read.return_value = b'{"data":{"id":"123","text":"hello"}}'
        with mock.patch.dict(
            os.environ,
            {
                "X_CONSUMER_KEY": "ck",
                "X_CONSUMER_SECRET": "cs",
                "X_ACCESS_TOKEN": "at",
                "X_ACCESS_TOKEN_SECRET": "ats",
            },
            clear=True,
        ):
            with mock.patch("scripts.post_to_x.urlopen", return_value=mock_response):
                result = post_to_x("hello")

        self.assertEqual(result["id"], "123")
        self.assertEqual(result["text"], "hello")


if __name__ == "__main__":
    unittest.main()
