from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

from yt_dlp import DownloadError

from vkm.core import douyin_loader
from vkm.core.douyin_loader import DouyinLoader


class FakeYoutubeDL:
    def __init__(self, options):
        self.options = options

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def extract_info(self, url: str, download: bool = False):
        assert "douyin.com" in url
        assert not download
        return {
            "title": "测试抖音视频",
            "uploader": "测试作者",
            "duration": 12,
            "webpage_url": "https://www.douyin.com/video/123",
            "id": "123",
            "extractor": "Douyin",
        }

    def download(self, urls):
        assert len(urls) == 1
        assert "douyin.com" in urls[0]
        output = Path(self.options["outtmpl"].replace("%(ext)s", "m4a"))
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_bytes(b"fake audio")


class BrowserFallbackYoutubeDL(FakeYoutubeDL):
    def extract_info(self, url: str, download: bool = False):
        browser = self.options.get("cookiesfrombrowser", (None,))[0]
        if browser == "edge":
            raise DownloadError("could not find edge cookies database")
        assert browser == "chrome"
        return super().extract_info(url, download)


class LoginRequiredYoutubeDL(FakeYoutubeDL):
    def extract_info(self, url: str, download: bool = False):
        raise DownloadError("Fresh cookies are needed")


class FinalUrlResponse:
    final_url = "https://www.douyin.com/video/123456?previous_page=app_code_link"

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def geturl(self) -> str:
        return self.final_url


class ShareVideoFinalUrlResponse(FinalUrlResponse):
    final_url = "https://www.iesdouyin.com/share/video/654321/?region=CN"


class BytesResponse:
    def __init__(self, data: bytes):
        self.data = data
        self.offset = 0

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def read(self, size: int = -1) -> bytes:
        if size == -1:
            size = len(self.data) - self.offset
        chunk = self.data[self.offset : self.offset + size]
        self.offset += len(chunk)
        return chunk


