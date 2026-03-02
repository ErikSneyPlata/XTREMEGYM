// backend/controllers/settingsController.js
import bcrypt from 'bcryptjs';
import { supabase } from '../db.js';

// ─── helpers ──────────────────────────────────────────────────────────────────
const ROLES = ['admin', 'encargado', 'entrenador'];

const logActivity = async (admin_id, action, details = '') => {
  try {
    await supabase.from('activity_log').insert([{ admin_id, action, details }]);
  } catch (_) { /* non-blocking */ }
};

// ═══════════════════════════════════════════════════════════════════════════════
// ADMINS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /settings/admins
export const getAdmins = async (req, res) => {
  const { data, error } = await supabase
    .from('admins')
    .select('id, username, full_name, role, created_at')
    .order('created_at', { ascending: true });

  if (error) return res.status(400).json({ error: error.message });
  res.json(data ?? []);
};

// POST /settings/admins
export const createAdmin = async (req, res) => {
  const { username, password, full_name, role = 'encargado' } = req.body;
  const requesterId = req.user?.id;

  if (!username || !password || !full_name) {
    return res.status(400).json({ error: 'username, password y full_name son obligatorios.' });
  }
  if (!ROLES.includes(role)) {
    return res.status(400).json({ error: `Rol inválido. Opciones: ${ROLES.join(', ')}` });
  }
  // Solo admin puede asignar rol admin
  if (role === 'admin' && req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Solo un administrador puede asignar el rol de administrador.' });
  }

  const { data: exists } = await supabase
    .from('admins').select('id').eq('username', username).maybeSingle();
  if (exists) return res.status(400).json({ error: 'El username ya está en uso.' });

  const password_hash = await bcrypt.hash(password, 12);

  const { data, error } = await supabase
    .from('admins')
    .insert([{ username, password_hash, full_name, role }])
    .select('id, username, full_name, role, created_at')
    .single();

  if (error) return res.status(400).json({ error: error.message });

  await logActivity(requesterId, 'create_admin', `Creó admin: ${username} (${role})`);
  res.status(201).json(data);
};

// PATCH /settings/admins/:id
export const updateAdmin = async (req, res) => {
  const { id } = req.params;
  const { full_name, role } = req.body;
  const requesterId = req.user?.id;
  const requesterRole = req.user?.role;

  // Buscar el admin a editar
  const { data: target } = await supabase
    .from('admins').select('id, username, role').eq('id', id).maybeSingle();
  if (!target) return res.status(404).json({ error: 'Admin no encontrado.' });

  // Solo admin puede editar otros admins
  if (requesterRole !== 'admin' && (target.role === 'admin' || role === 'admin')) {
    return res.status(403).json({ error: 'Sin permisos para modificar este usuario.' });
  }

  const updates = {};
  if (full_name) updates.full_name = full_name.trim();
  if (role && ROLES.includes(role)) updates.role = role;

  if (!Object.keys(updates).length) {
    return res.status(400).json({ error: 'Nada que actualizar.' });
  }

  const { data, error } = await supabase
    .from('admins').update(updates).eq('id', id)
    .select('id, username, full_name, role, created_at').single();

  if (error) return res.status(400).json({ error: error.message });

  await logActivity(requesterId, 'update_admin', `Editó admin: ${target.username}`);
  res.json(data);
};

// PATCH /settings/admins/:id/password
export const changePassword = async (req, res) => {
  const { id } = req.params;
  const { current_password, new_password } = req.body;
  const requesterId = req.user?.id;
  const requesterRole = req.user?.role;
  const isSelf = requesterId === id;

  if (!new_password || new_password.length < 6) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
  }

  const { data: target } = await supabase
    .from('admins').select('id, username, password_hash, role').eq('id', id).maybeSingle();
  if (!target) return res.status(404).json({ error: 'Admin no encontrado.' });

  // Si es su propia contraseña, verificar la actual
  if (isSelf) {
    if (!current_password) {
      return res.status(400).json({ error: 'Debes ingresar tu contraseña actual.' });
    }
    const valid = await bcrypt.compare(current_password, target.password_hash);
    if (!valid) return res.status(401).json({ error: 'Contraseña actual incorrecta.' });
  } else {
    // Solo admin puede cambiar la contraseña de otros
    if (requesterRole !== 'admin') {
      return res.status(403).json({ error: 'Sin permisos para cambiar contraseñas de otros usuarios.' });
    }
  }

  const password_hash = await bcrypt.hash(new_password, 12);
  const { error } = await supabase.from('admins').update({ password_hash }).eq('id', id);
  if (error) return res.status(400).json({ error: error.message });

  await logActivity(requesterId, 'change_password',
    isSelf ? 'Cambió su propia contraseña' : `Cambió contraseña de: ${target.username}`);
  res.json({ success: true });
};

