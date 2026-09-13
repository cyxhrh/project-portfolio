from __future__ import annotations

import sys
from pathlib import Path

from PySide6.QtGui import QIcon
from PySide6.QtWidgets import QApplication

from vkm.runtime import configure_packaged_environment
from vkm.ui.main_window import MainWindow


def main() -> int:
    configure_packaged_environment()
    app = QApplication(sys.argv)
    app.setApplicationName("Video Knowledge Mapper")
    icon_path = Path(__file__).resolve().parent / "assets" / "vkm_icon.ico"
    if icon_path.exists():
        app.setWindowIcon(QIcon(str(icon_path)))
    window = MainWindow()
    if icon_path.exists():
        window.setWindowIcon(QIcon(str(icon_path)))
    window.resize(1080, 820)
    window.show()
    return app.exec()


if __name__ == "__main__":
    raise SystemExit(main())
