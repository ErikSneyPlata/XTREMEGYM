// backend/controllers/clientController.js
import { supabase } from '../db.js';

const colToday = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

const addDays = (dateStr, days) => {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

// ─── GET /clients ─────────────────────────────────────────────────────────────
export const getClients = async (req, res) => {
  const { search, status, limit = 20, offset = 0 } = req.query;
  const today = colToday();

  let query = supabase.from('users').select('*', { count: 'exact' });

  if (search?.trim()) {
    query = query.or(
      `full_name.ilike.%${search.trim()}%,phone.ilike.%${search.trim()}%,dni.ilike.%${search.trim()}%`
    );
  }
  if (status && status !== 'all') query = query.eq('status', status);

  const lim = Math.min(parseInt(limit) || 20, 100);
  const off = Math.max(parseInt(offset) || 0, 0);

  const { data: users, error, count } = await query
    .order('full_name', { ascending: true })
    .range(off, off + lim - 1);

  if (error) return res.status(400).json({ error: error.message });
  if (!users?.length) return res.json({ data: [], count: count ?? 0 });

  const userIds = users.map(u => u.id);

  const { data: memberships } = await supabase
    .from('user_memberships')
    .select('user_id, start_date, end_date, membership_plans(name, duration_days)')
    .in('user_id', userIds)
    .eq('status', 'active')
    .gte('end_date', today)
    .order('start_date', { ascending: true });

  const byUser = {};
  for (const m of memberships ?? []) {
    if (!byUser[m.user_id]) byUser[m.user_id] = [];
    byUser[m.user_id].push(m);
  }

  const data = users.map(user => {
    const list        = byUser[user.id] ?? [];
    const active      = list.find(m => m.start_date <= today) ?? null;
    const last        = list[list.length - 1] ?? null;
    const realEndDate = last?.end_date ?? null;

    let daysLeft = null;
    if (realEndDate) {
      const diff = new Date(`${realEndDate}T12:00:00Z`) - new Date(`${today}T12:00:00Z`);
      daysLeft = Math.max(0, Math.ceil(diff / 86_400_000));
    }

    return { ...user, activeMembership: active, realEndDate, daysLeft };
  });

  res.json({ data, count: count ?? 0 });
};

// ─── GET /clients/counts ──────────────────────────────────────────────────────
export const getClientCounts = async (_req, res) => {
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
  if (!full_name?.trim())
    return res.status(400).json({ error: 'El nombre es obligatorio.' });

  // Verificar duplicados
  if (dni?.trim()) {
    const { data: existing } = await supabase
      .from('users').select('id').eq('dni', dni.trim()).maybeSingle();
    if (existing)
      return res.status(409).json({ error: 'Ya existe un socio con ese DNI.' });
  }
  if (email?.trim()) {
    const { data: existing } = await supabase
      .from('users').select('id').eq('email', email.trim().toLowerCase()).maybeSingle();
    if (existing)
      return res.status(409).json({ error: 'Ya existe un socio con ese correo.' });
  }

  const { data, error } = await supabase
    .from('users')
    .insert([{
      full_name: full_name.trim(),
      phone:     phone?.trim()               || null,
      email:     email?.trim().toLowerCase() || null,
      dni:       dni?.trim()                 || null,
      status:    'inactive',
    }])
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
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

  // Normalizar email
  if (updates.email) updates.email = updates.email.trim().toLowerCase();

  // Verificar duplicados si cambia DNI o email
  if (updates.dni) {
    const { data: ex } = await supabase
      .from('users').select('id').eq('dni', updates.dni).neq('id', id).maybeSingle();
    if (ex) return res.status(409).json({ error: 'DNI ya registrado en otro socio.' });
  }
  if (updates.email) {
    const { data: ex } = await supabase
      .from('users').select('id').eq('email', updates.email).neq('id', id).maybeSingle();
    if (ex) return res.status(409).json({ error: 'Email ya registrado en otro socio.' });
  }

  const { data, error } = await supabase
    .from('users').update(updates).eq('id', id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  if (!data)  return res.status(404).json({ error: 'Cliente no encontrado.' });
  res.json(data);
};

// ─── DELETE /clients/:id ──────────────────────────────────────────────────────
export const deleteClient = async (req, res) => {
  const { id } = req.params;
  const today  = colToday();

  // Bloquear si tiene membresía activa vigente hoy
  const { count } = await supabase
    .from('user_memberships')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', id)
    .eq('status', 'active')
    .gte('end_date', today);

  if (count > 0)
    return res.status(400).json({
      error: 'No se puede eliminar un socio con membresía activa. Cancela la membresía primero.',
    });

  const { error } = await supabase.from('users').delete().eq('id', id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'Socio eliminado correctamente.' });
};

// ─── GET /clients/:id/stats ───────────────────────────────────────────────────
export const getClientStats = async (req, res) => {
  const { id } = req.params;
  const today  = colToday();

  const [
    { data: allActive },
    { data: checkins, count: totalVisits },
    { data: payments },
    { data: membershipHistory },
  ] = await Promise.all([
    // Membresías vigentes (activas con end_date >= hoy)
    supabase
      .from('user_memberships')
      .select('id, start_date, end_date, plan_id, membership_plans(name, price, duration_days)')
      .eq('user_id', id)
      .eq('status', 'active')
      .gte('end_date', today)
      .order('start_date', { ascending: true }),

    // Check-ins recientes
    supabase
      .from('check_ins')
      .select('id, type, created_at', { count: 'exact' })
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(8),

    // Pagos recientes
    supabase
      .from('payments')
      .select('id, amount, payment_method, payment_type, created_at')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(5),

    // Historial completo de membresías (todas, incluyendo expiradas)
    supabase
      .from('user_memberships')
      .select('id, start_date, end_date, status, plan_id, membership_plans(name, price, duration_days)')
      .eq('user_id', id)
      .order('start_date', { ascending: false })
      .limit(20),
  ]);

  const all               = allActive ?? [];
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
    recentCheckins:    checkins          ?? [],
    totalVisits:       totalVisits       ?? 0,
    recentPayments:    payments          ?? [],
    membershipHistory: membershipHistory ?? [],
  });
};

