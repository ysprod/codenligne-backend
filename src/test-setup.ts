import { Logger } from '@nestjs/common';

/**
 * Les tests exercent volontairement les chemins d'erreur : panne réseau
 * simulée, montant incohérent, référence rejouée, base injoignable. Les
 * journaux Nest qui en résultent sont attendus — les afficher noie les vraies
 * erreurs dans la sortie de `npm test`. Les échecs de tests, eux, restent
 * affichés par Jest.
 *
 * Pour déboguer un test en voyant les logs : `LOG_TESTS=1 npm test`.
 */
if (!process.env.LOG_TESTS) {
  Logger.overrideLogger(false);
  for (const method of ['log', 'error', 'warn', 'debug', 'verbose'] as const) {
    jest.spyOn(Logger.prototype, method).mockImplementation(() => undefined);
  }
}
