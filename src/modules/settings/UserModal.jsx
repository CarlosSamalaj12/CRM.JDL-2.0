import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import Swal from 'sweetalert2';

const ROLE_COLORS = {
  admin: { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  recepcionista: { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' },
  vendedor: { bg: '#dcfce7', color: '#166534', border: '#86efac' },
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
  const [monthlyGoals, setMonthlyGoals] = useState([]);
  
  // Goal inputs
  const [goalMonth, setGoalMonth] = useState('');
  const [goalAmount, setGoalAmount] = useState('');

  // Media files states
  const [avatarDataUrl, setAvatarDataUrl] = useState('');
  const [signatureDataUrl, setSignatureDataUrl] = useState('');

  // Fetch all users on mount and listen to when the modal is made visible
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/state', { t: Date.now() });
      const allUsers = response?.state?.users || [];
      setUsers(allUsers);
    } catch (err) {
      console.error('Error fetching users from state:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();

    // Listen to visibility changes on the backdrop using a MutationObserver
    const backdrop = document.getElementById('userBackdrop');
    if (!backdrop) return;

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'hidden') {
          if (!backdrop.hidden) {
            fetchUsers();
            resetForm();
          }
        }
      });
    });

    observer.observe(backdrop, { attributes: true });
    return () => observer.disconnect();
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
        setMonthlyGoals(user.monthlyGoals || []);
        setAvatarDataUrl(user.avatarDataUrl || '');
        setSignatureDataUrl(user.signatureDataUrl || '');
      }
    } else {
      resetForm();
    }
  }, [selectedUserId, users]);

  const resetForm = () => {
    setSelectedUserId('');
    setFullName('');
    setEmail('');
    setPhone('');
    setRole('vendedor');
    setActive(true);
    setSalesTargetEnabled(false);
    setMonthlyGoals([]);
    setAvatarDataUrl('');
    setSignatureDataUrl('');
    setGoalMonth('');
    setGoalAmount('');
  };

  const saveState = async (updatedUsers) => {
    const res = await api.get('/api/state', { t: Date.now() });
    const currentState = res?.state || {};
    await api.put('/api/state', { state: { ...currentState, users: updatedUsers } });
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
      Swal.fire({
        icon: 'success',
        title: 'Estado Actualizado',
        text: 'El estado del usuario se ha actualizado correctamente.',
        confirmButtonColor: '#10b981',
        timer: 1500,
        showConfirmButton: false
      });
    } catch (e) {
      console.error('Error modifying user status:', e);
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo cambiar el estado del usuario.' });
    }
  };

  const handleClose = () => {
    document.getElementById('userBackdrop').hidden = true;
    if (onClose) onClose();
  };

  // Convert uploaded files to base64
  const handleFileUpload = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (type === 'avatar') {
        setAvatarDataUrl(event.target.result);
      } else if (type === 'signature') {
        setSignatureDataUrl(event.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Add monthly goal to list
  const handleAddGoal = () => {
    if (!goalMonth || !goalAmount) {
      Swal.fire({
        icon: 'warning',
        title: 'Campos incompletos',
        text: 'Por favor, selecciona un mes y escribe el monto de la meta.',
        confirmButtonColor: '#0ea5e9'
      });
      return;
    }

    // Check if goal for this month already exists
    if (monthlyGoals.some(g => g.month === goalMonth)) {
      Swal.fire({
        icon: 'warning',
        title: 'Meta duplicada',
        text: 'Ya has registrado una meta para este mes. Modifica o elimina la anterior.',
        confirmButtonColor: '#0ea5e9'
      });
      return;
    }

    setMonthlyGoals(prev => [
      ...prev,
      { month: goalMonth, amount: parseFloat(goalAmount) }
    ].sort((a, b) => b.month.localeCompare(a.month))); // Sort descending

    setGoalMonth('');
    setGoalAmount('');
  };

  // Remove goal from list
  const handleRemoveGoal = (monthToRemove) => {
    setMonthlyGoals(prev => prev.filter(g => g.month !== monthToRemove));
  };

  // Submit and save state
  const handleSave = async (e) => {
    e.preventDefault();
    if (!fullName || !email || !role) {
      Swal.fire({
        icon: 'warning',
        title: 'Faltan datos',
        text: 'Completa el Nombre Completo, Correo y Rol del usuario.',
        confirmButtonColor: '#0ea5e9'
      });
      return;
    }

    try {
      setLoading(true);
      const response = await api.get('/api/state', { t: Date.now() });
      const currentState = response?.state || {};
      const currentUsers = currentState.users || [];

      let updatedUsers = [...currentUsers];

      if (selectedUserId) {
        // Edit existing user
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
              avatarDataUrl: avatarDataUrl,
              signatureDataUrl: signatureDataUrl,
            };
          }
          return u;
        });
      } else {
        // Check if email already registered
        const normalizedEmail = email.toLowerCase().trim();
        if (currentUsers.some(u => String(u.email || '').toLowerCase() === normalizedEmail)) {
          Swal.fire({
            icon: 'error',
            title: 'Correo duplicado',
            text: 'El correo electrónico ingresado ya se encuentra pre-registrado en el sistema.',
            confirmButtonColor: '#ef4444'
          });
          setLoading(false);
          return;
        }

        // Add pre-registered user (will be linked to Google UID on first sign in)
        const newId = `user_prereg_${Date.now()}`;
        const newUser = {
          id: newId,
          name: fullName,
          fullName: fullName,
          username: normalizedEmail.split('@')[0],
          email: normalizedEmail,
          phone: phone,
          password: '', // Redundant field, authenticated via Google
          role: role,
          active: active,
          salesTargetEnabled: salesTargetEnabled,
          monthlyGoals: monthlyGoals,
          avatarDataUrl: avatarDataUrl,
          signatureDataUrl: signatureDataUrl,
        };

        updatedUsers.push(newUser);
      }

      // Save state to MariaDB via state replication route
      await api.put('/api/state', { state: { ...currentState, users: updatedUsers } });

      Swal.fire({
        icon: 'success',
        title: '¡Guardado Exitosamente!',
        text: selectedUserId 
          ? `Se han actualizado los datos de ${fullName}.` 
          : `Se ha pre-registrado y autorizado el correo de ${fullName}.`,
        confirmButtonColor: '#10b981',
        timer: 2000,
        showConfirmButton: false
      });

      // Refetch and close
      await fetchUsers();
      handleClose();

    } catch (err) {
      console.error('Error saving user to global state:', err);
      Swal.fire({
        icon: 'error',
        title: 'Error al Guardar',
        text: 'Ocurrió un error al guardar los datos del usuario en el servidor.',
        confirmButtonColor: '#ef4444'
      });
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
      <style>{`
        .glass-modal {
          background: #ffffff !important;
          border: 1px solid #cbd5e1 !important;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15) !important;
          border-radius: 16px !important;
          overflow: hidden;
          width: 95%;
          max-width: 920px !important;
          height: min(820px, 85vh) !important;
          max-height: 90vh !important;
          display: flex;
          flex-direction: column;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .premium-info-banner {
          display: flex;
          gap: 16px;
          background: #f0f9ff !important;
          border: 1px solid #bae6fd !important;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 24px;
          align-items: flex-start;
          box-shadow: 0 4px 15px -3px rgba(14, 165, 233, 0.05);
        }

        .premium-info-icon {
          font-size: 28px;
          color: #0284c7 !important;
          animation: pulse 2s infinite;
        }

        .premium-info-text {
          color: #334155 !important;
          font-size: 13px;
          line-height: 1.6;
        }

        .premium-info-text strong {
          color: #0369a1 !important;
          display: block;
          margin-bottom: 4px;
          font-size: 14px;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.05); }
        }

        .field-group {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
        }

        @media (max-width: 640px) {
          .field-group {
            grid-template-columns: 1fr;
            gap: 15px;
          }
        }

        .modern-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .modern-field span {
          color: #475569 !important;
          font-size: 12.5px;
          font-weight: 700;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        .modern-field input, .modern-field select, .modern-field textarea {
          background: #ffffff !important;
          border: 1px solid #cbd5e1 !important;
          color: #0f172a !important;
          padding: 11px 16px !important;
          border-radius: 8px !important;
          font-size: 14px !important;
          transition: all 0.2s ease;
        }

        .modern-field input:focus, .modern-field select:focus {
          border-color: #0ea5e9 !important;
          box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.15) !important;
          background: #ffffff !important;
          outline: none;
        }

        .avatar-upload-wrap {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .avatar-preview-box {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          overflow: hidden;
          background: #f1f5f9;
          border: 2px solid #0d9488;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .avatar-preview-box img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .avatar-placeholder {
          font-size: 28px;
          color: #94a3b8;
        }

        .signature-preview-box {
          height: 80px;
          background: #f8fafc;
          border: 1.5px dashed #cbd5e1;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          margin-top: 8px;
        }

        .signature-preview-box img {
          max-height: 90%;
          max-width: 90%;
          object-fit: contain;
        }

        .signature-placeholder {
          color: #64748b;
          font-size: 13px;
        }

        .premium-switch-inline {
          display: flex;
          align-items: center;
          gap: 12px;
          background: #f8fafc !important;
          border: 1px solid #cbd5e1 !important;
          padding: 12px 16px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .premium-switch-inline:hover {
          background: #f1f5f9 !important;
          border-color: #94a3b8 !important;
        }

        .premium-switch-inline input[type="checkbox"] {
          width: 18px;
          height: 18px;
          accent-color: #0d9488 !important;
          cursor: pointer;
        }

        .premium-switch-inline span {
          color: #334155 !important;
          font-size: 13.5px;
          user-select: none;
        }

        .goals-input-grid {
          display: flex;
          gap: 12px;
          margin-top: 8px;
        }

        .goals-table-container {
          background: #ffffff !important;
          border: 1px solid #cbd5e1 !important;
          border-radius: 8px;
          max-height: 150px;
          overflow-y: auto;
          margin-top: 12px;
        }

        .goals-table-container table {
          width: 100%;
          border-collapse: collapse;
        }

        .goals-table-container th {
          background: #f8fafc !important;
          color: #475569 !important;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          text-align: left;
          padding: 8px 12px;
          position: sticky;
          top: 0;
        }

        .goals-table-container td {
          padding: 8px 12px;
          border-bottom: 1px solid #f1f5f9 !important;
          color: #1e293b !important;
          font-size: 13px;
        }

        .goal-delete-btn {
          background: transparent;
          border: none;
          color: #ef4444;
          cursor: pointer;
          font-size: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 4px;
          border-radius: 4px;
          transition: all 0.15s ease;
        }

        .goal-delete-btn:hover {
          background: rgba(239, 68, 68, 0.15);
        }

        .usr-table { width: 100%; min-width: 500px; border-collapse: collapse; background: #ffffff; table-layout: auto; }
        .usr-table th { background: #f1f5f9 !important; color: #475569 !important; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; padding: 10px 14px; text-align: left; border-bottom: 2px solid #e2e8f0 !important; }
        .usr-table tbody tr { background: #ffffff !important; }
        .usr-table tbody tr:nth-child(even) { background: #f8fafc !important; }
        .usr-table td { padding: 12px 14px !important; border-bottom: 1px solid #f1f5f9 !important; vertical-align: middle !important; color: #1e293b !important; background: transparent; font-size: 13px !important; }
        .usr-table tr:last-child td { border-bottom: none !important; }
        .usr-table tbody tr:hover td { background: #eff6ff !important; color: #0f172a !important; }
        .usr-row-editing td { background: #f0f9ff !important; }
        .role-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; border: 1px solid; }
        .usr-icon-btn { background: none !important; border: none; cursor: pointer; padding: 6px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; transition: background 0.15s; }
        .usr-icon-btn:hover { background: #f1f5f9 !important; }
        .usr-icon-btn.danger:hover { background: #fee2e2 !important; }
        .usr-icon-btn.success:hover { background: #dcfce7 !important; }
        .usr-switch { position: relative; display: inline-block; width: 38px; height: 22px; }
        .usr-switch input { opacity: 0; width: 0; height: 0; }
        .usr-slider { position: absolute; cursor: pointer; inset: 0; background: #cbd5e1 !important; border-radius: 22px; transition: 0.25s; }
        .usr-slider:before { content: ''; position: absolute; height: 16px; width: 16px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: 0.25s; }
        input:checked + .usr-slider { background: #10b981 !important; }
        input:checked + .usr-slider:before { transform: translateX(16px); }
      `}</style>

      <div className="modal glass-modal" role="dialog" aria-modal="true" aria-labelledby="userTitle">
        <div className="modalHeader" style={{ borderBottom: '1px solid #cbd5e1', paddingBottom: '16px' }}>
          <div>
            <div className="modalTitle" id="userTitle" style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-outlined" style={{ color: '#0284c7' }}>person_add</span>
              Pre-registro e Invitaciones de Usuarios
            </div>
            <div className="modalSubtitle" style={{ color: '#475569' }}>
              Autorización de Google Login y asignación de roles operacionales
            </div>
          </div>
          <button className="iconBtn" id="btnUserClose" type="button" title="Cerrar" onClick={handleClose} style={{ color: '#64748b' }}>&#10005;</button>
        </div>

        <form id="userForm" onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
          <div className="modalBody" style={{ padding: '24px 32px', overflowY: 'auto', flex: 1, minHeight: 0, display: 'block', width: '100%', boxSizing: 'border-box' }}>
          
          {/* Elegant Google Secure Login Info Banner */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '16px', 
            background: '#f0f9ff', 
            border: '1px solid #bae6fd', 
            borderRadius: '12px', 
            padding: '14px 20px', 
            marginBottom: '24px' 
          }}>
            <svg viewBox="0 0 24 24" style={{ width: '28px', height: '28px', flexShrink: 0 }}>
              <path fill="#EA4335" d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.198 2.698 1.24 6.65l4.026 3.115Z" />
              <path fill="#4285F4" d="M23.64 12.273c0-.818-.073-1.609-.208-2.373H12v4.582h6.54c-.28 1.514-1.134 2.8-2.42 3.668l3.8 2.946c2.227-2.055 3.52-5.073 3.52-8.823Z" />
              <path fill="#FBBC05" d="M5.266 14.235 1.24 17.35C3.198 21.302 7.27 24 12 24c3.155 0 5.8-1.045 7.732-2.846l-3.8-2.946c-1.055.709-2.409 1.127-3.932 1.127-3.555 0-6.564-2.4-7.636-5.636l-4.027 3.114-1.071 1.422Z" />
              <path fill="#34A853" d="M12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.198 2.698 1.24 6.65l4.026 3.115C2.31 9.764 5.318 4.909 12 4.909Z" />
            </svg>
            <div style={{ fontSize: '13px', color: '#0369a1', lineHeight: '1.5' }}>
              <strong style={{ color: '#0284c7', display: 'block', marginBottom: '2px' }}>Acceso Seguro con Google Accounts</strong>
              El personal se autentica de forma segura vía Google Login. Solo pre-registra el correo y asigna el rol operativo correspondiente.
            </div>
          </div>

          <div className="field-group" style={{ marginBottom: '24px' }}>
            <div className="modern-field">
              <span>Modo de Operación</span>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: selectedUserId ? '#f0f9ff' : '#f0fdf4',
                border: selectedUserId ? '1px solid #bae6fd' : '1px solid #bbf7d0',
                padding: '11px 16px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                color: selectedUserId ? '#0369a1' : '#15803d',
                height: '100%',
                boxSizing: 'border-box'
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>
                  {selectedUserId ? 'edit' : 'person_add'}
                </span>
                {selectedUserId ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'space-between' }}>
                    <span>Editando Usuario</span>
                    <button 
                      type="button" 
                      onClick={resetForm}
                      style={{ 
                        background: '#0284c7', 
                        color: '#fff', 
                        border: 'none', 
                        padding: '2px 8px', 
                        borderRadius: '4px', 
                        fontSize: '11px', 
                        cursor: 'pointer',
                        fontWeight: '700'
                      }}
                    >Nuevo usuario</button>
                  </div>
                ) : 'Pre-registrar Nuevo Usuario'}
              </div>
            </div>
 
            <div className="modern-field">
              <span>Estado de Acceso</span>
              <label className="premium-switch-inline" style={{ height: '100%', boxSizing: 'border-box' }}>
                <input 
                  id="userActive" 
                  type="checkbox" 
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                />
                <span style={{ fontWeight: '700', color: '#1e293b' }}>ACCESO AUTORIZADO (ACTIVO)</span>
              </label>
            </div>
          </div>

          {/* Form Personal Details Inputs */}
          <div className="field-group" style={{ marginBottom: '20px' }}>
            <label className="modern-field">
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
            <label className="modern-field">
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

          <div className="field-group" style={{ marginBottom: '24px' }}>
            <label className="modern-field">
              <span>Teléfono móvil</span>
              <input 
                id="userPhone" 
                type="text" 
                placeholder="Ej: 5632-5547" 
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>
            <label className="modern-field">
              <span>Rol del Usuario</span>
              <select 
                id="userRole"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="vendedor">Vendedor (Pipeline comercial y Cotizaciones)</option>
                <option value="recepcionista">Recepcionista (Operación del Calendario)</option>
                <option value="admin">Administrador (Acceso Total + Metas de Ventas)</option>
              </select>
            </label>
          </div>

          {/* Professional Avatar and Signature Section */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr', 
            gap: '24px', 
            background: '#f8fafc', 
            padding: '20px', 
            borderRadius: '12px', 
            border: '1px solid #e2e8f0', 
            marginBottom: '24px' 
          }}>
            {/* Profile Photo */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Fotografía / Avatar</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '4px' }}>
                <div style={{ 
                  width: '64px', 
                  height: '64px', 
                  borderRadius: '50%', 
                  overflow: 'hidden', 
                  border: '2px solid #cbd5e1', 
                  background: '#ffffff', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  flexShrink: 0 
                }}>
                  {avatarDataUrl ? (
                    <img src={avatarDataUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Avatar" />
                  ) : (
                    <span style={{ fontSize: '28px', color: '#94a3b8' }}>👤</span>
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
                    style={{ padding: '8px 16px', fontSize: '13px', minHeight: '36px' }}
                    onClick={() => document.getElementById('userAvatar').click()}
                  >
                    Subir foto
                  </button>
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>PNG o JPG (Máx. 2MB)</div>
                </div>
              </div>
            </div>

            {/* Digital Signature */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Firma digital para cotizaciones</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '4px' }}>
                <div style={{ 
                  flex: 1, 
                  height: '64px', 
                  border: '1.5px dashed #cbd5e1', 
                  borderRadius: '8px', 
                  background: '#ffffff', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  overflow: 'hidden', 
                  padding: '4px' 
                }}>
                  {signatureDataUrl ? (
                    <img src={signatureDataUrl} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} alt="Firma" />
                  ) : (
                    <span style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>Sin firma registrada</span>
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
                    style={{ padding: '8px 16px', fontSize: '13px', minHeight: '36px' }}
                    onClick={() => document.getElementById('userSignature').click()}
                  >
                    Subir firma
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Collapsible Monthly Sales Target Section */}
          <div style={{ 
            background: '#f8fafc', 
            padding: '20px', 
            borderRadius: '12px', 
            border: '1px solid #cbd5e1', 
            marginBottom: '24px' 
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              borderBottom: '1px solid #cbd5e1', 
              paddingBottom: '12px', 
              marginBottom: '16px' 
            }}>
              <span style={{ fontSize: '13px', fontWeight: '800', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>📈 Configuración de Metas Comerciales</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input 
                  id="userSalesTargetEnabled" 
                  type="checkbox" 
                  checked={salesTargetEnabled}
                  onChange={(e) => setSalesTargetEnabled(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#0d9488' }}
                />
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#475569' }}>Influir en metas mensuales</span>
              </label>
            </div>

            {salesTargetEnabled ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                  <label className="modern-field" style={{ flex: 1 }}>
                    <span>Seleccionar Mes</span>
                    <input 
                      id="userGoalMonth" 
                      type="month" 
                      value={goalMonth}
                      onChange={(e) => setGoalMonth(e.target.value)}
                    />
                  </label>
                  <label className="modern-field" style={{ flex: 1 }}>
                    <span>Monto de la Meta</span>
                    <input 
                      id="userGoalAmount" 
                      type="number" 
                      min="0" 
                      step="0.01" 
                      placeholder="Monto Q." 
                      value={goalAmount}
                      onChange={(e) => setGoalAmount(e.target.value)}
                    />
                  </label>
                  <button 
                    className="btn-cotizar" 
                    id="btnUserGoalAdd" 
                    type="button"
                    onClick={handleAddGoal}
                    style={{ padding: '10px 20px', minHeight: '38px', borderRadius: '8px' }}
                  >
                    Agregar Meta
                  </button>
                </div>

                <div className="modern-field">
                  <span>Historial de Metas Mensuales del Vendedor</span>
                  <div className="goals-table-container" style={{ border: '1px solid #cbd5e1', borderRadius: '8px', background: '#ffffff', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                          <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '800', color: '#475569' }}>Mes / Año</th>
                          <th style={{ padding: '8px 12px', fontSize: '11px', fontWeight: '800', color: '#475569' }}>Monto asignado</th>
                          <th style={{ width: '40px' }}></th>
                        </tr>
                      </thead>
                      <tbody id="userGoalsBody">
                        {monthlyGoals.length === 0 ? (
                          <tr>
                            <td colSpan="3" style={{ textAlign: 'center', padding: '12px', color: '#64748b', fontSize: '13px', fontStyle: 'italic' }}>
                              Sin metas mensuales registradas
                            </td>
                          </tr>
                        ) : (
                          monthlyGoals.map(g => (
                            <tr key={g.month} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '8px 12px', fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>{g.month}</td>
                              <td style={{ padding: '8px 12px', fontSize: '13px', fontWeight: '700', color: '#10b981' }}>
                                Q {parseFloat(g.amount).toLocaleString('es-GT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td style={{ padding: '4px', textAlign: 'center' }}>
                                <button 
                                  type="button" 
                                  className="goal-delete-btn" 
                                  title="Eliminar meta"
                                  onClick={() => handleRemoveGoal(g.month)}
                                >
                                  ❌
                                </button>
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
              <div style={{ textAlign: 'center', padding: '12px', color: '#64748b', fontSize: '13.5px', fontStyle: 'italic' }}>
                Marca la casilla superior para configurar las metas y objetivos comerciales de este vendedor.
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={{ margin: '32px 0 24px 0', height: '1px', background: '#cbd5e1' }}></div>

          {/* Table Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-outlined" style={{ color: '#0ea5e9' }}>group</span>
                Usuarios Registrados ({users.length})
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                Lista de cuentas autorizadas. Haz clic en "Editar" para modificar sus datos o metas comerciales.
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '12px', overflowX: 'auto', overflowY: 'visible', marginBottom: '24px', width: '100%', boxSizing: 'border-box', flexShrink: 0 }}>
            {loading ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>Cargando usuarios...</div>
            ) : users.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>No hay usuarios autorizados.</div>
            ) : (
              <table className="usr-table" style={{ width: '100%', minWidth: '500px', borderCollapse: 'collapse', background: '#ffffff', tableLayout: 'auto' }}>
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Correo</th>
                    <th>Teléfono</th>
                    <th>Rol</th>
                    <th style={{ textAlign: 'center' }}>Activo</th>
                    <th style={{ textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => {
                    const isSelected = selectedUserId === u.id;
                    const roleLabel = u.role === 'admin' ? 'Administrador' : u.role === 'recepcionista' ? 'Recepcionista' : 'Vendedor';
                    const roleStyle = ROLE_COLORS[u.role] || ROLE_COLORS.vendedor;
                    const avatarUrl = u.avatarDataUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.fullName || u.name || '?')}&background=0ea5e9&color=fff&size=80`;
                    const isActive = u.active !== false;

                    return (
                      <tr 
                        key={u.id} 
                        className={isSelected ? 'usr-row-editing' : ''}
                        style={{ background: '#ffffff', color: '#1e293b' }}
                      >
                        <td style={{ color: '#1e293b', background: 'transparent' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <img 
                              src={avatarUrl} 
                              alt="" 
                              style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #cbd5e1' }} 
                            />
                            <div>
                              <div style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a' }}>{u.fullName || u.name}</div>
                              <div style={{ fontSize: '11px', color: '#64748b' }}>{u.username || '—'}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ color: '#1e293b', background: 'transparent' }}>
                          {u.email || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Sin correo</span>}
                        </td>
                        <td style={{ color: '#1e293b', background: 'transparent' }}>
                          {u.phone || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>—</span>}
                        </td>
                        <td>
                          <span className="role-badge" style={{ background: roleStyle.bg, color: roleStyle.color, borderColor: roleStyle.border }}>
                            {roleLabel}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <label className="usr-switch" title={isActive ? 'Activo - clic para desactivar' : 'Inactivo - clic para activar'}>
                            <input type="checkbox" checked={isActive} onChange={() => toggleActive(u.id)} />
                            <span className="usr-slider"></span>
                          </label>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="usr-icon-btn"
                            title="Editar usuario"
                            onClick={() => setSelectedUserId(u.id)}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#0ea5e9' }}>edit</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Close of modalBody */}
          </div>

          {/* Modal Action Buttons Footer */}
          <div className="modalFooter" style={{ borderTop: '1px solid #cbd5e1', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', flexShrink: 0 }}>
            <div className="leftActions">
              <button 
                className="btn-cancel" 
                type="button" 
                onClick={resetForm}
                style={{ padding: '10px 20px', borderRadius: '8px' }}
              >
                Limpiar Formulario
              </button>
            </div>
            <div className="rightActions" style={{ display: 'flex', gap: '12px' }}>
              <button 
                className="btn-cancel" 
                type="button" 
                onClick={handleClose}
                style={{ padding: '10px 20px', borderRadius: '8px' }}
              >
                Cancelar
              </button>
              <button 
                className="btn-teal" 
                id="btnUserSubmit" 
                type="submit"
                disabled={loading}
                style={{ padding: '11px 24px', borderRadius: '8px' }}
              >
                {loading ? 'Guardando...' : (selectedUserId ? 'Guardar Cambios' : 'Pre-registrar Usuario')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}