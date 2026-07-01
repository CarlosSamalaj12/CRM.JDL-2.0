import { useState } from 'react';

const DESCRIPTIONS = {
  dashboard: {
    title: 'Dashboard Ejecutivo',
    desc: 'Panel general con métricas clave del periodo. Toma datos de eventos, cotizaciones, metas y checklists.',
    calculation: 'Metas: suma de montos de eventos Confirmado + Pre-reserva. Eficiencia: (confirmados / total) × 100. Satisfacción: promedio de ratings en checklists (Malo=2.5, Regular=5, Bueno=7.5, Excelente=10). Ocupación: PAX acumulado por día vs capacidad total de salones.',
    source: 'Eventos del rango filtrado por rol y vendedor. Cotizaciones (total de la cotización). Checklists de evaluación. Configuración de metas globales y capacidad de salones.',
  },
  ventas: {
    title: 'Reporte de Ventas',
    desc: 'Lista detallada de eventos con montos cotizados. Filtrable por estado, vendedor, salón y fechas.',
    calculation: 'Monto total = total de la cotización. Ticket promedio = total / número de eventos. Conversión = (confirmados / total) × 100.',
    source: 'Eventos del calendario con su cotización asociada. Usuarios del sistema para asignar vendedor.',
  },
  institucion: {
    title: 'Reporte por Institución',
    desc: 'Analiza el comportamiento de una empresa o grupo: consumo histórico, salones más usados, platillos más pedidos.',
    calculation: 'Totales por empresa: suma del total de cotizaciones de eventos filtrados. Ranking: frecuencia de uso. Saldo pendiente = total cotizado - anticipos.',
    source: 'Eventos agrupados por empresa/cliente. Cotizaciones con items, anticipos, catálogo de servicios.',
  },
  ocupacion: {
    title: 'Ocupación por Día',
    desc: 'Vista semanal de eventos, PAX y ocupación de salones día por día.',
    calculation: 'Ocupación = PAX del día / capacidad total marcada × 100. Eventos activos = Confirmado + Pre-reserva.',
    source: 'Eventos del rango semanal. Capacidad de salones configurada en Settings. PAX por evento.',
  },
  ocupacionBarras: {
    title: 'Ocupación en Barras',
    desc: 'Gráfica de barras comparativa de ocupación por día.',
    calculation: 'Altura de barra = PAX del día / capacidad total. Promedio = PAX total / días del periodo.',
    source: 'Mismos datos que Ocupación por Día, representación visual alternativa.',
  },
  ingresosCategorias: {
    title: 'Ingresos por Categoría',
    desc: 'Montos divididos en categorías: Alimentos & Bebidas, Hospedaje JDL, Hospedaje de Terceros y Misceláneos.',
    calculation: 'Por cada evento, se suman los montos de cada categoría. Porcentaje = (categoría / total general) × 100.',
    source: 'Categorías dentro de cada cotización. Eventos con estado activo en el rango de fechas.',
  },
  comisiones: {
    title: 'Comisiones',
    desc: 'Cálculo de comisiones por vendedor según sus tiers configurados.',
    calculation: 'Se suma el total de ventas del vendedor en el periodo. Se aplica el % del tier más alto alcanzado. Comisión = ventas × (tier.percentage / 100).',
    source: 'Eventos Confirmado por vendedor. Tiers de comisión configurados en Usuarios → Metas.',
  },
  contabilidad: {
    title: 'Contabilidad',
    desc: 'Saldos, anticipos y montos pendientes por evento y empresa.',
    calculation: 'Saldo pendiente = total de la cotización - suma de anticipos. Anticipos vienen de tabla anticipos_evento.',
    source: 'Cotizaciones con sus anticipos registrados. Eventos del rango seleccionado.',
  },
  eficienciaEventos: {
    title: 'Eficiencia por Estado',
    desc: 'Distribución de eventos por estado (Confirmado, Pre-reserva, Cancelado, etc.) en el periodo.',
    calculation: 'Cada evento cuenta 1 vez en su estado. Porcentaje = (cantidad del estado / total eventos) × 100.',
    source: 'Todos los eventos del rango de fechas. Estados definidos en STATUS_META.',
  },
  eficienciaConfirmacion: {
    title: 'Eficiencia de Confirmación',
    desc: 'Tasa de confirmación: qué porcentaje de eventos terminan confirmados.',
    calculation: 'Eficiencia = (eventos Confirmado / total eventos) × 100. Monto confirmado = suma del total de cotizaciones de confirmados.',
    source: 'Eventos del periodo. Solo estado Confirmado cuenta como exitoso.',
  },
  seguimientos: {
    title: 'Seguimientos Pendientes',
    desc: 'Eventos en estados de negociación que requieren seguimiento.',
    calculation: 'Agrupa por vendedor y estado. Muestra días desde última actualización.',
    source: 'Eventos con estado: Seguimiento, 1ra Cotización, Lista de Espera, Pre-reserva.',
  },
  satisfaccion: {
    title: 'Satisfacción del Cliente',
    desc: 'Calificaciones de servicio basadas en checklists de eventos.',
    calculation: 'Cada ítem evaluado tiene un rating: Malo=2.5, Regular=5, Bueno=7.5, Excelente=10. Promedio global = suma de scores / total de ratings.',
    source: 'Checklists de eventos con sección de evaluación. Ratings por ítem.',
  },
  proyeccion: {
    title: 'Proyección de Metas',
    desc: 'Compara el avance actual contra la meta del mes y proyecta el resultado esperado.',
    calculation: 'Ritmo diario = meta / días del mes. Proyección = (acumulado / días transcurridos) × días totales. Porcentaje = (acumulado / meta) × 100.',
    source: 'Metas mensuales configuradas. Eventos Confirmado + Pre-reserva del mes actual.',
  },
  ventasUsuario: {
    title: 'Ventas por Usuario',
    desc: 'Desempeño individual de cada vendedor/recepcionista en el periodo.',
    calculation: 'Suma de montos de eventos Confirmado por usuario. Ordenado por monto descendente.',
    source: 'Eventos agrupados por userId. Cotizaciones con total.',
  },
};

