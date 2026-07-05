import pool from '../config/db.js';
import { emitChange } from '../helpers/socketEvents.js';

function normalizeTipo(tipo) {
  if (!tipo) return 'entradas';
  const t = tipo.toLowerCase().trim();
  if (t === 'salsas' || t === 'salsa') return 'salsa';
  if (t === 'guarniciones' || t === 'guarnición' || t === 'guarnicion') return 'guarnición';
  if (t === 'proteínas' || t === 'proteinas' || t === 'proteina' || t === 'carne') return 'proteina';
  if (t === 'postres' || t === 'postre') return 'postre';
  if (t === 'bebidas' || t === 'bebida') return 'bebida';
  if (t === 'entradas' || t === 'entrada') return 'entradas';
  if (t === 'refacción' || t === 'refaccion' || t === 'refacciones') return 'refacción';
  if (t === 'boquita' || t === 'boquitas') return 'boquita';
  if (t === 'desayuno' || t === 'desayunos') return 'desayuno';
  if (t === 'tortilla_pan' || t === 'otros' || t === 'otro') return 'entradas';
  return 'entradas';
}

// --- INGREDIENTES ---
export async function createIngrediente(req, res, next) {
  try {
    const { nombre, tipo } = req.body;
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ message: 'El nombre del ingrediente es requerido' });
    }
    const nombreTrim = nombre.trim();
    // Verificar duplicado (case-insensitive)
    const [existing] = await pool.query('SELECT id FROM cat_ingredientes WHERE LOWER(nombre) = LOWER(?)', [nombreTrim]);
    if (existing.length > 0) {
      return res.status(409).json({ message: `Ya existe un ingrediente llamado "${nombreTrim}"` });
    }
    const [result] = await pool.query('INSERT INTO cat_ingredientes (nombre, tipo) VALUES (?, ?)', [nombreTrim, tipo]);
    emitChange(req, 'ingrediente', 'created', { id: result.insertId });
    res.status(201).json({ id: result.insertId, nombre: nombreTrim, tipo });
  } catch (error) { next(error); }
}

export async function getIngredientes(req, res, next) {
  try {
    const [rows] = await pool.query('SELECT * FROM cat_ingredientes ORDER BY nombre ASC');
    res.json(rows.map(r => ({ ...r, tipo: normalizeTipo(r.tipo) })));
  } catch (error) { next(error); }
}

