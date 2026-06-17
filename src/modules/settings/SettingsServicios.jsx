import { useEffect, useMemo, useState } from 'react';
import { loadState as loadCrmState, saveState as saveCrmState } from '../../services/stateService';
import { toast, modernConfirm } from '../../utils/toast';

const emptyService = { id: '', name: '', price: '', category: '', subcategory: '', quantityMode: 'MANUAL', description: '', active: true };
const emptyCategory = { id: '', name: '' };
const emptySubcategory = { id: '', name: '', categoryId: '' };

export default function SettingsServicios({ inline, onBack }) {
  const [activeSection, setActiveSection] = useState('servicios');
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);

  // Service modal state
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [serviceDraft, setServiceDraft] = useState(emptyService);

  // Category modal state
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState(emptyCategory);

  // Subcategory modal state
  const [showSubcategoryModal, setShowSubcategoryModal] = useState(false);
  const [subcategoryDraft, setSubcategoryDraft] = useState(emptySubcategory);
  const [subcategoryFilterCategory, setSubcategoryFilterCategory] = useState('');

  const loadData = async () => {
    try {
      const state = await loadCrmState();
      setServices(Array.isArray(state.services) ? state.services : []);
      setCategories(Array.isArray(state.serviceCategories) ? state.serviceCategories : []);
    } catch (err) {
      console.error('Error al cargar servicios:', err);
      toast('Error al cargar servicios');
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleClose = () => { if (onBack) onBack(); };

  // ── Helpers ──
  const computedCategories = useMemo(() => {
    const fromServices = [...new Set(services.map(s => String(s.category || 'General').trim()).filter(Boolean))];
    const fromManaged = categories.map(c => c.name);
    return [...new Set([...fromManaged, ...fromServices])].sort();
  }, [services, categories]);

  const subcategoriesForCategory = useMemo(() => {
    const catId = subcategoryFilterCategory;
    const cat = categories.find(c => String(c.id) === String(catId) || c.name === catId);
    const managed = cat ? (cat.subcategories || []) : [];
    const fromServices = services
      .filter(s => String(s.category || 'General') === (cat?.name || catId))
      .map(s => s.subcategory || '')
      .filter(Boolean);
    return [...new Set([...managed.map(s => s.name), ...fromServices])].sort();
  }, [categories, services, subcategoryFilterCategory]);

  const saveAll = async (nextServices, nextCategories) => {
    setSaving(true);
    try {
      const state = await loadCrmState();
      await saveCrmState({
        ...state,
        services: nextServices ?? services,
        serviceCategories: nextCategories ?? categories,
      });
      if (nextServices) setServices(nextServices);
      if (nextCategories) setCategories(nextCategories);
      toast('Guardado correctamente');
    } catch (err) {
      console.error(err);
      toast('Error al guardar');
    }
    setSaving(false);
  };

  // ── Service CRUD ──
  const openNewService = () => { setServiceDraft(emptyService); setShowServiceModal(true); };
  const openEditService = (svc) => {
    setServiceDraft({
      id: svc.id || '',
      name: svc.name || '',
      price: svc.price ?? '',
      category: svc.category || '',
      subcategory: svc.subcategory || '',
      quantityMode: svc.quantityMode || 'MANUAL',
      description: svc.description || '',
      active: svc.active !== false,
    });
    setShowServiceModal(true);
  };
  const handleSaveService = async () => {
    const name = serviceDraft.name.trim();
    if (!name) { toast('El nombre es obligatorio'); return; }
    const saved = {
      id: serviceDraft.id || `svc_${Date.now()}`,
      name,
      price: Number(serviceDraft.price) || 0,
      category: serviceDraft.category || 'General',
      subcategory: serviceDraft.subcategory || '',
      quantityMode: serviceDraft.quantityMode || 'MANUAL',
      description: serviceDraft.description || '',
      active: serviceDraft.active !== false,
    };
    const idx = services.findIndex(s => String(s.id) === String(saved.id));
    const next = [...services];
    if (idx >= 0) next[idx] = saved;
    else next.push(saved);
    await saveAll(next, null);
    setShowServiceModal(false);
    setServiceDraft(emptyService);
  };
  const handleDeleteService = async (svc) => {
    const ok = await modernConfirm('Eliminar servicio', `Eliminar "${svc.name}"?`);
    if (!ok) return;
    const next = services.filter(s => String(s.id) !== String(svc.id));
    await saveAll(next, null);
  };
  const toggleServiceActive = async (svc) => {
    const next = services.map(s => String(s.id) === String(svc.id) ? { ...s, active: s.active === false ? true : false } : s);
    await saveAll(next, null);
  };

  // ── Category CRUD ──
  const openNewCategory = () => { setCategoryDraft(emptyCategory); setShowCategoryModal(true); };
  const openEditCategory = (cat) => {
    setCategoryDraft({ id: cat.id, name: cat.name });
    setShowCategoryModal(true);
  };
  const handleSaveCategory = async () => {
    const name = categoryDraft.name.trim();
    if (!name) { toast('El nombre es obligatorio'); return; }
    const saved = { id: categoryDraft.id || `cat_${Date.now()}`, name, subcategories: [] };
    const idx = categories.findIndex(c => String(c.id) === String(saved.id));
    const next = [...categories];
    if (idx >= 0) next[idx] = saved;
    else next.push(saved);
    await saveAll(null, next);
    setShowCategoryModal(false);
    setCategoryDraft(emptyCategory);
  };
  const handleDeleteCategory = async (cat) => {
    const ok = await modernConfirm('Eliminar categoria', `Eliminar "${cat.name}"? Los servicios con esta categoria pasaran a "General".`);
    if (!ok) return;
    const nextCategories = categories.filter(c => String(c.id) !== String(cat.id));
    const nextServices = services.map(s => ({
      ...s,
      category: String(s.category || 'General') === cat.name ? 'General' : s.category,
      subcategory: String(s.category || 'General') === cat.name ? '' : s.subcategory,
    }));
    await saveAll(nextServices, nextCategories);
  };

  // ── Subcategory CRUD ──
  const openNewSubcategory = () => {
    const firstCat = categories[0];
    setSubcategoryDraft({ ...emptySubcategory, categoryId: firstCat?.id || '' });
    setShowSubcategoryModal(true);
  };
  const openEditSubcategory = (cat, sub) => {
    setSubcategoryDraft({ id: sub.id, name: sub.name, categoryId: cat.id });
    setShowSubcategoryModal(true);
  };
  const handleSaveSubcategory = async () => {
    const name = subcategoryDraft.name.trim();
    if (!name) { toast('El nombre es obligatorio'); return; }
    const catId = subcategoryDraft.categoryId;
    if (!catId) { toast('Seleccione una categoria'); return; }
    const saved = { id: subcategoryDraft.id || `sub_${Date.now()}`, name };
    const next = categories.map(c => {
      if (String(c.id) !== String(catId)) return c;
      const subs = Array.isArray(c.subcategories) ? [...c.subcategories] : [];
      const idx = subs.findIndex(s => String(s.id) === String(saved.id));
      if (idx >= 0) subs[idx] = saved;
      else subs.push(saved);
      return { ...c, subcategories: subs };
    });
    await saveAll(null, next);
    setShowSubcategoryModal(false);
    setSubcategoryDraft(emptySubcategory);
  };
  const handleDeleteSubcategory = async (cat, sub) => {
    const ok = await modernConfirm('Eliminar subcategoria', `Eliminar "${sub.name}"?`);
    if (!ok) return;
    const next = categories.map(c => {
      if (String(c.id) !== String(cat.id)) return c;
      return { ...c, subcategories: (c.subcategories || []).filter(s => String(s.id) !== String(sub.id)) };
    });
    await saveAll(null, next);
  };

  // ── Import / Export ──
  const exportCSV = () => {
    const headers = ['id', 'name', 'price', 'category', 'subcategory', 'quantityMode', 'description', 'active'];
    const rows = services.map(s => [
      s.id, `"${(s.name || '').replace(/"/g, '""')}"`, s.price,
      `"${(s.category || '').replace(/"/g, '""')}"`, `"${(s.subcategory || '').replace(/"/g, '""')}"`,
      s.quantityMode || 'MANUAL', `"${(s.description || '').replace(/"/g, '""')}"`, s.active !== false ? '1' : '0',
    ].join(','));
    const csv = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'servicios.csv'; a.click();
    URL.revokeObjectURL(url);
    toast('Exportacion completada');
  };
  const importCSV = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.csv';
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      const lines = text.split('\n').filter(Boolean);
      if (lines.length < 2) { toast('CSV vacio'); return; }
      const headerLine = lines[0].replace(/^\uFEFF/, '');
      const cols = headerLine.split(',').map(c => c.trim().toLowerCase());
      const imported = lines.slice(1).map(line => {
        const vals = [];
        let current = '', inQuote = false;
        for (const ch of line) {
          if (ch === '"') { inQuote = !inQuote; continue; }
          if (ch === ',' && !inQuote) { vals.push(current.trim()); current = ''; continue; }
          current += ch;
        }
        vals.push(current.trim());
        const obj = {};
        cols.forEach((col, i) => { obj[col] = vals[i] || ''; });
        return {
          id: obj.id || `svc_${Date.now()}_${Math.random().toString(36).slice(2,5)}`,
          name: obj.name || 'Sin nombre',
          price: Number(obj.price) || 0,
          category: obj.category || 'General',
          subcategory: obj.subcategory || '',
          quantityMode: obj.quantitymode || 'MANUAL',
          description: obj.description || '',
          active: obj.active !== '0' && obj.active !== 'false',
        };
      });
      if (imported.length === 0) { toast('No se encontraron datos validos'); return; }
      const ok = await modernConfirm('Importar servicios', `Se importaran ${imported.length} servicio(s). Continuar?`);
      if (!ok) return;
      const existingIds = new Set(services.map(s => s.id));
      const merged = [...services];
      for (const s of imported) {
        if (s.id && existingIds.has(s.id)) {
          const idx = merged.findIndex(x => String(x.id) === String(s.id));
          if (idx >= 0) merged[idx] = s;
        } else {
          merged.push(s);
        }
      }
      await saveAll(merged, null);
    };
    input.click();
  };

  // ── Styling shortcuts ──
  const s = (sel) => ({
    padding: '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px',
    background: '#fff', color: '#1e293b', outline: 'none', width: sel === 'full' ? '100%' : undefined,
    boxSizing: 'border-box',
  });
  const btn = (variant) => ({
    padding: '5px 12px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', border: 'none',
    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px',
    background: variant === 'danger' ? '#ef4444' : variant === 'primary' ? '#2563eb' : variant === 'success' ? '#16a34a' : '#f1f5f9',
    color: variant === 'danger' || variant === 'primary' || variant === 'success' ? '#fff' : '#1e293b',
  });

  return (
    <div style={{ padding: inline ? '0' : '16px 28px 28px', overflowY: 'auto', height: '100%' }}>
      {!inline && (
        <div className="reports-page-header" style={{ flexShrink: 0 }}>
          <div className="reports-brand-header">
            <div className="reports-brand-badge">
              <img src="/Oficial_JDL_acua.png" alt="" className="reports-brand-logo" />
            </div>
            <div>
              <div className="reports-eyebrow">CRM Reservas | Jardines del Lago</div>
              <div className="reports-title">Panel de Configuración</div>
              <div className="reports-subtitle">Catálogo de servicios, categorías y subcategorías</div>
            </div>
          </div>
          <button className="btn-exit" type="button" onClick={handleClose}>
            <svg viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 4 7 9l6 5" /></svg>
            Volver
          </button>
        </div>
      )}

      <div style={{ marginBottom: '16px', display: 'flex', gap: '6px', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px' }}>
        {[
          { id: 'servicios', label: 'Servicios', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' },
          { id: 'categorias', label: 'Categorías', icon: 'M4 6h16M4 12h16M4 18h16' },
          { id: 'subcategorias', label: 'Subcategorías', icon: 'M12 6v12M6 12h12' },
        ].map(t => (
          <button key={t.id} type="button" onClick={() => setActiveSection(t.id)}
            style={{
              padding: '7px 14px', fontSize: '11px', fontWeight: 800, borderRadius: '8px',
              border: 'none', cursor: 'pointer',
              background: activeSection === t.id ? '#0f172a' : '#f1f5f9',
              color: activeSection === t.id ? '#fff' : '#475569',
              transition: 'all 0.12s', display: 'flex', alignItems: 'center', gap: '5px',
            }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={t.icon} /></svg>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── SECTION: Servicios ── */}
      {activeSection === 'servicios' && (
        <div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
            <button type="button" onClick={openNewService} style={{ ...btn('primary'), padding: '7px 16px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
              Nuevo servicio
            </button>
            <button type="button" onClick={exportCSV} style={btn('default')}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Exportar CSV
            </button>
            <button type="button" onClick={importCSV} style={btn('default')}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              Importar CSV
            </button>
          </div>

          <div style={{ borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden', background: '#fff' }}>
            {services.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                No hay servicios registrados. Crea el primer servicio.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Nombre', 'Precio', 'Categoría', 'Subcategoría', 'Modo', 'Estado', ''].map(h => (
                      <th key={h} style={{ padding: '8px 10px', fontWeight: 800, color: '#64748b', borderBottom: '2px solid #e2e8f0', fontSize: '10px', textTransform: 'uppercase', textAlign: h === 'Precio' ? 'right' : 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {services.map((svc, i) => (
                    <tr key={svc.id || i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '7px 10px', fontWeight: 700, color: '#0f172a' }}>{svc.name}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700 }}>Q {Number(svc.price || 0).toFixed(2)}</td>
                      <td style={{ padding: '7px 10px', color: '#475569' }}>{svc.category || 'General'}</td>
                      <td style={{ padding: '7px 10px', color: '#475569' }}>{svc.subcategory || '-'}</td>
                      <td style={{ padding: '7px 10px', color: '#64748b', fontSize: '10px' }}>{svc.quantityMode || 'MANUAL'}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'center', verticalAlign: 'middle' }}>
                        <label style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '18px', cursor: 'pointer', verticalAlign: 'middle' }}>
                          <input type="checkbox" checked={svc.active !== false} onChange={() => toggleServiceActive(svc)} style={{ opacity: 0, width: 0, height: 0, margin: 0 }} />
                          <span style={{ position: 'absolute', cursor: 'pointer', inset: 0, background: svc.active !== false ? '#0d9488' : '#cbd5e1', borderRadius: '999px', transition: '0.25s' }}>
                            <span style={{ position: 'absolute', height: '12px', width: '12px', left: svc.active !== false ? '19px' : '3px', bottom: '3px', background: 'white', borderRadius: '50%', transition: '0.25s' }} />
                          </span>
                        </label>
                      </td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button type="button" onClick={() => openEditService(svc)} style={{ background: '#2563eb', border: 'none', cursor: 'pointer', padding: '5px 12px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#fff', marginRight: '4px' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#1d4ed8'} onMouseLeave={e => e.currentTarget.style.background = '#2563eb'}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button type="button" onClick={() => handleDeleteService(svc)} style={btn('danger')}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── SECTION: Categorías ── */}
      {activeSection === 'categorias' && (
        <div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
            <button type="button" onClick={openNewCategory} style={{ ...btn('primary'), padding: '7px 16px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
              Nueva categoría
            </button>
          </div>
          <div style={{ borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden', background: '#fff' }}>
            {categories.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>No hay categorías registradas.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ padding: '8px 10px', fontWeight: 800, color: '#64748b', borderBottom: '2px solid #e2e8f0', fontSize: '10px', textTransform: 'uppercase' }}>Nombre</th>
                    <th style={{ padding: '8px 10px', fontWeight: 800, color: '#64748b', borderBottom: '2px solid #e2e8f0', fontSize: '10px', textTransform: 'uppercase' }}>Subcategorías</th>
                    <th style={{ padding: '8px 10px', fontWeight: 800, color: '#64748b', borderBottom: '2px solid #e2e8f0', fontSize: '10px', textTransform: 'uppercase' }}>Servicios</th>
                    <th style={{ padding: '8px 10px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((cat, i) => {
                    const subs = cat.subcategories || [];
                    const svcCount = services.filter(s => String(s.category || 'General') === cat.name).length;
                    return (
                      <tr key={cat.id || i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '7px 10px', fontWeight: 700, color: '#0f172a' }}>{cat.name}</td>
                        <td style={{ padding: '7px 10px', color: '#64748b' }}>{subs.length} subcategoría(s)</td>
                        <td style={{ padding: '7px 10px', color: '#64748b' }}>{svcCount} servicio(s)</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button type="button" onClick={() => openEditCategory(cat)} style={{ background: '#2563eb', border: 'none', cursor: 'pointer', padding: '5px 12px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#fff', marginRight: '4px' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#1d4ed8'} onMouseLeave={e => e.currentTarget.style.background = '#2563eb'}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          <button type="button" onClick={() => handleDeleteCategory(cat)} style={btn('danger')}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── SECTION: Subcategorías ── */}
      {activeSection === 'subcategorias' && (
        <div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" onClick={openNewSubcategory} style={{ ...btn('primary'), padding: '7px 16px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
              Nueva subcategoría
            </button>
            <select value={subcategoryFilterCategory} onChange={e => setSubcategoryFilterCategory(e.target.value)} style={{ ...s(''), minWidth: '180px' }}>
              <option value="">Todas las categorías</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div style={{ borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden', background: '#fff' }}>
            {(() => {
              const catFilter = subcategoryFilterCategory;
              const catList = catFilter ? categories.filter(c => String(c.id) === String(catFilter)) : categories;
              const rows = catList.flatMap(cat =>
                (cat.subcategories || []).map(sub => ({ cat, sub }))
              );
              if (rows.length === 0) return <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>No hay subcategorías registradas.</div>;
              return (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      <th style={{ padding: '8px 10px', fontWeight: 800, color: '#64748b', borderBottom: '2px solid #e2e8f0', fontSize: '10px', textTransform: 'uppercase' }}>Nombre</th>
                      <th style={{ padding: '8px 10px', fontWeight: 800, color: '#64748b', borderBottom: '2px solid #e2e8f0', fontSize: '10px', textTransform: 'uppercase' }}>Categoría</th>
                      <th style={{ padding: '8px 10px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(({ cat, sub }, i) => (
                      <tr key={sub.id || i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '7px 10px', fontWeight: 700, color: '#0f172a' }}>{sub.name}</td>
                        <td style={{ padding: '7px 10px', color: '#64748b' }}>{cat.name}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button type="button" onClick={() => openEditSubcategory(cat, sub)} style={{ background: '#2563eb', border: 'none', cursor: 'pointer', padding: '5px 12px', fontSize: '11px', fontWeight: 700, borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#fff', marginRight: '4px' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#1d4ed8'} onMouseLeave={e => e.currentTarget.style.background = '#2563eb'}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          <button type="button" onClick={() => handleDeleteSubcategory(cat, sub)} style={btn('danger')}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })()}
          </div>
        </div>
      )}

      {/* ── MODAL: Service ── */}
      {showServiceModal && (
        <div onClick={() => setShowServiceModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '14px', maxWidth: '500px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', padding: '24px' }}>
            <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              {serviceDraft.id ? 'Editar servicio' : 'Nuevo servicio'}
            </div>
            <div style={{ display: 'grid', gap: '10px' }}>
              <label style={{ fontSize: '10px', fontWeight: 700, color: '#475569' }}>Nombre <span style={{ color: '#dc2626' }}>*</span>
                <input value={serviceDraft.name} onChange={e => setServiceDraft(p => ({ ...p, name: e.target.value }))} placeholder="Ej: Salón principal" style={{ ...s('full'), marginTop: '3px' }} />
              </label>
              <label style={{ fontSize: '10px', fontWeight: 700, color: '#475569' }}>Precio base (Q)
                <input type="number" step="0.01" min="0" value={serviceDraft.price} onChange={e => setServiceDraft(p => ({ ...p, price: e.target.value }))} placeholder="0.00" style={{ ...s('full'), marginTop: '3px' }} />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <label style={{ fontSize: '10px', fontWeight: 700, color: '#475569' }}>Categoría
                  <input value={serviceDraft.category} onChange={e => setServiceDraft(p => ({ ...p, category: e.target.value }))} placeholder="General" list="svc-cat-list" style={{ ...s('full'), marginTop: '3px' }} />
                  <datalist id="svc-cat-list">{computedCategories.map(c => <option key={c} value={c} />)}</datalist>
                </label>
                <label style={{ fontSize: '10px', fontWeight: 700, color: '#475569' }}>Subcategoría
                  <input value={serviceDraft.subcategory} onChange={e => setServiceDraft(p => ({ ...p, subcategory: e.target.value }))} placeholder="Opcional" list="svc-sub-list" style={{ ...s('full'), marginTop: '3px' }} />
                  <datalist id="svc-sub-list">
                    {(() => {
                      const cat = categories.find(c => c.name === serviceDraft.category);
                      const subs = cat ? (cat.subcategories || []).map(s => s.name) : [];
                      const fromSvcs = [...new Set(services.filter(s => s.category === serviceDraft.category).map(s => s.subcategory).filter(Boolean))];
                      return [...new Set([...subs, ...fromSvcs])].map(c => <option key={c} value={c} />);
                    })()}
                  </datalist>
                </label>
              </div>
              <label style={{ fontSize: '10px', fontWeight: 700, color: '#475569' }}>Modo de cantidad
                <select value={serviceDraft.quantityMode} onChange={e => setServiceDraft(p => ({ ...p, quantityMode: e.target.value }))} style={{ ...s('full'), marginTop: '3px' }}>
                  <option value="MANUAL">Manual (cantidad fija)</option>
                  <option value="PAX">Por persona (PAX)</option>
                </select>
              </label>
              <label style={{ fontSize: '10px', fontWeight: 700, color: '#475569' }}>Descripción
                <textarea value={serviceDraft.description} onChange={e => setServiceDraft(p => ({ ...p, description: e.target.value }))} rows={2} placeholder="Descripción opcional" style={{ ...s('full'), marginTop: '3px', resize: 'vertical' }} />
              </label>
              <label style={{ fontSize: '10px', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '8px 12px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '20px', flexShrink: 0 }}>
                  <input type="checkbox" checked={serviceDraft.active !== false} onChange={e => setServiceDraft(p => ({ ...p, active: e.target.checked }))} style={{ opacity: 0, width: 0, height: 0, margin: 0 }} />
                  <span style={{ position: 'absolute', cursor: 'pointer', inset: 0, background: serviceDraft.active !== false ? '#0d9488' : '#cbd5e1', borderRadius: '999px', transition: '0.25s' }}>
                    <span style={{ position: 'absolute', height: '14px', width: '14px', left: serviceDraft.active !== false ? '21px' : '3px', bottom: '3px', background: 'white', borderRadius: '50%', transition: '0.25s', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }} />
                  </span>
                </span>
                Servicio activo
              </label>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '18px' }}>
              <button type="button" onClick={() => setShowServiceModal(false)} style={btn('default')}>Cancelar</button>
              <button type="button" onClick={handleSaveService} disabled={saving} style={{ ...btn('primary'), opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Guardando...' : (serviceDraft.id ? 'Guardar cambios' : 'Crear servicio')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Category ── */}
      {showCategoryModal && (
        <div onClick={() => setShowCategoryModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '14px', maxWidth: '400px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', padding: '24px' }}>
            <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', marginBottom: '16px' }}>
              {categoryDraft.id ? 'Editar categoría' : 'Nueva categoría'}
            </div>
            <label style={{ fontSize: '10px', fontWeight: 700, color: '#475569', display: 'block' }}>Nombre <span style={{ color: '#dc2626' }}>*</span>
              <input value={categoryDraft.name} onChange={e => setCategoryDraft(p => ({ ...p, name: e.target.value }))} placeholder="Ej: Salones" style={{ ...s('full'), marginTop: '3px' }} />
            </label>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '18px' }}>
              <button type="button" onClick={() => setShowCategoryModal(false)} style={btn('default')}>Cancelar</button>
              <button type="button" onClick={handleSaveCategory} disabled={saving} style={{ ...btn('primary'), opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Guardando...' : (categoryDraft.id ? 'Guardar cambios' : 'Crear categoría')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Subcategory ── */}
      {showSubcategoryModal && (
        <div onClick={() => setShowSubcategoryModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '14px', maxWidth: '400px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', padding: '24px' }}>
            <div style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', marginBottom: '16px' }}>
              {subcategoryDraft.id ? 'Editar subcategoría' : 'Nueva subcategoría'}
            </div>
            <div style={{ display: 'grid', gap: '10px' }}>
              <label style={{ fontSize: '10px', fontWeight: 700, color: '#475569', display: 'block' }}>Categoría
                <select value={subcategoryDraft.categoryId} onChange={e => setSubcategoryDraft(p => ({ ...p, categoryId: e.target.value }))} style={{ ...s('full'), marginTop: '3px' }}>
                  <option value="">Seleccione...</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label style={{ fontSize: '10px', fontWeight: 700, color: '#475569', display: 'block' }}>Nombre <span style={{ color: '#dc2626' }}>*</span>
                <input value={subcategoryDraft.name} onChange={e => setSubcategoryDraft(p => ({ ...p, name: e.target.value }))} placeholder="Ej: Salon A" style={{ ...s('full'), marginTop: '3px' }} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '18px' }}>
              <button type="button" onClick={() => setShowSubcategoryModal(false)} style={btn('default')}>Cancelar</button>
              <button type="button" onClick={handleSaveSubcategory} disabled={saving} style={{ ...btn('primary'), opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Guardando...' : (subcategoryDraft.id ? 'Guardar cambios' : 'Crear subcategoría')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}