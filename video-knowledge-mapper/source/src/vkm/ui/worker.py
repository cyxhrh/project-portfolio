from __future__ import annotations

from pathlib import Path

from PySide6.QtCore import QObject, Signal, Slot

from vkm.core.config import AppError, ConfigurationError
from vkm.core.deepseek_artifact_runner import run_deepseek_from_artifact
from vkm.core.feishu_sync import FeishuSyncService
from vkm.core.models import PipelineRequest
from vkm.core.pipeline import VideoKnowledgePipeline


def friendly_error_message(exc: Exception) -> str:
    message = str(exc)
    if is_feishu_authorization_error(message):
        return "学习笔记已保存在本地，但飞书授权已失效。请重新登录飞书后再同步。"
    if isinstance(exc, ConfigurationError) or "DEEPSEEK_API_KEY" in message:
        return "请先配置 DeepSeek API Key。"
    if "metadata.json" in message or "缺少视频信息" in message:
        return "这个结果目录不完整，缺少视频信息，请重新生成学习笔记。"
    if "transcript.txt" in message or "缺少转写文本" in message:
        return "这个结果目录不完整，缺少转写文本，请重新生成学习笔记。"
    if "local video not found" in message:
        return "本地视频文件不存在，请重新选择。"
    if "内容" in message and ("失败" in message or "提取" in message):
        return "视频内容获取失败，请检查链接是否可访问，或稍后重试。"
    if "转写" in message or "transcribe" in message.lower():
        return "视频转文字失败，请检查视频是否有声音，或换一个视频再试。"
    return message or "处理失败，请稍后重试。"


def is_feishu_authorization_error(message: str) -> bool:
    normalized = message.lower()
    return any(
        marker in normalized
        for marker in (
            "token_missing",
            "need user authorization",
            "user identity: missing",
            "auth login",
        )
    )


class PipelineWorker(QObject):
    log = Signal(str)
    status = Signal(str)
    result_ready = Signal(object)
    finished = Signal(str)
    failed = Signal(str)

    def __init__(self, request: PipelineRequest) -> None:
        super().__init__()
        self.request = request

    @Slot()
    def run(self) -> None:
        try:
            pipeline = VideoKnowledgePipeline(
                log_callback=self.log.emit,
                status_callback=self.status.emit,
            )
            result = pipeline.run(self.request)
            artifact_dir = result.artifact_dir or result.output_path.parent
            self.result_ready.emit(
                {
                    "markdown_path": result.output_path,
                    "xmind_path": result.xmind_path,
                    "result_dir": artifact_dir,
                }
            )
            self.status.emit("正在同步到飞书")
            self.log.emit(f"已生成 Markdown：{result.output_path}")
            sync_summary: list[str] = []
            try:
                sync_result = FeishuSyncService(result.output_path.parent).sync_markdown(
                    result.output_path
                )
                if sync_result.document_url:
                    self.log.emit(f"飞书知识库文档：{sync_result.document_url}")
                    sync_summary.append(f"飞书知识库文档：{sync_result.document_url}")
                if sync_result.record_id:
                    self.log.emit(f"AI成长系统记录：{sync_result.record_id}")
                    sync_summary.append(f"AI成长系统记录：{sync_result.record_id}")
            except Exception as exc:
                sync_message = friendly_error_message(exc)
                self.log.emit(f"飞书同步未完成：{sync_message}")
                sync_summary.append(f"飞书同步未完成：{sync_message}")
            self.finished.emit(
                "\n".join(
                    line
                    for line in [
                        "学习笔记已生成",
                        f"Markdown 路径：{result.output_path}",
                        f"XMind 路径：{result.xmind_path}" if result.xmind_path else "",
                        f"结果目录路径：{artifact_dir}",
                        *sync_summary,
                    ]
                    if line
                )
            )
        except Exception as exc:
            self.failed.emit(friendly_error_message(exc))


