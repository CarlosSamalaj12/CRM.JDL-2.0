-- ============================================================
-- Top de salones más utilizados
-- Filtros: Estatuscotizacion = 4 (Confirmado), mes de Agosto
-- Tabla:  tbl_seguimientocotizaciones
-- Ejecutar en: HeidiSQL / MariaDB  (crm_jdl @ 127.0.0.1:3306)
-- ============================================================
-- Edita los 4 parámetros de SET abajo según necesites.
-- ============================================================

SET @anio    = 2026;   -- Año a filtrar
SET @mes     = 8;      -- Mes a filtrar (1=Ene ... 12=Dic)
SET @estatus = 4;      -- 4=Confirmado (7=Pre-reserva, 8=Mantenimiento)
SET @limite  = 50;     -- NULL = sin límite; o un número entero


-- Rango del mes (medio-abierto, evita problemas con horas)
SET @desde     = DATE(CONCAT(@anio, '-', LPAD(@mes, 2, '0'), '-01'));
SET @hasta_excl = DATE_ADD(@desde, INTERVAL 1 MONTH);


-- ⚠ MariaDB no acepta variables de usuario en LIMIT directamente.
-- Se construye el SQL con PREPARE/EXECUTE para inyectar el límite
-- de forma segura (sólo se concatena un número).
SET @limite_sql = IFNULL(@limite, 18446744073709551615); -- tope BIGINT UNSIGNED = "sin límite"

SET @sql = CONCAT('
SELECT
  s.Salon                                      AS salon,
  COUNT(*)                                     AS cantidad,
  ROUND(
    COUNT(*) * 100.0 /
    NULLIF((SELECT COUNT(*)
            FROM tbl_seguimientocotizaciones
            WHERE Estatuscotizacion = ', @estatus, '
              AND FechaEvento >= ''', @desde, '''
              AND FechaEvento <  ''', @hasta_excl, '''
              AND Salon IS NOT NULL
              AND Salon <> ''''), 0),
    2
  )                                            AS porcentaje
FROM tbl_seguimientocotizaciones s
WHERE s.Estatuscotizacion = ', @estatus, '
  AND s.FechaEvento   >= ''', @desde, '''
  AND s.FechaEvento   <  ''', @hasta_excl, '''
  AND s.Salon IS NOT NULL
  AND s.Salon <> '''' 
GROUP BY s.Salon
ORDER BY cantidad DESC, salon ASC
LIMIT ', @limite_sql);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
