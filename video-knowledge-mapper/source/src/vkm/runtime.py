from __future__ import annotations

import os
import sys
from pathlib import Path


def configure_packaged_environment() -> None:
    """Make bundled command-line tools visible when running from PyInstaller."""
    candidate_roots: list[Path] = []

    if getattr(sys, "frozen", False):
        candidate_roots.append(Path(sys.executable).resolve().parent)

    pyinstaller_root = getattr(sys, "_MEIPASS", None)
    if pyinstaller_root:
        candidate_roots.append(Path(pyinstaller_root))

    for root in candidate_roots:
        ffmpeg_dir = root / "tools" / "ffmpeg" / "bin"
        ffmpeg_exe = ffmpeg_dir / "ffmpeg.exe"
        if ffmpeg_exe.exists():
            os.environ["PATH"] = f"{ffmpeg_dir}{os.pathsep}{os.environ.get('PATH', '')}"
            break

    os.environ.setdefault("VKM_WHISPER_DEVICE", "cpu")
    os.environ.setdefault("VKM_WHISPER_COMPUTE_TYPE", "int8")
