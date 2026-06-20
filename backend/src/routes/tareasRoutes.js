import express from 'express';
import * as tareasController from '../controllers/tareasController.js';

const router = express.Router();

router.get('/evento/:id_ocupacion', tareasController.getTareasEvento);
router.get('/:id_ocupacion/usuario', tareasController.getTareasUsuario);
router.post('/:id_ocupacion', tareasController.createTarea);
router.put('/:id', tareasController.updateTarea);
router.delete('/:id', tareasController.deleteTarea);

export default router;
