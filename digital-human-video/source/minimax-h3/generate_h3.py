"""Create, poll, and download one MiniMax H3 text-to-video job.

The script intentionally reads the credential only from MINIMAX_API_KEY and
never writes it to the project directory or command output.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


BASE_URL = "https://api.minimaxi.com"
MODEL = "MiniMax-H3"


def request_json(url: str, api_key: str, payload: dict | None = None) -> dict:
    headers = {"Authorization": f"Bearer {api_key}"}
    data = None
    if payload is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = Request(url, data=data, headers=headers, method="POST" if data else "GET")
    with urlopen(request, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def download(url: str, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with urlopen(url, timeout=180) as response, destination.open("wb") as output:
        while chunk := response.read(1024 * 1024):
            output.write(chunk)


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate one MiniMax H3 vertical B-roll clip.")
    parser.add_argument("--prompt", required=True, help="Video prompt; do not request readable text or logos.")
    parser.add_argument("--output", required=True, type=Path, help="Final .mp4 destination.")
    parser.add_argument("--duration", type=int, default=4, choices=range(4, 16), help="4-15 seconds.")
    parser.add_argument("--resolution", default="768P", choices=("768P", "2K"))
    parser.add_argument("--ratio", default="9:16")
    parser.add_argument("--poll-seconds", type=int, default=10)
    parser.add_argument("--max-wait-seconds", type=int, default=900)
    parser.add_argument("--dry-run", action="store_true", help="Print the safe request shape without sending it.")
    args = parser.parse_args()

    api_key = os.environ.get("MINIMAX_API_KEY")
    if not api_key:
        print("MINIMAX_API_KEY is not configured. Set it in the user environment, then open a new terminal.", file=sys.stderr)
        return 2

    payload = {
        "model": MODEL,
        "content": [{"type": "text", "text": args.prompt}],
        "duration": args.duration,
        "resolution": args.resolution,
        "ratio": args.ratio,
    }
    if args.dry_run:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 0

    try:
        created = request_json(f"{BASE_URL}/v2/video_generation", api_key, payload)
        task_id = created["task_id"]
        print(f"Submitted MiniMax H3 task: {task_id}")
        deadline = time.monotonic() + args.max_wait_seconds
        while time.monotonic() < deadline:
            time.sleep(args.poll_seconds)
            result = request_json(f"{BASE_URL}/v2/query/video_generation/{task_id}", api_key)
            task = result["task"]
            status = task["status"]
            print(f"Task status: {status}")
            if status == "succeeded":
                video_url = task["content"]["url"]
                download(video_url, args.output)
                print(f"Saved: {args.output}")
                return 0
            if status in {"failed", "cancelled"}:
                raise RuntimeError(f"MiniMax task {status}: {task.get('error')}")
        raise TimeoutError("Timed out waiting for MiniMax H3. Query the task ID in the MiniMax console.")
    except (HTTPError, URLError, KeyError, RuntimeError, TimeoutError) as error:
        print(f"MiniMax H3 generation failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
