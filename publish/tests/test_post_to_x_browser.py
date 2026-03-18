import os
import sys
import unittest
from pathlib import Path

TEST_ROOT = os.path.dirname(os.path.abspath(__file__))
PUBLISH_ROOT = os.path.dirname(TEST_ROOT)
REPO_ROOT = os.path.dirname(PUBLISH_ROOT)

if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from scripts.post_to_x_browser import (
    DEFAULT_PROFILE_DIR,
    is_login_url,
    parse_args,
    resolve_profile_dir,
)


class PostToXBrowserTests(unittest.TestCase):
    def test_resolve_profile_dir_defaults_to_local_profile(self):
        self.assertEqual(resolve_profile_dir(), DEFAULT_PROFILE_DIR)

    def test_resolve_profile_dir_resolves_custom_path(self):
        custom = resolve_profile_dir("./local/custom-x-profile")
        self.assertTrue(str(custom).endswith(str(Path("local/custom-x-profile"))))

    def test_is_login_url_detects_x_login_pages(self):
        self.assertTrue(is_login_url("https://x.com/i/flow/login"))
        self.assertTrue(is_login_url("https://twitter.com/login"))
        self.assertFalse(is_login_url("https://x.com/compose/post"))

    def test_parse_args_for_post_mode(self):
        args = parse_args(["post", "--text", "hello", "--dry-run", "--headless"])
        self.assertEqual(args.command, "post")
        self.assertEqual(args.text, "hello")
        self.assertTrue(args.dry_run)
        self.assertTrue(args.headless)


if __name__ == "__main__":
    unittest.main()
