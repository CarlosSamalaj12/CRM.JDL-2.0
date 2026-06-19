-- ============================================================
-- FIX: Eliminar tablas conflictivas antes de importar Informes.sql
-- Ejecuta este script en HeidiSQL ANTES de importar db/Informes.sql
-- ============================================================
-- NOTA: Este script elimina SOLO las tablas que causan conflicto
-- de nombres de constraints. Las tablas principales del CRM
-- (eventos, usuarios, empresas, etc.) NO se ven afectadas.
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;
SET @OLD_UNIQUE_CHECKS = @@UNIQUE_CHECKS, UNIQUE_CHECKS = 0;

-- ============================================================
-- 1. TABLAS DE INFORMES (dependen de las cat_*)
-- ============================================================
DROP TABLE IF EXISTS `informe_imagenes`;
DROP TABLE IF EXISTS `informe_destacados`;
DROP TABLE IF EXISTS `informe_comentarios`;
DROP TABLE IF EXISTS `informe_lecturas`;
DROP TABLE IF EXISTS `informe_historial`;
DROP TABLE IF EXISTS `informe_dia_menu_detalle`;
DROP TABLE IF EXISTS `informe_dias_detalle`;
DROP TABLE IF EXISTS `informes_eventos`;

-- ============================================================
-- 2. TABLAS DE PLATILLOS (dependen de cat_opciones_ingrediente)
-- ============================================================
DROP TABLE IF EXISTS `platillo_componentes`;
DROP TABLE IF EXISTS `menu_items`;

-- ============================================================
-- 3. TABLAS DE CATÁLOGO (las que tienen constraints genéricas)
-- ============================================================
DROP TABLE IF EXISTS `cat_opciones_ingrediente`;
DROP TABLE IF EXISTS `cat_platillos`;
DROP TABLE IF EXISTS `cat_menus`;
DROP TABLE IF EXISTS `cat_ingredientes`;
DROP TABLE IF EXISTS `cat_categorias_alimento`;

-- ============================================================
-- 4. OTRAS TABLAS DE CONFIGURACIÓN (sin datos críticos)
-- ============================================================
DROP TABLE IF EXISTS `config_equipo`;
DROP TABLE IF EXISTS `config_tipo_mesa`;
DROP TABLE IF EXISTS `config_tipo_silla`;

-- ============================================================
-- 5. TABLAS DE NOTIFICACIONES Y EVENT_NOTAS
-- ============================================================
DROP TABLE IF EXISTS `notificaciones`;
DROP TABLE IF EXISTS `event_notas`;
DROP TABLE IF EXISTS `evento_metadatos`;

-- ============================================================
-- 6. TABLAS DE MENÚ/MONTAJE (heredadas del schema.sql)
-- ============================================================
DROP TABLE IF EXISTS `menu_montaje_plantilla_adicional`;
DROP TABLE IF EXISTS `menu_montaje_plantilla_guarnicion`;
DROP TABLE IF EXISTS `menu_montaje_plantilla_detalle`;
DROP TABLE IF EXISTS `menu_montaje_plantillas`;
DROP TABLE IF EXISTS `menu_plato_preparacion_montaje_adicional_sugerido`;
DROP TABLE IF EXISTS `menu_plato_preparacion_montaje_tipo_sugerido`;
DROP TABLE IF EXISTS `menu_plato_preparacion_bebida_sugerida`;
DROP TABLE IF EXISTS `menu_plato_preparacion_guarnicion_sugerida`;
DROP TABLE IF EXISTS `menu_plato_preparacion_postre_sugerido`;
DROP TABLE IF EXISTS `menu_plato_preparacion_salsa_sugerida`;
DROP TABLE IF EXISTS `menu_plato_guarnicion_sugerida`;
DROP TABLE IF EXISTS `menu_preparacion_postre_sugerido`;
DROP TABLE IF EXISTS `menu_preparacion_salsa_sugerida`;
DROP TABLE IF EXISTS `menu_preparaciones`;
DROP TABLE IF EXISTS `menu_platos_fuertes`;
DROP TABLE IF EXISTS `menu_salsas`;
DROP TABLE IF EXISTS `menu_guarniciones`;
DROP TABLE IF EXISTS `menu_postres`;
DROP TABLE IF EXISTS `menu_bebidas`;
DROP TABLE IF EXISTS `menu_comentarios_adicionales`;
DROP TABLE IF EXISTS `montaje_tipo_adicional_sugerido`;
DROP TABLE IF EXISTS `montaje_adicionales`;
DROP TABLE IF EXISTS `montaje_tipos`;

-- ============================================================
-- RESTAURAR CONFIGURACIÓN
-- ============================================================
SET UNIQUE_CHECKS = @OLD_UNIQUE_CHECKS;
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- MENSAJE FINAL
-- ============================================================
SELECT '✅ LIMPIEZA COMPLETADA. Ahora puedes importar db/Informes.sql sin errores.' AS RESULTADO;
