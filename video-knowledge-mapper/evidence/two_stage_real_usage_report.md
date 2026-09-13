> 历史项目记录的脱敏副本；保留原报告结果，不代表 2026-09-13 重新执行。

# 命令行二阶段真实使用验证报告

生成时间：2026-06-24

## 1. B站只获取内容结果

命令：

```powershell
python scripts/build_artifact_only.py --url "https://www.bilibili.com/video/BV1AcRdBaEa8/"
```

结果：成功。

生成 artifact 目录：

```text
C:\Users\USER\Documents\视频拆解\Video Knowledge Mapper\outputs\bilibili_BV1AcRdBaEa8
```

文件检查：

- `metadata.json`：存在，901 bytes
- `transcript.txt`：存在，3806 bytes
- `source_result.json`：存在，1472 bytes
- `debug_report.md`：存在，1302 bytes

metadata 核心字段：

```json
{
  "title": "如何把清晰的脑子养回来（二）",
  "uploader": "心理能量1101",
  "duration": 207,
  "platform": "bilibili",
  "video_id": "BV1AcRdBaEa8",
  "webpage_url": "https://www.bilibili.com/video/BV1AcRdBaEa8/",
  "transcript_source": "whisper"
}
```

transcript.txt 前 5 行：

```text
[00:00] 如何把親戚的腦子養回來?
[00:32] 這決定了你一整天的狀態
[00:34] 經過一夜的呼吸和出汗
[00:36] 你的身體已經拖水了
[00:38] 大腦百分之七十五世水
```

## 2. 抖音只获取内容结果

命令：

```powershell
python scripts/build_artifact_only.py --url "https://www.douyin.com/video/7380678787580562707"
```

结果：成功。

生成 artifact 目录：

```text
C:\Users\USER\Documents\视频拆解\Video Knowledge Mapper\outputs\douyin_7380678787580562707
```

文件检查：

- `metadata.json`：存在，965 bytes
- `transcript.txt`：存在，2398 bytes
- `source_result.json`：存在，1456 bytes
- `debug_report.md`：存在，1421 bytes

metadata 核心字段：

```json
{
  "title": "如何把抖音的视频保存在手机相册里面？很简单，看完你就学会了！ #抖音视频 #保存抖音视频 #手机技巧 #内存不足 #手机技巧分享 #视频去水印 #视频教学 #抖音",
  "uploader": "手机知识大鼻子",
  "duration": 163.134,
  "platform": "douyin",
  "video_id": "7380678787580562707",
  "webpage_url": "https://www.douyin.com/video/7380678787580562707",
  "transcript_source": "whisper"
}
```

transcript.txt 前 5 行：

```text
[00:00] 在抖音刷到積極喜歡的視頻
[00:03] 怎麼保存到積極手機現車裡面呢
[00:06] 原來很多也不會操作的
[00:08] 今天主要給大家分享一下這個問題
[00:11] 相信你學會了肯定能用的大
```

## 3. 本地 MP4 只获取内容结果

命令：

```powershell
python scripts/build_artifact_only.py --local "temp\douyin_fallback_video.mp4"
```

结果：成功。

生成 artifact 目录：

```text
C:\Users\USER\Documents\视频拆解\Video Knowledge Mapper\outputs\local_douyin_fallback_video_2dcad769
```

文件检查：

- `metadata.json`：存在，482 bytes
- `transcript.txt`：存在，2839 bytes
- `source_result.json`：存在，303 bytes
- `debug_report.md`：存在，575 bytes

metadata 核心字段：

```json
{
  "title": "douyin_fallback_video",
  "uploader": null,
  "duration": null,
  "platform": "local",
  "video_id": "douyin_fallback_video",
  "local_path": "C:\\Users\\USER\\Documents\\视频拆解\\Video Knowledge Mapper\\temp\\douyin_fallback_video.mp4",
  "transcript_source": "whisper"
}
```

transcript.txt 前 5 行：

```text
[00:00] 在抖音刷到積極喜歡的視頻
[00:03] 怎麼保存到積極手積線車裡面呢
[00:06] 原來很多也不會操作的
[00:08] 今天主要給大家分享一下這個問題
[00:11] 先進你學會了
```

## 4. 三路 transcript.txt 质量评价

共同结论：

- 三路 `transcript.txt` 都存在。
- 三路都不是空文件。
- 三路都带 `[00:xx]` 时间戳。
- 三路文本都能被 DeepSeek 使用。
- 没发现文件编码级乱码，例如 replacement character。

质量注意点：

- 本次命令中使用 `VKM_WHISPER_MODEL=tiny` 做快速验证，因此转写质量不是最终最佳质量。
- B站 transcript 可读，但有明显 ASR 错字，例如“清晰”被识别为“親戚”，“脱水”被识别为“拖水”。
- 抖音 transcript 可读，但有明显 ASR 错字，例如“自己喜欢的视频 / 手机相册”附近被识别成“積極喜歡的視頻 / 手機現車”。
- 本地 MP4 使用的是抖音兜底视频文件，因此内容与抖音样例接近；同样有 tiny 模型导致的识别错误。

建议：

- 命令行快速验证可以继续用 `tiny`。
- 真正生产笔记建议使用默认 `small` 或更高模型，减少错别字。

## 5. 三路重跑笔记结果

### B站重跑笔记

命令：

```powershell
python scripts/run_deepseek_from_artifact.py "outputs\bilibili_BV1AcRdBaEa8"
```

