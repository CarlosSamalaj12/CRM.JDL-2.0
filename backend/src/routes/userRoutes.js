import { Router } from 'express';
import { authenticate, authorizeRoles } from '../middlewares/auth.js';
import { getUsers, createUser, updateUser, toggleUserActive, deleteUser } from '../controllers/userController.js';

const router = Router();

router.get('/', authenticate, getUsers);
router.post('/', authenticate, authorizeRoles('Admin'), createUser);
router.put('/:id', authenticate, updateUser);
router.patch('/:id/toggle-active', authenticate, authorizeRoles('Admin'), toggleUserActive);
router.delete('/:id', authenticate, authorizeRoles('Admin'), deleteUser);

export default router;