def test_douyin_loader_extracts_url_from_share_text(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(douyin_loader, "YoutubeDL", FakeYoutubeDL)
    loader = DouyinLoader(output_dir=tmp_path / "outputs", temp_dir=tmp_path / "temp")

    result = loader.extract("看看这个视频 https://www.douyin.com/video/123456 复制打开抖音")

    assert result.success is True
    assert result.source_type == "audio"
    assert result.metadata_path is not None
    assert result.audio_path is not None
    assert Path(result.metadata_path).exists()
    assert Path(result.audio_path).read_bytes() == b"fake audio"

    metadata = Path(result.metadata_path).read_text(encoding="utf-8")
    assert '"title": "测试抖音视频"' in metadata
    assert '"normalized_url": "https://www.douyin.com/video/123456"' in metadata
    assert "复制打开抖音" in metadata


def test_douyin_loader_extracts_leading_url_from_share_text(
    tmp_path: Path, monkeypatch
) -> None:
    monkeypatch.setattr(douyin_loader, "YoutubeDL", FakeYoutubeDL)
    loader = DouyinLoader(output_dir=tmp_path / "outputs", temp_dir=tmp_path / "temp")

    result = loader.extract("https://www.douyin.com/video/123456 复制此链接，打开抖音搜索")

    assert result.success is True
    metadata = Path(result.metadata_path or "").read_text(encoding="utf-8")
    assert '"normalized_url": "https://www.douyin.com/video/123456"' in metadata


def test_douyin_loader_rejects_non_douyin_url(tmp_path: Path) -> None:
    loader = DouyinLoader(output_dir=tmp_path / "outputs", temp_dir=tmp_path / "temp")

    result = loader.extract("https://example.com/video/123")

    assert result.success is False
    assert result.error_code == "INVALID_URL"


def test_douyin_loader_auto_browser_cookies_falls_forward(
    tmp_path: Path, monkeypatch
) -> None:
    monkeypatch.setattr(douyin_loader, "YoutubeDL", BrowserFallbackYoutubeDL)
    loader = DouyinLoader(
        output_dir=tmp_path / "outputs",
        temp_dir=tmp_path / "temp",
        auto_browser_cookies=True,
    )

    result = loader.extract("https://v.douyin.com/abc123/")

    assert result.success is True
    assert result.browser_cookie_attempts is not None
    assert result.browser_cookie_attempts[0]["browser"] == "edge"
    assert result.browser_cookie_attempts[0]["success"] is False
    assert result.browser_cookie_attempts[1]["browser"] == "chrome"
    assert result.browser_cookie_attempts[1]["success"] is True


def test_douyin_loader_resolves_short_url(tmp_path: Path, monkeypatch) -> None:
    seen_urls: list[str] = []

    class ResolvingYoutubeDL(FakeYoutubeDL):
        def extract_info(self, url: str, download: bool = False):
            seen_urls.append(url)
            return {
                "title": "短链视频",
                "uploader": "作者",
                "duration": 8,
                "webpage_url": url,
                "id": "123456",
                "extractor": "Douyin",
            }

        def download(self, urls):
            seen_urls.extend(urls)
            output = Path(self.options["outtmpl"].replace("%(ext)s", "m4a"))
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_bytes(b"audio")

    monkeypatch.setattr(douyin_loader, "YoutubeDL", ResolvingYoutubeDL)
    monkeypatch.setattr(douyin_loader.urllib.request, "urlopen", lambda request, timeout=20: FinalUrlResponse())
    loader = DouyinLoader(output_dir=tmp_path / "outputs", temp_dir=tmp_path / "temp")

    result = loader.extract("https://v.douyin.com/abc123/")

    assert result.success is True
    assert seen_urls == [
        "https://www.douyin.com/video/123456",
        "https://www.douyin.com/video/123456",
    ]


def test_douyin_loader_normalizes_share_video_redirect(
    tmp_path: Path, monkeypatch
) -> None:
    seen_urls: list[str] = []

    class ResolvingYoutubeDL(FakeYoutubeDL):
        def extract_info(self, url: str, download: bool = False):
            seen_urls.append(url)
            return {
                "title": "短链视频",
                "uploader": "作者",
                "duration": 8,
                "webpage_url": url,
                "id": "654321",
                "extractor": "Douyin",
            }

        def download(self, urls):
            seen_urls.extend(urls)
            output = Path(self.options["outtmpl"].replace("%(ext)s", "m4a"))
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_bytes(b"audio")

    monkeypatch.setattr(douyin_loader, "YoutubeDL", ResolvingYoutubeDL)
    monkeypatch.setattr(
        douyin_loader.urllib.request,
        "urlopen",
        lambda request, timeout=20: ShareVideoFinalUrlResponse(),
    )
    loader = DouyinLoader(output_dir=tmp_path / "outputs", temp_dir=tmp_path / "temp")

    result = loader.extract("https://v.douyin.com/abc123/ 复制此链接")

    assert result.success is True
    assert seen_urls == [
        "https://www.douyin.com/video/654321",
        "https://www.douyin.com/video/654321",
    ]


def test_douyin_loader_falls_back_to_share_page_when_ytdlp_needs_login(
    tmp_path: Path, monkeypatch
) -> None:
    router_data = {
        "loaderData": {
            "video_(id)/page": {
                "videoInfoRes": {
                    "item_list": [
                        {
                            "aweme_id": "123456",
                            "desc": "公开分享页标题",
                            "create_time": 1718448197,
                            "author": {"nickname": "公开作者"},
                            "video": {
                                "duration": 12345,
                                "play_addr": {
                                    "url_list": ["https://example.com/video.mp4"]
                                },
                            },
                        }
                    ]
                }
            }
        }
    }
    html = (
        "<html><script>window._ROUTER_DATA = "
        + douyin_loader.json.dumps(router_data, ensure_ascii=False)
        + "</script></html>"
    ).encode("utf-8")

    def fake_urlopen(request, timeout=20):
        url = request.full_url if hasattr(request, "full_url") else str(request)
        if "iesdouyin.com/share/video" in url:
            return BytesResponse(html)
        if "example.com/video.mp4" in url:
            return BytesResponse(b"fake mp4")
        raise AssertionError(url)

    def fake_run(command, **kwargs):
        Path(command[-1]).write_bytes(b"fake audio")
        return SimpleNamespace(returncode=0, stderr="")

    monkeypatch.setattr(douyin_loader, "YoutubeDL", LoginRequiredYoutubeDL)
    monkeypatch.setattr(douyin_loader.urllib.request, "urlopen", fake_urlopen)
    monkeypatch.setattr(douyin_loader.subprocess, "run", fake_run)
    loader = DouyinLoader(output_dir=tmp_path / "outputs", temp_dir=tmp_path / "temp")

    result = loader.extract("https://www.douyin.com/video/123456")

    assert result.success is True
    assert result.source_type == "audio"
    assert result.audio_path is not None
    assert Path(result.audio_path).read_bytes() == b"fake audio"
    metadata = douyin_loader.json.loads(
        Path(result.metadata_path or "").read_text(encoding="utf-8")
    )
    assert metadata["metadata_source"] == "share-page"
    assert metadata["title"] == "公开分享页标题"
    assert metadata["uploader"] == "公开作者"
