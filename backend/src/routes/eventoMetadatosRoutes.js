import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { getMetadatos, saveMetadatos } from '../controllers/eventoMetadatosController.js';

const router = Router();

router.get('/:id/metadata', authenticate, getMetadatos);
router.put('/:id/metadata', authenticate, saveMetadatos);

export default router;
