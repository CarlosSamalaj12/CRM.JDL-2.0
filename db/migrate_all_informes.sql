-- ============================================
-- MIGRACION COMPLETA - Sistema de Informes
-- ============================================
-- Script idempotente - seguro de ejecutar múltiples veces
-- ============================================

USE `crm_jdl`;

-- ============================================
-- 1. SISTEMA DE TAREAS PERSONALES POR EVENTO
-- ============================================
CREATE TABLE IF NOT EXISTS `tareas_evento` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_ocupacion` varchar(30) NOT NULL,
  `usuario_id` varchar(100) NOT NULL,
  `usuario_nombre` varchar(255) DEFAULT NULL,
  `contenido` text NOT NULL,
  `completada` tinyint(1) NOT NULL DEFAULT 0,
  `fecha_creacion` datetime DEFAULT current_timestamp(),
  `fecha_actualizacion` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_tareas_evento_usuario` (`id_ocupacion`, `usuario_id`),
  KEY `idx_tareas_usuario` (`usuario_id`),
  CONSTRAINT `fk_tareas_evento_ocupacion` FOREIGN KEY (`id_ocupacion`) REFERENCES `eventos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 2. SISTEMA DE RESPUESTAS EN COMENTARIOS
-- ============================================
-- Procedimiento para agregar columna si no existe
DROP PROCEDURE IF EXISTS `add_parent_id_column`;
DELIMITER //
CREATE PROCEDURE `add_parent_id_column`()
BEGIN
  IF NOT EXISTS (
    SELECT * FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = 'crm_jdl' 
    AND TABLE_NAME = 'informe_comentarios' 
    AND COLUMN_NAME = 'parent_id'
  ) THEN
    ALTER TABLE `informe_comentarios` 
    ADD COLUMN `parent_id` INT NULL AFTER `dia_id`;
  END IF;
END //
DELIMITER ;

CALL `add_parent_id_column`();
DROP PROCEDURE IF EXISTS `add_parent_id_column`;

-- Procedimiento para agregar foreign key si no existe
DROP PROCEDURE IF EXISTS `add_parent_id_fk`;
DELIMITER //
CREATE PROCEDURE `add_parent_id_fk`()
BEGIN
  IF NOT EXISTS (
    SELECT * FROM information_schema.TABLE_CONSTRAINTS 
    WHERE TABLE_SCHEMA = 'crm_jdl' 
    AND TABLE_NAME = 'informe_comentarios' 
    AND CONSTRAINT_NAME = 'fk_comentario_parent'
  ) THEN
    ALTER TABLE `informe_comentarios`
    ADD CONSTRAINT `fk_comentario_parent` 
    FOREIGN KEY (`parent_id`) REFERENCES `informe_comentarios`(`id`) 
    ON DELETE CASCADE;
  END IF;
END //
DELIMITER ;

CALL `add_parent_id_fk`();
DROP PROCEDURE IF EXISTS `add_parent_id_fk`;

-- Procedimiento para agregar índice si no existe
DROP PROCEDURE IF EXISTS `add_parent_id_index`;
DELIMITER //
CREATE PROCEDURE `add_parent_id_index`()
BEGIN
  IF NOT EXISTS (
    SELECT * FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = 'crm_jdl' 
    AND TABLE_NAME = 'informe_comentarios' 
    AND INDEX_NAME = 'idx_comentarios_parent'
  ) THEN
    CREATE INDEX `idx_comentarios_parent` ON `informe_comentarios`(`parent_id`);
  END IF;
END //
DELIMITER ;

CALL `add_parent_id_index`();
DROP PROCEDURE IF EXISTS `add_parent_id_index`;

-- ============================================
-- 3. CAMPO COMENTARIO_ID EN NOTIFICACIONES
-- ============================================
-- Procedimiento para agregar columna si no existe
DROP PROCEDURE IF EXISTS `add_comentario_id_column`;
DELIMITER //
CREATE PROCEDURE `add_comentario_id_column`()
BEGIN
  IF NOT EXISTS (
    SELECT * FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = 'crm_jdl' 
    AND TABLE_NAME = 'notificaciones' 
    AND COLUMN_NAME = 'comentario_id'
  ) THEN
    ALTER TABLE `notificaciones` 
    ADD COLUMN `comentario_id` INT NULL;
  END IF;
END //
DELIMITER ;

CALL `add_comentario_id_column`();
DROP PROCEDURE IF EXISTS `add_comentario_id_column`;

-- ============================================
-- VERIFICACION FINAL
-- ============================================
SELECT '=== MIGRACION COMPLETADA EXITOSAMENTE ===' AS resultado;

SELECT 
  'tareas_evento' AS tabla,
  COUNT(*) AS existe
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'crm_jdl' AND TABLE_NAME = 'tareas_evento';

SELECT 
  'informe_comentarios.parent_id' AS campo,
  COUNT(*) AS existe
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = 'crm_jdl' AND TABLE_NAME = 'informe_comentarios' AND COLUMN_NAME = 'parent_id';

SELECT 
  'notificaciones.comentario_id' AS campo,
  COUNT(*) AS existe
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = 'crm_jdl' AND TABLE_NAME = 'notificaciones' AND COLUMN_NAME = 'comentario_id';
