import { Keypair } from '@solana/web3.js';
import type {
  AwardMessage,
  BidMessage,
  ScoringEntry,
  WantMessage,
} from '../../lib/types.js';

export function scoreBids(
  want: WantMessage,
  bids: Array<BidMessage>
): AwardMessage {
  const eligible = bids.filter(
    (bid) => bid.priceLamports <= want.budgetLamports
  );
  if (eligible.length === 0)
    throw new Error(`No bids fit budget ${String(want.budgetLamports)}`);

  const scoring: Array<ScoringEntry> = eligible
    .map((bid) => ({
      sellerId: bid.sellerId,
      confidence: bid.confidence,
      priceLamports: bid.priceLamports,
      score: bid.confidence / bid.priceLamports,
    }))
    .sort((a, b) => b.score - a.score || a.priceLamports - b.priceLamports);

  const winner = scoring[0];
  if (!winner) throw new Error('No winner after scoring');

  return {
    type: 'AWARD',
    requestId: want.requestId,
    winnerSellerId: winner.sellerId,
    priceLamports: winner.priceLamports,
    scoring,
    escrowReference: Keypair.generate().publicKey.toBase58(),
  };
}
