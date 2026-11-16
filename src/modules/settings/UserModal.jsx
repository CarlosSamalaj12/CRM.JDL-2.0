import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { loadState as loadCrmState, invalidateStateCache } from '../../services/stateService';
import { getEquipos, updateUserEquipo, updateUser, createUser, deleteUser, toggleUserActive, api } from '../../services/api.js';
import toast from 'react-hot-toast';

const ROLE_LABELS = {
  admin: 'Administrador',
  recepcionista: 'Recepcionista',
  vendedor: 'Vendedor',
  eventos: 'Eventos',
  coordinador: 'Coordinador',
};

const ROLE_COLORS = {
  admin: { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  recepcionista: { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' },
  vendedor: { bg: '#dcfce7', color: '#166534', border: '#86efac' },
  eventos: { bg: '#f3e8ff', color: '#6b21a8', border: '#d8b4fe' },
  coordinador: { bg: '#fff7ed', color: '#9a3412', border: '#fed7aa' },
};

export default function UserModal({ onClose }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [equipos, setEquipos] = useState([]);

  // Form states
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('vendedor');
  const [teamId, setTeamId] = useState('');
  const [active, setActive] = useState(true);
  const [salesTargetEnabled, setSalesTargetEnabled] = useState(false);
  const [goalTiers, setGoalTiers] = useState([]);
  const [canAuthorizeDiscount, setCanAuthorizeDiscount] = useState(false);
  const [canUseChecklist, setCanUseChecklist] = useState(false);

  const [isOpen, setIsOpen] = useState(false);

  const formatNumberWithCommas = (value) => {
    if (value === null || value === undefined || value === '') return '';
    const cleanVal = String(value).replace(/[^0-9.]/g, '');
    const parts = cleanVal.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    if (parts[1]) {
      parts[1] = parts[1].slice(0, 2);
    }
    return parts.join('.');
  };

  // Tier inputs
  const [tierName, setTierName] = useState('');
  const [tierAmount, setTierAmount] = useState('');
  const [tierPercentage, setTierPercentage] = useState('');
  const [editingTierIndex, setEditingTierIndex] = useState(null);

  // Media files states
  const [avatarDataUrl, setAvatarDataUrl] = useState('');
  const [signatureDataUrl, setSignatureDataUrl] = useState('');

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const state = await loadCrmState();
      const allUsers = state?.users || [];
      setUsers(allUsers);
    } catch (err) {
      console.error('Error fetching users from state:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadEquipos = async () => {
    try {
      const data = await getEquipos();
      setEquipos(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error cargando equipos:', err);
      toast.error('No se pudieron cargar los equipos de trabajo.');
    }
  };

  function resetForm() {
    setSelectedUserId('');
    setFullName('');
    setEmail('');
    setPhone('');
    setRole('vendedor');
    setTeamId('');
    setActive(true);
    setSalesTargetEnabled(false);
    setGoalTiers([]);
    setCanAuthorizeDiscount(false);
    setCanUseChecklist(false);
    setAvatarDataUrl('');
    setSignatureDataUrl('');
    setTierName('');
    setTierAmount('');
    setTierPercentage('');
    setEditingTierIndex(null);
  }

  useEffect(() => {
    const handleOpenAddUser = () => {
      setIsOpen(true);
      resetForm();
      fetchUsers();
      loadEquipos();
    };

    const handleEditUser = (e) => {
      setIsOpen(true);
      if (e.detail && e.detail.userId) {
        setSelectedUserId(e.detail.userId);
      }
      fetchUsers();
      loadEquipos();
    };

    window.addEventListener('openAddUser', handleOpenAddUser);
    window.addEventListener('editUser', handleEditUser);

    fetchUsers();
    loadEquipos();

    return () => {
      window.removeEventListener('openAddUser', handleOpenAddUser);
      window.removeEventListener('editUser', handleEditUser);
    };
  }, []);

  // When a user is selected to be edited
  useEffect(() => {
    let cancelled = false;
    if (selectedUserId) {
      const user = users.find(u => u.id === selectedUserId);
      if (user) {
        setFullName(user.fullName || user.name || '');
        setEmail(user.email || '');
        setPhone(user.phone || '');
        setRole(user.role || 'vendedor');
        setActive(user.active !== false);
        setSalesTargetEnabled(user.salesTargetEnabled === true);
        setGoalTiers(user.goalTiers || []);
        setCanAuthorizeDiscount(user.canAuthorizeDiscount === true);
        setCanUseChecklist(user.canUseChecklist === true);
        setAvatarDataUrl('');
        setSignatureDataUrl('');
        setTeamId(user.teamId ? String(user.teamId) : '');

        // Fetch avatar and signature on demand
        api.get(`/api/usuarios/${selectedUserId}/media`)
          .then(res => {
            if (cancelled) return;
            if (res) {
              setAvatarDataUrl(res.avatar_data_url || '');
              setSignatureDataUrl(res.firma_data_url || '');
            }
          })
          .catch(err => {
            console.error('Error fetching user media in UserModal:', err);
          });
      }
    } else {
      resetForm();
    }
    return () => {
      cancelled = true;
    };
  }, [selectedUserId, users]);

  const handleClose = () => {
    setIsOpen(false);
    if (onClose) onClose();
  };

  // Convert and compress uploaded files
  const handleFileUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const compressedDataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            if (type === 'avatar') {
              const maxDim = 150;
              if (width > height) {
                if (width > maxDim) {
                  height = Math.round((height * maxDim) / width);
                  width = maxDim;
                }
              } else {
                if (height > maxDim) {
                  width = Math.round((width * maxDim) / height);
                  height = maxDim;
                }
              }
            } else {
              const maxW = 400;
              const maxH = 200;
              if (width > maxW || height > maxH) {
                const ratio = Math.min(maxW / width, maxH / height);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            const mime = type === 'avatar' ? 'image/jpeg' : 'image/png';
            const quality = type === 'avatar' ? 0.75 : undefined;
            resolve(canvas.toDataURL(mime, quality));
          };
          img.src = event.target.result;
        };
        reader.readAsDataURL(file);
      });

      if (type === 'avatar') {
        setAvatarDataUrl(compressedDataUrl);
      } else if (type === 'signature') {
        setSignatureDataUrl(compressedDataUrl);
      }
    } catch (err) {
      console.error('Error al procesar la imagen:', err);
      toast.error('No se pudo procesar la imagen seleccionada.');
    }
  };

  const handleAddTier = () => {
    if (!tierName || !tierAmount || !tierPercentage) {
      toast.error('Completa el nombre, monto y porcentaje del nivel.');
      return;
    }
    const amt = parseFloat(String(tierAmount).replace(/,/g, ''));
    const pct = parseFloat(tierPercentage);
    if (isNaN(amt) || amt <= 0) {
      toast.error('El monto debe ser mayor a 0.');
      return;
    }
    if (isNaN(pct) || pct <= 0) {
      toast.error('El porcentaje debe ser mayor a 0.');
      return;
    }
    if (editingTierIndex !== null) {
      setGoalTiers(prev => prev.map((t, idx) => idx === editingTierIndex ? { name: tierName.trim(), amount: amt, percentage: pct } : t));
      setEditingTierIndex(null);
    } else {
      setGoalTiers(prev => [...prev, { name: tierName.trim(), amount: amt, percentage: pct }]);
    }
    setTierName('');
    setTierAmount('');
    setTierPercentage('');
  };

  const handleEditTier = (index) => {
    const tier = goalTiers[index];
    if (tier) {
      setTierName(tier.name);
      setTierAmount(formatNumberWithCommas(tier.amount));
      setTierPercentage(String(tier.percentage));
      setEditingTierIndex(index);
    }
  };

  const handleRemoveTier = (index) => {
    setGoalTiers(prev => prev.filter((_, i) => i !== index));
    if (editingTierIndex === index) {
      setTierName('');
      setTierAmount('');
      setTierPercentage('');
      setEditingTierIndex(null);
    } else if (editingTierIndex > index) {
      setEditingTierIndex(prev => prev - 1);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!fullName || !email || !role) {
      toast.error('Completa el Nombre Completo, Correo y Rol del usuario.');
      return;
    }

    try {
      setLoading(true);

      const nameTrimmed = fullName.trim().toLowerCase();
      const nameExists = selectedUserId
        ? users.some(u => (u.fullName || u.name || '').trim().toLowerCase() === nameTrimmed && u.id !== selectedUserId)
        : users.some(u => (u.fullName || u.name || '').trim().toLowerCase() === nameTrimmed);
      if (nameExists) {
        toast.error('Ya existe un usuario con ese nombre completo.');
        setLoading(false);
        return;
      }

      const normalizedEmail = email.toLowerCase().trim();

      const userPayload = {
        name: fullName.trim(),
        fullName: fullName.trim(),
        username: normalizedEmail.split('@')[0],
        email: normalizedEmail,
        phone: phone.trim(),
        role: role,
        teamId: teamId ? Number(teamId) : null,
        active: active,
        salesTargetEnabled: salesTargetEnabled,
        goalTiers: goalTiers,
        canAuthorizeDiscount: canAuthorizeDiscount,
        canUseChecklist: canUseChecklist,
        avatarDataUrl: avatarDataUrl,
        signatureDataUrl: signatureDataUrl,
      };

      if (selectedUserId) {
        await updateUser(selectedUserId, userPayload);
      } else {
        if (users.some(u => String(u.email || '').toLowerCase() === normalizedEmail)) {
          toast.error('El correo electrónico ya se encuentra pre-registrado en el sistema.');
          setLoading(false);
          return;
        }

        const newId = `user_prereg_${Date.now()}`;
        await createUser({
          ...userPayload,
          id: newId,
          password: '',
        });
      }

      // Sincronizar equipo_id directamente en la tabla usuarios para que el equipo se refleje en tareas semanales
      if (selectedUserId && !selectedUserId.startsWith('user_prereg_')) {
        updateUserEquipo(selectedUserId, teamId ? Number(teamId) : null).catch(err => {
          console.warn('No se pudo sincronizar equipo_id en la BD:', err);
        });
      }

      // Si el usuario editado es el usuario actualmente logueado, actualizar el localStorage para reflejo instantáneo
      try {
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        if (currentUser && (currentUser.id === selectedUserId || currentUser.email === normalizedEmail)) {
          const updatedUser = {
            ...currentUser,
            ...userPayload,
            canAuthorizeDiscount: canAuthorizeDiscount,
            canUseChecklist: canUseChecklist,
          };
          localStorage.setItem('user', JSON.stringify(updatedUser));
        }
      } catch (err) {
        console.warn('No se pudo actualizar localStorage user:', err);
      }

      handleClose();
      invalidateStateCache();
      toast.success(selectedUserId ? `Datos de ${fullName} actualizados.` : `${fullName} pre-registrado y autorizado.`, { duration: 2000 });

      window.dispatchEvent(new CustomEvent('usersUpdated'));
      await fetchUsers();

    } catch (err) {
      console.error('Error saving user to database:', err);
      toast.error(err.message || 'Ocurrió un error al guardar los datos del usuario.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentRoleStyle = ROLE_COLORS[role] || ROLE_COLORS.vendedor;

  return ReactDOM.createPortal(
    <div
      className="settings-user-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="settings-user-modal" role="dialog" aria-modal="true" aria-labelledby="userModalTitle">
        {/* CABECERA DINÁMICA */}
        <div className="settings-user-modal-header">
          <div className="settings-user-header-left">
            <div className="settings-user-header-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div className="settings-user-header-title-box">
              <h2 className="settings-user-modal-title" id="userModalTitle">
                <span>{selectedUserId ? `Editar Usuario: ${fullName || 'Sin nombre'}` : 'Pre-registro de Usuario'}</span>
                {selectedUserId && (
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: currentRoleStyle.bg,
                      color: currentRoleStyle.color,
                      border: `1px solid ${currentRoleStyle.border}`,
                      textTransform: 'uppercase'
                    }}
                  >
                    {ROLE_LABELS[role] || role}
                  </span>
                )}
              </h2>
              <p className="settings-user-modal-subtitle">
                {selectedUserId
                  ? 'Modificación de credenciales, roles, permisos y metas comerciales'
                  : 'Autorización de Google Login y asignación de roles operacionales'}
              </p>
            </div>
          </div>

          <div className="settings-user-header-right">
            {selectedUserId && (
              <button
                type="button"
                className="settings-user-btn-new-mode"
                onClick={resetForm}
                title="Cambiar al modo de crear nuevo usuario"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '13px', height: '13px', flexShrink: 0 }}>
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>Nuevo usuario</span>
              </button>
            )}

            <button
              type="button"
              className="settings-user-btn-close"
              onClick={handleClose}
              title="Cerrar modal"
              aria-label="Cerrar modal"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px', flexShrink: 0, display: 'block' }}>
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* CUERPO CON SCROLL (BENTO CARDS) */}
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <div className="settings-user-modal-body">
            {/* Banner Informativo de Google Login */}
            <div className="settings-user-google-banner">
              <svg viewBox="0 0 24 24">
                <path fill="#EA4335" d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.198 2.698 1.24 6.65l4.026 3.115Z" />
                <path fill="#4285F4" d="M23.64 12.273c0-.818-.073-1.609-.208-2.373H12v4.582h6.54c-.28 1.514-1.134 2.8-2.42 3.668l3.8 2.946c2.227-2.055 3.52-5.073 3.52-8.823Z" />
                <path fill="#FBBC05" d="M5.266 14.235 1.24 17.35C3.198 21.302 7.27 24 12 24c3.155 0 5.8-1.045 7.732-2.846l-3.8-2.946c-1.055.709-2.409 1.127-3.932 1.127-3.555 0-6.564-2.4-7.636-5.636l-4.027 3.114-1.071 1.422Z" />
                <path fill="#34A853" d="M12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.198 2.698 1.24 6.65l4.026 3.115C2.31 9.764 5.318 4.909 12 4.909Z" />
              </svg>
              <div className="settings-user-google-text">
                <strong>Autenticación corporativa vía Google Login</strong>
                El colaborador iniciará sesión automáticamente con su cuenta de Google. Pre-registra su correo institucional o Gmail para conceder acceso y asignar sus privilegios.
              </div>
            </div>

            {/* BENTO BLOQUE 1: DATOS GENERALES Y PERFIL */}
            <div className="settings-user-bento-card">
              <div className="settings-user-bento-header">
                <h3 className="settings-user-bento-title">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <span>Perfil y Credenciales de Cuenta</span>
                </h3>

                <label className="settings-user-switch-label" title="Controla si el usuario puede iniciar sesión en el CRM">
                  <span>Acceso Autorizado (Activo)</span>
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                  />
                </label>
              </div>

              <div className="settings-user-form-grid">
                {/* Nombre Completo */}
                <div className="settings-user-field">
                  <label className="settings-user-label" htmlFor="userFullName">Nombre Completo *</label>
                  <div className="settings-user-input-wrap">
                    <svg className="settings-user-input-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    <input
                      id="userFullName"
                      type="text"
                      className="with-icon"
                      placeholder="Ej. Carlos Roberto Samalaj"
                      required
                      value={fullName ?? ''}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                </div>

                {/* Correo Google */}
                <div className="settings-user-field">
                  <label className="settings-user-label" htmlFor="userEmail">Correo Google (Gmail / Institucional) *</label>
                  <div className="settings-user-input-wrap">
                    <svg className="settings-user-input-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                    <input
                      id="userEmail"
                      type="email"
                      className="with-icon"
                      placeholder="ejemplo@jardinesdellago.com"
                      required
                      value={email ?? ''}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                {/* Teléfono Móvil */}
                <div className="settings-user-field">
                  <label className="settings-user-label" htmlFor="userPhone">Teléfono Móvil</label>
                  <div className="settings-user-input-wrap">
                    <svg className="settings-user-input-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                    <input
                      id="userPhone"
                      type="text"
                      className="with-icon"
                      placeholder="Ej. 5632-5547"
                      value={phone ?? ''}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </div>

                {/* Rol del Usuario */}
                <div className="settings-user-field">
                  <label className="settings-user-label" htmlFor="userRole">Rol del Usuario *</label>
                  <select
                    id="userRole"
                    value={role ?? 'vendedor'}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    <option value="vendedor">Vendedor (Pipeline comercial y Cotizaciones)</option>
                    <option value="recepcionista">Recepcionista (Operación del Calendario)</option>
                    <option value="admin">Administrador (Acceso Total + Metas de Ventas)</option>
                    <option value="eventos">Eventos (Gestión de checklists y reportes)</option>
                    <option value="coordinador">Coordinador (Solo lectura: informes, checklists, ocupación)</option>
                  </select>
                </div>

                {/* Equipo de Trabajo */}
                <div className="settings-user-field" style={{ gridColumn: 'span 2' }}>
                  <label className="settings-user-label" htmlFor="userTeam">Equipo de Trabajo (Área)</label>
                  <select
                    id="userTeam"
                    value={teamId ?? ''}
                    onChange={(e) => setTeamId(e.target.value)}
                  >
                    <option value="">Sin equipo asignado</option>
                    {equipos.map(eq => (
                      <option key={eq.id} value={eq.id}>{eq.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* BENTO BLOQUE 2: PERMISOS OPERATIVOS ESPECIALES */}
            <div className="settings-user-bento-card">
              <div className="settings-user-bento-header">
                <h3 className="settings-user-bento-title">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <span>Permisos Especiales de Operación</span>
                </h3>
              </div>

              <div className="settings-user-permissions-grid">
                {/* Permiso 1: Autorizar Descuentos */}
                <div className={`settings-user-perm-card ${canAuthorizeDiscount ? 'active' : ''}`}>
                  <div className="settings-user-perm-info">
                    <div className="settings-user-perm-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        <line x1="9" y1="9" x2="15" y2="15" />
                        <circle cx="9.5" cy="9.5" r=".5" fill="currentColor" />
                        <circle cx="14.5" cy="14.5" r=".5" fill="currentColor" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="settings-user-perm-title">Autorizar Descuentos</h4>
                      <p className="settings-user-perm-desc">
                        Recibirá notificaciones en tiempo real en el Centro de Autorizaciones para aprobar o rechazar descuentos comerciales.
                      </p>
                    </div>
                  </div>
                  <label className="settings-user-switch-label" title="Habilitar permiso para autorizar descuentos">
                    <input
                      type="checkbox"
                      checked={canAuthorizeDiscount}
                      onChange={(e) => setCanAuthorizeDiscount(e.target.checked)}
                    />
                  </label>
                </div>

                {/* Permiso 2: Uso de Check List */}
                <div className={`settings-user-perm-card ${canUseChecklist ? 'active' : ''}`}>
                  <div className="settings-user-perm-info">
                    <div className="settings-user-perm-icon" style={{ color: '#059669' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                        <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                        <polyline points="9 14 11 16 15 11" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="settings-user-perm-title">Llenar y Guardar Check Lists</h4>
                      <p className="settings-user-perm-desc">
                        Permite a este usuario (incluyendo coordinadores y áreas operativas) calificar y registrar checklists en eventos.
                      </p>
                    </div>
                  </div>
                  <label className="settings-user-switch-label" title="Habilitar permiso para checklists">
                    <input
                      type="checkbox"
                      checked={canUseChecklist}
                      onChange={(e) => setCanUseChecklist(e.target.checked)}
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* BENTO BLOQUE 3: FOTOGRAFÍA Y FIRMA DIGITAL (2 COLUMNAS) */}
            <div className="settings-user-bento-card">
              <div className="settings-user-bento-header">
                <h3 className="settings-user-bento-title">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                    <line x1="12" y1="22.08" x2="12" y2="12" />
                  </svg>
                  <span>Fotografía y Firma Digital</span>
                </h3>
              </div>

              <div className="settings-user-media-grid">
                {/* Columna 1: Avatar */}
                <div className="settings-user-media-panel">
                  <div className="settings-user-media-panel-header">
                    <span className="settings-user-media-title">Fotografía / Avatar</span>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>PNG o JPG (Máx. 2MB)</span>
                  </div>

                  <div className="settings-user-avatar-row">
                    <div className="settings-user-avatar-preview">
                      {avatarDataUrl ? (
                        <img src={avatarDataUrl} alt="Avatar de usuario" />
                      ) : (
                        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                      )}
                    </div>

                    <div className="settings-user-media-actions">
                      <input
                        id="userAvatarInput"
                        type="file"
                        accept="image/png,image/jpeg"
                        style={{ display: 'none' }}
                        onChange={(e) => handleFileUpload(e, 'avatar')}
                      />
                      <button
                        type="button"
                        className="settings-user-btn-upload"
                        onClick={() => document.getElementById('userAvatarInput').click()}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        <span>{avatarDataUrl ? 'Cambiar foto' : 'Subir foto'}</span>
                      </button>

                      {avatarDataUrl && (
                        <button
                          type="button"
                          className="settings-user-btn-remove"
                          onClick={() => setAvatarDataUrl('')}
                          title="Eliminar foto de perfil"
                        >
                          Quitar
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Columna 2: Firma Digital */}
                <div className="settings-user-media-panel">
                  <div className="settings-user-media-panel-header">
                    <span className="settings-user-media-title">Firma Digital (Cotizaciones)</span>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Fondo transparente recomendado</span>
                  </div>

                  <div className="settings-user-signature-box">
                    {signatureDataUrl ? (
                      <img src={signatureDataUrl} alt="Firma digital" />
                    ) : (
                      <span style={{ fontSize: '11.5px', color: '#94a3b8', fontStyle: 'italic' }}>
                        Sin firma digital registrada
                      </span>
                    )}
                  </div>

                  <div className="settings-user-media-actions">
                    <input
                      id="userSignatureInput"
                      type="file"
                      accept="image/png,image/jpeg"
                      style={{ display: 'none' }}
                      onChange={(e) => handleFileUpload(e, 'signature')}
                    />
                    <button
                      type="button"
                      className="settings-user-btn-upload"
                      onClick={() => document.getElementById('userSignatureInput').click()}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </svg>
                      <span>{signatureDataUrl ? 'Cambiar firma' : 'Subir firma'}</span>
                    </button>

                    {signatureDataUrl && (
                      <button
                        type="button"
                        className="settings-user-btn-remove"
                        onClick={() => setSignatureDataUrl('')}
                        title="Eliminar firma digital"
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* BENTO BLOQUE 4: METAS Y COMISIONES */}
            <div className="settings-user-bento-card">
              <div className="settings-user-bento-header">
                <h3 className="settings-user-bento-title">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="6" />
                    <circle cx="12" cy="12" r="2" />
                  </svg>
                  <span>Niveles de Meta y Comisiones Comerciales</span>
                </h3>

                <label className="settings-user-switch-label" title="Habilitar esquema de comisiones">
                  <span>Habilitar metas y comisiones</span>
                  <input
                    type="checkbox"
                    checked={salesTargetEnabled}
                    onChange={(e) => setSalesTargetEnabled(e.target.checked)}
                  />
                </label>
              </div>

              {salesTargetEnabled ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Fila de ingreso de nivel */}
                  <div className="settings-user-goals-row">
                    <div className="settings-user-field" style={{ flex: '1 1 180px' }}>
                      <label className="settings-user-label">Nombre del nivel</label>
                      <input
                        type="text"
                        placeholder="Ej. Meta Media, Meta Alta"
                        value={tierName ?? ''}
                        onChange={(e) => setTierName(e.target.value)}
                      />
                    </div>

                    <div className="settings-user-field" style={{ flex: '0 0 150px' }}>
                      <label className="settings-user-label">Monto mínimo (Q)</label>
                      <input
                        type="text"
                        placeholder="Q 160,000"
                        value={tierAmount ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          const clean = val.replace(/[^0-9.,]/g, '');
                          setTierAmount(formatNumberWithCommas(clean));
                        }}
                      />
                    </div>

                    <div className="settings-user-field" style={{ flex: '0 0 110px' }}>
                      <label className="settings-user-label">% Comisión</label>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        placeholder="Ej. 2.5"
                        value={tierPercentage ?? ''}
                        onChange={(e) => setTierPercentage(e.target.value)}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={handleAddTier}
                        style={{
                          height: '40px',
                          padding: '0 16px',
                          borderRadius: '8px',
                          border: 'none',
                          background: '#0284c7',
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: '12.5px',
                          cursor: 'pointer'
                        }}
                      >
                        {editingTierIndex !== null ? 'Actualizar' : 'Agregar nivel'}
                      </button>

                      {editingTierIndex !== null && (
                        <button
                          type="button"
                          onClick={() => {
                            setTierName('');
                            setTierAmount('');
                            setTierPercentage('');
                            setEditingTierIndex(null);
                          }}
                          style={{
                            height: '40px',
                            padding: '0 12px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            color: '#475569',
                            fontWeight: 700,
                            fontSize: '12.5px',
                            cursor: 'pointer'
                          }}
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Tabla de niveles */}
                  <table className="settings-user-goals-table">
                    <thead>
                      <tr>
                        <th>Nivel</th>
                        <th>Monto Mínimo</th>
                        <th>% Comisión</th>
                        <th style={{ width: '80px', textAlign: 'center' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {goalTiers.length === 0 ? (
                        <tr>
                          <td colSpan="4" style={{ textAlign: 'center', padding: '16px', color: '#94a3b8', fontStyle: 'italic' }}>
                            Sin niveles de meta configurados. Agrega niveles como Meta Baja, Meta Media o Meta Alta.
                          </td>
                        </tr>
                      ) : (
                        goalTiers.map((t, i) => (
                          <tr key={i} style={editingTierIndex === i ? { background: '#f0fdf4' } : {}}>
                            <td style={{ fontWeight: 700, color: '#0f172a' }}>{t.name}</td>
                            <td style={{ fontWeight: 800, color: '#059669' }}>
                              Q {t.amount.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td style={{ fontWeight: 800, color: '#2563eb' }}>{t.percentage}%</td>
                            <td style={{ textAlign: 'center' }}>
                              <div style={{ display: 'inline-flex', gap: '6px' }}>
                                <button
                                  type="button"
                                  title="Editar nivel"
                                  onClick={() => handleEditTier(i)}
                                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#0284c7', padding: '3px' }}
                                >
                                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  title="Eliminar nivel"
                                  onClick={() => handleRemoveTier(i)}
                                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '3px' }}
                                >
                                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '12px', color: '#64748b', fontSize: '12.5px', fontStyle: 'italic' }}>
                  Activa el interruptor para asignar metas escalonadas y porcentajes de comisión por vendedor.
                </div>
              )}
            </div>
          </div>

          {/* PIE DE ACCIONES FIJO */}
          <div className="settings-user-modal-footer">
            <button
              type="button"
              className="settings-user-footer-btn-clean"
              onClick={resetForm}
              disabled={loading}
            >
              Limpiar Formulario
            </button>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                type="button"
                className="settings-user-footer-btn-cancel"
                onClick={handleClose}
                disabled={loading}
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="settings-user-footer-btn-submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                      <polyline points="23 4 23 10 17 10" />
                      <polyline points="1 20 1 14 7 14" />
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                    </svg>
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>{selectedUserId ? 'Guardar Cambios' : 'Pre-registrar Usuario'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
