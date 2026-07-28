-- ============================================================
-- FIX: Normalizar pax_compartido en eventos multi-slot
-- ============================================================
-- Problema: eventos creados antes de que existiera el switch
-- "Compartido / No Compartido" en el formulario. Algunos tienen
-- pax_compartido = 0 en todos los slots aunque en la UI aparezcan
-- como "Compartido", lo que hace que el reporte de ventas sume el
-- pax de cada slot en vez de tomar el compartido.
--
-- Estrategia: para cada grupo (id_grupo) con varios slots, si AL
-- MENOS UN slot ya está marcado como compartido (pax_compartido=1),
-- propagar ese 1 a TODOS los slots del grupo. Los grupos donde
-- todos los slots están en 0 se dejan sin tocar (decisión manual).
--
-- IMPORTANTE:
--   1. Correr primero el BLOQUE 1 (diagnóstico) y revisar.
--   2. Si todo bien, correr BLOQUE 2 (UPDATE).
--   3. Al final correr BLOQUE 3 (verificación).
-- ============================================================

-- ============================================================
-- IMPORTANTE: antes de correr nada, seleccioná la base `crm_jdl`
-- desde el dropdown de la izquierda en HeidiSQL.
-- ============================================================

-- ============================================================
-- BLOQUE 1: DIAGNÓSTICO (solo lectura, no modifica nada)
-- ============================================================

-- 1.1 Resumen general: ¿cuántos grupos hay en cada estado?
-- ----------------------------------------
SELECT
  CASE
    WHEN total_slots = 1 THEN '1 slot (no aplica)'
    WHEN todos_compartido = 1 THEN 'Multi-slot, todos compartido=1 ✅'
    WHEN todos_no_compartido = 1 THEN 'Multi-slot, todos compartido=0 ⚠️'
    ELSE 'Multi-slot, MIXTO (algunos 1 y otros 0) 🔧'
  END AS estado_grupo,
  COUNT(*) AS cantidad_grupos
FROM (
  SELECT
    id_grupo,
    COUNT(*) AS total_slots,
    MIN(pax_compartido) AS min_pc,
    MAX(pax_compartido) AS max_pc,
    CASE WHEN MIN(pax_compartido) = 1 THEN 1 ELSE 0 END AS todos_compartido,
    CASE WHEN MAX(pax_compartido) = 0 THEN 1 ELSE 0 END AS todos_no_compartido
  FROM eventos
  WHERE id_grupo IS NOT NULL AND id_grupo <> ''
  GROUP BY id_grupo
) t
GROUP BY estado_grupo
ORDER BY estado_grupo;

-- 1.2 Detalle de los grupos MIXTOS (los que el script va a arreglar)
-- ----------------------------------------
-- Muestra los slots de los grupos donde hay mezcla de compartido=0 y compartido=1.
SELECT
  e.id_grupo,
  e.id,
  e.nombre,
  e.nombre_salon,
  DATE_FORMAT(e.fecha_evento, '%Y-%m-%d') AS fecha,
  e.hora_inicio,
  e.hora_fin,
  e.pax,
  e.pax_compartido,
  CASE WHEN e.pax_compartido = 1 THEN 'COMPARTIDO' ELSE 'no compartido' END AS tipo_actual
FROM eventos e
WHERE e.id_grupo IN (
  SELECT id_grupo
  FROM eventos
  WHERE id_grupo IS NOT NULL AND id_grupo <> ''
  GROUP BY id_grupo
  HAVING COUNT(*) > 1
     AND MIN(pax_compartido) = 0
     AND MAX(pax_compartido) = 1
)
ORDER BY e.id_grupo, e.fecha_evento, e.hora_inicio;

-- 1.3 Detalle de los grupos donde TODOS los slots están en 0 (decisión manual)
-- ----------------------------------------
SELECT
  e.id_grupo,
  e.id,
  e.nombre,
  e.nombre_salon,
  DATE_FORMAT(e.fecha_evento, '%Y-%m-%d') AS fecha,
  e.hora_inicio,
  e.hora_fin,
  e.pax,
  e.pax_compartido