export default function ReportInfo({ reportKey }) {
  const [open, setOpen] = useState(false);
  const info = DESCRIPTIONS[reportKey];
  if (!info) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          width: '28px', height: '28px', borderRadius: '50%',
          border: `2px solid #cbd5e1`, background: '#fff',
          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '13px', fontWeight: '800', color: '#94a3b8',
          transition: 'all 0.15s ease', flexShrink: 0, lineHeight: 1,
          fontFamily: 'serif', fontStyle: 'italic',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.color = '#2563eb'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#94a3b8'; }}
        title="¿Cómo se calcula este reporte?"
      >i</button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)',
            padding: '20px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: '16px', maxWidth: '520px', width: '100%',
              padding: '24px 28px', boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
              position: 'relative',
            }}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                position: 'absolute', top: '12px', right: '14px',
                background: '#f1f5f9', border: 'none', borderRadius: '8px',
                width: '28px', height: '28px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '16px', color: '#64748b', fontWeight: 700,
              }}
            >✕</button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '10px',
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '16px', color: '#fff',
              }}>ℹ️</div>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>{info.title}</div>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Acerca de este reporte</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{
                background: '#f8fafc', borderRadius: '10px', padding: '12px 14px',
                border: '1px solid #e2e8f0',
              }}>
                <div style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                  📋 Descripción
                </div>
                <div style={{ fontSize: '13px', color: '#334155', fontWeight: 500, lineHeight: 1.5 }}>{info.desc}</div>
              </div>

              <div style={{
                background: '#f8fafc', borderRadius: '10px', padding: '12px 14px',
                border: '1px solid #e2e8f0',
              }}>
                <div style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                  🧮 Cálculo
                </div>
                <div style={{ fontSize: '13px', color: '#334155', fontWeight: 500, lineHeight: 1.5 }}>{info.calculation}</div>
              </div>

              <div style={{
                background: '#f8fafc', borderRadius: '10px', padding: '12px 14px',
                border: '1px solid #e2e8f0',
              }}>
                <div style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                  📡 Fuente de datos
                </div>
                <div style={{ fontSize: '13px', color: '#334155', fontWeight: 500, lineHeight: 1.5 }}>{info.source}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
