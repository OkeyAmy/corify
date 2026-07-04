import type {
  HolderMomentumAnswer,
  TokenDepthAnswer,
  WalletActivityAnswer,
} from './types.js';

interface RpcResponse<T> {
  result?: T;
  error?: { message?: string };
}

export interface MainnetDataClient {
  getWalletActivity(address: string): Promise<WalletActivityAnswer>;
  getTokenDepth(mint: string): Promise<TokenDepthAnswer>;
  getHolderMomentum(mint: string): Promise<HolderMomentumAnswer>;
}

export class SolanaIntelligenceClient implements MainnetDataClient {
  constructor(
    private readonly rpcUrl: string,
    private readonly birdeyeApiKey: string,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async getWalletActivity(address: string): Promise<WalletActivityAnswer> {
    const balance = await this.rpc<{ value: number }>('getBalance', [address]);
    const signatures = await this.rpc<
      Array<{ signature: string; blockTime?: number }>
    >('getSignaturesForAddress', [address, { limit: 20 }]);
    const now = Math.floor(Date.now() / 1000);
    const recent = signatures.filter(
      (sig) =>
        typeof sig.blockTime === 'number' && now - sig.blockTime <= 86_400
    );
    const txs = await Promise.all(
      recent.map((sig) =>
        this.rpc<ParsedTransaction>('getTransaction', [
          sig.signature,
          { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 },
        ])
      )
    );
    const largestTxLamports = txs.reduce(
      (largest, tx) => Math.max(largest, largestBalanceDelta(tx, address)),
      0
    );
    return {
      balanceLamports: balance.value,
      txCount24h: recent.length,
      largestTxLamports,
    };
  }

  async getTokenDepth(mint: string): Promise<TokenDepthAnswer> {
    const price = await this.birdeye<{ data?: { value?: number } }>(
      `/defi/price?address=${encodeURIComponent(mint)}`
    );
    const overview = await this.birdeye<{ data?: Record<string, unknown> }>(
      `/defi/token_overview?address=${encodeURIComponent(mint)}`
    );
    const data = overview.data ?? {};
    return {
      price: numberFrom(price.data?.value),
      volume24h: numberFrom(
        data.v24hUSD ?? data.volume24h ?? data.volume24hUSD
      ),
      liquidity: numberFrom(data.liquidity ?? data.liquidityUSD),
    };
  }

  async getHolderMomentum(mint: string): Promise<HolderMomentumAnswer> {
    const largest = await this.rpc<{
      value: Array<{ address: string; owner?: string }>;
    }>('getTokenLargestAccounts', [mint]).catch(async (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      if (!/Too many accounts requested|Too many requests/i.test(message))
        throw error;
      return this.heliusTokenAccountsFallback(mint);
    });
    const sampled = largest.value.slice(0, 10);
    const directOwners = sampled
      .map((account) => account.owner)
      .filter((owner): owner is string => typeof owner === 'string');
    const owners =
      directOwners.length > 0
        ? directOwners
        : await this.tokenAccountOwners(
            sampled.map((account) => account.address)
          );
    let holderCount = 0;
    for (const owner of owners) {
      const ownerAccounts = await this.rpc<{ value: Array<unknown> }>(
        'getTokenAccountsByOwner',
        [owner, { mint }, { encoding: 'jsonParsed' }]
      ).catch(() => ({ value: [] }));
      holderCount += ownerAccounts.value.length > 0 ? 1 : 0;
    }
    const growthRate = owners.length === 0 ? 0 : holderCount / owners.length;
    return { holderCount, sampledLargestAccounts: sampled.length, growthRate };
  }

  private async rpc<T>(method: string, params: unknown): Promise<T> {
    if (!this.rpcUrl)
      throw new Error('HELIUS_RPC_URL is required for live mainnet reads');
    const res = await this.fetchImpl(this.rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: method, method, params }),
    });
    if (!res.ok)
      throw new Error(
        `Solana RPC ${method} failed with HTTP ${String(res.status)}`
      );
    const json = (await res.json()) as RpcResponse<T>;
    if (json.error)
      throw new Error(
        `Solana RPC ${method}: ${json.error.message ?? 'unknown error'}`
      );
    if (json.result === undefined)
      throw new Error(`Solana RPC ${method}: missing result`);
    return json.result;
  }

  private async birdeye<T>(path: string): Promise<T> {
    if (!this.birdeyeApiKey)
      throw new Error('BIRDEYE_API_KEY is required for DepthScan');
    const res = await this.fetchBirdeye(path);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(
        `Birdeye ${path} failed with HTTP ${String(res.status)}${body ? `: ${body.slice(0, 180)}` : ''}`
      );
    }
    return (await res.json()) as T;
  }

  private async fetchBirdeye(path: string): Promise<Response> {
    let last: Response | undefined;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const res = await this.fetchImpl(`https://public-api.birdeye.so${path}`, {
        headers: {
          accept: 'application/json',
          'x-chain': 'solana',
          'X-API-KEY': this.birdeyeApiKey,
        },
      });
      if (res.status !== 429) return res;
      last = res;
      const retryAfter = Number(res.headers.get('retry-after') ?? 2);
      await new Promise((resolve) =>
        setTimeout(resolve, Math.max(1, retryAfter) * 1000)
      );
    }
    return (
      last ??
      this.fetchImpl(`https://public-api.birdeye.so${path}`, {
        headers: {
          accept: 'application/json',
          'x-chain': 'solana',
          'X-API-KEY': this.birdeyeApiKey,
        },
      })
    );
  }

  private async heliusTokenAccountsFallback(
    mint: string
  ): Promise<{ value: Array<{ address: string; owner?: string }> }> {
    const result = await this.rpc<{
      token_accounts?: Array<{ address: string; owner?: string }>;
    }>('getTokenAccounts', { mint, page: 1, limit: 10 });
    return { value: result.token_accounts ?? [] };
  }

  private async tokenAccountOwners(
    addresses: Array<string>
  ): Promise<Array<string>> {
    const accounts = await this.rpc<{
      value: Array<ParsedTokenAccount | null>;
    }>('getMultipleAccounts', [addresses, { encoding: 'jsonParsed' }]);
    return accounts.value
      .map((account) => account?.data?.parsed?.info?.owner)
      .filter((owner): owner is string => typeof owner === 'string');
  }
}

