import { applyDecorators, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from './roles.decorator';
import { Role } from '../enums/role.enum';

/**
 * Réservé aux administrateurs (ADMIN + SUPER_ADMIN).
 * N'applique PAS AccessGuard : les admins n'ont pas de date d'expiration.
 */
export function RequireAdmin() {
  return applyDecorators(
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles(Role.ADMIN, Role.SUPER_ADMIN),
  );
}