from __future__ import annotations

import json
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from vkm.core.mindmap import MindmapDocument, MindmapNode
from vkm.core.markdown_writer import safe_filename


def write_xmind_file(
    output_dir: Path, document: MindmapDocument, stem: str | None = None
) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f"{safe_filename(stem or document.title)}.xmind"

    content = [build_sheet(document)]
    metadata = {
        "creator": {
            "name": "Video Knowledge Mapper",
            "version": "0.1.0",
        },
        "activeSheetId": content[0]["id"],
        "created": datetime.now(timezone.utc).isoformat(),
    }
    manifest = {
        "file-entries": {
            "content.json": {},
            "metadata.json": {},
        }
    }

    with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("content.json", json.dumps(content, ensure_ascii=False))
        archive.writestr("metadata.json", json.dumps(metadata, ensure_ascii=False))
        archive.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False))

    return output_path


def build_sheet(document: MindmapDocument) -> dict[str, Any]:
    sheet_id = make_id()
    return {
        "id": sheet_id,
        "class": "sheet",
        "title": document.title,
        "rootTopic": {
            "id": make_id(),
            "class": "topic",
            "title": document.title,
            "children": {
                "attached": [build_topic(branch) for branch in document.branches],
            },
        },
        "topicPositioning": "fixed",
    }


def build_topic(node: MindmapNode) -> dict[str, Any]:
    topic: dict[str, Any] = {
        "id": make_id(),
        "class": "topic",
        "title": node.title,
    }
    if node.children:
        topic["children"] = {
            "attached": [build_topic(child) for child in node.children],
        }
    return topic


def make_id() -> str:
    return uuid.uuid4().hex


def export_xmind_png(_xmind_path: Path, _output_path: Path) -> None:
    raise NotImplementedError("PNG 导出预留接口，后续可接入 XMind CLI 或渲染服务。")
