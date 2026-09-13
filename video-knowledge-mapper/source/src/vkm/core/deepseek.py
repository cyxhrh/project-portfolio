from __future__ import annotations

from openai import OpenAI

from vkm.core.config import AppConfig
from vkm.core.models import TranscriptSegment, VideoMetadata
from vkm.utils.logging import CallbackLogger


MAX_DIRECT_TRANSCRIPT_CHARS = 24000
CHUNK_SIZE_CHARS = 14000


class DeepSeekNoteGenerator:
    def __init__(self, config: AppConfig, logger: CallbackLogger) -> None:
        self.config = config
        self.logger = logger
        self.client = OpenAI(
            api_key=config.deepseek_api_key,
            base_url=config.deepseek_base_url,
        )

    def generate(
        self,
        metadata: VideoMetadata,
        segments: list[TranscriptSegment],
        transcript_source: str,
    ) -> str:
        transcript = self._prepare_transcript(segments)
        self.logger.info("正在调用 DeepSeek 生成标准 Markdown 笔记...")
        return self._chat(
            [
                {
                    "role": "system",
                    "content": (
                        "你是严谨的中文视频学习笔记整理助手。"
                        "你只输出 Markdown，不输出解释性前言。"
                    ),
                },
                {
                    "role": "user",
                    "content": build_final_prompt(metadata, transcript, transcript_source),
                },
            ]
        )

    def generate_mindmap_json(
        self,
        metadata: VideoMetadata,
        segments: list[TranscriptSegment],
        transcript_source: str,
    ) -> str:
        transcript = self._prepare_transcript(segments)
        self.logger.info("正在调用 DeepSeek 生成 mindmap_json 学习地图...")
        return self._chat(
            [
                {
                    "role": "system",
                    "content": (
                        "你是学习地图设计师。你只输出严格 JSON，不输出 Markdown、Mermaid、解释或代码块。"
                    ),
                },
                {
                    "role": "user",
                    "content": build_mindmap_prompt(metadata, transcript, transcript_source),
                },
            ]
        )

    def generate_table_summary_json(
        self,
        metadata: VideoMetadata,
        segments: list[TranscriptSegment],
        transcript_source: str,
    ) -> str:
        transcript = self._prepare_transcript(segments)
        self.logger.info("正在调用 DeepSeek 生成 table_summary_json 表格索引...")
        return self._chat(
            [
                {
                    "role": "system",
                    "content": (
                        "你是知识索引设计助手。你只输出严格 JSON，不输出 Markdown、解释或代码块。"
                    ),
                },
                {
                    "role": "user",
                    "content": build_table_summary_prompt(
                        metadata, transcript, transcript_source
                    ),
                },
            ]
        )

    def _prepare_transcript(self, segments: list[TranscriptSegment]) -> str:
        transcript = format_transcript(segments)
        if len(transcript) > MAX_DIRECT_TRANSCRIPT_CHARS:
            self.logger.info("转写文本较长，正在分段总结...")
            return self._summarize_chunks(transcript)
        return transcript

    def _summarize_chunks(self, transcript: str) -> str:
        chunks = split_text(transcript, CHUNK_SIZE_CHARS)
        summaries: list[str] = []
        for index, chunk in enumerate(chunks, start=1):
            self.logger.info(f"正在总结第 {index}/{len(chunks)} 段...")
            summaries.append(
                self._chat(
                    [
                        {
                            "role": "system",
                            "content": "你是中文视频转写内容整理助手，只输出忠实摘要。",
                        },
                        {
                            "role": "user",
                            "content": (
                                "请保留关键观点、术语、时间点、例子、金句和行动建议，"
                                "将以下转写片段总结为结构化要点：\n\n"
                                f"{chunk}"
                            ),
                        },
                    ]
                )
            )
        return "\n\n".join(
            f"## 分段摘要 {index}\n{summary}"
            for index, summary in enumerate(summaries, start=1)
        )

    def _chat(self, messages: list[dict[str, str]]) -> str:
        response = self.client.chat.completions.create(
            model=self.config.deepseek_model,
            messages=messages,
            stream=False,
        )
        content = response.choices[0].message.content
        if not content:
            raise RuntimeError("DeepSeek 返回为空。")
        return content.strip()


def format_transcript(segments: list[TranscriptSegment]) -> str:
    return "\n".join(
        f"[{segment.timestamp()}] {segment.text}" for segment in segments
    )


