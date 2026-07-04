import type { MainnetDataClient } from '../../lib/data.js';
import { FixtureDataClient, SolanaIntelligenceClient } from '../../lib/data.js';

export function agentDataClient(): MainnetDataClient {
  if (process.env.CORIFY_DATA_MODE === 'fixture')
    return new FixtureDataClient();
  return new SolanaIntelligenceClient(
    process.env.HELIUS_RPC_URL ?? '',
    process.env.BIRDEYE_API_KEY ?? ''
  );
}
