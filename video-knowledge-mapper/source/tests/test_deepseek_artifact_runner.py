from __future__ import annotations

import json
from pathlib import Path

import pytest

from vkm.core import config
from vkm.core.config import AppConfig, ConfigurationError
from vkm.core.deepseek_artifact_runner import run_deepseek_from_artifact
from vkm.core.models import TranscriptSegment


class FakeNoteGenerator:
    def __init__(self, config, logger) -> None:
        self.config = config

    def generate(self, metadata, segments, transcript_source: str) -> str:
        assert metadata.title == "Artifact 测试视频"
        assert [segment.text for segment in segments] == ["第一段", "第二段"]
        assert transcript_source == "whisper"
        return "## 3分钟摘要\n\n这是从 artifact 重跑生成的笔记。"

    def generate_table_summary_json(self, metadata, segments, transcript_source: str) -> str:
        return json.dumps(
            {
                "title": "Artifact 测试视频",
                "category": "AI工具",
                "key_takeaway": "可以从 transcript 重跑",
                "action_item": "复用已有中间工件",
                "difficulty": 2,
                "knowledge_value": 4,
                "practice_status": "未实操",
            },
            ensure_ascii=False,
        )

    def generate_mindmap_json(self, metadata, segments, transcript_source: str) -> str:
        return json.dumps(
            {
                "title": "Artifact 学习地图",
                "branches": [
                    {"title": "输入", "children": [{"title": "metadata"}]},
                    {"title": "转写", "children": [{"title": "transcript"}]},
                    {"title": "输出", "children": [{"title": "Markdown"}]},
                ],
            },
            ensure_ascii=False,
        )


def write_artifact(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)
    (path / "metadata.json").write_text(
        json.dumps(
            {
                "title": "Artifact 测试视频",
                "uploader": "测试作者",
                "duration": 12,
                "platform": "douyin",
                "video_id": "123",
                "webpage_url": "https://www.douyin.com/video/123",
                "transcript_source": "whisper",
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    (path / "transcript.txt").write_text(
        "[00:01] 第一段\n[00:08] 第二段\n",
        encoding="utf-8",
    )


def test_missing_deepseek_api_key_fails_early(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(config, "PROJECT_ROOT", tmp_path)
    monkeypatch.delenv("DEEPSEEK_API_KEY", raising=False)

    with pytest.raises(ConfigurationError, match="DEEPSEEK_API_KEY missing or invalid"):
        AppConfig.from_env()


def test_dummy_deepseek_api_key_fails_early(monkeypatch) -> None:
    monkeypatch.setenv("DEEPSEEK_API_KEY", "smoke-test-dummy-key")

    with pytest.raises(ConfigurationError, match="DEEPSEEK_API_KEY missing or invalid"):
        AppConfig.from_env()


def test_artifact_missing_metadata_fails_clearly(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("DEEPSEEK_API_KEY", "real-looking-key")
    (tmp_path / "transcript.txt").write_text("[00:01] text", encoding="utf-8")

    with pytest.raises(Exception, match="缺少视频信息"):
        run_deepseek_from_artifact(tmp_path, output_dir=tmp_path / "notes")


def test_artifact_missing_transcript_fails_clearly(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("DEEPSEEK_API_KEY", "real-looking-key")
    (tmp_path / "metadata.json").write_text(
        json.dumps({"title": "Only metadata"}, ensure_ascii=False),
        encoding="utf-8",
    )

    with pytest.raises(Exception, match="缺少转写文本"):
        run_deepseek_from_artifact(tmp_path, output_dir=tmp_path / "notes")


def test_run_deepseek_from_artifact_with_fake_generator(
    tmp_path: Path, monkeypatch
) -> None:
    monkeypatch.setenv("DEEPSEEK_API_KEY", "real-looking-key")
    artifact_dir = tmp_path / "outputs" / "douyin_123"
    output_dir = tmp_path / "notes"
    write_artifact(artifact_dir)

    result = run_deepseek_from_artifact(
        artifact_dir,
        output_dir=output_dir,
        generator_cls=FakeNoteGenerator,
    )

    assert result.output_path.exists()
    markdown = result.output_path.read_text(encoding="utf-8")
    assert "这是从 artifact 重跑生成的笔记" in markdown
    assert "```mermaid" in markdown
    assert result.table_summary_path is not None
    assert result.table_summary_path.exists()
    assert result.mindmap_json_path is not None
    assert result.mindmap_json_path.exists()
    assert result.xmind_path is not None
    assert result.xmind_path.exists()
    assert result.segment_count == 2
