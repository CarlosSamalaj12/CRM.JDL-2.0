-- ============================================================
-- SCRIPT PARA DETECTAR REGISTROS DUPLICADOS
-- Ejecutar en HeidiSQL (o cualquier cliente MySQL/MariaDB)
-- ============================================================

-- 1. Verificar estructura de las tablas principales
-- (Solo informativo)
SELECT '--- TABLAS INVOLUCRADAS ---' AS '';
SELECT TABLE_NAME, TABLE_ROWS 
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME IN ('tbl_seguimientocotizaciones','eventos','evento_metadatos');

-- ============================================================
-- 2. BUSCAR DUPLICADOS EN tbl_seguimientocotizaciones
-- ============================================================
SELECT '--- DUPLICADOS EN tbl_seguimientocotizaciones ---' AS '';

-- Eventos con el mismo Idocupacion (no debería haber)
SELECT Idocupacion, Institucion, COUNT(*) AS cantidad
FROM tbl_seguimientocotizaciones
GROUP BY Idocupacion
HAVING COUNT(*) > 1
ORDER BY cantidad DESC;

-- ============================================================
-- 3. BUSCAR DUPLICADOS EN eventos
-- ============================================================
SELECT '--- DUPLICADOS EN eventos ---' AS '';

-- Eventos con el mismo id (no debería haber)
SELECT e.id, e.nombre, COUNT(*) AS cantidad
FROM eventos e
GROUP BY e.id
HAVING COUNT(*) > 1
ORDER BY cantidad DESC;

-- ============================================================
-- 4. BUSCAR DUPLICADOS EN evento_metadatos
-- ============================================================
SELECT '--- DUPLICADOS EN evento_metadatos ---' AS '';

SELECT id_ocupacion, COUNT(*) AS cantidad
FROM evento_metadatos
GROUP BY id_ocupacion
HAVING COUNT(*) > 1
ORDER BY cantidad DESC;

-- ============================================================
-- 5. VER EL DETALLE DE LAS 3 RESERVAS DEL EJEMPLO (días 7, 8, 9)
-- ============================================================
SELECT '--- DETALLE DE RESERVAS CERCANAS ---' AS '';

-- Cambiar '2026-07-07' por la fecha del primer día de tu evento de 3 días
SELECT Idocupacion, Institucion, FechaEvento, FechaSalida, HoraI, HoraF, Salon, Estatuscotizacion, Vendedor, Pax
FROM tbl_seguimientocotizaciones
WHERE FechaEvento >= '2026-07-07' AND FechaEvento <= '2026-07-09'
ORDER BY FechaEvento ASC, HoraI ASC;

-- ============================================================
-- 6. VER LA CONSULTA COMPLETA QUE USA EL KANBAN
-- (para ver el resultado real con JOINs)
-- ============================================================
SELECT '--- CONSULTA KANBAN (semana del 2026-07-07) ---' AS '';

SELECT
    e.Idocupacion,
    e.Institucion,
    e.Pax,
    e.Estatuscotizacion,
    COALESCE(u.nombre_completo, u.nombre, e.Vendedor) AS Vendedor,
    e.FechaEvento,
    e.FechaSalida,
    e.HoraI,
    e.HoraF,
    e.TipoEvento,
    e.Telefono,
    e.Salon,
    CASE
      WHEN COALESCE(m.tiene_alertas, 0) = 1 THEN 1
      WHEN EXISTS (
        SELECT 1 FROM informe_dias_detalle dd
        JOIN informes_eventos ie ON dd.informe_id = ie.id
        WHERE ie.id_ocupacion = e.Idocupacion
        AND dd.descripcion_montaje IS NOT NULL
        AND dd.descripcion_montaje LIKE '%"alertas":%'
        AND dd.descripcion_montaje NOT LIKE '%"alertas":[]%'
        LIMIT 1
      ) THEN 1
      ELSE 0
    END AS tiene_alertas,
    m.alertas_text
FROM tbl_seguimientocotizaciones e
LEFT JOIN evento_metadatos m ON e.Idocupacion = m.id_ocupacion
LEFT JOIN eventos ev ON e.Idocupacion = ev.id
LEFT JOIN usuarios u ON ev.id_usuario = u.id
WHERE e.Estatuscotizacion IN (4, 7, 8)
  AND YEARWEEK(FechaEvento, 1) = YEARWEEK('2026-07-07', 1)
ORDER BY FechaEvento ASC, HoraI ASC;

-- ============================================================
-- 7. RESUMEN GENERAL
-- ============================================================
SELECT '--- RESUMEN ---' AS '';
SELECT 
  (SELECT COUNT(*) FROM tbl_seguimientocotizaciones) AS total_tbl_seguimientocotizaciones,
  (SELECT COUNT(DISTINCT Idocupacion) FROM tbl_seguimientocotizaciones) AS unicos_tbl_seguimientocotizaciones,
  (SELECT COUNT(*) FROM eventos) AS total_eventos,
  (SELECT COUNT(DISTINCT id) FROM eventos) AS unicos_eventos;
