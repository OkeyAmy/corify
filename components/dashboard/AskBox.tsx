import { Activity, Loader2 } from 'lucide-react';
import type { CatalogEntry, WantRequest } from '../../app/lib/types';
import { defaults, labels, type RunState } from './constants';
import StatusBadge from './StatusBadge';

export default function AskBox({
  budgetLamports,
  catalog,
  error,
  forceBadDelivery,
  questionType,
  runState,
  targetAddress,
  onBudgetChange,
  onForceBadDeliveryChange,
  onQuestionTypeChange,
  onSubmit,
  onTargetAddressChange,
}: Readonly<{
  budgetLamports: number;
  catalog: Array<CatalogEntry>;
  error: string;
  forceBadDelivery: boolean;
  questionType: WantRequest['questionType'];
  runState: RunState;
  targetAddress: string;
  onBudgetChange: (value: number) => void;
  onForceBadDeliveryChange: (value: boolean) => void;
  onQuestionTypeChange: (value: WantRequest['questionType']) => void;
  onSubmit: () => void;
  onTargetAddressChange: (value: string) => void;
}>): React.ReactElement {
  const selectedSeller = catalog.find(
    (entry) => entry.questionType === questionType
  );

  return (
    <div id="ask" className="panel ask-panel">
      <div className="panel-head">
        <h2>Ask box</h2>
        <StatusBadge label={runState} />
      </div>
      <label>
        Product
        <select
          value={questionType}
          onChange={(event) => {
            onQuestionTypeChange(event.target.value as WantRequest['questionType']);
          }}
        >
          <option value="wallet_activity">Wallet activity</option>
          <option value="token_depth">Token market depth</option>
          <option value="holder_momentum">Holder momentum</option>
        </select>
      </label>
      <label>
        Wallet or token address
        <input
          value={targetAddress}
          spellCheck={false}
          onChange={(event) => {
            onTargetAddressChange(event.target.value);
          }}
        />
      </label>
      <label>
        Budget lamports
        <input
          type="number"
          min={1}
          step={100_000}
          value={budgetLamports}
          onChange={(event) => {
            onBudgetChange(Number(event.target.value));
          }}
        />
      </label>
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={forceBadDelivery}
          disabled={questionType !== 'wallet_activity'}
          onChange={(event) => {
            onForceBadDeliveryChange(event.target.checked);
          }}
        />
        Ledger proof run
      </label>
      <button disabled={runState === 'running'} onClick={onSubmit}>
        {runState === 'running' ? (
          <Loader2 className="spin" size={18} />
        ) : (
          <Activity size={18} />
        )}
        Run market
      </button>
      <p className="hint">
        Selected seller:{' '}
        {selectedSeller ? labels[selectedSeller.sellerId] : '-'}
      </p>
      <p className="hint">Default target: {defaults[questionType]}</p>
      {error ? <p className="error-text">{error}</p> : null}
    </div>
  );
}
