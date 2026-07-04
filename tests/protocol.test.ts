import { describe, expect, it } from 'vitest';
import {
  formatMarketMessage,
  parseBidMessage,
  parseMarketMessage,
  sellerForQuestionType,
} from '../lib/market/protocol.js';
import type { BidMessage, WantMessage } from '../lib/types.js';

describe('Corify market protocol', () => {
  it('round-trips typed JSON messages over Coral text threads', () => {
    const want: WantMessage = {
      type: 'WANT',
      requestId: 'req-1',
      targetAddress: 'Vote111111111111111111111111111111111111111',
      questionType: 'wallet_activity',
      budgetLamports: 6_000_000,
    };

    expect(parseMarketMessage(formatMarketMessage(want))).toEqual(want);
  });

  it('parses seller bids without accepting mismatched verbs', () => {
    const bid: BidMessage = {
      type: 'BID',
      requestId: 'req-1',
      sellerId: 'whaletrace',
      priceLamports: 2_000_000,
      confidence: 0.9,
      etaMs: 3_000,
      claimSummary: 'balance + 24h tx count + largest tx in window',
    };

    expect(parseBidMessage(formatMarketMessage(bid))).toEqual(bid);
    expect(parseMarketMessage(`WANT ${JSON.stringify(bid)}`)).toBeNull();
  });

  it('maps each question type to one specialist seller', () => {
    expect(sellerForQuestionType('wallet_activity')).toBe('whaletrace');
    expect(sellerForQuestionType('token_depth')).toBe('depthscan');
    expect(sellerForQuestionType('holder_momentum')).toBe('pulsecheck');
  });
});
