import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Imperio AI — Outbound Dashboard',
  description: 'AI Voice Agent Dashboard for Imperio Railing Systems',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
