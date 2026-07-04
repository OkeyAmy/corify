import { createDepthScan } from '../agents/sellers/depthscan/index.js';
import { createPulseCheck } from '../agents/sellers/pulsecheck/index.js';
import { createWhaleTrace } from '../agents/sellers/whaletrace/index.js';
import { LedgerVerifier } from '../agents/verifier/ledger.js';
import { scoreBids } from '../agents/buyer/scoring.js';
import type {
  AwardMessage,
  BidMessage,
  DeliveryMessage,
  SellerAgent,
  SettlementClient,
  SettlementReceipt,
  VerificationResultMessage,
  WantMessage,
} from '../lib/types.js';
import type { MainnetDataClient } from '../lib/data.js';

export interface AuctionResult {
  want: WantMessage;
  bids: Array<BidMessage>;
  award: AwardMessage;
  deposit: SettlementReceipt;
  delivery: DeliveryMessage;
  verification: VerificationResultMessage;
  settlement: SettlementReceipt;
  competitionNote: string;
}

export class AuctionEngine {
  private readonly sellers: Array<SellerAgent>;
  private readonly ledger: LedgerVerifier;

  constructor(
    data: MainnetDataClient,
    private readonly settlement: SettlementClient,
    sellers: Array<SellerAgent> = [
      createWhaleTrace(data),
      createDepthScan(data),
      createPulseCheck(data),
    ]
  ) {
    this.sellers = sellers;
    this.ledger = new LedgerVerifier(data);
  }

  async run(want: WantMessage, concurrentRequests = 0): Promise<AuctionResult> {
    const matching = this.sellers.filter(
      (seller) => seller.questionType === want.questionType
    );
    const bids = matching.flatMap((seller) => {
      const bid = seller.bid(want, concurrentRequests);
      return bid ? [bid] : [];
    });
    const award = scoreBids(want, bids);
    const winner = matching.find(
      (seller) => seller.id === award.winnerSellerId
    );
    if (!winner)
      throw new Error(
        `Winning seller ${award.winnerSellerId} is not registered`
      );

    const deposit = await this.settlement.deposit(award);
    const delivery = await winner.deliver(want);
    delivery.escrowReference = award.escrowReference;
    const verification = await this.ledger.verify(delivery);
    const settlement = verification.pass
      ? await this.settlement.release(award)
      : await this.settlement.refund(award);

    return {
      want,
      bids,
      award,
      deposit,
      delivery,
      verification,
      settlement,
      competitionNote:
        matching.length === 1
          ? 'Solo eligible seller for this beat; BID to AWARD flow still ran.'
          : 'Competitive bid window.',
    };
  }
}
