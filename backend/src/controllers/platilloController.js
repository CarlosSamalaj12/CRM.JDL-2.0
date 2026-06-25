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

// --- GESTIÓN DE PLATILLOS ---

// Crear un nuevo platillo
export async function createPlatillo(req, res, next) {
  try {
    const { nombre_platillo, descripcion, precio_base, categoria_id } = req.body;
    const [result] = await pool.query(
      'INSERT INTO cat_platillos (nombre_platillo, descripcion, categoria_id, precio_base) VALUES (?, ?, ?, ?)',
      [nombre_platillo, descripcion, categoria_id || null, precio_base || 0]
    );
    const [row] = await pool.query(
      'SELECT p.*, c.nombre AS categoria_nombre FROM cat_platillos p LEFT JOIN cat_categorias_alimento c ON p.categoria_id = c.id WHERE p.id = ?',
      [result.insertId]
    );
    res.status(201).json(row[0]);
  } catch (error) { next(error); }
}

// Listar todos los platillos
export async function getPlatillos(req, res, next) {
  try {
    const [rows] = await pool.query(
      'SELECT p.*, c.nombre AS categoria_nombre FROM cat_platillos p LEFT JOIN cat_categorias_alimento c ON p.categoria_id = c.id ORDER BY p.nombre_platillo ASC'
    );
    res.json(rows);
  } catch (error) { next(error); }
}

// Obtener un platillo completo con todos sus componentes agrupados por tipo
export async function getPlatilloDetalle(req, res, next) {
  try {
    const { id } = req.params;
    
    const [platilloRows] = await pool.query('SELECT * FROM cat_platillos WHERE id = ?', [id]);
    if (platilloRows.length === 0) return res.status(404).json({ message: 'Platillo no encontrado' });
    const platillo = platilloRows[0];

    const [componentes] = await pool.query(`
      SELECT 
        cp.id,
        cp.ingrediente_id,
        cp.opcion_id,
        cp.tipo_componente,
        cp.cantidad,
        cp.orden,
        i.nombre AS ingrediente_nombre,
        i.tipo AS ingrediente_tipo,
        oi.nombre_opcion AS opcion_nombre
      FROM platillo_componentes cp
      JOIN cat_ingredientes i ON cp.ingrediente_id = i.id
      LEFT JOIN cat_opciones_ingrediente oi ON cp.opcion_id = oi.id
      WHERE cp.platillo_id = ?
      ORDER BY cp.orden ASC, i.nombre ASC
    `, [id]);

    // Agrupar por tipo_componente
    const normalizedComponentes = componentes.map(c => ({ ...c, ingrediente_tipo: normalizeTipo(c.ingrediente_tipo) }));
    const agrupado = {};
    for (const c of normalizedComponentes) {
      const tipo = c.tipo_componente;
      if (!agrupado[tipo]) agrupado[tipo] = [];
      agrupado[tipo].push(c);
    }

    // Obtener opciones disponibles para todos los ingredientes del platillo
    const ingredienteIds = [...new Set(componentes.map(c => c.ingrediente_id))];
    let opcionesPorIngrediente = {};
    if (ingredienteIds.length > 0) {
      const [opciones] = await pool.query(
        `SELECT * FROM cat_opciones_ingrediente WHERE ingrediente_id IN (${ingredienteIds.map(() => '?').join(',')}) ORDER BY nombre_opcion`,
        ingredienteIds
      );
      for (const op of opciones) {
        if (!opcionesPorIngrediente[op.ingrediente_id]) opcionesPorIngrediente[op.ingrediente_id] = [];
        opcionesPorIngrediente[op.ingrediente_id].push(op);
      }
    }

    res.json({
      ...platillo,
      componentes: normalizedComponentes,
      componentes_agrupados: agrupado,
      opciones_por_ingrediente: opcionesPorIngrediente,
    });
  } catch (error) { next(error); }
}

// Normalizar tipos antiguos a nuevos
// Normalizar tipos antiguos a nuevos (para compatibilidad con ingredientes creados antes del cambio)
const TIPO_MAP = {
  'carne': 'proteina',
  'guarnición': 'guarnicion',
};

