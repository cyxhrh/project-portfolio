from __future__ import annotations

import shutil
import tempfile
import json
from pathlib import Path
from typing import Any

from vkm.core.bilibili_loader import BilibiliLoader
from vkm.core.config import AppConfig, AppError, ensure_fixed_directories
from vkm.core.deepseek import DeepSeekNoteGenerator
from vkm.core.douyin_loader import DouyinLoader
from vkm.core.markdown_writer import replace_mermaid_section, write_markdown_note
from vkm.core.mindmap import (
    fallback_mindmap_from_markdown,
    mindmap_to_mermaid,
    parse_mindmap_response,
    write_mindmap_json_file,
)
from vkm.core.models import (
    BatchPipelineResult,
    PipelineArtifactResult,
    PipelineRequest,
    PipelineResult,
    TranscriptSegment,
    VideoMetadata,
)
from vkm.core.pipeline_artifacts import (
    artifact_dir_for_source,
    copy_debug_report,
    copy_source_result_artifact,
    read_json_if_exists,
    stable_id_from_text,
    write_debug_report,
    write_metadata_artifact,
    write_source_result_artifact,
    write_transcript_file,
)
from vkm.core.table_summary import (
    parse_table_summary_response,
    write_table_summary_json_file,
)
from vkm.core.transcriber import FasterWhisperTranscriber
from vkm.core.video_source import VideoSourceService
from vkm.core.xmind_writer import write_xmind_file
from vkm.utils.logging import CallbackLogger, LogCallback


VIDEO_EXTENSIONS = {".mp4"}
BILIBILI_COOKIES_PATH = Path("secrets") / "bilibili_cookies.txt"
DOUYIN_COOKIES_PATH = Path("secrets") / "douyin_cookies.txt"
PIPELINE_ARTIFACTS_DIR = Path(__file__).resolve().parents[3] / "outputs"


