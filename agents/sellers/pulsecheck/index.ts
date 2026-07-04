import type { MainnetDataClient } from '../../../lib/data.js';
import type {
  DeliveryMessage,
  SellerAgent,
  WantMessage,
} from '../../../lib/types.js';

export function createPulseCheck(data: MainnetDataClient): SellerAgent {
  return {
    id: 'pulsecheck',
    questionType: 'holder_momentum',
    bid(want, concurrentRequests = 0) {
      if (want.questionType !== 'holder_momentum') return undefined;
      return {
        type: 'BID',
        requestId: want.requestId,
        sellerId: 'pulsecheck',
        priceLamports: pulseCheckPrice(concurrentRequests),
        confidence: 0.7,
        etaMs: 5_000,
        claimSummary:
          'top holder count + holder growth proxy from largest token accounts',
      };
    },
    async deliver(want: WantMessage): Promise<DeliveryMessage> {
      return {
        type: 'DELIVERY',
        requestId: want.requestId,
        escrowReference: '',
        sellerId: 'pulsecheck',
        questionType: 'holder_momentum',
        targetAddress: want.targetAddress,
        answer: await data.getHolderMomentum(want.targetAddress),
        deliveredAtMs: Date.now(),
      };
    },
  };
}

export function pulseCheckPrice(concurrentRequests: number): number {
  const surged = 3_000_000 * 1.2 ** Math.max(0, concurrentRequests);
  return Math.min(6_000_000, Math.round(surged));
}
