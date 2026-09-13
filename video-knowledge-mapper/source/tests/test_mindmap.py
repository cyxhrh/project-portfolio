from __future__ import annotations

import json

import pytest

from vkm.core.mindmap import (
    MindmapError,
    fallback_mindmap_from_markdown,
    mindmap_to_mermaid,
    parse_mindmap_response,
)


def test_parse_mindmap_response_normalizes_limits() -> None:
    payload = {
        "title": "  AI 视频学习地图  ",
        "branches": [
            {
                "title": "核心概念",
                "children": [
                    {"title": "概念一", "children": [{"title": "不应保留"}]},
                    {"title": "概念二"},
                    {"title": "概念三"},
                    {"title": "概念四"},
                    {"title": "概念五"},
                ],
            },
            {"title": "操作流程", "children": [{"title": "第一步"}]},
            {"title": "工具方法", "children": [{"title": "工具选择"}]},
            {"title": "应用场景"},
            {"title": "注意事项"},
            {"title": "低价值分支"},
        ],
    }

    document = parse_mindmap_response(json.dumps(payload, ensure_ascii=False))

    assert document.title == "AI 视频学习地图"
    assert len(document.branches) == 5
    assert len(document.branches[0].children) == 4
    assert document.branches[0].children[0].children == ()


def test_parse_mindmap_response_rejects_too_few_branches() -> None:
    payload = {
        "title": "学习地图",
        "branches": [
            {"title": "核心概念"},
            {"title": "操作流程"},
        ],
    }

    with pytest.raises(MindmapError):
        parse_mindmap_response(json.dumps(payload, ensure_ascii=False))


def test_mindmap_to_mermaid_uses_mindmap_structure() -> None:
    payload = {
        "title": "学习地图",
        "branches": [
            {"title": "核心概念", "children": [{"title": "方法（A）"}]},
            {"title": "操作流程"},
            {"title": "注意事项"},
        ],
    }

    document = parse_mindmap_response(json.dumps(payload, ensure_ascii=False))
    mermaid = mindmap_to_mermaid(document)

    assert mermaid.startswith("mindmap")
    assert "root((学习地图))" in mermaid
    assert "方法（A）" in mermaid


def test_fallback_mindmap_from_markdown_uses_note_sections() -> None:
    document = fallback_mindmap_from_markdown(
        "测试标题",
        """
## 3分钟摘要

这是一个关于视频拆解的摘要。

## 核心知识点

1. **读取视频**：先提取音频。
2. 生成笔记。

## 行动清单

- 粘贴链接
- 点击开始分析

## 复习卡片

Q: 如何开始？
A: 点击开始分析。
""",
    )

    mermaid = mindmap_to_mermaid(document)

    assert "root((测试标题))" in mermaid
    assert "核心知识点" in mermaid
    assert "读取视频" in mermaid
    assert len(document.branches) >= 3
