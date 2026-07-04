import OpenAI from 'openai';
import type { AuctionResult } from '../engine/auction.js';

export const GEMINI_OPENAI_BASE_URL =
  'https://generativelanguage.googleapis.com/v1beta/openai/';

export interface ConsumerSummary {
  provider: string;
  model: string;
  text: string;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function maybeSummarizeAuction(
  result: AuctionResult
): Promise<ConsumerSummary | undefined> {
  const provider = (process.env.LLM_PROVIDER ?? '').trim().toLowerCase();
  const model = (process.env.LLM_MODEL ?? '').trim();
  if (!provider || !model) return undefined;

  if (provider === 'venice') {
    const apiKey = process.env.VENICE_API_KEY;
    if (!apiKey) return undefined;
    return summarizeWithOpenAiSdk({
      provider,
      model,
      apiKey,
      baseURL: process.env.LLM_BASE_URL ?? 'https://api.venice.ai/api/v1',
      result,
    });
  }

  if (provider === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return undefined;
    return summarizeWithOpenAiSdk({
      provider,
      model,
      apiKey,
      ...(process.env.LLM_BASE_URL
        ? { baseURL: process.env.LLM_BASE_URL }
        : {}),
      result,
    });
  }

  if (provider === 'gemini') {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return undefined;
    return summarizeWithOpenAiSdk({
      provider,
      model,
      apiKey,
      baseURL: process.env.LLM_BASE_URL ?? GEMINI_OPENAI_BASE_URL,
      result,
    });
  }

  if (provider === 'anthropic') {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return undefined;
    return summarizeAnthropic({ provider, model, apiKey, result });
  }

  return undefined;
}

async function summarizeWithOpenAiSdk(input: {
  provider: string;
  model: string;
  apiKey: string;
  baseURL?: string;
  result: AuctionResult;
}): Promise<ConsumerSummary | undefined> {
  const client = new OpenAI({
    apiKey: input.apiKey,
    baseURL: input.baseURL,
  });
  const completion = await client.chat.completions.create({
    model: input.model,
    messages: summaryMessages(input.result),
    temperature: 0.2,
    max_tokens: 220,
  });
  const text = completion.choices[0]?.message.content?.trim();
  return text
    ? { provider: input.provider, model: input.model, text }
    : undefined;
}

async function summarizeAnthropic(input: {
  provider: string;
  model: string;
  apiKey: string;
  result: AuctionResult;
}): Promise<ConsumerSummary | undefined> {
  const messages = summaryMessages(input.result);
  const system =
    messages.find((message) => message.role === 'system')?.content ?? '';
  const user =
    messages.find((message) => message.role === 'user')?.content ?? '';
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'x-api-key': input.apiKey,
    },
    body: JSON.stringify({
      model: input.model,
      system,
      messages: [{ role: 'user', content: user }],
      max_tokens: 220,
    }),
  });
  if (!response.ok) return undefined;
  const payload = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const text = payload.content
    ?.find((part) => part.type === 'text')
    ?.text?.trim();
  return text
    ? { provider: input.provider, model: input.model, text }
    : undefined;
}

function summaryMessages(result: AuctionResult): Array<ChatMessage> {
  return [
    {
      role: 'system',
      content:
        'You write concise consumer-facing Solana research briefs. Do not invent facts. Mention the winning specialist, checked field, verification action, and the practical meaning in plain language.',
    },
    {
      role: 'user',
      content: JSON.stringify({
        questionType: result.want.questionType,
        targetAddress: result.want.targetAddress,
        winner: result.award.winnerSellerId,
        priceLamports: result.award.priceLamports,
        answer: result.delivery.answer,
        checked: result.verification.checked,
        action: result.verification.action,
        settlementExplorerUrl: result.settlement.explorerUrl,
      }),
    },
  ];
}
