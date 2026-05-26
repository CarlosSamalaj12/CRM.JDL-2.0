import React, { useEffect, useMemo, useState } from 'react';

const CATALOG_OPTIONS = [
  { value: 'plato_fuerte', label: 'Proteina / Plato base' },
  { value: 'preparacion', label: 'Preparacion' },
  { value: 'salsa', label: 'Salsas' },
  { value: 'guarnicion', label: 'Guarniciones' },
  { value: 'postre', label: 'Postres' },
  { value: 'bebida', label: 'Bebidas' },
  { value: 'comentario', label: 'Tortilla/Pan y extras' },
  { value: 'montaje_tipo', label: 'Montaje Tipo' },
  { value: 'montaje_adicional', label: 'Montaje Adicional' }
];

const closeModal = () => {
  const modal = document.getElementById('menuSuggestionsBackdrop');
  if (modal) modal.hidden = true;
};

export default function SettingsMenuMontaje() {
  const [catalogKind, setCatalogKind] = useState('plato_fuerte');
  const [catalogItems, setCatalogItems] = useState([]);
  const [proteins, setProteins] = useState([]);
  const [nameDraft, setNameDraft] = useState('');
  const [proteinDraft, setProteinDraft] = useState('');
  const [dishTypeDraft, setDishTypeDraft] = useState('NORMAL');
  const [editingItem, setEditingItem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  const selectedCatalogLabel = useMemo(
    () => CATALOG_OPTIONS.find(item => item.value === catalogKind)?.label || 'Catalogo',
    [catalogKind]
  );

  const showNotice = (message) => {
    setNotice(message);
    window.clearTimeout(showNotice.timer);
    showNotice.timer = window.setTimeout(() => setNotice(''), 2600);
  };

  const clearForm = () => {
    setEditingItem(null);
    setNameDraft('');
    setProteinDraft('');
    setDishTypeDraft('NORMAL');
  };

  const loadProteins = async () => {
    try {
      const res = await fetch('/api/menu-catalog/plato_fuerte');
      const data = await res.json();
      setProteins(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      console.error('Error al cargar proteinas:', err);
      showNotice('No se pudieron cargar las proteinas.');
    }
  };

  const loadCatalogItems = async (kind = catalogKind) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/menu-catalog/${kind}`);
      const data = await res.json();
      setCatalogItems(Array.isArray(data.items) ? data.items : []);
      clearForm();
    } catch (err) {
      console.error('Error al cargar catalogo:', err);
      showNotice('No se pudo cargar el catalogo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProteins();
    loadCatalogItems(catalogKind);
  }, []);

  useEffect(() => {
    loadCatalogItems(catalogKind);
  }, [catalogKind]);

  const handleEditItem = (item) => {
    setEditingItem(item);
    setNameDraft(item?.nombre || '');
    setProteinDraft(item?.id_plato_fuerte ? String(item.id_plato_fuerte) : '');
    setDishTypeDraft(item?.tipo_plato || 'NORMAL');
  };

  const buildPayload = (baseItem = {}) => {
    const payload = {
      nombre: nameDraft.trim() || baseItem.nombre || '',
      activo: baseItem.activo !== undefined ? baseItem.activo : true
    };
    if (catalogKind === 'preparacion') {
      payload.id_plato_fuerte = Number(proteinDraft || baseItem.id_plato_fuerte || 0);
    }
    if (catalogKind === 'plato_fuerte') {
      payload.tipo_plato = dishTypeDraft || baseItem.tipo_plato || 'NORMAL';
    }
    return payload;
  };

  const handleSaveItem = async () => {
    const nombre = nameDraft.trim();
    if (!nombre) {
      showNotice('Escriba el nombre del registro.');
      return;
    }
    if (catalogKind === 'preparacion' && !proteinDraft) {
      showNotice('Seleccione la proteina base para esta preparacion.');
      return;
    }

    setSaving(true);
    try {
      const url = editingItem
        ? `/api/menu-catalog/${catalogKind}/${editingItem.id}`
        : `/api/menu-catalog/${catalogKind}`;
      const res = await fetch(url, {
        method: editingItem ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(editingItem || {}))
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) throw new Error(data.message || 'No se pudo guardar el registro.');
      await loadCatalogItems(catalogKind);
      if (catalogKind === 'plato_fuerte') await loadProteins();
      showNotice(editingItem ? 'Registro actualizado.' : 'Registro guardado.');
    } catch (err) {
      console.error('Error al guardar catalogo:', err);
      showNotice(err.message || 'No se pudo guardar el registro.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleItem = async (item) => {
    const nextActive = item.activo === false;
    try {
      const payload = {
        nombre: item.nombre,
        activo: nextActive
      };
      if (catalogKind === 'preparacion') payload.id_plato_fuerte = item.id_plato_fuerte;
      if (catalogKind === 'plato_fuerte') payload.tipo_plato = item.tipo_plato || 'NORMAL';

      const res = await fetch(`/api/menu-catalog/${catalogKind}/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) throw new Error(data.message || 'No se pudo cambiar el estado.');
      await loadCatalogItems(catalogKind);
      if (catalogKind === 'plato_fuerte') await loadProteins();
      showNotice(nextActive ? 'Registro reactivado.' : 'Registro inhabilitado.');
    } catch (err) {
      console.error('Error al cambiar estado de catalogo:', err);
      showNotice(err.message || 'No se pudo cambiar el estado.');
    }
  };

  const catalogDetail = (item) => {
    if (catalogKind === 'preparacion') {
      return proteins.find(protein => String(protein.id) === String(item.id_plato_fuerte))?.nombre || 'Sin proteina';
    }
    if (catalogKind === 'plato_fuerte') return item.tipo_plato || 'NORMAL';
    return '-';
  };

  return (
    <div
      className="modalBackdrop"
      id="menuSuggestionsBackdrop"
      hidden
      onClick={(event) => {
        if (event.target.id === 'menuSuggestionsBackdrop') closeModal();
      }}
    >
      <style>{`
        #menuSuggestionsBackdrop {
          position: fixed;
          inset: 0;
          z-index: 9600;
          padding: 18px;
          background: rgba(2, 6, 23, .58);
          overflow: auto;
        }
        #menuSuggestionsBackdrop .settingsMenuCatalog {
          width: min(1160px, 96vw);
          max-height: calc(100vh - 36px);
          margin: 0 auto;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr) auto;
          border: 1px solid #c7d7ec;
          border-radius: 16px;
          background: #f2f6fb;
          box-shadow: 0 26px 70px rgba(15, 23, 42, .34);
          overflow: hidden;
        }
        #menuSuggestionsBackdrop .settingsMenuCatalogHeader,
        #menuSuggestionsBackdrop .settingsMenuCatalogFooter {
          background: #ffffff;
          border-color: #dbe3ef;
          padding: 16px 20px;
        }
        #menuSuggestionsBackdrop .settingsMenuCatalogHeader {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
          border-bottom: 1px solid #dbe3ef;
        }
        #menuSuggestionsBackdrop .settingsMenuCatalogTitle {
          margin: 0;
          color: #071125;
          font-size: 22px;
          line-height: 1.1;
          font-weight: 900;
        }
        #menuSuggestionsBackdrop .settingsMenuCatalogSubtitle {
          margin-top: 6px;
          color: #415574;
          font-size: 12px;
          line-height: 1.4;
        }
        #menuSuggestionsBackdrop .settingsMenuCatalogClose,
        #menuSuggestionsBackdrop .settingsMenuBtn {
          min-height: 38px;
          border: 1px solid #bfd7fb;
          border-radius: 10px;
          background: #edf4ff;
          color: #075cca;
          padding: 0 16px;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
        }
        #menuSuggestionsBackdrop .settingsMenuCatalogBody {
          min-height: 0;
          overflow: auto;
          padding: 18px 20px 20px;
          display: grid;
          gap: 16px;
        }
        #menuSuggestionsBackdrop .settingsMenuForm,
        #menuSuggestionsBackdrop .settingsMenuTableCard {
          border: 1px solid #d7e2f1;
          border-radius: 12px;
          background: #ffffff;
          padding: 16px;
        }
        #menuSuggestionsBackdrop .settingsMenuForm {
          display: grid;
          grid-template-columns: 1.25fr 1.35fr 1fr auto;
          gap: 14px;
          align-items: end;
        }
        #menuSuggestionsBackdrop .settingsMenuField {
          display: flex;
          flex-direction: column;
          gap: 7px;
          min-width: 0;
        }
        #menuSuggestionsBackdrop .settingsMenuField > span {
          color: #10213a;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .08em;
          text-transform: uppercase;
        }
        #menuSuggestionsBackdrop .settingsMenuField input,
        #menuSuggestionsBackdrop .settingsMenuField select {
          width: 100%;
          min-height: 40px;
          border: 1px solid #bfd0e6;
          border-radius: 10px;
          background: #ffffff;
          color: #071125;
          padding: 0 12px;
          font-size: 13px;
          outline: none;
        }
        #menuSuggestionsBackdrop .settingsMenuFormActions {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
        }
        #menuSuggestionsBackdrop .settingsMenuBtnPrimary {
          border-color: #1267d8;
          background: #1267d8;
          color: #ffffff;
        }
        #menuSuggestionsBackdrop .settingsMenuBtnDanger {
          border-color: #fecdd3;
          background: #fff1f2;
          color: #b91c1c;
        }
        #menuSuggestionsBackdrop .settingsMenuNotice {
          border: 1px solid #bdd3ef;
          border-radius: 10px;
          background: #edf4ff;
          color: #10213a;
          padding: 10px 12px;
          font-size: 12px;
          font-weight: 800;
        }
        #menuSuggestionsBackdrop .settingsMenuTableTitle {
          margin-bottom: 12px;
          color: #071125;
          font-size: 15px;
          font-weight: 900;
        }
        #menuSuggestionsBackdrop .settingsMenuTableWrap {
          max-height: 420px;
          overflow: auto;
          border: 1px solid #d7e2f1;
          border-radius: 10px;
        }
        #menuSuggestionsBackdrop table {
          width: 100%;
          min-width: 760px;
          border-collapse: collapse;
        }
        #menuSuggestionsBackdrop th {
          position: sticky;
          top: 0;
          z-index: 1;
          background: #e8f0fa;
          color: #10213a;
          padding: 12px 10px;
          text-align: left;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .06em;
          text-transform: uppercase;
          border-bottom: 1px solid #d7e2f1;
        }
        #menuSuggestionsBackdrop td {
          padding: 12px 10px;
          border-bottom: 1px solid #eef3f8;
          color: #10213a;
          font-size: 13px;
          vertical-align: middle;
        }
        #menuSuggestionsBackdrop tr:nth-child(even) td {
          background: #f8fbff;
        }
        #menuSuggestionsBackdrop .settingsMenuMuted {
          color: #64748b;
          font-weight: 700;
        }
        #menuSuggestionsBackdrop .settingsMenuStatus {
          display: inline-flex;
          min-height: 26px;
          align-items: center;
          border-radius: 999px;
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 900;
        }
        #menuSuggestionsBackdrop .settingsMenuStatus.isActive {
          background: #dcfce7;
          color: #166534;
        }
        #menuSuggestionsBackdrop .settingsMenuStatus.isInactive {
          background: #fee2e2;
          color: #991b1b;
        }
        #menuSuggestionsBackdrop .settingsMenuRowActions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        #menuSuggestionsBackdrop .settingsMenuCatalogFooter {
          display: flex;
          justify-content: flex-end;
          border-top: 1px solid #dbe3ef;
        }
        @media (max-width: 900px) {
          #menuSuggestionsBackdrop {
            padding: 0;
          }
          #menuSuggestionsBackdrop .settingsMenuCatalog {
            width: 100vw;
            max-height: 100vh;
            border-radius: 0;
          }
          #menuSuggestionsBackdrop .settingsMenuForm {
            grid-template-columns: 1fr;
          }
          #menuSuggestionsBackdrop .settingsMenuFormActions {
            justify-content: stretch;
          }
          #menuSuggestionsBackdrop .settingsMenuFormActions .settingsMenuBtn {
            flex: 1;
          }
        }
      `}</style>

      <div className="settingsMenuCatalog" role="dialog" aria-modal="true" aria-labelledby="menuSuggestionsTitle">
        <div className="settingsMenuCatalogHeader">
          <div>
            <h2 className="settingsMenuCatalogTitle" id="menuSuggestionsTitle">Gestionar catalogo Menu & Montaje</h2>
            <div className="settingsMenuCatalogSubtitle">
              Mismo catalogo utilizado en cotizaciones: proteinas, preparaciones, salsas, guarniciones, postres, bebidas, pan/tortilla y montaje.
            </div>
          </div>
          <button className="settingsMenuCatalogClose" type="button" onClick={closeModal}>Cerrar</button>
        </div>

        <div className="settingsMenuCatalogBody">
          {notice && <div className="settingsMenuNotice">{notice}</div>}

          <div className="settingsMenuForm">
            <label className="settingsMenuField">
              <span>Catalogo</span>
              <select value={catalogKind} onChange={event => setCatalogKind(event.target.value)}>
                {CATALOG_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            {catalogKind === 'preparacion' && (
              <label className="settingsMenuField">
                <span>Proteina base</span>
                <select value={proteinDraft} onChange={event => setProteinDraft(event.target.value)}>
                  <option value="">Seleccione proteina</option>
                  {proteins.map(item => (
                    <option key={item.id} value={item.id}>{item.nombre}</option>
                  ))}
                </select>
              </label>
            )}

            <label className="settingsMenuField">
              <span>Nombre</span>
              <input value={nameDraft} onChange={event => setNameDraft(event.target.value)} placeholder="Escriba el nombre" />
            </label>

            {catalogKind === 'plato_fuerte' && (
              <label className="settingsMenuField">
                <span>Tipo de plato</span>
                <select value={dishTypeDraft} onChange={event => setDishTypeDraft(event.target.value)}>
                  <option value="NORMAL">Normal</option>
                  <option value="VEGETARIANO">Vegetariano</option>
                  <option value="SIN PROTEINA">Sin proteina</option>
                </select>
              </label>
            )}

            <div className="settingsMenuFormActions">
              <button className="settingsMenuBtn" type="button" onClick={clearForm}>Limpiar</button>
              <button className="settingsMenuBtn settingsMenuBtnPrimary" type="button" onClick={handleSaveItem} disabled={saving}>
                {editingItem ? 'Actualizar registro' : 'Guardar registro'}
              </button>
            </div>
          </div>

          <div className="settingsMenuTableCard">
            <div className="settingsMenuTableTitle">{selectedCatalogLabel}</div>
            <div className="settingsMenuTableWrap">
              <table>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Detalle</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={4}>Cargando catalogo...</td></tr>
                  ) : catalogItems.length ? catalogItems.map(item => (
                    <tr key={item.id}>
                      <td>{item.nombre || <span className="settingsMenuMuted">Sin nombre</span>}</td>
                      <td>{catalogDetail(item)}</td>
                      <td>
                        <span className={`settingsMenuStatus ${item.activo === false ? 'isInactive' : 'isActive'}`}>
                          {item.activo === false ? 'Inactivo' : 'Activo'}
                        </span>
                      </td>
                      <td>
                        <div className="settingsMenuRowActions">
                          <button className="settingsMenuBtn" type="button" onClick={() => handleEditItem(item)}>Editar</button>
                          <button className="settingsMenuBtn settingsMenuBtnDanger" type="button" onClick={() => handleToggleItem(item)}>
                            {item.activo === false ? 'Reactivar' : 'Inhabilitar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={4}>No hay registros en este catalogo.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="settingsMenuCatalogFooter">
          <button className="settingsMenuBtn" type="button" onClick={closeModal}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
