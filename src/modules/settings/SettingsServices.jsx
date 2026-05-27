import React, { useState, useEffect, useRef } from 'react';
import { toast, modernConfirm } from '../../utils/toast';

const handleClose = (modalId) => {
  const modal = document.getElementById(modalId);
  if (modal) modal.hidden = true;
};

const generateGoalMonths = () => {
  const months = new Set();
  const now = new Date();
  const base = new Date(now.getFullYear() - 2, 0, 1);
  for (let i = 0; i < 96; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.add(key);
  }
  return Array.from(months).sort();
};

const formatMonthLabel = (monthKey) => {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) return monthKey;
  const [year, month] = monthKey.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
  return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
};

export default function SettingsServices() {
  const serviceBackdropRef = useRef(null);
  const categoryBackdropRef = useRef(null);
  const subcategoryBackdropRef = useRef(null);
  const goalsBackdropRef = useRef(null);

  // Visibility states
  const [isServiceOpen, setIsServiceOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isSubcategoryOpen, setIsSubcategoryOpen] = useState(false);
  const [isGoalsOpen, setIsGoalsOpen] = useState(false);

  // Data lists
  const [services, setServices] = useState([]);
  const [disabledServices, setDisabledServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [globalGoals, setGlobalGoals] = useState([]);

  // Service Form State
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [servicePrice, setServicePrice] = useState('');
  const [serviceCategoryId, setServiceCategoryId] = useState('');
  const [serviceSubcategoryId, setServiceSubcategoryId] = useState('');
  const [serviceQuantityMode, setServiceQuantityMode] = useState('MANUAL');
  const [serviceDescription, setServiceDescription] = useState('');
  const [serviceActive, setServiceActive] = useState(true);
  const [savingService, setSavingService] = useState(false);

  // Category Form State
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);

  // Subcategory Form State
  const [subcategoryCategorySelect, setSubcategoryCategorySelect] = useState('');
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState('');
  const [subcategoryName, setSubcategoryName] = useState('');
  const [savingSubcategory, setSavingSubcategory] = useState(false);

  // Global Goals Form State
  const [selectedGoalKey, setSelectedGoalKey] = useState('');
  const [goalMonth, setGoalMonth] = useState('');
  const [goalRole, setGoalRole] = useState('vendedor');
  const [goalAmount, setGoalAmount] = useState('');
  const [goalActive, setGoalActive] = useState(true);
  const [savingGoal, setSavingGoal] = useState(false);

  // MutationObservers to sync with DOM hidden attribute changes
  useEffect(() => {
    const setupObserver = (ref, setIsOpen) => {
      if (!ref.current) return;
      const observer = new MutationObserver(() => {
        setIsOpen(!ref.current.hidden);
      });
      observer.observe(ref.current, { attributes: true, attributeFilter: ['hidden'] });
      setIsOpen(!ref.current.hidden);
      return () => observer.disconnect();
    };

    const cleanup1 = setupObserver(serviceBackdropRef, setIsServiceOpen);
    const cleanup2 = setupObserver(categoryBackdropRef, setIsCategoryOpen);
    const cleanup3 = setupObserver(subcategoryBackdropRef, setIsSubcategoryOpen);
    const cleanup4 = setupObserver(goalsBackdropRef, setIsGoalsOpen);

    return () => {
      if (cleanup1) cleanup1();
      if (cleanup2) cleanup2();
      if (cleanup3) cleanup3();
      if (cleanup4) cleanup4();
    };
  }, []);

  // Fetch functions
  const loadServices = async () => {
    try {
      const [stateRes, catRes, subcatRes] = await Promise.all([
        fetch('/api/state'),
        fetch('/api/categorias-servicio'),
        fetch('/api/subcategorias-servicio')
      ]);
      const stateData = await stateRes.json();
      const catData = await catRes.json();
      const subcatData = await subcatRes.json();

      const loadedState = stateData?.state || stateData || {};
      setServices(Array.isArray(loadedState.services) ? loadedState.services : []);
      setDisabledServices(Array.isArray(loadedState.disabledServices) ? loadedState.disabledServices : []);
      setCategories(Array.isArray(catData?.categorias) ? catData.categorias : []);
      setSubcategories(Array.isArray(subcatData?.subcategorias) ? subcatData.subcategorias : []);
    } catch (err) {
      console.error(err);
      toast("Error al cargar servicios");
    }
  };

  const loadCategories = async () => {
    try {
      const res = await fetch('/api/categorias-servicio');
      const data = await res.json();
      setCategories(Array.isArray(data?.categorias) ? data.categorias : []);
    } catch (err) {
      console.error(err);
      toast("Error al cargar categorias");
    }
  };

  const loadSubcategories = async () => {
    try {
      const [catRes, subcatRes] = await Promise.all([
        fetch('/api/categorias-servicio'),
        fetch('/api/subcategorias-servicio')
      ]);
      const catData = await catRes.json();
      const subcatData = await subcatRes.json();
      setCategories(Array.isArray(catData?.categorias) ? catData.categorias : []);
      setSubcategories(Array.isArray(subcatData?.subcategorias) ? subcatData.subcategorias : []);
    } catch (err) {
      console.error(err);
      toast("Error al cargar subcategorias");
    }
  };

  const loadGoals = async () => {
    try {
      const res = await fetch('/api/state');
      const data = await res.json();
      const loadedState = data?.state || data || {};
      setGlobalGoals(Array.isArray(loadedState.globalMonthlyGoals) ? loadedState.globalMonthlyGoals : []);
    } catch (err) {
      console.error(err);
      toast("Error al cargar metas");
    }
  };

  // Triggers on open
  useEffect(() => { if (isServiceOpen) { loadServices(); resetServiceForm(); } }, [isServiceOpen]);
  useEffect(() => { if (isCategoryOpen) { loadCategories(); resetCategoryForm(); } }, [isCategoryOpen]);
  useEffect(() => { if (isSubcategoryOpen) { loadSubcategories(); resetSubcategoryForm(); } }, [isSubcategoryOpen]);
  useEffect(() => { if (isGoalsOpen) { loadGoals(); resetGoalForm(); } }, [isGoalsOpen]);

  // Subcategory filter on Category Selection
  const filteredSubcategoriesForService = categories.some(c => String(c.id) === String(serviceCategoryId))
    ? subcategories.filter(sc => String(sc.id_categoria) === String(serviceCategoryId))
    : [];

  useEffect(() => {
    if (serviceCategoryId) {
      const valid = subcategories.some(sc => String(sc.id_categoria) === String(serviceCategoryId) && String(sc.id) === String(serviceSubcategoryId));
      if (!valid) {
        setServiceSubcategoryId('');
      }
    } else {
      setServiceSubcategoryId('');
    }
  }, [serviceCategoryId, subcategories]);

  // Form Resets
  const resetServiceForm = () => {
    setSelectedServiceId('');
    setServiceName('');
    setServicePrice('');
    setServiceCategoryId('');
    setServiceSubcategoryId('');
    setServiceQuantityMode('MANUAL');
    setServiceDescription('');
    setServiceActive(true);
  };

  const resetCategoryForm = () => {
    setSelectedCategoryId('');
    setCategoryName('');
  };

  const resetSubcategoryForm = () => {
    setSelectedSubcategoryId('');
    setSubcategoryName('');
  };

  const resetGoalForm = () => {
    setSelectedGoalKey('');
    setGoalMonth('');
    setGoalRole('vendedor');
    setGoalAmount('');
    setGoalActive(true);
  };

  // Form selections load data
  const handleServiceSelectChange = (e) => {
    const id = e.target.value;
    setSelectedServiceId(id);
    if (id) {
      const s = services.find(x => x.id === id);
      if (s) {
        setServiceName(s.name || '');
        setServicePrice(s.price || '');
        setServiceCategoryId(s.categoryId || '');
        setServiceSubcategoryId(s.subcategoryId || '');
        setServiceQuantityMode(s.quantityMode || 'MANUAL');
        setServiceDescription(s.description || '');
        setServiceActive(!disabledServices.includes(id));
      }
    } else {
      resetServiceForm();
    }
  };

  const loadServiceForEdit = (s) => {
    setSelectedServiceId(s.id);
    setServiceName(s.name || '');
    setServicePrice(s.price || '');
    setServiceCategoryId(s.categoryId || '');
    setServiceSubcategoryId(s.subcategoryId || '');
    setServiceQuantityMode(s.quantityMode || 'MANUAL');
    setServiceDescription(s.description || '');
    setServiceActive(!disabledServices.includes(s.id));
  };

  const handleCategorySelectChange = (e) => {
    const id = e.target.value;
    setSelectedCategoryId(id);
    if (id) {
      const c = categories.find(x => String(x.id) === String(id));
      if (c) {
        setCategoryName(c.nombre || '');
      }
    } else {
      resetCategoryForm();
    }
  };

  const loadCategoryForEdit = (c) => {
    setSelectedCategoryId(String(c.id));
    setCategoryName(c.nombre || '');
  };

  const handleSubcategorySelectChange = (e) => {
    const id = e.target.value;
    setSelectedSubcategoryId(id);
    if (id) {
      const sc = subcategories.find(x => String(x.id) === String(id));
      if (sc) {
        setSubcategoryName(sc.nombre || '');
      }
    } else {
      resetSubcategoryForm();
    }
  };

  const loadSubcategoryForEdit = (sc) => {
    setSelectedSubcategoryId(String(sc.id));
    setSubcategoryName(sc.nombre || '');
    setSubcategoryCategorySelect(String(sc.id_categoria));
  };

  const handleGoalSelectChange = (e) => {
    const key = e.target.value;
    setSelectedGoalKey(key);
    if (key) {
      const [m, r] = key.split('|');
      const g = globalGoals.find(x => x.month === m && x.role === r);
      if (g) {
        setGoalMonth(g.month || '');
        setGoalRole(g.role || 'vendedor');
        setGoalAmount(g.amount || '');
        setGoalActive(g.active !== false);
      }
    } else {
      resetGoalForm();
    }
  };

  const loadGoalForEdit = (g) => {
    setSelectedGoalKey(`${g.month}|${g.role}`);
    setGoalMonth(g.month || '');
    setGoalRole(g.role || 'vendedor');
    setGoalAmount(g.amount || '');
    setGoalActive(g.active !== false);
  };

  // CRUD Actions
  const handleServiceSubmit = async (e) => {
    e.preventDefault();
    const nameTrim = serviceName.trim();
    if (!nameTrim) {
      toast("Nombre del servicio es obligatorio");
      return;
    }
    const priceNum = parseFloat(servicePrice);
    if (isNaN(priceNum) || priceNum < 0) {
      toast("Precio base debe ser un número mayor o igual a 0");
      return;
    }
    if (!serviceCategoryId) {
      toast("Debe seleccionar una categoría");
      return;
    }
    if (!serviceSubcategoryId) {
      toast("Debe seleccionar una subcategoría");
      return;
    }

    const isNew = !selectedServiceId;
    const newId = isNew ? `srv_${Date.now()}` : selectedServiceId;

    setSavingService(true);
    try {
      const categoryName = categories.find(c => String(c.id) === String(serviceCategoryId))?.nombre || '';
      const subcategoryName = subcategories.find(sc => String(sc.id) === String(serviceSubcategoryId))?.nombre || '';

      const newServiceObj = {
        id: newId,
        name: nameTrim,
        price: priceNum,
        categoryId: Number(serviceCategoryId),
        subcategoryId: Number(serviceSubcategoryId),
        category: categoryName,
        subcategory: subcategoryName,
        quantityMode: serviceQuantityMode,
        description: serviceDescription.trim()
      };

      let updatedServices = [...services];
      if (isNew) {
        updatedServices.push(newServiceObj);
      } else {
        updatedServices = updatedServices.map(s => s.id === selectedServiceId ? newServiceObj : s);
      }

      let updatedDisabled = [...disabledServices];
      if (serviceActive) {
        updatedDisabled = updatedDisabled.filter(id => id !== newId);
      } else {
        if (!updatedDisabled.includes(newId)) {
          updatedDisabled.push(newId);
        }
      }

      const stateRes = await fetch('/api/state');
      const stateData = await stateRes.json();
      const currentState = stateData.state || {};

      await fetch('/api/state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: {
            ...currentState,
            services: updatedServices,
            disabledServices: updatedDisabled
          }
        })
      });

      setServices(updatedServices);
      setDisabledServices(updatedDisabled);
      toast(isNew ? "Servicio agregado" : "Servicio actualizado");
      resetServiceForm();
    } catch (err) {
      console.error(err);
      toast("Error al guardar servicio");
    } finally {
      setSavingService(false);
    }
  };

  const handleToggleServiceActive = async (service) => {
    const isCurrentlyActive = !disabledServices.includes(service.id);
    const confirmText = isCurrentlyActive ? 'inhabilitar' : 'reactivar';

    const isConfirmed = await modernConfirm({
      title: `${isCurrentlyActive ? 'Inhabilitar' : 'Reactivar'} Servicio`,
      message: `¿Desea ${confirmText} el servicio "${service.name}"?`,
      confirmText: isCurrentlyActive ? 'Inhabilitar' : 'Reactivar',
      cancelText: 'Cancelar'
    });

    if (!isConfirmed) return;

    try {
      let nextDisabled = [...disabledServices];
      if (isCurrentlyActive) {
        nextDisabled.push(service.id);
      } else {
        nextDisabled = nextDisabled.filter(id => id !== service.id);
      }

      const stateRes = await fetch('/api/state');
      const stateData = await stateRes.json();
      const currentState = stateData.state || {};

      await fetch('/api/state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: {
            ...currentState,
            disabledServices: nextDisabled
          }
        })
      });

      setDisabledServices(nextDisabled);
      toast(isCurrentlyActive ? 'Servicio inhabilitado' : 'Servicio reactivado');

      if (selectedServiceId === service.id) {
        setServiceActive(!isCurrentlyActive);
      }
    } catch (err) {
      console.error(err);
      toast('Error al cambiar estado del servicio');
    }
  };

  const handleDisableServiceBtn = () => {
    if (selectedServiceId) {
      const s = services.find(x => x.id === selectedServiceId);
      if (s) handleToggleServiceActive(s);
    }
  };

  // Category Actions
  const handleCategorySave = async () => {
    const nameTrim = categoryName.trim();
    if (!nameTrim) {
      toast("Nombre de la categoría es obligatorio");
      return;
    }

    setSavingCategory(true);
    try {
      const isNew = !selectedCategoryId;
      let res;
      if (isNew) {
        res = await fetch('/api/categorias-servicio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre: nameTrim })
        });
      } else {
        res = await fetch(`/api/categorias-servicio/${selectedCategoryId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre: nameTrim })
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Error guardando categoría");
      }

      toast(isNew ? "Categoría agregada" : "Categoría actualizada");
      await loadCategories();
      await loadServices();
      resetCategoryForm();
    } catch (err) {
      console.error(err);
      toast(err.message || "Error al guardar categoría");
    } finally {
      setSavingCategory(false);
    }
  };

  const handleToggleCategoryActive = async (category) => {
    const isCurrentlyActive = category.activo;
    const confirmText = isCurrentlyActive ? 'inhabilitar' : 'reactivar';

    const isConfirmed = await modernConfirm({
      title: `${isCurrentlyActive ? 'Inhabilitar' : 'Reactivar'} Categoría`,
      message: `¿Desea ${confirmText} la categoría "${category.nombre}"? Esto también afectará a la visibilidad de sus servicios.`,
      confirmText: isCurrentlyActive ? 'Inhabilitar' : 'Reactivar',
      cancelText: 'Cancelar'
    });

    if (!isConfirmed) return;

    try {
      const res = await fetch(`/api/categorias-servicio/${category.id}/activo`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !isCurrentlyActive })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Error al actualizar estado");
      }

      toast(isCurrentlyActive ? 'Categoría inhabilitada' : 'Categoría reactivada');
      await loadCategories();
      await loadServices();

      if (selectedCategoryId === String(category.id)) {
        resetCategoryForm();
      }
    } catch (err) {
      console.error(err);
      toast(err.message || 'Error al cambiar estado de la categoría');
    }
  };

  // Subcategory Actions
  const handleSubcategorySave = async () => {
    const nameTrim = subcategoryName.trim();
    if (!subcategoryCategorySelect) {
      toast("Debe seleccionar una categoría para asociar la subcategoría");
      return;
    }
    if (!nameTrim) {
      toast("Nombre de la subcategoría es obligatorio");
      return;
    }

    setSavingSubcategory(true);
    try {
      const isNew = !selectedSubcategoryId;
      let res;
      if (isNew) {
        res = await fetch('/api/subcategorias-servicio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_categoria: Number(subcategoryCategorySelect), nombre: nameTrim })
        });
      } else {
        res = await fetch(`/api/subcategorias-servicio/${selectedSubcategoryId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id_categoria: Number(subcategoryCategorySelect), nombre: nameTrim })
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Error guardando subcategoría");
      }

      toast(isNew ? "Subcategoría agregada" : "Subcategoría actualizada");
      await loadSubcategories();
      await loadServices();
      resetSubcategoryForm();
    } catch (err) {
      console.error(err);
      toast(err.message || "Error al guardar subcategoría");
    } finally {
      setSavingSubcategory(false);
    }
  };

  const handleToggleSubcategoryActive = async (subcat) => {
    const isCurrentlyActive = subcat.activo;
    const confirmText = isCurrentlyActive ? 'inhabilitar' : 'reactivar';

    const isConfirmed = await modernConfirm({
      title: `${isCurrentlyActive ? 'Inhabilitar' : 'Reactivar'} Subcategoría`,
      message: `¿Desea ${confirmText} la subcategoría "${subcat.nombre}"?`,
      confirmText: isCurrentlyActive ? 'Inhabilitar' : 'Reactivar',
      cancelText: 'Cancelar'
    });

    if (!isConfirmed) return;

    try {
      const res = await fetch(`/api/subcategorias-servicio/${subcat.id}/activo`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activo: !isCurrentlyActive })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Error al actualizar estado");
      }

      toast(isCurrentlyActive ? 'Subcategoría inhabilitada' : 'Subcategoría reactivada');
      await loadSubcategories();
      await loadServices();

      if (selectedSubcategoryId === String(subcat.id)) {
        resetSubcategoryForm();
      }
    } catch (err) {
      console.error(err);
      toast(err.message || 'Error al cambiar estado de la subcategoría');
    }
  };

  // Global Goal Actions
  const handleGoalSave = async () => {
    if (!goalMonth) {
      toast("Debe seleccionar un mes");
      return;
    }
    const amountNum = parseFloat(goalAmount);
    if (isNaN(amountNum) || amountNum < 0) {
      toast("Monto meta debe ser mayor o igual a 0");
      return;
    }

    setSavingGoal(true);
    try {
      const isNew = !selectedGoalKey;

      if (isNew) {
        const exists = globalGoals.some(g => g.month === goalMonth && g.role === goalRole);
        if (exists) {
          toast(`Ya existe una meta para el mes ${goalMonth} y el rol ${goalRole}`);
          setSavingGoal(false);
          return;
        }
      }

      const newGoalObj = {
        month: goalMonth,
        role: goalRole,
        amount: amountNum,
        active: goalActive
      };

      let updatedGoals = [...globalGoals];
      if (isNew) {
        updatedGoals.push(newGoalObj);
      } else {
        updatedGoals = updatedGoals.map(g => (g.month === goalMonth && g.role === goalRole) ? newGoalObj : g);
      }

      const stateRes = await fetch('/api/state');
      const stateData = await stateRes.json();
      const currentState = stateData.state || {};

      await fetch('/api/state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: {
            ...currentState,
            globalMonthlyGoals: updatedGoals
          }
        })
      });

      setGlobalGoals(updatedGoals);
      toast(isNew ? "Meta mensual agregada" : "Meta mensual actualizada");
      resetGoalForm();
    } catch (err) {
      console.error(err);
      toast("Error al guardar meta global");
    } finally {
      setSavingGoal(false);
    }
  };

  const handleToggleGoalActive = async (goal) => {
    const isCurrentlyActive = goal.active;
    const confirmText = isCurrentlyActive ? 'inhabilitar' : 'reactivar';

    const isConfirmed = await modernConfirm({
      title: `${isCurrentlyActive ? 'Inhabilitar' : 'Reactivar'} Meta mensual`,
      message: `¿Desea ${confirmText} la meta de ${formatMonthLabel(goal.month)} para el rol ${goal.role}?`,
      confirmText: isCurrentlyActive ? 'Inhabilitar' : 'Reactivar',
      cancelText: 'Cancelar'
    });

    if (!isConfirmed) return;

    try {
      const updatedGoals = globalGoals.map(g => (g.month === goal.month && g.role === goal.role) ? { ...g, active: !isCurrentlyActive } : g);

      const stateRes = await fetch('/api/state');
      const stateData = await stateRes.json();
      const currentState = stateData.state || {};

      await fetch('/api/state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: {
            ...currentState,
            globalMonthlyGoals: updatedGoals
          }
        })
      });

      setGlobalGoals(updatedGoals);
      toast(isCurrentlyActive ? 'Meta inhabilitada' : 'Meta reactivada');

      const key = `${goal.month}|${goal.role}`;
      if (selectedGoalKey === key) {
        setGoalActive(!isCurrentlyActive);
      }
    } catch (err) {
      console.error(err);
      toast('Error al cambiar estado de la meta');
    }
  };

  const handleDisableGoalBtn = () => {
    if (selectedGoalKey) {
      const [m, r] = selectedGoalKey.split('|');
      const g = globalGoals.find(x => x.month === m && x.role === r);
      if (g) handleToggleGoalActive(g);
    }
  };

  return (
    <>
      <div className="modalBackdrop" id="serviceBackdrop" ref={serviceBackdropRef} hidden onClick={(e) => { if (e.target.id === 'serviceBackdrop') handleClose('serviceBackdrop'); }}>
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="serviceTitle" style={{ maxWidth: '800px', width: '95%' }}>
          <div className="modalHeader">
            <div>
              <div className="modalTitle" id="serviceTitle">{selectedServiceId ? 'Editar servicio' : 'Nuevo servicio'}</div>
              <div className="modalSubtitle">Se agregara al catalogo de cotizacion</div>
            </div>
            <button className="iconBtn" id="btnServiceClose" type="button" title="Cerrar" onClick={() => handleClose('serviceBackdrop')}>&#10005;</button>
          </div>

          <form className="modalBody" id="serviceForm" onSubmit={handleServiceSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="row2" style={{ display: 'flex', gap: '16px' }}>
              <label className="field" style={{ flex: 1 }}>
                <span>Servicio existente</span>
                <select id="serviceEditSelect" value={selectedServiceId} onChange={handleServiceSelectChange} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                  <option value="">Crear nuevo servicio</option>
                  {services.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} {disabledServices.includes(s.id) ? '(Inhabilitado)' : `($${s.price})`}
                    </option>
                  ))}
                </select>
              </label>
              <div className="field" style={{ width: '180px' }}>
                <span>Estado</span>
                <label className="statusSwitchInline" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', cursor: 'pointer', fontWeight: 'bold', color: serviceActive ? '#16a34a' : '#dc2626' }}>
                  <input id="serviceActive" type="checkbox" checked={serviceActive} onChange={(e) => setServiceActive(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                  <span>{serviceActive ? 'Servicio activo' : 'Servicio inactivo'}</span>
                </label>
              </div>
            </div>

            <div className="row2" style={{ display: 'flex', gap: '16px' }}>
              <label className="field" style={{ flex: 2 }}>
                <span>Nombre del servicio</span>
                <input id="serviceName" type="text" placeholder="Ej: Catering premium" required value={serviceName} onChange={(e) => setServiceName(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              </label>
              <label className="field" style={{ flex: 1 }}>
                <span>Precio base</span>
                <input id="servicePrice" type="number" min="0" step="0.01" placeholder="Ej: 150.00" required value={servicePrice} onChange={(e) => setServicePrice(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              </label>
            </div>

            <div className="row2" style={{ display: 'flex', gap: '16px' }}>
              <label className="field" style={{ flex: 1 }}>
                <span>Categoria</span>
                <select id="serviceCategory" required value={serviceCategoryId} onChange={(e) => setServiceCategoryId(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                  <option value="">-- Seleccionar categoria --</option>
                  {categories.filter(c => c.activo).map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <button className="btn-mantenimiento" type="button" id="btnServiceCategoryManage" onClick={() => { document.getElementById('serviceCategoryBackdrop').hidden = false; }} style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '4px', cursor: 'pointer' }}>Gestionar categorias</button>
                </div>
              </label>
              <label className="field" style={{ flex: 1 }}>
                <span>Subcategoria</span>
                <select id="serviceSubcategory" required value={serviceSubcategoryId} onChange={(e) => setServiceSubcategoryId(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                  <option value="">-- Seleccionar subcategoria --</option>
                  {filteredSubcategoriesForService.filter(sc => sc.activo).map(sc => (
                    <option key={sc.id} value={sc.id}>{sc.nombre}</option>
                  ))}
                </select>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <button className="btn-mantenimiento" type="button" id="btnServiceSubcategoryManage" onClick={() => { document.getElementById('serviceSubcategoryBackdrop').hidden = false; }} style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '4px', cursor: 'pointer' }}>Gestionar subcategorias</button>
                </div>
              </label>
            </div>

            <label className="field" style={{ display: 'flex', flexDirection: 'column' }}>
              <span>Modo de cantidad</span>
              <select id="serviceQuantityMode" required value={serviceQuantityMode} onChange={(e) => setServiceQuantityMode(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                <option value="MANUAL">MANUAL (cantidad editable)</option>
                <option value="PAX">PAX (calculado por no. de personas)</option>
              </select>
            </label>

            <label className="field" style={{ display: 'flex', flexDirection: 'column' }}>
              <span>Descripcion</span>
              <textarea id="serviceDescription" rows="2" placeholder="Descripcion del servicio" value={serviceDescription} onChange={(e) => setServiceDescription(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', resize: 'vertical' }}></textarea>
            </label>

            <div className="field">
              <span>Servicios registrados</span>
              <div className="quoteTableWrap" style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: '8px', marginTop: '6px' }}>
                <table className="quoteTable" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 1, borderBottom: '1px solid #cbd5e1' }}>
                    <tr>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', color: '#475569' }}>Servicio</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', color: '#475569' }}>Categoria</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', color: '#475569' }}>Subcategoria</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', color: '#475569' }}>Precio</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', color: '#475569' }}>Estado</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: '12px', color: '#475569' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody id="servicesManagerBody">
                    {services.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ padding: '16px', textAlign: 'center', color: '#64748b' }}>No hay servicios registrados</td>
                      </tr>
                    ) : (
                      services.map(s => {
                        const isDisabled = disabledServices.includes(s.id);
                        return (
                          <tr key={s.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '8px 12px', fontWeight: '600', color: '#0f172a' }}>{s.name}</td>
                            <td style={{ padding: '8px 12px', color: '#475569' }}>{s.category || 'Sin categoría'}</td>
                            <td style={{ padding: '8px 12px', color: '#475569' }}>{s.subcategory || 'Sin subcategoría'}</td>
                            <td style={{ padding: '8px 12px', color: '#475569' }}>${Number(s.price).toFixed(2)}</td>
                            <td style={{ padding: '8px 12px' }}>
                              <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', background: isDisabled ? '#fee2e2' : '#dcfce7', color: isDisabled ? '#991b1b' : '#15803d' }}>
                                {isDisabled ? 'Inhabilitado' : 'Activo'}
                              </span>
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                <button type="button" title="Editar" onClick={() => loadServiceForEdit(s)} style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>✎</button>
                                <button type="button" title={isDisabled ? 'Reactivar' : 'Inhabilitar'} onClick={() => handleToggleServiceActive(s)} style={{ background: isDisabled ? '#f0fdf4' : '#fff1f2', border: '1px solid', borderColor: isDisabled ? '#bbf7d0' : '#fecdd3', color: isDisabled ? '#16a34a' : '#e11d48', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>{isDisabled ? '↻' : '🚫'}</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modalFooter" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
              <div className="leftActions">
                <button className="btn-cancelar" type="button" id="btnServiceDisable" disabled={!selectedServiceId} onClick={handleDisableServiceBtn} style={{ opacity: selectedServiceId ? 1 : 0.5, cursor: selectedServiceId ? 'pointer' : 'not-allowed' }}>
                  {selectedServiceId && disabledServices.includes(selectedServiceId) ? 'Reactivar' : 'Inhabilitar'}
                </button>
              </div>
              <div className="rightActions" style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-cancel" type="button" id="btnServiceDiscard" onClick={() => handleClose('serviceBackdrop')} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>Cancelar</button>
                <button className="btn-teal" type="submit" disabled={savingService} style={{ background: '#005954', color: 'white', border: 'none', padding: '8px 24px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                  {savingService ? 'Guardando...' : 'Guardar servicio'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <div className="modalBackdrop" id="serviceCategoryBackdrop" ref={categoryBackdropRef} hidden onClick={(e) => { if (e.target.id === 'serviceCategoryBackdrop') handleClose('serviceCategoryBackdrop'); }}>
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="serviceCategoryTitle" style={{ maxWidth: '600px', width: '95%' }}>
          <div className="modalHeader">
            <div>
              <div className="modalTitle" id="serviceCategoryTitle">Categorias de servicio</div>
              <div className="modalSubtitle">Crea y edita categorias para tus servicios</div>
            </div>
            <button className="iconBtn" id="btnServiceCategoryClose" type="button" title="Cerrar" onClick={() => handleClose('serviceCategoryBackdrop')}>&#10005;</button>
          </div>

          <div className="modalBody" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <label className="field" style={{ display: 'flex', flexDirection: 'column' }}>
              <span>Categoria existente</span>
              <select id="serviceCategoryEditSelect" value={selectedCategoryId} onChange={handleCategorySelectChange} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                <option value="">Crear nueva categoria</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} {c.activo ? '(Activo)' : '(Inhabilitado)'}
                  </option>
                ))}
              </select>
            </label>

            <label className="field" style={{ display: 'flex', flexDirection: 'column' }}>
              <span>Nombre de categoria</span>
              <input id="serviceCategoryNameInput" type="text" placeholder="Ej: Alimentos y bebidas" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
            </label>

            <div className="field">
              <span>Categorias registradas</span>
              <div className="quoteTableWrap" style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: '8px', marginTop: '6px' }}>
                <table className="quoteTable" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 1, borderBottom: '1px solid #cbd5e1' }}>
                    <tr>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', color: '#475569' }}>Nombre</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', color: '#475569' }}>Estado</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: '12px', color: '#475569' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody id="serviceCategoryBody">
                    {categories.length === 0 ? (
                      <tr>
                        <td colSpan="3" style={{ padding: '16px', textAlign: 'center', color: '#64748b' }}>No hay categorías registradas</td>
                      </tr>
                    ) : (
                      categories.map(c => (
                        <tr key={c.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '8px 12px', fontWeight: '600', color: '#0f172a' }}>{c.nombre}</td>
                          <td style={{ padding: '8px 12px' }}>
                            <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', background: !c.activo ? '#fee2e2' : '#dcfce7', color: !c.activo ? '#991b1b' : '#15803d' }}>
                              {c.activo ? 'Activo' : 'Inhabilitado'}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                              <button type="button" onClick={() => loadCategoryForEdit(c)} style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>✎</button>
                              <button type="button" onClick={() => handleToggleCategoryActive(c)} style={{ background: !c.activo ? '#f0fdf4' : '#fff1f2', border: '1px solid', borderColor: !c.activo ? '#bbf7d0' : '#fecdd3', color: !c.activo ? '#16a34a' : '#e11d48', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>{c.activo ? '🚫' : '↻'}</button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="modalFooter" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
            <div className="leftActions"></div>
            <div className="rightActions" style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-cancel" id="btnServiceCategoryReset" type="button" onClick={resetCategoryForm} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>Nueva categoria</button>
              <button className="btn-teal" id="btnServiceCategorySave" type="button" onClick={handleCategorySave} disabled={savingCategory} style={{ background: '#005954', color: 'white', border: 'none', padding: '8px 24px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                {savingCategory ? 'Guardando...' : 'Guardar categoria'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="modalBackdrop" id="serviceSubcategoryBackdrop" ref={subcategoryBackdropRef} hidden onClick={(e) => { if (e.target.id === 'serviceSubcategoryBackdrop') handleClose('serviceSubcategoryBackdrop'); }}>
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="serviceSubcategoryTitle" style={{ maxWidth: '600px', width: '95%' }}>
          <div className="modalHeader">
            <div>
              <div className="modalTitle" id="serviceSubcategoryTitle">Subcategorias de servicio</div>
              <div className="modalSubtitle">Crea y edita subcategorias por categoria</div>
            </div>
            <button className="iconBtn" id="btnServiceSubcategoryClose" type="button" title="Cerrar" onClick={() => handleClose('serviceSubcategoryBackdrop')}>&#10005;</button>
          </div>

          <div className="modalBody" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="row2" style={{ display: 'flex', gap: '16px' }}>
              <label className="field" style={{ flex: 1 }}>
                <span>Categoria</span>
                <select id="serviceSubcategoryCategorySelect" value={subcategoryCategorySelect} onChange={(e) => setSubcategoryCategorySelect(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                  <option value="">-- Seleccionar categoria --</option>
                  {categories.filter(c => c.activo).map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </label>
              <label className="field" style={{ flex: 1 }}>
                <span>Subcategoria existente</span>
                <select id="serviceSubcategoryEditSelect" value={selectedSubcategoryId} onChange={handleSubcategorySelectChange} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                  <option value="">Crear nueva subcategoria</option>
                  {subcategories.filter(sc => String(sc.id_categoria) === String(subcategoryCategorySelect)).map(sc => (
                    <option key={sc.id} value={sc.id}>
                      {sc.nombre} {sc.activo ? '(Activo)' : '(Inhabilitado)'}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="field" style={{ display: 'flex', flexDirection: 'column' }}>
              <span>Nombre de subcategoria</span>
              <input id="serviceSubcategoryNameInput" type="text" placeholder="Ej: Cocteles" value={subcategoryName} onChange={(e) => setSubcategoryName(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
            </label>

            <div className="field">
              <span>Subcategorias registradas</span>
              <div className="quoteTableWrap" style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: '8px', marginTop: '6px' }}>
                <table className="quoteTable" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 1, borderBottom: '1px solid #cbd5e1' }}>
                    <tr>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', color: '#475569' }}>Subcategoria</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', color: '#475569' }}>Categoria</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', color: '#475569' }}>Estado</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: '12px', color: '#475569' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody id="serviceSubcategoryBody">
                    {subcategories.length === 0 ? (
                      <tr>
                        <td colSpan="4" style={{ padding: '16px', textAlign: 'center', color: '#64748b' }}>No hay subcategorías registradas</td>
                      </tr>
                    ) : (
                      subcategories.map(sc => {
                        const catName = categories.find(c => String(c.id) === String(sc.id_categoria))?.nombre || 'Desconocido';
                        return (
                          <tr key={sc.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '8px 12px', fontWeight: '600', color: '#0f172a' }}>{sc.nombre}</td>
                            <td style={{ padding: '8px 12px', color: '#475569' }}>{catName}</td>
                            <td style={{ padding: '8px 12px' }}>
                              <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', background: !sc.activo ? '#fee2e2' : '#dcfce7', color: !sc.activo ? '#991b1b' : '#15803d' }}>
                                {sc.activo ? 'Activo' : 'Inhabilitado'}
                              </span>
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                <button type="button" onClick={() => loadSubcategoryForEdit(sc)} style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>✎</button>
                                <button type="button" onClick={() => handleToggleSubcategoryActive(sc)} style={{ background: !sc.activo ? '#f0fdf4' : '#fff1f2', border: '1px solid', borderColor: !sc.activo ? '#bbf7d0' : '#fecdd3', color: !sc.activo ? '#16a34a' : '#e11d48', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>{sc.activo ? '🚫' : '↻'}</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="modalFooter" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
            <div className="leftActions"></div>
            <div className="rightActions" style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-cancel" id="btnServiceSubcategoryReset" type="button" onClick={resetSubcategoryForm} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>Nueva subcategoria</button>
              <button className="btn-teal" id="btnServiceSubcategorySave" type="button" onClick={handleSubcategorySave} disabled={savingSubcategory} style={{ background: '#005954', color: 'white', border: 'none', padding: '8px 24px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                {savingSubcategory ? 'Guardando...' : 'Guardar subcategoria'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="modalBackdrop" id="globalGoalsBackdrop" ref={goalsBackdropRef} hidden onClick={(e) => { if (e.target.id === 'globalGoalsBackdrop') handleClose('globalGoalsBackdrop'); }}>
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="globalGoalsTitle" style={{ maxWidth: '700px', width: '95%' }}>
          <div className="modalHeader">
            <div>
              <div className="modalTitle" id="globalGoalsTitle">Metas globales</div>
              <div className="modalSubtitle">Agrega, edita e inhabilita metas mensuales</div>
            </div>
            <button className="iconBtn" id="btnGlobalGoalsClose" type="button" title="Cerrar" onClick={() => handleClose('globalGoalsBackdrop')}>&#10005;</button>
          </div>

          <div className="modalBody" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="row2" style={{ display: 'flex', gap: '16px' }}>
              <label className="field" style={{ flex: 1 }}>
                <span>Meta existente</span>
                <select id="globalGoalsEditSelect" value={selectedGoalKey} onChange={handleGoalSelectChange} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                  <option value="">Crear nueva meta</option>
                  {globalGoals.map(g => {
                    const key = `${g.month}|${g.role}`;
                    return (
                      <option key={key} value={key}>
                        {formatMonthLabel(g.month)} - {g.role} ({g.active ? 'Activa' : 'Inactiva'})
                      </option>
                    );
                  })}
                </select>
              </label>
              <div className="field" style={{ width: '160px' }}>
                <span>Estado</span>
                <label className="statusSwitchInline" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', cursor: 'pointer', fontWeight: 'bold', color: goalActive ? '#16a34a' : '#dc2626' }}>
                  <input id="globalGoalActive" type="checkbox" checked={goalActive} onChange={(e) => setGoalActive(e.target.checked)} style={{ width: '18px', height: '18px' }} />
                  <span>{goalActive ? 'Meta activa' : 'Meta inactiva'}</span>
                </label>
              </div>
            </div>

            <div className="row3" style={{ display: 'flex', gap: '16px' }}>
              <label className="field" style={{ flex: 1 }}>
                <span>Mes</span>
                <select id="globalGoalMonth" value={goalMonth} onChange={(e) => setGoalMonth(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                  <option value="">Selecciona un mes</option>
                  {generateGoalMonths().map(m => (
                    <option key={m} value={m}>{formatMonthLabel(m)}</option>
                  ))}
                </select>
              </label>
              <label className="field" style={{ flex: 1 }}>
                <span>Rol</span>
                <select id="globalGoalRole" value={goalRole} onChange={(e) => setGoalRole(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                  <option value="vendedor">Vendedor</option>
                  <option value="recepcionista">Recepcionista</option>
                </select>
              </label>
              <label className="field" style={{ flex: 1 }}>
                <span>Monto meta</span>
                <input id="globalGoalAmount" type="number" min="0" step="0.01" placeholder="Ej: 250000" value={goalAmount} onChange={(e) => setGoalAmount(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              </label>
            </div>

            <div className="field">
              <span>Metas registradas</span>
              <div className="quoteTableWrap" style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: '8px', marginTop: '6px' }}>
                <table className="quoteTable" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 1, borderBottom: '1px solid #cbd5e1' }}>
                    <tr>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', color: '#475569' }}>Mes</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', color: '#475569' }}>Rol</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', color: '#475569' }}>Monto</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', color: '#475569' }}>Estado</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: '12px', color: '#475569' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody id="globalGoalsBody">
                    {globalGoals.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ padding: '16px', textAlign: 'center', color: '#64748b' }}>No hay metas registradas</td>
                      </tr>
                    ) : (
                      globalGoals.map(g => {
                        const key = `${g.month}|${g.role}`;
                        return (
                          <tr key={key} style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '8px 12px', fontWeight: '600', color: '#0f172a' }}>{formatMonthLabel(g.month)}</td>
                            <td style={{ padding: '8px 12px', color: '#475569' }}>{g.role}</td>
                            <td style={{ padding: '8px 12px', color: '#475569' }}>${Number(g.amount).toFixed(2)}</td>
                            <td style={{ padding: '8px 12px' }}>
                              <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', background: !g.active ? '#fee2e2' : '#dcfce7', color: !g.active ? '#991b1b' : '#15803d' }}>
                                {g.active ? 'Activa' : 'Inactiva'}
                              </span>
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                <button type="button" onClick={() => loadGoalForEdit(g)} style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>✎</button>
                                <button type="button" onClick={() => handleToggleGoalActive(g)} style={{ background: !g.active ? '#f0fdf4' : '#fff1f2', border: '1px solid', borderColor: !g.active ? '#bbf7d0' : '#fecdd3', color: !g.active ? '#16a34a' : '#e11d48', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>{g.active ? '🚫' : '↻'}</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="modalFooter" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
            <div className="leftActions">
              <button className="btn-cancelar" id="btnGlobalGoalDisable" type="button" disabled={!selectedGoalKey} onClick={handleDisableGoalBtn} style={{ opacity: selectedGoalKey ? 1 : 0.5, cursor: selectedGoalKey ? 'pointer' : 'not-allowed' }}>
                {selectedGoalKey && globalGoals.find(x => `${x.month}|${x.role}` === selectedGoalKey)?.active === false ? 'Reactivar' : 'Inhabilitar'}
              </button>
            </div>
            <div className="rightActions" style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-cancel" id="btnGlobalGoalReset" type="button" onClick={resetGoalForm} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>Nueva meta</button>
              <button className="btn-teal" id="btnGlobalGoalSave" type="button" onClick={handleGoalSave} disabled={savingGoal} style={{ background: '#005954', color: 'white', border: 'none', padding: '8px 24px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                {savingGoal ? 'Guardando...' : 'Guardar meta'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}