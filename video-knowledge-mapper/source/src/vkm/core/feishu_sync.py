from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Any

from vkm.core.config import AI_VIDEO_NOTES_DIR, AppError, DEFAULT_FEISHU_CLI
from vkm.core.models import FeishuSyncResult
from vkm.core.table_summary import load_table_summary_for_markdown


DEFAULT_CLI_CANDIDATES = [
    str(DEFAULT_FEISHU_CLI),
    "lark-cli.exe",
    "lark-cli",
    "feishu",
    "lark",
    "feishu-cli",
]

AI_GROWTH_BASE_TOKEN = 'REPLACE_WITH_YOUR_AI_GROWTH_BASE_TOKEN'
AI_GROWTH_TABLE_ID = 'REPLACE_WITH_YOUR_AI_GROWTH_TABLE_ID'
AI_WIKI_SPACE_ID = 'REPLACE_WITH_YOUR_AI_WIKI_SPACE_ID'
SYNC_HISTORY_FILE = "sync_history.jsonl"


class FeishuSyncService:
    def __init__(self, notes_dir: Path = AI_VIDEO_NOTES_DIR) -> None:
        self.notes_dir = notes_dir

    def sync_latest_markdown(self) -> FeishuSyncResult:
        markdown_path = find_latest_markdown(self.notes_dir)
        return self.sync_markdown(markdown_path)

    def sync_markdown(self, markdown_path: Path) -> FeishuSyncResult:
        markdown = markdown_path.read_text(encoding="utf-8")
        title = extract_markdown_title(markdown, markdown_path)
        command_name = resolve_feishu_cli_command()

        wiki_result = create_wiki_markdown_document(command_name, title, markdown)
        document_url = wiki_result.get("url")
        doc_token = wiki_result.get("obj_token") or wiki_result.get("document_id")

        record = build_ai_growth_record(markdown, markdown_path, document_url)
        base_result = write_ai_growth_record(command_name, record)
        record_id = extract_record_id(base_result["stdout"])
        if not record_id:
            record_id = lookup_record_id_by_title(command_name, str(record["标题"]))

        sync_result = FeishuSyncResult(
            markdown_path=markdown_path,
            title=title,
            command=base_result["command"],
            stdout=base_result["stdout"],
            stderr=base_result["stderr"],
            document_url=document_url,
            base_token=AI_GROWTH_BASE_TOKEN,
            table_id=AI_GROWTH_TABLE_ID,
            record_id=record_id,
        )
        append_sync_history(self.notes_dir, sync_result, doc_token=doc_token)
        return sync_result


def create_wiki_markdown_document(
    command_name: str, title: str, markdown: str
) -> dict[str, str | None]:
    node_result = run_command(
        [
            command_name,
            "wiki",
            "+node-create",
            "--space-id",
            AI_WIKI_SPACE_ID,
            "--title",
            title,
            "--obj-type",
            "docx",
            "--as",
            "user",
            "--format",
            "json",
        ]
    )
    if node_result.returncode != 0:
        raise AppError(
            "创建 ai 知识库 Wiki 文档失败。\n"
            f"输出：{node_result.stdout.strip()}\n错误：{node_result.stderr.strip()}"
        )

    payload = parse_json(node_result.stdout)
    obj_token = find_first_by_keys(payload, ("obj_token", "document_id", "token"))
    node_token = find_first_by_keys(payload, ("node_token",))
    url = extract_wiki_url(payload) or build_wiki_url(node_token)
    if not obj_token:
        raise AppError(f"Wiki 文档已创建，但未能解析文档 token：{node_result.stdout}")

    with tempfile.TemporaryDirectory(prefix="vkm_wiki_doc_") as temp_dir:
        content_path = Path(temp_dir) / "content.md"
        content_path.write_text(markdown, encoding="utf-8")
        update_result = subprocess.run(
            [
                command_name,
                "docs",
                "+update",
                "--api-version",
                "v2",
                "--doc",
                obj_token,
                "--command",
                "overwrite",
                "--doc-format",
                "markdown",
                "--content",
                "@content.md",
                "--as",
                "user",
                "--format",
                "json",
            ],
            cwd=temp_dir,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="ignore",
            check=False,
        )
    if update_result.returncode != 0:
        raise AppError(
            "Wiki 文档已创建，但写入 Markdown 内容失败。\n"
            f"文档：{url or obj_token}\n"
            f"输出：{update_result.stdout.strip()}\n错误：{update_result.stderr.strip()}"
        )

    return {
        "obj_token": obj_token,
        "node_token": node_token,
        "url": url,
        "stdout": node_result.stdout.strip(),
    }


