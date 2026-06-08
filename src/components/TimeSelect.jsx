import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function TimeSelect({ value, onChange, disabled, style }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const hourScrollRef = useRef(null);
  const minuteScrollRef = useRef(null);

  const timeVal = value || '10:00';
  const parts = timeVal.split(':');
  const hour = parts[0] || '10';
  const minute = parts[1] || '00';

  const [inputValue, setInputValue] = useState(timeVal);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, height: 0 });

  const updateCoords = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
      });
    }
  };

  useEffect(() => {
    setInputValue(timeVal);
  }, [timeVal]);

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  
  // Standard 5-minute intervals
  const minutesList = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];
  
  // If the existing value is not a multiple of 5, dynamically insert it to preserve data integrity
  if (minute && !minutesList.includes(minute)) {
    minutesList.push(minute);
    minutesList.sort((a, b) => Number(a) - Number(b));
  }

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current && 
        !containerRef.current.contains(event.target) &&
        !event.target.closest('.mmp-time-dropdown')
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Track coordinates for viewport-fixed positioning on open, resize or scroll
  useEffect(() => {
    if (isOpen) {
      updateCoords();
      window.addEventListener('scroll', updateCoords, true);
      window.addEventListener('resize', updateCoords);
    }
    return () => {
      window.removeEventListener('scroll', updateCoords, true);
      window.removeEventListener('resize', updateCoords);
    };
  }, [isOpen]);

  // Scroll active items into view when opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        if (hourScrollRef.current) {
          const activeHour = hourScrollRef.current.querySelector('.is-active');
          if (activeHour) {
            hourScrollRef.current.scrollTop = 
              activeHour.offsetTop - 
              hourScrollRef.current.offsetHeight / 2 + 
              activeHour.offsetHeight / 2;
          }
        }
        if (minuteScrollRef.current) {
          const activeMin = minuteScrollRef.current.querySelector('.is-active');
          if (activeMin) {
            minuteScrollRef.current.scrollTop = 
              activeMin.offsetTop - 
              minuteScrollRef.current.offsetHeight / 2 + 
              activeMin.offsetHeight / 2;
          }
        }
      }, 50);
    }
  }, [isOpen, hour, minute]);

  const selectHour = (h) => {
    onChange(`${h}:${minute}`);
  };

  const selectMinute = (m) => {
    onChange(`${hour}:${m}`);
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputValue(val);

    // If they typed a fully valid HH:MM pattern, update parent immediately
    if (/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(val)) {
      onChange(val);
    }
  };

  const handleInputBlur = () => {
    let val = inputValue.trim();
    if (!val) {
      setInputValue(timeVal);
      return;
    }

    // 1. Already valid HH:MM or H:MM
    if (/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(val)) {
      const parts = val.split(':');
      const formatted = `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
      setInputValue(formatted);
      onChange(formatted);
      return;
    }

    // 2. Numbers only e.g. "1330" -> "13:30", "930" -> "09:30"
    if (/^\d{3,4}$/.test(val)) {
      const pad = val.padStart(4, '0');
      const h = pad.substring(0, 2);
      const m = pad.substring(2, 4);
      const hourNum = parseInt(h, 10);
      const minNum = parseInt(m, 10);
      if (hourNum < 24 && minNum < 60) {
        const formatted = `${h}:${m}`;
        setInputValue(formatted);
        onChange(formatted);
        return;
      }
    }

    // 3. Single/double digit e.g. "9" -> "09:00", "13" -> "13:00"
    if (/^\d{1,2}$/.test(val)) {
      const hourNum = parseInt(val, 10);
      if (hourNum < 24) {
        const formatted = `${String(hourNum).padStart(2, '0')}:00`;
        setInputValue(formatted);
        onChange(formatted);
        return;
      }
    }

    // 4. H:M or HH:M e.g. "9:5" -> "09:05"
    if (/^\d{1,2}:\d{1}$/.test(val)) {
      const parts = val.split(':');
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (h < 24 && m < 60) {
        const formatted = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        setInputValue(formatted);
        onChange(formatted);
        return;
      }
    }

    // Reset to fallback if invalid
    setInputValue(timeVal);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block', width: '100%', minWidth: '76px' }}>
      <div style={{ display: 'flex', alignItems: 'center', position: 'relative', width: '100%' }}>
        {/* Text input permitting manual typing */}
        <input
          type="text"
          disabled={disabled}
          value={inputValue}
          placeholder="10:00"
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onFocus={() => !disabled && setIsOpen(true)}
          style={{
            width: '100%',
            padding: '6px 20px 6px 6px',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            background: disabled ? '#f1f5f9' : '#ffffff',
            color: disabled ? '#94a3b8' : '#0f172a',
            fontSize: '12.5px',
            fontWeight: '600',
            height: '30px',
            boxSizing: 'border-box',
            outline: 'none',
            textAlign: 'center',
            ...style
          }}
        />
        <span
          onClick={() => !disabled && setIsOpen(!isOpen)}
          style={{
            position: 'absolute',
            right: '6px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontSize: '11px',
            opacity: 0.6,
            userSelect: 'none'
          }}
        >
          🕒
        </span>
      </div>

      {isOpen && createPortal(
        <div
          className="mmp-time-dropdown"
          style={{
            position: 'fixed',
            bottom: coords.top >= 150 ? `${window.innerHeight - coords.top + 4}px` : undefined,
            top: coords.top < 150 ? `${coords.top + coords.height + 4}px` : undefined,
            left: `${coords.left + coords.width / 2}px`,
            transform: 'translateX(-50%)',
            zIndex: 999999,
            width: '100px',
            height: '140px',
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
            display: 'flex',
            padding: '3px',
            gap: '2px',
            boxSizing: 'border-box',
          }}
        >
          {/* Hour Column */}
          <div
            ref={hourScrollRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              paddingRight: '0px',
              scrollbarWidth: 'none', // Firefox
              msOverflowStyle: 'none' // IE/Edge
            }}
            className="mmp-time-column"
          >
            {hours.map((h) => {
              const active = h === hour;
              return (
                <div
                  key={h}
                  onClick={() => selectHour(h)}
                  className={active ? 'is-active' : ''}
                  style={{
                    padding: '4px 0',
                    fontSize: '12px',
                    fontWeight: active ? '700' : '500',
                    textAlign: 'center',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    background: active ? '#2563eb' : 'transparent',
                    color: active ? '#ffffff' : '#334155',
                    marginBottom: '2px',
                    transition: 'all 0.1s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.target.style.background = '#eff6ff';
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.target.style.background = 'transparent';
                  }}
                >
                  {h}
                </div>
              );
            })}
          </div>

          {/* Separator dots */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontWeight: 'bold', fontSize: '11px', width: '4px' }}>:</div>

          {/* Minute Column */}
          <div
            ref={minuteScrollRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              paddingRight: '0px',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none'
            }}
            className="mmp-time-column"
          >
            {minutesList.map((m) => {
              const active = m === minute;
              return (
                <div
                  key={m}
                  onClick={() => selectMinute(m)}
                  className={active ? 'is-active' : ''}
                  style={{
                    padding: '4px 0',
                    fontSize: '12px',
                    fontWeight: active ? '700' : '500',
                    textAlign: 'center',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    background: active ? '#2563eb' : 'transparent',
                    color: active ? '#ffffff' : '#334155',
                    marginBottom: '2px',
                    transition: 'all 0.1s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.target.style.background = '#eff6ff';
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.target.style.background = 'transparent';
                  }}
                >
                  {m}
                </div>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
