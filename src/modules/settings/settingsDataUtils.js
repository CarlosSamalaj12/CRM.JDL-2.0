import api from '../../services/api';

export const IMPORT_EVENT_COLUMNS = [
  'evento_id',
  'grupo_id',
  'nombre_evento',
  'estado',
  'fecha_inicio_evento',
  'fecha_fin_evento',
  'fecha_bloque',
  'hora_inicio',
  'hora_final',
  'salon_principal',
  'salones',
  'vendedor_id',
  'vendedor',
  'pax_total',
  'pax_bloque',
  'empresa_id',
  'empresa',
  'encargado_id',
  'encargado',
  'tipo_evento',
  'notas',
  'total_cotizacion',
];

export const IMPORT_MANAGER_COLUMNS = [
  'empresa_id',
  'nombre_comercial',
  'razon_social_facturar',
  'nit',
  'correo_empresa',
  'telefono_empresa',
  'direccion_empresa',
  'tipo_evento_preferido',
  'notas_empresa',
  'encargado_id',
  'nombre_encargado',
  'telefono_encargado',
  'correo_encargado',
  'direccion_encargado',
];

export function uid(prefix = 'ev') {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

export function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

export function normalizeCompanyRecord(company = {}) {
  const managers = Array.isArray(company.managers) ? company.managers : [];
  const normalizedManagers = managers
    .map((manager) => ({
      id: String(manager.id || uid('mgr')),
      name: String(manager.name || '').trim(),
      phone: String(manager.phone || '').trim(),
      email: String(manager.email || '').trim(),
      address: String(manager.address || '').trim(),
    }))
    .filter((manager) => manager.name);

  if (!normalizedManagers.length) {
    const fallbackName = String(company.contact || company.owner || 'Encargado').trim();
    normalizedManagers.push({
      id: uid('mgr'),
      name: fallbackName || 'Encargado',
      phone: String(company.phone || '').trim(),
      email: String(company.email || '').trim(),
      address: String(company.address || '').trim(),
    });
  }

  return {
    id: String(company.id || uid('cmp')),
    name: String(company.name || 'Empresa').trim(),
    owner: String(company.owner || company.contact || '').trim(),
    email: String(company.email || '').trim(),
    nit: String(company.nit || 'CF').trim(),
    businessName: String(company.businessName || company.billTo || company.name || '').trim(),
    billTo: String(company.billTo || company.businessName || company.name || '').trim(),
    eventType: String(company.eventType || 'Social').trim(),
    address: String(company.address || '').trim(),
    phone: String(company.phone || '').trim(),
    notes: String(company.notes || '').trim(),
    managers: normalizedManagers,
  };
}

export async function loadCrmState() {
  const data = await api.get('/api/state', { t: Date.now() });
  return data?.state || {};
}

export async function saveCrmState(state) {
  return api.put('/api/state', { state });
}

export function csvEscapeCell(value) {
  const text = String(value ?? '');
  return /[",\r\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function downloadCsvTemplate(fileBase, columns, exampleRow) {
  const rows = [columns, columns.map((key) => exampleRow?.[key] ?? '')];
  const csv = rows.map((row) => row.map(csvEscapeCell).join(',')).join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${fileBase}.csv`);
}

export function parseCsvRows(text) {
  const clean = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    const next = clean[i + 1];
    if (ch === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && (ch === ',' || ch === ';')) {
      row.push(cell);
      cell = '';
      continue;
    }
    if (!inQuotes && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && next === '\n') i += 1;
      row.push(cell);
      if (row.some((value) => String(value || '').trim())) rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    cell += ch;
  }

  row.push(cell);
  if (row.some((value) => String(value || '').trim())) rows.push(row);
  if (!rows.length) return [];

  const headers = rows[0].map(normalizeImportHeader);
  return rows.slice(1)
    .map((values) => {
      const obj = {};
      headers.forEach((header, idx) => {
        if (header) obj[header] = String(values[idx] || '').trim();
      });
      return obj;
    })
    .filter((obj) => Object.values(obj).some((value) => String(value || '').trim()));
}

export function normalizeImportHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

export function normalizeImportDate(value) {
  const raw = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const slash = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (slash) return `${slash[3]}-${String(Number(slash[2])).padStart(2, '0')}-${String(Number(slash[1])).padStart(2, '0')}`;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
}

export function normalizeImportTime(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return '';
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return '';
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function normalizeImportNumber(value) {
  const raw = String(value || '').replace(/[Q,\s]/g, '').trim();
  const num = Number(raw);
  return Number.isFinite(num) ? Math.max(0, num) : 0;
}

export function findCompanyForImport(state, row) {
  const id = String(row.empresa_id || '').trim();
  const name = String(row.nombre_comercial || row.empresa || '').trim();
  state.companies = Array.isArray(state.companies) ? state.companies : [];

  let company = id ? state.companies.find((item) => String(item.id || '') === id) : null;
  if (!company && name) {
    const norm = normalizeKey(name);
    company = state.companies.find((item) => normalizeKey(item.name) === norm) || null;
  }

  if (!company && (id || name)) {
    company = normalizeCompanyRecord({
      id: id || uid('cmp'),
      name: name || 'Empresa importada',
      businessName: row.razon_social_facturar || name,
      billTo: row.razon_social_facturar || name,
      nit: row.nit || 'CF',
      email: row.correo_empresa || '',
      phone: row.telefono_empresa || '',
      address: row.direccion_empresa || '',
      eventType: row.tipo_evento_preferido || row.tipo_evento || 'Corporativo',
      notes: row.notas_empresa || '',
      managers: [],
    });
    state.companies.push(company);
  }

  if (company) {
    company.name = String(row.nombre_comercial || row.empresa || company.name || '').trim() || company.name;
    company.businessName = String(row.razon_social_facturar || company.businessName || company.name || '').trim();
    company.billTo = String(row.razon_social_facturar || company.billTo || company.businessName || company.name || '').trim();
    company.nit = String(row.nit || company.nit || 'CF').trim();
    company.email = String(row.correo_empresa || company.email || '').trim();
    company.phone = String(row.telefono_empresa || company.phone || '').trim();
    company.address = String(row.direccion_empresa || company.address || '').trim();
    company.eventType = String(row.tipo_evento_preferido || row.tipo_evento || company.eventType || 'Corporativo').trim();
    company.notes = String(row.notas_empresa || company.notes || '').trim();
    company.managers = Array.isArray(company.managers) ? company.managers : [];
  }

  return company || null;
}

export function upsertManagerForImport(company, row) {
  if (!company) return null;
  const id = String(row.encargado_id || '').trim();
  const name = String(row.nombre_encargado || row.encargado || '').trim();
  if (!name && !id) return null;

  company.managers = Array.isArray(company.managers) ? company.managers : [];
  let manager = id ? company.managers.find((item) => String(item.id || '') === id) : null;
  if (!manager && name) {
    const norm = normalizeKey(name);
    manager = company.managers.find((item) => normalizeKey(item.name) === norm) || null;
  }
  if (!manager) {
    manager = { id: id || uid('mgr'), name: name || 'Encargado', phone: '', email: '', address: '' };
    company.managers.push(manager);
  }
  manager.name = name || manager.name;
  manager.phone = String(row.telefono_encargado || row.telefono || manager.phone || '').trim();
  manager.email = String(row.correo_encargado || row.correo || manager.email || '').trim();
  manager.address = String(row.direccion_encargado || row.direccion || manager.address || '').trim();
  return manager;
}

export function findUserForImport(state, row) {
  const users = Array.isArray(state.users) ? state.users : [];
  const id = String(row.vendedor_id || '').trim();
  if (id) {
    const byId = users.find((user) => String(user.id || '') === id);
    if (byId) return byId;
  }
  const name = String(row.vendedor || '').trim();
  if (name) {
    const norm = normalizeKey(name);
    const byName = users.find((user) => normalizeKey(user.fullName || user.name) === norm);
    if (byName) return byName;
  }
  return users.find((user) => user.active !== false) || users[0] || null;
}

export function importManagersCompaniesRows(state, rows) {
  let companiesTouched = 0;
  let managersTouched = 0;
  for (const row of rows) {
    const company = findCompanyForImport(state, row);
    if (!company) continue;
    companiesTouched += 1;
    if (upsertManagerForImport(company, row)) managersTouched += 1;
  }
  state.companies = (state.companies || []).map(normalizeCompanyRecord);
  return { companiesTouched, managersTouched };
}

export function importEventRows(state, rows) {
  let imported = 0;
  let skipped = 0;
  state.events = Array.isArray(state.events) ? state.events : [];
  state.salones = Array.isArray(state.salones) ? state.salones : [];

  for (const row of rows) {
    const date = normalizeImportDate(row.fecha_bloque || row.fecha_inicio_evento);
    const startTime = normalizeImportTime(row.hora_inicio);
    const endTime = normalizeImportTime(row.hora_final);
    const salon = String(row.salon_principal || row.salon || '').trim();
    const name = String(row.nombre_evento || '').trim();
    if (!date || !startTime || !endTime || !salon || !name || endTime <= startTime) {
      skipped += 1;
      continue;
    }

    if (!state.salones.some((item) => String(item || '').toLowerCase() === salon.toLowerCase())) {
      state.salones.push(salon);
    }

    const company = findCompanyForImport(state, row);
    const manager = upsertManagerForImport(company, row);
    const user = findUserForImport(state, row);
    const total = normalizeImportNumber(row.total_cotizacion);
    const salones = String(row.salones || salon)
      .split(',')
      .map((item) => String(item || '').trim())
      .filter(Boolean);
    const eventId = String(row.evento_id || '').trim() || uid('evt');
    const paxTotal = Math.max(0, Math.floor(normalizeImportNumber(row.pax_total)));
    const event = {
      id: eventId,
      groupId: String(row.grupo_id || '').trim() || null,
      name,
      salon,
      mainSalon: salon,
      salones: Array.from(new Set([...salones, salon])),
      date,
      eventDateStart: normalizeImportDate(row.fecha_inicio_evento) || date,
      eventDateEnd: normalizeImportDate(row.fecha_fin_evento) || normalizeImportDate(row.fecha_inicio_evento) || date,
      endDate: normalizeImportDate(row.fecha_fin_evento) || normalizeImportDate(row.fecha_inicio_evento) || date,
      status: String(row.estado || 'Pre reserva').trim(),
      startTime,
      endTime,
      userId: String(user?.id || ''),
      pax: paxTotal,
      slotPax: Math.max(0, Math.floor(normalizeImportNumber(row.pax_bloque))),
      notes: String(row.notas || '').trim(),
    };
    if (company && manager) {
      event.quote = {
        companyId: company.id,
        managerId: manager.id,
        companyName: company.name,
        contact: manager.name,
        eventType: String(row.tipo_evento || company.eventType || '').trim(),
        eventDate: event.eventDateStart,
        people: paxTotal,
        pax: paxTotal,
        quotedAt: '',
        version: 1,
        discountType: 'FIXED',
        discountValue: 0,
        items: total > 0 ? [{ name: 'Importado', qty: 1, price: total, category: 'Miscelaneos' }] : [],
      };
    }

    const idx = state.events.findIndex((item) => String(item.id || '') === eventId);
    if (idx >= 0) state.events[idx] = { ...state.events[idx], ...event, quote: event.quote || state.events[idx].quote };
    else state.events.push(event);
    imported += 1;
  }

  state.salones = Array.from(new Set(state.salones.map((item) => String(item || '').trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
  state.companies = (state.companies || []).map(normalizeCompanyRecord);
  return { imported, skipped };
}

export function getQuoteTotals(quote = {}) {
  const items = Array.isArray(quote.items) ? quote.items : [];
  const subtotal = items.reduce((acc, item) => {
    const qty = Number(item.qty ?? item.quantity ?? 1);
    const price = Number(item.price ?? item.unitPrice ?? 0);
    return acc + (Number.isFinite(qty) ? qty : 1) * (Number.isFinite(price) ? price : 0);
  }, 0);
  const discountValue = Number(quote.discountValue || 0);
  const discountType = String(quote.discountType || '').toUpperCase();
  const discountAmount = discountType === 'PERCENT' ? subtotal * (discountValue / 100) : discountValue;
  const total = Math.max(0, subtotal - Math.max(0, discountAmount));
  return { subtotal, discountAmount, total };
}

export function getLatestQuoteSnapshot(event = {}) {
  const versions = Array.isArray(event.quote?.versions) ? event.quote.versions : [];
  if (versions.length) {
    return versions.slice().sort((a, b) => Number(b.version || 0) - Number(a.version || 0))[0];
  }
  return event.quote || null;
}

export function exportRowsToExcel({ title, subtitle, columns, example, rows, fileBase }) {
  const headCells = columns.map((col) => `<th>${escapeHtml(col.label)}</th>`).join('');
  const descriptionRows = columns
    .map((col) => `<tr><td>${escapeHtml(col.key)}</td><td>${escapeHtml(col.description || '')}</td></tr>`)
    .join('');
  const exampleCells = columns.map((col) => `<td>${escapeHtml(example?.[col.key] ?? '')}</td>`).join('');
  const dataRows = rows
    .map((row) => `<tr>${columns.map((col) => `<td>${escapeHtml(row?.[col.key] ?? '')}</td>`).join('')}</tr>`)
    .join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:Arial,sans-serif;color:#10213f} h1{font-size:20px;margin:0 0 6px}
    .sub{font-size:12px;margin-bottom:16px;color:#42526b}
    table{border-collapse:collapse;width:100%;margin-bottom:18px}
    th{background:#dbeafe;color:#0f2f66;text-align:left}
    th,td{border:1px solid #9db7d8;padding:8px;font-size:12px;vertical-align:top}
    .section{background:#eff6ff;font-weight:bold}
  </style></head><body>
    <h1>${escapeHtml(title)}</h1><div class="sub">${escapeHtml(subtitle || '')}</div>
    <table><tr class="section"><td colspan="2">Diccionario de columnas</td></tr>${descriptionRows}</table>
    <table><thead><tr>${headCells}</tr></thead><tbody><tr>${exampleCells}</tr>${dataRows}</tbody></table>
  </body></html>`;
  const blob = new Blob([`\uFEFF${html}`], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const stamp = new Date().toISOString().slice(0, 10);
  downloadBlob(blob, `${fileBase}_${stamp}.xls`);
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
