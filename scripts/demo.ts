import { randomUUID } from 'node:crypto';
import { AuctionEngine } from '../engine/auction.js';
import {
  DemoSettlementClient,
  EnvGuardedSettlementClient,
} from '../contracts/settlement.js';
import { FixtureDataClient, SolanaIntelligenceClient } from '../lib/data.js';
import { loadDotEnv } from '../lib/config.js';
import type { MainnetDataClient } from '../lib/data.js';
import type { WantMessage } from '../lib/types.js';

loadDotEnv();

const ACTIVE_WALLET = 'Vote111111111111111111111111111111111111111';

async function main() {
  const data = dataClient();
  const settlement =
    process.env.CORIFY_SETTLEMENT_MODE === 'offline'
      ? new DemoSettlementClient()
      : new EnvGuardedSettlementClient();

  console.log('Corify');
  console.log(
    '"Three specialist agents compete to answer one on-chain research question. The buyer pays for the best answer, not the cheapest one — and a fourth agent checks the winner\'s work against the chain before the money moves."'
  );
  console.log('');

  console.log('Run 1 — happy path');
  delete process.env.DEMO_FORCE_BAD_DELIVERY;
  const happy = await runWalletScenario(data, settlement);
  console.log(`Winner: ${happy.award.winnerSellerId}`);
  console.log(
    `Ledger: ${happy.verification.action} (${happy.verification.checked.field})`
  );
  console.log(`Explorer: ${happy.settlement.explorerUrl}`);
  console.log('');

  console.log('Run 2 — forced failure');
  process.env.DEMO_FORCE_BAD_DELIVERY = 'whaletrace';
  const failed = await runWalletScenario(data, settlement);
  console.log(`Winner: ${failed.award.winnerSellerId}`);
  console.log(
    `Ledger: ${failed.verification.action} (${failed.verification.reason ?? 'no reason supplied'})`
  );
  console.log(`Explorer: ${failed.settlement.explorerUrl}`);
}

async function runWalletScenario(
  data: MainnetDataClient,
  settlement: DemoSettlementClient | EnvGuardedSettlementClient
) {
  const engine = new AuctionEngine(data, settlement);
  const want: WantMessage = {
    type: 'WANT',
    requestId: randomUUID(),
    targetAddress: process.env.DEMO_WALLET_ADDRESS ?? ACTIVE_WALLET,
    questionType: 'wallet_activity',
    budgetLamports: 6_000_000,
  };
  return engine.run(want);
}

function dataClient(): MainnetDataClient {
  if (process.env.CORIFY_DATA_MODE === 'fixture')
    return new FixtureDataClient();
  return new SolanaIntelligenceClient(
    process.env.HELIUS_RPC_URL ?? '',
    process.env.BIRDEYE_API_KEY ?? ''
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
