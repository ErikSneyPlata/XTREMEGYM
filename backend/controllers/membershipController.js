// backend/controllers/membershipController.js
import { supabase } from "../db.js";

// Colombia — siempre UTC-5, sin horario de verano
const colToday = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

const addDays = (dateStr, days) => {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export const getPlans = async (req, res) => {
  const { data, error } = await supabase
    .from("membership_plans")
    .select("*")
    .order("duration_days", { ascending: true });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
};

export const createPlan = async (req, res) => {
  const { name, price, duration_days, description } = req.body;
  if (!name?.trim())
    return res
      .status(400)
      .json({ error: "El nombre del plan es obligatorio." });
  if (!price || Number(price) <= 0)
    return res.status(400).json({ error: "El precio debe ser mayor a 0." });
  if (!duration_days || Number(duration_days) <= 0)
    return res
      .status(400)
      .json({ error: "La duración debe ser mayor a 0 días." });
  const { data, error } = await supabase
    .from("membership_plans")
    .insert([
      {
        name: name.trim(),
        price: Number(price),
        duration_days: Number(duration_days),
        description: description?.trim() ?? null,
      },
    ])
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
};

export const updatePlan = async (req, res) => {
  const { id } = req.params;
  const { name, price, duration_days, description } = req.body;
  const updates = {};
  if (name !== undefined) updates.name = name.trim();
  if (price !== undefined) updates.price = Number(price);
  if (duration_days !== undefined)
    updates.duration_days = Number(duration_days);
  if (description !== undefined)
    updates.description = description?.trim() ?? null;
  if (!Object.keys(updates).length)
    return res.status(400).json({ error: "Nada que actualizar." });
  if (updates.price !== undefined && updates.price <= 0)
    return res.status(400).json({ error: "El precio debe ser mayor a 0." });
  if (updates.duration_days !== undefined && updates.duration_days <= 0)
    return res
      .status(400)
      .json({ error: "La duración debe ser mayor a 0 días." });
  const { data, error } = await supabase
    .from("membership_plans")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Plan no encontrado." });
  res.json(data);
};

export const deletePlan = async (req, res) => {
  const { id } = req.params;
  const { count } = await supabase
    .from("user_memberships")
    .select("id", { count: "exact", head: true })
    .eq("plan_id", id)
    .eq("status", "active");
  if (count > 0)
    return res
      .status(400)
      .json({
        error: `No se puede eliminar: hay ${count} membresía(s) activa(s) con este plan.`,
      });
  const { error } = await supabase
    .from("membership_plans")
    .delete()
    .eq("id", id);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: "Plan eliminado." });
};

// ─── registerMembershipPayment ────────────────────────────────────────────────
// Registro normal (desde hoy o acumulando al final del último plan).
// ─────────────────────────────────────────────────────────────────────────────
export const registerMembershipPayment = async (req, res) => {
  const { user_id, plan_id, payment_method } = req.body;
  const admin_id = req.user?.id;

  if (!user_id || !plan_id || !payment_method)
    return res
      .status(400)
      .json({ error: "user_id, plan_id y payment_method son obligatorios." });
  if (!["cash", "card", "transfer"].includes(payment_method))
    return res
      .status(400)
      .json({ error: 'payment_method debe ser "cash", "card" o "transfer".' });

  try {
    const { data: plan, error: planErr } = await supabase
      .from("membership_plans")
      .select("*")
      .eq("id", plan_id)
      .single();
    if (planErr || !plan)
      return res.status(404).json({ error: "Plan no encontrado." });

    const today = colToday();

    const { data: activeMemberships } = await supabase
      .from("user_memberships")
      .select(
        "id, start_date, end_date, plan_id, membership_plans(name, duration_days)",
      )
      .eq("user_id", user_id)
      .eq("status", "active")
      .gte("end_date", today)
      .order("end_date", { ascending: false });

    const isExtension = activeMemberships && activeMemberships.length > 0;
    const latestMembership = isExtension ? activeMemberships[0] : null;

    let startStr, endStr;
    if (isExtension) {
      startStr = addDays(latestMembership.end_date, 1);
    } else {
      startStr = today;
      await supabase
        .from("user_memberships")
        .update({ status: "expired" })
        .eq("user_id", user_id)
        .eq("status", "active");
    }
    endStr = addDays(startStr, plan.duration_days - 1);

    const { data: membership, error: memErr } = await supabase
      .from("user_memberships")
      .insert([
        {
          user_id,
          plan_id,
          start_date: startStr,
          end_date: endStr,
          status: "active",
        },
      ])
      .select()
      .single();
    if (memErr) throw memErr;

    const { error: payErr } = await supabase.from("payments").insert([
      {
        user_id,
        amount: plan.price,
        payment_method,
        payment_type: "membership",
        reference_id: membership.id,
        created_by: admin_id ?? null,
      },
    ]);
    if (payErr)
      console.error(
        "Aviso: membresía creada pero pago no registrado:",
        payErr.message,
      );

    await supabase.from("users").update({ status: "active" }).eq("id", user_id);

    const diffMs =
      new Date(`${endStr}T12:00:00Z`) - new Date(`${today}T12:00:00Z`);
    const totalDays = Math.max(0, Math.ceil(diffMs / 86_400_000));

    res.status(201).json({
      membership,
      extended: isExtension,
      previousEndDate: latestMembership?.end_date ?? null,
      newEndDate: endStr,
      totalDaysLeft: totalDays,
      planName: plan.name,
      planDays: plan.duration_days,
      message: isExtension
        ? `Plan "${plan.name}" acumulado. Vence el ${endStr} (${totalDays} días restantes).`
        : `Plan "${plan.name}" activo desde ${startStr} hasta ${endStr}.`,
    });
  } catch (err) {
    console.error("Error en registerMembershipPayment:", err.message);
    res.status(400).json({ error: err.message });
  }
};

