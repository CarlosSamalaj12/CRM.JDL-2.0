-- ============================================================
-- SCRIPT B: Limpiar tablas conflictivas para reimportar
-- ============================================================
-- Solo dropea las ~12 tablas que tienen constraints genéricas
-- y necesitan ser recreadas desde Informes.sql.
-- Las tablas principales del CRM NO se ven afectadas.
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- DROP en orden correcto (hijas primero, padres después)
DROP TABLE IF EXISTS `informe_imagenes`;
DROP TABLE IF EXISTS `informe_destacados`;
DROP TABLE IF EXISTS `informe_comentarios`;
DROP TABLE IF EXISTS `informe_lecturas`;
DROP TABLE IF EXISTS `informe_historial`;
DROP TABLE IF EXISTS `informe_dia_menu_detalle`;
DROP TABLE IF EXISTS `informe_dias_detalle`;
DROP TABLE IF EXISTS `informes_eventos`;
DROP TABLE IF EXISTS `evento_metadatos`;

DROP TABLE IF EXISTS `platillo_componentes`;
DROP TABLE IF EXISTS `menu_items`;
DROP TABLE IF EXISTS `cat_opciones_ingrediente`;
DROP TABLE IF EXISTS `cat_platillos`;
DROP TABLE IF EXISTS `cat_menus`;
DROP TABLE IF EXISTS `cat_ingredientes`;
DROP TABLE IF EXISTS `cat_categorias_alimento`;

DROP TABLE IF EXISTS `config_equipo`;
DROP TABLE IF EXISTS `config_tipo_mesa`;
DROP TABLE IF EXISTS `config_tipo_silla`;
DROP TABLE IF EXISTS `notificaciones`;
DROP TABLE IF EXISTS `event_notas`;

SET FOREIGN_KEY_CHECKS = 1;

SELECT '✅ TABLAS ELIMINADAS. Ahora puedes importar db/Informes.sql sin errores.' AS RESULTADO;
