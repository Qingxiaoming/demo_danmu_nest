# 弹幕系统工具脚本

本目录包含一些实用工具脚本，用于辅助弹幕系统的开发和维护。

## 日志查看器 (view-logs.js)

这是一个功能强大的日志查看工具，可以帮助您轻松查看和过滤应用程序的日志文件。

### 功能特点

- 列出所有可用的日志文件
- 查看指定日志文件的内容
- 支持按关键词过滤日志
- 支持按日志级别过滤 (INFO, WARN, ERROR, DEBUG)
- 特殊处理弹幕消息，使其更易于阅读
- 彩色输出，提高可读性
- 支持只查看弹幕相关消息

### 使用方法

```bash
# 列出所有日志文件
node scripts/view-logs.js

# 查看指定日志文件
node scripts/view-logs.js application-2025-03-13.log

# 使用选项查看日志
node scripts/view-logs.js -f application-2025-03-13.log -d

# 显示帮助信息
node scripts/view-logs.js --help
```

### 可用选项

- `--file, -f <文件名>`: 指定要查看的日志文件
- `--lines, -n <行数>`: 显示的行数，默认为50
- `--filter, -s <关键词>`: 过滤包含关键词的行
- `--level, -l <级别>`: 过滤指定级别的日志 (INFO, WARN, ERROR, DEBUG)
- `--danmu, -d`: 只显示弹幕消息
- `--all, -a`: 显示所有行，不限制行数
- `--help, -h`: 显示帮助信息

### 示例

```bash
# 查看最近的应用日志
node scripts/view-logs.js application-2025-03-13.log

# 只查看弹幕消息
node scripts/view-logs.js -f application-2025-03-13.log -d

# 查看包含"保存"关键词的日志
node scripts/view-logs.js -f application-2025-03-13.log -s "保存"

# 查看所有错误日志
node scripts/view-logs.js -f application-2025-03-13.log -l ERROR

# 查看最近100行日志
node scripts/view-logs.js -f application-2025-03-13.log -n 100

# 查看所有日志
node scripts/view-logs.js -f application-2025-03-13.log -a
``` 