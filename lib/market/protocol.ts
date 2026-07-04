import type {
  AwardMessage,
  BidMessage,
  DeliveryMessage,
  QuestionType,
  SellerId,
  VerificationResultMessage,
  WantMessage,
} from '../types.js';

export type MarketVerb =
  | 'WANT'
  | 'BID'
  | 'AWARD'
  | 'DEPOSITED'
  | 'DELIVERY'
  | 'VERIFICATION_RESULT'
  | 'RELEASED'
  | 'REFUNDED';

export interface DepositedMessage {
  type: 'DEPOSITED';
  requestId: string;
  escrowReference: string;
  signature: string;
  explorerUrl: string;
  paymentUrl?: string;
}

export interface SettledMessage {
  type: 'RELEASED' | 'REFUNDED';
  requestId: string;
  escrowReference: string;
  signature: string;
  explorerUrl: string;
}

export type MarketMessage =
  | WantMessage
  | BidMessage
  | AwardMessage
  | DepositedMessage
  | DeliveryMessage
  | VerificationResultMessage
  | SettledMessage;

export function formatMarketMessage(message: MarketMessage): string {
  return `${message.type} ${JSON.stringify(message)}`;
}

export function parseMarketMessage(text: string): MarketMessage | null {
  const trimmed = text.trim();
  const match =
    /^(WANT|BID|AWARD|DEPOSITED|DELIVERY|VERIFICATION_RESULT|RELEASED|REFUNDED)\s+([\s\S]+)$/.exec(
      trimmed
    );
  if (!match) return null;
  const verb = match[1] as MarketVerb;
  const payload = JSON.parse(match[2] ?? '{}') as Partial<MarketMessage>;
  if (payload.type !== verb) return null;
  return payload as MarketMessage;
}

export function parseWantMessage(text: string): WantMessage | null {
  const parsed = parseMarketMessage(text);
  return parsed?.type === 'WANT' ? parsed : null;
}

export function parseBidMessage(text: string): BidMessage | null {
  const parsed = parseMarketMessage(text);
  return parsed?.type === 'BID' ? parsed : null;
}

export function parseAwardMessage(text: string): AwardMessage | null {
  const parsed = parseMarketMessage(text);
  return parsed?.type === 'AWARD' ? parsed : null;
}

export function parseDepositedMessage(text: string): DepositedMessage | null {
  const parsed = parseMarketMessage(text);
  return parsed?.type === 'DEPOSITED' ? parsed : null;
}

export function parseDeliveryMessage(text: string): DeliveryMessage | null {
  const parsed = parseMarketMessage(text);
  return parsed?.type === 'DELIVERY' ? parsed : null;
}

export function parseVerificationResultMessage(
  text: string
): VerificationResultMessage | null {
  const parsed = parseMarketMessage(text);
  return parsed?.type === 'VERIFICATION_RESULT' ? parsed : null;
}

export function sellerForQuestionType(questionType: QuestionType): SellerId {
  if (questionType === 'wallet_activity') return 'whaletrace';
  if (questionType === 'token_depth') return 'depthscan';
  return 'pulsecheck';
}
