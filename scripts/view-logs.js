const fs = require('fs');
const path = require('path');
const readline = require('readline');

// 配置
const LOG_DIR = path.join(process.cwd(), 'logs');
const DEFAULT_LINES = 50;

// 命令行参数
const args = process.argv.slice(2);
const options = {
  file: null,
  lines: DEFAULT_LINES,
  filter: null,
  level: null,
  json: true,
  danmu: false,
  all: false
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
  } else if (arg === '--danmu' || arg === '-d') {
    options.danmu = true;
    options.lines = Infinity; // 当查看弹幕消息时，显示所有行
  } else if (arg === '--all' || arg === '-a') {
    options.all = true;
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

用法: node scripts/view-logs.js [文件名] [选项]

选项:
  --file, -f <文件名>    指定要查看的日志文件，不指定则列出所有日志文件
  --lines, -n <行数>     显示的行数，默认为 ${DEFAULT_LINES}
  --filter, -s <关键词>  过滤包含关键词的行
  --level, -l <级别>     过滤指定级别的日志 (INFO, WARN, ERROR, DEBUG)
  --danmu, -d            只显示弹幕消息
  --all, -a              显示所有行，不限制行数
  --help, -h             显示此帮助信息

示例:
  node scripts/view-logs.js                                # 列出所有日志文件
  node scripts/view-logs.js application-2025-03-13.log     # 查看指定日志文件
  node scripts/view-logs.js -f application-2025-03-13.log -d  # 只查看弹幕消息
  node scripts/view-logs.js -f error-2025-03-13.log        # 查看错误日志
  node scripts/view-logs.js -f application-2025-03-13.log -s "保存"  # 过滤包含"保存"的行
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
      
      // 特殊处理弹幕消息
      if (parsed.nickname) {
        // 提取时间戳的短格式：yyyy-MM-dd HH:mm:ss
        const shortTimestamp = timestamp.split('.')[0]; // 去掉毫秒部分
        
        // 判断操作类型 - 首先检查operation字段，其次检查消息内容
        let operationType = null;
        if (parsed.operation) {
          operationType = parsed.operation;
        } else if (message.includes('保存')) {
          operationType = '保存';
        } else if (message.includes('删除操作成功')) {
          operationType = '删除';
        } else if (message.includes('完成操作成功')) {
          operationType = '完成';
        } else if (message.includes('编辑操作成功')) {
          operationType = '编辑';
        } else if (message.includes('弹幕')) {
          operationType = '弹幕';
        }
        
        // 根据操作类型设置对应的颜色和格式
        if (operationType) {
          let color = '';
          switch(operationType) {
            case '删除': color = '90'; break; // 灰色
            case '完成': color = '32'; break; // 绿色
            case '编辑': color = '33'; break; // 橙色
            case '保存': color = '33'; break; // 橙色
            case '弹幕': color = '37'; break; // 白色
            case '挂起': color = '35'; break; // 紫色
            case '恢复': color = '33'; break; // 橙色
            default: color = '37'; break;     // 白色
          }
          if(operationType === '弹幕' || operationType === '编辑'){
            coloredOutput = `\x1b[${color}m【${operationType}】\x1b[0m\x1b[36m${parsed.nickname}\x1b[0m: \x1b[37m${parsed.text || ''}\x1b[0m`;
          
          }
          else{
          // 添加弹幕文本内容到输出中
          coloredOutput = `\x1b[${color}m【${operationType}】\x1b[0m\x1b[36m${parsed.nickname}\x1b[0m\x1b[90m[${shortTimestamp}]\x1b[0m`;
          }
          return coloredOutput;
        }
      }
      
      // 普通消息
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
      
      coloredOutput += `\x1b[35m[${context}]\x1b[0m ${message}`;
      
      // 其他元数据
      const meta = { ...parsed };
      delete meta.timestamp;
      delete meta.level;
      delete meta.context;
      delete meta.message;
      
      if (Object.keys(meta).length > 0) {
        // 只显示关键元数据
        const simplifiedMeta = {};
        if ('nickname' in meta) simplifiedMeta.nickname = meta.nickname;
        if ('text' in meta) simplifiedMeta.text = meta.text;
        if ('clientId' in meta) simplifiedMeta.clientId = meta.clientId;
        if ('danmuId' in meta) simplifiedMeta.danmuId = meta.danmuId;
        
        if (Object.keys(simplifiedMeta).length > 0) {
          coloredOutput += ` \x1b[90m${JSON.stringify(simplifiedMeta)}\x1b[0m`;
        }
      }
      
      return coloredOutput;
    } catch {
      return line;
    }
  } else {
    return line;
  }
}

// 读取日志文件
async function readLogFile(filename, options) {
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
    let lineCount = 0;
    
    for await (const line of rl) {
      lineCount++;
      
      // 弹幕过滤
      if (options.danmu) {
        try {
          const parsed = JSON.parse(line);
          
          // 判断是否是弹幕操作记录
          const isDanmuOperation = (
            // 操作字段检查 - 明确包含operation字段
            (parsed.operation && ['保存', '删除', '完成', '编辑'].includes(parsed.operation)) ||
            
            // 消息内容检查 - 包含特定关键词并且有nickname和text
            (parsed.nickname && parsed.text && (
              parsed.message && (
                parsed.message.includes('弹幕') || 
                parsed.message.includes('保存') || 
                parsed.message.includes('删除操作成功') || 
                parsed.message.includes('完成操作成功') || 
                parsed.message.includes('编辑操作成功')
              )
            ))
          );
          
          if (!isDanmuOperation) {
            continue;
          }
          
          // 过滤掉操作过程中的INFO日志
          if (parsed.level === 'info' && parsed.message && (
            parsed.message.includes('处理删除请求') || 
            parsed.message.includes('处理完成请求') || 
            parsed.message.includes('处理编辑请求') ||
            // 没有直接链接到特定昵称的日志
            (parsed.message.includes('操作成功') && !parsed.nickname)
          )) {
            continue;
          }
        } catch {
          continue;
        }
      }
      
      // 关键词过滤
      if (options.filter && !line.includes(options.filter)) continue;
      
      // 日志级别过滤
      if (options.level) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.level && parsed.level.toUpperCase() !== options.level) continue;
        } catch {
          // 非JSON格式，尝试正则匹配
          if (!line.includes(`[${options.level}]`)) continue;
        }
      }
      
      allLines.push(line);
      
      // 保持数组大小不超过所需行数，除非要求显示所有行
      if (!options.all && allLines.length > options.lines) {
        allLines.shift();
      }
    }
    
    // 输出日志
    console.log(`\n显示 ${filename} 的${options.all ? '所有' : '最后 ' + allLines.length} 行 (共 ${lineCount} 行):`);
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
    if (options.filter || options.level || options.danmu) {
      let filterInfo = '过滤条件: ';
      if (options.filter) filterInfo += `关键词="${options.filter}" `;
      if (options.level) filterInfo += `级别=${options.level} `;
      if (options.danmu) filterInfo += `只显示弹幕 `;
      console.log(filterInfo);
    }
  } catch (error) {
    console.error('读取日志文件时出错:', error);
  }
}

// 主函数
async function main() {
  if (options.file) {
    await readLogFile(options.file, options);
  } else {
    const logFiles = await listLogFiles();
    if (logFiles.length > 0) {
      console.log('\n使用方法:');
      console.log('  node scripts/view-logs.js <文件名>        # 查看特定日志文件');
      console.log('  node scripts/view-logs.js --help         # 显示更多选项');
    }
  }
}

main(); 