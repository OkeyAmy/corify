import { ShieldAlert, ShieldCheck } from 'lucide-react';
import type { AuctionResult } from '../../app/lib/types';
import TransactionLink from './TransactionLink';

export default function SettlementPanel({
  result,
}: Readonly<{ result: AuctionResult | undefined }>): React.ReactElement {
  const passed = result?.verification.pass;
  return (
    <div id="settlement" className="panel settlement-card">
      <div className="panel-head">
        <h2>Settlement</h2>
        {passed === false ? <ShieldAlert size={19} /> : <ShieldCheck size={19} />}
      </div>
      {result ? (
        <dl className="settlement-list">
          <div>
            <dt>DEPOSITED tx</dt>
            <dd>
              <TransactionLink
                href={result.deposit.explorerUrl}
                text={result.deposit.signature}
              />
            </dd>
          </div>
          <div>
            <dt>DELIVERY payload</dt>
            <dd>
              <pre>{JSON.stringify(result.delivery.answer, null, 2)}</pre>
            </dd>
          </div>
          <div>
            <dt>Ledger verification result</dt>
            <dd>
              {result.verification.checked.field}: delivered{' '}
              {String(result.verification.checked.delivered)}, rechecked{' '}
              {String(result.verification.checked.reChecked)}
            </dd>
          </div>
          <div>
            <dt>{passed ? 'RELEASED' : 'REFUNDED'} result</dt>
            <dd className={passed ? 'release-text' : 'refund-text'}>
              {result.verification.action.toUpperCase()}
              {result.verification.reason ? `: ${result.verification.reason}` : ''}
            </dd>
          </div>
          <div>
            <dt>Explorer link</dt>
            <dd>
              <TransactionLink
                href={result.settlement.explorerUrl}
                text={result.settlement.signature}
              />
            </dd>
          </div>
        </dl>
      ) : (
        <p className="muted">
          Deposit, verification, and release/refund receipts appear here.
        </p>
      )}
    </div>
  );
}
