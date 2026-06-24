-- --------------------------------------------------------
-- Host:                         127.0.0.1
-- Server version:               12.2.2-MariaDB - MariaDB Server
-- Server OS:                    Win64
-- HeidiSQL Version:             12.16.0.7229
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;


-- Dumping database structure for crm_jdl
CREATE DATABASE IF NOT EXISTS `crm_jdl` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_uca1400_ai_ci */;
USE `crm_jdl`;

-- Dumping structure for table crm_jdl.anticipos_evento
CREATE TABLE IF NOT EXISTS `anticipos_evento` (
  `id` varchar(30) NOT NULL,
  `id_evento` varchar(30) NOT NULL,
  `fecha_anticipo` date NOT NULL,
  `monto` decimal(12,2) NOT NULL DEFAULT 0.00,
  `tipo_pago` varchar(40) NOT NULL DEFAULT 'Efectivo',
  `descripcion` varchar(255) DEFAULT NULL,
  `creado_en_iso` varchar(50) DEFAULT NULL,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  `actualizado_en` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `numero_boleta` varchar(100) DEFAULT NULL,
  `id_usuario_creador` varchar(100) DEFAULT NULL,
  `nombre_usuario_creador` varchar(255) DEFAULT NULL,
  `nombre_evidencia` varchar(255) DEFAULT NULL,
  `tipo_evidencia` varchar(100) DEFAULT NULL,
  `datos_evidencia` mediumtext DEFAULT NULL,
  `editado_por_id` varchar(100) DEFAULT NULL,
  `editado_por_nombre` varchar(255) DEFAULT NULL,
  `editado_en_iso` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_anticipos_evento` (`id_evento`,`fecha_anticipo`),
  CONSTRAINT `fk_anticipos_evento` FOREIGN KEY (`id_evento`) REFERENCES `eventos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table crm_jdl.anticipos_evento: ~0 rows (approximately)

-- Dumping structure for table crm_jdl.app_state_kv
CREATE TABLE IF NOT EXISTS `app_state_kv` (
  `clave` varchar(120) NOT NULL,
  `valor_json` longtext DEFAULT NULL,
  `actualizado_en` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`clave`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Dumping data for table crm_jdl.app_state_kv: ~18 rows (approximately)
INSERT INTO `app_state_kv` (`clave`, `valor_json`, `actualizado_en`) VALUES
	('checklistTemplateItems', '[]', '2026-05-15 04:10:30'),
	('checklistTemplates', '[]', '2026-06-17 22:06:07'),
	('checklistTemplateSections', '["General"]', '2026-06-17 22:14:40'),
	('disabledCompanies', '[]', '2026-05-15 04:10:30'),
	('disabledManagers', '[]', '2026-05-15 04:10:30'),
	('disabledSalones', '[]', '2026-05-15 04:10:30'),
	('disabledServices', '[]', '2026-05-15 04:10:30'),
	('eventChecklists', '{}', '2026-06-17 21:40:46'),
	('globalMonthlyGoals', '[{"month":"2026-06","amount":1500000,"active":true}]', '2026-06-17 22:21:03'),
	('menuMontajeBebidas', '[]', '2026-05-15 04:10:30'),
	('menuMontajeSections', '["General"]', '2026-06-17 22:14:40'),
	('occupancyWeeklyOps', '{}', '2026-05-15 04:10:30'),
	('quickTemplates', '[]', '2026-06-16 22:17:18'),
	('quoteServiceTemplates', '[]', '2026-05-15 04:10:30'),
	('salonCapacities', '{"ElDeck":30,"Helipuerto JDL":50,"Jardin 1 CF":60,"Jardin 2 CF":100}', '2026-06-17 23:35:46'),
	('salonOccupancyEnabled', '["ElDeck","Helipuerto JDL","Jardin 1 CF","Jardin 2 CF"]', '2026-06-18 00:48:21'),
	('serviceCategories', '[{"id":"cat_1781744339272","name":"Alimentos & Bebidas","subcategories":[{"id":"sub_1781744391927","name":"Desayunos"},{"id":"sub_1781744398893","name":"Almuerzos"}]},{"id":"cat_1781744354206","name":"Hospedaje de Terceros","subcategories":[]},{"id":"cat_1781744363805","name":"Hospedaje JDL","subcategories":[]},{"id":"cat_1781744381004","name":"Misceláneos","subcategories":[]}]', '2026-06-18 00:59:58'),
	('services', '[{"id":"svc_1781759980734","name":"DESAYUNO BUFFET","price":185,"description":"","category":"Alimentos & Bebidas","subcategory":"Desayunos","quantityMode":"MANUAL","active":true}]', '2026-06-18 05:21:04');

-- Dumping structure for table crm_jdl.bitacora_migracion
CREATE TABLE IF NOT EXISTS `bitacora_migracion` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `origen` varchar(80) NOT NULL,
  `detalle` text DEFAULT NULL,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table crm_jdl.bitacora_migracion: ~0 rows (approximately)

-- Dumping structure for table crm_jdl.cat_categorias_alimento
CREATE TABLE IF NOT EXISTS `cat_categorias_alimento` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(150) NOT NULL,
  `fecha_creacion` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table crm_jdl.cat_categorias_alimento: ~4 rows (approximately)
INSERT INTO `cat_categorias_alimento` (`id`, `nombre`, `fecha_creacion`) VALUES
	(1, 'Desayuno', '2026-06-11 12:33:48'),
	(2, 'Refacción', '2026-06-11 12:33:48'),
	(3, 'Almuerzo', '2026-06-11 12:33:48'),
	(4, 'Cena', '2026-06-11 12:33:48');

-- Dumping structure for table crm_jdl.cat_ingredientes
CREATE TABLE IF NOT EXISTS `cat_ingredientes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(150) NOT NULL,
  `tipo` varchar(50) NOT NULL DEFAULT 'otros',
  `fecha_creacion` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=33 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table crm_jdl.cat_ingredientes: ~32 rows (approximately)
INSERT INTO `cat_ingredientes` (`id`, `nombre`, `tipo`, `fecha_creacion`) VALUES
	(1, 'Filete de Res', 'carne', '2026-06-09 17:01:15'),
	(2, 'Pechuga de Pollo', 'carne', '2026-06-09 17:01:15'),
	(3, 'Lomo de Cerdo', 'carne', '2026-06-09 17:01:15'),
	(4, 'Salmón', 'carne', '2026-06-09 17:01:15'),
	(5, 'Arrachera', 'carne', '2026-06-09 17:01:15'),
	(6, 'Costillas BBQ', 'carne', '2026-06-09 17:01:15'),
	(7, 'Arroz Blanco', 'guarnición', '2026-06-09 17:01:15'),
	(8, 'Puré de Papa', 'guarnición', '2026-06-09 17:01:15'),
	(9, 'Verduras Salteadas', 'guarnición', '2026-06-09 17:01:15'),
	(10, 'Ensalada César', 'guarnición', '2026-06-09 17:01:15'),
	(11, 'Papas a la Francesa', 'guarnición', '2026-06-09 17:01:15'),
	(12, 'Vegetales Asados', 'guarnición', '2026-06-09 17:01:15'),
	(13, 'Frijoles Charros', 'guarnición', '2026-06-09 17:01:15'),
	(14, 'Salsa Chimichurri', 'salsa', '2026-06-09 17:01:15'),
	(15, 'Salsa de Hongos', 'salsa', '2026-06-09 17:01:15'),
	(16, 'Salsa BBQ', 'salsa', '2026-06-09 17:01:15'),
	(17, 'Salsa Verde', 'salsa', '2026-06-09 17:01:15'),
	(18, 'Salsa de Mango Habanero', 'salsa', '2026-06-09 17:01:15'),
	(19, 'Pastel de Tres Leches', 'postre', '2026-06-09 17:01:15'),
	(20, 'Flan Napolitano', 'postre', '2026-06-09 17:01:15'),
	(21, 'Helado Artesanal', 'postre', '2026-06-09 17:01:15'),
	(22, 'Crème Brûlée', 'postre', '2026-06-09 17:01:15'),
	(23, 'Tiramisú', 'postre', '2026-06-09 17:01:15'),
	(24, 'Agua de Horchata', 'bebida', '2026-06-09 17:01:15'),
	(25, 'Agua de Jamaica', 'bebida', '2026-06-09 17:01:15'),
	(26, 'Limonada Natural', 'bebida', '2026-06-09 17:01:15'),
	(27, 'Café de Olla', 'bebida', '2026-06-09 17:01:15'),
	(28, 'Refrescos', 'bebida', '2026-06-09 17:01:15'),
	(29, 'Vino Tinto', 'bebida', '2026-06-09 17:01:15'),
	(30, 'Vino Blanco', 'bebida', '2026-06-09 17:01:15'),
	(31, 'Lomito', 'proteina', '2026-06-09 18:49:17'),
	(32, 'Test Ingredient', 'proteina', '2026-06-11 17:33:10');

-- Dumping structure for table crm_jdl.cat_menus
CREATE TABLE IF NOT EXISTS `cat_menus` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre_menu` varchar(150) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `categoria_id` int(11) DEFAULT NULL,
  `fecha_creacion` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `categoria_id` (`categoria_id`),
  CONSTRAINT `fk_cat_menus_categoria` FOREIGN KEY (`categoria_id`) REFERENCES `cat_categorias_alimento` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table crm_jdl.cat_menus: ~8 rows (approximately)
INSERT INTO `cat_menus` (`id`, `nombre_menu`, `descripcion`, `categoria_id`, `fecha_creacion`) VALUES
	(1, 'Ejecutivo', 'Menú económico para eventos corporativos. Incluye proteína básica, guarnición sencilla y bebida.', NULL, '2026-06-09 17:01:15'),
	(2, 'Ejecutivo Plus', 'Menú corporativo mejorado con proteína premium, guarnición y postre.', NULL, '2026-06-09 17:01:15'),
	(3, 'Social', 'Menú versátil perfecto para bodas y eventos sociales. Incluye entrada fría, plato fuerte y postre.', NULL, '2026-06-09 17:01:15'),
	(4, 'Premium', 'Menú de alta gama con cortes finos y presentación elegante. Ideal para recepciones.', NULL, '2026-06-09 17:01:15'),
	(5, 'Infantil', 'Menú pensado para niños: preparaciones sencillas y sabores suaves.', NULL, '2026-06-09 17:01:15'),
	(6, 'Vegetariano', 'Opción sin carne con guarniciones abundantes y sabores frescos.', NULL, '2026-06-09 17:01:15'),
	(7, 'Desayuno Ejecutivo', 'Menú de desayuno para eventos matutinos. Incluye café de olla.', NULL, '2026-06-09 17:01:15'),
	(8, 'Coctel', 'Bocadillos y canapés para eventos tipo coctel. Ideal para recepciones de pie.', NULL, '2026-06-09 17:01:15');

-- Dumping structure for table crm_jdl.cat_opciones_ingrediente
CREATE TABLE IF NOT EXISTS `cat_opciones_ingrediente` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `ingrediente_id` int(11) NOT NULL,
  `nombre_opcion` varchar(150) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ingrediente_id` (`ingrediente_id`),
  CONSTRAINT `fk_cat_opciones_ingrediente_ingrediente` FOREIGN KEY (`ingrediente_id`) REFERENCES `cat_ingredientes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table crm_jdl.cat_opciones_ingrediente: ~20 rows (approximately)
INSERT INTO `cat_opciones_ingrediente` (`id`, `ingrediente_id`, `nombre_opcion`) VALUES
	(1, 1, 'Término: 3/4'),
	(2, 1, 'Término: Medio'),
	(3, 1, 'Término: Bien cocido'),
	(4, 2, 'A la plancha'),
	(5, 2, 'Empanizada'),
	(6, 2, 'Asada'),
	(7, 3, 'Adobado'),
	(8, 3, 'A la parrilla'),
	(9, 4, 'A la parrilla'),
	(10, 4, 'Sellado con costra de hierbas'),
	(11, 5, 'A la parrilla'),
	(12, 5, 'En trozos'),
	(13, 6, 'Bañadas en salsa BBQ'),
	(14, 9, 'Con mantequilla de ajo'),
	(15, 9, 'Salteadas en aceite de oliva'),
	(16, 10, 'Con aderezo clásico'),
	(17, 10, 'Con aderezo light'),
	(18, 12, 'Con romero y aceite de oliva'),
	(19, 15, 'Con crema'),
	(20, 15, 'Sin crema');

-- Dumping structure for table crm_jdl.cat_platillos
CREATE TABLE IF NOT EXISTS `cat_platillos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre_platillo` varchar(150) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `categoria_id` int(11) DEFAULT NULL,
  `precio_base` decimal(10,2) DEFAULT 0.00,
  `fecha_creacion` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `categoria_id` (`categoria_id`),
  CONSTRAINT `fk_cat_platillos_categoria` FOREIGN KEY (`categoria_id`) REFERENCES `cat_categorias_alimento` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table crm_jdl.cat_platillos: ~2 rows (approximately)
INSERT INTO `cat_platillos` (`id`, `nombre_platillo`, `descripcion`, `categoria_id`, `precio_base`, `fecha_creacion`) VALUES
	(1, 'Lomito al Oregano', '', NULL, 0.00, '2026-06-09 18:49:29'),
	(2, 'Filete de pollo', '', NULL, 0.00, '2026-06-09 18:50:10');

-- Dumping structure for table crm_jdl.categorias_servicio
CREATE TABLE IF NOT EXISTS `categorias_servicio` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(140) NOT NULL,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_categorias_servicio_nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table crm_jdl.categorias_servicio: ~4 rows (approximately)
INSERT INTO `categorias_servicio` (`id`, `nombre`, `creado_en`, `activo`) VALUES
	(1, 'Alimentos y Bebidas', '2026-05-20 14:33:53', 1),
	(2, 'Habitaciones', '2026-05-20 14:33:53', 1),
	(3, 'Hospedaje Terceros', '2026-05-20 14:33:53', 1),
	(4, 'Miscelaneos', '2026-05-20 14:33:53', 1);

-- Dumping structure for table crm_jdl.config_equipo
CREATE TABLE IF NOT EXISTS `config_equipo` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(150) NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `fecha_creacion` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table crm_jdl.config_equipo: ~4 rows (approximately)
INSERT INTO `config_equipo` (`id`, `nombre`, `activo`, `fecha_creacion`) VALUES
	(1, 'Microfono', 1, '2026-06-14 17:49:49'),
	(2, 'Bocinas', 1, '2026-06-14 17:49:56'),
	(3, 'Pantalla', 1, '2026-06-14 17:50:07'),
	(4, 'Cañonera', 1, '2026-06-14 17:50:21');

-- Dumping structure for table crm_jdl.config_tipo_mesa
CREATE TABLE IF NOT EXISTS `config_tipo_mesa` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(150) NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `fecha_creacion` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table crm_jdl.config_tipo_mesa: ~2 rows (approximately)
INSERT INTO `config_tipo_mesa` (`id`, `nombre`, `activo`, `fecha_creacion`) VALUES
	(1, 'Rectangulares', 1, '2026-06-14 17:51:02'),
	(2, 'Redondas', 1, '2026-06-14 17:51:09');

-- Dumping structure for table crm_jdl.config_tipo_silla
CREATE TABLE IF NOT EXISTS `config_tipo_silla` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(150) NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `fecha_creacion` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table crm_jdl.config_tipo_silla: ~2 rows (approximately)
INSERT INTO `config_tipo_silla` (`id`, `nombre`, `activo`, `fecha_creacion`) VALUES
	(1, 'Chavarry', 1, '2026-06-14 17:50:43'),
	(2, 'Corporatvo', 1, '2026-06-14 17:50:54');

-- Dumping structure for table crm_jdl.cotizacion_versiones_evento
CREATE TABLE IF NOT EXISTS `cotizacion_versiones_evento` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `id_evento` varchar(30) NOT NULL,
  `version_num` int(11) NOT NULL,
  `subtotal` decimal(12,2) NOT NULL DEFAULT 0.00,
  `descuento_tipo` varchar(12) NOT NULL DEFAULT 'AMOUNT',
  `descuento_valor` decimal(12,2) NOT NULL DEFAULT 0.00,
  `descuento_monto` decimal(12,2) NOT NULL DEFAULT 0.00,
  `total_neto` decimal(12,2) NOT NULL DEFAULT 0.00,
  `cotizado_en_iso` varchar(40) DEFAULT NULL,
  `json_crudo` longtext DEFAULT NULL,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cotizacion_version_evento` (`id_evento`,`version_num`),
  KEY `idx_cotizacion_version_evento` (`id_evento`)
) ENGINE=InnoDB AUTO_INCREMENT=1021 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table crm_jdl.cotizacion_versiones_evento: ~4 rows (approximately)
INSERT INTO `cotizacion_versiones_evento` (`id`, `id_evento`, `version_num`, `subtotal`, `descuento_tipo`, `descuento_valor`, `descuento_monto`, `total_neto`, `cotizado_en_iso`, `json_crudo`, `creado_en`) VALUES
	(1017, 'evt_a1326fe1', 1, 170.00, 'AMOUNT', 0.00, 0.00, 170.00, '2026-06-17T21:34:43.120Z', '{"companyId":"cmp_1781675622316","companyName":"TIGO GUATEMALA","managerId":"mgr_1781675621093","managerName":"CARLOS SAMALAJ","contact":"CARLOS SAMALAJ","email":"TSAMALAJ@GMAIL.COM","phone":"56325547","nit":"9457877","billTo":"CARLOS SAMALAJ","address":"Calle Monterrey Panajachel Solola","eventType":"Social","venue":"San Pedro","schedule":"","code":"COT-001","docDate":"2026-06-17","people":200,"eventDate":"2026-06-17","endDate":"2026-06-18","dueDate":"2026-05-18","discountType":"AMOUNT","discountValue":0,"items":[{"rowId":"row_140o3q5c","serviceId":"svc_1781675555668","name":"DESYAUNO NUEVO","qty":1,"price":85,"quantityMode":"MANUAL","serviceDate":"2026-06-17"},{"rowId":"row_9h3ff3sl","serviceId":"svc_1781675555668","name":"DESYAUNO NUEVO","qty":1,"price":85,"quantityMode":"MANUAL","serviceDate":"2026-06-17"}],"templateId":"contrato_corp","currency":"GTQ","internalNotes":"","version":1,"versions":[],"paymentType":"","menuMontajeEntries":[],"menuMontajeVersion":1,"menuMontajeVersions":[],"advanceLogs":[{"id":"advlog_1781677553211_fb2rz","at":"2026-06-17T06:25:53.211Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"added","label":"Agregado","change":"Agregado anticipo: Q 10.00 - pago de evneto bi"},{"id":"advlog_1781677566301_rgdsz","at":"2026-06-17T06:26:06.301Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"deleted","label":"Eliminado","change":"Anticipo eliminado"},{"id":"advlog_1781677593235_g6bsc","at":"2026-06-17T06:26:33.235Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"added","label":"Agregado","change":"Agregado anticipo: Q 10.00 - pago banco bi"},{"id":"advlog_1781678603991_08p44","at":"2026-06-17T06:43:23.991Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"added","label":"Agregado","change":"Agregado anticipo: Q 13.00 - dfdf"},{"id":"advlog_1781678621303_ep5fi","at":"2026-06-17T06:43:41.303Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"deleted","label":"Eliminado","change":"Anticipo eliminado"},{"id":"advlog_1781678897974_oxyvw","at":"2026-06-17T06:48:17.974Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"added","label":"Agregado","change":"Agregado anticipo: Q 10.00 - dfdf"},{"id":"advlog_1781678906417_tbmsg","at":"2026-06-17T06:48:26.417Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"deleted","label":"Eliminado","change":"Anticipo eliminado"},{"id":"advlog_1781678949871_00cds","at":"2026-06-17T06:49:09.871Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"edited","label":"Editado","change":"Editado anticipo: Q 15.00 - pago banco bi"},{"id":"advlog_1781679087630_h0g7e","at":"2026-06-17T06:51:27.630Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"edited","label":"Editado","change":"Editado anticipo: Q 1154.00 - pago banco bi"},{"id":"advlog_1781679358073_erscz","at":"2026-06-17T06:55:58.073Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"edited","label":"Editado","change":"Editado anticipo: Q 114.00 - pago banco bi"},{"id":"advlog_1781679375444_z60zj","at":"2026-06-17T06:56:15.444Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"added","label":"Agregado","change":"Agregado anticipo: Q 5.00 - dfdf"},{"id":"advlog_1781731059485_t6t69","at":"2026-06-17T21:17:39.485Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"added","label":"Agregado","change":"Agregado anticipo: Q 51.00 - BANCO INDUSTRIAL"}],"subtotal":170,"discountAmount":0,"total":170,"quotedAt":"2026-06-17T21:34:43.120Z"}', '2026-06-18 07:21:47'),
	(1018, 'evt_a1326fe1_s1_20260618', 1, 170.00, 'AMOUNT', 0.00, 0.00, 170.00, '2026-06-17T21:34:43.120Z', '{"companyId":"cmp_1781675622316","companyName":"TIGO GUATEMALA","managerId":"mgr_1781675621093","managerName":"CARLOS SAMALAJ","contact":"CARLOS SAMALAJ","email":"TSAMALAJ@GMAIL.COM","phone":"56325547","nit":"9457877","billTo":"CARLOS SAMALAJ","address":"Calle Monterrey Panajachel Solola","eventType":"Social","venue":"San Pedro","schedule":"","code":"COT-10344","docDate":"2026-06-17","people":200,"eventDate":"2026-06-17","endDate":"2026-06-18","dueDate":"2026-05-18","discountType":"AMOUNT","discountValue":0,"items":[{"rowId":"row_140o3q5c","serviceId":"svc_1781675555668","name":"DESYAUNO NUEVO","qty":1,"price":85,"quantityMode":"MANUAL","serviceDate":"2026-06-17"},{"rowId":"row_9h3ff3sl","serviceId":"svc_1781675555668","name":"DESYAUNO NUEVO","qty":1,"price":85,"quantityMode":"MANUAL","serviceDate":"2026-06-17"}],"templateId":"contrato_corp","currency":"GTQ","internalNotes":"","version":1,"versions":[],"paymentType":"","menuMontajeEntries":[],"menuMontajeVersion":1,"menuMontajeVersions":[],"advanceLogs":[{"id":"advlog_1781677553211_fb2rz","at":"2026-06-17T06:25:53.211Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"added","label":"Agregado","change":"Agregado anticipo: Q 10.00 - pago de evneto bi"},{"id":"advlog_1781677566301_rgdsz","at":"2026-06-17T06:26:06.301Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"deleted","label":"Eliminado","change":"Anticipo eliminado"},{"id":"advlog_1781677593235_g6bsc","at":"2026-06-17T06:26:33.235Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"added","label":"Agregado","change":"Agregado anticipo: Q 10.00 - pago banco bi"},{"id":"advlog_1781678603991_08p44","at":"2026-06-17T06:43:23.991Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"added","label":"Agregado","change":"Agregado anticipo: Q 13.00 - dfdf"},{"id":"advlog_1781678621303_ep5fi","at":"2026-06-17T06:43:41.303Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"deleted","label":"Eliminado","change":"Anticipo eliminado"},{"id":"advlog_1781678897974_oxyvw","at":"2026-06-17T06:48:17.974Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"added","label":"Agregado","change":"Agregado anticipo: Q 10.00 - dfdf"},{"id":"advlog_1781678906417_tbmsg","at":"2026-06-17T06:48:26.417Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"deleted","label":"Eliminado","change":"Anticipo eliminado"},{"id":"advlog_1781678949871_00cds","at":"2026-06-17T06:49:09.871Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"edited","label":"Editado","change":"Editado anticipo: Q 15.00 - pago banco bi"},{"id":"advlog_1781679087630_h0g7e","at":"2026-06-17T06:51:27.630Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"edited","label":"Editado","change":"Editado anticipo: Q 1154.00 - pago banco bi"},{"id":"advlog_1781679358073_erscz","at":"2026-06-17T06:55:58.073Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"edited","label":"Editado","change":"Editado anticipo: Q 114.00 - pago banco bi"},{"id":"advlog_1781679375444_z60zj","at":"2026-06-17T06:56:15.444Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"added","label":"Agregado","change":"Agregado anticipo: Q 5.00 - dfdf"},{"id":"advlog_1781731059485_t6t69","at":"2026-06-17T21:17:39.485Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"added","label":"Agregado","change":"Agregado anticipo: Q 51.00 - BANCO INDUSTRIAL"}],"subtotal":170,"discountAmount":0,"total":170,"quotedAt":"2026-06-17T21:34:43.120Z"}', '2026-06-18 07:21:47'),
	(1019, 'evt_75276114', 1, 370.00, 'AMOUNT', 0.00, 0.00, 370.00, '2026-06-18T07:21:47.470Z', '{"companyId":"cmp_1781760064283","companyName":"JARDINES DEL LAGO","managerId":"mgr_1781760061820","managerName":"ISABEL RALON","contact":"ISABEL RALON","email":"IRALON@JARDINESDELLAGO.COM","phone":"77626114","nit":"4854306","billTo":"ISABEL RALON","address":"Calle Monterrey Panajachel Solola","eventType":"Social","venue":"Helipuerto JDL","schedule":"8  A 15 ","code":"COT-002","docDate":"2026-06-18","people":15,"eventDate":"2026-06-19","endDate":"2026-06-20","dueDate":"2026-05-20","discountType":"AMOUNT","discountValue":0,"items":[{"rowId":"row_rjwz8acc","serviceId":"svc_1781759980734","name":"DESAYUNO BUFFET","qty":1,"price":185,"quantityMode":"MANUAL","serviceDate":"2026-06-19"},{"rowId":"row_2kabgyi0","serviceId":"svc_1781759980734","name":"DESAYUNO BUFFET","qty":1,"price":185,"quantityMode":"MANUAL","serviceDate":"2026-06-20"}],"advances":[],"templateId":"contrato_corp","currency":"GTQ","internalNotes":"","version":1,"versions":[],"paymentType":"","menuMontajeEntries":[],"menuMontajeVersion":1,"menuMontajeVersions":[],"advanceLogs":[],"subtotal":370,"discountAmount":0,"total":370,"quotedAt":"2026-06-18T07:21:47.470Z"}', '2026-06-18 07:21:47'),
	(1020, 'evt_75276114_s1_20260620', 1, 370.00, 'AMOUNT', 0.00, 0.00, 370.00, '2026-06-18T07:21:47.470Z', '{"companyId":"cmp_1781760064283","companyName":"JARDINES DEL LAGO","managerId":"mgr_1781760061820","managerName":"ISABEL RALON","contact":"ISABEL RALON","email":"IRALON@JARDINESDELLAGO.COM","phone":"77626114","nit":"4854306","billTo":"ISABEL RALON","address":"Calle Monterrey Panajachel Solola","eventType":"Social","venue":"Helipuerto JDL","schedule":"8  A 15 ","code":"COT-10345","docDate":"2026-06-18","people":15,"eventDate":"2026-06-19","endDate":"2026-06-20","dueDate":"2026-05-20","discountType":"AMOUNT","discountValue":0,"items":[{"rowId":"row_rjwz8acc","serviceId":"svc_1781759980734","name":"DESAYUNO BUFFET","qty":1,"price":185,"quantityMode":"MANUAL","serviceDate":"2026-06-19"},{"rowId":"row_2kabgyi0","serviceId":"svc_1781759980734","name":"DESAYUNO BUFFET","qty":1,"price":185,"quantityMode":"MANUAL","serviceDate":"2026-06-20"}],"advances":[],"templateId":"contrato_corp","currency":"GTQ","internalNotes":"","version":1,"versions":[],"paymentType":"","menuMontajeEntries":[],"menuMontajeVersion":1,"menuMontajeVersions":[],"advanceLogs":[],"subtotal":370,"discountAmount":0,"total":370,"quotedAt":"2026-06-18T07:21:47.470Z"}', '2026-06-18 07:21:47');

-- Dumping structure for table crm_jdl.cotizaciones_evento
CREATE TABLE IF NOT EXISTS `cotizaciones_evento` (
  `id_evento` varchar(30) NOT NULL,
  `id_empresa` varchar(30) DEFAULT NULL,
  `id_encargado` varchar(30) DEFAULT NULL,
  `nombre_empresa` varchar(200) DEFAULT NULL,
  `nombre_encargado` varchar(200) DEFAULT NULL,
  `contacto` varchar(200) DEFAULT NULL,
  `correo` varchar(200) DEFAULT NULL,
  `facturar_a` varchar(220) DEFAULT NULL,
  `direccion` varchar(300) DEFAULT NULL,
  `tipo_evento` varchar(120) DEFAULT NULL,
  `lugar` varchar(160) DEFAULT NULL,
  `horario_texto` varchar(180) DEFAULT NULL,
  `codigo` varchar(120) DEFAULT NULL,
  `fecha_documento` date DEFAULT NULL,
  `telefono` varchar(80) DEFAULT NULL,
  `nit` varchar(64) DEFAULT NULL,
  `personas` int(11) DEFAULT NULL,
  `fecha_evento` date DEFAULT NULL,
  `folio` varchar(120) DEFAULT NULL,
  `fecha_fin` date DEFAULT NULL,
  `fecha_max_pago` date DEFAULT NULL,
  `tipo_pago` varchar(120) DEFAULT NULL,
  `notas_internas` text DEFAULT NULL,
  `notas` text DEFAULT NULL,
  `cotizado_en_iso` varchar(50) DEFAULT NULL,
  `json_crudo` longtext DEFAULT NULL,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  `actualizado_en` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `version_actual` int(11) NOT NULL DEFAULT 1,
  `subtotal` decimal(12,2) NOT NULL DEFAULT 0.00,
  `descuento_tipo` varchar(12) NOT NULL DEFAULT 'AMOUNT',
  `descuento_valor` decimal(12,2) NOT NULL DEFAULT 0.00,
  `descuento_monto` decimal(12,2) NOT NULL DEFAULT 0.00,
  `total_neto` decimal(12,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id_evento`),
  KEY `idx_cotizaciones_empresa` (`id_empresa`),
  KEY `idx_cotizaciones_encargado` (`id_encargado`),
  CONSTRAINT `fk_cotizaciones_evento` FOREIGN KEY (`id_evento`) REFERENCES `eventos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table crm_jdl.cotizaciones_evento: ~4 rows (approximately)
INSERT INTO `cotizaciones_evento` (`id_evento`, `id_empresa`, `id_encargado`, `nombre_empresa`, `nombre_encargado`, `contacto`, `correo`, `facturar_a`, `direccion`, `tipo_evento`, `lugar`, `horario_texto`, `codigo`, `fecha_documento`, `telefono`, `nit`, `personas`, `fecha_evento`, `folio`, `fecha_fin`, `fecha_max_pago`, `tipo_pago`, `notas_internas`, `notas`, `cotizado_en_iso`, `json_crudo`, `creado_en`, `actualizado_en`, `version_actual`, `subtotal`, `descuento_tipo`, `descuento_valor`, `descuento_monto`, `total_neto`) VALUES
	('evt_75276114', 'cmp_1781760064283', 'mgr_1781760061820', 'JARDINES DEL LAGO', 'ISABEL RALON', 'ISABEL RALON', 'IRALON@JARDINESDELLAGO.COM', 'ISABEL RALON', 'Calle Monterrey Panajachel Solola', 'Social', 'Helipuerto JDL', '8  A 15', 'COT-002', '2026-06-18', '77626114', '4854306', 15, '2026-06-19', NULL, '2026-06-20', '2026-05-20', NULL, NULL, NULL, '2026-06-18T07:21:47.470Z', '{"companyId":"cmp_1781760064283","companyName":"JARDINES DEL LAGO","managerId":"mgr_1781760061820","managerName":"ISABEL RALON","contact":"ISABEL RALON","email":"IRALON@JARDINESDELLAGO.COM","phone":"77626114","nit":"4854306","billTo":"ISABEL RALON","address":"Calle Monterrey Panajachel Solola","eventType":"Social","venue":"Helipuerto JDL","schedule":"8  A 15 ","code":"COT-002","docDate":"2026-06-18","people":15,"eventDate":"2026-06-19","endDate":"2026-06-20","dueDate":"2026-05-20","discountType":"AMOUNT","discountValue":0,"items":[{"rowId":"row_rjwz8acc","serviceId":"svc_1781759980734","name":"DESAYUNO BUFFET","qty":1,"price":185,"quantityMode":"MANUAL","serviceDate":"2026-06-19"},{"rowId":"row_2kabgyi0","serviceId":"svc_1781759980734","name":"DESAYUNO BUFFET","qty":1,"price":185,"quantityMode":"MANUAL","serviceDate":"2026-06-20"}],"advances":[],"templateId":"contrato_corp","currency":"GTQ","internalNotes":"","version":1,"versions":[],"paymentType":"","menuMontajeEntries":[],"menuMontajeVersion":1,"menuMontajeVersions":[],"advanceLogs":[],"subtotal":370,"discountAmount":0,"total":370,"quotedAt":"2026-06-18T07:21:47.470Z"}', '2026-06-18 05:21:30', '2026-06-18 07:21:47', 1, 370.00, 'AMOUNT', 0.00, 0.00, 370.00),
	('evt_75276114_s1_20260620', 'cmp_1781760064283', 'mgr_1781760061820', 'JARDINES DEL LAGO', 'ISABEL RALON', 'ISABEL RALON', 'IRALON@JARDINESDELLAGO.COM', 'ISABEL RALON', 'Calle Monterrey Panajachel Solola', 'Social', 'Helipuerto JDL', '8  A 15', 'COT-10345', '2026-06-18', '77626114', '4854306', 15, '2026-06-19', NULL, '2026-06-20', '2026-05-20', NULL, NULL, NULL, '2026-06-18T07:21:47.470Z', '{"companyId":"cmp_1781760064283","companyName":"JARDINES DEL LAGO","managerId":"mgr_1781760061820","managerName":"ISABEL RALON","contact":"ISABEL RALON","email":"IRALON@JARDINESDELLAGO.COM","phone":"77626114","nit":"4854306","billTo":"ISABEL RALON","address":"Calle Monterrey Panajachel Solola","eventType":"Social","venue":"Helipuerto JDL","schedule":"8  A 15 ","code":"COT-10345","docDate":"2026-06-18","people":15,"eventDate":"2026-06-19","endDate":"2026-06-20","dueDate":"2026-05-20","discountType":"AMOUNT","discountValue":0,"items":[{"rowId":"row_rjwz8acc","serviceId":"svc_1781759980734","name":"DESAYUNO BUFFET","qty":1,"price":185,"quantityMode":"MANUAL","serviceDate":"2026-06-19"},{"rowId":"row_2kabgyi0","serviceId":"svc_1781759980734","name":"DESAYUNO BUFFET","qty":1,"price":185,"quantityMode":"MANUAL","serviceDate":"2026-06-20"}],"advances":[],"templateId":"contrato_corp","currency":"GTQ","internalNotes":"","version":1,"versions":[],"paymentType":"","menuMontajeEntries":[],"menuMontajeVersion":1,"menuMontajeVersions":[],"advanceLogs":[],"subtotal":370,"discountAmount":0,"total":370,"quotedAt":"2026-06-18T07:21:47.470Z"}', '2026-06-18 05:21:30', '2026-06-18 07:21:47', 1, 370.00, 'AMOUNT', 0.00, 0.00, 370.00),
	('evt_a1326fe1', 'cmp_1781675622316', 'mgr_1781675621093', 'TIGO GUATEMALA', 'CARLOS SAMALAJ', 'CARLOS SAMALAJ', 'TSAMALAJ@GMAIL.COM', 'CARLOS SAMALAJ', 'Calle Monterrey Panajachel Solola', 'Social', 'San Pedro', NULL, 'COT-001', '2026-06-17', '56325547', '9457877', 200, '2026-06-17', NULL, '2026-06-18', '2026-05-18', NULL, NULL, NULL, '2026-06-17T21:34:43.120Z', '{"companyId":"cmp_1781675622316","companyName":"TIGO GUATEMALA","managerId":"mgr_1781675621093","managerName":"CARLOS SAMALAJ","contact":"CARLOS SAMALAJ","email":"TSAMALAJ@GMAIL.COM","phone":"56325547","nit":"9457877","billTo":"CARLOS SAMALAJ","address":"Calle Monterrey Panajachel Solola","eventType":"Social","venue":"San Pedro","schedule":"","code":"COT-001","docDate":"2026-06-17","people":200,"eventDate":"2026-06-17","endDate":"2026-06-18","dueDate":"2026-05-18","discountType":"AMOUNT","discountValue":0,"items":[{"rowId":"row_140o3q5c","serviceId":"svc_1781675555668","name":"DESYAUNO NUEVO","qty":1,"price":85,"quantityMode":"MANUAL","serviceDate":"2026-06-17"},{"rowId":"row_9h3ff3sl","serviceId":"svc_1781675555668","name":"DESYAUNO NUEVO","qty":1,"price":85,"quantityMode":"MANUAL","serviceDate":"2026-06-17"}],"templateId":"contrato_corp","currency":"GTQ","internalNotes":"","version":1,"versions":[],"paymentType":"","menuMontajeEntries":[],"menuMontajeVersion":1,"menuMontajeVersions":[],"advanceLogs":[{"id":"advlog_1781677553211_fb2rz","at":"2026-06-17T06:25:53.211Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"added","label":"Agregado","change":"Agregado anticipo: Q 10.00 - pago de evneto bi"},{"id":"advlog_1781677566301_rgdsz","at":"2026-06-17T06:26:06.301Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"deleted","label":"Eliminado","change":"Anticipo eliminado"},{"id":"advlog_1781677593235_g6bsc","at":"2026-06-17T06:26:33.235Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"added","label":"Agregado","change":"Agregado anticipo: Q 10.00 - pago banco bi"},{"id":"advlog_1781678603991_08p44","at":"2026-06-17T06:43:23.991Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"added","label":"Agregado","change":"Agregado anticipo: Q 13.00 - dfdf"},{"id":"advlog_1781678621303_ep5fi","at":"2026-06-17T06:43:41.303Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"deleted","label":"Eliminado","change":"Anticipo eliminado"},{"id":"advlog_1781678897974_oxyvw","at":"2026-06-17T06:48:17.974Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"added","label":"Agregado","change":"Agregado anticipo: Q 10.00 - dfdf"},{"id":"advlog_1781678906417_tbmsg","at":"2026-06-17T06:48:26.417Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"deleted","label":"Eliminado","change":"Anticipo eliminado"},{"id":"advlog_1781678949871_00cds","at":"2026-06-17T06:49:09.871Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"edited","label":"Editado","change":"Editado anticipo: Q 15.00 - pago banco bi"},{"id":"advlog_1781679087630_h0g7e","at":"2026-06-17T06:51:27.630Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"edited","label":"Editado","change":"Editado anticipo: Q 1154.00 - pago banco bi"},{"id":"advlog_1781679358073_erscz","at":"2026-06-17T06:55:58.073Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"edited","label":"Editado","change":"Editado anticipo: Q 114.00 - pago banco bi"},{"id":"advlog_1781679375444_z60zj","at":"2026-06-17T06:56:15.444Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"added","label":"Agregado","change":"Agregado anticipo: Q 5.00 - dfdf"},{"id":"advlog_1781731059485_t6t69","at":"2026-06-17T21:17:39.485Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"added","label":"Agregado","change":"Agregado anticipo: Q 51.00 - BANCO INDUSTRIAL"}],"subtotal":170,"discountAmount":0,"total":170,"quotedAt":"2026-06-17T21:34:43.120Z"}', '2026-06-17 05:53:52', '2026-06-17 21:43:57', 1, 170.00, 'AMOUNT', 0.00, 0.00, 170.00),
	('evt_a1326fe1_s1_20260618', 'cmp_1781675622316', 'mgr_1781675621093', 'TIGO GUATEMALA', 'CARLOS SAMALAJ', 'CARLOS SAMALAJ', 'TSAMALAJ@GMAIL.COM', 'CARLOS SAMALAJ', 'Calle Monterrey Panajachel Solola', 'Social', 'San Pedro', NULL, 'COT-10344', '2026-06-17', '56325547', '9457877', 200, '2026-06-17', NULL, '2026-06-18', '2026-05-18', NULL, NULL, NULL, '2026-06-17T21:34:43.120Z', '{"companyId":"cmp_1781675622316","companyName":"TIGO GUATEMALA","managerId":"mgr_1781675621093","managerName":"CARLOS SAMALAJ","contact":"CARLOS SAMALAJ","email":"TSAMALAJ@GMAIL.COM","phone":"56325547","nit":"9457877","billTo":"CARLOS SAMALAJ","address":"Calle Monterrey Panajachel Solola","eventType":"Social","venue":"San Pedro","schedule":"","code":"COT-10344","docDate":"2026-06-17","people":200,"eventDate":"2026-06-17","endDate":"2026-06-18","dueDate":"2026-05-18","discountType":"AMOUNT","discountValue":0,"items":[{"rowId":"row_140o3q5c","serviceId":"svc_1781675555668","name":"DESYAUNO NUEVO","qty":1,"price":85,"quantityMode":"MANUAL","serviceDate":"2026-06-17"},{"rowId":"row_9h3ff3sl","serviceId":"svc_1781675555668","name":"DESYAUNO NUEVO","qty":1,"price":85,"quantityMode":"MANUAL","serviceDate":"2026-06-17"}],"templateId":"contrato_corp","currency":"GTQ","internalNotes":"","version":1,"versions":[],"paymentType":"","menuMontajeEntries":[],"menuMontajeVersion":1,"menuMontajeVersions":[],"advanceLogs":[{"id":"advlog_1781677553211_fb2rz","at":"2026-06-17T06:25:53.211Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"added","label":"Agregado","change":"Agregado anticipo: Q 10.00 - pago de evneto bi"},{"id":"advlog_1781677566301_rgdsz","at":"2026-06-17T06:26:06.301Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"deleted","label":"Eliminado","change":"Anticipo eliminado"},{"id":"advlog_1781677593235_g6bsc","at":"2026-06-17T06:26:33.235Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"added","label":"Agregado","change":"Agregado anticipo: Q 10.00 - pago banco bi"},{"id":"advlog_1781678603991_08p44","at":"2026-06-17T06:43:23.991Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"added","label":"Agregado","change":"Agregado anticipo: Q 13.00 - dfdf"},{"id":"advlog_1781678621303_ep5fi","at":"2026-06-17T06:43:41.303Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"deleted","label":"Eliminado","change":"Anticipo eliminado"},{"id":"advlog_1781678897974_oxyvw","at":"2026-06-17T06:48:17.974Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"added","label":"Agregado","change":"Agregado anticipo: Q 10.00 - dfdf"},{"id":"advlog_1781678906417_tbmsg","at":"2026-06-17T06:48:26.417Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"deleted","label":"Eliminado","change":"Anticipo eliminado"},{"id":"advlog_1781678949871_00cds","at":"2026-06-17T06:49:09.871Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"edited","label":"Editado","change":"Editado anticipo: Q 15.00 - pago banco bi"},{"id":"advlog_1781679087630_h0g7e","at":"2026-06-17T06:51:27.630Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"edited","label":"Editado","change":"Editado anticipo: Q 1154.00 - pago banco bi"},{"id":"advlog_1781679358073_erscz","at":"2026-06-17T06:55:58.073Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"edited","label":"Editado","change":"Editado anticipo: Q 114.00 - pago banco bi"},{"id":"advlog_1781679375444_z60zj","at":"2026-06-17T06:56:15.444Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"added","label":"Agregado","change":"Agregado anticipo: Q 5.00 - dfdf"},{"id":"advlog_1781731059485_t6t69","at":"2026-06-17T21:17:39.485Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"added","label":"Agregado","change":"Agregado anticipo: Q 51.00 - BANCO INDUSTRIAL"}],"subtotal":170,"discountAmount":0,"total":170,"quotedAt":"2026-06-17T21:34:43.120Z"}', '2026-06-17 05:53:52', '2026-06-18 07:21:47', 1, 170.00, 'AMOUNT', 0.00, 0.00, 170.00);

-- Dumping structure for table crm_jdl.doc_sequence
CREATE TABLE IF NOT EXISTS `doc_sequence` (
  `scope` varchar(40) NOT NULL,
  `last_value` bigint(20) unsigned NOT NULL DEFAULT 0,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`scope`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Dumping data for table crm_jdl.doc_sequence: ~0 rows (approximately)
INSERT INTO `doc_sequence` (`scope`, `last_value`, `updated_at`) VALUES
	('COT', 10345, '2026-06-18 07:21:47');

-- Dumping structure for table crm_jdl.empresas
CREATE TABLE IF NOT EXISTS `empresas` (
  `id` varchar(30) NOT NULL,
  `nombre` varchar(200) NOT NULL,
  `encargado_principal` varchar(200) DEFAULT NULL,
  `correo` varchar(200) DEFAULT NULL,
  `nit` varchar(64) DEFAULT NULL,
  `razon_social` varchar(220) DEFAULT NULL,
  `tipo_evento` varchar(120) DEFAULT NULL,
  `direccion` varchar(300) DEFAULT NULL,
  `telefono` varchar(80) DEFAULT NULL,
  `notas` text DEFAULT NULL,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table crm_jdl.empresas: ~1 rows (approximately)
INSERT INTO `empresas` (`id`, `nombre`, `encargado_principal`, `correo`, `nit`, `razon_social`, `tipo_evento`, `direccion`, `telefono`, `notas`, `creado_en`) VALUES
	('cmp_1781760064283', 'JARDINES DEL LAGO', 'ISABEL RALON', 'IRALON@JARDINESDELLAGO.COM', '4854306', 'ISABEL RALON', 'Social', 'Calle Monterrey Panajachel Solola', '56325547', NULL, '2026-06-18 07:21:47');

-- Dumping structure for table crm_jdl.encargados_empresa
CREATE TABLE IF NOT EXISTS `encargados_empresa` (
  `id` varchar(30) NOT NULL,
  `id_empresa` varchar(30) NOT NULL,
  `nombre` varchar(200) NOT NULL,
  `telefono` varchar(80) DEFAULT NULL,
  `correo` varchar(200) DEFAULT NULL,
  `direccion` varchar(300) DEFAULT NULL,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_encargados_empresa` (`id_empresa`),
  CONSTRAINT `fk_encargados_empresa` FOREIGN KEY (`id_empresa`) REFERENCES `empresas` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table crm_jdl.encargados_empresa: ~1 rows (approximately)
INSERT INTO `encargados_empresa` (`id`, `id_empresa`, `nombre`, `telefono`, `correo`, `direccion`, `creado_en`) VALUES
	('mgr_1781760061820', 'cmp_1781760064283', 'ISABEL RALON', '77626114', 'IRALON@JARDINESDELLAGO.COM', 'ZONA 2', '2026-06-18 07:21:47');

-- Dumping structure for table crm_jdl.event_notas
CREATE TABLE IF NOT EXISTS `event_notas` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `idocupacion` varchar(255) NOT NULL,
  `usuario_id` varchar(30) DEFAULT NULL,
  `contenido` text NOT NULL,
  `mencion_a_id` varchar(255) DEFAULT NULL,
  `reacciones` text DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_event_notas_usuario` (`usuario_id`),
  CONSTRAINT `fk_event_notas_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=34 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table crm_jdl.event_notas: ~10 rows (approximately)
INSERT INTO `event_notas` (`id`, `idocupacion`, `usuario_id`, `contenido`, `mencion_a_id`, `reacciones`, `created_at`) VALUES
	(7, 'HAB02202644987', NULL, '@FrontOffice Demo  hacelo bien', 'legacy_inf_4', '{"👍":[1,3],"😂":[1]}', '2026-06-10 01:01:31'),
	(8, 'HAB02202645003', NULL, '@Vendedor Demo Necesito mas info', 'legacy_inf_2', '{"👍":[3]}', '2026-06-10 14:38:47'),
	(9, 'HAB14202510224', NULL, '@Vendedor Demo  si se ara entonces', 'legacy_inf_2', '{"👍":[3]}', '2026-06-10 17:10:07'),
	(10, 'HAB22202644346', NULL, '@Coordinador Demo  hola', 'legacy_inf_3', '{"😂":[1]}', '2026-06-11 17:28:57'),
	(11, 'HAB02202644987', NULL, '@Vendedor Demo  hola', 'legacy_inf_2', NULL, '2026-06-11 17:34:56'),
	(12, 'evt_fcf41367121428_19ebf1ab692', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', '@Vendedor Demo cambiar la solicitud', '', NULL, '2026-06-13 15:03:39'),
	(24, 'HAB02202644987', NULL, 'Test note mentioning someone @Kevin Bixcul M', '', NULL, '2026-06-14 12:43:06'),
	(25, 'HAB02202644987', NULL, 'Test note mentioning someone @Kevin Bixcul M', '', NULL, '2026-06-14 12:43:25'),
	(26, 'HAB02202644987', NULL, 'Test note mentioning someone @Kevin Bixcul M', 'kLy8WstSA9SFw8fKkdW88BKEKci2', NULL, '2026-06-14 12:43:38'),
	(32, 'evt_92f4e5f549b058_19ec76e1837', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', '@Carlos Roberto Samalaj  hola', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', NULL, '2026-06-14 12:50:07'),
	(33, 'evt_a1326fe1', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', '@kevin Bixcul  hola mira este modo', 'user_prereg_1781679962646', '{"😂":["Keg6VRrMFLdJK9aslxy7sG2mxFI2"]}', '2026-06-17 01:06:48');

-- Dumping structure for table crm_jdl.evento_metadatos
CREATE TABLE IF NOT EXISTS `evento_metadatos` (
  `id_ocupacion` varchar(255) NOT NULL,
  `desayunos` int(11) DEFAULT 0,
  `habitaciones` text DEFAULT NULL,
  `tiene_alertas` tinyint(1) DEFAULT 0,
  `alertas_text` text DEFAULT NULL,
  `fecha_creacion` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id_ocupacion`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table crm_jdl.evento_metadatos: ~3 rows (approximately)
INSERT INTO `evento_metadatos` (`id_ocupacion`, `desayunos`, `habitaciones`, `tiene_alertas`, `alertas_text`, `fecha_creacion`) VALUES
	('2026-06-09', 10, '20', 0, NULL, '2026-06-12 21:46:29'),
	('HAB02202644987', 0, '0', 0, NULL, '2026-06-12 21:46:29'),
	('HAB09202645461', 0, '0', 0, NULL, '2026-06-12 21:46:29');

-- Dumping structure for table crm_jdl.eventos
CREATE TABLE IF NOT EXISTS `eventos` (
  `id` varchar(30) NOT NULL,
  `id_grupo` varchar(120) DEFAULT NULL,
  `nombre` varchar(240) NOT NULL,
  `nombre_salon` varchar(120) NOT NULL,
  `fecha_evento` date NOT NULL,
  `fecha_inicio_reserva` date DEFAULT NULL,
  `fecha_fin_reserva` date DEFAULT NULL,
  `hora_inicio` time NOT NULL,
  `hora_fin` time NOT NULL,
  `estado` varchar(80) NOT NULL,
  `id_usuario` varchar(30) DEFAULT NULL,
  `pax` int(11) DEFAULT NULL,
  `notas` text DEFAULT NULL,
  `cotizacion_json` longtext DEFAULT NULL,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  `actualizado_en` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_eventos_grupo` (`id_grupo`),
  KEY `idx_eventos_fecha_salon` (`fecha_evento`,`nombre_salon`),
  KEY `idx_eventos_usuario` (`id_usuario`),
  CONSTRAINT `fk_eventos_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table crm_jdl.eventos: ~6 rows (approximately)
INSERT INTO `eventos` (`id`, `id_grupo`, `nombre`, `nombre_salon`, `fecha_evento`, `fecha_inicio_reserva`, `fecha_fin_reserva`, `hora_inicio`, `hora_fin`, `estado`, `id_usuario`, `pax`, `notas`, `cotizacion_json`, `creado_en`, `actualizado_en`) VALUES
	('evt_75276114', 'evt_75276114', 'Cena familiar', 'Helipuerto JDL', '2026-06-19', '2026-06-19', '2026-06-20', '07:00:00', '09:00:00', 'Confirmado', 'user_prereg_1781734502892', 15, NULL, '{"companyId":"cmp_1781760064283","companyName":"JARDINES DEL LAGO","managerId":"mgr_1781760061820","managerName":"ISABEL RALON","contact":"ISABEL RALON","email":"IRALON@JARDINESDELLAGO.COM","phone":"77626114","nit":"4854306","billTo":"ISABEL RALON","address":"Calle Monterrey Panajachel Solola","eventType":"Social","venue":"Helipuerto JDL","schedule":"8  A 15 ","code":"COT-002","docDate":"2026-06-18","people":15,"eventDate":"2026-06-19","endDate":"2026-06-20","dueDate":"2026-05-20","discountType":"AMOUNT","discountValue":0,"items":[{"rowId":"row_rjwz8acc","serviceId":"svc_1781759980734","name":"DESAYUNO BUFFET","qty":1,"price":185,"quantityMode":"MANUAL","serviceDate":"2026-06-19"},{"rowId":"row_2kabgyi0","serviceId":"svc_1781759980734","name":"DESAYUNO BUFFET","qty":1,"price":185,"quantityMode":"MANUAL","serviceDate":"2026-06-20"}],"templateId":"contrato_corp","currency":"GTQ","internalNotes":"","version":1,"versions":[],"paymentType":"","menuMontajeEntries":[],"menuMontajeVersion":1,"menuMontajeVersions":[],"advanceLogs":[],"subtotal":370,"discountAmount":0,"total":370,"quotedAt":"2026-06-18T07:21:47.470Z"}', '2026-06-17 01:26:46', '2026-06-18 07:21:47'),
	('evt_75276114_s1_20260620', 'evt_75276114', 'Cena familiar', 'Helipuerto JDL', '2026-06-20', '2026-06-19', '2026-06-20', '07:00:00', '09:00:00', 'Confirmado', 'user_prereg_1781734502892', 15, NULL, '{"companyId":"cmp_1781760064283","companyName":"JARDINES DEL LAGO","managerId":"mgr_1781760061820","managerName":"ISABEL RALON","contact":"ISABEL RALON","email":"IRALON@JARDINESDELLAGO.COM","phone":"77626114","nit":"4854306","billTo":"ISABEL RALON","address":"Calle Monterrey Panajachel Solola","eventType":"Social","venue":"Helipuerto JDL","schedule":"8  A 15 ","code":"COT-002","docDate":"2026-06-18","people":15,"eventDate":"2026-06-19","endDate":"2026-06-20","dueDate":"2026-05-20","discountType":"AMOUNT","discountValue":0,"items":[{"rowId":"row_rjwz8acc","serviceId":"svc_1781759980734","name":"DESAYUNO BUFFET","qty":1,"price":185,"quantityMode":"MANUAL","serviceDate":"2026-06-19"},{"rowId":"row_2kabgyi0","serviceId":"svc_1781759980734","name":"DESAYUNO BUFFET","qty":1,"price":185,"quantityMode":"MANUAL","serviceDate":"2026-06-20"}],"templateId":"contrato_corp","currency":"GTQ","internalNotes":"","version":1,"versions":[],"paymentType":"","menuMontajeEntries":[],"menuMontajeVersion":1,"menuMontajeVersions":[],"advanceLogs":[],"subtotal":370,"discountAmount":0,"total":370,"quotedAt":"2026-06-18T07:21:47.470Z"}', '2026-06-17 01:26:46', '2026-06-18 07:21:47'),
	('evt_9f50fb80', 'evt_9f50fb80', 'eymi', 'ElDeck', '2026-06-18', '2026-06-18', '2026-06-19', '11:00:00', '14:00:00', 'Lista de Espera', 'usr_1781742734393', 10, NULL, NULL, '2026-06-18 00:00:17', '2026-06-18 00:38:55'),
	('evt_9f50fb80_s1_20260619', 'evt_9f50fb80', 'eymi', 'ElDeck', '2026-06-19', '2026-06-18', '2026-06-19', '11:00:00', '14:00:00', 'Lista de Espera', 'usr_1781742734393', 10, NULL, NULL, '2026-06-18 00:00:17', '2026-06-18 00:38:55'),
	('evt_a1326fe1', 'evt_a1326fe1', 'MANTENIMIENTO', 'ElDeck', '2026-06-17', '2026-06-17', '2026-06-18', '07:00:00', '10:00:00', 'Confirmado', 'usr_1781742734393', 10, NULL, '{"companyId":"cmp_1781675622316","companyName":"TIGO GUATEMALA","managerId":"mgr_1781675621093","managerName":"CARLOS SAMALAJ","contact":"CARLOS SAMALAJ","email":"TSAMALAJ@GMAIL.COM","phone":"56325547","nit":"9457877","billTo":"CARLOS SAMALAJ","address":"Calle Monterrey Panajachel Solola","eventType":"Social","venue":"San Pedro","schedule":"","code":"COT-001","docDate":"2026-06-17","people":200,"eventDate":"2026-06-17","endDate":"2026-06-18","dueDate":"2026-05-18","discountType":"AMOUNT","discountValue":0,"items":[{"rowId":"row_140o3q5c","serviceId":"svc_1781675555668","name":"DESYAUNO NUEVO","qty":1,"price":85,"quantityMode":"MANUAL","serviceDate":"2026-06-17"},{"rowId":"row_9h3ff3sl","serviceId":"svc_1781675555668","name":"DESYAUNO NUEVO","qty":1,"price":85,"quantityMode":"MANUAL","serviceDate":"2026-06-17"}],"templateId":"contrato_corp","currency":"GTQ","internalNotes":"","version":1,"versions":[],"paymentType":"","menuMontajeEntries":[],"menuMontajeVersion":1,"menuMontajeVersions":[],"advanceLogs":[{"id":"advlog_1781677553211_fb2rz","at":"2026-06-17T06:25:53.211Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"added","label":"Agregado","change":"Agregado anticipo: Q 10.00 - pago de evneto bi"},{"id":"advlog_1781677566301_rgdsz","at":"2026-06-17T06:26:06.301Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"deleted","label":"Eliminado","change":"Anticipo eliminado"},{"id":"advlog_1781677593235_g6bsc","at":"2026-06-17T06:26:33.235Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"added","label":"Agregado","change":"Agregado anticipo: Q 10.00 - pago banco bi"},{"id":"advlog_1781678603991_08p44","at":"2026-06-17T06:43:23.991Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"added","label":"Agregado","change":"Agregado anticipo: Q 13.00 - dfdf"},{"id":"advlog_1781678621303_ep5fi","at":"2026-06-17T06:43:41.303Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"deleted","label":"Eliminado","change":"Anticipo eliminado"},{"id":"advlog_1781678897974_oxyvw","at":"2026-06-17T06:48:17.974Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"added","label":"Agregado","change":"Agregado anticipo: Q 10.00 - dfdf"},{"id":"advlog_1781678906417_tbmsg","at":"2026-06-17T06:48:26.417Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"deleted","label":"Eliminado","change":"Anticipo eliminado"},{"id":"advlog_1781678949871_00cds","at":"2026-06-17T06:49:09.871Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"edited","label":"Editado","change":"Editado anticipo: Q 15.00 - pago banco bi"},{"id":"advlog_1781679087630_h0g7e","at":"2026-06-17T06:51:27.630Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"edited","label":"Editado","change":"Editado anticipo: Q 1154.00 - pago banco bi"},{"id":"advlog_1781679358073_erscz","at":"2026-06-17T06:55:58.073Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"edited","label":"Editado","change":"Editado anticipo: Q 114.00 - pago banco bi"},{"id":"advlog_1781679375444_z60zj","at":"2026-06-17T06:56:15.444Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"added","label":"Agregado","change":"Agregado anticipo: Q 5.00 - dfdf"},{"id":"advlog_1781731059485_t6t69","at":"2026-06-17T21:17:39.485Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"added","label":"Agregado","change":"Agregado anticipo: Q 51.00 - BANCO INDUSTRIAL"}],"subtotal":170,"discountAmount":0,"total":170,"quotedAt":"2026-06-17T21:34:43.120Z"}', '2026-06-17 01:26:46', '2026-06-18 00:49:25'),
	('evt_a1326fe1_s1_20260618', 'evt_a1326fe1', 'MANTENIMIENTO', 'ElDeck', '2026-06-18', '2026-06-17', '2026-06-18', '07:00:00', '10:00:00', 'Confirmado', 'usr_1781742734393', 10, NULL, '{"companyId":"cmp_1781675622316","companyName":"TIGO GUATEMALA","managerId":"mgr_1781675621093","managerName":"CARLOS SAMALAJ","contact":"CARLOS SAMALAJ","email":"TSAMALAJ@GMAIL.COM","phone":"56325547","nit":"9457877","billTo":"CARLOS SAMALAJ","address":"Calle Monterrey Panajachel Solola","eventType":"Social","venue":"San Pedro","schedule":"","code":"COT-001","docDate":"2026-06-17","people":200,"eventDate":"2026-06-17","endDate":"2026-06-18","dueDate":"2026-05-18","discountType":"AMOUNT","discountValue":0,"items":[{"rowId":"row_140o3q5c","serviceId":"svc_1781675555668","name":"DESYAUNO NUEVO","qty":1,"price":85,"quantityMode":"MANUAL","serviceDate":"2026-06-17"},{"rowId":"row_9h3ff3sl","serviceId":"svc_1781675555668","name":"DESYAUNO NUEVO","qty":1,"price":85,"quantityMode":"MANUAL","serviceDate":"2026-06-17"}],"templateId":"contrato_corp","currency":"GTQ","internalNotes":"","version":1,"versions":[],"paymentType":"","menuMontajeEntries":[],"menuMontajeVersion":1,"menuMontajeVersions":[],"advanceLogs":[{"id":"advlog_1781677553211_fb2rz","at":"2026-06-17T06:25:53.211Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"added","label":"Agregado","change":"Agregado anticipo: Q 10.00 - pago de evneto bi"},{"id":"advlog_1781677566301_rgdsz","at":"2026-06-17T06:26:06.301Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"deleted","label":"Eliminado","change":"Anticipo eliminado"},{"id":"advlog_1781677593235_g6bsc","at":"2026-06-17T06:26:33.235Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"added","label":"Agregado","change":"Agregado anticipo: Q 10.00 - pago banco bi"},{"id":"advlog_1781678603991_08p44","at":"2026-06-17T06:43:23.991Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"added","label":"Agregado","change":"Agregado anticipo: Q 13.00 - dfdf"},{"id":"advlog_1781678621303_ep5fi","at":"2026-06-17T06:43:41.303Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"deleted","label":"Eliminado","change":"Anticipo eliminado"},{"id":"advlog_1781678897974_oxyvw","at":"2026-06-17T06:48:17.974Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"added","label":"Agregado","change":"Agregado anticipo: Q 10.00 - dfdf"},{"id":"advlog_1781678906417_tbmsg","at":"2026-06-17T06:48:26.417Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"deleted","label":"Eliminado","change":"Anticipo eliminado"},{"id":"advlog_1781678949871_00cds","at":"2026-06-17T06:49:09.871Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"edited","label":"Editado","change":"Editado anticipo: Q 15.00 - pago banco bi"},{"id":"advlog_1781679087630_h0g7e","at":"2026-06-17T06:51:27.630Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"edited","label":"Editado","change":"Editado anticipo: Q 1154.00 - pago banco bi"},{"id":"advlog_1781679358073_erscz","at":"2026-06-17T06:55:58.073Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"edited","label":"Editado","change":"Editado anticipo: Q 114.00 - pago banco bi"},{"id":"advlog_1781679375444_z60zj","at":"2026-06-17T06:56:15.444Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"added","label":"Agregado","change":"Agregado anticipo: Q 5.00 - dfdf"},{"id":"advlog_1781731059485_t6t69","at":"2026-06-17T21:17:39.485Z","actorName":"Carlos Roberto Samalaj","actorId":"Keg6VRrMFLdJK9aslxy7sG2mxFI2","tone":"added","label":"Agregado","change":"Agregado anticipo: Q 51.00 - BANCO INDUSTRIAL"}],"subtotal":170,"discountAmount":0,"total":170,"quotedAt":"2026-06-17T21:34:43.120Z"}', '2026-06-17 01:26:46', '2026-06-18 00:49:25');

-- Dumping structure for table crm_jdl.historial_anticipos
CREATE TABLE IF NOT EXISTS `historial_anticipos` (
  `id` varchar(100) NOT NULL,
  `id_anticipo` varchar(100) NOT NULL,
  `id_evento` varchar(30) NOT NULL,
  `accion` varchar(20) NOT NULL DEFAULT 'added',
  `id_usuario_actor` varchar(100) DEFAULT NULL,
  `nombre_usuario_actor` varchar(255) DEFAULT NULL,
  `detalle` text DEFAULT NULL,
  `creado_en_iso` varchar(50) DEFAULT NULL,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_historial_anticipos_evento` (`id_evento`),
  KEY `idx_historial_anticipos_anticipo` (`id_anticipo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table crm_jdl.historial_anticipos: ~93 rows (approximately)
INSERT INTO `historial_anticipos` (`id`, `id_anticipo`, `id_evento`, `accion`, `id_usuario_actor`, `nombre_usuario_actor`, `detalle`, `creado_en_iso`, `creado_en`) VALUES
	('ha_1781678621346_9jaw2', 'adv_1781678603991_d3zev', 'evt_a1326fe1', 'deleted', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Anticipo eliminado', '2026-06-17T06:43:41.303Z', '2026-06-17 06:43:41'),
	('ha_1781678906445_1rpss', 'adv_1781678897974_xltbw', 'evt_a1326fe1', 'deleted', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Anticipo eliminado', '2026-06-17T06:48:26.417Z', '2026-06-17 06:48:26'),
	('ha_1781679087661_vstme', 'adv_1781677593235_xvibv', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 1154.00 - pago banco bi', '2026-06-17T06:51:27.630Z', '2026-06-17 06:51:27'),
	('ha_1781679087672_gp8nf', 'adv_1781677593235_xvibv', 'evt_a1326fe1_s1_20260618', 'added', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Agregado anticipo: Q 10.00 - dfdf', '2026-06-17T06:48:17.974Z', '2026-06-17 06:51:27'),
	('ha_1781679358109_mlnzh', 'adv_1781677593235_xvibv', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 06:55:58'),
	('ha_1781679358120_fe6ep', 'adv_1781677593235_xvibv', 'evt_a1326fe1_s1_20260618', 'added', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Agregado anticipo: Q 10.00 - dfdf', '2026-06-17T06:48:17.974Z', '2026-06-17 06:55:58'),
	('ha_1781679375477_ozmjp', 'adv_1781677593235_xvibv', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 06:56:15'),
	('ha_1781679375486_iqchk', 'adv_1781679375444_9bgba', 'evt_a1326fe1', 'added', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Agregado anticipo: Q 5.00 - dfdf', '2026-06-17T06:56:15.444Z', '2026-06-17 06:56:15'),
	('ha_1781679375521_7ub42', 'adv_1781677593235_xvibv', 'evt_a1326fe1_s1_20260618', 'added', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Agregado anticipo: Q 5.00 - dfdf', '2026-06-17T06:56:15.444Z', '2026-06-17 06:56:15'),
	('ha_1781679375531_7j07u', 'adv_1781679375444_9bgba', 'evt_a1326fe1_s1_20260618', 'added', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Agregado anticipo: Q 5.00 - dfdf', '2026-06-17T06:56:15.444Z', '2026-06-17 06:56:15'),
	('ha_1781679962708_97fxm', 'adv_1781677593235_xvibv', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 07:06:02'),
	('ha_1781679962731_9uybf', 'adv_1781679375444_9bgba', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 07:06:02'),
	('ha_1781681556669_yr1a1', 'adv_1781677593235_xvibv', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 07:32:36'),
	('ha_1781681556678_f9z0a', 'adv_1781679375444_9bgba', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 07:32:36'),
	('ha_1781681583353_bmruh', 'adv_1781677593235_xvibv', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 07:33:03'),
	('ha_1781681583374_2rcn9', 'adv_1781679375444_9bgba', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 07:33:03'),
	('ha_1781681598662_diwgj', 'adv_1781677593235_xvibv', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 07:33:18'),
	('ha_1781681598670_0ihob', 'adv_1781679375444_9bgba', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 07:33:18'),
	('ha_1781681605559_zkaw6', 'adv_1781677593235_xvibv', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 07:33:25'),
	('ha_1781681605567_6zrfd', 'adv_1781679375444_9bgba', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 07:33:25'),
	('ha_1781681612111_61l48', 'adv_1781677593235_xvibv', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 07:33:32'),
	('ha_1781681612120_ogced', 'adv_1781679375444_9bgba', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 07:33:32'),
	('ha_1781681616860_s5pou', 'adv_1781677593235_xvibv', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 07:33:36'),
	('ha_1781681616867_7vv3l', 'adv_1781679375444_9bgba', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 07:33:36'),
	('ha_1781681621395_1phav', 'adv_1781677593235_xvibv', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 07:33:41'),
	('ha_1781681621404_u6sjk', 'adv_1781679375444_9bgba', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 07:33:41'),
	('ha_1781681640115_3exdf', 'adv_1781677593235_xvibv', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 07:34:00'),
	('ha_1781681640122_h7i93', 'adv_1781679375444_9bgba', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 07:34:00'),
	('ha_1781681649421_d398w', 'adv_1781677593235_xvibv', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 07:34:09'),
	('ha_1781681649428_jy1i4', 'adv_1781679375444_9bgba', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 07:34:09'),
	('ha_1781681658878_qwum2', 'adv_1781677593235_xvibv', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 07:34:18'),
	('ha_1781681658892_4khv9', 'adv_1781679375444_9bgba', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 07:34:18'),
	('ha_1781681687545_vlz74', 'adv_1781677593235_xvibv', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 07:34:47'),
	('ha_1781681687556_aapmd', 'adv_1781679375444_9bgba', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 07:34:47'),
	('ha_1781681889127_0x9q6', 'adv_1781677593235_xvibv', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 07:38:09'),
	('ha_1781681889135_0sqh9', 'adv_1781679375444_9bgba', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 07:38:09'),
	('ha_1781681889808_j9nam', 'adv_1781677593235_xvibv', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 07:38:09'),
	('ha_1781681889816_yo6gl', 'adv_1781679375444_9bgba', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 07:38:09'),
	('ha_1781729908102_aq5li', 'adv_1781677593235_xvibv', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 20:58:28'),
	('ha_1781729908113_8sw3t', 'adv_1781679375444_9bgba', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 20:58:28'),
	('ha_1781729935861_vnnte', 'adv_1781677593235_xvibv', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 20:58:55'),
	('ha_1781729935870_b006y', 'adv_1781679375444_9bgba', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 20:58:55'),
	('ha_1781730058564_ykt41', 'adv_1781677593235_xvibv', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 21:00:58'),
	('ha_1781730058587_y8rmt', 'adv_1781679375444_9bgba', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 21:00:58'),
	('ha_1781730549015_r55vw', 'adv_1781677593235_xvibv', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 21:09:09'),
	('ha_1781730549023_7futq', 'adv_1781679375444_9bgba', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 21:09:09'),
	('ha_1781730564724_yuxt6', 'adv_1781677593235_xvibv', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 21:09:24'),
	('ha_1781730564732_r2kxr', 'adv_1781679375444_9bgba', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 21:09:24'),
	('ha_1781730567321_57z4z', 'adv_1781677593235_xvibv', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 21:09:27'),
	('ha_1781730567328_49noe', 'adv_1781679375444_9bgba', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 21:09:27'),
	('ha_1781730568101_4urpv', 'adv_1781677593235_xvibv', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 21:09:28'),
	('ha_1781730568115_6n4ud', 'adv_1781679375444_9bgba', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 21:09:28'),
	('ha_1781730577336_f1z0h', 'adv_1781677593235_xvibv', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 21:09:37'),
	('ha_1781730577344_gxcnj', 'adv_1781679375444_9bgba', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 21:09:37'),
	('ha_1781730586498_kn1f8', 'adv_1781677593235_xvibv', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 21:09:46'),
	('ha_1781730586507_xxhd3', 'adv_1781679375444_9bgba', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 21:09:46'),
	('ha_1781730598024_xjcxj', 'adv_1781677593235_xvibv', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 21:09:58'),
	('ha_1781730598033_22azm', 'adv_1781679375444_9bgba', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 21:09:58'),
	('ha_1781730636511_xst7g', 'adv_1781677593235_xvibv', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 21:10:36'),
	('ha_1781730636519_mf0ki', 'adv_1781679375444_9bgba', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 21:10:36'),
	('ha_1781730798066_muh2l', 'adv_1781677593235_xvibv', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 21:13:18'),
	('ha_1781730798073_0ciwk', 'adv_1781679375444_9bgba', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 21:13:18'),
	('ha_1781730805485_g2eef', 'adv_1781677593235_xvibv', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 21:13:25'),
	('ha_1781730805493_ocrmk', 'adv_1781679375444_9bgba', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 21:13:25'),
	('ha_1781730809869_67a4r', 'adv_1781677593235_xvibv', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 21:13:29'),
	('ha_1781730809876_b3maw', 'adv_1781679375444_9bgba', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 21:13:29'),
	('ha_1781730815156_rp1ab', 'adv_1781677593235_xvibv', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 21:13:35'),
	('ha_1781730815164_earff', 'adv_1781679375444_9bgba', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 21:13:35'),
	('ha_1781730822187_uqke7', 'adv_1781677593235_xvibv', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 21:13:42'),
	('ha_1781730822195_0g9jb', 'adv_1781679375444_9bgba', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 21:13:42'),
	('ha_1781730841569_la0pr', 'adv_1781677593235_xvibv', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 21:14:01'),
	('ha_1781730841577_d8a5c', 'adv_1781679375444_9bgba', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 21:14:01'),
	('ha_1781730847334_e23ob', 'adv_1781677593235_xvibv', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 21:14:07'),
	('ha_1781730847351_txf82', 'adv_1781679375444_9bgba', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 21:14:07'),
	('ha_1781730851871_enmym', 'adv_1781677593235_xvibv', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 21:14:11'),
	('ha_1781730851880_y7dzf', 'adv_1781679375444_9bgba', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 21:14:11'),
	('ha_1781730856941_i3kaf', 'adv_1781677593235_xvibv', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 21:14:16'),
	('ha_1781730856950_3wdpv', 'adv_1781679375444_9bgba', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 21:14:16'),
	('ha_1781730879910_1cp3p', 'adv_1781677593235_xvibv', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 21:14:39'),
	('ha_1781730879918_hntr3', 'adv_1781679375444_9bgba', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 21:14:39'),
	('ha_1781730907563_zioiz', 'adv_1781677593235_xvibv', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 21:15:07'),
	('ha_1781730907571_0fa5f', 'adv_1781679375444_9bgba', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 21:15:07'),
	('ha_1781731009108_l1a9t', 'adv_1781677593235_xvibv', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 21:16:49'),
	('ha_1781731009117_q5wa8', 'adv_1781679375444_9bgba', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 21:16:49'),
	('ha_1781731059532_9dmll', 'adv_1781677593235_xvibv', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 21:17:39'),
	('ha_1781731059540_jwovh', 'adv_1781679375444_9bgba', 'evt_a1326fe1', 'edited', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Editado anticipo: Q 114.00 - pago banco bi', '2026-06-17T06:55:58.073Z', '2026-06-17 21:17:39'),
	('ha_1781731059564_a4j05', 'adv_1781731059485_ouyx9', 'evt_a1326fe1', 'added', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Agregado anticipo: Q 51.00 - BANCO INDUSTRIAL', '2026-06-17T21:17:39.485Z', '2026-06-17 21:17:39'),
	('ha_1781731059624_bv78r', 'adv_1781677593235_xvibv', 'evt_a1326fe1_s1_20260618', 'added', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Agregado anticipo: Q 51.00 - BANCO INDUSTRIAL', '2026-06-17T21:17:39.485Z', '2026-06-17 21:17:39'),
	('ha_1781731059646_sdc3v', 'adv_1781679375444_9bgba', 'evt_a1326fe1_s1_20260618', 'added', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Agregado anticipo: Q 51.00 - BANCO INDUSTRIAL', '2026-06-17T21:17:39.485Z', '2026-06-17 21:17:39'),
	('ha_1781731059651_puxdl', 'adv_1781731059485_ouyx9', 'evt_a1326fe1_s1_20260618', 'added', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Agregado anticipo: Q 51.00 - BANCO INDUSTRIAL', '2026-06-17T21:17:39.485Z', '2026-06-17 21:17:39'),
	('ha_1781732083157_swu95', 'adv_1781677593235_xvibv', 'evt_a1326fe1', 'deleted', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Anticipo eliminado', '2026-06-17T06:48:26.417Z', '2026-06-17 21:34:43'),
	('ha_1781732083157_t8qxk', 'adv_1781679375444_9bgba', 'evt_a1326fe1', 'deleted', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Anticipo eliminado', '2026-06-17T06:48:26.417Z', '2026-06-17 21:34:43'),
	('ha_1781732083158_m8dkg', 'adv_1781731059485_ouyx9', 'evt_a1326fe1', 'deleted', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Anticipo eliminado', '2026-06-17T06:48:26.417Z', '2026-06-17 21:34:43');

-- Dumping structure for table crm_jdl.historial_evento
CREATE TABLE IF NOT EXISTS `historial_evento` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `clave_evento` varchar(30) DEFAULT NULL,
  `cambiado_en_iso` varchar(50) DEFAULT NULL,
  `cambiado_en` datetime DEFAULT NULL,
  `id_usuario_actor` varchar(30) DEFAULT NULL,
  `nombre_actor` varchar(200) DEFAULT NULL,
  `cambio_texto` text NOT NULL,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_historial_clave_evento` (`clave_evento`),
  KEY `idx_historial_usuario_actor` (`id_usuario_actor`)
) ENGINE=InnoDB AUTO_INCREMENT=3640 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table crm_jdl.historial_evento: ~5 rows (approximately)
INSERT INTO `historial_evento` (`id`, `clave_evento`, `cambiado_en_iso`, `cambiado_en`, `id_usuario_actor`, `nombre_actor`, `cambio_texto`, `creado_en`) VALUES
	(3635, 'evt_75276114_s1_20260620', '2026-06-18T07:11:59.576Z', '2026-06-18 01:11:59', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Cambios: • Fecha de inicio: "2026-06-20" → "2026-06-19", • Encargado: "usr_1781742734393" → "user_prereg_1781734502892"', '2026-06-18 07:21:47'),
	(3636, 'evt_75276114_s1_20260620', '2026-06-18T06:28:55.269Z', '2026-06-18 00:28:55', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Cambios: • Fecha de inicio: "2026-06-20" → "2026-06-19"', '2026-06-18 07:21:47'),
	(3637, 'evt_9f50fb80', '2026-06-18T00:00:17.841Z', '2026-06-17 18:00:17', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Reserva creada', '2026-06-18 07:21:47'),
	(3638, 'evt_a1326fe1', '2026-06-18T00:49:25.776Z', '2026-06-17 18:49:25', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Cambios: • Salón: "San Pedro" → "ElDeck", • Cantidad de personas: "200" → "10"', '2026-06-18 07:21:47'),
	(3639, 'evt_75276114', '2026-06-18T00:49:36.126Z', '2026-06-17 18:49:36', 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'Carlos Roberto Samalaj', 'Cambios: • Salón: "San Pedro" → "Helipuerto JDL", • Cantidad de personas: "51" → "15", • quote: "-" → "-"', '2026-06-18 07:21:47');

-- Dumping structure for table crm_jdl.informe_comentarios
CREATE TABLE IF NOT EXISTS `informe_comentarios` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `informe_id` int(11) NOT NULL,
  `dia_id` int(11) DEFAULT NULL,
  `usuario_id` varchar(30) DEFAULT NULL,
  `contenido` text NOT NULL,
  `mencion_a_id` varchar(255) DEFAULT NULL,
  `reacciones` text DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `informe_id` (`informe_id`),
  KEY `dia_id` (`dia_id`),
  KEY `fk_informe_comentarios_usuario` (`usuario_id`),
  CONSTRAINT `fk_informe_comentarios_informe` FOREIGN KEY (`informe_id`) REFERENCES `informes_eventos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_informe_comentarios_dia` FOREIGN KEY (`dia_id`) REFERENCES `informe_dias_detalle` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_informe_comentarios_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table crm_jdl.informe_comentarios: ~6 rows (approximately)
INSERT INTO `informe_comentarios` (`id`, `informe_id`, `dia_id`, `usuario_id`, `contenido`, `mencion_a_id`, `reacciones`, `created_at`) VALUES
	(1, 27, NULL, NULL, 'Test comment mentioning someone @Kevin Bixcul M', '', NULL, '2026-06-14 12:42:41'),
	(2, 27, NULL, NULL, 'Test comment mentioning someone @Kevin Bixcul M', '', NULL, '2026-06-14 12:43:01'),
	(3, 27, NULL, NULL, 'Test comment mentioning someone @Kevin Bixcul M', '', NULL, '2026-06-14 12:43:06'),
	(4, 27, NULL, NULL, 'Test comment mentioning someone @Kevin Bixcul M', '', NULL, '2026-06-14 12:43:25'),
	(5, 27, NULL, NULL, 'Test comment mentioning someone @Kevin Bixcul M', 'kLy8WstSA9SFw8fKkdW88BKEKci2', NULL, '2026-06-14 12:43:38'),
	(6, 29, NULL, NULL, '@Carlos Samalaj 2 Revisar montaje', 'JGiUdbmVWgQG0dt7rov5hbG4uV52', NULL, '2026-06-14 17:58:21');

-- Dumping structure for table crm_jdl.informe_destacados
CREATE TABLE IF NOT EXISTS `informe_destacados` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `informe_id` int(11) NOT NULL,
  `dia_id` int(11) DEFAULT NULL,
  `usuario_id` varchar(80) NOT NULL,
  `razon` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `informe_id` (`informe_id`),
  KEY `dia_id` (`dia_id`),
  KEY `fk_informe_destacados_usuario` (`usuario_id`),
  CONSTRAINT `fk_informe_destacados_informe` FOREIGN KEY (`informe_id`) REFERENCES `informes_eventos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_informe_destacados_dia` FOREIGN KEY (`dia_id`) REFERENCES `informe_dias_detalle` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_informe_destacados_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table crm_jdl.informe_destacados: ~0 rows (approximately)

-- Dumping structure for table crm_jdl.informe_dia_menu_detalle
CREATE TABLE IF NOT EXISTS `informe_dia_menu_detalle` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `dia_id` int(11) NOT NULL,
  `menu_item_id` int(11) DEFAULT NULL,
  `ingrediente_id` int(11) NOT NULL,
  `opcion_id` int(11) DEFAULT NULL,
  `metodo_preparacion` varchar(100) DEFAULT NULL,
  `cantidad_total` decimal(10,2) DEFAULT 0.00,
  `notas` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `dia_id` (`dia_id`),
  KEY `ingrediente_id` (`ingrediente_id`),
  KEY `opcion_id` (`opcion_id`),
  CONSTRAINT `fk_informe_dia_menu_detalle_dia` FOREIGN KEY (`dia_id`) REFERENCES `informe_dias_detalle` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_informe_dia_menu_detalle_ingrediente` FOREIGN KEY (`ingrediente_id`) REFERENCES `cat_ingredientes` (`id`),
  CONSTRAINT `fk_informe_dia_menu_detalle_opcion` FOREIGN KEY (`opcion_id`) REFERENCES `cat_opciones_ingrediente` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=158 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table crm_jdl.informe_dia_menu_detalle: ~24 rows (approximately)
INSERT INTO `informe_dia_menu_detalle` (`id`, `dia_id`, `menu_item_id`, `ingrediente_id`, `opcion_id`, `metodo_preparacion`, `cantidad_total`, `notas`) VALUES
	(112, 23, NULL, 5, NULL, NULL, 1.00, NULL),
	(113, 23, NULL, 10, NULL, NULL, 1.00, NULL),
	(114, 23, NULL, 13, NULL, NULL, 1.00, NULL),
	(115, 23, NULL, 14, NULL, NULL, 1.00, NULL),
	(116, 23, NULL, 20, NULL, NULL, 1.00, NULL),
	(117, 23, NULL, 25, NULL, NULL, 1.00, NULL),
	(118, 24, NULL, 5, NULL, 'Al vapor', 10.00, NULL),
	(119, 24, NULL, 10, NULL, NULL, 1.00, NULL),
	(120, 24, NULL, 16, NULL, NULL, 1.00, NULL),
	(121, 24, NULL, 14, NULL, NULL, 1.00, NULL),
	(122, 24, NULL, 22, NULL, NULL, 1.00, NULL),
	(123, 24, NULL, 20, NULL, NULL, 1.00, NULL),
	(124, 24, NULL, 25, NULL, NULL, 1.00, NULL),
	(135, 27, NULL, 27, NULL, NULL, 1.00, NULL),
	(136, 27, NULL, 3, NULL, NULL, 45.00, NULL),
	(137, 27, NULL, 7, NULL, NULL, 1.00, NULL),
	(138, 27, NULL, 12, NULL, NULL, 1.00, NULL),
	(139, 27, NULL, 21, NULL, NULL, 1.00, NULL),
	(152, 30, NULL, 25, NULL, NULL, 1.00, NULL),
	(153, 30, NULL, 5, NULL, 'A la plancha', 100.00, 'sins al'),
	(154, 30, NULL, 10, NULL, NULL, 1.00, NULL),
	(155, 30, NULL, 13, NULL, NULL, 1.00, NULL),
	(156, 30, NULL, 20, NULL, NULL, 1.00, NULL),
	(157, 30, NULL, 14, NULL, NULL, 1.00, NULL);

-- Dumping structure for table crm_jdl.informe_dias_detalle
CREATE TABLE IF NOT EXISTS `informe_dias_detalle` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `informe_id` int(11) NOT NULL,
  `fecha_evento` date NOT NULL,
  `menu_id` int(11) DEFAULT NULL,
  `descripcion_montaje` text DEFAULT NULL,
  `comentario_menu` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `informe_id` (`informe_id`),
  KEY `menu_id` (`menu_id`),
  CONSTRAINT `fk_informe_dias_detalle_informe` FOREIGN KEY (`informe_id`) REFERENCES `informes_eventos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_informe_dias_detalle_menu` FOREIGN KEY (`menu_id`) REFERENCES `cat_menus` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table crm_jdl.informe_dias_detalle: ~3 rows (approximately)
INSERT INTO `informe_dias_detalle` (`id`, `informe_id`, `fecha_evento`, `menu_id`, `descripcion_montaje`) VALUES
	(23, 27, '2026-06-11', 8, '{"_v":2,"montajes":[],"alertas":[],"alertaCustom":""}'),
	(24, 28, '2026-06-14', NULL, '{"_v":2,"montajes":[],"alertas":[],"alertaCustom":""}'),
	(27, 29, '2026-06-14', NULL, '{"_v":2,"montajes":[{"salon":"Santa Cruz","tipo_montaje":"Imperial","num_personas":"45","horario":"13:00","equipo_necesario":"Bocinas, Microfono, Pantalla","manteleria":"Azul y Blanco","mesas":"Redondas","sillas":"Chavarry"}],"alertas":["Vegano"],"alertaCustom":""}'),
	(30, 30, '2026-06-18', NULL, '{"_v":2,"montajes":[{"salon":"Salon san pedro","tipo_montaje":"Escuela","num_personas":"100","horario":"8a 11","equipo_necesario":"Cañonera, Microfono, Pantalla","manteleria":"blanco con azul","cristaleria":"critaleria nueva","mesas":"Rectangulares","sillas":"Chavarry"},{"salon":"san pedro","tipo_montaje":"Imperial","num_personas":"10","horario":"8 a 10","equipo_necesario":"Cañonera, Bocinas","manteleria":"blanco y azul","cristaleria":"azul","mesas":"Redondas","sillas":"Chavarry"}],"alertas":["Sin Gluten"],"alertaCustom":""}');

-- Dumping structure for table crm_jdl.informe_historial
CREATE TABLE IF NOT EXISTS `informe_historial` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `informe_id` int(11) NOT NULL,
  `usuario_id` varchar(30) DEFAULT NULL,
  `accion` varchar(100) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `informe_id` (`informe_id`),
  KEY `fk_informe_historial_usuario` (`usuario_id`),
  CONSTRAINT `fk_informe_historial_informe` FOREIGN KEY (`informe_id`) REFERENCES `informes_eventos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_informe_historial_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=159 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table crm_jdl.informe_historial: ~39 rows (approximately)
INSERT INTO `informe_historial` (`id`, `informe_id`, `usuario_id`, `accion`, `descripcion`, `created_at`) VALUES
	(116, 27, NULL, 'CREAR_VERSION', 'Se creó la versión 1', '2026-06-11 17:11:34'),
	(117, 27, NULL, 'lectura', 'Marcó el informe como leído', '2026-06-11 17:11:34'),
	(118, 27, NULL, 'lectura', 'Marcó el informe como leído', '2026-06-11 17:11:34'),
	(119, 27, NULL, 'lectura', 'Marcó el informe como leído', '2026-06-11 17:19:14'),
	(120, 27, NULL, 'lectura', 'Marcó el informe como leído', '2026-06-11 17:19:14'),
	(121, 27, NULL, 'lectura', 'Marcó el informe como leído', '2026-06-11 17:20:49'),
	(122, 27, NULL, 'lectura', 'Marcó el informe como leído', '2026-06-11 17:20:49'),
	(123, 27, NULL, 'lectura', 'Marcó el informe como leído', '2026-06-11 17:24:15'),
	(124, 27, NULL, 'lectura', 'Marcó el informe como leído', '2026-06-11 17:27:38'),
	(125, 27, NULL, 'lectura', 'Marcó el informe como leído', '2026-06-11 17:27:38'),
	(126, 27, NULL, 'lectura', 'Marcó el informe como leído', '2026-06-11 17:28:08'),
	(127, 27, NULL, 'lectura', 'Marcó el informe como leído', '2026-06-11 17:28:08'),
	(128, 27, NULL, 'lectura', 'Marcó el informe como leído', '2026-06-11 17:30:37'),
	(129, 27, NULL, 'lectura', 'Marcó el informe como leído', '2026-06-11 17:30:37'),
	(130, 27, 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'lectura', 'Marcó el informe como leído', '2026-06-13 15:03:57'),
	(131, 27, 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'lectura', 'Marcó el informe como leído', '2026-06-13 15:03:57'),
	(132, 27, 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'destacado', 'Destacó una sección del informe', '2026-06-13 15:04:11'),
	(134, 27, NULL, 'comentario', 'Agregó un comentario al informe', '2026-06-14 12:42:41'),
	(135, 27, NULL, 'comentario', 'Agregó un comentario al informe', '2026-06-14 12:43:01'),
	(136, 27, NULL, 'comentario', 'Agregó un comentario al informe', '2026-06-14 12:43:06'),
	(137, 27, NULL, 'comentario', 'Agregó un comentario al informe', '2026-06-14 12:43:25'),
	(138, 27, NULL, 'comentario', 'Agregó un comentario al informe', '2026-06-14 12:43:38'),
	(139, 29, NULL, 'CREAR_VERSION', 'Se creó la versión 1', '2026-06-14 17:47:40'),
	(140, 29, NULL, 'lectura', 'Marcó el informe como leído', '2026-06-14 17:47:40'),
	(141, 29, NULL, 'lectura', 'Marcó el informe como leído', '2026-06-14 17:47:40'),
	(142, 29, NULL, 'REEMPLAZAR_DIAS', 'Se reemplazaron los días del informe', '2026-06-14 17:49:21'),
	(143, 29, NULL, 'lectura', 'Marcó el informe como leído', '2026-06-14 17:49:21'),
	(144, 29, NULL, 'lectura', 'Marcó el informe como leído', '2026-06-14 17:49:21'),
	(145, 29, NULL, 'REEMPLAZAR_DIAS', 'Se reemplazaron los días del informe', '2026-06-14 17:53:28'),
	(146, 29, NULL, 'lectura', 'Marcó el informe como leído', '2026-06-14 17:53:28'),
	(147, 29, NULL, 'lectura', 'Marcó el informe como leído', '2026-06-14 17:53:28'),
	(148, 29, NULL, 'lectura', 'Marcó el informe como leído', '2026-06-14 17:54:11'),
	(149, 29, NULL, 'lectura', 'Marcó el informe como leído', '2026-06-14 17:54:11'),
	(150, 29, NULL, 'lectura', 'Marcó el informe como leído', '2026-06-14 17:56:02'),
	(151, 29, NULL, 'lectura', 'Marcó el informe como leído', '2026-06-14 17:56:02'),
	(152, 29, NULL, 'comentario', 'Agregó un comentario al informe', '2026-06-14 17:58:21'),
	(153, 29, NULL, 'lectura', 'Marcó el informe como leído', '2026-06-14 17:59:53'),
	(154, 29, NULL, 'lectura', 'Marcó el informe como leído', '2026-06-14 17:59:53'),
	(155, 29, NULL, 'lectura', 'Marcó el informe como leído', '2026-06-14 18:00:07');

-- Dumping structure for table crm_jdl.informe_imagenes
CREATE TABLE IF NOT EXISTS `informe_imagenes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `informe_id` int(11) NOT NULL,
  `dia_id` int(11) DEFAULT NULL,
  `url` text NOT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `informe_id` (`informe_id`),
  KEY `dia_id` (`dia_id`),
  CONSTRAINT `fk_informe_imagenes_informe` FOREIGN KEY (`informe_id`) REFERENCES `informes_eventos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_informe_imagenes_dia` FOREIGN KEY (`dia_id`) REFERENCES `informe_dias_detalle` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table crm_jdl.informe_imagenes: ~0 rows (approximately)

-- Dumping structure for table crm_jdl.informe_lecturas
CREATE TABLE IF NOT EXISTS `informe_lecturas` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `informe_id` int(11) NOT NULL,
  `usuario_id` varchar(80) NOT NULL,
  `leido_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_lectura` (`informe_id`,`usuario_id`),
  KEY `fk_informe_lecturas_usuario` (`usuario_id`),
  CONSTRAINT `fk_informe_lecturas_informe` FOREIGN KEY (`informe_id`) REFERENCES `informes_eventos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_informe_lecturas_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=104 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table crm_jdl.informe_lecturas: ~1 rows (approximately)
INSERT INTO `informe_lecturas` (`id`, `informe_id`, `usuario_id`, `leido_at`) VALUES
	(79, 27, 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', '2026-06-13 15:03:57');

-- Dumping structure for table crm_jdl.informes_eventos
CREATE TABLE IF NOT EXISTS `informes_eventos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_ocupacion` varchar(255) NOT NULL,
  `version` int(11) DEFAULT 1,
  `fecha_creacion` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table crm_jdl.informes_eventos: ~2 rows (approximately)
INSERT INTO `informes_eventos` (`id`, `id_ocupacion`, `version`, `fecha_creacion`) VALUES
	(27, 'HAB02202644987', 1, '2026-06-11 17:11:34'),
	(28, 'evt_92f4e5f549b058_19ec76e1837', 1, '2026-06-14 12:40:06'),
	(29, 'evt_70d54b41f1ed8_19ec813ee27', 1, '2026-06-14 17:47:40'),
	(30, 'evt_75276114', 1, '2026-06-17 23:58:15');

-- Dumping structure for table crm_jdl.items_cotizacion_evento
CREATE TABLE IF NOT EXISTS `items_cotizacion_evento` (
  `id` varchar(200) NOT NULL,
  `id_evento` varchar(30) NOT NULL,
  `id_servicio` varchar(30) DEFAULT NULL,
  `fecha_servicio` date DEFAULT NULL,
  `cantidad` decimal(12,2) NOT NULL DEFAULT 0.00,
  `precio` decimal(12,2) NOT NULL DEFAULT 0.00,
  `nombre` varchar(260) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  `precio_unitario` decimal(12,2) NOT NULL DEFAULT 0.00,
  `modo_cantidad` varchar(12) NOT NULL DEFAULT 'MANUAL',
  `total_linea` decimal(12,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`),
  KEY `idx_items_cotizacion_evento` (`id_evento`),
  KEY `idx_items_cotizacion_servicio` (`id_servicio`),
  CONSTRAINT `fk_items_cotizacion_evento` FOREIGN KEY (`id_evento`) REFERENCES `cotizaciones_evento` (`id_evento`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table crm_jdl.items_cotizacion_evento: ~8 rows (approximately)
INSERT INTO `items_cotizacion_evento` (`id`, `id_evento`, `id_servicio`, `fecha_servicio`, `cantidad`, `precio`, `nombre`, `descripcion`, `creado_en`, `precio_unitario`, `modo_cantidad`, `total_linea`) VALUES
	('evt_75276114__row_2kabgyi0__2', 'evt_75276114', 'svc_1781759980734', '2026-06-20', 1.00, 185.00, 'DESAYUNO BUFFET', NULL, '2026-06-18 07:21:47', 185.00, 'MANUAL', 185.00),
	('evt_75276114__row_rjwz8acc__1', 'evt_75276114', 'svc_1781759980734', '2026-06-19', 1.00, 185.00, 'DESAYUNO BUFFET', NULL, '2026-06-18 07:21:47', 185.00, 'MANUAL', 185.00),
	('evt_75276114_s1_20260620__row_2kabgyi0__2', 'evt_75276114_s1_20260620', 'svc_1781759980734', '2026-06-20', 1.00, 185.00, 'DESAYUNO BUFFET', NULL, '2026-06-18 07:21:47', 185.00, 'MANUAL', 185.00),
	('evt_75276114_s1_20260620__row_rjwz8acc__1', 'evt_75276114_s1_20260620', 'svc_1781759980734', '2026-06-19', 1.00, 185.00, 'DESAYUNO BUFFET', NULL, '2026-06-18 07:21:47', 185.00, 'MANUAL', 185.00),
	('evt_a1326fe1__row_140o3q5c__1', 'evt_a1326fe1', 'svc_1781675555668', '2026-06-17', 1.00, 85.00, 'DESYAUNO NUEVO', NULL, '2026-06-18 07:21:47', 85.00, 'MANUAL', 85.00),
	('evt_a1326fe1__row_9h3ff3sl__2', 'evt_a1326fe1', 'svc_1781675555668', '2026-06-17', 1.00, 85.00, 'DESYAUNO NUEVO', NULL, '2026-06-18 07:21:47', 85.00, 'MANUAL', 85.00),
	('evt_a1326fe1_s1_20260618__row_140o3q5c__1', 'evt_a1326fe1_s1_20260618', 'svc_1781675555668', '2026-06-17', 1.00, 85.00, 'DESYAUNO NUEVO', NULL, '2026-06-18 07:21:47', 85.00, 'MANUAL', 85.00),
	('evt_a1326fe1_s1_20260618__row_9h3ff3sl__2', 'evt_a1326fe1_s1_20260618', 'svc_1781675555668', '2026-06-17', 1.00, 85.00, 'DESYAUNO NUEVO', NULL, '2026-06-18 07:21:47', 85.00, 'MANUAL', 85.00);

-- Dumping structure for table crm_jdl.items_cotizacion_version_evento
CREATE TABLE IF NOT EXISTS `items_cotizacion_version_evento` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `id_evento` varchar(30) NOT NULL,
  `version_num` int(11) NOT NULL,
  `fila_num` int(11) NOT NULL,
  `id_servicio` varchar(30) DEFAULT NULL,
  `fecha_servicio` date DEFAULT NULL,
  `cantidad` decimal(12,2) NOT NULL DEFAULT 0.00,
  `precio` decimal(12,2) NOT NULL DEFAULT 0.00,
  `nombre` varchar(240) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `precio_unitario` decimal(12,2) NOT NULL DEFAULT 0.00,
  `modo_cantidad` varchar(12) NOT NULL DEFAULT 'MANUAL',
  `total_linea` decimal(12,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`),
  KEY `idx_items_cotizacion_version_evento` (`id_evento`,`version_num`)
) ENGINE=InnoDB AUTO_INCREMENT=1593 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table crm_jdl.items_cotizacion_version_evento: ~8 rows (approximately)
INSERT INTO `items_cotizacion_version_evento` (`id`, `id_evento`, `version_num`, `fila_num`, `id_servicio`, `fecha_servicio`, `cantidad`, `precio`, `nombre`, `descripcion`, `precio_unitario`, `modo_cantidad`, `total_linea`) VALUES
	(1585, 'evt_a1326fe1', 1, 1, 'svc_1781675555668', '2026-06-17', 1.00, 85.00, 'DESYAUNO NUEVO', NULL, 85.00, 'MANUAL', 85.00),
	(1586, 'evt_a1326fe1', 1, 2, 'svc_1781675555668', '2026-06-17', 1.00, 85.00, 'DESYAUNO NUEVO', NULL, 85.00, 'MANUAL', 85.00),
	(1587, 'evt_a1326fe1_s1_20260618', 1, 1, 'svc_1781675555668', '2026-06-17', 1.00, 85.00, 'DESYAUNO NUEVO', NULL, 85.00, 'MANUAL', 85.00),
	(1588, 'evt_a1326fe1_s1_20260618', 1, 2, 'svc_1781675555668', '2026-06-17', 1.00, 85.00, 'DESYAUNO NUEVO', NULL, 85.00, 'MANUAL', 85.00),
	(1589, 'evt_75276114', 1, 1, 'svc_1781759980734', '2026-06-19', 1.00, 185.00, 'DESAYUNO BUFFET', NULL, 185.00, 'MANUAL', 185.00),
	(1590, 'evt_75276114', 1, 2, 'svc_1781759980734', '2026-06-20', 1.00, 185.00, 'DESAYUNO BUFFET', NULL, 185.00, 'MANUAL', 185.00),
	(1591, 'evt_75276114_s1_20260620', 1, 1, 'svc_1781759980734', '2026-06-19', 1.00, 185.00, 'DESAYUNO BUFFET', NULL, 185.00, 'MANUAL', 185.00),
	(1592, 'evt_75276114_s1_20260620', 1, 2, 'svc_1781759980734', '2026-06-20', 1.00, 185.00, 'DESAYUNO BUFFET', NULL, 185.00, 'MANUAL', 185.00);

-- Dumping structure for table crm_jdl.menu_bebidas
CREATE TABLE IF NOT EXISTS `menu_bebidas` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(180) NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_menu_bebidas_nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Dumping data for table crm_jdl.menu_bebidas: ~0 rows (approximately)

-- Dumping structure for table crm_jdl.menu_comentarios_adicionales
CREATE TABLE IF NOT EXISTS `menu_comentarios_adicionales` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(240) NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_menu_comentarios_adicionales_nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Dumping data for table crm_jdl.menu_comentarios_adicionales: ~0 rows (approximately)

-- Dumping structure for table crm_jdl.menu_guarniciones
CREATE TABLE IF NOT EXISTS `menu_guarniciones` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(180) NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_menu_guarniciones_nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Dumping data for table crm_jdl.menu_guarniciones: ~3 rows (approximately)
INSERT INTO `menu_guarniciones` (`id`, `nombre`, `activo`, `creado_en`) VALUES
	(1, 'Puré de Papa Rústico', 1, '2026-05-21 20:02:06'),
	(2, 'Vegetales al Vapor', 1, '2026-05-21 20:02:06'),
	(3, 'Arroz Almendrado', 1, '2026-05-21 20:02:06');

-- Dumping structure for table crm_jdl.menu_items
CREATE TABLE IF NOT EXISTS `menu_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `menu_id` int(11) NOT NULL,
  `ingrediente_id` int(11) NOT NULL,
  `opcion_id` int(11) DEFAULT NULL,
  `cantidad` decimal(10,2) NOT NULL DEFAULT 1.00,
  PRIMARY KEY (`id`),
  KEY `menu_id` (`menu_id`),
  KEY `ingrediente_id` (`ingrediente_id`),
  KEY `opcion_id` (`opcion_id`),
  CONSTRAINT `fk_menu_items_menu` FOREIGN KEY (`menu_id`) REFERENCES `cat_menus` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_menu_items_ingrediente` FOREIGN KEY (`ingrediente_id`) REFERENCES `cat_ingredientes` (`id`),
  CONSTRAINT `fk_menu_items_opcion` FOREIGN KEY (`opcion_id`) REFERENCES `cat_opciones_ingrediente` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=33 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table crm_jdl.menu_items: ~32 rows (approximately)
INSERT INTO `menu_items` (`id`, `menu_id`, `ingrediente_id`, `opcion_id`, `cantidad`) VALUES
	(1, 1, 2, 4, 1.00),
	(2, 1, 7, NULL, 1.00),
	(3, 1, 25, NULL, 1.00),
	(4, 2, 5, 11, 1.00),
	(5, 2, 8, NULL, 1.00),
	(6, 2, 20, NULL, 1.00),
	(7, 2, 28, NULL, 1.00),
	(8, 3, 10, 16, 1.00),
	(9, 3, 1, 2, 1.00),
	(10, 3, 9, 14, 1.00),
	(11, 3, 19, NULL, 1.00),
	(12, 3, 29, NULL, 1.00),
	(13, 4, 4, 10, 1.00),
	(14, 4, 12, 18, 1.00),
	(15, 4, 15, 19, 1.00),
	(16, 4, 22, NULL, 1.00),
	(17, 4, 30, NULL, 1.00),
	(18, 5, 2, 5, 1.00),
	(19, 5, 11, NULL, 1.00),
	(20, 5, 21, NULL, 1.00),
	(21, 5, 26, NULL, 1.00),
	(22, 6, 9, 15, 1.00),
	(23, 6, 7, NULL, 1.00),
	(24, 6, 15, 20, 1.00),
	(25, 6, 23, NULL, 1.00),
	(26, 6, 24, NULL, 1.00),
	(27, 7, 2, 4, 1.00),
	(28, 7, 13, NULL, 1.00),
	(29, 7, 27, NULL, 1.00),
	(30, 8, 5, 12, 1.00),
	(31, 8, 14, NULL, 1.00),
	(32, 8, 28, NULL, 1.00);

-- Dumping structure for table crm_jdl.menu_montaje_plantilla_adicional
CREATE TABLE IF NOT EXISTS `menu_montaje_plantilla_adicional` (
  `id_detalle` bigint(20) unsigned NOT NULL,
  `id_montaje_tipo` bigint(20) unsigned DEFAULT NULL,
  `id_adicional` bigint(20) unsigned NOT NULL,
  `cantidad` int(11) DEFAULT NULL,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_detalle`,`id_adicional`),
  KEY `idx_menu_montaje_plantilla_adicional_tipo` (`id_montaje_tipo`),
  KEY `idx_menu_montaje_plantilla_adicional_adicional` (`id_adicional`),
  CONSTRAINT `fk_menu_montaje_plantilla_adicional_adicional` FOREIGN KEY (`id_adicional`) REFERENCES `montaje_adicionales` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_menu_montaje_plantilla_adicional_detalle` FOREIGN KEY (`id_detalle`) REFERENCES `menu_montaje_plantilla_detalle` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_menu_montaje_plantilla_adicional_tipo` FOREIGN KEY (`id_montaje_tipo`) REFERENCES `montaje_tipos` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Dumping data for table crm_jdl.menu_montaje_plantilla_adicional: ~0 rows (approximately)

-- Dumping structure for table crm_jdl.menu_montaje_plantilla_detalle
CREATE TABLE IF NOT EXISTS `menu_montaje_plantilla_detalle` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `id_plantilla` bigint(20) unsigned NOT NULL,
  `id_plato_fuerte` bigint(20) unsigned DEFAULT NULL,
  `id_preparacion` bigint(20) unsigned DEFAULT NULL,
  `id_salsa` bigint(20) unsigned DEFAULT NULL,
  `id_postre` bigint(20) unsigned DEFAULT NULL,
  `cantidad` int(11) DEFAULT NULL,
  `notas` text DEFAULT NULL,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_menu_montaje_plantilla_detalle_plantilla` (`id_plantilla`),
  KEY `idx_menu_montaje_plantilla_detalle_plato` (`id_plato_fuerte`),
  KEY `idx_menu_montaje_plantilla_detalle_preparacion` (`id_preparacion`),
  KEY `idx_menu_montaje_plantilla_detalle_salsa` (`id_salsa`),
  KEY `idx_menu_montaje_plantilla_detalle_postre` (`id_postre`),
  CONSTRAINT `fk_menu_montaje_plantilla_detalle_plantilla` FOREIGN KEY (`id_plantilla`) REFERENCES `menu_montaje_plantillas` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_menu_montaje_plantilla_detalle_plato` FOREIGN KEY (`id_plato_fuerte`) REFERENCES `menu_platos_fuertes` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_menu_montaje_plantilla_detalle_postre` FOREIGN KEY (`id_postre`) REFERENCES `menu_postres` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_menu_montaje_plantilla_detalle_preparacion` FOREIGN KEY (`id_preparacion`) REFERENCES `menu_preparaciones` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_menu_montaje_plantilla_detalle_salsa` FOREIGN KEY (`id_salsa`) REFERENCES `menu_salsas` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Dumping data for table crm_jdl.menu_montaje_plantilla_detalle: ~0 rows (approximately)

-- Dumping structure for table crm_jdl.menu_montaje_plantilla_guarnicion
CREATE TABLE IF NOT EXISTS `menu_montaje_plantilla_guarnicion` (
  `id_detalle` bigint(20) unsigned NOT NULL,
  `id_guarnicion` bigint(20) unsigned NOT NULL,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_detalle`,`id_guarnicion`),
  KEY `idx_menu_montaje_plantilla_guarnicion_guarnicion` (`id_guarnicion`),
  CONSTRAINT `fk_menu_montaje_plantilla_guarnicion_detalle` FOREIGN KEY (`id_detalle`) REFERENCES `menu_montaje_plantilla_detalle` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_menu_montaje_plantilla_guarnicion_guarnicion` FOREIGN KEY (`id_guarnicion`) REFERENCES `menu_guarniciones` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Dumping data for table crm_jdl.menu_montaje_plantilla_guarnicion: ~0 rows (approximately)

-- Dumping structure for table crm_jdl.menu_montaje_plantillas
CREATE TABLE IF NOT EXISTS `menu_montaje_plantillas` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(200) NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_menu_montaje_plantillas_nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Dumping data for table crm_jdl.menu_montaje_plantillas: ~0 rows (approximately)

-- Dumping structure for table crm_jdl.menu_plato_guarnicion_sugerida
CREATE TABLE IF NOT EXISTS `menu_plato_guarnicion_sugerida` (
  `id_plato_fuerte` bigint(20) unsigned NOT NULL,
  `id_guarnicion` bigint(20) unsigned NOT NULL,
  `prioridad` int(11) NOT NULL DEFAULT 1,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_plato_fuerte`,`id_guarnicion`),
  KEY `idx_menu_plato_guarnicion_sugerida_guarnicion` (`id_guarnicion`),
  CONSTRAINT `fk_menu_plato_guarnicion_guarnicion` FOREIGN KEY (`id_guarnicion`) REFERENCES `menu_guarniciones` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_menu_plato_guarnicion_plato` FOREIGN KEY (`id_plato_fuerte`) REFERENCES `menu_platos_fuertes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Dumping data for table crm_jdl.menu_plato_guarnicion_sugerida: ~0 rows (approximately)

-- Dumping structure for table crm_jdl.menu_plato_preparacion_bebida_sugerida
CREATE TABLE IF NOT EXISTS `menu_plato_preparacion_bebida_sugerida` (
  `id_plato_fuerte` bigint(20) unsigned NOT NULL,
  `id_preparacion` bigint(20) unsigned NOT NULL,
  `id_bebida` bigint(20) unsigned NOT NULL,
  `prioridad` int(11) NOT NULL DEFAULT 1,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_plato_fuerte`,`id_preparacion`,`id_bebida`),
  KEY `idx_menu_pp_bebida_bebida` (`id_bebida`),
  KEY `fk_menu_pp_bebida_preparacion` (`id_preparacion`),
  CONSTRAINT `fk_menu_pp_bebida_item` FOREIGN KEY (`id_bebida`) REFERENCES `menu_bebidas` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_menu_pp_bebida_plato` FOREIGN KEY (`id_plato_fuerte`) REFERENCES `menu_platos_fuertes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_menu_pp_bebida_preparacion` FOREIGN KEY (`id_preparacion`) REFERENCES `menu_preparaciones` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Dumping data for table crm_jdl.menu_plato_preparacion_bebida_sugerida: ~0 rows (approximately)

-- Dumping structure for table crm_jdl.menu_plato_preparacion_guarnicion_sugerida
CREATE TABLE IF NOT EXISTS `menu_plato_preparacion_guarnicion_sugerida` (
  `id_plato_fuerte` bigint(20) unsigned NOT NULL,
  `id_preparacion` bigint(20) unsigned NOT NULL,
  `id_guarnicion` bigint(20) unsigned NOT NULL,
  `prioridad` int(11) NOT NULL DEFAULT 1,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_plato_fuerte`,`id_preparacion`,`id_guarnicion`),
  KEY `idx_menu_pp_guarnicion_guarnicion` (`id_guarnicion`),
  KEY `fk_menu_pp_guarnicion_preparacion` (`id_preparacion`),
  CONSTRAINT `fk_menu_pp_guarnicion_item` FOREIGN KEY (`id_guarnicion`) REFERENCES `menu_guarniciones` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_menu_pp_guarnicion_plato` FOREIGN KEY (`id_plato_fuerte`) REFERENCES `menu_platos_fuertes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_menu_pp_guarnicion_preparacion` FOREIGN KEY (`id_preparacion`) REFERENCES `menu_preparaciones` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Dumping data for table crm_jdl.menu_plato_preparacion_guarnicion_sugerida: ~0 rows (approximately)

-- Dumping structure for table crm_jdl.menu_plato_preparacion_montaje_adicional_sugerido
CREATE TABLE IF NOT EXISTS `menu_plato_preparacion_montaje_adicional_sugerido` (
  `id_plato_fuerte` bigint(20) unsigned NOT NULL,
  `id_preparacion` bigint(20) unsigned NOT NULL,
  `id_adicional` bigint(20) unsigned NOT NULL,
  `prioridad` int(11) NOT NULL DEFAULT 1,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_plato_fuerte`,`id_preparacion`,`id_adicional`),
  KEY `idx_menu_pp_montaje_adicional_adicional` (`id_adicional`),
  KEY `fk_menu_pp_montaje_adicional_preparacion` (`id_preparacion`),
  CONSTRAINT `fk_menu_pp_montaje_adicional_item` FOREIGN KEY (`id_adicional`) REFERENCES `montaje_adicionales` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_menu_pp_montaje_adicional_plato` FOREIGN KEY (`id_plato_fuerte`) REFERENCES `menu_platos_fuertes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_menu_pp_montaje_adicional_preparacion` FOREIGN KEY (`id_preparacion`) REFERENCES `menu_preparaciones` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Dumping data for table crm_jdl.menu_plato_preparacion_montaje_adicional_sugerido: ~0 rows (approximately)

-- Dumping structure for table crm_jdl.menu_plato_preparacion_montaje_tipo_sugerido
CREATE TABLE IF NOT EXISTS `menu_plato_preparacion_montaje_tipo_sugerido` (
  `id_plato_fuerte` bigint(20) unsigned NOT NULL,
  `id_preparacion` bigint(20) unsigned NOT NULL,
  `id_montaje_tipo` bigint(20) unsigned NOT NULL,
  `prioridad` int(11) NOT NULL DEFAULT 1,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_plato_fuerte`,`id_preparacion`,`id_montaje_tipo`),
  KEY `idx_menu_pp_montaje_tipo_tipo` (`id_montaje_tipo`),
  KEY `fk_menu_pp_montaje_tipo_preparacion` (`id_preparacion`),
  CONSTRAINT `fk_menu_pp_montaje_tipo_item` FOREIGN KEY (`id_montaje_tipo`) REFERENCES `montaje_tipos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_menu_pp_montaje_tipo_plato` FOREIGN KEY (`id_plato_fuerte`) REFERENCES `menu_platos_fuertes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_menu_pp_montaje_tipo_preparacion` FOREIGN KEY (`id_preparacion`) REFERENCES `menu_preparaciones` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Dumping data for table crm_jdl.menu_plato_preparacion_montaje_tipo_sugerido: ~0 rows (approximately)

-- Dumping structure for table crm_jdl.menu_plato_preparacion_postre_sugerido
CREATE TABLE IF NOT EXISTS `menu_plato_preparacion_postre_sugerido` (
  `id_plato_fuerte` bigint(20) unsigned NOT NULL,
  `id_preparacion` bigint(20) unsigned NOT NULL,
  `id_postre` bigint(20) unsigned NOT NULL,
  `prioridad` int(11) NOT NULL DEFAULT 1,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_plato_fuerte`,`id_preparacion`,`id_postre`),
  KEY `idx_menu_pp_postre_postre` (`id_postre`),
  KEY `fk_menu_pp_postre_preparacion` (`id_preparacion`),
  CONSTRAINT `fk_menu_pp_postre_item` FOREIGN KEY (`id_postre`) REFERENCES `menu_postres` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_menu_pp_postre_plato` FOREIGN KEY (`id_plato_fuerte`) REFERENCES `menu_platos_fuertes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_menu_pp_postre_preparacion` FOREIGN KEY (`id_preparacion`) REFERENCES `menu_preparaciones` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Dumping data for table crm_jdl.menu_plato_preparacion_postre_sugerido: ~0 rows (approximately)

-- Dumping structure for table crm_jdl.menu_plato_preparacion_salsa_sugerida
CREATE TABLE IF NOT EXISTS `menu_plato_preparacion_salsa_sugerida` (
  `id_plato_fuerte` bigint(20) unsigned NOT NULL,
  `id_preparacion` bigint(20) unsigned NOT NULL,
  `id_salsa` bigint(20) unsigned NOT NULL,
  `prioridad` int(11) NOT NULL DEFAULT 1,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_plato_fuerte`,`id_preparacion`,`id_salsa`),
  KEY `idx_menu_pp_salsa_salsa` (`id_salsa`),
  KEY `fk_menu_pp_salsa_preparacion` (`id_preparacion`),
  CONSTRAINT `fk_menu_pp_salsa_item` FOREIGN KEY (`id_salsa`) REFERENCES `menu_salsas` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_menu_pp_salsa_plato` FOREIGN KEY (`id_plato_fuerte`) REFERENCES `menu_platos_fuertes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_menu_pp_salsa_preparacion` FOREIGN KEY (`id_preparacion`) REFERENCES `menu_preparaciones` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Dumping data for table crm_jdl.menu_plato_preparacion_salsa_sugerida: ~0 rows (approximately)

-- Dumping structure for table crm_jdl.menu_platos_fuertes
CREATE TABLE IF NOT EXISTS `menu_platos_fuertes` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(180) NOT NULL,
  `tipo_plato` varchar(20) NOT NULL DEFAULT 'NORMAL',
  `es_sin_proteina` tinyint(1) NOT NULL DEFAULT 0,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_menu_platos_fuertes_nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table crm_jdl.menu_platos_fuertes: ~3 rows (approximately)
INSERT INTO `menu_platos_fuertes` (`id`, `nombre`, `tipo_plato`, `es_sin_proteina`, `activo`, `creado_en`) VALUES
	(1, 'Medallones de Res al Vino Tinto', 'NORMAL', 0, 1, '2026-05-21 20:02:06'),
	(2, 'Pechuga Cordon Bleu', 'NORMAL', 0, 1, '2026-05-21 20:02:06'),
	(3, 'Lasaña Vegetariana', 'VEGETARIANO', 1, 1, '2026-05-21 20:02:06');

-- Dumping structure for table crm_jdl.menu_postres
CREATE TABLE IF NOT EXISTS `menu_postres` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(180) NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_menu_postres_nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Dumping data for table crm_jdl.menu_postres: ~3 rows (approximately)
INSERT INTO `menu_postres` (`id`, `nombre`, `activo`, `creado_en`) VALUES
	(1, 'Tiramisú Clásico', 1, '2026-05-21 20:02:06'),
	(2, 'Cheesecake de Frambuesa', 1, '2026-05-21 20:02:06'),
	(3, 'Flan Napolitano', 1, '2026-05-21 20:02:06');

-- Dumping structure for table crm_jdl.menu_preparacion_postre_sugerido
CREATE TABLE IF NOT EXISTS `menu_preparacion_postre_sugerido` (
  `id_preparacion` bigint(20) unsigned NOT NULL,
  `id_postre` bigint(20) unsigned NOT NULL,
  `prioridad` int(11) NOT NULL DEFAULT 1,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_preparacion`,`id_postre`),
  KEY `idx_menu_preparacion_postre_sugerido_postre` (`id_postre`),
  CONSTRAINT `fk_menu_preparacion_postre_postre` FOREIGN KEY (`id_postre`) REFERENCES `menu_postres` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_menu_preparacion_postre_preparacion` FOREIGN KEY (`id_preparacion`) REFERENCES `menu_preparaciones` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Dumping data for table crm_jdl.menu_preparacion_postre_sugerido: ~0 rows (approximately)

-- Dumping structure for table crm_jdl.menu_preparacion_salsa_sugerida
CREATE TABLE IF NOT EXISTS `menu_preparacion_salsa_sugerida` (
  `id_preparacion` bigint(20) unsigned NOT NULL,
  `id_salsa` bigint(20) unsigned NOT NULL,
  `prioridad` int(11) NOT NULL DEFAULT 1,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_preparacion`,`id_salsa`),
  KEY `idx_menu_preparacion_salsa_sugerida_salsa` (`id_salsa`),
  CONSTRAINT `fk_menu_preparacion_sugerida_preparacion` FOREIGN KEY (`id_preparacion`) REFERENCES `menu_preparaciones` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_menu_preparacion_sugerida_salsa` FOREIGN KEY (`id_salsa`) REFERENCES `menu_salsas` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table crm_jdl.menu_preparacion_salsa_sugerida: ~0 rows (approximately)

-- Dumping structure for table crm_jdl.menu_preparaciones
CREATE TABLE IF NOT EXISTS `menu_preparaciones` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `id_plato_fuerte` bigint(20) unsigned NOT NULL,
  `nombre` varchar(180) NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_menu_preparaciones_plato_nombre` (`id_plato_fuerte`,`nombre`),
  KEY `idx_menu_preparaciones_plato` (`id_plato_fuerte`),
  CONSTRAINT `fk_menu_preparaciones_plato` FOREIGN KEY (`id_plato_fuerte`) REFERENCES `menu_platos_fuertes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table crm_jdl.menu_preparaciones: ~0 rows (approximately)

-- Dumping structure for table crm_jdl.menu_salsas
CREATE TABLE IF NOT EXISTS `menu_salsas` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(180) NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_menu_salsas_nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table crm_jdl.menu_salsas: ~3 rows (approximately)
INSERT INTO `menu_salsas` (`id`, `nombre`, `activo`, `creado_en`) VALUES
	(1, 'Salsa de Champiñones', 1, '2026-05-21 20:02:06'),
	(2, 'Salsa a la Pimienta', 1, '2026-05-21 20:02:06'),
	(3, 'Jus de Ternera', 1, '2026-05-21 20:02:06');

-- Dumping structure for table crm_jdl.montaje_adicionales
CREATE TABLE IF NOT EXISTS `montaje_adicionales` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(180) NOT NULL,
  `tipo` varchar(120) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_montaje_adicionales_nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Dumping data for table crm_jdl.montaje_adicionales: ~3 rows (approximately)
INSERT INTO `montaje_adicionales` (`id`, `nombre`, `tipo`, `activo`, `creado_en`) VALUES
	(1, 'Arreglo Floral Centro', 'DECORACION', 1, '2026-05-21 20:02:06'),
	(2, 'Mantelería Blanca', 'MANTELERIA', 1, '2026-05-21 20:02:06'),
	(3, 'Pizarrón Blanco + Marcadores', 'EQUIPO', 1, '2026-05-21 20:02:06');

-- Dumping structure for table crm_jdl.montaje_tipo_adicional_sugerido
CREATE TABLE IF NOT EXISTS `montaje_tipo_adicional_sugerido` (
  `id_montaje_tipo` bigint(20) unsigned NOT NULL,
  `id_adicional` bigint(20) unsigned NOT NULL,
  `prioridad` int(11) NOT NULL DEFAULT 1,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_montaje_tipo`,`id_adicional`),
  KEY `idx_montaje_tipo_adicional_sugerido_adicional` (`id_adicional`),
  CONSTRAINT `fk_montaje_tipo_adicional_sugerido_adicional` FOREIGN KEY (`id_adicional`) REFERENCES `montaje_adicionales` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_montaje_tipo_adicional_sugerido_tipo` FOREIGN KEY (`id_montaje_tipo`) REFERENCES `montaje_tipos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Dumping data for table crm_jdl.montaje_tipo_adicional_sugerido: ~0 rows (approximately)

-- Dumping structure for table crm_jdl.montaje_tipos
CREATE TABLE IF NOT EXISTS `montaje_tipos` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(180) NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_montaje_tipos_nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

-- Dumping data for table crm_jdl.montaje_tipos: ~4 rows (approximately)
INSERT INTO `montaje_tipos` (`id`, `nombre`, `activo`, `creado_en`) VALUES
	(1, 'Montaje Imperial', 1, '2026-05-21 20:02:06'),
	(2, 'Montaje Escuela', 1, '2026-05-21 20:02:06'),
	(3, 'Montaje Ruso', 1, '2026-05-21 20:02:06'),
	(4, 'Auditorio', 1, '2026-05-21 20:02:06');

-- Dumping structure for table crm_jdl.notificaciones
CREATE TABLE IF NOT EXISTS `notificaciones` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `usuario_id` varchar(80) DEFAULT NULL,
  `tipo` varchar(60) NOT NULL DEFAULT 'informe',
  `titulo` varchar(180) DEFAULT NULL,
  `mensaje` text DEFAULT NULL,
  `informe_id` int(11) DEFAULT NULL,
  `idocupacion` varchar(255) DEFAULT NULL,
  `leido` tinyint(1) DEFAULT 0,
  `fecha_creacion` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_notificaciones_usuario` (`usuario_id`),
  CONSTRAINT `fk_notificaciones_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=156 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table crm_jdl.notificaciones: ~36 rows (approximately)
INSERT INTO `notificaciones` (`id`, `usuario_id`, `tipo`, `titulo`, `mensaje`, `informe_id`, `idocupacion`, `leido`, `fecha_creacion`) VALUES
	(117, NULL, 'informe', 'Informe v1 creado', 'Se creó la versión 1 del informe para HOPE 4 KIDS', 23, 'HAB02202644987', 1, '2026-06-09 23:41:12'),
	(118, NULL, 'mencion', 'Te mencionaron en una nota', 'Admin Demo te mencionó en una nota del evento', NULL, 'HAB02202644987', 0, '2026-06-10 01:01:31'),
	(119, NULL, 'mencion', 'Te mencionaron en un comentario', 'Admin Demo te mencionó en el informe', 23, 'HAB02202644987', 0, '2026-06-10 01:27:37'),
	(120, NULL, 'informe', 'Informe v1 creado', 'Se creó la versión 1 del informe para PROPUESTA DE MATRIMONIO CARLOS MARTIN', 24, 'HAB02202645003', 1, '2026-06-10 01:28:32'),
	(121, NULL, 'mencion', 'Te mencionaron en una nota', 'Admin Demo te mencionó en una nota del evento', NULL, 'HAB02202645003', 1, '2026-06-10 14:38:47'),
	(122, NULL, 'informe', 'Informe v1 creado', 'Se creó la versión 1 del informe para FOOD FOR THE HUNGRY', 25, 'HAB09202645461', 1, '2026-06-10 14:45:12'),
	(123, NULL, 'mencion', 'Te mencionaron en un comentario', 'Coordinador Demo te mencionó en el informe', 24, 'HAB02202645003', 0, '2026-06-10 14:57:39'),
	(124, NULL, 'informe', 'Informe creado', 'Se creó un informe para 15 AÑOS CARRANZA. Revisa los detalles del menú asignado.', 1, NULL, 1, '2026-06-10 16:38:42'),
	(125, NULL, 'comentario', 'Nuevo comentario', 'Coordinador agregó un comentario al informe de BODA CORTEZ SAMS: "Confirmar número de asistentes para el montaje."', 1, NULL, 1, '2026-06-10 16:38:42'),
	(126, NULL, 'alerta', 'Cambio de estado', 'El evento BODA CORTEZ SAMS cambió de Pre-reserva a Confirmado.', NULL, NULL, 0, '2026-06-10 16:38:42'),
	(127, NULL, 'recordatorio', 'Evento próximo', 'BODA RODOLFO MOGOLLÓN — faltan 3 días. Verifica detalles del servicio y menú.', NULL, NULL, 0, '2026-06-10 16:38:42'),
	(128, NULL, 'informe', 'Informe actualizado', 'Se actualizó el informe de BODA PEREIRA MILLAN con nuevos datos del menú ejecutivo.', 1, NULL, 0, '2026-06-10 16:38:42'),
	(129, NULL, 'alerta', 'Nota agregada', 'Se agregó una nota importante al evento 15 AÑOS CARRANZA: "Cliente solicita opción vegetariana adicional."', NULL, NULL, 1, '2026-06-10 16:38:42'),
	(130, NULL, 'comentario', 'Mencion recibida', '@Admin te mencionó en un comentario del informe de BODA CORTEZ SAMS.', 1, NULL, 1, '2026-06-10 16:38:42'),
	(131, NULL, 'recordatorio', 'Tareas pendientes', 'Tienes 3 informes pendientes por revisar.', NULL, NULL, 0, '2026-06-10 16:38:42'),
	(132, NULL, 'mencion', 'Te mencionaron en un comentario', 'Admin Demo te mencionó en el informe', 24, 'HAB02202645003', 0, '2026-06-10 16:42:32'),
	(133, NULL, 'mencion', 'Te mencionaron en un comentario', 'Admin Demo te mencionó en el informe', 24, 'HAB02202645003', 0, '2026-06-10 16:44:51'),
	(134, NULL, 'mencion', 'Te mencionaron en una nota', 'Coordinador Demo te mencionó en una nota del evento', NULL, 'HAB14202510224', 0, '2026-06-10 17:10:07'),
	(135, NULL, 'informe', 'Informe v1 creado', 'Se creó la versión 1 del informe para CHENCHO TOURS', 26, 'HAB22202644346', 1, '2026-06-10 19:06:23'),
	(136, NULL, 'informe', 'Informe creado', 'Se creó un informe para 15 AÑOS CARRANZA. Revisa los detalles del menú asignado.', 1, NULL, 1, '2026-06-11 14:50:08'),
	(137, NULL, 'comentario', 'Nuevo comentario', 'Coordinador agregó un comentario al informe de BODA CORTEZ SAMS: "Confirmar número de asistentes para el montaje."', 1, NULL, 1, '2026-06-11 14:50:08'),
	(138, NULL, 'alerta', 'Cambio de estado', 'El evento BODA CORTEZ SAMS cambió de Pre-reserva a Confirmado.', NULL, NULL, 1, '2026-06-11 14:50:08'),
	(139, NULL, 'recordatorio', 'Evento próximo', 'BODA RODOLFO MOGOLLÓN — faltan 3 días. Verifica detalles del servicio y menú.', NULL, NULL, 0, '2026-06-11 14:50:08'),
	(140, NULL, 'informe', 'Informe actualizado', 'Se actualizó el informe de BODA PEREIRA MILLAN con nuevos datos del menú ejecutivo.', 1, NULL, 0, '2026-06-11 14:50:08'),
	(141, NULL, 'alerta', 'Nota agregada', 'Se agregó una nota importante al evento 15 AÑOS CARRANZA: "Cliente solicita opción vegetariana adicional."', NULL, NULL, 1, '2026-06-11 14:50:08'),
	(142, NULL, 'comentario', 'Mencion recibida', '@Admin te mencionó en un comentario del informe de BODA CORTEZ SAMS.', 1, NULL, 1, '2026-06-11 14:50:08'),
	(143, NULL, 'recordatorio', 'Tareas pendientes', 'Tienes 3 informes pendientes por revisar.', NULL, NULL, 1, '2026-06-11 14:50:08'),
	(144, NULL, 'informe', 'Informe v1 creado', 'Se creó la versión 1 del informe para HOPE 4 KIDS', 27, 'HAB02202644987', 1, '2026-06-11 17:11:34'),
	(145, NULL, 'mencion', 'Te mencionaron en una nota', 'Admin Demo te mencionó en una nota del evento', NULL, 'HAB22202644346', 0, '2026-06-11 17:28:57'),
	(146, NULL, 'mencion', 'Te mencionaron en una nota', 'Admin Demo te mencionó en una nota del evento', NULL, 'HAB02202644987', 0, '2026-06-11 17:34:56'),
	(147, NULL, 'informe', 'Informe v1 creado', 'Se creó la versión 1 del informe para carlos', 28, 'evt_92f4e5f549b058_19ec76e1837', 0, '2026-06-14 12:40:06'),
	(149, NULL, 'mencion', 'Te mencionaron en un comentario', 'Carlos Roberto Samalaj te mencionó en el informe', 27, 'HAB02202644987', 0, '2026-06-14 12:43:38'),
	(150, NULL, 'mencion', 'Te mencionaron en una nota', 'Carlos Roberto Samalaj te mencionó en una nota del evento', NULL, 'HAB02202644987', 0, '2026-06-14 12:43:38'),
	(151, 'Keg6VRrMFLdJK9aslxy7sG2mxFI2', 'mencion', 'Te mencionaron en una nota', 'Carlos Roberto Samalaj te mencionó en una nota del evento', NULL, 'evt_92f4e5f549b058_19ec76e1837', 0, '2026-06-14 12:50:07'),
	(152, NULL, 'informe', 'Informe v1 creado', 'Se creó la versión 1 del informe para Cumpleaños de Kevin', 29, 'evt_70d54b41f1ed8_19ec813ee27', 0, '2026-06-14 17:47:40'),
	(153, NULL, 'mencion', 'Te mencionaron en un comentario', 'Sistemas Admin te mencionó en el informe', 29, 'evt_70d54b41f1ed8_19ec813ee27', 1, '2026-06-14 17:58:21'),
	(154, 'user_prereg_1781679962646', 'mencion', 'Te mencionaron en una nota', 'Carlos Roberto Samalaj te mencionó en una nota del evento', NULL, 'evt_a1326fe1', 0, '2026-06-17 01:06:48'),
	(155, NULL, 'informe', 'Informe v1 creado', 'Se creó la versión 1 del informe para Cena familiar', 30, 'evt_75276114', 0, '2026-06-17 23:58:15');

-- Dumping structure for table crm_jdl.platillo_componentes
CREATE TABLE IF NOT EXISTS `platillo_componentes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `platillo_id` int(11) NOT NULL,
  `ingrediente_id` int(11) NOT NULL,
  `opcion_id` int(11) DEFAULT NULL,
  `tipo_componente` varchar(100) NOT NULL DEFAULT 'proteina',
  `cantidad` decimal(10,2) NOT NULL DEFAULT 1.00,
  `orden` int(11) DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `platillo_id` (`platillo_id`),
  KEY `ingrediente_id` (`ingrediente_id`),
  KEY `opcion_id` (`opcion_id`),
  CONSTRAINT `fk_platillo_componentes_platillo` FOREIGN KEY (`platillo_id`) REFERENCES `cat_platillos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_platillo_componentes_ingrediente` FOREIGN KEY (`ingrediente_id`) REFERENCES `cat_ingredientes` (`id`),
  CONSTRAINT `fk_platillo_componentes_opcion` FOREIGN KEY (`opcion_id`) REFERENCES `cat_opciones_ingrediente` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table crm_jdl.platillo_componentes: ~13 rows (approximately)
INSERT INTO `platillo_componentes` (`id`, `platillo_id`, `ingrediente_id`, `opcion_id`, `tipo_componente`, `cantidad`, `orden`) VALUES
	(1, 1, 31, NULL, 'proteina', 1.00, 0),
	(2, 1, 7, NULL, 'guarnicion', 1.00, 0),
	(3, 1, 13, NULL, 'guarnicion', 1.00, 0),
	(4, 1, 11, NULL, 'guarnicion', 1.00, 0),
	(5, 1, 8, NULL, 'guarnicion', 1.00, 0),
	(6, 1, 12, NULL, 'guarnicion', 1.00, 0),
	(7, 1, 20, NULL, 'postre', 1.00, 0),
	(8, 1, 24, NULL, 'bebida', 1.00, 0),
	(9, 2, 2, NULL, 'proteina', 1.00, 0),
	(10, 2, 7, NULL, 'guarnicion', 1.00, 0),
	(11, 2, 12, NULL, 'guarnicion', 1.00, 0),
	(12, 2, 21, NULL, 'postre', 1.00, 0),
	(13, 2, 27, NULL, 'bebida', 1.00, 0);

-- Dumping structure for table crm_jdl.recordatorios_evento
CREATE TABLE IF NOT EXISTS `recordatorios_evento` (
  `id` varchar(30) NOT NULL,
  `clave_evento` varchar(30) NOT NULL,
  `fecha_recordatorio` date DEFAULT NULL,
  `hora_recordatorio` time DEFAULT NULL,
  `medio` varchar(80) NOT NULL,
  `notas` text DEFAULT NULL,
  `creado_en_iso` varchar(50) DEFAULT NULL,
  `creado_en` datetime DEFAULT NULL,
  `id_usuario_creador` varchar(30) DEFAULT NULL,
  `creado_en_fila` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_recordatorios_clave_evento` (`clave_evento`),
  KEY `idx_recordatorios_fecha_hora` (`fecha_recordatorio`,`hora_recordatorio`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table crm_jdl.recordatorios_evento: ~0 rows (approximately)

-- Dumping structure for table crm_jdl.salones
CREATE TABLE IF NOT EXISTS `salones` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(120) NOT NULL,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_salones_nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=1400 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table crm_jdl.salones: ~4 rows (approximately)
INSERT INTO `salones` (`id`, `nombre`, `creado_en`) VALUES
	(1396, 'ElDeck', '2026-06-18 07:21:47'),
	(1397, 'Helipuerto JDL', '2026-06-18 07:21:47'),
	(1398, 'Jardin 1 CF', '2026-06-18 07:21:47'),
	(1399, 'Jardin 2 CF', '2026-06-18 07:21:47');

-- Dumping structure for table crm_jdl.servicios
CREATE TABLE IF NOT EXISTS `servicios` (
  `id` varchar(30) NOT NULL,
  `nombre` varchar(220) NOT NULL,
  `precio` decimal(12,2) NOT NULL DEFAULT 0.00,
  `descripcion` text DEFAULT NULL,
  `id_categoria` bigint(20) unsigned DEFAULT NULL,
  `id_subcategoria` bigint(20) unsigned DEFAULT NULL,
  `modo_cantidad` varchar(12) NOT NULL DEFAULT 'MANUAL',
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_servicios_categoria` (`id_categoria`),
  KEY `idx_servicios_subcategoria` (`id_subcategoria`),
  CONSTRAINT `fk_servicios_categoria` FOREIGN KEY (`id_categoria`) REFERENCES `categorias_servicio` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_servicios_subcategoria` FOREIGN KEY (`id_subcategoria`) REFERENCES `subcategorias_servicio` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table crm_jdl.servicios: ~12 rows (approximately)
INSERT INTO `servicios` (`id`, `nombre`, `precio`, `descripcion`, `id_categoria`, `id_subcategoria`, `modo_cantidad`, `creado_en`) VALUES
	('srv_101', 'Menú 3 Tiempos Premium', 350.00, 'Entrada, plato fuerte y postre. Incluye pan y mantequilla.', 1, NULL, 'PAX', '2026-06-05 16:42:58'),
	('srv_102', 'Menú 2 Tiempos Ejecutivo', 220.00, 'Plato fuerte y postre.', 1, NULL, 'PAX', '2026-06-05 16:42:58'),
	('srv_103', 'Coffee Break Básico', 65.00, 'Café, té, agua y galletas.', 1, NULL, 'PAX', '2026-06-05 16:42:58'),
	('srv_201', 'Descorche por Botella', 150.00, 'Incluye servicio de mezcladores y cristalería.', 2, NULL, 'MANUAL', '2026-06-05 16:42:58'),
	('srv_202', 'Barra Libre Nacional (4 horas)', 280.00, 'Ron, Vodka, Tequila, Whisky nacional.', 2, NULL, 'PAX', '2026-06-05 16:42:58'),
	('srv_301', 'Alquiler Silla Tiffany (Extra)', 15.00, 'Silla adicional modelo Tiffany color blanco.', 3, NULL, 'MANUAL', '2026-06-05 16:42:58'),
	('srv_302', 'Proyector 4K + Pantalla', 850.00, 'Equipo audiovisual para presentaciones.', 3, NULL, 'MANUAL', '2026-06-05 16:42:58'),
	('srv_303', 'Pista de Baile Iluminada (Modulos)', 400.00, 'Precio por módulo de pista iluminada.', 3, NULL, 'MANUAL', '2026-06-05 16:42:58'),
	('srv_401', 'Mesero Extra', 350.00, 'Turno de 8 horas.', 4, NULL, 'MANUAL', '2026-06-05 16:42:58'),
	('srv_402', 'Valet Parking (Por Vehículo)', 45.00, 'Servicio de acomodo de vehículos.', 4, NULL, 'MANUAL', '2026-06-05 16:42:58'),
	('svc_1779259759227', 'Ambientacion', 50.00, NULL, 4, 18, 'MANUAL', '2026-06-05 16:42:58'),
	('svc_1779262561113', 'Salon con audio y video', 100.00, NULL, 4, 15, 'MANUAL', '2026-06-05 16:42:58');

-- Dumping structure for table crm_jdl.subcategorias_servicio
CREATE TABLE IF NOT EXISTS `subcategorias_servicio` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `id_categoria` bigint(20) unsigned NOT NULL,
  `nombre` varchar(140) NOT NULL,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_subcategorias_servicio` (`id_categoria`,`nombre`),
  KEY `idx_subcategorias_servicio_categoria` (`id_categoria`),
  CONSTRAINT `fk_subcategorias_categoria` FOREIGN KEY (`id_categoria`) REFERENCES `categorias_servicio` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table crm_jdl.subcategorias_servicio: ~18 rows (approximately)
INSERT INTO `subcategorias_servicio` (`id`, `id_categoria`, `nombre`, `creado_en`, `activo`) VALUES
	(1, 1, 'Desayunos', '2026-05-20 14:33:53', 1),
	(2, 1, 'Almuerzos', '2026-05-20 14:33:53', 1),
	(3, 1, 'Cenas', '2026-05-20 14:33:53', 1),
	(4, 1, 'Coffee Break', '2026-05-20 14:33:53', 1),
	(5, 1, 'Boquitas', '2026-05-20 14:33:53', 1),
	(6, 1, 'Bebidas', '2026-05-20 14:33:53', 1),
	(7, 1, 'Refacciones', '2026-05-20 14:33:53', 1),
	(8, 1, 'Otros', '2026-05-20 14:33:53', 1),
	(9, 2, 'Habitaciones JDL', '2026-05-20 14:33:53', 1),
	(10, 2, 'Paquetes Habitacion', '2026-05-20 14:33:53', 1),
	(11, 2, 'Otros', '2026-05-20 14:33:53', 1),
	(12, 3, 'Habitaciones Terceros', '2026-05-20 14:33:53', 1),
	(13, 3, 'Otros', '2026-05-20 14:33:53', 1),
	(14, 4, 'Montaje y Decoracion', '2026-05-20 14:33:53', 1),
	(15, 4, 'Equipo y Audiovisual', '2026-05-20 14:33:53', 1),
	(16, 4, 'Musica y Entretenimiento', '2026-05-20 14:33:53', 1),
	(17, 4, 'Transporte', '2026-05-20 14:33:53', 1),
	(18, 4, 'Otros', '2026-05-20 14:33:53', 1);

-- Dumping structure for view crm_jdl.tbl_seguimientocotizaciones
-- Creating temporary table to overcome VIEW dependency errors
CREATE TABLE `tbl_seguimientocotizaciones` (
	`Idocupacion` VARCHAR(1) NOT NULL COLLATE 'utf8mb4_unicode_ci',
	`Institucion` VARCHAR(1) NOT NULL COLLATE 'utf8mb4_unicode_ci',
	`Pax` INT(11) NULL,
	`Estatuscotizacion` INT(1) NOT NULL,
	`Vendedor` VARCHAR(1) NULL COLLATE 'utf8mb4_unicode_ci',
	`FechaEvento` DATE NOT NULL,
	`FechaSalida` DATE NULL,
	`HoraI` TIME NOT NULL,
	`HoraF` TIME NOT NULL,
	`TipoEvento` VARCHAR(1) NOT NULL COLLATE 'utf8mb4_unicode_ci',
	`Telefono` VARCHAR(1) NULL COLLATE 'utf8mb4_unicode_ci',
	`Salon` VARCHAR(1) NOT NULL COLLATE 'utf8mb4_unicode_ci',
	`EncargadoEvento` VARCHAR(1) NULL COLLATE 'utf8mb4_unicode_ci',
	`NoDoc` VARCHAR(1) NULL COLLATE 'utf8mb4_unicode_ci'
);

-- Dumping structure for table crm_jdl.usuarios
CREATE TABLE IF NOT EXISTS `usuarios` (
  `id` varchar(30) NOT NULL,
  `nombre` varchar(160) NOT NULL,
  `nombre_usuario` varchar(120) DEFAULT NULL,
  `nombre_completo` varchar(200) DEFAULT NULL,
  `correo` varchar(200) DEFAULT NULL,
  `telefono` varchar(80) DEFAULT NULL,
  `contrasena` varchar(255) DEFAULT NULL,
  `firma_data_url` longtext DEFAULT NULL,
  `avatar_data_url` longtext DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `influye_meta_ventas` tinyint(1) NOT NULL DEFAULT 0,
  `metas_mensuales_json` longtext DEFAULT NULL,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  `rol` varchar(50) NOT NULL DEFAULT 'vendedor',
  `tiers_comision_json` longtext DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dumping data for table crm_jdl.usuarios: ~2 rows (approximately)
INSERT INTO `usuarios` (`id`, `nombre`, `nombre_usuario`, `nombre_completo`, `correo`, `telefono`, `contrasena`, `firma_data_url`, `avatar_data_url`, `activo`, `influye_meta_ventas`, `metas_mensuales_json`, `creado_en`, `rol`, `tiers_comision_json`) VALUES
	('user_prereg_1781734480905', 'Kevin Bixcul', 'sistemashotel', 'Kevin Bixcul', 'sistemashotel@jardinesdellago.com', '1454545', NULL, NULL, NULL, 1, 0, '[]', '2026-06-18 07:21:47', 'admin', '[]'),
	('user_prereg_1781734502892', 'Carlos Samalaj', 'sistemas', 'Carlos Samalaj', 'sistemas@jardinesdellago.com', '56325547', NULL, 'data:image/jpeg;base64,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ckRhdGFib29sAQAAAABQZ1BzZW51bQAAAABQZ1BzAAAAAFBnUEMAAAAATGVmdFVudEYjUmx0AAAAAAAAAAAAAAAAVG9wIFVudEYjUmx0AAAAAAAAAAAAAAAAU2NsIFVudEYjUHJjQFkAAAAAAAAAAAAQY3JvcFdoZW5QcmludGluZ2Jvb2wAAAAADmNyb3BSZWN0Qm90dG9tbG9uZwAAAAAAAAAMY3JvcFJlY3RMZWZ0bG9uZwAAAAAAAAANY3JvcFJlY3RSaWdodGxvbmcAAAAAAAAAC2Nyb3BSZWN0VG9wbG9uZwAAAAAAOEJJTQPtAAAAAAAQAGAAAAABAAIAYAAAAAEAAjhCSU0EJgAAAAAADgAAAAAAAAAAAAA/gAAAOEJJTQQNAAAAAAAEAAAAWjhCSU0EGQAAAAAABAAAAB44QklNA/MAAAAAAAkAAAAAAAAAAAEAOEJJTScQAAAAAAAKAAEAAAAAAAAAAjhCSU0D9QAAAAAASAAvZmYAAQBsZmYABgAAAAAAAQAvZmYAAQChmZoABgAAAAAAAQAyAAAAAQBaAAAABgAAAAAAAQA1AAAAAQAtAAAABgAAAAAAAThCSU0D+AAAAAAAcAAA/////////////////////////////wPoAAAAAP////////////////////////////8D6AAAAAD/////////////////////////////A+gAAAAA/////////////////////////////wPoAAA4QklNBAAAAAAAAAIAAThCSU0EAgAAAAAABAAAAAA4QklNBDAAAAAAAAIBAThCSU0ELQAAAAAAAgAAOEJJTQQIAAAAAAAQAAAAAQAAAkAAAAJAAAAAADhCSU0ERAAAAAAAEAAAAAIAAAJAAAACQAAAAAA4QklNBEkAAAAAAAQAAAAAOEJJTQQeAAAAAAAEAAAAADhCSU0EGgAAAAADTQAAAAYAAAAAAAAAAAAAAUAAAARMAAAADABTAGkAbgAgAHQA7QB0AHUAbABvAC0AMgAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAETAAAAUAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAQAAAAAAAG51bGwAAAACAAAABmJvdW5kc09iamMAAAABAAAAAAAAUmN0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ME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDEwLjAtYzAwMCAyNS5HLmQyMGU0NjYsIDIwMjUvMTIvMDgtMjA6NTA6MjEgICAgICAgICI+IDxyZGY6UkRGIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyI+IDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PSIiIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyIgeG1sbnM6ZGM9Imh0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvIiB4bWxuczpwaG90b3Nob3A9Imh0dHA6Ly9ucy5hZG9iZS5jb20vcGhvdG9zaG9wLzEuMC8iIHhtbG5zOnhtcE1NPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvbW0vIiB4bWxuczpzdEV2dD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL3NUeXBlL1Jlc291cmNlRXZlbnQjIiB4bXA6Q3JlYXRvclRvb2w9IkFkb2JlIFBob3Rvc2hvcCAyNy40IChXaW5kb3dzKSIgeG1wOkNyZWF0ZURhdGU9IjIwMjYtMDMtMThUMjE6MTQ6NDgtMDY6MDAiIHhtcDpNb2RpZnlEYXRlPSIyMDI2LTAzLTE4VDIxOjE2OjU1LTA2OjAwIiB4bXA6TWV0YWRhdGFEYXRlPSIyMDI2LTAzLTE4VDIxOjE2OjU1LTA2OjAwIiBkYzpmb3JtYXQ9ImltYWdlL2pwZWciIHBob3Rvc2hvcDpDb2xvck1vZGU9IjMiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6YTI5MmVjM2YtNWViNi0zODRmLTk2MGMtMDExMGI1NDMwNWVhIiB4bXBNTTpEb2N1bWVudElEPSJhZG9iZTpkb2NpZDpwaG90b3Nob3A6ZDgxYTEzMDAtMjJhMy1mMzQ1LThlZjctOWU2ODcwYTU2NjUyIiB4bXBNTTpPcmlnaW5hbERvY3VtZW50SUQ9InhtcC5kaWQ6NDAzN2UxNDMtYThlZS01MDRiLWIyYWItMWUxMTRlZDE3MGNlIj4gPHhtcE1NOkhpc3Rvcnk+IDxyZGY6U2VxPiA8cmRmOmxpIHN0RXZ0OmFjdGlvbj0iY3JlYXRlZCIgc3RFdnQ6aW5zdGFuY2VJRD0ieG1wLmlpZDo0MDM3ZTE0My1hOGVlLTUwNGItYjJhYi0xZTExNGVkMTcwY2UiIHN0RXZ0OndoZW49IjIwMjYtMDMtMThUMjE6MTQ6NDgtMDY6MDAiIHN0RXZ0OnNvZnR3YXJlQWdlbnQ9IkFkb2JlIFBob3Rvc2hvcCAyNy40IChXaW5kb3dzKSIvPiA8cmRmOmxpIHN0RXZ0OmFjdGlvbj0iY29udmVydGVkIiBzdEV2dDpwYXJhbWV0ZXJzPSJmcm9tIGFwcGxpY2F0aW9uL3ZuZC5hZG9iZS5waG90b3Nob3AgdG8gaW1hZ2UvanBlZyIvPiA8cmRmOmxpIHN0RXZ0OmFjdGlvbj0ic2F2ZWQiIHN0RXZ0Omluc3RhbmNlSUQ9InhtcC5paWQ6YTI5MmVjM2YtNWViNi0zODRmLTk2MGMtMDExMGI1NDMwNWVhIiBzdEV2dDp3aGVuPSIyMDI2LTAzLTE4VDIxOjE2OjU1LTA2OjAwIiBzdEV2dDpzb2Z0d2FyZUFnZW50PSJBZG9iZSBQaG90b3Nob3AgMjcuNCAoV2luZG93cykiIHN0RXZ0OmNoYW5nZWQ9Ii8iLz4gPC9yZGY6U2VxPiA8L3htcE1NOkhpc3Rvcnk+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDw/eHBhY2tldCBlbmQ9InciPz7/7gAOQWRvYmUAZEAAAAAB/9sAhAABAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAgICAgICAgICAgIDAwMDAwMDAwMDAQEBAQEBAQEBAQECAgECAgMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwP/wAARCAFABEwDAREAAhEBAxEB/90ABACK/8QBogAAAAYCAwEAAAAAAAAAAAAABwgGBQQJAwoCAQALAQAABgMBAQEAAAAAAAAAAAAGBQQDBwIIAQkACgsQAAIBAwQBAwMCAwMDAgYJdQECAwQRBRIGIQcTIgAIMRRBMiMVCVFCFmEkMxdScYEYYpElQ6Gx8CY0cgoZwdE1J+FTNoLxkqJEVHNFRjdHYyhVVlcassLS4vJkg3SThGWjs8PT4yk4ZvN1Kjk6SElKWFlaZ2hpanZ3eHl6hYaHiImKlJWWl5iZmqSlpqeoqaq0tba3uLm6xMXGx8jJytTV1tfY2drk5ebn6Onq9PX29/j5+hEAAgEDAgQEAwUEBAQGBgVtAQIDEQQhEgUxBgAiE0FRBzJhFHEIQoEjkRVSoWIWMwmxJMHRQ3LwF+GCNCWSUxhjRPGisiY1GVQ2RWQnCnODk0Z0wtLi8lVldVY3hIWjs8PT4/MpGpSktMTU5PSVpbXF1eX1KEdXZjh2hpamtsbW5vZnd4eXp7fH1+f3SFhoeIiYqLjI2Oj4OUlZaXmJmam5ydnp+So6SlpqeoqaqrrK2ur6/9oADAMBAAIRAxEAPwDf49+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3XRNv6/W3Hv3XuvG/vR48etZ8uuGsXtqW97Wv79R6VA63pfrnz78Tp49aoa569zz/vHvRNQdJ7urenXfvYrQV49a697317r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r/9Df49+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3XvfuvddE2/2PvTGgr17rDqIVnZgFQEsTYAKBcnkWAt7aGpj28et9ITcfZ2ztrwmXJZqi4VjpjqInYMPorBWJBv7MbexuJ6aUJ6oxoK9FP3r8sTQxSVOKoJXp4pXWKeEMySRqbhrhCDcD2bwcumU6pzpI4V6aM5VTTI6BPJfNvNRzxPTY+arLrdadNZlJX+iqnsQx8qW4UfrDPSA7hIr6fLpy29/Mk6/o8rRYLetPXbfq55Uh11imKO7MEI1SRAcN/j7Tzcps7yCHuA8x0oF6tAWwerGtnb2wO+sLS57btbHXY+riEsU0TK4IYcepbre/sE3Vi9jdGKU5HSuGTxTQdLEfQf6w9tHj1frv37r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3X//0d/j37r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3XvfuvddH/AF7e9EEigND17pvyFfSYuiqsjkKmOmoaKCSoq55mASGGJS7uzfTi3vSg3L+BEKycK9bJAXqont3+YQN8b0ynTXQkE2X3DQ1k1BV5enj8lHURm0Lokt2VGRm9iux2NIYxNd0Jp0leVmIWM0PT30x8X+ztxTS53sTMVhjqJnlqcXUzsGW5LMI1IHAJ9vtuNtZdkQFelCAFauM9HMoukts0VImLTGRVuOK+F0mBZ0crYnURcWvf2X3G8yyuhLmo6a8MdwA7ekNh/idgcXvmmz5p4GxkLs6Ujt5E9diUK2sALe9PvlwFxKQem/pYjX9MdPPevw16d7j2tkqCXauPx+fNLN/CsrRj7eaGrClomZ1BJ/cA9327mvcbSSJWuf0C2R8uqyWkbAkJnqrH4N9zdtdBfKjeHxE7bSf+7wE0+w6yoAf7qkEoeJVmIDHTF+OfZ7zLbWu5Qw3tkAGwSek9rIYpylcHrYLQEXBN/pb+n5uB/rewB0anJPXP37rXXvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3X/9Lf49+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+6910fof+R+/de6SG+d77Z672rm957uylNicBt7HTZPKVtTMkSw0sClpHAZhqaw+g92SN5WVE+I9aJpnrWk74+cXePz67Qq+iPiRS19Js+jqQKjedB92cfm8XLULDVxGoHhhLrEG+n9PYr260ttqQ3Nz/aEdNElq+nVu/wr+B2x/jPtv+IV8S5zeuaMOUymQr4opKmjyUzCapjjms8hXyADlv6+y3c93kupD4FRF5deSDTnqxAIPqAo4/si31/23sg0uXDM2On+ukijj1aQBqNzwOT/AFPH193LqSM5HWusv19+w3XusTfqsPoLf7D2y6xzBoVNHXPVhTh59a6P83DdJ6Z+VXxL3xtujnl3bvfeNLt4VVMrAUtLG9NHO1S0Vj45Eew1cexdtc0su3SW4+IdIHjpcah59bDe36p63B4iqkYNNUY2ilnI5BnenjaexP1/dJ9hp1Ku6n4gelvTx7r17r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de66JsL+/de661C1/+KX/AN79+691yBvyPfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691//9Pf49+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3XvegKde66vcG3/Gv9v9PewRXr3SD7A7A2x1ptzIbn3XkqfG0FFS1M488iI87U8DzGOEOy6nIT6c+3be2kvLhYohWvVXkEeTx61n+6eyPkx/M87Hm6m6xXJ7R6eo66rx1fnIGmp6LPY1CFqqaokgQKzMrAcsLk+xg9rbbVanUF8bpMkpeVMVGerx/hj8K+rfh71liNnbNw9JJmIIEfI5mWEPXyVjJ/lASok1S+NpWY8/X2E726edidR0/b0roK9HUXn1EWY/W/4/wH+HtMDUDr3XL37r3XveqD069173vr3XA/k/63uooHJ9evDj1RH/ADiKfDY/d3xhyjUEWX3Pm+x8bgsJTOgeWiD1NKstbBe+lkEtyQPx7F3LCn6fcpGGNGP2dNFQ0oFfLq7vaNDJjNrbdoJ2ZpqbC46KdmvqM4pIfLf838hPsKtlmPz6dpTHSk91691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3XvfuvdcW/H+x96b4G62PPojvyE+WOE6j35tLYUhJyO4qyKCNkZAVLyFBfVyR7MbbaJW29rkk9NeOqmnn0cjblc+TwuPyUl9VdSw1Iv9dMqKw+n559oKUCjzA6cDBgDTp896691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691//9Tf49+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3XR/p/X/AH3091ckDHW+kzundWF2ZhavOZ/IU9DQ0kMkjPUOsSuUBOhb35Nvb1naSXUkcESlmc09ePVWYLxPWvz3Runs3+Yn29Qdb9dVlbiutdmbsU5rK0waGnqaVJYoaineVm0yRywI3+39j5Nth5dtDNI4Nx6efSFyZGIAJ6vF6X6P2L0btKj2nsvEwUUEd56mZY1Ms1XJZp5vIFBCu4+n+HsDX19NuEzzsSAPLpZFEEWp49DOB+TyfyfaUZAr1frv3vr3Xvfuvde9+691737r3XFrH03t/wAT/h79SvW+qMPnhk8VvL5mdA7ZycQqIdlZGDIY9OSoylQY7sVta6sF9yFyzAibJuMz4JVgCfs6LDclbugGR1eNRF2oqRpAPIaaBnH0sxiUkfT8H3Hx4noy456l+9de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de69ce/cOPXuve/de697917r3v3Xuve/de6jVk6U1LPUSGyQwyOTe30Un3tV1HT1omgPWuxumqqe+PnhjcbPD93i9sVsYhubqkkcjMpBa/Pp9yHEyQbA3iChK9E9Wkn06uB62IMTRpj8bQ0EYslHSU9Oo/oI4kW3+w9x3Wpb0r0cAaVAHTh791vr3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r//1d/j37r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3XVxz/h9f8AY+/de6ZMzmsft/G1mYy9RDR0VHE80s8zrGgVVJ03Ygc296iiuLqdYIFqCetMQgJJ6oB+S/dfZfzE7Pbo/qGWui2vTZClhzWTx7zNBFTq7tNJ5Kcfp0fW59yhtlpabBbG4uCPqAtR9vRexaRhThXq374xfG/avx12NTYHD08Mmar6elnz+UWFVmrK0Qr5HLteQ+sm9z9R7AW+b3NuVxU8a9Lo00jPHozQBH+txb/D+vsrXVQV6v1y92691737r3Xvfuvde9+691737r3UOqnSnp6iqkYLHTwSzuWNrLGjMST9B9Pe40ZpAAOOOtcNR+XVBaRy98fzIcHBSxmoxmzTUZfITWaWNDSrGY0ZhdVu0f5PuRGdbLl14GNGZeidIy974hHn1f8Agj6AWtx/h/sP9t7jrjno5679+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691xuPr/AE911Z09ep59d3Fr/wCx/wCJ92NaY49e6796HDPXuve99e697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3XusYOrlTwPr/vrf096da/b1ulOudxx/j9Peq6aKetUr137t17r3v3XuuiQOT7917pIb/rosbszctfPIIoaTD108khYLoEcDtqBNgLEe3rUa50UevVJPgbqiX+XZjTv/5Mdj7wf/K6ahyVY8VV+saYjKE9ZuAeR9PYz32ZRtEdrwNOiuzWs5PWwSBbn8/T2BEqEVT5dG/Xfu3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuv/W3+Pfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3XvegQSQOI691GqamClp6iqqJBFBTRPPNKeAscSFnYn+iqPflOttK5brYFetef58fMPfnau/qLoHoD7isllrVx+YqqNfS0bERVB1gtbR5D7GW2QDaoxcXCAPSvr0XzOznGRXq0H4ZfFfB9AbJocjUwrV713BQU1Vm6+U65UlqII2liJZRazEg+ybd9zl3GXUWICnh69KYE0oNYo3R3QtiT/X6D+n+A/oPZGq9xYjPTx+XXIX92JOoADt635dd+7da697917r3v3Xuve/de66Jt/j/gOT7917oEPkHvqj2F1juTK1FQsEjY+pigFwGZ2jIFluL8n2ssInkuoGVe0MK9NTByh0DPVfv8uLrmSr3P2X3Zk4tdVuGploMbOwIbwGocvpB/SGT2KuaZ4xa20ELAk8fy6Zgj0ks3xdW4KRb/AHs2+p/PsDI4YCnSvru493Jpx69Trv37r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691DrauGhpKqtqGWOGjglnldvoEiRnJufpwvvUS+LKVXL160zBVLE9vRM+kflrt7u/t/ePXW2p0qo9mRyNXzxp/m5lFxEzBjck+ze722e0gWaaLSjcM9JVuVlfRE1W6OspuL/T2U+Z6V+nXL37r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde96JCip4de6rR+dHztw/xRyuzcBqjmye5quGn+3CLKwE5AT0ahbUWH+t7N9t264vonnt4tSDjmlOktxcJE2lmo/R4upN2yb72Dt3dcqlGzNFBW+MixTyxI+m1+Bd/ZZdpSXT+NTnp+MuFq3n0JnunV+ve/de66PtuQ0A9OtjomXz47E/0a/GHsPOKzLPU0JxsGjhz90kiNpN/rp9mOzQvPewqi1qempmVUNTx6JV/Jz2lHD1buLe8kd6vO1xYyPzJaVRIQT9efZzzIzLcLEcADpLbDvZvl1dCoIvc354P+wHsLjzPl0u65e7de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de6//X3+Pfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3XAMCSovcfX3oAAn59e6qk/mKfMCn6vw2N6s2LXw1+9t5+bHvBQzu1XSLNJ9qVZIeQ3J+vs522xGoySinn1ZeOOsP8vf4fUew8V/pd31Rpkt37qj/iEUmQgR6ijaql8pt5Q7iwt+fbm4bgZQY1avl+zpkRIDqA6thtawHA4HHH0sALfQD2Scenadc/eutde9+691737r3Xvfuvde9+691737r3XE/4cX/Nh+P6+/A1691SX/MG7mr949g7T6J2i71lTlclHT18NGzSSJGJQJQVjNufGfqfYx5b2iJ4rjcLqYqtMDy4cek0pkDdtadDr1B8oujugcdgumN05aHbmciIFVJW/wCTq1Q6oZGYmPSbar/X2n/q3u+7LdXcB1QrWnVRexRZlGf9XHo/21+1OvN5iP8AuxvDA5cypqRKWvgd2HH0QsCSb+w9Nt1/bL3wEU446fSVHowPaeHS/JFgRaxPBFiCP6ix9ozHqP6jZ6dr1k9uda697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuis/MXtGm6m6G3tuaeWOKQ4qugg1yGMkmkmY6SvN7Aezbl+0FxusEYHxMOkl7IEhp646q/wD5IPXRfZfcHe9c08uR7J3lUpTPUDUEpKSSTmGRizmNgRf2KefXW3ubKxj+FRkf4Oku3xaWaX8NOr5vYA6Nfs697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3XusTypHG8jGyxxvIxP0CoCWJ/1gPetOogH168TQHrSy/mOZLdfyd+a8mcxxq02J1Vu+jwyyoXNHUzU9TTQlQWYRMwJ+gB9zHy/Zx2G0SGtCy1/b0FLqV57lTQ4PW3J8dqWWk6e2PFLGYz/BaLSgAFoxTxBDbj9Sj3Et7/ALm3B9WPQmhYtDHXy6G72n6d697qxoMde64sbC/4/P8Avv8AX96k+Hr3VS384DcsmF+N6U6KsqVWVQS05YXm1ppjUKT6jccexPypGBfIfQdIb56Kgp59C9/LR22+D+NO1Z3o2oWycEVY0LJoJEkEbqf6nhvbPMM4kv7ha1IPV7YVXV5dWG+w+vwjpX173br3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3X//Q3+Pfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3XvfuvddX5+n+x9+OBXrfXgb+6K+oVp1roFe+O4tudLdfZ7decrYYJ4cfVNi6d3RJKurWJvFHHrYAlW9q7KFrq4WNcD18uvdUW/DT457i+VHdFb8i+0WqanGUmbqKrEY/I+aSEU33U9RD4VIWIDSRb2d7lcx2qi1j/tKcfLqymlSfPrYxoaGnx1HS0NHGsNLRwJTwxIAqrHGgRQAOBYD2HDnj1XqZ7917r3v3Xuve/de697917r3v3Xuve/de64O4QXP0/r7o7UoAMnr3QBfJHuzC9GdaZbduUqo4KjxNBjo3Khpah1IAUMy3I9rbKISyJUYHW6VxXqq/4L9Y5XuzuOu+Re8qOSWjhqZ5sNFXRPJGWkknljkiuojHpcezu+u1t7c2aMRIB5HGetMKEqRXo5fyh+BPVHfskm4KjGtjdzJreOvovJFIXMei48Rvxx7c2Xm7ddnRreNgbc+XSOayilrUceqqN7/Ar5BdCOm6Op+xc8y0bef7KSsrWAVH4j0MpFivs9HMNpuVVkQBjx6bW2lSgBwOHRjek/5g28dgDHbI7v8r5WFYqY1tSF1uytoJZnCG54Psj3HaLSdi0T0b5evSpA60BOerR9kfJLrzelPTyUeWpRJOinQZoVN+L3Bf8Ax9kU9hc29dS1+zpRpPHocqPL4ysRJaWrilVgGUq6tww4/Tf+vtEA5rVCOtEU6chIrWKkMD+QfdGfSaaSetdd6j/qT73qooY4HXhnrlf3sEMKg460SR5deBv7314V9Ou/ej1vr3vWqnEde66vzbm9r/Tj/b+7eVevdUqfzl96GHpeDZNBVFchnqyPHxwRPaR5q8LTBSgJdgVlH49jzkWAG7lvXXsiH+qnRPujF1WND3A9Hd+A3TsXR3xY6u2cIljrJ8JBm8iQpVvusrDFUOr3Aa6g/n2HOY747hud5dZ0jAr8ul9mmm2UH06OcPp7JVyAelPXfvfXuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuuibe66u4L69e6QfZm4Ydr7A3hn5XEaY/BV8mpuAHaBoU5NudUg9v2sbXN2lqmHJGfLrUhEalm4da3m7NhYKPa+ywqRx1+9+yG3TnciyETFJKyCRY5JDy0TGK39Pcmm6kWNrBW7wmT5dEltGgZi+STjrZH65SGPY+2IqZQKeDE0UMFhYNGkKKGH+DWv7jKf8A3Jmr6n9vR3GNK6fw+XS59tdb66Pujmg/Pr3XFjxcc2t79IaAGnXqE461nf8AhQj29l9qr8bOt8LK4bem/qM5WNTZfsIJ6csXH+pIB9ijl0lWlnAwi1+fRRucgXwUFalur4/i/S0dL0Z18lDEkUP93scoAXSCyUkKFrcfUj6+yG7dpb64mNdLHHRlbIUjXV59GAvbixP+PtjGc0HT3Hrlf3XUvr1rr3u3Hh17r3v3Xuve9VPp17rq/wDh79U+nWga9d+/VPp1vr3vfXuuv9h791odeubDj/YX+nv3W+u/fuvddA3v/gSP9t7rqHXuu/duvddA39+x5HrZFOvf1/3v/e/9t791rrwP1/HNv+N+9EgefXuvX5P+H+P++t79qWnHr3XfvVT6de66v/vH9eP9792+fXuur/0F/fgQcV61U+nXd/8AD37r1T6dd+/db697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r//R3+Pfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+69173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4f5g/HXL1UuPTszb9DlI1JagyFUKeocgHiJTqDn/AG3uh2u/A/3ENfs6usqt59Qp/mR0Rj69qDL7xo8cdeiOqkbVSSc8ES3sARzf2+uzbg61EWerl19epWZ+W/TGLiirIt00OTxsiBzWY+TzKqnk6gAPp7o20bghAaOg8+mWnUHAr1gT5e9KV2KfJ4PdNLkhECZaYEpKgX6jTcm/tlttlT4sde+qQ0FOuG3PmB0zuQyQU2fSCvi1K1LMLXcErYE/Xkf7z72LCTj5DpxZA3AdCXtnuLbG46paSnqYzK7WQoxYMD9Db/W9tPA6Vr5dX6FqNxIiuv6WFx/rfj2xXNPPr3XP37r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691/9Lf49+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691wLEGwF/6/4f096A7ifl1vFM9EY+fHyIoujOit2Ggqlbe24aBsPt2gglVapqiueOnEqJy5AE3Fh7M+X7Vrm9aWUaUQ9aqOFemr4GdHDY/Uu0t+blpw++t3YlcrlZ5oj9xE1eA4jd5byXAHtTvt8bi4aGMaY0NMefXseXR/bEj6kH+ot/tv9b2Rg6qHrfnw65e99a697917r3v3Xuve/de697917ro+9EmooOvDrjqNr291kbRSgqetkenRE/nB8jabqPYtZtDDTh987zxdZQYelhkAqY/uYXhEqoLyEEvwQPZzs9n4twl1I1Il8umnZgyqo49BH/Lg+P8Aldi7Lm3vvmj8u6NwT1Nb5quJjNH90yE2Mt24H0PtRzBfpLLHDCnZ5kdXXI6tKA/4n/e/Yf092qvVvs67926111/sfdAraq6sde6793691jeJJF0yokg/IdFdT/sGBHvRr+A0690j8t19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vb25+/dv/wCUVOtNBI9ckdCzsT4D9yUlHJRVe6MjKUQrFFVzVZIP45eT8W9tPv1koqtuvVVgkQjuNT1Kj+AncORr56LJbgyFDHNdIalJqkoCDZGNpDa1vaNt6tjqYQqelogcj4qdKHbX8untPHVs+O3Pu+fLYOq1KKiKecywBiNPBluAl/bX7+tQDS3Unps2rD/RD080/wDLM39tbMrW7d7Ura7B1RtXYWqnqyDC59SJqk03CH3QcxQE0NmvW/pH/wB+npp3z/KFptzSw7h2z2pnNq51rTVdClRWfZzyGxdWWOYrZiP9bn2pXm5oQIooF8McOmjYFmLeKeoafycNm7ijp6jdW7cpRbjolTxZjG1FWi1Dx/RpNNQCdX+t7secZfi8BT+zp1bUqRWQnoVsd/LE25TYn+7u4czUbioETxU9ezz/AHaLp0glnlDXt+faOPmVw7SeGM+XTrQEZEhJ6k4L+WjgtsxTUGKz9ZV4yYm9LWvO+hGP0UvKQAvvcnMhkqTEK060luWHc5B6lYj+XJhcPXzPSV9RTx1JIkCPKYrsD6iPKRbn2WPupkqfCHVltlBqePUyD+XfT4fOJlqHMGUFw0qxmVSRqDfTycke6R7kAcxinz6UAKKDT0bDZHx1otpT0eRp8hI08OnXC+q5ta/JJHtPcXgkrSIDrfRnadPHDFH+ERV/5J49lSkljjHW+s/t3rXXvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691//9Pf49+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691FqqmCjhlqqqZKemgjaSaaVgsaIi6mLMeAABf37SzsipWpPXjTTnrXP2xkcj/MM/mBdo0VNJNWdNdFZKkxqlzopKnIUlXTmTS4DCRiYybexpIk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L1vVilOuWlb6rDVYAtaxNvdDoY1K561Trv8A1xcf7c+3BpIFDnrxxnz64iNFJZVCk/UgWvf+vv2k/wAXWq/LrxVSQSLEG4Nuf9v71obybrdA3l1ysb2PII/PPP8AT/W92AIpU56910BxyT+eP9h/vXvbCuK9b+zr2kXBHFv6fkf09t6M9er13pHvZWprXPWuvaR+bn/X5t/re/FK+fXuvaR79oHr14569pH+++vv2gYz14Y67AsLc/8AE+79e679+6910VB5+h/qPr/t/fuvdeAsLe/de679+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvdf/9Tf49+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3XXurEigHHr3XXP9eB+OOfdutCueq9P5jPc9Z1l03/AHfwNW1PunfVXHhsUsEhFSRO4hcqiHyWOq1x7O+X7WO5vtVyP0FFfz8uvMwAp59Mf8sf40U/x/6SrcnX0mjd/ZeVO6dx1kkYFTUS1CllEkhJkdSXv6j9fft9vnurow6h4aGgp1SNAmfPqygfQf6w9kYHn5npw56797Irjr3XvehUDPXuve/ahWlc9e697317r3v32de66Jt9feqMfPr3WGeaKGJ5pZUihiUySyyEKkaKNRd2awVUAuT/AIe/E6Kahx62KZ61pv5gvym3H8svkinwL6JrJshjDQ0c+/c1iJJqmj+2eRJp0eSG0I8aKQQT7F23WAtLNr+5IEJFfn02zEGg4dXwfGnpHAdBdPbH69wtFBTyYPA0VNkKiONEkqqwRl53kKi5YySH2F7uY3k/ihuwfD9nVxWmePQ+88H6j6/42tx/h7YOPiPXuuJlTUV1oCLenUofn/aSQfflLEmi9vWs14inTXJn8JHVtQSZjHRVqctSzVcEc1j/ALS7qT/sPbvhvQNoOnrfScyfZ2wsNWLRZbdeGx9Q7aY1qK2BFka5GlW1MCbj3sQytQhT1rUvr0l8n3x1niHkWu3PjEjjBbzx1cLxsv8AUEH+nPtWu3XDiqr1XxYv4uglynzV6UxrVejc2OrFpBdlhq4/M1r3sluR7fTZb5jlMHrfiRkYbouW6/5o/S1BFO22shT5eupBL9zihI5qR4tV9KpHdr6fx7Vx8t3jN3Ht6Ya40sBinQAxfzk+vd20+RpNk4HIDdWJEqy4OrhqgKyWK/phLQgnW1gLH2p/qy1RrloPt6sLmM+VD0Rbd/8AO37737V5jbnXHS+f2hvjbUkqpHkqHJDGZWKJm5EksXjYSheOfz7dTltdYPigt1p5wUIjbvr0AsH8z759d/7mh2LT7Aymx9z0URjpspQQVi0EtRqaNGYx2Qhnsefam85ehtIhKSK9ajZmy2Wr0M+Ex38zftkNgO1Z8xiqiIasRuTHisgui8xM5SRByPaLTt0MaHUNXTkoKhSnHz6H7Y3xo+Z80L4re26MxnIlULTVjTVJmWM/Qlmmvf8APuy3VlH8NKdWTUaVOOkN2X8KPlLlUq6hN35mPGYqmnr51qp6gRmKljMrKzvPpUWHHv0+42ixjSimSvWjFqkX061ys50J3b3Fluzs5lcnlp6Ta+crMXSTyy1M0CpTTTJK0cjzMugPH/reziHefAt4kt9IJ49amTUQlMdWq/y2P5SO5u39m5Lc+79z5GhxuYPhhy9DJolhtK4I1pMjkKFPsv3LepI30gjHTiRLGigeXVquz/5DnVFNlGp+xdz1u98ExLRTVKq1dTEcoVaV9d1P+Pst/rBMIzSn2dbZVOAMdHS2B/Kt+OGw8c23lxUm4tttdDj8xFDOY4yhXQhfygCx91HMu40oGUDpM1sj1qOsEX8o/wCHOL3B/eTA9cYmgq2fVPRyY+gno5wf1BleAlb2/p7Yk37cXqWnNadaFrGBQA9Qt5/yhvhlu+pOQi62xeAypS5qMdjqBIzILXcoIkBu3+9+92nMu4wU0z+fVWs0YUIPQO5n+TX0ZJQVOPp8Pj6yidWWNWpKVZVBBC8BALgezmPm29LAmah+fTR26EnCnV1XX2T/ACKKbAbhk3F17DNSJCTKYBDCifUmyGNx+PZzHzxIU+nuHBr6dJpbAIQadFg3HnN3/Cfeu3ocvKa2kStgp6rHVALsixVCRn0jyXB93kij3SFpBUJxr8+nYTJFwpTra9+Lu7dq9u9S7T31SYCgo6itoYGkZKaNSzqBZjeNTe5/I9x9ffURTMgkOgHHRmjEgEjozLUFE5VpKSmZ1N1bwxhlI+lmCgj2gBfuq5NetkAmtM9SHiSQBZESRR+HUP8A9DAj3oY8+rV65gAAACwAsAPoAPoAP6e/EVNSetcOvaQPpx/rEgf7Yce90HXumHccy02Dy07Gyx0U7Fr2sFQ35+vuhEhdFSmknrbMVFVwx616fgnSQJ84fkP2jUoJqowZHG4wSDUyKgnYspNyF1J+Pcjb1EINvsLNKeC4Un18uk0YNSSc9G8+Fm35q35Nd2diZAtNXZmtqqSF2JbRTipFtLklgtj9Pp7Jt4Jitkt1P6VB9uOktr4rysZPI46t3Kj8ewiyHSFU4r0Z8ePXtI97EYBrU9VoOvEC3+v7tgDPDrRA9OiI/wAxXf77D+Me+3pHIymaoHw2PRGKyNNXSwQegL6mOmT2d8tQJPuSrLXwUz0nvf7LSpoOqDuk/j42yPkp8S9sU1O0WR3FQ/333dkFjVGMtSFqBBUvwwfVH/aP59jrebg3ltcPI1VjUgfkOk8B0xpT4ic/Z1tvAACy8AWUD+gXj3FIyWand0YnAFOuQ/P+v/xA9+UUFfXqx6797Ir1rrqw910Ctanr2Ou/eyoIp17rq3vdBQDr3Hr1re/AU69Qde0j+nvfW6nr1h/T37r1T1371QenWuve/EA9e69b3rSPn17rqw97Apw63Xr1h78RXqtB13b3rSPn1vr1vftI+fXuve90FKde6978AB17r3vfXuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r/9Xf49+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfu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yjGUtMpjsstHQ0sELBUH1jBuR/j7djfxdjvLgn8bDplT+usVOr7+V4sSAAASb/T+v+J9x8OB6NG4Drkpvf8ABv8AT8/j35fhX7Orny65e99a697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de6//W3+Pfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+6917348McevddC/1/wB49+HAA8etn069f3UsKgda67uPftS+vXuuvemKkfFTr3XG4+moA/WxPJ/w5+nvYpXDV69UcPPqFU5Khp20TVlLDIvJSaZE4/2J97JatEQnr3DNeiPfNf5JbV6p6k3AFztDBmq6FqKli863MksbrdGU6uNd/Z5sdhPNcqWhOj7Oks86qpAPRMv5YezNqbFxu/8AvHembxy7h3jMGjrZqmJp48eyAsgv6yCCPqfZ3zNC/ipZQJ+mFBI+dOqWlHUSE5BPViu8vmH0Vs3HTZWp31g6yClDNVwU9bGayBE/WfAOSQAePYTh2a+Z9TAmOmOlhdRgnope+/5wvxC21g5cttvfFHuutopWTJYGlLLlKdU4JSBdRYjn/X9msfLm5yBWEH6Z4HpOblA2notGe/np9Pbt2lU5jorA5XdW58O0gy+1shQ1MdXZOdECKt2JCmxHswi5RnYFpZwpHl08JFYY6JtuP+cL8ou25Z5+mOq8xt7P0YWOfBZHG1YSZlYo3jEx5JP+9+zMcsWMIVpLpSR8+kZuHNQOPQNZv5F/zF98ZmgqqDGZ/auayQH39EIaqKn8hPrAXyhbEk+2mtNqhyWU9UEkrEipr0MW3+kvnVvqhGV3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P9h71UMcHrXXY97691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691//X3+Pfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+6911f378+tV661W+vH9P6e/da1U4jrlf8/wC9c/71791brjqW+nUNX9Li/wDtvr7917rhLJHFYySpETwpd1QN/gNRAJ97AqaU690gc92l19tipmos/uzCYisjjeQ01bkKWGR1VNfoDyrdiD9L+3hazS0VI2NfQHqpYDieiZbv/mSfHbBVuTwGO3NSVm6Mdq044VNMRUaAf80VkJfUBxYezGHYZpD3cPs68ZBnoq2Q/m+7PzlRWbd27tuvx26KOSQQJWWEFay3RRGXSxR2Fxb2aQ8sazqlkonVGkAHGnQK7u/mPd47lQUuO2jkcDWxemCsgjlNNMBez6o4iLm/9fZzFy9t0KAuwJ6SNckEgnPSKyncXzE33jIcsMflZYGRhJU0bzkxx2LeRxGuoWAv7ehttpt/ECgE19OnHnIjr8uqUvlDuH5P9x9v4PrFMrkMiZMojPSeepZxoeINFLD+vgC309i2xt7FLM3ES56D31DPOEOF6th6/wD5enzAyGzNt5XZ3YlbiKKmhiGb2pUVNXGkkcaqJPGmpeCv9fYKvtygN08swGrgOjlEdUrH8PQk1n8k/cXZFbjt8S9x5XEZXUhz23Xra6SjrJLhqiNo1lKKshBXm319pBzJZxHSsJP5deWKaSp1Y6G7CfyG/ivR5XHbteeuod8xhGykXld8dXyf2vJTSVDF0lt+F9p5ubdx0lIUHgD4fy6dW0/Ezd3R1Nl/y4vih19V0mQxmwMHgdyBYxU5COlgigyckYC6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QhiGXHRLt1fD7t/q7I/xHZuTyr0cLh1jp5qxkI/wCMw/Hs6h3ixvP05FHSdkKH4cdCvsv5LdjdaxwUG86XJukARJJahXI0oAjX8iX/Hvc+xx3qma30+H9o6YFwY2056Pz1D8gNr9oUqmjq4o6pVAeNnUtruAQVHI5PsKbhtEtgSSKjpdFNrAr0YMMxF7pYgEG/Bv/T2VCtOn+ufv3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r//Q3+Pfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3XvddPdqr17pmz+VhwmGyeVnOmLH0k1S5PP+bXUBb88+7RjxZFjHXuqfO8P5qOE63NdQ0+HlqZaSeSFpqeBna8RPPD/AOHsVWfLcdwiTtJnpJcztCpIGOixbc/nIZDLvUTDGSyU66vHBNRFXYj6AapCbkH2ZtyzARQOM/PopXcZJiEAz0ld2fzmdzVzyY3aO2clT5+EP4ad6F/BUyAelATJpIa3t2Lli1YDVIK9OtuMwpReHRds/wDze/lVuYzYCPqzPYDPlWGLy0GNkjpqiQD9osQQukkj283LO2DuecCnT8V9Kxyvy6LBvf8AmBfzft3UtTtHOdQ5iiwkzE4be+KoPE8aMf2nlmjvcFQCbn2/bWPL8DqTIOPV3kmpSlT0RfuXb380Ht7Evl5KnclZn8VIZ42iZ1kljC8RyW1X+lvYus7zl2CMNFp8QcKjpE3iudJrToS+kuku9t97JXKb22TnML23gQVOQdJI/vZIQOZBotIGYH2G5r2ze8Z1ZQtel8NuQoqTXo2Gz4O3qCigi391UHzWOIigzFNRiOqkEfCyMVXUxNgfd2uLR5KiQUp01dxsqAgn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yTQgPn1W5/Ngwy4vc3We+Ptjaky9HE86n9GnxesmwsD7EnKVZluYC34f8vVrk0WM08+rbuic/DuTqjZeVglEySYajQuG1epII7i/P0v7Bm6RPbbpMjA6ST09E4ZSfToYQLe0gGXJ9enSa9cXVXBV0DKeLEBgb/1B/A92FQag9a6C/evUmyt7UU9NlMJRtLMrqZVRUcawRq1BT+Tf2ust1nspNIZvDr0zLAJO7z6rk310R2J0Rnpt19bU0lZhhKZpqWN/IFjv5CNOkW+nsXR7jbblFodhXpEITHg1p0Z34+fJvB9hu239wZCixW5aQCKXHVTrBM8gFjpVmuSSD7Itz2e4t1MtsmqM5+zp/wCrClAcDo5SMrKrK6uHAIZSCpBsQeOOR7D7HT5d/p0tqGUEHHWf3vrXXvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3XE+0zk1HW+ux7eTh1o9d+79e697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r/9Hf49+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde91qdVKY690z57FRZvFVmLnGqCtheCZf9UjixH+292U+G4dePXuPRFdxfy8eltzV1Rk8hQLNUVc7VE0E9PBJEWdgzqdSsbG3s4Te7mJFRPhHVJIxImhhjrPJ/Li+M8lNCkez6Whq4gt6mmp6dQzL9fRoAIPuw5huzWq46TpZQoa0z0ssF8FPjriaeJZth4esrYHDQ5B6KlSoXR+klhFctfn20d/vXJAJA6sbKGpNOhmo+hupaKhgx7bE25Vxw2Ec0+IoGqEC8qBKIA4sf8AH2mlv7yUn9U0+09OpBGvADHS+pdobZosemKgwOK/h8alVppaClkjVTxps8TDge0zSvgkmvV9I4U6T0XVew4KySuo9t4ylnlJ83ioqXxy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08zLOywx6Sojksxvo/Hs45x20GeO6gSqaeI6ZtpQCFY0J6uAU8kE83/H0tYWt7AlRmhz0ZtQUpw65+/VA611xIv+SD/X3olSOtg0xTHUWppoa2nkpqhBLBIrJJG6oysCLfRgb/X3aLxImqDnqr0OOqIv5iPxV3r1/X0XyI6KqMnHkMDUpXZrF4/yxrNBFUB5VMdK6agUY/g+5H5Y3uG7R7K6CkgUz0UXsLKwYKadWC/BL5Ejv3qDFVmVjal3RiKSno8zSSs/nFTCDFIzrL6wdSj6+wvzDtUdjdG5hIZGPAeXS6zfVEFLZ6PJ7IOlXXvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+6911qFr349+6910fad1auB1vrsC1/8Tf26nDrR6793691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3X//S3+Pfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3XHSL3/r/tvfuvdcrW+nv3Xuve/de697917r3v3Xuve/de697917rg66rD/bf0/wBj7o+QBTrY6pM/mkbg/vJvrp/rKCU+I5GCtroARpdnrIwupQbn029izYv0re4c8Mf4OklytSnVqvRG3o9tdV7PxccaxLHiaVyqjSAzRi/H9fZBuji4uCRwB6fjqq0PQuv/AI/QEf7Hj/ePaFzQx/M9X6pT/mx7yr8JW9TbWxkaTVW5c3GsokCvGtP5Y0KsDyt7H2POUlVvqTX8J6SXAGM9WgfHvFHFdQ7MpXjWJzjYWdVFgNQBsB9LcewheKFvLkD+M9OQA6FJ6G+wAAtwPp7TdP8AXFiukksAB9WJsB/jc8e6OpagHWx1UR8+/nhi+ucbP1T1rVtlN95l1x8n2JR5aOWZ3itdWZh9CTx7EW1belBO/FTXrR8x59B3/L3+ElZDlV+QPb0Aye68xKMjSwZESSywtUM1SjqJVAGlivtXu+56YzCgyR1VOHHz6u6VFACBQqpYKqgKtv6AfSw9hNXJrXj1brJ7t17r3v3Xuve/de697917r3v3Xuure9EA8evdV/fN74rbj+R+2f4Vh8q1JGFKyQrO8MjDxFNSlOfz7MbC4WA0rTr2ajqg/an8lbdWxd8VmT3G9VuPCVs7SmGeWqkaBmZjdC4tw3sc2nMSeEIy+QKdJUjpMWp59H72B8b+0uj448dtzY1DujaEnjVIaqj81ZRIrA/tSOhKlefoPZfLuNvNKST/AKvPpScqQDnoas/tT5eV+JWq6qnjx9FS+qbA1wC+O31jg1IpU8e3GvdnqP0B1SAeHqIHHovfafxh+fPdm1zU7C7RynWPYWMjeWEvXTU9DNUJZkQsEVNBdSP9Y+08l5s5BbwRTpRVSQvl1Sr8yes/ndWQ7a6e+Sm8KvL72p6unp6LK0FXJJBlY5ToSQmMerXGf9j7Ptnu9ijUyNCACOkd1ExP6Q6sm6b+PX8wnp7rrYO2NvbnrMnsBKCmrKjDSTSmSmM8UTNpDJexVvaTcrrY7uakMYD+vSRUvFbvPb0YnIbY+W23ym4MLubL4mSkplqauGaaXwaku7qwKBdIZf8Abey/Rtty3hgDj1fxJ4+qm/kp3j8n/mLn06WEmRrsftHcOPfdE1KzmkqI6SaRijtCrDS4+oPsQx2202FutKVfj1V2kk06vLq03rD5O78+Ou0sHsXBbbq8dhcdj8fSyItL+39zBSwwyS6iguGcH/b+w/eWFldOTFx6djJBIAx0MFf/ADJNz4OGnrMngq2qiEflmNPT3axFybWP09pRy9DKrcK06ceQrgdUK/zX/wCZtg+4871FXUGNqydl7qx5hx1bAqlapMgHaaNT+VN+fYn2DaxBaXEagU/2OmGYyHu62HPjj/NM6VqOtOtcRveoqcblP7qYeOtrgYmgWdYVjsV1XBRQPz7CV9y5etPNOlChJIHT6SrGojbBHVk2xPkN032TDHJtLf2365pBdaaTI0sFVzzYxSTA3sfZFLt15FXVbMT8h08JY/XoZo5I5EWSKRJUYXWSN1dGB+hVlJBHtAy+H+A6vTpyoP2dciRxcHj35e4VZQD17165X/1/9sffi9DSnWuu/d+vde9+691737r3Xvfuvde9+691737r3XFrX5/5H7owDsFPlnrwWueg67W7EwvVOwN0b+3DUJSYvbmNmrJppGUDWFtEl2IHqkI93hia7uo4lHYD15mCgnqgfEbc3B8pKjvz5H7lp5KzDw7PrMZshJ0d4QGppoBLGgBQAi1iPcgWFwtvd29qGwuOi64Jpqp0bn+T/HS0PTGbxNM2tqDNVQrG/CVDSzaoyfxpvwP8PZdzjGy3MUtMU63YyFic46uG9hDow6978RXHXugh7v3/AEPWnV28d1Vc6xNQ4SvFLqIUvVSU0qQhbkch2B9qttt/rryO38gc9NytRCAc9EG/l9dXvlcdkO4Nw0/mym5clkchDNOCZSk0kbREMwtaxPsRcwyrbpHt6NigP7Ok0UZLq3l1atYf77/b+wn0tGOmnM4qDL42sx1SiyQVcLwyRuupWV1Km4/P197EpidHAyD1YsSpA49a4Hc/S24/iB8nsf3NtXzxbYy2VjmzFPAsqwBJJnWXUpHjIIb3J1heR7ttzRyN3AU6JvBYTamHn1sA9Q9oYHtbZWH3Pg62nqGqqOneqgR0MkEzRjUjoGJBuDz7jncLR7S5kWmK9GwIIGOhTBv9fr/gP+R+0SurGnn1vr1wOSbX/BPu5oo4Y6311db2/r9P6G//ABX3UyDOOq6R0Vr5Yd3bB6Z6wzM28p6OVs3ST0FFiqgxNJUyVCtEjpDIwLBXt9AefZtstvJJeJJFUAGp6auGqunHRAv5YWI3k2a3xuiuoJKHa+erp6vDaYmhhkglqXljGi2mwT2fc0TwvFFHB/agivVLaIKGNPLq6X2DulPXvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3XvfuvddG1jf6f8V9+691w4OlRyAbn/W/3x9+691k9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691//T3+Pfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9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5p3SXVuPqU2rWxbvzlK4gq8NR+WStpnbUPII4VJYRkf19ndrsErZdRx6Qz3Q4IT1XPsTpjv/APmI9mY/fvZzZLB9Z4fLQ5fbcFQrxQ1FCXarWnlSZzewdRa319mZmstoSRIWrLTP29UgEsgBPmetjHr3YeF642ph9p4KmihpMXRwU6siKpd4owjOSoBNyPYOuJZJZXlGanz6M0BUcel37b6t1737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3XFv0n/AH30591LAYPXuukAsCPz9T/sfewa569125IHH9fe+vddg3F7Ee/de679+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3X//1N/j37r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+69173o8D17rq17f4e6rlaHhXrfWvZkZ4aH+bYK3OEGtyNJBR4HHuf3IgHYGeOM86CVJuB+fY2loOXqD+DpthUqaZ62EIxaNR+NK2/r9B9fYHApEo8+rgU6ye3M0xx690TD509AQ/IforcO0IYVfNxQy1WGkEZklSrjTXGI9PrU+SNfp7X7NdiK6HievVJVDLTqjXqH+Yd8kvhhSU/SncPUG4Mvtzbkj4/GbijpKhwaUG0Thnp2Niqn8+xffbXt24KZ1mpM2T0nXxASvQkb/74+WHzGkh2tsKizO3OvM40c9DnadKiGqo2m0hopmhhRgoQkc/j2Hxa2G1OTPLqH+DpYhIz0ez4ify4dvdTVUO++xDHuLfcyrLU1dajVP3DynyFpTM7EEEc8X9orrcGzoNR17z6tep4IqaGKCGKOGGFBHHFEulERQAqoo4AA9loYyVZx1rrP7t17r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3XuvHj3VjQV690C3yB3fHsnqXeu4JZFiWlwtaqyFtJu8BVQpPAJLe37RGmniSmCetNgHqon+Vj1sNw9l9j91ZGBZ5J562GgqZULvepmMd0m/QSFH4/p7ONxlEcIt1rXrauaYPR8Pmd8ssN0Js6tocbUpVbsyVO8FHS08qGogmlZYoyUBdrm5/HtvaNtEra5hjj1V2pinRHPhR8cd19y70rO/O446iby10eUxGPyKSuLvOJYnjWbTGNKxj6D8ezK93AWiNBEeqhTUHy6vOjRYwERUSNQFjRBpVVW9gAOAAP6ewkCWdmJ6d6ye7da6696r3U8uvdUMfz6tvip+N1FuVRqm2/W09TDGFY65ErYXVrr9GX2IOXpXrNEDjqkhK5B8uj2fyzt6vvn4adN5Spq/u6yDbVLS1chfWVeLyKisw/Khfp7K7+N4rmZW4168kgZQa46PwV1KBYMPzqFwQfrcG/19oVYk0I6c6ZMnt7D5eB6euoYJY3UqQY0I9Qt9Dx7djluY2qr0HVDErZIFegD3f8VOrt2wzx1WEx15r3MlFEwufoSVAPHs2i3u9jXSJDT7emTbITUY6IP2b/LrOKlbK9euKOeN3nUUPli5DFgNKv8A0Ps5tuZ4Rpju1r9vV2iQZHRcKjOfI7485GKor/41UYimmVLl6lo/FGwJJ1KwA0+zRotv3FC8AAbpjWwYGpAr1aR8efljtrsnF0WPzFZDTZpkVWSapgVy2lSQysytfn2Ftx2swksgqB0oVjXPR1IZY5kSSJw8bqGRgQQwbkEEcEWP49kOsazH+IdOYp1m92691737r3XBmta1v8b+9DvBpw691XF85PmRRdMbYr9k7CnOW7UyhpKWioKCRJamhFfdVqtEfkk/bAuePZ9tGxteAXDmkanqjsRinSR+AfxFyPXlVujvrtQjLdn9pLS5Srkro2lloUqNFWjRtNcxuAQvAH09u75u3jgWNmdKJg08/L9nTcUWakVPVnmSpTXY+toyqsKuklpyG5UrKhRuP+Ct7IIT4dxDKfwnPShhVSvWtJ/LiGR63/mWfJPrWqqXpsLVVtXksYrlo48hNNNPqVFbhjG724/p7H/MIN5tcVyPhUD/ACdFsOlZiQKDrZqLW/r/AK4/H+v7jtxxI+IdGAPkekbv7fm3+uNpZvd+5q6CgxeFx9TXSyTzRxeXwRFxHH5GUNI7WAH+PtTYWst/LHEi5LU+zrznQCT1UJ8CNx7i+YO+uxfkDuemmXbOI3rWY3aC1SM0VVR0lSwjnh1KqEaYfqL+zvebd9niSKJ+9uIHTQXVRivV1wv+QB+Bb+g+nsNlhVBTJHT/AFy92611737r3XVuf8Lf7z7bpR6+XW+gU7d6J2R3DiKjGbkx9M0k0ciLVfbo0il4ylyws3sxtdzksmVVPaem3jD5PVPPYn8sTtfaWVqst0vu94YmdpIqSOaohte/p0iT+n+HsWwcw2kkYWdc/PpG0LA8MdBxB/L7+Uvb4Sm3bvzKbPy+EkX/ACj7msFLX06mxX0MAS9rc/g+2pt5tImJhhXR1UI5bSAadG26d/lK9TbYzGM3zvlmz284UWPKpUCSox+RKkXkkjllZSXt/T2VTcx3AP6KAU6dFqGFHGerX9s7UwGzsTTYTbOKo8RjKVQsVLSQrFEmlVUWCi/0HsjmuJZ2MklSx6UrGqigHSjv7aQGmerE9d+99b697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917rifbL/F1vrv6Lx+B/vXtxfhHWuulNxc/192691y96Br17r3vfXuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de6//V3+Pfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3XR/23v329e66P1H+9/6/wDxX3Q0+AdezXrXL3vjp4v5220d2bkmNNj123Di9qY4tZMnUawskoS3qlR1PPsXeJq2Uw0yF49b08Gr1saLyP6cDj+lxfn+nsIBTpK14de67/3r3YatVa4611w0lRwb/wC9/X+v196ZO4MtAetk16D7eXVuxt/QmHdO2sPl1awdqqjjeS349Zubjn26JZ1pplI61RfTPUzaPXGzdiUQx+1sJR4qkAAEEMQ0LpFgVXgA+6SgTik3d1vGcdLcLYWFvxawsB78qgAL5DrXXL34/Lr3Xve+vde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+69176+9UqM9e6qz/AJqXZ42b0rj9oU9QI8jvvJDG08StaRw7JHYD/U3uPZ1tCjx1l04U9NySBBwz0iOoOzti/DX4h4etyVdC28txQzVEGHV9dUaqoR3STQLEquq/t+e3a/3A6e1Pn16MkrUinQGfHfoHd3yx38/b/aRqTt9KsVlBj6tikc0IczRgIQ35Ye11/cx2Fp9NGKyk8R1XJfQRQ9Xt4DA4zbeKosLiKWOkoaCmipoI41AXREoUXIHqPsJSSPM5Z+HT+Onr6f8AGvx70AAKDrRPoOu/fuvdcf7Xtup18MU60eI6rc/mkdbwdh/F3d8E9M1UuOpJqnQo1EFSjBrf4aT7O+XZPDvNLIc9NXFdBpx6CP8Akw5vHSfFqn2rQztUHbeSmp5g49UDeeZPCb3vpI9q+aLZrS9Lsaq3+x03bDiOrfgw54tb/fcew4QFIPqelZFB13z7qxccBXqoqTnru/8Ah78GY8Up1vrhbUeBYf0IuD/xT3540NdSVPW6+vSI3nsHbe+MZNic5QQzQzhlLtGNYJUqSCfyb+3obm5tiHik0oPLqpXV9vVH3zK+Hm+ekIpO5um8pXy0GIlSryWMppCSsauS48At6dJ+v+HsV2G5xXWi3nB1t59N6dOSej5/y/Pk/R/ITq+lE0pOewUUVFlYJCRPFUQqY5RIpJIOqP2V71tq2UgljIYMfL06rHJVinVg2vm2k/W3/G/9b2Rl0BoWoelFOvFwoLNZVAJLE2UAfkn+lve68KCo69+fVd3zh+aON6E2PmsTsdYt0dl1WPdsTgqECsqJBJHIGKRoeZIhz/gfZjZWctQ8kZ0jquseueipfAb4r7j7GzcXyj+QUv8AEdy7lpUlw+3MlKGloYnhRljno2B8bU5ewub+zS73VrUfSWjUqMn7etUqePb1dbJVY+haGjkqaek/bRIIGdYwI0AVEQEgekCw9hplctrjPfXPz6tUDFessldSQhDJVQqrelW1rp5t+b2HurLOtCEJqeteXxda5fyUoR8b/wCYRsjuXHVkC7d3XWwxVUkTD1zyVbLIs9rHSS5/1/csbVaPueyizoFl0nj9nRJcEwuWLVz5dbAeM7H2lXbUpN3SZqhp8ZPjUyEk086RKqiDyuvqNrixsBz7jJrSaKdrZxWTUR0cRyoyBgfLrXd+VPyY3f8AP/vrr743/HtqmfrTHbu/h3Y+46G6RRmlq3Wpp6iouf22jj4H0I9jjabNditZ7m6SraSR0jlkMzgKcA9X5/H/AKV2f8f+t8H1ns2KGGhw0Cfc6GXyT1rRqamZwBcl5CTz7BV/eS39088jdp4DpcgCilehqeVIuZWWME2BYgKT/S5+h9o1X8z/AIOr9dvKkaNLIypEq6mkLDSB/Un+nvZxx61X9nUeGupZ43lhqoJolBYtHIrBVF73tf6W9+oxpp69j16hUufw1dK0NJlKOaaM6ZIUmQurHnSykgg8e96WAyOtVGc9eq87h6OZaeryNLTyt+lZJVF/xa5sPetIao0162COIPXJ81iYVDNkaUh7aNMyG9/6BSfexCckAgdaFAa+vUT+9O3TMKY5nHie/wDmpKhEcf7cjn34o4wnWi6atHn1Fr977VxUgjyWdx9CDYCSoqESFi30AlY6bn3RUnfy/l1fGKdOozuGai/iKZOikoSAwqo6iOSEg83DIxFufbgjm4eGSetEjhXqLQbq23lHaLH5zF1cqGzxQ1kLSqf6NHq1qf8AYe/GGc8IzTqupRxPWU7kwS1JpHylGlSDYxPMqsT/AIXsD78Ec/gNet1Hr05vWU0cP3DTRCD6+UOClv63HHupD61QIc9bx656wwZPH1N/BWU0un9WiZCVP+Ivx7uY5BxU9eOOPXFctjXdo1racupIZfItwR7owK8QadaqK0rnrJ/EKPWIxUQs7fRUkVj/ALG30+nvTFVGpjQdeqfTrP547hQ6EkAgahfn/D3rUWFUUsP8HW+I6yFj9ApP+9f7f36pHl1unXd+CQDx+P62928q+fWuuIe/FrG17E2P+2/p7bV9RppI6912G5sRp/1z9fdtXdpp17rl/j7tw691x1f4H/Y8e/VH8Q62BXrl791o9e9+6911b3Rlqa169137sBQAde697317roe6JwP29e6793691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3X/1t/j37r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3XvfuvddNext9ffuvddIOL/AJP1/wBuffuvdcvfuvde9+691737r3XFvxf8kD3Rh3A9e61u/mtmYOt/5svxm7J3MXp9rSJT4LGK5MULZuaqZBMzCwZGOo8/k+xZt0LT7Xdeen/N0lluNDBetj2llWenp6gEEVEEMq6SCpEkauNJH1Hq+vsK6GV5K+vSoZAPUn3vr3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3XvfuvdceSOP8AYW/p/j7bkDEAIc9e61Cf56fzbodifKLqHrLHwHP1WAmUVOFpJDNN91UzosUqxRBrPHLKPrzcexXssQEMkr4oOmHILoCMV6Mj8QPi1218qMrtbsLuY5Gi2fjKaOuwOPrEnFPLSOFCQyQzMsZZUX/U+013OIpC6N0oTtBrw62Pdo7SweyMFRbf2/RwUWPooliijjjSMEKqqSdCjg6ePZJNPJM3iMSR1qgrXz6U97AWtYfUkiwH559t6mP4c9e6wSVcESs8k8Cov1YyILf0Bu31960Sk4HXqgefUR83iY4/JJkaONf6vURL/h+WHt1Ypjgpnr3Hh1Cn3ZtylTy1OYoKeP6eSWpiCf6+oMVt794M3iaNB4dbC1zTpG9ktsvdXXm58bmsniqnBZXD1tLNOKqmniXzQPpf9bLqU2Pt61e6tryN1Q4PVWIAz1rR/Bn5IbX+IXy/7T6czW7sbUdcbny1ZNjGWviApqh6wyIVi8hjGgP9Bb2Pb/a7jedtgutB8Wlei9ZVSVqHt62Ex8wPjtPS1EtB2ftetrKYXkxiZOFa0FTyvjci5H+HsEnZbwks6HSPPpeJUYcekNN8+vjZCZ6SXfmNpMlEreOiqJ0RpZRcaEflTf8A4n27+4dwcAgEV4dU8dOgkyn80n474SvkxWVyn29USVgmWdWp5D/ZbVob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uvde9+691737r3Xvfuvde96ApXr3Xve+vde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691/9ff49+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691xYXtzbn/fAf4+6sK06969a+388XravXA9X94YqD/K+utw0FXLUKp1U1NFkIpGnNuAV1fU/19jTle4DxXtiy/Hw9eHRfdRAMkgJr1bv8Su1aLuH4/dbb1o6payWr23joa6VSLGsghET/Qn8IP8AY+w3udu1nezRPhK9K4H1pniOjJKbj2Xr5+lena165e7de697917r3v3Xuve/de697917r3v3Xuve/de697917ro+/daNfLr3PvWfTrY+fXr8+/Gvl17z64gt+bA3/obf73713eXXuumkVELuQij6s36QP8Txb37Vp+Lr1Osb1VPGodpoghsA2tSLn6Wseb+7DPDr3TO26tupU/ZyZmgjqr28D1EaSX540s1/x79n+E9bII6S0vbvXNPmJMDV7sxFDlEbQaetq4afUeOVaSRQV5+vHt1YJpB2xk/Z14Ak08+iH/Oj+Z18efhttTL0+4t8Ys7+nxAyG3MRDLT1ceQEys6vHKs+hiq/gX+vsz2nZrq6njiljIUnpuVxHShz1qA/Fb5B/F75C/LneHyY+a2Vknw1RuKOfZVc9pqajX7o1CQzRq4SJVcL9T7Fu57adphW2tjqaQUNfLptKynVTgetovL/AM3X4w9U4rC0WxcdJuLYixxUuNrcDHHogh0ARNKkTSfQ/W59hVtquJiA+OlWkeRx0F29v5yccCQ1WxNqVG4cfkriOP7VDUUyycC/JPpB/p7XJsAjjBlbHqOkpkbWUI7egEj/AJnXyQzG4JKTb23cimKrHF6WemAMKyMOFYoPpf3UbfbI1dXW+Pnjpwy3yf8AlpumpMVBhszjfK1kYxMI5DzyGEdlufZhFZ2CjXI9PTpqQMQNPl034vKfPHdlTU4ncOLzGPx1RxjcxEJBGRIfQ7MsXNiRzf3WtgjAK2OrxlxSvHpX0XRX8wMzJj9w5Sqyu0MkLR1cVQzVNKj/ANogIXUKD/vHu4udthfXgt0rVuyjdP6/An50YWc1mG7eqMzs7LL/AJbtusyEgmggmFnCpJzqVWsLf090/ee3PLUxqD0lljLVoc9VufMj+Sr2xteNPkZsXdWSm3TQVD5PM4aOsqfI5RRPUIiWIYHxkD2L+X+bNrSeXb7oKIqUB6LpYT8YrXpcfD/4n9P/ACfoqWKfem4dj904vVT5PF1FdVQRV1RAF1HxgqCHufx7b32+O3RvJb2ytZt50z1qEMx7ierNI/5QWKyUdP8A3nyk81fSMpiyFPWTl3Zf7TFbk6rX9hAcyADyGOn1s2Vi2o5PSqT+ULsqrEJydatekRXQZ5pvMACLEkkHge0c2/SMTpIp0sWJ1BViKdLWf+Wb0LsrHivz+fp8f9rGWUSTyFAUHKOCw491j3m8mOmEV6uVQA93RQ+5Nn/EHrnE18WOxiV+7Y1mioMvjVNRFNUCNvEJAjNbU9r39mtrFuEzxyTMVXz6YlroYjj0TroT+VTR/MvsEdgdqbeWi2piqyOemYiWAVlNGdcXpUWZmv8AT2Z7rzMscC2pA1KMdJorUSdzMa9Xzbk2r8Jvhh1Pj9u7twm0qfb1FTeClhyFNTVNRUT0lLZI3keRWiMjJYcg3b2B/qNxvblpFkYIR+wdGSwpSlMdVF7g75zvyv3bXdffFbrKDF7eR2pM3DU49Bja/GJdZamkfSytZWuCD7EUBW0i8WWY+JTqpiRakLXq4v4nfBfrDo7AUGarduY+o3hWw09ZXTPDrFJVvEDNEFcHhZWPsp3HmC8vjGguG0ICOPXlUfw06O3NsfadRIZ5Nv4xZza8kdLGjG3+KgD2SNNM+TK1ft6tpHp1yfZm2XCrJhMfMq2sslPGbW+nNh7940tMuSfXrwFOHWeLaW3ILCHD0USg30pAgU/64tz7qXYkknrZAPl1yqNs4CqZfNh6ImNgyOKdFKlfoQQo96Z5WCgSsAPn16g4U6cJMVjpohDLQ0kkSqFVXgjNgAAP7P8Ah78zyEECQgnzr16goBTrqnxWOo42jpaKmijbkxrCmkn/AFiPdW1MQdR6qiIgIA6ywUNJTFnp6aGneTmQwxomvn+1ZbH35uFetgAGoHXN6SlkkWV6eFpU5SUxp5FP+D21D3TUzdvW6DzHXOangqEMdRFHOh+qyorj/bEe3ASPPr3TaMBh1vooKZNX1CRIB/trW97LMfxHrWkdYm2zgH5fE0LN/qzAmq/5N7e9+JJShckdeoPQdSKfCYmkVkgx9Iiv+oCCMg/4cr9PfixPn16g9OucGHxdLKZqegpYJG/U0cKKW/17C1/etR9evUHUg0tIJBKaeASrysgiUOP+QgL+9HII631kdFcglFcfUFlBIP8AUE8j6e9eVD1759ZAtvyT/r2P/Ee9BaefXuvaAPoSP8Ba3+2t78EQcFFet1xSg66aON/1orf8GUH/AIj3ug9OtEA+XUZ6CkksXgiYr9NSK1v9a49+CqPLqukdYZMVjp+JqCla30JiS4P+HHuwLAEKxHW6D066bDYqSH7eTH0kkP08ckEbLY/66+/B5RxlJ69pX06j023cJRsWpcZRwXNyEgTSf9gRb3tnkYU8Q9aCgNXrHU7XwFXMs8+IoTMhDJOsEayA/wCuq+9mSQrp1mnW6D06l1WFxFdCKetxtDVQqAqxz0sMigAWFtSn3VXdeDnrxVW4jqJQ7W27jTIaHDY+mEq6HVKaPQy3uRpZSLH3czSkAeIafb1Xw0/hHTLU9a7Gqqs17bZxMVcxu1XT0kUMzH/aiigN/tvdxdXI4Tt+3r3hpx0jrnP17tGddMmBx0h4s7U6CQAfjWLHn376q687hj17w0/hHUcdabN0lVw9Mv8AyApAP+AsPp/r+9/V3VNJnanXvDj/AIeuDdX7JlieKbB0kiuCGvGB9frb6+7LeXK8JT17w48UQdJ7D9JbJ2/lGy2GoFpZ3fUy2OkG9/SOPbcs8sooznrSxhGLDoXo41iREUWCKAAPp9PbAFK5r051k97691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691/9Df49+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+69161/wDYG/v3Xuiw/MDqLF909CdhbMycCzCt27kPD+2kjrIkYlQoHB5Dxj2Y7Rdm03G2evYWz0zcKGic+YHVNP8AJX+Q5wGZ7G+IW8q1qfObEzFfDt6krLxTTUsFbJpKK5swMb8W9irnSyFxBBeQjBGSPs6R2Ehqyt1sZLfkG/H9R/vR/I9gJF0oo8+jLrl7t17r3v3Xuve/de697917r3P5/wB7v/xA9+691xuRa9j/AFNwP94Nvx7917rg8qIbO6IT9Nbqur/Bb2ufemDFe3j17pur81isSImymSocekzBIZKupigSVzwFRpGUE390SKd+GevVA4npH7t7W672MlFLuzd2FwsFcwSnq6uthWnLNbTeRGYAP+PwfahLK4kBIQ9eqCadAxu75odAbLyH2mW3zipaX7dKj+JUNSlVSBWAJBePjgm3tam13TIG0EHqpcLxPRauw/5pHSOyaqtNI77iwyQa6TKY7yOkjMABqCKRYMf9f2oh2Geckk0K8f8AY60r6gxU4HRYqj+bJla+bxbf2rNkcbXhjR1C0tR9wqP+m503uP8AX9mI5cMS1aXPTHjd1K46BXOfzCfkPuda2j2vtvJhEaUJTy0dUGc3Yoodjcg293j2i0VazSDX1tnkr2jFOgqx3yJ+cnaleuExG289t7KwOVpmmgrFp6phZV0a3CspuPa1LDbAaalr1UvL6dKbJdBfN3f+NyVd2bvCr6lrcepeDddTVGjxivoMsBqJXnCqGIsf9f3RLjbGfwkjB0mnDqjvOo+XVJfyG3N8m977yl+Omz9353cXe2AzkmLl3Xt6eqqcbmMJUhKSDIU9TBMsTkPNe4P1X2IrO72i2XviGR/Pr0ck1QB0YftD+T5lOpvgt2j8gfnh2TlN8bm2ztl59kz5Cs8uQxFdkFK0NFI0sk0hWORLBdVyPZVZb4g3ORFX1p+XT8kTE449Gp/lRfyS+pN7fFrY3Y/aUP8AHsb2LQjNLhqxYvJT00zS/azRrJG3jZoGQ/4+yLeN9nu72aMHC4B6djGlCPPq5jr7+Ub8dOu4JsdicatZhJARHjK+GnmihBN7JqiYC3+t7JRf3SnEh6vU0p0OO2/5evQm3Z1qKbblLE0Tho4lp6ZobD6DT4gAAP8AD2oO73OkK71HVCoLV6HfHfGnpzHRoI9mYszpptUrTQpJdbWb0xgD6f4+0Ul9PISV69oHQkUvX2zaWljpE29izHF+hno4DIP6esRhuPbX1c7/ANoxHW9AHDpTw46hgp4qWOlgFPCuiOMxIyqo+gAKn3rUxNdRr1vqSIwihY9KqBYIB6QP6AfgW90NSSWJ6916xHA/p9AbDn8gfSw9+0DjU9e6g5CgosnSVFDk6enqqWojeGaGoVGjdJF0sGDgj1Bre/KFVlkQfqKetMoao8uteH5yfDncPU2/o+6+h92YvYe4BOlcKB6qClgrjqcyRqq+M3b6ex7te/tuMP7tu4P0gOJHSKaHQAy9RPjj/OXOOmm2F329BTbiwQWhmrgZFjrHpUKPKJQGDB9F73/PtRuPJY8PXbg5Fek67iakU4dDBuD+cVsfduWGB6w+0qa1HMMpSaWTURwSCQoHJ/Hski5auY8Mp0/P06XRzu4NAM9MGNpu0vkjWVWTq97riMfIxerwtbViAvA92cwCSQ8aD+Pb30kO3/AQSOtKrg5OOht2J8efjb1lTSZzsLcdDmXI11VBkamCdBUhtbmJmEpFrfj2zNuG4SI0cEZp8utSEBWBIr/k6CPuf+ZTgdlU0nU/xt2uajcMOqGhio6aZ4p42YhWRolVGIjAt7pBsrXVJ7skHz61FLQ08ui8dffAPvb5pZuPffyGzOXoNi5mpjq6jbFRM8ctDM8gmbwxTyMQAgHFh9fai4urSxh8KEgyA/y6XFqqM46vr6D+NXWXx52rjds7GwtJBLjYGpv4waaGPI1MZ0+meaNAzCw5BJ9hm5vJbhyte3qvz6MGAPyP6X/oT7ShApJHn1rrl7t17r3v3Xuve/de697917r3v3Xuve/de6970RUEde6970FA69173br3Xvfuvde9+691737r3XvfuvddWB+oHv3Xuu/fuvde9+691737r3Xvfuvde9+691737r3XvfuvddE25Pv3XuutXFwCf8Pfuvddg3/BH+v7917rv37r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvdf/9Hf49+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+z5de69799vXuo1TTx1UM9NOqvDUQyQSIwBDJKpVgQeCCD78XCDUPiB6rQnsb4T1qa/wAw3pTsX4K/MTZvzR6qpqxdn5PNRrvSHHRTLAaaR4Jah6gxo8BUqrfqt7kHa7gbxtv0lwwagoB0WylbaX9NadbLfx9762T8ietNvdi7Hy1LX02Vx9NUV1PTzRySUNU0StPBKiMxUozfn2DN12+52qYxTLUcR8wel8MgkQN59DkrOQCBqH+vY/7G/wDT2WiUOpKDP+Dp808uo02QoadZWmraWMwKzyq9REjIFBLa1ZwRa3uwSUoop39ap68OgN3J8mOntrpOareWImmp5GSopI66mWeNlJVhpeUEEMPa+32y6lGFJ6beRUpXov8Avj+Yp0LtOiNTHuKlmlTXrgkqqVdRC3ABEv8AUfX2Yry5fk1OBTpozLih6KDuD+cv1RBWGgx9NURVUt46NwYpaaeUXAvIquOSP6+34+XJyyqzjJ/Z1ozihoc06Lju3+bt2NV5CTbuM2HnqaqyLEYTNU1LM1HI0h0wHyJTsgDEg/X2dw8qWq4mvVPTfiysRQ9BtlvmT/MH7HxdVsWo2DncQuTMg25vejpqtBFK1hTvJKlP9Bx7ffY9ktEaV51cjyr0pAYpQ5PSS2F8fv5uHYoyWwfkdvKvm2bVsKrZu6sbU1aVlDFMbwipKIsgZAyn2jD7JEapGAfy6adZcAHofab+WJ8p8pjxtHtDtvL702nUBGpKxq6tesoA1yATqDqyKePaeXdduTT4a1INOqqsxJDHoYtifyhP7twfwzNbyyG5sLUIyvFkqirlnijaxZA00l+Da3tPccw+HQW6Dp8xqwoRXoyG3v5XHUeJoI6CRVqaZNOqnrI5JlcBtRW7OfTf/H2kk32V9LI2k0z1uOMKGFME9GLwPwc6KwNPRLS7Yo4qilRVUrToYtS2+i3Jsf8AX9pX3e8c/wBqadV8GMtqYZ6Gam6I6noaeERbLwUEtOqk1UdFEjto/tu30IsPaOS/mBZ2ckdO0A4cOg37c7u6B+P2O/iW5Zds46sp6Wc41IIscJpaqngaSGn8inUkjsAOfz7ftLW9v27SQh+3rVVrQnPVBHYXfnyz/mlblr+s+n8Pl9hdGNVVW198zslRTStTLVHTl6KrhiQvqghBUh/o3sQR2FltsTS3EgMhH8+mVZmZgfh8ure/hp/Lb6g+K+3sLPWUlJvnsXHU0KSb5y9OanLEhjM0bVFUXkcJK/BP9PYaudxa5dhDNSMHh8unwtDUDPVev/ChDeVXurrT49/ELb1RIc98hO3dtwVOOpXGuowWJrrVkckEd5Wif7gj6AWHs52Cy8Zbm9JoFWgP29Ukk0uBXj1ep0V11jupenesuusZTx0dLtHZu3cKIVURAT0eKpYagaOPUZlb/Hj2G7ou87up7yxr8x1fh59CrPPBToHqJo4ELBRJM6xpc/QamKrz7Y0gnKnrfUGsy+Mx9N93W11NBSnj7hpkEV/6a9Vre3VjCkaVJr1omgz011289s4+jjrpczjzSyGyvHV07cf1/wA4T7cEbk0C568CKdJiXuDr9DaPceNkI/Uv3UCkf7FpAL+7NBJ5xE/Z1s/b0isz8oOnNvVAp85u3H4xS2kVFRVUywavwPIZQvJ/x9uJZ3T8IT1U0Az0Xvff8yj439c5eHFbl3LHHFXWWgytHPT1FBK7C6KZI2dRf/X9rrfYrqZDISAa+fVlKkA9FA3d/OP2tid2VOwqXYG4qqTNwyRbR3fj4JJcRUTy3FI80iwyILm30I+vt59lZMSP1vt49F7pvm987uzctnercz1dX7Xosgz1Gz+wKCkqY0qIZCfs2mmWHTcKwJ9qIrK1gCtJTWOPXlPcacOkNu34o/Or5J4l9ndz7nycEVPKDiM/RSVqOIVYtGHZAn6h9faxNys7YfCOqT/D+XS02n/I6xVXtdo945SSu3GadguX1TfcyOY2UM7lw5a5v7Nl50bSqmWqDHRRHZJqMgQhui8U/wDJ03f03uKqr9uVNXWrLI709WEqi0bNygJbVexHu/8AWqKRW1EZBHRlHHopTpdV3xY+bGLqaKGgmycGIkMcAr8f93HJFCSEVm8afhbX9kkl7t75Zan7enm0kfLo1/XH8uzufcUVInaW9K7J4DJxJLIWqar7mlaQjVrQsrXUX/Hup3mG3DCCgNOkTpI1fTqwHpv4B9K9Uy09fPhKLcOaoZvNR5isp/JVx/6kM8pYsFA/p7LLjmC7lBXxKDpyOCnxZI6PNTU1PSxrFSwxQQoqokcMaxIAoCj0oqjgD2SltbFySW6U8BTqQAB9Pfuvdd+/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917ro8gj/D37r3XSXtz/X37r3XZ/4kf72Pfuvdd+/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de6/9Lf49+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3XvfuvdcTyOP9459+qB1sdRXraONzG9TCkiAsYzKqvx9boTf3sAtw6rUevQcZ7uPrfALXLk934Wkq8fDJPPjp6yOKrKRAltMROomw4t7fSzeaRYcVbz6oZ0jI1mhPDqr/5M/wAxz4Jby2FvLrfce4MXvjM09LVwVmy5Yw9ZHMsMiGSAanZnBPBA9ne27ZuFhdxhK0J6SXskRK6iK9azPxw/mbdgfFPufdUnSe0srkenJqqomqts5SGWUUMTatRghkYFVUWIsPcm7hy/+9LdTcJ+vQdF7XghcBOrZdsfzYu6PlAGzvQpoMRmsUFGV2xXIsLFgNLxrFK5N7qfYUueUY9tjaV1Gnpbb3ZkoSak9I3efZnys7hzVI/9+JuvtxyERZDHvP4KCrYCz6SXC2e/HHtLBZWzIshAz0tecKNPSVoPht2BuXcwqewexarHVdaVLVtNki1FUO51NKStl06vr/r+zy3uLK2Gk0r0XPqlatejMYf+W91zUiKk7B3/AAZTEVap4shSZJTLGTb/ADhRSRYHm/v11uIlBCDPWqUp0Z7YHwi+FPX1IMVuvI4vcVMxD0NfNUI9RTSD9B8mgkWI9hqdtxYmRV7B1sEV6OZgdu/FfZmCpsbVYnadfgoNDUOWqIoKmWmRB6SZSoZCij2XTteOA0ZYH0pXpXC4IIPl0OVB2b0RTbZNRhtx7RrsLjIwTT0tTSzzU6CwI8P+cVkt/QW9lRt79pRVTn16U6gBXy6Z4flh0DV46tmxvYe36ubHRsJMT90i1w8Y5j+3NzwBYc/j3ddpvZThcHz614i+vSLxHzs+N2RlnoTvmkxuSg1L9lXL4dbrcBY2LWa7f4e325d3JBrSMkdb1qK16Sk/8wnoXF5T+G57LPQ65fFBWxoZaaa5IQiQEWBI9u2/L26TKf0Tj9nSZ7tFx59J7dX8xnp3ZuQply1SrYitZfs8opKxvG1irFrkWIPusew3jySK66dJpnrSXWaE46Cfd383H4/bfqpoqTLwVRiiDiFtR8pIJARw/F7fj2ofYLlFrTpQJAc9V2/ID+dbmdxUGXw/TG3a/wDiaU0saQrRyyJNdlUvG5ezDx3Ps22Pld72TTOlQD0xLNoFDx6ArqCjpu6MTU9z/JLcGQ3BszLoaup2zTyutftvJIxa4pkLOsa2AI49nW4JFaN9BZp+twx0zE5mIzkdWjdc/Pb44dV9byYro7bUeQOApfLkqOlojFkshHSxjiUKfI8zIv8AvHsKXOxXZk/xuUhT0rLhCBivSf29/OFxHbmzMxkOqOv87Bvvb9VUwVG1cxjpleukgDAx0/kILa3SwsL8+3P6sW1tGzpMDUV6fVgw+fVEnYXzU3t86/5hvVu8364y22c/8cMdWU0OCno5QtFuoRoyzTxuTeOeoQkHiwHsZJZbds/K6mScGSVv8PRePEknFePVwY+bfzT3rh6jY+7Os6jaufWsdMZuGgoTDFNTgsKadpEIW7KFJP8Aj7CCbbt8M8UjS1Bz0ulFAOon+lH545zGVGy9z0NRU0VTqFDl6aDTPEpFkYyK2oOgP+39qJ12yNjQLq/w9NVPkeutubK+amW29X7arcxla5GLrSpUsxkAZrgKSxII/Htt229YyyAauraq4p0u9vfGn5R7mxy7ZyOayWIrEgZoZppykZY6gt2PAHtMLuyTNB16hPSt6z+Bnd9Z/GML2Fu2qoZpGlaiytPVXSy/5s3UWJb+nvY3eygqVSpPToOkZFelDQ/yta7dFPltsdp70r8thqpZWoMrQ1jLVwFiVUEKuoMAbi/59svzBpP6cNOqsKggdCD1d/KW6L2nh6/bG/8A7vsXDl2kxU+UqG++oSTcATPG7DSOB7Sy79dOcLQdeANKeXR0dn/E7ozZu2KPalNsTC5LHY+VZMfPk6SKqyFIqW8Qjq3TyL47cEW9l8u43cjBqn/B1bodqPa+BoqKkx8GKoRSUMSw0sbQRyGFE/Sqsy3Fgfx7S+LcsdTnj17h9vT3HDHEgjRVWNQAqAcAD8e9k1A1daOesgUD6Cw/oPp7oqKOHDr3XCSKKZdMsaSL+A6hgD/rH3ao4V6915Y1RBGiqEAsF/AH9Lc3HvfWgKdcgqqukAKP6Dgf4+6sK5rjrfXgo/w/p/sPftKgDHXq1674+g9+DKTQHPXuu/duvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+6917/AA/1j/vv9t7917r3v3Xuve/de69e319+6911cH6Ee/de679+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvdf/09/j37r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3XveiQOPXuve9YPn17rr37SOvdYmcIrO1lRQWLswChQOWY/2QPfgq5OuvW9IB49MWR3Tt3E0U2Sr81jIqOnt5qg1tNpjB4Ja0tuP9v7sB5Cteq1Hr0XzfPzG+P2w6Ra3IdhbdroAzedaDKUss9OVPPkiLhrj+lvahLSdzQIet9Ff3H/Nd+N2Lmf+D7joMxFHcSItZEsykDmyp/U/4n2qTbJiQpUjqpYAEk46LpvP+dH1Vj46lsDEkk6KWjgldmDFeLKRGTz7M4OX3kajNjppphTHRKd3fzzs7kxX0W29rZOnycckopZII6p4JmsfFyIiNLMB9PZ1DyjAzDxrgBD0ws51E1J6rU+QX81P5zb4o5K/ZG0Nz0eQo5S3moIcqEliGq5IhQfUfX2J7PY9htUAmmQnz4dIpXmZqrXoiW9sz/Mn72pcb2xgaffcuVxbJLmcJAmZ/wAtpg6tNE0aFSSyEjkezJJuWbNGosRfyOMdb8GWYLWtR0JmJ+BHafeePwnyB6+2LvDbffG2jHLujb2Qpsh9pmnjAE6SU0r6naWSP8qfr7JbzctsdqxyqCPTrxsnalTno4mS+CHyR+QeyqGt2315UdW9j0NKtHnqSPGNTwZMRqBJIUZFu0uk/j22OZIbYALclh8z1sWJoSy16ACu+Fny2+HOPrd74zHZpc0UeXIJQ0tXEJnivI5Ig9J+l+fbg5igvholIZf5db8Ax5APSc6Z+VXanZO7jt7sxMzgqunqShrpRUU8kJQjSSzKh5ufz7XrBbTQBolUGnTbeLqJz1eJsDp/ffae36Zdk9tQ5GrWnQRUdXXD7hSUDBFPkDc+yFp47WYiS3DDh04CcV49cG+LHydRq7buT3FlqF5w8VHWR1U8lPrNwsiHzuAvqH093W9iXuMK8erk18uk1tD+Xt8w3y1RiN+7uyVbtvJufsMrT1FUXpYpDdGc+bSpXj2lm3eJSD4Q01z07HGWVqceh/pP5XHyX208dNTdsVm5to1yj7nGzVdQ1RBDKPUUvN+pUYjj+nsqud9tiSEjAp0sRAFAAzTpqb+SN2FjdyUm/wDY/wAhtz4o1emTM7NrKyuNBUAi0senztEGb+ntGd+hKlRHU+vSd7Zi2H7eh/xv8nLalQlLuSo3xnMNvNGBq44amX7GtYWZiyrUEHWb/j6e3U5oVI/CSAV6cW3H4m6Vu4v5b/x8xmCmk3lu6ih3FiYzNVOuQp6auYRqTqCGpR2ZgL/T23DzHuPiO0cBIOKdWkiog7uicdo4L4wbL2rVjbWWh37PRq1NNi/IkuTppk9OqPRdyVIv9fYgsr7cZNJeMovn0llCgfDkdVj7q6R7q+RbSbc2Vis1SbYmqbYzyQVhlo4pJAqDWACAg/ofZ/Df29ujPcKurouKNLIrL8I6sn+L/wDI8oqjb9NUd3ZevqJqlPJFKdTVCE20KwllLWUgj2Ft55nhNUgQcfLo5jjZUC16tV60/lkfHXrynhhO36PKy00Yjhr56Gm+5KadBWQshuSD/j7DKcwXaEyRSsrH0PV/BBrqFel7h/gR0rt/LVlViqIx4jJStJX4GWKNqCQMQXVYRdBe39B7o28zu3iMx8b1+fWxEF+DHTnQfAr44YPcSbn25suiwld5A9RDTRRtR1g51JPA40FWH+Htpt5upVZZJC3+Hq+lfMV6Vm7+kugOstvbl7Hpuvdrbfq9t4PLZh8lQ46mpGeajoJ6hWn0II5Gd4hyR71Z31zPIiayV1DB9Ot8OqZv5LPUu3+2N3/Kn5Tbv2zjKms312dksRtt5aCHxpjMbUVKLU07GIAl42AuP6+zfmCd4xFAXPhYNPIdeAXjTur1sLzbQ2zOI/PhcbKYlURs9FTalRbBQHEOvi39fYeNxJJoIc0HDrTDVx6mxbewkUqzxY2jV0FltTxEDj8Bk+vuhdzxY163QdTloKJJBMlHBHIvIdIYlbj/AIKPbeptdNRp16g9OpQSMkPoXV+G0jUPqPr9be7HPHr3XP3qgPHr3Xve+vddW/4j/eOR7917ru3N/wA/T37r3Xvfuvde96IB49e697317r3vVBxpnr3Xve+vde9+691737r3XvegAOA69173vr3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3XvfuvdY3LDTp/xv/rcXPv3XuutduF5H9T/AL4e/de6yKSRc/74e/de679+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3X//U3+Pfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691736o4Vz17rg8iICzOqqoJYlgLAe9VFaVz1qo9ekHufsvZm08ZXZTL5zHxQ46F56mJqiMTrGnLlULBvSPb8cEshwhp9nXqj+IdEM7Q/mq/FPr7bGU3Jjt8UG55cA04zOAoJYv4rTrTozSlIvMzMy6Tb0/Ue10Gy3U5EmkgHhjrxamB1Vbvn/AIUd9bbjjNZ8btj5fsKWhdafMbemo/8AcnTOpIlkQIdbBRzYAezyDlZ3A1zKD9tOq+IK0p0XLfP8zH+Yn3DEM/0FsDKU2GyqEZjbFbSBKiihqBZhGGS4Mak/j2aNs+02yCrqWA9ePSKcyivHoFsd0t/NL7Yyq7hoN37hxOJy6lsxtOqqZo4o2k4lSOMoANP4t7LZbnZoaqEz9nTccczDU1ehr2V/Jl+Qm78hFm90b5z9LU5CZZK3GVWRqhTMzjXILFQum7Ee0Z3K3iNQtcdGqfPhTo62wf5Gm26WpSTcmbqIZyuqaZauoljeUAXJCixufbZ5iiB0iI/s6blBYUHRr9p/yeOgaBHptz0Yy2lSIqyJpFlb6Aar/S3+PujcwOKeGM/Z02IBSh6HvYv8s74x7NEsU+ysfmoGt4WrIr1EVuR+6b/T2zLv93Kukt1dYlU1A6HTbfxH6C2vLMaDr7BVFNUKytTVtFHUIgP+p1AfQe0L39zL/oxr1cIgHw56EjbXTHWOzpaiXbezcJjEqlKywQUMXgbUeSsbAqvHHtIZnQnXKxBPW6A+XSox2yto4mskyOM25icdWyEmWopKKGFpNX1LiNQrHj+nv3i1odR69Tp1GGxfnNUuNo0nPPnSCNJGP1uSoF7/AOPupZ2ooY6etg0FPLpL7v642nvahqMfn8TRV8FQjoyVNMsi2dSrcED6g+3YZXgNQ2OqlQaGnVTXyD/lO9ebvfIZzr3GUGGzM4Lq9GppiZLN+pVBvz7Em38wSxEI7dvTTQhiTTqnXdnxG+bfxtztZltlRZjI0NJI80f2MkrDRC7BbDxsLlLezuHc7e6k7yPz6SvDp4Co6SmP/mC/LjZ9X/AN87Wz8VZSsYIqitpGIfT6dQZo1/r9fawrbkGjr+3qhjYdDptn+cn3Z1egbsDrjM5zbyjU09NQiUpABa/CE3AHtHLZwTVAdanpRESK+vQybM/n4bQ3ZBXPsrC5SozlAJGm2rkKQLJI0akmOFGIKlmXSOPaX+rkUn+jL+3pxpCgxU9Rdvf8KAMj2zX13X2zunty7T7PxrSGGmy2Pk+wybR2OiJ5QFKSD6fX22eWYYQZXnUoPmOqeMzHSFIPTtuX53fO3vrb9Rs7b3WuS6w7Ao3Y4rKxUpp6HJErdGEgTTpfTxzbn2hO32UJDMwp9vWmaUCp4dJrrv4g/OX5BVtDnO5d25rau5aWdhUiGrmio8pSggapQiCNhIn49rU3KxtlpFEC3n1eJnYsrVpTqzXq7+WLsHbtdTZ3cbtU5m0L14kklmgq5Y1AclT6PWxJ9l91zFO48OFadeaMOR5dWK7R6h6/2RBBFt7beOomgjRNaU6AvpFtRuODfn2SSbheSg+K2enFgjQYHQmKoRQoChV4VVWwUD6WA49pc5ZjUnpzrkPfhpIqBjr3XuPexQ+XXuu/eqAA4691Wl/NS7Sq+uvilvaixMrJmd10kmAokRh5JPv4zTPYfXkT+zTaFQSs+nIz178+pX8qvqeTqX4hbCw9RTfbVuXSbO14Y3d6rICKV3YkA+o/7b3TdLg3ctScdXfiOrIvp7LfgCjqnXfu/Xuuvz7p+M9b8uu/d+tde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3WOR9IHBNzY8HgHi/8Aj9ffuvdRJX8MbMq6jY2P9D+P9v7917rnQytNCWddJDlbf6yIf97Pv3Xupnv3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de6/9Xf49+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3VO3zp/mY0/wAX+1f9EOJxU1dumahoqil/YnlhmkyGJocjBGGjRlBtXKPwb+1tnaQzNrkanXiCQM9EM2D8wvml8mc5lMBtvZec2jl/3J8XPUU9bFRZGL+xoMrLHpYH8exELXaICvjGslOkxXDLTj0odzfBH5o/JzCV0G7d7ZLrndGPkMVRGKh4KLJUxJ1hgZwreT6fQ+1bbzttqtI4wTw6bhQ6wadKTp3+QJ1Li6ei3Z2FuXOVG/ZZdWfptcc+IypLXm8kbSMhSUf7T+T7LZuZ5CWjhWkfl0r0Amp6sY6r/lWfDbp3O0u6tj9W4nE7gCochUxUtK0ORl02lM1P9usdnN+fZRNvF1Ka1oftPXtA8zjo62H6k662/Vfd4PaWGxM5UB2oKGnp0cD6a444kRj/ALD2jNxI3xPUnq1OltFiMZAweHH0cDgj1U8EcTHn86FW/Pto549e6cOOAQTbi9rf7z7917rlY3vfi309+69137917r3v3XuurD+g9+69137917r3v3Xuve/de697917riVB/qP8AWJF/9e3v3XuostJFOpWWOKeNz646mJJVK/lSHDXB9+FRwJ690F+7+jOpd8Iw3LsHb1e5NvMMZSR1ANiNQlSFWHt1biVKUc06qVB6DQ/Drod4/tZtj4msoG9L0VXQ0ssfjItp1PAxNh7fG4zKcV69oGD0GE38tP4eDPxboxPUmDwOdjlExrMXSwQCVg+s+WEQ6H1MPz73+9Ln8T56tT5dDOnxM+PMVXQ5ROrNpw5jHJGtPmabD0NPkrxgAPJUwwI7k25vf22243D9rSHSfLr1OhqTaW21WlQYPF6qNY1p6gUNPHOixgBNMyRCS4AH59tNKzE9x690oFjUAKEWyeleLEKPoAbX9t9e6yAWvz/Tg/j/AG/v3Xuu/fuvde9+691737r3XvfuvddXHvRNKde6oa/mUZ6fs/ubqzp7HMaqlG46SpyVNHd7JFLTX1p+k8qb39m9l+iGc+an/B1r/L1df11gqfbWyds4SmiEcNBi6aBUVVQL40A/SosPp7Kjkk9b6W/vXXuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de66LAf8U/Pv3XuuIcHjn/ff7H37r3XP37r3Xvfuvde9+691w8aldLC4vf/AIp7917rtECCwFubn/XsP+Ke/de65e/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r/9bf49+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3RWOxPh70h2x2DW9j9g7Pxu4dwypjUoayqhDTUP8OoaOijZHJtfRRLYW+nu6sy8G6tWq06HXbuwtpbXpcfTYbb2KozjadKWmqIKGminWJAFBMiIHJI+vPvzOzGpY16pQdK+1iSFHP1sAD/AIEn6n23hsFetgDrl71hcBcdb68ef6/7D37Uf4evdd+9gfLrXXve+vde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvdan+Hr3Xvduvde9+69173qg9Ovde97691737r3Xvfuvde9+691737r3Xvfuvde9+691AyFR9pQ1tSTpENNLIGv9CkbEH/AAN/dHJ1IAPPrfVEOzaWLsv50ZDM1SithwdY8cCsDKqMKoAlbXA+ns9ukaKzRgKEjrQ4Dq+iOMRRxxRjSiKqgccKL3H+w9kvXusvv3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuuri9vz7917rrUPyfyf6+/de69rX+v+8H/inv3XuuJf+nHP1/3w9+691wJvyffuvdeH1H+uP979+691n9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691/9ff49+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+690iex8hFjNibqr5n8cdLha2VnvptpjIHP+JPtyBBLMijJr17qon+X1tOo3H21v/flWjvAmUrJKeY3II+6cIL/i5Hs63I0gROvevV1nsh691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3XEA3JNv8P8Pr/gP6+/de64FeTyv1/r7917rrT/tS/wC39+691wvckf0Nv+Re/de679+6912OCD/j7917rJrH+P8AvH/Fffuvdcxzz7917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de6//0N/j37r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3RLPnv2SnW3xx3fXpIqVmaEeDol16HeasfTaMD1M3H49mmyWzS3ZXFetllX4ukl/Lz2dLt7peizNVEErc8sdXM7ppd/MzT3JPJ/UPd94kAufpj8a/s6sQMY6sA9lHVOve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917riUBN+ffuvddaB/j/vH/FPfuvddFLcj/G9/+Re/de6x+/de697917r3v3XuuaHm39f+Iv7917rL7917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuv/9Hf49+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvddf15/417917qoT+Zdlot1bl6d6hEhMWRzlNmMggPBEVSFjVx9bFP8Ae/Yn2CPQstyTw/ydNSGhUdWUdNbaptqdcbWxFLGI4oMXSjSPxaFRf6D629kd/Is95JKPXp5mJUdCp7Sda697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917ro/Q/6x/3r37r3WD37r3XvfuvddX5A/B+p/p7917rKoFxZr/4WP9PfuvdZPfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691/9Lf49+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691R78pKlt0fNvrPb8Gqqq5amlhWJPWYqeKY3e30VfTz7GFkVtttZBlnWtfTpl8kfI9XYYukFDjKCjUWFNR00NrfmOJVb/efYPYnWy1zXj09TFOnL37r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3XvfuvdcCW5Fr3va1+P9f37r3WOx/of9sffuvdesf6H/AGx9+691yVf6j+n1uP8Akfv3XusgUDkD/e/fuvdd+/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r/9Pf49+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3XvfuvdcL3Ok2sbjj6297pUHr3VInx8z+D72/mSdyVMASvpujaZMb92AJIhk6i7JGCCVSSNwQQTf2fXMrQ2MKg0qvXtPnTq736XP9f98P949h+grXr3XfvfXuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r3v3Xuve/de697917r//1N/j37r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+690gO0d4U3X/XG+971biKLa21M9mtZHJkx+MqamEAcX1yxqPfoA8svh+VerAVI6pB/kLbEz1X1l8h/kPvOGY7i7x7p3BlqOpqRab+B0dbkEo0W92VDHUJbn2Y7pM7JEhAwtOvZ+Hy6v8+o9la1ZBXqp6793691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvdf/V3+Pfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3RQfnLXeD44dg0fkMceRxc9LVsDpH2bQSmoRj9NMicH/D2Y7QEe6Wpp1Zfi6CT+WJ/Dl+MmFhw1GlFhKWvqIKOKOMIkki6RPMtgAdUi/X/AB9tboR9RIoPA9apQ9WM+0Q4DrXXve+vde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3X/1t/j37r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde96bgevdEl+feKyec+O+68LhopJcjlojRQiJSWCTRSpKTb8aW9mO0FUlDEZr16prjpWfCnZNJ178b+u9r06gTUWLV68EaXNdOqPPrB5vc2v7YvSr3MxpjUevdGu9puvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvde9+691737r3Xvfuvdf/2Q==', NULL, 1, 0, '[]', '2026-06-18 07:21:47', 'admin', '[]'),
	('usr_1781811746107', 'Carlos Roberto Samalaj', 'csamalaj', 'Carlos Roberto Samalaj', 'sistemas@jardinesdellago.com', '56325547', 'scrypt$16384$8$1$e94370ce28a0e7f3bc149b21ae937e72$e655fa1aedb67f40e1d657e09c586d734e2a5b2ff3adc8d19e3852eba5cc9262770152c1659cfe000469b0db5a65903ccb371ba5f732609d8fc4ca1a00d2281e', NULL, NULL, 1, 0, NULL, '2026-06-18 19:42:26', 'admin', NULL);

-- Removing temporary table and create final VIEW structure
DROP TABLE IF EXISTS `tbl_seguimientocotizaciones`;
CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `tbl_seguimientocotizaciones` AS SELECT
      e.id AS Idocupacion,
      e.nombre AS Institucion,
      e.pax AS Pax,
      CASE
        WHEN e.estado = 'Confirmado' THEN 4
        WHEN e.estado = 'Pre reserva' OR e.estado = 'Pre-reserva' THEN 7
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
    LEFT JOIN cotizaciones_evento c ON e.id = c.id_evento
    LEFT JOIN usuarios u ON e.id_usuario = u.id 
;

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
