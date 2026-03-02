// frontend/src/pages/Clients.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import {
  Search, UserPlus, Edit2, Phone, Mail, CreditCard,
  X, Save, Loader2, Users, ShieldCheck, ShieldOff,
  Clock, AlertTriangle, ChevronRight, RefreshCw,
  CheckCircle, CalendarPlus, Info, CalendarClock, Shield,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const LIMIT = 20;
const numPages = (count) => Math.ceil(count / LIMIT);

const STATUS_CONFIG = {
  active:   { label: 'Activo',     color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20',  dot: 'bg-green-400'  },
  warning:  { label: 'Por vencer', color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/20',  dot: 'bg-amber-400'  },
  expired:  { label: 'Vencido',    color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/20',    dot: 'bg-red-400'    },
  inactive: { label: 'Inactivo',   color: 'text-slate-400',  bg: 'bg-slate-500/10',  border: 'border-slate-500/20',  dot: 'bg-slate-500'  },
};

const PAYMENT_METHODS = [
  { value: 'cash',     label: 'Efectivo' },
  { value: 'card',     label: 'Tarjeta'  },
  { value: 'transfer', label: 'Transf.'  },
];

const fmt          = (n) => `$${Number(n ?? 0).toLocaleString('es-CO', { minimumFractionDigits: 0 })}`;
const fmtDate      = (d) => d ? new Date(`${d}T12:00:00Z`).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtDateShort = (d) => d ? new Date(`${d}T12:00:00Z`).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }) : '—';
const addDays      = (dateStr, days) => { const d = new Date(`${dateStr}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };

// ─── StatusBadge ──────────────────────────────────────────────────────────────
function StatusBadge({ status, pulse = false, small = false }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.inactive;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wider border ${cfg.color} ${cfg.bg} ${cfg.border} ${small ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]'}`}>
      <span className={`rounded-full flex-shrink-0 ${cfg.dot} ${pulse ? 'animate-pulse' : ''} ${small ? 'size-1' : 'size-1.5'}`} />
      {cfg.label}
    </span>
  );
}

