import type {
  DeliveryMessage,
  HolderMomentumAnswer,
  TokenDepthAnswer,
  VerificationResultMessage,
  WalletActivityAnswer,
} from '../../lib/types.js';
import type { MainnetDataClient } from '../../lib/data.js';

export class LedgerVerifier {
  constructor(private readonly data: MainnetDataClient) {}

  async verify(delivery: DeliveryMessage): Promise<VerificationResultMessage> {
    if (delivery.questionType === 'wallet_activity') {
      const delivered = delivery.answer as WalletActivityAnswer;
      const checked = await this.data.getWalletActivity(delivery.targetAddress);
      return result(
        delivery,
        'balanceLamports',
        delivered.balanceLamports,
        checked.balanceLamports,
        0
      );
    }
    if (delivery.questionType === 'token_depth') {
      const delivered = delivery.answer as TokenDepthAnswer;
      const checked = await this.data.getTokenDepth(delivery.targetAddress);
      return result(
        delivery,
        'price',
        delivered.price,
        checked.price,
        Math.abs(checked.price) * 0.02
      );
    }
    const delivered = delivery.answer as HolderMomentumAnswer;
    const checked = await this.data.getHolderMomentum(delivery.targetAddress);
    return result(
      delivery,
      'holderCount',
      delivered.holderCount,
      checked.holderCount,
      1
    );
  }
}

function result(
  delivery: DeliveryMessage,
  field: string,
  delivered: number,
  reChecked: number,
  tolerance: number
): VerificationResultMessage {
  const toleranceExceeded = Math.abs(delivered - reChecked) > tolerance;
  const verification: VerificationResultMessage = {
    type: 'VERIFICATION_RESULT',
    requestId: delivery.requestId,
    escrowReference: delivery.escrowReference,
    pass: !toleranceExceeded,
    checked: { field, delivered, reChecked, toleranceExceeded },
    action: toleranceExceeded ? 'refund' : 'release',
  };
  if (toleranceExceeded)
    verification.reason = `${field} differed beyond tolerance ${String(tolerance)}`;
  return verification;
}
