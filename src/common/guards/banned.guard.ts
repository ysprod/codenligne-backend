// banned.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

/**
 * Enregistré en APP_GUARD APRÈS JwtAuthGuard : request.user doit déjà être
 * peuplé, sinon le contrôle ne voit jamais personne (c'était le cas quand il
 * était posé via app.useGlobalGuards, exécuté avant tout garde de contrôleur).
 */
@Injectable()
export class BannedGuard implements CanActivate {
    async canActivate(context: ExecutionContext): Promise<boolean> {
        if (context.getType() !== 'http') {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (user && user.isBanned) {
            throw new ForbiddenException({
                message: 'Votre compte a été banni',
                code: 'ACCOUNT_BANNED',
                reason: user.bannedReason || 'Violation des conditions d\'utilisation'
            });
        }

        return true;
    }
}
