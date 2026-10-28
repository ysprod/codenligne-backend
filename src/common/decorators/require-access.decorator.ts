import { applyDecorators, UseGuards } from '@nestjs/common';
import { AccessGuard } from '../guards/access.guard';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

/**
 * Décorateur à utiliser sur toutes les routes protégées de l'espace apprenant.
 * Applique à la fois l'authentification (JWT) et la vérification du statut d'accès.
 */
export function RequireAccess() {
  return applyDecorators(
    UseGuards(JwtAuthGuard, AccessGuard),
  );
}