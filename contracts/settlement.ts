import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import type {
  AwardMessage,
  SettlementClient,
  SettlementReceipt,
} from '../lib/types.js';

const DEFAULT_DEVNET_RPC = 'https://api.devnet.solana.com';
const DEFAULT_PROGRAM_ID = 'R5NWNg9eRLWWQU81Xbzz5Du1k7jTDeeT92Ty6qCeXet';

export class DemoSettlementClient implements SettlementClient {
  private counter = 0;

  deposit(): Promise<SettlementReceipt> {
    return Promise.resolve(this.receipt('deposit'));
  }

  release(): Promise<SettlementReceipt> {
    return Promise.resolve(this.receipt('release'));
  }

  refund(): Promise<SettlementReceipt> {
    return Promise.resolve(this.receipt('refund'));
  }

  private receipt(action: SettlementReceipt['action']): SettlementReceipt {
    this.counter += 1;
    const signature = `offline-${action}-${this.counter.toString().padStart(2, '0')}`;
    const receipt = {
      action,
      signature,
      explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
    };
    return action === 'deposit'
      ? {
          ...receipt,
          paymentUrl:
            'solana:offline-demo?amount=0&label=Corify%20offline%20deposit&message=Fixture%20deposit',
        }
      : receipt;
  }
}

export class EnvGuardedSettlementClient implements SettlementClient {
  private live?: Promise<SolanaEscrowSettlementClient>;

  async deposit(award: AwardMessage): Promise<SettlementReceipt> {
    return (await this.client()).deposit(award);
  }

  async release(award: AwardMessage): Promise<SettlementReceipt> {
    return (await this.client()).release(award);
  }

  async refund(award: AwardMessage): Promise<SettlementReceipt> {
    return (await this.client()).refund(award);
  }

  private client(): Promise<SolanaEscrowSettlementClient> {
    this.live ??= SolanaEscrowSettlementClient.fromEnv();
    return this.live;
  }
}

export class SolanaEscrowSettlementClient implements SettlementClient {
  constructor(
    private readonly connection: Connection,
    private readonly programId: PublicKey,
    private readonly buyer: Keypair,
    private readonly seller: PublicKey,
    private readonly ledger: Keypair,
    private readonly noDeliveryDeadlineSeconds = 60
  ) {}

  static async fromEnv(): Promise<SolanaEscrowSettlementClient> {
    const buyerPath = requiredEnv('DEVNET_KEYPAIR_PATH');
    const seller = new PublicKey(requiredEnv('SELLER_PUBLIC_KEY'));
    const ledgerPath = process.env.LEDGER_KEYPAIR_PATH ?? buyerPath;
    const rpcUrl = process.env.SOLANA_RPC_URL ?? DEFAULT_DEVNET_RPC;
    assertDevnet(rpcUrl);
    return new SolanaEscrowSettlementClient(
      new Connection(rpcUrl, 'confirmed'),
      new PublicKey(process.env.CORIFY_ESCROW_PROGRAM_ID ?? DEFAULT_PROGRAM_ID),
      await loadKeypairFile(buyerPath),
      seller,
      await loadKeypairFile(ledgerPath)
    );
  }

  async deposit(award: AwardMessage): Promise<SettlementReceipt> {
    const awardRef = new PublicKey(award.escrowReference);
    const escrow = this.escrowPda(awardRef);
    const deadline = BigInt(
      Math.floor(Date.now() / 1000) + this.noDeliveryDeadlineSeconds
    );
    const data = Buffer.concat([
      discriminator('deposit'),
      awardRef.toBuffer(),
      u64(award.priceLamports),
      i64(deadline),
    ]);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.buyer.publicKey, isSigner: true, isWritable: true },
        { pubkey: this.seller, isSigner: false, isWritable: false },
        { pubkey: this.ledger.publicKey, isSigner: false, isWritable: false },
        { pubkey: escrow, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });
    const signature = await sendAndConfirmTransaction(
      this.connection,
      new Transaction().add(ix),
      [this.buyer],
      {
        commitment: 'confirmed',
      }
    );
    return {
      ...receipt('deposit', signature),
      paymentUrl: buildSolanaPayUrl({
        recipient: this.seller,
        awardRef,
        lamports: award.priceLamports,
        requestId: award.requestId,
      }),
    };
  }

  async release(award: AwardMessage): Promise<SettlementReceipt> {
    return this.ledgerSettle('release', award);
  }

  async refund(award: AwardMessage): Promise<SettlementReceipt> {
    return this.ledgerSettle('refund', award);
  }

  private async ledgerSettle(
    action: 'release' | 'refund',
    award: AwardMessage
  ): Promise<SettlementReceipt> {
    const awardRef = new PublicKey(award.escrowReference);
    const escrow = this.escrowPda(awardRef);
    const ix = new TransactionInstruction({
      programId: this.programId,
      keys: [
        { pubkey: this.ledger.publicKey, isSigner: true, isWritable: false },
        { pubkey: this.buyer.publicKey, isSigner: false, isWritable: true },
        { pubkey: this.seller, isSigner: false, isWritable: true },
        { pubkey: escrow, isSigner: false, isWritable: true },
      ],
      data: discriminator(
        action === 'release' ? 'release' : 'refund_by_ledger'
      ),
    });
    const signature = await sendAndConfirmTransaction(
      this.connection,
      new Transaction().add(ix),
      [this.ledger],
      {
        commitment: 'confirmed',
      }
    );
    return receipt(action, signature);
  }

  private escrowPda(awardRef: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from('corify-escrow'),
        this.buyer.publicKey.toBuffer(),
        awardRef.toBuffer(),
      ],
      this.programId
    )[0];
  }
}

export function discriminator(name: string): Buffer {
  return createHash('sha256').update(`global:${name}`).digest().subarray(0, 8);
}

function receipt(
  action: SettlementReceipt['action'],
  signature: string
): SettlementReceipt {
  return {
    action,
    signature,
    explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
  };
}

function buildSolanaPayUrl(input: {
  recipient: PublicKey;
  awardRef: PublicKey;
  lamports: number;
  requestId: string;
}): string {
  const params = new URLSearchParams({
    amount: (input.lamports / 1_000_000_000).toString(),
    reference: input.awardRef.toBase58(),
    label: 'Corify escrow deposit',
    message: `Award ${input.requestId}`,
  });
  return `solana:${input.recipient.toBase58()}?${params.toString()}`;
}

async function loadKeypairFile(path: string): Promise<Keypair> {
  const raw = JSON.parse(await readFile(path, 'utf8')) as Array<number>;
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for live devnet settlement`);
  return value;
}

function assertDevnet(url: string): void {
  if (process.env.ALLOW_MAINNET === '1') return;
  if (/mainnet/i.test(url))
    throw new Error(`Refusing settlement on mainnet RPC: ${url}`);
}

function u64(value: number): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(value));
  return buf;
}

function i64(value: bigint): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigInt64LE(value);
  return buf;
}
