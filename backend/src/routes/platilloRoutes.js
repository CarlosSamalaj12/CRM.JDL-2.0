import express from 'express';
import * as platilloController from '../controllers/platilloController.js';

const router = express.Router();

// Gestión de Platillos
router.post('/', platilloController.createPlatillo);
router.get('/', platilloController.getPlatillos);
router.get('/:id', platilloController.getPlatilloDetalle);
router.delete('/:id', platilloController.deletePlatillo);

// Sugerencias disponibles (ingredientes agrupados + opciones)
router.get('/sugerencias/disponibles', platilloController.getSugerenciasDisponibles);

// Gestión de Componentes (Sugerencias del platillo)
router.post('/:platillo_id/componentes', platilloController.addComponente);
router.delete('/componentes/:comp_id', platilloController.removeComponente);
router.patch('/componentes/:comp_id', platilloController.updateComponente);

export default router;
