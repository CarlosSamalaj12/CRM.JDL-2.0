-- ============================================================
-- Migración: Tablas de Informes Eventos para CRM.JDL
-- Crea todas las tablas necesarias por el backend de Informes
-- en la base de datos crm_jdl
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;
USE crm_jdl;

-- ============================================================
-- 1. CATÁLOGO DE INGREDIENTES
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_ingredientes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(200) NOT NULL,
  tipo VARCHAR(100) NOT NULL DEFAULT '',
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cat_ingredientes_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 2. OPCIONES DE INGREDIENTES (preparaciones)
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_opciones_ingrediente (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ingrediente_id BIGINT UNSIGNED NOT NULL,
  nombre_opcion VARCHAR(200) NOT NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_opciones_ingrediente (ingrediente_id),
  CONSTRAINT fk_opciones_ingrediente
    FOREIGN KEY (ingrediente_id) REFERENCES cat_ingredientes(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 3. CATEGORÍAS DE ALIMENTO
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_categorias_alimento (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(200) NOT NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cat_categorias_alimento_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4. MENÚS
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_menus (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre_menu VARCHAR(200) NOT NULL,
  descripcion TEXT NULL,
  categoria_id BIGINT UNSIGNED NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_cat_menus_categoria (categoria_id),
  CONSTRAINT fk_cat_menus_categoria
    FOREIGN KEY (categoria_id) REFERENCES cat_categorias_alimento(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 5. ITEMS DEL MENÚ (ingredientes dentro de un menú)
-- ============================================================
CREATE TABLE IF NOT EXISTS menu_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  menu_id BIGINT UNSIGNED NOT NULL,
  ingrediente_id BIGINT UNSIGNED NOT NULL,
  opcion_id BIGINT UNSIGNED NULL,
  cantidad DECIMAL(10,2) NOT NULL DEFAULT 1,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_menu_items_menu (menu_id),
  KEY idx_menu_items_ingrediente (ingrediente_id),
  KEY idx_menu_items_opcion (opcion_id),
  CONSTRAINT fk_menu_items_menu
    FOREIGN KEY (menu_id) REFERENCES cat_menus(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_menu_items_ingrediente
    FOREIGN KEY (ingrediente_id) REFERENCES cat_ingredientes(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_menu_items_opcion
    FOREIGN KEY (opcion_id) REFERENCES cat_opciones_ingrediente(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 6. PLATILLOS (combos)
-- ============================================================
CREATE TABLE IF NOT EXISTS cat_platillos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre_platillo VARCHAR(200) NOT NULL,
  descripcion TEXT NULL,
  precio_base DECIMAL(12,2) NOT NULL DEFAULT 0,
  categoria_id BIGINT UNSIGNED NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_cat_platillos_categoria (categoria_id),
  CONSTRAINT fk_cat_platillos_categoria
    FOREIGN KEY (categoria_id) REFERENCES cat_categorias_alimento(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 7. COMPONENTES DEL PLATILLO
-- ============================================================
CREATE TABLE IF NOT EXISTS platillo_componentes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  platillo_id BIGINT UNSIGNED NOT NULL,
  ingrediente_id BIGINT UNSIGNED NOT NULL,
  opcion_id BIGINT UNSIGNED NULL,
  tipo_componente VARCHAR(50) NOT NULL DEFAULT 'base',
  cantidad DECIMAL(10,2) NOT NULL DEFAULT 1,
  orden INT NOT NULL DEFAULT 0,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_platillo_componentes_platillo (platillo_id),
  KEY idx_platillo_componentes_ingrediente (ingrediente_id),
  KEY idx_platillo_componentes_opcion (opcion_id),
  CONSTRAINT fk_platillo_componentes_platillo
    FOREIGN KEY (platillo_id) REFERENCES cat_platillos(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_platillo_componentes_ingrediente
    FOREIGN KEY (ingrediente_id) REFERENCES cat_ingredientes(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_platillo_componentes_opcion
    FOREIGN KEY (opcion_id) REFERENCES cat_opciones_ingrediente(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 8. INFORMES DE EVENTOS (encabezados)
-- ============================================================
CREATE TABLE IF NOT EXISTS informes_eventos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_ocupacion VARCHAR(120) NOT NULL,
  version INT NOT NULL DEFAULT 1,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_informes_eventos_ocupacion_version (id_ocupacion, version),
  KEY idx_informes_eventos_ocupacion (id_ocupacion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 9. DÍAS DEL INFORME
-- ============================================================
CREATE TABLE IF NOT EXISTS informe_dias_detalle (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  informe_id BIGINT UNSIGNED NOT NULL,
  fecha_evento DATE NOT NULL,
  menu_id BIGINT UNSIGNED NULL,
  descripcion_montaje TEXT NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_informe_dias_informe (informe_id),
  KEY idx_informe_dias_menu (menu_id),
  CONSTRAINT fk_informe_dias_informe
    FOREIGN KEY (informe_id) REFERENCES informes_eventos(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_informe_dias_menu
    FOREIGN KEY (menu_id) REFERENCES cat_menus(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 10. DETALLE DEL MENÚ POR DÍA (personalización)
-- ============================================================
CREATE TABLE IF NOT EXISTS informe_dia_menu_detalle (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  dia_id BIGINT UNSIGNED NOT NULL,
  menu_item_id BIGINT UNSIGNED NULL,
  ingrediente_id BIGINT UNSIGNED NOT NULL,
  opcion_id BIGINT UNSIGNED NULL,
  metodo_preparacion VARCHAR(200) NULL,
  cantidad_total DECIMAL(10,2) NOT NULL DEFAULT 0,
  notas TEXT NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_informe_dia_menu_detalle_dia (dia_id),
  KEY idx_informe_dia_menu_detalle_ingrediente (ingrediente_id),
  KEY idx_informe_dia_menu_detalle_opcion (opcion_id),
  CONSTRAINT fk_informe_dia_menu_detalle_dia
    FOREIGN KEY (dia_id) REFERENCES informe_dias_detalle(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_informe_dia_menu_detalle_ingrediente
    FOREIGN KEY (ingrediente_id) REFERENCES cat_ingredientes(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_informe_dia_menu_detalle_opcion
    FOREIGN KEY (opcion_id) REFERENCES cat_opciones_ingrediente(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 11. COMENTARIOS EN INFORMES
-- ============================================================
CREATE TABLE IF NOT EXISTS informe_comentarios (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  informe_id BIGINT UNSIGNED NOT NULL,
  dia_id BIGINT UNSIGNED NULL,
  usuario_id VARCHAR(80) NULL,
  contenido TEXT NOT NULL,
  mencion_a_id VARCHAR(80) NULL,
  reacciones JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_informe_comentarios_informe (informe_id),
  KEY idx_informe_comentarios_usuario (usuario_id),
  KEY idx_informe_comentarios_dia (dia_id),
  CONSTRAINT fk_informe_comentarios_informe
    FOREIGN KEY (informe_id) REFERENCES informes_eventos(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_informe_comentarios_dia
    FOREIGN KEY (dia_id) REFERENCES informe_dias_detalle(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 12. LECTURAS DE INFORMES
-- ============================================================
CREATE TABLE IF NOT EXISTS informe_lecturas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  informe_id BIGINT UNSIGNED NOT NULL,
  usuario_id VARCHAR(80) NOT NULL,
  leido_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_informe_lectura (informe_id, usuario_id),
  KEY idx_informe_lecturas_usuario (usuario_id),
  CONSTRAINT fk_informe_lecturas_informe
    FOREIGN KEY (informe_id) REFERENCES informes_eventos(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 13. DESTACADOS DE INFORMES
-- ============================================================
CREATE TABLE IF NOT EXISTS informe_destacados (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  informe_id BIGINT UNSIGNED NOT NULL,
  dia_id BIGINT UNSIGNED NULL,
  usuario_id VARCHAR(80) NOT NULL,
  razon TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_informe_destacados_informe (informe_id),
  KEY idx_informe_destacados_usuario (usuario_id),
  CONSTRAINT fk_informe_destacados_informe
    FOREIGN KEY (informe_id) REFERENCES informes_eventos(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 14. HISTORIAL DE INFORMES
-- ============================================================
CREATE TABLE IF NOT EXISTS informe_historial (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  informe_id BIGINT UNSIGNED NOT NULL,
  usuario_id VARCHAR(80) NULL,
  accion VARCHAR(100) NOT NULL,
  descripcion TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_informe_historial_informe (informe_id),
  KEY idx_informe_historial_usuario (usuario_id),
  CONSTRAINT fk_informe_historial_informe
    FOREIGN KEY (informe_id) REFERENCES informes_eventos(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 15. IMÁGENES DE INFORMES
-- ============================================================
CREATE TABLE IF NOT EXISTS informe_imagenes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  informe_id BIGINT UNSIGNED NOT NULL,
  dia_id BIGINT UNSIGNED NULL,
  url VARCHAR(500) NOT NULL,
  descripcion TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_informe_imagenes_informe (informe_id),
  KEY idx_informe_imagenes_dia (dia_id),
  CONSTRAINT fk_informe_imagenes_informe
    FOREIGN KEY (informe_id) REFERENCES informes_eventos(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_informe_imagenes_dia
    FOREIGN KEY (dia_id) REFERENCES informe_dias_detalle(id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 16. NOTIFICACIONES
-- ============================================================
CREATE TABLE IF NOT EXISTS notificaciones (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id VARCHAR(80) NULL,
  tipo VARCHAR(50) NOT NULL DEFAULT 'info',
  titulo VARCHAR(200) NOT NULL,
  mensaje TEXT NULL,
  informe_id BIGINT UNSIGNED NULL,
  idocupacion VARCHAR(120) NULL,
  leido TINYINT(1) NOT NULL DEFAULT 0,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notificaciones_usuario (usuario_id),
  KEY idx_notificaciones_leido (usuario_id, leido),
  KEY idx_notificaciones_informe (informe_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 17. METADATOS DE EVENTOS
-- ============================================================
CREATE TABLE IF NOT EXISTS evento_metadatos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_ocupacion VARCHAR(120) NOT NULL,
  desayunos INT NOT NULL DEFAULT 0,
  habitaciones INT NOT NULL DEFAULT 0,
  tiene_alertas TINYINT(1) NOT NULL DEFAULT 0,
  alertas_text TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_evento_metadatos_ocupacion (id_ocupacion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 18. NOTAS DE KANBAN (event_notas)
-- ============================================================
CREATE TABLE IF NOT EXISTS event_notas (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  idocupacion VARCHAR(120) NOT NULL,
  usuario_id VARCHAR(80) NULL,
  contenido TEXT NOT NULL,
  mencion_a_id VARCHAR(80) NULL,
  reacciones JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_event_notas_ocupacion (idocupacion),
  KEY idx_event_notas_usuario (usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 19. CONFIG: EQUIPOS
-- ============================================================
CREATE TABLE IF NOT EXISTS config_equipo (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(200) NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_config_equipo_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 20. CONFIG: TIPOS DE SILLA
-- ============================================================
CREATE TABLE IF NOT EXISTS config_tipo_silla (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(200) NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_config_tipo_silla_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 21. CONFIG: TIPOS DE MESA
-- ============================================================
CREATE TABLE IF NOT EXISTS config_tipo_mesa (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(200) NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_config_tipo_mesa_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 22. VISTA: tbl_seguimientocotizaciones
-- Mapea la tabla eventos del CRM al formato legacy que esperan
-- los controllers de Informes Eventos
-- ============================================================
CREATE OR REPLACE VIEW tbl_seguimientocotizaciones AS
SELECT
  e.id AS Idocupacion,
  e.nombre AS Institucion,
  e.pax AS Pax,
  CASE e.estado
    WHEN 'Confirmado' THEN '4'
    WHEN 'Pre reserva' THEN '7'
    ELSE '0'
  END AS Estatuscotizacion,
  u.nombre AS Vendedor,
  e.fecha_evento AS FechaEvento,
  e.fecha_fin_reserva AS FechaSalida,
  e.hora_inicio AS HoraI,
  e.hora_fin AS HoraF,
  COALESCE(c.tipo_evento, 'Social') AS TipoEvento,
  COALESCE(c.telefono, '') AS Telefono,
  e.nombre_salon AS Salon,
  '' AS NoDoc,
  COALESCE(m.nombre, '') AS EncargadoEvento
FROM eventos e
LEFT JOIN usuarios u ON e.id_usuario = u.id
LEFT JOIN cotizaciones_evento c ON e.id = c.id_evento
LEFT JOIN encargados_empresa m ON c.id_encargado = m.id;

SET FOREIGN_KEY_CHECKS = 1;
