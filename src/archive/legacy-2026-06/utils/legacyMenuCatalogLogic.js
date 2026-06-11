// Legacy Menu Catalog Logic extracted from app.js
import { showToast as toast } from './toastUtils';

let menuCatalogManagerKind = "plato_fuerte";
let menuCatalogManagerEditingId = "";
let menuCatalogManagerRows = [];
let menuSuggestionDraggingRow = null;

let el = {};

export function initLegacyMenuCatalogLogic() {
  const ids = [
    "menuCatalogBackdrop", "menuCatalogTitle", "btnMenuCatalogClose", "menuCatalogKind",
    "menuCatalogProteinWrap", "menuCatalogProtein", "menuCatalogName", "menuCatalogDishTypeWrap",
    "menuCatalogDishType", "menuCatalogNoProteinWrap", "menuCatalogNoProtein", "btnMenuCatalogReset",
    "btnMenuCatalogSave", "menuCatalogBody", "btnMenuCatalogOpenSuggestions", "btnMenuCatalogDiscard",
    "menuSuggestionsBackdrop", "menuSuggestionsTitle", "btnMenuSuggestionsClose", "menuSuggestionsProtein",
    "menuSuggestionsPreparation", "menuSuggestionsSalsas", "menuSuggestionsGuarniciones",
    "menuSuggestionsPostres", "menuSuggestionsBebidas", "menuSuggestionsMontajeTipos",
    "menuSuggestionsMontajeAdicionales", "btnMenuSuggestionsManageCatalog", "btnMenuSuggestionsDiscard",
    "btnMenuSuggestionsSave"
  ];
  
  ids.forEach(id => {
    el[id] = document.getElementById(id);
  });
  
  if (el.btnMenuCatalogClose) el.btnMenuCatalogClose.onclick = closeMenuCatalogManagerModal;
  if (el.btnMenuCatalogDiscard) el.btnMenuCatalogDiscard.onclick = closeMenuCatalogManagerModal;
  if (el.btnMenuCatalogReset) el.btnMenuCatalogReset.onclick = resetMenuCatalogManagerForm;
  if (el.btnMenuCatalogSave) el.btnMenuCatalogSave.onclick = saveMenuCatalogManagerRecord;
  if (el.menuCatalogKind) el.menuCatalogKind.onchange = () => {
    menuCatalogManagerEditingId = "";
    menuCatalogManagerKind = String(el.menuCatalogKind.value || "plato_fuerte");
    resetMenuCatalogManagerForm();
    syncMenuCatalogManagerFormByKind();
    refreshMenuCatalogManagerRows();
  };
  
  if (el.btnMenuCatalogOpenSuggestions) el.btnMenuCatalogOpenSuggestions.onclick = () => {
    closeMenuCatalogManagerModal();
    openMenuSuggestionsModal();
  };
  
  if (el.btnMenuSuggestionsClose) el.btnMenuSuggestionsClose.onclick = closeMenuSuggestionsModal;
  if (el.btnMenuSuggestionsDiscard) el.btnMenuSuggestionsDiscard.onclick = closeMenuSuggestionsModal;
  if (el.btnMenuSuggestionsManageCatalog) el.btnMenuSuggestionsManageCatalog.onclick = () => {
    closeMenuSuggestionsModal();
    openMenuCatalogManagerModal("plato_fuerte");
  };
  if (el.btnMenuSuggestionsSave) el.btnMenuSuggestionsSave.onclick = async () => {
    const payload = {
      id_plato_fuerte: parseInt(el.menuSuggestionsProtein?.value || 0, 10),
      id_preparacion: parseInt(el.menuSuggestionsPreparation?.value || 0, 10),
      salsaIds: Array.from(el.menuSuggestionsSalsas?.querySelectorAll("input:checked") || []).map(i => parseInt(i.value, 10)),
      guarnicionIds: Array.from(el.menuSuggestionsGuarniciones?.querySelectorAll("input:checked") || []).map(i => parseInt(i.value, 10)),
      postreIds: Array.from(el.menuSuggestionsPostres?.querySelectorAll("input:checked") || []).map(i => parseInt(i.value, 10)),
      bebidaIds: Array.from(el.menuSuggestionsBebidas?.querySelectorAll("input:checked") || []).map(i => parseInt(i.value, 10)),
      montajeTipoIds: Array.from(el.menuSuggestionsMontajeTipos?.querySelectorAll("input:checked") || []).map(i => parseInt(i.value, 10)),
      montajeAdicionalIds: Array.from(el.menuSuggestionsMontajeAdicionales?.querySelectorAll("input:checked") || []).map(i => parseInt(i.value, 10)),
    };
    const res = await saveMenuSuggestions(payload);
    if (res && res.ok) {
      toast("Sugerencias guardadas", "success");
    } else {
      toast("Error al guardar sugerencias", "error");
    }
  };
  
  if (el.menuSuggestionsProtein) el.menuSuggestionsProtein.onchange = refreshMenuSuggestionsModalData;
  if (el.menuSuggestionsPreparation) el.menuSuggestionsPreparation.onchange = refreshMenuSuggestionsModalData;
  
  // Expose global functions to window so they can be called externally if needed
  window.openMenuCatalogManagerModal = openMenuCatalogManagerModal;
}

