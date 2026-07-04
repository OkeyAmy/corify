import { startCorifyAgent } from '../../../lib/coral/agent.js';
import {
  formatMarketMessage,
  parseAwardMessage,
  parseWantMessage,
} from '../../../lib/market/protocol.js';
import { createPulseCheck } from './index.js';
import { agentDataClient } from '../common.js';
import type { WantMessage } from '../../../lib/types.js';

const seller = createPulseCheck(agentDataClient());
const wants = new Map<string, WantMessage>();

await startCorifyAgent('pulsecheck', async (ctx) => {
  while (true) {
    const mention = await ctx.waitForMention();
    if (!mention) continue;
    const want = parseWantMessage(mention.text);
    if (want) {
      wants.set(want.requestId, want);
      const concurrent = Number(
        process.env.PULSECHECK_CONCURRENT_REQUESTS ?? 0
      );
      const bid = seller.bid(want, concurrent);
      if (bid) await ctx.reply(mention, formatMarketMessage(bid));
      continue;
    }
    const award = parseAwardMessage(mention.text);
    if (award?.winnerSellerId === seller.id) {
      const want = wants.get(award.requestId);
      if (!want) throw new Error(`No stored WANT for ${award.requestId}`);
      const delivery = await seller.deliver(want);
      delivery.escrowReference = award.escrowReference;
      await ctx.reply(mention, formatMarketMessage(delivery));
    }
  }
});
