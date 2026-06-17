import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { saveMontaje, getMontaje, getTiposMontaje } from '../controllers/montajeController.js';

const router = Router();

router.get('/tipos', getTiposMontaje);
router.get('/:dia_id', authenticate, getMontaje);
router.put('/:dia_id', authenticate, saveMontaje);

export default router;
