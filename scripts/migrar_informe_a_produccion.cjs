/**
 * Script para MIGRAR un informe completo de LOCAL a PRODUCCIÓN
 * 
 * Lee todos los datos de un informe de la BD local y genera
 * un script SQL listo para ejecutar en producción en HeidiSQL.
 * 
 * Uso: node scripts/migrar_informe_a_produccion.cjs <id_ocupacion_origen> <id_ocupacion_destino>
 * 
 * Ejemplo: node scripts/migrar_informe_a_produccion.cjs evt_2f7647 38365
 */
require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');

const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3307),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'crm_jdl',
};

function esc(val) {
  if (val === null || val === undefined) return 'NULL';
  const s = String(val)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "''")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  return `'${s}'`;
}

function escJson(val) {
  if (!val) return 'NULL';
  return esc(JSON.stringify(val));
}

async function main() {
  const origen = process.argv[2];
  const destino = process.argv[3];

  if (!origen || !destino) {
    console.error('❌ Uso: node scripts/migrar_informe_a_produccion.cjs <id_origen> <id_destino>');
    console.error('   Ejemplo: node scripts/migrar_informe_a_produccion.cjs evt_2f7647 38365');
    process.exit(1);
  }

  const pool = mysql.createPool({ ...DB_CONFIG, waitForConnections: true, connectionLimit: 2 });
  const salida = [];
  let line = (...args) => salida.push(args.join(' '));

  try {
    // Verificar que existe el evento origen
    const [evt] = await pool.query('SELECT id, nombre FROM eventos WHERE id = ?', [origen]);
    if (evt.length === 0) {
      console.error(`❌ El evento origen "${origen}" no existe en la BD local`);
      process.exit(1);
    }
    console.log(`📋 Migrando informe de "${evt[0].nombre}" (${origen} -> ${destino})`);

    // Obtener TODAS las versiones
    const [versiones] = await pool.query(
      'SELECT * FROM informes_eventos WHERE id_ocupacion = ? ORDER BY version ASC',
      [origen]
    );

    if (versiones.length === 0) {
      console.error(`❌ No hay informes para el evento "${origen}"`);
      process.exit(1);
    }

    console.log(`📄 ${versiones.length} versiones encontradas`);

    line('-- ============================================');
    line('-- MIGRACION COMPLETA DE INFORME');
    line(`-- Origen: ${origen} (${evt[0].nombre})`);
    line(`-- Destino: ${destino}`);
    line(`-- Fecha: ${new Date().toISOString()}`);
    line(`-- Versiones: ${versiones.length}`);
    line('-- ============================================');
    line('');

    // LIMPIAR datos existentes en producción
    line('-- LIMPIAR DATOS EXISTENTES');
    line('SET FOREIGN_KEY_CHECKS = 0;');
    line(`DELETE FROM informe_historial WHERE informe_id IN (SELECT id FROM informes_eventos WHERE id_ocupacion = ${esc(destino)});`);
    line(`DELETE FROM informe_imagenes WHERE informe_id IN (SELECT id FROM informes_eventos WHERE id_ocupacion = ${esc(destino)});`);
    line(`DELETE FROM informe_comentarios WHERE informe_id IN (SELECT id FROM informes_eventos WHERE id_ocupacion = ${esc(destino)});`);
    line(`DELETE FROM informe_lecturas WHERE informe_id IN (SELECT id FROM informes_eventos WHERE id_ocupacion = ${esc(destino)});`);
    line(`DELETE FROM informe_destacados WHERE informe_id IN (SELECT id FROM informes_eventos WHERE id_ocupacion = ${esc(destino)});`);
    line(`DELETE FROM informe_dia_menu_detalle WHERE dia_id IN (SELECT id FROM informe_dias_detalle WHERE informe_id IN (SELECT id FROM informes_eventos WHERE id_ocupacion = ${esc(destino)}));`);
    line(`DELETE FROM informe_dias_detalle WHERE informe_id IN (SELECT id FROM informes_eventos WHERE id_ocupacion = ${esc(destino)});`);
    line(`DELETE FROM informes_eventos WHERE id_ocupacion = ${esc(destino)};`);
    line('');

    // Mapa: id_viejo_informe -> @var_name
    const varsByVersion = {};

    for (let vi = 0; vi < versiones.length; vi++) {
      const ver = versiones[vi];
      const varName = `@inf_v${ver.version}`;
      varsByVersion[ver.id] = varName;

      line(`-- === VERSION ${ver.version} (ID local: ${ver.id}) ===`);
      line(`INSERT INTO informes_eventos (id_ocupacion, version) VALUES (${esc(destino)}, ${ver.version});`);
      line(`SET ${varName} = LAST_INSERT_ID();`);
      line('');

      // Días de esta versión
      const [dias] = await pool.query(
        'SELECT * FROM informe_dias_detalle WHERE informe_id = ? ORDER BY id',
        [ver.id]
      );

      for (const dia of dias) {
        const diaVar = `@dia_${origen.replace(/[^a-zA-Z0-9]/g, '_')}_v${ver.version}_${dia.id}`;
        const fecha = dia.fecha_evento ? dia.fecha_evento.toISOString().slice(0, 10) : null;
        const menuId = dia.menu_id || 'NULL';

        line(`-- Dia: ${fecha || 'sin fecha'}`);
        line(`INSERT INTO informe_dias_detalle (informe_id, fecha_evento, menu_id, descripcion_montaje, comentario_menu)`);
        line(`VALUES (${varName}, ${esc(fecha)}, ${menuId}, ${esc(dia.descripcion_montaje)}, ${esc(dia.comentario_menu)});`);
        line(`SET ${diaVar} = LAST_INSERT_ID();`);
        line('');

        // Items del menú
        const [items] = await pool.query(
          'SELECT * FROM informe_dia_menu_detalle WHERE dia_id = ? ORDER BY id',
          [dia.id]
        );

        if (items.length > 0) {
          line(`-- ${items.length} items`);
          const valuesList = [];
          for (const item of items) {
            const vals = [
              diaVar,
              item.menu_item_id || 'NULL',
              item.ingrediente_id,
              item.opcion_id || 'NULL',
              esc(item.metodo_preparacion),
              item.cantidad_total,
              esc(item.notas)
            ];
            valuesList.push(`(${vals.join(', ')})`);
          }
          line('INSERT INTO informe_dia_menu_detalle (dia_id, menu_item_id, ingrediente_id, opcion_id, metodo_preparacion, cantidad_total, notas) VALUES');
          valuesList.forEach((v, i) => {
            line(i < valuesList.length - 1 ? `  ${v},` : `  ${v};`);
          });
          line('');
        }
      }

      // Imágenes de esta versión
      const [imgs] = await pool.query(
        'SELECT * FROM informe_imagenes WHERE informe_id = ? ORDER BY id',
        [ver.id]
      );

      if (imgs.length > 0) {
        line(`-- ${imgs.length} imagenes`);
        for (const img of imgs) {
          const imgDiaVar = img.dia_id
            ? `@dia_${origen.replace(/[^a-zA-Z0-9]/g, '_')}_v${ver.version}_${img.dia_id}`
            : 'NULL';
          line('INSERT INTO informe_imagenes (informe_id, dia_id, url, descripcion)');
          line(`VALUES (${varName}, ${imgDiaVar}, ${esc(img.url)}, ${esc(img.descripcion)});`);
        }
        line('');
      }

      // Historial de esta versión
      const [hist] = await pool.query(
        'SELECT * FROM informe_historial WHERE informe_id = ? ORDER BY id',
        [ver.id]
      );

      if (hist.length > 0) {
        line(`-- ${hist.length} historial`);
        for (const h of hist) {
          line('INSERT INTO informe_historial (informe_id, usuario_id, accion, descripcion)');
          line(`VALUES (${varName}, ${esc(h.usuario_id)}, ${esc(h.accion)}, ${esc(h.descripcion)});`);
        }
        line('');
      }

      // Comentarios de esta versión
      const [comms] = await pool.query(
        'SELECT * FROM informe_comentarios WHERE informe_id = ? ORDER BY id',
        [ver.id]
      );

      if (comms.length > 0) {
        line(`-- ${comms.length} comentarios`);
        for (const c of comms) {
          const commDiaVar = c.dia_id
            ? `@dia_${origen.replace(/[^a-zA-Z0-9]/g, '_')}_v${ver.version}_${c.dia_id}`
            : 'NULL';
          line('INSERT INTO informe_comentarios (informe_id, dia_id, usuario_id, contenido, mencion_a_id, reacciones)');
          line(`VALUES (${varName}, ${commDiaVar}, ${esc(c.usuario_id)}, ${esc(c.contenido)}, ${esc(c.mencion_a_id)}, ${escJson(c.reacciones)});`);
        }
        line('');
      }
    }

    line('SET FOREIGN_KEY_CHECKS = 1;');
    line('');
    line('-- === FIN DE MIGRACION ===');

    // Guardar a archivo
    const filename = `migracion_informe_${destino}.sql`;
    fs.writeFileSync(filename, salida.join('\n'), 'utf8');
    
    const sizeKB = (Buffer.byteLength(salida.join('\n'), 'utf8') / 1024).toFixed(1);
    console.log(`\n✅ Script generado: ${filename} (${sizeKB} KB)`);
    console.log(`📋 Copia este archivo y ejecútalo en HeidiSQL en producción`);
    console.log(`   O abre el archivo y pega su contenido en HeidiSQL`);

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
