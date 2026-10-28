import { applyDecorators, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from './roles.decorator';
import { Role } from '../enums/role.enum';

/**
 * Réservé au super administrateur (gestion des collaborateurs, CDC §12).
 */
export function RequireSuperAdmin() {
  return applyDecorators(
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles(Role.SUPER_ADMIN),
  );
}