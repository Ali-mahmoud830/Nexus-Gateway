/**
 * src/api/routes/index.ts
 *
 * Central router registry.
 * All versioned routes are mounted here so app.ts stays clean.
 * As we add phases (invoices, webhooks, etc.) we simply import
 * and mount the new router in this file.
 */

import { Router } from 'express';
import healthRouter from './health';
import invoiceRouter from './invoiceRoutes';
import adminRouter from './adminRoutes';
import configRouter from './configRoutes';

const router = Router();

// Health check — no auth
router.use('/health', healthRouter);

// Public configuration for checkout portal
router.use('/config', configRouter);

// Invoice management & status queries
router.use('/invoices', invoiceRouter);

// Secure Admin Command Center
router.use('/admin', adminRouter);

export default router;
