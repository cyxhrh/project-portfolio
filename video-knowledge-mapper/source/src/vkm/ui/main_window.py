from __future__ import annotations

from pathlib import Path

from PySide6.QtCore import Qt, QThread, QUrl
from PySide6.QtGui import QDesktopServices
from PySide6.QtWidgets import (
    QFileDialog,
    QFrame,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QMainWindow,
    QMessageBox,
    QPushButton,
    QSizePolicy,
    QTextEdit,
    QToolButton,
    QVBoxLayout,
    QWidget,
)

from vkm.core.config import AI_VIDEO_NOTES_DIR, AppError, ensure_fixed_directories
from vkm.core.models import PipelineRequest
from vkm.ui.worker import ArtifactNoteWorker, ArtifactOnlyWorker, PipelineWorker


UI_LOG_REPLACEMENTS = {
    "Artifact 目录": "结果目录",
    "artifact": "结果",
    "Artifact": "结果",
    "transcript.txt": "转写文本",
    "metadata.json": "视频信息",
    "table_summary_json": "复习卡片",
    "mindmap JSON": "思维导图数据",
    "mindmap_json": "思维导图数据",
    "faster-whisper": "转写模型",
    "DeepSeek": "AI 笔记生成",
}


def sanitize_ui_message(message: str) -> str:
    sanitized = message
    for old, new in UI_LOG_REPLACEMENTS.items():
        sanitized = sanitized.replace(old, new)
    return sanitized


def user_stage_from_message(message: str) -> str | None:
    text = sanitize_ui_message(message)
    if "读取已有结果" in text:
        return "读取已有结果"
    if "完成" in text or "已生成" in text or "已重新生成" in text:
        return "完成"
    if any(token in text for token in ("生成标准 Markdown", "写入 Markdown", "复习卡片", "学习地图", "XMind", "AI 笔记生成")):
        return "生成学习笔记"
    if any(token in text for token in ("转写", "字幕", "音频", "转写模型")):
        return "生成转写结果"
    if any(token in text for token in ("读取", "获取", "下载", "视频信息", "视频内容")):
        return "获取视频内容"
    return None


def validate_video_input(url: str, local_file: Path | None) -> None:
    if not url.strip() and local_file is None:
        raise AppError("请先输入视频链接，或选择本地视频文件。")
    if local_file is not None and not local_file.is_file():
        raise AppError("本地视频文件不存在，请重新选择。")


def validate_existing_result_dir(path: Path | None) -> None:
    if path is None:
        raise AppError("请先选择一个已有结果目录。")
    if not (path / "transcript.txt").is_file():
        raise AppError("这个结果目录不完整，缺少转写文本，请重新生成学习笔记。")
    if not (path / "metadata.json").is_file():
        raise AppError("这个结果目录不完整，缺少视频信息，请重新生成学习笔记。")


def validate_file_target(path: Path | None) -> Path:
    if path is None or not path.is_file():
        raise AppError("文件不存在，请重新生成。")
    return path


def validate_directory_target(path: Path | None) -> Path:
    if path is None or not path.is_dir():
        raise AppError("结果目录不存在，请重新生成。")
    return path


