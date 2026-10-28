import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Response } from 'express';
import { Model } from 'mongoose';
import { AccessStatus } from '../common/enums/access-status.enum';
import { Role } from '../common/enums/role.enum';
import { requireJwtSecret } from '../common/jwt-secrets';
import { RedisService } from '../redis/redis.service';
import { User, UserDocument } from '../users/schemas/user.schema';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './strategies/jwt.strategy';

const DUMMY_PASSWORD_HASH = bcrypt.hashSync('codenligne-dummy-password', 10);
const MAX_LOGIN_FAILURES = 10;
const LOGIN_LOCK_SECONDS = 15 * 60;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly accessCookieName = 'codenligne_access_token';
  private readonly refreshCookieName = 'codenligne_refresh_token';

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  // ─── Gestion des cookies ──────────────────────────────
  private getAccessTokenTtlSeconds() {
    return Number(this.configService.get<number>('JWT_EXPIRATION') || 604800);
  }

  private getRefreshTokenTtlSeconds() {
    return Number(this.configService.get<number>('JWT_REFRESH_EXPIRATION') || 2592000);
  }

  private getCookieSameSite(): 'lax' | 'strict' | 'none' {
    const configured = String(this.configService.get<string>('AUTH_COOKIE_SAMESITE') || '').toLowerCase();
    if (configured === 'strict' || configured === 'none' || configured === 'lax') {
      return configured;
    }
    return this.configService.get<string>('NODE_ENV') === 'production' ? 'none' : 'lax';
  }

  private isSecureCookieEnabled() {
    const configured = this.configService.get<string>('AUTH_COOKIE_SECURE');
    if (configured === 'true') return true;
    if (configured === 'false') return false;
    return this.getCookieSameSite() === 'none' || this.configService.get<string>('NODE_ENV') === 'production';
  }

  private getCookieDomain() {
    const domain = this.configService.get<string>('AUTH_COOKIE_DOMAIN');
    return domain?.trim() || undefined;
  }

  private buildCookieOptions(maxAgeMs: number) {
    return {
      httpOnly: true,
      secure: this.isSecureCookieEnabled(),
      sameSite: this.getCookieSameSite(),
      path: '/',
      maxAge: maxAgeMs,
      domain: this.getCookieDomain(),
    } as const;
  }

  private sanitizeUser(user: UserDocument) {
    const userObject = user.toObject();
    const {
      password,
      resetPasswordToken,
      resetPasswordExpires,
      currentRefreshTokenHash,
      currentRefreshTokenIssuedAt,
      ...userWithoutSecrets
    } = userObject;

    void password;
    void resetPasswordToken;
    void resetPasswordExpires;
    void currentRefreshTokenHash;
    void currentRefreshTokenIssuedAt;

    return userWithoutSecrets;
  }

  private setSessionCookies(response: Response, accessToken: string, refreshToken: string) {
    response.setHeader('Cache-Control', 'no-store');
    response.cookie(this.accessCookieName, accessToken, this.buildCookieOptions(this.getAccessTokenTtlSeconds() * 1000));
    response.cookie(this.refreshCookieName, refreshToken, this.buildCookieOptions(this.getRefreshTokenTtlSeconds() * 1000));
  }

  private clearSessionCookies(response: Response) {
    const expiredCookieOptions = { ...this.buildCookieOptions(0), expires: new Date(0) };
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Clear-Site-Data', '"cache", "cookies", "storage"');
    response.cookie(this.accessCookieName, 'logged-out', expiredCookieOptions);
    response.cookie(this.refreshCookieName, 'logged-out', expiredCookieOptions);
  }

  // ─── Sessions (Redis) ─────────────────────────────────
  private async persistRefreshToken(userId: string, refreshToken: string) {
    const saltRounds = Number(this.configService.get('BCRYPT_ROUNDS', 10)) || 10;
    const refreshTokenHash = await bcrypt.hash(refreshToken, saltRounds);
    const key = `session:user:${userId}`;
    const ttl = this.getRefreshTokenTtlSeconds();
    await this.redisService.set(key, refreshTokenHash, ttl);

    await this.userModel.findByIdAndUpdate(userId, {
      currentRefreshTokenHash: refreshTokenHash,
      currentRefreshTokenIssuedAt: new Date(),
    }).exec();
  }

  private async revokeRefreshToken(userId: string) {
    const key = `session:user:${userId}`;
    await this.redisService.del(key);
    await this.userModel.findByIdAndUpdate(userId, {
      $unset: { currentRefreshTokenHash: '', currentRefreshTokenIssuedAt: '' },
    }).exec();
  }

  // 👇 MÉTHODE REMISE ICI
  private async resolveUserIdFromToken(token: string | undefined, secret?: string) {
    if (!token) return null;
    try {
      const payload = this.jwtService.verify<JwtPayload>(token, secret ? { secret } : undefined);
      return payload.sub;
    } catch {
      return null;
    }
  }

  // ─── Issue Session ────────────────────────────────────
  private async issueSession(user: UserDocument, response?: Response) {
    const tokens = await this.generateTokens(user);
    await this.persistRefreshToken(user._id.toString(), tokens.refreshToken);

    if (response) {
      this.setSessionCookies(response, tokens.accessToken, tokens.refreshToken);
    }

    return {
      success: true,
      user: this.sanitizeUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessTokenExpiresIn: this.getAccessTokenTtlSeconds(),
      refreshTokenExpiresIn: this.getRefreshTokenTtlSeconds(),
      authTransport: 'cookie',
      pendingApproval: user.status === AccessStatus.PENDING,
    };
  }

  // ─── Inscription ──────────────────────────────────────
  async register(registerDto: RegisterDto, response?: Response) {
    const { firstName, lastName, username, phone, email, password, acceptedTerms } = registerDto;

    if (!acceptedTerms) {
      throw new BadRequestException("Vous devez accepter les conditions d'utilisation");
    }

    const normalizedUsername = username.toLowerCase().trim();
    const normalizedPhone = phone.trim();
    const normalizedEmail = email?.trim().toLowerCase() || undefined;

    const existing = await this.userModel.findOne({
      $or: [{ username: normalizedUsername }, { phone: normalizedPhone }],
    }).exec();

    if (existing) {
      throw new ConflictException("Un compte existe déjà avec ce nom d'utilisateur ou ce numéro de téléphone.");
    }

    const saltRounds = Number(this.configService.get('BCRYPT_ROUNDS', 10)) || 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const user = new this.userModel({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      username: normalizedUsername,
      phone: normalizedPhone,
      email: normalizedEmail,
      password: hashedPassword,
      role: Role.LEARNER,
      status: AccessStatus.PENDING,
    });

    await user.save();
    return this.issueSession(user, response);
  }

  // ─── Connexion ────────────────────────────────────────
  async login(loginDto: LoginDto, response?: Response) {
    const { username, password } = loginDto;
    const failuresKey = `auth:login-failures:${String(username).toLowerCase()}`;

    if ((await this.getLoginFailures(failuresKey)) >= MAX_LOGIN_FAILURES) {
      throw new HttpException('Trop de tentatives. Réessayez dans 15 min.', HttpStatus.TOO_MANY_REQUESTS);
    }

    const user = await this.validateUser(username, password);

    if (!user) {
      await this.recordLoginFailure(failuresKey, username);
      throw new UnauthorizedException('Identifiants incorrects');
    }

    await this.clearLoginFailures(failuresKey);
    await this.userModel.findByIdAndUpdate(user._id, { lastLoginAt: new Date() });

    return this.issueSession(user, response);
  }

  async validateUser(username: string, password: string): Promise<UserDocument | null> {
    const user = await this.userModel.findOne({ username: username.toLowerCase().trim() }).exec();
    if (!user) {
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return null;

    if (user.status === AccessStatus.REFUSED) {
      throw new UnauthorizedException('Compte refusé. Contactez l’assistance.');
    }

    return user;
  }

  // ─── Gestion des échecs de connexion ──────────────────
  private async getLoginFailures(key: string): Promise<number> {
    try { return Number(await this.redisService.get(key)) || 0; }
    catch (error) {
      this.logger.warn(`Compteur d'échecs indisponible : ${(error as Error).message}`);
      return 0;
    }
  }

  private async recordLoginFailure(key: string, username: string): Promise<void> {
    try {
      const failures = await this.redisService.incr(key);
      if (failures === 1) await this.redisService.getClient().expire(key, LOGIN_LOCK_SECONDS);
    } catch (error) {
      this.logger.warn(`Échec non comptabilisé : ${(error as Error).message}`);
    }
  }

  private async clearLoginFailures(key: string): Promise<void> {
    try { await this.redisService.del(key); } catch {}
  }

  // ─── Tokens ───────────────────────────────────────────
  async generateTokens(user: UserDocument) {
    const payload: JwtPayload = { sub: user._id.toString(), email: user.email ?? '', role: user.role ?? Role.LEARNER };
    const accessToken = this.jwtService.sign(payload, { expiresIn: this.getAccessTokenTtlSeconds() });
    const refreshToken = this.jwtService.sign(payload, {
      secret: requireJwtSecret('JWT_REFRESH_SECRET', this.configService.get<string>('JWT_REFRESH_SECRET')),
      expiresIn: this.getRefreshTokenTtlSeconds(),
    });
    return { accessToken, refreshToken };
  }

  async refreshToken(refreshToken: string | undefined, response?: Response) {
    if (!refreshToken) throw new UnauthorizedException('Missing refresh token');

    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: requireJwtSecret('JWT_REFRESH_SECRET', this.configService.get<string>('JWT_REFRESH_SECRET')),
      });

      const user = await this.userModel.findById(payload.sub).exec();
      if (!user || user.status === AccessStatus.REFUSED) throw new UnauthorizedException('Invalid refresh token');

      const redisKey = `session:user:${user._id}`;
      const redisHash = await this.redisService.get(redisKey);
      if (!redisHash) {
        await this.revokeRefreshToken(user._id.toString());
        throw new UnauthorizedException('Refresh token has been revoked');
      }

      const refreshTokenMatches = await bcrypt.compare(refreshToken, redisHash);
      if (!refreshTokenMatches) {
        await this.revokeRefreshToken(user._id.toString());
        throw new UnauthorizedException('Refresh token rotated or revoked');
      }

      return this.issueSession(user, response);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  // ─── Profil ───────────────────────────────────────────
  async getProfile(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .select('-password -resetPasswordToken -resetPasswordExpires -currentRefreshTokenHash -currentRefreshTokenIssuedAt')
      .exec();

    if (!user) throw new BadRequestException('User not found');

    let effectiveStatus = user.status;
    if (user.status === AccessStatus.ACTIVE && user.accessEndsAt && new Date() > new Date(user.accessEndsAt)) {
      effectiveStatus = AccessStatus.EXPIRED;
    }

    return { ...this.sanitizeUser(user), status: effectiveStatus };
  }

  // ─── Logout ───────────────────────────────────────────
  async logout(options?: { response?: Response; refreshToken?: string; accessToken?: string }) {
    const refreshSecret = requireJwtSecret('JWT_REFRESH_SECRET', this.configService.get<string>('JWT_REFRESH_SECRET'));
    const userIdFromRefreshToken = await this.resolveUserIdFromToken(options?.refreshToken, refreshSecret);
    const userIdFromAccessToken = await this.resolveUserIdFromToken(options?.accessToken);
    const userId = userIdFromRefreshToken || userIdFromAccessToken;

    if (userId) await this.revokeRefreshToken(userId);
    if (options?.response) this.clearSessionCookies(options.response);

    return { message: 'Logout successful', success: true, authTransport: 'cookie', clientCacheAction: 'PURGE_ALL_AUTH_SCOPED_CACHE' };
  }

  // ─── Réinitialisation (CDC §3) ────────────────────────
  async requestPasswordReset(targetUserId: string, actorId: string) {
    const actor = await this.userModel.findById(actorId).exec();
    if (!actor || (actor.role !== Role.ADMIN && actor.role !== Role.SUPER_ADMIN)) {
      throw new UnauthorizedException('Action réservée aux administrateurs');
    }

    const target = await this.userModel.findById(targetUserId).exec();
    if (!target) throw new BadRequestException('Utilisateur introuvable');

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    target.resetPasswordToken = codeHash;
    target.resetPasswordExpires = expiresAt;
    await target.save();

    return { code, expiresAt: expiresAt.toISOString() };
  }

  async confirmPasswordResetByUsername(username: string, code: string, newPassword: string) {
    if (newPassword.length < 8) {
      throw new BadRequestException('Le mot de passe doit contenir au moins 8 caractères');
    }

    const user = await this.userModel.findOne({ username: username.toLowerCase() }).exec();
    if (!user) throw new BadRequestException('Utilisateur introuvable');

    if (!user.resetPasswordToken || !user.resetPasswordExpires) {
      throw new BadRequestException('Aucune demande de réinitialisation en cours');
    }

    if (new Date() > user.resetPasswordExpires) {
      throw new BadRequestException('Code expiré');
    }

    const isValid = await bcrypt.compare(code, user.resetPasswordToken);
    if (!isValid) throw new BadRequestException('Code invalide');

    const saltRounds = Number(this.configService.get('BCRYPT_ROUNDS', 10)) || 10;
    user.password = await bcrypt.hash(newPassword, saltRounds);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await this.revokeRefreshToken(user._id.toString());
    await user.save();

    return { success: true };
  }
}