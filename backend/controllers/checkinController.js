// backend/controllers/checkinController.js
import { supabase } from '../db.js';

// ─── Timezone helpers (Colombia — siempre UTC-5, sin horario de verano) ───────
const colToday = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }); // 'YYYY-MM-DD'

const todayRangeUTC = () => {
  const dateStr = colToday();                         // día colombiano actual
  const from    = `${dateStr}T05:00:00.000Z`;         // medianoche Colombia = 05:00 UTC
  const to      = new Date(from);
  to.setUTCDate(to.getUTCDate() + 1);
  to.setUTCMilliseconds(to.getUTCMilliseconds() - 1);
  return { from, to: to.toISOString() };
};

const toLocalDate = (d) =>
  d.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }); // 'YYYY-MM-DD'

// ─── GET /checkin-history ─────────────────────────────────────────────────────
export const getCheckinHistory = async (req, res) => {
  const lim = Math.min(parseInt(req.query.limit) || 200, 500);
  const { from, to } = todayRangeUTC();

  const { data, error } = await supabase
    .from('check_ins')
    .select('id, type, created_at, users(full_name)')
    .gte('created_at', from)
    .lte('created_at', to)
    .order('created_at', { ascending: false })
    .limit(lim);

  if (error) return res.status(400).json({ error: error.message });
  res.json(data ?? []);
};

// ─── POST /checkins ───────────────────────────────────────────────────────────
// Validaciones de membresía:
//
//   tipo 'monthly':
//     - Requiere una membresía con start_date <= HOY y end_date >= HOY
//       (la vigente hoy, aunque tenga extensiones futuras encoladas)
//     - Si sólo tiene extensiones futuras (start > hoy) → error: membresía aún no inicia
//
//   tipo 'daily':
//     - Bloqueado si tiene CUALQUIER membresía activa vigente HOY
//     - Bloqueado también si tiene extensiones futuras (ya pagó su siguiente mes)
//       para evitar cobrarle pase diario a alguien que ya pagó su siguiente plan
//
// ─────────────────────────────────────────────────────────────────────────────
export const createCheckin = async (req, res) => {
  const { user_id, type, amount, payment_method = 'cash' } = req.body;

  if (!user_id || !type)
    return res.status(400).json({ error: 'user_id y type son obligatorios.' });
  if (!['monthly', 'daily'].includes(type))
    return res.status(400).json({ error: 'type debe ser "monthly" o "daily".' });

  // Verificar usuario
  const { data: user, error: userErr } = await supabase
    .from('users').select('id').eq('id', user_id).single();
  if (userErr || !user)
    return res.status(404).json({ error: 'Usuario no encontrado.' });

  const today = colToday();

  // Membresía vigente HOY (start_date <= hoy <= end_date)
  const { data: currentMembership } = await supabase
    .from('user_memberships')
    .select('id, start_date, end_date')
    .eq('user_id', user_id)
    .eq('status', 'active')
    .lte('start_date', today)  // ya inició
    .gte('end_date',   today)  // no ha vencido
    .order('end_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Extensiones futuras (start_date > hoy, ya pagadas)
  const { data: futureMemberships } = await supabase
    .from('user_memberships')
    .select('id, start_date, end_date')
    .eq('user_id', user_id)
    .eq('status', 'active')
    .gt('start_date', today)
    .limit(1);

  const hasFuture = (futureMemberships?.length ?? 0) > 0;

  // ── validaciones por tipo ─────────────────────────────────────────────────

  if (type === 'monthly') {
    if (!currentMembership) {
      // ¿Tiene extensión futura pero la vigente no ha iniciado aún?
      if (hasFuture) {
        const nextStart = futureMemberships[0].start_date;
        return res.status(400).json({
          error: `El próximo plan aún no ha iniciado. Inicia el ${nextStart}.`,
        });
      }
      return res.status(400).json({ error: 'El socio no tiene membresía activa.' });
    }
  }

  if (type === 'daily') {
    if (currentMembership) {
      return res.status(400).json({
        error: 'El socio ya tiene membresía activa. No se permite cobrar pase diario.',
      });
    }
    // También bloqueamos si tiene un plan futuro ya pagado
    // (sería raro cobrarle pase diario el último día antes de que inicie su siguiente plan)
    if (hasFuture) {
      return res.status(400).json({
        error: 'El socio ya tiene un plan pagado próximo a iniciar. No se permite cobrar pase diario.',
      });
    }
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ error: 'El monto del pase diario es obligatorio.' });
    }
  }

  // ── Crear pago para pase diario ───────────────────────────────────────────
  let paymentId = null;
  if (type === 'daily') {
    const { data: payment, error: payErr } = await supabase
      .from('payments')
      .insert([{
        user_id, amount: Number(amount), payment_method,
        payment_type: 'daily_pass', created_by: req.user?.id ?? null,
      }])
      .select('id').single();

    if (payErr) return res.status(400).json({ error: `Error al registrar pago: ${payErr.message}` });
    paymentId = payment.id;
  }

  // ── Crear check-in ────────────────────────────────────────────────────────
  const { data: checkin, error: checkinErr } = await supabase
    .from('check_ins')
    .insert([{ user_id, type, payment_id: paymentId, created_by: req.user?.id ?? null }])
    .select().single();

  if (checkinErr) {
    if (paymentId) await supabase.from('payments').delete().eq('id', paymentId);
    return res.status(400).json({ error: checkinErr.message });
  }

  // Actualizar last_check_in
  await supabase.from('users').update({ last_check_in: new Date().toISOString() }).eq('id', user_id);

  res.status(201).json({ ...checkin, payment_id: paymentId });
};

// ─── DELETE /checkins/:id ─────────────────────────────────────────────────────
export const deleteCheckin = async (req, res) => {
  const { id } = req.params;

  const { data: existing, error: fetchErr } = await supabase
    .from('check_ins').select('id, user_id, type, created_at, payment_id')
    .eq('id', id).maybeSingle();

  if (fetchErr || !existing)
    return res.status(404).json({ error: 'Registro de ingreso no encontrado.' });

  // Solo del día actual (Colombia)
  const isToday = toLocalDate(new Date(existing.created_at)) === colToday();
  if (!isToday)
    return res.status(403).json({ error: 'Solo se pueden eliminar ingresos del día actual.' });

  const { error: deleteErr } = await supabase.from('check_ins').delete().eq('id', id);
  if (deleteErr) return res.status(400).json({ error: deleteErr.message });

  // Revertir pago de pase diario
  let reversedAmount = null;
  if (existing.type === 'daily' && existing.payment_id) {
    const { data: payment } = await supabase
      .from('payments').select('id, amount').eq('id', existing.payment_id).maybeSingle();
    if (payment) {
      await supabase.from('payments').delete().eq('id', payment.id);
      reversedAmount = payment.amount;
    }
  }

  // Recalcular last_check_in
  const { data: lastCheckin } = await supabase
    .from('check_ins').select('created_at').eq('user_id', existing.user_id)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();

  await supabase.from('users')
    .update({ last_check_in: lastCheckin?.created_at ?? null })
    .eq('id', existing.user_id);

  res.json({
    success: true, deleted_id: id,
    payment_reversed: reversedAmount !== null,
    reversed_amount:  reversedAmount,
  });
};