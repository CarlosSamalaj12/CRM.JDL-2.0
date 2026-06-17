import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import {
  getComentarios, createComentario,
  marcarLeido, getLecturas,
  toggleDestacado, getDestacados,
  getHistorial, getUsuarios,
  toggleReaccion
} from '../controllers/colaboracionController.js';

const router = Router();

// Comentarios
router.get('/:id/comentarios', authenticate, getComentarios);
router.post('/:id/comentarios', authenticate, createComentario);
router.post('/:id/comentarios/:comentarioId/reaccion', authenticate, toggleReaccion);

// Lecturas (enterado)
router.post('/:id/leer', authenticate, marcarLeido);
router.get('/:id/lecturas', authenticate, getLecturas);

// Destacados (énfasis)
router.post('/:id/destacar', authenticate, toggleDestacado);
router.get('/:id/destacados', authenticate, getDestacados);

// Historial
router.get('/:id/historial', authenticate, getHistorial);

// Usuarios para menciones
router.get('/usuarios', authenticate, getUsuarios);

export default router;
