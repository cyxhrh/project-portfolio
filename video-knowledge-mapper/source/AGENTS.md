# AGENTS.md

This file is the development guide for agents and maintainers working on
Video Knowledge Mapper. Read it before changing code in this project.

## Project Overview

Video Knowledge Mapper is a Windows desktop tool that turns video links or
local MP4 files into reusable learning notes.

The current v0.1 product goal is:

> Help a normal user turn a video into reviewable learning notes.

Primary user-facing flows:

1. Generate learning notes from a Bilibili link, Douyin link, or local MP4.
2. Regenerate notes from an existing result directory.
3. Generate transcript artifacts only, without running AI note generation.

The app also has existing Feishu sync support for generated Markdown notes.

## Repository Structure

The real application lives in:

```text
Video Knowledge Mapper/
```

Important paths:

```text
src/vkm/app.py                         Desktop app entrypoint
src/vkm/ui/main_window.py              PySide6 main window and UI behavior
src/vkm/ui/worker.py                   Qt workers for background tasks
src/vkm/core/pipeline.py               Main video-to-notes pipeline
src/vkm/core/deepseek.py               AI note generation client and prompt logic
src/vkm/core/deepseek_artifact_runner.py
                                       Regenerate notes from an existing result dir
src/vkm/core/pipeline_artifacts.py     Writes reusable result directories
src/vkm/core/bilibili_loader.py        Bilibili-specific source loader
src/vkm/core/douyin_loader.py          Douyin-specific source loader
src/vkm/core/transcriber.py            Audio extraction and faster-whisper usage
src/vkm/core/markdown_writer.py        Markdown output writer
src/vkm/core/mindmap.py                Mindmap JSON parsing and Mermaid generation
src/vkm/core/xmind_writer.py           XMind file writer
src/vkm/core/table_summary.py          Review-card/table summary parsing
src/vkm/core/feishu_sync.py            Existing Feishu wiki/base sync integration
src/vkm/core/config.py                 Fixed dirs, env loading, config validation
src/vkm/core/models.py                 Shared dataclasses
scripts/build_artifact_only.py         CLI: generate reusable result dir only
scripts/run_deepseek_from_artifact.py  CLI: regenerate notes from result dir
tests/                                 Pytest suite
outputs/                              Reports and sample/generated artifacts
build_windows.ps1                     PyInstaller build script
PACKAGING.md                          Windows packaging notes
README.md                             User/developer overview, may lag current UI
```

The repository root also contains older unrelated static-page and presentation
assets. Do not treat those as part of the Video Knowledge Mapper app unless the
user explicitly asks.

## Technology Stack

- Python 3.10+
- PySide6 for the Windows desktop UI
- pytest for automated tests
- yt-dlp and platform-specific loaders for video metadata/source handling
- faster-whisper for transcription
- OpenAI-compatible client usage for DeepSeek
- FFmpeg for audio extraction
- webvtt-py and srt for subtitle parsing
- lark-cli / Feishu CLI for existing Feishu sync
- PyInstaller for Windows folder builds

Declared runtime dependencies are in `pyproject.toml` and `requirements.txt`.
Build-only dependencies are in `requirements-build.txt`.

## Current Capabilities

### Generate Learning Notes

Input:

- Bilibili URL
- Douyin URL
- Local MP4

Internal flow:

```text
video link / local MP4
-> source loading
-> transcript artifact
-> AI note generation
-> Markdown / Mermaid / XMind / mindmap JSON / table summary
-> result open buttons
-> Feishu sync for generated Markdown
```

### Regenerate Notes

Input:

- Existing result directory containing:
  - `metadata.json`
  - `transcript.txt`

Internal flow:

```text
existing result directory
-> read video info and transcript
-> AI note generation
-> Markdown / Mermaid / XMind / mindmap JSON / table summary
```

This flow must not redownload video or retranscribe audio.

### Generate Transcript Result Only

Input:

- Bilibili URL
- Douyin URL
- Local MP4

Internal flow:

```text
video link / local MP4
-> source loading
-> transcription or subtitle extraction
-> outputs/<platform>_<id>/
```

This flow must not call AI note generation and must not produce Markdown,
XMind, or table summary.

### Result Opening

After successful tasks, the UI can open:

- Markdown file
- XMind file
- transcript text
- result directory

Use the operating system default opener through Qt desktop services. If a
target is missing, show a friendly user-facing error.

## Fixed Directories and Artifacts

Default fixed directories:

```text
D:\AI_Video_Input
D:\AI_Video_Notes
D:\AI_Video_Done
```

Reusable result directories are written under project `outputs/`:

```text
outputs/<platform>_<id>/
  metadata.json
  transcript.txt
  source_result.json
  debug_report.md
```

Do not rename these artifact files unless the user explicitly asks and tests
are updated. They are part of the two-stage workflow contract.

## Development Rules

### Preserve Product Boundaries

Do not add platforms, Feishu features, Notion support, cloud sync, task queues,
account systems, or large UI rewrites unless explicitly requested.

When the user asks for a small UI or behavior change, keep the change scoped to
that behavior. Prefer preserving existing pipeline contracts.

