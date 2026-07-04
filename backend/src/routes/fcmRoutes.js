import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { guardarToken } from '../controllers/fcmController.js';

const router = Router();

router.post('/guardar-token', authenticate, guardarToken);

export default router;
