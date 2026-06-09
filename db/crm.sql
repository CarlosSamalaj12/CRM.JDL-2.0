-- ------------------------------------------------------
-- Respaldo de Base de Datos: crm_jdl
-- Generado el: 8/6/2026, 11:35:04 a. m.
-- ------------------------------------------------------

SET FOREIGN_KEY_CHECKS = 0;

--
-- Estructura de tabla para la tabla `anticipos_evento`
--
DROP TABLE IF EXISTS `anticipos_evento`;
CREATE TABLE `anticipos_evento` (
  `id` varchar(100) NOT NULL,
  `id_evento` varchar(80) NOT NULL,
  `fecha_anticipo` date NOT NULL,
  `monto` decimal(12,2) NOT NULL DEFAULT 0.00,
  `tipo_pago` varchar(40) NOT NULL DEFAULT 'Efectivo',
  `descripcion` varchar(255) DEFAULT NULL,
  `creado_en_iso` varchar(50) DEFAULT NULL,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  `actualizado_en` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_anticipos_evento` (`id_evento`,`fecha_anticipo`),
  CONSTRAINT `fk_anticipos_evento` FOREIGN KEY (`id_evento`) REFERENCES `eventos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `anticipos_evento`
--
-- (Sin registros en `anticipos_evento`)

--
-- Estructura de tabla para la tabla `app_state_kv`
--
DROP TABLE IF EXISTS `app_state_kv`;
CREATE TABLE `app_state_kv` (
  `clave` varchar(120) NOT NULL,
  `valor_json` longtext DEFAULT NULL,
  `actualizado_en` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`clave`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

--
-- Volcado de datos para la tabla `app_state_kv`
--
INSERT INTO `app_state_kv` (`clave`, `valor_json`, `actualizado_en`) VALUES
('checklistTemplateItems', '[]', '2026-05-14 22:10:30'),
('checklistTemplates', '[{"id":"tpl_default","name":"Checklist general","active":true,"sections":[{"id":"ev_fa89ae8842d958_19e4c8eddbe","name":"General","active":true}],"items":[]}]', '2026-05-21 16:01:34'),
('checklistTemplateSections', '["General"]', '2026-05-17 20:11:24'),
('disabledCompanies', '[]', '2026-05-14 22:10:30'),
('disabledManagers', '[]', '2026-05-14 22:10:30'),
('disabledSalones', '[]', '2026-05-14 22:10:30'),
('disabledServices', '[]', '2026-05-14 22:10:30'),
('eventChecklists', '{}', '2026-05-14 22:10:30'),
('globalMonthlyGoals', '[]', '2026-05-14 22:10:30'),
('menuMontajeBebidas', '[]', '2026-05-14 22:10:30'),
('menuMontajeSections', '["General"]', '2026-05-17 20:11:24'),
('occupancyWeeklyOps', '{}', '2026-05-14 22:10:30'),
('quickTemplates', '[{"id":"tpl-corporativo","name":"Corporativo","header":"","body":"","footer":"","assets":{"pagePdf":"","headerImage":"./Encabezadojdl.png","footerImage":"./piedepaginajdl.png"},"positionedFields":[],"signatureDefaults":{"w":22,"h":5},"roomRates":[],"formulas":[],"createdAt":"2026-05-19T21:19:48.166Z","updatedAt":"2026-05-19T21:19:48.166Z"},{"id":"tpl-servi-hosp","name":"Servi Hosp","header":"","body":"","footer":"","assets":{"pagePdf":"","headerImage":"./EncabezadoServ.jpg","footerImage":""},"positionedFields":[],"signatureDefaults":{"w":22,"h":5},"roomRates":[],"formulas":[],"createdAt":"2026-05-19T21:19:48.166Z","updatedAt":"2026-05-19T21:19:48.166Z"},{"id":"tpl-contrato-corp","name":"Jardines","header":"","body":"","footer":"","assets":{"pagePdf":"","headerImage":"","footerImage":""},"positionedFields":[],"signatureDefaults":{"w":22,"h":5},"roomRates":[],"formulas":[],"createdAt":"2026-05-19T21:19:48.166Z","updatedAt":"2026-05-19T21:19:48.166Z"}]', '2026-05-19 15:19:49'),
('quoteServiceTemplates', '[]', '2026-05-14 22:10:30'),
('salonCapacities', '{}', '2026-06-04 07:52:32');

--
-- Estructura de tabla para la tabla `bitacora_migracion`
--
DROP TABLE IF EXISTS `bitacora_migracion`;
CREATE TABLE `bitacora_migracion` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `origen` varchar(80) NOT NULL,
  `detalle` text DEFAULT NULL,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `bitacora_migracion`
--
-- (Sin registros en `bitacora_migracion`)

--
-- Estructura de tabla para la tabla `categorias_servicio`
--
DROP TABLE IF EXISTS `categorias_servicio`;
CREATE TABLE `categorias_servicio` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(140) NOT NULL,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_categorias_servicio_nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `categorias_servicio`
--
INSERT INTO `categorias_servicio` (`id`, `nombre`, `creado_en`, `activo`) VALUES
('1', 'Alimentos y Bebidas', '2026-05-20 08:33:53', 1),
('2', 'Habitaciones', '2026-05-20 08:33:53', 1),
('3', 'Hospedaje Terceros', '2026-05-20 08:33:53', 1),
('4', 'Miscelaneos', '2026-05-20 08:33:53', 1);

--
-- Estructura de tabla para la tabla `cotizacion_versiones_evento`
--
DROP TABLE IF EXISTS `cotizacion_versiones_evento`;
CREATE TABLE `cotizacion_versiones_evento` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `id_evento` varchar(100) NOT NULL,
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
) ENGINE=InnoDB AUTO_INCREMENT=115 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `cotizacion_versiones_evento`
--
INSERT INTO `cotizacion_versiones_evento` (`id`, `id_evento`, `version_num`, `subtotal`, `descuento_tipo`, `descuento_valor`, `descuento_monto`, `total_neto`, `cotizado_en_iso`, `json_crudo`, `creado_en`) VALUES
('112', 'ev_0029e766a038a8_19e4c7ceaa2', 1, '0.00', 'AMOUNT', '0.00', '0.00', '0.00', '2026-05-21T21:57:47.510Z', '{"companyId":"","managerId":"","dueDate":"2026-04-22","docDate":"2026-05-22","paymentType":"","code":"COT-009","contact":"","email":"","billTo":"","address":"","eventType":"","venue":"","schedule":"","phone":"","nit":"","people":"50","eventDate":"2026-05-22","folio":"","endDate":"2026-05-22","internalNotes":"","discountType":"AMOUNT","discountValue":0,"items":[],"notes":"","templateId":"tpl-contrato-corp","currency":"GTQ","version":1,"versions":[],"advances":[],"menuMontajeVersions":[{"version":1,"entries":[{"date":"2026-05-22","salon":"Gran Salón","menuTitle":"","menuQty":0,"menuDescription":"[PLATOS FUERTES]\\n- Por definir","montajeDescription":"[MONTAJE]\\n- TIPO (Auditorio) | ADICIONALES (Ninguno)","menuSelection":{"section":"General","platoId":null,"platoQty":1,"preparacionId":null,"platoItems":[],"lineItems":[],"salsaIds":[],"guarnicionIds":[],"guarnicionQtys":{},"postreIds":[],"postreQtys":{},"bebidaIds":[],"bebidaQtys":{},"comentarioIds":[],"comentarioLibre":""},"montajeSelection":{"tipoId":4,"adicionalIds":[]}}],"savedAt":"2026-05-21T21:57:47.510Z"}],"menuMontajeVersion":1,"menuMontajeEntries":[{"id":"ev_cbafd64cb65df_19e4c8b7176","date":"2026-05-22","salon":"Gran Salón","menuTitle":"","menuQty":0,"menuDescription":"[PLATOS FUERTES]\\n- Por definir","montajeDescription":"[MONTAJE]\\n- TIPO (Auditorio) | ADICIONALES (Ninguno)","menuSelection":{"section":"General","platoId":null,"platoQty":1,"preparacionId":null,"platoItems":[],"lineItems":[],"salsaIds":[],"guarnicionIds":[],"guarnicionQtys":{},"postreIds":[],"postreQtys":{},"bebidaIds":[],"bebidaQtys":{},"comentarioIds":[],"comentarioLibre":""},"montajeSelection":{"tipoId":4,"adicionalIds":[]},"updatedAt":"2026-05-21T21:57:47.510Z"}],"quotedAt":"2026-05-21T21:57:47.510Z"}', '2026-06-05 10:42:58'),
('113', 'evt_1779394960744', 1, '0.00', 'AMOUNT', '0.00', '0.00', '0.00', '2026-05-24T18:01:34.807Z', '{"companyId":"","companyName":"","managerId":"","managerName":"","contact":"","email":"","phone":"","nit":"","billTo":"","address":"","eventType":"","venue":"Gran Salón, Terraza Panorámica","schedule":"","code":"COT-010","docDate":"2026-05-24","people":118,"eventDate":"2026-05-26","endDate":"2026-05-26","dueDate":"","discountType":"AMOUNT","discountValue":0,"items":[],"advances":[],"templateId":"contrato_corp","currency":"GTQ","internalNotes":"","version":1,"versions":[],"paymentType":"","menuMontajeEntries":[{"id":"bbxnu7l","date":"2026-05-26","salon":"Gran Salón, Terraza Panorámica","menuTitle":"Menú de Celebración de 15 Años Estefanía","menuQty":121,"menuDescription":"[PLATO 1]\\n- PLATO FUERTE (Cant 121 - Medallones de Res al Vino Tinto) | HORARIO (Sin hora) | PREPARACION (Por definir) | SALSAS (Jus de Ternera) | GUARNICIONES (Por definir) | POSTRES (Por definir) | BEBIDAS (Por definir)","montajeDescription":"[MONTAJE]\\n- TIPO (Montaje Imperial) | ADICIONALES (Mantelería Blanca)\\n\\n\\n","lineItems":[{"key":"vpy6gon","platoId":1,"preparacionId":null,"qty":121,"servicioHora":"","salsaIds":[3],"guarnicionIds":[],"postreIds":[],"bebidaIds":[],"comentarioIds":[],"comentarioLibre":""}],"updatedAt":"2026-05-24T18:01:34.807Z"}],"menuMontajeVersion":5,"menuMontajeVersions":[{"version":1,"entries":[{"id":"bbxnu7l","date":"2026-05-26","salon":"Gran Salón, Terraza Panorámica","menuTitle":"Menú de Celebración de 15 Años Estefanía","menuQty":121,"menuDescription":"[PLATO 1]\\n- PLATO FUERTE (Cant 118 - Medallones de Res al Vino Tinto) | HORARIO (10:40) | PREPARACION (Por definir) | SALSAS (Jus de Ternera, Salsa de Champiñones) | GUARNICIONES (Arroz Almendrado, Puré de Papa Rústico) | POSTRES (Cheesecake de Frambuesa, Tiramisú Clásico) | BEBIDAS (Por definir)\\n","montajeDescription":"[MONTAJE]\\n- TIPO (Montaje Imperial) | ADICIONALES (Mantelería Blanca)\\n\\n\\n","lineItems":[{"key":"enu9rs6","platoId":1,"preparacionId":null,"qty":118,"servicioHora":"10:40","salsaIds":[3,1],"guarnicionIds":[3,1],"postreIds":[2,1],"bebidaIds":[],"comentarioIds":[],"comentarioLibre":""}],"updatedAt":"2026-05-24T15:27:12.056Z"}],"savedAt":"2026-05-24T15:27:12.056Z"},{"version":2,"entries":[{"id":"bbxnu7l","date":"2026-05-26","salon":"Gran Salón, Terraza Panorámica","menuTitle":"Menú de Celebración de 15 Años Estefanía","menuQty":121,"menuDescription":"[PLATO 1]\\n- PLATO FUERTE (Cant 118 - Medallones de Res al Vino Tinto) | HORARIO (10:40) | PREPARACION (Por definir) | SALSAS (Jus de Ternera, Salsa de Champiñones) | GUARNICIONES (Arroz Almendrado, Puré de Papa Rústico) | POSTRES (Cheesecake de Frambuesa, Tiramisú Clásico) | BEBIDAS (Por definir)\\n","montajeDescription":"[MONTAJE]\\n- TIPO (Montaje Imperial) | ADICIONALES (Mantelería Blanca)\\n\\n\\n","lineItems":[{"key":"enu9rs6","platoId":1,"preparacionId":null,"qty":118,"servicioHora":"10:40","salsaIds":[3,1],"guarnicionIds":[3,1],"postreIds":[2,1],"bebidaIds":[],"comentarioIds":[],"comentarioLibre":""}],"updatedAt":"2026-05-24T15:27:12.686Z"}],"savedAt":"2026-05-24T15:27:12.686Z"},{"version":3,"entries":[{"id":"bbxnu7l","date":"2026-05-26","salon":"Gran Salón, Terraza Panorámica","menuTitle":"Menú de Celebración de 15 Años Estefanía","menuQty":121,"menuDescription":"[PLATO 1]\\n- PLATO FUERTE (Cant 118 - Medallones de Res al Vino Tinto) | HORARIO (10:40) | PREPARACION (Por definir) | SALSAS (Jus de Ternera, Salsa de Champiñones) | GUARNICIONES (Arroz Almendrado, Puré de Papa Rústico) | POSTRES (Cheesecake de Frambuesa, Tiramisú Clásico) | BEBIDAS (Por definir)\\n","montajeDescription":"[MONTAJE]\\n- TIPO (Montaje Imperial) | ADICIONALES (Mantelería Blanca)\\n\\n\\n","lineItems":[{"key":"enu9rs6","platoId":1,"preparacionId":null,"qty":118,"servicioHora":"10:40","salsaIds":[3,1],"guarnicionIds":[3,1],"postreIds":[2,1],"bebidaIds":[],"comentarioIds":[],"comentarioLibre":""}],"updatedAt":"2026-05-24T15:28:44.640Z"}],"savedAt":"2026-05-24T15:28:44.640Z"},{"version":4,"entries":[{"id":"bbxnu7l","date":"2026-05-26","salon":"Gran Salón, Terraza Panorámica","menuTitle":"Menú de Celebración de 15 Años Estefanía","menuQty":121,"menuDescription":"[PLATO 1]\\n- PLATO FUERTE (Cant 118 - Medallones de Res al Vino Tinto) | HORARIO (10:40) | PREPARACION (Por definir) | SALSAS (Jus de Ternera, Salsa de Champiñones) | GUARNICIONES (Arroz Almendrado, Puré de Papa Rústico) | POSTRES (Cheesecake de Frambuesa, Tiramisú Clásico) | BEBIDAS (Por definir)\\n","montajeDescription":"[MONTAJE]\\n- TIPO (Montaje Imperial) | ADICIONALES (Mantelería Blanca)\\n\\n\\n","lineItems":[{"key":"enu9rs6","platoId":1,"preparacionId":null,"qty":118,"servicioHora":"10:40","salsaIds":[3,1],"guarnicionIds":[3,1],"postreIds":[2,1],"bebidaIds":[],"comentarioIds":[],"comentarioLibre":""}],"updatedAt":"2026-05-24T15:53:11.525Z"}],"savedAt":"2026-05-24T15:53:11.525Z"},{"version":5,"entries":[{"id":"bbxnu7l","date":"2026-05-26","salon":"Gran Salón, Terraza Panorámica","menuTitle":"Menú de Celebración de 15 Años Estefanía","menuQty":121,"menuDescription":"[PLATO 1]\\n- PLATO FUERTE (Cant 121 - Medallones de Res al Vino Tinto) | HORARIO (Sin hora) | PREPARACION (Por definir) | SALSAS (Jus de Ternera) | GUARNICIONES (Por definir) | POSTRES (Por definir) | BEBIDAS (Por definir)","montajeDescription":"[MONTAJE]\\n- TIPO (Montaje Imperial) | ADICIONALES (Mantelería Blanca)\\n\\n\\n","lineItems":[{"key":"vpy6gon","platoId":1,"preparacionId":null,"qty":121,"servicioHora":"","salsaIds":[3],"guarnicionIds":[],"postreIds":[],"bebidaIds":[],"comentarioIds":[],"comentarioLibre":""}],"updatedAt":"2026-05-24T18:01:34.807Z"}],"savedAt":"2026-05-24T18:01:34.807Z"}],"advanceLogs":[],"subtotal":0,"discountAmount":0,"total":0,"quotedAt":"2026-05-24T18:01:34.807Z"}', '2026-06-05 10:42:58'),
('114', 'evt_test_1780581152206', 1, '19200.00', 'AMOUNT', '0.00', '0.00', '19200.00', '2026-06-05T15:45:27.252Z', '{"companyId":"cmp_test_1780581152206","companyName":"","managerId":"mgr_test_1_1780581152206","managerName":"","contact":"Juan Pérez","email":"jperez@corp-e2e.com","phone":"55551234","nit":"1234567-8","billTo":"Corporación de Pruebas E2E S.A.","address":"Ciudad de Guatemala","eventType":"Corporativo","venue":"Gran Salón","schedule":"09:00 - 17:00","code":"COT-9999","docDate":"2026-06-04","people":"150","eventDate":"2026-06-04","endDate":"2026-06-04","dueDate":"2026-06-04","discountType":"AMOUNT","discountValue":0,"items":[{"id":"item_1_1780581152210","name":"Almuerzo Ejecutivo Buffet","price":125,"qty":150,"total":18750},{"id":"item_2_1780581152210","name":"Alquiler de Proyector HD","price":450,"qty":1,"total":450}],"advances":[],"templateId":"contrato_corp","currency":"GTQ","internalNotes":"","version":1,"versions":[],"paymentType":"","menuMontajeEntries":[{"id":"mme_1780581152210","date":"2026-06-04","salon":"Gran Salón","menuTitle":"Menú Conferencia Anual E2E 2026","menuQty":150,"menuNotes":"Servir a las 13:00 Hrs en punto.","menuDescription":"[PLATO 1]\\n- PLATO FUERTE (Cant 75 - Pechuga Cordon Bleu) | HORARIO (10:00) | PREPARACION (Por definir) | SALSAS (Salsa a la Pimienta (x45), Jus de Ternera (x25), Salsa de Champiñones (x56)) | GUARNICIONES (Arroz Almendrado, Puré de Papa Rústico (x6)) | POSTRES (Cheesecake de Frambuesa (x17)) | BEBIDAS (Por definir) | PAN/TORTILLA (Por definir)\\n\\n[PLATO 2]\\n- PLATO FUERTE (Cant 75 - Lasaña Vegetariana) | HORARIO (13:30) | PREPARACION (Por definir) | SALSAS (Jus de Ternera (x75)) | GUARNICIONES (Arroz Almendrado) | POSTRES (Por definir) | BEBIDAS (Por definir) | PAN/TORTILLA (Por definir)\\n\\n[COMENTARIO]\\n- Servir a las 13:00 Hrs en punto.","montajeDescription":"[MONTAJE]\\n- TIPO (Montaje Escuela) | ADICIONALES (Arreglo Floral Centro, Mantelería Blanca)","lineItems":[{"key":"cbe7qqe","platoId":2,"preparacionId":null,"qty":75,"servicioHora":"10:00","salsaIds":[2,3,1],"guarnicionIds":[3,1],"postreIds":[2],"bebidaIds":[],"bebidaQtys":{},"comentarioIds":[],"comentarioQtys":{},"salsaQtys":{"1":56,"2":45,"3":25},"guarnicionQtys":{"1":6,"3":1},"postreQtys":{"2":17},"comentarioLibre":"","suggestedSalsaIds":[],"suggestedGuarnicionIds":[],"suggestedPostreIds":[],"suggestedBebidaIds":[],"adicionales":[]},{"key":"8uuzjkt","platoId":3,"preparacionId":null,"qty":75,"servicioHora":"13:30","salsaIds":[3],"guarnicionIds":[3],"postreIds":[],"bebidaIds":[],"bebidaQtys":{},"comentarioIds":[],"comentarioQtys":{},"salsaQtys":{"3":75},"guarnicionQtys":{"3":1},"postreQtys":{},"adicionales":[],"comentarioLibre":"","suggestedSalsaIds":[],"suggestedGuarnicionIds":[],"suggestedPostreIds":[],"suggestedBebidaIds":[]}],"updatedAt":"2026-06-05T15:45:27.252Z"}],"menuMontajeVersion":6,"menuMontajeVersions":[{"version":1,"savedAt":"2026-06-04T13:52:32.210Z","entries":[]},{"version":2,"entries":[{"id":"mme_1780581152210","date":"2026-06-04","salon":"Gran Salón","menuTitle":"Menú Conferencia Anual E2E 2026","menuQty":150,"menuNotes":"Servir a las 13:00 Hrs en punto.","menuDescription":"[PLATO 1]\\n- PLATO FUERTE (Cant 150 - Lasaña Vegetariana) | HORARIO (13:30) | PREPARACION (Por definir) | SALSAS (Salsa a la Pimienta (x45), Jus de Ternera (x25), Salsa de Champiñones (x56)) | GUARNICIONES (Arroz Almendrado, Puré de Papa Rústico (x6)) | POSTRES (Cheesecake de Frambuesa (x15)) | BEBIDAS (Por definir) | PAN/TORTILLA (Por definir)\\n\\n[COMENTARIO GENERAL]\\n- Servir a las 13:00 Hrs en punto.","montajeDescription":"[MONTAJE]\\n- TIPO (Montaje Escuela) | ADICIONALES (Arreglo Floral Centro, Mantelería Blanca)","lineItems":[{"key":"cbe7qqe","platoId":3,"preparacionId":null,"qty":150,"servicioHora":"13:30","salsaIds":[2,3,1],"guarnicionIds":[3,1],"postreIds":[2],"bebidaIds":[],"bebidaQtys":{},"comentarioIds":[],"comentarioQtys":{},"salsaQtys":{"1":56,"2":45,"3":25},"guarnicionQtys":{"1":6,"3":1},"postreQtys":{"2":15},"comentarioLibre":"","suggestedSalsaIds":[],"suggestedGuarnicionIds":[],"suggestedPostreIds":[],"suggestedBebidaIds":[]}],"updatedAt":"2026-06-05T14:32:33.495Z"}],"savedAt":"2026-06-05T14:32:33.495Z"},{"version":3,"entries":[{"id":"mme_1780581152210","date":"2026-06-04","salon":"Gran Salón","menuTitle":"Menú Conferencia Anual E2E 2026","menuQty":150,"menuNotes":"Servir a las 13:00 Hrs en punto.","menuDescription":"[PLATO 1]\\n- PLATO FUERTE (Cant 75 - Pechuga Cordon Bleu) | HORARIO (Sin hora) | PREPARACION (Por definir) | SALSAS (Salsa a la Pimienta (x45), Jus de Ternera (x25), Salsa de Champiñones (x56)) | GUARNICIONES (Arroz Almendrado, Puré de Papa Rústico (x6)) | POSTRES (Cheesecake de Frambuesa (x15)) | BEBIDAS (Por definir) | PAN/TORTILLA (Por definir)\\n\\n[PLATO 2]\\n- PLATO FUERTE (Cant 75 - Lasaña Vegetariana) | HORARIO (13:30) | PREPARACION (Por definir) | SALSAS (Jus de Ternera (x75)) | GUARNICIONES (Por definir) | POSTRES (Por definir) | BEBIDAS (Por definir) | PAN/TORTILLA (Por definir)\\n\\n[COMENTARIO]\\n- Servir a las 13:00 Hrs en punto.","montajeDescription":"[MONTAJE]\\n- TIPO (Montaje Escuela) | ADICIONALES (Arreglo Floral Centro, Mantelería Blanca)","lineItems":[{"key":"cbe7qqe","platoId":2,"preparacionId":null,"qty":75,"servicioHora":"","salsaIds":[2,3,1],"guarnicionIds":[3,1],"postreIds":[2],"bebidaIds":[],"bebidaQtys":{},"comentarioIds":[],"comentarioQtys":{},"salsaQtys":{"1":56,"2":45,"3":25},"guarnicionQtys":{"1":6,"3":1},"postreQtys":{"2":15},"comentarioLibre":"","suggestedSalsaIds":[],"suggestedGuarnicionIds":[],"suggestedPostreIds":[],"suggestedBebidaIds":[],"adicionales":[]},{"key":"8uuzjkt","platoId":3,"preparacionId":null,"qty":75,"servicioHora":"13:30","salsaIds":[3],"guarnicionIds":[],"postreIds":[],"bebidaIds":[],"bebidaQtys":{},"comentarioIds":[],"comentarioQtys":{},"salsaQtys":{"3":75},"guarnicionQtys":{},"postreQtys":{},"adicionales":[],"comentarioLibre":"","suggestedSalsaIds":[],"suggestedGuarnicionIds":[],"suggestedPostreIds":[],"suggestedBebidaIds":[]}],"updatedAt":"2026-06-05T15:05:07.814Z"}],"savedAt":"2026-06-05T15:05:07.814Z"},{"version":4,"entries":[{"id":"mme_1780581152210","date":"2026-06-04","salon":"Gran Salón","menuTitle":"Menú Conferencia Anual E2E 2026","menuQty":150,"menuNotes":"Servir a las 13:00 Hrs en punto.","menuDescription":"[PLATO 1]\\n- PLATO FUERTE (Cant 75 - Pechuga Cordon Bleu) | HORARIO (Sin hora) | PREPARACION (Por definir) | SALSAS (Salsa a la Pimienta (x45), Jus de Ternera (x25), Salsa de Champiñones (x56)) | GUARNICIONES (Arroz Almendrado, Puré de Papa Rústico (x6)) | POSTRES (Cheesecake de Frambuesa (x15)) | BEBIDAS (Por definir) | PAN/TORTILLA (Por definir)\\n\\n[PLATO 2]\\n- PLATO FUERTE (Cant 75 - Lasaña Vegetariana) | HORARIO (13:30) | PREPARACION (Por definir) | SALSAS (Jus de Ternera (x75)) | GUARNICIONES (Arroz Almendrado) | POSTRES (Por definir) | BEBIDAS (Por definir) | PAN/TORTILLA (Por definir)\\n\\n[COMENTARIO]\\n- Servir a las 13:00 Hrs en punto.","montajeDescription":"[MONTAJE]\\n- TIPO (Montaje Escuela) | ADICIONALES (Arreglo Floral Centro, Mantelería Blanca)","lineItems":[{"key":"cbe7qqe","platoId":2,"preparacionId":null,"qty":75,"servicioHora":"","salsaIds":[2,3,1],"guarnicionIds":[3,1],"postreIds":[2],"bebidaIds":[],"bebidaQtys":{},"comentarioIds":[],"comentarioQtys":{},"salsaQtys":{"1":56,"2":45,"3":25},"guarnicionQtys":{"1":6,"3":1},"postreQtys":{"2":15},"comentarioLibre":"","suggestedSalsaIds":[],"suggestedGuarnicionIds":[],"suggestedPostreIds":[],"suggestedBebidaIds":[],"adicionales":[]},{"key":"8uuzjkt","platoId":3,"preparacionId":null,"qty":75,"servicioHora":"13:30","salsaIds":[3],"guarnicionIds":[3],"postreIds":[],"bebidaIds":[],"bebidaQtys":{},"comentarioIds":[],"comentarioQtys":{},"salsaQtys":{"3":75},"guarnicionQtys":{"3":1},"postreQtys":{},"adicionales":[],"comentarioLibre":"","suggestedSalsaIds":[],"suggestedGuarnicionIds":[],"suggestedPostreIds":[],"suggestedBebidaIds":[]}],"updatedAt":"2026-06-05T15:22:58.564Z"}],"savedAt":"2026-06-05T15:22:58.564Z"},{"version":5,"entries":[{"id":"mme_1780581152210","date":"2026-06-04","salon":"Gran Salón","menuTitle":"Menú Conferencia Anual E2E 2026","menuQty":150,"menuNotes":"Servir a las 13:00 Hrs en punto.","menuDescription":"[PLATO 1]\\n- PLATO FUERTE (Cant 75 - Pechuga Cordon Bleu) | HORARIO (Sin hora) | PREPARACION (Por definir) | SALSAS (Salsa a la Pimienta (x45), Jus de Ternera (x25), Salsa de Champiñones (x56)) | GUARNICIONES (Arroz Almendrado, Puré de Papa Rústico (x6)) | POSTRES (Cheesecake de Frambuesa (x17)) | BEBIDAS (Por definir) | PAN/TORTILLA (Por definir)\\n\\n[PLATO 2]\\n- PLATO FUERTE (Cant 75 - Lasaña Vegetariana) | HORARIO (13:30) | PREPARACION (Por definir) | SALSAS (Jus de Ternera (x75)) | GUARNICIONES (Arroz Almendrado) | POSTRES (Por definir) | BEBIDAS (Por definir) | PAN/TORTILLA (Por definir)\\n\\n[COMENTARIO]\\n- Servir a las 13:00 Hrs en punto.","montajeDescription":"[MONTAJE]\\n- TIPO (Montaje Escuela) | ADICIONALES (Arreglo Floral Centro, Mantelería Blanca)","lineItems":[{"key":"cbe7qqe","platoId":2,"preparacionId":null,"qty":75,"servicioHora":"","salsaIds":[2,3,1],"guarnicionIds":[3,1],"postreIds":[2],"bebidaIds":[],"bebidaQtys":{},"comentarioIds":[],"comentarioQtys":{},"salsaQtys":{"1":56,"2":45,"3":25},"guarnicionQtys":{"1":6,"3":1},"postreQtys":{"2":17},"comentarioLibre":"","suggestedSalsaIds":[],"suggestedGuarnicionIds":[],"suggestedPostreIds":[],"suggestedBebidaIds":[],"adicionales":[]},{"key":"8uuzjkt","platoId":3,"preparacionId":null,"qty":75,"servicioHora":"13:30","salsaIds":[3],"guarnicionIds":[3],"postreIds":[],"bebidaIds":[],"bebidaQtys":{},"comentarioIds":[],"comentarioQtys":{},"salsaQtys":{"3":75},"guarnicionQtys":{"3":1},"postreQtys":{},"adicionales":[],"comentarioLibre":"","suggestedSalsaIds":[],"suggestedGuarnicionIds":[],"suggestedPostreIds":[],"suggestedBebidaIds":[]}],"updatedAt":"2026-06-05T15:38:09.748Z"}],"savedAt":"2026-06-05T15:38:09.748Z"},{"version":6,"entries":[{"id":"mme_1780581152210","date":"2026-06-04","salon":"Gran Salón","menuTitle":"Menú Conferencia Anual E2E 2026","menuQty":150,"menuNotes":"Servir a las 13:00 Hrs en punto.","menuDescription":"[PLATO 1]\\n- PLATO FUERTE (Cant 75 - Pechuga Cordon Bleu) | HORARIO (10:00) | PREPARACION (Por definir) | SALSAS (Salsa a la Pimienta (x45), Jus de Ternera (x25), Salsa de Champiñones (x56)) | GUARNICIONES (Arroz Almendrado, Puré de Papa Rústico (x6)) | POSTRES (Cheesecake de Frambuesa (x17)) | BEBIDAS (Por definir) | PAN/TORTILLA (Por definir)\\n\\n[PLATO 2]\\n- PLATO FUERTE (Cant 75 - Lasaña Vegetariana) | HORARIO (13:30) | PREPARACION (Por definir) | SALSAS (Jus de Ternera (x75)) | GUARNICIONES (Arroz Almendrado) | POSTRES (Por definir) | BEBIDAS (Por definir) | PAN/TORTILLA (Por definir)\\n\\n[COMENTARIO]\\n- Servir a las 13:00 Hrs en punto.","montajeDescription":"[MONTAJE]\\n- TIPO (Montaje Escuela) | ADICIONALES (Arreglo Floral Centro, Mantelería Blanca)","lineItems":[{"key":"cbe7qqe","platoId":2,"preparacionId":null,"qty":75,"servicioHora":"10:00","salsaIds":[2,3,1],"guarnicionIds":[3,1],"postreIds":[2],"bebidaIds":[],"bebidaQtys":{},"comentarioIds":[],"comentarioQtys":{},"salsaQtys":{"1":56,"2":45,"3":25},"guarnicionQtys":{"1":6,"3":1},"postreQtys":{"2":17},"comentarioLibre":"","suggestedSalsaIds":[],"suggestedGuarnicionIds":[],"suggestedPostreIds":[],"suggestedBebidaIds":[],"adicionales":[]},{"key":"8uuzjkt","platoId":3,"preparacionId":null,"qty":75,"servicioHora":"13:30","salsaIds":[3],"guarnicionIds":[3],"postreIds":[],"bebidaIds":[],"bebidaQtys":{},"comentarioIds":[],"comentarioQtys":{},"salsaQtys":{"3":75},"guarnicionQtys":{"3":1},"postreQtys":{},"adicionales":[],"comentarioLibre":"","suggestedSalsaIds":[],"suggestedGuarnicionIds":[],"suggestedPostreIds":[],"suggestedBebidaIds":[]}],"updatedAt":"2026-06-05T15:45:27.252Z"}],"savedAt":"2026-06-05T15:45:27.252Z"}],"advanceLogs":[],"subtotal":19200,"discountAmount":0,"total":19200,"quotedAt":"2026-06-05T15:45:27.252Z"}', '2026-06-05 10:42:58');

--
-- Estructura de tabla para la tabla `cotizaciones_evento`
--
DROP TABLE IF EXISTS `cotizaciones_evento`;
CREATE TABLE `cotizaciones_evento` (
  `id_evento` varchar(80) NOT NULL,
  `id_empresa` varchar(80) DEFAULT NULL,
  `id_encargado` varchar(80) DEFAULT NULL,
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

--
-- Volcado de datos para la tabla `cotizaciones_evento`
--
INSERT INTO `cotizaciones_evento` (`id_evento`, `id_empresa`, `id_encargado`, `nombre_empresa`, `nombre_encargado`, `contacto`, `correo`, `facturar_a`, `direccion`, `tipo_evento`, `lugar`, `horario_texto`, `codigo`, `fecha_documento`, `telefono`, `nit`, `personas`, `fecha_evento`, `folio`, `fecha_fin`, `fecha_max_pago`, `tipo_pago`, `notas_internas`, `notas`, `cotizado_en_iso`, `json_crudo`, `creado_en`, `actualizado_en`, `version_actual`, `subtotal`, `descuento_tipo`, `descuento_valor`, `descuento_monto`, `total_neto`) VALUES
('ev_0029e766a038a8_19e4c7ceaa2', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'COT-009', '2026-05-22 00:00:00', NULL, NULL, 50, '2026-05-22 00:00:00', NULL, '2026-05-22 00:00:00', '2026-04-22 00:00:00', NULL, NULL, NULL, '2026-05-21T21:57:47.510Z', '{"companyId":"","managerId":"","dueDate":"2026-04-22","docDate":"2026-05-22","paymentType":"","code":"COT-009","contact":"","email":"","billTo":"","address":"","eventType":"","venue":"","schedule":"","phone":"","nit":"","people":"50","eventDate":"2026-05-22","folio":"","endDate":"2026-05-22","internalNotes":"","discountType":"AMOUNT","discountValue":0,"items":[],"notes":"","templateId":"tpl-contrato-corp","currency":"GTQ","version":1,"versions":[],"advances":[],"menuMontajeVersions":[{"version":1,"entries":[{"date":"2026-05-22","salon":"Gran Salón","menuTitle":"","menuQty":0,"menuDescription":"[PLATOS FUERTES]\\n- Por definir","montajeDescription":"[MONTAJE]\\n- TIPO (Auditorio) | ADICIONALES (Ninguno)","menuSelection":{"section":"General","platoId":null,"platoQty":1,"preparacionId":null,"platoItems":[],"lineItems":[],"salsaIds":[],"guarnicionIds":[],"guarnicionQtys":{},"postreIds":[],"postreQtys":{},"bebidaIds":[],"bebidaQtys":{},"comentarioIds":[],"comentarioLibre":""},"montajeSelection":{"tipoId":4,"adicionalIds":[]}}],"savedAt":"2026-05-21T21:57:47.510Z"}],"menuMontajeVersion":1,"menuMontajeEntries":[{"id":"ev_cbafd64cb65df_19e4c8b7176","date":"2026-05-22","salon":"Gran Salón","menuTitle":"","menuQty":0,"menuDescription":"[PLATOS FUERTES]\\n- Por definir","montajeDescription":"[MONTAJE]\\n- TIPO (Auditorio) | ADICIONALES (Ninguno)","menuSelection":{"section":"General","platoId":null,"platoQty":1,"preparacionId":null,"platoItems":[],"lineItems":[],"salsaIds":[],"guarnicionIds":[],"guarnicionQtys":{},"postreIds":[],"postreQtys":{},"bebidaIds":[],"bebidaQtys":{},"comentarioIds":[],"comentarioLibre":""},"montajeSelection":{"tipoId":4,"adicionalIds":[]},"updatedAt":"2026-05-21T21:57:47.510Z"}],"quotedAt":"2026-05-21T21:57:47.510Z"}', '2026-06-05 10:42:58', '2026-06-05 10:42:58', 1, '0.00', 'AMOUNT', '0.00', '0.00', '0.00'),
('evt_1779394960744', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Gran Salón, Terraza Panorámica', NULL, 'COT-010', '2026-05-24 00:00:00', NULL, NULL, 118, '2026-05-26 00:00:00', NULL, '2026-05-26 00:00:00', NULL, NULL, NULL, NULL, '2026-05-24T18:01:34.807Z', '{"companyId":"","companyName":"","managerId":"","managerName":"","contact":"","email":"","phone":"","nit":"","billTo":"","address":"","eventType":"","venue":"Gran Salón, Terraza Panorámica","schedule":"","code":"COT-010","docDate":"2026-05-24","people":118,"eventDate":"2026-05-26","endDate":"2026-05-26","dueDate":"","discountType":"AMOUNT","discountValue":0,"items":[],"advances":[],"templateId":"contrato_corp","currency":"GTQ","internalNotes":"","version":1,"versions":[],"paymentType":"","menuMontajeEntries":[{"id":"bbxnu7l","date":"2026-05-26","salon":"Gran Salón, Terraza Panorámica","menuTitle":"Menú de Celebración de 15 Años Estefanía","menuQty":121,"menuDescription":"[PLATO 1]\\n- PLATO FUERTE (Cant 121 - Medallones de Res al Vino Tinto) | HORARIO (Sin hora) | PREPARACION (Por definir) | SALSAS (Jus de Ternera) | GUARNICIONES (Por definir) | POSTRES (Por definir) | BEBIDAS (Por definir)","montajeDescription":"[MONTAJE]\\n- TIPO (Montaje Imperial) | ADICIONALES (Mantelería Blanca)\\n\\n\\n","lineItems":[{"key":"vpy6gon","platoId":1,"preparacionId":null,"qty":121,"servicioHora":"","salsaIds":[3],"guarnicionIds":[],"postreIds":[],"bebidaIds":[],"comentarioIds":[],"comentarioLibre":""}],"updatedAt":"2026-05-24T18:01:34.807Z"}],"menuMontajeVersion":5,"menuMontajeVersions":[{"version":1,"entries":[{"id":"bbxnu7l","date":"2026-05-26","salon":"Gran Salón, Terraza Panorámica","menuTitle":"Menú de Celebración de 15 Años Estefanía","menuQty":121,"menuDescription":"[PLATO 1]\\n- PLATO FUERTE (Cant 118 - Medallones de Res al Vino Tinto) | HORARIO (10:40) | PREPARACION (Por definir) | SALSAS (Jus de Ternera, Salsa de Champiñones) | GUARNICIONES (Arroz Almendrado, Puré de Papa Rústico) | POSTRES (Cheesecake de Frambuesa, Tiramisú Clásico) | BEBIDAS (Por definir)\\n","montajeDescription":"[MONTAJE]\\n- TIPO (Montaje Imperial) | ADICIONALES (Mantelería Blanca)\\n\\n\\n","lineItems":[{"key":"enu9rs6","platoId":1,"preparacionId":null,"qty":118,"servicioHora":"10:40","salsaIds":[3,1],"guarnicionIds":[3,1],"postreIds":[2,1],"bebidaIds":[],"comentarioIds":[],"comentarioLibre":""}],"updatedAt":"2026-05-24T15:27:12.056Z"}],"savedAt":"2026-05-24T15:27:12.056Z"},{"version":2,"entries":[{"id":"bbxnu7l","date":"2026-05-26","salon":"Gran Salón, Terraza Panorámica","menuTitle":"Menú de Celebración de 15 Años Estefanía","menuQty":121,"menuDescription":"[PLATO 1]\\n- PLATO FUERTE (Cant 118 - Medallones de Res al Vino Tinto) | HORARIO (10:40) | PREPARACION (Por definir) | SALSAS (Jus de Ternera, Salsa de Champiñones) | GUARNICIONES (Arroz Almendrado, Puré de Papa Rústico) | POSTRES (Cheesecake de Frambuesa, Tiramisú Clásico) | BEBIDAS (Por definir)\\n","montajeDescription":"[MONTAJE]\\n- TIPO (Montaje Imperial) | ADICIONALES (Mantelería Blanca)\\n\\n\\n","lineItems":[{"key":"enu9rs6","platoId":1,"preparacionId":null,"qty":118,"servicioHora":"10:40","salsaIds":[3,1],"guarnicionIds":[3,1],"postreIds":[2,1],"bebidaIds":[],"comentarioIds":[],"comentarioLibre":""}],"updatedAt":"2026-05-24T15:27:12.686Z"}],"savedAt":"2026-05-24T15:27:12.686Z"},{"version":3,"entries":[{"id":"bbxnu7l","date":"2026-05-26","salon":"Gran Salón, Terraza Panorámica","menuTitle":"Menú de Celebración de 15 Años Estefanía","menuQty":121,"menuDescription":"[PLATO 1]\\n- PLATO FUERTE (Cant 118 - Medallones de Res al Vino Tinto) | HORARIO (10:40) | PREPARACION (Por definir) | SALSAS (Jus de Ternera, Salsa de Champiñones) | GUARNICIONES (Arroz Almendrado, Puré de Papa Rústico) | POSTRES (Cheesecake de Frambuesa, Tiramisú Clásico) | BEBIDAS (Por definir)\\n","montajeDescription":"[MONTAJE]\\n- TIPO (Montaje Imperial) | ADICIONALES (Mantelería Blanca)\\n\\n\\n","lineItems":[{"key":"enu9rs6","platoId":1,"preparacionId":null,"qty":118,"servicioHora":"10:40","salsaIds":[3,1],"guarnicionIds":[3,1],"postreIds":[2,1],"bebidaIds":[],"comentarioIds":[],"comentarioLibre":""}],"updatedAt":"2026-05-24T15:28:44.640Z"}],"savedAt":"2026-05-24T15:28:44.640Z"},{"version":4,"entries":[{"id":"bbxnu7l","date":"2026-05-26","salon":"Gran Salón, Terraza Panorámica","menuTitle":"Menú de Celebración de 15 Años Estefanía","menuQty":121,"menuDescription":"[PLATO 1]\\n- PLATO FUERTE (Cant 118 - Medallones de Res al Vino Tinto) | HORARIO (10:40) | PREPARACION (Por definir) | SALSAS (Jus de Ternera, Salsa de Champiñones) | GUARNICIONES (Arroz Almendrado, Puré de Papa Rústico) | POSTRES (Cheesecake de Frambuesa, Tiramisú Clásico) | BEBIDAS (Por definir)\\n","montajeDescription":"[MONTAJE]\\n- TIPO (Montaje Imperial) | ADICIONALES (Mantelería Blanca)\\n\\n\\n","lineItems":[{"key":"enu9rs6","platoId":1,"preparacionId":null,"qty":118,"servicioHora":"10:40","salsaIds":[3,1],"guarnicionIds":[3,1],"postreIds":[2,1],"bebidaIds":[],"comentarioIds":[],"comentarioLibre":""}],"updatedAt":"2026-05-24T15:53:11.525Z"}],"savedAt":"2026-05-24T15:53:11.525Z"},{"version":5,"entries":[{"id":"bbxnu7l","date":"2026-05-26","salon":"Gran Salón, Terraza Panorámica","menuTitle":"Menú de Celebración de 15 Años Estefanía","menuQty":121,"menuDescription":"[PLATO 1]\\n- PLATO FUERTE (Cant 121 - Medallones de Res al Vino Tinto) | HORARIO (Sin hora) | PREPARACION (Por definir) | SALSAS (Jus de Ternera) | GUARNICIONES (Por definir) | POSTRES (Por definir) | BEBIDAS (Por definir)","montajeDescription":"[MONTAJE]\\n- TIPO (Montaje Imperial) | ADICIONALES (Mantelería Blanca)\\n\\n\\n","lineItems":[{"key":"vpy6gon","platoId":1,"preparacionId":null,"qty":121,"servicioHora":"","salsaIds":[3],"guarnicionIds":[],"postreIds":[],"bebidaIds":[],"comentarioIds":[],"comentarioLibre":""}],"updatedAt":"2026-05-24T18:01:34.807Z"}],"savedAt":"2026-05-24T18:01:34.807Z"}],"advanceLogs":[],"subtotal":0,"discountAmount":0,"total":0,"quotedAt":"2026-05-24T18:01:34.807Z"}', '2026-06-05 10:42:58', '2026-06-05 10:42:58', 1, '0.00', 'AMOUNT', '0.00', '0.00', '0.00'),
('evt_test_1780581152206', 'cmp_test_1780581152206', 'mgr_test_1_1780581152206', NULL, NULL, 'Juan Pérez', 'jperez@corp-e2e.com', 'Corporación de Pruebas E2E S.A.', 'Ciudad de Guatemala', 'Corporativo', 'Gran Salón', '09:00 - 17:00', 'COT-9999', '2026-06-04 00:00:00', '55551234', '1234567-8', 150, '2026-06-04 00:00:00', NULL, '2026-06-04 00:00:00', '2026-06-04 00:00:00', NULL, NULL, NULL, '2026-06-05T15:45:27.252Z', '{"companyId":"cmp_test_1780581152206","companyName":"","managerId":"mgr_test_1_1780581152206","managerName":"","contact":"Juan Pérez","email":"jperez@corp-e2e.com","phone":"55551234","nit":"1234567-8","billTo":"Corporación de Pruebas E2E S.A.","address":"Ciudad de Guatemala","eventType":"Corporativo","venue":"Gran Salón","schedule":"09:00 - 17:00","code":"COT-9999","docDate":"2026-06-04","people":"150","eventDate":"2026-06-04","endDate":"2026-06-04","dueDate":"2026-06-04","discountType":"AMOUNT","discountValue":0,"items":[{"id":"item_1_1780581152210","name":"Almuerzo Ejecutivo Buffet","price":125,"qty":150,"total":18750},{"id":"item_2_1780581152210","name":"Alquiler de Proyector HD","price":450,"qty":1,"total":450}],"advances":[],"templateId":"contrato_corp","currency":"GTQ","internalNotes":"","version":1,"versions":[],"paymentType":"","menuMontajeEntries":[{"id":"mme_1780581152210","date":"2026-06-04","salon":"Gran Salón","menuTitle":"Menú Conferencia Anual E2E 2026","menuQty":150,"menuNotes":"Servir a las 13:00 Hrs en punto.","menuDescription":"[PLATO 1]\\n- PLATO FUERTE (Cant 75 - Pechuga Cordon Bleu) | HORARIO (10:00) | PREPARACION (Por definir) | SALSAS (Salsa a la Pimienta (x45), Jus de Ternera (x25), Salsa de Champiñones (x56)) | GUARNICIONES (Arroz Almendrado, Puré de Papa Rústico (x6)) | POSTRES (Cheesecake de Frambuesa (x17)) | BEBIDAS (Por definir) | PAN/TORTILLA (Por definir)\\n\\n[PLATO 2]\\n- PLATO FUERTE (Cant 75 - Lasaña Vegetariana) | HORARIO (13:30) | PREPARACION (Por definir) | SALSAS (Jus de Ternera (x75)) | GUARNICIONES (Arroz Almendrado) | POSTRES (Por definir) | BEBIDAS (Por definir) | PAN/TORTILLA (Por definir)\\n\\n[COMENTARIO]\\n- Servir a las 13:00 Hrs en punto.","montajeDescription":"[MONTAJE]\\n- TIPO (Montaje Escuela) | ADICIONALES (Arreglo Floral Centro, Mantelería Blanca)","lineItems":[{"key":"cbe7qqe","platoId":2,"preparacionId":null,"qty":75,"servicioHora":"10:00","salsaIds":[2,3,1],"guarnicionIds":[3,1],"postreIds":[2],"bebidaIds":[],"bebidaQtys":{},"comentarioIds":[],"comentarioQtys":{},"salsaQtys":{"1":56,"2":45,"3":25},"guarnicionQtys":{"1":6,"3":1},"postreQtys":{"2":17},"comentarioLibre":"","suggestedSalsaIds":[],"suggestedGuarnicionIds":[],"suggestedPostreIds":[],"suggestedBebidaIds":[],"adicionales":[]},{"key":"8uuzjkt","platoId":3,"preparacionId":null,"qty":75,"servicioHora":"13:30","salsaIds":[3],"guarnicionIds":[3],"postreIds":[],"bebidaIds":[],"bebidaQtys":{},"comentarioIds":[],"comentarioQtys":{},"salsaQtys":{"3":75},"guarnicionQtys":{"3":1},"postreQtys":{},"adicionales":[],"comentarioLibre":"","suggestedSalsaIds":[],"suggestedGuarnicionIds":[],"suggestedPostreIds":[],"suggestedBebidaIds":[]}],"updatedAt":"2026-06-05T15:45:27.252Z"}],"menuMontajeVersion":6,"menuMontajeVersions":[{"version":1,"savedAt":"2026-06-04T13:52:32.210Z","entries":[]},{"version":2,"entries":[{"id":"mme_1780581152210","date":"2026-06-04","salon":"Gran Salón","menuTitle":"Menú Conferencia Anual E2E 2026","menuQty":150,"menuNotes":"Servir a las 13:00 Hrs en punto.","menuDescription":"[PLATO 1]\\n- PLATO FUERTE (Cant 150 - Lasaña Vegetariana) | HORARIO (13:30) | PREPARACION (Por definir) | SALSAS (Salsa a la Pimienta (x45), Jus de Ternera (x25), Salsa de Champiñones (x56)) | GUARNICIONES (Arroz Almendrado, Puré de Papa Rústico (x6)) | POSTRES (Cheesecake de Frambuesa (x15)) | BEBIDAS (Por definir) | PAN/TORTILLA (Por definir)\\n\\n[COMENTARIO GENERAL]\\n- Servir a las 13:00 Hrs en punto.","montajeDescription":"[MONTAJE]\\n- TIPO (Montaje Escuela) | ADICIONALES (Arreglo Floral Centro, Mantelería Blanca)","lineItems":[{"key":"cbe7qqe","platoId":3,"preparacionId":null,"qty":150,"servicioHora":"13:30","salsaIds":[2,3,1],"guarnicionIds":[3,1],"postreIds":[2],"bebidaIds":[],"bebidaQtys":{},"comentarioIds":[],"comentarioQtys":{},"salsaQtys":{"1":56,"2":45,"3":25},"guarnicionQtys":{"1":6,"3":1},"postreQtys":{"2":15},"comentarioLibre":"","suggestedSalsaIds":[],"suggestedGuarnicionIds":[],"suggestedPostreIds":[],"suggestedBebidaIds":[]}],"updatedAt":"2026-06-05T14:32:33.495Z"}],"savedAt":"2026-06-05T14:32:33.495Z"},{"version":3,"entries":[{"id":"mme_1780581152210","date":"2026-06-04","salon":"Gran Salón","menuTitle":"Menú Conferencia Anual E2E 2026","menuQty":150,"menuNotes":"Servir a las 13:00 Hrs en punto.","menuDescription":"[PLATO 1]\\n- PLATO FUERTE (Cant 75 - Pechuga Cordon Bleu) | HORARIO (Sin hora) | PREPARACION (Por definir) | SALSAS (Salsa a la Pimienta (x45), Jus de Ternera (x25), Salsa de Champiñones (x56)) | GUARNICIONES (Arroz Almendrado, Puré de Papa Rústico (x6)) | POSTRES (Cheesecake de Frambuesa (x15)) | BEBIDAS (Por definir) | PAN/TORTILLA (Por definir)\\n\\n[PLATO 2]\\n- PLATO FUERTE (Cant 75 - Lasaña Vegetariana) | HORARIO (13:30) | PREPARACION (Por definir) | SALSAS (Jus de Ternera (x75)) | GUARNICIONES (Por definir) | POSTRES (Por definir) | BEBIDAS (Por definir) | PAN/TORTILLA (Por definir)\\n\\n[COMENTARIO]\\n- Servir a las 13:00 Hrs en punto.","montajeDescription":"[MONTAJE]\\n- TIPO (Montaje Escuela) | ADICIONALES (Arreglo Floral Centro, Mantelería Blanca)","lineItems":[{"key":"cbe7qqe","platoId":2,"preparacionId":null,"qty":75,"servicioHora":"","salsaIds":[2,3,1],"guarnicionIds":[3,1],"postreIds":[2],"bebidaIds":[],"bebidaQtys":{},"comentarioIds":[],"comentarioQtys":{},"salsaQtys":{"1":56,"2":45,"3":25},"guarnicionQtys":{"1":6,"3":1},"postreQtys":{"2":15},"comentarioLibre":"","suggestedSalsaIds":[],"suggestedGuarnicionIds":[],"suggestedPostreIds":[],"suggestedBebidaIds":[],"adicionales":[]},{"key":"8uuzjkt","platoId":3,"preparacionId":null,"qty":75,"servicioHora":"13:30","salsaIds":[3],"guarnicionIds":[],"postreIds":[],"bebidaIds":[],"bebidaQtys":{},"comentarioIds":[],"comentarioQtys":{},"salsaQtys":{"3":75},"guarnicionQtys":{},"postreQtys":{},"adicionales":[],"comentarioLibre":"","suggestedSalsaIds":[],"suggestedGuarnicionIds":[],"suggestedPostreIds":[],"suggestedBebidaIds":[]}],"updatedAt":"2026-06-05T15:05:07.814Z"}],"savedAt":"2026-06-05T15:05:07.814Z"},{"version":4,"entries":[{"id":"mme_1780581152210","date":"2026-06-04","salon":"Gran Salón","menuTitle":"Menú Conferencia Anual E2E 2026","menuQty":150,"menuNotes":"Servir a las 13:00 Hrs en punto.","menuDescription":"[PLATO 1]\\n- PLATO FUERTE (Cant 75 - Pechuga Cordon Bleu) | HORARIO (Sin hora) | PREPARACION (Por definir) | SALSAS (Salsa a la Pimienta (x45), Jus de Ternera (x25), Salsa de Champiñones (x56)) | GUARNICIONES (Arroz Almendrado, Puré de Papa Rústico (x6)) | POSTRES (Cheesecake de Frambuesa (x15)) | BEBIDAS (Por definir) | PAN/TORTILLA (Por definir)\\n\\n[PLATO 2]\\n- PLATO FUERTE (Cant 75 - Lasaña Vegetariana) | HORARIO (13:30) | PREPARACION (Por definir) | SALSAS (Jus de Ternera (x75)) | GUARNICIONES (Arroz Almendrado) | POSTRES (Por definir) | BEBIDAS (Por definir) | PAN/TORTILLA (Por definir)\\n\\n[COMENTARIO]\\n- Servir a las 13:00 Hrs en punto.","montajeDescription":"[MONTAJE]\\n- TIPO (Montaje Escuela) | ADICIONALES (Arreglo Floral Centro, Mantelería Blanca)","lineItems":[{"key":"cbe7qqe","platoId":2,"preparacionId":null,"qty":75,"servicioHora":"","salsaIds":[2,3,1],"guarnicionIds":[3,1],"postreIds":[2],"bebidaIds":[],"bebidaQtys":{},"comentarioIds":[],"comentarioQtys":{},"salsaQtys":{"1":56,"2":45,"3":25},"guarnicionQtys":{"1":6,"3":1},"postreQtys":{"2":15},"comentarioLibre":"","suggestedSalsaIds":[],"suggestedGuarnicionIds":[],"suggestedPostreIds":[],"suggestedBebidaIds":[],"adicionales":[]},{"key":"8uuzjkt","platoId":3,"preparacionId":null,"qty":75,"servicioHora":"13:30","salsaIds":[3],"guarnicionIds":[3],"postreIds":[],"bebidaIds":[],"bebidaQtys":{},"comentarioIds":[],"comentarioQtys":{},"salsaQtys":{"3":75},"guarnicionQtys":{"3":1},"postreQtys":{},"adicionales":[],"comentarioLibre":"","suggestedSalsaIds":[],"suggestedGuarnicionIds":[],"suggestedPostreIds":[],"suggestedBebidaIds":[]}],"updatedAt":"2026-06-05T15:22:58.564Z"}],"savedAt":"2026-06-05T15:22:58.564Z"},{"version":5,"entries":[{"id":"mme_1780581152210","date":"2026-06-04","salon":"Gran Salón","menuTitle":"Menú Conferencia Anual E2E 2026","menuQty":150,"menuNotes":"Servir a las 13:00 Hrs en punto.","menuDescription":"[PLATO 1]\\n- PLATO FUERTE (Cant 75 - Pechuga Cordon Bleu) | HORARIO (Sin hora) | PREPARACION (Por definir) | SALSAS (Salsa a la Pimienta (x45), Jus de Ternera (x25), Salsa de Champiñones (x56)) | GUARNICIONES (Arroz Almendrado, Puré de Papa Rústico (x6)) | POSTRES (Cheesecake de Frambuesa (x17)) | BEBIDAS (Por definir) | PAN/TORTILLA (Por definir)\\n\\n[PLATO 2]\\n- PLATO FUERTE (Cant 75 - Lasaña Vegetariana) | HORARIO (13:30) | PREPARACION (Por definir) | SALSAS (Jus de Ternera (x75)) | GUARNICIONES (Arroz Almendrado) | POSTRES (Por definir) | BEBIDAS (Por definir) | PAN/TORTILLA (Por definir)\\n\\n[COMENTARIO]\\n- Servir a las 13:00 Hrs en punto.","montajeDescription":"[MONTAJE]\\n- TIPO (Montaje Escuela) | ADICIONALES (Arreglo Floral Centro, Mantelería Blanca)","lineItems":[{"key":"cbe7qqe","platoId":2,"preparacionId":null,"qty":75,"servicioHora":"","salsaIds":[2,3,1],"guarnicionIds":[3,1],"postreIds":[2],"bebidaIds":[],"bebidaQtys":{},"comentarioIds":[],"comentarioQtys":{},"salsaQtys":{"1":56,"2":45,"3":25},"guarnicionQtys":{"1":6,"3":1},"postreQtys":{"2":17},"comentarioLibre":"","suggestedSalsaIds":[],"suggestedGuarnicionIds":[],"suggestedPostreIds":[],"suggestedBebidaIds":[],"adicionales":[]},{"key":"8uuzjkt","platoId":3,"preparacionId":null,"qty":75,"servicioHora":"13:30","salsaIds":[3],"guarnicionIds":[3],"postreIds":[],"bebidaIds":[],"bebidaQtys":{},"comentarioIds":[],"comentarioQtys":{},"salsaQtys":{"3":75},"guarnicionQtys":{"3":1},"postreQtys":{},"adicionales":[],"comentarioLibre":"","suggestedSalsaIds":[],"suggestedGuarnicionIds":[],"suggestedPostreIds":[],"suggestedBebidaIds":[]}],"updatedAt":"2026-06-05T15:38:09.748Z"}],"savedAt":"2026-06-05T15:38:09.748Z"},{"version":6,"entries":[{"id":"mme_1780581152210","date":"2026-06-04","salon":"Gran Salón","menuTitle":"Menú Conferencia Anual E2E 2026","menuQty":150,"menuNotes":"Servir a las 13:00 Hrs en punto.","menuDescription":"[PLATO 1]\\n- PLATO FUERTE (Cant 75 - Pechuga Cordon Bleu) | HORARIO (10:00) | PREPARACION (Por definir) | SALSAS (Salsa a la Pimienta (x45), Jus de Ternera (x25), Salsa de Champiñones (x56)) | GUARNICIONES (Arroz Almendrado, Puré de Papa Rústico (x6)) | POSTRES (Cheesecake de Frambuesa (x17)) | BEBIDAS (Por definir) | PAN/TORTILLA (Por definir)\\n\\n[PLATO 2]\\n- PLATO FUERTE (Cant 75 - Lasaña Vegetariana) | HORARIO (13:30) | PREPARACION (Por definir) | SALSAS (Jus de Ternera (x75)) | GUARNICIONES (Arroz Almendrado) | POSTRES (Por definir) | BEBIDAS (Por definir) | PAN/TORTILLA (Por definir)\\n\\n[COMENTARIO]\\n- Servir a las 13:00 Hrs en punto.","montajeDescription":"[MONTAJE]\\n- TIPO (Montaje Escuela) | ADICIONALES (Arreglo Floral Centro, Mantelería Blanca)","lineItems":[{"key":"cbe7qqe","platoId":2,"preparacionId":null,"qty":75,"servicioHora":"10:00","salsaIds":[2,3,1],"guarnicionIds":[3,1],"postreIds":[2],"bebidaIds":[],"bebidaQtys":{},"comentarioIds":[],"comentarioQtys":{},"salsaQtys":{"1":56,"2":45,"3":25},"guarnicionQtys":{"1":6,"3":1},"postreQtys":{"2":17},"comentarioLibre":"","suggestedSalsaIds":[],"suggestedGuarnicionIds":[],"suggestedPostreIds":[],"suggestedBebidaIds":[],"adicionales":[]},{"key":"8uuzjkt","platoId":3,"preparacionId":null,"qty":75,"servicioHora":"13:30","salsaIds":[3],"guarnicionIds":[3],"postreIds":[],"bebidaIds":[],"bebidaQtys":{},"comentarioIds":[],"comentarioQtys":{},"salsaQtys":{"3":75},"guarnicionQtys":{"3":1},"postreQtys":{},"adicionales":[],"comentarioLibre":"","suggestedSalsaIds":[],"suggestedGuarnicionIds":[],"suggestedPostreIds":[],"suggestedBebidaIds":[]}],"updatedAt":"2026-06-05T15:45:27.252Z"}],"savedAt":"2026-06-05T15:45:27.252Z"}],"advanceLogs":[],"subtotal":19200,"discountAmount":0,"total":19200,"quotedAt":"2026-06-05T15:45:27.252Z"}', '2026-06-05 10:42:58', '2026-06-05 10:42:58', 1, '19200.00', 'AMOUNT', '0.00', '0.00', '19200.00');

--
-- Estructura de tabla para la tabla `doc_sequence`
--
DROP TABLE IF EXISTS `doc_sequence`;
CREATE TABLE `doc_sequence` (
  `scope` varchar(40) NOT NULL,
  `last_value` bigint(20) unsigned NOT NULL DEFAULT 0,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`scope`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

--
-- Volcado de datos para la tabla `doc_sequence`
--
INSERT INTO `doc_sequence` (`scope`, `last_value`, `updated_at`) VALUES
('COT', '9999', '2026-06-04 07:52:32');

--
-- Estructura de tabla para la tabla `empresas`
--
DROP TABLE IF EXISTS `empresas`;
CREATE TABLE `empresas` (
  `id` varchar(80) NOT NULL,
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

--
-- Volcado de datos para la tabla `empresas`
--
INSERT INTO `empresas` (`id`, `nombre`, `encargado_principal`, `correo`, `nit`, `razon_social`, `tipo_evento`, `direccion`, `telefono`, `notas`, `creado_en`) VALUES
('cmp_test_1780581152206', 'Corporación de Pruebas E2E S.A.', 'Juan Pérez', 'contacto@corp-e2e.com', '1234567-8', 'Corporación de Pruebas E2E S.A.', 'Corporativo', 'Avenida de la Reforma 12-01, Ciudad de Guatemala', '55551234', NULL, '2026-06-05 10:42:58'),
('emp_001', 'Tech Solutions Corp', 'Carlos Méndez', 'contacto@techsolutions.com', '1234567-8', 'Tech Solutions S.A.', 'Corporativo', 'Av. Reforma 1-50, Zona 9, Guatemala', '2233-4455', NULL, '2026-06-05 10:42:58'),
('emp_002', 'Universidad San Pablo', 'Lic. Marta Reyes', 'eventos@uspanpablo.edu.gt', '9876543-2', 'Universidad San Pablo', 'Educativo / Graduación', 'Zona 16, Blvd. Rafael Landívar', '2411-2233', NULL, '2026-06-05 10:42:58'),
('emp_003', 'Comercializadora El Sol', 'Juan Pérez', 'jperez@elsol.com', '4561237-9', 'El Sol y CIA S.A.', 'Convivio', 'Calzada Aguilar Batres, Zona 11', '2477-8899', NULL, '2026-06-05 10:42:58');

--
-- Estructura de tabla para la tabla `encargados_empresa`
--
DROP TABLE IF EXISTS `encargados_empresa`;
CREATE TABLE `encargados_empresa` (
  `id` varchar(80) NOT NULL,
  `id_empresa` varchar(80) NOT NULL,
  `nombre` varchar(200) NOT NULL,
  `telefono` varchar(80) DEFAULT NULL,
  `correo` varchar(200) DEFAULT NULL,
  `direccion` varchar(300) DEFAULT NULL,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_encargados_empresa` (`id_empresa`),
  CONSTRAINT `fk_encargados_empresa` FOREIGN KEY (`id_empresa`) REFERENCES `empresas` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `encargados_empresa`
--
INSERT INTO `encargados_empresa` (`id`, `id_empresa`, `nombre`, `telefono`, `correo`, `direccion`, `creado_en`) VALUES
('enc_001', 'emp_001', 'Carlos Méndez', '5544-3322', 'cmendez@techsolutions.com', 'Av. Reforma 1-50, Zona 9', '2026-06-05 10:42:58'),
('enc_002', 'emp_001', 'Ana Castillo (Logística)', '5544-1111', 'logistica@techsolutions.com', 'Av. Reforma 1-50, Zona 9', '2026-06-05 10:42:58'),
('enc_003', 'emp_002', 'Lic. Marta Reyes', '5988-7766', 'mreyes@uspanpablo.edu.gt', 'Zona 16', '2026-06-05 10:42:58'),
('enc_004', 'emp_003', 'Juan Pérez', '5011-2030', 'jperez@elsol.com', 'Calzada Aguilar Batres', '2026-06-05 10:42:58'),
('mgr_test_1_1780581152206', 'cmp_test_1780581152206', 'Juan Pérez', '55551234', 'jperez@corp-e2e.com', 'Ciudad de Guatemala', '2026-06-05 10:42:58'),
('mgr_test_2_1780581152206', 'cmp_test_1780581152206', 'Ana Gómez', '55555678', 'agomez@corp-e2e.com', 'Antigua Guatemala', '2026-06-05 10:42:58');

--
-- Estructura de tabla para la tabla `eventos`
--
DROP TABLE IF EXISTS `eventos`;
CREATE TABLE `eventos` (
  `id` varchar(80) NOT NULL,
  `id_grupo` varchar(120) DEFAULT NULL,
  `nombre` varchar(240) NOT NULL,
  `nombre_salon` varchar(120) NOT NULL,
  `fecha_evento` date NOT NULL,
  `fecha_inicio_reserva` date DEFAULT NULL,
  `fecha_fin_reserva` date DEFAULT NULL,
  `hora_inicio` time NOT NULL,
  `hora_fin` time NOT NULL,
  `estado` varchar(80) NOT NULL,
  `id_usuario` varchar(80) DEFAULT NULL,
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

--
-- Volcado de datos para la tabla `eventos`
--
INSERT INTO `eventos` (`id`, `id_grupo`, `nombre`, `nombre_salon`, `fecha_evento`, `fecha_inicio_reserva`, `fecha_fin_reserva`, `hora_inicio`, `hora_fin`, `estado`, `id_usuario`, `pax`, `notas`, `cotizacion_json`, `creado_en`, `actualizado_en`) VALUES
('ev_0029e766a038a8_19e4c7ceaa2', 'grp_ev_9cd463f58382d_19e4c862cd6', 'Reunion Empresa Claro', 'Sala Ejecutiva', '2026-05-22 00:00:00', '2026-05-22 00:00:00', '2026-05-22 00:00:00', '02:00:00', '03:00:00', 'Perdido', 'kLy8WstSA9SFw8fKkdW88BKEKci2', 50, NULL, '{"companyId":"","managerId":"","dueDate":"2026-04-22","docDate":"2026-05-22","paymentType":"","code":"COT-009","contact":"","email":"","billTo":"","address":"","eventType":"","venue":"","schedule":"","phone":"","nit":"","people":"50","eventDate":"2026-05-22","folio":"","endDate":"2026-05-22","internalNotes":"","discountType":"AMOUNT","discountValue":0,"items":[],"notes":"","templateId":"tpl-contrato-corp","currency":"GTQ","version":1,"versions":[],"advances":[],"menuMontajeVersions":[{"version":1,"entries":[{"date":"2026-05-22","salon":"Gran Salón","menuTitle":"","menuQty":0,"menuDescription":"[PLATOS FUERTES]\\n- Por definir","montajeDescription":"[MONTAJE]\\n- TIPO (Auditorio) | ADICIONALES (Ninguno)","menuSelection":{"section":"General","platoId":null,"platoQty":1,"preparacionId":null,"platoItems":[],"lineItems":[],"salsaIds":[],"guarnicionIds":[],"guarnicionQtys":{},"postreIds":[],"postreQtys":{},"bebidaIds":[],"bebidaQtys":{},"comentarioIds":[],"comentarioLibre":""},"montajeSelection":{"tipoId":4,"adicionalIds":[]}}],"savedAt":"2026-05-21T21:57:47.510Z"}],"menuMontajeVersion":1,"menuMontajeEntries":[{"id":"ev_cbafd64cb65df_19e4c8b7176","date":"2026-05-22","salon":"Gran Salón","menuTitle":"","menuQty":0,"menuDescription":"[PLATOS FUERTES]\\n- Por definir","montajeDescription":"[MONTAJE]\\n- TIPO (Auditorio) | ADICIONALES (Ninguno)","menuSelection":{"section":"General","platoId":null,"platoQty":1,"preparacionId":null,"platoItems":[],"lineItems":[],"salsaIds":[],"guarnicionIds":[],"guarnicionQtys":{},"postreIds":[],"postreQtys":{},"bebidaIds":[],"bebidaQtys":{},"comentarioIds":[],"comentarioLibre":""},"montajeSelection":{"tipoId":4,"adicionalIds":[]},"updatedAt":"2026-05-21T21:57:47.510Z"}],"quotedAt":"2026-05-21T21:57:47.510Z"}', '2026-06-05 10:42:58', '2026-06-05 10:42:58'),
('ev_cddff2e75860f_19e5fc88769', 'evt_1e2ee833f19068_19e5be5a53f', '15 años', 'San Pedro', '2026-05-28 00:00:00', '2026-05-28 00:00:00', '2026-05-29 00:00:00', '08:00:00', '13:00:00', 'Lista de Espera', 'PP7L1SWd2mYJHGa5ZPAvOjtIHek2', 70, NULL, NULL, '2026-06-05 10:42:58', '2026-06-05 10:42:58'),
('ev_cddff2e75860f_19e5fc88769_slot_1_20260529', 'evt_1e2ee833f19068_19e5be5a53f', '15 años', 'San Pedro', '2026-05-29 00:00:00', '2026-05-28 00:00:00', '2026-05-29 00:00:00', '08:00:00', '13:00:00', 'Lista de Espera', 'PP7L1SWd2mYJHGa5ZPAvOjtIHek2', 70, NULL, NULL, '2026-06-05 10:42:58', '2026-06-05 10:42:58'),
('evt_1779394960744', 'evt_1779394960744', 'Celebración de 15 Años Estefanía', 'Gran Salón, Terraza Panorámica', '2026-05-26 00:00:00', '2026-05-26 00:00:00', '2026-05-26 00:00:00', '08:00:00', '13:00:00', 'Confirmado', 'PP7L1SWd2mYJHGa5ZPAvOjtIHek2', 118, NULL, '{"companyId":"","companyName":"","managerId":"","managerName":"","contact":"","email":"","phone":"","nit":"","billTo":"","address":"","eventType":"","venue":"Gran Salón, Terraza Panorámica","schedule":"","code":"COT-010","docDate":"2026-05-24","people":118,"eventDate":"2026-05-26","endDate":"2026-05-26","dueDate":"","discountType":"AMOUNT","discountValue":0,"items":[],"advances":[],"templateId":"contrato_corp","currency":"GTQ","internalNotes":"","version":1,"versions":[],"paymentType":"","menuMontajeEntries":[{"id":"bbxnu7l","date":"2026-05-26","salon":"Gran Salón, Terraza Panorámica","menuTitle":"Menú de Celebración de 15 Años Estefanía","menuQty":121,"menuDescription":"[PLATO 1]\\n- PLATO FUERTE (Cant 121 - Medallones de Res al Vino Tinto) | HORARIO (Sin hora) | PREPARACION (Por definir) | SALSAS (Jus de Ternera) | GUARNICIONES (Por definir) | POSTRES (Por definir) | BEBIDAS (Por definir)","montajeDescription":"[MONTAJE]\\n- TIPO (Montaje Imperial) | ADICIONALES (Mantelería Blanca)\\n\\n\\n","lineItems":[{"key":"vpy6gon","platoId":1,"preparacionId":null,"qty":121,"servicioHora":"","salsaIds":[3],"guarnicionIds":[],"postreIds":[],"bebidaIds":[],"comentarioIds":[],"comentarioLibre":""}],"updatedAt":"2026-05-24T18:01:34.807Z"}],"menuMontajeVersion":5,"menuMontajeVersions":[{"version":1,"entries":[{"id":"bbxnu7l","date":"2026-05-26","salon":"Gran Salón, Terraza Panorámica","menuTitle":"Menú de Celebración de 15 Años Estefanía","menuQty":121,"menuDescription":"[PLATO 1]\\n- PLATO FUERTE (Cant 118 - Medallones de Res al Vino Tinto) | HORARIO (10:40) | PREPARACION (Por definir) | SALSAS (Jus de Ternera, Salsa de Champiñones) | GUARNICIONES (Arroz Almendrado, Puré de Papa Rústico) | POSTRES (Cheesecake de Frambuesa, Tiramisú Clásico) | BEBIDAS (Por definir)\\n","montajeDescription":"[MONTAJE]\\n- TIPO (Montaje Imperial) | ADICIONALES (Mantelería Blanca)\\n\\n\\n","lineItems":[{"key":"enu9rs6","platoId":1,"preparacionId":null,"qty":118,"servicioHora":"10:40","salsaIds":[3,1],"guarnicionIds":[3,1],"postreIds":[2,1],"bebidaIds":[],"comentarioIds":[],"comentarioLibre":""}],"updatedAt":"2026-05-24T15:27:12.056Z"}],"savedAt":"2026-05-24T15:27:12.056Z"},{"version":2,"entries":[{"id":"bbxnu7l","date":"2026-05-26","salon":"Gran Salón, Terraza Panorámica","menuTitle":"Menú de Celebración de 15 Años Estefanía","menuQty":121,"menuDescription":"[PLATO 1]\\n- PLATO FUERTE (Cant 118 - Medallones de Res al Vino Tinto) | HORARIO (10:40) | PREPARACION (Por definir) | SALSAS (Jus de Ternera, Salsa de Champiñones) | GUARNICIONES (Arroz Almendrado, Puré de Papa Rústico) | POSTRES (Cheesecake de Frambuesa, Tiramisú Clásico) | BEBIDAS (Por definir)\\n","montajeDescription":"[MONTAJE]\\n- TIPO (Montaje Imperial) | ADICIONALES (Mantelería Blanca)\\n\\n\\n","lineItems":[{"key":"enu9rs6","platoId":1,"preparacionId":null,"qty":118,"servicioHora":"10:40","salsaIds":[3,1],"guarnicionIds":[3,1],"postreIds":[2,1],"bebidaIds":[],"comentarioIds":[],"comentarioLibre":""}],"updatedAt":"2026-05-24T15:27:12.686Z"}],"savedAt":"2026-05-24T15:27:12.686Z"},{"version":3,"entries":[{"id":"bbxnu7l","date":"2026-05-26","salon":"Gran Salón, Terraza Panorámica","menuTitle":"Menú de Celebración de 15 Años Estefanía","menuQty":121,"menuDescription":"[PLATO 1]\\n- PLATO FUERTE (Cant 118 - Medallones de Res al Vino Tinto) | HORARIO (10:40) | PREPARACION (Por definir) | SALSAS (Jus de Ternera, Salsa de Champiñones) | GUARNICIONES (Arroz Almendrado, Puré de Papa Rústico) | POSTRES (Cheesecake de Frambuesa, Tiramisú Clásico) | BEBIDAS (Por definir)\\n","montajeDescription":"[MONTAJE]\\n- TIPO (Montaje Imperial) | ADICIONALES (Mantelería Blanca)\\n\\n\\n","lineItems":[{"key":"enu9rs6","platoId":1,"preparacionId":null,"qty":118,"servicioHora":"10:40","salsaIds":[3,1],"guarnicionIds":[3,1],"postreIds":[2,1],"bebidaIds":[],"comentarioIds":[],"comentarioLibre":""}],"updatedAt":"2026-05-24T15:28:44.640Z"}],"savedAt":"2026-05-24T15:28:44.640Z"},{"version":4,"entries":[{"id":"bbxnu7l","date":"2026-05-26","salon":"Gran Salón, Terraza Panorámica","menuTitle":"Menú de Celebración de 15 Años Estefanía","menuQty":121,"menuDescription":"[PLATO 1]\\n- PLATO FUERTE (Cant 118 - Medallones de Res al Vino Tinto) | HORARIO (10:40) | PREPARACION (Por definir) | SALSAS (Jus de Ternera, Salsa de Champiñones) | GUARNICIONES (Arroz Almendrado, Puré de Papa Rústico) | POSTRES (Cheesecake de Frambuesa, Tiramisú Clásico) | BEBIDAS (Por definir)\\n","montajeDescription":"[MONTAJE]\\n- TIPO (Montaje Imperial) | ADICIONALES (Mantelería Blanca)\\n\\n\\n","lineItems":[{"key":"enu9rs6","platoId":1,"preparacionId":null,"qty":118,"servicioHora":"10:40","salsaIds":[3,1],"guarnicionIds":[3,1],"postreIds":[2,1],"bebidaIds":[],"comentarioIds":[],"comentarioLibre":""}],"updatedAt":"2026-05-24T15:53:11.525Z"}],"savedAt":"2026-05-24T15:53:11.525Z"},{"version":5,"entries":[{"id":"bbxnu7l","date":"2026-05-26","salon":"Gran Salón, Terraza Panorámica","menuTitle":"Menú de Celebración de 15 Años Estefanía","menuQty":121,"menuDescription":"[PLATO 1]\\n- PLATO FUERTE (Cant 121 - Medallones de Res al Vino Tinto) | HORARIO (Sin hora) | PREPARACION (Por definir) | SALSAS (Jus de Ternera) | GUARNICIONES (Por definir) | POSTRES (Por definir) | BEBIDAS (Por definir)","montajeDescription":"[MONTAJE]\\n- TIPO (Montaje Imperial) | ADICIONALES (Mantelería Blanca)\\n\\n\\n","lineItems":[{"key":"vpy6gon","platoId":1,"preparacionId":null,"qty":121,"servicioHora":"","salsaIds":[3],"guarnicionIds":[],"postreIds":[],"bebidaIds":[],"comentarioIds":[],"comentarioLibre":""}],"updatedAt":"2026-05-24T18:01:34.807Z"}],"savedAt":"2026-05-24T18:01:34.807Z"}],"advanceLogs":[],"subtotal":0,"discountAmount":0,"total":0,"quotedAt":"2026-05-24T18:01:34.807Z"}', '2026-06-05 10:42:58', '2026-06-05 10:42:58'),
('evt_d15305aa0e0b68_19e51ad6740', 'evt_d15305aa0e0b68_19e51ad6740', 'Boda', 'San Pedro', '2026-05-23 00:00:00', '2026-05-23 00:00:00', '2026-05-23 00:00:00', '08:00:00', '10:00:00', 'Cancelado', 'PP7L1SWd2mYJHGa5ZPAvOjtIHek2', 40, NULL, NULL, '2026-06-05 10:42:58', '2026-06-05 10:42:58'),
('evt_test_1780581152206', 'evt_test_1780581152206', 'Conferencia Anual E2E 2026', 'Gran Salón', '2026-06-07 00:00:00', '2026-06-07 00:00:00', '2026-06-07 00:00:00', '09:00:00', '17:00:00', 'Seguimiento', 'kLy8WstSA9SFw8fKkdW88BKEKci2', 150, NULL, '{"companyId":"cmp_test_1780581152206","companyName":"","managerId":"mgr_test_1_1780581152206","managerName":"","contact":"Juan Pérez","email":"jperez@corp-e2e.com","phone":"55551234","nit":"1234567-8","billTo":"Corporación de Pruebas E2E S.A.","address":"Ciudad de Guatemala","eventType":"Corporativo","venue":"Gran Salón","schedule":"09:00 - 17:00","code":"COT-9999","docDate":"2026-06-04","people":"150","eventDate":"2026-06-04","endDate":"2026-06-04","dueDate":"2026-06-04","discountType":"AMOUNT","discountValue":0,"items":[{"id":"item_1_1780581152210","name":"Almuerzo Ejecutivo Buffet","price":125,"qty":150,"total":18750},{"id":"item_2_1780581152210","name":"Alquiler de Proyector HD","price":450,"qty":1,"total":450}],"advances":[],"templateId":"contrato_corp","currency":"GTQ","internalNotes":"","version":1,"versions":[],"paymentType":"","menuMontajeEntries":[{"id":"mme_1780581152210","date":"2026-06-04","salon":"Gran Salón","menuTitle":"Menú Conferencia Anual E2E 2026","menuQty":150,"menuNotes":"Servir a las 13:00 Hrs en punto.","menuDescription":"[PLATO 1]\\n- PLATO FUERTE (Cant 75 - Pechuga Cordon Bleu) | HORARIO (10:00) | PREPARACION (Por definir) | SALSAS (Salsa a la Pimienta (x45), Jus de Ternera (x25), Salsa de Champiñones (x56)) | GUARNICIONES (Arroz Almendrado, Puré de Papa Rústico (x6)) | POSTRES (Cheesecake de Frambuesa (x17)) | BEBIDAS (Por definir) | PAN/TORTILLA (Por definir)\\n\\n[PLATO 2]\\n- PLATO FUERTE (Cant 75 - Lasaña Vegetariana) | HORARIO (13:30) | PREPARACION (Por definir) | SALSAS (Jus de Ternera (x75)) | GUARNICIONES (Arroz Almendrado) | POSTRES (Por definir) | BEBIDAS (Por definir) | PAN/TORTILLA (Por definir)\\n\\n[COMENTARIO]\\n- Servir a las 13:00 Hrs en punto.","montajeDescription":"[MONTAJE]\\n- TIPO (Montaje Escuela) | ADICIONALES (Arreglo Floral Centro, Mantelería Blanca)","lineItems":[{"key":"cbe7qqe","platoId":2,"preparacionId":null,"qty":75,"servicioHora":"10:00","salsaIds":[2,3,1],"guarnicionIds":[3,1],"postreIds":[2],"bebidaIds":[],"bebidaQtys":{},"comentarioIds":[],"comentarioQtys":{},"salsaQtys":{"1":56,"2":45,"3":25},"guarnicionQtys":{"1":6,"3":1},"postreQtys":{"2":17},"comentarioLibre":"","suggestedSalsaIds":[],"suggestedGuarnicionIds":[],"suggestedPostreIds":[],"suggestedBebidaIds":[],"adicionales":[]},{"key":"8uuzjkt","platoId":3,"preparacionId":null,"qty":75,"servicioHora":"13:30","salsaIds":[3],"guarnicionIds":[3],"postreIds":[],"bebidaIds":[],"bebidaQtys":{},"comentarioIds":[],"comentarioQtys":{},"salsaQtys":{"3":75},"guarnicionQtys":{"3":1},"postreQtys":{},"adicionales":[],"comentarioLibre":"","suggestedSalsaIds":[],"suggestedGuarnicionIds":[],"suggestedPostreIds":[],"suggestedBebidaIds":[]}],"updatedAt":"2026-06-05T15:45:27.252Z"}],"menuMontajeVersion":6,"menuMontajeVersions":[{"version":1,"savedAt":"2026-06-04T13:52:32.210Z","entries":[]},{"version":2,"entries":[{"id":"mme_1780581152210","date":"2026-06-04","salon":"Gran Salón","menuTitle":"Menú Conferencia Anual E2E 2026","menuQty":150,"menuNotes":"Servir a las 13:00 Hrs en punto.","menuDescription":"[PLATO 1]\\n- PLATO FUERTE (Cant 150 - Lasaña Vegetariana) | HORARIO (13:30) | PREPARACION (Por definir) | SALSAS (Salsa a la Pimienta (x45), Jus de Ternera (x25), Salsa de Champiñones (x56)) | GUARNICIONES (Arroz Almendrado, Puré de Papa Rústico (x6)) | POSTRES (Cheesecake de Frambuesa (x15)) | BEBIDAS (Por definir) | PAN/TORTILLA (Por definir)\\n\\n[COMENTARIO GENERAL]\\n- Servir a las 13:00 Hrs en punto.","montajeDescription":"[MONTAJE]\\n- TIPO (Montaje Escuela) | ADICIONALES (Arreglo Floral Centro, Mantelería Blanca)","lineItems":[{"key":"cbe7qqe","platoId":3,"preparacionId":null,"qty":150,"servicioHora":"13:30","salsaIds":[2,3,1],"guarnicionIds":[3,1],"postreIds":[2],"bebidaIds":[],"bebidaQtys":{},"comentarioIds":[],"comentarioQtys":{},"salsaQtys":{"1":56,"2":45,"3":25},"guarnicionQtys":{"1":6,"3":1},"postreQtys":{"2":15},"comentarioLibre":"","suggestedSalsaIds":[],"suggestedGuarnicionIds":[],"suggestedPostreIds":[],"suggestedBebidaIds":[]}],"updatedAt":"2026-06-05T14:32:33.495Z"}],"savedAt":"2026-06-05T14:32:33.495Z"},{"version":3,"entries":[{"id":"mme_1780581152210","date":"2026-06-04","salon":"Gran Salón","menuTitle":"Menú Conferencia Anual E2E 2026","menuQty":150,"menuNotes":"Servir a las 13:00 Hrs en punto.","menuDescription":"[PLATO 1]\\n- PLATO FUERTE (Cant 75 - Pechuga Cordon Bleu) | HORARIO (Sin hora) | PREPARACION (Por definir) | SALSAS (Salsa a la Pimienta (x45), Jus de Ternera (x25), Salsa de Champiñones (x56)) | GUARNICIONES (Arroz Almendrado, Puré de Papa Rústico (x6)) | POSTRES (Cheesecake de Frambuesa (x15)) | BEBIDAS (Por definir) | PAN/TORTILLA (Por definir)\\n\\n[PLATO 2]\\n- PLATO FUERTE (Cant 75 - Lasaña Vegetariana) | HORARIO (13:30) | PREPARACION (Por definir) | SALSAS (Jus de Ternera (x75)) | GUARNICIONES (Por definir) | POSTRES (Por definir) | BEBIDAS (Por definir) | PAN/TORTILLA (Por definir)\\n\\n[COMENTARIO]\\n- Servir a las 13:00 Hrs en punto.","montajeDescription":"[MONTAJE]\\n- TIPO (Montaje Escuela) | ADICIONALES (Arreglo Floral Centro, Mantelería Blanca)","lineItems":[{"key":"cbe7qqe","platoId":2,"preparacionId":null,"qty":75,"servicioHora":"","salsaIds":[2,3,1],"guarnicionIds":[3,1],"postreIds":[2],"bebidaIds":[],"bebidaQtys":{},"comentarioIds":[],"comentarioQtys":{},"salsaQtys":{"1":56,"2":45,"3":25},"guarnicionQtys":{"1":6,"3":1},"postreQtys":{"2":15},"comentarioLibre":"","suggestedSalsaIds":[],"suggestedGuarnicionIds":[],"suggestedPostreIds":[],"suggestedBebidaIds":[],"adicionales":[]},{"key":"8uuzjkt","platoId":3,"preparacionId":null,"qty":75,"servicioHora":"13:30","salsaIds":[3],"guarnicionIds":[],"postreIds":[],"bebidaIds":[],"bebidaQtys":{},"comentarioIds":[],"comentarioQtys":{},"salsaQtys":{"3":75},"guarnicionQtys":{},"postreQtys":{},"adicionales":[],"comentarioLibre":"","suggestedSalsaIds":[],"suggestedGuarnicionIds":[],"suggestedPostreIds":[],"suggestedBebidaIds":[]}],"updatedAt":"2026-06-05T15:05:07.814Z"}],"savedAt":"2026-06-05T15:05:07.814Z"},{"version":4,"entries":[{"id":"mme_1780581152210","date":"2026-06-04","salon":"Gran Salón","menuTitle":"Menú Conferencia Anual E2E 2026","menuQty":150,"menuNotes":"Servir a las 13:00 Hrs en punto.","menuDescription":"[PLATO 1]\\n- PLATO FUERTE (Cant 75 - Pechuga Cordon Bleu) | HORARIO (Sin hora) | PREPARACION (Por definir) | SALSAS (Salsa a la Pimienta (x45), Jus de Ternera (x25), Salsa de Champiñones (x56)) | GUARNICIONES (Arroz Almendrado, Puré de Papa Rústico (x6)) | POSTRES (Cheesecake de Frambuesa (x15)) | BEBIDAS (Por definir) | PAN/TORTILLA (Por definir)\\n\\n[PLATO 2]\\n- PLATO FUERTE (Cant 75 - Lasaña Vegetariana) | HORARIO (13:30) | PREPARACION (Por definir) | SALSAS (Jus de Ternera (x75)) | GUARNICIONES (Arroz Almendrado) | POSTRES (Por definir) | BEBIDAS (Por definir) | PAN/TORTILLA (Por definir)\\n\\n[COMENTARIO]\\n- Servir a las 13:00 Hrs en punto.","montajeDescription":"[MONTAJE]\\n- TIPO (Montaje Escuela) | ADICIONALES (Arreglo Floral Centro, Mantelería Blanca)","lineItems":[{"key":"cbe7qqe","platoId":2,"preparacionId":null,"qty":75,"servicioHora":"","salsaIds":[2,3,1],"guarnicionIds":[3,1],"postreIds":[2],"bebidaIds":[],"bebidaQtys":{},"comentarioIds":[],"comentarioQtys":{},"salsaQtys":{"1":56,"2":45,"3":25},"guarnicionQtys":{"1":6,"3":1},"postreQtys":{"2":15},"comentarioLibre":"","suggestedSalsaIds":[],"suggestedGuarnicionIds":[],"suggestedPostreIds":[],"suggestedBebidaIds":[],"adicionales":[]},{"key":"8uuzjkt","platoId":3,"preparacionId":null,"qty":75,"servicioHora":"13:30","salsaIds":[3],"guarnicionIds":[3],"postreIds":[],"bebidaIds":[],"bebidaQtys":{},"comentarioIds":[],"comentarioQtys":{},"salsaQtys":{"3":75},"guarnicionQtys":{"3":1},"postreQtys":{},"adicionales":[],"comentarioLibre":"","suggestedSalsaIds":[],"suggestedGuarnicionIds":[],"suggestedPostreIds":[],"suggestedBebidaIds":[]}],"updatedAt":"2026-06-05T15:22:58.564Z"}],"savedAt":"2026-06-05T15:22:58.564Z"},{"version":5,"entries":[{"id":"mme_1780581152210","date":"2026-06-04","salon":"Gran Salón","menuTitle":"Menú Conferencia Anual E2E 2026","menuQty":150,"menuNotes":"Servir a las 13:00 Hrs en punto.","menuDescription":"[PLATO 1]\\n- PLATO FUERTE (Cant 75 - Pechuga Cordon Bleu) | HORARIO (Sin hora) | PREPARACION (Por definir) | SALSAS (Salsa a la Pimienta (x45), Jus de Ternera (x25), Salsa de Champiñones (x56)) | GUARNICIONES (Arroz Almendrado, Puré de Papa Rústico (x6)) | POSTRES (Cheesecake de Frambuesa (x17)) | BEBIDAS (Por definir) | PAN/TORTILLA (Por definir)\\n\\n[PLATO 2]\\n- PLATO FUERTE (Cant 75 - Lasaña Vegetariana) | HORARIO (13:30) | PREPARACION (Por definir) | SALSAS (Jus de Ternera (x75)) | GUARNICIONES (Arroz Almendrado) | POSTRES (Por definir) | BEBIDAS (Por definir) | PAN/TORTILLA (Por definir)\\n\\n[COMENTARIO]\\n- Servir a las 13:00 Hrs en punto.","montajeDescription":"[MONTAJE]\\n- TIPO (Montaje Escuela) | ADICIONALES (Arreglo Floral Centro, Mantelería Blanca)","lineItems":[{"key":"cbe7qqe","platoId":2,"preparacionId":null,"qty":75,"servicioHora":"","salsaIds":[2,3,1],"guarnicionIds":[3,1],"postreIds":[2],"bebidaIds":[],"bebidaQtys":{},"comentarioIds":[],"comentarioQtys":{},"salsaQtys":{"1":56,"2":45,"3":25},"guarnicionQtys":{"1":6,"3":1},"postreQtys":{"2":17},"comentarioLibre":"","suggestedSalsaIds":[],"suggestedGuarnicionIds":[],"suggestedPostreIds":[],"suggestedBebidaIds":[],"adicionales":[]},{"key":"8uuzjkt","platoId":3,"preparacionId":null,"qty":75,"servicioHora":"13:30","salsaIds":[3],"guarnicionIds":[3],"postreIds":[],"bebidaIds":[],"bebidaQtys":{},"comentarioIds":[],"comentarioQtys":{},"salsaQtys":{"3":75},"guarnicionQtys":{"3":1},"postreQtys":{},"adicionales":[],"comentarioLibre":"","suggestedSalsaIds":[],"suggestedGuarnicionIds":[],"suggestedPostreIds":[],"suggestedBebidaIds":[]}],"updatedAt":"2026-06-05T15:38:09.748Z"}],"savedAt":"2026-06-05T15:38:09.748Z"},{"version":6,"entries":[{"id":"mme_1780581152210","date":"2026-06-04","salon":"Gran Salón","menuTitle":"Menú Conferencia Anual E2E 2026","menuQty":150,"menuNotes":"Servir a las 13:00 Hrs en punto.","menuDescription":"[PLATO 1]\\n- PLATO FUERTE (Cant 75 - Pechuga Cordon Bleu) | HORARIO (10:00) | PREPARACION (Por definir) | SALSAS (Salsa a la Pimienta (x45), Jus de Ternera (x25), Salsa de Champiñones (x56)) | GUARNICIONES (Arroz Almendrado, Puré de Papa Rústico (x6)) | POSTRES (Cheesecake de Frambuesa (x17)) | BEBIDAS (Por definir) | PAN/TORTILLA (Por definir)\\n\\n[PLATO 2]\\n- PLATO FUERTE (Cant 75 - Lasaña Vegetariana) | HORARIO (13:30) | PREPARACION (Por definir) | SALSAS (Jus de Ternera (x75)) | GUARNICIONES (Arroz Almendrado) | POSTRES (Por definir) | BEBIDAS (Por definir) | PAN/TORTILLA (Por definir)\\n\\n[COMENTARIO]\\n- Servir a las 13:00 Hrs en punto.","montajeDescription":"[MONTAJE]\\n- TIPO (Montaje Escuela) | ADICIONALES (Arreglo Floral Centro, Mantelería Blanca)","lineItems":[{"key":"cbe7qqe","platoId":2,"preparacionId":null,"qty":75,"servicioHora":"10:00","salsaIds":[2,3,1],"guarnicionIds":[3,1],"postreIds":[2],"bebidaIds":[],"bebidaQtys":{},"comentarioIds":[],"comentarioQtys":{},"salsaQtys":{"1":56,"2":45,"3":25},"guarnicionQtys":{"1":6,"3":1},"postreQtys":{"2":17},"comentarioLibre":"","suggestedSalsaIds":[],"suggestedGuarnicionIds":[],"suggestedPostreIds":[],"suggestedBebidaIds":[],"adicionales":[]},{"key":"8uuzjkt","platoId":3,"preparacionId":null,"qty":75,"servicioHora":"13:30","salsaIds":[3],"guarnicionIds":[3],"postreIds":[],"bebidaIds":[],"bebidaQtys":{},"comentarioIds":[],"comentarioQtys":{},"salsaQtys":{"3":75},"guarnicionQtys":{"3":1},"postreQtys":{},"adicionales":[],"comentarioLibre":"","suggestedSalsaIds":[],"suggestedGuarnicionIds":[],"suggestedPostreIds":[],"suggestedBebidaIds":[]}],"updatedAt":"2026-06-05T15:45:27.252Z"}],"savedAt":"2026-06-05T15:45:27.252Z"}],"advanceLogs":[],"subtotal":19200,"discountAmount":0,"total":19200,"quotedAt":"2026-06-05T15:45:27.252Z"}', '2026-06-05 10:42:58', '2026-06-05 10:42:58');

--
-- Estructura de tabla para la tabla `historial_evento`
--
DROP TABLE IF EXISTS `historial_evento`;
CREATE TABLE `historial_evento` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `clave_evento` varchar(120) NOT NULL,
  `cambiado_en_iso` varchar(50) DEFAULT NULL,
  `cambiado_en` datetime DEFAULT NULL,
  `id_usuario_actor` varchar(80) DEFAULT NULL,
  `nombre_actor` varchar(200) DEFAULT NULL,
  `cambio_texto` text NOT NULL,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_historial_clave_evento` (`clave_evento`),
  KEY `idx_historial_usuario_actor` (`id_usuario_actor`)
) ENGINE=InnoDB AUTO_INCREMENT=707 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `historial_evento`
--
INSERT INTO `historial_evento` (`id`, `clave_evento`, `cambiado_en_iso`, `cambiado_en`, `id_usuario_actor`, `nombre_actor`, `cambio_texto`, `creado_en`) VALUES
('686', 'evt_1e2ee833f19068_19e5be5a53f', '2026-05-25T15:37:17.929Z', '2026-05-25 09:37:17', 'VLkLPnmBBBgguTCftj0VaMrJvEn1', 'Sistemas Admin', 'Salon/Horario: San Pedro 2026-05-28 a 2026-05-29 08:00-10:30 -> San Pedro 2026-05-28 a 2026-05-29 08:00-13:00.', '2026-06-05 10:42:58'),
('687', 'evt_1e2ee833f19068_19e5be5a53f', '2026-05-25T15:36:33.243Z', '2026-05-25 09:36:33', 'VLkLPnmBBBgguTCftj0VaMrJvEn1', 'Sistemas Admin', 'Cita agregada: 2026-05-13 08:00 via Telefono.', '2026-06-05 10:42:58'),
('688', 'evt_1e2ee833f19068_19e5be5a53f', '2026-05-25T15:36:12.847Z', '2026-05-25 09:36:12', 'VLkLPnmBBBgguTCftj0VaMrJvEn1', 'Sistemas Admin', 'Salon/Horario: San Pedro 2026-05-28 a 2026-05-29 08:00-09:00 -> San Pedro 2026-05-28 a 2026-05-29 08:00-10:30.', '2026-06-05 10:42:58'),
('689', 'evt_1e2ee833f19068_19e5be5a53f', '2026-05-25T15:26:26.074Z', '2026-05-25 09:26:26', NULL, 'Sistema', 'Reserva creada', '2026-06-05 10:42:58'),
('690', 'evt_1779394960744', '2026-05-24T21:30:37.287Z', '2026-05-24 15:30:37', NULL, 'Sistema', 'Cambios: • groupId: "-" → "-", • slots: "-" → "[object Object]"', '2026-06-05 10:42:58'),
('691', 'evt_1779394960744', '2026-05-21T21:38:36.020Z', '2026-05-21 15:38:36', NULL, 'Sistema', 'Reserva creada', '2026-06-05 10:42:58'),
('692', 'evt_1779394960744', '2026-06-04T13:52:32.186Z', '2026-06-04 07:52:32', NULL, 'Sistema', 'Cambios: • slots: "-" → "[object Object]"', '2026-06-05 10:42:58'),
('693', 'grp_ev_9cd463f58382d_19e4c862cd6', '2026-05-21T21:57:47.510Z', '2026-05-21 15:57:47', 'kLy8WstSA9SFw8fKkdW88BKEKci2', 'Kevin Bixcul M', 'Menu & Montaje (listas) actualizado en V1.', '2026-06-05 10:42:58'),
('694', 'grp_ev_9cd463f58382d_19e4c862cd6', '2026-05-21T21:52:02.263Z', '2026-05-21 15:52:02', 'kLy8WstSA9SFw8fKkdW88BKEKci2', 'Kevin Bixcul M', 'Salon/Horario: Sala Ejecutiva 2026-05-22 02:00-03:00 -> Sala Ejecutiva 2026-05-22 02:00-03:00 | Gran Salón 2026-05-22 12:00-15:00.', '2026-06-05 10:42:58'),
('695', 'grp_ev_9cd463f58382d_19e4c862cd6', '2026-05-21T21:41:55.491Z', '2026-05-21 15:41:55', 'kLy8WstSA9SFw8fKkdW88BKEKci2', 'Kevin Bixcul M', 'Reserva creada: 2026-05-22 (Sala Ejecutiva 02:00-03:00).', '2026-06-05 10:42:58'),
('696', 'grp_ev_9cd463f58382d_19e4c862cd6', '2026-05-22T17:07:16.084Z', '2026-05-22 11:07:16', 'kLy8WstSA9SFw8fKkdW88BKEKci2', 'Kevin Bixcul M', 'Estado: Perdido -> 1er Cotizacion.', '2026-06-05 10:42:58'),
('697', 'grp_ev_9cd463f58382d_19e4c862cd6', '2026-05-22T17:07:41.733Z', '2026-05-22 11:07:41', 'kLy8WstSA9SFw8fKkdW88BKEKci2', 'Kevin Bixcul M', 'Estado: Perdido -> 1er Cotizacion.', '2026-06-05 10:42:58'),
('698', 'grp_ev_9cd463f58382d_19e4c862cd6', '2026-05-22T17:07:58.582Z', '2026-05-22 11:07:58', 'kLy8WstSA9SFw8fKkdW88BKEKci2', 'Kevin Bixcul M', 'Estado: Perdido -> 1er Cotizacion.', '2026-06-05 10:42:58'),
('699', 'evt_d15305aa0e0b68_19e51ad6740', '2026-05-22T21:53:29.001Z', '2026-05-22 15:53:29', NULL, 'Sistema', 'Reserva creada', '2026-06-05 10:42:58'),
('700', 'evt_d15305aa0e0b68_19e51ad6740', '2026-05-22T22:01:39.224Z', '2026-05-22 16:01:39', NULL, 'Sistema', 'Cambios: • Fecha de fin: "-" → "2026-05-23", • Hora de fin: "09:00" → "10:00", • slots: "-" → "[object Object]"', '2026-06-05 10:42:58'),
('701', 'evt_d15305aa0e0b68_19e51ad6740', '2026-05-24T02:49:40.203Z', '2026-05-23 20:49:40', NULL, 'Sistema', 'Cambios: • Estado: "Reserva sin Cotizacion" → "Lista de Espera", • Fecha de fin: "-" → "2026-05-23", • slots: "-" → "[object Object]"', '2026-06-05 10:42:58'),
('702', 'evt_d15305aa0e0b68_19e51ad6740', '2026-05-24T14:58:25.348Z', '2026-05-24 08:58:25', NULL, 'Sistema', 'Cambios: • slots: "-" → "[object Object]"', '2026-06-05 10:42:58'),
('703', 'ev_190e7d4a28c698_19e4c862cd6', '2026-05-22T22:03:50.753Z', '2026-05-22 16:03:50', NULL, 'Sistema', 'Reserva eliminada', '2026-06-05 10:42:58'),
('704', 'ev_cddff2e75860f_19e5fc88769', '2026-05-26T21:57:08.558Z', '2026-05-26 15:57:08', NULL, 'Sistema', 'Cambios: • Encargado: "VLkLPnmBBBgguTCftj0VaMrJvEn1" → "PP7L1SWd2mYJHGa5ZPAvOjtIHek2", • slots: "-" → "[object Object]"', '2026-06-05 10:42:58'),
('705', 'ev_cddff2e75860f_19e5fc88769', '2026-05-26T22:26:24.312Z', '2026-05-26 16:26:24', NULL, 'Sistema', 'Cambios: • Estado: "Reserva sin Cotizacion" → "Lista de Espera", • slots: "-" → "[object Object]"', '2026-06-05 10:42:58'),
('706', 'evt_test_1780581152206', NULL, NULL, NULL, NULL, 'Cambios: • Fecha de inicio: "2026-06-04" → "2026-06-07", • Fecha de fin: "2026-06-04" → "2026-06-07", • groupId: "-" → "-", • slots: "-" → "[object Object]"', '2026-06-05 10:42:58');

--
-- Estructura de tabla para la tabla `items_cotizacion_evento`
--
DROP TABLE IF EXISTS `items_cotizacion_evento`;
CREATE TABLE `items_cotizacion_evento` (
  `id` varchar(80) NOT NULL,
  `id_evento` varchar(80) NOT NULL,
  `id_servicio` varchar(80) DEFAULT NULL,
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

--
-- Volcado de datos para la tabla `items_cotizacion_evento`
--
INSERT INTO `items_cotizacion_evento` (`id`, `id_evento`, `id_servicio`, `fecha_servicio`, `cantidad`, `precio`, `nombre`, `descripcion`, `creado_en`, `precio_unitario`, `modo_cantidad`, `total_linea`) VALUES
('evt_test_1780581152206__row_1__1', 'evt_test_1780581152206', NULL, NULL, '150.00', '125.00', 'Almuerzo Ejecutivo Buffet', NULL, '2026-06-05 10:42:58', '125.00', 'MANUAL', '18750.00'),
('evt_test_1780581152206__row_2__2', 'evt_test_1780581152206', NULL, NULL, '1.00', '450.00', 'Alquiler de Proyector HD', NULL, '2026-06-05 10:42:58', '450.00', 'MANUAL', '450.00');

--
-- Estructura de tabla para la tabla `items_cotizacion_version_evento`
--
DROP TABLE IF EXISTS `items_cotizacion_version_evento`;
CREATE TABLE `items_cotizacion_version_evento` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `id_evento` varchar(100) NOT NULL,
  `version_num` int(11) NOT NULL,
  `fila_num` int(11) NOT NULL,
  `id_servicio` varchar(100) DEFAULT NULL,
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
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `items_cotizacion_version_evento`
--
INSERT INTO `items_cotizacion_version_evento` (`id`, `id_evento`, `version_num`, `fila_num`, `id_servicio`, `fecha_servicio`, `cantidad`, `precio`, `nombre`, `descripcion`, `precio_unitario`, `modo_cantidad`, `total_linea`) VALUES
('15', 'evt_test_1780581152206', 1, 1, NULL, NULL, '150.00', '125.00', 'Almuerzo Ejecutivo Buffet', NULL, '125.00', 'MANUAL', '18750.00'),
('16', 'evt_test_1780581152206', 1, 2, NULL, NULL, '1.00', '450.00', 'Alquiler de Proyector HD', NULL, '450.00', 'MANUAL', '450.00');

--
-- Estructura de tabla para la tabla `menu_bebidas`
--
DROP TABLE IF EXISTS `menu_bebidas`;
CREATE TABLE `menu_bebidas` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(180) NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_menu_bebidas_nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

--
-- Volcado de datos para la tabla `menu_bebidas`
--
-- (Sin registros en `menu_bebidas`)

--
-- Estructura de tabla para la tabla `menu_comentarios_adicionales`
--
DROP TABLE IF EXISTS `menu_comentarios_adicionales`;
CREATE TABLE `menu_comentarios_adicionales` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(240) NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_menu_comentarios_adicionales_nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

--
-- Volcado de datos para la tabla `menu_comentarios_adicionales`
--
-- (Sin registros en `menu_comentarios_adicionales`)

--
-- Estructura de tabla para la tabla `menu_guarniciones`
--
DROP TABLE IF EXISTS `menu_guarniciones`;
CREATE TABLE `menu_guarniciones` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(180) NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_menu_guarniciones_nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

--
-- Volcado de datos para la tabla `menu_guarniciones`
--
INSERT INTO `menu_guarniciones` (`id`, `nombre`, `activo`, `creado_en`) VALUES
('1', 'Puré de Papa Rústico', 1, '2026-05-21 14:02:06'),
('2', 'Vegetales al Vapor', 1, '2026-05-21 14:02:06'),
('3', 'Arroz Almendrado', 1, '2026-05-21 14:02:06');

--
-- Estructura de tabla para la tabla `menu_montaje_plantilla_adicional`
--
DROP TABLE IF EXISTS `menu_montaje_plantilla_adicional`;
CREATE TABLE `menu_montaje_plantilla_adicional` (
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

--
-- Volcado de datos para la tabla `menu_montaje_plantilla_adicional`
--
-- (Sin registros en `menu_montaje_plantilla_adicional`)

--
-- Estructura de tabla para la tabla `menu_montaje_plantilla_detalle`
--
DROP TABLE IF EXISTS `menu_montaje_plantilla_detalle`;
CREATE TABLE `menu_montaje_plantilla_detalle` (
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

--
-- Volcado de datos para la tabla `menu_montaje_plantilla_detalle`
--
-- (Sin registros en `menu_montaje_plantilla_detalle`)

--
-- Estructura de tabla para la tabla `menu_montaje_plantilla_guarnicion`
--
DROP TABLE IF EXISTS `menu_montaje_plantilla_guarnicion`;
CREATE TABLE `menu_montaje_plantilla_guarnicion` (
  `id_detalle` bigint(20) unsigned NOT NULL,
  `id_guarnicion` bigint(20) unsigned NOT NULL,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_detalle`,`id_guarnicion`),
  KEY `idx_menu_montaje_plantilla_guarnicion_guarnicion` (`id_guarnicion`),
  CONSTRAINT `fk_menu_montaje_plantilla_guarnicion_detalle` FOREIGN KEY (`id_detalle`) REFERENCES `menu_montaje_plantilla_detalle` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_menu_montaje_plantilla_guarnicion_guarnicion` FOREIGN KEY (`id_guarnicion`) REFERENCES `menu_guarniciones` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

--
-- Volcado de datos para la tabla `menu_montaje_plantilla_guarnicion`
--
-- (Sin registros en `menu_montaje_plantilla_guarnicion`)

--
-- Estructura de tabla para la tabla `menu_montaje_plantillas`
--
DROP TABLE IF EXISTS `menu_montaje_plantillas`;
CREATE TABLE `menu_montaje_plantillas` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(200) NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_menu_montaje_plantillas_nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

--
-- Volcado de datos para la tabla `menu_montaje_plantillas`
--
-- (Sin registros en `menu_montaje_plantillas`)

--
-- Estructura de tabla para la tabla `menu_plato_guarnicion_sugerida`
--
DROP TABLE IF EXISTS `menu_plato_guarnicion_sugerida`;
CREATE TABLE `menu_plato_guarnicion_sugerida` (
  `id_plato_fuerte` bigint(20) unsigned NOT NULL,
  `id_guarnicion` bigint(20) unsigned NOT NULL,
  `prioridad` int(11) NOT NULL DEFAULT 1,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_plato_fuerte`,`id_guarnicion`),
  KEY `idx_menu_plato_guarnicion_sugerida_guarnicion` (`id_guarnicion`),
  CONSTRAINT `fk_menu_plato_guarnicion_guarnicion` FOREIGN KEY (`id_guarnicion`) REFERENCES `menu_guarniciones` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_menu_plato_guarnicion_plato` FOREIGN KEY (`id_plato_fuerte`) REFERENCES `menu_platos_fuertes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

--
-- Volcado de datos para la tabla `menu_plato_guarnicion_sugerida`
--
-- (Sin registros en `menu_plato_guarnicion_sugerida`)

--
-- Estructura de tabla para la tabla `menu_plato_preparacion_bebida_sugerida`
--
DROP TABLE IF EXISTS `menu_plato_preparacion_bebida_sugerida`;
CREATE TABLE `menu_plato_preparacion_bebida_sugerida` (
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

--
-- Volcado de datos para la tabla `menu_plato_preparacion_bebida_sugerida`
--
-- (Sin registros en `menu_plato_preparacion_bebida_sugerida`)

--
-- Estructura de tabla para la tabla `menu_plato_preparacion_guarnicion_sugerida`
--
DROP TABLE IF EXISTS `menu_plato_preparacion_guarnicion_sugerida`;
CREATE TABLE `menu_plato_preparacion_guarnicion_sugerida` (
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

--
-- Volcado de datos para la tabla `menu_plato_preparacion_guarnicion_sugerida`
--
-- (Sin registros en `menu_plato_preparacion_guarnicion_sugerida`)

--
-- Estructura de tabla para la tabla `menu_plato_preparacion_montaje_adicional_sugerido`
--
DROP TABLE IF EXISTS `menu_plato_preparacion_montaje_adicional_sugerido`;
CREATE TABLE `menu_plato_preparacion_montaje_adicional_sugerido` (
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

--
-- Volcado de datos para la tabla `menu_plato_preparacion_montaje_adicional_sugerido`
--
-- (Sin registros en `menu_plato_preparacion_montaje_adicional_sugerido`)

--
-- Estructura de tabla para la tabla `menu_plato_preparacion_montaje_tipo_sugerido`
--
DROP TABLE IF EXISTS `menu_plato_preparacion_montaje_tipo_sugerido`;
CREATE TABLE `menu_plato_preparacion_montaje_tipo_sugerido` (
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

--
-- Volcado de datos para la tabla `menu_plato_preparacion_montaje_tipo_sugerido`
--
-- (Sin registros en `menu_plato_preparacion_montaje_tipo_sugerido`)

--
-- Estructura de tabla para la tabla `menu_plato_preparacion_postre_sugerido`
--
DROP TABLE IF EXISTS `menu_plato_preparacion_postre_sugerido`;
CREATE TABLE `menu_plato_preparacion_postre_sugerido` (
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

--
-- Volcado de datos para la tabla `menu_plato_preparacion_postre_sugerido`
--
-- (Sin registros en `menu_plato_preparacion_postre_sugerido`)

--
-- Estructura de tabla para la tabla `menu_plato_preparacion_salsa_sugerida`
--
DROP TABLE IF EXISTS `menu_plato_preparacion_salsa_sugerida`;
CREATE TABLE `menu_plato_preparacion_salsa_sugerida` (
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

--
-- Volcado de datos para la tabla `menu_plato_preparacion_salsa_sugerida`
--
-- (Sin registros en `menu_plato_preparacion_salsa_sugerida`)

--
-- Estructura de tabla para la tabla `menu_platos_fuertes`
--
DROP TABLE IF EXISTS `menu_platos_fuertes`;
CREATE TABLE `menu_platos_fuertes` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(180) NOT NULL,
  `tipo_plato` varchar(20) NOT NULL DEFAULT 'NORMAL',
  `es_sin_proteina` tinyint(1) NOT NULL DEFAULT 0,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_menu_platos_fuertes_nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `menu_platos_fuertes`
--
INSERT INTO `menu_platos_fuertes` (`id`, `nombre`, `tipo_plato`, `es_sin_proteina`, `activo`, `creado_en`) VALUES
('1', 'Medallones de Res al Vino Tinto', 'NORMAL', 0, 1, '2026-05-21 14:02:06'),
('2', 'Pechuga Cordon Bleu', 'NORMAL', 0, 1, '2026-05-21 14:02:06'),
('3', 'Lasaña Vegetariana', 'VEGETARIANO', 1, 1, '2026-05-21 14:02:06');

--
-- Estructura de tabla para la tabla `menu_postres`
--
DROP TABLE IF EXISTS `menu_postres`;
CREATE TABLE `menu_postres` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(180) NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_menu_postres_nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

--
-- Volcado de datos para la tabla `menu_postres`
--
INSERT INTO `menu_postres` (`id`, `nombre`, `activo`, `creado_en`) VALUES
('1', 'Tiramisú Clásico', 1, '2026-05-21 14:02:06'),
('2', 'Cheesecake de Frambuesa', 1, '2026-05-21 14:02:06'),
('3', 'Flan Napolitano', 1, '2026-05-21 14:02:06');

--
-- Estructura de tabla para la tabla `menu_preparacion_postre_sugerido`
--
DROP TABLE IF EXISTS `menu_preparacion_postre_sugerido`;
CREATE TABLE `menu_preparacion_postre_sugerido` (
  `id_preparacion` bigint(20) unsigned NOT NULL,
  `id_postre` bigint(20) unsigned NOT NULL,
  `prioridad` int(11) NOT NULL DEFAULT 1,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_preparacion`,`id_postre`),
  KEY `idx_menu_preparacion_postre_sugerido_postre` (`id_postre`),
  CONSTRAINT `fk_menu_preparacion_postre_postre` FOREIGN KEY (`id_postre`) REFERENCES `menu_postres` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_menu_preparacion_postre_preparacion` FOREIGN KEY (`id_preparacion`) REFERENCES `menu_preparaciones` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

--
-- Volcado de datos para la tabla `menu_preparacion_postre_sugerido`
--
-- (Sin registros en `menu_preparacion_postre_sugerido`)

--
-- Estructura de tabla para la tabla `menu_preparacion_salsa_sugerida`
--
DROP TABLE IF EXISTS `menu_preparacion_salsa_sugerida`;
CREATE TABLE `menu_preparacion_salsa_sugerida` (
  `id_preparacion` bigint(20) unsigned NOT NULL,
  `id_salsa` bigint(20) unsigned NOT NULL,
  `prioridad` int(11) NOT NULL DEFAULT 1,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_preparacion`,`id_salsa`),
  KEY `idx_menu_preparacion_salsa_sugerida_salsa` (`id_salsa`),
  CONSTRAINT `fk_menu_preparacion_sugerida_preparacion` FOREIGN KEY (`id_preparacion`) REFERENCES `menu_preparaciones` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_menu_preparacion_sugerida_salsa` FOREIGN KEY (`id_salsa`) REFERENCES `menu_salsas` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `menu_preparacion_salsa_sugerida`
--
-- (Sin registros en `menu_preparacion_salsa_sugerida`)

--
-- Estructura de tabla para la tabla `menu_preparaciones`
--
DROP TABLE IF EXISTS `menu_preparaciones`;
CREATE TABLE `menu_preparaciones` (
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

--
-- Volcado de datos para la tabla `menu_preparaciones`
--
-- (Sin registros en `menu_preparaciones`)

--
-- Estructura de tabla para la tabla `menu_salsas`
--
DROP TABLE IF EXISTS `menu_salsas`;
CREATE TABLE `menu_salsas` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(180) NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_menu_salsas_nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `menu_salsas`
--
INSERT INTO `menu_salsas` (`id`, `nombre`, `activo`, `creado_en`) VALUES
('1', 'Salsa de Champiñones', 1, '2026-05-21 14:02:06'),
('2', 'Salsa a la Pimienta', 1, '2026-05-21 14:02:06'),
('3', 'Jus de Ternera', 1, '2026-05-21 14:02:06');

--
-- Estructura de tabla para la tabla `montaje_adicionales`
--
DROP TABLE IF EXISTS `montaje_adicionales`;
CREATE TABLE `montaje_adicionales` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(180) NOT NULL,
  `tipo` varchar(120) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_montaje_adicionales_nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

--
-- Volcado de datos para la tabla `montaje_adicionales`
--
INSERT INTO `montaje_adicionales` (`id`, `nombre`, `tipo`, `activo`, `creado_en`) VALUES
('1', 'Arreglo Floral Centro', 'DECORACION', 1, '2026-05-21 14:02:06'),
('2', 'Mantelería Blanca', 'MANTELERIA', 1, '2026-05-21 14:02:06'),
('3', 'Pizarrón Blanco + Marcadores', 'EQUIPO', 1, '2026-05-21 14:02:06');

--
-- Estructura de tabla para la tabla `montaje_tipo_adicional_sugerido`
--
DROP TABLE IF EXISTS `montaje_tipo_adicional_sugerido`;
CREATE TABLE `montaje_tipo_adicional_sugerido` (
  `id_montaje_tipo` bigint(20) unsigned NOT NULL,
  `id_adicional` bigint(20) unsigned NOT NULL,
  `prioridad` int(11) NOT NULL DEFAULT 1,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id_montaje_tipo`,`id_adicional`),
  KEY `idx_montaje_tipo_adicional_sugerido_adicional` (`id_adicional`),
  CONSTRAINT `fk_montaje_tipo_adicional_sugerido_adicional` FOREIGN KEY (`id_adicional`) REFERENCES `montaje_adicionales` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_montaje_tipo_adicional_sugerido_tipo` FOREIGN KEY (`id_montaje_tipo`) REFERENCES `montaje_tipos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

--
-- Volcado de datos para la tabla `montaje_tipo_adicional_sugerido`
--
-- (Sin registros en `montaje_tipo_adicional_sugerido`)

--
-- Estructura de tabla para la tabla `montaje_tipos`
--
DROP TABLE IF EXISTS `montaje_tipos`;
CREATE TABLE `montaje_tipos` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(180) NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_montaje_tipos_nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

--
-- Volcado de datos para la tabla `montaje_tipos`
--
INSERT INTO `montaje_tipos` (`id`, `nombre`, `activo`, `creado_en`) VALUES
('1', 'Montaje Imperial', 1, '2026-05-21 14:02:06'),
('2', 'Montaje Escuela', 1, '2026-05-21 14:02:06'),
('3', 'Montaje Ruso', 1, '2026-05-21 14:02:06'),
('4', 'Auditorio', 1, '2026-05-21 14:02:06');

--
-- Estructura de tabla para la tabla `recordatorios_evento`
--
DROP TABLE IF EXISTS `recordatorios_evento`;
CREATE TABLE `recordatorios_evento` (
  `id` varchar(80) NOT NULL,
  `clave_evento` varchar(120) NOT NULL,
  `fecha_recordatorio` date DEFAULT NULL,
  `hora_recordatorio` time DEFAULT NULL,
  `medio` varchar(80) NOT NULL,
  `notas` text DEFAULT NULL,
  `creado_en_iso` varchar(50) DEFAULT NULL,
  `creado_en` datetime DEFAULT NULL,
  `id_usuario_creador` varchar(80) DEFAULT NULL,
  `creado_en_fila` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_recordatorios_clave_evento` (`clave_evento`),
  KEY `idx_recordatorios_fecha_hora` (`fecha_recordatorio`,`hora_recordatorio`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `recordatorios_evento`
--
-- (Sin registros en `recordatorios_evento`)

--
-- Estructura de tabla para la tabla `salones`
--
DROP TABLE IF EXISTS `salones`;
CREATE TABLE `salones` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(120) NOT NULL,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_salones_nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=508 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `salones`
--
INSERT INTO `salones` (`id`, `nombre`, `creado_en`) VALUES
('503', 'San Pedro', '2026-06-05 10:42:58'),
('504', 'Gran Salón', '2026-06-05 10:42:58'),
('505', 'Salón Jardín', '2026-06-05 10:42:58'),
('506', 'Terraza Panorámica', '2026-06-05 10:42:58'),
('507', 'Sala Ejecutiva', '2026-06-05 10:42:58');

--
-- Estructura de tabla para la tabla `servicios`
--
DROP TABLE IF EXISTS `servicios`;
CREATE TABLE `servicios` (
  `id` varchar(80) NOT NULL,
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

--
-- Volcado de datos para la tabla `servicios`
--
INSERT INTO `servicios` (`id`, `nombre`, `precio`, `descripcion`, `id_categoria`, `id_subcategoria`, `modo_cantidad`, `creado_en`) VALUES
('srv_101', 'Menú 3 Tiempos Premium', '350.00', 'Entrada, plato fuerte y postre. Incluye pan y mantequilla.', '1', NULL, 'PAX', '2026-06-05 10:42:58'),
('srv_102', 'Menú 2 Tiempos Ejecutivo', '220.00', 'Plato fuerte y postre.', '1', NULL, 'PAX', '2026-06-05 10:42:58'),
('srv_103', 'Coffee Break Básico', '65.00', 'Café, té, agua y galletas.', '1', NULL, 'PAX', '2026-06-05 10:42:58'),
('srv_201', 'Descorche por Botella', '150.00', 'Incluye servicio de mezcladores y cristalería.', '2', NULL, 'MANUAL', '2026-06-05 10:42:58'),
('srv_202', 'Barra Libre Nacional (4 horas)', '280.00', 'Ron, Vodka, Tequila, Whisky nacional.', '2', NULL, 'PAX', '2026-06-05 10:42:58'),
('srv_301', 'Alquiler Silla Tiffany (Extra)', '15.00', 'Silla adicional modelo Tiffany color blanco.', '3', NULL, 'MANUAL', '2026-06-05 10:42:58'),
('srv_302', 'Proyector 4K + Pantalla', '850.00', 'Equipo audiovisual para presentaciones.', '3', NULL, 'MANUAL', '2026-06-05 10:42:58'),
('srv_303', 'Pista de Baile Iluminada (Modulos)', '400.00', 'Precio por módulo de pista iluminada.', '3', NULL, 'MANUAL', '2026-06-05 10:42:58'),
('srv_401', 'Mesero Extra', '350.00', 'Turno de 8 horas.', '4', NULL, 'MANUAL', '2026-06-05 10:42:58'),
('srv_402', 'Valet Parking (Por Vehículo)', '45.00', 'Servicio de acomodo de vehículos.', '4', NULL, 'MANUAL', '2026-06-05 10:42:58'),
('svc_1779259759227', 'Ambientacion', '50.00', NULL, '4', '18', 'MANUAL', '2026-06-05 10:42:58'),
('svc_1779262561113', 'Salon con audio y video', '100.00', NULL, '4', '15', 'MANUAL', '2026-06-05 10:42:58');

--
-- Estructura de tabla para la tabla `subcategorias_servicio`
--
DROP TABLE IF EXISTS `subcategorias_servicio`;
CREATE TABLE `subcategorias_servicio` (
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

--
-- Volcado de datos para la tabla `subcategorias_servicio`
--
INSERT INTO `subcategorias_servicio` (`id`, `id_categoria`, `nombre`, `creado_en`, `activo`) VALUES
('1', '1', 'Desayunos', '2026-05-20 08:33:53', 1),
('2', '1', 'Almuerzos', '2026-05-20 08:33:53', 1),
('3', '1', 'Cenas', '2026-05-20 08:33:53', 1),
('4', '1', 'Coffee Break', '2026-05-20 08:33:53', 1),
('5', '1', 'Boquitas', '2026-05-20 08:33:53', 1),
('6', '1', 'Bebidas', '2026-05-20 08:33:53', 1),
('7', '1', 'Refacciones', '2026-05-20 08:33:53', 1),
('8', '1', 'Otros', '2026-05-20 08:33:53', 1),
('9', '2', 'Habitaciones JDL', '2026-05-20 08:33:53', 1),
('10', '2', 'Paquetes Habitacion', '2026-05-20 08:33:53', 1),
('11', '2', 'Otros', '2026-05-20 08:33:53', 1),
('12', '3', 'Habitaciones Terceros', '2026-05-20 08:33:53', 1),
('13', '3', 'Otros', '2026-05-20 08:33:53', 1),
('14', '4', 'Montaje y Decoracion', '2026-05-20 08:33:53', 1),
('15', '4', 'Equipo y Audiovisual', '2026-05-20 08:33:53', 1),
('16', '4', 'Musica y Entretenimiento', '2026-05-20 08:33:53', 1),
('17', '4', 'Transporte', '2026-05-20 08:33:53', 1),
('18', '4', 'Otros', '2026-05-20 08:33:53', 1);

--
-- Estructura de tabla para la tabla `usuarios`
--
DROP TABLE IF EXISTS `usuarios`;
CREATE TABLE `usuarios` (
  `id` varchar(80) NOT NULL,
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
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `usuarios`
--
INSERT INTO `usuarios` (`id`, `nombre`, `nombre_usuario`, `nombre_completo`, `correo`, `telefono`, `contrasena`, `firma_data_url`, `avatar_data_url`, `activo`, `influye_meta_ventas`, `metas_mensuales_json`, `creado_en`, `rol`) VALUES
('kLy8WstSA9SFw8fKkdW88BKEKci2', 'Kevin Bixcul M', 'kabm.thebest', 'Kevin Bixcul M', 'kabm.thebest@gmail.com', '515154', NULL, NULL, 'https://lh3.googleusercontent.com/a/ACg8ocL6B9g__XAq-kn2QqqOoL6KMeNzK3YjBkoFqVOxSwhpK_WM3Pkf=s96-c', 1, 0, '[]', '2026-06-05 10:42:58', 'vendedor'),
('PP7L1SWd2mYJHGa5ZPAvOjtIHek2', 'Kevin Bixcul “Martín”', 'kevinbixcul', 'Kevin Bixcul “Martín”', 'kevinbixcul@gmail.com', NULL, NULL, NULL, 'https://lh3.googleusercontent.com/a/ACg8ocJTn8CQXGJyuF8wf1yd2Nh8TyXEYAWraKcbF8wNRPtFQ0rLxO0T=s96-c', 1, 0, '[]', '2026-06-05 10:42:58', 'vendedor'),
('usr_1779114943855', 'Carlos Roberto Samalaj', 'sistemas', 'Carlos Roberto Samalaj', 'sistemas@jardinesdellago.com', '56325547', 'scrypt$16384$8$1$66ed0c349efef062eff2ddc9e4af9c72$c5e7fc5cd278b2dd121eb740fb34815a5dff96df7bc24d32ddb01e75227464b5ed36768b9a1059801c8888febe8622e7fb2469c634e1bacbaa8c1a6f97bf5374', NULL, NULL, 1, 0, '[]', '2026-06-05 10:42:58', 'admin'),
('usr_1779382722195', 'Carlos Roberto Samalaj', 'csamalaj', 'Carlos Roberto Samalaj', 'sistemas@jardinesdellago.com', '56325547', 'scrypt$16384$8$1$4d242f207aac060dbc05bb9933200faf$52ed0d775195ca0b1a2d3cf9b7ad560a6823f85e9ec0b95d5bb9dbab1d1d2241070a0150954c7bcd162c19cfb6c959f77696acf5902e846d42a32c03d6a406d6', NULL, NULL, 1, 0, '[]', '2026-06-05 10:42:58', 'admin'),
('VLkLPnmBBBgguTCftj0VaMrJvEn1', 'Sistemas Admin', 'sistemashotel', 'Sistemas Admin', 'sistemashotel@jardinesdellago.com', NULL, NULL, NULL, 'https://lh3.googleusercontent.com/a/ACg8ocK-TAFzkd4im78OVWBpLR0U-0dPgsObWtq7hzA3zjetwXEjnPuW=s96-c', 1, 0, '[]', '2026-06-05 10:42:58', 'admin');

SET FOREIGN_KEY_CHECKS = 1;