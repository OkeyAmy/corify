import { loadDotEnv } from '../lib/config.js';
import { SolanaIntelligenceClient } from '../lib/data.js';

loadDotEnv();

const rpc = process.env.HELIUS_RPC_URL ?? '';
const birdeye = process.env.BIRDEYE_API_KEY ?? '';
const wallet =
  process.env.DEMO_WALLET_ADDRESS ??
  'Vote111111111111111111111111111111111111111';
const mint =
  process.env.DEMO_TOKEN_MINT ?? 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

const client = new SolanaIntelligenceClient(rpc, birdeye);

const walletActivity = await client.getWalletActivity(wallet);
process.stdout.write(
  `OK WhaleTrace wallet=${wallet} balanceLamports=${String(walletActivity.balanceLamports)} txCount24h=${String(walletActivity.txCount24h)} largestTxLamports=${String(walletActivity.largestTxLamports)}\n`
);

const depth = await client.getTokenDepth(mint);
process.stdout.write(
  `OK DepthScan mint=${mint} price=${String(depth.price)} volume24h=${String(depth.volume24h)} liquidity=${String(depth.liquidity)}\n`
);

const momentum = await client.getHolderMomentum(mint);
process.stdout.write(
  `OK PulseCheck mint=${mint} holderCount=${String(momentum.holderCount)} sampled=${String(momentum.sampledLargestAccounts)} growthRate=${String(momentum.growthRate)}\n`
);
