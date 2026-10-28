import { Logger } from '@nestjs/common';

const MIN_SECRET_LENGTH = 32;
const logger = new Logger('JwtSecrets');
const warnedShortSecrets = new Set<string>();

export type JwtSecretName = 'JWT_SECRET' | 'JWT_REFRESH_SECRET';

/**
 * Retourne le secret JWT, ou lève une erreur s'il est absent.
 *
 * Aucun secret de repli : l'ancien repli en dur (`'fallback-secret'`, `'changeme'`)
 * permettait de forger des jetons SUPER_ADMIN dès que la variable manquait
 * (audit OWASP A02-1). Appelé à l'initialisation d'AuthModule, l'absence fait
 * donc échouer le démarrage au lieu de passer inaperçue.
 */
export function requireJwtSecret(name: JwtSecretName, value: string | undefined | null): string {
  if (!value || !value.trim()) {
    throw new Error(`${name} manquant : démarrage refusé (aucun secret de repli).`);
  }

  if (value.length < MIN_SECRET_LENGTH && !warnedShortSecrets.has(name)) {
    warnedShortSecrets.add(name);
    logger.warn(`${name} fait moins de ${MIN_SECRET_LENGTH} caractères : à renforcer.`);
  }

  return value;
}
