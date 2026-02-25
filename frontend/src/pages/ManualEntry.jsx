import { useState, useEffect } from 'react';
import api from '../services/api';
import { Search, User, CheckCircle, AlertCircle, Plus, Zap, CreditCard } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function ManualEntry() {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientStats, setClientStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    if (search.length > 2) {
      const delayDebounce = setTimeout(() => {
        handleSearch();
      }, 300);
      return () => clearTimeout(delayDebounce);
    } else {
      setResults([]);
    }
  }, [search]);

  const handleSearch = async () => {
    try {
      const response = await api.get(`/clients?search=${search}`);
      setResults(response.data);
    } catch (err) {
      console.error(err);
    }
  };

  const selectClient = async (client) => {
    setSelectedClient(client);
    setSearch('');
    setResults([]);
    try {
      const response = await api.get(`/clients/${client.id}/stats`);
      setClientStats(response.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCheckIn = async (type, amount) => {
    setLoading(true);
    try {
      await api.post('/checkins', {
        user_id: selectedClient.id,
        type,
        payment_amount: amount,
        payment_method: 'cash' // Default for daily pass in quick entry
      });
      
      setFeedback({ type: 'success', message: `Ingreso ${type === 'monthly' ? 'Membresía' : 'Diario'} registrado con éxito` });
      setTimeout(() => {
        setFeedback(null);
        setSelectedClient(null);
        setClientStats(null);
      }, 3000);
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.error || 'Error al registrar ingreso' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl mx-auto space-y-8"
    >
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-black tracking-tight">Ingreso Manual</h1>
        <p className="text-slate-500 text-lg">Verifica y registra el acceso de socios rápidamente</p>
      </div>

      {/* Search Section */}
      {!selectedClient && (
        <div className="relative group max-w-2xl mx-auto">
          <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
            <Search className="text-slate-500 group-focus-within:text-green-500 transition-colors" size={24} />
          </div>
          <input 
            type="text"
            autoFocus
            placeholder="Buscar por nombre, teléfono o DNI..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#141414] border-2 border-white/5 rounded-2xl py-6 pl-16 pr-6 text-2xl font-medium focus:border-green-600 focus:ring-0 outline-none transition-all shadow-2xl"
          />
          
          {/* Results Dropdown */}
          <AnimatePresence>
            {results.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full left-0 right-0 mt-4 bg-[#1a1a1a] border border-white/10 rounded-2xl overflow-hidden z-50 shadow-2xl"
              >
                {results.map((client) => (
                  <button 
                    key={client.id}
                    onClick={() => selectClient(client)}
                    className="w-full flex items-center justify-between p-5 hover:bg-green-600/10 transition-colors border-b border-white/5 last:border-0"
                  >
                    <div className="flex items-center gap-4">
                      <div className="size-12 rounded-xl bg-green-600/20 flex items-center justify-center text-green-500 font-bold text-xl">
                        {client.full_name[0].toUpperCase()}
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-lg">{client.full_name}</p>
                        <p className="text-sm text-slate-500">{client.phone || client.dni}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${client.status === 'active' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                      {client.status}
                    </span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Client Detail & Actions */}
      <AnimatePresence>
        {selectedClient && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#141414] border border-white/5 rounded-3xl p-8 shadow-2xl relative overflow-hidden"
          >
            {feedback && (
              <div className={`absolute inset-0 z-50 flex items-center justify-center backdrop-blur-md ${feedback.type === 'success' ? 'bg-green-600/20' : 'bg-red-600/20'}`}>
                <div className="text-center space-y-4">
                  <div className={`size-20 mx-auto rounded-full flex items-center justify-center ${feedback.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
                    {feedback.type === 'success' ? <CheckCircle size={40} className="text-white" /> : <AlertCircle size={40} className="text-white" />}
                  </div>
                  <p className="text-2xl font-bold">{feedback.message}</p>
                </div>
              </div>
            )}

            <button 
              onClick={() => setSelectedClient(null)}
              className="absolute top-6 right-6 text-slate-500 hover:text-white"
            >
              Cancelar
            </button>

            <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
              <div className="size-32 rounded-3xl bg-green-600/20 flex items-center justify-center text-green-500 font-bold text-5xl border-2 border-green-600/30">
                {selectedClient.full_name[0].toUpperCase()}
              </div>
              
              <div className="flex-1 text-center md:text-left space-y-4">
                <div>
                  <h2 className="text-4xl font-black">{selectedClient.full_name}</h2>
                  <p className="text-slate-500 text-lg">ID: {selectedClient.id.split('-')[0].toUpperCase()}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-[#0f0f0f] p-4 rounded-2xl border border-white/5">
                    <p className="text-xs text-slate-500 uppercase font-bold tracking-widest mb-1">Estado Membresía</p>
                    <p className={`text-xl font-bold ${clientStats?.membership ? 'text-green-500' : 'text-red-500'}`}>
                      {clientStats?.membership ? 'ACTIVA' : 'SIN MEMBRESÍA'}
                    </p>
                    {clientStats?.membership && (
                      <p className="text-xs text-slate-400 mt-1">Vence: {new Date(clientStats.membership.end_date).toLocaleDateString()}</p>
                    )}
                  </div>
                  <div className="bg-[#0f0f0f] p-4 rounded-2xl border border-white/5">
                    <p className="text-xs text-slate-500 uppercase font-bold tracking-widest mb-1">Último Ingreso</p>
                    <p className="text-xl font-bold text-slate-300">
                      {selectedClient.last_check_in ? new Date(selectedClient.last_check_in).toLocaleDateString() : 'Nunca'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                  <button 
                    onClick={() => handleCheckIn('monthly')}
                    disabled={!clientStats?.membership || loading}
                    className="flex items-center justify-center gap-3 bg-green-600 hover:bg-green-500 text-white font-black py-5 rounded-2xl shadow-lg shadow-green-600/20 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale"
                  >
                    <CheckCircle size={24} />
                    Confirmar Ingreso
                  </button>
                  <button 
                    onClick={() => handleCheckIn('daily', 15)}
                    disabled={loading}
                    className="flex items-center justify-center gap-3 bg-slate-800 hover:bg-slate-700 text-white font-black py-5 rounded-2xl transition-all active:scale-95 disabled:opacity-50"
                  >
                    <Zap size={24} className="text-amber-500" />
                    Pase Diario ($15)
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Actions */}
      {!selectedClient && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <button className="bg-[#141414] border border-white/5 p-6 rounded-2xl flex flex-col items-center gap-3 hover:bg-green-600/10 transition-all group">
            <div className="size-12 rounded-xl bg-green-600/10 flex items-center justify-center text-green-500 group-hover:bg-green-600 group-hover:text-white transition-all">
              <Plus size={24} />
            </div>
            <span className="font-bold">Nuevo Cliente Rápido</span>
          </button>
          <button className="bg-[#141414] border border-white/5 p-6 rounded-2xl flex flex-col items-center gap-3 hover:bg-blue-600/10 transition-all group">
            <div className="size-12 rounded-xl bg-blue-600/10 flex items-center justify-center text-blue-500 group-hover:bg-blue-600 group-hover:text-white transition-all">
              <CreditCard size={24} />
            </div>
            <span className="font-bold">Cobrar Membresía</span>
          </button>
          <div className="bg-[#141414] border border-white/5 p-6 rounded-2xl flex flex-col items-center justify-center text-center">
            <p className="text-xs text-slate-500 uppercase font-bold tracking-widest mb-1">Capacidad</p>
            <p className="text-3xl font-black text-green-500">142 / 250</p>
          </div>
        </div>
      )}
    </motion.div>
  );
}
