-- =============================================
-- LIMPIEZA DE DUPLICADOS EN EVENTOS
-- Ejecutar en HeidiSQL
-- =============================================

-- 1. Ver estado antes
SELECT COUNT(*) AS total_registros,
       COUNT(DISTINCT id) AS unicos,
       COUNT(*) - COUNT(DISTINCT id) AS duplicados
FROM eventos;

-- 2. Ver eventos duplicados
SELECT id, nombre, fecha_evento, hora_inicio, nombre_salon, COUNT(*) AS cantidad
FROM eventos
WHERE fecha_evento >= '2026-07-07' AND fecha_evento <= '2026-07-09'
GROUP BY id
HAVING COUNT(*) > 1
ORDER BY cantidad DESC;

-- 3. Ver eventos con mismo nombre, fecha y salon (posibles duplicados)
SELECT nombre, fecha_evento, nombre_salon, COUNT(*) AS cantidad, GROUP_CONCAT(id) AS ids
FROM eventos
WHERE fecha_evento >= '2026-07-07' AND fecha_evento <= '2026-07-09'
GROUP BY nombre, fecha_evento, nombre_salon
HAVING COUNT(*) > 1
ORDER BY cantidad DESC;
