# Corify

Three specialist agents compete to answer one on-chain research question. The buyer pays for the best answer, not the cheapest one — and a fourth agent checks the winner's work against the chain before the money moves.

Corify sells on-demand Solana wallet and token intelligence to other agents. Mainnet is used for live data reads. Devnet is used for escrow settlement, so the demo can prove real release/refund behavior without risking mainnet funds.

## System

- `agents/` — buyer scoring, WhaleTrace, DepthScan, PulseCheck, and Ledger verifier entrypoints.
- `backend/` — Express API for catalog and WANT execution.
- `engine/` — auction lifecycle: WANT, BID, AWARD, DEPOSITED, DELIVERED, VERIFIED, RELEASED/REFUNDED.
- `contracts/escrow/` — Anchor escrow program with Ledger-gated release/refund and timeout refund.
- `contracts/settlement.ts` — devnet settlement client plus Solana Pay deposit URL generation.
- `lib/` — message contracts, Coral text protocol helpers, Solana RPC, Birdeye, OpenAI-compatible LLM summaries, and setup config.
- `frontend/` — consumer landing page plus an interactive research desk backed by `/catalog` and `/want`.
- `.coral/agents/` — Coral agent manifests for buyer, sellers, and Ledger.

## Agents

- `WhaleTrace`: wallet balance, 24h transaction count, largest sampled transaction. Price: `2,000,000` lamports.
- `DepthScan`: Birdeye token price, 24h volume, liquidity. Price: `5,000,000` lamports.
- `PulseCheck`: holder momentum proxy from largest token accounts. Price: `3,000,000` lamports with 1.2x surge per concurrent request, capped at `6,000,000`.
- `Ledger`: mechanical verifier. It re-checks the key claim and releases or refunds escrow.

## Setup

Use pnpm only.

```bash
pnpm install
cp .env.example .env
pnpm run setup:keys
```

`pnpm run setup:keys` creates local devnet keypairs under `.corify/keys/` and updates `.env` with:

- `DEVNET_KEYPAIR_PATH`
- `LEDGER_KEYPAIR_PATH`
- `SELLER_KEYPAIR_PATH`
- `SELLER_PUBLIC_KEY`
- `CORAL_SESSION_KEYPAIR_PATH`
- `CORIFY_ESCROW_PROGRAM_ID`
- `LLM_PROVIDER`
- `LLM_MODEL`
- `LLM_BASE_URL`

Fill these values in `.env`:

```bash
HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=...
BIRDEYE_API_KEY=...
SOLANA_RPC_URL=https://api.devnet.solana.com
GEMINI_API_KEY=...
```

For Coral runtime integration, also set:

```bash
CORAL_BASE_URL=...
CORAL_AUTH_KEY=...
```

The LLM brief is optional. Corify uses the OpenAI SDK for Gemini with Google's OpenAI-compatible base URL:

```bash
LLM_PROVIDER=gemini
LLM_MODEL=gemini-3.5-flash
LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
GEMINI_API_KEY=...
```

Get `GEMINI_API_KEY` from Google AI Studio. The TxLINE, Venice, and base58 wallet secret variables from `solana_coralOS/.env.example` are starter-specific and are not needed for Corify's current backend unless you deliberately add that starter flow back.

`.env`, `.corify/`, `.omx/`, `.skills/`, `solana_coralOS/`, `coral-skill-set/`, and `alphaclaw/` are ignored and must stay local.

## Devnet Funding

Fund the generated local keys before live settlement:

```bash
pnpm run setup:airdrop
```

If the Solana devnet faucet rate-limits or is dry, fund these public keys manually from the Solana faucet or CLI. `setup:airdrop` prints each public key and balance.

## Commands

```bash
pnpm run lint
pnpm run typecheck
pnpm run build
pnpm test
pnpm run setup:check
pnpm run data:smoke
pnpm run coral:check
pnpm run demo
pnpm run backend
```

`pnpm run demo` runs the two required scenarios. In fixture/offline mode it is deterministic. With `CORIFY_DATA_MODE=live`, `CORIFY_SETTLEMENT_MODE=live`, funded devnet keys, and a deployed escrow program, it uses live mainnet data and devnet settlement.

`pnpm run data:smoke` validates the three live data paths:

- WhaleTrace through Helius mainnet RPC.
- DepthScan through Birdeye.
- PulseCheck through Solana RPC, with Helius enhanced token-account fallback when standard RPC limits are hit.

`pnpm run coral:check` verifies that a Coral server is reachable and exposes `/api_v1.json`. If `CORAL_BASE_URL` or `CORAL_AUTH_KEY` is missing, it reports the Coral runtime as blocked instead of inventing payloads.

## API

Start the backend:

```bash
pnpm run backend
```

Then open:

```bash
http://localhost:8787
```

Health:

```bash
curl http://localhost:8787/health
```

Catalog:

```bash
curl http://localhost:8787/catalog
```

Run a WANT:

```bash
curl -X POST http://localhost:8787/want \
  -H 'content-type: application/json' \
  -d '{
    "targetAddress": "Vote111111111111111111111111111111111111111",
    "questionType": "wallet_activity",
    "budgetLamports": 6000000
  }'
```

## Demo Story

Run 1 is the happy path: WhaleTrace delivers a wallet read, Ledger re-fetches the balance, and escrow releases.

Run 2 sets `DEMO_FORCE_BAD_DELIVERY=whaletrace`, adds 1 SOL to the delivered balance, and proves Ledger is real by refunding when the re-check fails.
