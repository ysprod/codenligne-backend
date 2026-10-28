import { applyDecorators, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from './roles.decorator';
import { Role } from '../enums/role.enum';

/**
 * Réservé aux gestionnaires pédagogiques et au-dessus (contenus, questions, QCM).
 * CDC §2 : le gestionnaire pédagogique gère les cours, la banque de questions
 * et les questionnaires. Il ne valide pas les comptes.
 */
export function RequirePedagogical() {
  return applyDecorators(
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles(Role.PEDAGOGICAL_MANAGER, Role.ADMIN, Role.SUPER_ADMIN),
  );
}