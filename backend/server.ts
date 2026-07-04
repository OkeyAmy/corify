import express from 'express';
import type { Application } from 'express';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { AuctionEngine } from '../engine/auction.js';
import {
  DemoSettlementClient,
  EnvGuardedSettlementClient,
} from '../contracts/settlement.js';
import { loadDotEnv } from '../lib/config.js';
import { FixtureDataClient, SolanaIntelligenceClient } from '../lib/data.js';
import type { MainnetDataClient } from '../lib/data.js';
import type { QuestionType, WantMessage } from '../lib/types.js';
import { maybeSummarizeAuction } from '../lib/llm.js';

loadDotEnv();

export function createApp(): Application {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'corify',
      dataMode: process.env.CORIFY_DATA_MODE ?? 'live',
      settlementMode: process.env.CORIFY_SETTLEMENT_MODE ?? 'live',
    });
  });

  app.get('/catalog', (_req, res) => {
    res.json([
      {
        sellerId: 'whaletrace',
        questionType: 'wallet_activity',
        basePriceLamports: 2_000_000,
        confidence: 0.9,
      },
      {
        sellerId: 'depthscan',
        questionType: 'token_depth',
        basePriceLamports: 5_000_000,
        confidence: 0.95,
      },
      {
        sellerId: 'pulsecheck',
        questionType: 'holder_momentum',
        basePriceLamports: 3_000_000,
        maxPriceLamports: 6_000_000,
        confidence: 0.7,
      },
    ]);
  });

  app.post('/want', async (req, res, next) => {
    try {
      const want = parseWant(req.body);
      const engine = new AuctionEngine(dataClient(), settlementClient());
      const result = await engine.run(want);
      const consumerSummary = await maybeSummarizeAuction(result);
      res.json(consumerSummary ? { ...result, consumerSummary } : result);
    } catch (error) {
      next(error);
    }
  });

  app.use(
    express.static(resolve(process.cwd(), 'frontend'), { extensions: ['html'] })
  );

  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      res.status(400).json({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  );

  return app;
}

export function parseWant(body: unknown): WantMessage {
  const input = body as Partial<WantMessage>;
  if (
    typeof input.targetAddress !== 'string' ||
    input.targetAddress.length < 32
  ) {
    throw new Error('targetAddress must be a base58 wallet or mint address');
  }
  if (!isQuestionType(input.questionType)) {
    throw new Error(
      'questionType must be wallet_activity, token_depth, or holder_momentum'
    );
  }
  const budgetLamports = Number(input.budgetLamports);
  if (!Number.isInteger(budgetLamports) || budgetLamports <= 0) {
    throw new Error('budgetLamports must be a positive integer');
  }
  return {
    type: 'WANT',
    requestId:
      typeof input.requestId === 'string' ? input.requestId : randomUUID(),
    targetAddress: input.targetAddress,
    questionType: input.questionType,
    budgetLamports,
  };
}

function isQuestionType(value: unknown): value is QuestionType {
  return (
    value === 'wallet_activity' ||
    value === 'token_depth' ||
    value === 'holder_momentum'
  );
}

function dataClient(): MainnetDataClient {
  if (process.env.CORIFY_DATA_MODE === 'fixture')
    return new FixtureDataClient();
  return new SolanaIntelligenceClient(
    process.env.HELIUS_RPC_URL ?? '',
    process.env.BIRDEYE_API_KEY ?? ''
  );
}

function settlementClient() {
  if (process.env.CORIFY_SETTLEMENT_MODE === 'offline')
    return new DemoSettlementClient();
  return new EnvGuardedSettlementClient();
}

if (import.meta.url === `file://${String(process.argv[1])}`) {
  const port = Number(process.env.PORT ?? 8787);
  createApp().listen(port, () => {
    process.stdout.write(
      `Corify backend listening on http://localhost:${String(port)}\n`
    );
  });
}
