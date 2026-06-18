/**
 * Script para corregir nombres de constraints genéricos en db/Informes.sql
 * Reemplaza CONSTRAINT '1', '2', '3' por nombres descriptivos únicos.
 * 
 * Uso: node scripts/fix_informes_sql.cjs
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'db', 'Informes.sql');
let originalContent = fs.readFileSync(filePath, 'utf8');

// Normalize line endings to \n for consistent matching
const hasCRLF = originalContent.includes('\r\n');
let content = originalContent.replace(/\r\n/g, '\n');

const replacements = [
  // cat_menus
  {
    old: "CONSTRAINT `1` FOREIGN KEY (`categoria_id`) REFERENCES `cat_categorias_alimento` (`id`) ON DELETE SET NULL\n) ENGINE=InnoDB AUTO_INCREMENT=9",
    new: "CONSTRAINT `fk_cat_menus_categoria` FOREIGN KEY (`categoria_id`) REFERENCES `cat_categorias_alimento` (`id`) ON DELETE SET NULL\n) ENGINE=InnoDB AUTO_INCREMENT=9"
  },
  // cat_opciones_ingrediente
  {
    old: "CONSTRAINT `1` FOREIGN KEY (`ingrediente_id`) REFERENCES `cat_ingredientes` (`id`) ON DELETE CASCADE\n) ENGINE=InnoDB AUTO_INCREMENT=21",
    new: "CONSTRAINT `fk_cat_opciones_ingrediente_ingrediente` FOREIGN KEY (`ingrediente_id`) REFERENCES `cat_ingredientes` (`id`) ON DELETE CASCADE\n) ENGINE=InnoDB AUTO_INCREMENT=21"
  },
  // cat_platillos
  {
    old: "CONSTRAINT `1` FOREIGN KEY (`categoria_id`) REFERENCES `cat_categorias_alimento` (`id`) ON DELETE SET NULL\n) ENGINE=InnoDB AUTO_INCREMENT=3",
    new: "CONSTRAINT `fk_cat_platillos_categoria` FOREIGN KEY (`categoria_id`) REFERENCES `cat_categorias_alimento` (`id`) ON DELETE SET NULL\n) ENGINE=InnoDB AUTO_INCREMENT=3"
  },
  // informe_comentarios
  {
    old: "CONSTRAINT `1` FOREIGN KEY (`informe_id`) REFERENCES `informes_eventos` (`id`) ON DELETE CASCADE,\n  CONSTRAINT `2` FOREIGN KEY (`dia_id`) REFERENCES `informe_dias_detalle` (`id`) ON DELETE CASCADE,\n  CONSTRAINT `fk_informe_comentarios_usuario`",
    new: "CONSTRAINT `fk_informe_comentarios_informe` FOREIGN KEY (`informe_id`) REFERENCES `informes_eventos` (`id`) ON DELETE CASCADE,\n  CONSTRAINT `fk_informe_comentarios_dia` FOREIGN KEY (`dia_id`) REFERENCES `informe_dias_detalle` (`id`) ON DELETE CASCADE,\n  CONSTRAINT `fk_informe_comentarios_usuario`"
  },
  // informe_destacados
  {
    old: "CONSTRAINT `1` FOREIGN KEY (`informe_id`) REFERENCES `informes_eventos` (`id`) ON DELETE CASCADE,\n  CONSTRAINT `2` FOREIGN KEY (`dia_id`) REFERENCES `informe_dias_detalle` (`id`) ON DELETE CASCADE,\n  CONSTRAINT `fk_informe_destacados_usuario`",
    new: "CONSTRAINT `fk_informe_destacados_informe` FOREIGN KEY (`informe_id`) REFERENCES `informes_eventos` (`id`) ON DELETE CASCADE,\n  CONSTRAINT `fk_informe_destacados_dia` FOREIGN KEY (`dia_id`) REFERENCES `informe_dias_detalle` (`id`) ON DELETE CASCADE,\n  CONSTRAINT `fk_informe_destacados_usuario`"
  },
  // informe_dia_menu_detalle
  {
    old: "CONSTRAINT `1` FOREIGN KEY (`dia_id`) REFERENCES `informe_dias_detalle` (`id`) ON DELETE CASCADE,\n  CONSTRAINT `2` FOREIGN KEY (`ingrediente_id`) REFERENCES `cat_ingredientes` (`id`),\n  CONSTRAINT `3` FOREIGN KEY (`opcion_id`) REFERENCES `cat_opciones_ingrediente` (`id`)",
    new: "CONSTRAINT `fk_informe_dia_menu_detalle_dia` FOREIGN KEY (`dia_id`) REFERENCES `informe_dias_detalle` (`id`) ON DELETE CASCADE,\n  CONSTRAINT `fk_informe_dia_menu_detalle_ingrediente` FOREIGN KEY (`ingrediente_id`) REFERENCES `cat_ingredientes` (`id`),\n  CONSTRAINT `fk_informe_dia_menu_detalle_opcion` FOREIGN KEY (`opcion_id`) REFERENCES `cat_opciones_ingrediente` (`id`)"
  },
  // informe_dias_detalle
  {
    old: "CONSTRAINT `1` FOREIGN KEY (`informe_id`) REFERENCES `informes_eventos` (`id`) ON DELETE CASCADE,\n  CONSTRAINT `2` FOREIGN KEY (`menu_id`) REFERENCES `cat_menus` (`id`)\n) ENGINE=InnoDB AUTO_INCREMENT=31",
    new: "CONSTRAINT `fk_informe_dias_detalle_informe` FOREIGN KEY (`informe_id`) REFERENCES `informes_eventos` (`id`) ON DELETE CASCADE,\n  CONSTRAINT `fk_informe_dias_detalle_menu` FOREIGN KEY (`menu_id`) REFERENCES `cat_menus` (`id`)\n) ENGINE=InnoDB AUTO_INCREMENT=31"
  },
  // informe_historial
  {
    old: "CONSTRAINT `1` FOREIGN KEY (`informe_id`) REFERENCES `informes_eventos` (`id`) ON DELETE CASCADE,\n  CONSTRAINT `fk_informe_historial_usuario`",
    new: "CONSTRAINT `fk_informe_historial_informe` FOREIGN KEY (`informe_id`) REFERENCES `informes_eventos` (`id`) ON DELETE CASCADE,\n  CONSTRAINT `fk_informe_historial_usuario`"
  },
  // informe_imagenes
  {
    old: "CONSTRAINT `1` FOREIGN KEY (`informe_id`) REFERENCES `informes_eventos` (`id`) ON DELETE CASCADE,\n  CONSTRAINT `2` FOREIGN KEY (`dia_id`) REFERENCES `informe_dias_detalle` (`id`) ON DELETE CASCADE\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    new: "CONSTRAINT `fk_informe_imagenes_informe` FOREIGN KEY (`informe_id`) REFERENCES `informes_eventos` (`id`) ON DELETE CASCADE,\n  CONSTRAINT `fk_informe_imagenes_dia` FOREIGN KEY (`dia_id`) REFERENCES `informe_dias_detalle` (`id`) ON DELETE CASCADE\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
  },
  // informe_lecturas
  {
    old: "CONSTRAINT `1` FOREIGN KEY (`informe_id`) REFERENCES `informes_eventos` (`id`) ON DELETE CASCADE,\n  CONSTRAINT `fk_informe_lecturas_usuario`",
    new: "CONSTRAINT `fk_informe_lecturas_informe` FOREIGN KEY (`informe_id`) REFERENCES `informes_eventos` (`id`) ON DELETE CASCADE,\n  CONSTRAINT `fk_informe_lecturas_usuario`"
  },
  // menu_items
  {
    old: "CONSTRAINT `1` FOREIGN KEY (`menu_id`) REFERENCES `cat_menus` (`id`) ON DELETE CASCADE,\n  CONSTRAINT `2` FOREIGN KEY (`ingrediente_id`) REFERENCES `cat_ingredientes` (`id`),\n  CONSTRAINT `3` FOREIGN KEY (`opcion_id`) REFERENCES `cat_opciones_ingrediente` (`id`)",
    new: "CONSTRAINT `fk_menu_items_menu` FOREIGN KEY (`menu_id`) REFERENCES `cat_menus` (`id`) ON DELETE CASCADE,\n  CONSTRAINT `fk_menu_items_ingrediente` FOREIGN KEY (`ingrediente_id`) REFERENCES `cat_ingredientes` (`id`),\n  CONSTRAINT `fk_menu_items_opcion` FOREIGN KEY (`opcion_id`) REFERENCES `cat_opciones_ingrediente` (`id`)"
  },
  // platillo_componentes
  {
    old: "CONSTRAINT `1` FOREIGN KEY (`platillo_id`) REFERENCES `cat_platillos` (`id`) ON DELETE CASCADE,\n  CONSTRAINT `2` FOREIGN KEY (`ingrediente_id`) REFERENCES `cat_ingredientes` (`id`),\n  CONSTRAINT `3` FOREIGN KEY (`opcion_id`) REFERENCES `cat_opciones_ingrediente` (`id`)",
    new: "CONSTRAINT `fk_platillo_componentes_platillo` FOREIGN KEY (`platillo_id`) REFERENCES `cat_platillos` (`id`) ON DELETE CASCADE,\n  CONSTRAINT `fk_platillo_componentes_ingrediente` FOREIGN KEY (`ingrediente_id`) REFERENCES `cat_ingredientes` (`id`),\n  CONSTRAINT `fk_platillo_componentes_opcion` FOREIGN KEY (`opcion_id`) REFERENCES `cat_opciones_ingrediente` (`id`)"
  }
];

console.log('=== CORRIGIENDO CONSTRAINTS EN Informes.sql ===\n');
console.log('Line endings:', hasCRLF ? 'CRLF (Windows)' : 'LF (Unix)');

let totalReplacements = 0;
for (const r of replacements) {
  // Use indexOf instead of match to avoid regex parsing issues with SQL syntax
  const index = content.indexOf(r.old);
  if (index >= 0) {
    content = content.replace(r.old, r.new);
    totalReplacements++;
    const name = r.new.split(' ')[0].replace('CONSTRAINT ','');
    console.log(`✅ Reemplazado: ${name}`);
  } else {
    console.log(`⚠️  No encontrado: ${r.old.substring(0, 65)}...`);
  }
}

// Restore original line endings
if (hasCRLF) {
  content = content.replace(/\n/g, '\r\n');
}

// Verify no more generic constraints remain
const checkContent = hasCRLF ? content.replace(/\r\n/g, '\n') : content;
const remaining = checkContent.match(/CONSTRAINT `[123]` FOREIGN KEY/g);

console.log(`\n--- RESUMEN ---`);
console.log(`Total reemplazos realizados: ${totalReplacements}`);

if (remaining) {
  console.log(`❌ ERROR: Quedan ${remaining.length} constraints genéricas sin reemplazar.`);
  // Show context for each remaining one
  for (const r of remaining) {
    const idx = checkContent.indexOf(r);
    const ctx = checkContent.substring(Math.max(0, idx - 60), idx + 80);
    console.log(`   ...${ctx.replace(/\n/g, '\\n')}...`);
  }
  process.exit(1);
} else {
  console.log(`✅ TODAS las constraints genéricas fueron reemplazadas.`);
}

// Write file
fs.writeFileSync(filePath, content, 'utf8');
console.log(`📁 Archivo actualizado: db/Informes.sql`);
console.log('\n🚀 Ya puedes importar db/Informes.sql en HeidiSQL sin el error 121.');
