# 打包成 Windows 独立软件

这个项目是 PySide6 桌面程序，推荐先做成“免安装文件夹版”，确认能在朋友电脑上运行后，再做成安装包。

## 方案结构

1. 用 PyInstaller 生成：

```text
dist\Video Knowledge Mapper\Video Knowledge Mapper.exe
```

2. 把整个 `dist\Video Knowledge Mapper` 文件夹压缩后发给朋友。

3. 如果需要“下一步、下一步、安装完成”的体验，再用 Inno Setup 把这个文件夹做成安装包。

## 打包前准备

在你的电脑上先确认项目已经能正常启动。然后安装依赖：

```powershell
cd "C:\Users\USER\Documents\视频拆解\Video Knowledge Mapper"
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

## 生成免安装版

运行：

```powershell
cd "C:\Users\USER\Documents\视频拆解\Video Knowledge Mapper"
powershell -ExecutionPolicy Bypass -File .\build_windows.ps1 -Clean
```

生成成功后，把这个文件夹发给朋友：

```text
C:\Users\USER\Documents\视频拆解\Video Knowledge Mapper\dist\Video Knowledge Mapper
```

朋友双击里面的：

```text
Video Knowledge Mapper.exe
```

## FFmpeg 怎么处理

当前程序需要 FFmpeg。你有两个选择：

1. 让朋友自己安装 FFmpeg，并确保系统能识别 `ffmpeg`。
2. 把便携版 FFmpeg 放到项目里的这个位置后再打包：

```text
tools\ffmpeg\bin\ffmpeg.exe
```

如果打包脚本发现这个文件，会自动把它放进软件里。

## DeepSeek Key 怎么处理

不要把你自己的 DeepSeek API Key 打包进去。朋友打开软件后，在界面里填自己的 Key 即可。

## 飞书同步怎么处理

飞书同步是更麻烦的一步，因为它依赖朋友电脑上的飞书 CLI 登录状态和目标知识库配置。

小范围分享时，建议先让朋友只使用“视频转 Markdown / XMind”功能。等核心流程稳定后，再把飞书同步做成可配置项。

## 做成真正安装包

免安装版确认可用后，可以用 Inno Setup 制作安装包：

1. 安装 Inno Setup。
2. 新建脚本，把 `dist\Video Knowledge Mapper` 整个文件夹作为安装内容。
3. 创建桌面快捷方式，指向 `Video Knowledge Mapper.exe`。
4. 输出一个 `VideoKnowledgeMapperSetup.exe`。

这一步本质上只是把 PyInstaller 生成的文件夹包起来，不改变程序逻辑。

## 分享前检查

分享给朋友前，请检查：

- 不要包含你的 DeepSeek API Key。
- 不要包含个人视频、笔记、历史同步记录。
- 不要把 `.venv`、`tests`、`tmp` 发出去。
- 朋友电脑第一次转写时，faster-whisper 可能需要下载模型，耗时会比较久。
