<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

# 弹幕系统

基于 NestJS 框架开发的实时弹幕系统，支持在线发送和接收弹幕消息。

## 项目特点

- 实时弹幕：基于 WebSocket 实现实时弹幕发送和接收
- 用户系统：支持用户注册、登录和身份验证
- 数据持久化：使用数据库存储弹幕和用户信息
- RESTful API：提供标准的 HTTP 接口
- 前端界面：包含美观的弹幕展示页面

## 技术栈

- 后端框架：NestJS
- 实时通信：WebSocket (Socket.io)
- 数据库：MongoDB
- 前端技术：HTML5, CSS3, JavaScript
- API 文档：Swagger

## 项目结构

```
src/
├── common/          # 公共配置和工具
├── core/            # 核心功能模块
├── model/           # 数据模型定义
├── modules/         # 业务模块
│   ├── danmu/      # 弹幕相关功能
│   └── user/       # 用户相关功能
└── main.ts         # 应用入口文件

public/             # 静态资源文件
```

## 安装

```bash
$ npm install
```

## 运行

```bash
# 开发模式
$ npm run start

# 监听模式
$ npm run start:dev

# 生产模式
$ npm run start:prod
```

## 测试

```bash
# 单元测试
$ npm run test

# e2e 测试
$ npm run test:e2e

# 测试覆盖率
$ npm run test:cov
```

## API 文档

启动服务后，访问 http://localhost:3000/api 查看 Swagger API 文档。

## 功能说明

### 弹幕功能

- 发送弹幕：支持发送文本弹幕
- 接收弹幕：实时显示其他用户发送的弹幕
- 弹幕持久化：将弹幕信息保存到数据库

### 用户系统

- 用户注册：新用户注册
- 用户登录：已注册用户登录
- 身份验证：基于 JWT 的用户认证

## 环境要求

- Node.js (>= 14.x)
- MongoDB (>= 4.x)

## 配置说明

在 `src/common/config.ts` 文件中配置：

- 数据库连接信息
- JWT 密钥
- 服务器端口
- 其他系统配置

## 部署

1. 安装依赖
```bash
$ yarn install
```

2. 配置环境
- 确保 MongoDB 服务已启动
- 检查并修改配置文件

3. 构建项目
```bash
$ yarn build
```

4. 启动服务
```bash
$ yarn start:prod
```

## 许可证

[MIT licensed](LICENSE)
