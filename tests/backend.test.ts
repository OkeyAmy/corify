import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp, parseWant } from '../backend/server.js';

describe('Corify backend', () => {
  it('exposes health and catalog endpoints', async () => {
    const app = createApp();

    const health = await request(app).get('/health').expect(200);
    const catalog = await request(app).get('/catalog').expect(200);

    expect(health.body.service).toBe('corify');
    expect(
      catalog.body.map((entry: { sellerId: string }) => entry.sellerId)
    ).toEqual(['whaletrace', 'depthscan', 'pulsecheck']);
  });

  it('serves the consumer frontend', async () => {
    const res = await request(createApp()).get('/').expect(200);
    expect(res.text).toContain('Open research desk');
    expect(res.text).toContain('id="market"');
  });

  it('runs a full WANT through the backend in fixture/offline test mode', async () => {
    vi.stubEnv('CORIFY_DATA_MODE', 'fixture');
    vi.stubEnv('CORIFY_SETTLEMENT_MODE', 'offline');
    vi.stubEnv('LLM_PROVIDER', '');

    const res = await request(createApp())
      .post('/want')
      .send({
        targetAddress: 'Vote111111111111111111111111111111111111111',
        questionType: 'wallet_activity',
        budgetLamports: 6_000_000,
      })
      .expect(200);

    expect(res.body.award.winnerSellerId).toBe('whaletrace');
    expect(res.body.verification.action).toBe('release');
    expect(res.body.settlement.explorerUrl).toContain('cluster=devnet');
    vi.unstubAllEnvs();
  });

  it('validates WANT payloads before running agents', () => {
    expect(() =>
      parseWant({
        targetAddress: 'short',
        questionType: 'wallet_activity',
        budgetLamports: 1,
      })
    ).toThrow('targetAddress');
    expect(() =>
      parseWant({
        targetAddress: 'Vote111111111111111111111111111111111111111',
        questionType: 'bad',
        budgetLamports: 1,
      })
    ).toThrow('questionType');
  });
});
