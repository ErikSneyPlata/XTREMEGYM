import { useEffect, useState } from 'react';
import api from '../services/api';
import { 
  TrendingUp, 
  Users, 
  AlertTriangle, 
  ArrowUpRight,
  DollarSign,
  Calendar
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { motion } from 'motion/react';

const StatCard = ({ title, value, icon: Icon, trend, color }) => (
  <div className="bg-[#141414] border border-white/5 p-6 rounded-2xl">
    <div className="flex items-center justify-between mb-4">
      <span className="text-slate-400 text-sm font-medium">{title}</span>
      <div className={`p-2 rounded-lg ${color} bg-opacity-10`}>
        <Icon className={color.replace('bg-', 'text-')} size={20} />
      </div>
    </div>
    <div className="flex items-baseline gap-2">
      <span className="text-3xl font-bold">{value}</span>
      {trend && (
        <span className="text-xs text-green-500 font-bold flex items-center gap-0.5">
          <ArrowUpRight size={12} />
          {trend}
        </span>
      )}
    </div>
  </div>
);

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get('/stats/dashboard');
        setStats(response.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64 text-green-500">Cargando métricas...</div>;

  const chartData = [
    { name: 'Lun', income: 400 },
    { name: 'Mar', income: 300 },
    { name: 'Mie', income: 600 },
    { name: 'Jue', income: 800 },
    { name: 'Vie', income: 500 },
    { name: 'Sab', income: 900 },
    { name: 'Dom', income: 200 },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8"
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-slate-500">Resumen general de PowerGym</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Ingresos del Día" 
          value={`$${stats?.dailyIncome || 0}`} 
          icon={DollarSign} 
          trend="+12%" 
          color="bg-green-500" 
        />
        <StatCard 
          title="Membresías Activas" 
          value={stats?.activeMemberships || 0} 
          icon={Users} 
          trend="+3%" 
          color="bg-blue-500" 
        />
        <StatCard 
          title="Bajo Stock" 
          value={stats?.lowStockCount || 0} 
          icon={AlertTriangle} 
          color="bg-red-500" 
        />
        <StatCard 
          title="Ingresos Hoy" 
          value={stats?.checkinsToday || 0} 
          icon={Calendar} 
          color="bg-purple-500" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#141414] border border-white/5 p-6 rounded-2xl">
          <h3 className="text-lg font-bold mb-6">Ingresos Últimos 7 Días</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #ffffff10', borderRadius: '12px' }}
                  itemStyle={{ color: '#16a34a' }}
                />
                <Area type="monotone" dataKey="income" stroke="#16a34a" strokeWidth={3} fillOpacity={1} fill="url(#colorIncome)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#141414] border border-white/5 p-6 rounded-2xl">
          <h3 className="text-lg font-bold mb-6">Estado del Gimnasio</h3>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-400">Capacidad Actual</span>
                <span className="text-green-500 font-bold">65%</span>
              </div>
              <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                <div className="bg-green-600 h-full w-[65%]"></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-400">Renovaciones Pendientes</span>
                <span className="text-blue-500 font-bold">12</span>
              </div>
              <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full w-[40%]"></div>
              </div>
            </div>
            <div className="pt-6 border-t border-white/5">
              <button className="w-full py-3 bg-green-600/10 text-green-500 font-bold rounded-xl hover:bg-green-600/20 transition-all">
                Ver Reporte Detallado
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
