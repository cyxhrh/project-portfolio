from __future__ import annotations

import json
import re
import shutil
import subprocess
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Literal

from yt_dlp import DownloadError, YoutubeDL


AUDIO_EXTENSIONS = {".m4a", ".mp3", ".webm", ".opus"}
SUBTITLE_EXTENSIONS = {".srt", ".vtt", ".json3", ".json"}
SourceType = Literal["subtitle", "audio", "fail"]
Stage = Literal["metadata", "subtitle", "audio", "done", "fail"]
BrowserName = Literal["edge", "chrome", "firefox", "brave"]
ErrorCode = Literal[
    "INVALID_URL",
    "NEED_LOGIN",
    "COOKIES_FILE_NOT_FOUND",
    "NO_SUBTITLE",
    "AUDIO_DOWNLOAD_FAILED",
    "YTDLP_FAILED",
    "NETWORK_FAILED",
    "UNKNOWN_ERROR",
]
AUTO_BROWSER_ORDER: list[BrowserName] = ["edge", "chrome", "firefox", "brave"]


class CookiesFileNotFoundError(FileNotFoundError):
    pass


class QuietYtdlpLogger:
    def debug(self, message: str) -> None:
        return None

    def info(self, message: str) -> None:
        return None

    def warning(self, message: str) -> None:
        return None

    def error(self, message: str) -> None:
        return None


@dataclass(frozen=True)
class DouyinLoaderResult:
    success: bool
    source_type: SourceType
    transcript_path: str | None
    audio_path: str | None
    metadata_path: str | None
    error_message: str | None
    stage: Stage
    has_subtitle: bool
    available_subtitles: list[str]
    used_subtitle_lang: str | None
    yt_dlp_error_type: str | None
    suggestion: str
    error_code: ErrorCode | None = None
    browser_cookie_attempts: list[dict[str, Any]] | None = None


