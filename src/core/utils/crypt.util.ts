import * as jwt from 'jsonwebtoken';
import { APP_KEY } from 'src/common/config';

// 定义自定义JwtPayload接口
export interface CustomJwtPayload {
  id: string | number;
  platform?: string;
  exp?: number;
  iat?: number;
  [key: string]: any;
}

export function jwtDecode(token: string): CustomJwtPayload | null {
  if (token) {
    token = token.substr(0, 7) == 'Bearer ' ? token.substr(7) : token;
    const secret = APP_KEY;
    try {
      const payload = jwt.verify(token, secret) as CustomJwtPayload;
      delete payload.exp;
      delete payload.iat;
      return payload;
    } catch (err) {
      console.error('[JWT failed]', err);
      return null;
    }
  } else {
    return null;
  }
}

export function jwtEncodeInExpire(
  payload: object,
  second: number = 5 * 24 * 60 * 60,
) {
  return jwt.sign(payload, APP_KEY, {
    expiresIn: second,
  });
}
