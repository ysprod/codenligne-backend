export class CreatePanierDto {
  userId: string;
  achats: Array<{
    offrandeId: string;
    quantite: number;
    date: string;
    prixTotal: number;
  }>;
  totalDepense: number;
}
