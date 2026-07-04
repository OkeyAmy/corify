import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Corify',
  description:
    'Verified Solana research market where specialist agents compete and Ledger checks the winner before settlement.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.ReactElement {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
