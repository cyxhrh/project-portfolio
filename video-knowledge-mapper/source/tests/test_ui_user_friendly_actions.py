from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

import pytest

from vkm.core.config import AppError
from vkm.core.models import (
    PipelineArtifactResult,
    PipelineRequest,
    PipelineResult,
    VideoMetadata,
)
from vkm.ui import worker
from vkm.ui.main_window import (
    sanitize_ui_message,
    validate_directory_target,
    validate_existing_result_dir,
    validate_file_target,
    validate_video_input,
)
from vkm.ui.worker import ArtifactNoteWorker, ArtifactOnlyWorker, PipelineWorker


def collect_signal(obj, signal_name: str) -> list:
    values: list = []
    getattr(obj, signal_name).connect(values.append)
    return values


def test_missing_video_input_uses_friendly_message() -> None:
    with pytest.raises(AppError, match="\u8bf7\u5148\u8f93\u5165\u89c6\u9891\u94fe\u63a5"):
        validate_video_input("", None)


def test_missing_transcript_uses_friendly_message(tmp_path: Path) -> None:
    (tmp_path / "metadata.json").write_text("{}", encoding="utf-8")

    with pytest.raises(AppError, match="\u7f3a\u5c11\u8f6c\u5199\u6587\u672c"):
        validate_existing_result_dir(tmp_path)


def test_missing_metadata_uses_friendly_message(tmp_path: Path) -> None:
    (tmp_path / "transcript.txt").write_text("hello", encoding="utf-8")

    with pytest.raises(AppError, match="\u7f3a\u5c11\u89c6\u9891\u4fe1\u606f"):
        validate_existing_result_dir(tmp_path)


def test_generate_notes_worker_calls_full_pipeline(monkeypatch, tmp_path: Path) -> None:
    calls: list[PipelineRequest] = []
    sync_calls: list[Path] = []

    class FakePipeline:
        def __init__(self, *, log_callback=None, status_callback=None) -> None:
            pass

        def run(self, request: PipelineRequest) -> PipelineResult:
            calls.append(request)
            output_path = tmp_path / "notes" / "note.md"
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text("# note", encoding="utf-8")
            xmind_path = output_path.with_suffix(".xmind")
            xmind_path.write_bytes(b"xmind")
            artifact_dir = tmp_path / "outputs" / "bilibili_BVTEST123"
            artifact_dir.mkdir(parents=True)
            return PipelineResult(
                output_path=output_path,
                metadata=VideoMetadata(title="Test video", source="source"),
                transcript_source="whisper",
                segment_count=2,
                artifact_dir=artifact_dir,
                xmind_path=xmind_path,
            )

        def build_artifact_only(self, request: PipelineRequest):
            raise AssertionError("main action should use the full pipeline")

    class FakeFeishuSyncService:
        def __init__(self, notes_dir: Path) -> None:
            self.notes_dir = notes_dir

        def sync_markdown(self, markdown_path: Path):
            sync_calls.append(markdown_path)
            return SimpleNamespace(
                document_url="https://example.feishu.cn/wiki/demo",
                record_id="rec_demo",
            )

    monkeypatch.setattr(worker, "VideoKnowledgePipeline", FakePipeline)
    monkeypatch.setattr(worker, "FeishuSyncService", FakeFeishuSyncService)
    finished = collect_signal(
        worker_obj := PipelineWorker(
            PipelineRequest(
                url="https://www.bilibili.com/video/BVTEST123/",
                local_file=None,
                output_dir=tmp_path / "notes",
                api_key="real-looking-key",
            )
        ),
        "finished",
    )
    result_payloads = collect_signal(worker_obj, "result_ready")

    worker_obj.run()

    assert len(calls) == 1
    assert calls[0].url == "https://www.bilibili.com/video/BVTEST123/"
    assert sync_calls == [tmp_path / "notes" / "note.md"]
    assert "\u5b66\u4e60\u7b14\u8bb0\u5df2\u751f\u6210" in finished[0]
    assert "https://example.feishu.cn/wiki/demo" in finished[0]
    assert "rec_demo" in finished[0]
    assert result_payloads[0]["markdown_path"] == tmp_path / "notes" / "note.md"
    assert result_payloads[0]["result_dir"] == tmp_path / "outputs" / "bilibili_BVTEST123"
    assert result_payloads[0]["xmind_path"] == tmp_path / "notes" / "note.xmind"


def test_generate_notes_keeps_local_results_when_feishu_authorization_is_missing(
    monkeypatch, tmp_path: Path
) -> None:
    output_path = tmp_path / "notes" / "note.md"
    artifact_dir = tmp_path / "outputs" / "bilibili_BVTEST123"

    class FakePipeline:
        def __init__(self, *, log_callback=None, status_callback=None) -> None:
            pass

        def run(self, request: PipelineRequest) -> PipelineResult:
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text("# note", encoding="utf-8")
            artifact_dir.mkdir(parents=True)
            return PipelineResult(
                output_path=output_path,
                metadata=VideoMetadata(title="Test video", source="source"),
                transcript_source="whisper",
                segment_count=1,
                artifact_dir=artifact_dir,
            )

    class MissingUserAuthorizationSync:
        def __init__(self, notes_dir: Path) -> None:
            pass

        def sync_markdown(self, markdown_path: Path):
            raise AppError("token_missing: need user authorization")

    monkeypatch.setattr(worker, "VideoKnowledgePipeline", FakePipeline)
    monkeypatch.setattr(worker, "FeishuSyncService", MissingUserAuthorizationSync)
    worker_obj = PipelineWorker(
        PipelineRequest(
            url="https://www.bilibili.com/video/BVTEST123/",
            local_file=None,
            output_dir=tmp_path / "notes",
        )
    )
    finished = collect_signal(worker_obj, "finished")
    failed = collect_signal(worker_obj, "failed")
    result_payloads = collect_signal(worker_obj, "result_ready")

    worker_obj.run()

    assert failed == []
    assert "学习笔记已生成" in finished[0]
    assert "飞书授权已失效" in finished[0]
    assert result_payloads[0]["markdown_path"] == output_path


