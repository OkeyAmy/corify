import type { MainnetDataClient } from '../../../lib/data.js';
import type {
  DeliveryMessage,
  SellerAgent,
  WantMessage,
} from '../../../lib/types.js';

export function createWhaleTrace(data: MainnetDataClient): SellerAgent {
  return {
    id: 'whaletrace',
    questionType: 'wallet_activity',
    bid(want) {
      if (want.questionType !== 'wallet_activity') return undefined;
      return {
        type: 'BID',
        requestId: want.requestId,
        sellerId: 'whaletrace',
        priceLamports: 2_000_000,
        confidence: 0.9,
        etaMs: 3_000,
        claimSummary: 'balance + 24h tx count + largest tx in window',
      };
    },
    async deliver(want: WantMessage): Promise<DeliveryMessage> {
      const answer = await data.getWalletActivity(want.targetAddress);
      if (process.env.DEMO_FORCE_BAD_DELIVERY === 'whaletrace') {
        answer.balanceLamports += 1_000_000_000;
      }
      return {
        type: 'DELIVERY',
        requestId: want.requestId,
        escrowReference: '',
        sellerId: 'whaletrace',
        questionType: 'wallet_activity',
        targetAddress: want.targetAddress,
        answer,
        deliveredAtMs: Date.now(),
      };
    },
  };
}
