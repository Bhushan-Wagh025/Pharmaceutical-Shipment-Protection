import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { Navbar } from '@/components/layout/Navbar';
import { Sidebar } from '@/components/layout/Sidebar';

export const metadata: Metadata = {
  title: 'PharmaProtect AIoT - B2B Pharmaceutical Cold Chain Protection',
  description: 'Enterprise AIoT system for real-time BLE temperature monitoring, predictive excursion forecasting, and automated motorized tray protection.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-white min-h-screen flex flex-col font-sans">
        <AuthProvider>
          <Navbar />
          <div className="flex flex-1">
            <Sidebar />
            <main className="flex-1 overflow-x-hidden p-6 bg-slate-50/50">
              {children}
            </main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
