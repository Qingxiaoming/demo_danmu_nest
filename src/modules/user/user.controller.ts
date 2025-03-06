import { Body, Get, Param, Post, Put, Req } from '@nestjs/common';
import { BindlineDto, CreateUserDto, UpdatePswdDto, UpdateUserDto, UserLoginDto } from './dto/user.dto';
import { User } from 'src/model/user.model';
import E from 'src/common/error';
import { H5Controller } from 'src/core/decorator/controller';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OpenAuthorize } from 'src/core/decorator/authorize';
import { jwtEncodeInExpire } from 'src/core/utils/crypt.util';
import { PLATFORM } from 'src/common/enum';

@ApiTags('h5-员工管理')
@ApiBearerAuth()
@H5Controller('user')
export class UserController {
  @ApiOperation({ summary: '登录' })
  @OpenAuthorize()
  @Post('login')
  async login(@Body() dto: UserLoginDto) {
    const user: User = await User.findOne({
      where: { phone: dto.phone,},// password: dto.password },
    });
    if (!user) {
      throw E.USER_OR_PASSWORD_ERROR;
    }
    return {
      token: jwtEncodeInExpire({
        platform: PLATFORM.h5,
        id: user.id,
      }),
      user,
    };
  }

  @ApiOperation({ summary: '个人信息' })
  @Get('me')
  async getMe(@Req() req) {
    return req.user;
  }

  @ApiOperation({ summary: '修改密码' })
  @Post('updatePassword/:id')
  async updatePassword(@Req() req, @Body() updatePswdDto: UpdatePswdDto) {
    // // 验证员工是否存在
    const user = await User.findByPk(req.user.id);
    if (!user) {
      throw E.USER_NOT_EXISTS;
    }
    // 验证旧密码和重输密码是否正确
    if (user.password !== updatePswdDto.oldPassword) {
      throw E.INVALID_PASSWORD;
    }
    else if (updatePswdDto.renewPassword !== updatePswdDto.newPassword) {
      throw E.INVALID_RENEWPASSWORD;
    }
    // 更新密码为新密码
    await user.update({ password: updatePswdDto.newPassword });
    return {
      message: '密码更新成功',
    };
  }
  
  @ApiOperation({ summary: '绑定产线' })
  @Post('bindline')  
  async updateUser(@Req() req, @Body() bindlineDto: BindlineDto) {

  }

}

