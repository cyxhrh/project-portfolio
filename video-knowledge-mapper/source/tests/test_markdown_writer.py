from __future__ import annotations

from vkm.core.markdown_writer import (
    REQUIRED_SECTIONS,
    render_markdown,
    replace_mermaid_section,
    safe_filename,
)
from vkm.core.models import VideoMetadata


def test_render_markdown_contains_standard_sections() -> None:
    metadata = VideoMetadata(title="Test Video", source="D:/AI_Video_Input/a.mp4")
    markdown = render_markdown(
        metadata=metadata,
        note_body="## 3分钟摘要\n\n内容",
        transcript_source="whisper",
        model_name="deepseek-v4-flash",
    )

    assert markdown.startswith("# Test Video")
    for section in REQUIRED_SECTIONS:
        assert f"## {section}" in markdown
    assert "## Notion 可复制版本" not in markdown


def test_safe_filename_removes_windows_reserved_chars() -> None:
    assert safe_filename('a<b>c:"d/e\\f|g?h*') == "a_b_c__d_e_f_g_h"


def test_replace_mermaid_section(tmp_path) -> None:
    path = tmp_path / "note.md"
    path.write_text(
        "# 标题\n\n## 基本信息\n\n信息\n\n## Mermaid 思维导图\n\n旧内容\n\n## 复习卡片\n\n卡片",
        encoding="utf-8",
    )

    replace_mermaid_section(path, "mindmap\n  root((标题))")

    content = path.read_text(encoding="utf-8")
    assert "```mermaid\nmindmap\n  root((标题))\n```" in content
    assert "旧内容" not in content
    assert "## 复习卡片" in content
