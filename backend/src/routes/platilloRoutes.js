import express from 'express';
import { authenticate } from '../middlewares/auth.js';
import * as platilloController from '../controllers/platilloController.js';

const router = express.Router();

// Blindaje de seguridad: todas las operaciones de platillos requieren autenticación
router.use(authenticate);

// Gestión de Platillos
router.post('/', platilloController.createPlatillo);
router.get('/', platilloController.getPlatillos);
router.get('/:id', platilloController.getPlatilloDetalle);
router.put('/:id', platilloController.updatePlatillo);
router.delete('/:id', platilloController.deletePlatillo);

// Sugerencias disponibles (ingredientes agrupados + opciones)
router.get('/sugerencias/disponibles', platilloController.getSugerenciasDisponibles);

// Gestión de Componentes (Sugerencias del platillo)
router.post('/:platillo_id/componentes', platilloController.addComponente);
router.delete('/componentes/:comp_id', platilloController.removeComponente);
router.patch('/componentes/:comp_id', platilloController.updateComponente);

export default router;
