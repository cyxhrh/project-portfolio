# Video Knowledge Mapper

Video Knowledge Mapper 是一个 Windows 桌面工具，用来把本地 MP4 视频分析成标准 Markdown 学习笔记，并同步到飞书：创建 ai 知识库文档，同时写入多维表格「AI成长系统」。

## 当前流程

```text
D:\AI_Video_Input 里的 MP4 视频
→ 提取音频
→ faster-whisper 转写
→ DeepSeek 分析
→ 生成 Markdown、table_summary_json、mindmap_json、XMind 到 D:\AI_Video_Notes
→ 原视频移动到 D:\AI_Video_Done
→ 读取最新 Markdown
→ 直接在 Wiki 空间 ai 中创建文档
→ 调用 lark-cli 写入「AI成长系统」多维表格
```

当前同步目标包括飞书文档和多维表格。table_summary_json 或 XMind 学习地图生成失败时，只记录错误，不影响 Markdown、飞书文档和多维表格同步。

## 固定目录

```text
D:\AI_Video_Input   待分析视频
D:\AI_Video_Notes   生成的 Markdown 笔记、mindmap_json 和 XMind
D:\AI_Video_Done    已处理视频
```

## Markdown 标准结构

每篇笔记固定包含：

- 视频标题
- 基本信息
- 3分钟摘要
- 核心知识点
- 时间轴大纲
- 行动清单
- 金句提取
- Mermaid 思维导图
- 复习卡片

## 思维导图输出

思维导图定位为快速复习用的“学习地图”，不是完整笔记的复制版。

- AI 先输出稳定的 `mindmap_json`
- 程序校验结构后自动生成 `.xmind`
- Markdown 中的 Mermaid 思维导图由程序根据同一份结构生成
- 同一个视频的 `.md`、`.mindmap.json`、`.xmind` 会放在同一个结果目录
- 结构限制为 1 个中心主题、3 到 5 个一级分支、每个一级分支最多 4 个二级节点、最多 3 层
- 后续可以在 `xmind_writer.py` 中扩展 PNG 导出

## 多维表格索引输出

多维表格「AI成长系统」只作为知识索引，不保存完整摘要、完整知识点或完整行动清单。

- AI 会额外生成 `.table_summary.json`
- Base 每行只写短字段，目标是 3 到 10 秒内读完
- 完整内容仍以 Markdown、飞书文档和 XMind 为准

`table_summary_json` 结构：

```json
{
  "title": "简短标题",
  "category": "AI工具",
  "key_takeaway": "一句话核心收获",
  "action_item": "一句话行动项",
  "difficulty": 3,
  "knowledge_value": 4,
  "practice_status": "未实操"
}
```

## 依赖

- Python 3.10+
- FFmpeg
- DeepSeek API Key
- lark-cli

飞书 CLI 默认会从系统 PATH 自动查找 `lark-cli`。如果你的安装目录没有加入 PATH，可用环境变量指定完整路径：

```powershell
$env:FEISHU_CLI_COMMAND="D:\path\to\lark-cli.exe"
```

## 安装依赖

```powershell
cd "C:\Users\USER\Documents\视频拆解\Video Knowledge Mapper"
python -m pip install -r requirements.txt
```

## 使用方式

1. 把 `.mp4` 视频放到 `D:\AI_Video_Input`
2. 打开 Video Knowledge Mapper
3. 在界面里粘贴 DeepSeek API Key
4. 点击「分析输入目录 MP4」
5. 生成的 Markdown、table_summary_json、mindmap_json 和 XMind 会出现在 `D:\AI_Video_Notes`
6. 原视频会移动到 `D:\AI_Video_Done`
7. 点击「同步到飞书」

同步成功后，软件会把记录追加到：

```text
D:\AI_Video_Notes\sync_history.jsonl
```

记录内容包括 Markdown 路径、标题、知识库文档链接、Base token、表 ID、记录 ID 和同步时间。

## 二阶段运行模式

项目现在支持把视频处理拆成两个阶段，方便复查、复跑和排错。

### 什么是 artifact

artifact 是每个视频的统一中间工件目录，位于 `outputs/` 下：

