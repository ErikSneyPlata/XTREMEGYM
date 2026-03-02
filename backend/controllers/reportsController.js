// backend/controllers/reportsController.js
import { supabase } from '../db.js';

// ─── helpers ──────────────────────────────────────────────────────────────────
// Colombia = UTC-5. Supabase guarda en UTC.
// Recibimos la fecha como string 'YYYY-MM-DD' desde el frontend (ya en hora local
// del usuario) y construimos los rangos UTC sumando/restando el offset.
const TZ_OFFSET_HOURS = 5; // UTC-5 Colombia

// 'YYYY-MM-DD' → inicio del día en UTC (00:00 local = 05:00 UTC)
const startOfDay = (dateStr) => {
  return `${dateStr}T${String(TZ_OFFSET_HOURS).padStart(2,'0')}:00:00.000Z`;
};

// 'YYYY-MM-DD' → fin del día en UTC (23:59:59 local = siguiente día 04:59:59 UTC)
const endOfDay = (dateStr) => {
  // Sumar 1 día y restar 1 ms equivale a 23:59:59.999 local
  const d = new Date(`${dateStr}T${String(TZ_OFFSET_HOURS).padStart(2,'0')}:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCMilliseconds(d.getUTCMilliseconds() - 1);
  return d.toISOString();
};

// Hoy como 'YYYY-MM-DD' en hora Colombia (UTC-5)
const todayLocal = () => {
  const adjusted = new Date(Date.now() - TZ_OFFSET_HOURS * 3600000);
  return adjusted.toISOString().slice(0, 10);
};

// Dado un string 'YYYY-MM-DD', retorna el lunes de esa semana
const mondayOf = (dateStr) => {
  const d = new Date(`${dateStr}T12:00:00Z`); // mediodía UTC evita ambigüedad
  const day = d.getUTCDay(); // 0=Dom
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
};

const addDays = (dateStr, n) => {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// Último día del mes como 'YYYY-MM-DD'
const lastDayOfMonth = (year, month) => {
  const d = new Date(Date.UTC(year, month, 0)); // day 0 = último del mes anterior
  return d.toISOString().slice(0, 10);
};

// ─── GET /reports/income ──────────────────────────────────────────────────────
// Query: ?mode=daily&date=2025-01-15
//        ?mode=weekly&date=2025-01-15   (week containing that date)
//        ?mode=monthly&year=2025&month=1
export const getIncomeReport = async (req, res) => {
  const { mode, date, year, month } = req.query;

  let from, to;
  // El frontend siempre envía 'date' como YYYY-MM-DD en hora local del usuario
  const localDate = date || todayLocal();

  if (mode === 'daily') {
    from = startOfDay(localDate);
    to   = endOfDay(localDate);

  } else if (mode === 'weekly') {
    const mon = mondayOf(localDate);
    const sun = addDays(mon, 6);
    from = startOfDay(mon);
    to   = endOfDay(sun);

  } else if (mode === 'monthly') {
    const y = parseInt(year)  || new Date().getFullYear();
    const m = parseInt(month) || new Date().getMonth() + 1;
    const firstDay = `${y}-${String(m).padStart(2,'0')}-01`;
    const lastDay  = lastDayOfMonth(y, m);
    from = startOfDay(firstDay);
    to   = endOfDay(lastDay);

  } else {
    return res.status(400).json({ error: 'mode debe ser daily, weekly o monthly.' });
  }

  // Fetch all payments in range with user info
  const { data: payments, error } = await supabase
    .from('payments')
    .select(`
      id,
      amount,
      payment_method,
      payment_type,
      created_at,
      users ( full_name, dni )
    `)
    .gte('created_at', from)
    .lte('created_at', to)
    .order('created_at', { ascending: false });

  if (error) return res.status(400).json({ error: error.message });

  const rows = payments ?? [];

  // ── Totals breakdown ──────────────────────────────────────────────────────
  const breakdown = {
    membership:   { count: 0, total: 0 },
    daily_pass:   { count: 0, total: 0 },
    product_sale: { count: 0, total: 0 },
  };

  const byMethod = { cash: 0, card: 0, transfer: 0 };

  rows.forEach(p => {
    const type = p.payment_type ?? 'membership';
    if (breakdown[type]) {
      breakdown[type].count++;
      breakdown[type].total += Number(p.amount);
    }
    byMethod[p.payment_method] = (byMethod[p.payment_method] ?? 0) + Number(p.amount);
  });

  const grandTotal = rows.reduce((s, p) => s + Number(p.amount), 0);

  // ── Daily series (for weekly/monthly views) ──────────────────────────────
  const byDay = {};
  rows.forEach(p => {
    const day = p.created_at.slice(0, 10);
    if (!byDay[day]) byDay[day] = { membership: 0, daily_pass: 0, product_sale: 0, total: 0 };
    const type = p.payment_type ?? 'membership';
    if (byDay[day][type] !== undefined) byDay[day][type] += Number(p.amount);
    byDay[day].total += Number(p.amount);
  });

  res.json({
    from,
    to,
    mode,
    grandTotal,
    breakdown,
    byMethod,
    byDay,
    payments: rows,
  });
};

// ─── GET /reports/active-memberships ─────────────────────────────────────────
// Returns active memberships with user info — used for PDF export
export const getActiveMemberships = async (req, res) => {
  // 🟡 Fix: end_date en Supabase es tipo DATE (solo fecha, sin hora).
  // Antes: comparaba contra new Date().toISOString() → "2025-01-15T05:00:00Z"
  // Supabase interpreta esto como datetime y puede excluir membresías que
  // vencen HOY si la hora UTC del servidor ya pasó las 00:00 del día siguiente.
  // Ahora: comparamos solo contra 'YYYY-MM-DD' para que sea una comparación
  // de fecha contra fecha, sin ambigüedad de hora.
  const todayStr = new Date(Date.now() - 5 * 3_600_000).toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('user_memberships')
    .select(`
      id,
      start_date,
      end_date,
      status,
      users ( full_name, dni, phone ),
      membership_plans ( name, duration_days, price )
    `)
    .eq('status', 'active')
    .gte('end_date', todayStr)
    .order('end_date', { ascending: true });

  if (error) return res.status(400).json({ error: error.message });

  const rows = (data ?? []).map(m => {
    const diff = new Date(m.end_date) - new Date();
    const daysLeft = Math.ceil(diff / 86400000);
    return {
      id:          m.id,
      full_name:   m.users?.full_name ?? '—',
      dni:         m.users?.dni       ?? '—',
      phone:       m.users?.phone     ?? '—',
      plan_name:   m.membership_plans?.name ?? '—',
      plan_price:  m.membership_plans?.price ?? 0,
      start_date:  m.start_date,
      end_date:    m.end_date,
      days_left:   daysLeft,
    };
  });

  res.json({ total: rows.length, members: rows });
};