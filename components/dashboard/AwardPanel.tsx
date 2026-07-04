import { BadgeDollarSign, CheckCircle2 } from 'lucide-react';
import type { AuctionResult } from '../../app/lib/types';
import { formatLamports, labels } from './constants';

export default function AwardPanel({
  result,
}: Readonly<{ result: AuctionResult | undefined }>): React.ReactElement {
  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Award math</h2>
        <BadgeDollarSign size={19} />
      </div>
      {result ? (
        <>
          <div className="winner-line">
            <CheckCircle2 size={20} />
            {labels[result.award.winnerSellerId]} wins at{' '}
            {formatLamports(result.award.priceLamports)} lamports
          </div>
          <div className="score-table">
            {result.award.scoring.map((entry) => (
              <div key={entry.sellerId}>
                <span>{labels[entry.sellerId]}</span>
                <code>
                  {entry.confidence} / {formatLamports(entry.priceLamports)} ={' '}
                  {entry.score.toExponential(3)}
                </code>
              </div>
            ))}
          </div>
          <pre>{JSON.stringify(result.delivery.answer, null, 2)}</pre>
          <p className="hint">
            {result.consumerSummary?.text ?? result.competitionNote}
          </p>
        </>
      ) : (
        <p className="muted">Buyer scoring appears here after AWARD.</p>
      )}
    </div>
  );
}
