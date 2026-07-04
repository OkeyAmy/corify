import type {
  AwardMessage,
  BidMessage,
  DeliveryMessage,
  SettlementReceipt,
  VerificationResultMessage,
  WantMessage,
} from '../../lib/types';

export interface CatalogEntry {
  sellerId: 'whaletrace' | 'depthscan' | 'pulsecheck';
  questionType: 'wallet_activity' | 'token_depth' | 'holder_momentum';
  basePriceLamports: number;
  maxPriceLamports?: number;
  confidence: number;
  etaMs: number;
  beat: string;
}

export interface HealthPayload {
  ok: boolean;
  service: 'corify';
  dataMode: 'live' | 'fixture';
  settlementMode: 'live' | 'offline';
}

export interface AuctionResult {
  want: WantMessage;
  bids: Array<BidMessage>;
  award: AwardMessage;
  deposit: SettlementReceipt;
  delivery: DeliveryMessage;
  verification: VerificationResultMessage;
  settlement: SettlementReceipt;
  competitionNote: string;
  consumerSummary?: { text: string };
}

export interface AuctionEvent {
  id: string;
  requestId: string;
  type:
    | 'WANT'
    | 'BID_OPEN'
    | 'BID'
    | 'BID_CLOSED'
    | 'AWARD'
    | 'DEPOSITED'
    | 'DELIVERY'
    | 'VERIFICATION_RESULT'
    | 'RELEASED'
    | 'REFUNDED';
  payload: unknown;
  createdAtMs: number;
}

export interface WantRequest {
  targetAddress: string;
  questionType: WantMessage['questionType'];
  budgetLamports: number;
  forceBadDelivery?: boolean;
}