class VideoKnowledgePipeline:
    def __init__(
        self,
        log_callback: LogCallback | None = None,
        status_callback: LogCallback | None = None,
    ) -> None:
        self.logger = CallbackLogger(log_callback)
        self.status = CallbackLogger(status_callback)

    def run_fixed_local_batch(self, api_key: str | None = None) -> BatchPipelineResult:
        ensure_fixed_directories()
        config = AppConfig.from_env(api_key)
        videos = find_input_videos(config.input_dir)
        if not videos:
            raise AppError(f"没有在 {config.input_dir} 中找到待分析的 MP4 视频。")

        processed: list[PipelineResult] = []
        for index, video_path in enumerate(videos, start=1):
            self.logger.info(f"开始处理第 {index}/{len(videos)} 个视频：{video_path.name}")
            processed.append(
                self.run(
                    PipelineRequest(
                        url=None,
                        local_file=video_path,
                        output_dir=config.notes_dir,
                        api_key=api_key,
                        move_to_done=True,
                        done_dir=config.done_dir,
                    )
                )
            )

        return BatchPipelineResult(processed=processed)

    def build_artifact_only(self, request: PipelineRequest) -> PipelineArtifactResult:
        if not request.url and not request.local_file:
            raise AppError("请粘贴视频链接，或选择一个本地视频文件。")

        config = AppConfig.from_env(request.api_key, require_deepseek=False)
        with tempfile.TemporaryDirectory(prefix="vkm_") as temp_dir:
            artifact_dir, metadata, segments, transcript_source = self._build_artifact(
                request,
                config,
                Path(temp_dir),
            )

        self.status.info("内容获取完成")
        self.logger.info(f"Artifact 目录：{artifact_dir}")
        return PipelineArtifactResult(
            artifact_dir=artifact_dir,
            metadata=metadata,
            transcript_source=transcript_source,
            segment_count=len(segments),
        )

    def _build_artifact(
        self,
        request: PipelineRequest,
        config: AppConfig,
        work_dir: Path,
    ) -> tuple[Path, VideoMetadata, list[TranscriptSegment], str]:
        video_service = VideoSourceService(self.logger)
        transcriber = FasterWhisperTranscriber(config, self.logger)

        if request.url:
            if is_bilibili_url(request.url):
                self.status.info("读取 B站视频信息")
                cookies_file = (
                    BILIBILI_COOKIES_PATH if BILIBILI_COOKIES_PATH.exists() else None
                )
                loader = BilibiliLoader(
                    output_dir=work_dir / "bilibili",
                    temp_dir=work_dir,
                    cookies_file=cookies_file,
                    auto_browser_cookies=cookies_file is None,
                )
                bilibili_result = loader.extract(request.url)
                if not bilibili_result.success:
                    raise AppError(bilibili_result.error_message or "B站视频内容提取失败。")

                metadata = metadata_from_bilibili_result(
                    request.url, bilibili_result.metadata_path
                )
                source_metadata = read_json_if_exists(
                    Path(bilibili_result.metadata_path)
                    if bilibili_result.metadata_path
                    else None
                )
                source_result_path = (
                    Path(bilibili_result.metadata_path).with_name("result.json")
                    if bilibili_result.metadata_path
                    else None
                )
                source_debug_path = (
                    Path(bilibili_result.metadata_path).with_name("debug_report.md")
                    if bilibili_result.metadata_path
                    else None
                )
                source_id = str(
                    source_metadata.get("id")
                    or source_metadata.get("bvid")
                    or stable_id_from_text(request.url)
                )
                if bilibili_result.source_type == "subtitle":
                    self.status.info("读取 B站字幕")
                    if not bilibili_result.transcript_path:
                        raise AppError("B站字幕提取成功但没有返回字幕文件。")
                    segments = segments_from_transcript_file(
                        Path(bilibili_result.transcript_path)
                    )
                    transcript_source = "subtitle"
                elif bilibili_result.source_type == "audio":
                    self.status.info("转写 B站音频")
                    if not bilibili_result.audio_path:
                        raise AppError("B站音频下载成功但没有返回音频文件。")
                    segments = transcriber.transcribe(Path(bilibili_result.audio_path))
                    transcript_source = "whisper"
                else:
                    raise AppError(bilibili_result.error_message or "B站视频内容提取失败。")

                artifact_dir = write_pipeline_artifacts(
                    base_dir=PIPELINE_ARTIFACTS_DIR,
                    platform="bilibili",
                    source_id=source_id,
                    metadata=metadata,
                    segments=segments,
                    transcript_source=transcript_source,
                    source_metadata=source_metadata,
                    source_result_path=source_result_path,
                    source_debug_path=source_debug_path,
                )
                return artifact_dir, metadata, segments, transcript_source

            if is_douyin_url(request.url):
                self.status.info("读取抖音视频信息")
                cookies_file = (
                    DOUYIN_COOKIES_PATH if DOUYIN_COOKIES_PATH.exists() else None
                )
                loader = DouyinLoader(
                    output_dir=work_dir / "douyin",
                    temp_dir=work_dir,
                    cookies_file=cookies_file,
                    auto_browser_cookies=cookies_file is None,
                )
                douyin_result = loader.extract(request.url)
                if not douyin_result.success:
                    raise AppError(douyin_result.error_message or "抖音视频内容提取失败。")

                metadata = metadata_from_douyin_result(
                    request.url, douyin_result.metadata_path
                )
                source_metadata = read_json_if_exists(
                    Path(douyin_result.metadata_path)
                    if douyin_result.metadata_path
                    else None
                )
                source_result_path = (
                    Path(douyin_result.metadata_path).with_name("result.json")
                    if douyin_result.metadata_path
                    else None
                )
                source_debug_path = (
                    Path(douyin_result.metadata_path).with_name("debug_report.md")
                    if douyin_result.metadata_path
                    else None
                )
                source_id = str(
                    source_metadata.get("id") or stable_id_from_text(request.url)
                )
                if douyin_result.source_type == "audio":
                    self.status.info("转写抖音音频")
                    if not douyin_result.audio_path:
                        raise AppError("抖音音频下载成功但没有返回音频文件。")
                    segments = transcriber.transcribe(Path(douyin_result.audio_path))
                    transcript_source = "whisper"
                elif douyin_result.source_type == "subtitle":
                    self.status.info("读取抖音字幕")
                    if not douyin_result.transcript_path:
                        raise AppError("抖音字幕提取成功但没有返回字幕文件。")
                    segments = segments_from_transcript_file(
                        Path(douyin_result.transcript_path)
                    )
                    transcript_source = "subtitle"
                else:
                    raise AppError(douyin_result.error_message or "抖音视频内容提取失败。")

                artifact_dir = write_pipeline_artifacts(
                    base_dir=PIPELINE_ARTIFACTS_DIR,
                    platform="douyin",
                    source_id=source_id,
                    metadata=metadata,
                    segments=segments,
                    transcript_source=transcript_source,
                    source_metadata=source_metadata,
                    source_result_path=source_result_path,
                    source_debug_path=source_debug_path,
                )
                return artifact_dir, metadata, segments, transcript_source

            raise AppError("只生成 artifact 暂时支持 B站链接、抖音链接和本地 MP4。")

        assert request.local_file is not None
        self.status.info("读取本地视频")
        metadata = video_service.metadata_from_local_file(request.local_file)
        self.status.info("提取音频")
        audio_path = transcriber.extract_audio(request.local_file, work_dir)
        self.status.info("转写音频")
        segments = transcriber.transcribe(audio_path)
        transcript_source = "whisper"
        artifact_dir = write_pipeline_artifacts(
            base_dir=PIPELINE_ARTIFACTS_DIR,
            platform="local",
            source_id=request.local_file.stem,
            metadata=metadata,
            segments=segments,
            transcript_source=transcript_source,
            source_metadata={},
            local_uniqueness_hint=str(request.local_file.resolve()),
            source_result_payload={
                "success": True,
                "source_type": "audio",
                "stage": "done",
                "transcript_path": None,
                "audio_path": str(audio_path),
                "metadata_path": None,
                "error_message": None,
                "suggestion": "本地视频已提取音频并完成转写。",
            },
        )
        return artifact_dir, metadata, segments, transcript_source

    def run(self, request: PipelineRequest) -> PipelineResult:
        if not request.url and not request.local_file:
            raise AppError("请粘贴视频链接，或选择一个本地视频文件。")

        config = AppConfig.from_env(request.api_key)
        request.output_dir.mkdir(parents=True, exist_ok=True)
        xmind_path: Path | None = None
        mindmap_json_path: Path | None = None
        table_summary_path: Path | None = None
        artifact_dir: Path | None = None

        with tempfile.TemporaryDirectory(prefix="vkm_") as temp_dir:
            work_dir = Path(temp_dir)
            video_service = VideoSourceService(self.logger)
            transcriber = FasterWhisperTranscriber(config, self.logger)

            if request.url:
                if is_bilibili_url(request.url):
                    self.status.info("读取 B站视频信息")
                    cookies_file = (
                        BILIBILI_COOKIES_PATH
                        if BILIBILI_COOKIES_PATH.exists()
                        else None
                    )
                    loader = BilibiliLoader(
                        output_dir=work_dir / "bilibili",
                        temp_dir=work_dir,
                        cookies_file=cookies_file,
                        auto_browser_cookies=cookies_file is None,
                    )
                    bilibili_result = loader.extract(request.url)
                    if not bilibili_result.success:
                        raise AppError(
                            bilibili_result.error_message or "B站视频内容提取失败。"
                        )

                    metadata = metadata_from_bilibili_result(
                        request.url, bilibili_result.metadata_path
                    )
                    source_metadata = read_json_if_exists(
                        Path(bilibili_result.metadata_path)
                        if bilibili_result.metadata_path
                        else None
                    )
                    source_result_path = (
                        Path(bilibili_result.metadata_path).with_name("result.json")
                        if bilibili_result.metadata_path
                        else None
                    )
                    source_debug_path = (
                        Path(bilibili_result.metadata_path).with_name("debug_report.md")
                        if bilibili_result.metadata_path
                        else None
                    )
                    source_id = str(
                        source_metadata.get("id")
                        or source_metadata.get("bvid")
                        or stable_id_from_text(request.url)
                    )
                    if bilibili_result.source_type == "subtitle":
                        self.status.info("读取 B站字幕")
                        if not bilibili_result.transcript_path:
                            raise AppError("B站字幕提取成功但没有返回字幕文件。")
                        segments = segments_from_transcript_file(
                            Path(bilibili_result.transcript_path)
                        )
                        transcript_source = "subtitle"
                    elif bilibili_result.source_type == "audio":
                        self.status.info("转写 B站音频")
                        if not bilibili_result.audio_path:
                            raise AppError("B站音频下载成功但没有返回音频文件。")
                        segments = transcriber.transcribe(Path(bilibili_result.audio_path))
                        transcript_source = "whisper"
                    else:
                        raise AppError(
                            bilibili_result.error_message or "B站视频内容提取失败。"
                        )
                    artifact_dir = write_pipeline_artifacts(
                        base_dir=PIPELINE_ARTIFACTS_DIR,
                        platform="bilibili",
                        source_id=source_id,
                        metadata=metadata,
                        segments=segments,
                        transcript_source=transcript_source,
                        source_metadata=source_metadata,
                        source_result_path=source_result_path,
                        source_debug_path=source_debug_path,
                    )
                elif is_douyin_url(request.url):
                    self.status.info("读取抖音视频信息")
                    cookies_file = (
                        DOUYIN_COOKIES_PATH if DOUYIN_COOKIES_PATH.exists() else None
                    )
                    loader = DouyinLoader(
                        output_dir=work_dir / "douyin",
                        temp_dir=work_dir,
                        cookies_file=cookies_file,
                        auto_browser_cookies=cookies_file is None,
                    )
                    douyin_result = loader.extract(request.url)
                    if not douyin_result.success:
                        raise AppError(
                            douyin_result.error_message or "抖音视频内容提取失败。"
                        )

                    metadata = metadata_from_douyin_result(
                        request.url, douyin_result.metadata_path
                    )
                    source_metadata = read_json_if_exists(
                        Path(douyin_result.metadata_path)
                        if douyin_result.metadata_path
                        else None
                    )
                    source_result_path = (
                        Path(douyin_result.metadata_path).with_name("result.json")
                        if douyin_result.metadata_path
                        else None
                    )
                    source_debug_path = (
                        Path(douyin_result.metadata_path).with_name("debug_report.md")
                        if douyin_result.metadata_path
                        else None
                    )
                    source_id = str(
                        source_metadata.get("id")
                        or stable_id_from_text(request.url)
                    )
                    if douyin_result.source_type == "audio":
                        self.status.info("转写抖音音频")
                        if not douyin_result.audio_path:
                            raise AppError("抖音音频下载成功但没有返回音频文件。")
                        segments = transcriber.transcribe(Path(douyin_result.audio_path))
                        transcript_source = "whisper"
                    elif douyin_result.source_type == "subtitle":
                        self.status.info("读取抖音字幕")
                        if not douyin_result.transcript_path:
                            raise AppError("抖音字幕提取成功但没有返回字幕文件。")
                        segments = segments_from_transcript_file(
                            Path(douyin_result.transcript_path)
                        )
                        transcript_source = "subtitle"
                    else:
                        raise AppError(
                            douyin_result.error_message or "抖音视频内容提取失败。"
                        )
                    artifact_dir = write_pipeline_artifacts(
                        base_dir=PIPELINE_ARTIFACTS_DIR,
                        platform="douyin",
                        source_id=source_id,
                        metadata=metadata,
                        segments=segments,
                        transcript_source=transcript_source,
                        source_metadata=source_metadata,
                        source_result_path=source_result_path,
                        source_debug_path=source_debug_path,
                    )
                else:
                    self.status.info("读取视频信息")
                    metadata, info = video_service.fetch_metadata(request.url)
                    self.status.info("提取字幕")
                    segments, transcript_source = video_service.download_best_subtitle(
                        request.url, info, work_dir
                    )

                    if not segments:
                        self.status.info("下载音频")
                        audio_path = video_service.download_audio(request.url, work_dir)
                        self.status.info("转写音频")
                        segments = transcriber.transcribe(audio_path)
                        transcript_source = "whisper"
            else:
                assert request.local_file is not None
                self.status.info("读取本地视频")
                metadata = video_service.metadata_from_local_file(request.local_file)
                self.status.info("提取音频")
                audio_path = transcriber.extract_audio(request.local_file, work_dir)
                self.status.info("转写音频")
                segments = transcriber.transcribe(audio_path)
                transcript_source = "whisper"
                artifact_dir = write_pipeline_artifacts(
                    base_dir=PIPELINE_ARTIFACTS_DIR,
                    platform="local",
                    source_id=request.local_file.stem,
                    metadata=metadata,
                    segments=segments,
                    transcript_source=transcript_source,
                    source_metadata={},
                    local_uniqueness_hint=str(request.local_file.resolve()),
                    source_result_payload={
                        "success": True,
                        "source_type": "audio",
                        "stage": "done",
                        "transcript_path": None,
                        "audio_path": str(audio_path),
                        "metadata_path": None,
                        "error_message": None,
                        "suggestion": "本地视频已提取音频并完成转写。",
                    },
                )

            generator = DeepSeekNoteGenerator(config, self.logger)
            self.status.info("生成标准 Markdown 笔记")
            note = generator.generate(
                metadata=metadata,
                segments=segments,
                transcript_source=transcript_source,
            )

            self.status.info("写入 Markdown")
            output_path = write_markdown_note(
                request.output_dir,
                metadata,
                note,
                transcript_source,
                config.deepseek_model,
            )

            try:
                self.status.info("生成表格索引摘要")
                raw_table_summary = generator.generate_table_summary_json(
                    metadata=metadata,
                    segments=segments,
                    transcript_source=transcript_source,
                )
                table_summary = parse_table_summary_response(
                    raw_table_summary,
                    fallback_title=metadata.title,
                )
                table_summary_path = write_table_summary_json_file(
                    output_path, table_summary
                )
                self.logger.info(f"表格索引摘要已生成：{table_summary_path}")
            except Exception as exc:
                self.logger.info(f"表格索引摘要生成失败，主流程继续：{exc}")

            try:
                self.status.info("生成 XMind 学习地图")
                raw_mindmap = generator.generate_mindmap_json(
                    metadata=metadata,
                    segments=segments,
                    transcript_source=transcript_source,
                )
                mindmap = parse_mindmap_response(raw_mindmap)
                mindmap_json_path = write_mindmap_json_file(output_path, mindmap)
                xmind_path = write_xmind_file(
                    output_path.parent,
                    mindmap,
                    stem=output_path.stem,
                )
                replace_mermaid_section(output_path, mindmap_to_mermaid(mindmap))
                self.logger.info(f"XMind 学习地图已生成：{xmind_path}")
            except Exception as exc:
                self.logger.info(f"XMind 学习地图生成失败，改用 Markdown 简版思维导图：{exc}")
                fallback_mindmap = fallback_mindmap_from_markdown(
                    metadata.title,
                    output_path.read_text(encoding="utf-8"),
                )
                replace_mermaid_section(
                    output_path,
                    mindmap_to_mermaid(fallback_mindmap),
                )

        moved_video_path = None
        if request.move_to_done and request.local_file:
            done_dir = request.done_dir or config.done_dir
            done_dir.mkdir(parents=True, exist_ok=True)
            moved_video_path = move_video_to_done(request.local_file, done_dir)
            self.logger.info(f"视频已移动到：{moved_video_path}")

        self.status.info("完成")
        self.logger.info(f"输出文件：{output_path}")
        return PipelineResult(
            output_path=output_path,
            metadata=metadata,
            transcript_source=transcript_source,
            segment_count=len(segments),
            moved_video_path=moved_video_path,
            artifact_dir=artifact_dir,
            xmind_path=xmind_path,
            mindmap_json_path=mindmap_json_path,
            table_summary_path=table_summary_path,
        )


