import { afterEach, describe, expect, it, vi } from 'vitest';
import { GEMINI_OPENAI_BASE_URL, maybeSummarizeAuction } from '../lib/llm.js';
import type { AuctionResult } from '../engine/auction.js';

describe('LLM summaries', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('skips summaries when provider config is absent', async () => {
    await expect(
      maybeSummarizeAuction(fixtureResult())
    ).resolves.toBeUndefined();
  });

  it('uses the official Gemini OpenAI-compatible base URL', () => {
    expect(GEMINI_OPENAI_BASE_URL).toBe(
      'https://generativelanguage.googleapis.com/v1beta/openai/'
    );
  });

  it('calls Gemini through the OpenAI-compatible chat completions endpoint', async () => {
    vi.stubEnv('LLM_PROVIDER', 'gemini');
    vi.stubEnv('LLM_MODEL', 'gemini-3.5-flash');
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'chatcmpl-test',
          object: 'chat.completion',
          created: 1,
          model: 'gemini-3.5-flash',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: 'Ledger released after balance matched.',
              },
              finish_reason: 'stop',
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    const summary = await maybeSummarizeAuction(fixtureResult());
    const firstFetchInput = fetchMock.mock.calls[0]?.[0];
    const url =
      firstFetchInput instanceof Request
        ? firstFetchInput.url
        : String(firstFetchInput);

    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
    );
    expect(summary?.text).toBe('Ledger released after balance matched.');
  });
});

function fixtureResult(): AuctionResult {
  return {
    want: {
      type: 'WANT',
      requestId: 'req-1',
      targetAddress: 'Vote111111111111111111111111111111111111111',
      questionType: 'wallet_activity',
      budgetLamports: 6_000_000,
    },
    bids: [],
    award: {
      type: 'AWARD',
      requestId: 'req-1',
      winnerSellerId: 'whaletrace',
      priceLamports: 2_000_000,
      scoring: [],
      escrowReference: '11111111111111111111111111111111',
    },
    deposit: {
      action: 'deposit',
      signature: 'deposit',
      explorerUrl: 'https://explorer.solana.com/tx/deposit?cluster=devnet',
    },
    delivery: {
      type: 'DELIVERY',
      requestId: 'req-1',
      escrowReference: '11111111111111111111111111111111',
      sellerId: 'whaletrace',
      questionType: 'wallet_activity',
      targetAddress: 'Vote111111111111111111111111111111111111111',
      answer: { balanceLamports: 1, txCount24h: 1, largestTxLamports: 0 },
      deliveredAtMs: 1,
    },
    verification: {
      type: 'VERIFICATION_RESULT',
      requestId: 'req-1',
      escrowReference: '11111111111111111111111111111111',
      pass: true,
      checked: {
        field: 'balanceLamports',
        delivered: 1,
        reChecked: 1,
        toleranceExceeded: false,
      },
      action: 'release',
    },
    settlement: {
      action: 'release',
      signature: 'release',
      explorerUrl: 'https://explorer.solana.com/tx/release?cluster=devnet',
    },
    competitionNote:
      'Solo eligible seller for this beat; BID to AWARD flow still ran.',
  };
}
