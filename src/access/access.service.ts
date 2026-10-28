import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { AccessLog, AccessLogDocument } from './schemas/access-log.schema';
import { AccessAction } from '../common/enums/access-action.enum';
import { AccessStatus } from '../common/enums/access-status.enum';
import { Role } from '../common/enums/role.enum';

@Injectable()
export class AccessService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(AccessLog.name) private accessLogModel: Model<AccessLogDocument>,
  ) {}

  // ─── Helpers ──────────────────────────────────────────

  /**
   * Vérifie que l'acteur a le droit de modifier les accès.
   * CDC §2 : gestionnaire pédagogique NON, admin OUI, super admin OUI.
   */
  private assertCanManageAccess(actor: UserDocument) {
    if (actor.role !== Role.ADMIN && actor.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException("Vous n'avez pas les droits pour gérer les accès.");
    }
  }

  /**
   * Vérifie que la date de fin est future (CDC §3).
   * Africa/Abidjan est à UTC+0, la comparaison Date est directe.
   */
  private assertFutureDate(date: Date) {
    if (date.getTime() <= Date.now()) {
      throw new BadRequestException("La date de fin d'accès doit être dans le futur.");
    }
  }

  /**
   * Journalise une décision administrative (CDC §12).
   * Auteur, date, action, motif, ancien/nouveau statut, ancienne/nouvelle date.
   */
  private async logDecision(params: {
    userId: Types.ObjectId;
    actorId: Types.ObjectId;
    action: AccessAction;
    reason?: string;
    previousStatus: AccessStatus;
    newStatus: AccessStatus;
    previousEndsAt?: Date;
    newEndsAt?: Date;
  }) {
    await this.accessLogModel.create(params);
  }

  // ─── Actions administratives ──────────────────────────

  /**
   * Active un compte en attente (CDC §3).
   * Fixe la date de fin d'accès (obligatoire, future).
   */
  async activate(userId: string, actor: UserDocument, accessEndsAtInput: Date | string) {
    this.assertCanManageAccess(actor);

    const accessEndsAt = new Date(accessEndsAtInput);
    this.assertFutureDate(accessEndsAt);

    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    if (user.status === AccessStatus.ACTIVE) {
      throw new BadRequestException('Ce compte est déjà actif.');
    }
    if (user.status === AccessStatus.REFUSED) {
      throw new BadRequestException('Ce compte a été refusé. L\'utilisateur doit créer un nouveau compte.');
    }

    const previousStatus = user.status;
    const previousEndsAt = user.accessEndsAt;

    user.status = AccessStatus.ACTIVE;
    user.accessEndsAt = accessEndsAt;
    user.activatedAt = new Date();
    user.activatedBy = actor._id.toString();
    user.blockReason = undefined;

    await user.save();

    await this.logDecision({
      userId: user._id,
      actorId: actor._id,
      action: AccessAction.ACTIVATE,
      previousStatus,
      newStatus: AccessStatus.ACTIVE,
      previousEndsAt,
      newEndsAt: accessEndsAt,
    });

    return { success: true, user };
  }

  /**
   * Refuse un compte en attente (CDC §3).
   * Décision définitive : l'utilisateur doit créer un nouveau compte.
   * Motif interne obligatoire.
   */
  async refuse(userId: string, actor: UserDocument, reason: string) {
    this.assertCanManageAccess(actor);
    if (!reason?.trim()) throw new BadRequestException('Un motif est requis pour refuser un compte.');

    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    if (user.status !== AccessStatus.PENDING) {
      throw new BadRequestException('Seul un compte en attente peut être refusé.');
    }

    const previousStatus = user.status;

    user.status = AccessStatus.REFUSED;
    user.refusalReason = reason.trim();
    user.accessEndsAt = undefined;

    await user.save();

    await this.logDecision({
      userId: user._id,
      actorId: actor._id,
      action: AccessAction.REFUSE,
      reason: reason.trim(),
      previousStatus,
      newStatus: AccessStatus.REFUSED,
    });

    return { success: true, user };
  }

  /**
   * Bloque un compte (CDC §3).
   * Le blocage manuel est prioritaire sur une date encore valide.
   * Motif interne obligatoire.
   */
  async block(userId: string, actor: UserDocument, reason: string) {
    this.assertCanManageAccess(actor);
    if (!reason?.trim()) throw new BadRequestException('Un motif est requis pour bloquer un compte.');

    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    if (user.status === AccessStatus.BLOCKED) {
      throw new BadRequestException('Ce compte est déjà bloqué.');
    }
    if (user.status === AccessStatus.REFUSED) {
      throw new BadRequestException('Un compte refusé ne peut pas être bloqué.');
    }

    const previousStatus = user.status;
    const previousEndsAt = user.accessEndsAt;

    user.status = AccessStatus.BLOCKED;
    user.blockReason = reason.trim();

    await user.save();

    await this.logDecision({
      userId: user._id,
      actorId: actor._id,
      action: AccessAction.BLOCK,
      reason: reason.trim(),
      previousStatus,
      newStatus: AccessStatus.BLOCKED,
      previousEndsAt,
      newEndsAt: previousEndsAt,
    });

    return { success: true, user };
  }

  /**
   * Réactive un compte bloqué (CDC §3).
   * Exige une nouvelle date future et une action explicite.
   * Prolonger un compte bloqué ne le débloque pas automatiquement.
   */
  async reactivate(userId: string, actor: UserDocument, accessEndsAtInput: Date | string) {
    this.assertCanManageAccess(actor);

    const accessEndsAt = new Date(accessEndsAtInput);
    this.assertFutureDate(accessEndsAt);

    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    if (user.status !== AccessStatus.BLOCKED) {
      throw new BadRequestException('Seul un compte bloqué peut être réactivé.');
    }

    const previousStatus = user.status;
    const previousEndsAt = user.accessEndsAt;

    user.status = AccessStatus.ACTIVE;
    user.accessEndsAt = accessEndsAt;
    user.blockReason = undefined;

    await user.save();

    await this.logDecision({
      userId: user._id,
      actorId: actor._id,
      action: AccessAction.REACTIVATE,
      previousStatus,
      newStatus: AccessStatus.ACTIVE,
      previousEndsAt,
      newEndsAt: accessEndsAt,
    });

    return { success: true, user };
  }

  /**
   * Prolonge la date de fin d'accès d'un compte ACTIF (CDC §3).
   * Ne débloque pas un compte bloqué.
   */
  async extend(userId: string, actor: UserDocument, newAccessEndsAtInput: Date | string) {
    this.assertCanManageAccess(actor);

    const newAccessEndsAt = new Date(newAccessEndsAtInput);
    this.assertFutureDate(newAccessEndsAt);

    const user = await this.userModel.findById(userId).exec();
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    if (user.status !== AccessStatus.ACTIVE) {
      throw new BadRequestException(
        'Seul un compte actif peut être prolongé. Utilisez la réactivation pour un compte bloqué.',
      );
    }

    if (user.accessEndsAt && newAccessEndsAt <= user.accessEndsAt) {
      throw new BadRequestException("La nouvelle date doit être postérieure à l'actuelle.");
    }

    const previousEndsAt = user.accessEndsAt;

    user.accessEndsAt = newAccessEndsAt;

    await user.save();

    await this.logDecision({
      userId: user._id,
      actorId: actor._id,
      action: AccessAction.EXTEND,
      previousStatus: user.status,
      newStatus: user.status,
      previousEndsAt,
      newEndsAt: newAccessEndsAt,
    });

    return { success: true, user };
  }

  /**
   * Récupère l'historique des décisions d'accès pour un utilisateur (CDC §12).
   */
  async getLogs(userId: string) {
    return this.accessLogModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .populate('actorId', 'firstName lastName username')
      .exec();
  }
}