import { useState, useEffect } from 'react';
import api from '../services/api';
import { Search, UserPlus, Edit2, Phone, Mail, CreditCard } from 'lucide-react';
import { motion } from 'motion/react';

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClients();
  }, [search]);

  const fetchClients = async () => {
    try {
      const response = await api.get(`/clients?search=${search}`);
      setClients(response.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'expired': return 'bg-red-500';
      case 'warning': return 'bg-amber-500';
      default: return 'bg-slate-500';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'active': return 'Activo';
      case 'expired': return 'Vencido';
      case 'warning': return 'Próximo a Vencer';
      default: return 'Inactivo';
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8"
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestión de Clientes</h1>
          <p className="text-slate-500">Administra la base de datos de socios</p>
        </div>
        <button className="bg-green-600 hover:bg-green-500 text-white font-bold px-6 py-3 rounded-xl flex items-center gap-2 shadow-lg shadow-green-600/20 transition-all active:scale-95">
          <UserPlus size={20} />
          Nuevo Cliente
        </button>
      </div>

      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-green-500 transition-colors" size={20} />
        <input 
          type="text"
          placeholder="Buscar por nombre, teléfono o DNI..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[#141414] border border-white/5 rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-green-600 outline-none transition-all"
        />
      </div>

      <div className="bg-[#141414] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/5 text-slate-400 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-bold">Cliente</th>
                <th className="px-6 py-4 font-bold">Contacto</th>
                <th className="px-6 py-4 font-bold">Estado</th>
                <th className="px-6 py-4 font-bold">Último Ingreso</th>
                <th className="px-6 py-4 font-bold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {clients.map((client) => (
                <tr key={client.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-full bg-green-600/20 flex items-center justify-center text-green-500 font-bold">
                        {client.full_name[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold">{client.full_name}</p>
                        <p className="text-xs text-slate-500">DNI: {client.dni || 'N/A'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Phone size={12} />
                        {client.phone || 'Sin teléfono'}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Mail size={12} />
                        {client.email || 'Sin email'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusColor(client.status)} bg-opacity-10 ${getStatusColor(client.status).replace('bg-', 'text-')} border border-current/20`}>
                      <span className={`size-1.5 rounded-full ${getStatusColor(client.status)} mr-2 animate-pulse`}></span>
                      {getStatusLabel(client.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-400">
                    {client.last_check_in ? new Date(client.last_check_in).toLocaleDateString() : 'Nunca'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button className="p-2 text-slate-400 hover:text-green-500 transition-colors">
                        <Edit2 size={18} />
                      </button>
                      <button className="p-2 text-slate-400 hover:text-blue-500 transition-colors">
                        <CreditCard size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {clients.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    No se encontraron clientes
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