class FixedBatchWorker(QObject):
    log = Signal(str)
    status = Signal(str)
    finished = Signal(str)
    failed = Signal(str)

    def __init__(self, api_key: str | None) -> None:
        super().__init__()
        self.api_key = api_key

    @Slot()
    def run(self) -> None:
        try:
            pipeline = VideoKnowledgePipeline(
                log_callback=self.log.emit,
                status_callback=self.status.emit,
            )
            result = pipeline.run_fixed_local_batch(self.api_key)
            sync_service = FeishuSyncService()
            messages: list[str] = []
            for item in result.processed:
                self.status.emit("正在同步到飞书")
                self.log.emit(f"已生成 Markdown：{item.output_path}")
                sync_result = sync_service.sync_markdown(item.output_path)
                if sync_result.document_url:
                    self.log.emit(f"飞书知识库文档：{sync_result.document_url}")
                    messages.append(sync_result.document_url)
                elif sync_result.record_id:
                    self.log.emit(f"AI成长系统记录：{sync_result.record_id}")
                    messages.append(sync_result.record_id)
                else:
                    messages.append(str(item.output_path))
            self.finished.emit("\n".join(messages))
        except Exception as exc:
            self.failed.emit(friendly_error_message(exc))


class ArtifactNoteWorker(QObject):
    log = Signal(str)
    status = Signal(str)
    result_ready = Signal(object)
    finished = Signal(str)
    failed = Signal(str)

    def __init__(
        self,
        artifact_dir: Path,
        *,
        api_key: str | None,
        output_dir: Path | None = None,
    ) -> None:
        super().__init__()
        self.artifact_dir = artifact_dir
        self.api_key = api_key
        self.output_dir = output_dir

    @Slot()
    def run(self) -> None:
        try:
            self.status.emit("读取已有结果")
            result = run_deepseek_from_artifact(
                self.artifact_dir,
                api_key=self.api_key,
                output_dir=self.output_dir,
                log_callback=self.log.emit,
            )
            result_dir = result.output_path.parent
            self.result_ready.emit(
                {
                    "markdown_path": result.output_path,
                    "xmind_path": result.xmind_path,
                    "result_dir": result_dir,
                }
            )
            self.finished.emit(
                "\n".join(
                    line
                    for line in [
                        "笔记已重新生成",
                        f"使用的已有结果目录：{self.artifact_dir}",
                        f"Markdown 路径：{result.output_path}",
                        f"结果目录路径：{result_dir}",
                        f"XMind 路径：{result.xmind_path}" if result.xmind_path else "",
                    ]
                    if line
                )
            )
        except Exception as exc:
            self.failed.emit(friendly_error_message(exc))


class ArtifactOnlyWorker(QObject):
    log = Signal(str)
    status = Signal(str)
    result_ready = Signal(object)
    finished = Signal(str)
    failed = Signal(str)

    def __init__(self, request: PipelineRequest) -> None:
        super().__init__()
        self.request = request

    @Slot()
    def run(self) -> None:
        try:
            pipeline = VideoKnowledgePipeline(
                log_callback=self.log.emit,
                status_callback=self.status.emit,
            )
            result = pipeline.build_artifact_only(self.request)
            transcript_path = result.artifact_dir / "transcript.txt"
            self.result_ready.emit(
                {
                    "transcript_path": transcript_path,
                    "result_dir": result.artifact_dir,
                }
            )
            self.finished.emit(
                "\n".join(
                    [
                        "转写结果已生成",
                        f"转写文本路径：{transcript_path}",
                        f"结果目录路径：{result.artifact_dir}",
                    ]
                )
            )
        except Exception as exc:
            self.failed.emit(friendly_error_message(exc))


class FeishuSyncWorker(QObject):
    log = Signal(str)
    status = Signal(str)
    finished = Signal(str)
    failed = Signal(str)

    @Slot()
    def run(self) -> None:
        try:
            self.status.emit("正在同步到 ai知识库和 AI成长系统")
            result = FeishuSyncService().sync_latest_markdown()
            self.log.emit(f"已读取 Markdown：{result.markdown_path}")
            self.log.emit(f"同步标题：{result.title}")
            if result.document_url:
                self.log.emit(f"知识库文档：{result.document_url}")
            if result.record_id:
                self.log.emit(f"Record ID：{result.record_id}")
            if result.stdout:
                self.log.emit(result.stdout)
            if result.stderr:
                self.log.emit(result.stderr)
            self.finished.emit(
                f"已同步到飞书：{result.document_url or result.record_id or result.title}"
            )
        except Exception as exc:
            self.failed.emit(friendly_error_message(exc))
