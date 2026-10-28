/**
 * Statuts de paiement
 */
export enum PaymentStatus {
  PENDING = 'PENDING', // En attente
  PROCESSING = 'PROCESSING', // En cours de traitement
  COMPLETED = 'COMPLETED', // Complété avec succès
  FAILED = 'FAILED', // Échec
  CANCELLED = 'CANCELLED', // Annulé
  REFUNDED = 'REFUNDED', // Remboursé
}

/**
 * Méthodes de paiement acceptées
 */
export enum PaymentMethod {
  CREDIT_CARD = 'CREDIT_CARD',
  DEBIT_CARD = 'DEBIT_CARD',
  STRIPE = 'STRIPE',
  PAYPAL = 'PAYPAL',
  MOBILE_MONEY = 'MOBILE_MONEY', // Pour l'Afrique (Orange Money, MTN, etc.) via FineoPay
  BANK_TRANSFER = 'BANK_TRANSFER',
  CASH = 'CASH',
  FINEOPAY = 'FINEOPAY',
}
