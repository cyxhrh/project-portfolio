from __future__ import annotations

import argparse
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = PROJECT_ROOT / "src"
sys.path.insert(0, str(SRC_DIR))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from vkm.core.config import AppError, ConfigurationError  # noqa: E402
from vkm.core.deepseek_artifact_runner import run_deepseek_from_artifact  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run DeepSeek note generation from an existing artifact directory."
    )
    parser.add_argument(
        "artifact_dir",
        help="Path like outputs/bilibili_BV1AcRdBaEa8 containing metadata.json and transcript.txt.",
    )
    parser.add_argument(
        "--output-dir",
        help="Optional Markdown output directory. Defaults to the project notes directory.",
    )
    args = parser.parse_args()

    try:
        result = run_deepseek_from_artifact(
            Path(args.artifact_dir),
            output_dir=Path(args.output_dir) if args.output_dir else None,
            log_callback=print,
        )
    except (ConfigurationError, AppError, FileNotFoundError) as exc:
        print(f"ERROR: {exc}")
        return 1

    print(f"Markdown: {result.output_path}")
    if result.table_summary_path:
        print(f"Table summary: {result.table_summary_path}")
    if result.mindmap_json_path:
        print(f"Mindmap JSON: {result.mindmap_json_path}")
    if result.xmind_path:
        print(f"XMind: {result.xmind_path}")
    print(f"Segments: {result.segment_count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
