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
from vkm.core.models import PipelineRequest  # noqa: E402
from vkm.core.pipeline import VideoKnowledgePipeline  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Build a reusable artifact directory without running DeepSeek."
    )
    input_group = parser.add_mutually_exclusive_group(required=True)
    input_group.add_argument("--url", help="Bilibili or Douyin video URL.")
    input_group.add_argument("--local", help="Path to a local MP4 file.")
    args = parser.parse_args()

    local_file = Path(args.local).resolve() if args.local else None
    if local_file and not local_file.is_file():
        print(f"ERROR: local video not found: {local_file}")
        return 1

    try:
        result = VideoKnowledgePipeline(
            log_callback=print,
            status_callback=print,
        ).build_artifact_only(
            PipelineRequest(
                url=args.url,
                local_file=local_file,
                output_dir=PROJECT_ROOT / "outputs",
            )
        )
    except (ConfigurationError, AppError, RuntimeError) as exc:
        print(f"ERROR: {exc}")
        return 1

    print(f"Artifact: {result.artifact_dir}")
    print(f"Title: {result.metadata.title}")
    print(f"Transcript source: {result.transcript_source}")
    print(f"Segments: {result.segment_count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
