import { ApiProperty } from '@nestjs/swagger';

export class UserLoginDto {
  @ApiProperty({
    name: 'phone',
    required: true,
    description: '手机号',
    default: '18888888888',
    type: String,
  })
  phone: string;

  @ApiProperty({
    name: 'password',
    required: true,
    description: '密码',
    default: '123456',
    type: String,
  })
  password: string;
}

export class CreateUserDto {
  @ApiProperty({
    name: 'code',
    required: true,
    description: '工号',
    default: '9527',
    type: String,
  })
  code: string;  // 工号

  @ApiProperty({
    name: 'userName',
    required: true,
    description: '姓名',
    default: '张三',
    type: String,
  })
  userName: string;  // 姓名

  @ApiProperty({
    name: 'phone',
    required: true,
    description: '手机号',
    default: '13386083998',
    type: String,
  })
  phone: string;  // 手机号

  @ApiProperty({
    name: 'section',
    required: true,
    description: '部门',
    default: '技术部',
    type: String,
  })
  section: string;  // 部门

  @ApiProperty({
    name: 'role',
    required: true,
    description: '角色',
    default: '开发',
    type: String,
  })
  role: string;  // 角色

  @ApiProperty({
    name: 'email',
    required: true,
    description: '邮箱',
    default: '123@qq.com',
    type: String,
  })
  email: string;

  @ApiProperty({
    name: 'password',
    description: '密码',
    default: '123456',
    type: String,
  })
  password: string;  // 密码

  @ApiProperty({
    name: 'isActive',
    required: false,
    description: '是否激活',
    default: true,
    type: Boolean,
  })
  isActive?: boolean = true;  // 是否激活，默认为 true
}

export class UpdateUserDto {
  @ApiProperty({
    name: 'userName',
    required: false,
    description: '姓名',
    type: String,
  })
  userName?: string;  // 姓名可选

  @ApiProperty({
    name: 'phone',
    required: false,
    description: '手机号',
    type: String,
  })
  phone?: string;  // 手机号可选

  @ApiProperty({
    name: 'section',
    required: false,
    description: '部门',
    type: String,
  })
  section?: string;  // 部门可选

  @ApiProperty({
    name: 'role',
    required: true,
    description: '角色',
    type: String,
  })
  role?: string;  // 角色

  @ApiProperty({
    name: 'email',
    required: true,
    description: '邮箱',
    type: String,
  })
  email?: string;

  @ApiProperty({
    name: 'isActive',
    required: false,
    description: '是否激活',
    default: true,
    type: Boolean,
  })
  isActive?: boolean = true;
}


export class UpdatePswdDto {
  @ApiProperty({
    name: 'oldPassword',
    required: false,
    description: '旧密码',
    type: String,
  })
  oldPassword?: string;  

  @ApiProperty({
    name: 'newPassword',
    required: false,
    description: '新密码',
    type: String,
  })
  newPassword?: string;  

  @ApiProperty({
    name: 'renewPassword',
    required: false,
    description: '确认密码',
    type: String,
  })
  renewPassword?: string; 
}

export class BindlineDto {
  @ApiProperty({
    name: 'productionLineId',
    required: false,
    description: '产线id',
    type: Number,
  })
  productionLineId?: string;  

}

