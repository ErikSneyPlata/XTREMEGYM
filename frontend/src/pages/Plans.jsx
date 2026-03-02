// frontend/src/pages/Plans.jsx
import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import {
  Plus, Edit2, Trash2, Save, X, Zap, Clock, Calendar,
  DollarSign, Loader2, History, Search, User, ChevronDown,
  CheckCircle, AlertTriangle, Shield, CalendarDays,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const fmt     = (n) => `$${Number(n ?? 0).toLocaleString('es-CO', { minimumFractionDigits: 0 })}`;
const fmtDate = (d) => d ? new Date(`${d}T12:00:00Z`).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const addDays = (dateStr, days) => {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const PAYMENT_METHODS = [
  { value: 'cash',     label: 'Efectivo' },
  { value: 'card',     label: 'Tarjeta'  },
  { value: 'transfer', label: 'Transferencia' },
];

// ─── getPlanIcon ──────────────────────────────────────────────────────────────
function getPlanIcon(days) {
  if (days === 1)  return <Zap className="text-amber-500" size={22} />;
  if (days <= 7)   return <Clock className="text-blue-500" size={22} />;
  if (days <= 15)  return <Calendar className="text-indigo-500" size={22} />;
  return                  <Calendar className="text-green-500" size={22} />;
}

// ─── ClientSearchInput ────────────────────────────────────────────────────────
function ClientSearchInput({ value, onChange, onSelect }) {
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [open, setOpen]         = useState(false);

  const search = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const { data } = await api.get(`/clients?search=${encodeURIComponent(q)}&limit=8&offset=0`);
      setResults(data?.data ?? []);
      setOpen(true);
    } catch { setResults([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 300);
    return () => clearTimeout(t);
  }, [query, search]);

  const handleSelect = (client) => {
    onSelect(client);
    setQuery(client.full_name);
    setOpen(false);
    setResults([]);
  };

  const handleClear = () => {
    onSelect(null);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="Buscar por nombre, DNI o teléfono..."
          value={value ? `${value.full_name}${value.dni ? ` — ${value.dni}` : ''}` : query}
          onChange={e => { if (value) handleClear(); setQuery(e.target.value); }}
          onFocus={() => results.length > 0 && setOpen(true)}
          className="w-full bg-[#0f0f0f] border border-white/5 rounded-xl py-3 pl-9 pr-9 text-sm focus:ring-2 focus:ring-green-600 outline-none transition-all"
        />
        {loading && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 animate-spin" />}
        {value && !loading && (
          <button onClick={handleClear} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
            <X size={14} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && results.length > 0 && !value && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            className="absolute z-50 w-full mt-1 bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden shadow-2xl"
          >
            {results.map(client => (
              <button key={client.id} onClick={() => handleSelect(client)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors text-left">
                <div className="size-8 rounded-lg bg-green-600/15 text-green-400 flex items-center justify-center font-black text-sm flex-shrink-0">
                  {client.full_name?.[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate">{client.full_name}</p>
                  <p className="text-[10px] text-slate-500">{client.dni ?? client.phone ?? 'Sin identificación'}</p>
                </div>
                <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                  client.status === 'active'   ? 'bg-green-500/15 text-green-400' :
                  client.status === 'warning'  ? 'bg-amber-500/15 text-amber-400' :
                  client.status === 'expired'  ? 'bg-red-500/15 text-red-400' :
                                                  'bg-slate-500/15 text-slate-400'
                }`}>
                  {client.status === 'active' ? 'Activo' : client.status === 'warning' ? 'Por vencer' : client.status === 'expired' ? 'Vencido' : 'Inactivo'}
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── ManualAssignSection ──────────────────────────────────────────────────────
function ManualAssignSection({ plans }) {
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedPlan,   setSelectedPlan]   = useState(null);
  const [startDate,      setStartDate]      = useState('');
  const [payMethod,      setPayMethod]      = useState('cash');
  const [customAmount,   setCustomAmount]   = useState('');
  const [useCustomAmt,   setUseCustomAmt]   = useState(false);
  const [submitting,     setSubmitting]     = useState(false);
  const [result,         setResult]         = useState(null);
  const [error,          setError]          = useState('');

  // Preview de fechas en tiempo real
  const today     = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  const endDate   = selectedPlan && startDate ? addDays(startDate, selectedPlan.duration_days - 1) : null;
  const isExpired = endDate && endDate < today;
  const daysLeft  = endDate && !isExpired
    ? Math.ceil((new Date(`${endDate}T12:00:00Z`) - new Date(`${today}T12:00:00Z`)) / 86_400_000)
    : 0;

  const canSubmit = selectedClient && selectedPlan && startDate && payMethod;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        user_id:        selectedClient.id,
        plan_id:        selectedPlan.id,
        payment_method: payMethod,
        start_date:     startDate,
        ...(useCustomAmt && customAmount !== '' && { amount: Number(customAmount) }),
      };
      const { data } = await api.post('/memberships/manual', payload);
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.error ?? 'Error al registrar la membresía.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSelectedClient(null);
    setSelectedPlan(null);
    setStartDate('');
    setPayMethod('cash');
    setCustomAmount('');
    setUseCustomAmt(false);
    setResult(null);
    setError('');
  };

  const monthlyPlans = plans.filter(p => p.duration_days > 1);

  return (
    <div className="bg-[#141414] border border-white/5 rounded-3xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-white/5 flex items-center gap-3">
        <div className="size-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
          <History size={18} className="text-amber-400" />
        </div>
        <div>
          <h2 className="font-black text-base">Asignación histórica de membresía</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Para clientes que ya compraron su plan — registra desde la fecha real de inicio
          </p>
        </div>
      </div>

      <div className="p-6">
        {result ? (
          // ── Resultado exitoso ─────────────────────────────────────────────
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
            <div className="text-center space-y-2">
              <div className={`size-14 mx-auto rounded-full flex items-center justify-center border ${
                result.isStillActive
                  ? 'bg-green-500/15 border-green-500/30'
                  : 'bg-amber-500/15 border-amber-500/30'
              }`}>
                {result.isStillActive
                  ? <CheckCircle size={28} className="text-green-400" />
                  : <AlertTriangle size={28} className="text-amber-400" />}
              </div>
              <h3 className="font-black text-base">
                {result.isStillActive ? '¡Membresía registrada y activa!' : 'Membresía histórica registrada'}
              </h3>
              <p className="text-slate-400 text-sm">{result.isStillActive
                ? 'El cliente ya aparece como activo en el sistema.'
                : 'La membresía ya venció — queda registrada en el historial del cliente.'}</p>
            </div>

            <div className={`rounded-2xl p-4 space-y-2.5 border text-sm ${
              result.isStillActive
                ? 'bg-green-600/8 border-green-600/20'
                : 'bg-amber-500/8 border-amber-500/20'
            }`}>
              <div className="flex justify-between">
                <span className="text-slate-400">Cliente</span>
                <span className="font-bold">{selectedClient?.full_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Plan</span>
                <span className="font-bold">{result.planName} ({result.planDays}d)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Inicio</span>
                <span className="font-bold">{fmtDate(result.startDate)}</span>
              </div>
              <div className="h-px bg-white/5" />
              <div className="flex justify-between">
                <span className="text-slate-400">Vencimiento</span>
                <span className={`font-black ${result.isStillActive ? 'text-green-400' : 'text-amber-400'}`}>
                  {fmtDate(result.endDate)}
                </span>
              </div>
              {result.isStillActive && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Días restantes</span>
                  <span className="font-black text-green-400">{result.daysLeft}d</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">Monto registrado</span>
                <span className="font-bold text-green-400">{fmt(result.amountPaid)}</span>
              </div>
            </div>

            <button onClick={handleReset}
              className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-slate-300 font-bold text-sm transition-all">
              Registrar otra membresía
            </button>
          </motion.div>
        ) : (
          // ── Formulario ────────────────────────────────────────────────────
          <div className="space-y-5">

            {/* 1. Buscar cliente */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">
                1. Seleccionar cliente
              </label>
              <ClientSearchInput
                value={selectedClient}
                onSelect={setSelectedClient}
              />
              {selectedClient && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  className="mt-2 flex items-center gap-2.5 px-3 py-2 bg-green-600/8 border border-green-600/20 rounded-xl">
                  <div className="size-7 rounded-lg bg-green-600/20 text-green-400 flex items-center justify-center font-black text-xs flex-shrink-0">
                    {selectedClient.full_name?.[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{selectedClient.full_name}</p>
                    <p className="text-[10px] text-slate-500">{selectedClient.dni ?? selectedClient.phone ?? '—'}</p>
                  </div>
                  <CheckCircle size={14} className="text-green-400 ml-auto flex-shrink-0" />
                </motion.div>
              )}
            </div>

            {/* 2. Seleccionar plan */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">
                2. Plan comprado
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {monthlyPlans.map(plan => {
                  const isSel = selectedPlan?.id === plan.id;
                  return (
                    <button key={plan.id} onClick={() => setSelectedPlan(isSel ? null : plan)}
                      className={`p-3 rounded-xl border-2 text-left flex items-center gap-3 transition-all ${
                        isSel ? 'border-green-600 bg-green-600/10' : 'border-white/5 bg-[#0f0f0f] hover:border-white/15'
                      }`}>
                      <div className="size-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                        {getPlanIcon(plan.duration_days)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-sm truncate">{plan.name}</p>
                        <p className="text-[10px] text-slate-500">{plan.duration_days} días</p>
                      </div>
                      <p className="font-black text-green-400 flex-shrink-0 text-sm">{fmt(plan.price)}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Fecha de inicio */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">
                3. Fecha real de inicio
              </label>
              <div className="relative">
                <CalendarDays size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="date"
                  value={startDate}
                  max={today}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full bg-[#0f0f0f] border border-white/5 rounded-xl py-3 pl-9 pr-4 text-sm focus:ring-2 focus:ring-green-600 outline-none transition-all"
                />
              </div>

              {/* Preview de fechas */}
              {selectedPlan && startDate && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  className={`mt-2 px-3 py-2.5 rounded-xl border flex items-center justify-between text-xs ${
                    isExpired
                      ? 'bg-amber-500/8 border-amber-500/20'
                      : daysLeft <= 7
                      ? 'bg-amber-500/8 border-amber-500/20'
                      : 'bg-green-600/8 border-green-600/20'
                  }`}>
                  <div className="flex items-center gap-2">
                    <Shield size={12} className={isExpired ? 'text-amber-400' : 'text-green-400'} />
                    <span className="text-slate-400">
                      {fmtDate(startDate)} → <span className="font-bold text-slate-200">{fmtDate(endDate)}</span>
                    </span>
                  </div>
                  <span className={`font-black text-[10px] px-2 py-0.5 rounded-full border ${
                    isExpired
                      ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                      : daysLeft <= 7
                      ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                      : 'text-green-400 bg-green-500/10 border-green-500/20'
                  }`}>
                    {isExpired ? 'Ya venció' : `${daysLeft}d restantes`}
                  </span>
                </motion.div>
              )}
            </div>

            {/* 4. Método de pago + monto */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">
                4. Método de pago
              </label>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {PAYMENT_METHODS.map(({ value, label }) => (
                  <button key={value} onClick={() => setPayMethod(value)}
                    className={`py-2.5 rounded-xl border-2 text-xs font-bold transition-all ${
                      payMethod === value
                        ? 'border-green-600 bg-green-600/15 text-green-400'
                        : 'border-white/5 bg-[#0f0f0f] text-slate-500 hover:border-white/15'
                    }`}>{label}</button>
                ))}
              </div>

              {/* Monto personalizado */}
              <div className="flex items-center gap-2 mb-2">
                <button onClick={() => { setUseCustomAmt(!useCustomAmt); setCustomAmount(''); }}
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
              </div>

              <AnimatePresence>
                {useCustomAmt && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden">
                    <div className="relative">
                      <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={customAmount}
                        onChange={e => setCustomAmount(e.target.value)}
                        placeholder={selectedPlan ? `Precio normal: ${fmt(selectedPlan.price)}` : 'Monto pagado...'}
                        className="w-full bg-[#0f0f0f] border border-amber-500/30 rounded-xl py-2.5 pl-8 pr-4 text-sm focus:ring-2 focus:ring-amber-500 outline-none transition-all"
                      />
                    </div>
                    <p className="text-[10px] text-slate-600 mt-1 ml-1">
                      Útil si el cliente pagó un precio especial o si el plan cambió de precio.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Resumen antes de confirmar */}
            {canSubmit && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="bg-[#0f0f0f] border border-white/5 rounded-xl p-3.5 space-y-2 text-xs">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Resumen</p>
                <div className="flex justify-between text-slate-400">
                  <span>Cliente</span><span className="font-bold text-slate-200">{selectedClient.full_name}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Plan</span><span className="font-bold text-slate-200">{selectedPlan.name}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Inicio → Fin</span>
                  <span className="font-bold text-slate-200">{fmtDate(startDate)} → {fmtDate(endDate)}</span>
                </div>
                <div className="h-px bg-white/5" />
                <div className="flex justify-between text-slate-400">
                  <span>Monto a registrar</span>
                  <span className="font-black text-green-400">
                    {useCustomAmt && customAmount !== '' ? fmt(Number(customAmount)) : fmt(selectedPlan.price)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Estado resultante</span>
                  <span className={`font-bold ${isExpired ? 'text-amber-400' : 'text-green-400'}`}>
                    {isExpired ? 'Vencida (solo historial)' : daysLeft <= 7 ? `Por vencer (${daysLeft}d)` : 'Activa ✓'}
                  </span>
                </div>
              </motion.div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
                <AlertTriangle size={13} className="flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Botón confirmar */}
            <button onClick={handleSubmit} disabled={!canSubmit || submitting}
              className="w-full py-3.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-sm transition-all disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg shadow-amber-600/20">
              {submitting
                ? <><Loader2 size={16} className="animate-spin" /> Registrando...</>
                : <><History size={16} /> Registrar membresía histórica</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Plans ───────────────────────────────────────────────────────────────
export default function Plans() {
  const [plans, setPlans]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [formData, setFormData]     = useState({ name: '', price: '', duration_days: '', description: '' });

  useEffect(() => { fetchPlans(); }, []);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/plans');
      setPlans(data);
    } catch (err) {
      console.error('Error fetching plans:', err);
    } finally { setLoading(false); }
  };

  const handleOpenModal = (plan = null) => {
    if (plan) {
      setEditingPlan(plan);
      setFormData({ name: plan.name, price: plan.price, duration_days: plan.duration_days, description: plan.description || '' });
    } else {
      setEditingPlan(null);
      setFormData({ name: '', price: '', duration_days: '', description: '' });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...formData,
        price:         parseFloat(formData.price),
        duration_days: parseInt(formData.duration_days),
      };
      if (isNaN(payload.price) || isNaN(payload.duration_days))
        throw new Error('Precio y duración deben ser números válidos');
      if (editingPlan) await api.put(`/plans/${editingPlan.id}`, payload);
      else             await api.post('/plans', payload);
      setShowModal(false);
      fetchPlans();
    } catch (err) {
      alert(err.response?.data?.error || err.message || 'Error al guardar plan');
    } finally { setLoading(false); }
  };

  const handleDelete = async (id, isDaily) => {
    if (isDaily) { alert('El Pase Diario no puede ser eliminado, solo modificado.'); return; }
    if (!confirm('¿Estás seguro de eliminar este plan?')) return;
    try {
      await api.delete(`/plans/${id}`);
      fetchPlans();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al eliminar plan');
    }
  };

  const hasDaily = plans.some(p => p.duration_days === 1);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-6xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Planes y Membresías</h1>
          <p className="text-slate-500">Configura los precios y duraciones de tus servicios</p>
        </div>
        <div className="flex gap-3">
          {!hasDaily && (
            <button
              onClick={() => {
                setEditingPlan(null);
                setFormData({ name: 'Pase Diario', price: '15', duration_days: '1', description: 'Acceso por un solo día' });
                setShowModal(true);
              }}
              className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl flex items-center gap-2 shadow-lg shadow-amber-600/20 transition-all active:scale-95 text-sm">
              <Zap size={18} /> Configurar Pase Diario
            </button>
          )}
          <button onClick={() => handleOpenModal()}
            className="bg-green-600 hover:bg-green-500 text-white font-bold px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl flex items-center gap-2 shadow-lg shadow-green-600/20 transition-all active:scale-95 text-sm">
            <Plus size={18} /> Nuevo Plan
          </button>
        </div>
      </div>

      {/* Grid de planes */}
      {loading && plans.length === 0 ? (
        <div className="flex justify-center py-20">
          <Loader2 className="size-12 animate-spin text-green-500 opacity-50" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {plans.map(plan => (
            <motion.div layout key={plan.id}
              className={`bg-[#141414] border rounded-3xl p-6 shadow-xl transition-all group relative overflow-hidden ${
                plan.duration_days === 1 ? 'border-amber-500/30' : 'border-white/5 hover:border-white/10'
              }`}>
              {plan.duration_days === 1 && (
                <div className="absolute top-0 right-0 bg-amber-500 text-black text-[10px] font-black uppercase tracking-widest px-4 py-1 rounded-bl-xl">
                  Pase Diario
                </div>
              )}
              <div className="flex items-start justify-between mb-6">
                <div className="size-14 rounded-2xl flex items-center justify-center bg-white/5 border border-white/5">
                  {getPlanIcon(plan.duration_days)}
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleOpenModal(plan)}
                    className="p-2 bg-white/5 rounded-lg text-slate-400 hover:text-green-500 hover:bg-green-500/10 transition-all">
                    <Edit2 size={18} />
                  </button>
                  <button onClick={() => handleDelete(plan.id, plan.duration_days === 1)}
                    className="p-2 bg-white/5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-all">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <h3 className="text-2xl font-black">{plan.name}</h3>
                  <p className="text-slate-500 text-sm line-clamp-2">{plan.description || 'Sin descripción'}</p>
                </div>
                <div className="flex items-end justify-between pt-4 border-t border-white/5">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Duración</p>
                    <p className="font-bold text-slate-300">{plan.duration_days} días</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Precio</p>
                    <p className="text-3xl font-black text-green-500">{fmt(plan.price)}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Sección asignación histórica ─────────────────────────────────────── */}
      <ManualAssignSection plans={plans} />

      {/* Modal crear/editar plan */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-[#1a1a1a] border border-white/10 w-full max-w-md rounded-3xl p-8 shadow-2xl">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-2xl font-black">{editingPlan ? 'Editar Plan' : 'Nuevo Plan'}</h3>
                  <p className="text-slate-500 text-sm">Configura los detalles del servicio</p>
                </div>
                <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white transition-colors">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Nombre del Plan</label>
                  <input required type="text"
                    disabled={editingPlan?.duration_days === 1}
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-[#0f0f0f] border border-white/5 rounded-xl p-4 focus:ring-2 focus:ring-green-600 outline-none transition-all disabled:opacity-50"
                    placeholder="Ej: Membresía Mensual" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Precio ($)</label>
                    <div className="relative">
                      <DollarSign size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input required type="number" step="0.01"
                        value={formData.price}
                        onChange={e => setFormData({ ...formData, price: e.target.value })}
                        className="w-full bg-[#0f0f0f] border border-white/5 rounded-xl p-4 pl-10 focus:ring-2 focus:ring-green-600 outline-none transition-all"
                        placeholder="0.00" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Duración (Días)</label>
                    <input required type="number"
                      disabled={editingPlan?.duration_days === 1}
                      value={formData.duration_days}
                      onChange={e => setFormData({ ...formData, duration_days: e.target.value })}
                      className="w-full bg-[#0f0f0f] border border-white/5 rounded-xl p-4 focus:ring-2 focus:ring-green-600 outline-none transition-all disabled:opacity-50"
                      placeholder="30" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Descripción (Opcional)</label>
                  <textarea value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-[#0f0f0f] border border-white/5 rounded-xl p-4 focus:ring-2 focus:ring-green-600 outline-none transition-all h-24 resize-none"
                    placeholder="Detalles del plan..." />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full bg-green-600 hover:bg-green-500 text-white font-black py-4 rounded-xl shadow-lg shadow-green-600/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="size-5 animate-spin" /> : <Save size={20} />}
                  {editingPlan ? 'Actualizar Plan' : 'Crear Plan'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}