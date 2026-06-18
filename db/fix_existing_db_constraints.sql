-- ============================================================
-- SCRIPT A: Corregir constraints en la BD existente
-- SIN PERDER DATOS. Ejecutar en HeidiSQL en la BD crm_jdl.
-- ============================================================
-- Este script elimina las constraints con nombres genéricos
-- ('1', '2', '3') y las recrea con nombres descriptivos únicos.
-- Los datos de las tablas NO se pierden.
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- 1. cat_menus
-- ============================================================
ALTER TABLE `cat_menus` DROP FOREIGN KEY `1`;
ALTER TABLE `cat_menus` ADD CONSTRAINT `fk_cat_menus_categoria`
  FOREIGN KEY (`categoria_id`) REFERENCES `cat_categorias_alimento` (`id`)
  ON DELETE SET NULL;

-- ============================================================
-- 2. cat_opciones_ingrediente
-- ============================================================
ALTER TABLE `cat_opciones_ingrediente` DROP FOREIGN KEY `1`;
ALTER TABLE `cat_opciones_ingrediente` ADD CONSTRAINT `fk_cat_opciones_ingrediente_ingrediente`
  FOREIGN KEY (`ingrediente_id`) REFERENCES `cat_ingredientes` (`id`)
  ON DELETE CASCADE;

-- ============================================================
-- 3. cat_platillos
-- ============================================================
ALTER TABLE `cat_platillos` DROP FOREIGN KEY `1`;
ALTER TABLE `cat_platillos` ADD CONSTRAINT `fk_cat_platillos_categoria`
  FOREIGN KEY (`categoria_id`) REFERENCES `cat_categorias_alimento` (`id`)
  ON DELETE SET NULL;

-- ============================================================
-- 4. informe_comentarios
-- ============================================================
ALTER TABLE `informe_comentarios` DROP FOREIGN KEY `1`;
ALTER TABLE `informe_comentarios` DROP FOREIGN KEY `2`;
ALTER TABLE `informe_comentarios` ADD CONSTRAINT `fk_informe_comentarios_informe`
  FOREIGN KEY (`informe_id`) REFERENCES `informes_eventos` (`id`) ON DELETE CASCADE;
ALTER TABLE `informe_comentarios` ADD CONSTRAINT `fk_informe_comentarios_dia`
  FOREIGN KEY (`dia_id`) REFERENCES `informe_dias_detalle` (`id`) ON DELETE CASCADE;

-- ============================================================
-- 5. informe_destacados
-- ============================================================
ALTER TABLE `informe_destacados` DROP FOREIGN KEY `1`;
ALTER TABLE `informe_destacados` DROP FOREIGN KEY `2`;
ALTER TABLE `informe_destacados` ADD CONSTRAINT `fk_informe_destacados_informe`
  FOREIGN KEY (`informe_id`) REFERENCES `informes_eventos` (`id`) ON DELETE CASCADE;
ALTER TABLE `informe_destacados` ADD CONSTRAINT `fk_informe_destacados_dia`
  FOREIGN KEY (`dia_id`) REFERENCES `informe_dias_detalle` (`id`) ON DELETE CASCADE;

-- ============================================================
-- 6. informe_dia_menu_detalle
-- ============================================================
ALTER TABLE `informe_dia_menu_detalle` DROP FOREIGN KEY `1`;
ALTER TABLE `informe_dia_menu_detalle` DROP FOREIGN KEY `2`;
ALTER TABLE `informe_dia_menu_detalle` DROP FOREIGN KEY `3`;
ALTER TABLE `informe_dia_menu_detalle` ADD CONSTRAINT `fk_informe_dia_menu_detalle_dia`
  FOREIGN KEY (`dia_id`) REFERENCES `informe_dias_detalle` (`id`) ON DELETE CASCADE;
ALTER TABLE `informe_dia_menu_detalle` ADD CONSTRAINT `fk_informe_dia_menu_detalle_ingrediente`
  FOREIGN KEY (`ingrediente_id`) REFERENCES `cat_ingredientes` (`id`);
ALTER TABLE `informe_dia_menu_detalle` ADD CONSTRAINT `fk_informe_dia_menu_detalle_opcion`
  FOREIGN KEY (`opcion_id`) REFERENCES `cat_opciones_ingrediente` (`id`);

