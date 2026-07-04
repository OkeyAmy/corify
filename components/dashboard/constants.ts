import type { WantRequest } from '../../app/lib/types';

export type RunState = 'idle' | 'running' | 'success' | 'error';

export const labels = {
  whaletrace: 'WhaleTrace',
  depthscan: 'DepthScan',
  pulsecheck: 'PulseCheck',
  wallet_activity: 'Wallet activity',
  token_depth: 'Token market depth',
  holder_momentum: 'Holder momentum',
};

export const defaults = {
  wallet_activity: 'Vote111111111111111111111111111111111111111',
  token_depth: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  holder_momentum: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
} satisfies Record<WantRequest['questionType'], string>;

export function formatLamports(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export function shortAddress(value: string): string {
  return `${value.slice(0, 6)}...${value.slice(-6)}`;
}

export function shortSignature(value: string): string {
  if (value.length <= 20) return value;
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}