async function readMenuCatalog(kind, extraQuery = "") {
  const q = String(extraQuery || "").trim();
  const endpoint = buildApiUrlFromStateUrl(activeApiStateUrl, `menu-catalog/${encodeURIComponent(kind)}${q ? `?${q}` : ""}`);
  const res = await fetch(endpoint, { cache: "no-store" });
  if (!res.ok) throw new Error(`menu_catalog_read_${kind}`);
  const payload = await res.json();
  return Array.isArray(payload?.items) ? payload.items : [];
}

async function createMenuCatalog(kind, body) {
  const endpoint = buildApiUrlFromStateUrl(activeApiStateUrl, `menu-catalog/${encodeURIComponent(kind)}`);
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) {
    let detail = "";
    try {
      const payload = await res.json();
      detail = String(payload?.detail || payload?.message || "").trim();
    } catch (_) { }
    throw new Error(detail || `menu_catalog_create_${kind}`);
  }
}

async function updateMenuCatalog(kind, id, body) {
  const endpoint = buildApiUrlFromStateUrl(activeApiStateUrl, `menu-catalog/${encodeURIComponent(kind)}/${encodeURIComponent(String(id || ""))}`);
  const res = await fetch(endpoint, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) {
    let detail = "";
    try {
      const payload = await res.json();
      detail = String(payload?.detail || payload?.message || "").trim();
    } catch (_) { }
    throw new Error(detail || `menu_catalog_update_${kind}`);
  }
}

async function readMenuSuggestions({ platoId, preparacionId }) {
  const q = `plato_id=${encodeURIComponent(String(platoId || ""))}&preparacion_id=${encodeURIComponent(String(preparacionId || ""))}`;
  const endpoint = buildApiUrlFromStateUrl(activeApiStateUrl, `menu-suggestions?${q}`);
  const res = await fetch(endpoint);
  if (!res.ok) throw new Error("menu_suggestions_read_failed");
  return res.json();
}

async function readMenuSuggestionsCached(platoId, preparacionId) {
  ensureMmsCatalogDefaults();
  const pid = Number(platoId || 0);
  const prepId = Number(preparacionId || 0);
  if (!Number.isFinite(pid) || pid <= 0 || !Number.isFinite(prepId) || prepId <= 0) {
    return normalizeMmsSuggestionLinks(null);
  }
  const cache = menuMontajeSelectableCatalogCache;
  const key = `${pid}:${prepId}`;
  if (cache.suggestionsByPair.has(key)) {
    return cache.suggestionsByPair.get(key);
  }
  if (cache.suggestionsInFlightByPair.has(key)) {
    return cache.suggestionsInFlightByPair.get(key);
  }
  const pending = readMenuSuggestions({ platoId: pid, preparacionId: prepId })
    .then((payload) => {
      const normalized = normalizeMmsSuggestionLinks(payload);
      cache.suggestionsByPair.set(key, normalized);
      cache.suggestionsInFlightByPair.delete(key);
      return normalized;
    })
    .catch((err) => {
      cache.suggestionsInFlightByPair.delete(key);
      throw err;
    });
  cache.suggestionsInFlightByPair.set(key, pending);
  return pending;
}

async function saveMenuSuggestions(payload) {
  const endpoint = buildApiUrlFromStateUrl(activeApiStateUrl, "menu-suggestions");
  const res = await fetch(endpoint, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {}),
  });
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = String(body?.detail || body?.message || "").trim();
    } catch (_) { }
    throw new Error(detail || "menu_suggestions_save_failed");
  }
}

