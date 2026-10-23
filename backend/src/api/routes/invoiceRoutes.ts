import { Router } from 'express';
import { createInvoice, getInvoiceStatus } from '../controllers/invoiceController';
import { invoiceLimiter } from '../middlewares/rateLimiter';
import { validateApiKey } from '../middlewares/apiKeyAuth';

const router = Router();

// POST /api/v1/invoices — protected with rate limiter and merchant API key verification
router.post('/', invoiceLimiter, validateApiKey, createInvoice);

// GET /api/v1/invoices/:invoiceId — public polling / status verification
router.get('/:invoiceId', validateApiKey, getInvoiceStatus);

export default router;
