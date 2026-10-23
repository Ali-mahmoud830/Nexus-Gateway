'use client';

/**
 * src/components/Navbar.tsx
 *
 * World-Class Institutional FinTech Navigation Header.
 * Minimalist, ultra-clean, and strictly client-facing.
 * Zero internal telemetry, zero trader tags, and zero exposed admin links.
 */

import React from 'react';
import Link from 'next/link';
import { Shield, Lock, Globe } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export const Navbar: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();

  return (
    <header className="w-full border-b border-gray-800/60 bg-[#070b14]/90 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Brand Logo - Neutral, Institutional White-Label Gateway */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
            <Shield className="w-5 h-5 text-black stroke-[2.5]" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-white text-base tracking-tight leading-none">
              NEXUS<span className="text-cyan-400 font-light ml-1">PAY</span>
            </span>
            <span className="text-[10px] font-mono text-gray-400 uppercase tracking-widest mt-0.5">
              {t.brandTag}
            </span>
          </div>
        </Link>

        {/* Security Trust Seals & Language Switcher */}
        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t.sslEncrypted}</span>
          </div>

          <button
            type="button"
            onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-900/90 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 text-gray-300 hover:text-white text-xs font-medium transition-all cursor-pointer shadow-sm"
            title={language === 'en' ? 'التحويل إلى العربية' : 'Switch to English'}
          >
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-sans font-semibold">{language === 'en' ? 'العربية' : 'English'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
