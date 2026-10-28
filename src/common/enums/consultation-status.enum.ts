/**
 * Statuts d'une consultation spirituelle
 */
export enum ConsultationStatus {
  PENDING = 'PENDING', // En attente d'attribution
  ASSIGNED = 'ASSIGNED', // Attribuée à un consultant
  COMPLETED = 'COMPLETED', // Terminée
  CANCELLED = 'CANCELLED', // Annulée
  REFUNDED = 'REFUNDED', // Remboursée
}

/**
 * Types de consultations disponibles
 */
export enum ConsultationType {
  NUMEROLOGIE = 'NUMEROLOGIE',
  VIE_PERSONNELLE = 'VIE_PERSONNELLE',
  RELATIONS = 'RELATIONS',
  PROFESSIONNEL = 'PROFESSIONNEL',
  ASTROLOGIE_AFRICAINE = 'ASTROLOGIE_AFRICAINE',
  SPIRITUALITE = 'SPIRITUALITE',
  AUTRE = 'AUTRE',
  CINQ_ETOILES = 'CINQ_ETOILES',
  CYCLES_PERSONNELS = 'CYCLES_PERSONNELS',
  NOMBRES_PERSONNELS = 'NOMBRES_PERSONNELS',
    HOROSCOPE = 'HOROSCOPE',
}
