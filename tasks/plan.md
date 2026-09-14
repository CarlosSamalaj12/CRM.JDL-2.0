# Plan de normalización progresiva de CRM JDL

Fecha del diagnóstico: 2026-09-14  
Estado: propuesta para aprobación; no se han ejecutado migraciones ni escrituras sobre la BD.

## Objetivo y restricciones

Normalizar gradualmente la base local, que es una copia con datos reales de producción, sin perder información ni romper el contrato actual de la aplicación. La futura puesta en producción debe aceptar que allí existirán más filas y debe hacerse con una transición no perceptible para los usuarios.

Restricciones acordadas:

- Trabajar localmente; no hacer commit, push ni cambios en GitHub.
- No modificar ni limpiar datos antes de tener respaldo restaurable, conciliación y pruebas.
- Mantener la estructura antigua disponible durante la convivencia.
- Hacer primero cambios aditivos; retirar columnas/tablas JSON únicamente en una migración posterior y separada.
- Toda migración de datos debe ser idempotente, reanudable por lotes y comprobable mediante conteos y hashes.
- No usar `FOREIGN_KEY_CHECKS=0` para ocultar inconsistencias.

## Línea base observada

- Motor local: MariaDB 12.2.2; tamaño aproximado de la BD: 196 MiB.
- 74 tablas base, 1 vista y 76 claves foráneas.
- El dump de estructura coincide con la BD salvo `tbl_seguimientocotizaciones`, que es una vista.
- Todos los campos JSON examinados contienen JSON sintácticamente válido.
- Los tres contenedores principales de cotizaciones ocupan unos 71.3 MiB de JSON: `eventos.cotizacion_json` (21.4 MiB), `cotizaciones_evento.json_crudo` (27.6 MiB) y `cotizacion_versiones_evento.json_crudo` (22.4 MiB).
- `app_state_kv` solo ocupa unos 201 KiB. Su problema principal no es el tamaño, sino la consulta, concurrencia y duplicación de fuentes de verdad.

### Hallazgos que condicionan el orden

1. `items_cotizacion_version_evento` tiene 182,055 filas. Hay 114,762 repeticiones adicionales de la misma clave lógica `(id_evento, version_num, fila_num)`; 12 grupos repetidos tienen payload distinto. El código ejecuta `ON DUPLICATE KEY UPDATE`, pero no existe un índice `UNIQUE` para esa clave, por lo que inserta de nuevo.
2. La representación JSON y la relacional de cotizaciones no son intercambiables todavía:
   - 950 de 1,694 cotizaciones difieren en cantidad de ítems.
   - 416 de 4,975 versiones aún difieren incluso comparando filas lógicas únicas.
   - De 941 cotizaciones con JSON tanto en `eventos` como en `cotizaciones_evento`, solo 332 son equivalentes de forma canónica y 609 difieren.
3. Hay referencias históricas huérfanas; no se deben agregar nuevas FK estrictas antes de conciliarlas:
   - 426 cotizaciones sin evento exacto; 1 empresa y 903 encargados referenciados no existen; 76 encargados no pertenecen a la empresa indicada.
   - 1,312 versiones no tienen un evento exacto.
   - 13 eventos usan un nombre de salón que no coincide con el catálogo actual.
4. La migración de checklist pendiente es insegura: el próximo arranque intentaría copiar `eventChecklists` a otra tabla que todavía guarda JSON y después vaciar el valor original. Las tablas realmente normalizadas usadas por `checklistController.js` no existen en la BD ni tienen DDL versionado. Además, el mapa `oldItemIdMap` se declara dentro del bucle de plantillas y se usa fuera de ese alcance.
5. Hay una primera migración de bajo riesgo ya conciliada: los 158 servicios del JSON coinciden, fila por fila, con los 158 servicios relacionales. Las 40 capacidades y banderas de salón también resuelven exactamente contra los 40 nombres de salón.
6. En posibles ventas, los 29 salones guardados como texto coinciden con el catálogo. En cambio, los 58 valores de servicios son 8 etiquetas distintas: 23 coinciden con categorías/subcategorías y 35 no coinciden con el catálogo; necesitan catálogo o mapeo explícito antes de imponer FK.
7. Las reacciones son pequeñas y limpias: 18 referencias de usuario en notas y 3 en comentarios de informes; todas resuelven contra usuarios existentes.

## Arquitectura de transición

Cada dominio seguirá el patrón `expandir -> copiar -> doble escritura -> lectura sombra -> cambiar lectura -> retirar legado`.

- **Expandir:** crear tablas/columnas nuevas sin cambiar respuestas de API.
- **Copiar:** backfill por lotes con cursor persistente; nunca sustituir o borrar la fuente.
- **Doble escritura:** una transacción escribe legado y modelo nuevo. Si falla uno, se revierte todo.
- **Lectura sombra:** la aplicación sigue respondiendo desde el legado, pero compara en segundo plano contra el modelo nuevo y registra solo métricas/identificadores de diferencias.
- **Cambiar lectura:** activar por bandera de dominio, con reversión inmediata al legado.
- **Retirar legado:** solo después de un periodo de observación y en una versión independiente. Primero se deja de escribir; mucho después se archiva o elimina.

