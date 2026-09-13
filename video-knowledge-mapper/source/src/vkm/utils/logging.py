from __future__ import annotations

from collections.abc import Callable
from datetime import datetime


LogCallback = Callable[[str], None]


class CallbackLogger:
    def __init__(self, callback: LogCallback | None = None) -> None:
        self._callback = callback

    def info(self, message: str) -> None:
        if self._callback:
            timestamp = datetime.now().strftime("%H:%M:%S")
            self._callback(f"[{timestamp}] {message}")
