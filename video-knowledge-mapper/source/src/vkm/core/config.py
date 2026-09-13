from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


class AppError(RuntimeError):
    """Base error shown to users in the desktop app."""


class ConfigurationError(AppError):
    """Raised when required user configuration is missing."""


class DependencyError(AppError):
    """Raised when an external dependency such as FFmpeg is missing."""


PROJECT_ROOT = Path(__file__).resolve().parents[3]
AI_VIDEO_INPUT_DIR = Path(r"D:\AI_Video_Input")
AI_VIDEO_NOTES_DIR = Path(r"D:\AI_Video_Notes")
AI_VIDEO_DONE_DIR = Path(r"D:\AI_Video_Done")
# Prefer the command discovered from PATH. Users can still override it with
# FEISHU_CLI_COMMAND when their installation is not on PATH.
DEFAULT_FEISHU_CLI = Path("lark-cli")


@dataclass(frozen=True)
class AppConfig:
    deepseek_api_key: str
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-v4-flash"
    whisper_model: str = "small"
    whisper_device: str = "cpu"
    whisper_compute_type: str = "int8"
    input_dir: Path = AI_VIDEO_INPUT_DIR
    notes_dir: Path = AI_VIDEO_NOTES_DIR
    done_dir: Path = AI_VIDEO_DONE_DIR
    feishu_cli_command: str = str(DEFAULT_FEISHU_CLI)
    feishu_cli_args_template: str | None = None

    @classmethod
    def from_env(
        cls, api_key_override: str | None = None, *, require_deepseek: bool = True
    ) -> "AppConfig":
        load_env_file()
        api_key = (
            check_deepseek_config(api_key_override)
            if require_deepseek
            else (api_key_override or os.environ.get("DEEPSEEK_API_KEY", "")).strip()
        )

        return cls(
            deepseek_api_key=api_key,
            deepseek_base_url=os.environ.get(
                "DEEPSEEK_BASE_URL", "https://api.deepseek.com"
            ).strip(),
            deepseek_model=os.environ.get(
                "DEEPSEEK_MODEL", "deepseek-v4-flash"
            ).strip(),
            whisper_model=os.environ.get("VKM_WHISPER_MODEL", "small").strip(),
            whisper_device=os.environ.get("VKM_WHISPER_DEVICE", "cpu").strip(),
            whisper_compute_type=os.environ.get(
                "VKM_WHISPER_COMPUTE_TYPE", "int8"
            ).strip(),
            input_dir=Path(os.environ.get("VKM_INPUT_DIR", str(AI_VIDEO_INPUT_DIR))),
            notes_dir=Path(os.environ.get("VKM_NOTES_DIR", str(AI_VIDEO_NOTES_DIR))),
            done_dir=Path(os.environ.get("VKM_DONE_DIR", str(AI_VIDEO_DONE_DIR))),
            feishu_cli_command=os.environ.get(
                "FEISHU_CLI_COMMAND", str(DEFAULT_FEISHU_CLI)
            ).strip(),
            feishu_cli_args_template=os.environ.get("FEISHU_CLI_ARGS_TEMPLATE"),
        )


def ensure_fixed_directories() -> None:
    AI_VIDEO_INPUT_DIR.mkdir(parents=True, exist_ok=True)
    AI_VIDEO_NOTES_DIR.mkdir(parents=True, exist_ok=True)
    AI_VIDEO_DONE_DIR.mkdir(parents=True, exist_ok=True)


def load_env_file(path: Path | None = None) -> None:
    env_path = path or PROJECT_ROOT / ".env"
    if not env_path.is_file():
        return
    for raw_line in env_path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def check_deepseek_config(api_key_override: str | None = None) -> str:
    api_key = (api_key_override or os.environ.get("DEEPSEEK_API_KEY", "")).strip()
    if not api_key or is_placeholder_deepseek_key(api_key):
        raise ConfigurationError(
            "DEEPSEEK_API_KEY missing or invalid. "
            "Please set a real DeepSeek API key in .env or environment variables."
        )
    return api_key


def is_placeholder_deepseek_key(value: str) -> bool:
    normalized = value.strip().lower()
    if not normalized:
        return True
    placeholder_tokens = (
        "dummy",
        "test",
        "placeholder",
        "your_deepseek_api_key_here",
        "your-api-key",
        "api_key",
        "example",
        "fake",
    )
    return any(token in normalized for token in placeholder_tokens)
