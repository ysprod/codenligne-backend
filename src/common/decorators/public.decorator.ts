import { SetMetadata } from '@nestjs/common';

/**
 * Clé de metadata pour les routes publiques
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Décorateur pour marquer une route comme publique (pas d'authentification requise)
 * @example
 * @Public()
 * @Get('public-data')
 * getPublicData() { ... }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
