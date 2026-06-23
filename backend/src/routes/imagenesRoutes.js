import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middlewares/auth.js';
import { getImagenes, createImagen, uploadImagenFile, deleteImagen } from '../controllers/imagenesController.js';

// Usamos memoria en lugar de disco — los archivos no se guardan en el servidor
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB máx antes de comprimir
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i;
    if (allowed.test(file.originalname)) return cb(null, true);
    cb(new Error('Solo se permiten imágenes (jpg, png, gif, webp, svg, bmp)'));
  },
});

const router = Router();

router.get('/:id/imagenes', authenticate, getImagenes);
router.post('/:id/imagenes', authenticate, createImagen);
router.post('/:id/imagenes/upload', authenticate, upload.single('imagen'), uploadImagenFile);
router.delete('/imagenes/:imgId', authenticate, deleteImagen);

export default router;
