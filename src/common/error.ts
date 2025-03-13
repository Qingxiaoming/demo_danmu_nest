// 定义错误码接口
interface ErrorCode {
  error: number;
  message: string;
  statusCode?: number;
  create?: (customMessage?: string | null, data?: any) => StandardError;
  throw?: (customMessage?: string | null, data?: any) => never;
}

// 定义标准错误接口
export interface StandardError extends Error {
  error: number;
  statusCode: number;
  data?: any;
}

const E: Record<string, ErrorCode> = {
  /*------ 通用错误码 1000~9999 ------*/
  UNDEFINED: { error: 1000, message: '未定义异常' },
  INVALID_PARAMS: { error: 1001, message: '参数异常' },
  API_ERROR: { error: 1002, message: '接口异常' },
  TODO: { error: 1003, message: '功能开发中' },
  ONLY_DEVELOPMENT: { error: 1004, message: '仅开发模式可用' },
  OPERATION_FAILED: { error: 1005, message: '操作失败' },
  RESOURCE_NOT_FOUND: { error: 1006, message: '资源不存在' },
  VALIDATION_ERROR: { error: 1007, message: '数据验证失败' },
  RATE_LIMIT_EXCEEDED: { error: 1008, message: '请求频率超限' },
  SYSTEM_ERROR: { error: 1009, message: '系统内部错误' },

  // USER AUTH
  AUTH_FAILED: { error: 2001, message: '无效验证', statusCode: 401 },
  INVALID_PASSWORD: { error: 2002, message: '密码错误' },
  USER_EXISTS: { error: 2003, message: '账号已经存在' },
  USER_NOT_EXISTS: { error: 2004, message: '账号不存在' },
  USER_ROLE_NO_PRIVILEGE: { error: 2005, message: '操作权限不足' },
  USER_OR_PASSWORD_ERROR: { error: 2006, message: '账号或密码错误' },
  INVALID_RENEWPASSWORD: { error: 2007, message: '新密码确认失败' },
  USER_DISABLED: { error: 2009, message: '账号禁用' },
  TOKEN_EXPIRED: { error: 2010, message: '令牌已过期', statusCode: 401 },
  TOKEN_INVALID: { error: 2011, message: '无效的令牌', statusCode: 401 },
  LOGIN_REQUIRED: { error: 2012, message: '请先登录', statusCode: 401 },
  SESSION_EXPIRED: { error: 2013, message: '会话已过期', statusCode: 401 },
  ACCOUNT_LOCKED: { error: 2014, message: '账号已锁定', statusCode: 403 },
  TOO_MANY_ATTEMPTS: { error: 2015, message: '尝试次数过多', statusCode: 429 },

  // RESTFUL
  RESTFUL_GET_ID: { error: 3001, message: '查询数据不存在' },
  RESTFUL_DELETE_ID: { error: 3002, message: '删除数据不存在' },
  RESTFUL_UPDATE_ID: { error: 3003, message: '更新数据不存在' },
  RESTFUL_DUPLICATION: { error: 3004, message: '数据已经存在' },
  RESTFUL_TODO: { error: 3005, message: '该接口未实现' },
  RESTFUL_HAS_DELETED: { error: 3006, message: '该数据已被删除' },
  RESTFUL_GET_AUTH: { error: 3007, message: '该权限不存在' },
  RESTFUL_BAD_REQUEST: { error: 3008, message: '无效的请求', statusCode: 400 },
  RESTFUL_NOT_FOUND: { error: 3009, message: '资源不存在', statusCode: 404 },
  RESTFUL_METHOD_NOT_ALLOWED: { error: 3010, message: '方法不允许', statusCode: 405 },
  RESTFUL_CONFLICT: { error: 3011, message: '资源冲突', statusCode: 409 },

  // SQL
  SQL_DUPLICATION: { error: 4001, message: '数据已经存在' },
  SQL_INCOMPLETE_PARAMS: { error: 4002, message: '错误，参数不全' },
  SQL_INSERT_FAILED: { error: 4003, message: '插入数据失败' },
  SQL_UPDATE_FAILED: { error: 4004, message: '更新数据失败' },
  SQL_DELETE_FAILED: { error: 4005, message: '删除数据失败' },
  SQL_QUERY_FAILED: { error: 4006, message: '查询数据失败' },
  SQL_CONNECTION_ERROR: { error: 4007, message: '数据库连接错误' },
  SQL_TRANSACTION_ERROR: { error: 4008, message: '事务处理错误' },

  // WEBSOCKET
  WS_CONNECTION_ERROR: { error: 5001, message: 'WebSocket连接错误' },
  WS_AUTH_ERROR: { error: 5002, message: 'WebSocket认证错误' },
  WS_INVALID_MESSAGE: { error: 5003, message: '无效的WebSocket消息' },
  WS_CONNECTION_CLOSED: { error: 5004, message: 'WebSocket连接已关闭' },
  WS_MESSAGE_TOO_LARGE: { error: 5005, message: '消息体过大' },
  WS_RATE_LIMITED: { error: 5006, message: '消息发送频率过高' },
  WS_ROOM_JOIN_FAILED: { error: 5007, message: '加入房间失败' },
  WS_ROOM_LEAVE_FAILED: { error: 5008, message: '离开房间失败' },
  WS_BROADCAST_FAILED: { error: 5009, message: '广播消息失败' },
  WS_CLIENT_NOT_FOUND: { error: 5010, message: '客户端不存在' },

  /*------ 业务错误码 10000~19999 ------*/
  // 弹幕相关错误
  DANMU_NOT_FOUND: { error: 10001, message: '弹幕不存在' },
  DANMU_ALREADY_PROCESSED: { error: 10002, message: '弹幕已处理' },
  DANMU_INVALID_STATUS: { error: 10003, message: '无效的弹幕状态' },
  DANMU_CREATE_FAILED: { error: 10004, message: '创建弹幕失败' },
  DANMU_UPDATE_FAILED: { error: 10005, message: '更新弹幕失败' },
  DANMU_DELETE_FAILED: { error: 10006, message: '删除弹幕失败' },
  DANMU_CONTENT_INVALID: { error: 10007, message: '弹幕内容不合规' },
  DANMU_RATE_LIMITED: { error: 10008, message: '发送弹幕过于频繁' },
  DANMU_USER_BANNED: { error: 10009, message: '用户已被禁言' },
  DANMU_ROOM_CLOSED: { error: 10010, message: '弹幕房间已关闭' },
  DANMU_ACCOUNT_INVALID: { error: 10011, message: '账号格式无效' },
  DANMU_PASSWORD_INVALID: { error: 10012, message: '密码格式无效' },
  DANMU_NICKNAME_INVALID: { error: 10013, message: '昵称格式无效' },
  DANMU_TEXT_TOO_LONG: { error: 10014, message: '弹幕内容过长' },
  DANMU_TEXT_EMPTY: { error: 10015, message: '弹幕内容不能为空' },
};

