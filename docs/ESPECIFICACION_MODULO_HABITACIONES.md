# Especificación Técnica y Funcional: Módulo de Ingreso de Habitaciones y Metas Comerciales

> **Proyecto:** CRM.JDL-2.0 — Jardines del Lago  
> **Fecha de Elaboración:** 10 de Octubre de 2026  
> **Estado:** Documentado y Validado (Pendiente de Implementación a Solicitud del Usuario)  
> **Autor / Arquitectura:** Antigravity AI & Carlos Samalaj  

---

## 1. Resumen Ejecutivo y Objetivo

El presente documento detalla la arquitectura, modelo de datos, flujos de usuario, endpoints y reportería para la incorporación del nuevo **Módulo de Ingreso de Habitaciones** en el CRM interno de Jardines del Lago.

### Propósito del Módulo
- Complementar la llegada a la **Meta Mensual Global** del recinto sumando las ventas de hospedaje a las ventas tradicionales de eventos.
- Brindar a recepcionistas y ejecutivos de ventas un formulario transaccional ágil para registrar estancias, calcular totales dinámicamente según noches y habitaciones, y dar seguimiento a los huéspedes.
- Desacoplar la proyección de metas comerciales para permitir visualizar el rendimiento por **Eventos**, **Habitaciones** o de forma **Consolidada**.

---

## 2. Ubicación en la Navegación Principal

### 2.1 Menú Vertical (Sidebar)
En el sidebar lateral izquierdo (`src/layouts/MainLayout/components/Sidebar.jsx`), inmediatamente debajo de la opción **"Tablero Ocupación"** (`/informes` / Kanban), se ubicará:
- **Etiqueta:** `Ingreso de Habitaciones`
- **Ruta:** `/habitaciones`
- **Icono:** Material Symbol `bed` / `hotel` o SVG minimalista `BedDouble`.
- **Acceso:** Roles autorizados (`admin`, `vendedor`, `recepcionista`).

```
[Tablero Calendario]
[Tablero Ocupación]
  └── [Ingreso de Habitaciones]  ⭐ (Nueva opción)
[Clientes y Empresas]
[Posibles Ventas]
[Reportes y Finanzas]
```

---

## 3. Modelo de Datos en MariaDB

### 3.1 Tabla Principal: `habitacion_reservas`
Almacena el registro transaccional comercial de cada reserva de habitación:

