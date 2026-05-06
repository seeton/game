import json
import os
import re
import sys
import tempfile
import time
import unittest
from io import BytesIO
from unittest import mock

TEST_ROOT = os.path.dirname(os.path.abspath(__file__))
PUBLISH_ROOT = os.path.dirname(TEST_ROOT)

if PUBLISH_ROOT not in sys.path:
    sys.path.insert(0, PUBLISH_ROOT)

from app_core import application, cleanup_old_sessions, load_binary_session, make_cookie_header


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
        self.assertIn(b"/static/styles.css", body)
        self.assertIn(b"/static/app.js?v=20260506b", body)
        self.assertIn(b"GAMES", body)

    def test_per_game_paths_serve_index_html(self) -> None:
        for game in ("minesweeper", "binary", "planet", "management", "fishing", "solitaire"):
            for suffix in ("", "/"):
                status, _, body = self.run_application("/" + game + suffix)
                self.assertTrue(
                    status.startswith("200"),
                    msg="expected 200 for /%s%s, got %s" % (game, suffix, status),
                )
                self.assertIn(b"/static/app.js", body)

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

    def _new_game(self, difficulty: str):
        body = ('{"difficulty":"%s"}' % difficulty).encode("utf-8")
        status, headers, response_body = self.run_application(
            "/app.xcg",
            "action=new",
            environ_overrides={
                "REQUEST_METHOD": "POST",
                "CONTENT_LENGTH": str(len(body)),
                "wsgi.input": BytesIO(body),
            },
        )
        payload = json.loads(response_body.decode("utf-8"))
        return status, headers, payload

    def test_easy_new_game_uses_5x5_board(self) -> None:
        status, headers, payload = self._new_game("easy")

        self.assertTrue(status.startswith("200"))
        self.assertEqual(headers["Content-Type"], "application/json; charset=utf-8")
        self.assertEqual(payload["rows"], 5)
        self.assertEqual(payload["cols"], 5)
        self.assertEqual(payload["mines"], 5)
        self.assertEqual(payload["label"], "easy")

    def test_medium_new_game_uses_7x7_board(self) -> None:
        status, _, payload = self._new_game("medium")

        self.assertTrue(status.startswith("200"))
        self.assertEqual(payload["rows"], 7)
        self.assertEqual(payload["cols"], 7)
        self.assertEqual(payload["label"], "medium")

    def test_hard_new_game_uses_15x15_board(self) -> None:
        status, _, payload = self._new_game("hard")

        self.assertTrue(status.startswith("200"))
        self.assertEqual(payload["rows"], 15)
        self.assertEqual(payload["cols"], 15)
        self.assertEqual(payload["label"], "hard")

    def test_security_headers_are_present(self) -> None:
        status, headers, _ = self.run_application("/styles.css")

        self.assertTrue(status.startswith("200"))
        self.assertIn("frame-ancestors 'self'", headers["Content-Security-Policy"])
        self.assertIn("default-src 'self'", headers["Content-Security-Policy"])
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

    def test_cleanup_old_sessions_removes_stale_binary_files(self) -> None:
        with tempfile.TemporaryDirectory() as runtime_dir:
            mines_dir = os.path.join(runtime_dir, "sessions")
            binary_dir = os.path.join(runtime_dir, "binary_sessions")
            os.makedirs(mines_dir)
            os.makedirs(binary_dir)

            stale_path = os.path.join(binary_dir, "%s.json" % ("a" * 32))
            fresh_path = os.path.join(binary_dir, "%s.json" % ("b" * 32))
            invalid_path = os.path.join(binary_dir, "junk.txt")
            temp_path = os.path.join(binary_dir, "stale.tmp")

            for path in (stale_path, fresh_path, invalid_path, temp_path):
                with open(path, "w", encoding="utf-8") as handle:
                    handle.write("{}")

            now_epoch = time.time()
            os.utime(stale_path, (now_epoch - (60 * 60 * 7), now_epoch - (60 * 60 * 7)))
            os.utime(temp_path, (now_epoch - (60 * 20), now_epoch - (60 * 20)))

            with mock.patch("app_core.RUNTIME_DIR", runtime_dir), mock.patch(
                "app_core.MINESWEEPER_SESSION_DIR", mines_dir
            ), mock.patch("app_core.BINARY_SESSION_DIR", binary_dir):
                cleanup_old_sessions()

            self.assertFalse(os.path.exists(stale_path))
            self.assertFalse(os.path.exists(invalid_path))
            self.assertFalse(os.path.exists(temp_path))
            self.assertTrue(os.path.exists(fresh_path))

    def test_corrupt_binary_session_is_deleted_on_load(self) -> None:
        with tempfile.TemporaryDirectory() as runtime_dir:
            binary_dir = os.path.join(runtime_dir, "binary_sessions")
            os.makedirs(binary_dir)
            session_id = "c" * 32
            session_path = os.path.join(binary_dir, "%s.json" % session_id)
            with open(session_path, "w", encoding="utf-8") as handle:
                handle.write("{not-json")

            with mock.patch("app_core.BINARY_SESSION_DIR", binary_dir):
                session = load_binary_session(session_id)

            self.assertIsNone(session)
            self.assertFalse(os.path.exists(session_path))


if __name__ == "__main__":
    unittest.main()
