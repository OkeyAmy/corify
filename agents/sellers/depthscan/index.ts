import type { MainnetDataClient } from '../../../lib/data.js';
import type {
  DeliveryMessage,
  SellerAgent,
  WantMessage,
} from '../../../lib/types.js';

export function createDepthScan(data: MainnetDataClient): SellerAgent {
  return {
    id: 'depthscan',
    questionType: 'token_depth',
    bid(want) {
      if (want.questionType !== 'token_depth') return undefined;
      return {
        type: 'BID',
        requestId: want.requestId,
        sellerId: 'depthscan',
        priceLamports: 5_000_000,
        confidence: 0.95,
        etaMs: 8_000,
        claimSummary: 'current price + 24h volume + liquidity pool depth',
      };
    },
    async deliver(want: WantMessage): Promise<DeliveryMessage> {
      return {
        type: 'DELIVERY',
        requestId: want.requestId,
        escrowReference: '',
        sellerId: 'depthscan',
        questionType: 'token_depth',
        targetAddress: want.targetAddress,
        answer: await data.getTokenDepth(want.targetAddress),
        deliveredAtMs: Date.now(),
      };
    },
  };
}
