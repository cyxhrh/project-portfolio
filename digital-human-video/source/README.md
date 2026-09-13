# 数字人企业介绍视频：制作源码节选

这是与已交付 V3 成片对应的原始工程节选，整理为分享副本。包括 MiniMax H3 异步素材生成脚本、HyperFrames / HTML / GSAP 全片动效源、时间线与 ASS 字幕。它展示的是已有制作实现，不包含数字人模型训练或自研生成模型。

## 文件与职责

- `minimax-h3/generate_h3.py`：原有 H3 素材脚本；创建任务、查询状态、成功后下载，密钥仅从环境变量读取。
- `composition/index.html`：53.08 秒竖屏画面编排与 GSAP 动效，包括全屏人物、圆形人物窗口、居中标题卡与逐条留存的能力清单。
- `composition/edl.json`：音频基准、段落时点、媒体映射与转场规则。
- `composition/master.ass`：原有中文字幕，供最后一层字幕合成使用。
- `composition/assets/README.md`：所需媒体接口。原始人像、声音、二维码和 B-roll 均未打包。
- `provenance.json`：逐文件来源、原始与分享副本 SHA-256、改动记录及静态核验结果。

## 分享副本改动

全片 HTML 中的电话号码、二维码引用与提示文案已改为通用联系信息占位，其余原始编排保留。新增 SVG 仅为无个人信息的普通图形。未提供完整媒体，不能直接声称本副本已重渲染通过。

## H3 脚本检查与使用

脚本保留 2026 年 8 月制作时的 API 实现，是历史项目代码证据；本次未重新调用外部服务或验证当前接口。

```powershell
# 使用临时测试占位值验证请求结构；不会提交生成任务。
$env:MINIMAX_API_KEY = 'DRY_RUN_PLACEHOLDER'
python .\minimax-h3\generate_h3.py --dry-run --output .\generated\example.mp4 --prompt "Vertical business B-roll, no readable text, no logo."
```

真正生成时，需自行提供有效凭据和授权素材，输出由 `--output` 参数指定。分享整理仅检查 Python 语法、HTML 内 JavaScript 语法、JSON 格式及联系方式残留，未请求服务、未渲染，也未复制任何凭据。
