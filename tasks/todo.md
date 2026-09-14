# Checklist de ejecución — normalización de BD

Este checklist comienza después de la aprobación del plan. Ningún punto está autorizado todavía.

## Seguridad y línea base

- [ ] Bloquear migraciones automáticas de arranque salvo opt-in explícito.
- [ ] Generar backup lógico y snapshot/backup físico de la copia local.
- [ ] Restaurar ambos en una BD desechable y comprobar la aplicación.
- [ ] Guardar versión, esquema, conteos, tamaños, sumas monetarias y hashes de línea base.
- [ ] Crear el verificador read-only de invariantes y huérfanos.

## Infraestructura de migración

- [ ] Crear migraciones versionadas con checksum y estados reanudables.
- [ ] Crear banderas `legacy/dual/shadow_read/normalized` por dominio.
- [ ] Crear registro de diferencias/excepciones sin datos personales.
- [ ] Probar ejecución doble, fallo intermedio, reanudación y rollback lógico.

## Prioridad 0: versiones de cotización

- [ ] Agregar tabla V2 con unicidad real por versión/fila.
- [ ] Corregir todos los escritores que hoy generan duplicados.
- [ ] Backfill por lotes desde snapshot de versión.
- [ ] Conciliar 416 versiones distintas y 12 grupos con payload conflictivo.
- [ ] Probar que guardados repetidos no aumentan filas.

## Piloto: servicios y salones

- [ ] Verificar nuevamente igualdad de los 158 servicios.
- [ ] Hacer relacional la configuración de los 40 salones.
- [ ] Activar doble escritura y lectura sombra.
- [ ] Cambiar lectura manteniendo fallback JSON.

## Posibles ventas y reacciones

- [ ] Migrar relación posible venta–salón.
- [ ] Definir catálogo/mapeo de las 8 etiquetas de servicio.
- [ ] Migrar relación posible venta–tipo de servicio.
- [ ] Migrar reacciones de notas y comentarios.
- [ ] Probar concurrencia de altas/bajas de reacción.

## Checklists

- [ ] Reemplazar la migración automática insegura.
- [ ] Crear DDL normalizado completo y versionado.
- [ ] Corregir el alcance del mapa de IDs.
- [ ] Backfill sin vaciar las claves KV.
- [ ] Comparar snapshot reconstruido y enlaces públicos.

## Cotizaciones

- [ ] Definir reglas de precedencia por campo y caso.
- [ ] Construir reporte de conciliación de las tres representaciones.
- [ ] Normalizar colecciones faltantes en tablas hijas.
- [ ] Ejecutar doble escritura y lectura sombra.
- [ ] Cambiar lectores gradualmente y probar rollback por bandera.

## Consistencia final

- [ ] Normalizar metas, tiers, templates y habitaciones.
- [ ] Resolver o formalizar todas las referencias históricas huérfanas.
- [ ] Agregar FK/índices únicamente con validadores en cero.
- [ ] Ensayar todo con un dump de producción actualizado y más grande.
- [ ] Preparar runbook de producción, observación y rollback.
- [ ] Retirar legado/JSON en una entrega posterior y separada.
