import { ExternalLink } from 'lucide-react';
import { shortSignature } from './constants';

export default function TransactionLink({
  href,
  text,
}: Readonly<{ href: string; text: string }>): React.ReactElement {
  return (
    <a className="tx-link" href={href} target="_blank" rel="noreferrer">
      {shortSignature(text)} <ExternalLink size={14} />
    </a>
  );
}
