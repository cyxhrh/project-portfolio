# AI Intel Collector｜AI 情报采集工具

本地 AI 一手信息采集与整理项目，源码包含多来源采集、正文提取、摘要、日报、飞书测试同步、URL 去重及 Electron 控制台。

## 界面

![历史状态控制台预览](screenshots/01-console-historical-preview.png)

这张图是 **原 HTML/CSS/renderer 配合历史状态的只读预览**，不是本次 Electron 实时运行截图。状态来自原 `getStatus()` 对 2026-07-07 报告的读取。为避免执行操作，预览替换了 Electron 桥接、禁用了运行与计划任务按钮，并在页面标明历史状态；没有修改原项目源码。

界面的“69”来自历史汇总字段；同轮执行报告记录新增 21 条、14 个来源中 4 个成功。两者口径不同，不把 69 解释为本次新增或今日采集量。

## 源码入口

- [采集入口](source/src/collect.js)
- [桌面主进程](source/desktop/main.js)
- [控制台界面](source/desktop/renderer/index.html)
- [来源配置](source/config/sources.json)
- [原项目说明](source/README.md)

## 验证与成果

本次完成 JavaScript 语法检查和控制台必需文件检查，未执行采集、付费模型调用、飞书同步或修改定时任务。

- [历史执行报告](evidence/execution_report.md)
- [历史自动运行报告](evidence/auto_run_report.md)
- [历史同步汇总](evidence/daily_sync_summary_report.md)
- [可打开的只读界面预览](evidence/console-preview/index.html)

在 source 目录执行 `npm ci` 后，`npm run desktop:dev` 打开控制台。`.env.example` 将飞书同步默认关闭；实际采集和模型摘要需要自行配置。历史报告只证明当时记录的结果，不代表系统当前稳定上线。
