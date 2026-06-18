import express from 'express';
import * as informeController from '../controllers/informeController.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

// Informes
router.post('/', authenticate, informeController.createInforme);
router.get('/', authenticate, informeController.getInformes);

// Importante: /ocupacion/:id_ocupacion debe ir ANTES de /:id para evitar conflicto
router.get('/ocupacion/:id_ocupacion', authenticate, informeController.getInformesByOcupacion);

router.get('/por-evento', informeController.getInformeByEventFields);

router.get('/:id', informeController.getInformeById);
router.put('/:id', authenticate, informeController.updateInforme);
router.delete('/:id', authenticate, informeController.deleteInforme);

// Detalle de días
router.post('/dias', authenticate, informeController.createInformeDia);
router.delete('/:id/dias', authenticate, informeController.deleteInformeDias);
router.delete('/dias/:id', authenticate, informeController.deleteInformeDia);

// Detalle personalizado del menú por día
router.get('/dias/:dia_id/detalle', informeController.getDiaMenuDetalle);
router.post('/dias/:dia_id/detalle', authenticate, informeController.saveDiaMenuDetalle);

export default router;
