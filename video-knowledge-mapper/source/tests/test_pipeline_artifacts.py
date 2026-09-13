from __future__ import annotations

import json
from pathlib import Path

from vkm.core import pipeline
from vkm.core.bilibili_loader import BilibiliLoaderResult
from vkm.core.douyin_loader import DouyinLoaderResult
from vkm.core.models import PipelineRequest, TranscriptSegment
from vkm.core.pipeline import VideoKnowledgePipeline


class FakeBilibiliLoader:
    def __init__(self, *, output_dir: Path, temp_dir: Path, **kwargs) -> None:
        self.output_dir = output_dir
        self.temp_dir = temp_dir

    def extract(self, url: str) -> BilibiliLoaderResult:
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        metadata_path = self.output_dir / "metadata.json"
        result_path = self.output_dir / "result.json"
        debug_path = self.output_dir / "debug_report.md"
        audio_path = self.temp_dir / "audio.m4a"
        metadata_path.write_text(
            json.dumps(
                {
                    "id": "BVTEST123",
                    "title": "B站测试视频",
                    "uploader": "测试UP",
                    "duration": 8,
                    "webpage_url": url,
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )
        result_path.write_text(
            json.dumps(
                {
                    "success": True,
                    "source_type": "audio",
                    "stage": "done",
                    "audio_path": str(audio_path),
                    "error_message": None,
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )
        debug_path.write_text("# fake bilibili debug\n", encoding="utf-8")
        audio_path.write_bytes(b"audio")
        return BilibiliLoaderResult(
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


class FakeDouyinLoader:
    def __init__(self, *, output_dir: Path, temp_dir: Path, **kwargs) -> None:
        self.output_dir = output_dir
        self.temp_dir = temp_dir

    def extract(self, url: str) -> DouyinLoaderResult:
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        metadata_path = self.output_dir / "metadata.json"
        result_path = self.output_dir / "result.json"
        debug_path = self.output_dir / "debug_report.md"
        audio_path = self.temp_dir / "douyin_audio.m4a"
        metadata_path.write_text(
            json.dumps(
                {
                    "id": "7380678787580562707",
                    "title": "抖音测试视频",
                    "uploader": "测试作者",
                    "duration": 12.3,
                    "webpage_url": url,
                    "metadata_source": "share-page",
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )
        result_path.write_text(
            json.dumps(
                {
                    "success": True,
                    "source_type": "audio",
                    "stage": "done",
                    "audio_path": str(audio_path),
                    "error_message": None,
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )
        debug_path.write_text("# fake douyin debug\n", encoding="utf-8")
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

    def extract_audio(self, video_path: Path, work_dir: Path) -> Path:
        audio_path = work_dir / "local_audio.wav"
        audio_path.write_bytes(b"audio")
        return audio_path

    def transcribe(self, audio_path: Path) -> list[TranscriptSegment]:
        return [
            TranscriptSegment(start=1, end=2, text="第一段转写"),
            TranscriptSegment(start=8, end=9, text="第二段转写"),
        ]


class FakeNoteGenerator:
    def __init__(self, config, logger) -> None:
        pass

    def generate(self, **kwargs) -> str:
        return "## 3分钟摘要\n\n测试摘要。"

    def generate_table_summary_json(self, **kwargs) -> str:
        raise RuntimeError("skip table summary")

    def generate_mindmap_json(self, **kwargs) -> str:
        raise RuntimeError("skip mindmap")


class ExplodingNoteGenerator:
    def __init__(self, *args, **kwargs) -> None:
        raise AssertionError("DeepSeek should not run while building artifacts only")


def install_pipeline_fakes(monkeypatch, artifact_dir: Path) -> None:
    monkeypatch.setattr(pipeline, "FasterWhisperTranscriber", FakeTranscriber)
    monkeypatch.setattr(pipeline, "DeepSeekNoteGenerator", FakeNoteGenerator)
    monkeypatch.setattr(pipeline, "PIPELINE_ARTIFACTS_DIR", artifact_dir)


def assert_common_artifacts(directory: Path, platform: str) -> None:
    assert (directory / "metadata.json").exists()
    assert (directory / "transcript.txt").exists()
    assert (directory / "source_result.json").exists()
    assert (directory / "debug_report.md").exists()

    transcript = (directory / "transcript.txt").read_text(encoding="utf-8")
    assert "[00:01] 第一段转写" in transcript
    assert "[00:08] 第二段转写" in transcript

    metadata = json.loads((directory / "metadata.json").read_text(encoding="utf-8"))
    assert metadata["platform"] == platform
    assert metadata["transcript_source"] == "whisper"


def test_bilibili_audio_fallback_writes_unified_transcript_artifacts(
    tmp_path: Path, monkeypatch
) -> None:
    install_pipeline_fakes(monkeypatch, tmp_path / "artifacts")
    monkeypatch.setattr(pipeline, "BilibiliLoader", FakeBilibiliLoader)

    result = VideoKnowledgePipeline().run(
        PipelineRequest(
            url="https://www.bilibili.com/video/BVTEST123/",
            local_file=None,
            output_dir=tmp_path / "notes",
            api_key="unit-run-valid-looking",
        )
    )

    assert result.output_path.exists()
    artifact_dir = tmp_path / "artifacts" / "bilibili_BVTEST123"
    assert_common_artifacts(artifact_dir, "bilibili")
    assert "# fake bilibili debug" in (artifact_dir / "debug_report.md").read_text(
        encoding="utf-8"
    )


def test_douyin_share_page_fallback_writes_unified_transcript_artifacts(
    tmp_path: Path, monkeypatch
) -> None:
    install_pipeline_fakes(monkeypatch, tmp_path / "artifacts")
    monkeypatch.setattr(pipeline, "DouyinLoader", FakeDouyinLoader)

    result = VideoKnowledgePipeline().run(
        PipelineRequest(
            url="https://www.douyin.com/video/7380678787580562707",
            local_file=None,
            output_dir=tmp_path / "notes",
            api_key="unit-run-valid-looking",
        )
    )

    assert result.output_path.exists()
    artifact_dir = tmp_path / "artifacts" / "douyin_7380678787580562707"
    assert_common_artifacts(artifact_dir, "douyin")
    metadata = json.loads((artifact_dir / "metadata.json").read_text(encoding="utf-8"))
    assert metadata["metadata_source"] == "share-page"


def test_local_video_writes_unified_transcript_artifacts(
    tmp_path: Path, monkeypatch
) -> None:
    install_pipeline_fakes(monkeypatch, tmp_path / "artifacts")
    video_path = tmp_path / "local input.mp4"
    video_path.write_bytes(b"fake mp4")

    result = VideoKnowledgePipeline().run(
        PipelineRequest(
            url=None,
            local_file=video_path,
            output_dir=tmp_path / "notes",
            api_key="unit-run-valid-looking",
        )
    )

    assert result.output_path.exists()
    candidates = list((tmp_path / "artifacts").glob("local_local_input_*"))
    assert len(candidates) == 1
    assert_common_artifacts(candidates[0], "local")

    source_result = json.loads(
        (candidates[0] / "source_result.json").read_text(encoding="utf-8")
    )
    assert source_result["source_type"] == "audio"


def test_build_bilibili_artifact_only_does_not_call_deepseek(
    tmp_path: Path, monkeypatch
) -> None:
    install_pipeline_fakes(monkeypatch, tmp_path / "artifacts")
    monkeypatch.setattr(pipeline, "BilibiliLoader", FakeBilibiliLoader)
    monkeypatch.setattr(pipeline, "DeepSeekNoteGenerator", ExplodingNoteGenerator)
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)

    result = VideoKnowledgePipeline().build_artifact_only(
        PipelineRequest(
            url="https://www.bilibili.com/video/BVTEST123/",
            local_file=None,
            output_dir=tmp_path / "notes",
        )
    )

    assert result.artifact_dir == tmp_path / "artifacts" / "bilibili_BVTEST123"
    assert_common_artifacts(result.artifact_dir, "bilibili")


def test_build_douyin_artifact_only_does_not_call_deepseek(
    tmp_path: Path, monkeypatch
) -> None:
    install_pipeline_fakes(monkeypatch, tmp_path / "artifacts")
    monkeypatch.setattr(pipeline, "DouyinLoader", FakeDouyinLoader)
    monkeypatch.setattr(pipeline, "DeepSeekNoteGenerator", ExplodingNoteGenerator)
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)

    result = VideoKnowledgePipeline().build_artifact_only(
        PipelineRequest(
            url="https://www.douyin.com/video/7380678787580562707",
            local_file=None,
            output_dir=tmp_path / "notes",
        )
    )

    assert result.artifact_dir == tmp_path / "artifacts" / "douyin_7380678787580562707"
    assert_common_artifacts(result.artifact_dir, "douyin")


def test_build_local_artifact_only_does_not_call_deepseek(
    tmp_path: Path, monkeypatch
) -> None:
    install_pipeline_fakes(monkeypatch, tmp_path / "artifacts")
    monkeypatch.setattr(pipeline, "DeepSeekNoteGenerator", ExplodingNoteGenerator)
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)
    video_path = tmp_path / "local input.mp4"
    video_path.write_bytes(b"fake mp4")

    result = VideoKnowledgePipeline().build_artifact_only(
        PipelineRequest(
            url=None,
            local_file=video_path,
            output_dir=tmp_path / "notes",
        )
    )

    assert result.artifact_dir.name.startswith("local_local_input_")
    assert_common_artifacts(result.artifact_dir, "local")
