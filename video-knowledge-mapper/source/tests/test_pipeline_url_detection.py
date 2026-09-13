from __future__ import annotations

from vkm.core.pipeline import is_bilibili_url, is_douyin_url


def test_detects_douyin_share_text() -> None:
    assert is_douyin_url("看看这个视频 https://v.douyin.com/abc123/ 复制打开抖音")


def test_detects_douyin_full_url() -> None:
    assert is_douyin_url("https://www.douyin.com/video/123")


def test_detects_bilibili_url() -> None:
    assert is_bilibili_url("https://www.bilibili.com/video/BV1AcRdBaEa8/")
