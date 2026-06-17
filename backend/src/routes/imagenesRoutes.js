import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { authenticate } from '../middlewares/auth.js';
import { getImagenes, createImagen, uploadImagenFile, deleteImagen } from '../controllers/imagenesController.js';

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(process.cwd(), 'uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i;
    if (allowed.test(path.extname(file.originalname))) return cb(null, true);
    cb(new Error('Solo se permiten imágenes (jpg, png, gif, webp, svg, bmp)'));
  },
});

const router = Router();

router.get('/:id/imagenes', authenticate, getImagenes);
router.post('/:id/imagenes', authenticate, createImagen);
router.post('/:id/imagenes/upload', authenticate, upload.single('imagen'), uploadImagenFile);
router.delete('/imagenes/:imgId', authenticate, deleteImagen);

export default router;
