from __future__ import annotations

import json
from pathlib import Path

from vkm.core import pipeline
from vkm.core.douyin_loader import DouyinLoaderResult
from vkm.core.models import PipelineRequest, TranscriptSegment
from vkm.core.pipeline import VideoKnowledgePipeline


class FakeDouyinLoader:
    def __init__(self, *, output_dir: Path, temp_dir: Path, **kwargs) -> None:
        self.output_dir = output_dir
        self.temp_dir = temp_dir

    def extract(self, url: str) -> DouyinLoaderResult:
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        metadata_path = self.output_dir / "metadata.json"
        audio_path = self.temp_dir / "douyin_audio.m4a"
        metadata_path.write_text(
            json.dumps(
                {
                    "title": "抖音测试视频",
                    "uploader": "测试作者",
                    "duration": 12.3,
                    "webpage_url": url,
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )
        audio_path.write_bytes(b"audio")
        return DouyinLoaderResult(
            success=True,
            source_type="audio",
            transcript_path=None,
            audio_path=str(audio_path),
            metadata_path=str(metadata_path),
            error_message=None,
            stage="done",
            has_subtitle=False,
            available_subtitles=[],
            used_subtitle_lang=None,
            yt_dlp_error_type=None,
            suggestion="ok",
        )


class FakeTranscriber:
    def __init__(self, config, logger) -> None:
        pass

    def transcribe(self, audio_path: Path) -> list[TranscriptSegment]:
        assert audio_path.name == "douyin_audio.m4a"
        return [TranscriptSegment(start=0, end=1, text="测试转写文本")]


class FakeNoteGenerator:
    def __init__(self, config, logger) -> None:
        pass

    def generate(self, **kwargs) -> str:
        return "## 3分钟摘要\n\n这是抖音链接分析结果。"

    def generate_table_summary_json(self, **kwargs) -> str:
        raise RuntimeError("skip table summary")

    def generate_mindmap_json(self, **kwargs) -> str:
        raise RuntimeError("skip mindmap")


def test_pipeline_processes_douyin_url_into_markdown(
    tmp_path: Path, monkeypatch
) -> None:
    monkeypatch.setattr(pipeline, "DouyinLoader", FakeDouyinLoader)
    monkeypatch.setattr(pipeline, "FasterWhisperTranscriber", FakeTranscriber)
    monkeypatch.setattr(pipeline, "DeepSeekNoteGenerator", FakeNoteGenerator)
    monkeypatch.setattr(pipeline, "PIPELINE_ARTIFACTS_DIR", tmp_path / "artifacts")

    result = VideoKnowledgePipeline().run(
        PipelineRequest(
            url="https://www.douyin.com/video/123456",
            local_file=None,
            output_dir=tmp_path,
            api_key="unit-run-valid-looking",
        )
    )

    assert result.metadata.title == "抖音测试视频"
    assert result.transcript_source == "whisper"
    assert result.segment_count == 1
    assert result.output_path.exists()
    markdown = result.output_path.read_text(encoding="utf-8")
    assert "抖音链接分析结果" in markdown
    assert "https://www.douyin.com/video/123456" in markdown
    assert "```mermaid" in markdown
    assert "root((抖音测试视频))" in markdown
    artifact_dirs = list((tmp_path / "artifacts").glob("douyin_*"))
    assert len(artifact_dirs) == 1
    assert (artifact_dirs[0] / "transcript.txt").exists()
