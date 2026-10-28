import { NotFoundException } from '@nestjs/common';
import { isValidObjectId, Model, Types } from 'mongoose';
import { PaymentStatus } from '../common/enums/payment-status.enum';
 
/**
 * Un compte ayant payé ne s'efface pas : ses transactions ne référencent leur
 * auteur que par `userId`, l'effacer rend ces paiements anonymes (« — » en
 * admin). Il est désactivé à la place (JwtStrategy refuse les comptes inactifs).
 *
 * « A payé » = argent réel passé par une passerelle (FineoPay, RayMoney,
 * paiement passerelle historique) : abouti, en cours, ou échec encore
 * rattrapable (paiement tardif). Les simulations et crédits manuels ne comptent
 * pas — un compte de test reste effaçable.
 */
const GATEWAY_WALLET_METHODS = ['fineopay', 'raymoney'];
const PAID_GATEWAY_STATUSES = [PaymentStatus.COMPLETED, PaymentStatus.PROCESSING, PaymentStatus.REFUNDED];

export const DEACTIVATED_INSTEAD_OF_DELETED =
  'Compte désactivé au lieu d’être supprimé : il a des paiements, son historique est conservé.';
export const HARD_DELETE_REFUSED =
  'Ce compte a des paiements : il ne peut pas être supprimé définitivement. Désactivez-le (DELETE /users/:id).';

/** userId stocké en string ou en ObjectId selon l'historique : on matche les deux */
function idForms(id: string): (string | Types.ObjectId)[] {
  return Types.ObjectId.isValid(id) ? [id, new Types.ObjectId(id)] : [id];
}

export async function userHasPayments(
  id: string,
  walletTransactionModel: Model<any>,
  paymentModel: Model<any>,
): Promise<boolean> {
  const ids = idForms(id);
  const recoverableSince = new Date(Date.now() -   86_400_000);
  // Collections brutes : pas de cast Mongoose (il convertirait l'ObjectId en string)
  const [walletPayment, gatewayPayment] = await Promise.all([
    walletTransactionModel.collection.findOne(
      {
        userId: { $in: ids },
        paymentMethod: { $in: GATEWAY_WALLET_METHODS },
        $or: [
          { status: { $in: ['completed', 'pending'] } },
          { status: 'failed', createdAt: { $gte: recoverableSince } },
        ],
      },
      { projection: { _id: 1 } },
    ),
    paymentModel.collection.findOne(
      { userId: { $in: ids }, status: { $in: PAID_GATEWAY_STATUSES } },
      { projection: { _id: 1 } },
    ),
  ]);
  return Boolean(walletPayment || gatewayPayment);
}

/**
 * Suppression d'un compte avec garde « a payé » :
 *  - `deactivate` : le compte est désactivé (bouton admin) ;
 *  - `refuse`     : 409 (route explicite de suppression définitive).
 * Un compte effacé perd aussi le payeur figé sur ses paniers non aboutis
 * (données personnelles sans utilité comptable).
 */
export async function removeUserSafely(params: {
  id: string;
  userModel: Model<any>;
}): Promise<{ deleted: boolean; deactivated: boolean }> {
  const { id, userModel,   } = params;
  if (!isValidObjectId(id)) {
    throw new NotFoundException(`Utilisateur avec l'ID ${id} non trouvé`);
  }

  

  const user = await userModel.findByIdAndDelete(id).exec();
  if (!user) throw new NotFoundException(`Utilisateur avec l'ID ${id} non trouvé`);
   
  return { deleted: true, deactivated: false };
}
