# 排队姬

基于 NestJS 框架开发的排队姬内置点歌姬。

## 项目特点

- **实时弹幕**: 基于 WebSocket (Socket.io) 实现实时弹幕发送和接收
- **音乐功能**: 支持音乐搜索、播放和管理
- **数据持久化**: 使用 Sequelize 和 MySQL 存储弹幕和音乐信息
- **RESTful API**: 提供标准的 HTTP 接口，支持 Swagger 文档
- **日志系统**: 完善的日志记录和查看机制
- **错误处理**: 统一的错误码和异常处理机制

## 技术栈

- **后端框架**: NestJS (v11)
- **数据库**: MySQL + Sequelize
- **实时通信**: WebSocket (Socket.io)
- **API 文档**: Swagger
- **日志系统**: Winston + winston-daily-rotate-file
- **安全**: bcrypt, jsonwebtoken, csurf

## 项目结构

```
src/
├── common/         # 公共配置、工具和常量
├── core/           # 核心功能和服务
├── model/          # 数据模型定义
├── modules/        # 业务模块
│   ├── danmu/      # 弹幕相关功能
│   └── music/      # 音乐相关功能
├── app.module.ts   # 应用模块配置
└── main.ts         # 应用入口文件

public/             # 静态资源文件
logs/               # 日志文件目录
```

## 安装和使用

### 环境要求

- Node.js >= 14.x
- MySQL >= 8.x

### 安装依赖

```bash
# 使用 npm
npm install

# 或使用 yarn
yarn install
```

### 配置环境变量

创建或修改 `.env` 文件，配置必要的环境变量：

```
PORT=5051
DATABASE_HOST=localhost
DATABASE_PORT=3306
DATABASE_USER=root
DATABASE_PASSWORD=password
DATABASE_NAME=danmu_db
JWT_SECRET=666666
```

### 运行项目

```bash
# 开发模式
npm run dev
# 或
yarn dev

# 生产模式
npm run build
npm run start:prod
# 或
yarn build
yarn start:prod
```

## API 文档

启动服务后，访问以下地址查看 Swagger API 文档：

```
http://localhost:5051/api/docs
```

## 主要功能

### 弹幕功能

- 发送弹幕：支持多种类型的弹幕发送
- 接收弹幕：实时显示其他用户发送的弹幕
- 弹幕持久化：将弹幕信息保存到数据库
- 弹幕统计：提供弹幕统计和分析功能

### 音乐功能

- 音乐搜索：支持关键词搜索音乐
- 音乐播放：在线播放音乐

## 日志系统

### 日志分类

- 应用日志：`logs/application-YYYY-MM-DD.log`
- 错误日志：`logs/error-YYYY-MM-DD.log`
- 安全日志：`logs/security.log` 和 `logs/security-YYYY-MM-DD.log`

### 查看日志

```bash
# 列出所有日志文件
npm run logs

# 查看今天的应用日志
npm run logs:app

# 查看今天的错误日志
npm run logs:error

# 查看安全日志
npm run logs:security
```

## 错误处理

项目实现了统一的错误处理机制，使用标准化的错误格式：

```typescript
{
  "success": false,
  "error": 1001,
  "message": "参数异常",
  "timestamp": "2023-03-14T10:15:30.123Z",
  "path": "/api/resource",
  "data": { "field": "username" }
}
```

### 错误码分类

- **通用错误码** (1000-9999)
  - 基础错误：1000-1999
  - 用户认证：2000-2999
  - RESTful API：3000-3999
  - 数据库操作：4000-4999
  - WebSocket：5000-5999

- **业务错误码** (10000-19999)
  - 弹幕相关：10000-10999
  - 音乐相关：11000-11999

## 贡献指南

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 许可证

[MIT](LICENSE)

### 待完成
点歌列表功能 切歌功能


添加时下拉框显示当前在线用户功能

优化日志,增加对队列操作的日志

睁眼状态只显示今天的队列
日志ui优化
添加弹幕时可以关联搜索
删除冗余代码
解决ipad后台下点歌有时候接收不到的问题,应该是加个防杀后台
如果可以的话播完歌自动继续当前音乐
设置按钮里的东西,特别是音乐使能按钮
已经waiting的再添加则弹出询问框
增加黑名单
增加礼物插队和手动插队
音乐改为不登录也可以放
焦点优化,删除当前焦点中的一行时应该是下一行填上来焦点不动,而不是回到默认第一行
加一个解压缩工具