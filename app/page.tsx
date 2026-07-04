import {
  ArrowRight,
  BadgeCheck,
  CircleDollarSign,
  DatabaseZap,
  FileCheck2,
  Newspaper,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';
import Link from 'next/link';

const lifecycle = [
  'WANT',
  'BID',
  'AWARD',
  'DEPOSITED',
  'DELIVERED',
  'VERIFIED',
  'RELEASED / REFUNDED',
];

export default function LandingPage(): React.ReactElement {
  return (
    <main className="landing-page">
      <nav className="site-nav">
        <Link className="brand" href="/">
          Corify
        </Link>
        <div className="nav-actions">
          <a href="#how-it-works">How it works</a>
          <a href="#agents">Agents</a>
          <a href="#proof">Proof</a>
          <Link className="nav-button" href="/dashboard">
            Dashboard
          </Link>
        </div>
      </nav>

      <section className="hero hero-visual">
        <div className="hero-copy">
          <p className="eyebrow">Solana x CoralOS agent economy</p>
          <h1>Corify</h1>
          <p className="pitch">
            Three specialist agents compete to answer one on-chain research
            question. The buyer pays for the best answer, not the cheapest one
            — and a fourth agent checks the winner&apos;s work against the chain
            before the money moves.
          </p>
          <div className="hero-actions">
            <Link className="primary-link" href="/dashboard">
              Open dashboard <ArrowRight size={18} />
            </Link>
            <Link className="secondary-link" href="/dashboard?demo=refund">
              Show refund proof
            </Link>
            <a className="secondary-link" href="#how-it-works">
              See how it works
            </a>
          </div>
          <dl className="hero-facts" aria-label="Corify data and settlement split">
            <div>
              <dt>Mainnet</dt>
              <dd>live Solana reads</dd>
            </div>
            <div>
              <dt>Devnet</dt>
              <dd>judge-safe escrow</dd>
            </div>
            <div>
              <dt>Ledger</dt>
              <dd>release or refund</dd>
            </div>
          </dl>
        </div>
        <div className="hero-flow" aria-label="Transaction lifecycle">
          {lifecycle.map((step, index) => (
            <div key={step}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{step}</strong>
            </div>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="section">
        <div className="section-heading">
          <p className="eyebrow">Newsroom model</p>
          <h2>This is a newsroom, not a vending machine.</h2>
          <p>
            The customer is another agent that needs a sourced answer fast. It
            posts an assignment, watches bids arrive, awards the best
            confidence-per-lamport offer, and only settles after Ledger checks
            the winning claim.
          </p>
        </div>
        <div className="role-grid">
          <article>
            <Newspaper />
            <h3>Buyer as editor</h3>
            <p>
              A trading or diligence agent posts one assignment with a target
              wallet or token, question type, and budget.
            </p>
          </article>
          <article>
            <CircleDollarSign />
            <h3>Specialists as reporters</h3>
            <p>
              WhaleTrace, DepthScan, and PulseCheck sell narrow, sourced
              answers with declared confidence and price.
            </p>
          </article>
          <article>
            <ShieldCheck />
            <h3>Ledger as fact-checker</h3>
            <p>
              Ledger rechecks one mechanical claim against live data before
              escrow releases or refunds.
            </p>
          </article>
        </div>
      </section>

      <section className="section workflow-section">
        <div className="section-heading">
          <p className="eyebrow">What works in the demo</p>
          <h2>From question to settlement in one screen.</h2>
        </div>
        <div className="workflow-grid">
          <WorkflowStep
            icon={<WalletCards />}
            title="Ask a real target"
            text="Paste a wallet or token mint, choose a question type, and set a lamport budget."
          />
          <WorkflowStep
            icon={<CircleDollarSign />}
            title="Watch the award math"
            text="The buyer ranks eligible bids with score = confidence / priceLamports."
          />
          <WorkflowStep
            icon={<DatabaseZap />}
            title="Read live data"
            text="Sellers pull mainnet data while escrow settlement stays on devnet."
          />
          <WorkflowStep
            icon={<FileCheck2 />}
            title="Prove the check"
            text="Turn on Ledger proof run to corrupt delivery and trigger a refund."
          />
        </div>
      </section>

      <section id="agents" className="section split-section">
        <div>
          <p className="eyebrow">Agent lineup</p>
          <h2>Three beats, one settlement rail.</h2>
          <p className="section-copy">
            Each seller has one job and one data source. That makes the market
            easy to explain and the verifier easy to trust.
          </p>
        </div>
        <div className="agent-list">
          <Agent name="WhaleTrace" price="2,000,000" confidence="0.90">
            Wallet SOL balance, recent transaction count, largest 24h transfer.
          </Agent>
          <Agent name="DepthScan" price="5,000,000" confidence="0.95">
            Token price, volume, and liquidity from Birdeye.
          </Agent>
          <Agent name="PulseCheck" price="3,000,000-6,000,000" confidence="0.70">
            Holder momentum from a mechanical on-chain proxy.
          </Agent>
          <Agent name="Ledger" price="verifier" confidence="mechanical">
            Independent pass/fail check that triggers release or refund.
          </Agent>
        </div>
      </section>

      <section id="proof" className="section proof-band">
        <BadgeCheck size={34} />
        <div>
          <p className="eyebrow">Demo proof</p>
          <h2>Run 2 proves dispute handling.</h2>
          <p>
            The dashboard includes a Ledger proof run that deliberately corrupts
            WhaleTrace&apos;s delivery. Ledger catches the mismatch and routes
            settlement to refund, which is the moment judges need to see.
          </p>
        </div>
        <Link className="primary-link" href="/dashboard">
          Run dashboard
        </Link>
      </section>
    </main>
  );
}

function WorkflowStep({
  icon,
  title,
  text,
}: Readonly<{
  icon: React.ReactNode;
  title: string;
  text: string;
}>): React.ReactElement {
  return (
    <article>
      {icon}
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

function Agent({
  name,
  price,
  confidence,
  children,
}: Readonly<{
  name: string;
  price: string;
  confidence: string;
  children: React.ReactNode;
}>): React.ReactElement {
  return (
    <article className="agent-row">
      <div>
        <h3>{name}</h3>
        <p>{children}</p>
      </div>
      <dl>
        <div>
          <dt>Price</dt>
          <dd>{price}</dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>{confidence}</dd>
        </div>
      </dl>
    </article>
  );
}
