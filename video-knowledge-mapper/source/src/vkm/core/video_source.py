from __future__ import annotations

import re
import shutil
from pathlib import Path
from typing import Any

from yt_dlp import YoutubeDL

from vkm.core.config import DependencyError
from vkm.core.models import VideoMetadata
from vkm.core.subtitles import parse_subtitle_file, select_subtitle_track
from vkm.utils.logging import CallbackLogger


def is_probable_url(value: str) -> bool:
    return bool(re.match(r"^https?://", value.strip(), re.IGNORECASE))


class VideoSourceService:
    def __init__(self, logger: CallbackLogger) -> None:
        self.logger = logger

    def fetch_metadata(self, url: str) -> tuple[VideoMetadata, dict[str, Any]]:
        self.logger.info("正在读取视频信息...")
        with YoutubeDL(self._base_options()) as ydl:
            info = ydl.extract_info(url, download=False)

        title = info.get("title") or "Untitled Video"
        metadata = VideoMetadata(
            title=title,
            source=url,
            webpage_url=info.get("webpage_url") or url,
            duration=info.get("duration"),
            uploader=info.get("uploader") or info.get("channel"),
        )
        return metadata, info

    def download_best_subtitle(
        self, url: str, info: dict[str, Any], work_dir: Path
    ) -> tuple[list, str | None]:
        selected = select_subtitle_track(info)
        if not selected:
            self.logger.info("没有发现可用字幕，将进入转写流程。")
            return [], None

        source, language = selected
        label = "原始字幕" if source == "subtitle" else "自动字幕"
        self.logger.info(f"发现{label}：{language}，正在下载...")

        outtmpl = str(work_dir / "subtitle")
        options = {
            **self._base_options(),
            "skip_download": True,
            "writesubtitles": source == "subtitle",
            "writeautomaticsub": source == "auto_subtitle",
            "subtitleslangs": [language],
            "subtitlesformat": "srt/vtt/best",
            "outtmpl": outtmpl,
        }

        before = set(work_dir.glob("subtitle*"))
        with YoutubeDL(options) as ydl:
            ydl.download([url])
        after = set(work_dir.glob("subtitle*"))

        candidates = [
            path
            for path in sorted(after - before)
            if path.suffix.lower() in {".srt", ".vtt"}
        ]
        if not candidates:
            candidates = [
                path
                for path in sorted(work_dir.glob("subtitle*"))
                if path.suffix.lower() in {".srt", ".vtt"}
            ]

        for path in candidates:
            segments = parse_subtitle_file(path)
            if segments:
                self.logger.info(f"字幕解析完成，共 {len(segments)} 个片段。")
                return segments, source

        self.logger.info("字幕下载成功但内容为空，将进入转写流程。")
        return [], None

    def download_audio(self, url: str, work_dir: Path) -> Path:
        if not shutil.which("ffmpeg"):
            raise DependencyError(
                "未找到 FFmpeg。请先安装 FFmpeg，并确认 ffmpeg -version 可以正常运行。"
            )

        self.logger.info("正在下载音频用于转写...")
        outtmpl = str(work_dir / "audio.%(ext)s")
        options = {
            **self._base_options(),
            "format": "bestaudio/best",
            "outtmpl": outtmpl,
            "postprocessors": [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "mp3",
                    "preferredquality": "192",
                }
            ],
        }
        with YoutubeDL(options) as ydl:
            ydl.download([url])

        audio_files = sorted(work_dir.glob("audio.*"))
        if not audio_files:
            raise RuntimeError("音频下载失败，未找到输出文件。")
        return audio_files[0]

    def metadata_from_local_file(self, path: Path) -> VideoMetadata:
        return VideoMetadata(
            title=path.stem,
            source=str(path),
            local_path=path,
        )

    @staticmethod
    def _base_options() -> dict[str, Any]:
        return {
            "quiet": True,
            "no_warnings": True,
            "noplaylist": True,
            "windowsfilenames": True,
        }
