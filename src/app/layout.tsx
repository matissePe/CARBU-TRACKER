import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Carbu Tracker — prix des carburants à Vannes et Séné',
  description: "Historique et tendances des prix des carburants des stations de Vannes et Séné.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
