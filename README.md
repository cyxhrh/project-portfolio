# CY · 项目作品集

我通过 AI Agent 与 Vibe Coding 开展项目实践，关注信息自动化、知识整理与网页交互。这份作品集收录三个项目的源码、界面截图、运行方式和验证记录。

| 项目 | 主要内容 | 代码与说明 |
| --- | --- | --- |
| **商机罗盘 Venture Compass** | 比赛网页：3D 全球市场地球、想法输入、转场动画与产品概念展示 | [查看项目](venture-compass/README.md) · [源码](venture-compass/source/) |
| **Video Knowledge Mapper** | 视频内容获取、转写、结构化笔记、思维导图与复习卡片 | [查看项目](video-knowledge-mapper/README.md) · [源码](video-knowledge-mapper/source/) |
| **AI Intel Collector** | 多来源 AI 信息采集、正文提取、摘要、日报与桌面控制台 | [查看项目](ai-intel-collector/README.md) · [源码](ai-intel-collector/source/) |

## 01 · 商机罗盘 Venture Compass

比赛项目的最新前端展示版。围绕“从一个商业想法出发”设计页面体验：开场动画、可旋转的全球市场地球、悬浮输入框、分析转场，以及 SINKSIDE 水槽下收纳产品页。

![商机罗盘：3D 地球与商业想法输入](venture-compass/screenshots/02-idea-input.png)

![SINKSIDE 产品概念展示](venture-compass/screenshots/03-sinkside-landing.png)

**技术栈：** React、TypeScript、Vite、Three.js / react-globe.gl、Fluent UI。

**实现重点：** 3D 地球交互、输入体验、页面过渡、视频首屏、产品方案切换与配套资源整合。

**当前状态：** 前端概念展示；输入统一导向预设 SINKSIDE 页面，尚未接入实时市场研究。2026-09-13 核验，37 个测试及生产构建通过。采用 2026-08-29 的源码版本 `768f39d`，截图与该版本对应。

[全部截图与运行方式](venture-compass/README.md) · [React 入口](venture-compass/source/src/app/App.tsx) · [3D 地球代码](venture-compass/source/src/components/CountryGlobe.tsx) · [产品页面代码](venture-compass/source/public/sinkside/index.html)

## 02 · Video Knowledge Mapper

把视频内容整理为适合复习的学习材料。项目包含内容获取、转写、AI 笔记生成、Markdown / Mermaid / XMind 导出和复习卡片，并支持基于已有转写继续生成笔记。

![Video Knowledge Mapper 主界面](video-knowledge-mapper/screenshots/01-main-interface.png)

**技术栈：** Python、PySide6、FFmpeg。

**实现重点：** 分阶段处理流程、桌面交互、结构化输出，以及可复用的已有处理结果。

**当前状态：** 2026-09-13 对分享源码验证，57 个测试通过。界面图由原 Qt 组件渲染，展示初始状态；历史使用报告单独保留并标明时间。

[项目说明与运行方式](video-knowledge-mapper/README.md) · [处理流程代码](video-knowledge-mapper/source/src/vkm/core/pipeline.py) · [历史使用报告](video-knowledge-mapper/evidence/two_stage_real_usage_report.md)

## 03 · AI Intel Collector

将 AI 一手信息采集、正文提取、摘要和日报生成串成工作流，提供 Electron 控制台，并保留飞书测试同步与去重记录。

![AI Intel Collector 控制台：历史状态预览](ai-intel-collector/screenshots/01-console-historical-preview.png)

**技术栈：** Node.js、Electron。

**实现重点：** 来源配置、采集与处理模块、报告生成、桌面状态展示及运行记录。

**当前状态：** 2026-09-13 完成 50 个 JavaScript 文件语法检查及控制台文件检查。截图是原界面与 2026-07-07 历史报告组合的只读预览，不代表当天重新采集成功。报告保留成功与失败记录。

[项目说明与运行方式](ai-intel-collector/README.md) · [采集入口](ai-intel-collector/source/src/collect.js) · [历史执行报告](ai-intel-collector/evidence/execution_report.md)

## 关于这份源码

这是为作品展示整理的源码快照。各项目分别提供依赖文件和运行说明；需要外部模型或服务的功能须自行配置。密钥、登录信息、私有飞书目标、个人视频与笔记不包含在内。截图、自动化测试和历史报告各自标明验证范围。