class DouyinLoader:
    def __init__(
        self,
        *,
        output_dir: Path | str | None = None,
        temp_dir: Path | str | None = None,
        cookies_from_browser: str | None = None,
        cookies_file: Path | str | None = None,
        auto_browser_cookies: bool = False,
    ) -> None:
        self.project_root = Path(__file__).resolve().parents[3]
        self.output_dir = Path(output_dir) if output_dir else self.project_root / "outputs" / "douyin_test"
        self.temp_dir = Path(temp_dir) if temp_dir else self.project_root / "temp"
        self.cookies_from_browser = cookies_from_browser
        self.cookies_file = Path(cookies_file) if cookies_file else None
        self.auto_browser_cookies = auto_browser_cookies
        self._last_browser_cookie_attempts: list[dict[str, Any]] | None = None

    def extract(self, url: str) -> DouyinLoaderResult:
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        self._last_browser_cookie_attempts = None
        original_input = url

        metadata_path = self.output_dir / "metadata.json"
        result_path = self.output_dir / "result.json"

        try:
            self._clean_previous_outputs()
            url = self._normalize_url(url)
            self._validate_cookies_file()

            stage: Stage = "metadata"
            try:
                info, selected_browser, browser_attempts = self._fetch_metadata_with_cookie_strategy(url)
                metadata = self._build_metadata(info, original_input, url)
                metadata["cookies_from_browser"] = selected_browser
                audio_downloader = "yt-dlp"
            except Exception as exc:
                if not self._can_use_share_page_fallback(exc):
                    raise
                browser_attempts = self._last_browser_cookie_attempts
                selected_browser = None
                info = self._fetch_share_page_info(url)
                metadata = self._build_share_page_metadata(info, original_input, url)
                metadata["cookies_from_browser"] = None
                audio_downloader = "share-page"
            self._write_json(metadata_path, metadata)

            stage = "audio"
            if audio_downloader == "share-page":
                audio_path = self._download_share_page_audio(
                    info["play_url"],
                    referer=info["share_url"],
                )
            else:
                audio_path = self._download_audio(url, selected_browser)
            result = DouyinLoaderResult(
                success=True,
                source_type="audio",
                transcript_path=None,
                audio_path=str(audio_path),
                metadata_path=str(metadata_path),
                error_message=None,
                stage="done",
                has_subtitle=False,
                available_subtitles=[],
                used_subtitle_lang=None,
                yt_dlp_error_type=None,
                suggestion="抖音视频已提取音频，下一步可以直接使用 audio 文件。",
                error_code=None,
                browser_cookie_attempts=browser_attempts,
            )
            self._write_result(result_path, result)
            self._write_debug_report(result_path.with_name("debug_report.md"), url, metadata, result)
            return result
        except Exception as exc:
            error_code = self._classify_error(exc)
            result = DouyinLoaderResult(
                success=False,
                source_type="fail",
                transcript_path=None,
                audio_path=None,
                metadata_path=str(metadata_path) if metadata_path.exists() else None,
                error_message=self._friendly_error(exc),
                stage=locals().get("stage", "fail"),
                has_subtitle=False,
                available_subtitles=[],
                used_subtitle_lang=None,
                yt_dlp_error_type=exc.__class__.__name__ if isinstance(exc, DownloadError) else None,
                suggestion=self._suggestion_for_error(error_code),
                error_code=error_code,
                browser_cookie_attempts=locals().get("browser_attempts", None)
                or self._last_browser_cookie_attempts,
            )
            self._write_result(result_path, result)
            metadata = {}
            if metadata_path.exists():
                metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
            self._write_debug_report(result_path.with_name("debug_report.md"), url, metadata, result)
            return result

    def _fetch_metadata_with_cookie_strategy(
        self, url: str
    ) -> tuple[dict[str, Any], str | None, list[dict[str, Any]] | None]:
        if self.auto_browser_cookies:
            attempts: list[dict[str, Any]] = []
            self._last_browser_cookie_attempts = attempts
            last_error: Exception | None = None
            for browser in AUTO_BROWSER_ORDER:
                try:
                    info = self._fetch_metadata(url, cookies_from_browser=browser)
                    attempts.append(
                        {
                            "browser": browser,
                            "success": True,
                            "stage": "metadata",
                            "error_code": None,
                            "error_type": None,
                            "failure_kind": None,
                        }
                    )
                    return info, browser, attempts
                except Exception as exc:
                    last_error = exc
                    error_code = self._classify_error(exc)
                    attempts.append(
                        {
                            "browser": browser,
                            "success": False,
                            "stage": "metadata",
                            "error_code": error_code,
                            "error_type": exc.__class__.__name__,
                            "failure_kind": self._cookie_failure_kind(exc),
                        }
                    )
            if last_error:
                raise last_error
            raise RuntimeError("Auto browser cookies failed without a captured error.")

        selected_browser = self.cookies_from_browser
        try:
            info = self._fetch_metadata(url, cookies_from_browser=selected_browser)
            attempts = None
            if selected_browser:
                attempts = [
                    {
                        "browser": selected_browser,
                        "success": True,
                        "stage": "metadata",
                        "error_code": None,
                        "error_type": None,
                        "failure_kind": None,
                    }
                ]
            return info, selected_browser, attempts
        except Exception as exc:
            if selected_browser:
                error_code = self._classify_error(exc)
                self._last_browser_cookie_attempts = [
                    {
                        "browser": selected_browser,
                        "success": False,
                        "stage": "metadata",
                        "error_code": error_code,
                        "error_type": exc.__class__.__name__,
                        "failure_kind": self._cookie_failure_kind(exc),
                    }
                ]
            raise

    def _fetch_metadata(
        self, url: str, *, cookies_from_browser: str | None = None
    ) -> dict[str, Any]:
        with YoutubeDL(self._yt_dlp_options(cookies_from_browser=cookies_from_browser)) as ydl:
            info = ydl.extract_info(url, download=False)
        if not isinstance(info, dict):
            raise RuntimeError("yt-dlp did not return video metadata.")
        return info

    def _download_audio(self, url: str, cookies_from_browser: str | None = None) -> Path:
        outtmpl = str(self.temp_dir / "douyin_audio.%(ext)s")
        options: dict[str, Any] = {
            **self._yt_dlp_options(cookies_from_browser=cookies_from_browser),
            "format": "bestaudio[ext=m4a]/bestaudio/best",
            "outtmpl": outtmpl,
        }
        if shutil.which("ffmpeg"):
            options["postprocessors"] = [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "m4a",
                }
            ]

        before = self._audio_files()
        with YoutubeDL(options) as ydl:
            ydl.download([url])
        after = self._audio_files()

        candidates = sorted(after - before) or sorted(after)
        for path in candidates:
            if path.exists() and path.stat().st_size > 0:
                return path
        raise RuntimeError("Audio download finished but no audio file was created.")

    def _download_share_page_audio(self, play_url: str, *, referer: str) -> Path:
        video_path = self.temp_dir / "douyin_fallback_video.mp4"
        audio_path = self.temp_dir / "douyin_audio.m4a"
        request = urllib.request.Request(
            play_url,
            headers={
                "User-Agent": self._desktop_user_agent(),
                "Referer": referer,
                "Accept": "*/*",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                with video_path.open("wb") as output:
                    shutil.copyfileobj(response, output)
        except urllib.error.URLError as exc:
            raise RuntimeError(f"Network failed downloading Douyin media: {exc}") from exc

        if not video_path.exists() or video_path.stat().st_size == 0:
            raise RuntimeError("Douyin media download finished but no file was created.")

        if not shutil.which("ffmpeg"):
            return video_path

        command = [
            "ffmpeg",
            "-y",
            "-i",
            str(video_path),
            "-vn",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
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
            raise RuntimeError(f"Douyin audio extraction failed: {completed.stderr.strip()}")
        if not audio_path.exists() or audio_path.stat().st_size == 0:
            raise RuntimeError("Douyin audio extraction finished but no audio file was created.")
        return audio_path

    def _yt_dlp_options(self, *, cookies_from_browser: str | None = None) -> dict[str, Any]:
        options: dict[str, Any] = {
            "quiet": True,
            "no_warnings": True,
            "logger": QuietYtdlpLogger(),
            "noplaylist": True,
            "windowsfilenames": True,
            "retries": 3,
            "fragment_retries": 3,
            "http_headers": {
                "User-Agent": self._desktop_user_agent(),
                "Referer": "https://www.douyin.com/",
                "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            },
        }
        browser = cookies_from_browser if cookies_from_browser is not None else self.cookies_from_browser
        if browser:
            options["cookiesfrombrowser"] = (browser,)
        if self.cookies_file:
            options["cookiefile"] = str(self.cookies_file)
        return options

    def _build_metadata(
        self, info: dict[str, Any], original_input: str, normalized_url: str
    ) -> dict[str, Any]:
        return {
            "title": info.get("title") or info.get("description"),
            "uploader": info.get("uploader") or info.get("creator") or info.get("channel"),
            "duration": info.get("duration"),
            "duration_string": info.get("duration_string"),
            "timestamp": info.get("timestamp"),
            "upload_date": info.get("upload_date"),
            "webpage_url": info.get("webpage_url") or normalized_url,
            "original_url": original_input,
            "normalized_url": normalized_url,
            "id": info.get("id"),
            "extractor": info.get("extractor"),
            "metadata_source": "yt-dlp",
        }

    def _build_share_page_metadata(
        self, info: dict[str, Any], original_input: str, normalized_url: str
    ) -> dict[str, Any]:
        return {
            "title": info.get("title"),
            "uploader": info.get("uploader"),
            "duration": info.get("duration"),
            "duration_string": None,
            "timestamp": info.get("timestamp"),
            "upload_date": info.get("upload_date"),
            "webpage_url": info.get("webpage_url") or normalized_url,
            "original_url": original_input,
            "normalized_url": normalized_url,
            "id": info.get("id"),
            "extractor": "DouyinSharePage",
            "metadata_source": "share-page",
        }

    def _fetch_share_page_info(self, url: str) -> dict[str, Any]:
        video_id = self._extract_video_id(url)
        if not video_id:
            raise ValueError("Invalid Douyin URL: could not find a numeric video id.")

        share_url = f"https://www.iesdouyin.com/share/video/{video_id}/"
        request = urllib.request.Request(
            share_url,
            headers={
                "User-Agent": self._mobile_user_agent(),
                "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                html = response.read().decode("utf-8", errors="replace")
        except urllib.error.URLError as exc:
            raise RuntimeError(f"Network failed fetching Douyin share page: {exc}") from exc

        match = re.search(r"window\._ROUTER_DATA\s*=\s*(\{.*?\})</script>", html, re.S)
        if not match:
            raise RuntimeError("Douyin share page did not include public video data.")

        data = json.loads(match.group(1))
        item = self._find_share_page_item(data)
        video = item.get("video") or {}
        play_addr = video.get("play_addr") or {}
        url_list = play_addr.get("url_list") or []
        if not url_list:
            raise RuntimeError("Douyin share page did not include a playable media URL.")

        create_time = item.get("create_time")
        duration_ms = video.get("duration")
        duration = round(duration_ms / 1000, 3) if isinstance(duration_ms, (int, float)) else None
        author = item.get("author") or {}
        return {
            "id": item.get("aweme_id") or video_id,
            "title": item.get("desc") or "Douyin Video",
            "uploader": author.get("nickname"),
            "timestamp": create_time,
            "upload_date": datetime.fromtimestamp(create_time).strftime("%Y%m%d")
            if isinstance(create_time, (int, float))
            else None,
            "duration": duration,
            "webpage_url": f"https://www.douyin.com/video/{video_id}",
            "share_url": share_url,
            "play_url": url_list[0],
        }

    def _find_share_page_item(self, data: dict[str, Any]) -> dict[str, Any]:
        loader_data = data.get("loaderData") or {}
        for value in loader_data.values():
            if not isinstance(value, dict):
                continue
            video_info = value.get("videoInfoRes") or {}
            items = video_info.get("item_list") or []
            if items and isinstance(items[0], dict):
                return items[0]
        raise RuntimeError("Douyin share page public data did not include item_list.")

    def _extract_video_id(self, url: str) -> str | None:
        normalized = self._normalize_resolved_url(url)
        if normalized:
            match = re.search(r"/video/(\d+)", normalized)
            if match:
                return match.group(1)
        parsed = urllib.parse.urlparse(url)
        match = re.search(r"/(?:share/)?video/(\d+)", parsed.path)
        if match:
            return match.group(1)
        return None

    def _normalize_url(self, value: str) -> str:
        candidate = self._extract_url(value)
        if not candidate:
            raise ValueError("Invalid URL: please provide a full Douyin video URL.")
        if "v.douyin.com" in candidate.lower():
            candidate = self._resolve_short_url(candidate)
        self._validate_url(candidate)
        return candidate

    def _extract_url(self, value: str) -> str | None:
        stripped = value.strip()
        match = re.search(r"https?://[^\s，。；;、<>\"']+", stripped, re.IGNORECASE)
        if match:
            return match.group(0).rstrip(".,，。!！?？)")
        return None

    def _validate_url(self, url: str) -> None:
        value = url.strip()
        lowered = value.lower()
        if (
            "douyin.com" not in lowered
            and "iesdouyin.com" not in lowered
            and "v.douyin.com" not in lowered
        ):
            raise ValueError("Invalid Douyin URL: expected a douyin.com video link.")

    def _resolve_short_url(self, url: str) -> str:
        request = urllib.request.Request(
            url,
            headers={
                "User-Agent": self._desktop_user_agent(),
                "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            },
        )
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                final_url = response.geturl()
        except urllib.error.URLError as exc:
            raise RuntimeError(f"Network failed resolving Douyin short URL: {exc.reason}") from exc

        normalized = self._normalize_resolved_url(final_url)
        if normalized:
            return normalized
        return final_url

    def _normalize_resolved_url(self, url: str) -> str | None:
        parsed = urllib.parse.urlparse(url)
        match = re.search(r"/(?:share/)?video/(\d+)", parsed.path)
        if match:
            return f"https://www.douyin.com/video/{match.group(1)}"

        query = urllib.parse.parse_qs(parsed.query)
        for key in ("modal_id", "aweme_id", "item_id"):
            values = query.get(key)
            if values and values[0].isdigit():
                return f"https://www.douyin.com/video/{values[0]}"

        return None

    def _validate_cookies_file(self) -> None:
        if not self.cookies_file:
            return
        path = self.cookies_file
        if not path.is_absolute():
            path = self.project_root / path
        if not path.is_file():
            raise CookiesFileNotFoundError(
                f'COOKIES_FILE_NOT_FOUND: cookies file not found: "{self.cookies_file}". '
                'Expected a Netscape-format cookies.txt file. You can place it at '
                '"secrets/douyin_cookies.txt".'
            )
        self.cookies_file = path

    def _can_use_share_page_fallback(self, exc: Exception) -> bool:
        return self._classify_error(exc) in {
            "NEED_LOGIN",
            "YTDLP_FAILED",
            "NETWORK_FAILED",
        }

    def _desktop_user_agent(self) -> str:
        return (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/126.0.0.0 Safari/537.36"
        )

    def _mobile_user_agent(self) -> str:
        return (
            "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) "
            "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 "
            "Mobile/15E148 Safari/604.1"
        )

    def _audio_files(self) -> set[Path]:
        return {
            path
            for path in self.temp_dir.glob("douyin_audio*")
            if path.suffix.lower() in AUDIO_EXTENSIONS
        }

    def _clean_previous_outputs(self) -> None:
        for pattern in ("douyin_audio*", "douyin_subtitle*"):
            for path in self.temp_dir.glob(pattern):
                if path.is_file():
                    path.unlink()
        for filename in ("metadata.json", "result.json", "transcript.txt", "debug_report.md"):
            path = self.output_dir / filename
            if path.is_file():
                path.unlink()

    def _classify_error(self, exc: Exception) -> ErrorCode:
        message = str(exc)
        lower = message.lower()
        if isinstance(exc, ValueError):
            return "INVALID_URL"
        if isinstance(exc, CookiesFileNotFoundError):
            return "COOKIES_FILE_NOT_FOUND"
        if "login" in lower or "cookie" in lower or "credential" in lower:
            return "NEED_LOGIN"
        if "unsupported url" in lower or "invalid" in lower:
            return "INVALID_URL"
        if "unable to download" in lower or "network" in lower or "timed out" in lower:
            return "NETWORK_FAILED"
        if "audio" in lower:
            return "AUDIO_DOWNLOAD_FAILED"
        if isinstance(exc, DownloadError):
            return "YTDLP_FAILED"
        return "UNKNOWN_ERROR"

    def _friendly_error(self, exc: Exception) -> str:
        error_code = self._classify_error(exc)
        if error_code == "COOKIES_FILE_NOT_FOUND":
            return str(exc)
        if error_code == "NEED_LOGIN":
            return "Douyin may require login or cookies. Try --auto-browser-cookies or --cookies secrets/douyin_cookies.txt."
        if error_code == "NETWORK_FAILED":
            return "Network or yt-dlp download failed. Please retry or check connectivity."
        return str(exc) or exc.__class__.__name__

    def _cookie_failure_kind(self, exc: Exception) -> str:
        if isinstance(exc, CookiesFileNotFoundError):
            return "COOKIES_FILE_NOT_FOUND"
        lower = str(exc).lower()
        if "could not find" in lower and "cookies" in lower:
            return "COOKIES_PATH_NOT_FOUND"
        if "cookie" in lower or "login" in lower or "credential" in lower:
            return "COOKIES_INVALID_OR_LOGIN_REQUIRED"
        if "timed out" in lower or "network" in lower or "unable to download" in lower:
            return "NETWORK_OR_DOWNLOAD_ERROR"
        return "UNKNOWN"

    def _suggestion_for_error(self, error_code: ErrorCode) -> str:
        suggestions = {
            "INVALID_URL": "请确认输入的是完整抖音视频链接。",
            "NEED_LOGIN": self._cookies_login_suggestion(),
            "COOKIES_FILE_NOT_FOUND": '请把 Netscape 格式 cookies 文件放到 secrets/douyin_cookies.txt，或用 --cookies 指定路径。',
            "NO_SUBTITLE": "抖音通常没有可直接下载字幕，已使用音频文件作为后续输入。",
            "AUDIO_DOWNLOAD_FAILED": "请检查网络、yt-dlp 版本和 FFmpeg；可先执行 pip install -U yt-dlp。",
            "YTDLP_FAILED": "请升级 yt-dlp 后重试；如果仍失败，尝试带 cookies 运行。",
            "NETWORK_FAILED": "请检查网络连接、代理或抖音访问状态，然后重试。",
            "UNKNOWN_ERROR": "请查看 result.json 中的 error_message，并保留 debug_report.md 用于继续定位。",
        }
        return suggestions[error_code]

    def _cookies_login_suggestion(self) -> str:
        return (
            "请在浏览器确认已登录抖音，并优先尝试：\n"
            'python scripts/test_douyin_loader.py "<url>" --auto-browser-cookies\n\n'
            "如果仍失败，请使用 Netscape 格式 cookies.txt：\n"
            'python scripts/test_douyin_loader.py "<url>" --cookies "secrets/douyin_cookies.txt"'
        )

    def _write_result(self, path: Path, result: DouyinLoaderResult) -> None:
        self._write_json(path, asdict(result))

    def _write_json(self, path: Path, data: dict[str, Any]) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    def _write_debug_report(
        self,
        path: Path,
        url: str,
        metadata: dict[str, Any],
        result: DouyinLoaderResult,
    ) -> None:
        lines = [
            "# Douyin Loader Debug Report",
            "",
            f"- 测试时间: {datetime.now().isoformat(timespec='seconds')}",
            f"- 测试链接: {url}",
            f"- 是否成功: {result.success}",
            f"- 使用了字幕还是音频: {result.source_type}",
            f"- 当前阶段: {result.stage}",
            f"- 视频标题: {metadata.get('title') or ''}",
            f"- 作者: {metadata.get('uploader') or ''}",
            f"- 视频时长: {metadata.get('duration') or ''}",
            f"- 失败原因: {result.error_code or ''}",
            f"- 错误信息: {result.error_message or ''}",
            f"- 建议下一步: {result.suggestion}",
            "",
        ]
        if result.browser_cookie_attempts:
            lines.extend(["## Browser Cookie Attempts", ""])
            for attempt in result.browser_cookie_attempts:
                lines.extend(
                    [
                        f"- 浏览器: {attempt.get('browser')}",
                        f"  - 是否成功: {attempt.get('success')}",
                        f"  - 失败阶段: {attempt.get('stage')}",
                        f"  - 错误类型: {attempt.get('error_type') or ''}",
                        f"  - 错误分类: {attempt.get('error_code') or ''}",
                        f"  - 失败原因类型: {attempt.get('failure_kind') or ''}",
                        "",
                    ]
                )
        path.write_text("\n".join(lines), encoding="utf-8")
