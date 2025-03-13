import * as jwt from 'jsonwebtoken';
import { APP_KEY } from 'src/common/config';

// 定义自定义JwtPayload接口
export interface CustomJwtPayload {
  id: string | number;
  role?: string;
  exp?: number;
  iat?: number;
  [key: string]: any;
}

/**
 * 解析JWT令牌
 * @param token JWT令牌
 * @returns 解析后的payload或null
 */
export function jwtDecode(token: string): CustomJwtPayload | null {
  if (!token) {
    return null;
  }
  
  token = token.startsWith('Bearer ') ? token.substring(7) : token;
  const secret = APP_KEY;
  
  try {
    const payload = jwt.verify(token, secret) as CustomJwtPayload;
    // 移除标准字段，只保留自定义数据
    const { exp, iat, ...customData } = payload;
    return customData;
  } catch (err) {
    // 不使用console.error，让调用者处理错误
    return null;
  }
}

/**
 * 创建带有过期时间的JWT令牌
 * @param payload 要编码的数据
 * @param second 过期时间（秒），默认5天
 * @returns JWT令牌
 */
export function jwtEncodeInExpire(
  payload: object,
  second: number = 5 * 24 * 60 * 60,
): string {
  return jwt.sign(payload, APP_KEY, {
    expiresIn: second,
  });
}
