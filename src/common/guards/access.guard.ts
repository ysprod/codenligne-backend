import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccessStatus } from '../enums/access-status.enum';
import { Role } from '../enums/role.enum';
import { UserDocument } from '../../users/schemas/user.schema';

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user: UserDocument = request.user;

    // 1. L'utilisateur doit être authentifié (JwtAuthGuard doit passer avant)
    if (!user) {
      throw new UnauthorizedException('Authentification requise');
    }

    // 2. Les administrateurs ne sont pas soumis aux restrictions d'accès à la formation
    // (Ils n'ont pas besoin de accessEndsAt pour utiliser le dashboard admin)
    if (user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN || user.role === Role.PEDAGOGICAL_MANAGER) {
      return true;
    }

    // 3. Vérification stricte pour les apprenants (LEARNER)
    if (user.status === AccessStatus.REFUSED) {
      throw new ForbiddenException("Votre compte a été refusé. Contactez l'assistance.");
    }

    if (user.status === AccessStatus.BLOCKED) {
      throw new ForbiddenException("Votre compte est bloqué. Contactez l'assistance.");
    }

    if (user.status === AccessStatus.PENDING) {
      throw new ForbiddenException("Votre compte est en attente de validation. Vous recevrez un accès dès qu'un administrateur l'aura activé.");
    }

    if (!user.accessEndsAt) {
      throw new ForbiddenException("Aucune date de fin d'accès n'est définie pour votre compte.");
    }

    // 4. Vérification de l'échéance (CDC §3)
    // On compare en UTC. La date de fin est interprétée comme 23:59:59 du jour choisi (Africa/Abidjan = UTC+0).
    const now = new Date();
    const endsAt = new Date(user.accessEndsAt);

    if (now > endsAt) {
      throw new ForbiddenException("Votre accès à la formation a expiré. Contactez l'assistance pour le renouveler.");
    }

    // (Optionnel) Si le statut en base est ACTIVE mais que la date est valide, on laisse passer.
    if (user.status !== AccessStatus.ACTIVE) {
      throw new ForbiddenException("Votre accès n'est pas actif.");
    }

    return true;
  }
}