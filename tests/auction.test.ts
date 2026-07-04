import { describe, expect, it, vi } from 'vitest';
import { scoreBids } from '../agents/buyer/scoring.js';
import { pulseCheckPrice } from '../agents/sellers/pulsecheck/index.js';
import { LedgerVerifier } from '../agents/verifier/ledger.js';
import { DemoSettlementClient } from '../contracts/settlement.js';
import { AuctionEngine } from '../engine/auction.js';
import { FixtureDataClient } from '../lib/data.js';
import type { DeliveryMessage, WantMessage } from '../lib/types.js';

const walletWant: WantMessage = {
  type: 'WANT',
  requestId: 'req-1',
  targetAddress: 'Vote111111111111111111111111111111111111111',
  questionType: 'wallet_activity',
  budgetLamports: 6_000_000,
};

describe('Corify auction', () => {
  it('routes wallet_activity to WhaleTrace and settles with a Ledger release', async () => {
    const engine = new AuctionEngine(
      new FixtureDataClient(),
      new DemoSettlementClient()
    );

    const result = await engine.run(walletWant);

    expect(result.bids).toHaveLength(1);
    expect(result.bids[0]?.sellerId).toBe('whaletrace');
    expect(result.award.winnerSellerId).toBe('whaletrace');
    expect(result.award.scoring[0]).toMatchObject({
      sellerId: 'whaletrace',
      confidence: 0.9,
      priceLamports: 2_000_000,
    });
    expect(result.award.scoring[0]?.score).toBeCloseTo(0.00000045);
    expect(result.verification.pass).toBe(true);
    expect(result.settlement.action).toBe('release');
    expect(result.settlement.explorerUrl).toContain('cluster=devnet');
    expect(result.competitionNote).toContain('Solo eligible seller');
  });

  it('forces a real Ledger failure by corrupting WhaleTrace delivery', async () => {
    vi.stubEnv('DEMO_FORCE_BAD_DELIVERY', 'whaletrace');
    const engine = new AuctionEngine(
      new FixtureDataClient(),
      new DemoSettlementClient()
    );

    const result = await engine.run(walletWant);

    expect(result.verification.pass).toBe(false);
    expect(result.verification.action).toBe('refund');
    expect(result.verification.checked).toEqual({
      field: 'balanceLamports',
      delivered: 42_200_000_000,
      reChecked: 41_200_000_000,
      toleranceExceeded: true,
    });
    expect(result.settlement.action).toBe('refund');
    vi.unstubAllEnvs();
  });

  it('filters over-budget bids and publishes confidence over price arithmetic', () => {
    const award = scoreBids({ ...walletWant, budgetLamports: 3_000_000 }, [
      {
        type: 'BID',
        requestId: 'req-1',
        sellerId: 'whaletrace',
        priceLamports: 2_000_000,
        confidence: 0.9,
        etaMs: 3_000,
        claimSummary: 'wallet',
      },
      {
        type: 'BID',
        requestId: 'req-1',
        sellerId: 'depthscan',
        priceLamports: 5_000_000,
        confidence: 0.95,
        etaMs: 8_000,
        claimSummary: 'depth',
      },
    ]);

    expect(award.winnerSellerId).toBe('whaletrace');
    expect(award.scoring).toHaveLength(1);
    expect(award.scoring[0]?.score).toBe(0.9 / 2_000_000);
  });

  it('caps PulseCheck surge pricing at 6,000,000 lamports', () => {
    expect(pulseCheckPrice(0)).toBe(3_000_000);
    expect(pulseCheckPrice(1)).toBe(3_600_000);
    expect(pulseCheckPrice(10)).toBe(6_000_000);
  });
});

describe('Ledger verifier tolerances', () => {
  it('allows DepthScan price drift within 2 percent', async () => {
    const delivered = new FixtureDataClient(undefined, {
      price: 100,
      volume24h: 1,
      liquidity: 1,
    });
    const checked = new FixtureDataClient(undefined, {
      price: 101.99,
      volume24h: 1,
      liquidity: 1,
    });
    const delivery: DeliveryMessage = {
      type: 'DELIVERY',
      requestId: 'req-depth',
      escrowReference: 'escrow',
      sellerId: 'depthscan',
      questionType: 'token_depth',
      targetAddress: 'So11111111111111111111111111111111111111112',
      answer: await delivered.getTokenDepth(
        'So11111111111111111111111111111111111111112'
      ),
      deliveredAtMs: 1,
    };

    const result = await new LedgerVerifier(checked).verify(delivery);

    expect(result.pass).toBe(true);
    expect(result.action).toBe('release');
  });
});
