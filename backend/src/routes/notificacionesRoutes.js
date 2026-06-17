import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { getNotificaciones, getNoLeidasCount, marcarLeida, marcarTodasLeidas } from '../controllers/notificacionesController.js';

const router = Router();

router.get('/', authenticate, getNotificaciones);
router.get('/no-leidas', authenticate, getNoLeidasCount);
router.patch('/:id/leer', authenticate, marcarLeida);
router.post('/leer-todas', authenticate, marcarTodasLeidas);

export default router;
