import { Router } from 'express';
import {
  getEvents,
  getEventStats,
  getEventById,
  updateEventStatus,
  updateEventQuote,
  getWeeklyServices,
  createEvent,
  updateEvent,
  deleteEvent,
  getEventHistory,
  createEventHistory,
  getEventReminders,
  createEventReminder,
  deleteEventReminder,
  toggleEventReminder,
  getEventChecklist,
  saveEventChecklist
} from '../controllers/eventsController.js';

const router = Router();

// Eventos base
router.get('/', getEvents);
router.post('/', createEvent);
router.get('/stats', getEventStats);
router.get('/weekly-services', getWeeklyServices);
router.get('/:id', getEventById);
router.put('/:id', updateEvent);
router.delete('/:id', deleteEvent);
router.patch('/:id/status', updateEventStatus);
router.put('/:id/quote', updateEventQuote);

// Historial de auditoría de evento
router.get('/:id/history', getEventHistory);
router.post('/:id/history', createEventHistory);

// Recordatorios / Citas de evento
router.get('/:id/reminders', getEventReminders);
router.post('/:id/reminders', createEventReminder);
router.delete('/:id/reminders/:reminderId', deleteEventReminder);
router.patch('/:id/reminders/:reminderId/toggle', toggleEventReminder);

// Checklist / Evaluación de evento
router.get('/:id/checklist', getEventChecklist);
router.put('/:id/checklist', saveEventChecklist);

export default router;

