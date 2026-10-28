import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UserDocument } from '../users/schemas/user.schema';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { Role } from '../common/enums/role.enum';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Authentification')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Inscription', description: 'Inscription d’un nouvel apprenant (statut En attente).' })
  @ApiResponse({ status: 201, description: 'Compte créé, en attente de validation.' })
  async register(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authService.register(registerDto, response);
  }

  @Public()
  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Connexion', description: 'Connexion d’un utilisateur.' })
  @ApiResponse({ status: 200, description: 'Connexion réussie.' })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authService.login(loginDto, response);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rafraîchir le token', description: 'Rafraîchit le token d’accès JWT.' })
  @ApiResponse({ status: 200, description: 'Token rafraîchi.' })
  async refreshToken(
    @Body() dto: RefreshTokenDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.authService.refreshToken(
      dto.refreshToken || request.cookies?.codenligne_refresh_token,
      response,
    );
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout' })
  @ApiResponse({ status: 200, description: 'Logout successful.' })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const authorization = request.headers.authorization || '';
    const accessToken = authorization.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length).trim()
      : request.cookies?.codenligne_access_token;

    return this.authService.logout({
      response,
      accessToken,
      refreshToken: request.cookies?.codenligne_refresh_token,
    });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser() user: UserDocument) {
    return this.authService.getProfile(user._id.toString());
  }

  // 👇 Route réservée à l'admin (Générer le code)
  @Post('reset-request')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Génère un code de réinitialisation (admin)' })
  async requestReset(
    @Body() body: { userId: string },
    @CurrentUser() actor: UserDocument,
  ) {
    return this.authService.requestPasswordReset(body.userId, actor._id.toString());
  }

  // 👇 Route publique (l'apprenant confirme avec le code reçu)
  @Public()
  @Post('reset-confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirme la réinitialisation avec le code' })
  async confirmReset(
    @Body() body: { username: string; code: string; newPassword: string },
  ) {
    return this.authService.confirmPasswordResetByUsername(body.username, body.code, body.newPassword);
  }
}