def write_ai_growth_record(command_name: str, record: dict[str, Any]) -> dict[str, Any]:
    with tempfile.TemporaryDirectory(prefix="vkm_feishu_base_") as temp_dir:
        record_path = Path(temp_dir) / "record.json"
        record_path.write_text(
            json.dumps(record, ensure_ascii=False),
            encoding="utf-8",
        )
        command = build_base_record_command(command_name)
        result = subprocess.run(
            command,
            cwd=temp_dir,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="ignore",
            check=False,
        )
    if result.returncode != 0:
        raise AppError(
            "写入飞书多维表格失败。\n"
            f"执行命令：{' '.join(command)}\n"
            f"写入字段：{json.dumps(record, ensure_ascii=False, indent=2)}\n"
            f"输出：{result.stdout.strip()}\n"
            f"错误：{result.stderr.strip()}"
        )
    return {
        "command": command,
        "stdout": result.stdout.strip(),
        "stderr": result.stderr.strip(),
    }


def find_latest_markdown(notes_dir: Path = AI_VIDEO_NOTES_DIR) -> Path:
    notes_dir.mkdir(parents=True, exist_ok=True)
    markdown_files = sorted(
        notes_dir.glob("*.md"),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )
    if not markdown_files:
        raise AppError(f"没有在 {notes_dir} 中找到 Markdown 笔记。")
    return markdown_files[0]


def extract_markdown_title(markdown: str, markdown_path: Path) -> str:
    for line in markdown.splitlines():
        stripped = line.strip()
        if stripped.startswith("# ") and not stripped.startswith("## "):
            title = stripped[2:].strip()
            if title:
                return title
    return markdown_path.stem


def build_ai_growth_record(
    markdown: str, markdown_path: Path, document_url: str | None = None
) -> dict[str, Any]:
    title = extract_markdown_title(markdown, markdown_path)
    table_summary = load_table_summary_for_markdown(markdown_path, fallback_title=title)

    return {
        "标题": table_summary.title,
        "分类": table_summary.category,
        "核心收获": table_summary.key_takeaway,
        "行动项": table_summary.action_item,
        "难度": table_summary.difficulty,
        "知识价值": table_summary.knowledge_value,
        "实操状态": table_summary.practice_status,
        "学习日期": datetime.now().strftime("%Y-%m-%d 00:00:00"),
        "文档链接": document_url or "",
    }


def extract_markdown_sections(markdown: str) -> dict[str, str]:
    matches = list(re.finditer(r"(?m)^##\s+(.+?)\s*$", markdown))
    sections: dict[str, str] = {}
    for index, match in enumerate(matches):
        title = match.group(1).strip()
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(markdown)
        sections[title] = markdown[start:end].strip()
    return sections


def extract_video_source(basic_info_section: str) -> str | None:
    for line in basic_info_section.splitlines():
        normalized = line.strip().lstrip("-").strip()
        if normalized.startswith("视频来源："):
            return normalized.split("：", 1)[1].strip()
    return None


def normalize_video_link(value: str | None) -> str:
    if not value:
        return ""
    value = value.strip()
    if value.startswith(("http://", "https://")):
        return limit_text(value, 2000)
    return ""


def limit_text(value: str, max_chars: int) -> str:
    value = value.strip()
    if len(value) <= max_chars:
        return value
    return value[: max_chars - 20].rstrip() + "\n\n[内容过长，已截断]"


def resolve_feishu_cli_command() -> str:
    configured = os.environ.get("FEISHU_CLI_COMMAND", "").strip()
    if configured:
        configured_path = Path(configured)
        if configured_path.exists():
            return str(configured_path.resolve())
        resolved_command = shutil.which(configured)
        if resolved_command:
            return resolved_command
        raise AppError(f"未找到 FEISHU_CLI_COMMAND 指定的飞书 CLI：{configured}")

    for candidate in DEFAULT_CLI_CANDIDATES:
        candidate_path = Path(candidate)
        if candidate_path.exists():
            return str(candidate_path.resolve())
        resolved_command = shutil.which(candidate)
        if resolved_command:
            return resolved_command

    raise AppError(
        "未找到飞书 CLI。请安装飞书 CLI，或设置 FEISHU_CLI_COMMAND 为 CLI 的完整路径。"
    )