def test_friendly_error_message_hides_feishu_authorization_details() -> None:
    message = worker.friendly_error_message(
        AppError("token_missing: need user authorization")
    )

    assert message == "学习笔记已保存在本地，但飞书授权已失效。请重新登录飞书后再同步。"
    assert "token_missing" not in message


def test_regenerate_notes_worker_only_uses_existing_result_dir(
    monkeypatch, tmp_path: Path
) -> None:
    calls: list[Path] = []
    output_path = tmp_path / "notes" / "note.md"
    xmind_path = tmp_path / "notes" / "note.xmind"

    def fake_run_deepseek_from_artifact(artifact_dir, **kwargs):
        calls.append(artifact_dir)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text("# note", encoding="utf-8")
        xmind_path.write_bytes(b"xmind")
        return SimpleNamespace(output_path=output_path, xmind_path=xmind_path)

    class ExplodingPipeline:
        def __init__(self, *args, **kwargs) -> None:
            raise AssertionError("regenerate should not download or transcribe")

    monkeypatch.setattr(worker, "run_deepseek_from_artifact", fake_run_deepseek_from_artifact)
    monkeypatch.setattr(worker, "VideoKnowledgePipeline", ExplodingPipeline)
    artifact_dir = tmp_path / "outputs" / "bilibili_BVTEST123"
    finished = collect_signal(
        worker_obj := ArtifactNoteWorker(
            artifact_dir,
            api_key="real-looking-key",
            output_dir=tmp_path / "notes",
        ),
        "finished",
    )
    result_payloads = collect_signal(worker_obj, "result_ready")

    worker_obj.run()

    assert calls == [artifact_dir]
    assert "\u7b14\u8bb0\u5df2\u91cd\u65b0\u751f\u6210" in finished[0]
    assert result_payloads[0]["markdown_path"] == output_path
    assert result_payloads[0]["result_dir"] == output_path.parent
    assert result_payloads[0]["xmind_path"] == xmind_path


def test_artifact_only_worker_does_not_call_full_pipeline(
    monkeypatch, tmp_path: Path
) -> None:
    calls: list[PipelineRequest] = []

    class FakePipeline:
        def __init__(self, *, log_callback=None, status_callback=None) -> None:
            pass

        def run(self, request: PipelineRequest):
            raise AssertionError("artifact-only action should not run DeepSeek notes")

        def build_artifact_only(self, request: PipelineRequest) -> PipelineArtifactResult:
            calls.append(request)
            artifact_dir = tmp_path / "outputs" / "douyin_123"
            artifact_dir.mkdir(parents=True)
            (artifact_dir / "transcript.txt").write_text("hello", encoding="utf-8")
            return PipelineArtifactResult(
                artifact_dir=artifact_dir,
                metadata=VideoMetadata(title="Test video", source="source"),
                transcript_source="whisper",
                segment_count=1,
            )

    monkeypatch.setattr(worker, "VideoKnowledgePipeline", FakePipeline)
    finished = collect_signal(
        worker_obj := ArtifactOnlyWorker(
            PipelineRequest(
                url="https://www.douyin.com/video/123",
                local_file=None,
                output_dir=tmp_path / "notes",
            )
        ),
        "finished",
    )
    result_payloads = collect_signal(worker_obj, "result_ready")

    worker_obj.run()

    artifact_dir = tmp_path / "outputs" / "douyin_123"
    assert len(calls) == 1
    assert "\u8f6c\u5199\u7ed3\u679c\u5df2\u751f\u6210" in finished[0]
    assert result_payloads[0]["transcript_path"] == artifact_dir / "transcript.txt"
    assert result_payloads[0]["result_dir"] == artifact_dir


def test_missing_open_file_target_uses_friendly_message(tmp_path: Path) -> None:
    with pytest.raises(AppError, match="\u6587\u4ef6\u4e0d\u5b58\u5728"):
        validate_file_target(tmp_path / "missing.md")


def test_missing_open_directory_target_uses_friendly_message(tmp_path: Path) -> None:
    with pytest.raises(AppError, match="\u7ed3\u679c\u76ee\u5f55\u4e0d\u5b58\u5728"):
        validate_directory_target(tmp_path / "missing")


def test_ui_log_sanitizer_hides_technical_terms() -> None:
    message = (
        "Artifact \u76ee\u5f55: outputs/demo transcript.txt metadata.json "
        "table_summary_json mindmap JSON faster-whisper DeepSeek artifact"
    )

    sanitized = sanitize_ui_message(message)

    for technical_term in (
        "Artifact",
        "artifact",
        "transcript.txt",
        "metadata.json",
        "table_summary_json",
        "mindmap JSON",
        "faster-whisper",
        "DeepSeek",
    ):
        assert technical_term not in sanitized