/**
 * 创建标准错误对象
 * @param errorCode 错误码对象
 * @param customMessage 自定义错误消息（可选）
 * @param data 附加数据（可选）
 * @returns 标准错误对象
 */
function createError(errorCode: ErrorCode, customMessage: string | null = null, data: any = null): StandardError {
  const error = new Error(customMessage || errorCode.message) as StandardError;
  error.error = errorCode.error;
  error.statusCode = errorCode.statusCode || 400;
  
  if (data) {
    error.data = data;
  }
  
  return error;
}

/**
 * 将普通错误转换为标准错误
 * @param error 原始错误
 * @param defaultErrorCode 默认错误码
 * @returns 标准错误对象
 */
export function normalizeError(error: any, defaultErrorCode: ErrorCode = E.UNDEFINED): StandardError {
  if (error && typeof error.error === 'number') {
    // 已经是标准错误格式
    return error as StandardError;
  }
  
  return createError(
    defaultErrorCode,
    error?.message || defaultErrorCode.message,
    { originalError: error }
  );
}

/**
 * 包装异步函数，统一错误处理
 * @param fn 异步函数
 * @param defaultErrorCode 默认错误码
 * @returns 包装后的异步函数
 */
export function wrapAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T, 
  defaultErrorCode: ErrorCode = E.UNDEFINED
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  return async function(...args: Parameters<T>): Promise<ReturnType<T>> {
    try {
      return await fn(...args);
    } catch (error) {
      throw normalizeError(error, defaultErrorCode);
    }
  };
}

// 为每个错误码添加工厂方法
Object.keys(E).forEach(key => {
  const errorCode = E[key];
  
  // 添加创建错误的方法
  errorCode.create = (customMessage = null, data = null) => {
    return createError(errorCode, customMessage, data);
  };
  
  // 添加抛出错误的方法
  errorCode.throw = (customMessage = null, data = null) => {
    throw createError(errorCode, customMessage, data);
  };
});

// 导出错误码
export default E;
