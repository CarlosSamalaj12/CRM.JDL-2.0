import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { getEquipos, createEquipo, updateEquipo, deleteEquipo } from '../controllers/equiposController.js';

const router = Router();

router.get('/', authenticate, getEquipos);
router.post('/', authenticate, createEquipo);
router.put('/:id', authenticate, updateEquipo);
router.delete('/:id', authenticate, deleteEquipo);

export default router;
