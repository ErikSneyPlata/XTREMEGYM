// frontend/src/pages/Plans.jsx
import { useState, useEffect } from 'react';
import api from '../services/api';
import {
  Plus, Edit2, Trash2, Save, X, Zap, Clock, Calendar,
  DollarSign, Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const fmt = (n) => `$${Number(n ?? 0).toLocaleString('es-CO', { minimumFractionDigits: 0 })}`;

function getPlanIcon(days) {
  if (days === 1)  return <Zap      className="text-amber-500"  size={22} />;
  if (days <= 7)   return <Clock    className="text-blue-500"   size={22} />;
  if (days <= 15)  return <Calendar className="text-indigo-500" size={22} />;
  return                  <Calendar className="text-green-500"  size={22} />;
}

export default function Plans() {
  const [plans, setPlans]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showModal, setShowModal]     = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [formData, setFormData]       = useState({ name: '', price: '', duration_days: '', description: '' });

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
      ) : plans.length === 0 ? (
        <div className="text-center py-20 text-slate-600">
          <Calendar size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-bold">No hay planes configurados</p>
          <p className="text-sm mt-1">Crea el primer plan para comenzar</p>
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

      {/* Modal crear/editar plan */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
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