FROM eventos e
WHERE e.id_grupo IN (
  SELECT id_grupo
  FROM eventos
  WHERE id_grupo IS NOT NULL AND id_grupo <> ''
  GROUP BY id_grupo
  HAVING COUNT(*) > 1
     AND MAX(pax_compartido) = 0
)
ORDER BY e.id_grupo, e.fecha_evento, e.hora_inicio
LIMIT 200;

-- 1.4 ¿Cuántas filas se van a actualizar con el BLOQUE 2?
-- ----------------------------------------
SELECT COUNT(*) AS filas_a_actualizar
FROM eventos
WHERE id_grupo IN (
  SELECT id_grupo
  FROM eventos
  WHERE id_grupo IS NOT NULL AND id_grupo <> ''
  GROUP BY id_grupo
  HAVING COUNT(*) > 1
     AND MIN(pax_compartido) = 0
     AND MAX(pax_compartido) = 1
)
  AND pax_compartido = 0;


-- ============================================================
-- BLOQUE 2: APLICAR EL FIX
-- ============================================================
-- ⚠️  Solo correr después de revisar el BLOQUE 1.
-- ⚠️  Esta query cambia pax_compartido de 0 a 1 en los slots
--     que están dentro de un grupo mixto (donde AL MENOS UN slot
--     ya tenía pax_compartido=1).
-- ============================================================

START TRANSACTION;

UPDATE eventos
SET pax_compartido = 1
WHERE id_grupo IN (
  SELECT id_grupo
  FROM eventos
  WHERE id_grupo IS NOT NULL AND id_grupo <> ''
  GROUP BY id_grupo
  HAVING COUNT(*) > 1
     AND MIN(pax_compartido) = 0
     AND MAX(pax_compartido) = 1
)
  AND pax_compartido = 0;

-- Cuando todo se vea bien, descomenta esta línea:
-- COMMIT;

-- Si algo salió mal, descomenta esta otra en su lugar:
-- ROLLBACK;


-- ============================================================
-- BLOQUE 3: VERIFICACIÓN POST-FIX
-- ============================================================

-- 3.1 Re-correr el resumen para confirmar que ya no hay grupos mixtos
SELECT
  CASE
    WHEN total_slots = 1 THEN '1 slot (no aplica)'
    WHEN todos_compartido = 1 THEN 'Multi-slot, todos compartido=1 ✅'
    WHEN todos_no_compartido = 1 THEN 'Multi-slot, todos compartido=0 ⚠️'
    ELSE 'Multi-slot, MIXTO (algunos 1 y otros 0) 🔧'
  END AS estado_grupo,
  COUNT(*) AS cantidad_grupos
FROM (
  SELECT
    id_grupo,
    COUNT(*) AS total_slots,
    MIN(pax_compartido) AS min_pc,
    MAX(pax_compartido) AS max_pc,
    CASE WHEN MIN(pax_compartido) = 1 THEN 1 ELSE 0 END AS todos_compartido,
    CASE WHEN MAX(pax_compartido) = 0 THEN 1 ELSE 0 END AS todos_no_compartido
  FROM eventos
  WHERE id_grupo IS NOT NULL AND id_grupo <> ''
  GROUP BY id_grupo
) t
GROUP BY estado_grupo
ORDER BY estado_grupo;

-- 3.2 Confirmar que los grupos que eran mixtos ya están consistentes
SELECT
  e.id_grupo,
  COUNT(*) AS slots,
  MIN(e.pax_compartido) AS min_pc,
  MAX(e.pax_compartido) AS max_pc,
  MAX(e.nombre) AS nombre_evento
FROM eventos e
WHERE e.id_grupo IN (
  -- mismos grupos que el BLOQUE 2 tocó
  SELECT DISTINCT id_grupo
  FROM eventos
  WHERE id_grupo IN (
    SELECT id_grupo
    FROM eventos
    WHERE id_grupo IS NOT NULL AND id_grupo <> ''
    GROUP BY id_grupo
    HAVING COUNT(*) > 1
       AND MAX(pax_compartido) = 1
  )
  GROUP BY id_grupo
  HAVING COUNT(*) > 1
)
GROUP BY e.id_grupo
ORDER BY e.id_grupo
LIMIT 50;

