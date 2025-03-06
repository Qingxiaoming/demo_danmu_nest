import { Model, Column, Table, DataType } from 'sequelize-typescript';

@Table({ tableName: 'now_queue' })
export class Danmu extends Model<Danmu> {
  @Column({
    type: DataType.STRING,
    primaryKey: true,
  })
  uid: string;

  @Column(DataType.STRING)
  nickname: string;

  @Column(DataType.TEXT)
  text: string;

  @Column(DataType.STRING)
  account: string;

  @Column(DataType.STRING)
  password: string;

  @Column(DataType.STRING)
  status: string;

  @Column(DataType.DATE)
  createtime: Date;
}