import { Router } from 'express';
import { getEvents, getEventStats, getEventById, updateEventStatus } from '../controllers/eventsController.js';

const router = Router();
router.get('/', getEvents);
router.get('/stats', getEventStats);
router.get('/:id', getEventById);
router.patch('/:id/status', updateEventStatus);

export default router;
