-- =============================================
-- DETECTAR Y LIMPIAR EVENTOS DUPLICADOS
-- Ejecutar en HeidiSQL
-- =============================================

-- 1. Ver eventos duplicados (mismo nombre, fecha, salon, hora)
SELECT nombre, fecha_evento, hora_inicio, nombre_salon, COUNT(*) AS cantidad, GROUP_CONCAT(id) AS ids
FROM eventos
WHERE fecha_evento >= '2026-07-01' AND fecha_evento <= '2026-07-09'
GROUP BY nombre, fecha_evento, hora_inicio, nombre_salon
HAVING COUNT(*) > 1
ORDER BY cantidad DESC;

-- 2. Ver detalle de duplicados
SELECT e1.id AS id_a_mantener, e1.nombre, e1.fecha_evento, e1.hora_inicio, e1.nombre_salon,
       e2.id AS id_a_eliminar
FROM eventos e1
JOIN eventos e2 ON e1.nombre = e2.nombre
  AND e1.fecha_evento = e2.fecha_evento
  AND e1.hora_inicio = e2.hora_inicio
  AND e1.nombre_salon = e2.nombre_salon
  AND e1.id < e2.id
WHERE e1.fecha_evento >= '2026-07-01' AND e1.fecha_evento <= '2026-07-09'
ORDER BY e1.fecha_evento, e1.hora_inicio;

-- =============================================
-- LIMPIEZA (descomentar despues de revisar)
-- =============================================

-- Eliminar eventos duplicados (mantiene el de menor id)
-- DELETE e2 FROM eventos e1
-- JOIN eventos e2 ON e1.nombre = e2.nombre
--   AND e1.fecha_evento = e2.fecha_evento
--   AND e1.hora_inicio = e2.hora_inicio
--   AND e1.nombre_salon = e2.nombre_salon
--   AND e1.id < e2.id
-- WHERE e1.fecha_evento >= '2026-07-01' AND e1.fecha_evento <= '2026-07-09';
