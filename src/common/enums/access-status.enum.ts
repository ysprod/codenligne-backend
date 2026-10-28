/**
 * Statuts d'accès CODENLIGNE — CDC §3
 * Une nouvelle inscription est toujours PENDING.
 * EXPIRED est calculé à partir de accessEndsAt (pas stocké en base).
 */
export enum AccessStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  REFUSED = 'REFUSED',
  BLOCKED = 'BLOCKED',
  EXPIRED = 'EXPIRED',
}