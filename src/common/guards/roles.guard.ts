import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../enums/role.enum';
import { AccessStatus } from '../enums/access-status.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Aucun rôle requis → autoriser (le JwtAuthGuard a déjà validé l'identité)
    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('Authentification requise');
    }

    // Un compte REFUSED ne doit jamais passer, même avec un rôle
    if (user.status === AccessStatus.REFUSED) {
      throw new ForbiddenException('Compte refusé');
    }

    const hasRole = requiredRoles.some((role) => user.role === role);

    if (!hasRole) {
      throw new ForbiddenException('Accès refusé : rôle insuffisant.');
    }

    return true;
  }
}