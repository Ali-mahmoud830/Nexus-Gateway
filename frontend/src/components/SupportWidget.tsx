'use client';

/**
 * src/components/SupportWidget.tsx
 *
 * Institutional 24/7 Live Support Concierge for Nexus Payment Gateway.
 * Provides instant real-time two-way communication between users making deposits
 * and the Admin Command Center without requiring any page reloads.
 *
 * Architecture note: SupportWidgetInner uses usePathname() which is a dynamic
 * runtime hook. It MUST be wrapped in <Suspense> at the usage point to prevent
 * Next.js prerender blocking on static routes like /pay/[invoiceId].
 */

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import {
  MessageSquare,
  Send,
  X,
  Headphones,
  ShieldCheck,
  CheckCheck,
  Loader2,
  Minimize2,
  Sparkles,
} from 'lucide-react';
import {
  sendUserSupportMessage,
  getUserSupportConversation,
  SupportMessage,
} from '@/lib/api';

export function SupportWidgetInner() {
  const pathname = usePathname();
  const { t, isRtl } = useLanguage();

  // Hide support widget on the admin command center so it doesn't collide
  const isAdminPage = pathname?.startsWith('/admin');

  const [isOpen, setIsOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLiveConnected, setIsLiveConnected] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Derive invoiceId if user is on /pay/[invoiceId]
  const invoiceIdMatch = pathname?.match(/\/pay\/([^/?]+)/);
  const currentInvoiceId = invoiceIdMatch ? invoiceIdMatch[1] : '';

  // 1. Initialize persistent sessionId in localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let storedSession = localStorage.getItem('nexus_support_session_id');
    if (!storedSession) {
      storedSession = `sess_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;
      localStorage.setItem('nexus_support_session_id', storedSession);
    }
    setSessionId(storedSession);
  }, []);

  // 2. Poll for conversation updates
  useEffect(() => {
    if (!sessionId) return;

    let isMounted = true;

    async function fetchConversation() {
      try {
        const data = await getUserSupportConversation(sessionId);
        if (isMounted) {
          setIsLiveConnected(true);
          if (data && Array.isArray(data.messages)) {
            setMessages(data.messages);
            if (!isOpen) {
              setUnreadCount(data.unreadCountUser || 0);
            } else {
              setUnreadCount(0);
            }
          }
        }
      } catch (err) {
        // Silently mark reconnecting without spamming errors
        if (isMounted) setIsLiveConnected(false);
      }
    }

    // Immediate initial fetch
    fetchConversation();

    // Active polling interval: 2.5s when open, 8s when closed
    const pollInterval = setInterval(fetchConversation, isOpen ? 2500 : 8000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [sessionId, isOpen]);

  // Scroll to bottom when messages update or drawer opens
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setUnreadCount(0);
    }
  }, [messages, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || !sessionId || isSending) return;

    setIsSending(true);
    if (!textToSend) setInputValue('');

    // Optimistic UI update
    const tempId = `temp_${Date.now()}`;
    const optimisticMsg: SupportMessage = {
      messageId: tempId,
      sender: 'user',
      senderName: 'You',
      text,
      createdAt: new Date().toISOString(),
      isRead: false,
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const res = await sendUserSupportMessage({
        sessionId,
        text,
        invoiceId: currentInvoiceId,
      });

      if (res && res.messages) {
        setMessages(res.messages);
      }
    } catch (err) {
      console.error('Failed to send support message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (isAdminPage) {
    return null;
  }

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className={`fixed z-50 ${isRtl ? 'left-4 sm:left-6' : 'right-4 sm:right-6'} bottom-5 sm:bottom-6 font-sans`}
    >
      {/* Floating Launcher Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center gap-3 px-4 py-3.5 rounded-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-xl shadow-cyan-900/40 hover:shadow-cyan-500/50 hover:scale-105 active:scale-95 transition-all duration-300 border border-cyan-400/30"
          aria-label="Open Live Support"
        >
          <div className="relative flex items-center justify-center">
            <Headphones className="w-5 h-5 transition-transform duration-300 group-hover:rotate-12" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
            </span>
          </div>
          <span className="text-sm font-semibold tracking-wide hidden sm:inline">
            {t.liveSupport || 'Live Support'}
          </span>

          {/* Unread Message Pill Badge */}
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-red-500 rounded-full shadow-lg ring-2 ring-[#090d16] animate-bounce">
              {unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Expanded Support Window */}
      {isOpen && (
        <div className="flex flex-col w-[92vw] sm:w-[390px] h-[550px] max-h-[82vh] bg-[#0c121e]/95 backdrop-blur-2xl rounded-2xl border border-gray-700/60 shadow-2xl shadow-black/80 overflow-hidden transition-all duration-300 animate-in fade-in zoom-in-95">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 bg-gradient-to-r from-gray-900/90 via-[#0f172a] to-gray-900/90 border-b border-gray-800">
            <div className="flex items-center gap-3">
              <div className="relative w-9 h-9 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-md">
                <Headphones className="w-4 h-4" />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-gray-900" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold text-white leading-tight">
                    {t.supportTitle || 'Nexus Concierge'}
                  </h3>
                  <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isLiveConnected ? 'bg-emerald-400' : 'bg-amber-400'
                    }`}
                  />
                  <p className="text-[11px] text-gray-400 font-medium">
                    {isLiveConnected
                      ? t.supportOnline || 'Online • Real-time'
                      : 'Connecting...'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800/60 transition-colors"
                title="Minimize"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800/60 transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Linked Invoice Context Banner (If viewing invoice) */}
          {currentInvoiceId && (
            <div className="flex items-center justify-between px-4 py-1.5 bg-cyan-950/40 border-b border-cyan-800/40 text-[11px] text-cyan-300">
              <div className="flex items-center gap-1.5 font-mono truncate">
                <Sparkles className="w-3 h-3 text-cyan-400 shrink-0" />
                <span className="text-gray-400">Context:</span>
                <span className="font-semibold text-cyan-200">
                  #{currentInvoiceId}
                </span>
              </div>
              <span className="text-[10px] bg-cyan-900/60 px-2 py-0.5 rounded text-cyan-300 font-medium shrink-0">
                Live Linking
              </span>
            </div>
          )}

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5 scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
            {/* Welcome greeting card */}
            <div className="p-3 rounded-xl bg-gray-900/60 border border-gray-800/80 text-xs text-gray-300 leading-relaxed shadow-sm">
              <div className="flex items-center gap-2 mb-1.5 text-cyan-400 font-semibold text-xs">
                <Headphones className="w-3.5 h-3.5" />
                <span>Nexus Direct Support</span>
              </div>
              <p>
                {t.supportSubtitle ||
                  'Direct instant assistance for deposits, verification & routing. How may we assist your transaction today?'}
              </p>
            </div>

            {/* Quick Questions Pills */}
            {messages.length === 0 && (
              <div className="space-y-1.5 pt-1">
                <p className="text-[11px] font-semibold text-gray-400 tracking-wider uppercase px-1">
                  {t.quickQuestions || 'Quick Inquiries'}
                </p>
                <button
                  onClick={() =>
                    handleSendMessage(
                      t.q1InvoiceStatus || 'How do I check my invoice status?'
                    )
                  }
                  className="w-full text-left rtl:text-right px-3 py-2 text-xs text-gray-300 bg-gray-800/50 hover:bg-gray-800 hover:text-white rounded-lg border border-gray-700/50 transition-colors"
                >
                  💬 {t.q1InvoiceStatus || 'How do I check my invoice status?'}
                </button>
                <button
                  onClick={() =>
                    handleSendMessage(
                      t.q2DepositDelay ||
                        'My deposit was sent but not confirmed yet'
                    )
                  }
                  className="w-full text-left rtl:text-right px-3 py-2 text-xs text-gray-300 bg-gray-800/50 hover:bg-gray-800 hover:text-white rounded-lg border border-gray-700/50 transition-colors"
                >
                  ⏳{' '}
                  {t.q2DepositDelay ||
                    'My deposit was sent but not confirmed yet'}
                </button>
                <button
                  onClick={() =>
                    handleSendMessage(
                      t.q3NetworkHelp || 'Which network has the lowest fee?'
                    )
                  }
                  className="w-full text-left rtl:text-right px-3 py-2 text-xs text-gray-300 bg-gray-800/50 hover:bg-gray-800 hover:text-white rounded-lg border border-gray-700/50 transition-colors"
                >
                  ⚡ {t.q3NetworkHelp || 'Which network has the lowest fee?'}
                </button>
              </div>
            )}

            {/* Message History */}
            {messages.map((msg) => {
              const isUser = msg.sender === 'user';
              return (
                <div
                  key={msg.messageId}
                  className={`flex flex-col ${
                    isUser ? 'items-end' : 'items-start'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1 px-1">
                    <span className="text-[10px] font-semibold text-gray-400">
                      {isUser
                        ? t.you || 'You'
                        : msg.senderName || t.supportAgent || 'Support'}
                    </span>
                    <span className="text-[9px] text-gray-500 font-mono">
                      {new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <div
                    className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap break-words shadow-sm ${
                      isUser
                        ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-tr-none'
                        : 'bg-gray-800/90 text-gray-200 border border-gray-700/70 rounded-tl-none'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              );
            })}

            <div ref={messagesEndRef} />
          </div>

          {/* Footer Input Bar */}
          <div className="p-3 bg-gray-900/95 border-t border-gray-800">
            <div className="flex items-center gap-2 bg-[#080d16] border border-gray-700 rounded-xl px-3 py-1.5 focus-within:border-cyan-500 transition-colors">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t.typeYourMessage || 'Type your message...'}
                disabled={isSending}
                className="flex-1 bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={!inputValue.trim() || isSending}
                className={`p-2 rounded-lg text-white transition-all ${
                  inputValue.trim() && !isSending
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-md'
                    : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                }`}
                title="Send"
              >
                {isSending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className={`w-3.5 h-3.5 ${isRtl ? 'rotate-180' : ''}`} />
                )}
              </button>
            </div>
            <div className="flex items-center justify-between mt-2 px-1 text-[10px] text-gray-500">
              <span className="flex items-center gap-1 font-mono">
                <CheckCheck className="w-3 h-3 text-cyan-400" />
                {t.supportHoursNotice || '24/7 dedicated payment specialists'}
              </span>
              <span className="text-gray-600">Enter ↵</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Public export: wraps the inner widget in <Suspense> so Next.js can
 * prerender static routes (e.g. /pay/[invoiceId]) without blocking.
 * usePathname() runs only at request time inside the boundary.
 */
export function SupportWidget() {
  return (
    <Suspense fallback={null}>
      <SupportWidgetInner />
    </Suspense>
  );
}
