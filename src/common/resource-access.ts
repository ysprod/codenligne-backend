import { ForbiddenException } from '@nestjs/common';
import { Role } from './enums/role.enum';

type Actor = { _id?: { toString(): string } | string; role?: string } | undefined;

export function isPrivilegedRole(role: string | undefined): boolean {
  return role === Role.ADMIN || role === Role.SUPER_ADMIN;
}

/**
 * Contrôle de propriété pour les routes qui prennent un :userId en paramètre :
 * seul l'utilisateur lui-même ou un ADMIN/SUPER_ADMIN y accède (audit OWASP A01-7).
 */
export function assertSelfOrPrivileged(actor: Actor, userId: string | undefined): void {
  const actorId = actor?._id?.toString();
  if (!actorId) {
    throw new ForbiddenException('Utilisateur non authentifié');
  }
  if (isPrivilegedRole(actor?.role)) {
    return;
  }
  if (!userId || userId !== actorId) {
    throw new ForbiddenException("Accès refusé aux données d'un autre utilisateur");
  }
}
