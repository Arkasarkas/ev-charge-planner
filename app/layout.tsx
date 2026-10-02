import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'EV Charge Planner',
  description: 'Best times to charge your EV in Belgium, based on day-ahead electricity prices.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
