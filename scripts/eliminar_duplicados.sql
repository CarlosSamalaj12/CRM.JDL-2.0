-- ============================================================
-- SCRIPT PARA ELIMINAR REGISTROS DUPLICADOS
-- Base de datos: crm_jdl
-- Tabla: tbl_seguimientocotizaciones
-- ============================================================
-- NOTA: Asegúrate de tener seleccionada la BD 'crm_jdl'
-- En HeidiSQL: doble clic en 'crm_jdl' en el panel izquierdo
-- ============================================================

-- ============================================================
-- PASO 1: Ver cuántos registros hay antes
-- ============================================================
SELECT '--- ANTES ---' AS '';

SELECT COUNT(*) AS total_registros,
       COUNT(DISTINCT Idocupacion) AS idocupacion_unicos
FROM crm_jdl.tbl_seguimientocotizaciones;

-- ============================================================
-- PASO 2: Ver los Idocupacion que están repetidos
-- ============================================================
SELECT '--- DUPLICADOS POR Idocupacion ---' AS '';

SELECT Idocupacion, Institucion, FechaEvento, FechaSalida, Salon,
       COUNT(*) AS cantidad
FROM crm_jdl.tbl_seguimientocotizaciones
GROUP BY Idocupacion
HAVING COUNT(*) > 1
ORDER BY cantidad DESC, Idocupacion;

-- ============================================================
-- PASO 2b: Ver detalle completo de cada duplicado
-- ============================================================
SELECT '--- DETALLE DE DUPLICADOS ---' AS '';

SELECT t1.*
FROM crm_jdl.tbl_seguimientocotizaciones t1
INNER JOIN (
  SELECT Idocupacion
  FROM crm_jdl.tbl_seguimientocotizaciones
  GROUP BY Idocupacion
  HAVING COUNT(*) > 1
) t2 ON t1.Idocupacion = t2.Idocupacion
ORDER BY t1.Idocupacion, t1.FechaEvento, t1.HoraI;

-- ============================================================
-- PASO 3: ELIMINAR DUPLICADOS (solo ejecutar si PASO 2 mostró datos)
-- Estrategia: SELECT DISTINCT -> temporal -> reemplazar
-- ============================================================
SELECT '--- ELIMINANDO DUPLICADOS ---' AS '';

-- 3a. Eliminar tabla temporal si existe de ejecuciones anteriores
DROP TABLE IF EXISTS crm_jdl.tbl_seguimientocotizaciones_temp;

-- 3b. Crear tabla temporal solo con registros únicos (DISTINCT)
CREATE TABLE crm_jdl.tbl_seguimientocotizaciones_temp AS
SELECT DISTINCT *
FROM crm_jdl.tbl_seguimientocotizaciones;

-- 3c. Vaciar la tabla original (cuidado: esto borra todo)
TRUNCATE TABLE crm_jdl.tbl_seguimientocotizaciones;

-- 3d. Copiar los datos únicos de vuelta
INSERT INTO crm_jdl.tbl_seguimientocotizaciones
SELECT * FROM crm_jdl.tbl_seguimientocotizaciones_temp;

-- 3e. Eliminar la tabla temporal
DROP TABLE IF EXISTS crm_jdl.tbl_seguimientocotizaciones_temp;

SELECT '--- DUPLICADOS ELIMINADOS ---' AS '';

-- ============================================================
-- PASO 4: Verificar que ya no hay duplicados
-- ============================================================
SELECT '--- DESPUES ---' AS '';

SELECT COUNT(*) AS total_registros,
       COUNT(DISTINCT Idocupacion) AS idocupacion_unicos
FROM crm_jdl.tbl_seguimientocotizaciones;

SELECT '--- VERIFICACION (debe mostrar 0 filas) ---' AS '';

SELECT Idocupacion, COUNT(*) AS cantidad
FROM crm_jdl.tbl_seguimientocotizaciones
GROUP BY Idocupacion
HAVING COUNT(*) > 1;
