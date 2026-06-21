import pool from '../config/db.js';

function normalizeTipo(tipo) {
  if (!tipo) return 'otros';
  const t = tipo.toLowerCase().trim();
  if (t === 'salsas' || t === 'salsa') return 'salsa';
  if (t === 'guarniciones' || t === 'guarnición' || t === 'guarnicion') return 'guarnición';
  if (t === 'proteínas' || t === 'proteinas' || t === 'proteina' || t === 'carne') return 'proteina';
  if (t === 'postres' || t === 'postre') return 'postre';
  if (t === 'bebidas' || t === 'bebida') return 'bebida';
  return t;
}

// --- INGREDIENTES ---
export async function createIngrediente(req, res, next) {
  try {
    const { nombre, tipo } = req.body;
    const [result] = await pool.query('INSERT INTO cat_ingredientes (nombre, tipo) VALUES (?, ?)', [nombre, tipo]);
    res.status(201).json({ id: result.insertId, nombre, tipo });
  } catch (error) { next(error); }
}

export async function getIngredientes(req, res, next) {
  try {
    const [rows] = await pool.query('SELECT * FROM cat_ingredientes ORDER BY nombre ASC');
    res.json(rows.map(r => ({ ...r, tipo: normalizeTipo(r.tipo) })));
  } catch (error) { next(error); }
}

// --- OPCIONES DE INGREDIENTES ---
export async function createOpcionIngrediente(req, res, next) {
  try {
    const { ingrediente_id, nombre_opcion } = req.body;
    const [result] = await pool.query('INSERT INTO cat_opciones_ingrediente (ingrediente_id, nombre_opcion) VALUES (?, ?)', [ingrediente_id, nombre_opcion]);
    res.status(201).json({ id: result.insertId, ingrediente_id, nombre_opcion });
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

// --- MENÚS ---
export async function createMenu(req, res, next) {
  try {
    const { nombre_menu, descripcion, categoria_id } = req.body;
    const [result] = await pool.query('INSERT INTO cat_menus (nombre_menu, descripcion, categoria_id) VALUES (?, ?, ?)', [nombre_menu, descripcion, categoria_id || null]);
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
    if (nombre_menu !== undefined) { fields.push('nombre_menu = ?'); params.push(nombre_menu); }
    if (descripcion !== undefined) { fields.push('descripcion = ?'); params.push(descripcion); }
    if (categoria_id !== undefined) { fields.push('categoria_id = ?'); params.push(categoria_id || null); }
    if (fields.length === 0) return res.status(400).json({ message: 'Sin campos para actualizar' });
    params.push(id);
    await pool.query(`UPDATE cat_menus SET ${fields.join(', ')} WHERE id = ?`, params);
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
    const [result] = await pool.query('INSERT INTO cat_categorias_alimento (nombre) VALUES (?)', [nombre]);
    res.status(201).json({ id: result.insertId, nombre });
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
    if (nombre !== undefined) { fields.push('nombre = ?'); params.push(nombre); }
    if (activo !== undefined) { fields.push('activo = ?'); params.push(activo); }
    if (fields.length === 0) return res.status(400).json({ message: 'Sin campos' });
    params.push(id);
    await pool.query(`UPDATE cat_categorias_alimento SET ${fields.join(', ')} WHERE id = ?`, params);
    const [rows] = await pool.query('SELECT * FROM cat_categorias_alimento WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (error) { next(error); }
}

export async function deleteCategoria(req, res, next) {
  try {
    const { id } = req.params;
    await pool.query('UPDATE cat_platillos SET categoria_id = NULL WHERE categoria_id = ?', [id]);
    await pool.query('DELETE FROM cat_categorias_alimento WHERE id = ?', [id]);
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
    res.json({ message: 'Item actualizado' });
  } catch (error) { next(error); }
}

export async function deleteMenuItem(req, res, next) {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM menu_items WHERE id = ?', [id]);
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
