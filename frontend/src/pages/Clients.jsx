// frontend/src/pages/Clients.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import {
  Search, UserPlus, Edit2, Phone, Mail, CreditCard,
  X, Save, Loader2, Users, ShieldCheck, ShieldOff,
  Clock, AlertTriangle, ChevronRight, RefreshCw,
  CheckCircle, CalendarPlus, Info, CalendarClock,
  Shield, Trash2, History, DollarSign, CalendarDays,
  XCircle, ChevronDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const LIMIT = 20;
const numPages = (count) => Math.ceil(count / LIMIT);

const STATUS_CFG = {
  active:   { label: 'Activo',     color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20',  dot: 'bg-green-400'  },
  warning:  { label: 'Por vencer', color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/20',  dot: 'bg-amber-400'  },
  expired:  { label: 'Vencido',    color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/20',    dot: 'bg-red-400'    },
  inactive: { label: 'Inactivo',   color: 'text-slate-400',  bg: 'bg-slate-500/10',  border: 'border-slate-500/20',  dot: 'bg-slate-500'  },
};

const PAY_METHODS = [
  { value: 'cash',     label: 'Efectivo'      },
  { value: 'card',     label: 'Tarjeta'       },
  { value: 'transfer', label: 'Transferencia' },
];

const fmt          = (n) => `$${Number(n ?? 0).toLocaleString('es-CO', { minimumFractionDigits: 0 })}`;
const fmtDate      = (d) => d ? new Date(`${d}T12:00:00Z`).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtDateShort = (d) => d ? new Date(`${d}T12:00:00Z`).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) : '—';
const addDays      = (ds, n) => { const d = new Date(`${ds}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const colToday     = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

/* ─── Atoms ──────────────────────────────────────────────────────────────── */
function StatusBadge({ status, pulse = false, small = false }) {
  const c = STATUS_CFG[status] ?? STATUS_CFG.inactive;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wider border ${c.color} ${c.bg} ${c.border} ${small ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'}`}>
      <span className={`rounded-full flex-shrink-0 ${c.dot} ${pulse ? 'animate-pulse' : ''} ${small ? 'size-1' : 'size-1.5'}`} />
      {c.label}
    </span>
  );
}

function DaysLeftBadge({ days }) {
  if (days === null || days === undefined) return null;
  if (days <= 0) return <span className="text-[9px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-full">Vencida</span>;
  const color = days <= 3 ? 'text-red-400 bg-red-500/10 border-red-500/20'
              : days <= 7 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
              : 'text-green-400 bg-green-500/10 border-green-500/20';
  return <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${color}`}>{days}d</span>;
}

/* ─── InputField ─────────────────────────────────────────────────────────── */
function InputField({ label, required, error, children }) {
  return (
    <div>
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      <AnimatePresence>
        {error && (
          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-1 mt-1 text-[10px] text-red-400 font-bold">
            <AlertTriangle size={9} /> {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

const inputCls = (err) =>
  `w-full bg-[#0f0f0f] border rounded-xl p-3 text-sm outline-none transition-all focus:ring-2 ${
    err ? 'border-red-500/50 focus:ring-red-500/30' : 'border-white/5 focus:ring-green-600'
  }`;

/* ═══════════════════════════════════════════════════════════════════════════
   MEMBERSHIP MODAL — normal + histórico + monto personalizado
   ═══════════════════════════════════════════════════════════════════════════ */
function MembershipModal({ client, plans, stats, onClose, onSuccess }) {
  const [mode, setMode]               = useState('normal'); // 'normal' | 'historical'
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [payMethod, setPayMethod]     = useState('cash');
  const [startDate, setStartDate]     = useState('');
  const [useCustomAmt, setUseCustomAmt] = useState(false);
  const [customAmt, setCustomAmt]     = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [result, setResult]           = useState(null);
  const [error, setError]             = useState('');

  const today        = colToday();
  const hasAny       = !!stats?.membership || (stats?.futureMemberships?.length ?? 0) > 0;
  const coveredUntil = stats?.realEndDate ?? null;
  const accumulated  = stats?.accumulatedDays ?? 0;

  const monthlyPlans = (plans ?? []).filter(p => p.duration_days > 1);

  // preview end date
  const previewEnd = (() => {
    if (!selectedPlan) return null;
    if (mode === 'historical' && startDate)
      return addDays(startDate, selectedPlan.duration_days - 1);
    if (mode === 'normal')
      return coveredUntil
        ? addDays(coveredUntil, selectedPlan.duration_days)
        : addDays(today, selectedPlan.duration_days - 1);
    return null;
  })();

  const isExpired   = previewEnd && mode === 'historical' && previewEnd < today;
  const daysPreview = previewEnd && !isExpired
    ? Math.max(0, Math.ceil((new Date(`${previewEnd}T12:00:00Z`) - new Date(`${today}T12:00:00Z`)) / 86_400_000))
    : 0;

  const handleSubmit = async () => {
    if (!selectedPlan) { setError('Selecciona un plan.'); return; }
    if (mode === 'historical' && !startDate) { setError('Ingresa la fecha de inicio.'); return; }
    setError(''); setSubmitting(true);
    try {
      const payload = {
        plan_id:        selectedPlan.id,
        payment_method: payMethod,
        mode,
        ...(mode === 'historical' && { start_date: startDate }),
        ...(useCustomAmt && customAmt !== '' && { amount: Number(customAmt) }),
      };
      const { data } = await api.post(`/clients/${client.id}/register-membership`, payload);
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.error ?? 'Error al procesar.');
    } finally { setSubmitting(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={!result ? onClose : undefined} />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        className="relative bg-[#1a1a1a] border border-white/10 w-full sm:max-w-sm sm:rounded-2xl rounded-t-3xl shadow-2xl max-h-[92vh] overflow-y-auto"
      >
        <div className="w-10 h-1 bg-white/10 rounded-full mx-auto mt-3 mb-1 sm:hidden" />

        {/* ── RESULTADO ──────────────────────────────────────────────────── */}
        {result ? (
          <div className="p-5 text-center space-y-4">
            <div className={`size-14 mx-auto rounded-full flex items-center justify-center border ${
              result.isStillActive === false
                ? 'bg-amber-500/15 border-amber-500/30'
                : 'bg-green-500/15 border-green-500/30'
            }`}>
              {result.isStillActive === false
                ? <History size={28} className="text-amber-400" />
                : <CheckCircle size={28} className="text-green-400" />}
            </div>
            <div>
              <h4 className="font-black text-base">
                {result.mode === 'historical'
                  ? result.isStillActive ? '¡Membresía registrada!' : 'Registro histórico guardado'
                  : result.extended ? '¡Días acumulados!' : '¡Membresía activada!'}
              </h4>
              <p className="text-slate-400 text-sm mt-0.5">{client.full_name}</p>
            </div>

            <div className={`rounded-xl p-3.5 text-left space-y-2 border ${
              result.mode === 'historical' && !result.isStillActive
                ? 'bg-amber-500/8 border-amber-500/20'
                : result.extended
                ? 'bg-blue-600/10 border-blue-600/20'
                : 'bg-green-600/10 border-green-600/20'
            }`}>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Plan</span>
                <span className="font-bold">{result.planName} · {result.planDays}d</span>
              </div>
              {result.previousEndDate && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Antes vencía</span>
                  <span className="font-bold">{fmtDate(result.previousEndDate)}</span>
                </div>
              )}
              {result.startDate && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Inicio</span>
                  <span className="font-bold">{fmtDate(result.startDate ?? result.newStartDate)}</span>
                </div>
              )}
              <div className="h-px bg-white/8" />
              <div className="flex justify-between">
                <span className="text-sm font-bold text-slate-200">Vence el</span>
                <span className={`font-black ${result.isStillActive === false ? 'text-amber-400' : 'text-green-400'}`}>
                  {fmtDate(result.endDate ?? result.newEndDate)}
                </span>
              </div>
              {(result.daysLeft > 0 || result.totalDaysLeft > 0) && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Días restantes</span>
                  <span className="font-bold text-green-400">{result.daysLeft ?? result.totalDaysLeft}d</span>
                </div>
              )}
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Monto registrado</span>
                <span className="font-bold text-green-400">{fmt(result.amountPaid)}</span>
              </div>
            </div>

            <button onClick={() => { onSuccess?.(); onClose(); }}
              className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-black text-sm transition-all">
              Listo
            </button>
          </div>
        ) : (
          /* ── FORMULARIO ──────────────────────────────────────────────── */
          <div className="p-5 space-y-4">
            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-black text-base">Registrar membresía</h4>
                <p className="text-xs text-slate-500 mt-0.5">{client.full_name}</p>
              </div>
              <button onClick={onClose} className="text-slate-500 hover:text-white p-1"><X size={18} /></button>
            </div>

            {/* Toggle modo */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-black/30 rounded-xl">
              {[
                { v: 'normal',     label: 'Desde hoy',   icon: Shield  },
                { v: 'historical', label: 'Histórico',   icon: History },
              ].map(({ v, label, icon: Icon }) => (
                <button key={v} onClick={() => { setMode(v); setStartDate(''); setError(''); }}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                    mode === v ? 'bg-[#1a1a1a] text-white shadow' : 'text-slate-500 hover:text-slate-300'
                  }`}>
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>

            {/* Info cobertura actual (modo normal) */}
            {mode === 'normal' && hasAny && coveredUntil && (
              <div className="flex items-start gap-2 px-3 py-2.5 bg-blue-600/10 border border-blue-600/20 rounded-xl">
                <Info size={13} className="text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-blue-300">
                  <p className="font-bold mb-0.5">Cobertura hasta {fmtDate(coveredUntil)}</p>
                  <p className="text-blue-400">El nuevo plan se sumará al final.{accumulated > 0 && ` (${accumulated}d acumulados)`}</p>
                </div>
              </div>
            )}

            {/* Aviso modo histórico */}
            {mode === 'historical' && (
              <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <Info size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300">Registra desde la fecha real de compra. Si ya venció, queda en el historial.</p>
              </div>
            )}

            {/* Fecha inicio (solo histórico) */}
            {mode === 'historical' && (
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Fecha de inicio real</label>
                <div className="relative">
                  <CalendarDays size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input type="date" value={startDate} max={today}
                    onChange={e => { setStartDate(e.target.value); setError(''); }}
                    className="w-full bg-[#0f0f0f] border border-white/5 rounded-xl py-2.5 pl-9 pr-3 text-sm focus:ring-2 focus:ring-green-600 outline-none transition-all" />
                </div>
              </div>
            )}

            {/* Planes */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Plan</label>
              <div className="space-y-1.5">
                {monthlyPlans.map(plan => {
                  const isSel = selectedPlan?.id === plan.id;
                  return (
                    <button key={plan.id} onClick={() => { setSelectedPlan(isSel ? null : plan); setError(''); }}
                      className={`w-full p-3 rounded-xl border-2 text-left flex justify-between items-center transition-all ${
                        isSel ? 'border-green-600 bg-green-600/10' : 'border-white/5 bg-[#0f0f0f] hover:border-white/15'
                      }`}>
                      <div>
                        <p className="font-bold text-sm">{plan.name}</p>
                        <p className="text-xs text-slate-500">{plan.duration_days} días</p>
                        {isSel && previewEnd && (
                          <p className={`text-[10px] mt-0.5 font-bold ${isExpired ? 'text-amber-400' : 'text-green-400'}`}>
                            → vence {fmtDate(previewEnd)} {isExpired ? '(ya venció)' : daysPreview > 0 ? `(${daysPreview}d)` : ''}
                          </p>
                        )}
                      </div>
                      <p className="font-black text-green-400 flex-shrink-0 ml-2">{fmt(plan.price)}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Método de pago */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Método de pago</label>
              <div className="grid grid-cols-3 gap-1.5">
                {PAY_METHODS.map(({ value, label }) => (
                  <button key={value} onClick={() => setPayMethod(value)}
                    className={`py-2.5 rounded-xl border-2 text-xs font-bold transition-all ${
                      payMethod === value
                        ? 'border-green-600 bg-green-600/15 text-green-400'
                        : 'border-white/5 bg-[#0f0f0f] text-slate-500 hover:border-white/15'
                    }`}>{label}</button>
                ))}
              </div>
            </div>

            {/* Monto personalizado */}
            <div>
              <button onClick={() => { setUseCustomAmt(!useCustomAmt); setCustomAmt(''); }}
                className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${
                  useCustomAmt ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'
                }`}>
                <div className={`size-3.5 rounded border-2 flex items-center justify-center transition-colors ${
                  useCustomAmt ? 'border-amber-500 bg-amber-500' : 'border-slate-600'
                }`}>
                  {useCustomAmt && <CheckCircle size={8} className="text-black" />}
                </div>
                Monto diferente al precio del plan
              </button>
              <AnimatePresence>
                {useCustomAmt && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mt-2">
                    <div className="relative">
                      <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input type="number" min="0" step="1000" value={customAmt}
                        onChange={e => setCustomAmt(e.target.value)}
                        placeholder={selectedPlan ? `Precio normal: ${fmt(selectedPlan.price)}` : 'Monto pagado...'}
                        className="w-full bg-[#0f0f0f] border border-amber-500/30 rounded-xl py-2.5 pl-8 pr-3 text-sm focus:ring-2 focus:ring-amber-500 outline-none transition-all" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex items-center gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
                  <AlertTriangle size={13} className="flex-shrink-0" /> {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit */}
            <button onClick={handleSubmit} disabled={!selectedPlan || submitting}
              className="w-full py-3.5 rounded-xl bg-green-600 hover:bg-green-500 text-white font-black text-sm transition-all disabled:opacity-40 flex items-center justify-center gap-2">
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              {submitting ? 'Procesando...'
                : mode === 'historical' ? 'Registrar histórico'
                : hasAny ? `Acumular — ${selectedPlan ? fmt(useCustomAmt && customAmt ? Number(customAmt) : selectedPlan.price) : '—'}`
                : `Activar — ${selectedPlan ? fmt(useCustomAmt && customAmt ? Number(customAmt) : selectedPlan.price) : '—'}`}
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CLIENT DETAIL PANEL — 3 tabs: Membresía / Actividad / Historial
   ═══════════════════════════════════════════════════════════════════════════ */
function ClientDetailPanel({ client, onClose, onEdit, onDelete, onMembershipChange, plans, mobile = false }) {
  const [stats, setStats]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState('membership'); // 'membership' | 'activity' | 'history'
  const [showMembModal, setShowMembModal] = useState(false);
  const [cancelling, setCancelling]       = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const loadStats = useCallback(() => {
    setLoading(true);
    api.get(`/clients/${client.id}/stats`)
      .then(({ data }) => setStats(data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [client.id]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const hasActive    = !!stats?.membership;
  const hasFuture    = (stats?.futureMemberships?.length ?? 0) > 0;
  const hasAny       = hasActive || hasFuture;
  const realEndDate  = stats?.realEndDate;
  const daysLeft     = stats?.daysLeft ?? null;
  const accumulated  = stats?.accumulatedDays ?? 0;

  const daysColor = !daysLeft || daysLeft <= 0 ? 'text-red-400'
    : daysLeft <= 3 ? 'text-red-400'
    : daysLeft <= 7 ? 'text-amber-400'
    : 'text-green-400';

  const handleCancelMembership = async () => {
    setCancelling(true);
    try {
      await api.post(`/clients/${client.id}/cancel-membership`);
      setConfirmCancel(false);
      loadStats();
      onMembershipChange?.();
    } catch (err) {
      alert(err.response?.data?.error ?? 'Error al cancelar membresía.');
    } finally { setCancelling(false); }
  };

  const TABS = [
    { id: 'membership', label: 'Membresía' },
    { id: 'activity',   label: 'Actividad' },
    { id: 'history',    label: 'Historial' },
  ];

  const content = (
    <>
      {mobile && <div className="w-10 h-1 bg-white/10 rounded-full mx-auto mb-3" />}

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className={`${mobile ? 'px-4 pb-3' : 'px-5 pt-5 pb-4'} border-b border-white/5 relative`}>
        <button onClick={onClose} className="absolute top-3 right-4 text-slate-600 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-all">
          <X size={16} />
        </button>
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-xl bg-green-600/20 border border-green-600/20 flex items-center justify-center text-green-400 font-black text-lg flex-shrink-0">
            {client.full_name?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0 pr-8">
            <p className="font-black text-sm truncate">{client.full_name}</p>
            <p className="text-xs text-slate-500 truncate">{client.dni ? `DNI: ${client.dni}` : 'Sin DNI'}</p>
            <div className="mt-1"><StatusBadge status={client.status} pulse={client.status === 'active'} small /></div>
          </div>
        </div>

        {/* Contacto inline */}
        <div className="flex gap-3 mt-2.5">
          {[{ icon: Phone, v: client.phone, ph: 'Sin teléfono' },
            { icon: Mail,  v: client.email, ph: 'Sin email'    }].map(({ icon: Icon, v, ph }) => (
            <div key={ph} className="flex items-center gap-1 text-[10px] text-slate-500 min-w-0">
              <Icon size={10} className="text-slate-700 flex-shrink-0" />
              <span className={`truncate ${v ? '' : 'text-slate-700 italic'}`}>{v || ph}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────── */}
      <div className="flex border-b border-white/5">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider transition-all ${
              tab === t.id
                ? 'text-green-400 border-b-2 border-green-500 -mb-px'
                : 'text-slate-500 hover:text-slate-300'
            }`}>{t.label}</button>
        ))}
      </div>

      {/* ── Contenido tabs ─────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={18} className="animate-spin text-green-500 opacity-50" />
        </div>
      ) : (
        <div className={`${mobile ? 'px-4' : 'px-5'} py-3 min-h-[160px]`}>

          {/* TAB: MEMBRESÍA */}
          {tab === 'membership' && (
            <div className="space-y-3">
              {hasAny ? (
                <>
                  {hasActive && (
                    <div className="bg-green-600/8 border border-green-600/15 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-black truncate">{stats.membership.membership_plans?.name}</p>
                        <span className={`text-sm font-black flex-shrink-0 ml-2 ${daysColor}`}>
                          {daysLeft <= 0 ? 'Vencida' : `${daysLeft}d`}
                        </span>
                      </div>
                      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{
                          width: `${Math.max(0, Math.min(100, (daysLeft / (stats.membership.membership_plans?.duration_days ?? 30)) * 100))}%`,
                          background: daysLeft <= 3 ? '#ef4444' : daysLeft <= 7 ? '#f59e0b' : '#16a34a',
                        }} />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500">
                        <span>Inicio: <span className="text-slate-300">{fmtDateShort(stats.membership.start_date)}</span></span>
                        <span>Vence: <span className="text-slate-300 font-bold">{fmtDate(realEndDate)}</span></span>
                      </div>
                    </div>
                  )}

                  {!hasActive && hasFuture && (
                    <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/8 border border-amber-500/20 rounded-xl px-3 py-2.5">
                      <CalendarClock size={12} className="flex-shrink-0" />
                      <span>Inicia {fmtDate(stats.futureMemberships[0].start_date)}</span>
                    </div>
                  )}

                  {hasFuture && (
                    <div className="space-y-1.5 pt-1">
                      <p className="text-[9px] text-slate-600 uppercase tracking-widest font-bold">Acumulados (+{accumulated}d)</p>
                      {stats.futureMemberships.map((m, i) => (
                        <div key={i} className="flex justify-between text-[10px] gap-2 bg-blue-600/5 border border-blue-600/10 rounded-lg px-2.5 py-1.5">
                          <span className="text-blue-400 font-bold truncate">{m.membership_plans?.name}</span>
                          <span className="text-slate-600 flex-shrink-0">desde {fmtDateShort(m.start_date)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Cancelar membresía */}
                  {hasAny && (
                    confirmCancel ? (
                      <div className="bg-red-500/8 border border-red-500/20 rounded-xl p-3 space-y-2">
                        <p className="text-xs text-red-400 font-bold">¿Cancelar toda la cobertura del socio?</p>
                        <p className="text-[10px] text-slate-500">Esta acción expirará su membresía inmediatamente.</p>
                        <div className="flex gap-2">
                          <button onClick={handleCancelMembership} disabled={cancelling}
                            className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-black transition-all disabled:opacity-50 flex items-center justify-center gap-1">
                            {cancelling ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
                            Sí, cancelar
                          </button>
                          <button onClick={() => setConfirmCancel(false)}
                            className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 text-xs font-bold transition-all">
                            No, volver
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmCancel(true)}
                        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/8 text-[10px] font-bold uppercase tracking-wider transition-all">
                        <XCircle size={11} /> Cancelar membresía
                      </button>
                    )
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 py-4 text-center">
                  <ShieldOff size={22} className="text-slate-700" />
                  <p className="text-xs text-slate-500">Sin membresía activa</p>
                </div>
              )}
            </div>
          )}

          {/* TAB: ACTIVIDAD */}
          {tab === 'activity' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Total visitas</p>
                <span className="text-sm font-black text-green-400">{stats?.totalVisits ?? 0}</span>
              </div>
              {(stats?.recentCheckins?.length ?? 0) > 0 ? (
                stats.recentCheckins.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 py-1.5 border-b border-white/4 last:border-0">
                    <div className={`size-2 rounded-full flex-shrink-0 ${c.type === 'monthly' ? 'bg-green-500' : 'bg-amber-500'}`} />
                    <span className="text-xs text-slate-400 flex-1">{c.type === 'monthly' ? 'Membresía' : 'Pase diario'}</span>
                    <span className="text-[10px] text-slate-600">
                      {new Date(c.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: '2-digit' })}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-600 italic text-center py-4">Sin visitas registradas</p>
              )}

              {(stats?.recentPayments?.length ?? 0) > 0 && (
                <>
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pt-2">Últimos pagos</p>
                  {stats.recentPayments.map((p, i) => (
                    <div key={i} className="flex items-center justify-between py-1 border-b border-white/4 last:border-0">
                      <span className="text-xs text-slate-400 capitalize">{p.payment_type?.replace('_', ' ')}</span>
                      <span className="text-xs font-bold text-green-400">{fmt(p.amount)}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* TAB: HISTORIAL */}
          {tab === 'history' && (
            <div className="space-y-1.5">
              {(stats?.membershipHistory?.length ?? 0) === 0 ? (
                <p className="text-xs text-slate-600 italic text-center py-4">Sin membresías registradas</p>
              ) : stats.membershipHistory.map((m, i) => {
                const expired = m.status === 'expired' || m.end_date < colToday();
                return (
                  <div key={i} className={`rounded-xl p-2.5 border space-y-1 ${
                    expired ? 'bg-white/2 border-white/5' : 'bg-green-600/6 border-green-600/15'
                  }`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold truncate">{m.membership_plans?.name ?? 'Plan'}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${
                        expired
                          ? 'text-slate-500 bg-slate-500/10 border-slate-500/20'
                          : 'text-green-400 bg-green-500/10 border-green-500/20'
                      }`}>{expired ? 'Vencida' : 'Activa'}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>{fmtDateShort(m.start_date)} → {fmtDateShort(m.end_date)}</span>
                      <span>{m.membership_plans?.duration_days ?? '?'}d</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Acciones ───────────────────────────────────────────────── */}
      <div className={`${mobile ? 'px-4 pb-4 pt-2' : 'px-5 py-3'} border-t border-white/5 space-y-2`}>
        <div className="flex gap-2">
          <button onClick={() => setShowMembModal(true)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border font-bold text-xs transition-all ${
              hasAny
                ? 'bg-blue-600/10 hover:bg-blue-600/20 border-blue-600/25 text-blue-400'
                : 'bg-green-600/15 hover:bg-green-600/25 border-green-600/30 text-green-400'
            }`}>
            {hasAny ? <CalendarPlus size={13} /> : <CreditCard size={13} />}
            {hasAny ? 'Acumular / Histórico' : 'Activar membresía'}
          </button>
          <button onClick={onEdit}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-slate-300 font-bold text-xs transition-all">
            <Edit2 size={13} />
          </button>
          <button onClick={onDelete}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-red-500/8 hover:bg-red-500/15 border border-red-500/15 text-red-400 font-bold text-xs transition-all">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showMembModal && (
          <MembershipModal
            client={client} plans={plans} stats={stats}
            onClose={() => setShowMembModal(false)}
            onSuccess={() => { loadStats(); onMembershipChange?.(); }}
          />
        )}
      </AnimatePresence>
    </>
  );

  if (mobile) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-end">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <motion.div
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 400, damping: 35 }}
          className="relative w-full bg-[#141414] border-t border-white/8 rounded-t-3xl pt-3 pb-safe overflow-y-auto max-h-[90vh]">
          {content}
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      className="w-72 xl:w-80 flex-shrink-0 bg-[#141414] border border-white/5 rounded-2xl overflow-hidden flex flex-col h-fit sticky top-4">
      {content}
    </motion.div>
  );
}

/* ─── MobileClientRow ────────────────────────────────────────────────────── */
function MobileClientRow({ client, isSelected, onClick }) {
  const membership  = client.activeMembership;
  const realEndDate = client.realEndDate;
  const daysLeft    = client.daysLeft;
  return (
    <div onClick={onClick}
      className={`flex items-center gap-3 px-3 py-3 transition-colors cursor-pointer border-b border-white/5 last:border-0 ${
        isSelected ? 'bg-green-600/5 border-l-2 border-l-green-500' : 'active:bg-white/5'
      }`}>
      <div className={`size-9 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 ${
        isSelected ? 'bg-green-600 text-white' : 'bg-green-600/15 text-green-400'
      }`}>
        {client.full_name?.[0]?.toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm truncate">{client.full_name}</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <StatusBadge status={client.status} small />
          {membership && (
            <>
              <span className="text-slate-700">·</span>
              <span className="text-[10px] text-slate-500">vence {fmtDateShort(realEndDate)}</span>
              <DaysLeftBadge days={daysLeft} />
            </>
          )}
        </div>
      </div>
      <ChevronRight size={14} className={`flex-shrink-0 transition-transform ${isSelected ? 'text-green-400 rotate-90' : 'text-slate-600'}`} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CLIENT FORM MODAL — crear / editar con validación inline
   ═══════════════════════════════════════════════════════════════════════════ */
function ClientFormModal({ client, onClose, onSaved }) {
  const isEdit = !!client;
  const [form, setForm]       = useState({
    full_name: client?.full_name ?? '',
    phone:     client?.phone     ?? '',
    email:     client?.email     ?? '',
    dni:       client?.dni       ?? '',
    status:    client?.status    ?? 'inactive',
  });
  const [errors, setErrors]   = useState({});
  const [saving, setSaving]   = useState(false);
  const [apiError, setApiError] = useState('');

  const setField = (k) => (v) => {
    setForm(f => ({ ...f, [k]: v }));
    if (errors[k]) setErrors(e => ({ ...e, [k]: '' }));
    setApiError('');
  };

  const validate = () => {
    const e = {};
    if (!form.full_name.trim())          e.full_name = 'El nombre es obligatorio.';
    else if (form.full_name.trim().length < 2) e.full_name = 'Mínimo 2 caracteres.';
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim()))
      e.email = 'Correo inválido.';
    if (form.dni.trim() && !/^\d{6,12}$/.test(form.dni.trim()))
      e.dni = 'Solo dígitos, 6-20 caracteres.';
    if (form.phone.trim() && !/^\+?[\d\s\-().]{7,20}$/.test(form.phone.trim()))
      e.phone = 'Teléfono inválido.';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    try {
      let saved;
      if (isEdit) {
        const { data } = await api.put(`/clients/${client.id}`, form);
        saved = data;
      } else {
        const { data } = await api.post('/clients', form);
        saved = data;
      }
      onSaved(saved, isEdit);
      onClose();
    } catch (err) {
      const msg = err.response?.data?.error ?? 'Error al guardar.';
      // Mapear errores de duplicados a campos
      if (msg.toLowerCase().includes('dni'))   setErrors(e => ({ ...e, dni: msg }));
      else if (msg.toLowerCase().includes('correo') || msg.toLowerCase().includes('email'))
        setErrors(e => ({ ...e, email: msg }));
      else setApiError(msg);
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        className="relative bg-[#1a1a1a] border border-white/10 w-full sm:max-w-md sm:rounded-2xl rounded-t-3xl p-5 sm:p-7 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="w-10 h-1 bg-white/10 rounded-full mx-auto mb-4 sm:hidden" />
        <div className="flex justify-between items-center mb-5">
          <div>
            <h3 className="text-xl font-black">{isEdit ? 'Editar socio' : 'Nuevo socio'}</h3>
            <p className="text-slate-500 text-xs mt-0.5">{isEdit ? 'Modifica la información' : 'Completa los datos del socio'}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white p-1"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
          <InputField label="Nombre completo" required error={errors.full_name}>
            <input type="text" value={form.full_name} onChange={e => setField('full_name')(e.target.value)}
              placeholder="Ej: Juan Pérez" className={inputCls(errors.full_name)} />
          </InputField>

          <div className="grid grid-cols-2 gap-3">
            <InputField label="DNI / Cédula" error={errors.dni}>
              <input type="text" value={form.dni} onChange={e => setField('dni')(e.target.value)}
                placeholder="1234567890" className={inputCls(errors.dni)} />
            </InputField>
            <InputField label="Teléfono" error={errors.phone}>
              <input type="tel" value={form.phone} onChange={e => setField('phone')(e.target.value)}
                placeholder="300 123 4567" className={inputCls(errors.phone)} />
            </InputField>
          </div>

          <InputField label="Correo electrónico" error={errors.email}>
            <input type="email" value={form.email} onChange={e => setField('email')(e.target.value)}
              placeholder="correo@ejemplo.com" className={inputCls(errors.email)} />
          </InputField>

          {isEdit && (
            <InputField label="Estado">
              <div className="grid grid-cols-4 gap-1.5">
                {Object.entries(STATUS_CFG).map(([value, cfg]) => (
                  <button key={value} type="button" onClick={() => setField('status')(value)}
                    className={`py-2 rounded-xl border-2 text-[10px] font-bold transition-all ${
                      form.status === value
                        ? `border-current ${cfg.bg} ${cfg.color}`
                        : 'border-white/5 bg-[#0f0f0f] text-slate-500 hover:border-white/15'
                    }`}>{cfg.label}</button>
                ))}
              </div>
            </InputField>
          )}

          {apiError && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
              <AlertTriangle size={13} className="flex-shrink-0" /> {apiError}
            </div>
          )}

          <button type="submit" disabled={saving}
            className="w-full mt-1 bg-green-600 hover:bg-green-500 text-white font-black py-3.5 rounded-xl shadow-lg shadow-green-600/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            {isEdit ? 'Guardar cambios' : 'Crear socio'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   DELETE CONFIRM MODAL
   ═══════════════════════════════════════════════════════════════════════════ */
function DeleteConfirmModal({ client, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError]       = useState('');

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/clients/${client.id}`);
      onDeleted(client.id);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error ?? 'Error al eliminar.');
    } finally { setDeleting(false); }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
        className="relative bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4">
        <div className="size-14 mx-auto rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center">
          <Trash2 size={24} className="text-red-400" />
        </div>
        <div>
          <h3 className="font-black text-lg">¿Eliminar socio?</h3>
          <p className="text-slate-400 text-sm mt-1">
            <span className="text-white font-bold">{client.full_name}</span> será eliminado permanentemente.
          </p>
          <p className="text-slate-600 text-xs mt-1">Solo puedes eliminar socios sin membresía activa.</p>
        </div>
        {error && (
          <div className="flex items-start gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 text-left">
            <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" /> {error}
          </div>
        )}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-sm transition-all">
            Cancelar
          </button>
          <button onClick={handleDelete} disabled={deleting}
            className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
            Eliminar
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN — Clients
   ═══════════════════════════════════════════════════════════════════════════ */
export default function Clients() {
  const [clients, setClients]             = useState([]);
  const [search, setSearch]               = useState('');
  const [statusFilter, setStatusFilter]   = useState('all');
  const [loading, setLoading]             = useState(true);
  const [page, setPage]                   = useState(1);
  const [totalCount, setTotalCount]       = useState(0);
  const [selectedClient, setSelectedClient] = useState(null);
  const [plans, setPlans]                 = useState([]);
  const [statsCount, setStatsCount]       = useState({ active: 0, warning: 0, expired: 0, inactive: 0 });

  // Modals
  const [formModal, setFormModal]         = useState(null);   // null | client | 'new'
  const [deleteModal, setDeleteModal]     = useState(null);   // null | client

  const searchRef = useRef('');
  const filterRef = useRef('all');
  const pageRef   = useRef(1);

  useEffect(() => {
    api.get('/plans').then(({ data }) => setPlans(Array.isArray(data) ? data : [])).catch(() => {});
  }, []);

  const fetchClients = useCallback(async ({ forcePage, forceSearch, forceFilter } = {}) => {
    const s      = forceSearch !== undefined ? forceSearch : searchRef.current;
    const f      = forceFilter !== undefined ? forceFilter : filterRef.current;
    const p      = forcePage   !== undefined ? forcePage   : pageRef.current;
    const offset = (p - 1) * LIMIT;
    setLoading(true);
    try {
      const params = new URLSearchParams({ search: s, limit: LIMIT, offset, ...(f !== 'all' && { status: f }) });
      const { data } = await api.get(`/clients?${params}`);
      setClients(data?.data ?? []);
      setTotalCount(data?.count ?? 0);
    } catch { setClients([]); }
    finally { setLoading(false); }
  }, []);

  const fetchCounts = useCallback(async () => {
    try {
      const { data } = await api.get('/clients/counts');
      setStatsCount(data);
    } catch (_) {}
  }, []);

  useEffect(() => {
    searchRef.current = search;
    const t = setTimeout(() => {
      pageRef.current = 1; setPage(1);
      fetchClients({ forceSearch: search, forcePage: 1 });
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const handleFilterChange = (val) => {
    setStatusFilter(val); filterRef.current = val;
    pageRef.current = 1; setPage(1);
    fetchClients({ forceFilter: val, forceSearch: searchRef.current, forcePage: 1 });
  };

  const goToPage = (p) => {
    pageRef.current = p; setPage(p);
    fetchClients({ forcePage: p });
    document.getElementById('clients-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => { fetchCounts(); }, []);

  // Callbacks del CRUD
  const handleSaved = (saved, isEdit) => {
    if (isEdit) {
      setClients(prev => prev.map(c => c.id === saved.id ? { ...c, ...saved } : c));
      if (selectedClient?.id === saved.id) setSelectedClient(prev => ({ ...prev, ...saved }));
    } else {
      pageRef.current = 1; setPage(1);
      fetchClients({ forcePage: 1 });
      fetchCounts();
    }
  };

  const handleDeleted = (id) => {
    setClients(prev => prev.filter(c => c.id !== id));
    if (selectedClient?.id === id) setSelectedClient(null);
    fetchCounts();
  };

  const handleMembershipChange = () => {
    fetchClients({ forcePage: pageRef.current });
    fetchCounts();
  };

  const STATUS_TABS = [
    { value: 'all',      label: 'Todos',    count: totalCount },
    { value: 'active',   label: 'Activos',  count: statsCount.active },
    { value: 'warning',  label: 'Vencer',   count: statsCount.warning },
    { value: 'expired',  label: 'Vencidos', count: statsCount.expired },
    { value: 'inactive', label: 'Inact.',   count: statsCount.inactive },
  ];

  const totalPgs = numPages(totalCount);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 sm:space-y-5">

      {/* Header */}
      <div className="flex justify-between items-center gap-2">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Socios</h1>
          <p className="text-slate-500 text-xs sm:text-sm">{totalCount.toLocaleString()} registrados</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { fetchClients({ forceSearch: searchRef.current, forceFilter: filterRef.current }); fetchCounts(); }}
            className="p-2 sm:p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setFormModal('new')}
            className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 text-white font-bold px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl shadow-lg shadow-green-600/20 transition-all active:scale-95 text-sm">
            <UserPlus size={15} /> <span>Nuevo socio</span>
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-1.5 sm:gap-3">
        {[
          { key: 'active',   label: 'Activos',  icon: ShieldCheck,   color: 'text-green-400', bg: 'bg-green-500/10'  },
          { key: 'warning',  label: 'Vencer',   icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10'  },
          { key: 'expired',  label: 'Vencidos', icon: ShieldOff,     color: 'text-red-400',   bg: 'bg-red-500/10'    },
          { key: 'inactive', label: 'Inact.',   icon: Clock,         color: 'text-slate-400', bg: 'bg-slate-500/10'  },
        ].map(({ key, label, icon: Icon, color, bg }) => (
          <button key={key} onClick={() => handleFilterChange(statusFilter === key ? 'all' : key)}
            className={`flex flex-col items-center justify-center gap-0.5 p-2 sm:p-4 sm:flex-row sm:items-center sm:gap-3 sm:justify-start rounded-xl border transition-all text-center sm:text-left ${
              statusFilter === key ? `${bg} border-current/30 ${color}` : 'bg-[#141414] border-white/5 hover:border-white/10 text-slate-400'
            }`}>
            <Icon size={14} className={`sm:size-4 ${statusFilter === key ? color : 'text-slate-600'} flex-shrink-0`} />
            <div>
              <p className="text-base sm:text-xl font-black leading-none">{statsCount[key]}</p>
              <p className="text-[8px] sm:text-[10px] font-bold uppercase tracking-wide mt-0.5">{label}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Search + tabs */}
      <div className="space-y-2 sm:space-y-0 sm:flex sm:gap-3">
        <div className="relative group flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-green-500 transition-colors" size={15} />
          <input type="text" placeholder="Buscar nombre, teléfono o DNI..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#141414] border border-white/5 rounded-xl py-2.5 pl-9 pr-4 focus:ring-2 focus:ring-green-600 outline-none transition-all text-sm" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
              <X size={13} />
            </button>
          )}
        </div>
        <div className="flex gap-1 overflow-x-auto scrollbar-none pb-0.5">
          {STATUS_TABS.map(({ value, label, count }) => (
            <button key={value} onClick={() => handleFilterChange(value)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all border whitespace-nowrap flex-shrink-0 ${
                statusFilter === value
                  ? 'bg-green-600 border-green-600 text-white'
                  : 'bg-[#141414] border-white/5 text-slate-400 hover:border-white/15 hover:text-white'
              }`}>
              {label}
              {count > 0 && <span className={`ml-1 ${statusFilter === value ? 'text-green-200' : 'text-slate-600'}`}>{count}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Layout principal */}
      <div className="flex gap-4 xl:gap-5 items-start">
        <div id="clients-table" className="flex-1 min-w-0 bg-[#141414] border border-white/5 rounded-xl sm:rounded-2xl overflow-hidden shadow-xl">

          {/* MÓVIL */}
          <div className="sm:hidden">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-3 border-b border-white/5">
                    <div className="size-9 rounded-xl bg-white/5 animate-pulse flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-white/5 rounded-full animate-pulse w-2/3" />
                      <div className="h-2.5 bg-white/5 rounded-full animate-pulse w-1/2" />
                    </div>
                  </div>
                ))
              : clients.length === 0
              ? <div className="py-12 text-center">
                  <Users size={28} className="mx-auto mb-2 text-slate-700" />
                  <p className="text-slate-500 text-sm">No se encontraron socios</p>
                </div>
              : clients.map(client => (
                  <MobileClientRow key={client.id} client={client}
                    isSelected={selectedClient?.id === client.id}
                    onClick={() => setSelectedClient(selectedClient?.id === client.id ? null : client)} />
                ))
            }
          </div>

          {/* DESKTOP */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left min-w-[560px]">
              <thead>
                <tr className="bg-white/5 text-slate-500 text-[10px] uppercase tracking-wider">
                  <th className="px-4 lg:px-5 py-3.5 font-bold">Socio</th>
                  <th className="px-4 lg:px-5 py-3.5 font-bold hidden md:table-cell">Contacto</th>
                  <th className="px-4 lg:px-5 py-3.5 font-bold">Estado</th>
                  <th className="px-4 lg:px-5 py-3.5 font-bold">Membresía</th>
                  <th className="px-4 lg:px-5 py-3.5 font-bold hidden xl:table-cell">Último ingreso</th>
                  <th className="px-4 lg:px-5 py-3.5 font-bold text-right">Ver</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i}><td colSpan={6} className="px-5 py-4">
                        <div className="h-4 bg-white/5 rounded-full animate-pulse" style={{ width: `${60 + (i % 3) * 15}%` }} />
                      </td></tr>
                    ))
                  : clients.length === 0
                  ? <tr><td colSpan={6} className="px-6 py-14 text-center">
                      <Users size={32} className="mx-auto mb-3 text-slate-700" />
                      <p className="text-slate-500 text-sm">No se encontraron socios</p>
                    </td></tr>
                  : clients.map(client => {
                      const isSel      = selectedClient?.id === client.id;
                      const membership  = client.activeMembership;
                      const realEndDate = client.realEndDate;
                      const daysLeft    = client.daysLeft;
                      return (
                        <tr key={client.id} onClick={() => setSelectedClient(isSel ? null : client)}
                          className={`transition-colors cursor-pointer group ${isSel ? 'bg-green-600/5 border-l-2 border-l-green-600' : 'hover:bg-white/5'}`}>
                          <td className="px-4 lg:px-5 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className={`size-9 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 ${isSel ? 'bg-green-600 text-white' : 'bg-green-600/15 text-green-400'}`}>
                                {client.full_name?.[0]?.toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-sm truncate">{client.full_name}</p>
                                <p className="text-[10px] text-slate-600 truncate">{client.dni ?? '—'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 lg:px-5 py-3 hidden md:table-cell">
                            <p className="text-xs text-slate-400 truncate">{client.phone ?? '—'}</p>
                            <p className="text-[10px] text-slate-600 truncate">{client.email ?? '—'}</p>
                          </td>
                          <td className="px-4 lg:px-5 py-3"><StatusBadge status={client.status} /></td>
                          <td className="px-4 lg:px-5 py-3">
                            {membership ? (
                              <div>
                                <div className="flex items-center gap-1">
                                  <Shield size={10} className="text-green-500 flex-shrink-0" />
                                  <p className="text-xs font-bold text-slate-200 truncate max-w-[110px]">{membership.membership_plans?.name ?? 'Plan'}</p>
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <p className="text-[10px] text-slate-500">vence {fmtDateShort(realEndDate)}</p>
                                  <DaysLeftBadge days={daysLeft} />
                                </div>
                              </div>
                            ) : client.status === 'inactive' ? (
                              <span className="text-xs text-slate-600 italic">Sin plan</span>
                            ) : (
                              <div className="flex items-center gap-1">
                                <ShieldOff size={10} className="text-red-400 flex-shrink-0" />
                                <span className="text-xs text-red-400">Vencida</span>
                              </div>
                            )}
                          </td>
                          <td className="px-4 lg:px-5 py-3 hidden xl:table-cell">
                            <p className="text-xs text-slate-500">
                              {client.last_check_in
                                ? new Date(client.last_check_in).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: '2-digit' })
                                : 'Nunca'}
                            </p>
                          </td>
                          <td className="px-4 lg:px-5 py-3 text-right">
                            <ChevronRight size={14} className={`ml-auto transition-transform ${isSel ? 'text-green-400 rotate-90' : 'text-slate-600 group-hover:text-slate-400'}`} />
                          </td>
                        </tr>
                      );
                    })
                }
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {totalCount > LIMIT && !loading && (() => {
            const delta = 1;
            const start = Math.max(1, page - delta);
            const end   = Math.min(totalPgs, page + delta);
            const pNums = Array.from({ length: end - start + 1 }, (_, i) => start + i);
            return (
              <div className="px-3 py-2.5 sm:p-4 border-t border-white/5 flex items-center justify-between gap-2">
                <span className="text-xs text-slate-600 hidden sm:inline">
                  {((page - 1) * LIMIT) + 1}–{Math.min(page * LIMIT, totalCount)} de {totalCount.toLocaleString()}
                </span>
                <div className="flex items-center gap-0.5 sm:gap-1 mx-auto sm:mx-0">
                  <button onClick={() => goToPage(page - 1)} disabled={page === 1}
                    className="px-2 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-all">‹</button>
                  {start > 1 && (<>
                    <button onClick={() => goToPage(1)} className="px-2 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white hover:bg-white/10 transition-all">1</button>
                    {start > 2 && <span className="text-slate-700 text-xs px-0.5">…</span>}
                  </>)}
                  {pNums.map(p => (
                    <button key={p} onClick={() => goToPage(p)}
                      className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all ${p === page ? 'bg-green-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}>
                      {p}
                    </button>
                  ))}
                  {end < totalPgs && (<>
                    {end < totalPgs - 1 && <span className="text-slate-700 text-xs px-0.5">…</span>}
                    <button onClick={() => goToPage(totalPgs)} className="px-2 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white hover:bg-white/10 transition-all">{totalPgs}</button>
                  </>)}
                  <button onClick={() => goToPage(page + 1)} disabled={page >= totalPgs}
                    className="px-2 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-all">›</button>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Panel detalle — desktop */}
        <AnimatePresence>
          {selectedClient && (
            <div className="hidden lg:block">
              <ClientDetailPanel
                key={selectedClient.id}
                client={selectedClient}
                plans={plans}
                onClose={() => setSelectedClient(null)}
                onEdit={() => setFormModal(selectedClient)}
                onDelete={() => setDeleteModal(selectedClient)}
                onMembershipChange={handleMembershipChange}
              />
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Panel detalle — móvil */}
      <AnimatePresence>
        {selectedClient && (
          <div className="lg:hidden">
            <ClientDetailPanel
              key={`m-${selectedClient.id}`}
              client={selectedClient}
              plans={plans}
              mobile
              onClose={() => setSelectedClient(null)}
              onEdit={() => { setSelectedClient(null); setFormModal(selectedClient); }}
              onDelete={() => { setSelectedClient(null); setDeleteModal(selectedClient); }}
              onMembershipChange={handleMembershipChange}
            />
          </div>
        )}
      </AnimatePresence>

      {/* Modal crear/editar */}
      <AnimatePresence>
        {formModal && (
          <ClientFormModal
            client={formModal === 'new' ? null : formModal}
            onClose={() => setFormModal(null)}
            onSaved={handleSaved}
          />
        )}
      </AnimatePresence>

      {/* Modal eliminar */}
      <AnimatePresence>
        {deleteModal && (
          <DeleteConfirmModal
            client={deleteModal}
            onClose={() => setDeleteModal(null)}
            onDeleted={handleDeleted}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}