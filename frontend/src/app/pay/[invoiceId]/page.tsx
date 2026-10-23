'use client';

/**
 * src/app/pay/[invoiceId]/page.tsx
 *
 * Dedicated checkout view for a specific invoice ID.
 * Features:
 * - Institutional Navbar with live telemetry
 * - Suspense wrapper for Next.js prerendering
 * - Real-time polling, Web3 payment, and countdown clock
 */

import React, { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getInvoiceStatus, createInvoice } from '@/lib/api';
import { InvoiceDetails, CryptoNetwork } from '@/types/invoice';
import { CheckoutCard } from '@/components/CheckoutCard';
import { Navbar } from '@/components/Navbar';
import { Loader2, ArrowLeft, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';

function InvoiceCheckoutContent() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params?.invoiceId as string;

  const [invoice, setInvoice] = useState<InvoiceDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!invoiceId) return;
      try {
        setLoading(true);
        const data = await getInvoiceStatus(invoiceId);
        setInvoice(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Invoice not found');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [invoiceId]);

  const handleRegenerate = async (network: CryptoNetwork) => {
    if (!invoice) return;
    try {
      setLoading(true);
      const newInvoice = await createInvoice({
        userId: 'client_checkout',
        amount: parseFloat(invoice.expectedCryptoAmount),
        network,
      });
      router.push(`/pay/${newInvoice.invoiceId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate invoice');
      setLoading(false);
    }
  };

  const { t, isArabic } = useLanguage();

  if (loading) {
    return (
      <div className="w-full max-w-md h-96 rounded-3xl crypto-card flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        <p className="text-xs text-gray-400 font-medium">{t.fetchingDetails}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-md rounded-3xl crypto-card p-8 text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded-full bg-rose-500/10 flex items-center justify-center">
          <AlertCircle className="w-6 h-6 text-rose-400" />
        </div>
        <h2 className="text-lg font-bold text-white">{t.invoiceExpiredOrNotFound}</h2>
        <p className="text-xs text-gray-400">{error}</p>
        <Link
          href="/"
          className="inline-block mt-2 px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-xs font-semibold text-white transition-colors"
        >
          {t.returnToCheckout}
        </Link>
      </div>
    );
  }

  return invoice ? (
    <CheckoutCard initialInvoice={invoice} onInvoiceRegenerate={handleRegenerate} />
  ) : null;
}

export default function InvoiceCheckoutPage() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-[#070b14] text-gray-100 flex flex-col selection:bg-cyan-500 selection:text-black">
      <Navbar />

      <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8">
        {/* Top Navigation Back Link */}
        <div className="w-full max-w-md mb-4 flex items-center justify-between text-xs text-gray-400">
          <Link
            href="/"
            className="flex items-center gap-1.5 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t.returnToCheckout}</span>
          </Link>
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-gray-500">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>{t.sslEncrypted}</span>
          </div>
        </div>

        <Suspense
          fallback={
            <div className="w-full max-w-md h-96 rounded-3xl crypto-card flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
              <p className="text-xs text-gray-400 font-medium">Loading checkout...</p>
            </div>
          }
        >
          <InvoiceCheckoutContent />
        </Suspense>
      </main>
    </div>
  );
}
