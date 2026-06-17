import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { equipoCtrl, sillaCtrl, mesaCtrl } from '../controllers/configController.js';

const router = Router();

// ─── EQUIPOS ───
router.get('/equipos', authenticate, equipoCtrl.getAll);
router.post('/equipos', authenticate, equipoCtrl.create);
router.put('/equipos/:id', authenticate, equipoCtrl.update);
router.delete('/equipos/:id', authenticate, equipoCtrl.remove);

// ─── TIPOS DE SILLA ───
router.get('/sillas', authenticate, sillaCtrl.getAll);
router.post('/sillas', authenticate, sillaCtrl.create);
router.put('/sillas/:id', authenticate, sillaCtrl.update);
router.delete('/sillas/:id', authenticate, sillaCtrl.remove);

// ─── TIPOS DE MESA ───
router.get('/mesas', authenticate, mesaCtrl.getAll);
router.post('/mesas', authenticate, mesaCtrl.create);
router.put('/mesas/:id', authenticate, mesaCtrl.update);
router.delete('/mesas/:id', authenticate, mesaCtrl.remove);

export default router;
