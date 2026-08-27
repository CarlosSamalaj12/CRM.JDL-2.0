import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import {
  getPosiblesVentas,
  getPosibleVenta,
  createPosibleVenta,
  updatePosibleVenta,
  deletePosibleVenta,
  getEliminadas,
  restorePosibleVenta,
  enviarMensajeVendedor,
} from '../controllers/posiblesVentasController.js';

const router = Router();

router.get('/', authenticate, getPosiblesVentas);
router.get('/eliminadas', authenticate, getEliminadas);
router.get('/:id', authenticate, getPosibleVenta);
router.post('/', authenticate, createPosibleVenta);
router.patch('/:id', authenticate, updatePosibleVenta);
router.delete('/:id', authenticate, deletePosibleVenta);
router.post('/:id/restore', authenticate, restorePosibleVenta);
router.post('/:id/mensaje-vendedor', authenticate, enviarMensajeVendedor);

export default router;
