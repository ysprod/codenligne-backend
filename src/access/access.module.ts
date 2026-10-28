import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AccessService } from './access.service';
import { AccessController } from './access.controller'; // 👈 Doit être importé
import { AccessLog, AccessLogSchema } from './schemas/access-log.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AccessLog.name, schema: AccessLogSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [AccessController], // 👈 Doit être déclaré ici
  providers: [AccessService],
  exports: [AccessService],
})
export class AccessModule {}