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

    def test_home_assets_are_served(self) -> None:
        for path, markers in (
            (
                "/home.css",
                (
                    b".work-grid",
                    b".work-image",
                    b"touch-action: none",
                    b".logo-fallback",
                    b".street-intro",
                    b".street-intro-pending",
                    b".christmas-intro__flight",
                    b"space-moon-stage-v5.jpg",
                    b"space-rocket-v1.png",
                    b".jackpot-intro__reels",
                    b"@keyframes christmas-flight",
                    b"@keyframes space-rocket-landing",
                    b"@keyframes jackpot-reel-land",
                    b"@keyframes jackpot-party-cracker",
                ),
            ),
            ("/home.js", (b"initLogoScene", b"logo.js?v=20260901f", b'=== "jackpot" ? 5 : 2')),
            (
                "/intro.js",
                (
                    b"street-intro-active",
                    b"street-intro-pending",
                    b"prefers-reduced-motion",
                    b"SECRET_CHANCE = 0.01",
                    b'ASSET_VERSION = "20260901f"',
                    b'durationMs: 5000',
                    b"seeton-intro-debug-index-v2",
                    b"192\\.168\\.",
                    b'christmas-stage-v4.png',
                    b'christmas-flight-v3.png',
                    b'space-moon-stage-v5.jpg',
                    b'space-rocket-v1.png',
                    b'jackpot-machine-v4.png',
                    b'jackpot-party-cracker-v1.png',
                    b'event.animationName === "jackpot-intro-curtain"',
                ),
            ),
            ("/logo.js", (b"setAnimationLoop", b'"pointerdown"', b'"pointermove"', b'"has-logo"')),
        ):
            status, _, body = self.run_application(path)
            self.assertTrue(status.startswith("200"), msg="expected 200 for %s" % path)
            for marker in markers:
                self.assertIn(marker, body)

    def test_home_intro_art_is_served_as_avif(self) -> None:
        for filename in (
            "street-paint.avif",
            "christmas-paint.avif",
            "space-paint.avif",
            "jackpot-paint.avif",
            "christmas-flight-v2.avif",
            "christmas-stage-v2.avif",
            "space-milky-way-v2.avif",
            "jackpot-machine-v2.avif",
        ):
            status, headers, body = self.run_application("/static/intro/" + filename)
            self.assertTrue(status.startswith("200"), msg="expected 200 for %s" % filename)
            self.assertEqual(headers["Content-Type"], "image/avif")
            self.assertEqual(body[4:12], b"ftypavif")

    def test_non_street_intro_animations_do_not_blur_text_or_art(self) -> None:
        with open(os.path.join(PUBLISH_ROOT, "static", "home.css"), encoding="utf-8") as handle:
            css = handle.read()

        street_start = css.index("@keyframes street-intro-word")
        street_end = css.index("\n@keyframes ", street_start + 1)
        self.assertIn("blur(", css[street_start:street_end])

        for name in (
            "christmas-flight",
            "christmas-intro-word",
            "space-moon-stage",
            "space-rocket-landing",
            "space-intro-word",
            "jackpot-machine",
            "jackpot-reel-land",
            "jackpot-party-cracker",
        ):
            start = css.index("@keyframes " + name)
            end = css.find("\n@keyframes ", start + 1)
            block = css[start:] if end == -1 else css[start:end]
            self.assertNotIn("blur(", block, msg="unexpected blur in %s" % name)

    def test_browser_compatible_intro_art_is_served(self) -> None:
        for filename, content_type, signature in (
            ("street-paint-v2.png", "image/png", b"\x89PNG\r\n\x1a\n"),
            ("christmas-stage-v4.png", "image/png", b"\x89PNG\r\n\x1a\n"),
            ("christmas-flight-v3.png", "image/png", b"\x89PNG\r\n\x1a\n"),
            ("space-moon-stage-v5.jpg", "image/jpeg", b"\xff\xd8\xff"),
            ("space-rocket-v1.png", "image/png", b"\x89PNG\r\n\x1a\n"),
            ("jackpot-machine-v4.png", "image/png", b"\x89PNG\r\n\x1a\n"),
            ("jackpot-party-cracker-v1.png", "image/png", b"\x89PNG\r\n\x1a\n"),
        ):
            status, headers, body = self.run_application("/static/intro/" + filename)
            self.assertTrue(status.startswith("200"), msg="expected 200 for %s" % filename)
            self.assertEqual(headers["Content-Type"], content_type)
            self.assertTrue(body.startswith(signature))

    def test_secret_reels_stop_the_actual_symbol_belts_on_777(self) -> None:
        with open(os.path.join(PUBLISH_ROOT, "static", "home.css"), encoding="utf-8") as handle:
            css = handle.read()
        with open(os.path.join(PUBLISH_ROOT, "static", "index.html"), encoding="utf-8") as handle:
            html = handle.read()

        belts = re.findall(r'<div class="jackpot-intro__belt">(.*?)</div>', html)
        self.assertEqual([belt.count("<span") for belt in belts], [21, 27, 33])
        self.assertTrue(all(belt.count('class="jackpot-intro__target">7') == 1 for belt in belts))
        self.assertIn("animation: jackpot-reel-land var(--spin-time) linear 0.45s 1 both", css)
        for stop in ("-85.714286%", "-88.888889%", "-90.909091%"):
            self.assertIn(stop, css)
        self.assertNotIn("jackpot-reel-spin", css)
        self.assertNotIn("jackpot-intro__seven", html)
        self.assertNotIn("jackpot-intro__win", html)
        self.assertNotIn("jackpot-intro__seeton", html)

    def test_index_is_minimal_home_with_rogue_link_and_logo(self) -> None:
        for path in ("/", "/index.html", "/app.xcg", "/app.py"):
            status, _, body = self.run_application(path)
            self.assertTrue(status.startswith("200"), msg="expected 200 for %s" % path)
            self.assertIn(b"/static/intro.js?v=20260901g", body)
            self.assertIn(b"/static/home.css?v=20260901g", body)
            self.assertIn(b"/static/home.js?v=20260901f", body)
            for game in ("rogue", "minesweeper", "binary", "planet", "management", "fishing", "solitaire"):
                self.assertIn(('href="/%s/"' % game).encode("ascii"), body)
            for repository in (
                "Voynich-public",
                "ai-world-rule-engine",
                "BottleShipCrypt",
                "AIwolf",
                "tikbuzz",
            ):
                self.assertIn(
                    ('href="https://github.com/seeton/%s"' % repository).encode("ascii"),
                    body,
                )
            self.assertIn(b'href="https://github.com/seeton" rel="me"', body)
            self.assertIn(b'class="projects"', body)
            self.assertEqual(body.count(b'class="work-item"'), 12)
            self.assertEqual(body.count(b'class="work-image"'), 12)
            self.assertEqual(body.count(b'loading="lazy" decoding="async"'), 12)
            self.assertIn("AIwolf — 1人用プロトタイプ".encode("utf-8"), body)
            self.assertIn("ユーザー間の通信・投稿・マッチング機能はありません。".encode("utf-8"), body)
            self.assertIn(b'id="orbit-stage"', body)
            self.assertIn(b'id="seeton-canvas"', body)
            self.assertIn(b'class="logo-fallback"', body)
            self.assertIn(b'class="street-intro" aria-hidden="true"', body)
            self.assertIn(b'class="christmas-intro__flight"', body)
            self.assertIn(b'class="space-intro__moon"', body)
            self.assertIn(b'class="space-intro__rocket"', body)
            self.assertEqual(body.count(b'class="jackpot-intro__belt"'), 3)
            self.assertEqual(body.count(b'class="jackpot-intro__target">7'), 3)
            self.assertIn(b'class="jackpot-intro__cracker jackpot-intro__cracker--left"', body)
            self.assertIn(b'class="jackpot-intro__cracker jackpot-intro__cracker--right"', body)
            self.assertNotIn('大当たり'.encode("utf-8"), body)
            self.assertNotIn(b"jackpot-intro__seven", body)
            self.assertNotIn(b"jackpot-intro__seeton", body)
            self.assertNotIn(b"/static/app.js", body)
            self.assertNotIn(b"data-game-select", body)

    def test_portfolio_images_are_served_as_jpeg(self) -> None:
        filenames = (
            "game-rogue.jpg",
            "game-minesweeper.jpg",
            "game-binary.jpg",
            "game-planet.jpg",
            "game-management.jpg",
            "game-fishing.jpg",
            "game-solitaire.jpg",
            "project-voynich.jpg",
            "project-ai-world.jpg",
            "project-bottleship.jpg",
            "project-aiwolf.jpg",
            "project-tikbuzz.jpg",
        )
        for filename in filenames:
            status, headers, body = self.run_application("/static/portfolio/" + filename)
            self.assertTrue(status.startswith("200"), msg="expected 200 for %s" % filename)
            self.assertEqual(headers["Content-Type"], "image/jpeg")
            self.assertTrue(body.startswith(b"\xff\xd8\xff"), msg="expected JPEG bytes for %s" % filename)

    def test_per_game_paths_serve_game_shell(self) -> None:
        for game in ("minesweeper", "binary", "planet", "management", "fishing", "solitaire"):
            for suffix in ("", "/"):
                status, _, body = self.run_application("/" + game + suffix)
                self.assertTrue(
                    status.startswith("200"),
                    msg="expected 200 for /%s%s, got %s" % (game, suffix, status),
                )
                self.assertIn(b"/static/styles.css?v=20260824a", body)
                self.assertIn(b"/static/app.js?v=20260824a", body)
                self.assertIn(b"data-game-select", body)
                self.assertNotIn(b"/static/home.js", body)

    def test_rogue_path_is_not_claimed_by_parent_app(self) -> None:
        status, _, body = self.run_application("/rogue/")
        self.assertTrue(status.startswith("404"))
        self.assertNotIn(b"data-game-select", body)

    def test_home_and_game_copies_are_synchronized(self) -> None:
        workspace_root = os.path.dirname(PUBLISH_ROOT)
        preview_root = os.path.join(workspace_root, "publish2")

        def read_bytes(*parts):
            with open(os.path.join(*parts), "rb") as source:
                return source.read()

        self.assertEqual(
            read_bytes(PUBLISH_ROOT, "index.html"),
            read_bytes(PUBLISH_ROOT, "static", "index.html"),
        )
        self.assertEqual(
            read_bytes(PUBLISH_ROOT, "game.html"),
            read_bytes(PUBLISH_ROOT, "static", "game.html"),
        )
        for asset in ("home.css", "home.js", "intro.js", "logo.js"):
            self.assertEqual(
                read_bytes(PUBLISH_ROOT, "static", asset),
                read_bytes(preview_root, asset),
            )

        static_index = read_bytes(PUBLISH_ROOT, "static", "index.html")
        expected_preview = (
            static_index.replace(b"/static/home.css", b"/home.css")
            .replace(b"/static/home.js", b"/home.js")
            .replace(b"/static/intro.js", b"/intro.js")
            .replace(b"/static/intro/", b"/intro/")
            .replace(b"/static/portfolio/", b"/portfolio/")
        )
        self.assertEqual(expected_preview, read_bytes(preview_root, "index.html"))

        for asset in (
            "street-paint.avif",
            "christmas-paint.avif",
            "space-paint.avif",
            "jackpot-paint.avif",
            "christmas-flight-v2.avif",
            "christmas-stage-v2.avif",
            "space-milky-way-v2.avif",
            "jackpot-machine-v2.avif",
            "christmas-stage-v3.png",
            "christmas-stage-v4.png",
            "christmas-flight-v3.png",
            "space-milky-way-v3.jpg",
            "space-milky-way-v4.jpg",
            "space-moon-stage-v5.jpg",
            "space-rocket-v1.png",
            "jackpot-machine-v3.png",
            "jackpot-machine-v4.png",
            "jackpot-party-cracker-v1.png",
            "street-paint-v2.png",
            "space-paint-v2.png",
            "jackpot-paint-v2.png",
        ):
            self.assertEqual(
                read_bytes(PUBLISH_ROOT, "static", "intro", asset),
                read_bytes(preview_root, "intro", asset),
            )

        portfolio_names = {
            name for name in os.listdir(os.path.join(PUBLISH_ROOT, "static", "portfolio")) if name.endswith(".jpg")
        }
        self.assertEqual(len(portfolio_names), 12)
        self.assertEqual(
            portfolio_names,
            {name for name in os.listdir(os.path.join(preview_root, "portfolio")) if name.endswith(".jpg")},
        )
        for name in portfolio_names:
            self.assertEqual(
                read_bytes(PUBLISH_ROOT, "static", "portfolio", name),
                read_bytes(preview_root, "portfolio", name),
            )

    def test_apache_denies_python_source_files(self) -> None:
        with open(os.path.join(PUBLISH_ROOT, ".htaccess"), "r", encoding="utf-8") as source:
            apache_config = source.read()
        self.assertIn("AddType image/avif .avif", apache_config)
        for filename in ("app.py", "app_core.py", "binary_sim.py", "minesweeper.py", "__init__.py"):
            self.assertIn(filename.replace(".", r"\."), apache_config)

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
