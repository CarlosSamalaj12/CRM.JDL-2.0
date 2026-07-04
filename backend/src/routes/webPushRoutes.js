import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { guardarSuscripcion } from '../controllers/webPushController.js';

const router = Router();

router.post('/save-subscription', authenticate, guardarSuscripcion);

export default router;
