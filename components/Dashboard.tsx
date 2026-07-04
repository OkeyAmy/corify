'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  getCatalog,
  getHealth,
  postWant,
  subscribeRequestEvents,
} from '../app/lib/api';
import type {
  AuctionEvent,
  AuctionResult,
  CatalogEntry,
  HealthPayload,
  WantRequest,
} from '../app/lib/types';
import AgentCatalog from './dashboard/AgentCatalog';
import AskBox from './dashboard/AskBox';
import AuctionFeed from './dashboard/AuctionFeed';
import AwardPanel from './dashboard/AwardPanel';
import { defaults, type RunState } from './dashboard/constants';
import SettlementPanel from './dashboard/SettlementPanel';
import StatusBadge from './dashboard/StatusBadge';

export default function Dashboard(): React.ReactElement {
  const searchParams = useSearchParams();
  const [catalog, setCatalog] = useState<Array<CatalogEntry>>([]);
  const [health, setHealth] = useState<HealthPayload>();
  const [questionType, setQuestionType] =
    useState<WantRequest['questionType']>('wallet_activity');
  const [targetAddress, setTargetAddress] = useState(defaults.wallet_activity);
  const [budgetLamports, setBudgetLamports] = useState(6_000_000);
  const [forceBadDelivery, setForceBadDelivery] = useState(false);
  const [runState, setRunState] = useState<RunState>('idle');
  const [result, setResult] = useState<AuctionResult>();
  const [events, setEvents] = useState<Array<AuctionEvent>>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void Promise.all([getHealth(), getCatalog()])
      .then(([healthPayload, catalogPayload]) => {
        if (!active) return;
        setHealth(healthPayload);
        setCatalog(catalogPayload);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : String(caught));
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (searchParams.get('demo') !== 'refund') return;
    setQuestionType('wallet_activity');
    setTargetAddress(defaults.wallet_activity);
    setBudgetLamports(6_000_000);
    setForceBadDelivery(true);
  }, [searchParams]);

  async function submit(): Promise<void> {
    setRunState('running');
    setError('');
    setEvents([]);
    setResult(undefined);
    try {
      const payload = await postWant({
        targetAddress,
        questionType,
        budgetLamports,
        forceBadDelivery,
      });
      setResult(payload);
      setRunState('success');
      subscribeRequestEvents(
        payload.want.requestId,
        (event) => {
          setEvents((current) =>
            current.some((item) => item.id === event.id)
              ? current
              : [...current, event]
          );
        },
        () => {
          setEvents([]);
        }
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setRunState('error');
    }
  }

  function chooseQuestionType(value: WantRequest['questionType']): void {
    setQuestionType(value);
    setTargetAddress(defaults[value]);
    if (value !== 'wallet_activity') setForceBadDelivery(false);
  }

  return (
    <main className="dashboard-shell">
      <aside className="sidebar">
        <Link className="brand" href="/">
          Corify
        </Link>
        <nav>
          <a href="#ask">Ask</a>
          <a href="#auction">Auction</a>
          <a href="#settlement">Settlement</a>
        </nav>
        <div className="mode-stack">
          <StatusBadge label={`data: ${health?.dataMode ?? 'checking'}`} />
          <StatusBadge
            label={`settlement: ${health?.settlementMode ?? 'checking'}`}
          />
        </div>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">CoralOS market desk</p>
            <h1>Verified Solana intelligence</h1>
          </div>
          <Link className="secondary-link" href="/">
            Landing
          </Link>
        </header>

        <AgentCatalog catalog={catalog} questionType={questionType} />

        <section className="work-grid">
          <AskBox
            budgetLamports={budgetLamports}
            catalog={catalog}
            error={error}
            forceBadDelivery={forceBadDelivery}
            questionType={questionType}
            runState={runState}
            targetAddress={targetAddress}
            onBudgetChange={setBudgetLamports}
            onForceBadDeliveryChange={setForceBadDelivery}
            onQuestionTypeChange={chooseQuestionType}
            onSubmit={() => {
              void submit();
            }}
            onTargetAddressChange={setTargetAddress}
          />

          <AuctionFeed
            events={events}
            result={result}
            running={runState === 'running'}
          />
        </section>

        <section className="results-grid">
          <AwardPanel result={result} />
          <SettlementPanel result={result} />
        </section>
      </section>
    </main>
  );
}
