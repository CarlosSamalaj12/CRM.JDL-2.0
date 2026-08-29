import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import {
  getPlantillas,
  getPlantilla,
  createPlantilla,
  updatePlantilla,
  setPlantillaActivo,
  deletePlantilla,
  getEvento,
  saveEventoTab,
  getHistorial,
  getSnapshot,
  migrate,
} from '../controllers/checklistController.js';

const router = Router();

// Snapshot primero (más específico). Todas las rutas requieren auth.
router.get('/snapshot', authenticate, getSnapshot);
router.post('/migrar', authenticate, migrate);

// Plantillas
router.get('/plantillas', authenticate, getPlantillas);
router.get('/plantillas/:id', authenticate, getPlantilla);
router.post('/plantillas', authenticate, createPlantilla);
router.put('/plantillas/:id', authenticate, updatePlantilla);
router.patch('/plantillas/:id/activo', authenticate, setPlantillaActivo);
router.delete('/plantillas/:id', authenticate, deletePlantilla);

// Respuestas por evento
router.get('/eventos/:eventoId/historial', authenticate, getHistorial);
router.get('/eventos/:eventoId', authenticate, getEvento);
router.put('/eventos/:eventoId/:tab', authenticate, saveEventoTab);

export default router;
