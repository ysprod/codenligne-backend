/**
 * Rôles disponibles dans le système Mon Étoile
 * Hiérarchie: SUPER_ADMIN > ADMIN > CONSULTANT > USER > GUEST
 */
export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN', // Accès total au système
  ADMIN = 'ADMIN', // Gestion des utilisateurs et consultations
  CONSULTANT = 'CONSULTANT', // Praticien spirituel / Voyant
  USER = 'USER', // Client standard
  GUEST = 'GUEST', // Visiteur non authentifié
 
  LEARNER = 'LEARNER',
  PEDAGOGICAL_MANAGER = 'PEDAGOGICAL_MANAGER',
 
}
 
export const isRoleHigherOrEqual = (userRole: Role, requiredRole: Role): boolean => {
  const hierarchy = {
    [Role.SUPER_ADMIN]: 5,
    [Role.ADMIN]: 4,
    [Role.CONSULTANT]: 3,
    [Role.USER]: 2,
    [Role.GUEST]: 1,
    [Role.LEARNER]: 1,
    [Role.PEDAGOGICAL_MANAGER]: 1
  };

  return hierarchy[userRole] >= hierarchy[requiredRole];
};
