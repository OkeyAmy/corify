import { Radio } from 'lucide-react';
import type { CatalogEntry, WantRequest } from '../../app/lib/types';
import { formatLamports, labels } from './constants';

export default function AgentCatalog({
  catalog,
  questionType,
}: Readonly<{
  catalog: Array<CatalogEntry>;
  questionType: WantRequest['questionType'];
}>): React.ReactElement {
  return (
    <section className="catalog-strip" aria-label="Agent catalog">
      {catalog.map((entry) => (
        <article
          key={entry.sellerId}
          className={
            entry.questionType === questionType
              ? 'catalog-card active'
              : 'catalog-card'
          }
        >
          <div className="card-title">
            <Radio size={17} />
            <h2>{labels[entry.sellerId]}</h2>
          </div>
          <p>{entry.beat}</p>
          <dl className="metric-row">
            <div>
              <dt>Price</dt>
              <dd>
                {formatLamports(entry.basePriceLamports)}
                {entry.maxPriceLamports
                  ? `-${formatLamports(entry.maxPriceLamports)}`
                  : ''}
              </dd>
            </div>
            <div>
              <dt>Confidence</dt>
              <dd>{entry.confidence.toFixed(2)}</dd>
            </div>
            <div>
              <dt>ETA</dt>
              <dd>{entry.etaMs}ms</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>online</dd>
            </div>
          </dl>
        </article>
      ))}
    </section>
  );
}
