import { existsSync, readFileSync } from 'node:fs';
import { PublicKey } from '@solana/web3.js';

export interface CorifyConfig {
  heliusRpcUrl: string;
  birdeyeApiKey: string;
  solanaRpcUrl: string;
  devnetKeypairPath: string;
  ledgerKeypairPath: string;
  sellerKeypairPath: string;
  sellerPublicKey: string;
  coralSessionKeypairPath: string;
  escrowProgramId: string;
  coralBaseUrl: string;
  coralAuthKey: string;
  dataMode: 'live' | 'fixture';
  settlementMode: 'live' | 'offline';
}

export interface SetupCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export function loadDotEnv(path = '.env'): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (key && process.env[key] === undefined) {
      process.env[key] = (rawValue ?? '').replace(/^["']|["']$/g, '');
    }
  }
}

export function configFromEnv(): CorifyConfig {
  return {
    heliusRpcUrl: process.env.HELIUS_RPC_URL ?? '',
    birdeyeApiKey: process.env.BIRDEYE_API_KEY ?? '',
    solanaRpcUrl: process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com',
    devnetKeypairPath: process.env.DEVNET_KEYPAIR_PATH ?? '',
    ledgerKeypairPath: process.env.LEDGER_KEYPAIR_PATH ?? '',
    sellerKeypairPath: process.env.SELLER_KEYPAIR_PATH ?? '',
    sellerPublicKey: process.env.SELLER_PUBLIC_KEY ?? '',
    coralSessionKeypairPath: process.env.CORAL_SESSION_KEYPAIR_PATH ?? '',
    escrowProgramId:
      process.env.CORIFY_ESCROW_PROGRAM_ID ??
      'R5NWNg9eRLWWQU81Xbzz5Du1k7jTDeeT92Ty6qCeXet',
    coralBaseUrl:
      process.env.CORAL_BASE_URL ?? process.env.CORAL_SERVER_URL ?? '',
    coralAuthKey: process.env.CORAL_AUTH_KEY ?? process.env.CORAL_TOKEN ?? '',
    dataMode: process.env.CORIFY_DATA_MODE === 'fixture' ? 'fixture' : 'live',
    settlementMode:
      process.env.CORIFY_SETTLEMENT_MODE === 'offline' ? 'offline' : 'live',
  };
}

export function validateSetup(config = configFromEnv()): Array<SetupCheck> {
  return [
    {
      name: 'HELIUS_RPC_URL',
      ok: config.dataMode === 'fixture' || config.heliusRpcUrl.length > 0,
      detail:
        config.dataMode === 'fixture'
          ? 'fixture mode skips live Helius reads'
          : 'required for WhaleTrace/PulseCheck mainnet reads',
    },
    {
      name: 'BIRDEYE_API_KEY',
      ok: config.dataMode === 'fixture' || config.birdeyeApiKey.length > 0,
      detail:
        config.dataMode === 'fixture'
          ? 'fixture mode skips live Birdeye reads'
          : 'required for DepthScan live reads',
    },
    {
      name: 'SOLANA_RPC_URL',
      ok:
        config.settlementMode === 'offline' ||
        (config.solanaRpcUrl.length > 0 &&
          !/mainnet/i.test(config.solanaRpcUrl)),
      detail:
        'required devnet RPC for settlement; mainnet is refused by default',
    },
    {
      name: 'DEVNET_KEYPAIR_PATH',
      ok:
        config.settlementMode === 'offline' ||
        keypairFileLooksValid(config.devnetKeypairPath),
      detail: 'buyer devnet signer JSON keypair',
    },
    {
      name: 'LEDGER_KEYPAIR_PATH',
      ok:
        config.settlementMode === 'offline' ||
        keypairFileLooksValid(config.ledgerKeypairPath),
      detail: 'Ledger authority devnet signer JSON keypair',
    },
    {
      name: 'SELLER_PUBLIC_KEY',
      ok:
        config.settlementMode === 'offline' ||
        publicKeyLooksValid(config.sellerPublicKey),
      detail: 'seller payout devnet public key',
    },
    {
      name: 'SELLER_KEYPAIR_PATH',
      ok:
        config.settlementMode === 'offline' ||
        keypairFileLooksValid(config.sellerKeypairPath),
      detail:
        'seller devnet keypair retained locally for funding/inspection; settlement only needs public key',
    },
    {
      name: 'CORIFY_ESCROW_PROGRAM_ID',
      ok:
        config.settlementMode === 'offline' ||
        publicKeyLooksValid(config.escrowProgramId),
      detail: 'deployed devnet escrow program id',
    },
    {
      name: 'CORAL_BASE_URL',
      ok: config.coralBaseUrl.length > 0,
      detail: 'required only for live Coral schema/session checks',
    },
    {
      name: 'CORAL_AUTH_KEY',
      ok: config.coralAuthKey.length > 0,
      detail: 'required only for live Coral schema/session checks',
    },
    {
      name: 'CORAL_SESSION_KEYPAIR_PATH',
      ok:
        config.coralSessionKeypairPath.length === 0 ||
        keypairFileLooksValid(config.coralSessionKeypairPath),
      detail: 'optional local signer reserved for Coral/session tooling',
    },
  ];
}

function keypairFileLooksValid(path: string): boolean {
  if (!path || !existsSync(path)) return false;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
    return (
      Array.isArray(parsed) &&
      parsed.length === 64 &&
      parsed.every((value) => Number.isInteger(value))
    );
  } catch {
    return false;
  }
}

function publicKeyLooksValid(value: string): boolean {
  try {
    if (!value) return false;
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}
