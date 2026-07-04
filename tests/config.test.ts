import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Keypair } from '@solana/web3.js';
import { describe, expect, it } from 'vitest';
import { validateSetup } from '../lib/config.js';

describe('setup validation', () => {
  it('reports missing live keys clearly', () => {
    const checks = validateSetup({
      heliusRpcUrl: '',
      birdeyeApiKey: '',
      solanaRpcUrl: 'https://api.devnet.solana.com',
      devnetKeypairPath: '',
      ledgerKeypairPath: '',
      sellerKeypairPath: '',
      sellerPublicKey: '',
      coralSessionKeypairPath: '',
      escrowProgramId: '',
      coralBaseUrl: '',
      coralAuthKey: '',
      dataMode: 'live',
      settlementMode: 'live',
    });

    expect(
      checks.filter((check) => !check.ok).map((check) => check.name)
    ).toContain('HELIUS_RPC_URL');
    expect(
      checks.filter((check) => !check.ok).map((check) => check.name)
    ).toContain('BIRDEYE_API_KEY');
    expect(
      checks.filter((check) => !check.ok).map((check) => check.name)
    ).toContain('DEVNET_KEYPAIR_PATH');
    expect(
      checks.filter((check) => !check.ok).map((check) => check.name)
    ).toContain('SELLER_KEYPAIR_PATH');
  });

  it('accepts locally generated keypair files in live settlement mode', () => {
    const dir = mkdtempSync(join(tmpdir(), 'corify-test-'));
    const buyer = Keypair.generate();
    const ledger = Keypair.generate();
    const seller = Keypair.generate();
    const coralSession = Keypair.generate();
    writeFileSync(
      join(dir, 'buyer.json'),
      JSON.stringify([...buyer.secretKey])
    );
    writeFileSync(
      join(dir, 'ledger.json'),
      JSON.stringify([...ledger.secretKey])
    );
    writeFileSync(
      join(dir, 'seller.json'),
      JSON.stringify([...seller.secretKey])
    );
    writeFileSync(
      join(dir, 'coral-session.json'),
      JSON.stringify([...coralSession.secretKey])
    );

    const checks = validateSetup({
      heliusRpcUrl: 'https://mainnet.helius-rpc.com/?api-key=test',
      birdeyeApiKey: 'bird',
      solanaRpcUrl: 'https://api.devnet.solana.com',
      devnetKeypairPath: join(dir, 'buyer.json'),
      ledgerKeypairPath: join(dir, 'ledger.json'),
      sellerKeypairPath: join(dir, 'seller.json'),
      sellerPublicKey: seller.publicKey.toBase58(),
      coralSessionKeypairPath: join(dir, 'coral-session.json'),
      escrowProgramId: Keypair.generate().publicKey.toBase58(),
      coralBaseUrl: 'http://localhost:5555',
      coralAuthKey: 'dev',
      dataMode: 'live',
      settlementMode: 'live',
    });

    expect(checks.every((check) => check.ok)).toBe(true);
  });
});
