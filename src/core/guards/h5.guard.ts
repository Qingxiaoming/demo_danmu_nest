import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AUTHORIZE_KEY_METADATA } from '../decorator/authorize';
import { jwtDecode } from '../utils/crypt.util';
import E from 'src/common/error';
import { PLATFORM } from 'src/common/enum';
import { User } from 'src/model/user.model';

@Injectable()
export class H5AuthGuard implements CanActivate {
  constructor(private reflector: Reflector = null) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    // 检查无需登录
    const openAuthorize = this.reflector.get<boolean>(
      AUTHORIZE_KEY_METADATA,
      context.getHandler(),
    );
    if (openAuthorize) {
      return true;
    }

    // jwt校验并绑定adminID和Admin
    const payload = jwtDecode(request.headers['authorization']);
    if (!payload || !payload.id) {
      throw E.AUTH_FAILED;
    }
    if (payload.platform != PLATFORM.h5) throw E.AUTH_FAILED;
    // 检查用户
    const user = await User.findByPk(payload.id);
    if (!user) throw E.USER_NOT_EXISTS;
    request.user = user;
    return true;
  }
}
