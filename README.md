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

## 日志系统

本项目实现了增强的日志系统，支持控制台和文件输出，具有以下特点：

### 日志存储

- 日志文件存储在 `logs` 目录下
- 应用日志：`application-YYYY-MM-DD.log`（按日期自动轮转）
- 错误日志：`error-YYYY-MM-DD.log`（按日期自动轮转）
- 安全日志：`security.log` 和 `security-YYYY-MM-DD.log`（按日期自动轮转）

### 日志优化特性

- **日志轮转**：日志文件按日期自动轮转，避免单个文件过大
- **重复日志抑制**：相同类型的日志在短时间内重复出现时会被合并记录，减少日志数量
- **连接状态管理**：WebSocket连接状态跟踪，避免重复记录认证信息
- **结构化日志格式**：支持JSON格式的结构化日志，便于分析和处理

### 查看日志

使用以下命令查看日志：

```bash
npm run logs              # 列出所有日志文件
npm run logs:app          # 查看今天的应用日志
npm run logs:error        # 查看今天的错误日志
npm run logs:security     # 查看安全日志
```

高级用法：

```bash
# 直接使用脚本查看特定日志文件
node scripts/view-logs.js security.log

# 查看最后100行
node scripts/view-logs.js security.log -n 100

# 过滤包含特定关键词的日志
node scripts/view-logs.js security.log -s "认证成功"

# 过滤特定级别的日志
node scripts/view-logs.js application-2025-03-13.log -l ERROR

# 以JSON格式输出
node scripts/view-logs.js application-2025-03-13.log -j
```

### 在代码中使用

在服务类中使用增强的日志服务：

```typescript
import { Injectable } from '@nestjs/common';
import { EnhancedLoggerService } from '../../core/services/logger.service';

@Injectable()
export class YourService {
  private readonly logger: EnhancedLoggerService;
  
  constructor(loggerService: EnhancedLoggerService) {
    // 设置上下文，便于识别日志来源
    this.logger = loggerService.setContext('YourService');
  }
  
  async someMethod(param: string) {
    // 记录不同级别的日志
    this.logger.log('处理请求', { param }); // 信息级别
    this.logger.warn('发现潜在问题', { issue: 'something' }); // 警告级别
    
    try {
      // 业务逻辑
    } catch (error) {
      // 错误日志，包含上下文信息
      this.logger.error('操作失败', { 
        param,
        errorMessage: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
}
```

### 日志级别

系统定义了以下日志级别：

- `debug`: 调试信息，仅在开发环境显示
- `log`: 一般信息，默认级别
- `warn`: 警告信息，潜在问题
- `error`: 错误信息，操作失败但不影响系统运行
- `fatal`: 致命错误，可能导致系统崩溃
- `verbose`: 详细信息，包含更多上下文

## 错误处理机制

本项目实现了统一的错误处理机制，使用标准化的错误格式和处理流程，具有以下特点：

### 错误码定义

所有错误码都在 `src/common/error.ts` 文件中集中定义，按照不同的业务领域进行分类：

```typescript
const E = {
  // 通用错误码 1000~9999
  UNDEFINED: { error: 1000, message: '未定义异常' },
  INVALID_PARAMS: { error: 1001, message: '参数异常' },
  
  // 用户认证相关错误 2000~2999
  AUTH_FAILED: { error: 2001, message: '无效验证', statusCode: 401 },
  
  // WebSocket相关错误 5000~5999
  WS_CONNECTION_ERROR: { error: 5001, message: 'WebSocket连接错误' },
  
  // 业务错误码 10000~19999
  DANMU_NOT_FOUND: { error: 10001, message: '弹幕不存在' },
  // ...
};
```

### 错误码分类

错误码按照业务领域进行分类，便于管理和使用：

1. **通用错误码** (1000-9999)
   - 基础错误：1000-1999（如参数错误、系统错误等）
   - 用户认证：2000-2999（如认证失败、密码错误等）
   - RESTful API：3000-3999（如资源不存在、请求冲突等）
   - 数据库操作：4000-4999（如查询失败、连接错误等）
   - WebSocket：5000-5999（如连接错误、消息无效等）

2. **业务错误码** (10000-19999)
   - 弹幕相关：10000-10999（如弹幕不存在、内容过长等）
   - 其他业务模块可在此基础上扩展

### 具体错误示例

#### 弹幕相关错误

```typescript
// 弹幕不存在
E.DANMU_NOT_FOUND.throw(`未找到ID为${uid}的弹幕`);

// 弹幕内容过长
E.DANMU_TEXT_TOO_LONG.throw('弹幕内容不能超过200个字符');

// 弹幕内容为空
E.DANMU_TEXT_EMPTY.throw('弹幕内容不能为空');

// 账号格式无效
E.DANMU_ACCOUNT_INVALID.throw('账号密码格式错误，应为"账号 / 密码"格式');
```

#### 认证相关错误

```typescript
// 认证失败
E.AUTH_FAILED.throw('用户未登录或会话已过期');

// 密码错误
E.INVALID_PASSWORD.throw('密码验证失败，请重试');

// 令牌过期
E.TOKEN_EXPIRED.throw('登录已过期，请重新登录');
```

### 使用方式

在代码中抛出错误的标准方式：

```typescript
// 直接抛出预定义错误
throw E.INVALID_PARAMS;

// 使用throw方法抛出带自定义消息的错误
E.INVALID_PARAMS.throw('参数格式不正确');

// 使用throw方法抛出带附加数据的错误
E.INVALID_PARAMS.throw('参数格式不正确', { field: 'username' });

// 创建错误对象但不立即抛出
const error = E.INVALID_PARAMS.create('参数格式不正确');
// 稍后抛出
throw error;
```

### 错误处理工具

项目提供了几个实用的错误处理工具函数：

1. **normalizeError**: 将任意错误转换为标准错误格式
   ```typescript
   const standardError = normalizeError(error, E.UNDEFINED);
   ```

2. **wrapAsync**: 包装异步函数，统一错误处理
   ```typescript
   const safeFunction = wrapAsync(async () => {
     // 可能抛出错误的代码
   }, E.API_ERROR);
   ```

### 全局异常过滤器

项目使用NestJS的异常过滤器机制，自动捕获并处理所有未处理的异常：

- **HTTP异常过滤器**: 处理REST API中的异常
- **WebSocket异常过滤器**: 处理WebSocket通信中的异常

这些过滤器会将异常转换为统一的响应格式：

```json
{
  "success": false,
  "error": 1001,
  "message": "参数异常",
  "timestamp": "2025-03-14T10:15:30.123Z",
  "path": "/api/resource",
  "data": { "field": "username" }
}
```

### 最佳实践

1. 始终使用 `E.ERROR_CODE.throw()` 方式抛出错误
2. 为每种业务场景定义专门的错误码，避免使用通用错误码
3. 在捕获异常时，使用 `normalizeError` 确保错误格式一致
4. 对于可能抛出异常的异步函数，考虑使用 `wrapAsync` 包装
5. 错误消息应当清晰明确，便于前端展示和用户理解
6. 在日志中记录错误详情，包括错误码、消息和上下文信息
