import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Guard qui vérifie la présence et la validité du JWT token
 * Peut être bypassé avec le décorateur @Public()
 *
 * Enregistré en APP_GUARD (app.module.ts) : toute route est authentifiée par
 * défaut, une route publique doit le déclarer avec @Public(). Oublier un garde
 * produit donc un 401 visible, plus une fuite silencieuse (audit OWASP A06-4).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Les gateways WebSocket authentifient leur handshake elles-mêmes.
    if (context.getType() !== 'http') {
      return true;
    }

    // Vérifier si la route est marquée comme publique
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Déjà authentifié par le garde global : un @UseGuards(JwtAuthGuard) local
    // ne relance pas la validation (et sa requête Mongo).
    if (context.switchToHttp().getRequest()?.user) {
      return true;
    }

    // Sinon, vérifier le JWT token
    return super.canActivate(context);
  }
}
