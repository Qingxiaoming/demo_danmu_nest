# Backup Files

这个目录包含了项目重构前的原始文件备份：

- index.html：原始的前端页面文件
- b.js：原始的后端服务器文件

这些文件已经被重构并整合到NestJS项目中的相应模块中：

- 前端页面移至 `/public/index.html`
- WebSocket服务器逻辑移至 `/src/modules/danmu/danmu.gateway.ts`
- 数据库操作逻辑移至 `/src/modules/danmu/danmu.service.ts`
- 模块配置移至 `/src/modules/danmu/danmu.module.ts`