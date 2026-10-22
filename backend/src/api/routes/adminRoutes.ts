/**
 * src/api/routes/adminRoutes.ts
 *
 * Route definitions for the Admin Command Center.
 */

import { Router } from 'express';
import {
  adminLogin,
  getAdminOverview,
  getAdminInvoices,
  reconcileInvoiceManually,
  triggerManualSweep,
  getAdminApiKeys,
  createAdminApiKey,
  deleteAdminApiKey,
} from '../controllers/adminController';
import { requireAdminAuth } from '../middlewares/adminAuth';

const router = Router();

// Public auth route
router.post('/login', adminLogin);

// Protected routes (Requires Bearer JWT with super_admin role)
router.use(requireAdminAuth);

router.get('/overview', getAdminOverview);
router.get('/invoices', getAdminInvoices);
router.post('/invoices/:invoiceId/reconcile', reconcileInvoiceManually);
router.post('/invoices/:invoiceId/sweep', triggerManualSweep);
router.get('/keys', getAdminApiKeys);
router.post('/keys', createAdminApiKey);
router.delete('/keys/:keyId', deleteAdminApiKey);

export default router;
