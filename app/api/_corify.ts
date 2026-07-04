import { randomUUID } from 'node:crypto';
import { scoreBids } from '../../agents/buyer/scoring';
import { createDepthScan } from '../../agents/sellers/depthscan';
import { createPulseCheck } from '../../agents/sellers/pulsecheck';
import { createWhaleTrace } from '../../agents/sellers/whaletrace';
import { LedgerVerifier } from '../../agents/verifier/ledger';
import {
  DemoSettlementClient,
  EnvGuardedSettlementClient,
} from '../../contracts/settlement';
import { FixtureDataClient, SolanaIntelligenceClient } from '../../lib/data';
import { maybeSummarizeAuction } from '../../lib/llm';
import type { MainnetDataClient } from '../../lib/data';
import type {
  AwardMessage,
  BidMessage,
  DeliveryMessage,
  QuestionType,
  SellerAgent,
  SettlementClient,
  SettlementReceipt,
  VerificationResultMessage,
  WantMessage,
} from '../../lib/types';
import type { AuctionEvent, CatalogEntry, HealthPayload } from '../lib/types';

interface AuctionResult {
  want: WantMessage;
  bids: Array<BidMessage>;
  award: AwardMessage;
  deposit: SettlementReceipt;
  delivery: DeliveryMessage;
  verification: VerificationResultMessage;
  settlement: SettlementReceipt;
  competitionNote: string;
}

const requests = new Map<string, AuctionResult & { consumerSummary?: { text: string } }>();

export const catalog: Array<CatalogEntry> = [
  {
    sellerId: 'whaletrace',
    questionType: 'wallet_activity',
    basePriceLamports: 2_000_000,
    confidence: 0.9,
    etaMs: 3_000,
    beat: 'Wallet activity: SOL balance, 24h tx count, largest recent transfer.',
  },
  {
    sellerId: 'depthscan',
    questionType: 'token_depth',
    basePriceLamports: 5_000_000,
    confidence: 0.95,
    etaMs: 8_000,
    beat: 'Token market depth: price, 24h volume, liquidity pool depth.',
  },
  {
    sellerId: 'pulsecheck',
    questionType: 'holder_momentum',
    basePriceLamports: 3_000_000,
    maxPriceLamports: 6_000_000,
    confidence: 0.7,
    etaMs: 5_000,
    beat: 'Holder momentum: largest-account holder proxy and growth-rate claim.',
  },
];

export function health(): HealthPayload {
  return {
    ok: true,
    service: 'corify',
    dataMode: dataMode(),
    settlementMode: settlementMode(),
  };
}

export function parseWantPayload(input: unknown): WantMessage {
  const body = input as Partial<WantMessage>;
  if (
    typeof body.targetAddress !== 'string' ||
    body.targetAddress.length < 32
  ) {
    throw new Error('targetAddress must be a base58 wallet or mint address');
  }
  if (!isQuestionType(body.questionType)) {
    throw new Error(
      'questionType must be wallet_activity, token_depth, or holder_momentum'
    );
  }
  const budgetLamports = Number(body.budgetLamports);
  if (!Number.isInteger(budgetLamports) || budgetLamports <= 0) {
    throw new Error('budgetLamports must be a positive integer');
  }
  return {
    type: 'WANT',
    requestId:
      typeof body.requestId === 'string' ? body.requestId : randomUUID(),
    targetAddress: body.targetAddress,
    questionType: body.questionType,
    budgetLamports,
  };
}

export async function runAuction(
  want: WantMessage,
  forceBadDelivery: boolean
): Promise<AuctionResult & { consumerSummary?: { text: string } }> {
  const previousForce = process.env.DEMO_FORCE_BAD_DELIVERY;
  if (forceBadDelivery) {
    process.env.DEMO_FORCE_BAD_DELIVERY = 'whaletrace';
  }
  try {
    const result = await runEngine(want, dataClient(), settlementClient());
    const consumerSummary = await maybeSummarizeAuction(result);
    const stored = consumerSummary ? { ...result, consumerSummary } : result;
    requests.set(want.requestId, stored);
    return stored;
  } finally {
    if (previousForce === undefined) {
      delete process.env.DEMO_FORCE_BAD_DELIVERY;
    } else {
      process.env.DEMO_FORCE_BAD_DELIVERY = previousForce;
    }
  }
}

