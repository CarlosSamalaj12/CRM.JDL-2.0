import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { getNotas, createNota, toggleReaccionNota } from '../controllers/notasController.js';

const router = Router();

router.get('/:idocupacion', authenticate, getNotas);
router.post('/:idocupacion', authenticate, createNota);
router.post('/:id/reaccion', authenticate, toggleReaccionNota);

export default router;
