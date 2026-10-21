/**
 * src/api/routes/invoiceRoutes.ts
 *
 * Route definitions for cryptocurrency payment invoices.
 */

import { Router } from 'express';
import { createInvoice, getInvoiceStatus } from '../controllers/invoiceController';
import { invoiceLimiter } from '../middlewares/rateLimiter';

const router = Router();

// POST /api/v1/invoices — protected with invoice rate limiter
router.post('/', invoiceLimiter, createInvoice);

// GET /api/v1/invoices/:invoiceId — public polling / status verification
router.get('/:invoiceId', getInvoiceStatus);

export default router;
