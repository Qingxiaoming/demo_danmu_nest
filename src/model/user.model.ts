// 工厂 员工
import { Column, Model, Table } from 'sequelize-typescript';

@Table({
  tableName: 'user',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
})
export class User extends Model<User> {


  @Column({
    comment: '工号',
    allowNull: false,
    unique: true,
  })
  code: string;

  @Column({
    comment: '名字',
    allowNull: false,
  })
  userName: string;

  @Column({
    comment: '手机号',
    allowNull: false,
    unique: true,
  })
  phone: string;

  @Column({
    comment: '部门',
  })
  section: string;

  @Column({
    comment: '角色',
  })
  role: string;

  @Column({
    comment: '邮箱',
    unique: true,
  })
  email: string;

  @Column({
    comment: '密码',
    allowNull: false,
  })
  declare password?: string;

  @Column({ defaultValue: true })
  isActive: boolean;

}
