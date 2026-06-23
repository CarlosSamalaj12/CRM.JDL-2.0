import React, { useState, useEffect } from 'react';
import { loadState as loadCrmState, saveState as saveCrmState } from '../../services/stateService';
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
  
  // Form states
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('vendedor');
  const [active, setActive] = useState(true);
  const [salesTargetEnabled, setSalesTargetEnabled] = useState(false);
  const [goalTiers, setGoalTiers] = useState([]);

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

  // Media files states
  const [avatarDataUrl, setAvatarDataUrl] = useState('');
  const [signatureDataUrl, setSignatureDataUrl] = useState('');

  // Fetch all users on mount and listen to when the modal is made visible
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

  function resetForm() {
    setSelectedUserId('');
    setFullName('');
    setEmail('');
    setPhone('');
    setRole('vendedor');
    setActive(true);
    setSalesTargetEnabled(false);
    setGoalTiers([]);
    setAvatarDataUrl('');
    setSignatureDataUrl('');
    setTierName('');
    setTierAmount('');
    setTierPercentage('');
  }

  useEffect(() => {
    const handleOpenAddUser = () => {
      const backdrop = document.getElementById('userBackdrop');
      if (backdrop) backdrop.hidden = false;
      resetForm();
      fetchUsers();
    };

    const handleEditUser = (e) => {
      const backdrop = document.getElementById('userBackdrop');
      if (backdrop) backdrop.hidden = false;
      if (e.detail && e.detail.userId) {
        setSelectedUserId(e.detail.userId);
      }
      fetchUsers();
    };

    window.addEventListener('openAddUser', handleOpenAddUser);
    window.addEventListener('editUser', handleEditUser);

    fetchUsers();

    return () => {
      window.removeEventListener('openAddUser', handleOpenAddUser);
      window.removeEventListener('editUser', handleEditUser);
    };
  }, []);

  // When a user is selected to be edited
  useEffect(() => {
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
        setAvatarDataUrl(user.avatarDataUrl || '');
        setSignatureDataUrl(user.signatureDataUrl || '');
      }
    } else {
      resetForm();
    }
  }, [selectedUserId, users]);

  const saveState = async (updatedUsers) => {
    const currentState = await loadCrmState();
    await saveCrmState({ ...currentState, users: updatedUsers });
  };

  const toggleActive = async (userId) => {
    const updatedUsers = users.map(u => u.id === userId ? { ...u, active: !u.active } : u);
    try {
      await saveState(updatedUsers);
      setUsers(updatedUsers);
      if (selectedUserId === userId) {
        const found = updatedUsers.find(u => u.id === userId);
        if (found) setActive(found.active !== false);
      }
      toast.success('Estado actualizado correctamente.', { duration: 1500 });
    } catch (e) {
      console.error('Error modifying user status:', e);
      toast.error('No se pudo cambiar el estado del usuario.');
    }
  };

  const handleClose = () => {
    document.getElementById('userBackdrop').hidden = true;
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
      toast('Completa el nombre, monto y porcentaje del nivel.', { icon: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> });
      return;
    }
    const amt = parseFloat(String(tierAmount).replace(/,/g, ''));
    const pct = parseFloat(tierPercentage);
    if (isNaN(amt) || amt <= 0) {
      toast('El monto debe ser mayor a 0.', { icon: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> });
      return;
    }
    if (isNaN(pct) || pct <= 0) {
      toast('El porcentaje debe ser mayor a 0.', { icon: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> });
      return;
    }
    setGoalTiers(prev => [...prev, { name: tierName.trim(), amount: amt, percentage: pct }]);
    setTierName('');
    setTierAmount('');
    setTierPercentage('');
  };

  const handleRemoveTier = (index) => {
    setGoalTiers(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!fullName || !email || !role) {
      toast('Completa el Nombre Completo, Correo y Rol del usuario.', { icon: <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> });
      return;
    }

    try {
      setLoading(true);
      const currentState = await loadCrmState();
      const currentUsers = currentState.users || [];

      let updatedUsers = [...currentUsers];

      const nameTrimmed = fullName.trim().toLowerCase();
      const nameExists = selectedUserId
        ? currentUsers.some(u => (u.fullName || u.name || '').trim().toLowerCase() === nameTrimmed && u.id !== selectedUserId)
        : currentUsers.some(u => (u.fullName || u.name || '').trim().toLowerCase() === nameTrimmed);
      if (nameExists) {
        toast.error('Ya existe un usuario con ese nombre completo.');
        setLoading(false);
        return;
      }

      if (selectedUserId) {
        updatedUsers = updatedUsers.map(u => {
          if (u.id === selectedUserId) {
            return {
              ...u,
              name: fullName,
              fullName: fullName,
              username: email.split('@')[0],
              email: email.toLowerCase(),
              phone: phone,
              role: role,
              active: active,
              salesTargetEnabled: salesTargetEnabled,
              monthlyGoals: monthlyGoals,
              goalTiers: goalTiers,
              avatarDataUrl: avatarDataUrl,
              signatureDataUrl: signatureDataUrl,
            };
          }
          return u;
        });
      } else {
        const normalizedEmail = email.toLowerCase().trim();
        if (currentUsers.some(u => String(u.email || '').toLowerCase() === normalizedEmail)) {
          toast.error('El correo electrónico ya se encuentra pre-registrado en el sistema.');
          setLoading(false);
          return;
        }

        const newId = `user_prereg_${Date.now()}`;
        const newUser = {
          id: newId,
          name: fullName,
          fullName: fullName,
          username: normalizedEmail.split('@')[0],
          email: normalizedEmail,
          phone: phone,
          password: '',
          role: role,
          active: active,
          salesTargetEnabled: salesTargetEnabled,
          monthlyGoals: monthlyGoals,
          goalTiers: goalTiers,
          avatarDataUrl: avatarDataUrl,
          signatureDataUrl: signatureDataUrl,
        };

        updatedUsers.push(newUser);
      }

      await saveCrmState({ ...currentState, users: updatedUsers });

      toast.success(selectedUserId ? `Datos de ${fullName} actualizados.` : `${fullName} pre-registrado y autorizado.`, { duration: 2000 });

      window.dispatchEvent(new CustomEvent('usersUpdated'));
      await fetchUsers();
      handleClose();

    } catch (err) {
      console.error('Error saving user to global state:', err);
      toast.error('Ocurrió un error al guardar los datos del usuario.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="modalBackdrop" 
      id="userBackdrop" 
      hidden 
      onClick={(e) => { if (e.target.classList.contains('modalBackdrop')) handleClose(); }}
    >
      <div className="modal settings-user-modal" role="dialog" aria-modal="true" aria-labelledby="userTitle">
        <div className="modalHeader">
          <div>
            <div className="modalTitle" id="userTitle">
              Pre-registro e Invitaciones de Usuarios
            </div>
            <div className="modalSubtitle">
              Autorización de Google Login y asignación de roles operacionales
            </div>
          </div>
          <button className="btn-exit" id="btnUserClose" type="button" title="Cerrar" onClick={handleClose}>
            <svg className="crm-icon-x" viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4 4l10 10M14 4l-10 10" /></svg>
          </button>
        </div>

        <form id="userForm" className="settings-user-form" onSubmit={handleSave}>
          <div className="modalBody settings-user-body">
            {/* Google Login Info Banner */}
            <div className="settings-google-banner">
              <svg viewBox="0 0 24 24">
                <path fill="#EA4335" d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.198 2.698 1.24 6.65l4.026 3.115Z" />
                <path fill="#4285F4" d="M23.64 12.273c0-.818-.073-1.609-.208-2.373H12v4.582h6.54c-.28 1.514-1.134 2.8-2.42 3.668l3.8 2.946c2.227-2.055 3.52-5.073 3.52-8.823Z" />
                <path fill="#FBBC05" d="M5.266 14.235 1.24 17.35C3.198 21.302 7.27 24 12 24c3.155 0 5.8-1.045 7.732-2.846l-3.8-2.946c-1.055.709-2.409 1.127-3.932 1.127-3.555 0-6.564-2.4-7.636-5.636l-4.027 3.114-1.071 1.422Z" />
                <path fill="#34A853" d="M12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.198 2.698 1.24 6.65l4.026 3.115C2.31 9.764 5.318 4.909 12 4.909Z" />
              </svg>
              <div>
                <strong>Acceso Seguro con Google Accounts</strong>
                El personal se autentica de forma segura vía Google Login. Solo pre-registra el correo y asigna el rol operativo correspondiente.
              </div>
            </div>

            {/* Row 1: Mode + Active */}
            <div className="settings-field-group">
              <div className="settings-modern-field">
                <span>Modo de Operación</span>
                <div className={`settings-mode-indicator ${selectedUserId ? 'settings-mode-indicator--edit' : 'settings-mode-indicator--new'}`}>
                  <svg viewBox="0 0 24 24" style={{width: '18px', height: '18px', fill: 'none', stroke: 'currentColor', strokeWidth: 2, flexShrink: 0}}>
                    {selectedUserId ? (
                      <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    ) : (
                      <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></>
                    )}
                  </svg>
                  {selectedUserId ? (
                    <>
                      <span>Editando Usuario</span>
                      <button
                        type="button"
                        onClick={resetForm}
                        style={{
                          marginLeft: 'auto',
                          background: '#0284c7',
                          color: '#fff',
                          border: 'none',
                          padding: '3px 10px',
                          borderRadius: '6px',
                          fontSize: '10px',
                          cursor: 'pointer',
                          fontWeight: '800',
                        }}
                      >
                        Nuevo usuario
                      </button>
                    </>
                  ) : (
                    'Pre-registrar Nuevo Usuario'
                  )}
                </div>
              </div>

              <div className="settings-modern-field">
                <span>Estado de Acceso</span>
                <label className="settings-switch-inline">
                  <input
                    id="userActive"
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                  />
                  <span>ACCESO AUTORIZADO (ACTIVO)</span>
                </label>
              </div>
            </div>

            {/* Row 2: Name + Email */}
            <div className="settings-field-group">
              <label className="settings-modern-field">
                <span>Nombre completo</span>
                <input
                  id="userFullName"
                  type="text"
                  placeholder="Ej: Carlos Samalaj"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </label>
              <label className="settings-modern-field">
                <span>Correo de Google (Gmail / Institucional)</span>
                <input
                  id="userEmail"
                  type="email"
                  placeholder="correo@jardinesdellago.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
            </div>

            {/* Row 3: Phone + Role */}
            <div className="settings-field-group">
              <label className="settings-modern-field">
                <span>Teléfono móvil</span>
                <input
                  id="userPhone"
                  type="text"
                  placeholder="Ej: 5632-5547"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </label>
              <label className="settings-modern-field">
                <span>Rol del Usuario</span>
                <select
                  id="userRole"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="vendedor">Vendedor (Pipeline comercial y Cotizaciones)</option>
                  <option value="recepcionista">Recepcionista (Operación del Calendario)</option>
                  <option value="admin">Administrador (Acceso Total + Metas de Ventas)</option>
                  <option value="eventos">Eventos (Gestión de checklists y reportes)</option>
                  <option value="coordinador">Coordinador (Solo lectura: informes, checklists, ocupación)</option>
                </select>
              </label>
            </div>

            {/* Avatar + Signature */}
            <div className="settings-media-grid">
              {/* Profile Photo */}
              <div>
                <span className="settings-media-label">Fotografía / Avatar</span>
                <div className="settings-media-row">
                  <div className="settings-avatar-circle">
                    {avatarDataUrl ? (
                      <img src={avatarDataUrl} alt="Avatar" />
                    ) : (
                      <span style={{ fontSize: '24px', color: '#94a3b8' }}>👤</span>
                    )}
                  </div>
                  <div>
                    <input
                      id="userAvatar"
                      type="file"
                      accept="image/png,image/jpeg"
                      style={{ display: 'none' }}
                      onChange={(e) => handleFileUpload(e, 'avatar')}
                    />
                    <button
                      className="btn-mantenimiento"
                      type="button"
                      onClick={() => document.getElementById('userAvatar').click()}
                    >
                      Subir foto
                    </button>
                    <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>PNG o JPG (Máx. 2MB)</div>
                  </div>
                </div>
              </div>

              {/* Digital Signature */}
              <div>
                <span className="settings-media-label">Firma digital para cotizaciones</span>
                <div className="settings-media-row">
                  <div className="settings-signature-box">
                    {signatureDataUrl ? (
                      <img src={signatureDataUrl} alt="Firma" />
                    ) : (
                      <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>Sin firma registrada</span>
                    )}
                  </div>
                  <div>
                    <input
                      id="userSignature"
                      type="file"
                      accept="image/png,image/jpeg"
                      style={{ display: 'none' }}
                      onChange={(e) => handleFileUpload(e, 'signature')}
                    />
                    <button
                      className="btn-mantenimiento"
                      type="button"
                      onClick={() => document.getElementById('userSignature').click()}
                    >
                      Subir firma
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Goal Tiers - Comisiones */}
            <div className="settings-goals-section">
              <div className="settings-goals-header">
                <span className="settings-goals-title">🎯 Niveles de Meta y Comisiones</span>
                <label className="settings-goals-toggle">
                  <input
                    id="userSalesTargetEnabled"
                    type="checkbox"
                    checked={salesTargetEnabled}
                    onChange={(e) => setSalesTargetEnabled(e.target.checked)}
                  />
                  <span>Habilitar metas y comisiones</span>
                </label>
              </div>

              {salesTargetEnabled ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Tier Inputs */}
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>Niveles de Meta</div>
                  <div className="settings-goals-input-row" style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                    <div className="settings-modern-field" style={{ flex: '1 1 140px' }}>
                      <span>Nombre del nivel</span>
                      <input type="text" placeholder="Ej: Meta Media" value={tierName} onChange={(e) => setTierName(e.target.value)} />
                    </div>
                    <div className="settings-modern-field" style={{ flex: '0 0 130px' }}>
                      <span>Monto mínimo Q</span>
                      <input
                        type="text"
                        placeholder="Q 160,000"
                        value={tierAmount}
                        onChange={(e) => {
                          const val = e.target.value;
                          const clean = val.replace(/[^0-9.,]/g, '');
                          setTierAmount(formatNumberWithCommas(clean));
                        }}
                      />
                    </div>
                    <div className="settings-modern-field" style={{ flex: '0 0 110px' }}>
                      <span>% Comisión</span>
                      <input type="number" min="0" step="0.1" placeholder="Ej: 2.5" value={tierPercentage} onChange={(e) => setTierPercentage(e.target.value)} />
                    </div>
                    <button className="btn-cotizar" type="button" onClick={handleAddTier} style={{ marginBottom: '1px' }}>Agregar</button>
                  </div>

                  {/* Tiers Table */}
                  <div className="settings-modern-field">
                    <span>Niveles configurados</span>
                    <div className="settings-goals-table-wrap">
                      <table>
                        <thead><tr><th>Nivel</th><th>Monto mínimo</th><th>% Comisión</th><th style={{ width: '40px' }}></th></tr></thead>
                        <tbody id="userTiersBody">
                          {goalTiers.length === 0 ? (
                            <tr><td colSpan="4" style={{ textAlign: 'center', padding: '12px', color: '#64748b', fontSize: '12px', fontStyle: 'italic' }}>Sin niveles configurados. Agrega niveles como Meta Media, Meta Alta, etc.</td></tr>
                          ) : (
                            goalTiers.map((t, i) => (
                              <tr key={i}>
                                <td style={{ fontWeight: '600' }}>{t.name}</td>
                                <td style={{ fontWeight: '700', color: '#059669' }}>Q {t.amount.toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td style={{ fontWeight: '700', color: '#2563eb' }}>{t.percentage}%</td>
                                <td style={{ textAlign: 'center' }}>
                                  <button type="button" className="settings-goal-delete-btn" title="Eliminar nivel" onClick={() => handleRemoveTier(i)}>✕</button>
                                </td>
                            </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '10px', color: '#64748b', fontSize: '12px', fontStyle: 'italic' }}>
                  Marca la casilla superior para configurar los niveles de meta y comisiones.
                </div>
              )}
            </div>

          </div>

          {/* Footer */}
          <div className="modalFooter" style={{ padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', flexShrink: 0 }}>
            <div className="leftActions">
              <button className="btn-cancel" type="button" onClick={resetForm}>
                Limpiar Formulario
              </button>
            </div>
            <div className="rightActions" style={{ display: 'flex', gap: '10px' }}>
              <button className="btn-exit" type="button" onClick={handleClose}>
                Cancelar
              </button>
              <button className="btn-teal" id="btnUserSubmit" type="submit" disabled={loading}>
                {loading ? 'Guardando...' : (selectedUserId ? 'Guardar Cambios' : 'Pre-registrar Usuario')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
