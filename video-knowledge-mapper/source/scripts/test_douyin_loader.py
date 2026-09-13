from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = PROJECT_ROOT / "src"
sys.path.insert(0, str(SRC_DIR))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from vkm.core.douyin_loader import DouyinLoader  # noqa: E402


DEFAULT_COOKIES_FILE = PROJECT_ROOT / "secrets" / "douyin_cookies.txt"


def main() -> int:
    parser = argparse.ArgumentParser(description="Test Douyin video extraction.")
    parser.add_argument("url", help="Douyin video URL, for example https://www.douyin.com/video/...")
    browser_group = parser.add_mutually_exclusive_group()
    browser_group.add_argument(
        "--cookies-from-browser",
        choices=["edge", "chrome", "firefox", "brave"],
        help="Read cookies from a local browser profile. Windows recommendation: --cookies-from-browser edge",
    )
    browser_group.add_argument(
        "--auto-browser-cookies",
        action="store_true",
        help="Try browser cookies in order: edge -> chrome -> firefox -> brave.",
    )
    parser.add_argument(
        "--cookies",
        dest="cookies_file",
        help="Path to a Netscape-format cookies.txt file.",
    )
    args = parser.parse_args()

    cookies_file = args.cookies_file
    if (
        cookies_file is None
        and args.cookies_from_browser is None
        and not args.auto_browser_cookies
        and DEFAULT_COOKIES_FILE.exists()
    ):
        cookies_file = str(DEFAULT_COOKIES_FILE)
        print('Using default cookies file: "secrets/douyin_cookies.txt"')

    loader = DouyinLoader(
        cookies_from_browser=args.cookies_from_browser,
        cookies_file=cookies_file,
        auto_browser_cookies=args.auto_browser_cookies,
    )
    result = loader.extract(args.url)
    print(json.dumps(result.__dict__, ensure_ascii=False, indent=2))

    if result.error_code in {"NEED_LOGIN", "COOKIES_FILE_NOT_FOUND"}:
        print("\nCookie fallback guidance:")
        print("请在浏览器确认已登录抖音，并优先尝试：")
        print('python scripts/test_douyin_loader.py "<url>" --auto-browser-cookies')
        print("\n如果仍失败，请使用 Netscape 格式 cookies.txt：")
        print('python scripts/test_douyin_loader.py "<url>" --cookies "secrets/douyin_cookies.txt"')

    return 0 if result.success else 1


if __name__ == "__main__":
    raise SystemExit(main())
