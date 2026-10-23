/**
 * src/api/routes/configRoutes.ts
 *
 * Public Configuration Route for Checkout UI.
 */

import { Router } from 'express';
import { getPublicGatewayConfig } from '../controllers/adminController';

const router = Router();

// Public route to retrieve active dynamic presets, deposit thresholds, and fee rates
router.get('/public', getPublicGatewayConfig);

export default router;
