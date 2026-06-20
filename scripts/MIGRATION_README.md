# Migración - Sistema de Tareas por Evento

## Descripción

Este script crea la tabla `tareas_evento` necesaria para el sistema de tareas personales en el Kanban del sistema de informes.

## Archivos

- `migrate_tareas_evento.sql` - Script SQL puro
- `migrate_tareas.js` - Script Node.js interactivo
- `migrate_tareas_quick.js` - Script Node.js con parámetros

## Métodos de Ejecución

### Método 1: Script Node.js Interactivo (Recomendado para desarrollo)

```bash
# Desde la raíz del proyecto
node scripts/migrate_tareas.js
```

El script te guiará con preguntas interactivas.

### Método 2: Script Node.js con Parámetros (Para producción)

```bash
# Con parámetros directos
node scripts/migrate_tareas_quick.js --host=appjardinesdellago.tech --port=3306 --user=root --password=tu_password --database=crm_jdl

# O usando variables de entorno
DB_HOST=appjardinesdellago.tech DB_PORT=3306 DB_USER=root DB_PASSWORD=tu_password DB_NAME=crm_jdl node scripts/migrate_tareas_quick.js
```

### Método 3: Script SQL Puro

```bash
# Usando MySQL CLI
mysql -h appjardinesdellago.tech -u root -p crm_jdl < db/migrate_tareas_evento.sql

# O ejecutando desde MySQL Workbench/phpMyAdmin
# Abre el archivo db/migrate_tareas_evento.sql y ejecútalo
```

## Requisitos

- Node.js 14+ (para scripts Node.js)
- mysql2 package instalado: `npm install mysql2`
- Acceso a la base de datos MySQL/MariaDB
- La tabla `eventos` debe existir (requisito de foreign key)

## Estructura de la Tabla

```sql
tareas_evento
├── id (INT, PRIMARY KEY, AUTO_INCREMENT)
├── id_ocupacion (VARCHAR(30), FOREIGN KEY → eventos.id)
├── usuario_id (VARCHAR(100))
├── usuario_nombre (VARCHAR(255))
├── contenido (TEXT)
├── completada (TINYINT(1), DEFAULT 0)
├── fecha_creacion (DATETIME)
└── fecha_actualizacion (DATETIME)
```

## Verificación

Después de ejecutar la migración, verifica que la tabla se creó correctamente:

```sql
SELECT * FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'crm_jdl' 
  AND TABLE_NAME = 'tareas_evento';
```

## Solución de Problemas

### Error: "La tabla eventos no existe"
Asegúrate de que la base de datos tenga la tabla `eventos` antes de ejecutar la migración.

### Error: "Access denied"
Verifica las credenciales de la base de datos en el archivo `.env` o en los parámetros.

### Error: "ECONNREFUSED"
Verifica que el servidor MySQL esté corriendo y accesible desde tu máquina.

## Notas Importantes

- La tabla usa `ON DELETE CASCADE`, por lo que si se elimina un evento, se eliminarán todas sus tareas asociadas
- Cada usuario solo puede ver SUS propias tareas (filtrado por `usuario_id`)
- La tabla está optimizada con índices para búsquedas rápidas por evento y usuario
