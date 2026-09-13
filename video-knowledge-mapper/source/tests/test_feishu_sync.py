from __future__ import annotations

import json
from pathlib import Path

import vkm.core.feishu_sync as feishu_sync

from vkm.core.feishu_sync import (
    FeishuSyncService,
    append_sync_history,
    build_ai_growth_record,
    build_base_record_command,
    build_wiki_url,
    extract_markdown_sections,
    extract_markdown_title,
    extract_record_id,
    find_latest_markdown,
    resolve_feishu_cli_command,
)
from vkm.core.models import FeishuSyncResult


def test_extract_markdown_title_from_h1(tmp_path: Path) -> None:
    path = tmp_path / "note.md"
    assert extract_markdown_title("# 标题\n\n## 正文", path) == "标题"


def test_extract_markdown_title_falls_back_to_filename(tmp_path: Path) -> None:
    path = tmp_path / "note_name.md"
    assert extract_markdown_title("## 正文", path) == "note_name"


def test_find_latest_markdown(tmp_path: Path) -> None:
    older = tmp_path / "older.md"
    latest = tmp_path / "latest.md"
    older.write_text("# older", encoding="utf-8")
    latest.write_text("# latest", encoding="utf-8")

    assert find_latest_markdown(tmp_path) == latest


def test_sync_latest_markdown_delegates_to_latest_file(
    tmp_path: Path, monkeypatch
) -> None:
    latest = tmp_path / "latest.md"
    latest.write_text("# latest", encoding="utf-8")
    service = FeishuSyncService(tmp_path)
    called: list[Path] = []

    def fake_sync_markdown(path: Path):
        called.append(path)
        return None

    monkeypatch.setattr(service, "sync_markdown", fake_sync_markdown)

    assert service.sync_latest_markdown() is None
    assert called == [latest]


def test_extract_markdown_sections() -> None:
    sections = extract_markdown_sections("## 3分钟摘要\n\n摘要\n\n## 行动清单\n\n行动")

    assert sections["3分钟摘要"] == "摘要"
    assert sections["行动清单"] == "行动"


def test_build_ai_growth_record() -> None:
    path = Path("note.md")
    markdown = """# 标题

## 基本信息

- 视频来源：D:\\AI_Video_Input\\a.mp4

## 3分钟摘要

摘要

## 核心知识点

知识点

## 行动清单

行动

## 金句提取

金句
"""
    record = build_ai_growth_record(markdown, path, "https://example.feishu.cn/wiki/abc")

    assert record["标题"] == "标题"
    assert record["分类"] == "AI视频"
    assert record["核心收获"] == "查看完整笔记获取核心收获"
    assert record["行动项"] == "打开文档复习并整理下一步"
    assert record["难度"] == 3
    assert record["知识价值"] == 3
    assert record["实操状态"] == "未实操"
    assert record["文档链接"] == "https://example.feishu.cn/wiki/abc"
    assert "AI总结" not in record
    assert "核心知识点" not in record
    assert "行动清单" not in record


def test_build_ai_growth_record_uses_table_summary_json(tmp_path: Path) -> None:
    markdown_path = tmp_path / "note.md"
    markdown = "# 很长的视频原始标题\n\n## 3分钟摘要\n\n长摘要"
    markdown_path.write_text(markdown, encoding="utf-8")
    markdown_path.with_suffix(".table_summary.json").write_text(
        json.dumps(
            {
                "title": "短标题",
                "category": "AI工具",
                "key_takeaway": "用索引表判断是否回看",
                "action_item": "整理一条可执行复习动作",
                "difficulty": 2,
                "knowledge_value": 5,
                "practice_status": "暂不需要",
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    record = build_ai_growth_record(markdown, markdown_path, "https://example.feishu.cn/wiki/abc")

    assert record["标题"] == "短标题"
    assert record["分类"] == "AI工具"
    assert record["核心收获"] == "用索引表判断是否回看"
    assert record["行动项"] == "整理一条可执行复习动作"
    assert record["难度"] == 2
    assert record["知识价值"] == 5
    assert record["实操状态"] == "暂不需要"
    assert record["文档链接"] == "https://example.feishu.cn/wiki/abc"


def test_build_base_record_command() -> None:
    command = build_base_record_command("lark-cli.exe")

    assert command[:2] == ["lark-cli.exe", "base"]
    assert "+record-upsert" in command
    assert "--base-token" in command
    assert "--table-id" in command
    assert "@record.json" in command


def test_resolve_feishu_cli_command_returns_windows_command_path(
    monkeypatch,
) -> None:
    command_path = r"C:\Users\USER\AppData\Roaming\npm\lark-cli.cmd"
    monkeypatch.delenv("FEISHU_CLI_COMMAND", raising=False)
    monkeypatch.setattr(feishu_sync, "DEFAULT_CLI_CANDIDATES", ["lark-cli"])
    monkeypatch.setattr(feishu_sync.shutil, "which", lambda _: command_path)

    assert resolve_feishu_cli_command() == command_path


def test_extract_record_id_from_cli_json() -> None:
    stdout = '{"ok":true,"data":{"record":{"record_id":"rec123"}}}'

    assert extract_record_id(stdout) == "rec123"


def test_build_wiki_url() -> None:
    assert build_wiki_url("abc") == "https://example.feishu.cn/wiki/abc"


def test_append_sync_history(tmp_path: Path) -> None:
    result = FeishuSyncResult(
        markdown_path=tmp_path / "note.md",
        title="标题",
        command=["lark-cli", "base", "+record-upsert"],
        stdout="{}",
        stderr="",
        base_token="base_token",
        table_id="table_id",
        record_id="rec123",
    )

    history_path = append_sync_history(tmp_path, result)

    assert history_path.exists()
    content = history_path.read_text(encoding="utf-8")
    assert "AI成长系统" in content
    assert "rec123" in content
    assert "base_token" not in content
    assert "table_id" not in content
    assert '"command"' not in content