```sql
CREATE TABLE IF NOT EXISTS habitacion_reservas (
  id VARCHAR(100) NOT NULL PRIMARY KEY,
  nombre_huesped VARCHAR(255) NOT NULL,
  telefono VARCHAR(50) NULL,
  correo VARCHAR(150) NULL,
  id_vendedor VARCHAR(100) NULL,
  vendedor_nombre VARCHAR(150) NULL,
  id_medio_contacto VARCHAR(100) NULL,
  medio_contacto_nombre VARCHAR(100) NULL,
  fecha_check_in DATE NOT NULL,
  fecha_check_out DATE NOT NULL,
  noches INT NOT NULL DEFAULT 1,
  cantidad_habitaciones INT NOT NULL DEFAULT 1,
  no_reserva VARCHAR(100) NULL,
  no_folio VARCHAR(100) NULL,
  id_tipo_cliente VARCHAR(100) NULL,
  tipo_cliente_nombre VARCHAR(100) NULL,
  solicito VARCHAR(255) NULL,
  id_tipo_habitacion VARCHAR(100) NULL,
  tipo_habitacion_nombre VARCHAR(150) NULL,
  modulo VARCHAR(100) NULL,
  tarifa_diaria DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  monto_total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  id_empresa VARCHAR(200) NULL,
  empresa_nombre VARCHAR(255) NULL,
  id_forma_pago VARCHAR(100) NULL,
  forma_pago_nombre VARCHAR(100) NULL,
  estado VARCHAR(50) NOT NULL DEFAULT 'Confirmada',
  observaciones TEXT NULL,
  ultimo_contacto DATETIME NULL,
  ultimo_contacto_medio VARCHAR(50) NULL,
  creado_por VARCHAR(100) NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_hab_checkin (fecha_check_in),
  INDEX idx_hab_checkout (fecha_check_out),
  INDEX idx_hab_vendedor (id_vendedor),
  INDEX idx_hab_telefono (telefono),
  INDEX idx_hab_correo (correo),
  INDEX idx_hab_empresa (id_empresa)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 3.2 Tabla de Catálogos Dinámicos: `habitacion_catalogos`
Permite administrar desde el panel de configuración los parámetros desplegables:

```sql
CREATE TABLE IF NOT EXISTS habitacion_catalogos (
  id VARCHAR(100) NOT NULL PRIMARY KEY,
  categoria VARCHAR(50) NOT NULL, -- 'medios_contacto', 'tipos_cliente', 'tipos_habitacion', 'formas_pago', 'plantillas'
  nombre VARCHAR(150) NOT NULL,
  descripcion VARCHAR(255) NULL,
  tarifa_base DECIMAL(12,2) NULL DEFAULT 0.00, -- para tipos de habitación
  plantilla_whatsapp TEXT NULL,
  plantilla_correo_asunto VARCHAR(255) NULL,
  plantilla_correo_cuerpo TEXT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  orden INT NOT NULL DEFAULT 0,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_cat_categoria (categoria, activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 3.3 Tabla / Registro de Metas de Habitaciones: `habitacion_metas`
Define las metas comerciales mensuales para los vendedores de habitaciones:

```sql
CREATE TABLE IF NOT EXISTS habitacion_metas (
  id VARCHAR(100) NOT NULL PRIMARY KEY,
  mes VARCHAR(7) NOT NULL, -- Formato YYYY-MM (ej. 2026-10)
  id_usuario VARCHAR(100) NULL, -- NULL para meta global de habitaciones, o ID de vendedor
  monto DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_hab_meta (mes, id_usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

## 4. Campos del Formulario de Ingreso de Habitaciones

El modal/drawer ejecutivo de ingreso de habitaciones contendrá los siguientes campos estructurados:

| Campo | Tipo | Comportamiento / Validación |
| :--- | :--- | :--- |
| **Nombre Huésped** | Texto (Input) | Obligatorio. Al escribir, autocompleta sugerencias de huéspedes anteriores. |
| **Teléfono** | Teléfono (Input) | Búsqueda automática de historial. Valida formato para botón directo de WhatsApp. |
| **Correo** | Email (Input) | Búsqueda de historial y enlace directo `mailto:`. |
| **Vendedor** | Select | Lista de usuarios del CRM con rol vendedor/recepcionista. Default: usuario en sesión. |
| **Medio de Contacto** | Select | Opciones dinámicas: *Llamada Recepción*, *Correo Recepción*, *WhatsApp Recepción*, *Correo del Vendedor*, etc. |
| **Tipo de Cliente** | Select | Opciones dinámicas: *Individual*, *Corporativo*, *Social*, etc. |
| **Empresa** | Autocomplete / Input | Busca en la tabla `empresas` del CRM. Si no existe, se crea al vuelo solo con el nombre sin requerir NIT ni dirección. |
| **Fecha Check-In** | Date | Fecha de ingreso. |
| **Fecha Check-Out** | Date | Fecha de salida (mínimo día siguiente a Check-In). |
| **Noches** | Number (Calculado) | `Math.max(1, Math.round((CheckOut - CheckIn) / (1000 * 60 * 60 * 24)))`. Editable si se requiere. |
| **Cantidad Habitaciones** | Number | Cantidad de habitaciones reservadas (ej. 1, 2, 3...). Default: `1`. |
| **Tipo de Habitación** | Select | Opciones: *Habitación Sencilla*, *Habitación Doble*, *Habitación Triple*, etc. Al elegir, precarga la tarifa sugerida. |
| **Solicitó** | Texto (Input) | Detalle específico o requerimiento del huésped (ej. *Cama King*, *Vista al lago*, *Piso alto*). |
| **Módulo** | Texto (Input) | Bloque o sector del recinto donde se hospeda (ej. *Módulo A*, *Módulo Jardín*). |
| **Tarifa Diaria (Q)** | Number / Currency | Tarifa por noche por habitación. Editable. |
| **Monto Total (Q)** | Number (Calculado) | **Fórmula automática:** `Cantidad Habitaciones × Noches × Tarifa Diaria`. Permite ajuste o sobreescritura manual. |
| **No. Reserva** | Texto Libre | Ingreso manual de código de confirmación o voucher de agencia. |
| **No. Folio** | Texto Libre | Ingreso manual de número de folio físico o factura interna. |
| **Estado / Forma Pago** | Select | Opciones: *Pago con Tarjeta*, *Pago en Efectivo*, *Transferencia*, *Pendiente de Pago*, etc. |
| **Último Contacto** | DateTime (Badge) | Se actualiza automáticamente al interactuar por WhatsApp o Correo, o permite edición manual. |
| **Observaciones** | Textarea | Notas internas y solicitudes especiales. |

---

## 5. Inteligencia de Huéspedes y Medición de "Último Contacto"

### 5.1 Detección Automática de Huéspedes Frecuentes
Al ingresar un teléfono o correo electrónico existente en la base de datos de habitaciones:
1. El sistema muestra un badge ejecutivo: **"⭐ Huésped Frecuente: X estancias anteriores"**.
2. Despliega un botón para ver el resumen cronológico de fechas previas en las que se hospedó.
3. Precarga automáticamente el nombre y la empresa habitual.

### 5.2 Módulo de Contacto Rápido y Actualización Automática
En la fila de cada reserva en la tabla principal y en la ficha del huésped se ubican dos acciones directas:
- **Botón WhatsApp:** Abre un modal con el mensaje personalizado generado según la plantilla configurada (reemplazando tokens como `{nombre_huesped}`, `{check_in}`, `{check_out}`, `{tipo_habitacion}`, `{total}`). Al presionar "Enviar por WhatsApp", redirige a `https://wa.me/{telefono}?text=...` y registra la fecha/hora actual como `ultimo_contacto` con medio `WhatsApp`.
- **Botón Correo:** Genera el correo con asunto y cuerpo predeterminados. Al presionar "Abrir Correo", ejecuta el cliente de correo o endpoint y actualiza `ultimo_contacto` con medio `Correo`.

---

## 6. Centro de Configuración Unificado de Habitaciones

En el panel de configuración general (`src/modules/settings/SettingsMain.jsx`), se integrará una nueva tarjeta Bento:
- **Título:** `Configuración de Habitaciones`
- **Descripción:** *Catálogos de medios de contacto, tipos de habitación con tarifas, tipos de cliente, formas de pago y plantillas.*
- **Sub-vistas internas (Tabs):**
  1. **Medios de Contacto:** Alta, edición y desactivación de canales (Llamada, WhatsApp, etc.).
  2. **Tipos de Habitación:** Nombre (Sencilla, Doble, Triple...), descripción y tarifa base sugerida (Q).
  3. **Tipos de Cliente:** Clasificaciones (Individual, Corporativo, Social...).
  4. **Formas de Pago / Estado:** Métodos autorizados (Tarjeta, Efectivo, Transferencia...).
  5. **Plantillas de Mensajes:** Asunto y cuerpo de mensajes predeterminados para WhatsApp y Correo con soporte de variables dinámicas:
     - `{nombre_huesped}`
     - `{no_reserva}`
     - `{no_folio}`
     - `{check_in}`
     - `{check_out}`
     - `{noches}`
     - `{tipo_habitacion}`
     - `{monto_total}`
  6. **Metas de Habitaciones:** Registro mensual de metas por vendedor y meta global de hospedaje.

---

## 7. Endpoints REST a Implementar (`server.cjs`)

```http
### RESERVAS DE HABITACIONES
GET    /api/habitaciones                  -> Listar reservas con filtros (mes, fechas, vendedor, estado, search)
POST   /api/habitaciones                  -> Crear nueva reserva de habitación (crea empresa al vuelo si no existe)
GET    /api/habitaciones/:id              -> Obtener detalle de una reserva
PUT    /api/habitaciones/:id              -> Actualizar reserva
DELETE /api/habitaciones/:id              -> Eliminar reserva (borrado lógico o físico seguro)
POST   /api/habitaciones/:id/contacto     -> Registrar interacción de contacto (actualiza ultimo_contacto)

### HISTORIAL DE HUÉSPED
GET    /api/habitaciones/huesped/historial?query=... -> Busca por teléfono o correo y retorna contador y estancias

### CATÁLOGOS DINÁMICOS
GET    /api/habitaciones/catalogos/:cat   -> Obtener catálogo (medios_contacto, tipos_cliente, tipos_habitacion, etc.)
POST   /api/habitaciones/catalogos/:cat   -> Agregar elemento al catálogo
PUT    /api/habitaciones/catalogos/:cat/:id -> Editar elemento
DELETE /api/habitaciones/catalogos/:cat/:id -> Desactivar o eliminar elemento

### METAS DE HABITACIONES
GET    /api/habitaciones/metas?mes=YYYY-MM -> Obtener metas del mes (global y por vendedor)
PUT    /api/habitaciones/metas            -> Guardar/actualizar metas de habitaciones
```

---

## 8. Impacto en Reportes y Proyección de Metas

### 8.1 Nomenclatura en Módulo de Reportes (`ReportsModule.jsx`)
- La tarjeta y pestaña actual de "Reporte de Ventas" se renombra oficialmente a:  
  **`Reporte de Ventas de Eventos`** (`ReportsVentas.jsx`).
- Se crea la nueva tarjeta y vista dedicada:  
  **`Reporte de Ventas de Habitaciones`** (`ReportsVentasHabitaciones.jsx`).

### 8.2 Nuevo `Reporte de Ventas de Habitaciones` (`ReportsVentasHabitaciones.jsx`)
Incluye:
- Indicadores superiores (KPI Cards): Total Ingresos Habitaciones (Q), Noches Vendidas, Habitaciones Reservadas, Ticket Promedio por Noche.
- Gráficas y desglose por Tipo de Habitación, Vendedor, Medio de Contacto y Tipo de Cliente.
- Tabla transaccional con exportación a Excel (.xlsx).

### 8.3 Dashboard Ejecutivo (`ReportsDashboard.jsx`)
- En el bloque de **Meta Global Mensual**:
  - `Ventas Eventos: Q X.XX`
  - `+ Ventas Habitaciones: Q Y.YY`
  - `--------------------------------`
  - **`Total Ingresos Consolidados: Q (X + Y)`**
- La barra de porcentaje de cumplimiento hacia la Meta Global suma ambas fuentes de ingreso.

### 8.4 Proyección de Metas (`ReportsProyeccionMetas.jsx`)
- Se añade un conmutador de visualización en la cabecera:
  - `[ Consolidado ]` (Suma Eventos + Habitaciones vs Meta Global Consolidada).
  - `[ Solo Eventos ]` (Eventos vs Meta de Eventos por Vendedor/Equipo).
  - `[ Solo Habitaciones ]` (Habitaciones vs Meta de Habitaciones por Vendedor).

---

## 9. Lista de Chequeo de Archivos para la Futura Implementación

Cuando se decida iniciar la implementación, se tocarán los siguientes archivos:

1. **Backend:**
   - `server.cjs` (Migraciones MariaDB de tablas, endpoints `/api/habitaciones/*`).
2. **Servicios Frontend:**
   - `src/services/habitacionesService.js` (Nuevo servicio atómico para llamadas a la API).
3. **Navegación y Rutas:**
   - `src/layouts/MainLayout/components/Sidebar.jsx` (Enlace de menú bajo Tablero de Ocupación).
   - `src/App.jsx` (Ruta protegida `/habitaciones`).
4. **Módulo Principal:**
   - `src/modules/habitaciones/HabitacionesModule.jsx` (Nuevo: Listado, KPIs, filtros, modal de reserva y modal de contacto).
   - `src/modules/habitaciones/habitaciones.css` (Estilos ejecutivos y responsivos).
5. **Configuración:**
   - `src/modules/settings/SettingsHabitaciones.jsx` (Nuevo: Catálogos y metas de habitaciones).
   - `src/modules/settings/SettingsMain.jsx` (Tarjeta Bento y vista inline).
6. **Reportería:**
   - `src/modules/reports/ReportsModule.jsx` (Renombrar ventas eventos y añadir tarjeta habitaciones).
   - `src/modules/reports/ReportsVentasHabitaciones.jsx` (Nuevo reporte de ventas de habitaciones).
   - `src/modules/reports/ReportsDashboard.jsx` (Suma consolidada a meta global).
   - `src/modules/reports/ReportsProyeccionMetas.jsx` (Conmutador de proyección de metas).
7. **Pruebas:**
   - `tests/habitaciones-system.test.mjs` (Pruebas unitarias de fórmulas, esquema y endpoints).
