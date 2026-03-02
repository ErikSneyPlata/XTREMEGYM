import { useEffect, useState } from 'react';
import api from '../services/api';
import {
  TrendingUp, TrendingDown, Users, AlertTriangle,
  ArrowUpRight, ArrowDownRight, DollarSign, Calendar,
  ShoppingBag, Package, CreditCard, Banknote,
  RefreshCw, Clock, ChevronRight, Activity,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { motion } from 'motion/react';

// ─── helpers ──────────────────────────────────────────────────────────────────
const fmt   = (n) => `$${Number(n ?? 0).toLocaleString('es-CO', { minimumFractionDigits: 0 })}`;
const fmtN  = (n) => Number(n ?? 0).toLocaleString('es-CO');

function daysUntil(dateStr) {
  const diff = new Date(dateStr) - new Date();
  return Math.ceil(diff / 86400000);
}

// ─── palette ─────────────────────────────────────────────────────────────────
const C = {
  green:   '#16a34a',
  greenLt: '#4ade80',
  blue:    '#3b82f6',
  amber:   '#f59e0b',
  red:     '#ef4444',
  violet:  '#8b5cf6',
  teal:    '#14b8a6',
  slate:   '#64748b',
};

const PIE_COLORS = [C.green, C.blue, C.amber, C.violet, C.teal, C.red];

// ─── sub-components ───────────────────────────────────────────────────────────

function KpiCard({ title, value, sub, icon: Icon, color, trend, trendLabel, delay = 0 }) {
  const positive = parseFloat(trend) >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="bg-[#141414] border border-white/5 p-6 rounded-2xl flex flex-col gap-4 hover:border-white/10 transition-colors"
    >
      <div className="flex items-center justify-between">
        <span className="text-slate-400 text-sm font-medium">{title}</span>
        <div className="p-2 rounded-xl" style={{ background: color + '22' }}>
          <Icon size={18} style={{ color }} />
        </div>
      </div>
      <div>
        <p className="text-3xl font-bold tracking-tight">{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
      </div>
      {trend !== null && trend !== undefined && (
        <div className="flex items-center gap-1.5">
          {positive
            ? <ArrowUpRight size={14} style={{ color: C.greenLt }} />
            : <ArrowDownRight size={14} style={{ color: C.red }} />}
          <span className="text-xs font-bold" style={{ color: positive ? C.greenLt : C.red }}>
            {positive ? '+' : ''}{trend}%
          </span>
          {trendLabel && <span className="text-xs text-slate-600">{trendLabel}</span>}
        </div>
      )}
    </motion.div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1e1e1e] border border-white/10 rounded-xl p-3 shadow-2xl text-xs">
      <p className="text-slate-400 mb-2 font-medium">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color }} className="font-bold">
          {entry.name}: {fmt(entry.value)}
        </p>
      ))}
    </div>
  );
};

function SectionTitle({ children }) {
  return (
    <h2 className="text-base font-bold text-slate-300 tracking-wide uppercase text-[11px] letter-spacing-wider mb-4">
      {children}
    </h2>
  );
}