## Fase 0 — Congelar riesgos y asegurar recuperación

1. Desactivar temporalmente las migraciones automáticas al iniciar el backend y exigir una variable explícita como `DB_RUN_MIGRATIONS=true`.
2. Sacar respaldo lógico y físico/snapshot de la copia local, junto con versión de MariaDB, tamaño, conteos por tabla y checksum del dump.
3. Restaurar ese respaldo en una tercera BD desechable y ejecutar pruebas de lectura de la aplicación. Un backup sin restauración probada no cuenta como respaldo válido.
4. Crear un reporte de integridad reproducible que solo emita conteos, hashes y claves técnicas, nunca datos personales.
5. Congelar la lista de invariantes funcionales: número de eventos, cotizaciones/versiones/ítems, totales monetarios, anticipos, checklists, posibles ventas y reacciones.

**Aceptación:** restauración completa exitosa; conteos y sumas coinciden; arrancar el backend no cambia el esquema ni los datos sin autorización explícita.

## Fase 1 — Sistema de migraciones y observabilidad

1. Sustituir los `ensure*` ad hoc de arranque por archivos SQL/JS versionados, con checksum y orden inmutable.
2. Extender el registro de migraciones con estados `started/completed/failed`, cursor de backfill, conteos origen/destino, diferencias y duración.
3. Añadir banderas independientes por dominio: `legacy`, `dual`, `shadow_read`, `normalized`.
4. Preparar validadores idempotentes y una tabla de excepciones que registre la clave técnica, regla incumplida y hash; no borrar ni corregir automáticamente.
5. Probar cada DDL con el tamaño y carga de la copia. En producción usar `LOCK=NONE`/`NOWAIT` cuando la operación lo permita y abortar, no degradar silenciosamente a un bloqueo largo.

**Aceptación:** ejecutar dos veces no duplica ni altera resultados; un fallo puede reanudarse desde el cursor; volver a `legacy` no requiere restaurar backup.

## Fase 2 — Detener el crecimiento incorrecto de versiones

1. Crear `items_cotizacion_version_evento_v2` con FK hacia la versión y `UNIQUE(version_id, fila_num)` (o equivalente compuesto validado).
2. Corregir todos los escritores para que la clave lógica produzca un upsert real. El código antiguo queda intacto hasta validar el nuevo escritor, pero después se detiene su escritura para no seguir acumulando duplicados.
3. Poblar V2 desde `cotizacion_versiones_evento.json_crudo.items`, porque es el snapshot de la versión; comparar contra las filas relacionales únicas existentes.
4. Enviar las 416 versiones con diferencia y los 12 grupos conflictivos a conciliación; conservar la tabla antigua completa durante todo el proceso.
5. Validar conteos por versión, subtotal, descuentos, total de línea y total neto.

**Aceptación:** una misma cotización guardada varias veces no aumenta el número de filas de su versión; cero diferencias no explicadas; tabla antigua aún disponible para rollback.

## Fase 3 — Piloto de normalización de bajo riesgo

1. Declarar `servicios`, `categorias_servicio` y `subcategorias_servicio` como fuente primaria; mantener lectura fallback desde `app_state_kv` durante la observación.
2. Crear `salon_configuracion(salon_id, capacidad, ocupacion_habilitada, conflicto_habilitado, ...)` y copiar las tres configuraciones basadas en nombres a IDs de salón.
3. Ejecutar doble escritura y lectura sombra; después detener escritura de `services`, `serviceCategories`, `salonCapacities`, `salonOccupancyEnabled` y `salonConflictDisabled` en KV.
4. No borrar todavía esas claves JSON.

**Aceptación:** igualdad 100% en servicios y configuración de salones; las API conservan exactamente el mismo formato y comportamiento.

## Fase 4 — Posibles ventas y reacciones

1. Crear `posible_venta_salones(posible_venta_id, salon_id, orden)`; migrar las 29 relaciones que ya resuelven sin ambigüedad.
2. Crear un catálogo explícito de los 8 tipos/etiquetas usados por posibles ventas y `posible_venta_servicios(posible_venta_id, tipo_servicio_id, orden)`. No enlazarlos a `servicios` hasta definir qué significan las 35 entradas hoy no coincidentes.
3. Crear `event_nota_reacciones(nota_id, usuario_id, reaccion, creado_en)` e `informe_comentario_reacciones(comentario_id, usuario_id, reaccion, creado_en)`, con unicidad por comentario/usuario/reacción.
4. Doble escritura, backfill, lectura sombra y cambio de lectura por separado para cada subdominio.

