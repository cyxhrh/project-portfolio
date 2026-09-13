from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any


MAX_TITLE_CHARS = 60
MAX_INDEX_TEXT_CHARS = 40
CATEGORIES = ("AI工具", "编程", "AI视频", "商业认知", "自媒体", "其他")
PRACTICE_STATUSES = ("未实操", "已实操", "暂不需要")


class TableSummaryError(RuntimeError):
    """Raised when table_summary_json cannot be parsed."""


@dataclass(frozen=True)
class TableSummary:
    title: str
    category: str
    key_takeaway: str
    action_item: str
    difficulty: int
    knowledge_value: int
    practice_status: str = "未实操"

    def to_dict(self) -> dict[str, Any]:
        return {
            "title": self.title,
            "category": self.category,
            "key_takeaway": self.key_takeaway,
            "action_item": self.action_item,
            "difficulty": self.difficulty,
            "knowledge_value": self.knowledge_value,
            "practice_status": self.practice_status,
        }


def parse_table_summary_response(response: str, fallback_title: str) -> TableSummary:
    raw = extract_json_object(response)
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise TableSummaryError("DeepSeek 未返回有效的 table_summary_json。") from exc
    return normalize_table_summary_payload(payload, fallback_title=fallback_title)


def load_table_summary_for_markdown(markdown_path: Path, fallback_title: str) -> TableSummary:
    path = table_summary_path_for_markdown(markdown_path)
    if not path.exists():
        return fallback_table_summary(fallback_title)
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return fallback_table_summary(fallback_title)
    return normalize_table_summary_payload(payload, fallback_title=fallback_title)


def write_table_summary_json_file(markdown_path: Path, summary: TableSummary) -> Path:
    output_path = table_summary_path_for_markdown(markdown_path)
    output_path.write_text(
        json.dumps(summary.to_dict(), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return output_path


def table_summary_path_for_markdown(markdown_path: Path) -> Path:
    return markdown_path.with_suffix(".table_summary.json")


def normalize_table_summary_payload(payload: Any, fallback_title: str) -> TableSummary:
    if not isinstance(payload, dict):
        raise TableSummaryError("table_summary_json 根节点必须是 JSON object。")

    title = clean_short_text(
        str(payload.get("title") or fallback_title),
        max_chars=MAX_TITLE_CHARS,
        fallback=fallback_title or "未命名笔记",
    )
    key_takeaway = clean_short_text(
        str(payload.get("key_takeaway") or ""),
        max_chars=MAX_INDEX_TEXT_CHARS,
        fallback="查看完整笔记获取核心收获",
    )
    action_item = clean_short_text(
        str(payload.get("action_item") or ""),
        max_chars=MAX_INDEX_TEXT_CHARS,
        fallback="打开文档复习并整理下一步",
    )

    return TableSummary(
        title=title,
        category=normalize_category(payload.get("category")),
        key_takeaway=key_takeaway,
        action_item=action_item,
        difficulty=clamp_rating(payload.get("difficulty"), default=3),
        knowledge_value=clamp_rating(payload.get("knowledge_value"), default=3),
        practice_status=normalize_practice_status(payload.get("practice_status")),
    )


def fallback_table_summary(title: str) -> TableSummary:
    return TableSummary(
        title=clean_short_text(title, max_chars=MAX_TITLE_CHARS, fallback="未命名笔记"),
        category="AI视频",
        key_takeaway="查看完整笔记获取核心收获",
        action_item="打开文档复习并整理下一步",
        difficulty=3,
        knowledge_value=3,
        practice_status="未实操",
    )


def extract_json_object(text: str) -> str:
    stripped = text.strip()
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", stripped, re.DOTALL)
    if fenced:
        return fenced.group(1)

    start = stripped.find("{")
    end = stripped.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise TableSummaryError("DeepSeek 未返回可解析的 table_summary_json。")
    return stripped[start : end + 1]


def normalize_category(value: Any) -> str:
    text = clean_short_text(str(value or ""), max_chars=20, fallback="其他")
    if text in CATEGORIES:
        return text
    return "其他"


def normalize_practice_status(value: Any) -> str:
    text = clean_short_text(str(value or ""), max_chars=10, fallback="未实操")
    if text in PRACTICE_STATUSES:
        return text
    return "未实操"


def clamp_rating(value: Any, default: int) -> int:
    try:
        rating = int(value)
    except (TypeError, ValueError):
        rating = default
    return max(1, min(5, rating))


def clean_short_text(value: str, max_chars: int, fallback: str) -> str:
    value = re.sub(r"\s+", " ", value).strip()
    value = re.sub(r"^[\-*•\d\.\)、\)]\s*", "", value)
    value = value.strip(" -:：；;,.，。")
    if not value:
        value = fallback
    if len(value) > max_chars:
        value = value[: max_chars - 1].rstrip(" -:：；;,.，。") + "…"
    return value