// ─── POST /clients/:id/cancel-membership ─────────────────────────────────────
// Cancela (expira) todas las membresías activas/futuras del usuario.
export const cancelMembership = async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('user_memberships')
    .update({ status: 'expired' })
    .eq('user_id', id)
    .eq('status', 'active');

  if (error) return res.status(400).json({ error: error.message });

  await supabase
    .from('users')
    .update({ status: 'inactive' })
    .eq('id', id);

  res.json({ message: 'Membresía cancelada.' });
};

// ─── POST /clients/:id/register-membership ───────────────────────────────────
// Registro de membresía directamente desde el panel de cliente.
// Soporta modo normal (desde hoy / acumular) y modo histórico (fecha manual).
export const registerClientMembership = async (req, res) => {
  const { id: user_id } = req.params;
  const { plan_id, payment_method, start_date, amount, mode = 'normal' } = req.body;
  const admin_id = req.user?.id;

  if (!plan_id || !payment_method)
    return res.status(400).json({ error: 'plan_id y payment_method son obligatorios.' });
  if (!['cash', 'card', 'transfer'].includes(payment_method))
    return res.status(400).json({ error: 'Método de pago inválido.' });
  if (mode === 'historical' && !start_date)
    return res.status(400).json({ error: 'start_date es obligatorio en modo histórico.' });

  try {
    const { data: plan, error: planErr } = await supabase
      .from('membership_plans').select('*').eq('id', plan_id).single();
    if (planErr || !plan)
      return res.status(404).json({ error: 'Plan no encontrado.' });

    const today = colToday();

    // ── MODO HISTÓRICO ────────────────────────────────────────────────────────
    if (mode === 'historical') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(start_date))
        return res.status(400).json({ error: 'start_date debe tener formato YYYY-MM-DD.' });

      const endStr       = addDays(start_date, plan.duration_days - 1);
      const isStillActive = endStr >= today;

      // Expirar membresías activas previas
      await supabase
        .from('user_memberships')
        .update({ status: 'expired' })
        .eq('user_id', user_id)
        .eq('status', 'active');

      const { data: membership, error: memErr } = await supabase
        .from('user_memberships')
        .insert([{ user_id, plan_id, start_date, end_date: endStr, status: 'active' }])
        .select().single();
      if (memErr) throw memErr;

      const payAmount = amount !== undefined && Number(amount) >= 0 ? Number(amount) : plan.price;
      await supabase.from('payments').insert([{
        user_id, amount: payAmount, payment_method,
        payment_type: 'membership', reference_id: membership.id,
        created_by: admin_id ?? null,
        created_at: new Date(`${start_date}T00:00:00Z`).toISOString(),
      }]);

      if (isStillActive) {
        const daysLeft = Math.max(0, Math.ceil(
          (new Date(`${endStr}T12:00:00Z`) - new Date(`${today}T12:00:00Z`)) / 86_400_000
        ));
        await supabase.from('users').update({
          status: daysLeft <= 7 ? 'warning' : 'active',
        }).eq('id', user_id);
      }

      const daysLeft = isStillActive ? Math.max(0, Math.ceil(
        (new Date(`${endStr}T12:00:00Z`) - new Date(`${today}T12:00:00Z`)) / 86_400_000
      )) : 0;

      return res.status(201).json({
        membership, mode: 'historical', isStillActive,
        startDate: start_date, endDate: endStr, daysLeft,
        planName: plan.name, planDays: plan.duration_days, amountPaid: payAmount,
      });
    }

    // ── MODO NORMAL ───────────────────────────────────────────────────────────
    const { data: activeMemberships } = await supabase
      .from('user_memberships')
      .select('id, end_date')
      .eq('user_id', user_id)
      .eq('status', 'active')
      .gte('end_date', today)
      .order('end_date', { ascending: false });

    const isExtension = activeMemberships?.length > 0;
    const latest      = isExtension ? activeMemberships[0] : null;

    let startStr;
    if (isExtension) {
      startStr = addDays(latest.end_date, 1);
    } else {
      startStr = today;
      await supabase
        .from('user_memberships')
        .update({ status: 'expired' })
        .eq('user_id', user_id)
        .eq('status', 'active');
    }
    const endStr = addDays(startStr, plan.duration_days - 1);

    const { data: membership, error: memErr } = await supabase
      .from('user_memberships')
      .insert([{ user_id, plan_id, start_date: startStr, end_date: endStr, status: 'active' }])
      .select().single();
    if (memErr) throw memErr;

    const payAmount = amount !== undefined && Number(amount) >= 0 ? Number(amount) : plan.price;
    await supabase.from('payments').insert([{
      user_id, amount: payAmount, payment_method,
      payment_type: 'membership', reference_id: membership.id,
      created_by: admin_id ?? null,
    }]);

    await supabase.from('users').update({ status: 'active' }).eq('id', user_id);

    const totalDaysLeft = Math.max(0, Math.ceil(
      (new Date(`${endStr}T12:00:00Z`) - new Date(`${today}T12:00:00Z`)) / 86_400_000
    ));

    return res.status(201).json({
      membership, mode: 'normal', extended: isExtension,
      previousEndDate: latest?.end_date ?? null,
      newStartDate: startStr, newEndDate: endStr,
      totalDaysLeft, planName: plan.name, planDays: plan.duration_days,
      amountPaid: payAmount,
    });

  } catch (err) {
    console.error('registerClientMembership:', err.message);
    res.status(400).json({ error: err.message });
  }
};