// ─── registerManualMembership ─────────────────────────────────────────────────
//
// Asignación manual con fecha de inicio personalizada.
// Úsalo para registrar membresías históricas o retroactivas.
//
// Body: { user_id, plan_id, payment_method, start_date, amount? }
//   - start_date: 'YYYY-MM-DD' — la fecha real en que el cliente compró
//   - amount:     opcional — si el precio fue diferente al del plan
//
// Comportamiento:
//   - Calcula end_date = start_date + (duration_days - 1)
//   - Si end_date >= hoy → membresía activa, usuario 'active'
//   - Si end_date <  hoy → membresía expirada, usuario permanece como estaba
//   - Expira cualquier membresía 'active' previa del usuario antes de insertar
//   - Registra el pago con la fecha actual (created_at default de la DB)
//
// ─────────────────────────────────────────────────────────────────────────────
export const registerManualMembership = async (req, res) => {
  const { user_id, plan_id, payment_method, start_date, amount } = req.body;
  const admin_id = req.user?.id;

  if (!user_id || !plan_id || !payment_method || !start_date)
    return res
      .status(400)
      .json({
        error:
          "user_id, plan_id, payment_method y start_date son obligatorios.",
      });
  if (!["cash", "card", "transfer"].includes(payment_method))
    return res
      .status(400)
      .json({ error: 'payment_method debe ser "cash", "card" o "transfer".' });

  // Validar formato de fecha
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start_date))
    return res
      .status(400)
      .json({ error: "start_date debe tener formato YYYY-MM-DD." });

  try {
    const { data: plan, error: planErr } = await supabase
      .from("membership_plans")
      .select("*")
      .eq("id", plan_id)
      .single();
    if (planErr || !plan)
      return res.status(404).json({ error: "Plan no encontrado." });

    // Verificar que el usuario existe
    const { data: user, error: userErr } = await supabase
      .from("users")
      .select("id, status")
      .eq("id", user_id)
      .single();
    if (userErr || !user)
      return res.status(404).json({ error: "Usuario no encontrado." });

    const today = colToday();
    const endStr = addDays(start_date, plan.duration_days - 1);

    // Determinar si la membresía ya venció o sigue vigente
    const isStillActive = endStr >= today;
    const memberStatus = isStillActive ? "active" : "active"; // en user_memberships siempre 'active'

    // Expirar membresías activas previas para no generar conflictos
    await supabase
      .from("user_memberships")
      .update({ status: "expired" })
      .eq("user_id", user_id)
      .eq("status", "active");

    // Insertar la membresía con la fecha histórica
    const { data: membership, error: memErr } = await supabase
      .from("user_memberships")
      .insert([
        {
          user_id,
          plan_id,
          start_date, // fecha histórica real
          end_date: endStr,
          status: "active",
        },
      ])
      .select()
      .single();
    if (memErr) throw memErr;

    // Registrar el pago (monto del plan o monto personalizado)
    const paymentAmount =
      amount !== undefined && Number(amount) >= 0 ? Number(amount) : plan.price;

    const createdAtFromStartDate = new Date(
      `${start_date}T00:00:00Z`,
    ).toISOString();

    const { error: payErr } = await supabase.from("payments").insert([
      {
        user_id,
        amount: paymentAmount,
        payment_method,
        payment_type: "membership",
        reference_id: membership.id,
        created_by: admin_id ?? null,
        created_at: createdAtFromStartDate, // 👈 AQUÍ
      },
    ]);
    if (payErr)
      console.error(
        "Aviso: membresía manual creada pero pago no registrado:",
        payErr.message,
      );

    // Actualizar estado del usuario según si la membresía sigue vigente
    if (isStillActive) {
      const daysLeft = Math.ceil(
        (new Date(`${endStr}T12:00:00Z`) - new Date(`${today}T12:00:00Z`)) /
          86_400_000,
      );
      const newUserStatus = daysLeft <= 7 ? "warning" : "active";
      await supabase
        .from("users")
        .update({ status: newUserStatus })
        .eq("id", user_id);
    }
    // Si ya venció, el usuario queda con su status previo (no lo tocamos)

    const daysLeft = isStillActive
      ? Math.max(
          0,
          Math.ceil(
            (new Date(`${endStr}T12:00:00Z`) - new Date(`${today}T12:00:00Z`)) /
              86_400_000,
          ),
        )
      : 0;

    res.status(201).json({
      membership,
      isHistorical: true,
      startDate: start_date,
      endDate: endStr,
      isStillActive,
      daysLeft,
      planName: plan.name,
      planDays: plan.duration_days,
      amountPaid: paymentAmount,
      message: isStillActive
        ? `Membresía histórica registrada. Vigente hasta el ${endStr} (${daysLeft} días restantes).`
        : `Membresía histórica registrada. Ya venció el ${endStr}.`,
    });
  } catch (err) {
    console.error("Error en registerManualMembership:", err.message);
    res.status(400).json({ error: err.message });
  }
};
