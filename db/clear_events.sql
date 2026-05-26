USE crm_jdl;

-- Desactivamos la revisión de llaves foráneas temporalmente para poder truncar
SET FOREIGN_KEY_CHECKS = 0;

-- Vaciamos todas las tablas relacionadas con eventos (reservas, cotizaciones, recordatorios, etc.)
TRUNCATE TABLE eventos;
TRUNCATE TABLE cotizaciones_evento;
TRUNCATE TABLE items_cotizacion_evento;
TRUNCATE TABLE historial_evento;
TRUNCATE TABLE recordatorios_evento;
TRUNCATE TABLE anticipos_evento;

-- Reactivamos la revisión de llaves foráneas
SET FOREIGN_KEY_CHECKS = 1;

SELECT 'Base de datos limpia de eventos. Usuarios, servicios y empresas se mantuvieron intactos.' AS Estado;
