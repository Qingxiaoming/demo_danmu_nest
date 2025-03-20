export const DanmuConfig = {
  // B站弹幕相关配置
  bilibili: {
    roomId: 23415751, // B站直播间ID
    filterKeyword: ["排队", "帮帮", "排个队"], // 需要过滤的关键词数组，弹幕包含任一关键词都会被保存
  },

  // 认证相关配置
  auth: {
    cooldownMs: 5 * 60 * 1000, // 认证冷却时间（5分钟）
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key', // JWT密钥
    jwtExpiresIn: '12h', // JWT过期时间
  },

  // WebSocket相关配置
  websocket: {
    port: 5052,
    cors: {
      origin: '*',
      credentials: true,
      methods: ['GET', 'POST'],
      allowedHeaders: ['Authorization', 'auth_token', 'content-type']
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000,
  },

  // 系统相关配置
  system: {
    updateInterval: 2000, // 数据更新间隔（毫秒）
    clientCleanupInterval: 30 * 60 * 1000, // 客户端清理间隔（30分钟）
    clientExpireTime: 2 * 60 * 60 * 1000, // 客户端过期时间（2小时）
  }
}; 