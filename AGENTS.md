# Corify — v1 Build Spec (execute exactly as written)

This is the only spec document. There is no prior version to reconcile against — build this, not something adjacent to it. Every decision below is final. Where something would normally be "your call," it isn't — the call has been made. If the coding agent hits a genuine blocker (an API is down, a key won't provision), it should log the blocker and use the stated fallback, not improvise a different product direction.

---

## 0. What we're actually up against

The track is Solana × CoralOS at the Imperial AI Agent Hackathon (Imperial AI Society / Imperial Blockchain & FinTech Society / UK AI Agents Lab). $5,000 pool, $3,000 for 1st. Judged 40% technology (CoralOS runtime + market protocol + escrow, working devnet demo, architecture quality), 30% impact (a service worth buying, settlement that survives dispute/no-show), 30% creativity & UX (novel agents/mechanisms, watchable transaction flow, clarity).

The starter kit (`github.com/trilltino/solana_coralOS`) gives every team the same eight layers: frontend, `deliverService()`, seller persona, buyer, Solana Pay escrow, "new agents" slot, runtime, escrow contract. **Most submissions will be a single-persona reskin of the starter** — one seller, one buyer, cosmetic changes to the pricing config, a demo video of one transaction going through. That's the floor. It will not win.

The pattern that actually wins this class of hackathon is proven and public: look at how AlphaClaw scored at the SURGE × OpenClaw hackathon — a coordinator agent buys from six independent specialist agents, each selling a narrow, real data stream via micropayment, with reputation-adjusted pricing (0.5x–1.5x based on track record), and every hop is a real on-chain payment, not a mocked one. That is the shape to beat: **multiple genuinely different specialists, real external data, a coordinating buyer that reasons over what it's paying for, and a verification step that can actually catch a bad answer live.** We are building that shape, on CoralOS's actual escrow/market protocol instead of x402, for a vertical you already have real working knowledge of.

(see AlphaClaw[alphaclaw/] at the OpenClaw/SURGE hackathon: a graph of narrow specialist agents selling data to a coordinator via micropayments, with dynamic reputation-adjusted pricing)

---

## 1. The product — decided, not a category

**Name: Corify.**

**One-line pitch, verbatim, use this everywhere (deck, video, README):** _"Three specialist agents compete to answer one on-chain research question. The buyer pays for the best answer, not the cheapest one — and a fourth agent checks the winner's work against the chain before the money moves."_

**What it sells:** on-demand Solana wallet/token intelligence. A buyer agent posts a real question about a real Solana address or token — "what does this wallet's recent activity look like," "what does this token's current market depth look like" — and three specialist sellers compete to answer it. This is not synthetic demo data. Every seller pulls live Solana mainnet data at query time. The market transaction (bid, escrow, payment, refund) happens on devnet, exactly as the starter kit is built to do — **mainnet for data, devnet for money.** State this split explicitly in the pitch; it's a strength, not a caveat, because it's the only way to have both real data and free, fast, judge-safe settlement.

**Why an agent (not a human) is the customer, and why now:** other AI agents — trading agents, portfolio agents, due-diligence agents — need fast, sourced answers about specific wallets and tokens to make decisions, and right now they either hardcode one data provider or can't reason about which source to trust. A competitive market where specialists bid and a verifier checks the winner is the more capital-efficient answer than every agent maintaining its own set of API integrations.

---

## 2. The four agents — exact roles, no substitutes

Use this analogy verbatim when explaining the system to anyone, including in the demo narration: **this is a newsroom, not a vending machine.** A buyer (the editor) puts out an assignment. Three reporters (the sellers) each specialize in a different beat and race to file. The editor doesn't just take whoever files first or cheapest — they weigh price against each reporter's track record and what they're actually claiming to have found, inside a fixed budget. Before anything runs, a fact-checker (the verifier) independently checks the winning reporter's key claim against the primary source before the reporter gets paid. If the fact-checker catches an error, the story gets killed and the editor gets their money back.

### Seller 1 — **WhaleTrace**

