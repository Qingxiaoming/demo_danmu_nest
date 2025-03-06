import { SetMetadata } from '@nestjs/common';

export const AUTHORIZE_KEY_METADATA = 'AUTHORIZE_KEY_METADATA';

/**
 * 开放授权Api，使用该注解则无需校验Token及权限
 */
export const OpenAuthorize = () => SetMetadata(AUTHORIZE_KEY_METADATA, true);
