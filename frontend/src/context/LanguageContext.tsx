'use client';

/**
 * src/context/LanguageContext.tsx
 *
 * Comprehensive i18n Context supporting 8 major global languages:
 * English (en), Arabic (ar), Urdu (ur), Russian (ru), Turkish (tr),
 * Spanish (es), French (fr), and Simplified Chinese (zh).
 *
 * Implements strict LTR isolation for numbers, hashes, and currency amounts.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'en' | 'ar' | 'ur' | 'ru' | 'tr' | 'es' | 'fr' | 'zh';

export interface LanguageOption {
  code: Language;
  label: string;
  flag: string;
  dir: 'ltr' | 'rtl';
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English', flag: '🇺🇸', dir: 'ltr' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦', dir: 'rtl' },
  { code: 'ur', label: 'اردو', flag: '🇵🇰', dir: 'rtl' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺', dir: 'ltr' },
  { code: 'tr', label: 'Türkçe', flag: '🇹🇷', dir: 'ltr' },
  { code: 'es', label: 'Español', flag: '🇪🇸', dir: 'ltr' },
  { code: 'fr', label: 'Français', flag: '🇫🇷', dir: 'ltr' },
  { code: 'zh', label: '中文 (简体)', flag: '🇨🇳', dir: 'ltr' },
];

export interface Translations {
  // Brand & Navbar
  brandTitle: string;
  brandSubtitle: string;
  brandTag: string;
  sslEncrypted: string;
  networkLive: string;

  // Checkout Portal (page.tsx)
  terminalBadge: string;
  checkoutTitle: string;
  checkoutSubtitle: string;
  selectNetworkLabel: string;
  paymentAmountLabel: string;
  enterCustomAmount: string;
  proceedToPayment: string;
  generatingInvoice: string;
  startNewPayment: string;
  protocolFooter: string;

  // Network Selector
  selectDepositNetwork: string;
  stablecoinBadge: string;
  speed: string;
  networkGas: string;
  subsidized: string;
  standard: string;

  // Digital Wallets Tab / Options
  cryptoTab: string;
  digitalWalletsTab: string;
  noDigitalWallets: string;
  accountTitle: string;
  accountNumber: string;
  instructions: string;
  copyDetails: string;

  // Checkout Card & Invoice (/pay/[invoiceId])
  returnToCheckout: string;
  fetchingDetails: string;
  invoiceExpiredOrNotFound: string;
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

  // FAQs
  faq1Question: string;
  faq1Answer: string;
  faq2Question: string;
  faq2Answer: string;
  faq3Question: string;
  faq3Answer: string;
}

const translations: Record<Language, Translations> = {
  // 1. English
  en: {
    brandTitle: 'NEXUS',
    brandSubtitle: 'GATEWAY',
    brandTag: 'Decentralized Payment Rails',
    sslEncrypted: '256-Bit SSL Encrypted Checkout',
    networkLive: 'Network Connected',

    terminalBadge: 'Non-Custodial Decentralized Payment Terminal',
    checkoutTitle: 'Secure Crypto Checkout',
    checkoutSubtitle: 'Select your preferred blockchain network and proceed with instant automated settlement.',
    selectNetworkLabel: '1. Select Payment Network',
    paymentAmountLabel: '2. Payment Amount (USD)',
    enterCustomAmount: 'Enter custom amount',
    proceedToPayment: 'Proceed to Payment',
    generatingInvoice: 'Generating Secure Invoice...',
    startNewPayment: 'Start New Payment',
    protocolFooter: 'Nexus Gateway Protocol • Institutional Non-Custodial Clearing Rails',

    selectDepositNetwork: 'Select Deposit Network',
    stablecoinBadge: 'USDT Stablecoin',
    speed: 'Speed',
    networkGas: 'Network Gas',
    subsidized: 'Subsidized',
    standard: 'Standard',

    cryptoTab: 'Crypto (USDT)',
    digitalWalletsTab: 'Local & Digital Wallets',
    noDigitalWallets: 'No alternative digital wallets active at this moment.',
    accountTitle: 'Account Title',
    accountNumber: 'Account / IBAN',
    instructions: 'Instructions',
    copyDetails: 'Copy Details',

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
    expiredNotice: 'The 15-minute deposit window has ended. To safeguard your funds, please generate a new deposit address.',
    generateNewInvoice: 'Generate New Invoice',
    securedBy: 'Secured by Non-Custodial Smart Contract Rails',

    amountToPay: 'Amount to Pay',
    sendExactAmount: 'Send exact amount',
    copy: 'Copy',
    copied: 'Copied!',
    depositAddress: 'Deposit Address',
    viewOnExplorer: 'View on Explorer',
    warningNotice: 'Send only USDT to this address on the chosen network. Transferring any other asset will result in permanent loss.',

    awaitingPayment: 'Awaiting Payment',
    paymentDetected: 'Payment Detected',
    confirmations: 'Confirmations',
    paymentConfirmed: 'Payment Confirmed',
    underpaidAmount: 'Partial Payment Detected',
    invoiceExpired: 'Invoice Expired',
    paymentFailed: 'Payment Failed',

    paymentConfirmedTitle: 'Payment Confirmed & Settled',
    paymentConfirmedSubtitle: 'Your funds have been securely credited and settled via on-chain rails.',
    amountCredited: 'Amount Credited',
    network: 'Network',
    transaction: 'Transaction',

    paymentWindow: 'Payment Window',
    timeExpired: 'Expired',

    faq1Question: 'How does non-custodial payment protection work?',
    faq1Answer: 'Each payment invoice generates an isolated, one-time cryptographic deposit address on the blockchain. Funds are verified directly on-chain without intermediary holding, ensuring complete security and zero custodial risk.',
    faq2Question: 'How fast is the payment confirmed?',
    faq2Answer: 'BNB Smart Chain (BEP-20) transfers confirm within 3 to 15 seconds. TRON (TRC-20) transfers confirm in approximately 60 seconds.',
    faq3Question: 'Which wallets and exchanges can I pay from?',
    faq3Answer: 'You can transfer from any Web3 wallet (MetaMask, Trust Wallet, TronLink, Ledger) or directly from any exchange (Binance, OKX, Bybit, KuCoin) by scanning the QR code or copying the address.',
  },

  // 2. Arabic
  ar: {
    brandTitle: 'NEXUS',
    brandSubtitle: 'GATEWAY',
    brandTag: 'بوابة الدفع اللامركزية المعتمدة',
    sslEncrypted: 'دفع مشفر بحماية SSL 256-Bit',
    networkLive: 'اتصال مباشر بالشبكة',

    terminalBadge: 'محطة دفع لامركزية غير احتجازية فائقة الأمان',
    checkoutTitle: 'بوابة الدفع الرقمي الآمنة',
    checkoutSubtitle: 'اختر شبكة البلوكتشين المناسبة لك وتابع عملية الإيداع مع تسوية فورية وتلقائية.',
    selectNetworkLabel: '١. اختر شبكة الدفع',
    paymentAmountLabel: '٢. مبلغ الدفع (USD)',
    enterCustomAmount: 'أدخل مبلغاً مخصصاً',
    proceedToPayment: 'الانتقال إلى الدفع',
    generatingInvoice: 'جاري إنشاء فاتورة دفع مشفرة...',
    startNewPayment: 'بدء عملية دفع جديدة',
    protocolFooter: 'بروتوكول Nexus Gateway • شبكة التسوية الرقمية المؤسسية غير الاحتجازية',

    selectDepositNetwork: 'اختر شبكة الإيداع',
    stablecoinBadge: 'عملة USDT الرقمية',
    speed: 'سرعة التحقق',
    networkGas: 'رسوم الغاز',
    subsidized: 'مدعومة',
    standard: 'قياسية',

    cryptoTab: 'العملات الرقمية (USDT)',
    digitalWalletsTab: 'المحافظ الإلكترونية والحسابات المحلية',
    noDigitalWallets: 'لا توجد محافظ إلكترونية نشطة في الوقت الحالي.',
    accountTitle: 'اسم الحساب',
    accountNumber: 'رقم الحساب / الآيبان',
    instructions: 'تعليمات التحويل',
    copyDetails: 'نسخ البيانات',

    returnToCheckout: 'العودة إلى صفحة الدفع',
    fetchingDetails: 'جاري تحميل تفاصيل الدفع المشفرة...',
    invoiceExpiredOrNotFound: 'انتهت صلاحية الفاتورة أو غير موجودة',
    completeDeposit: 'إتمام عملية الإيداع',
    invoiceNumber: 'رقم الفاتورة #',
    paymentSummaryAndFees: 'ملخص الدفع والرسوم',
    invoiceAmount: 'قيمة الإيداع',
    networkFee: 'رسوم الشبكة',
    totalDue: 'الإجمالي المطلوب دفعه',
    payVia: 'الدفع عبر',
    confirmingIn: 'التأكيد خلال',
    instantOneClick: 'دفع فوري بضغطة واحدة • أو امسح رمز الاستجابة السريعة (QR) أدناه',
    paymentSessionExpired: 'انتهت جلسة الدفع',
    expiredNotice: 'انتهت نافذة الإيداع المحددة بـ 15 دقيقة. لحماية أموالك، يرجى إنشاء عنوان دفع جديد.',
    generateNewInvoice: 'إنشاء فاتورة جديدة',
    securedBy: 'محمي بواسطة عقود ذكية لامركزية غير احتجازية',

    amountToPay: 'المبلغ المطلوب إرساله',
    sendExactAmount: 'أرسل المبلغ بدقة',
    copy: 'نسخ',
    copied: 'تم النسخ!',
    depositAddress: 'عنوان الإيداع المخصص',
    viewOnExplorer: 'عرض على مستكشف البلوكتشين',
    warningNotice: 'أرسل فقط عملة USDT عبر الشبكة المحددة إلى هذا العنوان. إرسال أي عملة أخرى أو استخدام شبكة خاطئة سيؤدي إلى فقدان أموالك بشكل دائم.',

    awaitingPayment: 'في انتظار الإيداع',
    paymentDetected: 'تم رصد التحويل على البلوكتشين',
    confirmations: 'تأكيدات الشبكة',
    paymentConfirmed: 'تم تأكيد الدفع بنجاح',
    underpaidAmount: 'تم رصد دفعة جزئية (أقل من المطلوب)',
    invoiceExpired: 'انتهت صلاحية الفاتورة',
    paymentFailed: 'فشلت عملية التحقق',

    paymentConfirmedTitle: 'تم تأكيد وتسوية الدفع بنجاح',
    paymentConfirmedSubtitle: 'تم التحقق من إيداعك وقيده بشكل نهائي وفوري عبر شبكة البلوكتشين.',
    amountCredited: 'المبلغ المقيد لحسابك',
    network: 'الشبكة',
    transaction: 'معرّف المعاملة (TxID)',

    paymentWindow: 'الوقت المتبقي',
    timeExpired: 'انتهى الوقت',

    faq1Question: 'كيف تعمل الحماية غير الاحتجازية للأموال؟',
    faq1Answer: 'تقوم المنظومة بتوليد عنوان إيداع مشفر وفريد لكل فاتورة على حدة. تتم معالجة المعاملة مباشرة على شبكة البلوكتشين بدون أي وسيط احتجازي، مما يضمن أقصى معايير الأمان المالي وانعدام المخاطر.',
    faq2Question: 'ما هي سرعة تأكيد عملية الإيداع؟',
    faq2Answer: 'تستغرق التحويلات عبر شبكة BNB Smart Chain (BEP-20) من 3 إلى 15 ثانية فقط. بينما تستغرق التحويلات عبر شبكة TRON (TRC-20) حوالي 60 ثانية للتسوية النهائية.',
    faq3Question: 'ما هي المحافظ والمنصات التي يمكنني الدفع منها؟',
    faq3Answer: 'يمكنك التحويل من أي محفظة شخصية (مثل MetaMask أو Trust Wallet أو TronLink أو Ledger) أو مباشرة من أي منصة تداول عالمية (مثل Binance أو OKX أو Bybit أو KuCoin) بمسح رمز QR أو نسخ العنوان.',
  },

  // 3. Urdu
  ur: {
    brandTitle: 'NEXUS',
    brandSubtitle: 'GATEWAY',
    brandTag: 'محفوظ اور خودکار کرپٹو ادائیگی نظام',
    sslEncrypted: '256-بٹ SSL انکرپٹڈ ادائیگی',
    networkLive: 'نیٹ ورک سے لائیو منسلک',

    terminalBadge: 'نان کسٹوڈیل خودکار ادائیگی ٹرمینل',
    checkoutTitle: 'محفوظ کرپٹو چیک آؤٹ',
    checkoutSubtitle: 'اپنا پسندیدہ بلاک چین نیٹ ورک منتخب کریں اور فوری خودکار تصفیہ کے ساتھ آگے بڑھیں۔',
    selectNetworkLabel: '۱. ادائیگی کا نیٹ ورک منتخب کریں',
    paymentAmountLabel: '۲. ادائیگی کی رقم (USD)',
    enterCustomAmount: 'اپنی مرضی کی رقم درج کریں',
    proceedToPayment: 'ادائیگی کے لیے آگے بڑھیں',
    generatingInvoice: 'محفوظ انوائس تیار کی جا رہی ہے...',
    startNewPayment: 'نئی ادائیگی شروع کریں',
    protocolFooter: 'Nexus Gateway Protocol • ادارہ جاتی نان کسٹوڈیل تصفیہ نظام',

    selectDepositNetwork: 'ڈپازٹ نیٹ ورک منتخب کریں',
    stablecoinBadge: 'USDT اسٹیبل کوائن',
    speed: 'رفتار',
    networkGas: 'نیٹ ورک فیس',
    subsidized: 'رعایتی',
    standard: 'معیاری',

    cryptoTab: 'کرپٹو کرنسی (USDT)',
    digitalWalletsTab: 'مقامی والٹس (JazzCash / EasyPaisa)',
    noDigitalWallets: 'اس وقت کوئی مقامی ڈیجیٹل والٹ فعال نہیں ہے۔',
    accountTitle: 'اکاؤنٹ کا نام',
    accountNumber: 'اکاؤنٹ نمبر / IBAN',
    instructions: 'ہدایات',
    copyDetails: 'تفصیلات کاپی کریں',

    returnToCheckout: 'چیک آؤٹ پر واپس جائیں',
    fetchingDetails: 'ادائیگی کی تفصیلات لوڈ ہو رہی ہیں...',
    invoiceExpiredOrNotFound: 'انوائس کی میعاد ختم یا دستیاب نہیں',
    completeDeposit: 'ڈپازٹ مکمل کریں',
    invoiceNumber: 'انوائس نمبر #',
    paymentSummaryAndFees: 'ادائیگی کا خلاصہ اور فیس',
    invoiceAmount: 'انوائس کی رقم',
    networkFee: 'نیٹ ورک فیس',
    totalDue: 'کل واجب الادا رقم',
    payVia: 'ادائیگی بذریعہ',
    confirmingIn: 'تصدیق کا وقت',
    instantOneClick: 'فوری 1-کلک ادائیگی • یا نیچے دیا گیا QR کوڈ اسکین کریں',
    paymentSessionExpired: 'ادائیگی کا سیشن ختم ہوگیا',
    expiredNotice: '15 منٹ کی ڈیڈ لائن ختم ہو چکی ہے۔ فنڈز کے تحفظ کے لیے نیا پتہ بنائیں۔',
    generateNewInvoice: 'نئی انوائس بنائیں',
    securedBy: 'محفوظ بذریعہ اسمارٹ کانٹریکٹ نان کسٹوڈیل نیٹ ورک',

    amountToPay: 'بھیجنے کی رقم',
    sendExactAmount: 'بالکل درست رقم بھیجیں',
    copy: 'کاپی کریں',
    copied: 'کاپی ہو گیا!',
    depositAddress: 'ڈپازٹ کا پتہ',
    viewOnExplorer: 'ایکسپلورر پر دیکھیں',
    warningNotice: 'اس پتے پر منتخب کردہ نیٹ ورک کے ذریعے صرف USDT بھیجیں۔ کوئی اور اثاثہ بھیجنے پر رقم ضائع ہو سکتی ہے۔',

    awaitingPayment: 'ادائیگی کا انتظار ہے',
    paymentDetected: 'ٹرانزیکشن بلاک چین پر موصول ہو گئی',
    confirmations: 'تصدیقات',
    paymentConfirmed: 'ادائیگی کامیابی سے تصدیق شدہ',
    underpaidAmount: 'جزوی رقم موصول ہوئی ہے',
    invoiceExpired: 'انوائس کی میعاد ختم ہو گئی',
    paymentFailed: 'ادائیگی ناکام ہو گئی',

    paymentConfirmedTitle: 'ادائیگی کی تصدیق اور تصفیہ مکمل',
    paymentConfirmedSubtitle: 'آپ کی رقم محفوظ طریقے سے اکاؤنٹ میں جمع کر دی گئی ہے۔',
    amountCredited: 'جمع شدہ رقم',
    network: 'نیٹ ورک',
    transaction: 'ٹرانزیکشن آئی ڈی (TxID)',

    paymentWindow: 'باقی وقت',
    timeExpired: 'ختم شد',

    faq1Question: 'نان کسٹوڈیل ادائیگی کا تحفظ کیسے کام کرتا ہے؟',
    faq1Answer: 'ہر انوائس کے لیے بلاک چین پر ایک الگ اور محفوظ پتہ خودکار طور پر تیار ہوتا ہے۔ فنڈز بلاک چین پر براہ راست تصدیق ہوتے ہیں جس میں کسٹوڈی کا کوئی خطرہ نہیں ہوتا۔',
    faq2Question: 'ادائیگی کتنی دیر میں تصدیق ہوتی ہے؟',
    faq2Answer: 'BNB Smart Chain (BEP-20) پر 3 سے 15 سیکنڈ لگتے ہیں، جبکہ TRON (TRC-20) پر تقریباً 60 سیکنڈ لگتے ہیں۔',
    faq3Question: 'میں کن والٹس یا ایکسچینجز سے ادائیگی کر سکتا ہوں؟',
    faq3Answer: 'آپ کسی بھی پرسنل والٹ (Trust Wallet, MetaMask, TronLink) یا کسی بھی ایکسچینج (Binance, Bybit, OKX) سے براہ راست بھیج سکتے ہیں۔',
  },

  // 4. Russian
  ru: {
    brandTitle: 'NEXUS',
    brandSubtitle: 'GATEWAY',
    brandTag: 'Децентрализованный платежный шлюз',
    sslEncrypted: '256-битное SSL шифрование',
    networkLive: 'Сеть активна',

    terminalBadge: 'Некастодиальный децентрализованный платежный терминал',
    checkoutTitle: 'Безопасная криптооплата',
    checkoutSubtitle: 'Выберите блокчейн-сеть и перейдите к мгновенному автоматическому расчету.',
    selectNetworkLabel: '1. Выберите сеть для оплаты',
    paymentAmountLabel: '2. Сумма платежа (USD)',
    enterCustomAmount: 'Введите другую сумму',
    proceedToPayment: 'Перейти к оплате',
    generatingInvoice: 'Создание защищенного счета...',
    startNewPayment: 'Создать новый платеж',
    protocolFooter: 'Протокол Nexus Gateway • Институциональный некастодиальный расчетный шлюз',

    selectDepositNetwork: 'Выберите сеть депозита',
    stablecoinBadge: 'Стейблкоин USDT',
    speed: 'Скорость',
    networkGas: 'Комиссия сети',
    subsidized: 'Субсидированная',
    standard: 'Стандартная',

    cryptoTab: 'Криптовалюта (USDT)',
    digitalWalletsTab: 'Электронные кошельки',
    noDigitalWallets: 'В данный момент нет активных сторонних кошельков.',
    accountTitle: 'Имя получателя',
    accountNumber: 'Номер счета / карты',
    instructions: 'Инструкции',
    copyDetails: 'Копировать реквизиты',

    returnToCheckout: 'Вернуться к оформлению',
    fetchingDetails: 'Загрузка данных платежа...',
    invoiceExpiredOrNotFound: 'Счет устарел или не найден',
    completeDeposit: 'Завершить депозит',
    invoiceNumber: 'Счет №',
    paymentSummaryAndFees: 'Итоговая сумма и комиссии',
    invoiceAmount: 'Сумма счета',
    networkFee: 'Комиссия сети',
    totalDue: 'К оплате',
    payVia: 'Оплата через',
    confirmingIn: 'Подтверждение за',
    instantOneClick: 'Мгновенный перевод • Или отсканируйте QR-код ниже',
    paymentSessionExpired: 'Платежная сессия истекла',
    expiredNotice: '15-минутный интервал оплаты завершился. Создайте новый адрес депозита.',
    generateNewInvoice: 'Создать новый счет',
    securedBy: 'Защищено некастодиальными смарт-контрактами',

    amountToPay: 'Сумма к отправке',
    sendExactAmount: 'Отправьте точную сумму',
    copy: 'Копировать',
    copied: 'Скопировано!',
    depositAddress: 'Адрес депозита',
    viewOnExplorer: 'Посмотреть в эксплорере',
    warningNotice: 'Отправляйте только USDT в выбранной сети на этот адрес. Отправка других активов приведет к безвозвратной потере.',

    awaitingPayment: 'Ожидание оплаты',
    paymentDetected: 'Платеж обнаружен в сети',
    confirmations: 'Подтверждения',
    paymentConfirmed: 'Оплата подтверждена',
    underpaidAmount: 'Обнаружена неполная оплата',
    invoiceExpired: 'Срок действия счета истек',
    paymentFailed: 'Ошибка оплаты',

    paymentConfirmedTitle: 'Платеж успешно подтвержден',
    paymentConfirmedSubtitle: 'Ваши средства зачислены в полном объеме через ончейн-протокол.',
    amountCredited: 'Зачисленная сумма',
    network: 'Сеть',
    transaction: 'Хэш транзакции (TxID)',

    paymentWindow: 'Время на оплату',
    timeExpired: 'Истекло',

    faq1Question: 'Как работает некастодиальная защита платежей?',
    faq1Answer: 'Для каждого счета генерируется изолированный одноразовый адрес в блокчейне. Оплата проверяется непосредственно в распределенной сети без посредников, гарантируя безопасность.',
    faq2Question: 'Как быстро подтверждается транзакция?',
    faq2Answer: 'В сети BNB Smart Chain (BEP-20) подтверждение занимает от 3 до 15 секунд. В сети TRON (TRC-20) — около 60 секунд.',
    faq3Question: 'С каких кошельков и бирж можно платить?',
    faq3Answer: 'Вы можете отправить перевод с любого Web3-кошелька (MetaMask, Trust Wallet, TronLink) или с любой биржи (Binance, OKX, Bybit, KuCoin).',
  },

  // 5. Turkish
  tr: {
    brandTitle: 'NEXUS',
    brandSubtitle: 'GATEWAY',
    brandTag: 'Merkeziyetsiz Ödeme Ağı',
    sslEncrypted: '256-Bit SSL Şifreli Ödeme',
    networkLive: 'Ağ Bağlantısı Canlı',

    terminalBadge: 'Gözetimsiz Merkeziyetsiz Ödeme Terminali',
    checkoutTitle: 'Güvenli Kripto Ödeme',
    checkoutSubtitle: 'Tercih ettiğiniz blokzincir ağını seçin ve anında otomatik ödeme ile devam edin.',
    selectNetworkLabel: '1. Ödeme Ağını Seçin',
    paymentAmountLabel: '2. Ödeme Tutarı (USD)',
    enterCustomAmount: 'Farklı bir tutar girin',
    proceedToPayment: 'Ödemeye Devam Et',
    generatingInvoice: 'Güvenli Fatura Oluşturuluyor...',
    startNewPayment: 'Yeni Ödeme Başlat',
    protocolFooter: 'Nexus Gateway Protokolü • Kurumsal Gözetimsiz Takas Altyapısı',

    selectDepositNetwork: 'Yatırma Ağını Seçin',
    stablecoinBadge: 'USDT Sabit Kripto Para',
    speed: 'Hız',
    networkGas: 'Ağ Gaz Ücreti',
    subsidized: 'Sübvanse Edilmiş',
    standard: 'Standart',

    cryptoTab: 'Kripto (USDT)',
    digitalWalletsTab: 'Yerel ve Dijital Cüzdanlar',
    noDigitalWallets: 'Şu anda aktif alternatif dijital cüzdan bulunmamaktadır.',
    accountTitle: 'Hesap Sahibi',
    accountNumber: 'Hesap No / IBAN',
    instructions: 'Talimatlar',
    copyDetails: 'Bilgileri Kopyala',

    returnToCheckout: 'Ödemeye Geri Dön',
    fetchingDetails: 'Güvenli ödeme detayları yükleniyor...',
    invoiceExpiredOrNotFound: 'Faturanın Süresi Doldu veya Bulunamadı',
    completeDeposit: 'Yatırma İşlemini Tamamla',
    invoiceNumber: 'Fatura No #',
    paymentSummaryAndFees: 'Ödeme Özeti ve Ücretler',
    invoiceAmount: 'Fatura Tutarı',
    networkFee: 'Ağ Ücreti',
    totalDue: 'Toplam Ödenecek',
    payVia: 'Ödeme Yolu',
    confirmingIn: 'Onay Süresi',
    instantOneClick: 'Anında 1 Tıkla Transfer • Veya aşağıdaki QR kodu tarayın',
    paymentSessionExpired: 'Ödeme Oturumu Sona Erdi',
    expiredNotice: '15 dakikalık ödeme süresi doldu. Güvenliğiniz için lütfen yeni bir fatura adresi oluşturun.',
    generateNewInvoice: 'Yeni Fatura Oluştur',
    securedBy: 'Gözetimsiz Akıllı Sözleşmelerle Korunmaktadır',

    amountToPay: 'Ödenecek Tutar',
    sendExactAmount: 'Tam tutarı gönderin',
    copy: 'Kopyala',
    copied: 'Kopyalandı!',
    depositAddress: 'Yatırma Adresi',
    viewOnExplorer: 'Blok Gezgininde Görüntüle',
    warningNotice: 'Bu adrese yalnızca seçilen ağ üzerinden USDT gönderin. Başka bir varlık göndermek kalıcı kayba neden olur.',

    awaitingPayment: 'Ödeme Bekleniyor',
    paymentDetected: 'Ödeme Blokzincirde Algılandı',
    confirmations: 'Onaylar',
    paymentConfirmed: 'Ödeme Başarıyla Onaylandı',
    underpaidAmount: 'Kısmi Ödeme Algılandı',
    invoiceExpired: 'Fatura Süresi Doldu',
    paymentFailed: 'Ödeme Başarısız Oldu',

    paymentConfirmedTitle: 'Ödeme Onaylandı ve Tamamlandı',
    paymentConfirmedSubtitle: 'Bakiyeniz güvenli bir şekilde hesabınıza aktarılmıştır.',
    amountCredited: 'Yatırılan Tutar',
    network: 'Ağ',
    transaction: 'İşlem Kodu (TxID)',

    paymentWindow: 'Ödeme Süresi',
    timeExpired: 'Süre Doldu',

    faq1Question: 'Gözetimsiz ödeme koruması nasıl çalışır?',
    faq1Answer: 'Her fatura için blokzincirde izole ve tek kullanımlık bir kriptografik adres üretilir. Ödeme aracı olmadan doğrulanır.',
    faq2Question: 'Ödeme ne kadar sürede onaylanır?',
    faq2Answer: 'BNB Smart Chain (BEP-20) 3-15 saniyede, TRON (TRC-20) ise yaklaşık 60 saniyede onaylanır.',
    faq3Question: 'Hangi cüzdan ve borsalardan ödeme yapabilirim?',
    faq3Answer: 'Tüm Web3 cüzdanlarından (MetaMask, Trust Wallet, TronLink) veya borsalardan (Binance, OKX, Bybit) doğrudan transfer yapabilirsiniz.',
  },

  // 6. Spanish
  es: {
    brandTitle: 'NEXUS',
    brandSubtitle: 'GATEWAY',
    brandTag: 'Pasarela de Pagos Descentralizada',
    sslEncrypted: 'Pago Seguro Encriptado SSL de 256 Bits',
    networkLive: 'Red Conectada en Vivo',

    terminalBadge: 'Terminal de Pago Descentralizada Sin Custodia',
    checkoutTitle: 'Pago Cripto Seguro',
    checkoutSubtitle: 'Seleccione su red de blockchain preferida y continúe con la liquidación automática instantánea.',
    selectNetworkLabel: '1. Seleccione la Red de Pago',
    paymentAmountLabel: '2. Monto a Pagar (USD)',
    enterCustomAmount: 'Ingrese monto personalizado',
    proceedToPayment: 'Proceder al Pago',
    generatingInvoice: 'Generando Factura Segura...',
    startNewPayment: 'Iniciar Nuevo Pago',
    protocolFooter: 'Protocolo Nexus Gateway • Rieles de Liquidación Institucional Sin Custodia',

    selectDepositNetwork: 'Seleccionar Red de Depósito',
    stablecoinBadge: 'Moneda Estable USDT',
    speed: 'Velocidad',
    networkGas: 'Gas de Red',
    subsidized: 'Subvencionado',
    standard: 'Estándar',

    cryptoTab: 'Cripto (USDT)',
    digitalWalletsTab: 'Billeteras Digitales y Locales',
    noDigitalWallets: 'No hay billeteras digitales alternativas activas en este momento.',
    accountTitle: 'Titular de la Cuenta',
    accountNumber: 'Número de Cuenta / IBAN',
    instructions: 'Instrucciones',
    copyDetails: 'Copiar Datos',

    returnToCheckout: 'Volver al Checkout',
    fetchingDetails: 'Cargando detalles de pago seguro...',
    invoiceExpiredOrNotFound: 'Factura Expirada o No Encontrada',
    completeDeposit: 'Completar Depósito',
    invoiceNumber: 'Factura #',
    paymentSummaryAndFees: 'Resumen de Pago y Tarifas',
    invoiceAmount: 'Monto de la Factura',
    networkFee: 'Tarifa de Red',
    totalDue: 'Total a Pagar',
    payVia: 'Pagar mediante',
    confirmingIn: 'Confirmación en',
    instantOneClick: 'Transferencia instantánea en 1 clic • O escanee el código QR a continuación',
    paymentSessionExpired: 'Sesión de Pago Expirada',
    expiredNotice: 'El plazo de 15 minutos ha finalizado. Genere una nueva dirección para resguardar sus fondos.',
    generateNewInvoice: 'Generar Nueva Factura',
    securedBy: 'Protegido por Contratos Inteligentes Sin Custodia',

    amountToPay: 'Monto a Enviar',
    sendExactAmount: 'Envíe el monto exacto',
    copy: 'Copiar',
    copied: '¡Copiado!',
    depositAddress: 'Dirección de Depósito',
    viewOnExplorer: 'Ver en Explorador',
    warningNotice: 'Envíe únicamente USDT en la red seleccionada a esta dirección. Enviar cualquier otro activo provocará su pérdida permanente.',

    awaitingPayment: 'Esperando Pago',
    paymentDetected: 'Pago Detectado en la Red',
    confirmations: 'Confirmaciones',
    paymentConfirmed: 'Pago Confirmado Exitosamente',
    underpaidAmount: 'Pago Parcial Detectado',
    invoiceExpired: 'Factura Expirada',
    paymentFailed: 'Pago Fallido',

    paymentConfirmedTitle: 'Pago Confirmado y Liquidado',
    paymentConfirmedSubtitle: 'Sus fondos han sido acreditados de forma segura mediante liquidación on-chain.',
    amountCredited: 'Monto Acreditado',
    network: 'Red',
    transaction: 'ID de Transacción (TxID)',

    paymentWindow: 'Ventana de Pago',
    timeExpired: 'Expirado',

    faq1Question: '¿Cómo funciona la protección sin custodia?',
    faq1Answer: 'Cada factura genera una dirección criptográfica aislada y única en la blockchain. Los fondos se verifican directamente on-chain sin custodia de intermediarios.',
    faq2Question: '¿Qué tan rápido se confirma el pago?',
    faq2Answer: 'BNB Smart Chain (BEP-20) se confirma en 3 a 15 segundos. TRON (TRC-20) se liquida en aproximadamente 60 segundos.',
    faq3Question: '¿Desde qué billeteras o exchanges puedo pagar?',
    faq3Answer: 'Puede transferir desde cualquier billetera Web3 (MetaMask, Trust Wallet, TronLink) o directamente desde exchanges (Binance, OKX, Bybit).',
  },

  // 7. French
  fr: {
    brandTitle: 'NEXUS',
    brandSubtitle: 'GATEWAY',
    brandTag: 'Passerelle de Paiement Décentralisée',
    sslEncrypted: 'Paiement Sécurisé SSL 256 Bits',
    networkLive: 'Réseau Connecté en Direct',

    terminalBadge: 'Terminal de Paiement Décentralisé Non-Custodial',
    checkoutTitle: 'Paiement Crypto Sécurisé',
    checkoutSubtitle: 'Sélectionnez votre réseau blockchain et procédez au règlement automatisé instantané.',
    selectNetworkLabel: '1. Sélectionnez le Réseau de Paiement',
    paymentAmountLabel: '2. Montant du Paiement (USD)',
    enterCustomAmount: 'Entrez un montant personnalisé',
    proceedToPayment: 'Procéder au Paiement',
    generatingInvoice: 'Génération de la Facture Sécurisée...',
    startNewPayment: 'Commencer un Nouveau Paiement',
    protocolFooter: 'Protocole Nexus Gateway • Infrastructure de Règlement Institutionnel Non-Custodial',

    selectDepositNetwork: 'Sélectionner le Réseau de Dépôt',
    stablecoinBadge: 'Stablecoin USDT',
    speed: 'Vitesse',
    networkGas: 'Frais de Réseau',
    subsidized: 'Subventionné',
    standard: 'Standard',

    cryptoTab: 'Crypto (USDT)',
    digitalWalletsTab: 'Portefeuilles Électroniques & Locaux',
    noDigitalWallets: 'Aucun portefeuille alternatif actif pour le moment.',
    accountTitle: 'Titulaire du Compte',
    accountNumber: 'Numéro de Compte / IBAN',
    instructions: 'Instructions',
    copyDetails: 'Copier les Coordonnées',

    returnToCheckout: 'Retour au Paiement',
    fetchingDetails: 'Chargement des détails de paiement...',
    invoiceExpiredOrNotFound: 'Facture Expirée ou Introuvable',
    completeDeposit: 'Finaliser le Dépôt',
    invoiceNumber: 'Facture #',
    paymentSummaryAndFees: 'Récapitulatif et Frais',
    invoiceAmount: 'Montant de la Facture',
    networkFee: 'Frais de Réseau',
    totalDue: 'Total à Payer',
    payVia: 'Payer via',
    confirmingIn: 'Confirmation dans',
    instantOneClick: 'Transfert instantané en 1 clic • Ou scannez le code QR ci-dessous',
    paymentSessionExpired: 'Session de Paiement Expirée',
    expiredNotice: 'Le délai de 15 minutes est écoulé. Veuillez générer une nouvelle adresse pour vos fonds.',
    generateNewInvoice: 'Générer une Nouvelle Facture',
    securedBy: 'Sécurisé par des Smart Contracts Non-Custodial',

    amountToPay: 'Montant à Envoyer',
    sendExactAmount: 'Envoyez le montant exact',
    copy: 'Copier',
    copied: 'Copié !',
    depositAddress: 'Adresse de Dépôt',
    viewOnExplorer: 'Voir sur l’Explorateur',
    warningNotice: 'Envoyez uniquement des USDT sur le réseau sélectionné. Tout autre actif envoyé sera irrémédiablement perdu.',

    awaitingPayment: 'En Attente de Paiement',
    paymentDetected: 'Paiement Détecté sur la Blockchain',
    confirmations: 'Confirmations',
    paymentConfirmed: 'Paiement Confirmé avec Succès',
    underpaidAmount: 'Paiement Partiel Détecté',
    invoiceExpired: 'Facture Expirée',
    paymentFailed: 'Échec du Paiement',

    paymentConfirmedTitle: 'Paiement Confirmé et Réglé',
    paymentConfirmedSubtitle: 'Vos fonds ont été crédités et sécurisés via les protocoles on-chain.',
    amountCredited: 'Montant Crédité',
    network: 'Réseau',
    transaction: 'ID de Transaction (TxID)',

    paymentWindow: 'Délai de Paiement',
    timeExpired: 'Expiré',

    faq1Question: 'Comment fonctionne la protection non-custodiale ?',
    faq1Answer: 'Chaque facture génère une adresse cryptographique unique et isolée. Les fonds sont validés sur la blockchain sans détention intermédiaire.',
    faq2Question: 'À quelle vitesse le paiement est-il confirmé ?',
    faq2Answer: 'BNB Smart Chain (BEP-20) confirme en 3 à 15 secondes. TRON (TRC-20) se règle en environ 60 secondes.',
    faq3Question: 'Quels portefeuilles et plateformes sont compatibles ?',
    faq3Answer: 'Vous pouvez payer depuis n’importe quel portefeuille Web3 (MetaMask, Trust Wallet, TronLink) ou plateforme (Binance, OKX, Bybit).',
  },

  // 8. Chinese (Simplified)
  zh: {
    brandTitle: 'NEXUS',
    brandSubtitle: 'GATEWAY',
    brandTag: '去中心化安全加密支付网关',
    sslEncrypted: '256位 SSL 加密安全结账',
    networkLive: '节点实时在线',

    terminalBadge: '非托管式去中心化安全支付终端',
    checkoutTitle: '安全加密货币结账',
    checkoutSubtitle: '选择您偏好的区块链网络，享受毫秒级自动化结算服务。',
    selectNetworkLabel: '1. 选择支付网络',
    paymentAmountLabel: '2. 支付金额 (USD)',
    enterCustomAmount: '输入自定义金额',
    proceedToPayment: '前往支付',
    generatingInvoice: '正在生成安全账单...',
    startNewPayment: '发起新支付',
    protocolFooter: 'Nexus Gateway 协议 • 机构级非托管清算结算架构',

    selectDepositNetwork: '选择充值网络',
    stablecoinBadge: 'USDT 稳定币',
    speed: '到账速度',
    networkGas: '网络燃气费',
    subsidized: '平台补贴',
    standard: '标准',

    cryptoTab: '加密货币 (USDT)',
    digitalWalletsTab: '电子钱包与本地账户',
    noDigitalWallets: '当前暂无激活的第三方电子钱包。',
    accountTitle: '账户姓名',
    accountNumber: '账号 / IBAN',
    instructions: '转账说明',
    copyDetails: '复制信息',

    returnToCheckout: '返回结账页',
    fetchingDetails: '正在获取加密支付详情...',
    invoiceExpiredOrNotFound: '账单已过期或不存在',
    completeDeposit: '完成存款充值',
    invoiceNumber: '账单编号 #',
    paymentSummaryAndFees: '支付明细与费率',
    invoiceAmount: '账单本金',
    networkFee: '网络手续费',
    totalDue: '应付总额',
    payVia: '支付方式',
    confirmingIn: '确认耗时',
    instantOneClick: '一键即时转账 • 或扫描下方二维码进行手动付款',
    paymentSessionExpired: '支付会话已超时',
    expiredNotice: '15分钟支付窗口已截止。为确保资金安全，请生成新的充值地址。',
    generateNewInvoice: '生成新账单',
    securedBy: '由非托管智能合约清算协议提供安全保障',

    amountToPay: '应付金额',
    sendExactAmount: '请务必发送精准金额',
    copy: '复制',
    copied: '已复制！',
    depositAddress: '专属充值地址',
    viewOnExplorer: '在区块链浏览器中查看',
    warningNotice: '请仅向此地址充值对应网络的 USDT。充值任何其他币种或网络将导致资金永久丢失。',

    awaitingPayment: '等待付款中',
    paymentDetected: '已在链上检测到入账',
    confirmations: '网络确认数',
    paymentConfirmed: '支付已成功确认',
    underpaidAmount: '检测到部分付款（少于应付金额）',
    invoiceExpired: '账单已超时过期',
    paymentFailed: '支付验证失败',

    paymentConfirmedTitle: '支付成功确认并已结算',
    paymentConfirmedSubtitle: '您的款项已通过链上清算直接完成记账与结算。',
    amountCredited: '入账到账金额',
    network: '结算网络',
    transaction: '交易哈希 (TxID)',

    paymentWindow: '有效付款时间',
    timeExpired: '已截止',

    faq1Question: '非托管支付安全机制是如何运作的？',
    faq1Answer: '每个账单均在区块链上独立动态生成一次性安全充值地址。资金直接由链上智能合约结算，无中间人资金滞留风险。',
    faq2Question: '支付确认通常需要多长时间？',
    faq2Answer: 'BNB 智能链 (BEP-20) 通常在 3 至 15 秒内完成确认；TRON (TRC-20) 约需 60 秒完成不可逆清算。',
    faq3Question: '支持从哪些钱包或交易所进行支付？',
    faq3Answer: '支持任何标准 Web3 钱包（MetaMask、Trust Wallet、TronLink）以及任何主流交易所（Binance、OKX、Bybit、KuCoin）。',
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
  isRtl: boolean;
  isArabic: boolean;
  supportedLanguages: LanguageOption[];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    // 1. Check saved language in localStorage
    const saved = localStorage.getItem('nexus_selected_lang') as Language;
    if (saved && translations[saved]) {
      setLanguageState(saved);
      return;
    }

    // 2. Fallback to browser language
    if (typeof navigator !== 'undefined' && navigator.language) {
      const code = navigator.language.split('-')[0].toLowerCase() as Language;
      if (translations[code]) {
        setLanguageState(code);
      }
    }
  }, []);

  const setLanguage = (lang: Language) => {
    if (translations[lang]) {
      setLanguageState(lang);
      localStorage.setItem('nexus_selected_lang', lang);
      // Update HTML dir attribute for full RTL page support
      const option = SUPPORTED_LANGUAGES.find((opt) => opt.code === lang);
      if (typeof document !== 'undefined') {
        document.documentElement.dir = option?.dir || 'ltr';
        document.documentElement.lang = lang;
      }
    }
  };

  const currentOption = SUPPORTED_LANGUAGES.find((opt) => opt.code === language);
  const isRtl = currentOption?.dir === 'rtl';
  const isArabic = language === 'ar';

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t: translations[language] || translations.en,
        isRtl,
        isArabic,
        supportedLanguages: SUPPORTED_LANGUAGES,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
