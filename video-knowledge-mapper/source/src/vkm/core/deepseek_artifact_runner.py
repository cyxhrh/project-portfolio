from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path

from vkm.core.config import AI_VIDEO_NOTES_DIR, AppConfig, AppError
from vkm.core.deepseek import DeepSeekNoteGenerator
from vkm.core.markdown_writer import replace_mermaid_section, write_markdown_note
from vkm.core.mindmap import (
    fallback_mindmap_from_markdown,
    mindmap_to_mermaid,
    parse_mindmap_response,
    write_mindmap_json_file,
)
from vkm.core.models import TranscriptSegment, VideoMetadata
from vkm.core.table_summary import (
    parse_table_summary_response,
    write_table_summary_json_file,
)
from vkm.core.xmind_writer import write_xmind_file
from vkm.utils.logging import CallbackLogger, LogCallback


@dataclass(frozen=True)
class DeepSeekArtifactResult:
    output_path: Path
    xmind_path: Path | None
    mindmap_json_path: Path | None
    table_summary_path: Path | None
    segment_count: int


def run_deepseek_from_artifact(
    artifact_dir: Path,
    *,
    api_key: str | None = None,
    output_dir: Path | None = None,
    log_callback: LogCallback | None = None,
    generator_cls: type[DeepSeekNoteGenerator] = DeepSeekNoteGenerator,
) -> DeepSeekArtifactResult:
    artifact_dir = artifact_dir.resolve()
    metadata_path = artifact_dir / "metadata.json"
    transcript_path = artifact_dir / "transcript.txt"
    if not metadata_path.is_file():
        raise AppError("这个结果目录不完整，缺少视频信息，请重新生成学习笔记。")
    if not transcript_path.is_file():
        raise AppError("这个结果目录不完整，缺少转写文本，请重新生成学习笔记。")

    metadata = metadata_from_artifact(metadata_path)
    segments = segments_from_transcript_text(transcript_path.read_text(encoding="utf-8-sig"))
    if not segments:
        raise AppError("这个结果目录不完整，转写文本为空，请重新生成学习笔记。")

    config = AppConfig.from_env(api_key)
    notes_dir = output_dir or config.notes_dir or AI_VIDEO_NOTES_DIR
    logger = CallbackLogger(log_callback)
    generator = generator_cls(config, logger)
    transcript_source = str(
        json.loads(metadata_path.read_text(encoding="utf-8")).get(
            "transcript_source", "artifact"
        )
    )

    note = generator.generate(
        metadata=metadata,
        segments=segments,
        transcript_source=transcript_source,
    )
    output_path = write_markdown_note(
        notes_dir,
        metadata,
        note,
        transcript_source,
        config.deepseek_model,
    )

    table_summary_path: Path | None = None
    mindmap_json_path: Path | None = None
    xmind_path: Path | None = None

    try:
        raw_table_summary = generator.generate_table_summary_json(
            metadata=metadata,
            segments=segments,
            transcript_source=transcript_source,
        )
        table_summary = parse_table_summary_response(
            raw_table_summary,
            fallback_title=metadata.title,
        )
        table_summary_path = write_table_summary_json_file(output_path, table_summary)
    except Exception as exc:
        logger.info(f"表格索引摘要生成失败，主流程继续：{exc}")

    try:
        raw_mindmap = generator.generate_mindmap_json(
            metadata=metadata,
            segments=segments,
            transcript_source=transcript_source,
        )
        mindmap = parse_mindmap_response(raw_mindmap)
        mindmap_json_path = write_mindmap_json_file(output_path, mindmap)
        xmind_path = write_xmind_file(output_path.parent, mindmap, stem=output_path.stem)
        replace_mermaid_section(output_path, mindmap_to_mermaid(mindmap))
    except Exception as exc:
        logger.info(f"XMind 学习地图生成失败，改用 Markdown 简版思维导图：{exc}")
        fallback_mindmap = fallback_mindmap_from_markdown(
            metadata.title,
            output_path.read_text(encoding="utf-8"),
        )
        replace_mermaid_section(output_path, mindmap_to_mermaid(fallback_mindmap))

    return DeepSeekArtifactResult(
        output_path=output_path,
        xmind_path=xmind_path,
        mindmap_json_path=mindmap_json_path,
        table_summary_path=table_summary_path,
        segment_count=len(segments),
    )


def metadata_from_artifact(path: Path) -> VideoMetadata:
    data = json.loads(path.read_text(encoding="utf-8"))
    title = data.get("title") or "Artifact Video"
    source = data.get("webpage_url") or data.get("source") or data.get("local_path") or str(path.parent)
    local_path = Path(data["local_path"]) if data.get("local_path") else None
    return VideoMetadata(
        title=title,
        source=str(source),
        webpage_url=data.get("webpage_url"),
        local_path=local_path,
        duration=data.get("duration"),
        uploader=data.get("uploader"),
    )


def segments_from_transcript_text(text: str) -> list[TranscriptSegment]:
    segments: list[TranscriptSegment] = []
    for index, raw_line in enumerate(text.splitlines()):
        line = raw_line.strip()
        if not line:
            continue
        match = re.match(r"^\[(\d{2}):(\d{2})(?::(\d{2}))?\]\s*(.+)$", line)
        if match:
            first = int(match.group(1))
            second = int(match.group(2))
            third = match.group(3)
            start = first * 60 + second if third is None else first * 3600 + second * 60 + int(third)
            content = match.group(4).strip()
        else:
            start = float(index)
            content = line
        if content:
            segments.append(
                TranscriptSegment(start=float(start), end=float(start + 1), text=content)
            )
    return segments
