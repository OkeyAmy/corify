import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Keypair } from '@solana/web3.js';
import { configFromEnv, loadDotEnv, validateSetup } from '../lib/config.js';

loadDotEnv();

const command = process.argv[2] ?? 'check';

if (command === 'keys') {
  await createLocalKeys();
} else if (command === 'check') {
  printChecks();
} else {
  process.stderr.write(
    `Unknown setup command "${command}". Use "check" or "keys".\n`
  );
  process.exitCode = 1;
}

async function createLocalKeys(): Promise<void> {
  const base = resolve('.corify/keys');
  await mkdir(base, { recursive: true });
  const buyer = await ensureKeypair(`${base}/buyer.json`);
  const ledger = await ensureKeypair(`${base}/ledger.json`);
  const seller = await ensureKeypair(`${base}/seller.json`);
  const coralSession = await ensureKeypair(`${base}/coral-session.json`);
  const escrowProgram = await ensureKeypair(
    `${base}/corify-escrow-program.json`
  );
  await updateEnvFile({
    CORAL_AUTH_KEY:
      process.env.CORAL_AUTH_KEY ??
      `corify-local-${randomBytes(24).toString('hex')}`,
    CORAL_BASE_URL: process.env.CORAL_BASE_URL ?? 'http://localhost:5555',
    CORAL_CONNECTION_URL:
      process.env.CORAL_CONNECTION_URL ?? 'stdio://corify-local',
    CORIFY_ESCROW_PROGRAM_ID: escrowProgram.publicKey,
    DEVNET_KEYPAIR_PATH: buyer.path,
    LEDGER_KEYPAIR_PATH: ledger.path,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? '',
    LLM_BASE_URL:
      process.env.LLM_BASE_URL ??
      'https://generativelanguage.googleapis.com/v1beta/openai/',
    LLM_MODEL: process.env.LLM_MODEL ?? 'gemini-3.5-flash',
    LLM_PROVIDER: process.env.LLM_PROVIDER ?? 'gemini',
    SELLER_KEYPAIR_PATH: seller.path,
    SELLER_PUBLIC_KEY: seller.publicKey,
    CORAL_SESSION_KEYPAIR_PATH: coralSession.path,
  });

  process.stdout.write(`Created local devnet key files:\n`);
  process.stdout.write(`DEVNET_KEYPAIR_PATH=${buyer.path}\n`);
  process.stdout.write(`LEDGER_KEYPAIR_PATH=${ledger.path}\n`);
  process.stdout.write(`SELLER_KEYPAIR_PATH=${seller.path}\n`);
  process.stdout.write(`SELLER_PUBLIC_KEY=${seller.publicKey}\n`);
  process.stdout.write(`CORAL_SESSION_KEYPAIR_PATH=${coralSession.path}\n`);
  process.stdout.write(
    `CORIFY_ESCROW_PROGRAM_KEYPAIR_PATH=${escrowProgram.path}\n`
  );
  process.stdout.write(`CORIFY_ESCROW_PROGRAM_ID=${escrowProgram.publicKey}\n`);
  process.stdout.write('CORAL_BASE_URL=http://localhost:5555\n');
  process.stdout.write('CORAL_CONNECTION_URL=stdio://corify-local\n');
  process.stdout.write('CORAL_AUTH_KEY=<generated local token in .env>\n');
  process.stdout.write('LLM_PROVIDER=gemini\n');
  process.stdout.write('LLM_MODEL=gemini-3.5-flash\n');
  process.stdout.write(
    'LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/\n'
  );
  process.stdout.write(
    'GEMINI_API_KEY=<add your Google AI Studio key in .env>\n'
  );
  process.stdout.write('\nFund buyer and ledger on devnet:\n');
  process.stdout.write(`solana airdrop 2 ${buyer.publicKey} --url devnet\n`);
  process.stdout.write(`solana airdrop 1 ${ledger.publicKey} --url devnet\n`);
  process.stdout.write(`solana airdrop 1 ${seller.publicKey} --url devnet\n`);
  process.stdout.write(
    '\nDeploy the escrow program with the generated program keypair, then keep CORIFY_ESCROW_PROGRAM_ID set to that program id.\n'
  );
  process.stdout.write(
    '.env was updated with local key paths, local Coral defaults, seller public key, and escrow program id.\n'
  );
}

async function ensureKeypair(
  path: string
): Promise<{ path: string; publicKey: string }> {
  if (existsSync(path)) {
    const bytes = JSON.parse(await readFile(path, 'utf8')) as Array<number>;
    return {
      path,
      publicKey: Keypair.fromSecretKey(
        Uint8Array.from(bytes)
      ).publicKey.toBase58(),
    };
  }
  await mkdir(dirname(path), { recursive: true });
  const keypair = Keypair.generate();
  await writeFile(path, JSON.stringify([...keypair.secretKey]), {
    mode: 0o600,
  });
  return { path, publicKey: keypair.publicKey.toBase58() };
}

function printChecks(): void {
  const config = configFromEnv();
  const checks = validateSetup(config);
  for (const check of checks) {
    process.stdout.write(
      `${check.ok ? 'OK' : 'MISSING'} ${check.name} - ${check.detail}\n`
    );
  }
  const failedRequired = checks.filter(
    (check) => !check.ok && !check.name.startsWith('CORAL_')
  );
  if (failedRequired.length > 0) process.exitCode = 1;
}

async function updateEnvFile(updates: Record<string, string>): Promise<void> {
  const path = '.env';
  const existing = existsSync(path)
    ? (await readFile(path, 'utf8')).split('\n')
    : [];
  const seen = new Set<string>();
  const lines = existing.map((line) => {
    const match = /^\s*([A-Z0-9_]+)\s*=/.exec(line);
    if (!match) return line;
    const [, key] = match;
    if (!key) return line;
    if (!(key in updates)) return line;
    seen.add(key);
    return `${key}=${updates[key] ?? ''}`;
  });
  for (const [key, value] of Object.entries(updates)) {
    if (!seen.has(key)) lines.push(`${key}=${value}`);
  }
  await writeFile(
    path,
    `${lines.filter((line, index) => line.length > 0 || index < lines.length - 1).join('\n')}\n`,
    {
      mode: 0o600,
    }
  );
}