-- ============================================================
-- 7. informe_dias_detalle
-- ============================================================
ALTER TABLE `informe_dias_detalle` DROP FOREIGN KEY `1`;
ALTER TABLE `informe_dias_detalle` DROP FOREIGN KEY `2`;
ALTER TABLE `informe_dias_detalle` ADD CONSTRAINT `fk_informe_dias_detalle_informe`
  FOREIGN KEY (`informe_id`) REFERENCES `informes_eventos` (`id`) ON DELETE CASCADE;
ALTER TABLE `informe_dias_detalle` ADD CONSTRAINT `fk_informe_dias_detalle_menu`
  FOREIGN KEY (`menu_id`) REFERENCES `cat_menus` (`id`);

-- ============================================================
-- 8. informe_historial
-- ============================================================
ALTER TABLE `informe_historial` DROP FOREIGN KEY `1`;
ALTER TABLE `informe_historial` ADD CONSTRAINT `fk_informe_historial_informe`
  FOREIGN KEY (`informe_id`) REFERENCES `informes_eventos` (`id`) ON DELETE CASCADE;

-- ============================================================
-- 9. informe_imagenes
-- ============================================================
ALTER TABLE `informe_imagenes` DROP FOREIGN KEY `1`;
ALTER TABLE `informe_imagenes` DROP FOREIGN KEY `2`;
ALTER TABLE `informe_imagenes` ADD CONSTRAINT `fk_informe_imagenes_informe`
  FOREIGN KEY (`informe_id`) REFERENCES `informes_eventos` (`id`) ON DELETE CASCADE;
ALTER TABLE `informe_imagenes` ADD CONSTRAINT `fk_informe_imagenes_dia`
  FOREIGN KEY (`dia_id`) REFERENCES `informe_dias_detalle` (`id`) ON DELETE CASCADE;

-- ============================================================
-- 10. informe_lecturas
-- ============================================================
ALTER TABLE `informe_lecturas` DROP FOREIGN KEY `1`;
ALTER TABLE `informe_lecturas` ADD CONSTRAINT `fk_informe_lecturas_informe`
  FOREIGN KEY (`informe_id`) REFERENCES `informes_eventos` (`id`) ON DELETE CASCADE;

-- ============================================================
-- 11. menu_items
-- ============================================================
ALTER TABLE `menu_items` DROP FOREIGN KEY `1`;
ALTER TABLE `menu_items` DROP FOREIGN KEY `2`;
ALTER TABLE `menu_items` DROP FOREIGN KEY `3`;
ALTER TABLE `menu_items` ADD CONSTRAINT `fk_menu_items_menu`
  FOREIGN KEY (`menu_id`) REFERENCES `cat_menus` (`id`) ON DELETE CASCADE;
ALTER TABLE `menu_items` ADD CONSTRAINT `fk_menu_items_ingrediente`
  FOREIGN KEY (`ingrediente_id`) REFERENCES `cat_ingredientes` (`id`);
ALTER TABLE `menu_items` ADD CONSTRAINT `fk_menu_items_opcion`
  FOREIGN KEY (`opcion_id`) REFERENCES `cat_opciones_ingrediente` (`id`);

-- ============================================================
-- 12. platillo_componentes
-- ============================================================
ALTER TABLE `platillo_componentes` DROP FOREIGN KEY `1`;
ALTER TABLE `platillo_componentes` DROP FOREIGN KEY `2`;
ALTER TABLE `platillo_componentes` DROP FOREIGN KEY `3`;
ALTER TABLE `platillo_componentes` ADD CONSTRAINT `fk_platillo_componentes_platillo`
  FOREIGN KEY (`platillo_id`) REFERENCES `cat_platillos` (`id`) ON DELETE CASCADE;
ALTER TABLE `platillo_componentes` ADD CONSTRAINT `fk_platillo_componentes_ingrediente`
  FOREIGN KEY (`ingrediente_id`) REFERENCES `cat_ingredientes` (`id`);
ALTER TABLE `platillo_componentes` ADD CONSTRAINT `fk_platillo_componentes_opcion`
  FOREIGN KEY (`opcion_id`) REFERENCES `cat_opciones_ingrediente` (`id`);

-- ============================================================
-- FINALIZAR
-- ============================================================
SET FOREIGN_KEY_CHECKS = 1;

SELECT '✅ CONSTRAINTS CORREGIDAS. Ahora puedes importar db/Informes.sql sin errores.' AS RESULTADO;
