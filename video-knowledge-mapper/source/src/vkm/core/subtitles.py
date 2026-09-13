from __future__ import annotations

import html
import re
from pathlib import Path
from typing import Any

import srt

from vkm.core.models import TranscriptSegment


LANGUAGE_PRIORITY = [
    "zh-Hans",
    "zh-CN",
    "zh",
    "zh-Hant",
    "zh-TW",
    "en",
]


def parse_subtitle_file(path: Path) -> list[TranscriptSegment]:
    suffix = path.suffix.lower()
    text = path.read_text(encoding="utf-8-sig", errors="ignore")
    if suffix == ".srt":
        return parse_srt_text(text)
    if suffix == ".vtt":
        return parse_vtt_text(text)
    raise ValueError(f"不支持的字幕格式：{suffix}")


def parse_srt_text(text: str) -> list[TranscriptSegment]:
    segments: list[TranscriptSegment] = []
    for item in srt.parse(text):
        content = clean_subtitle_text(item.content)
        if content:
            segments.append(
                TranscriptSegment(
                    start=item.start.total_seconds(),
                    end=item.end.total_seconds(),
                    text=content,
                )
            )
    return segments


def parse_vtt_text(text: str) -> list[TranscriptSegment]:
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    blocks = re.split(r"\n{2,}", normalized.strip())
    segments: list[TranscriptSegment] = []

    for block in blocks:
        lines = [line.strip() for line in block.split("\n") if line.strip()]
        if not lines or lines[0].upper().startswith("WEBVTT"):
            continue

        timing_index = next(
            (index for index, line in enumerate(lines) if "-->" in line), None
        )
        if timing_index is None:
            continue

        start_raw, end_raw = lines[timing_index].split("-->", 1)
        start = parse_vtt_timestamp(start_raw.strip())
        end = parse_vtt_timestamp(end_raw.strip().split()[0])
        content = clean_subtitle_text("\n".join(lines[timing_index + 1 :]))
        if content:
            segments.append(TranscriptSegment(start=start, end=end, text=content))

    return segments


def parse_vtt_timestamp(value: str) -> float:
    parts = value.replace(",", ".").split(":")
    if len(parts) == 3:
        hours, minutes, seconds = parts
        return int(hours) * 3600 + int(minutes) * 60 + float(seconds)
    if len(parts) == 2:
        minutes, seconds = parts
        return int(minutes) * 60 + float(seconds)
    return float(parts[0])


def clean_subtitle_text(text: str) -> str:
    cleaned = re.sub(r"<[^>]+>", "", text)
    cleaned = html.unescape(cleaned)
    cleaned = re.sub(r"\{\\.*?\}", "", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.strip()


def select_subtitle_track(
    info: dict[str, Any],
) -> tuple[str, str] | None:
    manual = info.get("subtitles") or {}
    automatic = info.get("automatic_captions") or {}

    manual_lang = choose_language(manual)
    if manual_lang:
        return ("subtitle", manual_lang)

    automatic_lang = choose_language(automatic)
    if automatic_lang:
        return ("auto_subtitle", automatic_lang)

    return None


def choose_language(tracks: dict[str, Any]) -> str | None:
    if not tracks:
        return None

    available = list(tracks.keys())
    for preferred in LANGUAGE_PRIORITY:
        if preferred in tracks:
            return preferred

    for preferred in LANGUAGE_PRIORITY:
        for language in available:
            if language.lower().startswith(preferred.lower()):
                return language

    return available[0]