// ─── DaysLeftBadge ────────────────────────────────────────────────────────────
function DaysLeftBadge({ days }) {
  if (days === null || days === undefined) return null;
  if (days <= 0) return <span className="text-[9px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-full">Vencida</span>;
  const color = days <= 3 ? 'text-red-400 bg-red-500/10 border-red-500/20'
              : days <= 7 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
              : 'text-green-400 bg-green-500/10 border-green-500/20';
  return <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${color}`}>{days}d</span>;
}

// ─── RenewModal ───────────────────────────────────────────────────────────────
function RenewModal({ client, plans, stats, onClose, onSuccess }) {
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [payMethod, setPayMethod]       = useState('cash');
  const [submitting, setSubmitting]     = useState(false);
  const [result, setResult]             = useState(null);

  const hasAnyActive = !!stats?.membership || (stats?.futureMemberships?.length ?? 0) > 0;
  const coveredUntil = stats?.realEndDate ?? null;
  const accumulated  = stats?.accumulatedDays ?? 0;

  const previewEnd = selectedPlan && coveredUntil
    ? addDays(coveredUntil, 1 + (selectedPlan.duration_days - 1))
    : selectedPlan
    ? addDays(new Date().toISOString().slice(0, 10), selectedPlan.duration_days - 1)
    : null;

  const handlePay = async () => {
    if (!selectedPlan) return;
    setSubmitting(true);
    try {
      const { data } = await api.post('/memberships/pay', {
        user_id: client.id, plan_id: selectedPlan.id, payment_method: payMethod,
      });
      setResult(data);
    } catch (err) {
      alert(err.response?.data?.error ?? 'Error al procesar el pago');
    } finally { setSubmitting(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={!result ? onClose : undefined} />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        className="relative bg-[#1a1a1a] border border-white/10 w-full sm:max-w-sm sm:rounded-2xl rounded-t-3xl p-5 shadow-2xl max-h-[92vh] overflow-y-auto"
      >
        {/* Handle bar móvil */}
        <div className="w-10 h-1 bg-white/10 rounded-full mx-auto mb-4 sm:hidden" />

        {result ? (
          <div className="text-center space-y-4">
            <div className="size-14 mx-auto rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center">
              <CheckCircle size={28} className="text-green-400" />
            </div>
            <div>
              <h4 className="font-black text-base">{result.extended ? '¡Días acumulados!' : '¡Membresía activada!'}</h4>
              <p className="text-slate-400 text-sm mt-0.5">{client.full_name}</p>
            </div>
            <div className={`rounded-xl p-3.5 text-left space-y-2 border ${result.extended ? 'bg-blue-600/10 border-blue-600/20' : 'bg-green-600/10 border-green-600/20'}`}>
              {result.extended && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Plan anterior vencía</span>
                  <span className="font-bold text-slate-200">{fmtDate(result.previousEndDate)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Plan: {result.planName}</span>
                <span className="text-slate-400">+{result.planDays} días</span>
              </div>
              <div className="h-px bg-white/8" />
              <div className="flex justify-between">
                <span className="text-sm font-bold text-slate-200">Vence el</span>
                <span className="font-black text-green-400">{fmtDate(result.newEndDate)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Días restantes</span>
                <span className="font-bold text-green-400">{result.totalDaysLeft}d</span>
              </div>
            </div>
            <button onClick={() => { onSuccess?.(); onClose(); }}
              className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-black text-sm transition-all">
              Listo
            </button>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h4 className="font-black text-base">{hasAnyActive ? 'Acumular días' : 'Activar membresía'}</h4>
                <p className="text-xs text-slate-500 mt-0.5">{client.full_name}</p>
              </div>
              <button onClick={onClose} className="text-slate-500 hover:text-white p-1 flex-shrink-0"><X size={18} /></button>
            </div>

            {hasAnyActive && coveredUntil && (
              <div className="flex items-start gap-2 px-3 py-2.5 bg-blue-600/10 border border-blue-600/20 rounded-xl mb-4">
                <Info size={13} className="text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-blue-300">
                  <p className="font-bold mb-0.5">Cobertura hasta {fmtDate(coveredUntil)}</p>
                  <p className="text-blue-400">El nuevo plan se sumará.{accumulated > 0 && ` (${accumulated}d acumulados)`}</p>
                </div>
              </div>
            )}

            <div className="space-y-2 mb-4">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Plan</p>
              {(plans ?? []).filter(p => p.duration_days > 1).map(plan => {
                const isSelected = selectedPlan?.id === plan.id;
                const newEnd = coveredUntil
                  ? addDays(coveredUntil, 1 + (plan.duration_days - 1))
                  : addDays(new Date().toISOString().slice(0, 10), plan.duration_days - 1);
                return (
                  <button key={plan.id} onClick={() => setSelectedPlan(plan)}
                    className={`w-full p-3 rounded-xl border-2 text-left flex justify-between items-center transition-all ${
                      isSelected ? 'border-green-600 bg-green-600/10' : 'border-white/5 bg-[#0f0f0f] hover:border-white/15'
                    }`}>
                    <div>
                      <p className="font-bold text-sm">{plan.name}</p>
                      <p className="text-xs text-slate-500">{plan.duration_days} días</p>
                      {hasAnyActive && <p className="text-[10px] text-blue-400 mt-0.5">→ vence {fmtDate(newEnd)}</p>}
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <p className="font-black text-green-400">{fmt(plan.price)}</p>
                      {isSelected && hasAnyActive && <p className="text-[9px] text-blue-400 mt-0.5">se acumula</p>}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mb-4">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Método de pago</p>
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_METHODS.map(({ value, label }) => (
                  <button key={value} onClick={() => setPayMethod(value)}
                    className={`py-2.5 rounded-xl border-2 text-xs font-bold transition-all ${
                      payMethod === value ? 'border-green-600 bg-green-600/15 text-green-400' : 'border-white/5 bg-[#0f0f0f] text-slate-500 hover:border-white/15'
                    }`}>{label}</button>
                ))}
              </div>
            </div>

            {selectedPlan && (
              <div className="bg-[#0f0f0f] border border-white/5 rounded-xl p-3 mb-4 text-xs space-y-1.5">
                {hasAnyActive && coveredUntil ? (
                  <>
                    <div className="flex justify-between text-slate-400">
                      <span>Cobertura actual hasta</span>
                      <span className="font-bold text-slate-200">{fmtDate(coveredUntil)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>+ {selectedPlan.duration_days} días</span>
                      <span className="font-bold text-green-400">{fmtDate(previewEnd)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between text-slate-400">
                    <span>Vence el</span>
                    <span className="font-bold text-green-400">{fmtDate(previewEnd)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-white/5 pt-1.5 text-slate-400">
                  <span>Total</span>
                  <span className="font-black text-green-400">{fmt(selectedPlan.price)}</span>
                </div>
              </div>
            )}

            <button onClick={handlePay} disabled={!selectedPlan || submitting}
              className="w-full py-3.5 rounded-xl bg-green-600 hover:bg-green-500 text-white font-black text-sm transition-all disabled:opacity-40 flex items-center justify-center gap-2">
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              {submitting ? 'Procesando...' : hasAnyActive
                ? `Acumular — ${selectedPlan ? fmt(selectedPlan.price) : 'selecciona un plan'}`
                : `Activar — ${selectedPlan ? fmt(selectedPlan.price) : 'selecciona un plan'}`}
            </button>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─── ClientDetailPanel ────────────────────────────────────────────────────────
// En móvil: bottom sheet deslizante desde abajo
// En desktop: panel lateral fijo
function ClientDetailPanel({ client, onClose, onEdit, onRenew, plans, mobile = false }) {
  const [stats, setStats]         = useState(null);
  const [loading, setLoad]        = useState(true);
  const [showRenew, setShowRenew] = useState(false);

  const loadStats = useCallback(() => {
    setLoad(true);
    api.get(`/clients/${client.id}/stats`)
      .then(({ data }) => setStats(data))
      .catch(() => setStats(null))
      .finally(() => setLoad(false));
  }, [client.id]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const daysLeft     = stats?.daysLeft ?? null;
  const hasActive    = !!stats?.membership;
  const hasFuture    = (stats?.futureMemberships?.length ?? 0) > 0;
  const hasAnyActive = hasActive || hasFuture;
  const realEndDate  = stats?.realEndDate;
  const accumulated  = stats?.accumulatedDays ?? 0;

  const daysColor = !daysLeft || daysLeft <= 0 ? 'text-red-400'
    : daysLeft <= 3 ? 'text-red-400'
    : daysLeft <= 7 ? 'text-amber-400'
    : 'text-green-400';

  const content = (
    <>
      {/* Handle bar — solo móvil */}
      {mobile && <div className="w-10 h-1 bg-white/10 rounded-full mx-auto mb-3" />}

      {/* Header */}
      <div className={`${mobile ? 'px-4 pb-3' : 'px-5 pt-5 pb-4'} border-b border-white/5 relative`}>
        <button onClick={onClose} className="absolute top-3 right-4 text-slate-600 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-all">
          <X size={16} />
        </button>
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-xl bg-green-600/20 border border-green-600/20 flex items-center justify-center text-green-400 font-black text-lg flex-shrink-0">
            {client.full_name?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0 pr-6">
            <p className="font-black text-sm truncate">{client.full_name}</p>
            <p className="text-xs text-slate-500 truncate">{client.dni ? `DNI: ${client.dni}` : 'Sin DNI'}</p>
            <div className="mt-1"><StatusBadge status={client.status} pulse={client.status === 'active'} small /></div>
          </div>
        </div>
      </div>

      {/* Contacto */}
      <div className={`${mobile ? 'px-4' : 'px-5'} py-2.5 border-b border-white/5 flex gap-4`}>
        {[{ icon: Phone, value: client.phone, ph: 'Sin teléfono' },
          { icon: Mail,  value: client.email, ph: 'Sin email'    }].map(({ icon: Icon, value, ph }) => (
          <div key={ph} className="flex items-center gap-1.5 text-xs text-slate-400 min-w-0">
            <Icon size={11} className="text-slate-600 flex-shrink-0" />
            <span className={`truncate text-[11px] ${value ? '' : 'text-slate-600 italic'}`}>{value || ph}</span>
          </div>
        ))}
      </div>

      {/* Stats */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={18} className="animate-spin text-green-500 opacity-50" />
        </div>
      ) : (
        <>
          {/* Membresía */}
          <div className={`${mobile ? 'px-4' : 'px-5'} py-3 border-b border-white/5`}>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2">Membresía</p>
            {hasAnyActive ? (
              <div className="space-y-1.5">
                {hasActive && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold truncate">{stats.membership.membership_plans?.name}</span>
                    <span className={`text-sm font-black flex-shrink-0 ${daysColor}`}>
                      {daysLeft <= 0 ? 'Vencida' : `${daysLeft}d`}
                    </span>
                  </div>
                )}
                {!hasActive && hasFuture && (
                  <div className="flex items-center gap-2 text-xs text-amber-400">
                    <CalendarClock size={12} className="flex-shrink-0" />
                    <span className="truncate text-[11px]">Inicia {fmtDate(stats.futureMemberships[0].start_date)}</span>
                  </div>
                )}
                {hasActive && (
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{
                      width: `${Math.max(0, Math.min(100, (daysLeft / (stats.membership.membership_plans?.duration_days ?? 30)) * 100))}%`,
                      background: daysLeft <= 3 ? '#ef4444' : daysLeft <= 7 ? '#f59e0b' : '#16a34a',
                    }} />
                  </div>
                )}
                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <span>Vence: <span className="text-slate-300 font-bold">{fmtDate(realEndDate)}</span></span>
                  {hasFuture && (
                    <span className="text-blue-400 font-bold flex items-center gap-1 flex-shrink-0">
                      <CalendarPlus size={9} /> +{accumulated}d acum.
                    </span>
                  )}
                </div>
                {hasFuture && (
                  <div className="pt-1.5 border-t border-white/5 space-y-1">
                    <p className="text-[9px] text-slate-600 uppercase tracking-widest font-bold">Acumulados</p>
                    {stats.futureMemberships.map((m, i) => (
                      <div key={i} className="flex justify-between text-[10px] gap-2">
                        <span className="text-blue-400 truncate">{m.membership_plans?.name}</span>
                        <span className="text-slate-600 flex-shrink-0">desde {fmtDate(m.start_date)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <ShieldOff size={13} className="text-red-400 flex-shrink-0" />
                Sin membresía activa
              </div>
            )}
          </div>

          {/* Actividad + Pagos en fila en móvil para ahorrar espacio */}
          <div className={`${mobile ? 'px-4 grid grid-cols-2 gap-0 divide-x divide-white/5' : 'px-5'}`}>
            {/* Actividad */}
            <div className={`${mobile ? 'pr-3 py-3' : 'py-3 border-b border-white/5'}`}>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Actividad</p>
                <span className="text-[10px] font-black text-green-400">{stats?.totalVisits ?? 0}v</span>
              </div>
              {(stats?.recentCheckins?.length ?? 0) > 0 ? (
                <div className="space-y-1">
                  {stats.recentCheckins.slice(0, mobile ? 3 : 5).map((c, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[10px] text-slate-500">
                      <div className={`size-1.5 rounded-full flex-shrink-0 ${c.type === 'monthly' ? 'bg-green-500' : 'bg-amber-500'}`} />
                      <span className="truncate">{c.type === 'monthly' ? 'Membresía' : 'Diario'}</span>
                      <span className="ml-auto text-slate-600 flex-shrink-0 text-[9px]">
                        {new Date(c.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-slate-600 italic">Sin visitas</p>
              )}
            </div>

            {/* Pagos */}
            {(stats?.recentPayments?.length ?? 0) > 0 && (
              <div className={`${mobile ? 'pl-3 py-3' : 'py-3 border-b border-white/5'}`}>
                {!mobile && <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Últimos pagos</p>}
                {mobile && <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Pagos</p>}
                <div className="space-y-1.5">
                  {stats.recentPayments.slice(0, mobile ? 3 : 4).map((p, i) => (
                    <div key={i} className="flex items-center justify-between text-[10px] gap-1">
                      <span className="text-slate-400 truncate capitalize">{p.payment_type?.replace('_', ' ')}</span>
                      <span className="font-bold text-green-400 flex-shrink-0">{fmt(p.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Acciones */}
      <div className={`${mobile ? 'px-4 pb-2 pt-3' : 'px-5 py-3'} flex gap-2`}>
        <button onClick={() => setShowRenew(true)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border font-bold text-xs transition-all ${
            hasAnyActive
              ? 'bg-blue-600/10 hover:bg-blue-600/20 border-blue-600/25 text-blue-400'
              : 'bg-green-600/15 hover:bg-green-600/25 border-green-600/30 text-green-400'
          }`}>
          {hasAnyActive ? <CalendarPlus size={13} /> : <CreditCard size={13} />}
          {hasAnyActive ? 'Acumular' : 'Activar'}
        </button>
        <button onClick={onEdit}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-slate-300 font-bold text-xs transition-all">
          <Edit2 size={13} /> Editar
        </button>
      </div>

      <AnimatePresence>
        {showRenew && (
          <RenewModal
            client={client} plans={plans} stats={stats}
            onClose={() => setShowRenew(false)}
            onSuccess={() => { loadStats(); onRenew?.(); }}
          />
        )}
      </AnimatePresence>
    </>
  );

  // En móvil: bottom sheet
  if (mobile) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-end">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <motion.div
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 400, damping: 35 }}
          className="relative w-full bg-[#141414] border-t border-white/8 rounded-t-3xl pt-3 pb-safe overflow-y-auto max-h-[88vh]"
        >
          {content}
        </motion.div>
      </motion.div>
    );
  }

  // En desktop: panel lateral
  return (
    <motion.div
      initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
      exit={{ x: 40, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      className="w-72 xl:w-80 flex-shrink-0 bg-[#141414] border border-white/5 rounded-2xl overflow-hidden flex flex-col h-fit sticky top-4"
    >
      {content}
    </motion.div>
  );
}

// ─── MobileClientRow ──────────────────────────────────────────────────────────
// Tarjeta compacta para móvil — muestra más info sin tabla horizontal
function MobileClientRow({ client, isSelected, onClick }) {
  const membership  = client.activeMembership;
  const realEndDate = client.realEndDate;
  const daysLeft    = client.daysLeft;

  return (
    <div onClick={onClick}
      className={`flex items-center gap-3 px-3 py-3 transition-colors cursor-pointer border-b border-white/5 last:border-0 ${
        isSelected ? 'bg-green-600/5 border-l-2 border-l-green-500' : 'active:bg-white/5'
      }`}>
      {/* Avatar */}
      <div className={`size-9 rounded-xl flex items-center justify-center font-black text-sm flex-shrink-0 ${
        isSelected ? 'bg-green-600 text-white' : 'bg-green-600/15 text-green-400'
      }`}>
        {client.full_name?.[0]?.toUpperCase()}
      </div>

      {/* Info principal */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <p className="font-bold text-sm truncate">{client.full_name}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <StatusBadge status={client.status} small />
          {membership && (
            <>
              <span className="text-slate-700">·</span>
              <span className="text-[10px] text-slate-500">vence {fmtDateShort(realEndDate)}</span>
              <DaysLeftBadge days={daysLeft} />
            </>
          )}
          {!membership && client.status === 'expired' && (
            <>
              <span className="text-slate-700">·</span>
              <span className="text-[10px] text-red-400">Sin membresía</span>
            </>
          )}
        </div>
      </div>

      {/* Chevron */}
      <ChevronRight size={14} className={`flex-shrink-0 transition-transform ${isSelected ? 'text-green-400 rotate-90' : 'text-slate-600'}`} />
    </div>
  );
}

// ─── Main Clients ─────────────────────────────────────────────────────────────
export default function Clients() {
  const [clients, setClients]               = useState([]);
  const [search, setSearch]                 = useState('');
  const [statusFilter, setStatusFilter]     = useState('all');
  const [loading, setLoading]               = useState(true);
  const [page, setPage]                     = useState(1);
  const [totalCount, setTotalCount]         = useState(0);
  const [submitting, setSubmitting]         = useState(false);
  const [showModal, setShowModal]           = useState(false);
  const [editingClient, setEditingClient]   = useState(null);
  const [formData, setFormData]             = useState({ full_name: '', phone: '', email: '', dni: '', status: 'inactive' });
  const [selectedClient, setSelectedClient] = useState(null);
  const [plans, setPlans]                   = useState([]);
  const [statsCount, setStatsCount]         = useState({ active: 0, warning: 0, expired: 0, inactive: 0 });

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
      const [active, warning, expired, inactive] = await Promise.all(
        ['active', 'warning', 'expired', 'inactive'].map(s =>
          api.get(`/clients?status=${s}&limit=1&offset=0`)
            .then(({ data }) => data?.count ?? 0).catch(() => 0)
        )
      );
      setStatsCount({ active, warning, expired, inactive });
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

  const openModal = (client = null) => {
    setEditingClient(client);
    setFormData(client
      ? { full_name: client.full_name, phone: client.phone ?? '', email: client.email ?? '', dni: client.dni ?? '', status: client.status }
      : { full_name: '', phone: '', email: '', dni: '', status: 'inactive' });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setSubmitting(true);
    try {
      if (editingClient) {
        await api.put(`/clients/${editingClient.id}`, formData);
        setClients(prev => prev.map(c => c.id === editingClient.id ? { ...c, ...formData } : c));
        if (selectedClient?.id === editingClient.id) setSelectedClient(prev => ({ ...prev, ...formData }));
      } else {
        await api.post('/clients', formData);
        pageRef.current = 1; setPage(1);
        fetchClients({ forcePage: 1, forceSearch: searchRef.current, forceFilter: filterRef.current });
        fetchCounts();
      }
      setShowModal(false);
    } catch (err) {
      alert(err.response?.data?.error ?? 'Error al guardar cliente');
    } finally { setSubmitting(false); }
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
          <button onClick={() => openModal()}
            className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 text-white font-bold px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl shadow-lg shadow-green-600/20 transition-all active:scale-95 text-sm">
            <UserPlus size={15} /> <span className="hidden xs:inline">Nuevo</span><span className="xs:hidden"> Socio</span>
          </button>
        </div>
      </div>

      {/* Stats bar — 4 tarjetas compactas */}
      <div className="grid grid-cols-4 gap-1.5 sm:gap-3">
        {[
          { key: 'active',   label: 'Activos',  icon: ShieldCheck,   color: 'text-green-400',  bg: 'bg-green-500/10'  },
          { key: 'warning',  label: 'Vencer',   icon: AlertTriangle, color: 'text-amber-400',  bg: 'bg-amber-500/10'  },
          { key: 'expired',  label: 'Vencidos', icon: ShieldOff,     color: 'text-red-400',    bg: 'bg-red-500/10'    },
          { key: 'inactive', label: 'Inact.',   icon: Clock,         color: 'text-slate-400',  bg: 'bg-slate-500/10'  },
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
        {/* Búsqueda */}
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
        {/* Tabs scroll horizontal */}
        <div className="flex gap-1 overflow-x-auto scrollbar-none pb-0.5 sm:pb-0 sm:flex-wrap">
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

      {/* ── LAYOUT PRINCIPAL ─────────────────────────────────────── */}
      <div className="flex gap-4 xl:gap-5 items-start">

        {/* Lista / Tabla */}
        <div id="clients-table" className="flex-1 min-w-0 bg-[#141414] border border-white/5 rounded-xl sm:rounded-2xl overflow-hidden shadow-xl">

          {/* MÓVIL: lista de tarjetas (sin tabla) */}
          <div className="sm:hidden">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-3 border-b border-white/5">
                  <div className="size-9 rounded-xl bg-white/5 animate-pulse flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-white/5 rounded-full animate-pulse w-2/3" />
                    <div className="h-2.5 bg-white/5 rounded-full animate-pulse w-1/2" />
                  </div>
                </div>
              ))
            ) : clients.length === 0 ? (
              <div className="py-12 text-center">
                <Users size={28} className="mx-auto mb-2 text-slate-700" />
                <p className="text-slate-500 text-sm">No se encontraron socios</p>
                {(search || statusFilter !== 'all') && (
                  <button onClick={() => { setSearch(''); handleFilterChange('all'); }}
                    className="mt-2 text-xs text-green-500 underline underline-offset-2">
                    Limpiar filtros
                  </button>
                )}
              </div>
            ) : clients.map(client => (
              <MobileClientRow
                key={client.id}
                client={client}
                isSelected={selectedClient?.id === client.id}
                onClick={() => setSelectedClient(selectedClient?.id === client.id ? null : client)}
              />
            ))}
          </div>

          {/* DESKTOP: tabla completa */}
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
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}><td colSpan={6} className="px-5 py-4">
                      <div className="h-4 bg-white/5 rounded-full animate-pulse" style={{ width: `${60 + (i % 3) * 15}%` }} />
                    </td></tr>
                  ))
                ) : clients.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-14 text-center">
                    <Users size={32} className="mx-auto mb-3 text-slate-700" />
                    <p className="text-slate-500 text-sm">No se encontraron socios</p>
                    {(search || statusFilter !== 'all') && (
                      <button onClick={() => { setSearch(''); handleFilterChange('all'); }}
                        className="mt-3 text-xs text-green-500 underline underline-offset-2">Limpiar filtros</button>
                    )}
                  </td></tr>
                ) : clients.map(client => {
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
                })}
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

        {/* Panel detalle desktop — lateral, solo lg+ */}
        <AnimatePresence>
          {selectedClient && (
            <div className="hidden lg:block">
              <ClientDetailPanel
                key={selectedClient.id}
                client={selectedClient}
                plans={plans}
                onClose={() => setSelectedClient(null)}
                onEdit={() => openModal(selectedClient)}
                onRenew={() => { fetchClients({ forcePage: pageRef.current }); fetchCounts(); }}
              />
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Panel detalle móvil — bottom sheet, solo < lg */}
      <AnimatePresence>
        {selectedClient && (
          <div className="lg:hidden">
            <ClientDetailPanel
              key={`mobile-${selectedClient.id}`}
              client={selectedClient}
              plans={plans}
              mobile
              onClose={() => setSelectedClient(null)}
              onEdit={() => { setSelectedClient(null); openModal(selectedClient); }}
              onRenew={() => { fetchClients({ forcePage: pageRef.current }); fetchCounts(); setSelectedClient(null); }}
            />
          </div>
        )}
      </AnimatePresence>

      {/* Modal crear/editar */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              className="relative bg-[#1a1a1a] border border-white/10 w-full sm:max-w-lg sm:rounded-2xl rounded-t-3xl p-5 sm:p-8 shadow-2xl max-h-[92vh] overflow-y-auto">
              {/* Handle móvil */}
              <div className="w-10 h-1 bg-white/10 rounded-full mx-auto mb-4 sm:hidden" />
              <div className="flex justify-between items-center mb-4 sm:mb-6">
                <div>
                  <h3 className="text-xl font-black">{editingClient ? 'Editar Socio' : 'Nuevo Socio'}</h3>
                  <p className="text-slate-500 text-xs mt-0.5">{editingClient ? 'Modifica la información' : 'Completa los datos'}</p>
                </div>
                <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white p-1"><X size={20} /></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Nombre completo *</label>
                    <input required type="text" value={formData.full_name}
                      onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                      placeholder="Ej: Juan Pérez"
                      className="w-full bg-[#0f0f0f] border border-white/5 rounded-xl p-3 text-sm focus:ring-2 focus:ring-green-600 outline-none transition-all" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">DNI / Cédula</label>
                    <input type="text" value={formData.dni}
                      onChange={e => setFormData({ ...formData, dni: e.target.value })}
                      placeholder="Número de documento"
                      className="w-full bg-[#0f0f0f] border border-white/5 rounded-xl p-3 text-sm focus:ring-2 focus:ring-green-600 outline-none transition-all" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Teléfono</label>
                    <input type="tel" value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="300 123 4567"
                      className="w-full bg-[#0f0f0f] border border-white/5 rounded-xl p-3 text-sm focus:ring-2 focus:ring-green-600 outline-none transition-all" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Email</label>
                    <input type="email" value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      placeholder="correo@ejemplo.com"
                      className="w-full bg-[#0f0f0f] border border-white/5 rounded-xl p-3 text-sm focus:ring-2 focus:ring-green-600 outline-none transition-all" />
                  </div>
                  {editingClient && (
                    <div className="col-span-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Estado</label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {Object.entries(STATUS_CONFIG).map(([value, cfg]) => (
                          <button key={value} type="button" onClick={() => setFormData({ ...formData, status: value })}
                            className={`py-2 rounded-xl border-2 text-[10px] font-bold transition-all ${
                              formData.status === value ? `border-current ${cfg.bg} ${cfg.color}` : 'border-white/5 bg-[#0f0f0f] text-slate-500 hover:border-white/15'
                            }`}>{cfg.label}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <button type="submit" disabled={submitting}
                  className="w-full mt-1 bg-green-600 hover:bg-green-500 text-white font-black py-3.5 rounded-xl shadow-lg shadow-green-600/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2">
                  {submitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  {editingClient ? 'Guardar cambios' : 'Crear socio'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}