### Keep the Three Core Flows Separate

Maintain these boundaries:

- `VideoKnowledgePipeline.run`: complete analysis and note generation.
- `VideoKnowledgePipeline.build_artifact_only`: result directory only, no AI
  note generation.
- `run_deepseek_from_artifact`: note regeneration from existing result
  directory, no download and no transcription.

Tests should explicitly protect these boundaries when changed.

### UI Language

The UI is for normal users. Avoid exposing these terms in main UI text and
visible logs:

- artifact
- pipeline
- metadata
- source_result
- rerun
- transcribe-only
- table_summary_json
- faster-whisper

Preferred user-facing terms:

- result directory
- existing result directory
- video info
- transcript text
- regenerate
- generate transcript result only
- review cards
- transcription model
- AI note generation

The UI layer currently maps technical log text through `sanitize_ui_message`.
Keep this protection when adding logs.

### Error Messages

Errors shown in the desktop UI must tell the user what to do next. Prefer:

- `请先输入视频链接，或选择本地视频文件。`
- `请先选择一个已有结果目录。`
- `这个结果目录不完整，缺少转写文本，请重新生成学习笔记。`
- `这个结果目录不完整，缺少视频信息，请重新生成学习笔记。`
- `文件不存在，请重新生成。`
- `结果目录不存在，请重新生成。`
- `请先配置 DeepSeek API Key。`

Do not show API keys, cookies, raw stack traces, or full command payloads in
user-facing UI.

### Secrets and Sensitive Files

Never print, commit, or package:

- `.env`
- API keys
- cookies
- `secrets/`
- `cookies.txt`
- `bilibili_cookies.txt`
- `douyin_cookies.txt`
- `*.cookies.txt`

Do not log browser cookies or API key values. For DeepSeek keys, only report
whether configuration is missing or invalid.

### Feishu Sync

Feishu sync exists and is part of the current generated-note path. It depends
on local Feishu CLI configuration and authentication.

Rules:

- Reuse `FeishuSyncService`; do not create a second sync implementation.
- Do not add new Feishu destinations unless explicitly requested.
- Do not hard-code new tokens or IDs casually.
- If sync fails, preserve the local Markdown/XMind outputs and surface a clear
  error.

### Encoding and Chinese Text

Many existing files contain Chinese UI text. Prefer UTF-8 when reading/writing.
If terminal output displays mojibake, do not assume the app UI is broken; verify
in the actual Windows desktop app when visual correctness matters.

When editing Chinese text, preserve meaningful wording and avoid mass rewrites.

### Generated Outputs

`outputs/` contains reports, smoke-test data, and sample artifacts. Avoid
deleting or rewriting historical reports unless explicitly requested.

When asked to create a report, write it under `outputs/` with a clear filename.

## Testing Rules

Run focused tests for targeted changes, then run the full suite when feasible.

Common commands:

```powershell
python -m pytest
python -m pytest tests\test_ui_user_friendly_actions.py
python -m pytest tests\test_pipeline_artifacts.py
python -m pytest tests\test_deepseek_artifact_runner.py
python -m pytest tests\test_feishu_sync.py
```

Expected current full-suite baseline:

```text
54 passed
```

When changing UI workers, test at least:

- complete note generation still calls the full pipeline
- complete note generation emits Markdown and result directory paths
- complete note generation triggers existing Feishu sync
- regenerate notes does not download or transcribe
- transcript-only does not call AI note generation
- missing files/directories show friendly errors
- UI log sanitization hides technical terms

When changing artifact behavior, test Bilibili, Douyin, and local MP4 paths.

## Manual Verification

Use real Windows desktop verification for:

- Chinese font rendering
- file open buttons
- directory open buttons
- XMind default opener
- transcript default opener
- file dialog behavior

Known caveat: desktop automation around the native directory picker has been
unstable. Prefer user-performed manual verification for final acceptance.

## Packaging Rules

Use the existing build script:

```powershell
powershell -ExecutionPolicy Bypass -File .\build_windows.ps1 -Clean
```

Before sharing a build:

- Do not include personal API keys.
- Do not include cookies.
- Do not include personal videos or notes.
- Do not include `.venv`, `tests`, or temporary files.
- Confirm FFmpeg availability, either system-installed or bundled at
  `tools\ffmpeg\bin\ffmpeg.exe`.

## Do Not Do Without Explicit Request

- Do not rewrite the whole UI.
- Do not change the DeepSeek prompt casually.
- Do not change Bilibili or Douyin cookie strategy.
- Do not remove CLI entrypoints.
- Do not delete `build_artifact_only.py`.
- Do not delete `run_deepseek_from_artifact.py`.
- Do not rename artifact files.
- Do not add Notion.
- Do not add new platforms.
- Do not print API keys or cookies.
- Do not run destructive git commands.

## Preferred Change Workflow

1. Read the relevant module and nearby tests.
2. Identify which of the three core flows is affected.
3. Make the smallest code change that preserves existing contracts.
4. Add or update focused tests.
5. Run focused tests.
6. Run `python -m pytest` when feasible.
7. If UI behavior changed, add or update a short report under `outputs/` only
   when the user asks for one.

