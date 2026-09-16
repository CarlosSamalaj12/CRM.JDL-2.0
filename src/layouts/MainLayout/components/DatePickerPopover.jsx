import React, { useState, useEffect, useRef, useMemo } from 'react';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const MONTH_SHORT = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

const DAY_LETTERS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

function formatISODate(date) {
  if (!date || isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function DatePickerPopover({
  isOpen,
  onClose,
  currentDate = new Date(),
  onSelectDate
}) {
  const popoverRef = useRef(null);

  const safeCurrentDate = useMemo(() => {
    return currentDate instanceof Date && !isNaN(currentDate.getTime())
      ? currentDate
      : new Date();
  }, [currentDate]);

  const [activeTab, setActiveTab] = useState('date'); // 'date' | 'month' | 'year'
  const [navYear, setNavYear] = useState(() => safeCurrentDate.getFullYear());
  const [navMonth, setNavMonth] = useState(() => safeCurrentDate.getMonth());
  const [directDate, setDirectDate] = useState(() => formatISODate(safeCurrentDate));
  const [yearBlockStart, setYearBlockStart] = useState(() => {
    const y = safeCurrentDate.getFullYear();
    return Math.floor(y / 12) * 12;
  });

  // Sync state whenever popover opens or currentDate changes
  useEffect(() => {
    if (isOpen) {
      const y = safeCurrentDate.getFullYear();
      const m = safeCurrentDate.getMonth();
      setNavYear(y);
      setNavMonth(m);
      setDirectDate(formatISODate(safeCurrentDate));
      setYearBlockStart(Math.floor(y / 12) * 12);
    }
  }, [isOpen, safeCurrentDate]);

  // Click outside and Escape key handling (Safari + Mobile touch support)
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside, { passive: true });
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const today = new Date();

  // Navigation handlers for Fecha/Día tab
  const handlePrevMonth = (e) => {
    e.stopPropagation();
    if (navMonth === 0) {
      setNavMonth(11);
      setNavYear(y => y - 1);
    } else {
      setNavMonth(m => m - 1);
    }
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    if (navMonth === 11) {
      setNavMonth(0);
      setNavYear(y => y + 1);
    } else {
      setNavMonth(m => m + 1);
    }
  };

  // Calendar cells for Month
  const calendarCells = () => {
    const firstDayIndex = new Date(navYear, navMonth, 1).getDay(); // 0 is Sunday
    const daysInMonth = new Date(navYear, navMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(navYear, navMonth, 0).getDate();

    const cells = [];

    // Trailing days from previous month
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const prevMonthIndex = navMonth === 0 ? 11 : navMonth - 1;
      const prevYear = navMonth === 0 ? navYear - 1 : navYear;
      cells.push({
        day: dayNum,
        month: prevMonthIndex,
        year: prevYear,
        isCurrentMonth: false
      });
    }

    // Days in current month
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        day: d,
        month: navMonth,
        year: navYear,
        isCurrentMonth: true
      });
    }

    // Leading days of next month (fill up to 42 cells)
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
      const nextMonthIndex = navMonth === 11 ? 0 : navMonth + 1;
      const nextYear = navMonth === 11 ? navYear + 1 : navYear;
      cells.push({
        day: d,
        month: nextMonthIndex,
        year: nextYear,
        isCurrentMonth: false
      });
    }

    return cells;
  };

  const handleSelectDay = (cell) => {
    const selected = new Date(cell.year, cell.month, cell.day);
    if (onSelectDate) onSelectDate(selected);
    onClose();
  };

  const handleSelectMonth = (mIndex) => {
    const daysInTargetMonth = new Date(navYear, mIndex + 1, 0).getDate();
    const safeDay = Math.min(safeCurrentDate.getDate(), daysInTargetMonth);
    const selected = new Date(navYear, mIndex, safeDay);
    if (onSelectDate) onSelectDate(selected);
    onClose();
  };

  const handleSelectYear = (year) => {
    const daysInTargetMonth = new Date(year, safeCurrentDate.getMonth() + 1, 0).getDate();
    const safeDay = Math.min(safeCurrentDate.getDate(), daysInTargetMonth);
    const selected = new Date(year, safeCurrentDate.getMonth(), safeDay);
    if (onSelectDate) onSelectDate(selected);
    onClose();
  };

  const handleDirectDateSubmit = (e) => {
    e.preventDefault();
    if (!directDate) return;
    const parts = directDate.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        const selected = new Date(y, m, d);
        if (onSelectDate) onSelectDate(selected);
        onClose();
      }
    }
  };

  const handleGoToday = () => {
    if (onSelectDate) onSelectDate(new Date());
    onClose();
  };

  const handleGoThisMonth = () => {
    const now = new Date();
    if (onSelectDate) onSelectDate(new Date(now.getFullYear(), now.getMonth(), 1));
    onClose();
  };

  const yearsInBlock = Array.from({ length: 12 }, (_, i) => yearBlockStart + i);

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Selector rápido de fecha, mes y año"
      style={{
        position: 'absolute',
        top: 'calc(100% + 6px)',
        left: 0,
        width: '260px',
        backgroundColor: '#ffffff',
        borderRadius: '10px',
        boxShadow: '0 12px 28px -4px rgba(15, 23, 42, 0.16), 0 4px 10px -2px rgba(15, 23, 42, 0.08)',
        border: '1px solid #cbd5e1',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxSizing: 'border-box',
        WebkitBoxSizing: 'border-box',
        WebkitBackfaceVisibility: 'hidden',
        animation: 'datePickerPop 0.12s cubic-bezier(0.16, 1, 0.3, 1)',
        fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}
    >
      <style>{`
        @keyframes datePickerPop {
          from {
            opacity: 0;
            transform: translateY(-4px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .dp-safari-input::-webkit-calendar-picker-indicator {
          cursor: pointer;
          opacity: 0.6;
          padding: 0;
          margin: 0;
          transform: scale(0.85);
        }
        .dp-safari-input::-webkit-inner-spin-button {
          display: none;
          -webkit-appearance: none;
        }
      `}</style>

      {/* ─── TABS HEADER (Minimalist SVGs, NO emojis) ─── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '4px',
        backgroundColor: '#f8fafc',
        borderBottom: '1px solid #e2e8f0',
        gap: '3px',
        boxSizing: 'border-box'
      }}>
        {[
          {
            key: 'date',
            label: 'Día',
            icon: (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            )
          },
          {
            key: 'month',
            label: 'Mes',
            icon: (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"/>
                <rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/>
              </svg>
            )
          },
          {
            key: 'year',
            label: 'Año',
            icon: (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            )
          }
        ].map(tab => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1,
                padding: '4px 0',
                fontSize: '10.5px',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#065f46' : '#64748b',
                backgroundColor: isActive ? '#ffffff' : 'transparent',
                border: isActive ? '1px solid #cbd5e1' : '1px solid transparent',
                borderRadius: '5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                transition: 'all 0.12s ease',
                boxShadow: isActive ? '0 1px 2px rgba(15, 23, 42, 0.05)' : 'none',
                WebkitAppearance: 'none',
                boxSizing: 'border-box'
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ─── CONTENIDO DE LAS PESTAÑAS ─── */}
      <div style={{ padding: '8px 10px', boxSizing: 'border-box' }}>
        {/* TAB 1: FECHA / DÍA */}
        {activeTab === 'date' && (
          <div>
            {/* Header del mes: ‹ Septiembre 2026 › */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '6px'
            }}>
              <button
                type="button"
                onClick={handlePrevMonth}
                title="Mes anterior"
                style={{
                  width: '22px',
                  height: '22px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '5px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  cursor: 'pointer',
                  fontSize: '11px',
                  WebkitAppearance: 'none'
                }}
              >
                ‹
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('month')}
                  title="Cambiar mes"
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 700,
                    color: '#0f172a',
                    border: 'none',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    padding: '2px 4px',
                    borderRadius: '4px'
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  {MONTH_NAMES[navMonth]}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('year')}
                  title="Cambiar año"
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 700,
                    color: '#059669',
                    border: 'none',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    padding: '2px 4px',
                    borderRadius: '4px'
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#ecfdf5'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  {navYear}
                </button>
              </div>

              <button
                type="button"
                onClick={handleNextMonth}
                title="Mes siguiente"
                style={{
                  width: '22px',
                  height: '22px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '5px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  cursor: 'pointer',
                  fontSize: '11px',
                  WebkitAppearance: 'none'
                }}
              >
                ›
              </button>
            </div>

            {/* Días de la semana */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              textAlign: 'center',
              marginBottom: '4px'
            }}>
              {DAY_LETTERS.map((d, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: '9px',
                    fontWeight: 700,
                    color: i === 0 || i === 6 ? '#f43f5e' : '#94a3b8'
                  }}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Cuadrícula de 42 días (compact 22px height) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '1px'
            }}>
              {calendarCells().map((cell, idx) => {
                const isSelected =
                  cell.year === safeCurrentDate.getFullYear() &&
                  cell.month === safeCurrentDate.getMonth() &&
                  cell.day === safeCurrentDate.getDate();

                const isToday =
                  cell.year === today.getFullYear() &&
                  cell.month === today.getMonth() &&
                  cell.day === today.getDate();

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectDay(cell)}
                    style={{
                      height: '22px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      fontWeight: isSelected ? 700 : cell.isCurrentMonth ? 500 : 400,
                      color: isSelected
                        ? '#ffffff'
                        : isToday
                        ? '#059669'
                        : cell.isCurrentMonth
                        ? '#1e293b'
                        : '#cbd5e1',
                      backgroundColor: isSelected
                        ? '#059669'
                        : isToday
                        ? '#ecfdf5'
                        : 'transparent',
                      borderRadius: '4px',
                      border: isToday && !isSelected ? '1px solid #10b981' : '1px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.1s ease',
                      boxShadow: isSelected ? '0 1px 2px rgba(5, 150, 105, 0.3)' : 'none',
                      WebkitAppearance: 'none',
                      padding: 0
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = '#f1f5f9';
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = isToday ? '#ecfdf5' : 'transparent';
                      }
                    }}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>

            {/* Selector directo de fecha (Sleek and compact for Safari/Chrome) */}
            <div style={{
              marginTop: '6px',
              paddingTop: '6px',
              borderTop: '1px solid #f1f5f9'
            }}>
              <form
                onSubmit={handleDirectDateSubmit}
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <div style={{ flex: 1, position: 'relative' }}>
                  <input
                    type="date"
                    className="dp-safari-input"
                    value={directDate}
                    onChange={e => setDirectDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '3px 6px',
                      fontSize: '10px',
                      borderRadius: '5px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#f8fafc',
                      color: '#1e293b',
                      boxSizing: 'border-box',
                      WebkitAppearance: 'none',
                      height: '24px'
                    }}
                  />
                </div>
                <button
                  type="submit"
                  title="Saltar a esta fecha"
                  style={{
                    padding: '0 8px',
                    height: '24px',
                    fontSize: '10px',
                    fontWeight: 600,
                    backgroundColor: '#059669',
                    color: '#ffffff',
                    borderRadius: '5px',
                    border: 'none',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    WebkitAppearance: 'none'
                  }}
                >
                  Ir →
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 2: MES */}
        {activeTab === 'month' && (
          <div>
            {/* Header del Año para selector de mes */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '8px'
            }}>
              <button
                type="button"
                onClick={() => setNavYear(y => y - 1)}
                title="Año anterior"
                style={{
                  width: '22px',
                  height: '22px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '5px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  cursor: 'pointer',
                  fontSize: '11px',
                  WebkitAppearance: 'none'
                }}
              >
                ‹
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('year')}
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#0f172a',
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  padding: '2px 6px',
                  borderRadius: '4px'
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                {navYear} ▾
              </button>

              <button
                type="button"
                onClick={() => setNavYear(y => y + 1)}
                title="Año siguiente"
                style={{
                  width: '22px',
                  height: '22px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '5px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  cursor: 'pointer',
                  fontSize: '11px',
                  WebkitAppearance: 'none'
                }}
              >
                ›
              </button>
            </div>

            {/* Grid 3x4 de meses (compact 26px height) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '4px'
            }}>
              {MONTH_SHORT.map((mShort, idx) => {
                const isSelected =
                  navYear === safeCurrentDate.getFullYear() &&
                  idx === safeCurrentDate.getMonth();

                const isCurrentMonth =
                  navYear === today.getFullYear() &&
                  idx === today.getMonth();

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectMonth(idx)}
                    style={{
                      height: '26px',
                      fontSize: '10.5px',
                      fontWeight: isSelected ? 700 : 500,
                      color: isSelected
                        ? '#ffffff'
                        : isCurrentMonth
                        ? '#059669'
                        : '#1e293b',
                      backgroundColor: isSelected
                        ? '#059669'
                        : isCurrentMonth
                        ? '#ecfdf5'
                        : '#f8fafc',
                      border: isCurrentMonth && !isSelected
                        ? '1px solid #a7f3d0'
                        : '1px solid #e2e8f0',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                      boxShadow: isSelected ? '0 1px 3px rgba(5, 150, 105, 0.25)' : 'none',
                      WebkitAppearance: 'none',
                      padding: 0
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = '#e2e8f0';
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = isCurrentMonth ? '#ecfdf5' : '#f8fafc';
                      }
                    }}
                  >
                    {mShort}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: AÑO */}
        {activeTab === 'year' && (
          <div>
            {/* Header del bloque de años */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '8px'
            }}>
              <button
                type="button"
                onClick={() => setYearBlockStart(y => y - 12)}
                title="Años anteriores"
                style={{
                  width: '22px',
                  height: '22px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '5px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  cursor: 'pointer',
                  fontSize: '11px',
                  WebkitAppearance: 'none'
                }}
              >
                ‹
              </button>

              <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#0f172a' }}>
                {yearBlockStart} — {yearBlockStart + 11}
              </span>

              <button
                type="button"
                onClick={() => setYearBlockStart(y => y + 12)}
                title="Años siguientes"
                style={{
                  width: '22px',
                  height: '22px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '5px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  cursor: 'pointer',
                  fontSize: '11px',
                  WebkitAppearance: 'none'
                }}
              >
                ›
              </button>
            </div>

            {/* Grid de 12 años (compact 26px height) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '4px'
            }}>
              {yearsInBlock.map(y => {
                const isSelected = y === safeCurrentDate.getFullYear();
                const isThisYear = y === today.getFullYear();

                return (
                  <button
                    key={y}
                    type="button"
                    onClick={() => handleSelectYear(y)}
                    style={{
                      height: '26px',
                      fontSize: '10.5px',
                      fontWeight: isSelected ? 700 : 500,
                      color: isSelected
                        ? '#ffffff'
                        : isThisYear
                        ? '#059669'
                        : '#1e293b',
                      backgroundColor: isSelected
                        ? '#059669'
                        : isThisYear
                        ? '#ecfdf5'
                        : '#f8fafc',
                      border: isThisYear && !isSelected
                        ? '1px solid #a7f3d0'
                        : '1px solid #e2e8f0',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                      boxShadow: isSelected ? '0 1px 3px rgba(5, 150, 105, 0.25)' : 'none',
                      WebkitAppearance: 'none',
                      padding: 0
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = '#e2e8f0';
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = isThisYear ? '#ecfdf5' : '#f8fafc';
                      }
                    }}
                  >
                    {y}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ─── FOOTER CON ATAJOS RÁPIDOS ─── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 8px',
        backgroundColor: '#f8fafc',
        borderTop: '1px solid #e2e8f0',
        fontSize: '10px',
        boxSizing: 'border-box'
      }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            type="button"
            onClick={handleGoToday}
            style={{
              padding: '2px 7px',
              height: '20px',
              color: '#059669',
              backgroundColor: '#ecfdf5',
              border: '1px solid #a7f3d0',
              borderRadius: '4px',
              fontWeight: 600,
              fontSize: '9.5px',
              cursor: 'pointer',
              WebkitAppearance: 'none'
            }}
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={handleGoThisMonth}
            style={{
              padding: '2px 7px',
              height: '20px',
              color: '#475569',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '4px',
              fontWeight: 500,
              fontSize: '9.5px',
              cursor: 'pointer',
              WebkitAppearance: 'none'
            }}
          >
            Este mes
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            padding: '2px 6px',
            color: '#64748b',
            backgroundColor: 'transparent',
            border: 'none',
            fontWeight: 500,
            fontSize: '10px',
            cursor: 'pointer',
            WebkitAppearance: 'none'
          }}
        >
          Cerrar ✕
        </button>
      </div>
    </div>
  );
}