**Aceptación:** las listas mantienen orden y contenido; las operaciones concurrentes de reacción no pierden actualizaciones; cero referencias de usuario sin resolver.

## Fase 5 — Checklists

1. Cancelar la migración automática actual que vacía el origen.
2. Crear DDL versionado para plantillas, secciones, ítems, checklist por evento, respuestas, historial y enlaces públicos.
3. Corregir el mapeo de IDs para que sea por plantilla; conservar snapshots de texto/sección en respuestas históricas.
4. Backfill de los 4 templates, 50 eventos y 4 enlaces públicos sin tocar `app_state_kv`.
5. Comparar un snapshot reconstruido desde tablas con el JSON original; solo al llegar a igualdad se cambia la lectura.

**Aceptación:** igualdad canónica del snapshot; enlaces públicos vigentes; historial y respuestas preservados; ejecutar la migración dos veces no duplica.

## Fase 6 — Cotizaciones y eventos (la etapa más delicada)

1. Definir formalmente una sola fuente canónica por dato. Hoy la UI principal lee `eventos.cotizacion_json`, mientras reportes consultan tablas relacionales; no se escogerá una fuente por intuición.
2. Crear un reconciliador que compare por cotización y versión: cabecera, contacto/empresa, fechas, ítems, importes, anticipos y templates. Clasificar cada diferencia como equivalente, transformable o requiere decisión.
3. Mantener en tablas columnas consultables y relaciones; mover colecciones a tablas hijas: ítems, versiones, medios/tipos de pago, templates aplicados, entradas y versiones de menú/montaje cuando corresponda.
4. Conservar snapshots JSON inmutables únicamente cuando tengan valor de auditoría. Añadir `CHECK(JSON_VALID(...))` mientras permanezcan.
5. Activar doble escritura y lectura sombra por porcentaje o por usuarios internos; cambiar reportes primero, luego API de detalle y finalmente UI principal.
6. Dejar de escribir `eventos.cotizacion_json` y `json_crudo` solo después de un periodo sin diferencias. La eliminación física queda fuera de esta fase.

**Aceptación:** mismos documentos generados, mismos totales, mismo número y orden de ítems/versiones, cero diferencias no justificadas durante el periodo acordado y rollback por bandera probado.

## Fase 7 — Configuración restante y consistencia referencial

1. Normalizar metas globales y de usuario, tiers de comisión, templates rápidos/de servicios/contrato y tipos de montaje en tablas con orden y vigencia.
2. Convertir `evento_metadatos.habitaciones` mediante una columna aditiva numérica; hoy se usa como escalar, no como colección.
3. Resolver mediante tablas de mapeo o registros archivados las referencias huérfanas. No eliminar cotizaciones/versiones históricas.
4. Agregar FK e índices solo después de que el validador reporte cero huérfanos o excepciones formalmente aceptadas.
5. Unificar longitudes de identificadores y collations en etapas posteriores, nunca junto con el primer cambio de lectura.

**Aceptación:** cero nuevas referencias huérfanas; las excepciones históricas están documentadas; constraints activas sin deshabilitar validación.

## JSON que debe permanecer

Normalizar no significa prohibir JSON. Deben permanecer como JSON los snapshots inmutables de auditoría, payloads externos o estructuras cuyo esquema sea deliberadamente flexible y que no se consulten por atributos. Ejemplo inicial: `historial_posibles_ventas.snapshot_json`. Mientras exista, debe validarse, versionarse su esquema y no ser fuente mutable de verdad.

## Ensayo y despliegue en producción

1. Reimportar un dump de producción más reciente en una BD de ensayo y repetir todas las fases desde cero; nunca copiar tablas normalizadas desde la primera copia local.
2. Ejecutar un dry-run que reporte estimación de filas, espacio adicional y tiempo por lote.
3. Confirmar espacio libre suficiente para tablas sombra, índices, binlogs y rollback.
4. Desplegar primero código compatible con ambos esquemas; después aplicar cambios aditivos; luego iniciar backfill limitado y pausable.
5. Comparar continuamente conteos, checksums por lote, sumas monetarias y tasa de diferencias.
6. Hacer el cambio de lectura con bandera reversible. Ante error, volver a legado; no ejecutar `DOWN` destructivo durante el incidente.
7. Retirar JSON/legado en otra versión, tras respaldo final y periodo de retención acordado.

No se puede prometer literalmente cero milisegundos de bloqueo antes de probar cada DDL con la configuración y carga reales. Sí se puede diseñar para que la transición sea no perceptible: tablas sombra, cambios aditivos, backfill en lotes, DDL online comprobado, `NOWAIT`, banderas y rollback inmediato.

## Fuera de alcance de esta primera entrega

- Ejecutar DDL/DML o corregir datos.
- Arrancar el backend contra la copia real.
- Borrar duplicados, JSON o registros huérfanos.
- Cambiar contratos de API o UI.
- Publicar cambios en GitHub.

