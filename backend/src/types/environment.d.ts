/**
 * src/types/environment.d.ts
 *
 * Extends NodeJS.ProcessEnv so every env variable access is
 * fully typed and validated at startup — not at runtime mid-request.
 */

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      // ---- Server
      NODE_ENV: 'development' | 'production' | 'test';
      PORT: string;
      API_VERSION: string;

      // ---- CORS
      ALLOWED_ORIGINS: string;

      // ---- MongoDB
      MONGODB_URI: string;
      MONGODB_DB_NAME: string;

      // ---- JWT
      JWT_SECRET: string;
      JWT_EXPIRES_IN: string;

      // ---- HD Wallet
      HD_MNEMONIC: string;
      BSC_DERIVATION_PATH: string;
      TRON_DERIVATION_PATH: string;
      HD_ADDRESS_COUNTER_OFFSET: string;

      // ---- Cold Wallets
      BSC_MAIN_WALLET: string;
      TRON_MAIN_WALLET: string;

      // ---- BSC RPC
      BSC_RPC_PRIMARY: string;
      BSC_RPC_SECONDARY: string;
      BSC_RPC_TERTIARY: string;
      BSC_USDT_CONTRACT: string;
      BSC_CONFIRMATIONS_REQUIRED: string;

      // ---- TRON RPC
      TRON_FULL_NODE: string;
      TRON_SOLIDITY_NODE: string;
      TRON_EVENT_SERVER: string;
      TRON_API_KEY: string;
      TRON_USDT_CONTRACT: string;
      TRON_CONFIRMATIONS_REQUIRED: string;

      // ---- Invoice
      INVOICE_EXPIRY_MINUTES: string;

      // ---- Sweeper & Gas Station
      SWEEPER_CRON_INTERVAL_SECONDS: string;
      SWEEPER_MIN_AMOUNT_USD: string;
      GAS_STATION_BSC_PRIVATE_KEY?: string;
      GAS_STATION_TRON_PRIVATE_KEY?: string;

      // ---- Logging
      LOG_LEVEL: string;
      LOG_DIR: string;
    }
  }
}

export {};
