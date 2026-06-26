import express from 'express';
import * as tareasSemanalesController from '../controllers/tareasSemanalesController.js';

const router = express.Router();

router.get('/evento/:id_ocupacion', tareasSemanalesController.getTareasByOcupacion);
router.get('/:semana_lunes/merged', tareasSemanalesController.getTareasMerged);
router.get('/:semana_lunes', tareasSemanalesController.getTareasSemana);
router.get('/:semana_lunes/historial', tareasSemanalesController.getHistorial);
router.post('/', tareasSemanalesController.createTarea);
router.put('/:id', tareasSemanalesController.updateTarea);
router.delete('/:id', tareasSemanalesController.deleteTarea);
router.post('/log', tareasSemanalesController.logHistorialEntry);
router.post('/auto/no-realizado', tareasSemanalesController.autoMarcarNoRealizado);

export default router;