// Obtener ingredientes disponibles agrupados por tipo para sugerencias
export async function getSugerenciasDisponibles(req, res, next) {
  try {
    const [ingredientes] = await pool.query('SELECT * FROM cat_ingredientes ORDER BY tipo, nombre');
    const agrupado = {};
    for (const ing of ingredientes) {
      const normTipo = normalizeTipo(ing.tipo);
      const tipoNorm = TIPO_MAP[normTipo] || normTipo;
      if (!agrupado[tipoNorm]) agrupado[tipoNorm] = [];
      agrupado[tipoNorm].push({ ...ing, tipo: tipoNorm });
    }

    const [opciones] = await pool.query('SELECT * FROM cat_opciones_ingrediente ORDER BY nombre_opcion');
    const opcionesPorIngrediente = {};
    for (const op of opciones) {
      if (!opcionesPorIngrediente[op.ingrediente_id]) opcionesPorIngrediente[op.ingrediente_id] = [];
      opcionesPorIngrediente[op.ingrediente_id].push(op);
    }

    res.json({
      ingredientes_agrupados: agrupado,
      opciones_por_ingrediente: opcionesPorIngrediente,
    });
  } catch (error) { next(error); }
}

// Actualizar un platillo
export async function updatePlatillo(req, res, next) {
  try {
    const { id } = req.params;
    const { nombre_platillo, descripcion, categoria_id, precio_base } = req.body;
    const fields = [];
    const params = [];
    if (nombre_platillo !== undefined) { fields.push('nombre_platillo = ?'); params.push(nombre_platillo); }
    if (descripcion !== undefined) { fields.push('descripcion = ?'); params.push(descripcion); }
    if (categoria_id !== undefined) { fields.push('categoria_id = ?'); params.push(categoria_id || null); }
    if (precio_base !== undefined) { fields.push('precio_base = ?'); params.push(precio_base); }
    if (fields.length === 0) return res.status(400).json({ message: 'Sin campos para actualizar' });
    params.push(id);
    await pool.query(`UPDATE cat_platillos SET ${fields.join(', ')} WHERE id = ?`, params);
    const [rows] = await pool.query(
      'SELECT p.*, c.nombre AS categoria_nombre FROM cat_platillos p LEFT JOIN cat_categorias_alimento c ON p.categoria_id = c.id WHERE p.id = ?',
      [id]
    );
    res.json(rows[0]);
  } catch (error) { next(error); }
}

// Eliminar un platillo
export async function deletePlatillo(req, res, next) {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM cat_platillos WHERE id = ?', [id]);
    res.status(204).send();
  } catch (error) { next(error); }
}

// --- GESTIÓN DE COMPONENTES (Sugerencias) ---

export async function addComponente(req, res, next) {
  try {
    const { platillo_id } = req.params;
    const { ingrediente_id, opcion_id, tipo_componente, cantidad, orden } = req.body;

    const [result] = await pool.query(
      `INSERT INTO platillo_componentes 
       (platillo_id, ingrediente_id, opcion_id, tipo_componente, cantidad, orden) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [platillo_id, ingrediente_id, opcion_id || null, tipo_componente, cantidad || 1, orden || 0]
    );

    res.status(201).json({ id: result.insertId });
  } catch (error) { next(error); }
}

export async function removeComponente(req, res, next) {
  try {
    const { comp_id } = req.params;
    await pool.query('DELETE FROM platillo_componentes WHERE id = ?', [comp_id]);
    res.status(204).send();
  } catch (error) { next(error); }
}

export async function updateComponente(req, res, next) {
  try {
    const { comp_id } = req.params;
    const { opcion_id, cantidad, orden } = req.body;
    const updates = [];
    const params = [];
    if (opcion_id !== undefined) { updates.push('opcion_id = ?'); params.push(opcion_id || null); }
    if (cantidad !== undefined) { updates.push('cantidad = ?'); params.push(cantidad); }
    if (orden !== undefined) { updates.push('orden = ?'); params.push(orden); }
    if (updates.length === 0) return res.status(400).json({ message: 'Sin cambios' });
    params.push(comp_id);
    await pool.query(`UPDATE platillo_componentes SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ message: 'ok' });
  } catch (error) { next(error); }
}
