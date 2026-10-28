import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';

/**
 * DTO pour la mise à jour d'un utilisateur
 * Tous les champs sont optionnels sauf le password (sécurité)
 */
export class UpdateUserDto extends PartialType(OmitType(CreateUserDto, ['password'] as const)) {
  /** Email optionnel pour la mise à jour */
  email?: string;
  aspectsTexte?: any; 
  aspectsTexteBrute?: any;

  /** Carte du ciel astrologique (optionnel) */
  carteDuCiel?: any;
}
