import { Router } from 'express';
import { getEvents, getEventStats, getEventById, updateEventStatus, updateEventQuote, getWeeklyServices } from '../controllers/eventsController.js';

const router = Router();
router.get('/', getEvents);
router.get('/stats', getEventStats);
router.get('/weekly-services', getWeeklyServices);
router.get('/:id', getEventById);
router.patch('/:id/status', updateEventStatus);
router.put('/:id/quote', updateEventQuote);

export default router;
