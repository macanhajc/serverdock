import { Router } from 'express';
import { verifyToken } from '../middleware/auth.js';
import { getVpnStatus } from '../lib/vpn/index.js';

const router = Router();

// GET /api/vpn/status — admin only
router.get('/status', verifyToken, async (_req, res) => {
  const status = await getVpnStatus();
  res.json(status);
});

export default router;