-- 3.3 Verificar el evento del INACOP (cambia 2026-07-01 por la fecha que quieras)
SELECT
  e.id_grupo,
  e.id,
  e.nombre,
  e.nombre_salon,
  DATE_FORMAT(e.fecha_evento, '%Y-%m-%d') AS fecha,
  e.hora_inicio,
  e.hora_fin,
  e.pax,
  e.pax_compartido
FROM eventos e
WHERE e.nombre LIKE '%INACOP%'
  AND e.fecha_evento BETWEEN '2026-06-25' AND '2026-07-10'
ORDER BY e.fecha_evento, e.hora_inicio;


-- ============================================================
-- BLOQUE 4: ATAJAR LOS GRUPOS "TODOS EN 0" (caso INACOP)
-- ============================================================
-- Como el BLOQUE 2 no agarró nada (no hay grupos mixtos), vamos
-- por los grupos donde TODOS los slots están en 0. Usamos
-- heurísticas razonables para sugerir "esto parece compartido".
--
-- Heurística A (la más segura): todos los slots del grupo tienen
--   exactamente el mismo pax → casi seguro compartido.
-- Heurística B: el grupo tiene 2+ slots y fue creado hace tiempo
--   (antes de que se forzara a elegir el tipo en el form) Y todos
--   los slots son del mismo salón → probablemente compartido.
--
-- Si ninguna heurística te convence para un caso particular,
-- abrilo en el form y re-guardalo.
-- ============================================================

-- 4.1 ¿Cuántos grupos "todos en 0" hay?
-- ----------------------------------------
SELECT COUNT(*) AS grupos_todos_en_cero
FROM (
  SELECT id_grupo
  FROM eventos
  WHERE id_grupo IS NOT NULL AND id_grupo <> ''
  GROUP BY id_grupo
  HAVING COUNT(*) > 1
     AND MAX(pax_compartido) = 0
) t;

-- 4.2 Heurística A: mismo pax en todos los slots del grupo
-- ----------------------------------------
-- Listado de los grupos candidatos a compartido (mismo pax).
SELECT
  e.id_grupo,
  e.id,
  e.nombre,
  e.nombre_salon,
  DATE_FORMAT(e.fecha_evento, '%Y-%m-%d') AS fecha,
  e.hora_inicio,
  e.hora_fin,
  e.pax,
  e.pax_compartido
FROM eventos e
WHERE e.id_grupo IN (
  SELECT id_grupo
  FROM eventos
  WHERE id_grupo IS NOT NULL AND id_grupo <> ''
  GROUP BY id_grupo
  HAVING COUNT(*) > 1
     AND MAX(pax_compartido) = 0
     AND COUNT(DISTINCT pax) = 1
     AND MAX(pax) > 0
)
ORDER BY e.id_grupo, e.fecha_evento, e.hora_inicio
LIMIT 500;

-- 4.3 Heurística B: mismo salón en todos los slots
-- ----------------------------------------
SELECT
  e.id_grupo,
  e.id,
  e.nombre,
  e.nombre_salon,
  DATE_FORMAT(e.fecha_evento, '%Y-%m-%d') AS fecha,
  e.hora_inicio,
  e.hora_fin,
  e.pax,
  e.pax_compartido
FROM eventos e
WHERE e.id_grupo IN (
  SELECT id_grupo
  FROM eventos
  WHERE id_grupo IS NOT NULL AND id_grupo <> ''
  GROUP BY id_grupo
  HAVING COUNT(*) > 1
     AND MAX(pax_compartido) = 0
     AND COUNT(DISTINCT nombre_salon) = 1
)
ORDER BY e.id_grupo, e.fecha_evento, e.hora_inicio
LIMIT 500;

-- 4.4 ¿Cuántas filas arreglaría cada heurística?
-- ----------------------------------------
SELECT 'A: mismo pax' AS heuristica, COUNT(*) AS filas_a_actualizar
FROM eventos
WHERE id_grupo IN (
  SELECT id_grupo
  FROM eventos
  WHERE id_grupo IS NOT NULL AND id_grupo <> ''
  GROUP BY id_grupo
  HAVING COUNT(*) > 1
     AND MAX(pax_compartido) = 0
     AND COUNT(DISTINCT pax) = 1
     AND MAX(pax) > 0
)
  AND pax_compartido = 0
