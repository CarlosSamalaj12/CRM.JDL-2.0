-- =============================================
-- LIMPIEZA DE DUPLICADOS EN tbl_seguimientocotizaciones
-- Ejecutar en HeidiSQL
-- =============================================

-- 1. Ver estado antes
SELECT COUNT(*) AS total_registros,
       COUNT(DISTINCT Idocupacion) AS unicos,
       COUNT(*) - COUNT(DISTINCT Idocupacion) AS duplicados
FROM tbl_seguimientocotizaciones;

-- 2. Ver duplicados (primeros 50)
SELECT Idocupacion, Institucion, FechaEvento, Salon, COUNT(*) AS cantidad
FROM tbl_seguimientocotizaciones
GROUP BY Idocupacion
HAVING COUNT(*) > 1
ORDER BY cantidad DESC
LIMIT 50;

-- =============================================
-- LIMPIEZA (descomentar las lineas de abajo)
-- =============================================

-- Eliminar tabla temporal si existe
DROP TABLE IF EXISTS tbl_seguimientocotizaciones_temp;

-- Crear tabla temporal sin duplicados
CREATE TABLE tbl_seguimientocotizaciones_temp AS
SELECT DISTINCT * FROM tbl_seguimientocotizaciones;

-- Limpiar tabla original
TRUNCATE TABLE tbl_seguimientocotizaciones;

-- Insertar registros unicos
INSERT INTO tbl_seguimientocotizaciones
SELECT * FROM tbl_seguimientocotizaciones_temp;

-- Eliminar tabla temporal
DROP TABLE tbl_seguimientocotizaciones_temp;

-- 3. Verificar despues
SELECT COUNT(*) AS total_registros,
       COUNT(DISTINCT Idocupacion) AS unicos,
       COUNT(*) - COUNT(DISTINCT Idocupacion) AS duplicados
FROM tbl_seguimientocotizaciones;
