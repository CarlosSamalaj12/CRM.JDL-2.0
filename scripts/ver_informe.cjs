/**
 * Script para ver todos los datos de un informe por ID de ocupación (evento)
 * Uso: node scripts/ver_informe.cjs <id_ocupacion>
 * Ejemplo: node scripts/ver_informe.cjs evt_2f7647
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3307),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'crm_jdl',
};

async function main() {
  const idOcupacion = process.argv[2];
  if (!idOcupacion) {
    console.error('❌ Uso: node scripts/ver_informe.cjs <id_ocupacion>');
    console.error('   Ejemplo: node scripts/ver_informe.cjs evt_2f7647');
    process.exit(1);
  }

  const pool = mysql.createPool({ ...DB_CONFIG, waitForConnections: true, connectionLimit: 2 });

  try {
    // 1. Información del evento
    const [evento] = await pool.query(
      `      SELECT e.id, e.nombre, e.nombre_salon, e.fecha_evento, e.estado,
              e.pax, e.hora_inicio, e.hora_fin, e.cotizacion_json,
              ce.folio
       FROM eventos e
       LEFT JOIN cotizaciones_evento ce ON e.id = ce.id_evento
       WHERE e.id = ?`,
      [idOcupacion]
    );

    console.log('\n══════════════════════════════════════════════════');
    console.log('📋  DATOS DEL EVENTO');
    console.log('══════════════════════════════════════════════════');
    if (evento.length === 0) {
      console.log('⚠️  No se encontró el evento con ID:', idOcupacion);
      // Buscar por aproximación
      const [eventos] = await pool.query(
        `SELECT id, nombre FROM eventos WHERE id LIKE ? LIMIT 5`,
        [`%${idOcupacion}%`]
      );
      if (eventos.length > 0) {
        console.log('\nEventos similares encontrados:');
        eventos.forEach(e => console.log(`   - ${e.id}: ${e.nombre}`));
      }
    } else {
      const e = evento[0];
      // Extraer datos de cotización desde cotizacion_json
      let quoteCode = '-', quoteContact = '-', quoteEmail = '-', quotePhone = '-';
      try {
        if (e.cotizacion_json) {
          const q = typeof e.cotizacion_json === 'string' ? JSON.parse(e.cotizacion_json) : e.cotizacion_json;
          quoteCode = q.code || '-';
          quoteContact = q.contact || '-';
          quoteEmail = q.email || '-';
          quotePhone = q.phone || '-';
        }
      } catch {}
      
      console.log(`  ID:           ${e.id}`);
      console.log(`  Nombre:       ${e.nombre || '-'}`);
      console.log(`  Salón:        ${e.nombre_salon || '-'}`);
      console.log(`  Fecha:        ${e.fecha_evento ? new Date(e.fecha_evento).toISOString().slice(0,10) : '-'}`);
      console.log(`  Estado:       ${e.estado || '-'}`);
      console.log(`  Pax:          ${e.pax || '-'}`);
      console.log(`  Horario:      ${e.hora_inicio || ''} - ${e.hora_fin || ''}`);
      console.log(`  Cotización:   ${quoteCode}`);
      console.log(`  Folio:        ${e.folio || '-'}`);
      console.log(`  Contacto:     ${quoteContact}`);
      console.log(`  Email:        ${quoteEmail}`);
      console.log(`  Teléfono:     ${quotePhone}`);
    }

    // 2. Informes del evento (todas las versiones)
    const [informes] = await pool.query(
      `SELECT i.*,
              (SELECT COUNT(*) FROM informe_dias_detalle WHERE informe_id = i.id) AS total_dias
       FROM informes_eventos i
       WHERE i.id_ocupacion = ?
       ORDER BY i.version DESC`,
      [idOcupacion]
    );

    console.log('\n══════════════════════════════════════════════════');
    console.log(`📄  INFORMES ENCONTRADOS: ${informes.length}`);
    console.log('══════════════════════════════════════════════════');
    
    if (informes.length === 0) {
      console.log('⚠️  No hay informes creados para este evento.');
      await pool.end();
      return;
    }

    for (const inf of informes) {
      console.log(`\n  ┌─ INFORME #${inf.id} (versión ${inf.version}) ─────────────────`);
      console.log(`  │ Creado:     ${inf.fecha_creacion ? new Date(inf.fecha_creacion).toLocaleString('es-GT') : '-'}`);
      console.log(`  │ Ocupación:  ${inf.id_ocupacion}`);
      console.log(`  │ Días:       ${inf.total_dias}`);
      console.log(`  └────────────────────────────────────────────────`);

      // 3. Días del informe
      const [dias] = await pool.query(
        `SELECT d.*, m.nombre_menu, c.nombre AS categoria_nombre
         FROM informe_dias_detalle d
         LEFT JOIN cat_menus m ON d.menu_id = m.id
         LEFT JOIN cat_categorias_alimento c ON m.categoria_id = c.id
         WHERE d.informe_id = ?
         ORDER BY d.fecha_evento ASC`,
        [inf.id]
      );

      for (const dia of dias) {
        console.log(`\n    ┌─ DÍA: ${dia.fecha_evento ? new Date(dia.fecha_evento).toISOString().slice(0,10) : 'Sin fecha'}`);
        console.log(`    │ ID:          ${dia.id}`);
        console.log(`    │ Menú:        ${dia.nombre_menu || '-'}`);
        console.log(`    │ Categoría:   ${dia.categoria_nombre || '-'}`);
        
        // Parsear descripcion_montaje
        if (dia.descripcion_montaje) {
          try {
            const montaje = typeof dia.descripcion_montaje === 'string'
              ? JSON.parse(dia.descripcion_montaje)
              : dia.descripcion_montaje;
            if (montaje && montaje._v === 2) {
              console.log(`    │ Montajes:    ${(montaje.montajes || []).length}`);
              if (montaje.montajes && montaje.montajes.length > 0) {
                montaje.montajes.forEach((m, i) => {
                  console.log(`    │   [${i+1}] Salón: ${m.salon || '-'} | Tipo: ${m.tipo_montaje || '-'} | Pax: ${m.num_personas || '-'} | Hora: ${m.horario || '-'}`);
                  if (m.equipo_necesario) console.log(`    │       Equipo: ${m.equipo_necesario}`);
                  if (m.mesas) console.log(`    │       Mesas:  ${m.mesas}`);
                  if (m.sillas) console.log(`    │       Sillas: ${m.sillas}`);
                });
              }
              if (montaje.alertas && montaje.alertas.length > 0) {
                console.log(`    │ Alertas:     ${montaje.alertas.join(', ')}`);
              }
              if (montaje.alertaCustom) {
                console.log(`    │ Alerta Custom: ${montaje.alertaCustom}`);
              }
              // Tiempos de comida
              if (montaje.items_tiempo_comida) {
                console.log(`    │ Tiempos comida: ${montaje.items_tiempo_comida.filter(Boolean).length} asignados`);
              }
            } else {
              console.log(`    │ Montaje:     ${JSON.stringify(montaje).slice(0, 200)}...`);
            }
          } catch {
            console.log(`    │ Montaje:     ${String(dia.descripcion_montaje).slice(0, 200)}`);
          }
        }

        if (dia.comentario_menu) {
          console.log(`    │ Comentario menú: ${dia.comentario_menu.slice(0, 150)}`);
        }

        // 4. Items del menú para este día
        const [items] = await pool.query(
          `SELECT d.*, i.nombre AS ingrediente_nombre, i.tipo AS ingrediente_tipo,
                  o.nombre_opcion AS opcion_nombre
           FROM informe_dia_menu_detalle d
           JOIN cat_ingredientes i ON d.ingrediente_id = i.id
           LEFT JOIN cat_opciones_ingrediente o ON d.opcion_id = o.id
           WHERE d.dia_id = ?
           ORDER BY d.id ASC`,
          [dia.id]
        );

        if (items.length > 0) {
          console.log(`    │ Items:       ${items.length}`);
          
          // Agrupar por tiempo de comida si está disponible
          let itemsTc = [];
          try {
            const p = typeof dia.descripcion_montaje === 'string'
              ? JSON.parse(dia.descripcion_montaje)
              : (dia.descripcion_montaje || {});
            if (p && p._v === 2 && p.items_tiempo_comida) {
              itemsTc = p.items_tiempo_comida;
            }
          } catch {}

          items.forEach((item, idx) => {
            const tcId = itemsTc && idx < itemsTc.length ? itemsTc[idx] : null;
            const tcLabel = tcId ? ` [TC: ${tcId}]` : '';
            console.log(`    │   ${idx+1}. ${item.ingrediente_nombre}${tcLabel}`);
            if (item.cantidad_total && item.cantidad_total > 0) console.log(`    │      Cantidad: ${item.cantidad_total}`);
            if (item.metodo_preparacion) console.log(`    │      Preparación: ${item.metodo_preparacion}`);
            if (item.opcion_nombre) console.log(`    │      Opción: ${item.opcion_nombre}`);
            if (item.notas) console.log(`    │      📝 Nota: ${item.notas}`);
          });
        } else {
          console.log(`    │ Items:       Sin items asignados`);
        }
        console.log(`    └──────────────────────────────────────────────`);
      }
    }

    // 5. Comentarios del informe (último informe)
    if (informes.length > 0) {
      const ultimoId = informes[0].id;
      const [comentarios] = await pool.query(
        `SELECT c.*, u.nombre AS usuario_nombre
         FROM informe_comentarios c
         LEFT JOIN usuarios u ON c.usuario_id = u.id
         WHERE c.informe_id = ?
         ORDER BY c.created_at DESC`,
        [ultimoId]
      );

      if (comentarios.length > 0) {
        console.log('\n══════════════════════════════════════════════════');
        console.log(`💬  COMENTARIOS (${comentarios.length})`);
        console.log('══════════════════════════════════════════════════');
        for (const c of comentarios) {
          console.log(`  [${new Date(c.created_at).toLocaleString('es-GT')}] ${c.usuario_nombre || 'Anónimo'}:`);
          console.log(`    ${c.contenido.slice(0, 200)}`);
          if (c.reacciones) console.log(`    Reacciones: ${JSON.stringify(c.reacciones)}`);
        }
      }

      // 6. Imágenes
      const [imagenes] = await pool.query(
        `SELECT * FROM informe_imagenes WHERE informe_id = ? ORDER BY created_at`,
        [ultimoId]
      );

      if (imagenes.length > 0) {
        console.log('\n══════════════════════════════════════════════════');
        console.log(`🖼️  IMÁGENES (${imagenes.length})`);
        console.log('══════════════════════════════════════════════════');
        for (const img of imagenes) {
          console.log(`  ID: ${img.id} | ${img.descripcion || 'Sin descripción'} | ${img.url.slice(0, 60)}...`);
        }
      }

      // 7. Historial
      const [historial] = await pool.query(
        `SELECT h.*, u.nombre AS usuario_nombre
         FROM informe_historial h
         LEFT JOIN usuarios u ON h.usuario_id = u.id
         WHERE h.informe_id = ?
         ORDER BY h.created_at DESC
         LIMIT 15`,
        [ultimoId]
      );

      if (historial.length > 0) {
        console.log('\n══════════════════════════════════════════════════');
        console.log(`📜  HISTORIAL (últimos ${historial.length})`);
        console.log('══════════════════════════════════════════════════');
        for (const h of historial) {
          console.log(`  [${new Date(h.created_at).toLocaleString('es-GT')}] ${h.accion} - ${h.usuario_nombre || 'Sistema'}: ${h.descripcion || ''}`);
        }
      }

      // 8. Versiones anteriores (resumen)
      if (informes.length > 1) {
        console.log('\n══════════════════════════════════════════════════');
        console.log(`🔄  VERSIONES ANTERIORES`);
        console.log('══════════════════════════════════════════════════');
        for (let i = 1; i < informes.length; i++) {
          console.log(`  Versión ${informes[i].version} (ID: ${informes[i].id}) - ${new Date(informes[i].fecha_creacion).toLocaleString('es-GT')}`);
        }
      }
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err);
  } finally {
    await pool.end();
    console.log('\n✅ Consulta completada.\n');
  }
}

main();
