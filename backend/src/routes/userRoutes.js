import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { getUsers, createUser, updateUser, toggleUserActive, deleteUser } from '../controllers/userController.js';

const router = Router();

router.get('/', authenticate, getUsers);
router.post('/', authenticate, createUser);
router.put('/:id', authenticate, updateUser);
router.patch('/:id/toggle-active', authenticate, toggleUserActive);
router.delete('/:id', authenticate, deleteUser);

export default router;
