'use client';

/**
 * src/context/LanguageContext.tsx
 *
 * Professional i18n Context for Nexus Gateway.
 * Supports English and Arabic without altering page structure or layout.
 * Persists selection in localStorage and respects browser language.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'en' | 'ar';

export interface Translations {
  // Brand & Navbar
  brandTitle: string;
  brandSubtitle: string;
  brandTag: string;
  sslEncrypted: string;

  // Navigation & General
  returnToCheckout: string;
  fetchingDetails: string;
  invoiceExpiredOrNotFound: string;

  // Checkout Card
  completeDeposit: string;
  invoiceNumber: string;
  paymentSummaryAndFees: string;
  invoiceAmount: string;
  networkFee: string;
  totalDue: string;
  payVia: string;
  confirmingIn: string;
  instantOneClick: string;
  paymentSessionExpired: string;
  expiredNotice: string;
  generateNewInvoice: string;
  securedBy: string;

  // QR Card
  amountToPay: string;
  sendExactAmount: string;
  copy: string;
  copied: string;
  depositAddress: string;
  viewOnExplorer: string;
  warningNotice: string;

  // Status Badge
  awaitingPayment: string;
  paymentDetected: string;
  confirmations: string;
  paymentConfirmed: string;
  underpaidAmount: string;
  invoiceExpired: string;
  paymentFailed: string;

  // Success View
  paymentConfirmedTitle: string;
  paymentConfirmedSubtitle: string;
  amountCredited: string;
  network: string;
  transaction: string;

  // Countdown
  paymentWindow: string;
  timeExpired: string;
}

const translations: Record<Language, Translations> = {
  en: {
    brandTitle: 'NEXUS',
    brandSubtitle: 'PAY',
    brandTag: 'Secure Crypto Rail',
    sslEncrypted: '256-Bit SSL Encrypted Checkout',

    returnToCheckout: 'Return to Checkout',
    fetchingDetails: 'Fetching secure payment details...',
    invoiceExpiredOrNotFound: 'Invoice Expired or Not Found',

    completeDeposit: 'Complete Deposit',
    invoiceNumber: 'Invoice #',
    paymentSummaryAndFees: 'Payment Summary & Fees',
    invoiceAmount: 'Invoice Amount',
    networkFee: 'Network Fee',
    totalDue: 'Total Due',
    payVia: 'Pay via',
    confirmingIn: 'Confirming in',
    instantOneClick: 'Instant 1-Click transfer • Or scan QR code below manually',
    paymentSessionExpired: 'Payment Session Expired',
    expiredNotice:
      'The 15-minute deposit window has ended. To safeguard your funds, please generate a new deposit address.',
    generateNewInvoice: 'Generate New Invoice',
    securedBy: 'Secured by Non-Custodial Smart Contract Rails',

    amountToPay: 'Amount to Pay',
    sendExactAmount: 'Send exact amount',
    copy: 'Copy',
    copied: 'Copied',
    depositAddress: 'Deposit Address',
    viewOnExplorer: 'View on Explorer',
    warningNotice:
      'Only send USDT via the {network} network to this unique address. Sending any other token or network may result in permanent loss.',

    awaitingPayment: 'Awaiting Payment',
    paymentDetected: 'Payment Detected',
    confirmations: 'Confirmations',
    paymentConfirmed: 'Payment Confirmed',
    underpaidAmount: 'Underpaid Amount',
    invoiceExpired: 'Invoice Expired',
    paymentFailed: 'Payment Failed',

    paymentConfirmedTitle: 'Payment Confirmed!',
    paymentConfirmedSubtitle: 'Your deposit has been verified on the blockchain and credited.',
    amountCredited: 'Amount Credited',
    network: 'Network',
    transaction: 'Transaction',

    paymentWindow: 'Payment Window',
    timeExpired: 'Time expired. Please generate a new invoice.',
  },
  ar: {
    brandTitle: 'NEXUS',
    brandSubtitle: 'PAY',
    brandTag: 'بوابة الدفع الرقمية الآمنة',
    sslEncrypted: 'دفع مشفر وآمن بمعيار 256-Bit SSL',

    returnToCheckout: 'العودة لصفحة الدفع',
    fetchingDetails: 'جاري جلب تفاصيل الدفع الآمن...',
    invoiceExpiredOrNotFound: 'الفاتورة منتهية الصلاحية أو غير موجودة',

    completeDeposit: 'إتمام عملية الإيداع',
    invoiceNumber: 'فاتورة رقم #',
    paymentSummaryAndFees: 'تفاصيل الدفع ورسوم المعالجة',
    invoiceAmount: 'قيمة الإيداع الصافي',
    networkFee: 'رسوم معالجة الشبكة',
    totalDue: 'إجمالي المبلغ المطلوب تحويله',
    payVia: 'الدفع عبر',
    confirmingIn: 'جاري التأكيد في',
    instantOneClick: 'تحويل فوري بنقرة واحدة • أو امسح رمز QR أدناه يدوياً',
    paymentSessionExpired: 'انتهت صلاحية جلسة الدفع',
    expiredNotice:
      'انتهت نافذة الإيداع المحددة (15 دقيقة). لحماية أموالك، يرجى إنشاء عنوان إيداع جديد.',
    generateNewInvoice: 'إنشاء فاتورة جديدة',
    securedBy: 'معاملات محمية بتقنية العقود الذكية غير الاحتجازية',

    amountToPay: 'المبلغ المطلوب تحويله',
    sendExactAmount: 'يرجى إرسال المبلغ بدقة',
    copy: 'نسخ',
    copied: 'تم النسخ',
    depositAddress: 'عنوان الإيداع المخصص',
    viewOnExplorer: 'عرض المعاملة في المستكشف',
    warningNotice:
      'يرجى إرسال عملة USDT حصراً عبر شبكة {network} إلى هذا العنوان المخصص. إرسال أي عملة أو شبكة أخرى قد يؤدي إلى فقدان الأموال نهائياً.',

    awaitingPayment: 'قيد انتظار التحويل',
    paymentDetected: 'تم رصد المعاملة',
    confirmations: 'تأكيدات',
    paymentConfirmed: 'تم تأكيد المعاملة بنجاح',
    underpaidAmount: 'المبلغ المحول غير مكتمل',
    invoiceExpired: 'انتهت صلاحية الفاتورة',
    paymentFailed: 'فشلت المعاملة',

    paymentConfirmedTitle: 'تم تأكيد الإيداع بنجاح!',
    paymentConfirmedSubtitle: 'تم التحقق من المعاملة عبر البلوكشين وإيداع الرصيد في حسابك.',
    amountCredited: 'المبلغ المودع',
    network: 'الشبكة',
    transaction: 'رقم المعاملة',

    paymentWindow: 'نافذة صلاحية الدفع',
    timeExpired: 'انتهى الوقت المحدد. يرجى إنشاء فاتورة جديدة.',
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
  isArabic: boolean;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  t: translations.en,
  isArabic: false,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    // Check saved language preference or browser language
    const saved = localStorage.getItem('nexus_language') as Language;
    if (saved === 'ar' || saved === 'en') {
      setLanguageState(saved);
    } else if (typeof navigator !== 'undefined' && navigator.language.startsWith('ar')) {
      setLanguageState('ar');
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('nexus_language', lang);
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t: translations[language],
        isArabic: language === 'ar',
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
