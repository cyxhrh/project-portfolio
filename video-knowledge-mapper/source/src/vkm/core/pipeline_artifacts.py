from __future__ import annotations

import hashlib
import json
import re
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any, Literal

from vkm.core.models import TranscriptSegment, VideoMetadata


ArtifactPlatform = Literal["bilibili", "douyin", "local"]


def segments_to_transcript_text(segments: list[TranscriptSegment]) -> str:
    return "\n".join(
        f"[{segment.timestamp()}] {segment.text.strip()}"
        for segment in segments
        if segment.text.strip()
    )


def write_transcript_file(path: Path, segments: list[TranscriptSegment]) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(segments_to_transcript_text(segments), encoding="utf-8")
    return path


def artifact_dir_for_source(
    base_dir: Path,
    platform: ArtifactPlatform,
    source_id: str,
    *,
    uniqueness_hint: str | None = None,
) -> Path:
    safe_id = safe_artifact_name(source_id) or "unknown"
    if platform == "local" and uniqueness_hint:
        digest = hashlib.sha1(uniqueness_hint.encode("utf-8")).hexdigest()[:8]
        safe_id = f"{safe_id}_{digest}"
    return base_dir / f"{platform}_{safe_id}"


def safe_artifact_name(value: str, max_length: int = 80) -> str:
    cleaned = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", str(value))
    cleaned = re.sub(r"\s+", "_", cleaned).strip(" ._")
    return cleaned[:max_length].rstrip(" ._")


def stable_id_from_text(value: str) -> str:
    return hashlib.sha1(value.encode("utf-8")).hexdigest()[:12]


def write_metadata_artifact(
    path: Path,
    metadata: VideoMetadata,
    *,
    platform: ArtifactPlatform,
    video_id: str | None,
    transcript_source: str,
    source_metadata: dict[str, Any] | None = None,
) -> Path:
    payload: dict[str, Any] = dict(source_metadata or {})
    payload.update(
        {
            "title": metadata.title,
            "uploader": metadata.uploader,
            "duration": metadata.duration,
            "source": metadata.source,
            "webpage_url": metadata.webpage_url,
            "local_path": str(metadata.local_path) if metadata.local_path else None,
            "platform": platform,
            "video_id": video_id,
            "transcript_source": transcript_source,
            "artifact_written_at": datetime.now().isoformat(timespec="seconds"),
        }
    )
    return write_json(path, payload)


def write_source_result_artifact(path: Path, payload: dict[str, Any]) -> Path:
    return write_json(path, payload)


def copy_source_result_artifact(source: Path | None, target: Path) -> Path | None:
    if not source or not source.is_file():
        return None
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)
    return target


def copy_debug_report(source: Path | None, target: Path) -> Path | None:
    if not source or not source.is_file():
        return None
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)
    return target


def write_debug_report(
    path: Path,
    *,
    platform: ArtifactPlatform,
    metadata: VideoMetadata,
    transcript_source: str,
    source_result: dict[str, Any],
    transcript_path: Path,
) -> Path:
    lines = [
        "# Pipeline Artifact Debug Report",
        "",
        f"- 生成时间: {datetime.now().isoformat(timespec='seconds')}",
        f"- 平台: {platform}",
        f"- 视频标题: {metadata.title}",
        f"- 作者/来源: {metadata.uploader or metadata.source}",
        f"- 视频时长: {metadata.duration or ''}",
        f"- 来源链接: {metadata.webpage_url or metadata.source}",
        f"- 转写来源: {transcript_source}",
        f"- transcript: {transcript_path}",
        f"- source success: {source_result.get('success')}",
        f"- source type: {source_result.get('source_type')}",
        f"- error: {source_result.get('error_message') or ''}",
    ]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return path


def read_json_if_exists(path: Path | None) -> dict[str, Any]:
    if not path or not path.is_file():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict[str, Any]) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return path
