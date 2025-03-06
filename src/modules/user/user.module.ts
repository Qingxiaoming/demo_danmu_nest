import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { SequelizeModule } from '@nestjs/sequelize';
import { User } from 'src/model/user.model';
import { UsersService } from './user.service';


@Module({
  imports: [SequelizeModule.forFeature([User])],
  controllers: [UserController],
  providers: [UsersService],
})
export class UserModule {}
