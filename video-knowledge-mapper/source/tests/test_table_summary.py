from __future__ import annotations

import json

from vkm.core.table_summary import (
    CATEGORIES,
    PRACTICE_STATUSES,
    parse_table_summary_response,
)


def test_parse_table_summary_response_normalizes_limits() -> None:
    payload = {
        "title": "  一个非常长非常长非常长非常长非常长非常长非常长非常长的视频标题  ",
        "category": "AI工具",
        "key_takeaway": "这是一条超过四十个中文字符的核心收获需要被截断否则表格阅读成本会变高",
        "action_item": "打开飞书文档提炼一个今天就能执行的小步骤",
        "difficulty": 8,
        "knowledge_value": "4",
        "practice_status": "已实操",
    }

    summary = parse_table_summary_response(
        json.dumps(payload, ensure_ascii=False),
        fallback_title="备用标题",
    )

    assert len(summary.title) <= 60
    assert len(summary.key_takeaway) <= 40
    assert len(summary.action_item) <= 40
    assert summary.category in CATEGORIES
    assert summary.difficulty == 5
    assert summary.knowledge_value == 4
    assert summary.practice_status == "已实操"


def test_parse_table_summary_response_uses_safe_defaults() -> None:
    payload = {
        "title": "",
        "category": "未知分类",
        "key_takeaway": "",
        "action_item": "",
        "difficulty": "bad",
        "knowledge_value": None,
        "practice_status": "其他状态",
    }

    summary = parse_table_summary_response(
        f"```json\n{json.dumps(payload, ensure_ascii=False)}\n```",
        fallback_title="备用标题",
    )

    assert summary.title == "备用标题"
    assert summary.category == "其他"
    assert summary.key_takeaway == "查看完整笔记获取核心收获"
    assert summary.action_item == "打开文档复习并整理下一步"
    assert summary.difficulty == 3
    assert summary.knowledge_value == 3
    assert summary.practice_status in PRACTICE_STATUSES