export async function updateIngrediente(req, res, next) {
  try {
    const { id } = req.params;
    const { nombre, tipo } = req.body;
    const fields = [];
    const params = [];
    if (nombre !== undefined) {
      const nombreTrim = String(nombre).trim();
      if (!nombreTrim) return res.status(400).json({ message: 'El nombre del ingrediente no puede estar vacío' });
      // Verificar duplicado excluyendo el registro actual
      const [existing] = await pool.query('SELECT id FROM cat_ingredientes WHERE LOWER(nombre) = LOWER(?) AND id != ?', [nombreTrim, id]);
      if (existing.length > 0) {
        return res.status(409).json({ message: `Ya existe otro ingrediente llamado "${nombreTrim}"` });
      }
      fields.push('nombre = ?'); params.push(nombreTrim);
    }
    if (tipo !== undefined) { fields.push('tipo = ?'); params.push(tipo); }
    if (fields.length === 0) return res.status(400).json({ message: 'Sin campos para actualizar' });
    params.push(id);
    await pool.query(`UPDATE cat_ingredientes SET ${fields.join(', ')} WHERE id = ?`, params);
    emitChange(req, 'ingrediente', 'updated', { id });
    const [rows] = await pool.query('SELECT * FROM cat_ingredientes WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (error) { next(error); }
}

export async function deleteIngrediente(req, res, next) {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM informe_dia_menu_detalle WHERE ingrediente_id = ?', [id]);
    await pool.query('DELETE FROM cat_opciones_ingrediente WHERE ingrediente_id = ?', [id]);
    await pool.query('DELETE FROM menu_items WHERE ingrediente_id = ?', [id]);
    await pool.query('DELETE FROM platillo_componentes WHERE ingrediente_id = ?', [id]);
    await pool.query('DELETE FROM cat_ingredientes WHERE id = ?', [id]);
    emitChange(req, 'ingrediente', 'deleted', { id });
    res.status(204).send();
  } catch (error) { next(error); }
}

export async function getIngredienteAsociaciones(req, res, next) {
  try {
    const { id } = req.params;
    const [platillos] = await pool.query(
      `SELECT DISTINCT cp.id, cp.nombre_platillo
       FROM platillo_componentes pc
       JOIN cat_platillos cp ON cp.id = pc.platillo_id
       WHERE pc.ingrediente_id = ?`, [id]
    );
    const [menus] = await pool.query(
      `SELECT DISTINCT cm.id, cm.nombre_menu
       FROM menu_items mi
       JOIN cat_menus cm ON cm.id = mi.menu_id
       WHERE mi.ingrediente_id = ?`, [id]
    );
    const [informes] = await pool.query(
      `SELECT DISTINCT ie.id, ie.id_ocupacion
       FROM informe_dia_menu_detalle idmd
       JOIN informe_dias_detalle idd ON idd.id = idmd.dia_id
       JOIN informes_eventos ie ON ie.id = idd.informe_id
       WHERE idmd.ingrediente_id = ?`, [id]
    );
    res.json({ platillos, menus, informes });
  } catch (error) { next(error); }
}

// --- OPCIONES DE INGREDIENTES ---
export async function createOpcionIngrediente(req, res, next) {
  try {
    const { ingrediente_id, nombre_opcion } = req.body;
    if (!nombre_opcion || !nombre_opcion.trim()) {
      return res.status(400).json({ message: 'El nombre de la opción es requerido' });
    }
    const nombreTrim = nombre_opcion.trim();
    // Verificar duplicado dentro del mismo ingrediente
    const [existing] = await pool.query(
      'SELECT id FROM cat_opciones_ingrediente WHERE ingrediente_id = ? AND LOWER(nombre_opcion) = LOWER(?)',
      [ingrediente_id, nombreTrim]
    );
    if (existing.length > 0) {
      return res.status(409).json({ message: `Ya existe una opción llamada "${nombreTrim}" para este ingrediente` });
    }
    const [result] = await pool.query('INSERT INTO cat_opciones_ingrediente (ingrediente_id, nombre_opcion) VALUES (?, ?)', [ingrediente_id, nombreTrim]);
    emitChange(req, 'opcion_ingrediente', 'created', { id: result.insertId, ingrediente_id });
    res.status(201).json({ id: result.insertId, ingrediente_id, nombre_opcion: nombreTrim });
  } catch (error) { next(error); }
}

export async function getOpcionesIngrediente(req, res, next) {
  try {
    const { ingrediente_id } = req.query;
    let query = 'SELECT * FROM cat_opciones_ingrediente';
    let params = [];
    if (ingrediente_id) {
      query += ' WHERE ingrediente_id = ?';
      params.push(ingrediente_id);
    }
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) { next(error); }
}

export async function updateOpcionIngrediente(req, res, next) {
  try {
    const { id } = req.params;
    const { nombre_opcion } = req.body;
    if (!nombre_opcion || !String(nombre_opcion).trim()) return res.status(400).json({ message: 'nombre_opcion requerido' });
    const nombreTrim = String(nombre_opcion).trim();
    // Obtener el ingrediente_id de la opción actual
    const [current] = await pool.query('SELECT ingrediente_id FROM cat_opciones_ingrediente WHERE id = ?', [id]);
    if (current.length === 0) return res.status(404).json({ message: 'Opción no encontrada' });
    const ingredienteId = current[0].ingrediente_id;
    // Verificar duplicado dentro del mismo ingrediente, excluyendo la opción actual
    const [existing] = await pool.query(
      'SELECT id FROM cat_opciones_ingrediente WHERE ingrediente_id = ? AND LOWER(nombre_opcion) = LOWER(?) AND id != ?',
      [ingredienteId, nombreTrim, id]
    );
    if (existing.length > 0) {
      return res.status(409).json({ message: `Ya existe otra opción llamada "${nombreTrim}" para este ingrediente` });
    }
    await pool.query('UPDATE cat_opciones_ingrediente SET nombre_opcion = ? WHERE id = ?', [nombreTrim, id]);
    emitChange(req, 'opcion_ingrediente', 'updated', { id });
    const [rows] = await pool.query('SELECT * FROM cat_opciones_ingrediente WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (error) { next(error); }
}

export async function deleteOpcionIngrediente(req, res, next) {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM cat_opciones_ingrediente WHERE id = ?', [id]);
    emitChange(req, 'opcion_ingrediente', 'deleted', { id });
    res.status(204).send();
  } catch (error) { next(error); }
}

// --- MENÚS ---
export async function createMenu(req, res, next) {
  try {
    const { nombre_menu, descripcion, categoria_id } = req.body;
    if (!nombre_menu || !nombre_menu.trim()) {
      return res.status(400).json({ message: 'El nombre del menú es requerido' });
    }
    const nombreTrim = nombre_menu.trim();
    const [existing] = await pool.query('SELECT id FROM cat_menus WHERE LOWER(nombre_menu) = LOWER(?)', [nombreTrim]);
    if (existing.length > 0) {
      return res.status(409).json({ message: `Ya existe un menú llamado "${nombreTrim}"` });
    }
    const [result] = await pool.query('INSERT INTO cat_menus (nombre_menu, descripcion, categoria_id) VALUES (?, ?, ?)', [nombreTrim, descripcion, categoria_id || null]);
    emitChange(req, 'menu', 'created', { id: result.insertId });
    const [row] = await pool.query(
      'SELECT m.*, c.nombre AS categoria_nombre FROM cat_menus m LEFT JOIN cat_categorias_alimento c ON m.categoria_id = c.id WHERE m.id = ?',
      [result.insertId]
    );
    res.status(201).json(row[0]);
  } catch (error) { next(error); }
}

export async function updateMenu(req, res, next) {
  try {
    const { id } = req.params;
    const { nombre_menu, descripcion, categoria_id } = req.body;
    const fields = [];
    const params = [];
    if (nombre_menu !== undefined) {
      const nombreTrim = String(nombre_menu).trim();
      if (!nombreTrim) return res.status(400).json({ message: 'El nombre del menú no puede estar vacío' });
      const [existing] = await pool.query('SELECT id FROM cat_menus WHERE LOWER(nombre_menu) = LOWER(?) AND id != ?', [nombreTrim, id]);
      if (existing.length > 0) {
        return res.status(409).json({ message: `Ya existe otro menú llamado "${nombreTrim}"` });
      }
      fields.push('nombre_menu = ?'); params.push(nombreTrim);
    }
    if (descripcion !== undefined) { fields.push('descripcion = ?'); params.push(descripcion); }
    if (categoria_id !== undefined) { fields.push('categoria_id = ?'); params.push(categoria_id || null); }
    if (fields.length === 0) return res.status(400).json({ message: 'Sin campos para actualizar' });
    params.push(id);
    await pool.query(`UPDATE cat_menus SET ${fields.join(', ')} WHERE id = ?`, params);
    emitChange(req, 'menu', 'updated', { id });
    const [rows] = await pool.query(
      'SELECT m.*, c.nombre AS categoria_nombre FROM cat_menus m LEFT JOIN cat_categorias_alimento c ON m.categoria_id = c.id WHERE m.id = ?',
      [id]
    );
    res.json(rows[0]);
  } catch (error) { next(error); }
}

export async function getMenus(req, res, next) {
  try {
    const [rows] = await pool.query(
      'SELECT m.*, c.nombre AS categoria_nombre FROM cat_menus m LEFT JOIN cat_categorias_alimento c ON m.categoria_id = c.id ORDER BY m.nombre_menu ASC'
    );
    res.json(rows);
  } catch (error) { next(error); }
}

// --- DETALLE COMPLETO DE MENÚ (con items agrupados por tipo y opciones disponibles) ---
export async function getMenuDetalle(req, res, next) {
  try {
    const { id } = req.params;

    const [menuRows] = await pool.query('SELECT * FROM cat_menus WHERE id = ?', [id]);
    if (menuRows.length === 0) {
      return res.status(404).json({ message: 'Menú no encontrado' });
    }

    const [items] = await pool.query(`
      SELECT mi.*, i.nombre AS ingrediente_nombre, i.tipo AS ingrediente_tipo,
             oi.nombre_opcion AS opcion_nombre
      FROM menu_items mi
      JOIN cat_ingredientes i ON mi.ingrediente_id = i.id
      LEFT JOIN cat_opciones_ingrediente oi ON mi.opcion_id = oi.id
      WHERE mi.menu_id = ?
      ORDER BY i.tipo, i.nombre
    `, [id]);

    // Agrupar por tipo de ingrediente
    const normalizedItems = items.map(item => ({ ...item, ingrediente_tipo: normalizeTipo(item.ingrediente_tipo) }));
    const agrupado = {};
    for (const item of normalizedItems) {
      const tipo = item.ingrediente_tipo;
      if (!agrupado[tipo]) agrupado[tipo] = [];
      agrupado[tipo].push(item);
    }

    // Obtener opciones disponibles para CADA ingrediente único
    const ids = [...new Set(items.map(i => i.ingrediente_id))];
    let opciones = [];
    if (ids.length > 0) {
      [opciones] = await pool.query(
        `SELECT * FROM cat_opciones_ingrediente WHERE ingrediente_id IN (${ids.map(() => '?').join(',')}) ORDER BY nombre_opcion`,
        ids
      );
    }
    const opcionesPorIngrediente = {};
    for (const op of opciones) {
      if (!opcionesPorIngrediente[op.ingrediente_id]) opcionesPorIngrediente[op.ingrediente_id] = [];
      opcionesPorIngrediente[op.ingrediente_id].push(op);
    }

    // Obtener categoría del menú
    let categoria_nombre = null;
    if (menuRows[0].categoria_id) {
      const [catRows] = await pool.query('SELECT nombre FROM cat_categorias_alimento WHERE id = ?', [menuRows[0].categoria_id]);
      if (catRows.length > 0) categoria_nombre = catRows[0].nombre;
    }

    res.json({
      menu: { ...menuRows[0], categoria_nombre },
      items_agrupados: agrupado,
      items: normalizedItems,
      opciones_por_ingrediente: opcionesPorIngrediente,
    });
  } catch (error) { next(error); }
}

// --- CATEGORÍAS DE ALIMENTO ---
export async function createCategoria(req, res, next) {
  try {
    const { nombre } = req.body;
    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ message: 'El nombre de la categoría es requerido' });
    }
    const nombreTrim = nombre.trim();
    const [existing] = await pool.query('SELECT id FROM cat_categorias_alimento WHERE LOWER(nombre) = LOWER(?)', [nombreTrim]);
    if (existing.length > 0) {
      return res.status(409).json({ message: `Ya existe una categoría llamada "${nombreTrim}"` });
    }
    const [result] = await pool.query('INSERT INTO cat_categorias_alimento (nombre) VALUES (?)', [nombreTrim]);
    emitChange(req, 'categoria_alimento', 'created', { id: result.insertId });
    res.status(201).json({ id: result.insertId, nombre: nombreTrim });
  } catch (error) { next(error); }
}

