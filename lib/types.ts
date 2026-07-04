export type QuestionType =
  | 'wallet_activity'
  | 'token_depth'
  | 'holder_momentum';

export type SellerId = 'whaletrace' | 'depthscan' | 'pulsecheck';

export interface WantMessage {
  type: 'WANT';
  requestId: string;
  targetAddress: string;
  questionType: QuestionType;
  budgetLamports: number;
}

export interface BidMessage {
  type: 'BID';
  requestId: string;
  sellerId: SellerId;
  priceLamports: number;
  confidence: number;
  etaMs: number;
  claimSummary: string;
}

export interface ScoringEntry {
  sellerId: SellerId;
  confidence: number;
  priceLamports: number;
  score: number;
}

export interface AwardMessage {
  type: 'AWARD';
  requestId: string;
  winnerSellerId: SellerId;
  priceLamports: number;
  scoring: Array<ScoringEntry>;
  escrowReference: string;
}

export interface WalletActivityAnswer {
  balanceLamports: number;
  txCount24h: number;
  largestTxLamports: number;
}

export interface TokenDepthAnswer {
  price: number;
  volume24h: number;
  liquidity: number;
}

export interface HolderMomentumAnswer {
  holderCount: number;
  sampledLargestAccounts: number;
  growthRate: number;
}

export type DeliveryAnswer =
  | WalletActivityAnswer
  | TokenDepthAnswer
  | HolderMomentumAnswer;

export interface DeliveryMessage {
  type: 'DELIVERY';
  requestId: string;
  escrowReference: string;
  sellerId: SellerId;
  questionType: QuestionType;
  targetAddress: string;
  answer: DeliveryAnswer;
  deliveredAtMs: number;
}

export interface VerificationResultMessage {
  type: 'VERIFICATION_RESULT';
  requestId: string;
  escrowReference: string;
  pass: boolean;
  checked: {
    field: string;
    delivered: number;
    reChecked: number;
    toleranceExceeded: boolean;
  };
  action: 'release' | 'refund';
  reason?: string;
}

export interface SellerAgent {
  id: SellerId;
  questionType: QuestionType;
  bid(want: WantMessage, concurrentRequests?: number): BidMessage | undefined;
  deliver(want: WantMessage): Promise<DeliveryMessage>;
}

export interface SettlementReceipt {
  action: 'deposit' | 'release' | 'refund';
  signature: string;
  explorerUrl: string;
  paymentUrl?: string;
}

export interface SettlementClient {
  deposit(award: AwardMessage): Promise<SettlementReceipt>;
  release(award: AwardMessage): Promise<SettlementReceipt>;
  refund(award: AwardMessage): Promise<SettlementReceipt>;
}
