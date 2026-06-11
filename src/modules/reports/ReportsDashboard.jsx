import { useState, useMemo, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';

const STATUS = { CONFIRMADO: 'Confirmado', PRERESERVA: 'Pre reserva' };
const USER_ROLES = { SELLER: 'vendedor', RECEPTIONIST: 'recepcionista' };
const isGoalStatus = (s) => s === STATUS.CONFIRMADO || s === STATUS.PRERESERVA;

export default function ReportsDashboard({ onClose }) {
  const { events, users } = useOutletContext();
  const [monthKey, setMonthKey] = useState(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`; });
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [role, setRole] = useState(USER_ROLES.SELLER);
  const [scope, setScope] = useState('all');
  const [selectedSellerId, setSelectedSellerId] = useState('');

  const formatMoneyGT = (v) => 'Q ' + Number(v||0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const getMonthName = (m) => ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][m-1] || '';
  const getRoleLabel = (r) => r === USER_ROLES.SELLER ? 'Vendedor' : 'Recepcionista';

  const getDateRange = useCallback(() => {
    if (!fromDate || !toDate) { const [y,m] = monthKey.split('-'); const s = new Date(parseInt(y), parseInt(m)-1, 1); const e = new Date(parseInt(y), parseInt(m), 0); return { from: s.toISOString().split('T')[0], to: e.toISOString().split('T')[0], label: `${getMonthName(parseInt(m))} de ${monthKey.split('-')[0]}` }; }
    return { from: fromDate, to: toDate, label: `${fromDate} - ${toDate}` };
  }, [monthKey, fromDate, toDate]);

  const filteredUsers = useMemo(() => (users||[]).filter(u => String(u.role||'').toLowerCase() === (role === USER_ROLES.SELLER ? 'vendedor' : 'recepcionista')), [users, role]);

  const dashboardRows = useMemo(() => {
    if (!events) return [];
    const { from, to } = getDateRange();
    const rows = []; const groups = new Map();
    for (const ev of events) { const key = `${ev.date}|${ev.salon||''}|${ev.id}`; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(ev); }
    for (const [, series] of groups.entries()) {
      if (!series.some(ev => { const d = ev.date; return d >= from && d <= to; })) continue;
      const head = series[0];
      rows.push({ userId: String(head.userId||''), status: head.status, eventDate: head.date, salon: head.salon||'', total: Math.max(0, head.quote?.total||0), type: (head.quote?.eventType||head.name||'').toLowerCase().includes('corporativo') ? 'corp' : (head.quote?.eventType||head.name||'').toLowerCase().includes('social') ? 'social' : 'otro', monthKey: head.date?.substring(0,7) });
    }
    return rows;
  }, [events, getDateRange]);

  const filteredRows = useMemo(() => dashboardRows.filter(r => { if (scope === 'seller' && selectedSellerId && r.userId !== selectedSellerId) return false; return true; }), [dashboardRows, scope, selectedSellerId]);

  const statusMeta = () => [ { k: STATUS.CONFIRMADO, l: 'Confirmado', c: '#10c972' }, { k: 'Pre reserva', l: 'Pre-reserva', c: '#d07db8' }, { k: 'Seguimiento', l: 'Negociacion', c: '#ff6b3a' }, { k: 'Perdido', l: 'Perdido', c: '#7c5cff' }, { k: 'Cancelado', l: 'Cancelado', c: '#e42a48' }, { k: 'Reserva sin Cotizacion', l: 'Reserva sin cotizacion', c: '#0ea5e9' } ];

  const statusSummary = useMemo(() => {
    const meta = statusMeta(); const cnt = {}; meta.forEach(m => cnt[m.k] = 0);
    filteredRows.forEach(r => { if (cnt[r.status] !== undefined) cnt[r.status]++; });
    const total = Object.values(cnt).reduce((a,b) => a+b, 0);
    const confirmed = cnt[STATUS.CONFIRMADO]||0;
    return { total, confirmed, pct: total ? (confirmed/total)*100 : 0, seg: meta.map(m => ({...m, count: cnt[m.k]||0, pct: total ? ((cnt[m.k]||0)/total)*100 : 0})) };
  }, [filteredRows]);

  const globalGoal = useMemo(() => { const y = monthKey.substring(0,4); let g=0; (users||[]).forEach(u => { if (!u.salesTargetEnabled || !u.monthlyGoals) return; u.monthlyGoals.forEach(m => { if (m.month?.startsWith(y) && m.month === monthKey) g += Number(m.amount||0); }); }); return g; }, [users, monthKey]);
  const globalAchieved = useMemo(() => filteredRows.filter(r => isGoalStatus(r.status)).reduce((a,r) => a+r.total, 0), [filteredRows]);
  const focusedUser = scope === 'seller' && selectedSellerId ? users?.find(u => u.id === selectedSellerId) : null;
  const personalGoal = focusedUser?.monthlyGoals ? (focusedUser.monthlyGoals.find(g => g.month === monthKey)?.amount||0) : 0;
  const personalAchieved = focusedUser ? filteredRows.filter(r => r.userId === focusedUser.id && isGoalStatus(r.status)).reduce((a,r) => a+r.total, 0) : 0;
  const gProg = globalGoal ? (globalAchieved/globalGoal)*100 : 0;
  const pProg = personalGoal ? (personalAchieved/personalGoal)*100 : 0;

  const salonData = useMemo(() => {
    const c = {};
    filteredRows.forEach(r => { const s = r.salon || '(sin salon)'; c[s] = (c[s]||0)+1; });
    const p = ['#5b95f0','#facc15','#9b5de5','#e92f55','#10c972'];
    const o = Object.entries(c).sort((a,b) => b[1]-a[1]).map(([l,n],i) => ({l, n, c: p[i%p.length]})).slice(0,6);
    const tot = o.reduce((a,b) => a+b.n, 0);
    if (!tot) return null;
    let cur = 0; const slices = o.map(it => { const pct = (it.n/tot)*100; const nxt = cur+pct; const s = `${it.c} ${cur.toFixed(0)}% ${nxt.toFixed(0)}%`; cur = nxt; return s; });
    return { slices, o, tot };
  }, [filteredRows]);

  const sellerMetrics = useMemo(() => {
    return filteredUsers.filter(u => !scope || scope==='all' || u.id === selectedSellerId).map(s => {
      const sr = filteredRows.filter(r => r.userId === s.id);
      const cr = sr.filter(r => r.status === STATUS.CONFIRMADO);
      return { id: s.id, name: s.fullName||s.name||getRoleLabel(role), total: sr.length, confirmed: cr.length, amount: cr.reduce((a,b) => a+b.total, 0) };
    }).sort((a,b) => b.amount - a.amount);
  }, [filteredUsers, filteredRows, scope, selectedSellerId, role]);
  const maxAmt = Math.max(1, ...sellerMetrics.map(s => s.amount));

  const eventTypeData = useMemo(() => {
    const labels = { corp: 'Corporativo', social: 'Social', otro: 'Otro' };
    const colors = { corp: '#2563eb', social: '#10c972', otro: '#f59e0b' };
    const totals = { corp: { count: 0, amount: 0 }, social: { count: 0, amount: 0 }, otro: { count: 0, amount: 0 } };
    filteredRows.forEach((row) => {
      const key = totals[row.type] ? row.type : 'otro';
      totals[key].count += 1;
      totals[key].amount += Number(row.total || 0);
    });
    const max = Math.max(1, ...Object.values(totals).map((item) => item.amount));
    return Object.entries(totals).map(([key, item]) => ({
      key,
      label: labels[key],
      color: colors[key],
      count: item.count,
      amount: item.amount,
      pct: (item.amount / max) * 100
    }));
  }, [filteredRows]);

  const handleReset = () => { const n = new Date(); setMonthKey(`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`); setFromDate(''); setToDate(''); setRole(USER_ROLES.SELLER); setScope('all'); setSelectedSellerId(''); };

  const styles = {
    backdrop: { position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', overflow: 'hidden' },
    modal: { width: 'min(1280px, calc(100vw - 32px))', height: '92vh', maxHeight: '92vh', background: 'linear-gradient(180deg, #ffffff 0%, #f5f9ff 100%)', borderRadius: '16px', border: '1px solid rgba(191,210,232,0.5)', boxShadow: '0 25px 60px rgba(15,23,42,0.3)', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
    header: { background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(244,249,255,0.96) 100%)', borderBottom: '1px solid rgba(148,163,184,0.16)', padding: '16px 24px', display: 'flex', alignItems: 'center', minHeight: '86px', justifyContent: 'space-between', gap: '14px' },
    brandBadge: { width: '56px', height: '56px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #c7d8ec', background: '#f5faff', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' },
    brandLogo: { width: '40px', height: '40px', objectFit: 'contain' },
    brandCopy: { flex: '1' },
    eyebrow: { color: '#64748b', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' },
    title: { margin: '2px 0 0', fontSize: '20px', fontWeight: '800', color: '#0f172a' },
    subtitle: { marginTop: '2px', color: '#64748b', fontSize: '12px' },
    closeBtn: { width: '36px', height: '36px', borderRadius: '8px', border: 'none', background: '#f1f5f9', color: '#64748b', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    body: { padding: '14px', flex: '1', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' },
    sectionTitle: { fontSize: '10px', fontWeight: '900', color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '999px', padding: '4px 8px', display: 'inline-block', textTransform: 'uppercase' },
    sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' },
    sectionSubtitle: { fontSize: '14px', fontWeight: '800', color: '#0f172a', marginTop: '6px' },
    sectionDesc: { fontSize: '11px', color: '#64748b', marginTop: '2px' },
    toolbar: { display: 'flex', alignItems: 'flex-end', gap: '10px', flexWrap: 'wrap', padding: '12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' },
    field: { display: 'flex', flexDirection: 'column', gap: '3px' },
    fieldLabel: { fontSize: '9px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' },
    input: { height: '36px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '13px' },
    select: { height: '36px', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '0 10px', fontSize: '13px' },
    btn: { height: '36px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontWeight: '700', fontSize: '12px', cursor: 'pointer', padding: '0 12px' },
    actions: { marginLeft: 'auto', display: 'flex', gap: '8px' },
    goalsGrid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' },
    goalCard: { padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: '4px', minHeight: '100px' },
    heroCard: { gridColumn: 'span 2', background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)', color: 'white', border: 'none', padding: '12px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '6px' },
    heroRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
    heroSmall: { fontSize: '9px', fontWeight: '800', textTransform: 'uppercase', opacity: 0.8 },
    heroTitle: { fontSize: '16px', fontWeight: '800' },
    heroPct: { textAlign: 'right' },
    heroPctNum: { fontSize: '28px', fontWeight: '900' },
    heroPctLabel: { fontSize: '9px', opacity: 0.8 },
    heroBar: { height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.2)', display: 'flex', gap: '2px' },
    heroSeg: { height: '100%', minWidth: '2px' },
    heroLegend: { display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '9px', opacity: 0.9 },
    goalLabel: { fontSize: '9px', fontWeight: '900', color: '#64748b', textTransform: 'uppercase' },
    goalValue: { fontSize: '20px', fontWeight: '800', color: '#0f172a' },
    goalMeta: { fontSize: '10px', color: '#64748b' },
    goalProg: { height: '6px', background: '#e2e8f0', borderRadius: '3px', marginTop: 'auto', overflow: 'hidden' },
    goalProgBar: (p) => ({ height: '100%', background: p >= 100 ? '#16a34a' : p >= 80 ? '#f59e0b' : '#2563eb', width: `${Math.min(p,100)}%` }),
    chartsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
    chartCard: { padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc' },
    chartTitle: { fontSize: '13px', fontWeight: '800', color: '#0f172a', marginBottom: '4px' },
    chartSub: { fontSize: '10px', color: '#64748b', marginBottom: '8px' },
    pieWrap: { display: 'flex', alignItems: 'center', gap: '12px' },
    pie: { width: '80px', height: '80px', borderRadius: '50%', flexShrink: 0 },
    pieLeg: { display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '10px, color: #64748b' },
    pieLegItem: { display: 'flex', alignItems: 'center', gap: '4px' },
    pieDot: { width: '10px', height: '10px', borderRadius: '2px' },
    sellerGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '10px' },
    sellerCard: { padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0', background: '#f8fafc', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' },
    sellerVal: { fontSize: '16px', fontWeight: '900', color: '#2563eb' },
    sellerBar: { width: '40px', borderRadius: '4px', background: '#10c972' },
    sellerAv: { width: '32px', height: '32px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '800', color: '#64748b' },
    sellerName: { fontSize: '10px', fontWeight: '800', color: '#0f172a', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    sellerMeta: { fontSize: '9px', color: '#94a3b8' },
  };

  const visSeg = statusSummary.seg.filter(s => s.count > 0);
  const dateRange = getDateRange();

  return (
    <div className="modalBackdrop" id="dashboardReportBackdrop" style={styles.backdrop} onClick={(e) => { if (e.target.id === 'dashboardReportBackdrop') onClose(); }}>
      <div className="modal dashboardReportModal" style={styles.modal}>
        <div className="modalHeader" style={styles.header}>
          <div style={styles.brandBadge}><img src="/Oficial_JDL_acua.png" alt="JDL" style={styles.brandLogo} /></div>
          <div className="reportBrandCopy" style={styles.brandCopy}>
            <div style={styles.eyebrow} className="reportBrandEyebrow">CRM Reservas | Jardines del Lago</div>
            <div style={styles.title} className="modalTitle">Reporte Dashboard</div>
            <div style={styles.subtitle} className="modalSubtitle">Vista mensual de vendedores, metas y comparativos</div>
          </div>
          <button onClick={onClose} className="iconBtn reportModalClose">✕</button>
        </div>
        <div style={styles.body}>
          <div style={styles.sectionHeader}>
            <div>
              <div style={styles.sectionTitle}>Control gerencial</div>
              <div style={styles.sectionSubtitle}>Metas, comparativos y rendimiento por vendedor</div>
              <div style={styles.sectionDesc}>Un dashboard ejecutivo con mejor separación visual para identificar avances, brechas y desempeño del periodo.</div>
            </div>
          </div>
          <div className="reports-dashboard-toolbar" style={styles.toolbar}>
            <div style={styles.field}><span style={styles.fieldLabel}>Periodo</span><select value="month" disabled style={styles.select}><option value="month">Mes</option></select></div>
            <div style={styles.field}><span style={styles.fieldLabel}>Mes base</span><input type="month" value={monthKey} onChange={(e) => setMonthKey(e.target.value)} style={styles.input} /></div>
            <div style={styles.field}><span style={styles.fieldLabel}>Desde</span><input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={styles.input} placeholder="dd/mm/aaaa" /></div>
            <div style={styles.field}><span style={styles.fieldLabel}>Hasta</span><input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={styles.input} placeholder="dd/mm/aaaa" /></div>
            <div style={styles.field}><span style={styles.fieldLabel}>Rol</span><select value={role} onChange={(e) => setRole(e.target.value)} style={styles.select}><option value="vendedor">Vendedor</option><option value="recepcionista">Recepcionista</option></select></div>
            <div style={styles.field}><span style={styles.fieldLabel}>Vista</span><select value={scope} onChange={(e) => setScope(e.target.value)} style={styles.select}><option value="all">Todos usuarios del rol</option><option value="seller">Usuario específico</option></select></div>
            {scope === 'seller' && <div style={styles.field}><span style={styles.fieldLabel}>Usuario</span><select value={selectedSellerId} onChange={(e) => setSelectedSellerId(e.target.value)} style={styles.select}><option value="">Selecciona vendedor</option>{filteredUsers.map(u => <option key={u.id} value={u.id}>{u.fullName||u.name}</option>)}</select></div>}
            <div style={styles.actions}><button onClick={handleReset} style={styles.btn}>Limpiar filtros</button></div>
          </div>

          <div style={styles.sectionHeader}><div><div style={styles.sectionTitle}>KPIs clave</div><div style={styles.sectionSubtitle}>Lectura inmediata del avance comercial</div></div></div>
          <div className="reports-dashboard-goals-grid" style={styles.goalsGrid}>
            <article style={styles.goalCard}>
              <div style={styles.heroCard}>
                <div style={styles.heroRow}><div><small style={styles.heroSmall}>EFICIENCIA EN {getRoleLabel(role).toUpperCase()}S "CRM"</small><strong style={styles.heroTitle}>{dateRange.label}</strong></div><div style={styles.heroPct}><b style={styles.heroPctNum}>{statusSummary.pct.toFixed(1)}%</b><span style={styles.heroPctLabel}>Confirmado</span></div></div>
                <div style={styles.heroBar}>{visSeg.slice(0,5).map((s,i) => <div key={i} style={{...styles.heroSeg, width: `${Math.max(2,s.pct)}%`, background: s.c}} />)}</div>
                <div style={styles.heroLegend}>{visSeg.slice(0,5).map((s,i) => <span key={i} style={{display:'flex',alignItems:'center',gap:'3px'}}><i style={{...styles.pieDot, background: s.c}} /><span>{s.l.substring(0,12)} {s.pct.toFixed(0)}%</span></span>)}</div>
              </div>
            </article>
            <article style={{...styles.goalCard, borderTop: `3px solid ${gProg>=100?'#16a34a':gProg>=80?'#f59e0b':'#2563eb'}`}}><span style={styles.goalLabel}>Meta {getRoleLabel(role)}</span><span style={styles.goalValue}>{formatMoneyGT(globalGoal)}</span><span style={styles.goalMeta}>Avance {formatMoneyGT(globalAchieved)} | {gProg.toFixed(1)}%</span><div style={styles.goalProg}><div style={styles.goalProgBar(gProg)} /></div></article>
            <article style={{...styles.goalCard, borderTop: `3px solid ${gProg>=100?'#16a34a':gProg>=80?'#f59e0b':'#2563eb'}`}}><span style={styles.goalLabel}>Pendiente del rol</span><span style={styles.goalValue}>{formatMoneyGT(Math.max(0,globalGoal-globalAchieved))}</span><span style={styles.goalMeta}>{globalAchieved>=globalGoal?`Meta ${getRoleLabel(role)} superada`:'Ingreso pendiente para cumplir meta'}</span><div style={styles.goalProg}><div style={styles.goalProgBar(gProg)} /></div></article>
            <article style={{...styles.goalCard, borderTop: `3px solid ${pProg>=100?'#16a34a':pProg>=80?'#f59e0b':'#2563eb'}`}}><span style={styles.goalLabel}>Meta personal ({focusedUser?.fullName||'Selecciona vendedor'})</span><span style={styles.goalValue}>{formatMoneyGT(personalGoal)}</span><span style={styles.goalMeta}>Avance {formatMoneyGT(personalAchieved)} | {pProg.toFixed(1)}%</span><div style={styles.goalProg}><div style={styles.goalProgBar(pProg)} /></div></article>
            <article style={{...styles.goalCard, borderTop: `3px solid ${pProg>=100?'#16a34a':pProg>=80?'#f59e0b':'#2563eb'}`}}><span style={styles.goalLabel}>Falta para meta personal</span><span style={styles.goalValue}>{formatMoneyGT(Math.max(0,personalGoal-personalAchieved))}</span><span style={styles.goalMeta}>{personalAchieved>=personalGoal?'Meta personal superada':'Ingreso pendiente para cumplir meta'}</span><div style={styles.goalProg}><div style={styles.goalProgBar(pProg)} /></div></article>
          </div>

          <div style={styles.sectionHeader}><div><div style={styles.sectionTitle}>Analítica visual</div><div style={styles.sectionSubtitle}>Comparativos y distribuciones del periodo</div></div></div>
          <div className="reports-dashboard-charts-grid" style={styles.chartsGrid}>
            <div style={styles.chartCard}><div style={styles.chartTitle}>Áreas más utilizadas</div><div style={styles.chartSub}>Distribución de salones en el periodo</div>
              {salonData ? <div style={styles.pieWrap}><div style={{...styles.pie, background: `conic-gradient(${salonData.slices.join(',')})`}} /><div style={styles.pieLeg}>{salonData.o.map((it,i) => <div key={i} style={styles.pieLegItem}><i style={{...styles.pieDot, background: it.c}} /><span>{it.l.substring(0,12)}: {((it.n/salonData.tot)*100).toFixed(0)}%</span></div>)}</div></div> : <div style={{ color: '#94a3b8', fontSize: '11px', textAlign: 'center', padding: '12px' }}>Sin salones con activity</div>}
            </div>
            <div style={styles.chartCard}><div style={styles.chartTitle}>Ventas por tipo de evento</div><div style={styles.chartSub}>Corporativo vs Social por mes</div>
              <div style={{ display: 'grid', gap: '10px' }}>
                {eventTypeData.some(item => item.count > 0) ? eventTypeData.map(item => (
                  <div key={item.key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '11px', fontWeight: 800, color: '#334155' }}>
                      <span>{item.label} ({item.count})</span>
                      <span>{formatMoneyGT(item.amount)}</span>
                    </div>
                    <div style={{ height: '9px', borderRadius: '999px', background: '#e2e8f0', overflow: 'hidden', marginTop: '5px' }}>
                      <div style={{ width: `${Math.max(4, item.pct)}%`, height: '100%', background: item.color }} />
                    </div>
                  </div>
                )) : <div style={{ color: '#94a3b8', fontSize: '11px', textAlign: 'center', padding: '12px' }}>Sin ventas por tipo en el periodo</div>}
              </div>
            </div>
          </div>

          <div style={styles.sectionHeader}><div><div style={styles.sectionTitle}>Equipo</div><div style={styles.sectionSubtitle}>Lectura rápida del rendimiento individual</div></div></div>
          <div className="reports-dashboard-seller-grid" style={styles.sellerGrid}>
            {sellerMetrics.length ? sellerMetrics.map(s => <div key={s.id} style={styles.sellerCard}><div style={styles.sellerVal}>{formatMoneyGT(s.amount)}</div><div style={{...styles.sellerBar, height: `${Math.max(10,(s.amount/maxAmt)*80)}px`}} /><div style={styles.sellerAv}>{s.name.charAt(0).toUpperCase()}</div><div style={styles.sellerName}>{s.name}</div><div style={styles.sellerMeta}>{s.confirmed} confirmados de {s.total} evento(s)</div></div>) : <div style={{ color: '#94a3b8', fontSize: '11px', textAlign: 'center', gridColumn: '1/-1', padding: '20px' }}>No hay asesores comerciales con metas asignadas.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