UNION ALL
SELECT 'B: mismo salon' AS heuristica, COUNT(*) AS filas_a_actualizar
FROM eventos
WHERE id_grupo IN (
  SELECT id_grupo
  FROM eventos
  WHERE id_grupo IS NOT NULL AND id_grupo <> ''
  GROUP BY id_grupo
  HAVING COUNT(*) > 1
     AND MAX(pax_compartido) = 0
     AND COUNT(DISTINCT nombre_salon) = 1
)
  AND pax_compartido = 0;

-- 4.5 UPDATE: aplica la Heurística A (mismo pax) — la más segura
-- ----------------------------------------
START TRANSACTION;

UPDATE eventos
SET pax_compartido = 1
WHERE id_grupo IN (
  SELECT id_grupo
  FROM eventos
  WHERE id_grupo IS NOT NULL AND id_grupo <> ''
  GROUP BY id_grupo
  HAVING COUNT(*) > 1
     AND MAX(pax_compartido) = 0
     AND COUNT(DISTINCT pax) = 1
     AND MAX(pax) > 0
)
  AND pax_compartido = 0;

-- Cuando todo se vea bien, descomenta esta línea:
-- COMMIT;

-- Si algo salió mal, descomenta esta otra en su lugar:
-- ROLLBACK;

-- 4.6 UPDATE opcional: aplica la Heurística B (mismo salón)
-- ----------------------------------------
-- ⚠️  Solo correr si querés también arreglar el caso "mismo salón
--     pero pax diferente". Esta es más arriesgada.
-- ⚠️  Mejor revisá primero el listado de 4.3.
-- ----------------------------------------
-- START TRANSACTION;
--
-- UPDATE eventos
-- SET pax_compartido = 1
-- WHERE id_grupo IN (
--   SELECT id_grupo
--   FROM eventos
--   WHERE id_grupo IS NOT NULL AND id_grupo <> ''
--   GROUP BY id_grupo
--   HAVING COUNT(*) > 1
--      AND MAX(pax_compartido) = 0
--      AND COUNT(DISTINCT nombre_salon) = 1
-- )
--   AND pax_compartido = 0;
--
-- -- COMMIT;  -- o ROLLBACK; si algo no te cuadra

-- 4.7 Fix manual para grupos específicos (caso INACOP y otros)
-- ============================================================
-- Útil para grupos que las heurísticas A y B no agarraron
-- (pax distintos Y salones distintos), como el INACOP.
--
-- INSTRUCCIONES:
--   1. Corré 4.7.1 para sacar el id_grupo del INACOP.
--   2. Reemplazá 'PEGAR_ID_GRUPO_AQUI' en 4.7.2 por ese id_grupo
--      (mantenelo entre comillas).
--   3. Si tenés otros id_grupo que querés arreglar, agregalos a la
--      lista separados por coma, también entre comillas.
--   4. Descomentá todo el bloque 4.7.2 (sacar los -- ) y ejecutá.
--   5. Si los "Rows matched" te parecen bien, descomentá COMMIT.
-- ============================================================

-- 4.7.1 Sacar el id_grupo del INACOP
SELECT id_grupo, id, nombre, pax, pax_compartido, nombre_salon
FROM eventos
WHERE nombre LIKE '%INACOP%'
  AND fecha_evento BETWEEN '2026-06-25' AND '2026-07-10'
ORDER BY fecha_evento, hora_inicio;

-- 4.7.2 UPDATE manual — DECOMENTAR TODO ESTE BLOQUE y reemplazar
--       'PEGAR_ID_GRUPO_AQUI' por el id_grupo real.
-- ----------------------------------------
-- START TRANSACTION;
--
-- UPDATE eventos
-- SET pax_compartido = 1
-- WHERE id_grupo IN (
--   'PEGAR_ID_GRUPO_AQUI'
-- )
--   AND pax_compartido = 0;
--
-- -- COMMIT;   <- descomentar para aplicar
-- -- ROLLBACK; <- descomentar para deshacer

