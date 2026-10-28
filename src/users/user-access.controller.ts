import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { assertSelfOrPrivileged } from '../common/resource-access';
import { UserAccessService } from './user-access.service';

@ApiTags('User Access')
@Controller('user-access')
export class UserAccessController {
  constructor(private readonly userAccessService: UserAccessService) {}

  @Get('subscription-info')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Récupérer les informations d\'abonnement de l\'utilisateur connecté',
  })
  @ApiResponse({
    status: 200,
    description: 'Informations d\'abonnement retournées',
  })
  async getMySubscriptionInfo(@Req() req: Request & { user: any }) {
    return this.userAccessService.getSubscriptionInfo(req.user._id);
  }

  @Get('subscription-info/:userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Récupérer les informations d\'abonnement d\'un utilisateur',
  })
  @ApiResponse({
    status: 200,
    description: 'Informations d\'abonnement retournées',
  })
  async getUserSubscriptionInfo(@Param('userId') userId: string, @Req() req: Request & { user: any }) {
    assertSelfOrPrivileged(req.user, userId);
    return this.userAccessService.getSubscriptionInfo(userId);
  }

  @Post('check-access/:rubriqueId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Vérifier si l\'utilisateur connecté a accès à une rubrique',
  })
  @ApiResponse({
    status: 200,
    description: 'Résultat de la vérification d\'accès',
  })
  async checkMyAccessToRubrique(
    @Req() req: Request & { user: any }, 
  ): Promise<{ hasAccess: boolean }> {
    const hasAccess = await this.userAccessService.hasAccessToRubrique(
      req.user._id, 
    );
    return { hasAccess };
  }

  // Pas de route d'activation d'abonnement : `activate-premium` / `activate-integral`
  // activaient un abonnement payant sans paiement, durée fixée par le client
  // (audit OWASP A01-3). L'activation relève du règlement vérifié côté serveur.

  @Delete('cancel-subscription')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Annuler l\'abonnement de l\'utilisateur connecté',
  })
  @ApiResponse({
    status: 200,
    description: 'Abonnement annulé',
  })
  async cancelMySubscription(@Req() req: Request & { user: any }): Promise<{ success: boolean }> {
    await this.userAccessService.cancelSubscription(req.user._id);
    return { success: true };
  }
}
