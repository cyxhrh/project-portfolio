# 微光标本馆 · 运行源码

此目录为原项目当前 `3fe9d13` 版本的运行源码与资源快照；代码无未提交改动。未包括原项目的部署绑定、角色指令、依赖缓存或用户馆藏数据。

```bash
npm ci
npm run dev
```

检查与构建：

```bash
npm run typecheck
npm test
npm run build
```

技术栈：React、TypeScript、Vite、Canvas、IndexedDB、Vitest。应用不依赖后端或账户登录。馆藏属于当前浏览器和当前站点来源，不会在不同域名之间自动同步。

`public/` 包含预置背景与许可文件。字体依赖由包管理器安装；请保留对应字体许可。分享目录是源码快照，不是原项目完整开发历史。
