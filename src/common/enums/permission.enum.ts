/**
 * Permissions granulaires pour le système Mon Étoile
 * Format: ACTION:SCOPE:RESOURCE
 * - ACTION: create, read, update, delete
 * - SCOPE: own (ses propres ressources), any (toutes les ressources)
 * - RESOURCE: user, consultation, service, payment
 */
export enum Permission {
  // ========== USERS ==========
  CREATE_USER = 'create:user',
  READ_OWN_USER = 'read:own:user',
  READ_ANY_USER = 'read:any:user',
  UPDATE_OWN_USER = 'update:own:user',
  UPDATE_ANY_USER = 'update:any:user',
  DELETE_OWN_USER = 'delete:own:user',
  DELETE_ANY_USER = 'delete:any:user',
  MANAGE_ROLES = 'manage:roles',

  // ========== CONSULTATIONS ==========
  CREATE_CONSULTATION = 'create:consultation',
  READ_OWN_CONSULTATION = 'read:own:consultation',
  READ_ANY_CONSULTATION = 'read:any:consultation',
  UPDATE_OWN_CONSULTATION = 'update:own:consultation',
  UPDATE_ANY_CONSULTATION = 'update:any:consultation',
  DELETE_OWN_CONSULTATION = 'delete:own:consultation',
  DELETE_ANY_CONSULTATION = 'delete:any:consultation',
  ASSIGN_CONSULTATION = 'assign:consultation', // Attribuer une consultation à un consultant

  // ========== SERVICES ==========
  CREATE_SERVICE = 'create:service',
  READ_SERVICE = 'read:service',
  UPDATE_SERVICE = 'update:service',
  DELETE_SERVICE = 'delete:service',

  // ========== CONTENT & SPIRITUALITY ==========
  MANAGE_CONTENT = 'manage:content',  
  CREATE_CONTENT = 'create:content',
  UPDATE_CONTENT = 'update:content',
  DELETE_CONTENT = 'delete:content',

  // ========== PAYMENTS ==========
  CREATE_PAYMENT = 'create:payment',
  READ_OWN_PAYMENT = 'read:own:payment',
  READ_ANY_PAYMENT = 'read:any:payment',
  UPDATE_PAYMENT = 'update:payment',
  REFUND_PAYMENT = 'refund:payment',

  // ========== STATISTICS & REPORTS ==========
  VIEW_STATISTICS = 'view:statistics',
  VIEW_REPORTS = 'view:reports',
  EXPORT_DATA = 'export:data',

  // ========== SYSTEM ==========
  MANAGE_SYSTEM = 'manage:system',
  VIEW_LOGS = 'view:logs',
}

/**
 * Matrice des permissions par rôle
 * Définit quelles permissions sont accordées à chaque rôle
 */
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  SUPER_ADMIN: [
    // Toutes les permissions
    ...Object.values(Permission),
  ],

  ADMIN: [
    // Users
    Permission.CREATE_USER,
    Permission.READ_ANY_USER,
    Permission.UPDATE_ANY_USER,
    Permission.DELETE_ANY_USER,
    // Consultations
    Permission.READ_ANY_CONSULTATION,
    Permission.UPDATE_ANY_CONSULTATION,
    Permission.DELETE_ANY_CONSULTATION,
    Permission.ASSIGN_CONSULTATION,
    // Services
    Permission.CREATE_SERVICE,
    Permission.READ_SERVICE,
    Permission.UPDATE_SERVICE,
    Permission.DELETE_SERVICE,
    // Content & Spirituality
    Permission.MANAGE_CONTENT,
    Permission.CREATE_CONTENT,
    Permission.UPDATE_CONTENT,
    Permission.DELETE_CONTENT,
    // Payments
    Permission.READ_ANY_PAYMENT,
    Permission.UPDATE_PAYMENT,
    Permission.REFUND_PAYMENT,
    // Stats
    Permission.VIEW_STATISTICS,
    Permission.VIEW_REPORTS,
    Permission.EXPORT_DATA,
  ],

  CONSULTANT: [
    // Own profile
    Permission.READ_OWN_USER,
    Permission.UPDATE_OWN_USER,
    // Consultations assigned to them
    Permission.READ_ANY_CONSULTATION, // Voir les consultations qui leur sont attribuées
    Permission.UPDATE_ANY_CONSULTATION, // Mettre à jour les consultations en cours
    // Services (read only)
    Permission.READ_SERVICE,
    // Own payments
    Permission.READ_OWN_PAYMENT,
    // Stats (own)
    Permission.VIEW_STATISTICS,
  ],

  USER: [
    // Own profile
    Permission.READ_OWN_USER,
    Permission.UPDATE_OWN_USER,
    Permission.DELETE_OWN_USER,
    // Own consultations
    Permission.CREATE_CONSULTATION,
    Permission.READ_OWN_CONSULTATION,
    Permission.UPDATE_OWN_CONSULTATION,
    Permission.DELETE_OWN_CONSULTATION,
    // Services (read only)
    Permission.READ_SERVICE,
    // Own payments
    Permission.CREATE_PAYMENT,
    Permission.READ_OWN_PAYMENT,
  ],

  GUEST: [
    // Services (public access)
    Permission.READ_SERVICE,
    // Own consultations (guests can create and manage their own)
    Permission.CREATE_CONSULTATION,
    Permission.READ_OWN_CONSULTATION,
    Permission.UPDATE_OWN_CONSULTATION,
    Permission.DELETE_OWN_CONSULTATION,
  ],
};

/**
 * Vérifie si un rôle a une permission spécifique
 */
export const hasPermission = (role: string, permission: Permission): boolean => {
  return ROLE_PERMISSIONS[role]?.includes(permission) || false;
};

/**
 * Obtient toutes les permissions d'un rôle
 */
export const getRolePermissions = (role: string): Permission[] => {
  return ROLE_PERMISSIONS[role] || [];
};
