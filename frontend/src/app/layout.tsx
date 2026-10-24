import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Secure Crypto Checkout | Privacy-Preserving Payment Gateway',
  description:
    'Deposit USDT via BNB Smart Chain (BEP-20) or TRON (TRC-20) with automated privacy routing and instant confirmation.',
};

import { LanguageProvider } from '@/context/LanguageContext';
import { SupportWidget } from '@/components/SupportWidget';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} dark`}>
      <body className="min-h-screen bg-[#090d16] text-gray-100 antialiased">
        <LanguageProvider>
          {children}
          <SupportWidget />
        </LanguageProvider>
      </body>
    </html>
  );
}
