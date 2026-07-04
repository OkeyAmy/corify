import { readFile } from 'node:fs/promises';
import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import type { PublicKey } from '@solana/web3.js';
import { loadDotEnv, configFromEnv } from '../lib/config.js';

loadDotEnv();

const config = configFromEnv();
if (/mainnet/i.test(config.solanaRpcUrl))
  throw new Error(`Refusing airdrop on mainnet RPC ${config.solanaRpcUrl}`);

const connection = new Connection(config.solanaRpcUrl, 'confirmed');
const targets = [
  { name: 'buyer', path: config.devnetKeypairPath, sol: 1 },
  { name: 'ledger', path: config.ledgerKeypairPath, sol: 0.5 },
  { name: 'seller', path: config.sellerKeypairPath, sol: 0.5 },
];

for (const target of targets) {
  if (!target.path) throw new Error(`${target.name} keypair path is missing`);
  const keypair = await keypairFromFile(target.path);
  await requestAirdrop(target.name, keypair.publicKey, target.sol).catch(
    async (error: unknown) => {
      process.stderr.write(
        `${target.name} airdrop failed: ${error instanceof Error ? error.message : String(error)}\n`
      );
      const balance = await connection
        .getBalance(keypair.publicKey)
        .catch(() => -1);
      process.stderr.write(
        `${target.name} currentBalanceLamports=${String(balance)}\n`
      );
      process.exitCode = 1;
    }
  );
}

async function keypairFromFile(path: string): Promise<Keypair> {
  const bytes = JSON.parse(await readFile(path, 'utf8')) as Array<number>;
  return Keypair.fromSecretKey(Uint8Array.from(bytes));
}

async function requestAirdrop(
  name: string,
  publicKey: PublicKey,
  sol: number
): Promise<void> {
  const before = await connection.getBalance(publicKey);
  const signature = await connection.requestAirdrop(
    publicKey,
    Math.round(sol * LAMPORTS_PER_SOL)
  );
  const latest = await connection.getLatestBlockhash();
  await connection.confirmTransaction({ signature, ...latest }, 'confirmed');
  const after = await connection.getBalance(publicKey);
  process.stdout.write(
    `${name} ${publicKey.toBase58()} airdrop=${signature} before=${String(before)} after=${String(after)}\n`
  );
}
