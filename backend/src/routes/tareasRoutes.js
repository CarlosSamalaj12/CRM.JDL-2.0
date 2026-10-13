import express from 'express';
import { authenticate } from '../middlewares/auth.js';
import * as tareasController from '../controllers/tareasController.js';

const router = express.Router();

// Blindaje de seguridad: todas las tareas requieren autenticación
router.use(authenticate);

router.get('/evento/:id_ocupacion', tareasController.getTareasEvento);
router.get('/:id_ocupacion/usuario', tareasController.getTareasUsuario);
router.post('/:id_ocupacion', tareasController.createTarea);
router.put('/:id', tareasController.updateTarea);
router.delete('/:id', tareasController.deleteTarea);

export default router;
