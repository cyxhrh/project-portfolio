from __future__ import annotations

from vkm.core.subtitles import parse_srt_text, parse_vtt_text


def test_parse_srt_text() -> None:
    text = """1
00:00:01,000 --> 00:00:03,500
Hello <b>world</b>

2
00:00:04,000 --> 00:00:05,000
Next line
"""
    segments = parse_srt_text(text)

    assert len(segments) == 2
    assert segments[0].start == 1
    assert segments[0].end == 3.5
    assert segments[0].text == "Hello world"


def test_parse_vtt_text() -> None:
    text = """WEBVTT

00:00:01.000 --> 00:00:03.500
Hello <c>world</c>

00:00:04.000 --> 00:00:05.000
Next line
"""
    segments = parse_vtt_text(text)

    assert len(segments) == 2
    assert segments[1].start == 4
    assert segments[1].text == "Next line"