interface ParsedTransaction {
  meta?: {
    preBalances?: Array<number>;
    postBalances?: Array<number>;
  };
  transaction?: {
    message?: {
      accountKeys?: Array<string | { pubkey?: string }>;
    };
  };
}

interface ParsedTokenAccount {
  data?: {
    parsed?: {
      info?: {
        owner?: string;
      };
    };
  };
}

function largestBalanceDelta(tx: ParsedTransaction, address: string): number {
  const keys = tx.transaction?.message?.accountKeys ?? [];
  const index = keys.findIndex(
    (key) => (typeof key === 'string' ? key : key.pubkey) === address
  );
  if (index < 0) return 0;
  const pre = tx.meta?.preBalances?.[index] ?? 0;
  const post = tx.meta?.postBalances?.[index] ?? 0;
  return Math.abs(post - pre);
}

function numberFrom(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export class FixtureDataClient implements MainnetDataClient {
  constructor(
    private readonly wallet: WalletActivityAnswer = {
      balanceLamports: 41_200_000_000,
      txCount24h: 14,
      largestTxLamports: 9_000_000_000,
    },
    private readonly depth: TokenDepthAnswer = {
      price: 142.5,
      volume24h: 62_000_000,
      liquidity: 38_500_000,
    },
    private readonly momentum: HolderMomentumAnswer = {
      holderCount: 20,
      sampledLargestAccounts: 20,
      growthRate: 1,
    }
  ) {}

  getWalletActivity(): Promise<WalletActivityAnswer> {
    return Promise.resolve({ ...this.wallet });
  }

  getTokenDepth(): Promise<TokenDepthAnswer> {
    return Promise.resolve({ ...this.depth });
  }

  getHolderMomentum(): Promise<HolderMomentumAnswer> {
    return Promise.resolve({ ...this.momentum });
  }
}
