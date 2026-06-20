import { Router } from 'express';
import authRouter from './routes/authRoutes.js';
import eventsRouter from './routes/events.js';
import catalogRouter from './routes/catalogRoutes.js';
import platilloRouter from './routes/platilloRoutes.js';
import informeRouter from './routes/informeRoutes.js';
import notificacionesRouter from './routes/notificacionesRoutes.js';
import colaboracionRouter from './routes/colaboracionRoutes.js';
import montajeRouter from './routes/montajeRoutes.js';
import imagenesRouter from './routes/imagenesRoutes.js';
import notasRouter from './routes/notasRoutes.js';
import eventoMetadatosRouter from './routes/eventoMetadatosRoutes.js';
import configRouter from './routes/configRoutes.js';
import userRouter from './routes/userRoutes.js';
import tareasRouter from './routes/tareasRoutes.js';

const router = Router();

router.use('/auth', authRouter);
router.use('/events', eventsRouter);
router.use('/events', eventoMetadatosRouter);
router.use('/catalog', catalogRouter);
router.use('/platillos', platilloRouter);
router.use('/informes', colaboracionRouter);
router.use('/informes', informeRouter);
router.use('/notificaciones', notificacionesRouter);
router.use('/informes', imagenesRouter);
router.use('/notas', notasRouter);
router.use('/montaje', montajeRouter);
router.use('/config', configRouter);
router.use('/users', userRouter);
router.use('/tareas', tareasRouter);

export default router;
