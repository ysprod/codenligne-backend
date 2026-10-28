import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { Role } from '../../common/enums/role.enum';
import { AccessStatus } from '../../common/enums/access-status.enum';
import { requireJwtSecret } from '../../common/jwt-secrets';

export interface JwtPayload {
  sub: string;
  email?: string;
  role: Role;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req) => req?.cookies?.codenligne_access_token,
      ]),
      ignoreExpiration: false,
      secretOrKey: requireJwtSecret('JWT_SECRET', configService.get<string>('JWT_SECRET')),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.userModel
      .findById(payload.sub)
      .select('-password -resetPasswordToken -resetPasswordExpires')
      .exec();

    if (!user) throw new UnauthorizedException('User not found');
    if (user.status === AccessStatus.REFUSED) {
      throw new UnauthorizedException('Compte refusé');
    }

    return user;
  }
}