def find_input_videos(input_dir: Path) -> list[Path]:
    input_dir.mkdir(parents=True, exist_ok=True)
    return sorted(
        path
        for path in input_dir.iterdir()
        if path.is_file() and path.suffix.lower() in VIDEO_EXTENSIONS
    )


def is_bilibili_url(url: str) -> bool:
    lowered = url.lower()
    return "bilibili.com/video/" in lowered or "b23.tv/" in lowered


def is_douyin_url(url: str) -> bool:
    lowered = url.lower()
    return (
        "douyin.com" in lowered
        or "iesdouyin.com" in lowered
        or "v.douyin.com" in lowered
    )


def metadata_from_bilibili_result(url: str, metadata_path: str | None) -> VideoMetadata:
    if not metadata_path:
        raise AppError("B站视频信息提取成功但没有生成 metadata.json。")

    data = json.loads(Path(metadata_path).read_text(encoding="utf-8"))
    return VideoMetadata(
        title=data.get("title") or "Bilibili Video",
        source=url,
        webpage_url=data.get("webpage_url") or url,
        duration=data.get("duration"),
        uploader=data.get("uploader"),
    )


def metadata_from_douyin_result(url: str, metadata_path: str | None) -> VideoMetadata:
    if not metadata_path:
        raise AppError("抖音视频信息提取成功但没有生成 metadata.json。")

    data = json.loads(Path(metadata_path).read_text(encoding="utf-8"))
    return VideoMetadata(
        title=data.get("title") or "Douyin Video",
        source=url,
        webpage_url=data.get("webpage_url") or url,
        duration=data.get("duration"),
        uploader=data.get("uploader"),
    )


