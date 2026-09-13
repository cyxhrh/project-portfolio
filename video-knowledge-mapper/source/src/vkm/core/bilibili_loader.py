from __future__ import annotations

import json
import re
import shutil
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Literal

from yt_dlp import DownloadError, YoutubeDL

from vkm.core.subtitles import clean_subtitle_text, parse_subtitle_file


BILIBILI_SUBTITLE_LANGS = ["zh-CN", "zh-Hans", "zh", "ai-zh"]
SUBTITLE_LANG_PATTERNS = [
    "zh-CN",
    "zh-Hans",
    "zh",
    "ai-zh",
    "zh-Hant",
    "zh-TW",
    "cmn",
    "Chinese",
    "中文",
]
SUBTITLE_EXTENSIONS = {".srt", ".vtt", ".json3", ".json"}
AUDIO_EXTENSIONS = {".m4a", ".mp3", ".webm", ".opus"}
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
DEFAULT_COOKIES_PATH = Path("secrets") / "bilibili_cookies.txt"
BILIBILI_API_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/126.0.0.0 Safari/537.36"
    ),
    "Referer": "https://www.bilibili.com/",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}


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
class BilibiliLoaderResult:
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


class BilibiliLoader:
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
        self.output_dir = Path(output_dir) if output_dir else self.project_root / "outputs" / "bilibili_test"
        self.temp_dir = Path(temp_dir) if temp_dir else self.project_root / "temp"
        self.cookies_from_browser = cookies_from_browser
        self.cookies_file = Path(cookies_file) if cookies_file else None
        self.auto_browser_cookies = auto_browser_cookies
        self._last_browser_cookie_attempts: list[dict[str, Any]] | None = None

    def extract(self, url: str) -> BilibiliLoaderResult:
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        self._last_browser_cookie_attempts = None

        metadata_path = self.output_dir / "metadata.json"
        result_path = self.output_dir / "result.json"
        transcript_path = self.output_dir / "transcript.txt"

        try:
            self._clean_previous_outputs()
            self._validate_url(url)
            stage: Stage = "metadata"
            self._validate_cookies_file()
            try:
                info, selected_browser, browser_attempts = self._fetch_metadata_with_cookie_strategy(url)
                metadata_source = "yt-dlp"
            except Exception as metadata_exc:
                info = self._fetch_bilibili_api_metadata(url)
                selected_browser = None
                browser_attempts = self._last_browser_cookie_attempts
                metadata_source = "bilibili_api"
                info["__metadata_fallback_error"] = metadata_exc.__class__.__name__
            subtitle_keys = self.safe_subtitle_keys(info)
            subtitle_lang = self._choose_subtitle_lang(info)
            metadata = self._build_metadata(info, url)
            metadata["cookies_from_browser"] = selected_browser
            metadata["metadata_source"] = metadata_source
            self._write_json(metadata_path, metadata)

            stage = "subtitle"
            api_subtitle = self._download_api_subtitle(info)
            if api_subtitle:
                subtitle_file, api_subtitle_lang = api_subtitle
                subtitle_lang = api_subtitle_lang
            else:
                subtitle_file = self._download_best_subtitle(url, subtitle_lang, selected_browser)
            if subtitle_file:
                transcript = self._subtitle_to_text(subtitle_file)
                if transcript.strip():
                    transcript_path.write_text(transcript, encoding="utf-8")
                    result = BilibiliLoaderResult(
                        success=True,
                        source_type="subtitle",
                        transcript_path=str(transcript_path),
                        audio_path=None,
                        metadata_path=str(metadata_path),
                        error_message=None,
                        stage="done",
                        has_subtitle=True,
                        available_subtitles=subtitle_keys,
                        used_subtitle_lang=subtitle_lang,
                        yt_dlp_error_type=None,
                        suggestion="字幕已提取完成，下一步可以直接使用 transcript.txt。",
                        browser_cookie_attempts=browser_attempts,
                    )
                    self._write_result(result_path, result)
                    self._write_debug_report(result_path.with_name("debug_report.md"), url, metadata, result)
                    return result

            stage = "audio"
            audio_path = self._download_audio(url, selected_browser, info)
            result = BilibiliLoaderResult(
                success=True,
                source_type="audio",
                transcript_path=None,
                audio_path=str(audio_path),
                metadata_path=str(metadata_path),
                error_message=None,
                stage="done",
                has_subtitle=bool(subtitle_keys),
                available_subtitles=subtitle_keys,
                used_subtitle_lang=None,
                yt_dlp_error_type=None,
                suggestion="未获得可用字幕，已下载音频；下一步可以直接使用 audio 文件。",
                error_code="NO_SUBTITLE",
                browser_cookie_attempts=browser_attempts,
            )
            self._write_result(result_path, result)
            self._write_debug_report(result_path.with_name("debug_report.md"), url, metadata, result)
            return result
        except Exception as exc:
            error_code = self._classify_error(exc)
            result = BilibiliLoaderResult(
                success=False,
                source_type="fail",
                transcript_path=None,
                audio_path=None,
                metadata_path=str(metadata_path) if metadata_path.exists() else None,
                error_message=self._friendly_error(exc),
                stage=locals().get("stage", "fail"),
                has_subtitle=bool(locals().get("subtitle_keys", [])),
                available_subtitles=locals().get("subtitle_keys", []),
                used_subtitle_lang=locals().get("subtitle_lang", None),
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
        attempts = None
        try:
            info = self._fetch_metadata(url, cookies_from_browser=selected_browser)
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
                attempts = [
                    {
                        "browser": selected_browser,
                        "success": False,
                        "stage": "metadata",
                        "error_code": error_code,
                        "error_type": exc.__class__.__name__,
                        "failure_kind": self._cookie_failure_kind(exc),
                    }
                ]
                browser_attempts = attempts
                self._last_browser_cookie_attempts = attempts
            raise

    def _fetch_metadata(
        self, url: str, *, cookies_from_browser: str | None = None
    ) -> dict[str, Any]:
        with YoutubeDL(self._yt_dlp_options(cookies_from_browser=cookies_from_browser)) as ydl:
            info = ydl.extract_info(url, download=False)
        if not isinstance(info, dict):
            raise RuntimeError("yt-dlp did not return video metadata.")
        return info

    def _fetch_bilibili_api_metadata(self, url: str) -> dict[str, Any]:
        bvid = self._extract_bvid(url)
        if not bvid:
            raise ValueError("Invalid Bilibili URL: could not find BV id.")

        view_url = "https://api.bilibili.com/x/web-interface/view?" + urllib.parse.urlencode(
            {"bvid": bvid}
        )
        payload = self._get_json(view_url)
        if payload.get("code") != 0:
            message = payload.get("message") or "Bilibili API metadata request failed."
            raise RuntimeError(f"Bilibili API metadata request failed: {message}")

        data = payload.get("data") or {}
        owner = data.get("owner") or {}
        pages = data.get("pages") or []
        first_page = pages[0] if pages else {}
        aid = data.get("aid")
        cid = first_page.get("cid")
        subtitles = self._fetch_api_subtitle_tracks(aid, cid) if aid and cid else []

        return {
            "title": data.get("title"),
            "uploader": owner.get("name"),
            "channel": owner.get("name"),
            "duration": data.get("duration"),
            "timestamp": data.get("pubdate"),
            "release_timestamp": data.get("pubdate"),
            "webpage_url": f"https://www.bilibili.com/video/{bvid}/",
            "id": bvid,
            "extractor": "BilibiliAPI",
            "__api_aid": aid,
            "__api_bvid": bvid,
            "__api_cid": cid,
            "__api_pages": pages,
            "__api_subtitles": subtitles,
        }

    def _fetch_api_subtitle_tracks(self, aid: int, cid: int) -> list[dict[str, Any]]:
        player_url = "https://api.bilibili.com/x/player/v2?" + urllib.parse.urlencode(
            {"aid": aid, "cid": cid}
        )
        try:
            payload = self._get_json(player_url)
        except Exception:
            return []
        if payload.get("code") != 0:
            return []
        subtitle = ((payload.get("data") or {}).get("subtitle") or {})
        tracks = subtitle.get("subtitles") or []
        return [track for track in tracks if isinstance(track, dict)]

    def _download_api_subtitle(self, info: dict[str, Any]) -> tuple[Path, str] | None:
        tracks = info.get("__api_subtitles") or []
        track = self._choose_api_subtitle_track(tracks)
        if not track:
            return None

        subtitle_url = track.get("subtitle_url") or track.get("url")
        if not subtitle_url:
            return None
        if subtitle_url.startswith("//"):
            subtitle_url = "https:" + subtitle_url
        if not subtitle_url.startswith("http"):
            subtitle_url = urllib.parse.urljoin("https://www.bilibili.com", subtitle_url)

        data = self._get_json(subtitle_url)
        path = self.temp_dir / "subtitle.api.json"
        self._write_json(path, data)
        language = str(track.get("lan") or track.get("lan_doc") or "api")
        return path, language

    def _choose_api_subtitle_track(self, tracks: list[dict[str, Any]]) -> dict[str, Any] | None:
        if not tracks:
            return None

        for preferred in BILIBILI_SUBTITLE_LANGS:
            for track in tracks:
                values = [
                    str(track.get("lan") or ""),
                    str(track.get("lan_doc") or ""),
                ]
                if any(value.lower() == preferred.lower() for value in values):
                    return track

        for pattern in SUBTITLE_LANG_PATTERNS:
            pattern_lower = pattern.lower()
            for track in tracks:
                values = [
                    str(track.get("lan") or ""),
                    str(track.get("lan_doc") or ""),
                ]
                if any(pattern_lower in value.lower() for value in values):
                    return track

        return tracks[0]

    def _get_json(self, url: str) -> dict[str, Any]:
        request = urllib.request.Request(url, headers=BILIBILI_API_HEADERS)
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                raw = response.read()
        except urllib.error.HTTPError as exc:
            raise RuntimeError(f"Bilibili API HTTP error: {exc.code}") from exc
        except urllib.error.URLError as exc:
            raise RuntimeError(f"Bilibili API network error: {exc.reason}") from exc
        return json.loads(raw.decode("utf-8", errors="replace"))

    def _download_binary(self, url: str, path: Path) -> None:
        headers = {
            **BILIBILI_API_HEADERS,
            "Origin": "https://www.bilibili.com",
        }
        request = urllib.request.Request(url, headers=headers)
        path.parent.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(request, timeout=60) as response:
            with path.open("wb") as handle:
                while True:
                    chunk = response.read(1024 * 1024)
                    if not chunk:
                        break
                    handle.write(chunk)

    def _download_best_subtitle(
        self,
        url: str,
        subtitle_lang: str | None,
        cookies_from_browser: str | None = None,
    ) -> Path | None:
        if not subtitle_lang:
            return None

        before = self._subtitle_files()
        options = {
            **self._yt_dlp_options(cookies_from_browser=cookies_from_browser),
            "skip_download": True,
            "writesubtitles": True,
            "writeautomaticsub": True,
            "subtitleslangs": [subtitle_lang],
            "subtitlesformat": "srt/vtt/json3/best",
            "outtmpl": str(self.temp_dir / "subtitle.%(ext)s"),
        }

        try:
            with YoutubeDL(options) as ydl:
                ydl.download([url])
        except DownloadError:
            return None

        after = self._subtitle_files()
        candidates = sorted(after - before) or sorted(after)
        for path in candidates:
            if path.exists() and path.stat().st_size > 0:
                return path
        return None

    def _download_audio(
        self,
        url: str,
        cookies_from_browser: str | None = None,
        info: dict[str, Any] | None = None,
    ) -> Path:
        if info:
            api_audio = self._download_api_audio(info)
            if api_audio:
                return api_audio

        outtmpl = str(self.temp_dir / "audio.%(ext)s")
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

    def _download_api_audio(self, info: dict[str, Any]) -> Path | None:
        bvid = info.get("__api_bvid") or info.get("id")
        cid = info.get("__api_cid")
        if not bvid or not cid:
            return None

        play_url = "https://api.bilibili.com/x/player/playurl?" + urllib.parse.urlencode(
            {
                "bvid": bvid,
                "cid": cid,
                "fnval": 16,
                "fnver": 0,
                "fourk": 1,
            }
        )
        try:
            payload = self._get_json(play_url)
        except Exception:
            return None
        if payload.get("code") != 0:
            return None

        dash = ((payload.get("data") or {}).get("dash") or {})
        audio_tracks = dash.get("audio") or []
        if not audio_tracks:
            return None

        def bandwidth(track: dict[str, Any]) -> int:
            raw = track.get("bandwidth") or 0
            try:
                return int(raw)
            except (TypeError, ValueError):
                return 0

        best_audio = sorted(audio_tracks, key=bandwidth, reverse=True)[0]
        audio_url = best_audio.get("baseUrl") or best_audio.get("base_url")
        if not audio_url:
            return None

        audio_path = self.temp_dir / "audio.m4a"
        self._download_binary(str(audio_url), audio_path)
        return audio_path if audio_path.exists() and audio_path.stat().st_size > 0 else None

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
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/126.0.0.0 Safari/537.36"
                ),
                "Referer": "https://www.bilibili.com/",
                "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            },
        }
        browser = cookies_from_browser if cookies_from_browser is not None else self.cookies_from_browser
        if browser:
            options["cookiesfrombrowser"] = (browser,)
        if self.cookies_file:
            options["cookiefile"] = str(self.cookies_file)
        return options

    def _subtitle_to_text(self, path: Path) -> str:
        suffix = path.suffix.lower()
        if suffix in {".srt", ".vtt"}:
            segments = parse_subtitle_file(path)
            return "\n".join(segment.text for segment in segments if segment.text)
        if suffix in {".json3", ".json"}:
            return self._parse_json_subtitle(path)
        raise RuntimeError(f"Unsupported subtitle format: {suffix}")

    def _parse_json_subtitle(self, path: Path) -> str:
        data = json.loads(path.read_text(encoding="utf-8-sig", errors="ignore"))
        events = data.get("events") or data.get("body") or []
        lines: list[str] = []

        for event in events:
            if not isinstance(event, dict):
                continue
            if "segs" in event:
                text = "".join(seg.get("utf8", "") for seg in event.get("segs", []))
            else:
                text = event.get("content") or event.get("text") or ""
            text = clean_subtitle_text(str(text).replace("\n", " "))
            if text:
                lines.append(text)

        return "\n".join(lines)

    def _build_metadata(self, info: dict[str, Any], url: str) -> dict[str, Any]:
        return {
            "title": info.get("title"),
            "uploader": info.get("uploader") or info.get("channel"),
            "duration": info.get("duration"),
            "duration_string": info.get("duration_string"),
            "upload_date": info.get("upload_date"),
            "timestamp": info.get("timestamp"),
            "release_timestamp": info.get("release_timestamp"),
            "webpage_url": info.get("webpage_url") or url,
            "original_url": url,
            "id": info.get("id"),
            "extractor": info.get("extractor"),
            "aid": info.get("__api_aid"),
            "bvid": info.get("__api_bvid") or info.get("id"),
            "cid": info.get("__api_cid"),
            "subtitle_keys": {
                "subtitles": sorted((info.get("subtitles") or {}).keys()),
                "automatic_captions": sorted((info.get("automatic_captions") or {}).keys()),
                "api_subtitles": [
                    str(track.get("lan") or track.get("lan_doc") or "")
                    for track in (info.get("__api_subtitles") or [])
                ],
            },
        }

    def _validate_url(self, url: str) -> None:
        value = url.strip()
        if not re.match(r"^https?://", value, re.IGNORECASE):
            raise ValueError("Invalid URL: please provide a full Bilibili video URL.")
        if "bilibili.com/video/" not in value and "b23.tv/" not in value:
            raise ValueError("Invalid Bilibili URL: expected a bilibili.com/video/BV... link.")

    def _extract_bvid(self, url: str) -> str | None:
        match = re.search(r"(BV[a-zA-Z0-9]+)", url)
        if match:
            return match.group(1)
        return None

    def _subtitle_files(self) -> set[Path]:
        return {
            path
            for path in self.temp_dir.glob("subtitle*")
            if path.suffix.lower() in SUBTITLE_EXTENSIONS
        }

    def _audio_files(self) -> set[Path]:
        return {
            path
            for path in self.temp_dir.glob("audio*")
            if path.suffix.lower() in AUDIO_EXTENSIONS
        }

    @staticmethod
    def safe_subtitle_keys(info: dict[str, Any]) -> list[str]:
        manual = sorted((info.get("subtitles") or {}).keys())
        automatic = sorted((info.get("automatic_captions") or {}).keys())
        api = [
            str(track.get("lan") or track.get("lan_doc") or "")
            for track in (info.get("__api_subtitles") or [])
        ]
        return [f"subtitles:{lang}" for lang in manual] + [
            f"automatic_captions:{lang}" for lang in automatic
        ] + [f"api_subtitles:{lang}" for lang in api if lang]

    def _choose_subtitle_lang(self, info: dict[str, Any]) -> str | None:
        manual = info.get("subtitles") or {}
        automatic = info.get("automatic_captions") or {}
        return self._choose_lang_from_tracks(manual) or self._choose_lang_from_tracks(automatic)

    def _choose_lang_from_tracks(self, tracks: dict[str, Any]) -> str | None:
        if not tracks:
            return None

        for preferred in BILIBILI_SUBTITLE_LANGS:
            if preferred in tracks:
                return preferred

        available = list(tracks.keys())
        for pattern in SUBTITLE_LANG_PATTERNS:
            pattern_lower = pattern.lower()
            for language in available:
                language_lower = language.lower()
                if language_lower == pattern_lower:
                    return language
                if language_lower.startswith(pattern_lower):
                    return language
                if pattern_lower in language_lower:
                    return language

        return None

    def _clean_previous_outputs(self) -> None:
        for pattern in ("subtitle*", "audio*"):
            for path in self.temp_dir.glob(pattern):
                if path.is_file():
                    path.unlink()
        for filename in ("metadata.json", "result.json", "transcript.txt"):
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
        if (
            "login" in lower
            or "cookie" in lower
            or "credential" in lower
            or "http error 412" in lower
            or "precondition failed" in lower
        ):
            return "NEED_LOGIN"
        if "unsupported url" in lower or "invalid" in lower:
            return "INVALID_URL"
        if "unable to download" in lower or "network" in lower or "timed out" in lower:
            return "NETWORK_FAILED"
        if isinstance(exc, DownloadError):
            return "YTDLP_FAILED"
        if "audio" in lower:
            return "AUDIO_DOWNLOAD_FAILED"
        return "UNKNOWN_ERROR"

    def _friendly_error(self, exc: Exception) -> str:
        error_code = self._classify_error(exc)
        if error_code == "COOKIES_FILE_NOT_FOUND":
            return str(exc)
        if error_code == "NEED_LOGIN":
            return "Video may require login or cookies are invalid. Try --cookies-from-browser edge, --auto-browser-cookies, or --cookies cookies.txt."
        if error_code == "NETWORK_FAILED":
            return "Network or yt-dlp download failed. Please retry or check connectivity."
        return str(exc) or exc.__class__.__name__

    def _cookie_failure_kind(self, exc: Exception) -> str:
        if isinstance(exc, CookiesFileNotFoundError):
            return "COOKIES_FILE_NOT_FOUND"
        lower = str(exc).lower()
        if "could not find" in lower and "cookies" in lower:
            return "COOKIES_PATH_NOT_FOUND"
        if "http error 412" in lower or "precondition failed" in lower:
            return "HTTP_412"
        if "cookie" in lower or "login" in lower or "credential" in lower:
            return "COOKIES_INVALID_OR_LOGIN_REQUIRED"
        if "timed out" in lower or "network" in lower or "unable to download" in lower:
            return "NETWORK_OR_DOWNLOAD_ERROR"
        return "UNKNOWN"

    def _suggestion_for_error(self, error_code: ErrorCode) -> str:
        suggestions = {
            "INVALID_URL": "请确认输入的是完整 B站视频链接，例如 https://www.bilibili.com/video/BVxxxx。",
            "NEED_LOGIN": self._cookies_login_suggestion(),
            "COOKIES_FILE_NOT_FOUND": self._cookies_login_suggestion(),
            "NO_SUBTITLE": "没有可用字幕时应继续使用已下载音频文件。",
            "AUDIO_DOWNLOAD_FAILED": "请检查网络、yt-dlp 版本和 FFmpeg；可先执行 pip install -U yt-dlp。",
            "YTDLP_FAILED": "请升级 yt-dlp 后重试；如果仍失败，优先带 cookies 运行。",
            "NETWORK_FAILED": "请检查网络连接、代理或 B站访问状态，然后重试。",
            "UNKNOWN_ERROR": "请查看 result.json 中的 error_message，并保留 debug_report.md 用于继续定位。",
        }
        return suggestions[error_code]

    def _cookies_login_suggestion(self) -> str:
        return (
            "请在浏览器确认已登录 B站，并优先尝试：\n"
            'python scripts/test_bilibili_loader.py "<url>" --cookies-from-browser edge\n\n'
            "如果仍失败，请使用 Netscape 格式 cookies.txt：\n"
            'python scripts/test_bilibili_loader.py "<url>" --cookies "secrets/bilibili_cookies.txt"'
        )

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
                '"secrets/bilibili_cookies.txt".'
            )
        self.cookies_file = path

    def _write_result(self, path: Path, result: BilibiliLoaderResult) -> None:
        self._write_json(path, asdict(result))

    def _write_json(self, path: Path, data: dict[str, Any]) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(data, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def _write_debug_report(
        self,
        path: Path,
        url: str,
        metadata: dict[str, Any],
        result: BilibiliLoaderResult,
    ) -> None:
        lines = [
            "# Bilibili Loader Debug Report",
            "",
            f"- 测试时间: {datetime.now().isoformat(timespec='seconds')}",
            f"- 测试链接: {url}",
            f"- 是否成功: {result.success}",
            f"- 使用了字幕还是音频: {result.source_type}",
            f"- 当前阶段: {result.stage}",
            f"- 视频标题: {metadata.get('title') or ''}",
            f"- UP主: {metadata.get('uploader') or ''}",
            f"- 视频时长: {metadata.get('duration') or ''}",
            f"- 字幕语言: {result.used_subtitle_lang or ''}",
            f"- 可用字幕: {', '.join(result.available_subtitles) if result.available_subtitles else '无'}",
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