class MainWindow(QMainWindow):
    def __init__(self) -> None:
        super().__init__()
        ensure_fixed_directories()
        self.setWindowTitle("Video Knowledge Mapper")
        self.thread: QThread | None = None
        self.worker: ArtifactNoteWorker | ArtifactOnlyWorker | PipelineWorker | None = None
        self.local_file: Path | None = None
        self.result_dir: Path | None = None

        self.api_key_input = QLineEdit()
        self.api_key_input.setPlaceholderText("粘贴 DeepSeek API Key")
        self.api_key_input.setEchoMode(QLineEdit.Password)
        self.api_key_input.setMinimumHeight(42)

        self.url_input = QLineEdit()
        self.url_input.setPlaceholderText("请输入视频链接，或选择本地视频文件")
        self.url_input.setMinimumHeight(42)
        self.url_input.returnPressed.connect(self.start_generate_notes)

        self.local_file_input = self.create_readonly_path_input("未选择本地视频")
        self.result_dir_input = self.create_readonly_path_input("未选择已有结果目录")

        self.select_file_button = QPushButton("选择本地 MP4")
        self.select_file_button.clicked.connect(self.choose_local_file)

        self.generate_button = QPushButton("生成学习笔记")
        self.generate_button.setObjectName("primaryButton")
        self.generate_button.setMinimumHeight(50)
        self.generate_button.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Fixed)
        self.generate_button.clicked.connect(self.start_generate_notes)

        self.select_result_dir_button = QPushButton("选择已有结果目录")
        self.select_result_dir_button.clicked.connect(self.choose_result_dir)

        self.regenerate_button = QPushButton("重新生成笔记")
        self.regenerate_button.setObjectName("secondaryButton")
        self.regenerate_button.clicked.connect(self.start_regenerate_notes)

        self.advanced_toggle = QToolButton()
        self.advanced_toggle.setText("高级选项")
        self.advanced_toggle.setCheckable(True)
        self.advanced_toggle.setArrowType(Qt.RightArrow)
        self.advanced_toggle.clicked.connect(self.toggle_advanced_tools)

        self.transcript_only_button = QPushButton("仅生成转写结果")
        self.transcript_only_button.clicked.connect(self.start_artifact_only)

        self.status_label = QLabel("等待开始")
        self.status_label.setObjectName("statusBadge")
        self.log_box = QTextEdit()
        self.log_box.setReadOnly(True)
        self.log_box.setPlaceholderText("当前阶段、成功或失败信息、输出路径会显示在这里")

        self.advanced_card: QWidget | None = None
        self.latest_markdown_path: Path | None = None
        self.latest_xmind_path: Path | None = None
        self.latest_transcript_path: Path | None = None
        self.latest_result_dir: Path | None = None

        self.open_markdown_button = QPushButton("打开 Markdown")
        self.open_markdown_button.clicked.connect(self.open_latest_markdown)
        self.open_result_dir_button = QPushButton("打开结果目录")
        self.open_result_dir_button.clicked.connect(self.open_latest_result_dir)
        self.open_xmind_button = QPushButton("打开 XMind")
        self.open_xmind_button.clicked.connect(self.open_latest_xmind)
        self.open_transcript_button = QPushButton("打开转写文本")
        self.open_transcript_button.clicked.connect(self.open_latest_transcript)
        self.result_actions_card: QWidget | None = None

        self._build_layout()
        self._apply_styles()

    def create_readonly_path_input(self, text: str) -> QLineEdit:
        line_edit = QLineEdit(text)
        line_edit.setReadOnly(True)
        line_edit.setObjectName("pathInput")
        return line_edit

    def _build_layout(self) -> None:
        root = QWidget()
        root.setObjectName("root")
        main_layout = QVBoxLayout(root)
        main_layout.setContentsMargins(24, 22, 24, 24)
        main_layout.setSpacing(16)

        main_layout.addWidget(self._build_header())
        main_layout.addWidget(self._build_generate_card())
        main_layout.addWidget(self._build_regenerate_card())
        main_layout.addWidget(self._build_advanced_section())
        main_layout.addWidget(self._build_log_card(), 1)

        self.setCentralWidget(root)

    def _build_header(self) -> QWidget:
        header = QFrame()
        header.setObjectName("hero")
        layout = QHBoxLayout(header)
        layout.setContentsMargins(22, 20, 22, 20)
        layout.setSpacing(16)

        title_block = QVBoxLayout()
        title_block.setSpacing(5)
        title = QLabel("Video Knowledge Mapper")
        title.setObjectName("heroTitle")
        subtitle = QLabel("把视频变成可复习的学习笔记")
        subtitle.setObjectName("heroSubtitle")
        subtitle.setWordWrap(True)
        title_block.addWidget(title)
        title_block.addWidget(subtitle)

        layout.addLayout(title_block, 1)
        layout.addWidget(self.status_label, 0)
        return header

    def _build_generate_card(self) -> QWidget:
        card = self.create_card(
            "生成学习笔记",
            "支持 B站、抖音链接和本地 MP4。生成结果包括 Markdown 笔记、思维导图和复习卡片。",
        )

        api_header = QHBoxLayout()
        api_label = QLabel("DeepSeek API Key")
        api_label.setObjectName("fieldLabel")
        api_hint = QLabel("本次运行使用，不保存")
        api_hint.setObjectName("hintPill")
        api_header.addWidget(api_label)
        api_header.addStretch(1)
        api_header.addWidget(api_hint)

        link_label = QLabel("视频链接")
        link_label.setObjectName("fieldLabel")

        local_row = QHBoxLayout()
        local_row.setSpacing(10)
        local_row.addWidget(self.local_file_input, 1)
        local_row.addWidget(self.select_file_button, 0)

        card.layout().addLayout(api_header)
        card.layout().addWidget(self.api_key_input)
        card.layout().addWidget(link_label)
        card.layout().addWidget(self.url_input)
        card.layout().addLayout(local_row)
        card.layout().addWidget(self.generate_button)
        return card

    def _build_regenerate_card(self) -> QWidget:
        card = self.create_card(
            "重新生成笔记",
            "如果你已经处理过视频，可以直接用已有文字重新生成笔记，不需要重新下载视频或重新转写。",
        )

        row = QHBoxLayout()
        row.setSpacing(10)
        row.addWidget(self.result_dir_input, 1)
        row.addWidget(self.select_result_dir_button, 0)
        row.addWidget(self.regenerate_button, 0)
        card.layout().addLayout(row)

        hint = QLabel("适合修改转写文字或想换一种笔记版本时使用。")
        hint.setObjectName("hintText")
        card.layout().addWidget(hint)
        return card

    def _build_advanced_section(self) -> QWidget:
        wrapper = QFrame()
        wrapper.setObjectName("advancedWrapper")
        layout = QVBoxLayout(wrapper)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(8)
        layout.addWidget(self.advanced_toggle, 0, Qt.AlignLeft)

        self.advanced_card = self.create_card(
            "仅生成转写结果",
            "只把视频转成可复用文字，不调用 DeepSeek。适合先检查转写质量、处理长视频，或稍后再生成笔记。",
        )
        self.advanced_card.layout().addWidget(self.transcript_only_button)
        self.advanced_card.hide()
        layout.addWidget(self.advanced_card)
        return wrapper

    def _build_log_card(self) -> QWidget:
        card = self.create_card("日志", "显示当前阶段、成功或失败，以及输出路径。")
        self.result_actions_card = self._build_result_actions()
        self.result_actions_card.hide()
        card.layout().addWidget(self.result_actions_card)
        self.log_box.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)
        card.layout().addWidget(self.log_box, 1)
        return card

    def _build_result_actions(self) -> QWidget:
        wrapper = QFrame()
        wrapper.setObjectName("resultActions")
        layout = QHBoxLayout(wrapper)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(10)
        layout.addWidget(self.open_markdown_button)
        layout.addWidget(self.open_transcript_button)
        layout.addWidget(self.open_xmind_button)
        layout.addWidget(self.open_result_dir_button)
        layout.addStretch(1)
        return wrapper

    def create_card(self, title: str, subtitle: str) -> QFrame:
        card = QFrame()
        card.setObjectName("card")
        layout = QVBoxLayout(card)
        layout.setContentsMargins(18, 16, 18, 18)
        layout.setSpacing(10)

        title_label = QLabel(title)
        title_label.setObjectName("cardTitle")
        subtitle_label = QLabel(subtitle)
        subtitle_label.setObjectName("cardSubtitle")
        subtitle_label.setWordWrap(True)

        layout.addWidget(title_label)
        layout.addWidget(subtitle_label)
        return card

    def _apply_styles(self) -> None:
        self.setStyleSheet(
            """
            #root {
                background: #f4f7fb;
                color: #172033;
                font-size: 14px;
            }
            #hero {
                background: #182235;
                border-radius: 12px;
            }
            #heroTitle {
                color: #ffffff;
                font-size: 26px;
                font-weight: 700;
            }
            #heroSubtitle {
                color: #d8e3f0;
                font-size: 14px;
            }
            #statusBadge {
                background: #eef6ff;
                color: #1d5f9f;
                border: 1px solid #c8def7;
                border-radius: 14px;
                padding: 6px 14px;
                font-weight: 600;
            }
            #card {
                background: #ffffff;
                border: 1px solid #dde5ef;
                border-radius: 8px;
            }
            #cardTitle {
                color: #172033;
                font-size: 17px;
                font-weight: 700;
            }
            #cardSubtitle, #hintText {
                color: #667389;
                font-size: 12px;
            }
            #hintPill {
                background: #f1f5f9;
                color: #64748b;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                padding: 3px 9px;
                font-size: 12px;
            }
            #fieldLabel {
                color: #2d394d;
                font-weight: 600;
            }
            QLineEdit {
                min-height: 38px;
                border: 1px solid #cfd9e6;
                border-radius: 8px;
                padding: 3px 11px;
                background: #ffffff;
                selection-background-color: #2f80ed;
            }
            QLineEdit:focus {
                border: 1px solid #2f80ed;
                background: #fbfdff;
            }
            #pathInput {
                background: #f8fafc;
                color: #445067;
            }
            QPushButton, QToolButton {
                min-height: 40px;
                border-radius: 8px;
                border: 1px solid #cfd9e6;
                padding: 5px 14px;
                background: #ffffff;
                color: #243044;
                font-weight: 600;
            }
            QPushButton:hover, QToolButton:hover {
                background: #f1f6ff;
                border-color: #9fc3f3;
            }
            QPushButton:disabled {
                color: #9aa6b8;
                background: #eef2f6;
                border-color: #d8e0ea;
            }
            #primaryButton {
                background: #2563eb;
                border-color: #2563eb;
                color: #ffffff;
                min-height: 50px;
                font-size: 15px;
            }
            #primaryButton:hover {
                background: #1d4ed8;
                border-color: #1d4ed8;
            }
            #secondaryButton {
                background: #f8fafc;
                border-color: #cbd5e1;
                color: #334155;
                min-width: 118px;
            }
            #resultActions QPushButton {
                background: #eef6ff;
                border-color: #bfdbfe;
                color: #1d4ed8;
            }
            QTextEdit {
                border: 1px solid #dbe3ee;
                border-radius: 8px;
                background: #0f172a;
                color: #d8e3f0;
                padding: 10px;
                font-family: "Consolas";
                font-size: 12px;
            }
            """
        )

    def choose_local_file(self) -> None:
        path, _ = QFileDialog.getOpenFileName(
            self,
            "选择本地视频文件",
            "",
            "MP4 视频 (*.mp4)",
        )
        if not path:
            return
        self.local_file = Path(path)
        self.local_file_input.setText(str(self.local_file))

    def choose_result_dir(self) -> None:
        path = QFileDialog.getExistingDirectory(self, "选择已有结果目录")
        if not path:
            return
        self.result_dir = Path(path)
        self.result_dir_input.setText(str(self.result_dir))

    def toggle_advanced_tools(self) -> None:
        expanded = self.advanced_toggle.isChecked()
        self.advanced_toggle.setArrowType(Qt.DownArrow if expanded else Qt.RightArrow)
        if self.advanced_card:
            self.advanced_card.setVisible(expanded)

    def start_generate_notes(self) -> None:
        url = self.url_input.text().strip()
        try:
            validate_video_input(url, self.local_file)
        except AppError as exc:
            self.show_friendly_error(str(exc))
            return

        self.start_worker(
            PipelineWorker(
                PipelineRequest(
                    url=url or None,
                    local_file=None if url else self.local_file,
                    output_dir=AI_VIDEO_NOTES_DIR,
                    api_key=self.api_key_input.text().strip() or None,
                )
            )
        )

    def start_regenerate_notes(self) -> None:
        try:
            validate_existing_result_dir(self.result_dir)
        except AppError as exc:
            self.show_friendly_error(str(exc))
            return

        assert self.result_dir is not None
        self.start_worker(
            ArtifactNoteWorker(
                self.result_dir,
                api_key=self.api_key_input.text().strip() or None,
                output_dir=AI_VIDEO_NOTES_DIR,
            )
        )

    def start_artifact_only(self) -> None:
        url = self.url_input.text().strip()
        try:
            validate_video_input(url, self.local_file)
        except AppError as exc:
            self.show_friendly_error(str(exc))
            return

        self.start_worker(
            ArtifactOnlyWorker(
                PipelineRequest(
                    url=url or None,
                    local_file=None if url else self.local_file,
                    output_dir=AI_VIDEO_NOTES_DIR,
                )
            )
        )

    def start_worker(
        self, worker: ArtifactNoteWorker | ArtifactOnlyWorker | PipelineWorker
    ) -> None:
        self.log_box.clear()
        self.clear_result_actions()
        self.append_log("任务开始。")
        self.set_busy(True)

        self.thread = QThread(self)
        self.worker = worker
        self.worker.moveToThread(self.thread)
        self.thread.started.connect(self.worker.run)
        self.worker.log.connect(self.append_log)
        self.worker.status.connect(self.set_status)
        if hasattr(self.worker, "result_ready"):
            self.worker.result_ready.connect(self.set_result_actions)
        self.worker.finished.connect(self.on_finished)
        self.worker.failed.connect(self.on_failed)
        self.worker.finished.connect(self.thread.quit)
        self.worker.failed.connect(self.thread.quit)
        self.thread.finished.connect(self.worker.deleteLater)
        self.thread.finished.connect(self.thread.deleteLater)
        self.thread.finished.connect(self.cleanup_thread)
        self.thread.start()

    def set_busy(self, busy: bool) -> None:
        controls = [
            self.generate_button,
            self.regenerate_button,
            self.transcript_only_button,
            self.select_file_button,
            self.select_result_dir_button,
            self.api_key_input,
            self.url_input,
        ]
        for control in controls:
            control.setEnabled(not busy)
        if busy:
            self.set_status("正在处理")

    def append_log(self, message: str) -> None:
        sanitized = sanitize_ui_message(message)
        stage = user_stage_from_message(sanitized)
        if stage:
            self.status_label.setText(stage)
        self.log_box.append(sanitized)

    def set_status(self, message: str) -> None:
        self.status_label.setText(user_stage_from_message(message) or sanitize_ui_message(message))

    def on_finished(self, message: str) -> None:
        self.set_busy(False)
        self.set_status("完成")
        if message:
            self.append_log(message)
        QMessageBox.information(self, "完成", message or "任务已经完成。")

    def on_failed(self, message: str) -> None:
        self.set_busy(False)
        self.set_status("失败")
        self.append_log(f"失败：{message}")
        QMessageBox.critical(self, "处理失败", message)

    def show_friendly_error(self, message: str) -> None:
        self.set_status("需要补充信息")
        self.append_log(message)
        QMessageBox.warning(self, "提示", message)

    def cleanup_thread(self) -> None:
        self.thread = None
        self.worker = None

    def clear_result_actions(self) -> None:
        self.latest_markdown_path = None
        self.latest_xmind_path = None
        self.latest_transcript_path = None
        self.latest_result_dir = None
        if self.result_actions_card:
            self.result_actions_card.hide()

    def set_result_actions(self, payload: object) -> None:
        if not isinstance(payload, dict):
            return
        self.latest_markdown_path = payload.get("markdown_path")
        self.latest_xmind_path = payload.get("xmind_path")
        self.latest_transcript_path = payload.get("transcript_path")
        self.latest_result_dir = payload.get("result_dir")

        self.open_markdown_button.setVisible(self.latest_markdown_path is not None)
        self.open_xmind_button.setVisible(self.latest_xmind_path is not None)
        self.open_transcript_button.setVisible(self.latest_transcript_path is not None)
        self.open_result_dir_button.setVisible(self.latest_result_dir is not None)
        if self.result_actions_card:
            self.result_actions_card.show()

    def open_latest_markdown(self) -> None:
        self.open_file_target(self.latest_markdown_path)

    def open_latest_xmind(self) -> None:
        self.open_file_target(self.latest_xmind_path)

    def open_latest_transcript(self) -> None:
        self.open_file_target(self.latest_transcript_path)

    def open_latest_result_dir(self) -> None:
        self.open_directory_target(self.latest_result_dir)

    def open_file_target(self, path: Path | None) -> None:
        try:
            target = validate_file_target(path)
        except AppError as exc:
            self.show_friendly_error(str(exc))
            return
        QDesktopServices.openUrl(QUrl.fromLocalFile(str(target)))

    def open_directory_target(self, path: Path | None) -> None:
        try:
            target = validate_directory_target(path)
        except AppError as exc:
            self.show_friendly_error(str(exc))
            return
        QDesktopServices.openUrl(QUrl.fromLocalFile(str(target)))
