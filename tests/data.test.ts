import { describe, expect, it, vi } from 'vitest';
import { SolanaIntelligenceClient } from '../lib/data.js';

describe('SolanaIntelligenceClient', () => {
  it('uses Birdeye price and token_overview endpoints for DepthScan', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/defi/price')) {
        return response({ data: { value: 123.45 } });
      }
      if (url.includes('/defi/token_overview')) {
        return response({ data: { v24hUSD: 5000, liquidity: 7000 } });
      }
      throw new Error(`unexpected URL ${url}`);
    });
    const client = new SolanaIntelligenceClient(
      'https://rpc.example',
      'bird-key',
      fetchMock as typeof fetch
    );

    const depth = await client.getTokenDepth('Mint111');

    expect(depth).toEqual({ price: 123.45, volume24h: 5000, liquidity: 7000 });
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      'https://public-api.birdeye.so/defi/price?address=Mint111',
      'https://public-api.birdeye.so/defi/token_overview?address=Mint111',
    ]);
  });

  it('requires a Helius/mainnet RPC URL for WhaleTrace live reads', async () => {
    const client = new SolanaIntelligenceClient('', 'bird-key');

    await expect(client.getWalletActivity('wallet')).rejects.toThrow(
      'HELIUS_RPC_URL'
    );
  });
});

function response(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}
