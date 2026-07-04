import type { AuctionEvent, AuctionResult } from '../../app/lib/types';
import { formatLamports, labels, shortAddress } from './constants';
import StatusBadge from './StatusBadge';

export default function AuctionFeed({
  events,
  result,
  running,
}: Readonly<{
  events: Array<AuctionEvent>;
  result: AuctionResult | undefined;
  running: boolean;
}>): React.ReactElement {
  const items =
    events.length > 0
      ? events.map((event) => ({
          label: event.type,
          text: eventText(event),
        }))
      : result
        ? resultItems(result)
        : [
            {
              label: running ? 'BID_OPEN' : 'READY',
              text: running
                ? 'Auction engine is running the seller and Ledger flow.'
                : 'Submit a WANT to start the market.',
            },
          ];

  return (
    <div id="auction" className="panel">
      <div className="panel-head">
        <h2>Live auction feed</h2>
        <StatusBadge label={running ? 'running' : result ? 'complete' : 'idle'} />
      </div>
      <ol className="feed-list">
        {items.map((item) => (
          <li key={`${item.label}-${item.text}`}>
            <b>{item.label}</b>
            <span>{item.text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function resultItems(result: AuctionResult): Array<{ label: string; text: string }> {
  return [
    {
      label: 'WANT',
      text: `${labels[result.want.questionType]} for ${shortAddress(
        result.want.targetAddress
      )}`,
    },
    {
      label: 'BID_OPEN',
      text: `${labels[result.want.questionType]} bid window opened.`,
    },
    ...result.bids.map((bid) => ({
      label: 'BID',
      text: `${labels[bid.sellerId]} bid ${formatLamports(
        bid.priceLamports
      )} at ${bid.confidence.toFixed(2)} confidence.`,
    })),
    {
      label: 'BID_CLOSED',
      text: `${String(result.bids.length)} bid(s) received.`,
    },
    {
      label: 'AWARD',
      text: `${labels[result.award.winnerSellerId]} won. ${
        result.competitionNote
      }`,
    },
    {
      label: 'DELIVERY',
      text: `${labels[result.delivery.sellerId]} returned ${Object.keys(
        result.delivery.answer
      ).join(', ')}.`,
    },
    {
      label: 'VERIFICATION_RESULT',
      text: `Ledger chose ${result.verification.action}.`,
    },
    {
      label: result.verification.pass ? 'RELEASED' : 'REFUNDED',
      text: result.settlement.signature,
    },
  ];
}

function eventText(event: AuctionEvent): string {
  if (event.type === 'BID') {
    const bid = event.payload as {
      sellerId: keyof typeof labels;
      priceLamports: number;
      confidence: number;
    };
    return `${labels[bid.sellerId]} bid ${formatLamports(
      bid.priceLamports
    )} at ${bid.confidence.toFixed(2)} confidence.`;
  }
  if (event.type === 'WANT') {
    const want = event.payload as {
      targetAddress: string;
      questionType: keyof typeof labels;
    };
    return `${labels[want.questionType]} for ${shortAddress(want.targetAddress)}`;
  }
  if (event.type === 'AWARD') {
    const award = event.payload as { winnerSellerId: keyof typeof labels };
    return `${labels[award.winnerSellerId]} won the award.`;
  }
  if (event.type === 'VERIFICATION_RESULT') {
    const verification = event.payload as { action: string };
    return `Ledger chose ${verification.action}.`;
  }
  if (event.type === 'RELEASED' || event.type === 'REFUNDED') {
    const settlement = event.payload as { signature: string };
    return settlement.signature;
  }
  return `${event.type.toLowerCase().replaceAll('_', ' ')}.`;
}