def build_base_record_command(command_name: str) -> list[str]:
    return [
        command_name,
        "base",
        "+record-upsert",
        "--base-token",
        AI_GROWTH_BASE_TOKEN,
        "--table-id",
        AI_GROWTH_TABLE_ID,
        "--as",
        "user",
        "--json",
        "@record.json",
    ]


def extract_record_id(stdout: str) -> str | None:
    try:
        payload = json.loads(stdout)
    except json.JSONDecodeError:
        return None
    return find_first_record_id(payload)


def lookup_record_id_by_title(command_name: str, title: str) -> str | None:
    command = [
        command_name,
        "base",
        "+record-list",
        "--base-token",
        AI_GROWTH_BASE_TOKEN,
        "--table-id",
        AI_GROWTH_TABLE_ID,
        "--as",
        "user",
        "--limit",
        "100",
        "--format",
        "json",
    ]
    result = subprocess.run(
        command,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="ignore",
        check=False,
    )
    if result.returncode != 0:
        return None
    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError:
        return None

    data = payload.get("data", {})
    fields = data.get("fields", [])
    rows = data.get("data", [])
    record_ids = data.get("record_id_list", [])
    try:
        title_index = fields.index("标题")
    except ValueError:
        return None

    matches: list[str] = []
    for row, record_id in zip(rows, record_ids):
        if len(row) > title_index and row[title_index] == title:
            matches.append(record_id)
    return matches[-1] if matches else None


def extract_wiki_url(payload: Any) -> str | None:
    return find_first_url(payload)


def build_wiki_url(node_token: str | None) -> str | None:
    if not node_token:
        return None
    return f"https://example.feishu.cn/wiki/{node_token}"


def parse_json(stdout: str) -> dict[str, Any]:
    try:
        payload = json.loads(stdout)
    except json.JSONDecodeError as exc:
        raise AppError(f"飞书 CLI 返回不是有效 JSON：{stdout}") from exc
    if not isinstance(payload, dict):
        raise AppError(f"飞书 CLI 返回结构异常：{stdout}")
    return payload


def run_command(command: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="ignore",
        check=False,
    )


def find_first_by_keys(value: Any, keys: tuple[str, ...]) -> str | None:
    if isinstance(value, dict):
        for key in keys:
            candidate = value.get(key)
            if isinstance(candidate, str) and candidate:
                return candidate
        for item in value.values():
            found = find_first_by_keys(item, keys)
            if found:
                return found
    elif isinstance(value, list):
        for item in value:
            found = find_first_by_keys(item, keys)
            if found:
                return found
    return None


def find_first_url(value: Any) -> str | None:
    if isinstance(value, dict):
        for key in ("url", "document_url", "link"):
            candidate = value.get(key)
            if isinstance(candidate, str) and candidate.startswith(("http://", "https://")):
                return candidate
        for item in value.values():
            found = find_first_url(item)
            if found:
                return found
    elif isinstance(value, list):
        for item in value:
            found = find_first_url(item)
            if found:
                return found
    return None


def find_first_record_id(value: Any) -> str | None:
    if isinstance(value, dict):
        for key in ("record_id", "id"):
            candidate = value.get(key)
            if isinstance(candidate, str) and candidate.startswith("rec"):
                return candidate
        for item in value.values():
            found = find_first_record_id(item)
            if found:
                return found
    elif isinstance(value, list):
        for item in value:
            found = find_first_record_id(item)
            if found:
                return found
    return None


def append_sync_history(
    notes_dir: Path, result: FeishuSyncResult, doc_token: str | None = None
) -> Path:
    history_path = notes_dir / SYNC_HISTORY_FILE
    record = {
        "synced_at": datetime.now().isoformat(timespec="seconds"),
        "target": "AI成长系统 + ai知识库",
        "markdown_path": str(result.markdown_path),
        "title": result.title,
        "document_url": result.document_url,
        "record_id": result.record_id,
    }
    with history_path.open("a", encoding="utf-8") as file:
        file.write(json.dumps(record, ensure_ascii=False) + "\n")
    return history_path
