import { SetMetadata } from '@nestjs/common';
import { Permission } from '../enums/permission.enum';

/**
 * Clé de metadata pour les permissions requises
 */
export const PERMISSIONS_KEY = 'permissions';

/**
 * Décorateur pour spécifier les permissions requises sur une route
 * @example
 * @Permissions(Permission.DELETE_ANY_CONSULTATION)
 * @Delete(':id')
 * deleteConsultation() { ... }
 */
export const Permissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