def write_pipeline_artifacts(
    *,
    base_dir: Path,
    platform: str,
    source_id: str,
    metadata: VideoMetadata,
    segments: list[TranscriptSegment],
    transcript_source: str,
    source_metadata: dict[str, Any],
    source_result_path: Path | None = None,
    source_debug_path: Path | None = None,
    source_result_payload: dict[str, Any] | None = None,
    local_uniqueness_hint: str | None = None,
) -> Path:
    artifact_dir = artifact_dir_for_source(
        base_dir,
        platform,  # type: ignore[arg-type]
        source_id,
        uniqueness_hint=local_uniqueness_hint,
    )
    artifact_dir.mkdir(parents=True, exist_ok=True)

    transcript_path = write_transcript_file(
        artifact_dir / "transcript.txt",
        segments,
    )
    write_metadata_artifact(
        artifact_dir / "metadata.json",
        metadata,
        platform=platform,  # type: ignore[arg-type]
        video_id=source_id,
        transcript_source=transcript_source,
        source_metadata=source_metadata,
    )

    source_result_target = artifact_dir / "source_result.json"
    copied_result = copy_source_result_artifact(source_result_path, source_result_target)
    if not copied_result:
        write_source_result_artifact(
            source_result_target,
            source_result_payload
            or {
                "success": True,
                "source_type": transcript_source,
                "stage": "done",
                "error_message": None,
            },
        )

    debug_target = artifact_dir / "debug_report.md"
    copied_debug = copy_debug_report(source_debug_path, debug_target)
    if not copied_debug:
        source_result = read_json_if_exists(source_result_target)
        write_debug_report(
            debug_target,
            platform=platform,  # type: ignore[arg-type]
            metadata=metadata,
            transcript_source=transcript_source,
            source_result=source_result,
            transcript_path=transcript_path,
        )

    return artifact_dir


def segments_from_transcript_file(path: Path) -> list[TranscriptSegment]:
    text = path.read_text(encoding="utf-8-sig", errors="ignore")
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    segments = [
        TranscriptSegment(start=float(index), end=float(index + 1), text=line)
        for index, line in enumerate(lines)
    ]
    if not segments:
        raise AppError("B站字幕文件为空。")
    return segments


def move_video_to_done(video_path: Path, done_dir: Path) -> Path:
    target = unique_path(done_dir / video_path.name)
    return Path(shutil.move(str(video_path), str(target)))


def unique_path(path: Path) -> Path:
    if not path.exists():
        return path

    stem = path.stem
    suffix = path.suffix
    parent = path.parent
    index = 1
    while True:
        candidate = parent / f"{stem}_{index}{suffix}"
        if not candidate.exists():
            return candidate
        index += 1