// ─── main ─────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/stats/dashboard');
      setStats(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);

  if (loading && !stats) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-500">
        <Activity size={32} className="text-green-600 animate-pulse" />
        <p className="text-sm">Cargando métricas...</p>
      </div>
    );
  }

  const s = stats ?? {};
  const capacityPct = Math.min(100, ((s.gymStatus?.currentPeople ?? 0) / (s.gymStatus?.maxCapacity ?? 250)) * 100);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">

      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">
            {new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="flex items-center gap-2 text-xs text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl transition-all disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          {lastUpdated ? `Actualizado ${lastUpdated.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}` : 'Actualizar'}
        </button>
      </div>

      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Ingresos Hoy"
          value={fmt(s.dailyIncome)}
          sub={`Ayer: ${fmt(s.yesterdayIncome)}`}
          icon={DollarSign}
          color={C.green}
          trend={s.incomeTrend}
          trendLabel="vs ayer"
          delay={0}
        />
        <KpiCard
          title="Ingresos del Mes"
          value={fmt(s.monthlyIncome)}
          sub="Acumulado"
          icon={TrendingUp}
          color={C.blue}
          delay={0.05}
        />
        <KpiCard
          title="Membresías Activas"
          value={fmtN(s.activeMemberships)}
          sub={`${s.gymStatus?.pendingRenovations ?? 0} vencen esta semana`}
          icon={Users}
          color={C.violet}
          delay={0.1}
        />
        <KpiCard
          title="Check-ins Hoy"
          value={fmtN(s.checkinsToday)}
          sub={`En gimnasio ahora: ~${s.gymStatus?.currentPeople ?? 0}`}
          icon={Calendar}
          color={C.teal}
          trend={s.checkinTrend}
          trendLabel="vs ayer"
          delay={0.15}
        />
      </div>

      {/* ── Income breakdown strips ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Membresías', value: s.incomeByType?.membership ?? 0,   color: C.violet, icon: Users },
          { label: 'Pases Diarios', value: s.incomeByType?.daily_pass ?? 0, color: C.teal,   icon: Clock },
          { label: 'Ventas POS',  value: s.incomeByType?.product_sale ?? 0, color: C.amber,  icon: ShoppingBag },
        ].map(({ label, value, color, icon: Icon }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.05 }}
            className="bg-[#141414] border border-white/5 rounded-2xl px-5 py-4 flex items-center gap-4"
          >
            <div className="p-2.5 rounded-xl flex-shrink-0" style={{ background: color + '20' }}>
              <Icon size={16} style={{ color }} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 truncate">{label}</p>
              <p className="font-bold text-lg">{fmt(value)}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Weekly income stacked bar */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2 bg-[#141414] border border-white/5 p-6 rounded-2xl"
        >
          <SectionTitle>Ingresos últimos 7 días</SectionTitle>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={s.weeklyIncome ?? []} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                <XAxis dataKey="name" stroke={C.slate} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke={C.slate} fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#ffffff08' }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
                <Bar dataKey="memberships" name="Membresías" stackId="a" fill={C.violet} radius={[0, 0, 0, 0]} />
                <Bar dataKey="daily"       name="Pases"      stackId="a" fill={C.teal}   radius={[0, 0, 0, 0]} />
                <Bar dataKey="products"    name="Productos"  stackId="a" fill={C.amber}  radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Memberships by plan pie */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-[#141414] border border-white/5 p-6 rounded-2xl"
        >
          <SectionTitle>Membresías por plan</SectionTitle>
          {(s.membershipsByPlanChart?.length ?? 0) === 0 ? (
            <div className="h-64 flex items-center justify-center text-slate-600 text-sm">Sin datos</div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={s.membershipsByPlanChart}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    outerRadius={75}
                    innerRadius={42}
                    paddingAngle={3}
                  >
                    {s.membershipsByPlanChart?.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e1e1e', border: '1px solid #ffffff15', borderRadius: 12, fontSize: 12 }}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </motion.div>
      </div>

      {/* ── Bottom panels ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Expiring memberships */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-[#141414] border border-white/5 rounded-2xl overflow-hidden"
        >
          <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
            <SectionTitle>Vencen esta semana</SectionTitle>
            <span className="text-[10px] bg-amber-500/15 text-amber-400 border border-amber-500/20 font-bold px-2 py-0.5 rounded-full">
              {s.expiringMemberships?.length ?? 0}
            </span>
          </div>
          <div className="divide-y divide-white/5 max-h-72 overflow-y-auto">
            {(s.expiringMemberships?.length ?? 0) === 0 ? (
              <p className="text-slate-600 text-sm text-center py-10">Ninguna membresía vence esta semana 🎉</p>
            ) : (
              s.expiringMemberships.map((m, i) => {
                const days = daysUntil(m.end_date);
                return (
                  <div key={i} className="px-6 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors">
                    <div className="size-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 flex-shrink-0 font-black text-sm">
                      {days === 0 ? '!' : days}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{m.users?.full_name ?? '—'}</p>
                      <p className="text-[10px] text-slate-500 truncate">{m.membership_plans?.name}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      days <= 1
                        ? 'bg-red-500/15 text-red-400 border-red-500/20'
                        : days <= 3
                        ? 'bg-amber-500/15 text-amber-400 border-amber-500/20'
                        : 'bg-slate-500/15 text-slate-400 border-slate-500/20'
                    }`}>
                      {days === 0 ? 'Hoy' : `${days}d`}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>

        {/* Low stock */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="bg-[#141414] border border-white/5 rounded-2xl overflow-hidden"
        >
          <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
            <SectionTitle>Alertas de stock</SectionTitle>
            <span className="text-[10px] bg-red-500/15 text-red-400 border border-red-500/20 font-bold px-2 py-0.5 rounded-full">
              {s.lowStockProducts?.length ?? 0}
            </span>
          </div>
          <div className="divide-y divide-white/5 max-h-72 overflow-y-auto">
            {(s.lowStockProducts?.length ?? 0) === 0 ? (
              <p className="text-slate-600 text-sm text-center py-10">Stock en orden ✓</p>
            ) : (
              s.lowStockProducts.map((p, i) => (
                <div key={i} className="px-6 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors">
                  <div className="size-9 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
                    <Package size={16} className="text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{p.name}</p>
                    <p className="text-[10px] text-slate-500">{p.category || 'General'}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-red-400 font-black text-sm">{p.stock}</p>
                    <p className="text-[10px] text-slate-600">mín {p.min_stock}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>

        {/* Gym status + payment methods + user status */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-[#141414] border border-white/5 rounded-2xl p-6 space-y-6"
        >
          <SectionTitle>Estado general</SectionTitle>

          {/* Capacity bar */}
          <div>
            <div className="flex justify-between text-xs mb-2">
              <span className="text-slate-400">Capacidad actual</span>
              <span className="font-bold" style={{ color: capacityPct > 80 ? C.red : C.green }}>
                {Math.round(capacityPct)}%
              </span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${capacityPct}%`,
                  background: capacityPct > 80 ? C.red : C.green,
                }}
              />
            </div>
            <p className="text-[10px] text-slate-600 mt-1">
              {s.gymStatus?.currentPeople ?? 0} / {s.gymStatus?.maxCapacity ?? 250} personas (últimas 2h)
            </p>
          </div>

          {/* User status breakdown */}
          <div>
            <p className="text-xs text-slate-400 mb-3">Estado de socios</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'active',   label: 'Activos',   color: C.green  },
                { key: 'warning',  label: 'Advertencia', color: C.amber },
                { key: 'expired',  label: 'Vencidos',  color: C.red    },
                { key: 'inactive', label: 'Inactivos', color: C.slate  },
              ].map(({ key, label, color }) => (
                <div key={key} className="bg-black/30 rounded-xl px-3 py-2.5 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-500 truncate">{label}</p>
                    <p className="text-sm font-black">{fmtN(s.usersByStatus?.[key] ?? 0)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payment methods this month */}
          {(s.paymentMethodsChart?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs text-slate-400 mb-3">Pagos del mes por método</p>
              <div className="space-y-2">
                {s.paymentMethodsChart.map(({ name, value }, i) => {
                  const total = s.paymentMethodsChart.reduce((a, b) => a + b.value, 0);
                  const pct   = total > 0 ? (value / total * 100).toFixed(0) : 0;
                  const icons = { cash: Banknote, card: CreditCard, transfer: TrendingUp };
                  const Icon  = icons[name] ?? DollarSign;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <Icon size={13} className="text-slate-500 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-slate-400 capitalize">{name}</span>
                          <span className="text-slate-300 font-bold">{pct}%</span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, background: PIE_COLORS[i % PIE_COLORS.length] }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* ── Recent POS sales ── */}
      {(s.recentSales?.length ?? 0) > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="bg-[#141414] border border-white/5 rounded-2xl overflow-hidden"
        >
          <div className="px-6 py-5 border-b border-white/5">
            <SectionTitle>Últimas ventas (POS)</SectionTitle>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/5 text-slate-500 text-[10px] uppercase tracking-wider">
                  <th className="px-6 py-3 text-left font-bold">Cliente</th>
                  <th className="px-6 py-3 text-left font-bold">Método</th>
                  <th className="px-6 py-3 text-left font-bold">Hora</th>
                  <th className="px-6 py-3 text-right font-bold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {s.recentSales.map((sale, i) => (
                  <tr key={i} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-3 font-medium">{sale.users?.full_name ?? 'Cliente general'}</td>
                    <td className="px-6 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        sale.payment_method === 'card'
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          : sale.payment_method === 'transfer'
                          ? 'bg-violet-500/10 text-violet-400 border-violet-500/20'
                          : 'bg-green-500/10 text-green-400 border-green-500/20'
                      }`}>
                        {sale.payment_method}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-slate-500 text-xs">
                      {new Date(sale.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-6 py-3 text-right font-black text-green-500">
                      {fmt(sale.total_amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}