// backend/controllers/statsController.js
import { supabase } from '../db.js';

// 🔴 Fix: timezone Colombia (UTC-5) consistente con checkinController y reportsController.
// Antes: usaba new Date().setHours(0,0,0,0) que depende del timezone del servidor.
// En servidores cloud (UTC) el "día" cortaba a medianoche UTC, no a medianoche Colombia
// → check-ins de 7pm-11pm Colombia aparecían en "otro día" en el dashboard.
const COL_OFFSET_MS = 5 * 3_600_000; // UTC-5

const todayColombiaStr = () =>
  new Date(Date.now() - COL_OFFSET_MS).toISOString().slice(0, 10);

// 'YYYY-MM-DD' → ISO UTC que equivale a 00:00 hora Colombia
const dayStartUTC = (dateStr) => `${dateStr}T05:00:00.000Z`;

// 'YYYY-MM-DD' → ISO UTC que equivale a 23:59:59.999 hora Colombia
const dayEndUTC = (dateStr) => {
  const d = new Date(`${dateStr}T05:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCMilliseconds(d.getUTCMilliseconds() - 1);
  return d.toISOString();
};

const prevDayStr = (dateStr) => {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

// 🔴 Fix: registerCheckIn eliminada — era código muerto (no enrutada)
// y le faltaban las validaciones críticas de checkinController.

export const getDashboardStats = async (req, res) => {
  const todayStr     = todayColombiaStr();
  const yesterdayStr = prevDayStr(todayStr);

  const todayISO    = dayStartUTC(todayStr);
  const todayEndISO = dayEndUTC(todayStr);
  const yestISO     = dayStartUTC(yesterdayStr);
  const yestEndISO  = dayEndUTC(yesterdayStr);

  const firstDayMonth    = `${todayStr.slice(0, 7)}-01`;
  const firstDayMonthISO = dayStartUTC(firstDayMonth);

  try {
    // ── 1. Ingresos del día y de ayer ────────────────────────────────────────
    const [{ data: todayPayments }, { data: yesterdayPayments }] = await Promise.all([
      supabase.from('payments').select('amount, payment_type')
        .gte('created_at', todayISO).lte('created_at', todayEndISO),
      supabase.from('payments').select('amount, payment_type')
        .gte('created_at', yestISO).lte('created_at', yestEndISO),
    ]);

    const dailyIncome     = todayPayments?.reduce((s, p) => s + Number(p.amount), 0) ?? 0;
    const yesterdayIncome = yesterdayPayments?.reduce((s, p) => s + Number(p.amount), 0) ?? 0;
    const incomeTrend     = yesterdayIncome > 0
      ? ((dailyIncome - yesterdayIncome) / yesterdayIncome * 100).toFixed(1)
      : null;

    // ── 2. Ingresos del mes ──────────────────────────────────────────────────
    const { data: monthPayments } = await supabase
      .from('payments').select('amount').gte('created_at', firstDayMonthISO);
    const monthlyIncome = monthPayments?.reduce((s, p) => s + Number(p.amount), 0) ?? 0;

    // ── 3. Desglose de ingresos por tipo (hoy) ───────────────────────────────
    const incomeByType = { membership: 0, daily_pass: 0, product_sale: 0 };
    todayPayments?.forEach((p) => {
      if (incomeByType[p.payment_type] !== undefined)
        incomeByType[p.payment_type] += Number(p.amount);
    });

    // ── 4. Membresías activas y por plan ─────────────────────────────────────
    const { count: activeMemberships } = await supabase
      .from('user_memberships')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    const { data: membershipsByPlan } = await supabase
      .from('user_memberships')
      .select('membership_plans(name), status')
      .eq('status', 'active');

    const planCounts = {};
    membershipsByPlan?.forEach((m) => {
      const name = m.membership_plans?.name ?? 'Sin plan';
      planCounts[name] = (planCounts[name] ?? 0) + 1;
    });
    const membershipsByPlanChart = Object.entries(planCounts).map(([name, count]) => ({ name, count }));

    // ── 5. Socios que vencen en los próximos 7 días ──────────────────────────
    const nextWeekStr = (() => {
      const d = new Date(`${todayStr}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 7);
      return d.toISOString().slice(0, 10);
    })();

    const { data: expiringMemberships } = await supabase
      .from('user_memberships')
      .select('end_date, users(full_name, phone, dni), membership_plans(name)')
      .lte('end_date', nextWeekStr)
      .gte('end_date', todayStr)
      .eq('status', 'active')
      .order('end_date', { ascending: true })
      .limit(10);

    // ── 6. Stock bajo ────────────────────────────────────────────────────────
    const { data: products } = await supabase
      .from('products')
      .select('id, name, stock, min_stock, category');

    const lowStockProducts = (products ?? [])
      .filter((p) => p.stock <= p.min_stock)
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 5);

    // ── 7. Check-ins de hoy y tendencia ─────────────────────────────────────
    const [{ count: checkinsToday }, { count: checkinsYesterday }] = await Promise.all([
      supabase.from('check_ins').select('*', { count: 'exact', head: true })
        .gte('created_at', todayISO).lte('created_at', todayEndISO),
      supabase.from('check_ins').select('*', { count: 'exact', head: true })
        .gte('created_at', yestISO).lte('created_at', yestEndISO),
    ]);

    const checkinTrend = (checkinsYesterday ?? 0) > 0
      ? (((checkinsToday ?? 0) - (checkinsYesterday ?? 0)) / (checkinsYesterday ?? 1) * 100).toFixed(1)
      : null;

    // ── 8. Ingresos de los últimos 7 días por tipo ───────────────────────────
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const weeklyIncomePromises = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(`${todayStr}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() - (6 - i));
      const dStr  = d.toISOString().slice(0, 10);
      const start = dayStartUTC(dStr);
      const end   = dayEndUTC(dStr);

      return supabase
        .from('payments')
        .select('amount, payment_type')
        .gte('created_at', start)
        .lte('created_at', end)
        .then(({ data }) => ({
          name:        dayNames[d.getUTCDay()],
          memberships: data?.filter((p) => p.payment_type === 'membership').reduce((s, p) => s + Number(p.amount), 0) ?? 0,
          products:    data?.filter((p) => p.payment_type === 'product_sale').reduce((s, p) => s + Number(p.amount), 0) ?? 0,
          daily:       data?.filter((p) => p.payment_type === 'daily_pass').reduce((s, p) => s + Number(p.amount), 0) ?? 0,
          total:       data?.reduce((s, p) => s + Number(p.amount), 0) ?? 0,
        }));
    });
    const weeklyIncome = await Promise.all(weeklyIncomePromises);

    // ── 9. Últimas ventas del POS ────────────────────────────────────────────
    const { data: recentSales } = await supabase
      .from('sales')
      .select('total_amount, payment_method, created_at, users(full_name)')
      .order('created_at', { ascending: false })
      .limit(5);

    // ── 10. Usuarios activos / estados ───────────────────────────────────────
    const { data: userStatusData } = await supabase.from('users').select('status');

    const usersByStatus = { active: 0, expired: 0, warning: 0, inactive: 0 };
    userStatusData?.forEach((u) => {
      if (usersByStatus[u.status] !== undefined) usersByStatus[u.status]++;
    });

    // ── 11. Capacidad actual (check-ins últimas 3 h) ─────────────────────────
    const threeHoursAgoISO = new Date(Date.now() - 10_800_000).toISOString();
    const { count: currentPeople } = await supabase
      .from('check_ins')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', threeHoursAgoISO);

    // ── 12. Métodos de pago del mes ──────────────────────────────────────────
    const { data: monthPaymentsDetail } = await supabase
      .from('payments')
      .select('payment_method, amount')
      .gte('created_at', firstDayMonthISO);

    const paymentMethods = {};
    monthPaymentsDetail?.forEach((p) => {
      paymentMethods[p.payment_method] = (paymentMethods[p.payment_method] ?? 0) + Number(p.amount);
    });
    const paymentMethodsChart = Object.entries(paymentMethods).map(([name, value]) => ({ name, value }));

    res.json({
      dailyIncome,
      yesterdayIncome,
      incomeTrend,
      monthlyIncome,
      incomeByType,
      activeMemberships:   activeMemberships ?? 0,
      checkinsToday:       checkinsToday ?? 0,
      checkinTrend,
      weeklyIncome,
      membershipsByPlanChart,
      paymentMethodsChart,
      lowStockProducts,
      expiringMemberships: expiringMemberships ?? [],
      recentSales:         recentSales ?? [],
      usersByStatus,
      gymStatus: {
        currentPeople:      currentPeople ?? 0,
        maxCapacity:        250,
        pendingRenovations: expiringMemberships?.length ?? 0,
      },
    });
  } catch (err) {
    console.error('Dashboard error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

export const getCheckIns = async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 10, 200);
  try {
    const { data, error } = await supabase
      .from('check_ins')
      .select('*, users(full_name, dni)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};