import express from 'express';
import * as catalogController from '../controllers/catalogController.js';

const router = express.Router();

// Ingredientes
router.post('/ingredientes', catalogController.createIngrediente);
router.get('/ingredientes', catalogController.getIngredientes);
router.put('/ingredientes/:id', catalogController.updateIngrediente);
router.delete('/ingredientes/:id', catalogController.deleteIngrediente);

// Opciones
router.post('/opciones', catalogController.createOpcionIngrediente);
router.get('/opciones', catalogController.getOpcionesIngrediente);
router.put('/opciones/:id', catalogController.updateOpcionIngrediente);
router.delete('/opciones/:id', catalogController.deleteOpcionIngrediente);

// Menús
router.post('/menus', catalogController.createMenu);
router.get('/menus', catalogController.getMenus);
router.put('/menus/:id', catalogController.updateMenu);

// Items del menú
router.post('/menu-items', catalogController.createMenuItem);
router.get('/menu-items', catalogController.getMenuItems);
router.patch('/menu-items/:id', catalogController.updateMenuItem);
router.delete('/menu-items/:id', catalogController.deleteMenuItem);

// Categorías de alimento
router.post('/categorias', catalogController.createCategoria);
router.get('/categorias', catalogController.getCategorias);
router.put('/categorias/:id', catalogController.updateCategoria);
router.delete('/categorias/:id', catalogController.deleteCategoria);

// Detalle completo de menú
router.get('/menus/:id/detalle', catalogController.getMenuDetalle);

export default router;