export async function getCategorias(req, res, next) {
  try {
    const [rows] = await pool.query('SELECT * FROM cat_categorias_alimento ORDER BY nombre ASC');
    res.json(rows);
  } catch (error) { next(error); }
}

export async function updateCategoria(req, res, next) {
  try {
    const { id } = req.params;
    const { nombre, activo } = req.body;
    const fields = [];
    const params = [];
    if (nombre !== undefined) {
      const nombreTrim = String(nombre).trim();
      if (!nombreTrim) return res.status(400).json({ message: 'El nombre de la categoría no puede estar vacío' });
      const [existing] = await pool.query('SELECT id FROM cat_categorias_alimento WHERE LOWER(nombre) = LOWER(?) AND id != ?', [nombreTrim, id]);
      if (existing.length > 0) {
        return res.status(409).json({ message: `Ya existe otra categoría llamada "${nombreTrim}"` });
      }
      fields.push('nombre = ?'); params.push(nombreTrim);
    }
    if (activo !== undefined) { fields.push('activo = ?'); params.push(activo); }
    if (fields.length === 0) return res.status(400).json({ message: 'Sin campos' });
    params.push(id);
    await pool.query(`UPDATE cat_categorias_alimento SET ${fields.join(', ')} WHERE id = ?`, params);
    emitChange(req, 'categoria_alimento', 'updated', { id });
    const [rows] = await pool.query('SELECT * FROM cat_categorias_alimento WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (error) { next(error); }
}

export async function deleteCategoria(req, res, next) {
  try {
    const { id } = req.params;
    await pool.query('UPDATE cat_platillos SET categoria_id = NULL WHERE categoria_id = ?', [id]);
    await pool.query('DELETE FROM cat_categorias_alimento WHERE id = ?', [id]);
    emitChange(req, 'categoria_alimento', 'deleted', { id });
    res.json({ message: 'Categoría eliminada' });
  } catch (error) { next(error); }
}

// --- ITEMS DEL MENÚ ---
export async function createMenuItem(req, res, next) {
  try {
    const { menu_id, ingrediente_id, opcion_id, cantidad } = req.body;
    const [result] = await pool.query(
      'INSERT INTO menu_items (menu_id, ingrediente_id, opcion_id, cantidad) VALUES (?, ?, ?, ?)',
      [menu_id, ingrediente_id, opcion_id || null, cantidad]
    );
    emitChange(req, 'menu_item', 'created', { id: result.insertId, menu_id });
    res.status(201).json({ id: result.insertId, menu_id, ingrediente_id, opcion_id, cantidad });
  } catch (error) { next(error); }
}

export async function updateMenuItem(req, res, next) {
  try {
    const { id } = req.params;
    const { opcion_id, cantidad } = req.body;
    const fields = [];
    const params = [];
    if (opcion_id !== undefined) { fields.push('opcion_id = ?'); params.push(opcion_id || null); }
    if (cantidad !== undefined) { fields.push('cantidad = ?'); params.push(cantidad); }
    if (fields.length === 0) return res.status(400).json({ message: 'Sin campos para actualizar' });
    params.push(id);
    await pool.query(`UPDATE menu_items SET ${fields.join(', ')} WHERE id = ?`, params);
    emitChange(req, 'menu_item', 'updated', { id });
    res.json({ message: 'Item actualizado' });
  } catch (error) { next(error); }
}

export async function deleteMenuItem(req, res, next) {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM menu_items WHERE id = ?', [id]);
    emitChange(req, 'menu_item', 'deleted', { id });
    res.json({ message: 'Item eliminado' });
  } catch (error) { next(error); }
}

export async function getMenuItems(req, res, next) {
  try {
    const { menu_id } = req.query;
    let query = `
      SELECT mi.*, i.nombre as ingrediente_nombre, oi.nombre_opcion as opcion_nombre, m.nombre_menu
      FROM menu_items mi
      JOIN cat_ingredientes i ON mi.ingrediente_id = i.id
      LEFT JOIN cat_opciones_ingrediente oi ON mi.opcion_id = oi.id
      JOIN cat_menus m ON mi.menu_id = m.id
    `;
    let params = [];
    if (menu_id) {
      query += ' WHERE mi.menu_id = ?';
      params.push(menu_id);
    }
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) { next(error); }
}
