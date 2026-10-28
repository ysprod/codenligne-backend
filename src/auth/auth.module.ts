import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthService } from './auth.service';
import { RedisModule } from '../redis/redis.module';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { User, UserSchema } from '../users/schemas/user.schema';
import { requireJwtSecret } from '../common/jwt-secrets';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        // Secrets obligatoires : absence = échec au démarrage (pas de repli)
        const jwtSecret = requireJwtSecret('JWT_SECRET', configService.get<string>('JWT_SECRET'));
        requireJwtSecret('JWT_REFRESH_SECRET', configService.get<string>('JWT_REFRESH_SECRET'));
        const jwtExpiration = configService.get<number>('JWT_EXPIRATION') || 604800; // 7 days

        return {
          secret: jwtSecret,
          signOptions: {
            expiresIn: jwtExpiration,
          },
        };
      },
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    RedisModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
