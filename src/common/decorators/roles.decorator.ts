import { SetMetadata } from '@nestjs/common';
import { Role } from '../enums/role.enum';

export const ROLES_KEY = 'roles';

/**
 * Décorateur pour spécifier les rôles autorisés sur une route.
 *
 * @example
 * @Roles(Role.ADMIN, Role.SUPER_ADMIN)
 * @Get('admin-only')
 * adminOnlyRoute() { ... }
 *
 * Rôles CODENLIGNE (CDC §2) :
 * - LEARNER            : apprenant
 * - PEDAGOGICAL_MANAGER : gestionnaire pédagogique
 * - ADMIN              : administrateur
 * - SUPER_ADMIN        : super administrateur
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);