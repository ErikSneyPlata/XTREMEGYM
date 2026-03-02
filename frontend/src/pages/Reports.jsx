// frontend/src/pages/Reports.jsx
import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import {
  BarChart2, Download, FileText, Calendar, RefreshCw,
  TrendingUp, CreditCard, Banknote, ArrowRightLeft,
  Users, ShieldCheck, ChevronLeft, ChevronRight,
  Package, Zap, Filter,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// ─── helpers ──────────────────────────────────────────────────────────────────
const fmt     = (n) => `$${Number(n ?? 0).toLocaleString('es-CO', { minimumFractionDigits: 0 })}`;
const fmtDate = (s) => s ? new Date(s).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const MONTHS = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

const TYPE_CONFIG = {
  membership:   { label: 'Membresías',       color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20',  icon: ShieldCheck },
  daily_pass:   { label: 'Pases Diarios',    color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/20',  icon: Zap },
  product_sale: { label: 'Ventas Productos', color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   icon: Package },
};

const METHOD_CONFIG = {
  cash:     { label: 'Efectivo',      icon: Banknote,       color: 'text-slate-300' },
  card:     { label: 'Tarjeta',       icon: CreditCard,     color: 'text-green-400' },
  transfer: { label: 'Transferencia', icon: ArrowRightLeft, color: 'text-blue-400'  },
};

const paymentTypeLabel = {
  membership:   'Membresía',
  daily_pass:   'Pase diario',
  product_sale: 'Producto',
};

// ─── MiniBar ─────────────────────────────────────────────────────────────────
function MiniBar({ value, max, color = '#16a34a' }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden w-full">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, color, bg, border }) {
  return (
    <div className={`${bg} ${border} border rounded-2xl px-5 py-4 flex items-center gap-4`}>
      <div className={`size-10 rounded-xl ${bg} ${border} border flex items-center justify-center flex-shrink-0`}>
        <Icon size={18} className={color} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest truncate">{label}</p>
        <p className={`text-xl font-black ${color}`}>{value}</p>
        {sub && <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Excel export (client-side via SheetJS) ──────────────────────────────────
async function exportToExcel(report, mode, label) {
  const XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs');

  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Resumen ──────────────────────────────────────────────────────
  const summaryRows = [
    ['REPORTE DE INGRESOS', '', '', ''],
    [`Período: ${label}`, '', '', ''],
    [`Generado: ${new Date().toLocaleString('es-CO')}`, '', '', ''],
    ['', '', '', ''],
    ['RESUMEN POR TIPO', '', '', ''],
    ['Tipo', 'Transacciones', 'Total', ''],
    ['Membresías',       report.breakdown.membership.count,   report.breakdown.membership.total,   ''],
    ['Pases Diarios',    report.breakdown.daily_pass.count,   report.breakdown.daily_pass.total,   ''],
    ['Ventas Productos', report.breakdown.product_sale.count, report.breakdown.product_sale.total, ''],
    ['TOTAL',            Object.values(report.breakdown).reduce((s,b)=>s+b.count,0), report.grandTotal, ''],
    ['', '', '', ''],
    ['RESUMEN POR MÉTODO DE PAGO', '', '', ''],
    ['Método', 'Total', '', ''],
    ['Efectivo',      report.byMethod.cash     ?? 0, '', ''],
    ['Tarjeta',       report.byMethod.card     ?? 0, '', ''],
    ['Transferencia', report.byMethod.transfer ?? 0, '', ''],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
  ws1['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Resumen');

  // ── Sheet 2: Detalle por día ──────────────────────────────────────────────
  if (Object.keys(report.byDay).length > 0) {
    const dayRows = [
      ['Fecha', 'Membresías', 'Pases Diarios', 'Productos', 'Total del Día'],
      ...Object.entries(report.byDay)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([day, d]) => [day, d.membership, d.daily_pass, d.product_sale, d.total]),
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(dayRows);
    ws2['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Por Día');
  }

  // ── Sheet 3: Transacciones ────────────────────────────────────────────────
  const txRows = [
    ['Fecha', 'Hora', 'Cliente', 'DNI', 'Tipo', 'Método', 'Monto'],
    ...(report.payments ?? []).map(p => [
      new Date(p.created_at).toLocaleDateString('es-CO'),
      new Date(p.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
      p.users?.full_name ?? 'General',
      p.users?.dni ?? '—',
      paymentTypeLabel[p.payment_type] ?? p.payment_type,
      p.payment_method,
      Number(p.amount),
    ]),
  ];
  const ws3 = XLSX.utils.aoa_to_sheet(txRows);
  ws3['!cols'] = [{ wch: 12 }, { wch: 8 }, { wch: 26 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws3, 'Transacciones');

  XLSX.writeFile(wb, `Reporte_Ingresos_${label.replace(/\s/g, '_')}.xlsx`);
}

// ─── PDF export memberships (client-side via browser print) ──────────────────
function exportMembershipsPDF(members) {
  const now = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });

  const rows = members.map((m, i) => {
    const daysColor = m.days_left <= 3 ? '#ef4444' : m.days_left <= 7 ? '#f59e0b' : '#16a34a';
    return `
      <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
        <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb">${m.full_name}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#6b7280">${m.dni}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb">${m.plan_name}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#6b7280">${fmtDate(m.start_date)}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#6b7280">${fmtDate(m.end_date)}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;font-weight:700;color:${daysColor}">${m.days_left}d</td>
      </tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Membresías Activas — ${now}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #111; padding: 32px; }
    h1 { font-size: 20px; font-weight: 800; color: #111; margin-bottom: 4px; }
    .meta { color: #6b7280; font-size: 12px; margin-bottom: 24px; }
    .badge { display:inline-block; background:#dcfce7; color:#166534; font-size:11px; font-weight:700;
             padding:3px 10px; border-radius:20px; margin-bottom:20px; }
    table { width:100%; border-collapse:collapse; }
    thead tr { background:#111; color:#fff; }
    th { padding:10px 14px; text-align:left; font-size:11px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; }
    @media print { body { padding:20px; } }
  </style>
</head>
<body>
  <h1>Membresías Activas</h1>
  <p class="meta">Generado el ${now}</p>
  <div class="badge">${members.length} socios activos</div>
  <table>
    <thead>
      <tr>
        <th>Nombre</th><th>DNI</th><th>Plan</th>
        <th>Fecha Pago</th><th>Vencimiento</th><th>Días</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 400);
}

// ─── Main component ───────────────────────────────────────────────────────────

// Fecha de hoy en YYYY-MM-DD usando la hora LOCAL del navegador (no UTC)
const localToday = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export default function Reports() {
  const todayStr = localToday();
  const today    = new Date();

  // ── Income report state ───────────────────────────────────────────────────
  const [mode, setMode]         = useState('monthly');
  const [selDate, setSelDate]   = useState(todayStr);          // ← hora local
  const [selYear, setSelYear]   = useState(today.getFullYear());
  const [selMonth, setSelMonth] = useState(today.getMonth() + 1); // 1-indexed

  const [report, setReport]     = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);

  // ── Memberships state ─────────────────────────────────────────────────────
  const [members, setMembers]         = useState(null);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // ── Active tab ────────────────────────────────────────────────────────────
  const [tab, setTab] = useState('income'); // 'income' | 'members'

  // ── Fetch income report ───────────────────────────────────────────────────
  const fetchReport = useCallback(async () => {
    setLoadingReport(true);
    try {
      const params = new URLSearchParams({ mode });
      if (mode === 'daily' || mode === 'weekly') params.set('date', selDate);
      if (mode === 'monthly') { params.set('year', selYear); params.set('month', selMonth); }
      const { data } = await api.get(`/reports/income?${params}`);
      setReport(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingReport(false);
    }
  }, [mode, selDate, selYear, selMonth]);

  // ── Fetch active memberships ──────────────────────────────────────────────
  const fetchMembers = useCallback(async () => {
    setLoadingMembers(true);
    try {
      const { data } = await api.get('/reports/active-memberships');
      setMembers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  useEffect(() => { if (tab === 'income') fetchReport(); }, [tab, fetchReport]);
  useEffect(() => { if (tab === 'members') fetchMembers(); }, [tab, fetchMembers]);

  // ── Period label ──────────────────────────────────────────────────────────
  const periodLabel = () => {
    // Parsear 'YYYY-MM-DD' como fecha local agregando T12:00 para evitar shift de UTC
    if (mode === 'daily')   return new Date(`${selDate}T12:00:00`).toLocaleDateString('es-CO', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    if (mode === 'weekly')  return `Semana del ${new Date(`${selDate}T12:00:00`).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}`;
    return `${MONTHS[selMonth - 1]} ${selYear}`;
  };

  // ── Month nav ─────────────────────────────────────────────────────────────
  const prevMonth = () => {
    if (selMonth === 1) { setSelYear(y => y - 1); setSelMonth(12); }
    else setSelMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (selMonth === 12) { setSelYear(y => y + 1); setSelMonth(1); }
    else setSelMonth(m => m + 1);
  };
  const isCurrentMonth = selMonth === today.getMonth() + 1 && selYear === today.getFullYear();

  const maxDayTotal = report ? Math.max(...Object.values(report.byDay).map(d => d.total), 1) : 1;

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Reportes</h1>
          <p className="text-slate-500 text-xs mt-0.5">Análisis de ingresos y membresías activas</p>
        </div>
        <div className="flex gap-2">
          {tab === 'income' && report && (
            <button
              onClick={() => exportToExcel(report, mode, periodLabel())}
              className="flex items-center gap-2 px-4 py-2 bg-green-600/15 hover:bg-green-600/25 border border-green-600/30 text-green-400 font-bold text-sm rounded-xl transition-all"
            >
              <Download size={15} />
              Excel
            </button>
          )}
          {tab === 'members' && members && (
            <button
              onClick={() => exportMembershipsPDF(members.members)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600/15 hover:bg-blue-600/25 border border-blue-600/30 text-blue-400 font-bold text-sm rounded-xl transition-all"
            >
              <FileText size={15} />
              PDF
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-[#141414] border border-white/5 p-1 rounded-xl w-fit">
        {[
          { id: 'income',  label: 'Ingresos',    icon: BarChart2 },
          { id: 'members', label: 'Membresías',  icon: Users },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              tab === id
                ? 'bg-green-600 text-white shadow-lg shadow-green-600/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">

        {/* ── INCOME TAB ─────────────────────────────────────────────────────── */}
        {tab === 'income' && (
          <motion.div key="income" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">

            {/* Filters */}
            <div className="bg-[#141414] border border-white/5 rounded-2xl p-5 flex flex-wrap items-end gap-4">

              {/* Mode selector */}
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2">Período</p>
                <div className="flex gap-1.5">
                  {[
                    { v: 'daily',   l: 'Diario' },
                    { v: 'weekly',  l: 'Semanal' },
                    { v: 'monthly', l: 'Mensual' },
                  ].map(({ v, l }) => (
                    <button key={v} onClick={() => setMode(v)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        mode === v
                          ? 'bg-green-600 border-green-600 text-white'
                          : 'bg-[#0f0f0f] border-white/5 text-slate-400 hover:border-white/15'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date/month picker */}
              {(mode === 'daily' || mode === 'weekly') && (
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2">Fecha</p>
                  <input
                    type="date"
                    value={selDate}
                    max={todayStr}
                    onChange={e => setSelDate(e.target.value)}
                    className="bg-[#0f0f0f] border border-white/5 rounded-xl px-3 py-1.5 text-sm focus:ring-2 focus:ring-green-600 outline-none transition-all"
                  />
                </div>
              )}

              {mode === 'monthly' && (
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2">Mes</p>
                  <div className="flex items-center gap-2">
                    <button onClick={prevMonth} className="p-1.5 rounded-lg bg-[#0f0f0f] border border-white/5 hover:border-white/15 text-slate-400 hover:text-white transition-all">
                      <ChevronLeft size={15} />
                    </button>
                    <div className="flex gap-2">
                      <select
                        value={selMonth}
                        onChange={e => setSelMonth(Number(e.target.value))}
                        className="bg-[#0f0f0f] border border-white/5 rounded-xl px-3 py-1.5 text-sm outline-none appearance-none cursor-pointer"
                      >
                        {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                      </select>
                      <select
                        value={selYear}
                        onChange={e => setSelYear(Number(e.target.value))}
                        className="bg-[#0f0f0f] border border-white/5 rounded-xl px-3 py-1.5 text-sm outline-none appearance-none cursor-pointer"
                      >
                        {Array.from({ length: 4 }, (_, i) => today.getFullYear() - i).map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={nextMonth}
                      disabled={isCurrentMonth}
                      className="p-1.5 rounded-lg bg-[#0f0f0f] border border-white/5 hover:border-white/15 text-slate-400 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={fetchReport}
                disabled={loadingReport}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-bold text-sm rounded-xl transition-all disabled:opacity-50 ml-auto"
              >
                <RefreshCw size={14} className={loadingReport ? 'animate-spin' : ''} />
                Consultar
              </button>
            </div>

            {/* Loading skeleton */}
            {loadingReport && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-24 bg-[#141414] rounded-2xl border border-white/5 animate-pulse" />
                ))}
              </div>
            )}

            {/* Report content */}
            {!loadingReport && report && (
              <>
                {/* Period heading */}
                <div className="flex items-center gap-3">
                  <Calendar size={16} className="text-green-500" />
                  <h2 className="font-black text-lg capitalize">{periodLabel()}</h2>
                  <span className="text-xs text-slate-500">·</span>
                  <span className="text-lg font-black text-green-400">{fmt(report.grandTotal)}</span>
                </div>

                {/* KPI cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {Object.entries(TYPE_CONFIG).map(([type, cfg]) => (
                    <StatCard
                      key={type}
                      label={cfg.label}
                      value={fmt(report.breakdown[type]?.total ?? 0)}
                      sub={`${report.breakdown[type]?.count ?? 0} transacciones`}
                      icon={cfg.icon}
                      color={cfg.color}
                      bg={cfg.bg}
                      border={cfg.border}
                    />
                  ))}
                </div>

                {/* Payment methods */}
                <div className="bg-[#141414] border border-white/5 rounded-2xl p-5">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Por método de pago</p>
                  <div className="grid grid-cols-3 gap-4">
                    {Object.entries(METHOD_CONFIG).map(([method, cfg]) => {
                      const val = report.byMethod[method] ?? 0;
                      const pct = report.grandTotal > 0 ? ((val / report.grandTotal) * 100).toFixed(0) : 0;
                      return (
                        <div key={method} className="space-y-2">
                          <div className="flex items-center gap-2">
                            <cfg.icon size={14} className={cfg.color} />
                            <span className="text-xs text-slate-400 font-medium">{cfg.label}</span>
                          </div>
                          <p className={`text-lg font-black ${cfg.color}`}>{fmt(val)}</p>
                          <MiniBar value={val} max={report.grandTotal} color={method === 'cash' ? '#94a3b8' : method === 'card' ? '#4ade80' : '#60a5fa'} />
                          <p className="text-[10px] text-slate-600">{pct}% del total</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Daily breakdown (weekly/monthly only) */}
                {Object.keys(report.byDay).length > 1 && (
                  <div className="bg-[#141414] border border-white/5 rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-white/5">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Desglose por día</p>
                    </div>
                    <div className="divide-y divide-white/5 max-h-72 overflow-y-auto">
                      {Object.entries(report.byDay)
                        .sort(([a], [b]) => b.localeCompare(a))
                        .map(([day, d]) => (
                          <div key={day} className="px-5 py-3 flex items-center gap-4 hover:bg-white/5 transition-colors">
                            <span className="text-xs text-slate-500 font-mono w-24 flex-shrink-0">
                              {new Date(day + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short' })}
                            </span>
                            <div className="flex-1">
                              <MiniBar value={d.total} max={maxDayTotal} />
                            </div>
                            <div className="flex items-center gap-4 text-xs flex-shrink-0">
                              <span className="text-green-400 text-[10px]">Memb: {fmt(d.membership)}</span>
                              <span className="text-amber-400 text-[10px]">Diario: {fmt(d.daily_pass)}</span>
                              <span className="text-blue-400 text-[10px]">Prod: {fmt(d.product_sale)}</span>
                              <span className="font-black text-sm w-20 text-right">{fmt(d.total)}</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Transactions table */}
                <div className="bg-[#141414] border border-white/5 rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                      Transacciones ({report.payments?.length ?? 0})
                    </p>
                  </div>
                  {report.payments?.length === 0 ? (
                    <div className="py-12 text-center text-slate-600">
                      <TrendingUp size={32} className="mx-auto mb-2 opacity-20" />
                      <p className="text-sm">Sin movimientos en este período</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-80 overflow-y-auto">
                      <table className="w-full text-left">
                        <thead className="sticky top-0 bg-[#141414]">
                          <tr className="border-b border-white/5 text-[10px] text-slate-500 uppercase tracking-wider">
                            <th className="px-5 py-3 font-bold">Fecha</th>
                            <th className="px-5 py-3 font-bold">Cliente</th>
                            <th className="px-5 py-3 font-bold">Tipo</th>
                            <th className="px-5 py-3 font-bold">Método</th>
                            <th className="px-5 py-3 font-bold text-right">Monto</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {report.payments.map((p) => {
                            const typeCfg = TYPE_CONFIG[p.payment_type] ?? TYPE_CONFIG.membership;
                            return (
                              <tr key={p.id} className="hover:bg-white/5 transition-colors">
                                <td className="px-5 py-3 text-xs text-slate-500 font-mono whitespace-nowrap">
                                  {new Date(p.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                                  {' '}
                                  <span className="text-slate-700">
                                    {new Date(p.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </td>
                                <td className="px-5 py-3 text-sm font-medium max-w-[160px] truncate">
                                  {p.users?.full_name ?? <span className="text-slate-600 italic">General</span>}
                                </td>
                                <td className="px-5 py-3">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${typeCfg.bg} ${typeCfg.color} ${typeCfg.border}`}>
                                    {paymentTypeLabel[p.payment_type] ?? p.payment_type}
                                  </span>
                                </td>
                                <td className="px-5 py-3 text-xs capitalize text-slate-400">
                                  {p.payment_method}
                                </td>
                                <td className="px-5 py-3 text-right font-black text-sm text-green-400">
                                  {fmt(p.amount)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* ── MEMBERS TAB ────────────────────────────────────────────────────── */}
        {tab === 'members' && (
          <motion.div key="members" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldCheck size={18} className="text-green-500" />
                <h2 className="font-black text-lg">Membresías Activas</h2>
                {members && (
                  <span className="text-xs bg-green-600/15 text-green-400 font-bold px-2.5 py-0.5 rounded-full border border-green-600/20">
                    {members.total} socios
                  </span>
                )}
              </div>
              <button
                onClick={fetchMembers}
                disabled={loadingMembers}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
              >
                <RefreshCw size={15} className={loadingMembers ? 'animate-spin' : ''} />
              </button>
            </div>

            {loadingMembers && (
              <div className="space-y-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-14 bg-[#141414] rounded-xl border border-white/5 animate-pulse" />
                ))}
              </div>
            )}

            {!loadingMembers && members && (
              <div className="bg-[#141414] border border-white/5 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-white/5 text-[10px] text-slate-500 uppercase tracking-wider">
                        <th className="px-5 py-3.5 font-bold">Socio</th>
                        <th className="px-5 py-3.5 font-bold hidden sm:table-cell">DNI</th>
                        <th className="px-5 py-3.5 font-bold">Plan</th>
                        <th className="px-5 py-3.5 font-bold hidden md:table-cell">Fecha Pago</th>
                        <th className="px-5 py-3.5 font-bold">Vencimiento</th>
                        <th className="px-5 py-3.5 font-bold text-center">Días</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {members.members.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-5 py-12 text-center text-slate-600 text-sm">
                            No hay membresías activas
                          </td>
                        </tr>
                      ) : (
                        members.members.map((m) => {
                          const urgency = m.days_left <= 3 ? 'text-red-400 bg-red-500/10 border-red-500/20'
                                        : m.days_left <= 7 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                                        : 'text-green-400 bg-green-500/10 border-green-500/20';
                          return (
                            <tr key={m.id} className="hover:bg-white/5 transition-colors">
                              <td className="px-5 py-3.5">
                                <p className="font-bold text-sm">{m.full_name}</p>
                                <p className="text-[10px] text-slate-600">{m.phone}</p>
                              </td>
                              <td className="px-5 py-3.5 text-xs text-slate-500 hidden sm:table-cell">{m.dni}</td>
                              <td className="px-5 py-3.5">
                                <span className="text-xs font-bold text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                                  {m.plan_name}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 text-xs text-slate-500 hidden md:table-cell">
                                {fmtDate(m.start_date)}
                              </td>
                              <td className="px-5 py-3.5 text-xs text-slate-400">
                                {fmtDate(m.end_date)}
                              </td>
                              <td className="px-5 py-3.5 text-center">
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${urgency}`}>
                                  {m.days_left}d
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </motion.div>
        )}

      </AnimatePresence>
    </motion.div>
  );
}