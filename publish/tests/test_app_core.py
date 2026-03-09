import os
import sys
import unittest
from io import BytesIO
from unittest import mock

TEST_ROOT = os.path.dirname(os.path.abspath(__file__))
PUBLISH_ROOT = os.path.dirname(TEST_ROOT)

if PUBLISH_ROOT not in sys.path:
    sys.path.insert(0, PUBLISH_ROOT)

from app_core import application, make_cookie_header


class AppCoreTests(unittest.TestCase):
    def run_application(self, path: str, query_string: str = ""):
        captured = {}

        def start_response(status, headers):
            captured["status"] = status
            captured["headers"] = dict(headers)

        body = b"".join(
            application(
                {
                    "PATH_INFO": path,
                    "REQUEST_METHOD": "GET",
                    "QUERY_STRING": query_string,
                    "wsgi.input": BytesIO(b""),
                },
                start_response,
            )
        )
        return captured["status"], captured["headers"], body

    def test_cookie_is_secure_on_https(self) -> None:
        header = make_cookie_header("abc123", {"HTTPS": "on"})
        self.assertIn("Secure", header)

    def test_cookie_is_not_secure_on_plain_http(self) -> None:
        header = make_cookie_header("abc123", {"HTTPS": "off"})
        self.assertNotIn("Secure", header)

    def test_root_stylesheet_is_served(self) -> None:
        status, headers, body = self.run_application("/styles.css")
        self.assertTrue(status.startswith("200"))
        self.assertIn("text/css", headers["Content-Type"])
        self.assertIn(b":root", body)

    def test_root_script_is_served(self) -> None:
        status, headers, body = self.run_application("/app.js")
        self.assertTrue(status.startswith("200"))
        self.assertIn("javascript", headers["Content-Type"])
        self.assertIn(b"DEFAULT_LANGUAGE", body)

    def test_index_uses_static_asset_paths(self) -> None:
        status, _, body = self.run_application("/")
        self.assertTrue(status.startswith("200"))
        self.assertIn(b'./static/styles.css', body)
        self.assertIn(b'./static/app.js?v=20260309b', body)

    def test_binary_state_returns_json_error_when_case_build_fails(self) -> None:
        with mock.patch("app_core.build_binary_public_state", side_effect=RuntimeError("historical case fetch failed")):
            status, headers, body = self.run_application("/app.xcg", "action=binary_state&symbol=USD/JPY")

        self.assertTrue(status.startswith("502"))
        self.assertEqual(headers["Content-Type"], "application/json; charset=utf-8")
        self.assertIn(b'"error": "historical case fetch failed"', body)


if __name__ == "__main__":
    unittest.main()
