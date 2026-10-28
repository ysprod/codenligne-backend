import { ForbiddenException } from '@nestjs/common';
import { Role } from './enums/role.enum';

/**
 * Les permissions personnalisées s'ajoutent à celles du rôle (PermissionsGuard) :
 * `manage:roles` suffit à s'attribuer SUPER_ADMIN. Seul un SUPER_ADMIN peut donc
 * les écrire, à la création comme à la mise à jour — sinon un ADMIN (ou tout
 * porteur de `update:any:user`) s'élève en deux requêtes.
 */
export function assertCanSetCustomPermissions(
  actor: { role?: string } | undefined,
  customPermissions: unknown,
): void {
  if (customPermissions === undefined) {
    return;
  }

  if (actor?.role !== Role.SUPER_ADMIN) {
    throw new ForbiddenException('Seul un SUPER_ADMIN peut modifier les permissions personnalisées');
  }
}