- **Beat:** wallet activity. Given a Solana wallet address, reports: current SOL balance, count of transactions in the last 24h, and the largest single transaction amount in that window.
- **Data source:** direct Solana JSON-RPC calls (`getBalance`, `getSignaturesForAddress`, then `getTransaction` on the top N signatures) against a mainnet RPC endpoint.
- **Pricing:** cheapest of the three. Base price fixed at 2,000,000 lamports. Fast (target under 3s), shallow (doesn't inspect every transaction, samples the most recent 20).

### Seller 2 — **DepthScan**

- **Beat:** token market depth. Given a token mint address, reports: current price, 24h volume, and liquidity pool depth.
- **Data source:** Birdeye public API (`/defi/price`, `/defi/token_overview` endpoints) — requires a free API key, see §9.
- **Pricing:** premium. Base price fixed at 5,000,000 lamports. Slower (target 5–8s), deeper analysis, claims higher confidence.

### Seller 3 — **PulseCheck**

- **Beat:** holder momentum, as a real, mechanical, on-chain proxy for "sentiment" — do not attempt to integrate a social media API tonight, that's a live-demo failure point and an unnecessary dependency. Given a token mint address, reports: holder count now vs. holder count from the largest N token accounts' first-seen slot, expressed as a growth-rate claim over the lookback window.
- **Data source:** `getTokenLargestAccounts` + `getTokenAccountsByOwner` mainnet RPC calls, same endpoint as WhaleTrace.
- **Pricing:** surge-priced — starts at 3,000,000 lamports and scales up 1.2x for every concurrent request in the same bid window, capped at 6,000,000. This is your "surge-pricer" persona, implemented as an actual formula, not a flavor label.

### Verifier — **Ledger** (the new fourth agent)

- **Job:** after the winning seller delivers, Ledger independently re-runs one specific, cheap, mechanical check against the same mainnet RPC — not an LLM judgment call. For WhaleTrace: re-fetch the balance and compare to the delivered balance, tolerance zero (balances must match exactly, since it's a point-in-time read). For DepthScan: re-fetch price from Birdeye and compare to delivered price within 2% tolerance (price can move between calls). For PulseCheck: re-fetch top holder count and compare to delivered count within tolerance of 1 account (indexing lag).
- **Output:** pass → triggers `release`. fail → triggers `refund` and the failure reason is surfaced in the frontend, not hidden.
- **This is your dispute-handling story for the Impact criterion.** It must be a real, working check that can genuinely fail — not a check that always passes. See §8 for how to force a real failure live in the demo.

---

## 3. Architecture

```
FRONTEND (fork of starter dashboard)
  - Catalog: WhaleTrace / DepthScan / PulseCheck listed with live base prices
  - Ask box: buyer posts a wallet or token address + question type
  - Live auction feed: bids streaming in with price + claim + latency estimate
  - Award panel: buyer's scoring math shown on screen, not hidden — this is
    your "clarity of how the system works" score driver
  - Settlement panel: deposit tx, Ledger's check result, release/refund tx,
    Explorer link, all visible

AUCTION ENGINE (extend starter's engine, don't replace)
  - Accepts WANT from buyer: { targetAddress, questionType: "wallet_activity"
    | "token_depth" | "holder_momentum", budgetLamports }
  - Only the seller(s) whose beat matches questionType are eligible to bid
    (WhaleTrace only bids on wallet_activity, etc. — if a WANT's questionType
    only has one matching seller, that seller still goes through the full
    BID→AWARD flow solo so the pipeline is uniform, but note in the UI when
    there was no real competition for that query type)
  - 10-second fixed bid window
  - Sequences bids, closes window, hands ordered bid set to buyer agent

AGENT LAYER
  - Buyer: scores each bid as (declared confidence / price), picks the
    highest-scoring bid that fits inside budgetLamports. Confidence is a
    0–1 float each seller includes in its BID message (WhaleTrace: 0.9 fixed,
    DepthScan: 0.95 fixed, PulseCheck: 0.7 fixed, reflecting real reliability
    differences in the data). Show the arithmetic in the AWARD message.
  - Sellers: each is its own process, only calls its own beat's API, never
    calls another seller's API.
  - Ledger: only runs after DELIVERY, only re-checks the single claim
    specified in §2, nothing fuzzier.

RUNTIME — reuse solana_coralOS's CoralOS client, Solana Pay integration,
  and market protocol as-is. Do not rewrite this layer.

ESCROW CONTRACT (Rust, extend the starter's program — do not rewrite from
  scratch)
  - deposit(awardRef, amountLamports) on AWARD
  - release(awardRef) — callable only by Ledger's authority key after a
    pass result
  - refund(awardRef) — callable by Ledger's authority key after a fail
    result, OR by the buyer or anyone after a 60-second no-delivery
    deadline from AWARD (no-show path)
```

---

## 4. Lifecycle (identical shape for every query type — don't special-case)

```
WANT        buyer posts { targetAddress, questionType, budgetLamports }
BID_OPEN    engine broadcasts to matching seller(s), opens 10s window
BID         each matching seller responds { priceLamports, confidence,
            etaMs, claimSummary }
AWARD       buyer scores confidence/price for each bid within budget,
            picks winner, publishes the arithmetic, generates escrowRef
DEPOSITED   buyer's Solana Pay tx locks priceLamports on devnet, keyed to
            escrowRef
DELIVERED   winning seller calls its deliverService(), returns the full
            answer (balance/price/holder count + supporting numbers)
VERIFIED    Ledger re-runs the single mechanical check from §2 against
            live mainnet data
RELEASED    (pass) escrow pays the seller               ─┐ mutually
REFUNDED    (fail, or no DELIVERED within 60s of AWARD)  ─┘ exclusive
```

---

## 5. Message contracts (final — do not deviate without checking `coral-skill-set` first, see §10)

**WANT**

```json
{
  "type": "WANT",
  "requestId": "uuid",
  "targetAddress": "base58 pubkey or mint",
  "questionType": "wallet_activity",
  "budgetLamports": 6000000
}
```

**BID**

```json
{
  "type": "BID",
  "requestId": "uuid",
  "sellerId": "whaletrace",
  "priceLamports": 2000000,
  "confidence": 0.9,
  "etaMs": 3000,
  "claimSummary": "balance + 24h tx count + largest tx in window"
}
```

**AWARD**

```json
{
  "type": "AWARD",
  "requestId": "uuid",
  "winnerSellerId": "whaletrace",
  "priceLamports": 2000000,
  "scoring": [
    {
      "sellerId": "whaletrace",
      "confidence": 0.9,
      "priceLamports": 2000000,
      "score": 0.00000045
    }
  ],
  "escrowReference": "base58 pubkey used as Solana Pay reference"
}
```

**DELIVERY**

```json
{
  "type": "DELIVERY",
  "requestId": "uuid",
  "escrowReference": "...",
  "answer": {
    "balanceLamports": 41200000000,
    "txCount24h": 14,
    "largestTxLamports": 9000000000
  },
  "deliveredAtMs": 1234567890
}
```

**VERIFICATION_RESULT**

```json
{
  "type": "VERIFICATION_RESULT",
  "requestId": "uuid",
  "escrowReference": "...",
  "pass": false,
  "checked": {
    "field": "balanceLamports",
    "delivered": 41200000000,
    "reChecked": 39800000000,
    "toleranceExceeded": true
  },
  "action": "refund"
}
```

---

## 6. Repo structure

```
corify/
├── contracts/            # forked escrow program + settlement client (release/refund per §3)
├── engine/               # auction engine: bid window, questionType routing, sequencing
├── agents/
│   ├── buyer/             # scoring math from §3, budget enforcement
│   ├── sellers/
│   │   ├── whaletrace/      # mainnet RPC calls only
│   │   ├── depthscan/       # Birdeye calls only
│   │   └── pulsecheck/      # mainnet RPC calls, surge pricing formula
│   └── verifier/           # Ledger — one mechanical recheck per questionType
├── backend/              # HTTP API: health, catalog, WANT execution
├── frontend/             # dashboard: catalog, live bids, scoring math shown, settlement panel
├── scripts/
│   └── demo.sh            # one command: runs full loop + the forced-failure run, see §8
├── .coral/agents/        # Coral agent manifests for Corify agents
├── .env.example          # HELIUS_RPC_URL, BIRDEYE_API_KEY, devnet keypair path
└── README.md
```

---

## 7. Build order tonight — do these in sequence, do not parallelize early stages

1. Get the unmodified starter kit's single buyer/seller loop running on devnet. This confirms your environment, wallet funding, and Solana Pay flow work before you touch anything else.
2. Stand up the mainnet read layer first, in isolation, before touching the auction engine: write and manually test the three RPC/Birdeye calls in §2 against real addresses, confirm you get real numbers back, before wiring them into any agent.
3. Build questionType routing in the auction engine (WANT → only matching seller(s) get BID_OPEN).
4. Build the three seller processes, each calling only its own data source.
5. Build the buyer's scoring function exactly as in §3 — confidence/price, budget-filtered, arithmetic included in the AWARD message.
6. Extend the escrow contract for the release/refund split gated on Ledger's authority key, and the 60-second no-delivery refund deadline.
7. Build Ledger with the three mechanical rechecks from §2.
8. Wire the frontend: catalog → live bids → scoring math shown → settlement panel with Explorer link.
9. Write `scripts/demo.sh` per §8.
10. Only after 1–9 are solid and devnet-proven: polish the frontend, add a fourth query type if time remains. Do not add a fourth seller persona before the verifier's refund path is proven working live — the refund path is worth more than a fourth persona.

---

## 8. The demo script — exact required behavior

`scripts/demo.sh` must run two scenarios back to back, unattended, printing an Explorer link after each:

**Run 1 — happy path.** Post a real wallet_activity WANT for a known active mainnet wallet address (pick one and hardcode it — e.g. a well-known exchange hot wallet with high tx volume, so the demo always has real activity to report). Full loop runs WANT→RELEASED. Print the Explorer tx for the release.

**Run 2 — forced failure, to prove Ledger is real.** Post a WANT, let a seller win, then before DELIVERY, deliberately corrupt one field in that seller's delivered answer by a fixed amount (e.g. add 1 SOL to the delivered balance for WhaleTrace) via an environment flag (`DEMO_FORCE_BAD_DELIVERY=whaletrace`) that only your own delivery code checks — this is not cheating, it's how you prove a fact-checker that always says yes isn't worth anything. Ledger re-checks, catches the mismatch, refund fires. Print the Explorer tx for the refund.

Narrate both runs in the demo video. Run 2 is the single most important 20 seconds of the video — it is the concrete answer to "settlement that holds up under dispute."

---

## 9. Required setup — do this first, before any code

1. Get a free Helius API key (helius.dev, free tier, instant) and use its mainnet RPC URL. Do not rely on a public unauthenticated mainnet RPC for the demo — it will rate-limit mid-demo.
2. Get a free Birdeye API key (birdeye.so, free tier, instant) for DepthScan.
3. Fund a devnet keypair via `solana airdrop` for the escrow/Solana Pay side — this is separate from the mainnet read keys above and needs no funding beyond devnet SOL.
4. Put both mainnet API keys and the devnet keypair path in `.env`, never commit them.

---

## 10. `coral-skill-set` and `solana_coralOS` — how to use them

`solana_coralOS` (already cloned) is the sample implementation for the runtime, Solana Pay integration, and escrow program's base shape — reuse its runtime code directly per §3, extend its contract, don't rewrite either from scratch.

`coral-skill-set` — locate it (search the filesystem, check for it as a sibling directory or inside `solana_coralOS`) and read every file in it before writing any CoralOS-runtime-touching code. If it specifies message shapes, tool conventions, or agent registration patterns that differ from §5 or §3 of this doc, **follow `coral-skill-set`, and update the affected section of this file to match it** — then keep building. If it genuinely cannot be found after a real search, log that once and proceed using `solana_coralOS`'s own existing code as the fallback convention source, then keep building — don't stop to ask.

---

## 11. Pitch deck — exact content per slide

1. **Customer:** "The customer is a trading or due-diligence agent, not a human — it needs a fast, sourced answer about a specific wallet or token to make its next decision, right now, not a dashboard it has to read."
2. **What's sold:** "Three specialist agents each sell one thing: wallet activity, token market depth, or holder momentum — real Solana mainnet data, not a mock."
3. **Why they pay:** "Because getting a wrong or stale on-chain read costs more than 2–5 million lamports — and because a fourth agent checks the winner's work before the money moves, so the buyer isn't taking the seller's word for it."
4. **The economy:** "Not one seller — three specialists competing on price and confidence, plus an independent verifier. A graph, not a pair."
5. **Proof:** show the Run 2 Explorer refund link. Say explicitly: "this transaction is a refund, triggered because our own verifier caught a bad answer before payment went out — that's the moment that matters, not the plumbing."

---

## 12. Non-goals — unchanged, do not add scope here

No EVM, no Chainlink, no ZK proofs, no reuse of any code from `x402-chainlink` (concept-only reference, already used). No social/sentiment API integrations beyond the on-chain holder-count proxy in §2 — that dependency is cut on purpose. No mocked settlement anywhere — every RELEASED/REFUNDED in the demo must be a real devnet transaction with a real Explorer link.
