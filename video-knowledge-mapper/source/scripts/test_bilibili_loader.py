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

from vkm.core.bilibili_loader import BilibiliLoader  # noqa: E402


DEFAULT_COOKIES_FILE = PROJECT_ROOT / "secrets" / "bilibili_cookies.txt"


def main() -> int:
    parser = argparse.ArgumentParser(description="Test Bilibili video extraction.")
    parser.add_argument("url", help="Bilibili video URL, for example https://www.bilibili.com/video/BVxxxx")
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
        print('Using default cookies file: "secrets/bilibili_cookies.txt"')

    loader = BilibiliLoader(
        cookies_from_browser=args.cookies_from_browser,
        cookies_file=cookies_file,
        auto_browser_cookies=args.auto_browser_cookies,
    )
    result = loader.extract(args.url)
    print(json.dumps(result.__dict__, ensure_ascii=False, indent=2))

    if result.error_code in {"NEED_LOGIN", "COOKIES_FILE_NOT_FOUND"}:
        print("\nCookie fallback guidance:")
        print("请在浏览器确认已登录 B站，并优先尝试：")
        print('python scripts/test_bilibili_loader.py "<url>" --cookies-from-browser edge')
        print("\n如果仍失败，请使用 Netscape 格式 cookies.txt：")
        print('python scripts/test_bilibili_loader.py "<url>" --cookies "secrets/bilibili_cookies.txt"')

    if result.metadata_path:
        metadata_path = Path(result.metadata_path)
        if metadata_path.exists():
            metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
            subtitle_keys = metadata.get("subtitle_keys") or {}
            print("\nSubtitle keys from metadata:")
            print(json.dumps(subtitle_keys, ensure_ascii=False, indent=2))

    return 0 if result.success else 1


if __name__ == "__main__":
    raise SystemExit(main())