def split_text(text: str, max_chars: int) -> list[str]:
    lines = text.splitlines()
    chunks: list[str] = []
    current: list[str] = []
    current_len = 0

    for line in lines:
        line_len = len(line) + 1
        if current and current_len + line_len > max_chars:
            chunks.append("\n".join(current))
            current = []
            current_len = 0
        current.append(line)
        current_len += line_len

    if current:
        chunks.append("\n".join(current))
    return chunks


def build_final_prompt(
    metadata: VideoMetadata, transcript: str, transcript_source: str
) -> str:
    return f"""
请基于下面的视频信息和转写内容，生成一份中文标准 Markdown 学习笔记。

视频标题：{metadata.title}
视频来源：{metadata.source}
转写来源：{transcript_source}

只输出正文二级标题内容，不要输出一级标题。必须严格包含以下二级标题，且顺序不要改变：

## 基本信息
## 3分钟摘要
## 核心知识点
## 时间轴大纲
## 行动清单
## 金句提取
## Mermaid 思维导图
## 复习卡片

要求：
- 内容必须忠于转写，不要编造。
- 基本信息包含内容主题、适合人群、主要问题、核心结论。
- 3分钟摘要要让没看过视频的人快速理解核心内容。
- 核心知识点用条目化结构，尽量带解释和例子。
- 时间轴大纲尽量使用转写中的时间戳。
- 行动清单必须是可执行动作。
- 金句提取保留原意，避免过度改写。
- Mermaid 思维导图章节不要输出 Mermaid 代码，只写“学习地图已生成到同目录 XMind 文件，可用于快速复习。”
- 复习卡片使用 Q/A 格式。
- 如果某项信息不足，请写“转写中未明确提及”。

转写内容：

{transcript}
""".strip()


def build_mindmap_prompt(
    metadata: VideoMetadata, transcript: str, transcript_source: str
) -> str:
    return f"""
请基于视频转写内容，输出一个用于生成 XMind 的稳定 JSON 学习地图。

视频标题：{metadata.title}
转写来源：{transcript_source}

只输出 JSON object，不要输出 Markdown，不要输出 Mermaid，不要输出代码块。

JSON schema 固定为：
{{
  "title": "中心主题",
  "branches": [
    {{
      "title": "一级分支",
      "children": [
        {{
          "title": "二级节点"
        }}
      ]
    }}
  ]
}}

结构规则：
- 中心主题只能有 1 个。
- 一级分支必须 3 到 5 个。
- 每个一级分支最多 4 个二级节点。
- 最多 3 层：中心主题、一级分支、二级节点。不要继续嵌套。
- 删除重复、琐碎、低价值节点。
- 不要把时间轴、长句子、完整段落放进思维导图。
- 每个节点标题尽量短，优先 4 到 18 个中文字。

优先保留：
- 核心概念
- 操作流程
- 工具 / 方法
- 注意事项
- 应用场景
- 可执行步骤

思维导图定位：
- 它是“学习地图”，用于快速复习。
- 它不是完整笔记的复制版。
- 它应该帮助用户快速回忆结构、方法和行动路径。

转写内容：

{transcript}
""".strip()


def build_table_summary_prompt(
    metadata: VideoMetadata, transcript: str, transcript_source: str
) -> str:
    return f"""
请基于视频信息和转写内容，输出用于写入飞书多维表格的 table_summary_json。

视频标题：{metadata.title}
视频来源：{metadata.source}
转写来源：{transcript_source}

只输出 JSON object，不要输出 Markdown，不要输出解释，不要输出代码块。

JSON schema 固定为：
{{
  "title": "简短标题",
  "category": "AI工具",
  "key_takeaway": "一句话核心收获",
  "action_item": "一句话行动项",
  "difficulty": 3,
  "knowledge_value": 4,
  "practice_status": "未实操"
}}

字段规则：
- title：视频标题或笔记标题，保持简短，优先 6 到 30 个中文字符。
- category：必须从以下固定分类中选择一个：AI工具、编程、AI视频、商业认知、自媒体、其他。
- key_takeaway：只写一句话，不超过 40 个中文字符，用来判断是否值得回看。
- action_item：只写一句话，不超过 40 个中文字符，必须是可执行动作。
- difficulty：1 到 5 的整数，按内容门槛判断。
- knowledge_value：1 到 5 的整数，按复习价值和长期价值判断。
- practice_status：默认写“未实操”；只有明确不需要操作时才写“暂不需要”。

定位：
- Markdown 负责完整记录。
- 飞书文档负责完整阅读。
- XMind 负责结构化复习。
- table_summary_json 只负责索引、筛选、回看。
- 不要把完整摘要、完整知识点、完整行动清单写进 JSON。

转写内容：

{transcript}
""".strip()
