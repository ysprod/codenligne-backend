import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { Permission, getRolePermissions } from '../enums/permission.enum';

/**
 * Guard qui vérifie si l'utilisateur a les permissions requises
 * Pour les permissions "OWN" (:own:), on vérifie juste que l'utilisateur a la permission
 * La vérification de propriété se fait au niveau du service
 * À utiliser après JwtAuthGuard
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Récupérer les permissions requises depuis les metadata
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si aucune permission n'est requise, autoriser l'accès
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    // Récupérer l'utilisateur depuis la request
    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Obtenir les permissions du rôle de l'utilisateur
    const rolePermissions = getRolePermissions(user.role);

    // Obtenir les permissions personnalisées de l'utilisateur (s'il en a)
    const customPermissions = user.customPermissions || [];

    // Combiner toutes les permissions de l'utilisateur
    const userPermissions = [...rolePermissions, ...customPermissions];

    // Vérifier si l'utilisateur a toutes les permissions requises
    // Note: Pour les permissions "OWN", on vérifie juste que l'utilisateur a la permission
    // La vérification de propriété réelle se fait au niveau du service
    const hasAllPermissions = requiredPermissions.every((permission) =>
      userPermissions.includes(permission),
    );

    if (!hasAllPermissions) {
      const missingPermissions = requiredPermissions.filter(
        (permission) => !userPermissions.includes(permission),
      );

      throw new ForbiddenException(
        `Access denied. Missing permissions: ${missingPermissions.join(', ')}`,
      );
    }

    return true;
  }
}
