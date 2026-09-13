from __future__ import annotations

import re
from datetime import datetime
from pathlib import Path

from vkm.core.models import VideoMetadata


REQUIRED_SECTIONS = [
    "基本信息",
    "3分钟摘要",
    "核心知识点",
    "时间轴大纲",
    "行动清单",
    "金句提取",
    "Mermaid 思维导图",
    "复习卡片",
]


def write_markdown_note(
    output_dir: Path,
    metadata: VideoMetadata,
    note_body: str,
    transcript_source: str,
    model_name: str,
) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    file_name = f"{safe_filename(metadata.title)}_{datetime.now():%Y%m%d_%H%M%S}.md"
    output_path = output_dir / file_name
    output_path.write_text(
        render_markdown(metadata, note_body, transcript_source, model_name),
        encoding="utf-8",
    )
    return output_path


def render_markdown(
    metadata: VideoMetadata,
    note_body: str,
    transcript_source: str,
    model_name: str,
) -> str:
    source_line = metadata.webpage_url or str(metadata.local_path or metadata.source)
    generated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    body = remove_leading_h1(note_body.strip())
    body = remove_duplicate_basic_info(body)
    body = ensure_required_sections(body)

    return f"""# {metadata.title}

## 基本信息

- 视频标题：{metadata.title}
- 视频来源：{source_line}
- 生成时间：{generated_at}
- 转写来源：{transcript_source}
- 分析模型：{model_name}

---

{body}
"""


def safe_filename(value: str, max_length: int = 80) -> str:
    cleaned = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", value).strip(" ._")
    cleaned = re.sub(r"\s+", " ", cleaned)
    if not cleaned:
        cleaned = "video_note"
    return cleaned[:max_length].rstrip(" ._")


def ensure_required_sections(markdown: str) -> str:
    result = markdown
    for section in REQUIRED_SECTIONS:
        if section == "基本信息":
            continue
        if not re.search(rf"^##\s+{re.escape(section)}\s*$", result, re.MULTILINE):
            result += f"\n\n## {section}\n\n转写中未明确提及。"
    return result.strip()


def replace_mermaid_section(markdown_path: Path, mermaid: str) -> None:
    markdown = markdown_path.read_text(encoding="utf-8")
    replacement = f"## Mermaid 思维导图\n\n```mermaid\n{mermaid.strip()}\n```"
    pattern = r"(?ms)^##\s+Mermaid 思维导图\s*\n+.*?(?=^##\s+|\Z)"
    if re.search(pattern, markdown):
        updated = re.sub(pattern, replacement + "\n\n", markdown, count=1)
    else:
        updated = markdown.rstrip() + "\n\n" + replacement + "\n"
    markdown_path.write_text(updated, encoding="utf-8")


def remove_leading_h1(markdown: str) -> str:
    return re.sub(r"^#\s+.+\n+", "", markdown, count=1).strip()


def remove_duplicate_basic_info(markdown: str) -> str:
    return re.sub(
        r"^##\s+基本信息\s*\n+.*?(?=^##\s+|\Z)",
        "",
        markdown,
        count=1,
        flags=re.MULTILINE | re.DOTALL,
    ).strip()
