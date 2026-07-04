import { randomUUID } from 'node:crypto';
import { scoreBids } from './scoring.js';
import { startCorifyAgent } from '../../lib/coral/agent.js';
import {
  formatMarketMessage,
  parseBidMessage,
} from '../../lib/market/protocol.js';
import type { BidMessage, QuestionType, WantMessage } from '../../lib/types.js';

const sellers = (
  process.env.MARKET_SELLERS ?? 'whaletrace,depthscan,pulsecheck'
)
  .split(',')
  .map((seller) => seller.trim())
  .filter(Boolean);

await startCorifyAgent('corify-buyer', async (ctx) => {
  for (const seller of sellers) {
    try {
      await ctx.waitForAgent(seller, 8_000);
    } catch {
      // Agent may already be connected; the wait is a readiness hint.
    }
  }
  const thread = await ctx.createThread('corify-market', sellers);
  const want = wantFromEnv();
  await ctx.send(formatMarketMessage(want), thread, sellers);

  const bids: Array<BidMessage> = [];
  const deadline = Date.now() + Number(process.env.BID_WINDOW_MS ?? 10_000);
  while (Date.now() < deadline) {
    const mention = await ctx.waitForMention(
      Math.max(500, deadline - Date.now())
    );
    if (!mention) continue;
    const bid = parseBidMessage(mention.text);
    if (bid?.requestId === want.requestId) bids.push(bid);
  }

  const award = scoreBids(want, bids);
  await ctx.send(formatMarketMessage(award), thread, [award.winnerSellerId]);
});

function wantFromEnv(): WantMessage {
  const questionType = parseQuestionType(
    process.env.CORIFY_QUESTION_TYPE ?? 'wallet_activity'
  );
  const targetAddress =
    process.env.CORIFY_TARGET_ADDRESS ?? process.env.DEMO_WALLET_ADDRESS;
  if (!targetAddress)
    throw new Error('CORIFY_TARGET_ADDRESS or DEMO_WALLET_ADDRESS is required');
  return {
    type: 'WANT',
    requestId: process.env.CORIFY_REQUEST_ID ?? randomUUID(),
    targetAddress,
    questionType,
    budgetLamports: Number(process.env.CORIFY_BUDGET_LAMPORTS ?? 6_000_000),
  };
}

function parseQuestionType(value: string): QuestionType {
  if (
    value === 'wallet_activity' ||
    value === 'token_depth' ||
    value === 'holder_momentum'
  )
    return value;
  throw new Error(`Unsupported CORIFY_QUESTION_TYPE ${value}`);
}
