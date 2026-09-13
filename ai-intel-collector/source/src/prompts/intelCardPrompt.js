function buildIntelCardPrompt(item, scoring) {
  return [
    {
      role: "system",
      content:
        "你是 AI 行业一手情报分析员。只基于用户提供的标题、来源、摘要线索和正文片段生成行动型情报卡片；不要编造未提供的细节。输出必须是严格 JSON，不要 Markdown，不要代码块。"
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          task: "把这条 AI 情报转成行动型情报卡片。",
          output_schema: {
            one_sentence_summary: "一句话中文摘要",
            key_points: ["关键点 1", "关键点 2", "关键点 3"],
            detailed_summary: "2-4 句中文摘要；如果信息不足要说明是基于标题和来源的保守判断",
            why_it_matters: "为什么重要",
            relevance_to_my_projects: "对 AI Intel Collector 或 AI 工具项目的相关性",
            project_inspiration: "可转化成项目/产品/内容选题的灵感",
            suggested_actions: ["建议动作 1", "建议动作 2"],
            deep_dive_reason: "是否值得深挖以及原因",
            confidence: "high|medium|low",
            content_insufficient: false,
            should_deep_dive: true
          },
          rules: [
            "必须优先基于 content_snippet 和 summary_placeholder。",
            "如果 content_snippet 为空或不足，请设置 content_insufficient=true，并明确说明判断有限。",
            "不要编造未出现在输入字段里的事实、数字、产品能力或结论。",
            "如果正文片段和标题冲突，以正文片段为准；如果正文看起来是导航或无关内容，设置 confidence=low。",
            "suggested_actions 必须是可以执行的动作。"
          ],
          item: {
            title: item.title,
            url: item.url,
            source_name: item.source_name,
            source_type: item.source_type,
            source_priority: item.source_priority,
            published_at: item.published_at,
            category: item.category,
            importance: item.importance,
            summary_placeholder: item.summary_placeholder,
            content_snippet: item.content_snippet || "",
            content_fetch_status: item.content_fetch_status || "",
            tags: item.tags || []
          },
          scoring
        },
        null,
        2
      )
    }
  ];
}

module.exports = {
  buildIntelCardPrompt
};
