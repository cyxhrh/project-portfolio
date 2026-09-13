from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any


MAX_BRANCHES = 5
MIN_BRANCHES = 3
MAX_CHILDREN = 4
MAX_DEPTH = 2
MAX_TITLE_CHARS = 36
FALLBACK_SECTIONS = ("3分钟摘要", "核心知识点", "时间轴大纲", "行动清单", "复习卡片")


class MindmapError(RuntimeError):
    """Raised when mindmap JSON cannot be parsed or normalized."""


@dataclass(frozen=True)
class MindmapNode:
    title: str
    children: tuple["MindmapNode", ...] = ()


@dataclass(frozen=True)
class MindmapDocument:
    title: str
    branches: tuple[MindmapNode, ...]

    def to_dict(self) -> dict[str, Any]:
        return {
            "title": self.title,
            "branches": [node_to_dict(branch) for branch in self.branches],
        }


def parse_mindmap_response(response: str) -> MindmapDocument:
    raw = extract_json_object(response)
    payload = json.loads(raw)
    return normalize_mindmap_payload(payload)


def extract_json_object(text: str) -> str:
    stripped = text.strip()
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", stripped, re.DOTALL)
    if fenced:
        return fenced.group(1)

    start = stripped.find("{")
    end = stripped.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise MindmapError("DeepSeek 未返回可解析的 mindmap_json。")
    return stripped[start : end + 1]


def normalize_mindmap_payload(payload: Any) -> MindmapDocument:
    if not isinstance(payload, dict):
        raise MindmapError("mindmap_json 根节点必须是 JSON object。")

    title = clean_title(str(payload.get("title") or payload.get("central_topic") or "学习地图"))
    raw_branches = payload.get("branches")
    if not isinstance(raw_branches, list):
        raise MindmapError("mindmap_json 必须包含 branches 数组。")

    branches = dedupe_nodes(
        normalize_node(item, depth=1)
        for item in raw_branches
        if isinstance(item, dict)
    )
    branches = branches[:MAX_BRANCHES]
    if len(branches) < MIN_BRANCHES:
        raise MindmapError("mindmap_json 一级分支少于 3 个，无法形成有效学习地图。")

    return MindmapDocument(title=title, branches=tuple(branches))


def normalize_node(payload: dict[str, Any], depth: int) -> MindmapNode:
    title = clean_title(str(payload.get("title") or payload.get("name") or "未命名节点"))
    raw_children = payload.get("children", [])
    children: list[MindmapNode] = []
    if depth < MAX_DEPTH and isinstance(raw_children, list):
        children = dedupe_nodes(
            normalize_node(item, depth=depth + 1)
            for item in raw_children
            if isinstance(item, dict)
        )[:MAX_CHILDREN]
    return MindmapNode(title=title, children=tuple(children))


def clean_title(value: str) -> str:
    value = re.sub(r"\s+", " ", value).strip()
    value = re.sub(r"^\d+[\.\)、\)]\s*", "", value)
    value = value.strip("-:：；;,.，。 ")
    if not value:
        value = "未命名节点"
    if len(value) > MAX_TITLE_CHARS:
        value = value[:MAX_TITLE_CHARS].rstrip() + "…"
    return value


def dedupe_nodes(nodes: Any) -> list[MindmapNode]:
    result: list[MindmapNode] = []
    seen: set[str] = set()
    for node in nodes:
        key = node.title.lower()
        if key in seen:
            continue
        seen.add(key)
        result.append(node)
    return result


def node_to_dict(node: MindmapNode) -> dict[str, Any]:
    data: dict[str, Any] = {"title": node.title}
    if node.children:
        data["children"] = [node_to_dict(child) for child in node.children]
    return data


def mindmap_to_mermaid(document: MindmapDocument) -> str:
    lines = ["mindmap", f"  root(({document.title}))"]
    for branch in document.branches:
        append_mermaid_node(lines, branch, indent=4)
    return "\n".join(lines)


def fallback_mindmap_from_markdown(title: str, markdown: str) -> MindmapDocument:
    branches: list[MindmapNode] = []
    for section in FALLBACK_SECTIONS:
        content = extract_markdown_section(markdown, section)
        children = tuple(
            MindmapNode(item) for item in extract_section_points(content)[:MAX_CHILDREN]
        )
        if content.strip() or children:
            branches.append(MindmapNode(clean_title(section), children))

    if len(branches) < MIN_BRANCHES:
        existing = {branch.title for branch in branches}
        for section in FALLBACK_SECTIONS:
            cleaned = clean_title(section)
            if cleaned in existing:
                continue
            branches.append(MindmapNode(cleaned))
            existing.add(cleaned)
            if len(branches) >= MIN_BRANCHES:
                break

    return MindmapDocument(
        title=clean_title(title or "学习地图"),
        branches=tuple(branches[:MAX_BRANCHES]),
    )


def extract_markdown_section(markdown: str, section: str) -> str:
    pattern = rf"(?ms)^##\s+{re.escape(section)}\s*\n+(.*?)(?=^##\s+|\Z)"
    match = re.search(pattern, markdown)
    return match.group(1).strip() if match else ""


def extract_section_points(content: str) -> list[str]:
    points: list[str] = []
    for raw_line in content.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("```"):
            continue
        if line.startswith("|"):
            continue
        line = re.sub(r"^[-*+]\s+", "", line)
        line = re.sub(r"^\d+[\.\)、\)]\s*", "", line)
        line = re.sub(r"^#+\s*", "", line)
        line = re.sub(r"\*\*(.*?)\*\*", r"\1", line)
        line = re.sub(r"`([^`]+)`", r"\1", line)
        line = line.strip(" -:：；;,.，。")
        if not line or line == "转写中未明确提及":
            continue
        points.append(clean_title(line))
    return dedupe_text(points)


def append_mermaid_node(lines: list[str], node: MindmapNode, indent: int) -> None:
    lines.append(" " * indent + sanitize_mermaid_text(node.title))
    for child in node.children:
        append_mermaid_node(lines, child, indent + 2)


def sanitize_mermaid_text(value: str) -> str:
    return value.replace("(", "（").replace(")", "）").replace("\n", " ")


def dedupe_text(items: list[str]) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for item in items:
        key = item.lower()
        if key in seen:
            continue
        seen.add(key)
        result.append(item)
    return result


def write_mindmap_json_file(markdown_path: Path, document: MindmapDocument) -> Path:
    output_path = markdown_path.with_suffix(".mindmap.json")
    output_path.write_text(
        json.dumps(document.to_dict(), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return output_path
