import os
import re
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
    def run_application(self, path: str, query_string: str = "", environ_overrides=None):
        captured = {}
        environ = {
            "PATH_INFO": path,
            "REQUEST_METHOD": "GET",
            "QUERY_STRING": query_string,
            "wsgi.input": BytesIO(b""),
        }
        if environ_overrides:
            environ.update(environ_overrides)

        def start_response(status, headers):
            captured["status"] = status
            captured["headers"] = dict(headers)

        body = b"".join(application(environ, start_response))
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
        self.assertIn(b"./static/styles.css", body)
        self.assertIn(b"./static/app.js?v=20260313b", body)

    def test_binary_state_returns_json_error_when_case_build_fails(self) -> None:
        with mock.patch("app_core.build_binary_public_state", side_effect=RuntimeError("historical case fetch failed")):
            status, headers, body = self.run_application("/app.xcg", "action=binary_state&symbol=USD/JPY")

        self.assertTrue(status.startswith("502"))
        self.assertEqual(headers["Content-Type"], "application/json; charset=utf-8")
        self.assertIn(b'"error": "historical case fetch failed"', body)

    def test_binary_state_uses_no_store_headers(self) -> None:
        with mock.patch("app_core.build_binary_public_state", return_value={"balance": 100000}):
            status, headers, _ = self.run_application("/app.xcg", "action=binary_state&symbol=USD/JPY")

        self.assertTrue(status.startswith("200"))
        self.assertEqual(headers["Cache-Control"], "no-store, no-cache, must-revalidate, max-age=0")

    def test_security_headers_are_present(self) -> None:
        status, headers, _ = self.run_application("/styles.css")

        self.assertTrue(status.startswith("200"))
        self.assertEqual(headers["Content-Security-Policy"], "frame-ancestors 'self'")
        self.assertEqual(headers["Referrer-Policy"], "strict-origin-when-cross-origin")
        self.assertEqual(headers["X-Content-Type-Options"], "nosniff")
        self.assertEqual(headers["X-Frame-Options"], "SAMEORIGIN")

    def test_invalid_session_cookie_is_rotated(self) -> None:
        status, headers, _ = self.run_application(
            "/app.xcg",
            "action=state",
            environ_overrides={"HTTP_COOKIE": "signal_sweep_session=../../escape"},
        )

        self.assertTrue(status.startswith("200"))
        self.assertIn("Set-Cookie", headers)
        self.assertRegex(headers["Set-Cookie"], re.compile(r"signal_sweep_session=[0-9a-f]{32}"))

    def test_options_returns_204_without_cookie(self) -> None:
        status, headers, body = self.run_application(
            "/app.xcg",
            "action=state",
            environ_overrides={"REQUEST_METHOD": "OPTIONS"},
        )

        self.assertTrue(status.startswith("204"))
        self.assertEqual(headers["Allow"], "GET, POST, OPTIONS")
        self.assertNotIn("Set-Cookie", headers)
        self.assertEqual(body, b"")


if __name__ == "__main__":
    unittest.main()
