-- ============================================
-- SCRIPT DE MIGRACIÓN - SISTEMA DE TAREAS
-- ============================================
-- Este script crea la tabla necesaria para el sistema de tareas personales
-- Ejecutar en la base de datos de destino
-- ============================================

USE `crm_jdl`;

-- ============================================
-- TABLA: tareas_evento
-- Descripción: Tareas personales por usuario y evento
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
-- Verificación de la migración
-- ============================================

SELECT 
  TABLE_NAME,
  TABLE_ROWS,
  CREATE_TIME,
  UPDATE_TIME
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'crm_jdl' 
  AND TABLE_NAME = 'tareas_evento';

SELECT 'Migración completada exitosamente' AS mensaje;
