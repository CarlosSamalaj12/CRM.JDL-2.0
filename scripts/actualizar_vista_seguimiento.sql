-- Actualizar vista tbl_seguimientocotizaciones para evitar duplicados
DROP VIEW IF EXISTS tbl_seguimientocotizaciones;

CREATE VIEW tbl_seguimientocotizaciones AS
SELECT
  e.id AS Idocupacion,
  e.nombre AS Institucion,
  e.pax AS Pax,
  CASE
    WHEN e.estado = 'Confirmado' THEN 4
    WHEN e.estado = 'Pre reserva' OR e.estado = 'Pre-reserva' THEN 7
    WHEN e.estado = 'Mantenimiento' OR e.estado = 'Mantenimiento Realizado' THEN 8
    ELSE 1
  END AS Estatuscotizacion,
  COALESCE(u.nombre, e.id_usuario) AS Vendedor,
  e.fecha_evento AS FechaEvento,
  e.fecha_fin_reserva AS FechaSalida,
  e.hora_inicio AS HoraI,
  e.hora_fin AS HoraF,
  COALESCE(c.tipo_evento, 'Evento') AS TipoEvento,
  c.telefono AS Telefono,
  e.nombre_salon AS Salon,
  c.nombre_encargado AS EncargadoEvento,
  c.codigo AS NoDoc
FROM eventos e
LEFT JOIN (
  SELECT id_evento, tipo_evento, telefono, nombre_encargado, codigo
  FROM cotizaciones_evento
  GROUP BY id_evento
) c ON e.id = c.id_evento
LEFT JOIN usuarios u ON e.id_usuario = u.id;
