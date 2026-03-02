// frontend/src/pages/ManualEntry.jsx
import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import {
  Search, CheckCircle, AlertCircle, Zap, CreditCard,
  History, X, UserPlus, Clock, Users, Banknote,
  ArrowRightLeft, Activity, Shield, Trash2, CalendarPlus,
  Info, CalendarClock, ChevronDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// ─── helpers ──────────────────────────────────────────────────────────────────
const fmt     = (n) => `$${Number(n ?? 0).toLocaleString('es-CO', { minimumFractionDigits: 0 })}`;
const fmtDate = (d) => d ? new Date(`${d}T12:00:00Z`).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
// ✅ CORREGIDO: addDays usa el mismo patrón que el controlador arreglado
const addDays = (dateStr, days) => {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const PAYMENT_METHODS = [
  { value: 'cash',     label: 'Efectivo',     icon: Banknote       },
  { value: 'card',     label: 'Tarjeta',       icon: CreditCard     },
  { value: 'transfer', label: 'Transferencia', icon: ArrowRightLeft },
];

const paymentTypeLabel = {
  membership:   'Membresía',
  daily_pass:   'Pase diario',
  product_sale: 'Producto',
};

function PaymentMethodSelector({ value, onChange }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {PAYMENT_METHODS.map(({ value: v, label, icon: Icon }) => (
        <button key={v} type="button" onClick={() => onChange(v)}
          className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 transition-all text-xs font-bold ${
            value === v
              ? 'border-green-600 bg-green-600/15 text-green-400'
              : 'border-white/5 bg-[#0f0f0f] text-slate-500 hover:border-white/15'
          }`}>
          <Icon size={16} />{label}
        </button>
      ))}
    </div>
  );
}

function DaysLeftBadge({ days }) {
  if (days === null || days === undefined) return null;
  const color = days <= 3 ? 'text-red-400 bg-red-500/10 border-red-500/20'
              : days <= 7 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
              : 'text-green-400 bg-green-500/10 border-green-500/20';
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${color}`}>
      {days <= 0 ? 'Vencida' : `${days}d restantes`}
    </span>
  );
}

// ─── PaymentModal ─────────────────────────────────────────────────────────────
function PaymentModal({ client, plans, clientStats, onClose, onSuccess, loading, setLoading }) {
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [payMethod, setPayMethod]       = useState('cash');
  const [checkinAfterPay, setCheckinAfterPay] = useState(true);
  const [result, setResult]             = useState(null);

  const hasAnyActive = !!clientStats?.membership || (clientStats?.futureMemberships?.length ?? 0) > 0;
  const coveredUntil = clientStats?.realEndDate ?? null;
  const accumulated  = clientStats?.accumulatedDays ?? 0;

  // ✅ CORREGIDO: preview usa duration_days - 1 igual que el backend arreglado
  const previewEnd = selectedPlan
    ? coveredUntil
      ? addDays(coveredUntil, 1 + (selectedPlan.duration_days - 1))
      : addDays(new Date().toISOString().slice(0, 10), selectedPlan.duration_days - 1)
    : null;

  const handlePay = async () => {
    if (!selectedPlan || !client) return;
    setLoading(true);
    try {
      const { data } = await api.post('/memberships/pay', {
        user_id:        client.id,
        plan_id:        selectedPlan.id,
        payment_method: payMethod,
      });
      if (checkinAfterPay && !data.extended) {
        try { await api.post('/checkins', { user_id: client.id, type: 'monthly' }); } catch (_) {}
      }
      setResult(data);
    } catch (err) {
      alert(err.response?.data?.error ?? 'Error al procesar pago');
    } finally {
      setLoading(false);
    }
  };

  const handleDone = () => { onSuccess?.(); onClose(); };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={!result ? onClose : undefined} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="relative bg-[#1a1a1a] border border-white/10 w-full max-w-md rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl max-h-[92vh] overflow-y-auto">

        {/* ── Resultado exitoso ── */}
        {result ? (
          <div className="text-center space-y-4">
            <div className="size-16 mx-auto rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center">
              <CheckCircle size={32} className="text-green-400" />
            </div>
            <div>
              <h3 className="text-xl font-black">
                {result.extended ? '¡Días acumulados!' : '¡Plan activo!'}
              </h3>
              <p className="text-slate-400 text-sm mt-0.5">{client.full_name}</p>
            </div>
            <div className={`rounded-xl p-4 text-left space-y-2 border ${result.extended ? 'bg-blue-600/10 border-blue-600/20' : 'bg-green-600/10 border-green-600/20'}`}>
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
                <span className="text-sm font-bold">Vence el</span>
                <span className="font-black text-green-400">{fmtDate(result.newEndDate)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Días restantes totales</span>
                <span className="font-bold text-green-400">{result.totalDaysLeft}d</span>
              </div>
            </div>
            {result.extended && (
              <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
                <Info size={13} className="flex-shrink-0" />
                El ingreso de hoy usa la membresía actual. El nuevo plan inicia el {fmtDate(result.membership?.start_date)}.
              </div>
            )}
            <button onClick={handleDone}
              className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-black transition-all">
              Listo
            </button>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xl font-black">{hasAnyActive ? 'Acumular días' : 'Cobrar Plan'}</h3>
              <button onClick={onClose} className="text-slate-500 hover:text-white p-1"><X size={22} /></button>
            </div>
            <p className="text-slate-500 text-sm mb-5">{client.full_name}</p>

            {/* Banner cobertura existente */}
            {hasAnyActive && coveredUntil && (
              <div className="flex items-start gap-2.5 px-3 py-2.5 bg-blue-600/10 border border-blue-600/20 rounded-xl mb-4">
                <Info size={14} className="text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-blue-300">
                  <p className="font-bold mb-0.5">Ya tiene cobertura hasta {fmtDate(coveredUntil)}</p>
                  <p className="text-blue-400 leading-relaxed">
                    El nuevo plan se acumulará a continuación.
                    {accumulated > 0 && ` (${accumulated} días ya acumulados)`}
                  </p>
                </div>
              </div>
            )}

            {/* Planes */}
            <div className="space-y-2 mb-5">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Plan</p>
              {plans.filter(p => p.duration_days > 1).map(plan => {
                const isSelected = selectedPlan?.id === plan.id;
                // ✅ CORREGIDO: preview consistente con el backend
                const newEnd = coveredUntil
                  ? addDays(coveredUntil, 1 + (plan.duration_days - 1))
                  : addDays(new Date().toISOString().slice(0, 10), plan.duration_days - 1);
                return (
                  <button key={plan.id} onClick={() => setSelectedPlan(plan)}
                    className={`w-full p-4 rounded-xl border-2 transition-all text-left flex justify-between items-center ${
                      isSelected ? 'border-blue-600 bg-blue-600/10' : 'border-white/5 bg-[#0f0f0f] hover:border-white/15'
                    }`}>
                    <div>
                      <p className="font-bold text-sm">{plan.name}</p>
                      <p className="text-xs text-slate-500">{plan.duration_days} días</p>
                      {hasAnyActive && (
                        <p className="text-[10px] text-blue-400 mt-0.5">→ vencería {fmtDate(newEnd)}</p>
                      )}
                    </div>
                    <p className="text-xl font-black text-blue-400">{fmt(plan.price)}</p>
                  </button>
                );
              })}
            </div>

            {/* Método de pago */}
            <div className="mb-5">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Método de pago</p>
              <PaymentMethodSelector value={payMethod} onChange={setPayMethod} />
            </div>

            {/* Auto check-in */}
            {!hasAnyActive && (
              <label className="flex items-center gap-3 cursor-pointer p-3 bg-[#0f0f0f] rounded-xl border border-white/5 hover:border-white/10 transition-colors mb-5">
                <div onClick={() => setCheckinAfterPay(v => !v)}
                  className={`w-10 h-5 rounded-full transition-all relative flex-shrink-0 ${checkinAfterPay ? 'bg-green-600' : 'bg-white/10'}`}>
                  <div className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-all ${checkinAfterPay ? 'left-5' : 'left-0.5'}`} />
                </div>
                <div>
                  <p className="text-sm font-bold">Registrar ingreso automáticamente</p>
                  <p className="text-[10px] text-slate-500">El socio entra al gimnasio ahora</p>
                </div>
              </label>
            )}

            {hasAnyActive && (
              <div className="flex items-center gap-2 text-xs text-slate-500 bg-white/5 border border-white/5 rounded-xl px-3 py-2.5 mb-5">
                <Info size={13} className="flex-shrink-0" />
                El ingreso de hoy se hace con la membresía actual. El nuevo plan no inicia hasta {fmtDate(coveredUntil ? addDays(coveredUntil, 1) : null)}.
              </div>
            )}

            {/* Resumen */}
            {selectedPlan && (
              <div className="bg-blue-600/10 border border-blue-600/20 rounded-xl p-4 text-sm mb-5 space-y-1.5">
                {hasAnyActive && coveredUntil && (
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Cobertura actual hasta</span>
                    <span className="font-bold text-slate-200">{fmtDate(coveredUntil)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-400">{selectedPlan.name}</span>
                  <span className="font-bold">{fmt(selectedPlan.price)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Nueva fecha de vencimiento</span>
                  <span className="font-bold text-green-400">{fmtDate(previewEnd)}</span>
                </div>
              </div>
            )}

            <button onClick={handlePay} disabled={!selectedPlan || loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-[0.98] disabled:opacity-40">
              {loading ? 'Procesando...' : hasAnyActive
                ? `Acumular — ${selectedPlan ? fmt(selectedPlan.price) : 'selecciona plan'}`
                : `Confirmar — ${selectedPlan ? fmt(selectedPlan.price) : 'selecciona plan'}`}
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}

// ─── Main ManualEntry ─────────────────────────────────────────────────────────
export default function ManualEntry() {
  const searchRef = useRef(null);

  const [search, setSearch]                     = useState('');
  const [results, setResults]                   = useState([]);
  const [selectedClient, setSelectedClient]     = useState(null);
  const [clientStats, setClientStats]           = useState(null);
  const [statsLoading, setStatsLoading]         = useState(false);
  const [loading, setLoading]                   = useState(false);
  const [feedback, setFeedback]                 = useState(null);
  const [history, setHistory]                   = useState([]);
  const [capacity, setCapacity]                 = useState({ current: 0, max: 250 });
  const [plans, setPlans]                       = useState([]);
  const [showQuickAdd, setShowQuickAdd]         = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [newClient, setNewClient]               = useState({ full_name: '', dni: '', phone: '' });
  const [dailyPayMethod, setDailyPayMethod]     = useState('cash');
  const [showDailyOptions, setShowDailyOptions] = useState(false);
  const [deletingEntry, setDeletingEntry]       = useState(null);
  const [deleteLoading, setDeleteLoading]       = useState(false);
  // ✅ NUEVO: control de visibilidad del historial en móvil
  const [showHistory, setShowHistory]           = useState(false);

  useEffect(() => {
    fetchHistory(); fetchPlans(); fetchCapacity();
    searchRef.current?.focus();
  }, []);

  const fetchCapacity = async () => {
    try {
      const { data } = await api.get('/stats/dashboard');
      setCapacity({ current: data?.gymStatus?.currentPeople ?? 0, max: data?.gymStatus?.maxCapacity ?? 250 });
    } catch (_) {}
  };

  const fetchPlans = async () => {
    try {
      const { data } = await api.get('/plans');
      setPlans(Array.isArray(data) ? data : []);
    } catch (_) {}
  };

  const fetchHistory = async () => {
    try {
      const { data } = await api.get('/checkin-history');
      setHistory(Array.isArray(data) ? data : []);
    } catch (_) {}
  };

  useEffect(() => {
    if (search.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get(`/clients?search=${encodeURIComponent(search)}&limit=8`);
        setResults(data?.data ?? []);
      } catch (_) { setResults([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadClientStats = async (clientId) => {
    setStatsLoading(true);
    try {
      const { data } = await api.get(`/clients/${clientId}/stats`);
      setClientStats(data);
      return data;
    } catch (_) {
      setClientStats(null);
      return null;
    } finally {
      setStatsLoading(false);
    }
  };

  const selectClient = async (client) => {
    setSelectedClient(client);
    setSearch(''); setResults([]);
    await loadClientStats(client.id);
  };

  const clearClient = () => {
    setSelectedClient(null); setClientStats(null);
    setFeedback(null); setShowDailyOptions(false);
    setTimeout(() => searchRef.current?.focus(), 100);
  };

  const handleCheckIn = async (type, amount = 0, method = 'cash') => {
    setLoading(true);
    try {
      await api.post('/checkins', {
        user_id: selectedClient.id, type,
        amount: type === 'daily' ? amount : undefined,
        payment_method: type === 'daily' ? method : undefined,
      });
      showFeedback('success', type === 'monthly' ? '✓ Ingreso registrado' : `✓ Pase diario — ${fmt(amount)}`);
      fetchHistory(); fetchCapacity();
    } catch (err) {
      showFeedback('error', err.response?.data?.error ?? 'Error al registrar ingreso');
    } finally {
      setLoading(false);
    }
  };

  const showFeedback = (type, message) => {
    setFeedback({ type, message });
    if (type === 'success') {
      setTimeout(() => { setFeedback(null); clearClient(); }, 2200);
    } else {
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const handleQuickAdd = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const { data } = await api.post('/clients', newClient);
      setShowQuickAdd(false);
      setNewClient({ full_name: '', dni: '', phone: '' });
      selectClient(data);
    } catch (err) {
      alert(err.response?.data?.error ?? 'Error al crear cliente');
    } finally { setLoading(false); }
  };

  const handleDeleteEntry = async (id) => {
    setDeleteLoading(true);
    try {
      const { data } = await api.delete(`/checkins/${id}`);
      setHistory(prev => prev.filter(e => e.id !== id));
      setDeletingEntry(null);
      if (data?.payment_reversed) {
        showFeedback('success', `✓ Ingreso eliminado · Pago de ${fmt(data.reversed_amount)} revertido`);
      }
    } catch (err) {
      alert(err.response?.data?.error ?? 'Error al eliminar el registro');
    } finally { setDeleteLoading(false); }
  };

  const dailyPlan   = plans.find(p => p.duration_days === 1);
  const dailyPrice  = dailyPlan?.price ?? 15;
  const capacityPct = Math.min(100, (capacity.current / capacity.max) * 100);

  const hasActiveMembership = !!clientStats?.membership;
  const hasFutureMembership = (clientStats?.futureMemberships?.length ?? 0) > 0;
  const hasAnyMembership    = hasActiveMembership || hasFutureMembership;
  const daysLeft            = clientStats?.daysLeft ?? null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-6xl mx-auto space-y-5 sm:space-y-8 px-2 sm:px-0">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Ingreso Manual</h1>
          <p className="text-slate-500 text-sm mt-0.5 sm:mt-1">Verifica y registra accesos rápidamente</p>
        </div>
        {/* Barra de capacidad — oculta en móvil si hay cliente seleccionado */}
        <div className={`bg-[#141414] border border-white/5 px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl flex items-center gap-3 sm:gap-4 w-full sm:w-auto sm:min-w-[200px] ${selectedClient ? 'hidden sm:flex' : 'flex'}`}>
          <div className="flex-1">
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1.5">Capacidad</p>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-1">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${capacityPct}%`, background: capacityPct > 80 ? '#ef4444' : '#16a34a' }} />
            </div>
            <p className="text-xs font-black">
              <span style={{ color: capacityPct > 80 ? '#ef4444' : '#4ade80' }}>{capacity.current}</span>
              <span className="text-slate-600"> / {capacity.max}</span>
            </p>
          </div>
          <Users size={20} className="text-green-500 flex-shrink-0" />
        </div>
      </div>

      {/* Layout principal: panel + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-8">

        {/* Panel principal */}
        <div className="lg:col-span-2 space-y-5 sm:space-y-6">

          {/* Búsqueda */}
          {!selectedClient && (
            <div className="relative group">
              <Search className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-green-500 transition-colors" size={20} />
              <input ref={searchRef} type="text"
                placeholder="Buscar por nombre, teléfono o DNI..."
                value={search} onChange={e => setSearch(e.target.value)}
                className="w-full bg-[#141414] border-2 border-white/5 rounded-xl sm:rounded-2xl py-4 sm:py-5 pl-12 sm:pl-14 pr-4 sm:pr-5 text-base sm:text-lg font-medium focus:border-green-600 outline-none transition-all shadow-xl" />
              <AnimatePresence>
                {results.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    className="absolute top-full left-0 right-0 mt-2 sm:mt-3 bg-[#1a1a1a] border border-white/10 rounded-xl sm:rounded-2xl overflow-hidden z-50 shadow-2xl">
                    {results.map(client => (
                      <button key={client.id} onClick={() => selectClient(client)}
                        className="w-full flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 hover:bg-green-600/10 transition-colors border-b border-white/5 last:border-0">
                        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                          <div className="size-10 sm:size-11 rounded-xl bg-green-600/20 flex items-center justify-center text-green-500 font-bold text-lg flex-shrink-0">
                            {client.full_name?.[0]?.toUpperCase() ?? '?'}
                          </div>
                          <div className="text-left min-w-0">
                            <p className="font-bold truncate">{client.full_name}</p>
                            <p className="text-xs text-slate-500 truncate">{client.phone ?? client.dni ?? '—'}</p>
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full border flex-shrink-0 ml-2 ${
                          client.status === 'active'   ? 'bg-green-500/15 text-green-400 border-green-500/20'
                          : client.status === 'warning' ? 'bg-amber-500/15 text-amber-400 border-amber-500/20'
                          : 'bg-red-500/15 text-red-400 border-red-500/20'
                        }`}>{client.status}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Tarjeta de cliente seleccionado */}
          <AnimatePresence mode="wait">
            {selectedClient && (
              <motion.div key="detail" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
                className="bg-[#141414] border border-white/5 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl relative">

                {/* Feedback overlay */}
                <AnimatePresence>
                  {feedback && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className={`absolute inset-0 z-50 flex items-center justify-center backdrop-blur-md rounded-2xl sm:rounded-3xl ${
                        feedback.type === 'success' ? 'bg-green-600/25' : 'bg-red-600/25'
                      }`}>
                      <div className="text-center space-y-4 px-8">
                        <div className={`size-20 mx-auto rounded-full flex items-center justify-center ${
                          feedback.type === 'success' ? 'bg-green-500' : 'bg-red-500'
                        }`}>
                          {feedback.type === 'success'
                            ? <CheckCircle size={40} className="text-white" />
                            : <AlertCircle size={40} className="text-white" />}
                        </div>
                        <p className="text-xl sm:text-2xl font-bold">{feedback.message}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Header cliente */}
                <div className="flex items-center justify-between px-5 sm:px-8 pt-5 sm:pt-8 pb-4 sm:pb-6 border-b border-white/5">
                  <div className="flex items-center gap-3 sm:gap-5 min-w-0">
                    <div className="size-12 sm:size-16 rounded-xl sm:rounded-2xl bg-green-600/20 border-2 border-green-600/30 flex items-center justify-center text-green-500 font-black text-2xl sm:text-3xl flex-shrink-0">
                      {selectedClient.full_name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-lg sm:text-2xl font-black truncate">{selectedClient.full_name}</h2>
                      <p className="text-slate-500 text-xs sm:text-sm truncate">
                        {[selectedClient.dni && `DNI: ${selectedClient.dni}`, selectedClient.phone].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
                      </p>
                    </div>
                  </div>
                  <button onClick={clearClient} className="text-slate-500 hover:text-white p-2 hover:bg-white/5 rounded-xl transition-all flex-shrink-0">
                    <X size={18} />
                  </button>
                </div>

                {/* Stats bar — 3 columnas responsive */}
                <div className="grid grid-cols-3 divide-x divide-white/5 border-b border-white/5">
                  {[
                    {
                      label: 'Membresía',
                      value: statsLoading ? '...'
                        : hasActiveMembership ? 'Activa'
                        : hasFutureMembership ? 'Próxima'
                        : 'Sin plan',
                      color: hasActiveMembership ? 'text-green-400'
                        : hasFutureMembership ? 'text-blue-400'
                        : 'text-red-400',
                      sub: hasActiveMembership
                        ? <DaysLeftBadge days={daysLeft} />
                        : hasFutureMembership
                        ? <span className="text-[9px] sm:text-[10px] text-blue-400 text-center block leading-tight">inicia {fmtDate(clientStats.futureMemberships[0].start_date)}</span>
                        : null,
                    },
                    {
                      label: 'Visitas',
                      value: statsLoading ? '...' : (clientStats?.totalVisits ?? 0),
                      color: 'text-slate-200',
                      sub: <span className="text-[10px] text-slate-600">historial</span>,
                    },
                    {
                      label: 'Último ingreso',
                      value: selectedClient.last_check_in
                        ? new Date(selectedClient.last_check_in).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
                        : 'Nunca',
                      color: 'text-slate-200',
                      sub: selectedClient.last_check_in
                        ? <span className="text-[10px] text-slate-600">{new Date(selectedClient.last_check_in).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>
                        : null,
                    },
                  ].map(({ label, value, color, sub }) => (
                    <div key={label} className="px-2 sm:px-6 py-3 sm:py-4 text-center">
                      <p className="text-[9px] sm:text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-0.5 sm:mb-1">{label}</p>
                      <p className={`text-base sm:text-xl font-black ${color}`}>{value}</p>
                      {sub && <div className="mt-0.5 sm:mt-1 flex justify-center">{sub}</div>}
                    </div>
                  ))}
                </div>

                {/* Banner membresía vigente */}
                {hasActiveMembership && (
                  <div className="px-5 sm:px-8 py-3 bg-green-600/5 border-b border-white/5 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <Shield size={14} className="text-green-500 flex-shrink-0" />
                      <span className="text-xs sm:text-sm font-bold truncate">{clientStats.membership.membership_plans?.name}</span>
                      <span className="text-[10px] sm:text-xs text-slate-500 flex-shrink-0">
                        vence {fmtDate(clientStats.realEndDate)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <DaysLeftBadge days={daysLeft} />
                      {hasFutureMembership && (
                        <span className="text-[10px] font-bold text-blue-400 flex items-center gap-1">
                          <CalendarPlus size={11} />+{clientStats.accumulatedDays}d
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Banner plan próximo */}
                {!hasActiveMembership && hasFutureMembership && (
                  <div className="px-5 sm:px-8 py-3 bg-blue-600/5 border-b border-white/5 flex items-center gap-3">
                    <CalendarClock size={14} className="text-blue-400 flex-shrink-0" />
                    <span className="text-xs sm:text-sm text-blue-300">
                      Plan <strong>{clientStats.futureMemberships[0].membership_plans?.name}</strong> inicia el{' '}
                      {fmtDate(clientStats.futureMemberships[0].start_date)}
                    </span>
                  </div>
                )}

                {/* Botones de acción */}
                <div className="p-5 sm:p-8 space-y-3 sm:space-y-4">

                  {/* Confirmar ingreso */}
                  <button
                    onClick={() => handleCheckIn('monthly')}
                    disabled={!hasActiveMembership || loading || daysLeft <= 0}
                    className="w-full flex items-center justify-center gap-2 sm:gap-3 bg-green-600 hover:bg-green-500 text-white font-black py-4 sm:py-5 rounded-xl sm:rounded-2xl shadow-lg shadow-green-600/20 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed text-base sm:text-lg">
                    <CheckCircle size={20} />
                    {!hasActiveMembership && !hasFutureMembership ? 'Sin membresía activa'
                      : !hasActiveMembership && hasFutureMembership ? `Inicia ${fmtDate(clientStats.futureMemberships[0].start_date)}`
                      : daysLeft <= 0 ? 'Membresía vencida'
                      : 'Confirmar Ingreso'}
                  </button>

                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    {/* Cobrar / Acumular */}
                    <button
                      onClick={() => setShowPaymentModal(true)}
                      disabled={loading}
                      className="flex items-center justify-center gap-1.5 sm:gap-2 bg-blue-600/15 hover:bg-blue-600/25 border border-blue-600/30 text-blue-400 font-bold py-3 sm:py-4 rounded-xl sm:rounded-2xl transition-all active:scale-[0.98] disabled:opacity-40 text-sm">
                      {hasAnyMembership ? <CalendarPlus size={16} /> : <CreditCard size={16} />}
                      {hasAnyMembership ? 'Acumular días' : 'Cobrar Plan'}
                    </button>

                    {/* Pase diario */}
                    <button
                      onClick={() => setShowDailyOptions(v => !v)}
                      disabled={loading || hasAnyMembership}
                      title={hasAnyMembership ? 'Ya tiene membresía' : ''}
                      className={`flex items-center justify-center gap-1.5 sm:gap-2 border font-bold py-3 sm:py-4 rounded-xl sm:rounded-2xl transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed text-sm ${
                        hasAnyMembership
                          ? 'bg-slate-800/50 border-white/5 text-slate-600'
                          : 'bg-amber-600/15 hover:bg-amber-600/25 border-amber-600/30 text-amber-400'
                      }`}>
                      <Zap size={16} />
                      {hasAnyMembership ? 'Con membresía' : `Pase ${fmt(dailyPrice)}`}
                    </button>
                  </div>

                  {/* Aviso estado membresía */}
                  {hasActiveMembership && !statsLoading && (
                    <div className="flex items-start gap-2 sm:gap-2.5 px-3 sm:px-4 py-2.5 sm:py-3 bg-green-600/8 border border-green-600/20 rounded-xl">
                      <Shield size={13} className="text-green-500 flex-shrink-0 mt-0.5" />
                      <p className="text-[11px] sm:text-xs text-green-400">
                        Membresía vigente hasta {fmtDate(clientStats.realEndDate)}.
                        {hasFutureMembership && ` +${clientStats.accumulatedDays} días acumulados.`}
                      </p>
                    </div>
                  )}

                  {!hasActiveMembership && hasFutureMembership && !statsLoading && (
                    <div className="flex items-start gap-2 sm:gap-2.5 px-3 sm:px-4 py-2.5 sm:py-3 bg-blue-600/8 border border-blue-600/20 rounded-xl">
                      <CalendarClock size={13} className="text-blue-400 flex-shrink-0 mt-0.5" />
                      <p className="text-[11px] sm:text-xs text-blue-400">
                        Tiene un plan pagado que inicia el {fmtDate(clientStats.futureMemberships[0].start_date)}. No se puede cobrar pase diario.
                      </p>
                    </div>
                  )}

                  {/* Opciones pase diario */}
                  <AnimatePresence>
                    {showDailyOptions && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="bg-[#0f0f0f] rounded-xl sm:rounded-2xl p-3 sm:p-4 space-y-3 border border-white/5">
                          <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Método de pago — pase diario</p>
                          <PaymentMethodSelector value={dailyPayMethod} onChange={setDailyPayMethod} />
                          <button onClick={() => { handleCheckIn('daily', dailyPrice, dailyPayMethod); setShowDailyOptions(false); }}
                            disabled={loading}
                            className="w-full bg-amber-600 hover:bg-amber-500 text-white font-black py-3 rounded-xl transition-all active:scale-[0.98] disabled:opacity-40">
                            Confirmar Pase Diario — {fmt(dailyPrice)}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Últimos pagos */}
                {(clientStats?.recentPayments?.length ?? 0) > 0 && (
                  <div className="border-t border-white/5 px-5 sm:px-8 py-4 sm:py-5">
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-3">Últimos pagos</p>
                    <div className="space-y-2">
                      {clientStats.recentPayments.map((p, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 text-slate-400 min-w-0">
                            <span className="truncate">{paymentTypeLabel[p.payment_type] ?? p.payment_type}</span>
                            <span className="text-slate-600 flex-shrink-0">·</span>
                            <span className="capitalize flex-shrink-0">{p.payment_method}</span>
                          </div>
                          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 ml-2">
                            <span className="text-slate-500 hidden sm:inline">{new Date(p.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}</span>
                            <span className="font-bold text-green-400">{fmt(p.amount)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Quick actions sin cliente */}
          {!selectedClient && (
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <button onClick={() => setShowQuickAdd(true)}
                className="bg-[#141414] border border-white/5 p-4 sm:p-6 rounded-xl sm:rounded-2xl flex items-center gap-3 sm:gap-4 hover:bg-green-600/10 hover:border-green-600/20 transition-all group">
                <div className="size-10 sm:size-12 rounded-xl bg-green-600/10 flex items-center justify-center text-green-500 group-hover:bg-green-600 group-hover:text-white transition-all flex-shrink-0">
                  <UserPlus size={20} />
                </div>
                <div className="text-left">
                  <p className="font-black text-sm sm:text-base">Nuevo Socio</p>
                  <p className="text-slate-500 text-xs">Registro rápido</p>
                </div>
              </button>
              <div className="bg-[#141414] border border-white/5 p-4 sm:p-6 rounded-xl sm:rounded-2xl flex items-center gap-3 sm:gap-4">
                <div className="size-10 sm:size-12 rounded-xl bg-slate-800 flex items-center justify-center text-slate-500 flex-shrink-0">
                  <Activity size={20} />
                </div>
                <div>
                  <p className="font-black text-slate-300 text-sm sm:text-base">Hoy</p>
                  <p className="text-green-400 font-black text-lg sm:text-xl">{history.length} <span className="text-sm font-bold">ingresos</span></p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Sidebar historial ── */}
        <div className="bg-[#141414] border border-white/5 rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl h-fit">
          {/* Header con toggle en móvil */}
          <button
            onClick={() => setShowHistory(v => !v)}
            className="w-full px-5 sm:px-6 py-4 sm:py-5 border-b border-white/5 flex items-center justify-between lg:cursor-default"
          >
            <div className="flex items-center gap-3">
              <History className="text-green-500" size={17} />
              <h3 className="font-black text-sm sm:text-base">Últimos Ingresos</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-green-600/15 text-green-400 font-bold px-2 py-0.5 rounded-full border border-green-600/20">{history.length}</span>
              <ChevronDown size={15} className={`text-slate-500 transition-transform lg:hidden ${showHistory ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {/* Lista — siempre visible en lg, colapsable en móvil */}
          <div className={`divide-y divide-white/5 overflow-y-auto transition-all ${showHistory || typeof window !== 'undefined' && window.innerWidth >= 1024 ? 'max-h-[520px]' : 'max-h-0 lg:max-h-[520px]'} lg:max-h-[520px]`}
            style={{ maxHeight: showHistory ? '520px' : window && window.innerWidth >= 1024 ? '520px' : '0' }}>
            {history.length === 0 ? (
              <div className="text-center py-10 sm:py-12 text-slate-600">
                <Clock size={32} className="mx-auto mb-2 opacity-20" />
                <p className="text-sm">Sin registros aún</p>
              </div>
            ) : history.slice(0, 10).map(entry => {
              const isConfirming = deletingEntry === entry.id;
              return (
                <div key={entry.id} className="relative">
                  <div className={`flex items-center gap-3 px-4 sm:px-5 py-3 sm:py-3.5 transition-colors group ${isConfirming ? 'bg-red-500/5' : 'hover:bg-white/5'}`}>
                    <div className={`size-8 sm:size-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      entry.type === 'monthly' ? 'bg-green-600/10 text-green-500' : 'bg-amber-600/10 text-amber-500'
                    }`}>
                      {entry.type === 'monthly' ? <CheckCircle size={15} /> : <Zap size={15} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{entry.users?.full_name ?? 'Desconocido'}</p>
                      <p className="text-[10px] text-slate-500 font-medium">{entry.type === 'monthly' ? 'Membresía' : 'Pase diario'}</p>
                    </div>
                    <span className="text-[10px] text-slate-600 flex-shrink-0">
                      {new Date(entry.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {!isConfirming && (
                      <button onClick={() => setDeletingEntry(entry.id)}
                        className="ml-1 p-1.5 rounded-lg text-slate-700 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                  <AnimatePresence>
                    {isConfirming && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden border-t border-red-500/20">
                        <div className="px-4 sm:px-5 py-3 bg-red-500/8 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs text-red-400 font-medium">¿Eliminar este ingreso?</p>
                            {entry.type === 'daily' && <p className="text-[10px] text-slate-500 mt-0.5">El pago del pase diario también se revertirá</p>}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button onClick={() => setDeletingEntry(null)} disabled={deleteLoading}
                              className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded-lg hover:bg-white/5 transition-all">Cancelar</button>
                            <button onClick={() => handleDeleteEntry(entry.id)} disabled={deleteLoading}
                              className="text-xs text-white bg-red-600 hover:bg-red-500 px-2.5 py-1 rounded-lg font-bold transition-all disabled:opacity-50">
                              {deleteLoading ? '...' : 'Eliminar'}
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal nuevo socio */}
      <AnimatePresence>
        {showQuickAdd && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowQuickAdd(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="relative bg-[#1a1a1a] border border-white/10 w-full max-w-md rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black">Nuevo Socio</h3>
                <button onClick={() => setShowQuickAdd(false)} className="text-slate-500 hover:text-white p-1"><X size={22} /></button>
              </div>
              <form onSubmit={handleQuickAdd} className="space-y-4">
                {[
                  { name: 'full_name', label: 'Nombre completo *', placeholder: 'Ej: Juan Pérez',      required: true,  type: 'text' },
                  { name: 'dni',       label: 'DNI / Cédula *',    placeholder: 'Número de documento', required: true,  type: 'text' },
                  { name: 'phone',     label: 'Teléfono',          placeholder: 'Ej: 300 123 4567',    required: false, type: 'tel'  },
                ].map(({ name, label, placeholder, required, type }) => (
                  <div key={name}>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">{label}</label>
                    <input type={type} required={required} value={newClient[name]}
                      onChange={e => setNewClient({ ...newClient, [name]: e.target.value })}
                      placeholder={placeholder}
                      className="w-full bg-[#0f0f0f] border border-white/5 rounded-xl p-3.5 focus:ring-2 focus:ring-green-600 outline-none transition-all text-sm" />
                  </div>
                ))}
                <button type="submit" disabled={loading}
                  className="w-full bg-green-600 hover:bg-green-500 text-white font-black py-4 rounded-xl shadow-lg shadow-green-600/20 transition-all active:scale-[0.98] disabled:opacity-50 mt-2">
                  {loading ? 'Guardando...' : 'Registrar y Continuar →'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal cobrar plan */}
      <AnimatePresence>
        {showPaymentModal && selectedClient && (
          <PaymentModal
            client={selectedClient}
            plans={plans}
            clientStats={clientStats}
            onClose={() => setShowPaymentModal(false)}
            onSuccess={async () => {
              const newStats = await loadClientStats(selectedClient.id);
              fetchHistory(); fetchCapacity();
              showFeedback('success', newStats?.membership
                ? `✓ Plan registrado — vence ${fmtDate(newStats.realEndDate)}`
                : '✓ Plan registrado');
            }}
            loading={loading}
            setLoading={setLoading}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}