```text
outputs/<platform>_<id>/
├─ metadata.json
├─ transcript.txt
├─ source_result.json
└─ debug_report.md
```

- `metadata.json`：标题、作者、时长、平台、视频 ID、来源链接等。
- `transcript.txt`：最终进入 DeepSeek 的文本，带时间戳。
- `source_result.json`：本次来源处理结果，例如字幕或音频兜底状态。
- `debug_report.md`：处理过程摘要和失败提示。

### 入口 1：一键完整分析

用于平时直接从视频生成笔记：

```text
视频链接 / 本地 MP4
→ artifact
→ DeepSeek
→ Markdown / Mermaid / XMind / mindmap JSON / table summary
```

桌面 UI 的「开始分析」仍然走这个完整流程。

### 入口 2：只获取内容

用于先确认视频能否解析、转写质量是否可用，暂时不调用 DeepSeek。

B站或抖音链接：

```powershell
python scripts/build_artifact_only.py --url "https://www.bilibili.com/video/BVxxxx"
python scripts/build_artifact_only.py --url "https://www.douyin.com/video/123456"
```

本地 MP4：

```powershell
python scripts/build_artifact_only.py --local "C:\path\to\video.mp4"
```

这个入口只生成 artifact，不生成 Markdown、XMind 或 table summary。

### 入口 3：只重跑笔记

用于已经有 artifact 时，跳过下载和转写，只重新调用 DeepSeek。

```powershell
python scripts/run_deepseek_from_artifact.py "outputs/bilibili_BV1AcRdBaEa8"
python scripts/run_deepseek_from_artifact.py "outputs/douyin_7380678787580562707"
python scripts/run_deepseek_from_artifact.py "outputs/local_douyin_fallback_video_2dcad769"
```

可以指定输出目录：

```powershell
python scripts/run_deepseek_from_artifact.py "outputs/bilibili_BV1AcRdBaEa8" --output-dir "outputs/deepseek_rerun_notes"
```

### 什么时候用哪一种

- 想一次完成分析：用桌面 UI 或主 pipeline 的一键完整分析。
- 想先确认视频能不能解析、转写是否干净：用“只获取内容”。
- 修改了 prompt、修订了 transcript、或想重新生成笔记：用“只重跑笔记”。

### 敏感文件提醒

不要把下面文件提交到 Git：

- `.env`
- `secrets/`
- `cookies.txt`
- `bilibili_cookies.txt`
- `douyin_cookies.txt`
- `*.cookies.txt`

## 飞书同步说明

同步功能会读取 `D:\AI_Video_Notes` 中最新的 `.md` 文件：

- 先在 Wiki 空间 `ai` 中创建一篇文档
- 把完整 Markdown 写入该文档
- `.table_summary.json` 中的 `title` 写入「标题」
- `category` 写入「分类」
- `key_takeaway` 写入「核心收获」
- `action_item` 写入「行动项」
- `difficulty` 写入「难度」
- `knowledge_value` 写入「知识价值」
- `practice_status` 写入「实操状态」
- Wiki 文档链接写入「文档链接」
- 「学习日期」写入当天日期
- 如果 `.table_summary.json` 缺失或损坏，会使用短默认值降级写入，不影响飞书文档创建
- 使用命令：

Wiki 空间 ID：

```text
REPLACE_WITH_YOUR_VALUE
```

多维表格写入命令：

```powershell
lark-cli base +record-upsert --base-token REPLACE_WITH_YOUR_VALUE --table-id REPLACE_WITH_YOUR_VALUE --as user --json @record.json
```

如果飞书同步失败，请先确认：

```powershell
lark-cli auth status
```

必要时重新登录：

```powershell
lark-cli auth login --recommend
```

## 常见问题

### cublas64_12.dll is not found

软件默认使用 CPU 转写。若你手动设置过 GPU，请改回：

```powershell
$env:VKM_WHISPER_DEVICE="cpu"
$env:VKM_WHISPER_COMPUTE_TYPE="int8"
```

### 没找到 MP4

请确认视频文件后缀是 `.mp4`，并且已经放在：

```text
D:\AI_Video_Input
```

## 运行测试

```powershell
pytest
```
