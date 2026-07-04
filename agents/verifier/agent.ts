import { LedgerVerifier } from './ledger.js';
import { startCorifyAgent } from '../../lib/coral/agent.js';
import {
  parseDeliveryMessage,
  formatMarketMessage,
} from '../../lib/market/protocol.js';
import { agentDataClient } from '../sellers/common.js';

const ledger = new LedgerVerifier(agentDataClient());

await startCorifyAgent('corify-ledger', async (ctx) => {
  while (true) {
    const mention = await ctx.waitForMention();
    if (!mention) continue;
    const delivery = parseDeliveryMessage(mention.text);
    if (!delivery) continue;
    const verification = await ledger.verify(delivery);
    await ctx.reply(mention, formatMarketMessage(verification));
  }
});
