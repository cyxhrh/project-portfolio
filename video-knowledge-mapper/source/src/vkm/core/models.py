from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Literal


TranscriptSource = Literal["subtitle", "auto_subtitle", "whisper"]


@dataclass(frozen=True)
class TranscriptSegment:
    start: float
    end: float
    text: str

    def timestamp(self) -> str:
        return seconds_to_timestamp(self.start)


@dataclass(frozen=True)
class VideoMetadata:
    title: str
    source: str
    webpage_url: str | None = None
    local_path: Path | None = None
    duration: float | None = None
    uploader: str | None = None


@dataclass(frozen=True)
class PipelineRequest:
    url: str | None
    local_file: Path | None
    output_dir: Path
    api_key: str | None = None
    move_to_done: bool = False
    done_dir: Path | None = None


@dataclass(frozen=True)
class PipelineResult:
    output_path: Path
    metadata: VideoMetadata
    transcript_source: TranscriptSource
    segment_count: int
    moved_video_path: Path | None = None
    artifact_dir: Path | None = None
    xmind_path: Path | None = None
    mindmap_json_path: Path | None = None
    table_summary_path: Path | None = None


@dataclass(frozen=True)
class PipelineArtifactResult:
    artifact_dir: Path
    metadata: VideoMetadata
    transcript_source: TranscriptSource
    segment_count: int


@dataclass(frozen=True)
class BatchPipelineResult:
    processed: list[PipelineResult]
    skipped_count: int = 0


@dataclass(frozen=True)
class FeishuSyncResult:
    markdown_path: Path
    title: str
    command: list[str]
    stdout: str
    stderr: str
    document_url: str | None = None
    base_token: str | None = None
    table_id: str | None = None
    record_id: str | None = None


def seconds_to_timestamp(seconds: float) -> str:
    total = max(0, int(seconds))
    hours = total // 3600
    minutes = (total % 3600) // 60
    secs = total % 60
    if hours:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"
