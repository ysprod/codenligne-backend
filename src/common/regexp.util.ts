/**
 * Échappe les métacaractères d'une chaîne pour une utilisation sûre dans une RegExp
 * ou une clause MongoDB $regex, empêchant les attaques ReDoS (Regular Expression Denial of Service)
 * et les erreurs de syntaxe (Invalid regular expression).
 */
export function escapeRegExp(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Crée une instance RegExp sécurisée après échappement des caractères spéciaux
 */
export function createSafeRegExp(input: string, flags = 'i'): RegExp {
  return new RegExp(escapeRegExp(input), flags);
}
