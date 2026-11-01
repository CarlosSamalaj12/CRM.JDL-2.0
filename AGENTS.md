  CRM-JDL — Essential Agent Guidelines

1. Project Context & Stack

Stack: React 19 + Vite 8 + Express (server.cjs monolith) + MariaDB.

Frontend Architecture:

Legacy CRM (src/modules/{calendar,customers,reports,settings}/ with ApiClient).

Informes Module (src/modules/informes/ with raw fetch + Contexts: Auth, Socket, Toast).

System Updates: Governed by dist/version.json. Real-time cache purging and force-logout are triggered via Socket.io (system:force-logout) and Service Worker changes.

2. State & Reactivity Rules (CRITICAL)

Functional State Updates: ALWAYS use functional updates for forms to prevent data loss and race conditions (e.g., setFormData(prev => ({ ...prev, field: value }))).

Avoid Stale Closures in Sockets: WebSocket listeners (entity:changed, state-updated) MUST use useRef (e.g., filtersRef.current) to read current filters. Never depend on initial closures that reset user views.

Controlled Inputs: Never pass null to a controlled input. Always normalize database values with nullish coalescing (e.g., value={data.field ?? ''}).

3. API & Data Fetching

Atomic Endpoints Only: NEVER use monolithic state updates (saveCrmState or PUT /api/state) for saving single entities (like settings, checklists, or services). This causes 413 Payload Too Large errors and freezes the UI (45MB+ payloads). Always use or create dedicated atomic endpoints.

Database Integrity: Do not use DELETE on catalogs if they are in use (usageCount > 0). Return 409 Conflict and use soft deletes or atomic desyncs instead.

4. UI, Styling & UX

CSS Scoping: Always shield component styles with high specificity (e.g., body:not(.informes-theme) .your-class) to prevent global styles (design-system-scoped.css) from breaking inputs (dark gradients) or buttons (pill distortion).

No OS Emojis: Strictly forbid the use of OS native emojis (📅, 🕒, 👥). ALWAYS use minimalist SVG icons (e.g., Lucide/Feather) with subtle strokes (1.6px - 2.0px).

Modals & Popovers: Always mount floating elements (popovers, dropdowns, tooltips) to document.body using ReactDOM.createPortal to prevent overflow: hidden clipping issues from parent containers.

Mobile-First Data: Tables must transform into Bento-style Cards on mobile (<= 768px). Avoid horizontal scrolling tables on mobile interfaces whenever possible.

5. Printing & Exporting

Client-Side Printing: Use Blob URL (URL.createObjectURL(new Blob(...))) for generating print documents to bypass strict CSP headers from the remote server.

Excel Exports: Use ExcelJS (with XLSX fallback) to generate corporate spreadsheets. Include the institutional header, metadata row, and proper data formatting (e.g., "Q"#,##0.00).