// DELETE /settings/admins/:id
export const deleteAdmin = async (req, res) => {
  const { id } = req.params;
  const requesterId = req.user?.id;

  if (id === requesterId) {
    return res.status(400).json({ error: 'No puedes eliminarte a ti mismo.' });
  }

  const { data: target } = await supabase
    .from('admins').select('id, username, role').eq('id', id).maybeSingle();
  if (!target) return res.status(404).json({ error: 'Admin no encontrado.' });

  if (target.role === 'admin' && req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Solo un administrador puede eliminar otros administradores.' });
  }

  const { error } = await supabase.from('admins').delete().eq('id', id);
  if (error) return res.status(400).json({ error: error.message });

  await logActivity(requesterId, 'delete_admin', `Eliminó admin: ${target.username}`);
  res.json({ success: true });
};

// ═══════════════════════════════════════════════════════════════════════════════
// MEMBERSHIP PLANS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /settings/plans
export const getPlans = async (req, res) => {
  const { data, error } = await supabase
    .from('membership_plans')
    .select('*')
    .order('duration_days', { ascending: true });

  if (error) return res.status(400).json({ error: error.message });
  res.json(data ?? []);
};

// POST /settings/plans
export const createPlan = async (req, res) => {
  const { name, price, duration_days, description } = req.body;

  if (!name || !price || !duration_days) {
    return res.status(400).json({ error: 'name, price y duration_days son obligatorios.' });
  }
  if (Number(price) <= 0 || Number(duration_days) <= 0) {
    return res.status(400).json({ error: 'price y duration_days deben ser mayores a 0.' });
  }

  const { data, error } = await supabase
    .from('membership_plans')
    .insert([{ name: name.trim(), price: Number(price), duration_days: Number(duration_days), description }])
    .select().single();

  if (error) return res.status(400).json({ error: error.message });
  await logActivity(req.user?.id, 'create_plan', `Creó plan: ${name}`);
  res.status(201).json(data);
};

// PATCH /settings/plans/:id
export const updatePlan = async (req, res) => {
  const { id } = req.params;
  const { name, price, duration_days, description, active } = req.body;

  const updates = {};
  if (name !== undefined)         updates.name          = name.trim();
  if (price !== undefined)        updates.price         = Number(price);
  if (duration_days !== undefined) updates.duration_days = Number(duration_days);
  if (description !== undefined)  updates.description   = description;
  if (active !== undefined)       updates.active        = Boolean(active);

  if (!Object.keys(updates).length) return res.status(400).json({ error: 'Nada que actualizar.' });

  const { data, error } = await supabase
    .from('membership_plans').update(updates).eq('id', id).select().single();

  if (error) return res.status(400).json({ error: error.message });
  await logActivity(req.user?.id, 'update_plan', `Editó plan ID: ${id}`);
  res.json(data);
};

// DELETE /settings/plans/:id
export const deletePlan = async (req, res) => {
  const { id } = req.params;

  // Verificar que no tenga membresías activas asociadas
  const { count } = await supabase
    .from('user_memberships')
    .select('id', { count: 'exact', head: true })
    .eq('plan_id', id)
    .eq('status', 'active');

  if (count > 0) {
    return res.status(400).json({
      error: `No se puede eliminar: hay ${count} membresía(s) activa(s) con este plan. Desactívalo primero.`
    });
  }

  const { error } = await supabase.from('membership_plans').delete().eq('id', id);
  if (error) return res.status(400).json({ error: error.message });

  await logActivity(req.user?.id, 'delete_plan', `Eliminó plan ID: ${id}`);
  res.json({ success: true });
};

// ═══════════════════════════════════════════════════════════════════════════════
// ACTIVITY LOG
// ═══════════════════════════════════════════════════════════════════════════════

// GET /settings/activity-log?limit=50&offset=0
export const getActivityLog = async (req, res) => {
  const { limit = 50, offset = 0 } = req.query;

  const { data, error, count } = await supabase
    .from('activity_log')
    .select('id, action, details, created_at, admins(username, full_name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

  if (error) return res.status(400).json({ error: error.message });
  res.json({ data: data ?? [], count: count ?? 0 });
};