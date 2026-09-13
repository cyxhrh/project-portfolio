from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

from faster_whisper import WhisperModel

from vkm.core.config import AppConfig, DependencyError
from vkm.core.models import TranscriptSegment
from vkm.utils.logging import CallbackLogger


class FasterWhisperTranscriber:
    def __init__(self, config: AppConfig, logger: CallbackLogger) -> None:
        self.config = config
        self.logger = logger

    def extract_audio(self, video_path: Path, work_dir: Path) -> Path:
        if not shutil.which("ffmpeg"):
            raise DependencyError(
                "未找到 FFmpeg。请先安装 FFmpeg，并确认 ffmpeg -version 可以正常运行。"
            )

        audio_path = work_dir / "local_audio.wav"
        self.logger.info("正在从本地视频提取音频...")
        command = [
            "ffmpeg",
            "-y",
            "-i",
            str(video_path),
            "-vn",
            "-acodec",
            "pcm_s16le",
            "-ar",
            "16000",
            "-ac",
            "1",
            str(audio_path),
        ]
        completed = subprocess.run(
            command,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="ignore",
            check=False,
        )
        if completed.returncode != 0:
            raise RuntimeError(f"音频提取失败：{completed.stderr.strip()}")
        return audio_path

    def transcribe(self, audio_path: Path) -> list[TranscriptSegment]:
        self.logger.info(
            f"正在加载 faster-whisper 模型：{self.config.whisper_model}，设备：{self.config.whisper_device}..."
        )
        model = WhisperModel(
            self.config.whisper_model,
            device=self.config.whisper_device,
            compute_type=self.config.whisper_compute_type,
        )
        self.logger.info("正在转写音频，这一步可能需要一些时间...")
        raw_segments, _info = model.transcribe(
            str(audio_path),
            beam_size=5,
            vad_filter=True,
        )

        segments = [
            TranscriptSegment(start=item.start, end=item.end, text=item.text.strip())
            for item in raw_segments
            if item.text.strip()
        ]
        if not segments:
            raise RuntimeError("转写完成但没有得到有效文本。")

        self.logger.info(f"转写完成，共 {len(segments)} 个片段。")
        return segments
