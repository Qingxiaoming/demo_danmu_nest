/**
 * 数据库修复脚本
 * 在应用启动前运行，确保数据库表结构与模型一致
 */
const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixDatabase() {
  console.log('开始检查和修复数据库结构...');
  
  // 从环境变量获取数据库连接信息
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'now_queue'
  };
  
  let connection;
  
  try {
    // 创建数据库连接
    connection = await mysql.createConnection(dbConfig);
    console.log('已连接到数据库');
    
    // 检查now_queue表中是否存在pauseTime和workingDuration列
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'now_queue'
    `, [dbConfig.database]);
    
    const columnNames = columns.map(col => col.COLUMN_NAME);
    console.log('现有数据表列:', columnNames.join(', '));
    
    // 检查并添加pauseTime列
    if (!columnNames.includes('pauseTime')) {
      console.log('添加pauseTime列...');
      await connection.execute('ALTER TABLE now_queue ADD COLUMN pauseTime DATETIME NULL');
      console.log('pauseTime列已添加');
    } else {
      console.log('pauseTime列已存在');
    }
    
    // 检查并添加workingDuration列
    if (!columnNames.includes('workingDuration')) {
      console.log('添加workingDuration列...');
      await connection.execute('ALTER TABLE now_queue ADD COLUMN workingDuration INT DEFAULT 0');
      console.log('workingDuration列已添加');
      
      // 更新已有记录的workingDuration字段
      await connection.execute('UPDATE now_queue SET workingDuration = 0 WHERE workingDuration IS NULL');
      console.log('已更新现有记录的workingDuration值');
    } else {
      console.log('workingDuration列已存在');
    }
    
    console.log('数据库结构检查与修复完成');
  } catch (error) {
    console.error('数据库修复过程中发生错误:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('数据库连接已关闭');
    }
  }
}

// 执行修复
fixDatabase().then(() => {
  console.log('数据库修复脚本执行完毕');
  process.exit(0);
}).catch(err => {
  console.error('数据库修复脚本执行失败:', err);
  process.exit(1);
}); 