export function getStoredRequest(
  requestId: string
): (AuctionResult & { consumerSummary?: { text: string } }) | undefined {
  return requests.get(requestId);
}

export function eventsForResult(result: AuctionResult): Array<AuctionEvent> {
  const base = Date.now();
  const create = (
    index: number,
    type: AuctionEvent['type'],
    payload: unknown
  ): AuctionEvent => ({
    id: `${result.want.requestId}-${String(index).padStart(2, '0')}`,
    requestId: result.want.requestId,
    type,
    payload,
    createdAtMs: base + index,
  });

  return [
    create(0, 'WANT', result.want),
    create(1, 'BID_OPEN', {
      requestId: result.want.requestId,
      questionType: result.want.questionType,
    }),
    ...result.bids.map((bid, index) => create(index + 2, 'BID', bid)),
    create(result.bids.length + 2, 'BID_CLOSED', {
      requestId: result.want.requestId,
      bidsReceived: result.bids.length,
    }),
    create(result.bids.length + 3, 'AWARD', result.award),
    create(result.bids.length + 4, 'DEPOSITED', result.deposit),
    create(result.bids.length + 5, 'DELIVERY', result.delivery),
    create(result.bids.length + 6, 'VERIFICATION_RESULT', result.verification),
    create(
      result.bids.length + 7,
      result.verification.pass ? 'RELEASED' : 'REFUNDED',
      result.settlement
    ),
  ];
}

async function runEngine(
  want: WantMessage,
  data: MainnetDataClient,
  settlement: SettlementClient
): Promise<AuctionResult> {
  const sellers: Array<SellerAgent> = [
    createWhaleTrace(data),
    createDepthScan(data),
    createPulseCheck(data),
  ];
  const matching = sellers.filter(
    (seller) => seller.questionType === want.questionType
  );
  const bids = matching.flatMap((seller) => {
    const bid = seller.bid(want);
    return bid ? [bid] : [];
  });
  const award = scoreBids(want, bids);
  const winner = matching.find((seller) => seller.id === award.winnerSellerId);
  if (!winner)
    throw new Error(`Winning seller ${award.winnerSellerId} is not registered`);

  const deposit = await settlement.deposit(award);
  const delivery = await winner.deliver(want);
  delivery.escrowReference = award.escrowReference;
  const verification = await new LedgerVerifier(data).verify(delivery);
  const finalSettlement = verification.pass
    ? await settlement.release(award)
    : await settlement.refund(award);

  return {
    want,
    bids,
    award,
    deposit,
    delivery,
    verification,
    settlement: finalSettlement,
    competitionNote:
      matching.length === 1
        ? 'Solo eligible seller for this beat; BID to AWARD flow still ran.'
        : 'Competitive bid window.',
  };
}

function dataClient(): MainnetDataClient {
  if (dataMode() === 'fixture') return new FixtureDataClient();
  return new SolanaIntelligenceClient(
    process.env.HELIUS_RPC_URL ?? '',
    process.env.BIRDEYE_API_KEY ?? ''
  );
}

function settlementClient(): SettlementClient {
  if (settlementMode() === 'offline') return new DemoSettlementClient();
  return new EnvGuardedSettlementClient();
}

function dataMode(): 'live' | 'fixture' {
  if (process.env.CORIFY_DATA_MODE === 'fixture') return 'fixture';
  if (process.env.CORIFY_DATA_MODE === 'live') return 'live';
  return process.env.HELIUS_RPC_URL ? 'live' : 'fixture';
}

function settlementMode(): 'live' | 'offline' {
  if (process.env.CORIFY_SETTLEMENT_MODE === 'offline') return 'offline';
  if (process.env.CORIFY_SETTLEMENT_MODE === 'live') return 'live';
  return process.env.DEVNET_KEYPAIR_PATH && process.env.SELLER_PUBLIC_KEY
    ? 'live'
    : 'offline';
}

function isQuestionType(value: unknown): value is QuestionType {
  return (
    value === 'wallet_activity' ||
    value === 'token_depth' ||
    value === 'holder_momentum'
  );
}
