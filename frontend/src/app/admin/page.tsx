'use client';

/**
 * src/app/admin/page.tsx
 *
 * Nexus Gateway — Comprehensive Enterprise Admin Command Center
 * Features:
 * 1. Secure Master Passkey Authentication Gate
 * 2. Real-Time Financial Telemetry & Fee Metrics
 * 3. Live Gas Station Reserve Gauges (BSC BNB & TRON TRX)
 * 4. Master Transaction Explorer with search, filters & explorer links
 * 5. One-Click Manual Reconciliation & Sweep Triggering
 * 6. Visible Child Private Keys for Emergency Access
 * 7. Merchant Developer API Key Management Hub
 * 8. Live Dynamic Fee & Percentage Configuration Management
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Lock,
  RefreshCw,
  Search,
  ExternalLink,
  Key,
  Database,
  Fuel,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  Copy,
  Check,
  Send,
  Zap,
  LogOut,
  Layers,
  ChevronRight,
  DollarSign,
  Trash2,
  Plus,
  Sliders,
  Eye,
  EyeOff,
  Percent,
  Wallet,
  Smartphone,
  Coins,
} from 'lucide-react';
import {
  adminLogin,
  getAdminOverview,
  getAdminInvoices,
  reconcileInvoiceManually,
  triggerManualSweep,
  getAdminApiKeys,
  createAdminApiKey,
  deleteAdminApiKey,
  getAdminGatewayConfig,
  updateAdminGatewayConfig,
} from '../../lib/api';
import {
  AdminOverviewData,
  AdminApiKey,
  GatewayConfigData,
  AdminCustomWallet,
} from '../../types/invoice';

export default function AdminDashboardPage() {
  // Auth state
  const [token, setToken] = useState<string | null>(null);
  const [passkeyInput, setPasskeyInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Dashboard active tab
  const [activeTab, setActiveTab] = useState<'overview' | 'invoices' | 'fees' | 'wallets' | 'apikeys'>('overview');

  // Overview data
  const [overview, setOverview] = useState<AdminOverviewData | null>(null);
  const [isLoadingOverview, setIsLoadingOverview] = useState(false);

  // Invoices data
  const [invoices, setInvoices] = useState<any[]>([]);
  const [invoicesTotal, setInvoicesTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [networkFilter, setNetworkFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(false);

  // Private key reveal toggles (stores set of invoiceIds currently visible)
  const [revealedKeyIds, setRevealedKeyIds] = useState<Record<string, boolean>>({});

  // API Keys data
  const [apiKeys, setApiKeys] = useState<AdminApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdRawKey, setCreatedRawKey] = useState<string | null>(null);
  const [isCreatingKey, setIsCreatingKey] = useState(false);

  // Fee Configuration state
  const [feeConfig, setFeeConfig] = useState<GatewayConfigData | null>(null);
  const [tronFeeInput, setTronFeeInput] = useState('2.5');
  const [tronMinInput, setTronMinInput] = useState('2.0');
  const [bscFeeInput, setBscFeeInput] = useState('1.0');
  const [bscMinInput, setBscMinInput] = useState('0.3');
  const [autoSweepInput, setAutoSweepInput] = useState(true);
  const [isSavingFees, setIsSavingFees] = useState(false);
  const [simulatedAmount, setSimulatedAmount] = useState('100');

  // Wallets & Presets state
  const [tronMainWalletInput, setTronMainWalletInput] = useState('');
  const [bscMainWalletInput, setBscMainWalletInput] = useState('');
  const [isSavingWallets, setIsSavingWallets] = useState(false);

  const [customWalletsList, setCustomWalletsList] = useState<AdminCustomWallet[]>([]);
  const [newWalletName, setNewWalletName] = useState('');
  const [newWalletAccountTitle, setNewWalletAccountTitle] = useState('');
  const [newWalletAccountNumber, setNewWalletAccountNumber] = useState('');
  const [newWalletInstructions, setNewWalletInstructions] = useState('');
  const [isAddingWallet, setIsAddingWallet] = useState(false);

  const [presetsInput, setPresetsInput] = useState('25, 50, 100, 250, 500, 1000');
  const [defaultAmountInput, setDefaultAmountInput] = useState('100');
  const [minAmountInput, setMinAmountInput] = useState('10');
  const [maxAmountInput, setMaxAmountInput] = useState('10000');
  const [isSavingPresets, setIsSavingPresets] = useState(false);

  // UI helpers
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Centralized Auth Error Handler (Clears stale token on 401 and prompts unlock)
  const handleAuthError = useCallback((err: any) => {
    const is401 =
      err?.status === 401 ||
      err?.response?.status === 401 ||
      err?.message?.includes('401') ||
      err?.message?.includes('Unauthorized') ||
      err?.message?.includes('token') ||
      err?.message?.includes('auth');
    if (is401) {
      localStorage.removeItem('nexus_admin_token');
      setToken(null);
      setAuthError('Your admin session has expired. Please enter the master passkey to unlock.');
    }
  }, []);

  // Listen to 401 event dispatched by API client
  useEffect(() => {
    const onUnauthorized = () => {
      localStorage.removeItem('nexus_admin_token');
      setToken(null);
      setAuthError('Your admin session has expired. Please enter the master passkey to unlock.');
    };
    window.addEventListener('nexus_admin_unauthorized', onUnauthorized);
    return () => window.removeEventListener('nexus_admin_unauthorized', onUnauthorized);
  }, []);

  // Load token from localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem('nexus_admin_token');
    if (savedToken) {
      setToken(savedToken);
    }
  }, []);

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsLoggingIn(true);
    try {
      const res = await adminLogin(passkeyInput);
      localStorage.setItem('nexus_admin_token', res.token);
      setToken(res.token);
      setPasskeyInput('');
    } catch (err: any) {
      setAuthError(err.message || 'Invalid master passkey');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Handle Logout
  const handleLogout = () => {
    localStorage.removeItem('nexus_admin_token');
    setToken(null);
    setAuthError(null);
  };

  // Copy helper
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Toggle private key visibility
  const toggleKeyVisibility = (invoiceId: string) => {
    setRevealedKeyIds((prev) => ({
      ...prev,
      [invoiceId]: !prev[invoiceId],
    }));
  };

  // Load Overview Data
  const loadOverview = useCallback(async () => {
    if (!token) return;
    setIsLoadingOverview(true);
    try {
      const data = await getAdminOverview(token);
      setOverview(data);
    } catch (err: any) {
      handleAuthError(err);
    } finally {
      setIsLoadingOverview(false);
    }
  }, [token, handleAuthError]);

  // Load Invoices Data
  const loadInvoices = useCallback(async () => {
    if (!token) return;
    setIsLoadingInvoices(true);
    try {
      const data = await getAdminInvoices(token, {
        page,
        limit: 15,
        network: networkFilter || undefined,
        status: statusFilter || undefined,
        search: searchQuery || undefined,
      });
      setInvoices(data.invoices);
      setInvoicesTotal(data.pagination.total);
    } catch (err) {
      handleAuthError(err);
    } finally {
      setIsLoadingInvoices(false);
    }
  }, [token, page, networkFilter, statusFilter, searchQuery, handleAuthError]);

  // Load API Keys
  const loadApiKeys = useCallback(async () => {
    if (!token) return;
    try {
      const keys = await getAdminApiKeys(token);
      setApiKeys(keys);
    } catch (err) {
      handleAuthError(err);
    }
  }, [token, handleAuthError]);

  // Load Fee & Wallet Config
  const loadFeeConfig = useCallback(async () => {
    if (!token) return;
    try {
      const config = await getAdminGatewayConfig(token);
      setFeeConfig(config);
      setTronFeeInput(config.tronFeePercent?.toString() || '2.5');
      setTronMinInput(config.minTronFeeUsd?.toString() || '2.0');
      setBscFeeInput(config.bscFeePercent?.toString() || '1.0');
      setBscMinInput(config.minBscFeeUsd?.toString() || '0.3');
      setAutoSweepInput(config.autoSweepEnabled ?? true);

      setTronMainWalletInput(config.tronMainWallet || '');
      setBscMainWalletInput(config.bscMainWallet || '');
      setCustomWalletsList(config.customWallets || []);
      setPresetsInput((config.presetAmounts || [25, 50, 100, 250, 500, 1000]).join(', '));
      setDefaultAmountInput((config.defaultDepositAmount || 100).toString());
      setMinAmountInput((config.minDepositAmount || 10).toString());
      setMaxAmountInput((config.maxDepositAmount || 10000).toString());
    } catch (err) {
      handleAuthError(err);
    }
  }, [token, handleAuthError]);

  // Trigger data loads
  useEffect(() => {
    if (!token) return;
    if (activeTab === 'overview') {
      loadOverview();
    } else if (activeTab === 'invoices') {
      loadInvoices();
    } else if (activeTab === 'fees' || activeTab === 'wallets') {
      loadFeeConfig();
    } else if (activeTab === 'apikeys') {
      loadApiKeys();
    }
  }, [token, activeTab, loadOverview, loadInvoices, loadFeeConfig, loadApiKeys]);

  // Manual Reconcile Action
  const handleManualReconcile = async (invoiceId: string) => {
    if (!token) return;
    setActionLoadingId(invoiceId);
    setActionMessage(null);
    try {
      await reconcileInvoiceManually(token, invoiceId, { status: 'CONFIRMED' });
      setActionMessage(`✅ Invoice ${invoiceId} marked CONFIRMED successfully`);
      loadInvoices();
    } catch (err: any) {
      setActionMessage(`❌ Error: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Manual Sweep Action
  const handleManualSweep = async (invoiceId: string) => {
    if (!token) return;
    setActionLoadingId(invoiceId);
    setActionMessage(null);
    try {
      const res = await triggerManualSweep(token, invoiceId);
      if (res.sweepResult?.success) {
        setActionMessage(`✅ Sweep successful! Tx: ${res.sweepResult.txHash}`);
      } else {
        setActionMessage(`⚠️ Sweep result: ${res.sweepResult?.error || 'Check logs'}`);
      }
      loadInvoices();
    } catch (err: any) {
      setActionMessage(`❌ Sweep failed: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Save Fee Settings
  const handleSaveFeeSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setIsSavingFees(true);
    setActionMessage(null);
    try {
      await updateAdminGatewayConfig(token, {
        tronFeePercent: parseFloat(tronFeeInput),
        minTronFeeUsd: parseFloat(tronMinInput),
        bscFeePercent: parseFloat(bscFeeInput),
        minBscFeeUsd: parseFloat(bscMinInput),
        autoSweepEnabled: autoSweepInput,
      });
      setActionMessage('✅ Fee configuration updated and synced to database instantly!');
      loadFeeConfig();
    } catch (err: any) {
      handleAuthError(err);
      setActionMessage(`❌ Failed to update fee settings: ${err.message}`);
    } finally {
      setIsSavingFees(false);
    }
  };

  // Save Cold Receiving Wallets
  const handleSaveReceivingWallets = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setIsSavingWallets(true);
    setActionMessage(null);
    try {
      await updateAdminGatewayConfig(token, {
        tronMainWallet: tronMainWalletInput.trim(),
        bscMainWallet: bscMainWalletInput.trim(),
      });
      setActionMessage('✅ Primary Receiving Wallets (Cold Storage) updated successfully!');
      loadFeeConfig();
    } catch (err: any) {
      handleAuthError(err);
      setActionMessage(`❌ Failed to update receiving wallets: ${err.message}`);
    } finally {
      setIsSavingWallets(false);
    }
  };

  // Add Custom Digital Wallet (JazzCash / EasyPaisa / Bank Wire)
  const handleAddCustomWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newWalletName.trim() || !newWalletAccountNumber.trim()) return;
    setIsAddingWallet(true);
    setActionMessage(null);
    try {
      const newWallet: AdminCustomWallet = {
        id: `wallet_${Date.now()}`,
        name: newWalletName.trim(),
        accountTitle: newWalletAccountTitle.trim(),
        accountNumber: newWalletAccountNumber.trim(),
        instructions: newWalletInstructions.trim(),
        isActive: true,
      };
      const updated = [...customWalletsList, newWallet];
      await updateAdminGatewayConfig(token, { customWallets: updated });
      setCustomWalletsList(updated);
      setNewWalletName('');
      setNewWalletAccountTitle('');
      setNewWalletAccountNumber('');
      setNewWalletInstructions('');
      setActionMessage(`✅ Added digital account "${newWallet.name}" successfully!`);
    } catch (err: any) {
      handleAuthError(err);
      setActionMessage(`❌ Failed to add wallet: ${err.message}`);
    } finally {
      setIsAddingWallet(false);
    }
  };

  // Toggle Custom Wallet Active/Inactive
  const handleToggleWalletStatus = async (walletId: string) => {
    if (!token) return;
    try {
      const updated = customWalletsList.map((w) =>
        w.id === walletId ? { ...w, isActive: !w.isActive } : w,
      );
      await updateAdminGatewayConfig(token, { customWallets: updated });
      setCustomWalletsList(updated);
      setActionMessage('✅ Digital wallet status updated!');
    } catch (err: any) {
      handleAuthError(err);
      setActionMessage(`❌ Failed to toggle wallet status: ${err.message}`);
    }
  };

  // Delete Custom Wallet
  const handleDeleteCustomWallet = async (walletId: string) => {
    if (!token || !confirm('Are you sure you want to remove this digital wallet?')) return;
    try {
      const updated = customWalletsList.filter((w) => w.id !== walletId);
      await updateAdminGatewayConfig(token, { customWallets: updated });
      setCustomWalletsList(updated);
      setActionMessage('✅ Digital wallet removed successfully!');
    } catch (err: any) {
      handleAuthError(err);
      setActionMessage(`❌ Failed to delete wallet: ${err.message}`);
    }
  };

  // Save Checkout Presets & Figures
  const handleSavePresets = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setIsSavingPresets(true);
    setActionMessage(null);
    try {
      const parsedPresets = presetsInput
        .split(',')
        .map((s) => parseFloat(s.trim()))
        .filter((n) => !isNaN(n) && n > 0);

      await updateAdminGatewayConfig(token, {
        presetAmounts: parsedPresets.length > 0 ? parsedPresets : [25, 50, 100, 250, 500, 1000],
        defaultDepositAmount: parseFloat(defaultAmountInput) || 100,
        minDepositAmount: parseFloat(minAmountInput) || 10,
        maxDepositAmount: parseFloat(maxAmountInput) || 10000,
      });
      setActionMessage('✅ Checkout figures and preset buttons updated! Live customer checkout updated instantly.');
      loadFeeConfig();
    } catch (err: any) {
      handleAuthError(err);
      setActionMessage(`❌ Failed to update presets: ${err.message}`);
    } finally {
      setIsSavingPresets(false);
    }
  };

  // Create API Key
  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newKeyName.trim()) return;
    setIsCreatingKey(true);
    try {
      const res = await createAdminApiKey(token, newKeyName.trim());
      setCreatedRawKey(res.key.rawKey || null);
      setNewKeyName('');
      loadApiKeys();
    } catch (err: any) {
      alert(`Failed to create API key: ${err.message}`);
    } finally {
      setIsCreatingKey(false);
    }
  };

  // Delete API Key
  const handleDeleteApiKey = async (keyId: string) => {
    if (!token || !confirm('Are you sure you want to revoke this API key?')) return;
    try {
      await deleteAdminApiKey(token, keyId);
      loadApiKeys();
    } catch (err: any) {
      alert(`Failed to revoke key: ${err.message}`);
    }
  };

  // Simulator values
  const simAmt = parseFloat(simulatedAmount) || 0;
  const tronSimFee = Math.max((simAmt * parseFloat(tronFeeInput || '0')) / 100, parseFloat(tronMinInput || '0'));
  const tronSimTotal = simAmt + tronSimFee;
  const bscSimFee = Math.max((simAmt * parseFloat(bscFeeInput || '0')) / 100, parseFloat(bscMinInput || '0'));
  const bscSimTotal = simAmt + bscSimFee;

  // =========================================================================
  // VIEW: AUTHENTICATION GATE
  // =========================================================================
  if (!token) {
    return (
      <div className="min-h-screen bg-black text-gray-100 flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-md bg-gray-950 border border-gray-800/80 rounded-3xl p-8 shadow-2xl relative z-10 backdrop-blur-xl">
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mb-4 text-cyan-400 shadow-lg shadow-cyan-500/10">
              <Shield className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">NEXUS GATEWAY</h1>
            <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest font-mono">
              Admin Command Center
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                Master Passkey (Secret Key)
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={passkeyInput}
                  onChange={(e) => setPasskeyInput(e.target.value)}
                  placeholder="Enter master passkey..."
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500 transition-colors font-mono"
                  required
                />
                <Lock className="w-4 h-4 text-gray-500 absolute right-3.5 top-3.5" />
              </div>
            </div>

            {authError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-bold text-sm transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoggingIn ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  <span>Access Command Center</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-900 text-center text-xs text-gray-600">
            Protected by Encrypted Enterprise Rails &bull; Nexus Protocol v1.0
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW: AUTHENTICATED DASHBOARD
  // =========================================================================
  return (
    <div className="min-h-screen bg-black text-gray-100 flex flex-col font-sans">
      {/* Top Header Navbar */}
      <header className="border-b border-gray-800/80 bg-gray-950/80 backdrop-blur-md sticky top-0 z-30 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-white text-base tracking-wide">NEXUS GATEWAY</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                COMMAND CENTER
              </span>
            </div>
            <div className="text-[11px] text-gray-400 flex items-center gap-2 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Cloud API Live &bull; Full Oversight Mode</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (activeTab === 'overview') loadOverview();
              else if (activeTab === 'invoices') loadInvoices();
              else if (activeTab === 'fees' || activeTab === 'wallets') loadFeeConfig();
              else if (activeTab === 'apikeys') loadApiKeys();
            }}
            className="p-2 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 hover:text-white transition-colors cursor-pointer"
            title="Refresh current tab"
          >
            <RefreshCw
              className={`w-4 h-4 ${
                isLoadingOverview || isLoadingInvoices ? 'animate-spin text-cyan-400' : ''
              }`}
            />
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-xs font-semibold transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Lock & Exit</span>
          </button>
        </div>
      </header>

      {/* Action Notification Banner */}
      {actionMessage && (
        <div className="bg-cyan-950/80 border-b border-cyan-500/30 px-6 py-2.5 text-xs text-cyan-300 flex items-center justify-between animate-in fade-in">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="text-cyan-400 hover:text-white">
            &times;
          </button>
        </div>
      )}

      {/* Main Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-gray-800 pb-3 flex-wrap">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20'
                : 'bg-gray-900/60 text-gray-400 hover:text-white hover:bg-gray-900'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Overview & Gas Reserves</span>
          </button>
          <button
            onClick={() => setActiveTab('invoices')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activeTab === 'invoices'
                ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20'
                : 'bg-gray-900/60 text-gray-400 hover:text-white hover:bg-gray-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Invoices & Keys ({invoicesTotal || 0})</span>
          </button>
          <button
            onClick={() => setActiveTab('fees')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activeTab === 'fees'
                ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20'
                : 'bg-gray-900/60 text-gray-400 hover:text-white hover:bg-gray-900'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Fee Settings & Commission Control</span>
          </button>
          <button
            onClick={() => setActiveTab('wallets')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activeTab === 'wallets'
                ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20'
                : 'bg-gray-900/60 text-gray-400 hover:text-white hover:bg-gray-900'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>Receiving Wallets & Presets</span>
          </button>
          <button
            onClick={() => setActiveTab('apikeys')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              activeTab === 'apikeys'
                ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20'
                : 'bg-gray-900/60 text-gray-400 hover:text-white hover:bg-gray-900'
            }`}
          >
            <Key className="w-4 h-4" />
            <span>Merchant API Keys</span>
          </button>
        </div>

        {/* TAB 1: OVERVIEW & GAS RESERVES */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Top Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gray-950 border border-gray-800/80 rounded-2xl p-5 relative overflow-hidden">
                <div className="text-gray-400 text-xs font-semibold tracking-wider uppercase flex items-center justify-between">
                  <span>Total Volume</span>
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-black text-white font-mono mt-2">
                  ${overview?.metrics.totalVolumeUsdt || '0.00'}
                </div>
                <div className="text-[11px] text-gray-500 mt-1">Processed across BSC & TRON</div>
              </div>

              <div className="bg-gray-950 border border-gray-800/80 rounded-2xl p-5 relative overflow-hidden">
                <div className="text-gray-400 text-xs font-semibold tracking-wider uppercase flex items-center justify-between">
                  <span>Today's Deposits</span>
                  <Clock className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="text-2xl font-black text-white font-mono mt-2">
                  ${overview?.metrics.todayVolumeUsdt || '0.00'}
                </div>
                <div className="text-[11px] text-gray-500 mt-1">Confirmed in last 24h</div>
              </div>

              <div className="bg-gray-950 border border-gray-800/80 rounded-2xl p-5 relative overflow-hidden">
                <div className="text-gray-400 text-xs font-semibold tracking-wider uppercase flex items-center justify-between">
                  <span>Gas Surcharge Pool</span>
                  <Fuel className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-black text-amber-300 font-mono mt-2">
                  ${overview?.metrics.totalFeesCollectedUsdt || '0.00'}
                </div>
                <div className="text-[11px] text-gray-500 mt-1">
                  Fees paid by customers for sweeps
                </div>
              </div>

              <div className="bg-gray-950 border border-gray-800/80 rounded-2xl p-5 relative overflow-hidden">
                <div className="text-gray-400 text-xs font-semibold tracking-wider uppercase flex items-center justify-between">
                  <span>Total Invoices</span>
                  <Database className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="text-2xl font-black text-white font-mono mt-2">
                  {overview?.metrics.totalInvoices || 0}
                </div>
                <div className="text-[11px] text-gray-500 mt-1">
                  Confirmed: {overview?.metrics.statusCounts?.CONFIRMED || 0} &bull; Forwarded:{' '}
                  {overview?.metrics.statusCounts?.FORWARDED || 0}
                </div>
              </div>
            </div>

            {/* Gas Station Reserves Section */}
            <div className="bg-gray-950 border border-gray-800/80 rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Fuel className="w-5 h-5 text-amber-400" />
                    <span>Gas Station Live Reserves</span>
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Internal hot wallets that automatically fund temporary deposit addresses so they
                    can sweep customer tokens without admin intervention.
                  </p>
                </div>
                <span className="text-xs font-mono text-gray-500">Auto-Sweeper: Active (30s)</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {/* BSC Gas Station Card */}
                <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                      BSC Network (BEP-20)
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        overview?.gasStation.bsc.status === 'HEALTHY'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {overview?.gasStation.bsc.status || 'UNKNOWN'}
                    </span>
                  </div>

                  <div>
                    <div className="text-3xl font-black text-white font-mono">
                      {overview?.gasStation.bsc.nativeBalance || '0.0000'} BNB
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      Reserve funds micro-gas (~0.0004 BNB per sweep)
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-800/80 flex items-center justify-between text-xs">
                    <span className="text-gray-500 font-mono truncate max-w-[220px]">
                      {overview?.gasStation.bsc.address || 'Loading...'}
                    </span>
                    {overview?.gasStation.bsc.address && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            handleCopy(overview.gasStation.bsc.address, 'bsc-gas-addr')
                          }
                          className="text-gray-400 hover:text-white"
                          title="Copy Address"
                        >
                          {copiedText === 'bsc-gas-addr' ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <a
                          href={`https://bscscan.com/address/${overview.gasStation.bsc.address}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan-400 hover:text-cyan-300"
                          title="View on BscScan"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* TRON Gas Station Card */}
                <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                      TRON Network (TRC-20)
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        overview?.gasStation.tron.status === 'HEALTHY'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {overview?.gasStation.tron.status || 'UNKNOWN'}
                    </span>
                  </div>

                  <div>
                    <div className="text-3xl font-black text-white font-mono">
                      {overview?.gasStation.tron.nativeBalance || '0.00'} TRX
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      Reserve pays energy burns (~16-20 TRX per sweep)
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-800/80 flex items-center justify-between text-xs">
                    <span className="text-gray-500 font-mono truncate max-w-[220px]">
                      {overview?.gasStation.tron.address || 'Loading...'}
                    </span>
                    {overview?.gasStation.tron.address && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            handleCopy(overview.gasStation.tron.address, 'tron-gas-addr')
                          }
                          className="text-gray-400 hover:text-white"
                          title="Copy Address"
                        >
                          {copiedText === 'tron-gas-addr' ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <a
                          href={`https://tronscan.org/#/address/${overview.gasStation.tron.address}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan-400 hover:text-cyan-300"
                          title="View on TronScan"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: INVOICES & KEYS EXPLORER */}
        {activeTab === 'invoices' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="bg-gray-950 border border-gray-800/80 rounded-2xl p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
              <div className="relative w-full md:w-96">
                <input
                  type="text"
                  placeholder="Search Invoice ID, User, Address, TxHash..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 font-mono"
                />
                <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <select
                  value={networkFilter}
                  onChange={(e) => setNetworkFilter(e.target.value)}
                  className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none cursor-pointer"
                >
                  <option value="">All Networks</option>
                  <option value="BSC">BSC (BEP-20)</option>
                  <option value="TRON">TRON (TRC-20)</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none cursor-pointer"
                >
                  <option value="">All Statuses</option>
                  <option value="PENDING">PENDING</option>
                  <option value="CONFIRMED">CONFIRMED</option>
                  <option value="FORWARDED">FORWARDED</option>
                  <option value="EXPIRED">EXPIRED</option>
                  <option value="FAILED">FAILED</option>
                </select>
              </div>
            </div>

            {/* Invoices Table */}
            <div className="bg-gray-950 border border-gray-800/80 rounded-3xl overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-300">
                  <thead className="bg-gray-900/80 uppercase font-mono text-[10px] tracking-wider text-gray-400 border-b border-gray-800">
                    <tr>
                      <th className="py-3.5 px-4">Invoice / Customer ID</th>
                      <th className="py-3.5 px-4">Network</th>
                      <th className="py-3.5 px-4">Amounts (Deposit + Fee)</th>
                      <th className="py-3.5 px-4">Ephemeral Address & Private Key</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">On-Chain Tx</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-900 font-mono">
                    {invoices.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-gray-500 font-sans">
                          {isLoadingInvoices ? 'Loading blockchain data...' : 'No invoices found.'}
                        </td>
                      </tr>
                    ) : (
                      invoices.map((inv) => (
                        <tr key={inv.invoiceId} className="hover:bg-gray-900/40 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-bold text-white">{inv.invoiceId}</div>
                            <div className="text-[10px] text-gray-500 font-sans">
                              User: {inv.userId} &bull;{' '}
                              {new Date(inv.createdAt).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                inv.network === 'BSC'
                                  ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
                              }`}
                            >
                              {inv.network}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-cyan-300">
                              {inv.expectedCryptoAmount} USDT
                            </div>
                            <div className="text-[10px] text-gray-500">
                              Base: ${(inv.baseAmount || inv.fiatAmount)?.toFixed(2)} + Fee: $
                              {(inv.feeAmount || 0)?.toFixed(2)}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {/* Address */}
                            <div className="flex items-center gap-1.5">
                              <span className="truncate max-w-[130px] text-gray-300 font-mono">
                                {inv.depositAddress}
                              </span>
                              <button
                                onClick={() => handleCopy(inv.depositAddress, inv.invoiceId)}
                                className="text-gray-500 hover:text-white"
                                title="Copy Address"
                              >
                                {copiedText === inv.invoiceId ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>

                            {/* Revealed Child Private Key for Emergency Access */}
                            {inv.privateKey && (
                              <div className="flex items-center gap-1.5 mt-1 pt-1 border-t border-gray-900">
                                <span className="text-[9px] uppercase tracking-wider text-amber-500/90 font-sans font-bold">
                                  PrivKey:
                                </span>
                                <span className="text-[10px] text-amber-300 font-mono truncate max-w-[110px]">
                                  {revealedKeyIds[inv.invoiceId]
                                    ? inv.privateKey
                                    : '••••••••••••••••••••'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => toggleKeyVisibility(inv.invoiceId)}
                                  className="text-gray-500 hover:text-amber-400 transition-colors"
                                  title={revealedKeyIds[inv.invoiceId] ? 'Hide Key' : 'Reveal Key'}
                                >
                                  {revealedKeyIds[inv.invoiceId] ? (
                                    <EyeOff className="w-3 h-3 text-amber-400" />
                                  ) : (
                                    <Eye className="w-3 h-3" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleCopy(inv.privateKey, `priv-${inv.invoiceId}`)
                                  }
                                  className="text-gray-500 hover:text-white"
                                  title="Copy Private Key"
                                >
                                  {copiedText === `priv-${inv.invoiceId}` ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                inv.status === 'CONFIRMED' || inv.status === 'FORWARDED'
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : inv.status === 'PENDING'
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              }`}
                            >
                              {inv.status}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="space-y-1">
                              {inv.paymentDetails?.txHash ? (
                                <div className="flex items-center gap-1 text-[11px]">
                                  <span className="text-[9px] uppercase tracking-wider text-emerald-500 font-sans font-bold">
                                    Dep:
                                  </span>
                                  <a
                                    href={
                                      inv.network === 'BSC'
                                        ? `https://bscscan.com/tx/${inv.paymentDetails.txHash}`
                                        : `https://tronscan.org/#/transaction/${inv.paymentDetails.txHash}`
                                    }
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono"
                                  >
                                    <span className="truncate max-w-[80px]">
                                      {inv.paymentDetails.txHash}
                                    </span>
                                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                  </a>
                                </div>
                              ) : (
                                <span className="text-gray-600 text-[11px]">Awaiting tx</span>
                              )}

                              {/* Forwarded Principal Tx to Cold Wallet */}
                              {inv.forwardingDetails?.forwardTxHash && (
                                <div className="flex items-center gap-1 text-[10px]">
                                  <span className="text-[9px] uppercase tracking-wider text-indigo-400 font-sans font-bold">
                                    Main:
                                  </span>
                                  <a
                                    href={
                                      inv.network === 'BSC'
                                        ? `https://bscscan.com/tx/${inv.forwardingDetails.forwardTxHash}`
                                        : `https://tronscan.org/#/transaction/${inv.forwardingDetails.forwardTxHash}`
                                    }
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-indigo-300 hover:text-indigo-200 flex items-center gap-0.5 font-mono"
                                    title="Principal swept to Main Cold Wallet"
                                  >
                                    <span className="truncate max-w-[70px]">
                                      {inv.forwardingDetails.forwardTxHash}
                                    </span>
                                    <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
                                  </a>
                                </div>
                              )}

                              {/* Forwarded Fee Tx to Gas Station */}
                              {inv.forwardingDetails?.feeForwardTxHash && (
                                <div className="flex items-center gap-1 text-[10px]">
                                  <span className="text-[9px] uppercase tracking-wider text-amber-400 font-sans font-bold">
                                    Gas:
                                  </span>
                                  <a
                                    href={
                                      inv.network === 'BSC'
                                        ? `https://bscscan.com/tx/${inv.forwardingDetails.feeForwardTxHash}`
                                        : `https://tronscan.org/#/transaction/${inv.forwardingDetails.feeForwardTxHash}`
                                    }
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-amber-300 hover:text-amber-200 flex items-center gap-0.5 font-mono"
                                    title="Fee routed to Gas Station Wallet"
                                  >
                                    <span className="truncate max-w-[70px]">
                                      {inv.forwardingDetails.feeForwardTxHash}
                                    </span>
                                    <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
                                  </a>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {inv.status === 'PENDING' && (
                                <button
                                  disabled={actionLoadingId === inv.invoiceId}
                                  onClick={() => handleManualReconcile(inv.invoiceId)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold transition-colors cursor-pointer"
                                  title="Force Confirm Payment"
                                >
                                  {actionLoadingId === inv.invoiceId ? '...' : 'Verify'}
                                </button>
                              )}
                              {(inv.status === 'CONFIRMED' || inv.status === 'FAILED') && (
                                <button
                                  disabled={actionLoadingId === inv.invoiceId}
                                  onClick={() => handleManualSweep(inv.invoiceId)}
                                  className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-[10px] font-bold transition-colors cursor-pointer"
                                  title="Trigger Sweeper Auto-Forwarding"
                                >
                                  {actionLoadingId === inv.invoiceId ? '...' : 'Sweep'}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: FEE SETTINGS & COMMISSION CONTROL */}
        {activeTab === 'fees' && (
          <div className="space-y-6">
            <div className="bg-gray-950 border border-gray-800/80 rounded-3xl p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-gray-800/80 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-cyan-400" />
                    <span>Dynamic Percentage Fee & Commission Engine</span>
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Configure deposit fee percentages charged to users. Changes sync instantly to
                    the MongoDB database and take effect on all new invoices immediately.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Real-time DB Sync</span>
                </div>
              </div>

              <form onSubmit={handleSaveFeeSettings} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* TRON Fee Card */}
                  <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                        TRON (TRC-20) Settings
                      </span>
                      <span className="text-[11px] text-gray-500">High energy network</span>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-300 mb-1">
                          Deposit Fee Percentage (%)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="50"
                            value={tronFeeInput}
                            onChange={(e) => setTronFeeInput(e.target.value)}
                            className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-cyan-500"
                            required
                          />
                          <Percent className="w-4 h-4 text-gray-500 absolute right-3.5 top-3" />
                        </div>
                        <p className="text-[11px] text-gray-500 mt-1">
                          Added dynamically to user deposits (e.g. 2.5% of deposit amount).
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-300 mb-1">
                          Minimum Gas Floor (USD)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            value={tronMinInput}
                            onChange={(e) => setTronMinInput(e.target.value)}
                            className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-cyan-500"
                            required
                          />
                          <DollarSign className="w-4 h-4 text-gray-500 absolute right-3.5 top-3" />
                        </div>
                        <p className="text-[11px] text-gray-500 mt-1">
                          Guaranteed minimum fee to ensure micro-deposits always cover 16-20 TRX
                          gas.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* BSC Fee Card */}
                  <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                        BSC (BEP-20) Settings
                      </span>
                      <span className="text-[11px] text-gray-500">Ultra low fee network</span>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-300 mb-1">
                          Deposit Fee Percentage (%)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="50"
                            value={bscFeeInput}
                            onChange={(e) => setBscFeeInput(e.target.value)}
                            className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-cyan-500"
                            required
                          />
                          <Percent className="w-4 h-4 text-gray-500 absolute right-3.5 top-3" />
                        </div>
                        <p className="text-[11px] text-gray-500 mt-1">
                          Added dynamically to user deposits (e.g. 1.0% of deposit amount).
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-300 mb-1">
                          Minimum Gas Floor (USD)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.05"
                            min="0"
                            value={bscMinInput}
                            onChange={(e) => setBscMinInput(e.target.value)}
                            className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-cyan-500"
                            required
                          />
                          <DollarSign className="w-4 h-4 text-gray-500 absolute right-3.5 top-3" />
                        </div>
                        <p className="text-[11px] text-gray-500 mt-1">
                          Guaranteed minimum fee to cover ~0.0004 BNB execution cost.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Auto Sweep Toggle */}
                <div className="bg-gray-900/40 border border-gray-800/80 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-white">Auto-Sweeper Background Worker</div>
                    <div className="text-xs text-gray-400">
                      When enabled, confirmed deposits are automatically swept to your cold wallet
                      every 30 seconds.
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoSweepInput}
                      onChange={(e) => setAutoSweepInput(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                  </label>
                </div>

                {/* Save Button */}
                <button
                  type="submit"
                  disabled={isSavingFees}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-bold text-xs transition-all shadow-lg shadow-cyan-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSavingFees ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving to Database...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Save & Sync Settings Instantly</span>
                    </>
                  )}
                </button>
              </form>

              {/* Live Interactive Fee Calculator Simulator */}
              <div className="pt-6 border-t border-gray-800/80 space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-cyan-400" />
                  <span>Live Fee Calculator Preview</span>
                </h3>
                <p className="text-xs text-gray-400">
                  Test any deposit amount below to see the exact fee calculated in real time:
                </p>

                <div className="flex items-center gap-3 max-w-xs">
                  <span className="text-xs text-gray-400">Test Deposit:</span>
                  <div className="relative flex-1">
                    <input
                      type="number"
                      value={simulatedAmount}
                      onChange={(e) => setSimulatedAmount(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-white font-mono"
                    />
                    <span className="absolute right-2.5 top-1.5 text-xs text-gray-500 font-mono">
                      USD
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="p-4 rounded-xl bg-gray-900/80 border border-gray-800 space-y-1.5 text-xs">
                    <div className="font-bold text-red-400">TRON (TRC-20) Result:</div>
                    <div className="flex justify-between text-gray-400">
                      <span>Deposit Credited to Trader:</span>
                      <span className="font-mono text-white">${simAmt.toFixed(2)} USDT</span>
                    </div>
                    <div className="flex justify-between text-amber-400">
                      <span>Customer Network Fee:</span>
                      <span className="font-mono">+${tronSimFee.toFixed(2)} USDT</span>
                    </div>
                    <div className="flex justify-between font-bold pt-1 border-t border-gray-800 text-cyan-300">
                      <span>Total Expected from Customer:</span>
                      <span className="font-mono">{tronSimTotal.toFixed(6)} USDT</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-gray-900/80 border border-gray-800 space-y-1.5 text-xs">
                    <div className="font-bold text-yellow-400">BSC (BEP-20) Result:</div>
                    <div className="flex justify-between text-gray-400">
                      <span>Deposit Credited to Trader:</span>
                      <span className="font-mono text-white">${simAmt.toFixed(2)} USDT</span>
                    </div>
                    <div className="flex justify-between text-amber-400">
                      <span>Customer Network Fee:</span>
                      <span className="font-mono">+${bscSimFee.toFixed(2)} USDT</span>
                    </div>
                    <div className="flex justify-between font-bold pt-1 border-t border-gray-800 text-cyan-300">
                      <span>Total Expected from Customer:</span>
                      <span className="font-mono">{bscSimTotal.toFixed(6)} USDT</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: RECEIVING WALLETS, DIGITAL WALLETS & CHECKOUT PRESETS */}
        {activeTab === 'wallets' && (
          <div className="space-y-6">
            {/* CARD 1: Cold Storage Receiving Wallets */}
            <div className="bg-gray-950 border border-gray-800/80 rounded-3xl p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-gray-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">Cold Storage Receiving Wallets</h2>
                    <p className="text-xs text-gray-400">
                      Primary cold wallet destination addresses where customer principal deposits are forwarded.
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSaveReceivingWallets} className="space-y-4 max-w-3xl">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                    TRON (TRC-20) Cold Receiving Address
                  </label>
                  <input
                    type="text"
                    value={tronMainWalletInput}
                    onChange={(e) => setTronMainWalletInput(e.target.value)}
                    placeholder="e.g. TLyqzVGLV1srkB7dToTAnY9A9auHgCg14"
                    className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-xs text-cyan-300 font-mono placeholder-gray-600 focus:outline-none focus:border-cyan-500"
                  />
                  <span className="text-[11px] text-gray-500 mt-1 block">
                    Funds deposited via TRON TRC-20 will be swept directly to this destination.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                    BNB Chain (BEP-20) Cold Receiving Address
                  </label>
                  <input
                    type="text"
                    value={bscMainWalletInput}
                    onChange={(e) => setBscMainWalletInput(e.target.value)}
                    placeholder="e.g. 0x81155BBa2A6eEBd248dE2b7042078693c04d026B"
                    className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-xs text-yellow-300 font-mono placeholder-gray-600 focus:outline-none focus:border-cyan-500"
                  />
                  <span className="text-[11px] text-gray-500 mt-1 block">
                    Funds deposited via BSC BEP-20 will be swept directly to this destination.
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isSavingWallets}
                  className="py-2.5 px-6 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold text-xs transition-all shadow-md shadow-cyan-500/20 cursor-pointer disabled:opacity-50"
                >
                  {isSavingWallets ? 'Saving Receiving Wallets...' : 'Save Cold Storage Wallets'}
                </button>
              </form>
            </div>

            {/* CARD 2: Digital Wallets & Local Payment Accounts (JazzCash / EasyPaisa / Bank) */}
            <div className="bg-gray-950 border border-gray-800/80 rounded-3xl p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-gray-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">Digital Wallets & Local Accounts (JazzCash / EasyPaisa / Bank)</h2>
                    <p className="text-xs text-gray-400">
                      Add, update, or remove mobile digital wallets and bank accounts displayed to users on the checkout page.
                    </p>
                  </div>
                </div>
              </div>

              {/* Form to Add New Wallet */}
              <form onSubmit={handleAddCustomWallet} className="bg-gray-900/60 p-4 rounded-2xl border border-gray-800 space-y-3">
                <div className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-cyan-400" />
                  <span>Add New Digital Account / Wallet</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Provider Name</label>
                    <input
                      type="text"
                      placeholder="e.g. JazzCash, EasyPaisa, Bank Wire"
                      value={newWalletName}
                      onChange={(e) => setNewWalletName(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Account Title / Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Ali Mahmoud"
                      value={newWalletAccountTitle}
                      onChange={(e) => setNewWalletAccountTitle(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Account Number / IBAN</label>
                    <input
                      type="text"
                      placeholder="e.g. 03001234567"
                      value={newWalletAccountNumber}
                      onChange={(e) => setNewWalletAccountNumber(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-cyan-300 font-mono focus:outline-none focus:border-cyan-500"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 block mb-1">Instructions for User (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Please transfer the deposit amount and share the transaction ID via chat."
                    value={newWalletInstructions}
                    onChange={(e) => setNewWalletInstructions(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isAddingWallet}
                  className="py-2 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {isAddingWallet ? 'Adding...' : 'Add Account'}
                </button>
              </form>

              {/* Existing Digital Wallets List */}
              <div className="space-y-3">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Active & Configured Wallets ({customWalletsList.length})
                </div>
                {customWalletsList.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-gray-900/30 border border-gray-800 text-center text-xs text-gray-500">
                    No digital wallets configured. Add your first digital account above.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {customWalletsList.map((wallet) => (
                      <div
                        key={wallet.id}
                        className="p-4 rounded-2xl bg-gray-900/70 border border-gray-800 flex flex-col justify-between space-y-3"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-bold text-white text-sm">{wallet.name}</div>
                            <div className="text-xs text-gray-400">{wallet.accountTitle}</div>
                            <div className="text-xs font-mono text-cyan-300 font-bold mt-1">
                              {wallet.accountNumber}
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              wallet.isActive
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-gray-800 text-gray-500 border border-gray-700'
                            }`}
                          >
                            {wallet.isActive ? 'ACTIVE' : 'INACTIVE'}
                          </span>
                        </div>

                        {wallet.instructions && (
                          <div className="text-[11px] text-gray-400 bg-black/40 p-2 rounded-xl">
                            {wallet.instructions}
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t border-gray-800 text-xs">
                          <button
                            type="button"
                            onClick={() => handleToggleWalletStatus(wallet.id)}
                            className="text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
                          >
                            {wallet.isActive ? 'Disable Wallet' : 'Enable Wallet'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomWallet(wallet.id)}
                            className="text-rose-400 hover:text-rose-300 transition-colors cursor-pointer p-1"
                            title="Delete Wallet"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* CARD 3: Checkout Presets & Figures (Controls User-Facing Page) */}
            <div className="bg-gray-950 border border-gray-800/80 rounded-3xl p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between pb-4 border-b border-gray-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <Coins className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">Checkout Figures & Preset Buttons</h2>
                    <p className="text-xs text-gray-400">
                      Full control over the numbers, preset buttons, and deposit limits shown to customers on the homepage.
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSavePresets} className="space-y-4 max-w-2xl">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                    Preset Amount Buttons (Comma-separated USD numbers)
                  </label>
                  <input
                    type="text"
                    value={presetsInput}
                    onChange={(e) => setPresetsInput(e.target.value)}
                    placeholder="25, 50, 100, 250, 500, 1000"
                    className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                    required
                  />
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] text-gray-400">Live Button Preview:</span>
                    {presetsInput.split(',').map((p, idx) => {
                      const num = p.trim();
                      if (!num) return null;
                      return (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-mono text-xs font-bold"
                        >
                          ${num}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Default Selected ($)</label>
                    <input
                      type="number"
                      min="1"
                      value={defaultAmountInput}
                      onChange={(e) => setDefaultAmountInput(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Minimum Deposit ($)</label>
                    <input
                      type="number"
                      min="1"
                      value={minAmountInput}
                      onChange={(e) => setMinAmountInput(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">Maximum Deposit ($)</label>
                    <input
                      type="number"
                      min="1"
                      value={maxAmountInput}
                      onChange={(e) => setMaxAmountInput(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSavingPresets}
                  className="py-2.5 px-6 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold text-xs transition-all shadow-md shadow-cyan-500/20 cursor-pointer disabled:opacity-50"
                >
                  {isSavingPresets ? 'Saving Presets...' : 'Save Checkout Figures'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 5: MERCHANT API KEYS */}
        {activeTab === 'apikeys' && (
          <div className="space-y-6">
            {/* Create Key Card */}
            <div className="bg-gray-950 border border-gray-800/80 rounded-3xl p-6 space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Key className="w-5 h-5 text-cyan-400" />
                <span>Generate Platform API Key</span>
              </h2>
              <p className="text-xs text-gray-400">
                Use API keys to programmatically generate deposit invoices from your trading platform
                backend.
              </p>

              <form onSubmit={handleCreateApiKey} className="flex gap-3 max-w-md">
                <input
                  type="text"
                  placeholder="Key description (e.g. Trading App Production)"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                  required
                />
                <button
                  type="submit"
                  disabled={isCreatingKey}
                  className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Key</span>
                </button>
              </form>

              {/* Just Created Key Alert */}
              {createdRawKey && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-2 animate-in fade-in">
                  <div className="font-bold flex items-center gap-1.5 text-amber-400">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Save your Secret API Key now (will not be shown again):</span>
                  </div>
                  <div className="flex items-center justify-between bg-black/60 rounded-xl p-2.5 font-mono text-cyan-300">
                    <span className="truncate">{createdRawKey}</span>
                    <button
                      onClick={() => handleCopy(createdRawKey, 'raw-created-key')}
                      className="text-gray-400 hover:text-white"
                    >
                      {copiedText === 'raw-created-key' ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Existing Keys Table */}
            <div className="bg-gray-950 border border-gray-800/80 rounded-3xl overflow-hidden shadow-2xl">
              <div className="p-4 border-b border-gray-800 font-bold text-sm text-white">
                Active Merchant API Keys
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-300">
                  <thead className="bg-gray-900/80 uppercase font-mono text-[10px] tracking-wider text-gray-400 border-b border-gray-800">
                    <tr>
                      <th className="py-3.5 px-4">Description</th>
                      <th className="py-3.5 px-4">Key Prefix</th>
                      <th className="py-3.5 px-4">Scopes</th>
                      <th className="py-3.5 px-4">Created Date</th>
                      <th className="py-3.5 px-4 text-right">Revoke</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-900 font-mono">
                    {apiKeys.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-gray-500 font-sans">
                          No active API keys found.
                        </td>
                      </tr>
                    ) : (
                      apiKeys.map((k) => (
                        <tr key={k.keyId} className="hover:bg-gray-900/40">
                          <td className="py-3.5 px-4 font-bold text-white font-sans">{k.name}</td>
                          <td className="py-3.5 px-4 text-cyan-400">{k.keyPrefix}</td>
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] bg-gray-800 text-gray-300">
                              {k.scopes.join(', ')}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-gray-500">
                            {new Date(k.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => handleDeleteApiKey(k.keyId)}
                              className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Revoke Key"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
