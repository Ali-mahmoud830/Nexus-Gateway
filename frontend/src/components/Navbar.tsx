'use client';

/**
 * src/components/Navbar.tsx
 *
 * World-Class Institutional FinTech Navigation Header.
 * Minimalist, ultra-clean, and strictly client-facing.
 * Supports multi-language selection across 8 major world languages.
 */

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Shield, Lock, Globe, ChevronDown, Check } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export const Navbar: React.FC = () => {
  const { language, setLanguage, t, supportedLanguages } = useLanguage();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeLang = supportedLanguages.find((l) => l.code === language) || supportedLanguages[0];

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

        {/* Security Trust Seals & Multi-Language Dropdown */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t.sslEncrypted}</span>
          </div>

          {/* 8-Language Selector Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen((prev) => !prev)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-900/90 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 text-gray-200 text-xs font-semibold transition-all cursor-pointer shadow-sm"
              aria-label="Select Language"
            >
              <Globe className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
              <span>{activeLang.flag}</span>
              <span className="hidden xs:inline font-sans">{activeLang.label}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 py-1.5 rounded-2xl bg-gray-950/95 border border-gray-800/90 shadow-2xl backdrop-blur-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-1 text-[10px] uppercase font-mono font-bold text-gray-400 tracking-wider border-b border-gray-900 mb-1">
                  Select Language
                </div>
                {supportedLanguages.map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => {
                      setLanguage(item.code);
                      setDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 flex items-center justify-between text-xs transition-colors cursor-pointer text-left ${
                      language === item.code
                        ? 'bg-cyan-500/15 text-cyan-300 font-bold'
                        : 'text-gray-300 hover:bg-gray-900 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm">{item.flag}</span>
                      <span className="font-sans">{item.label}</span>
                    </div>
                    {language === item.code && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
