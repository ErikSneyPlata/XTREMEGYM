// backend/controllers/clientController.js
import { supabase } from '../db.js';

// Colombia — siempre UTC-5, sin horario de verano
const colToday = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

// ─── GET /clients ─────────────────────────────────────────────────────────────
// Incluye membresía vigente de cada usuario en la misma respuesta
// para mostrar fecha de vencimiento sin peticiones extra por fila.
export const getClients = async (req, res) => {
  const { search, status, limit = 20, offset = 0 } = req.query;
  const today = colToday();

  let query = supabase.from('users').select('*', { count: 'exact' });

  if (search?.trim()) {
    query = query.or(
      `full_name.ilike.%${search.trim()}%,phone.ilike.%${search.trim()}%,dni.ilike.%${search.trim()}%`
    );
  }
  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const lim = Math.min(parseInt(limit) || 20, 100);
  const off = Math.max(parseInt(offset) || 0, 0);

  const { data: users, error, count } = await query
    .order('full_name', { ascending: true })
    .range(off, off + lim - 1);

  if (error) return res.status(400).json({ error: error.message });
  if (!users?.length) return res.json({ data: [], count: count ?? 0 });

  // Una sola query para traer membresías de todos los usuarios de esta página
  const userIds = users.map(u => u.id);

  const { data: memberships } = await supabase
    .from('user_memberships')
    .select('user_id, start_date, end_date, membership_plans(name, duration_days)')
    .in('user_id', userIds)
    .eq('status', 'active')
    .gte('end_date', today)
    .order('start_date', { ascending: true });

  // Agrupar por user_id
  const byUser = {};
  for (const m of memberships ?? []) {
    if (!byUser[m.user_id]) byUser[m.user_id] = [];
    byUser[m.user_id].push(m);
  }

  const data = users.map(user => {
    const list   = byUser[user.id] ?? [];
    const active = list.find(m => m.start_date <= today) ?? null; // vigente hoy
    const last   = list[list.length - 1] ?? null;                 // el más lejano (incluye extensiones)
    const realEndDate = last?.end_date ?? null;

    let daysLeft = null;
    if (realEndDate) {
      const diff = new Date(`${realEndDate}T12:00:00Z`) - new Date(`${today}T12:00:00Z`);
      daysLeft = Math.max(0, Math.ceil(diff / 86_400_000));
    }

    return {
      ...user,
      activeMembership: active,   // { start_date, end_date, membership_plans } | null
      realEndDate,                 // fecha real incluyendo extensiones encoladas
      daysLeft,                    // días restantes totales
    };
  });

  res.json({ data, count: count ?? 0 });
};

// ─── GET /clients/counts ──────────────────────────────────────────────────────
// Una sola petición en lugar de las 4 paralelas del frontend.
export const getClientCounts = async (req, res) => {
  try {
    const results = await Promise.all(
      ['active', 'warning', 'expired', 'inactive'].map(s =>
        supabase
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('status', s)
          .then(({ count }) => [s, count ?? 0])
      )
    );
    res.json(Object.fromEntries(results));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// ─── POST /clients ────────────────────────────────────────────────────────────
export const createClient = async (req, res) => {
  const { full_name, phone, email, dni } = req.body;
  if (!full_name?.trim()) return res.status(400).json({ error: 'El nombre es obligatorio.' });

  const { data, error } = await supabase
    .from('users')
    .insert([{
      full_name: full_name.trim(),
      phone:     phone?.trim()  || null,
      email:     email?.trim()  || null,
      dni:       dni?.trim()    || null,
    }])
    .select();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data[0]);
};

// ─── PUT /clients/:id ─────────────────────────────────────────────────────────
export const updateClient = async (req, res) => {
  const { id } = req.params;
  const allowed = ['full_name', 'phone', 'email', 'dni', 'status'];
  const updates = Object.fromEntries(
    Object.entries(req.body).filter(([k]) => allowed.includes(k))
  );
  if (!Object.keys(updates).length)
    return res.status(400).json({ error: 'Nada que actualizar.' });

  const { data, error } = await supabase.from('users').update(updates).eq('id', id).select();
  if (error) return res.status(400).json({ error: error.message });
  if (!data?.length) return res.status(404).json({ error: 'Cliente no encontrado.' });
  res.json(data[0]);
};

// ─── GET /clients/:id/stats ───────────────────────────────────────────────────
export const getClientStats = async (req, res) => {
  const { id } = req.params;
  const today  = colToday();

  const [
    { data: allActive },
    { data: checkins, count: totalVisits },
    { data: payments },
  ] = await Promise.all([
    supabase
      .from('user_memberships')
      .select('id, start_date, end_date, plan_id, membership_plans(name, price, duration_days)')
      .eq('user_id', id)
      .eq('status', 'active')
      .gte('end_date', today)
      .order('start_date', { ascending: true }),

    supabase
      .from('check_ins')
      .select('id, type, created_at', { count: 'exact' })
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(8),

    supabase
      .from('payments')
      .select('id, amount, payment_method, payment_type, created_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const all = allActive ?? [];

  const membership        = all.find(m => m.start_date <= today) ?? null;
  const futureMemberships = all.filter(m => m.start_date > today);
  const lastPlan          = all[all.length - 1] ?? null;
  const realEndDate       = lastPlan?.end_date ?? null;

  let daysLeft = null;
  if (realEndDate) {
    const diff = new Date(`${realEndDate}T12:00:00Z`) - new Date(`${today}T12:00:00Z`);
    daysLeft = Math.max(0, Math.ceil(diff / 86_400_000));
  }

  const accumulatedDays = futureMemberships.reduce(
    (sum, m) => sum + (m.membership_plans?.duration_days ?? 0), 0
  );

  res.json({
    membership,
    futureMemberships,
    realEndDate,
    daysLeft,
    accumulatedDays,
    recentCheckins: checkins  ?? [],
    totalVisits:    totalVisits ?? 0,
    recentPayments: payments  ?? [],
  });
};