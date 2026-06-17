import { Router } from 'express';
import { me } from '../controllers/authController.js';
import { authenticate } from '../middlewares/auth.js';

const router = Router();

router.get('/me', authenticate, me);

export default router;
