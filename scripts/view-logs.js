const fs = require('fs');
const path = require('path');
const readline = require('readline');

// 配置
const LOG_DIR = path.join(__dirname, '..', 'logs');
const DEFAULT_LINES = 50;

// 命令行参数
const args = process.argv.slice(2);
const options = {
  file: null,
  lines: DEFAULT_LINES,
  filter: null,
  level: null,
  json: false
};

// 解析命令行参数
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--file' || arg === '-f') {
    options.file = args[++i];
  } else if (arg === '--lines' || arg === '-n') {
    options.lines = parseInt(args[++i], 10) || DEFAULT_LINES;
  } else if (arg === '--filter' || arg === '-s') {
    options.filter = args[++i];
  } else if (arg === '--level' || arg === '-l') {
    options.level = args[++i].toUpperCase();
  } else if (arg === '--json' || arg === '-j') {
    options.json = true;
  } else if (arg === '--help' || arg === '-h') {
    showHelp();
    process.exit(0);
  } else if (!options.file && arg && !arg.startsWith('-')) {
    // 支持直接传递文件名作为第一个参数
    options.file = arg;
  }
}

// 显示帮助信息
function showHelp() {
  console.log(`
日志查看工具

用法: node view-logs.js [文件名] [选项]

选项:
  --file, -f <文件名>    指定要查看的日志文件，不指定则列出所有日志文件
  --lines, -n <行数>     显示的行数，默认为 ${DEFAULT_LINES}
  --filter, -s <关键词>  过滤包含关键词的行
  --level, -l <级别>     过滤指定级别的日志 (INFO, WARN, ERROR)
  --json, -j             以JSON格式输出
  --help, -h             显示此帮助信息

示例:
  node view-logs.js                             # 列出所有日志文件
  node view-logs.js security.log                # 查看security.log文件
  node view-logs.js --file security.log         # 同上
  node view-logs.js -f security.log -n 100      # 查看最后100行
  node view-logs.js -f security.log -s "认证成功" # 过滤包含"认证成功"的行
`);
}

// 列出所有日志文件
async function listLogFiles() {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      console.error(`日志目录不存在: ${LOG_DIR}`);
      return [];
    }
    
    const files = fs.readdirSync(LOG_DIR);
    const logFiles = files.filter(file => file.endsWith('.log'));
    
    if (logFiles.length === 0) {
      console.log('没有找到日志文件');
      return [];
    }
    
    console.log('可用的日志文件:');
    logFiles.forEach((file, index) => {
      const stats = fs.statSync(path.join(LOG_DIR, file));
      const size = (stats.size / 1024).toFixed(2);
      const lastModified = new Date(stats.mtime).toLocaleString();
      console.log(`${index + 1}. ${file} (${size} KB) - 最后修改: ${lastModified}`);
    });
    
    return logFiles;
  } catch (error) {
    console.error('列出日志文件时出错:', error);
    return [];
  }
}

// 格式化日志行
function formatLogLine(line, isJson) {
  if (isJson) {
    try {
      const parsed = JSON.parse(line);
      // 美化输出
      const timestamp = parsed.timestamp || '';
      const level = parsed.level ? parsed.level.toUpperCase() : '';
      const context = parsed.context || '';
      const message = parsed.message || '';
      
      // 构建彩色输出
      let coloredOutput = '';
      
      // 时间戳
      coloredOutput += `\x1b[90m[${timestamp}]\x1b[0m `;
      
      // 日志级别 (带颜色)
      if (level === 'ERROR') {
        coloredOutput += `\x1b[31m[${level}]\x1b[0m `;
      } else if (level === 'WARN') {
        coloredOutput += `\x1b[33m[${level}]\x1b[0m `;
      } else if (level === 'INFO') {
        coloredOutput += `\x1b[32m[${level}]\x1b[0m `;
      } else if (level === 'DEBUG') {
        coloredOutput += `\x1b[36m[${level}]\x1b[0m `;
      } else {
        coloredOutput += `\x1b[37m[${level}]\x1b[0m `;
      }
      
      // 上下文
      coloredOutput += `\x1b[35m[${context}]\x1b[0m `;
      
      // 消息
      coloredOutput += message;
      
      // 其他元数据
      const meta = { ...parsed };
      delete meta.timestamp;
      delete meta.level;
      delete meta.context;
      delete meta.message;
      
      if (Object.keys(meta).length > 0) {
        coloredOutput += ` \x1b[90m${JSON.stringify(meta)}\x1b[0m`;
      }
      
      return coloredOutput;
    } catch {
      return line;
    }
  } else {
    return line;
  }
}

// 读取日志文件的最后N行
async function readLogFile(filename, lines, filter, level) {
  const filePath = path.join(LOG_DIR, filename);
  
  if (!fs.existsSync(filePath)) {
    console.error(`文件不存在: ${filePath}`);
    return;
  }
  
  try {
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });
    
    const allLines = [];
    
    for await (const line of rl) {
      // 过滤逻辑
      if (filter && !line.includes(filter)) continue;
      if (level) {
        // 尝试解析JSON格式的日志
        try {
          const logEntry = JSON.parse(line);
          if (logEntry.level && logEntry.level.toUpperCase() !== level) continue;
        } catch {
          // 非JSON格式，尝试正则匹配
          if (!line.includes(`[${level}]`)) continue;
        }
      }
      
      allLines.push(line);
      
      // 保持数组大小不超过所需行数
      if (allLines.length > lines) {
        allLines.shift();
      }
    }
    
    // 输出日志
    console.log(`\n显示 ${filename} 的最后 ${allLines.length} 行:`);
    console.log('='.repeat(80));
    
    if (allLines.length === 0) {
      console.log('没有找到匹配的日志记录');
    } else {
      allLines.forEach(line => {
        console.log(formatLogLine(line, options.json));
      });
    }
    
    console.log('='.repeat(80));
    
    // 显示过滤信息
    if (filter || level) {
      let filterInfo = '过滤条件: ';
      if (filter) filterInfo += `关键词="${filter}" `;
      if (level) filterInfo += `级别=${level}`;
      console.log(filterInfo);
    }
  } catch (error) {
    console.error('读取日志文件时出错:', error);
  }
}

// 主函数
async function main() {
  if (options.file) {
    await readLogFile(options.file, options.lines, options.filter, options.level);
  } else {
    const logFiles = await listLogFiles();
    if (logFiles.length > 0) {
      console.log('\n使用方法:');
      console.log('  node view-logs.js <文件名>        # 查看特定日志文件');
      console.log('  node view-logs.js --help         # 显示更多选项');
    }
  }
}

main(); 