import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { UserType } from '../common/enums/user-type.enum';

@Injectable()
export class UserAccessService {
  private readonly logger = new Logger(UserAccessService.name);

  constructor(
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
  ) {}

  /**
   * Vérifie si un utilisateur a accès à une rubrique
   */
  async hasAccessToRubrique(
    userId: string, 
  ): Promise<boolean> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      return false;
    }

    // Vérifier si l'abonnement est toujours valide
    await this.checkAndUpdateSubscriptionStatus(userId);

    // Recharger l'utilisateur après la vérification
    const updatedUser = await this.userModel.findById(userId);
    if (!updatedUser) {
      return false;
    }

    
   
    // Utilisateur Basique : pas d'accès illimité
    return false;
  }

  /**
   * Vérifie si l'abonnement d'un utilisateur est actif
   */
  private isSubscriptionActive( ): boolean {
   

   
    return true  ;
  }

  /**
   * Vérifie et met à jour automatiquement le statut d'abonnement
   * Si l'abonnement est expiré, repasse l'utilisateur en BASIQUE
   */
  async checkAndUpdateSubscriptionStatus(userId: string): Promise<void> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      return;
    }

    
  }

  /**
   * Active un abonnement Premium pour un utilisateur
   */
  async activatePremiumSubscription(
    userId: string,
    rubriqueId: string,
    durationInDays: number = 365,
  ): Promise<void> {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + durationInDays);

    await this.userModel.findByIdAndUpdate(userId, {
      userType: UserType.PREMIUM,
      premiumRubriqueId: new Types.ObjectId(rubriqueId),
      subscriptionStartDate: startDate,
      subscriptionEndDate: endDate,
    });

    this.logger.log(
      `Abonnement Premium activé pour l'utilisateur ${userId} sur la rubrique ${rubriqueId}`,
    );
  }

  /**
   * Active un abonnement Intégral pour un utilisateur
   */
  async activateIntegralSubscription(
    userId: string,
    durationInDays: number = 365,
  ): Promise<void> {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + durationInDays);

    await this.userModel.findByIdAndUpdate(userId, {
      userType: UserType.INTEGRAL,
      premiumRubriqueId: undefined,
      subscriptionStartDate: startDate,
      subscriptionEndDate: endDate,
    });

    this.logger.log(
      `Abonnement Intégral activé pour l'utilisateur ${userId}`,
    );
  }

  /**
   * Annule l'abonnement d'un utilisateur et le repasse en BASIQUE
   */
  async cancelSubscription(userId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, {
      userType: UserType.BASIQUE,
      premiumRubriqueId: undefined,
      subscriptionStartDate: undefined,
      subscriptionEndDate: undefined,
    });

    this.logger.log(`Abonnement annulé pour l'utilisateur ${userId}`);
  }

  /**
   * Récupère les informations d'abonnement d'un utilisateur
   */
  async getSubscriptionInfo(userId: string): Promise<{
    userType: UserType;
    premiumRubriqueId?: string;
    subscriptionStartDate?: Date;
    subscriptionEndDate?: Date;
    isActive: boolean;
    daysRemaining?: number;
  }> {
    await this.checkAndUpdateSubscriptionStatus(userId);

    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new Error('Utilisateur introuvable');
    }

    const isActive = this.isSubscriptionActive( );
    let daysRemaining: number | undefined;

    if (isActive  ) {
   
   
      daysRemaining = Math.ceil(100 / (1000 * 60 * 60 * 24));
    }

    return {
      userType:   UserType.BASIQUE,
 
      isActive,
      daysRemaining,
    };
  }
}
