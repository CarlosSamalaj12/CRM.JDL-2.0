USE crm_jdl;

-- 1. Salones
INSERT IGNORE INTO salones (nombre) VALUES 
  ('Gran Salón'),
  ('Salón Jardín'),
  ('Terraza Panorámica'),
  ('Sala Ejecutiva');

-- 2. Categorías de Servicio
INSERT IGNORE INTO categorias_servicio (id, nombre) VALUES 
  (1, 'Alimentos'),
  (2, 'Bebidas'),
  (3, 'Mobiliario y Equipo'),
  (4, 'Personal y Servicios');

-- 3. Servicios
INSERT IGNORE INTO servicios (id, nombre, precio, descripcion, id_categoria, modo_cantidad) VALUES
  ('srv_101', 'Menú 3 Tiempos Premium', 350.00, 'Entrada, plato fuerte y postre. Incluye pan y mantequilla.', 1, 'PAX'),
  ('srv_102', 'Menú 2 Tiempos Ejecutivo', 220.00, 'Plato fuerte y postre.', 1, 'PAX'),
  ('srv_103', 'Coffee Break Básico', 65.00, 'Café, té, agua y galletas.', 1, 'PAX'),
  ('srv_201', 'Descorche por Botella', 150.00, 'Incluye servicio de mezcladores y cristalería.', 2, 'MANUAL'),
  ('srv_202', 'Barra Libre Nacional (4 horas)', 280.00, 'Ron, Vodka, Tequila, Whisky nacional.', 2, 'PAX'),
  ('srv_301', 'Alquiler Silla Tiffany (Extra)', 15.00, 'Silla adicional modelo Tiffany color blanco.', 3, 'MANUAL'),
  ('srv_302', 'Proyector 4K + Pantalla', 850.00, 'Equipo audiovisual para presentaciones.', 3, 'MANUAL'),
  ('srv_303', 'Pista de Baile Iluminada (Modulos)', 400.00, 'Precio por módulo de pista iluminada.', 3, 'MANUAL'),
  ('srv_401', 'Mesero Extra', 350.00, 'Turno de 8 horas.', 4, 'MANUAL'),
  ('srv_402', 'Valet Parking (Por Vehículo)', 45.00, 'Servicio de acomodo de vehículos.', 4, 'MANUAL');

-- 4. Empresas
INSERT IGNORE INTO empresas (id, nombre, encargado_principal, correo, nit, razon_social, tipo_evento, direccion, telefono) VALUES
  ('emp_001', 'Tech Solutions Corp', 'Carlos Méndez', 'contacto@techsolutions.com', '1234567-8', 'Tech Solutions S.A.', 'Corporativo', 'Av. Reforma 1-50, Zona 9, Guatemala', '2233-4455'),
  ('emp_002', 'Universidad San Pablo', 'Lic. Marta Reyes', 'eventos@uspanpablo.edu.gt', '9876543-2', 'Universidad San Pablo', 'Educativo / Graduación', 'Zona 16, Blvd. Rafael Landívar', '2411-2233'),
  ('emp_003', 'Comercializadora El Sol', 'Juan Pérez', 'jperez@elsol.com', '4561237-9', 'El Sol y CIA S.A.', 'Convivio', 'Calzada Aguilar Batres, Zona 11', '2477-8899');

-- 5. Encargados de Empresa
INSERT IGNORE INTO encargados_empresa (id, id_empresa, nombre, telefono, correo, direccion) VALUES
  ('enc_001', 'emp_001', 'Carlos Méndez', '5544-3322', 'cmendez@techsolutions.com', 'Av. Reforma 1-50, Zona 9'),
  ('enc_002', 'emp_001', 'Ana Castillo (Logística)', '5544-1111', 'logistica@techsolutions.com', 'Av. Reforma 1-50, Zona 9'),
  ('enc_003', 'emp_002', 'Lic. Marta Reyes', '5988-7766', 'mreyes@uspanpablo.edu.gt', 'Zona 16'),
  ('enc_004', 'emp_003', 'Juan Pérez', '5011-2030', 'jperez@elsol.com', 'Calzada Aguilar Batres');

-- 6. Menú y Montaje (Datos base de ejemplo)
INSERT IGNORE INTO menu_platos_fuertes (nombre, tipo_plato, es_sin_proteina) VALUES
  ('Medallones de Res al Vino Tinto', 'NORMAL', 0),
  ('Pechuga Cordon Bleu', 'NORMAL', 0),
  ('Lasaña Vegetariana', 'VEGETARIANO', 1);

INSERT IGNORE INTO menu_guarniciones (nombre) VALUES
  ('Puré de Papa Rústico'),
  ('Vegetales al Vapor'),
  ('Arroz Almendrado');

INSERT IGNORE INTO menu_salsas (nombre) VALUES
  ('Salsa de Champiñones'),
  ('Salsa a la Pimienta'),
  ('Jus de Ternera');

INSERT IGNORE INTO menu_postres (nombre) VALUES
  ('Tiramisú Clásico'),
  ('Cheesecake de Frambuesa'),
  ('Flan Napolitano');

INSERT IGNORE INTO montaje_tipos (nombre) VALUES
  ('Montaje Imperial'),
  ('Montaje Escuela'),
  ('Montaje Ruso'),
  ('Auditorio');

INSERT IGNORE INTO montaje_adicionales (nombre, tipo) VALUES
  ('Arreglo Floral Centro', 'DECORACION'),
  ('Mantelería Blanca', 'MANTELERIA'),
  ('Pizarrón Blanco + Marcadores', 'EQUIPO');
