import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { Attempt, AttemptSchema } from '../quizzes/schemas/attempt.schema'; // 👈 Ajout
import { AccessLog, AccessLogSchema } from '../access/schemas/access-log.schema'; // 👈 Ajout

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Attempt.name, schema: AttemptSchema }, // 👈 Ajout
      { name: AccessLog.name, schema: AccessLogSchema }, // 👈 Ajout
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}