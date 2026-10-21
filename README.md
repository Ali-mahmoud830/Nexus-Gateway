# Nexus-Gateway — Privacy-Preserving Crypto Payment Gateway

> A production-grade USDT payment gateway for binary options platforms, built with a strict **privacy-first architecture**: each invoice generates a unique, ephemeral HD-derived deposit address that can never be traced back to the cold wallet.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    BINARY OPTIONS PLATFORM                  │
│                 (Any front-end / Mobile App)                │
└─────────────────────────┬───────────────────────────────────┘
                          │  POST /api/v1/invoices
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              BACKEND — Node.js + Express + TypeScript       │
│                                                             │
│  Phase 1: Express Server (Port 4000)                        │
│  Phase 2: MongoDB Atlas — Invoice / Counter / BlockCursor   │
│  Phase 3: HD Wallet BIP-44 — Unique ephemeral addr/invoice  │
│  Phase 4: Blockchain Listeners — BSC eth_getLogs / TronGrid │
│  Phase 5: Auto-Sweeper — Gas Station + Cold Wallet Forward  │
└──────────────┬──────────────────────────┬───────────────────┘
               │ Watch ephemeral addr      │ Sweep to cold wallet
               ▼                          ▼
     ┌──────────────────┐      ┌────────────────────────┐
     │  BSC RPC Nodes   │      │ MAIN (Cold) WALLET      │
     │  (3-node failover│      │ BSC:  0x...            │
     │   circuit breaker│      │ TRON: T...             │
     └──────────────────┘      └────────────────────────┘
               │
               │  WebSocket / Polling (3s)
               ▼
┌─────────────────────────────────────────────────────────────┐
│              FRONTEND — Next.js 16 + React 19 + Tailwind    │
│                                                             │
│  Phase 6: Deposit Terminal  → http://localhost:3000         │
│           Checkout Card     → /pay/[invoiceId]              │
│           • Network Selector (BSC / TRON)                   │
│           • 15-minute countdown timer                       │
│           • Dynamic QR code (copy + explorer link)          │
│           • Real-time status polling (PENDING→CONFIRMED)    │
│           • Confetti success screen                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Privacy Architecture

The core privacy guarantee is enforced by **BIP-44 HD wallet derivation**:

- Each invoice atomically increments a **per-network sequence counter** in MongoDB.
- The public key for `m/44'/60'/0'/0/{N}` (BSC) or `m/44'/195'/0'/0/{N}` (TRON) is derived **without ever exposing the private key or master seed**.
- Only the derived **public address** is written to the database. Private keys are computed in-memory during sweeping and never persisted.
- The auto-forwarding sweeper runs in a **decoupled async loop** with a randomized 1.5–3.5 second jitter per sweep, making on-chain patterns impossible to correlate.

---

## Monorepo Structure

```
nexus-gateway/
├── backend/               # Node.js + TypeScript API Gateway
│   ├── src/
│   │   ├── api/           # Controllers, Routes, Middlewares
│   │   ├── config/        # env.ts, database.ts
│   │   ├── models/        # Invoice, Counter, BlockCursor (Mongoose)
│   │   ├── services/
│   │   │   ├── hdWallet/  # BIP-44 derivation for BSC + TRON
│   │   │   ├── blockchain/# BSC Listener + TRON Listener + RPC Failover
│   │   │   └── sweeper/   # Gas Station + BSC/TRON sweepers + worker
│   │   ├── types/         # TronWeb ambient declarations
│   │   └── utils/         # Logger (Winston), ResponseHelper
│   ├── scripts/           # Sync indexes, Phase test scripts (1-6)
│   ├── .env.example       # Safe environment variable template
│   └── package.json
│
└── frontend/              # Next.js 16 + React 19 + Tailwind CSS
    ├── src/
    │   ├── app/           # App Router — page.tsx, pay/[invoiceId]/page.tsx
    │   ├── components/    # CheckoutCard, QrCodeCard, NetworkSelector, etc.
    │   ├── hooks/         # useCountdown, useInvoicePoller
    │   ├── lib/           # axios API client
    │   └── types/         # InvoiceDetails, InvoiceStatus, CryptoNetwork
    └── package.json
```

---

## Phases Completed

| Phase | Feature | Status |
|-------|---------|--------|
| 1 | Express Server + TypeScript + Rate Limiting + CORS + Health Check | ✅ Done |
| 2 | MongoDB Atlas Schema — Invoice, Counter, BlockCursor (12 indexes) | ✅ Done |
| 3 | BIP-44 HD Wallet Derivation — BSC (`m/44'/60'`) + TRON (`m/44'/195'`) | ✅ Done |
| 4 | Live Blockchain Listeners — BSC `eth_getLogs` + TRON TronGrid + 3-node RPC Failover | ✅ Done |
| 5 | Auto-Forwarding Sweeper — Gas Station Pre-Fund + Privacy Jitter + Cold Wallet Sweep | ✅ Done |
| 6 | Next.js Checkout UI — Countdown, QR Code, Real-time Polling, Confetti Confirmation | ✅ Done |

---

## Getting Started

### Prerequisites

- Node.js v18+
- MongoDB Atlas account (free M0 cluster is sufficient)
- TronGrid API key (free at [trongrid.io](https://www.trongrid.io))

### Backend Setup

```bash
cd backend
npm install
cp .env.example .env    # Fill in all required secrets
npm run dev             # Starts on port 4000
```

### Frontend Setup

```bash
cd frontend
npm install
# Create .env.local:
echo "NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1" > .env.local
npm run dev             # Starts on port 3000
```

### Required Environment Variables

> ⚠️ **Never commit `.env` files.** See `backend/.env.example` for the full template.

| Variable | Description |
|----------|-------------|
| `HD_MNEMONIC` | BIP-39 master mnemonic (12/24 words) — treat like a private key |
| `MONGODB_URI` | MongoDB Atlas direct replica-set URI |
| `BSC_MAIN_WALLET` | Cold wallet address for BNB Chain USDT |
| `TRON_MAIN_WALLET` | Cold wallet address for TRON USDT |
| `BSC_RPC_PRIMARY/SECONDARY/TERTIARY` | BNB Chain RPC endpoints |
| `TRON_API_KEY` | TronGrid API key |

---

## API Reference

```
GET  /api/v1/health                  — System health (DB, blockchain, sweeper)
POST /api/v1/invoices                — Create invoice { userId, amount, network }
GET  /api/v1/invoices/:invoiceId     — Poll invoice status (PENDING→CONFIRMED)
```

---

## Security Notes

- **Private keys** are never stored in the database or logged.
- The **HD mnemonic** is loaded once at startup from environment. In production, use AWS Secrets Manager or HashiCorp Vault.
- **Gas Station wallets** must be pre-funded with BNB (BSC) or TRX (TRON) before live sweeping.
- Set `BSC_MAIN_WALLET` and `TRON_MAIN_WALLET` to your actual cold wallet addresses before going live.

---

## License

MIT
