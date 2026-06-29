# CRM-JDL

Event management CRM for Jardines del Lago. React 19 + Vite 8 frontend, Express + MariaDB backend.

## Commands

| Command | Action |
|---------|--------|
| `npm run dev` | Vite dev server (port 5173) |
| `npm run server` | Express backend (port 3000) |
| `npm run dev:all` | Both concurrently |
| `npm run build` | Production build |
| `npm run lint` | ESLint (`.js`/`.jsx` only) |
| `npm run import-menus` | Run `scripts/import_menus.cjs` |

No test runner, no typecheck.dd
sss
## Architecture

**Two subsystems sharing the same auth/state/DB:**

1. **Legacy CRM** (`src/modules/calendar/`, `customers/`, `reports/`, `settings/`) — routed under `<MainLayout>`, uses `authService.getCurrentUser()` + `src/services/api.js` (ApiClient class).
2. **Informes module** (`src/modules/informes/`) — routed under `<ReportsLayout>`, uses `AuthContext`/`SocketContext`/`ToastContext` providers and `informes/services/api.js` (raw fetch calls).

Both share the same JWT token + user JSON in `localStorage`.

**Backend** (`server.cjs`, ~3940 lines): CJS monolith with inline CRM/auth/state routes. At startup it dynamically imports ESM routes from `backend/src/app_routes.js` mounted at `/api`. Auto-migrates schema on every start via `ensure*` functions. Creates `uploads/` dir if missing. Socket.io attached to the HTTP server for real-time events.

## Auth

- **Local login:** `POST /api/login` — scrypt password hash (N=16384, r=8, p=1), uses `loginUsers` dropdown.
- **Firebase login:** `POST /api/auth/firebase` — syncs Firebase user to MariaDB via `src/services/firebase.js`.
- **JWT secret:** Falls back to `sistema_informes_secret_key_change_in_prod` (hardcoded).
- **Role normalization:** `admin`→`Admin`, `recepcionista`→`FrontOffice`, `vendedor`→`Vendedor` (both in `server.cjs` and backend ESM middleware).
- Admin code for editing past events: `JDL-ADMIN-2026`.
- Roles: `admin`, `vendedor`, `recepcionista` (aliased `FrontOffice`), `coordinador`, `eventos`.

## Database

MariaDB, database `crm_jdl`. **Two DB drivers coexist**: `server.cjs` uses `mariadb` (port 3306), `backend/src/config/db.js` uses `mysql2/promise` (default port 3307). Both read from the same `.env`.

Key tables: `salones`, `usuarios`, `empresas`, `encargados_empresa`, `eventos`, `cotizaciones_evento`, `items_cotizacion_evento`, `cotizacion_versiones_evento`, `items_cotizacion_version_evento`, `historial_evento`, `recordatorios_evento`, `anticipos_evento`, `servicios`, `categorias_servicio`, `subcategorias_servicio`, `app_state_kv`, `doc_sequence`, `equipos_trabajo`, `informe_imagenes`.

## State sync

- `GET /api/state` — reads from relational tables, no in-memory cache.
- `PUT /api/state` — merges incoming state with current DB (preserves missing keys), then does destructive DELETE+INSERT. Emits `state-updated` via Socket.io after write.
- Client debounces 700ms via `schedulePersist()`.
- Cache-Control: `no-store` on all `/api/` routes.

## Key gotchas

- **Hybrid CJS/ESM backend:** `server.cjs` is CJS; it dynamically `import()`s ESM from `backend/src/`. If you add backend code, know which module system you're in.
- **ESLint disables specific react-hooks rules:** `set-state-in-effect`, `immutability`, `preserve-manual-memoization`, `purity` are all off.
- **`pdf-lib` loaded from CDN** in `index.html` (not npm). `flatpickr.css`, `slimselect.css`, and Material Symbols font also from CDN.
- **Google Calendar:** Uses OAuth2 flow (`/auth/google`, `/auth/google/callback`) plus service account for user reminders. Both paths in `googleCalendar.cjs`.
- **JWT filter:** ESM routes in `backend/src/` use `authenticate` + `authorizeRoles` from `backend/src/middlewares/auth.js`. Inline CJS routes in `server.cjs` do NOT use JWT middleware (auth is only on login).
- **Login flow:** User dropdown selector → local scrypt password or Firebase Google redirect. Role routes users to `/calendar` (admin/vendedor/recepcionista) or `/kanban` (eventos/coordinador).

## Directory map

- `server.cjs` — Monolith CJS backend (CRM API, auth, state sync, Google Calendar OAuth2)
- `backend/src/` — ESM informes subsystem: `routes/` (16), `controllers/` (16), `middlewares/` (auth, errorHandler, validate), `config/db.js`, `migrations/migrate_informes_tables.sql`
- `src/services/` — Shared: `api.js` (ApiClient), `authService.js`, `firebase.js`, `socketService.js`, `stateService.js`, `eventService.js`, `salonService.js`, `reminderService.js`, `historyService.js`, `conflictService.js`
- `src/modules/informes/` — Reports subsystem (Kanban, ConstructorInforme, Catalog, Dashboard, Configuracion), pages + components + context + `services/api.js`
- `src/layouts/MainLayout/` — CRM shell
- `scripts/` — 45 scripts: CSS scoping (`scope_css.cjs`, `verify_css.cjs`, `revert_css.cjs`), DB migrations, tooltip fixers, data cleanup
- `googleCalendar.cjs` — Google Calendar integration (OAuth2 + service account)

## Conventions

- **No TypeScript** — all `.jsx` / `.js`. `@types/react` installed but unused.
- **CSS:** Design system scoped files (`global-scoped.css`, `design-system-scoped.css`) + `responsive-mobile.css`, `tooltips.css`. Unscoped originals also present. Use `scripts/scope_css.cjs` to scope new CSS.
- **API proxy:** Vite forwards `/api` → `localhost:3000`. Backend serves `/uploads` statically.
- **localStorage keys:** `user` (JSON), `token` (JWT), `crm_topbar_settings_v1`, `crm_auth_session_v1`, `crm_quick_templates_v1`, `crm_active_module_screen_v1`.
- **ESLint ignores:** `dist`, `src/archive/**`, `scripts/**`.

## Import/export

- Events and companies export to Excel (`xlsx` npm package).
- Events and managers CSV import with downloadable templates.
- Document codes: `COT-NNN` via `doc_sequence` table.
