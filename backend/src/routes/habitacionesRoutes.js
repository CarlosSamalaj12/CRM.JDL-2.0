import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middlewares/auth.js';
import {
  getHabitaciones,
  getHabitacion,
  createHabitacion,
  updateHabitacion,
  deleteHabitacion,
  registrarContacto,
  getHuespedHistorial,
  getCatalogos,
  getCatalogoItemUsage,
  createCatalogoItem,
  updateCatalogoItem,
  deleteCatalogoItem,
  getMetas,
  updateMetas,
  getCampanaClientesPorSegmento,
  uploadPromocionImagen
} from '../controllers/habitacionesController.js';

// Multer en memoria para procesar imágenes de promociones
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB máx
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp|bmp)$/i;
    if (allowed.test(file.originalname)) return cb(null, true);
    cb(new Error('Solo se permiten imágenes rasterizadas (jpg, png, gif, webp, bmp).'));
  }
});

const router = Router();

// Campañas de marketing por segmento y upload de imágenes
router.get('/campanas/segmento/:idSegmento', authenticate, getCampanaClientesPorSegmento);
router.post('/catalogos/upload-imagen', authenticate, upload.single('imagen'), uploadPromocionImagen);
router.post('/upload-imagen', authenticate, upload.single('imagen'), uploadPromocionImagen);

// Catálogos dinámicos
router.get('/catalogos/:categoria', authenticate, getCatalogos);
router.get('/catalogos/:categoria/:id/usage', authenticate, getCatalogoItemUsage);
router.post('/catalogos/:categoria', authenticate, createCatalogoItem);
router.put('/catalogos/:categoria/:id', authenticate, updateCatalogoItem);
router.delete('/catalogos/:categoria/:id', authenticate, deleteCatalogoItem);

// Metas de habitaciones
router.get('/metas', authenticate, getMetas);
router.put('/metas', authenticate, updateMetas);

// Directorio inteligente de huéspedes e historial
router.get('/huesped/historial', authenticate, getHuespedHistorial);
router.get('/huespedes/historial', authenticate, getHuespedHistorial);

// Operaciones CRUD de reservas de habitaciones
router.get('/', authenticate, getHabitaciones);
router.get('/:id', authenticate, getHabitacion);
router.post('/', authenticate, createHabitacion);
router.put('/:id', authenticate, updateHabitacion);
router.delete('/:id', authenticate, deleteHabitacion);
router.post('/:id/contacto', authenticate, registrarContacto);

export default router;