function renderMenuSuggestionCheckboxList(container, items, selectedIds) {
  if (!container) return;
  container.innerHTML = "";
  const rows = Array.isArray(items) ? items.filter((x) => x && x.activo !== false) : [];
  if (!rows.length) {
    container.innerHTML = `<div class="menuSuggestEmpty">Sin datos en catalogo.</div>`;
    return;
  }
  const selectedSet = new Set((Array.isArray(selectedIds) ? selectedIds : []).map((x) => String(x)));
  for (const item of rows) {
    const id = String(item.id || "").trim();
    if (!id) continue;
    const isChecked = selectedSet.has(id);
    const row = document.createElement("label");
    row.className = "menuSuggestRow";
    row.dataset.mmSuggestId = id;
    row.draggable = isChecked;
    row.classList.toggle("isChecked", isChecked);
    row.innerHTML = `
      <span class="menuSuggestDragWrap">
        <span class="menuSuggestDrag" title="Arrastra para priorizar">&#9776;</span>
      </span>
      <span class="menuSuggestCheckWrap">
        <input type="checkbox" value="${escapeHtml(id)}" ${isChecked ? "checked" : ""} />
        <span class="menuSuggestCheckVisual" aria-hidden="true"></span>
      </span>
      <span class="menuSuggestMeta">
        <span class="menuSuggestName">${escapeHtml(String(item.nombre || "").trim())}</span>
        <span class="menuSuggestHint">${isChecked ? "Sugerencia activa y ordenable." : "Marca para sugerir esta opcion."}</span>
      </span>
      <span class="menuSuggestState">${isChecked ? "Activo" : "Opcional"}</span>
    `;
    container.appendChild(row);
  }
}

function setMenuSuggestRowDraggableByCheckbox(row) {
  if (!row) return;
  const checkbox = row.querySelector("input[type='checkbox']");
  const isChecked = !!checkbox?.checked;
  row.draggable = isChecked;
  row.classList.toggle("isChecked", isChecked);
}