结果：成功。

生成文件：

- Markdown：`D:\AI_Video_Notes\如何把清晰的脑子养回来（二）_20260624_121442.md`
- table summary：`D:\AI_Video_Notes\如何把清晰的脑子养回来（二）_20260624_121442.table_summary.json`
- mindmap JSON：`D:\AI_Video_Notes\如何把清晰的脑子养回来（二）_20260624_121442.mindmap.json`
- XMind：`D:\AI_Video_Notes\如何把清晰的脑子养回来（二）_20260624_121442.xmind`

校验：

- Markdown：存在
- Mermaid：存在
- XMind：存在
- mindmap JSON：存在
- table summary JSON：存在

### 抖音重跑笔记

命令：

```powershell
python scripts/run_deepseek_from_artifact.py "outputs\douyin_7380678787580562707"
```

结果：成功。

生成文件：

- Markdown：`D:\AI_Video_Notes\如何把抖音的视频保存在手机相册里面？很简单，看完你就学会了！ #抖音视频 #保存抖音视频 #手机技巧 #内存不足 #手机技巧分享 #视频去水印 #视频教学 #抖_20260624_121530.md`
- table summary：`D:\AI_Video_Notes\如何把抖音的视频保存在手机相册里面？很简单，看完你就学会了！ #抖音视频 #保存抖音视频 #手机技巧 #内存不足 #手机技巧分享 #视频去水印 #视频教学 #抖_20260624_121530.table_summary.json`
- mindmap JSON：`D:\AI_Video_Notes\如何把抖音的视频保存在手机相册里面？很简单，看完你就学会了！ #抖音视频 #保存抖音视频 #手机技巧 #内存不足 #手机技巧分享 #视频去水印 #视频教学 #抖_20260624_121530.mindmap.json`
- XMind：`D:\AI_Video_Notes\如何把抖音的视频保存在手机相册里面？很简单，看完你就学会了！ #抖音视频 #保存抖音视频 #手机技巧 #内存不足 #手机技巧分享 #视频去水印 #视频教学 #抖.xmind`

说明：

- 抖音标题较长，XMind 文件名走安全文件名截断，因此没有携带时间戳。
- 文件已确认存在，属于命名体验问题，不影响产物生成。

校验：

- Markdown：存在
- Mermaid：存在
- XMind：存在
- mindmap JSON：存在
- table summary JSON：存在

### 本地 MP4 重跑笔记

命令：

```powershell
python scripts/run_deepseek_from_artifact.py "outputs\local_douyin_fallback_video_2dcad769"
```

结果：成功。

生成文件：

- Markdown：`D:\AI_Video_Notes\douyin_fallback_video_20260624_121605.md`
- table summary：`D:\AI_Video_Notes\douyin_fallback_video_20260624_121605.table_summary.json`
- mindmap JSON：`D:\AI_Video_Notes\douyin_fallback_video_20260624_121605.mindmap.json`
- XMind：`D:\AI_Video_Notes\douyin_fallback_video_20260624_121605.xmind`

校验：

- Markdown：存在
- Mermaid：存在
- XMind：存在
- mindmap JSON：存在
- table summary JSON：存在

## 6. 是否有失败、空文件、乱码、目录覆盖、路径异常

- 失败：未发现。
- 空文件：未发现。
- transcript 缺时间戳：未发现。
- 编码级乱码：未发现。
- 明显 ASR 错字：有，主要来自快速验证使用的 `tiny` Whisper 模型。
- 目录覆盖：未发现导致数据丢失的问题。B站/抖音按视频 ID 写入，同一视频会复用同一 artifact 目录；本地视频按安全文件名 + 路径 hash 写入。
- 路径异常：发现一个轻微命名体验问题，长标题抖音 XMind 文件名被截断后不带时间戳，但文件生成成功。

## 7. 当前是否适合进入 UI 轻量改造

适合。

理由：

1. 二阶段命令行已经真实跑通。
2. 三路内容获取都能生成 artifact 四件套。
3. 三路 artifact 都能重跑 DeepSeek 并生成完整知识拆解产物。
4. 失败边界已经比较清楚：内容获取阶段、转写阶段、DeepSeek 阶段可拆开排查。

但 UI 改造建议保持轻量，不要一次性重做整个界面。

## 8. 建议 UI 怎么加这三个入口

建议保留当前「开始分析」作为主按钮，同时增加一个简单的模式选择：

```text
模式：
[完整分析] [只获取内容] [重跑笔记]
```

三个模式含义：

1. 完整分析
   - 输入 B站/抖音链接或本地 MP4
   - 生成 artifact
   - 调用 DeepSeek
   - 输出 Markdown / Mermaid / XMind / table summary

2. 只获取内容
   - 输入 B站/抖音链接或本地 MP4
   - 只生成 artifact
   - 不调用 DeepSeek
   - 完成后显示 artifact 目录

3. 重跑笔记
   - 输入或选择 artifact 目录
   - 读取 metadata.json + transcript.txt
   - 只调用 DeepSeek
   - 不下载、不转写

UI 文案建议：

- 主按钮仍叫「开始分析」
- 模式说明不要堆太多技术词
- artifact 可以在 UI 中称为「可复用转写结果」
- 重跑笔记可以叫「用已有转写重做笔记」

优先级建议：

```text
先加模式选择
→ 再加 artifact 目录选择
→ 最后再考虑飞书同步开关
```
