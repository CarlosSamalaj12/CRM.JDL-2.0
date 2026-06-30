import express from 'express';
import * as informeController from '../controllers/informeController.js';
import { authenticate, authorizeRoles } from '../middlewares/auth.js';

const EDIT_ROLES = ['Admin', 'Vendedor', 'FrontOffice'];

const router = express.Router();

// Informes
router.post('/', authenticate, authorizeRoles(...EDIT_ROLES), informeController.createInforme);
router.get('/', authenticate, informeController.getInformes);

// Importante: /ocupacion/:id_ocupacion debe ir ANTES de /:id para evitar conflicto
router.get('/ocupacion/:id_ocupacion', authenticate, informeController.getInformesByOcupacion);

router.get('/por-evento', informeController.getInformeByEventFields);

router.get('/:id', informeController.getInformeById);
router.put('/:id', authenticate, authorizeRoles(...EDIT_ROLES), informeController.updateInforme);
router.delete('/:id', authenticate, authorizeRoles(...EDIT_ROLES), informeController.deleteInforme);

// Detalle de días
router.post('/dias', authenticate, authorizeRoles(...EDIT_ROLES), informeController.createInformeDia);
router.delete('/:id/dias', authenticate, authorizeRoles(...EDIT_ROLES), informeController.deleteInformeDias);
router.delete('/dias/:id', authenticate, authorizeRoles(...EDIT_ROLES), informeController.deleteInformeDia);

// Detalle personalizado del menú por día
router.get('/dias/:dia_id/detalle', informeController.getDiaMenuDetalle);
router.post('/dias/:dia_id/detalle', authenticate, authorizeRoles(...EDIT_ROLES), informeController.saveDiaMenuDetalle);

// Actualizar notas de un ítem individual
router.patch('/detalle/:itemId', authenticate, authorizeRoles(...EDIT_ROLES), informeController.updateDiaMenuItemNotas);

export default router;