function bindMenuSuggestDnD(container) {
  if (!container) return;

function resetMenuCatalogManagerForm() {
  menuCatalogManagerEditingId = "";
  if (el.menuCatalogName) el.menuCatalogName.value = "";
  if (el.menuCatalogDishType) el.menuCatalogDishType.value = "NORMAL";
  if (el.menuCatalogNoProtein) el.menuCatalogNoProtein.checked = false;
}

function syncMenuCatalogManagerFormByKind() {
  const kind = String(el.menuCatalogKind?.value || menuCatalogManagerKind || "plato_fuerte");
  menuCatalogManagerKind = kind;
  const isPlato = kind === "plato_fuerte";
  const isPrep = kind === "preparacion";
  if (el.menuCatalogDishTypeWrap) el.menuCatalogDishTypeWrap.hidden = !isPlato;
  if (el.menuCatalogNoProteinWrap) el.menuCatalogNoProteinWrap.hidden = !isPlato;
  if (el.menuCatalogProteinWrap) el.menuCatalogProteinWrap.hidden = !isPrep;
}

async function loadMenuCatalogProteinOptionsForManager() {
  if (!el.menuCatalogProtein) return [];
  const platos = await readMenuCatalog("plato_fuerte");
  el.menuCatalogProtein.innerHTML = "";
  for (const p of platos.filter((x) => x && x.activo !== false)) {
    const opt = document.createElement("option");
    opt.value = String(p.id);
    opt.textContent = formatPlatoCatalogLabel(p);
    el.menuCatalogProtein.appendChild(opt);
  }
  if (!el.menuCatalogProtein.options.length) {
    el.menuCatalogProtein.innerHTML = `<option value="">Sin proteinas activas</option>`;
  }
  return platos;
}

function renderMenuCatalogManagerRows(kind, rows, proteins = []) {
  if (!el.menuCatalogBody) return;
  el.menuCatalogBody.innerHTML = "";
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="4">Sin registros.</td>`;
    el.menuCatalogBody.appendChild(tr);
    return;
  }
  const proteinById = new Map((Array.isArray(proteins) ? proteins : []).map((p) => [String(p.id), p]));
  for (const item of list) {
    const tr = document.createElement("tr");
    const id = String(item.id || "");
    const isActive = item.activo !== false;
    let detail = "-";
    if (kind === "plato_fuerte") {
      const tipo = String(item.tipo_plato || "NORMAL");
      const sp = item.es_sin_proteina ? " | SIN PROTEINA" : "";
      detail = `${tipo}${sp}`;
    } else if (kind === "preparacion") {
      const protein = proteinById.get(String(item.id_plato_fuerte || ""));
      detail = `Proteina: ${protein ? formatPlatoCatalogLabel(protein) : String(item.id_plato_fuerte || "-")}`;
    } else if (kind === "montaje_adicional") {
      detail = String(item.tipo || "-");
    }
    tr.innerHTML = `
      <td>${escapeHtml(String(item.nombre || "-"))}</td>
      <td>${escapeHtml(detail)}</td>
      <td>${isActive ? "Activo" : "Inhabilitado"}</td>
      <td>
        <div class="appointmentActions">
          <button type="button" class="apptIconBtn apptEdit" data-mmcat-action="edit" data-mmcat-id="${escapeHtml(id)}" title="Editar registro" aria-label="Editar registro">&#9998;</button>
          <button type="button" class="apptIconBtn ${isActive ? "apptDelete" : ""}" data-mmcat-action="toggle" data-mmcat-id="${escapeHtml(id)}" title="${isActive ? "Inhabilitar registro" : "Reactivar registro"}" aria-label="${isActive ? "Inhabilitar registro" : "Reactivar registro"}">${isActive ? "&#9940;" : "&#8635;"}</button>
        </div>
      </td>
    `;
    el.menuCatalogBody.appendChild(tr);
  }
}

async function refreshMenuCatalogManagerRows() {
  const kind = String(el.menuCatalogKind?.value || menuCatalogManagerKind || "plato_fuerte");
  menuCatalogManagerKind = kind;
  const proteins = await loadMenuCatalogProteinOptionsForManager();
  let rows;
  if (kind === "preparacion") {
    const proteinId = Number(el.menuCatalogProtein?.value || 0);
    rows = await readMenuCatalog("preparacion", `plato_id=${encodeURIComponent(String(proteinId || ""))}`);
  } else {
    rows = await readMenuCatalog(kind);
  }
  menuCatalogManagerRows = Array.isArray(rows) ? rows : [];
  renderMenuCatalogManagerRows(kind, menuCatalogManagerRows, proteins);
}

async function saveMenuCatalogManagerRecord() {
  const kind = String(el.menuCatalogKind?.value || menuCatalogManagerKind || "plato_fuerte");
  const name = String(el.menuCatalogName?.value || "").trim();
  if (!name) return toast("Nombre requerido.");
  const editingId = String(menuCatalogManagerEditingId || "").trim();

async function openMenuCatalogManagerModal(initialKind = "plato_fuerte") {
  if (!el.menuCatalogBackdrop || !el.menuCatalogKind) return;
  menuCatalogManagerEditingId = "";
  menuCatalogManagerKind = String(initialKind || "plato_fuerte");
  el.menuCatalogKind.value = menuCatalogManagerKind;
  resetMenuCatalogManagerForm();
  syncMenuCatalogManagerFormByKind();
  await refreshMenuCatalogManagerRows();
  el.menuCatalogBackdrop.hidden = false;
}

function closeMenuCatalogManagerModal() {
  if (!el.menuCatalogBackdrop) return;
  el.menuCatalogBackdrop.hidden = true;
  resetMenuCatalogManagerForm();
}

async function refreshMenuSuggestionsModalData() {
  if (!el.menuSuggestionsProtein || !el.menuSuggestionsPreparation) return;
  const platoId = Number(el.menuSuggestionsProtein.value || 0);
  const preparacionId = Number(el.menuSuggestionsPreparation.value || 0);
  if (!Number.isFinite(platoId) || platoId <= 0 || !Number.isFinite(preparacionId) || preparacionId <= 0) {
    renderMenuSuggestionCheckboxList(el.menuSuggestionsSalsas, [], []);
    renderMenuSuggestionCheckboxList(el.menuSuggestionsPostres, [], []);
    renderMenuSuggestionCheckboxList(el.menuSuggestionsGuarniciones, [], []);
    renderMenuSuggestionCheckboxList(el.menuSuggestionsBebidas, [], []);
    renderMenuSuggestionCheckboxList(el.menuSuggestionsMontajeTipos, [], []);
    renderMenuSuggestionCheckboxList(el.menuSuggestionsMontajeAdicionales, [], []);
    return;
  }

async function openMenuSuggestionsModal() {
  if (!el.menuSuggestionsBackdrop || !el.menuSuggestionsProtein || !el.menuSuggestionsPreparation) return;
  const platos = await readMenuCatalog("plato_fuerte");
  el.menuSuggestionsProtein.innerHTML = "";
  for (const p of platos.filter((x) => x && x.activo !== false)) {
    const opt = document.createElement("option");
    opt.value = String(p.id);
    opt.textContent = formatPlatoCatalogLabel(p);
    el.menuSuggestionsProtein.appendChild(opt);
  }
  if (!el.menuSuggestionsProtein.options.length) {
    el.menuSuggestionsProtein.innerHTML = `<option value="">Sin proteinas registradas</option>`;
    el.menuSuggestionsPreparation.innerHTML = `<option value="">Sin preparaciones</option>`;
    renderMenuSuggestionCheckboxList(el.menuSuggestionsSalsas, [], []);
    renderMenuSuggestionCheckboxList(el.menuSuggestionsPostres, [], []);
    renderMenuSuggestionCheckboxList(el.menuSuggestionsGuarniciones, [], []);
    el.menuSuggestionsBackdrop.hidden = false;
    document.body.classList.add("menuSuggestionsModalOpen");
    return;
  }

function closeMenuSuggestionsModal() {
  if (!el.menuSuggestionsBackdrop) return;
  el.menuSuggestionsBackdrop.hidden = true;
  document.body.classList.remove("menuSuggestionsModalOpen");
}