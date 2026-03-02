// frontend/src/pages/Settings.jsx
import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Users, Shield, Clock, Plus, Pencil, Trash2,
  KeyRound, X, AlertTriangle, ChevronRight,
  Eye, EyeOff, RefreshCw, UserCog, Crown, Headset,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// ─── helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) => `$${Number(n ?? 0).toLocaleString('es-CO', { minimumFractionDigits: 0 })}`;
const fmtDate = (s) => s ? new Date(s).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtTime = (s) => s ? new Date(s).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '—';

const ROLE_CONFIG = {
  admin:      { label: 'Administrador', icon: Crown,   color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  encargado:  { label: 'Encargado',     icon: Shield,  color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' },
  entrenador: { label: 'Entrenador',    icon: Headset, color: 'text-blue-400',  bg: 'bg-blue-500/10',  border: 'border-blue-500/20'  },
};

const ACTION_LABELS = {
  create_admin:     { label: 'Nuevo admin',       color: 'text-green-400' },
  update_admin:     { label: 'Editó admin',        color: 'text-blue-400' },
  delete_admin:     { label: 'Eliminó admin',      color: 'text-red-400' },
  change_password:  { label: 'Cambió contraseña',  color: 'text-amber-400' },
  create_plan:      { label: 'Nuevo plan',         color: 'text-green-400' },
  update_plan:      { label: 'Editó plan',         color: 'text-blue-400' },
  delete_plan:      { label: 'Eliminó plan',       color: 'text-red-400' },
};

// ─── sub-components ───────────────────────────────────────────────────────────
function TabBtn({ active, onClick, icon: Icon, label, badge }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
        active ? 'bg-green-600 text-white shadow-lg shadow-green-600/20' : 'text-slate-400 hover:text-white hover:bg-white/5'
      }`}
    >
      <Icon size={15} />
      {label}
      {badge != null && (
        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-white/5 text-slate-500'}`}>
          {badge}
        </span>
      )}
    </button>
  );
}

function RoleBadge({ role }) {
  const cfg = ROLE_CONFIG[role] ?? ROLE_CONFIG.encargado;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
      <cfg.icon size={10} />
      {cfg.label}
    </span>
  );
}

function PasswordInput({ label, value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      {label && <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">{label}</label>}
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full bg-[#0f0f0f] border border-white/5 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-green-600 outline-none transition-all pr-10"
        />
        <button type="button" onClick={() => setShow(v => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 transition-colors">
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </div>
  );
}

function ConfirmDelete({ message, sub, onConfirm, onCancel, loading }) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }} className="overflow-hidden"
    >
      <div className="px-4 py-3 bg-red-500/8 border-t border-red-500/20 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-red-400 font-medium">{message}</p>
          {sub && <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={onCancel} disabled={loading}
            className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded-lg hover:bg-white/5 transition-all">
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="text-xs text-white bg-red-600 hover:bg-red-500 px-3 py-1 rounded-lg font-bold transition-all disabled:opacity-50">
            {loading ? '...' : 'Eliminar'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: Admins
// ═══════════════════════════════════════════════════════════════════════════════
function AdminsTab({ currentUser }) {
  const [admins, setAdmins]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [editTarget, setEditTarget]   = useState(null);   // admin being edited
  const [pwdTarget, setPwdTarget]     = useState(null);   // admin whose pwd changes
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [delLoading, setDelLoading]   = useState(false);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');

  const isAdmin = currentUser?.role === 'admin';

  // form state
  const emptyForm = { username: '', full_name: '', role: 'encargado', password: '', confirmPassword: '' };
  const [form, setForm] = useState(emptyForm);

  // pwd form
  const [pwdForm, setPwdForm] = useState({ current_password: '', new_password: '', confirm: '' });

  const fetch = useCallback(async () => {
    setLoading(true);
    try { const { data } = await api.get('/settings/admins'); setAdmins(data ?? []); }
    catch (_) {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const openEdit = (admin) => {
    setEditTarget(admin);
    setForm({ ...emptyForm, full_name: admin.full_name, role: admin.role });
    setError('');
  };

  const handleSave = async () => {
    setError('');
    if (!editTarget && (!form.username || !form.full_name || !form.password)) {
      return setError('Todos los campos obligatorios deben completarse.');
    }
    if (!editTarget && form.password !== form.confirmPassword) {
      return setError('Las contraseñas no coinciden.');
    }
    setSaving(true);
    try {
      if (editTarget) {
        const { data } = await api.patch(`/settings/admins/${editTarget.id}`, {
          full_name: form.full_name, role: form.role,
        });
        setAdmins(prev => prev.map(a => a.id === editTarget.id ? data : a));
      } else {
        const { data } = await api.post('/settings/admins', {
          username: form.username, password: form.password,
          full_name: form.full_name, role: form.role,
        });
        setAdmins(prev => [...prev, data]);
      }
      setEditTarget(null); setShowForm(false); setForm(emptyForm);
    } catch (err) {
      setError(err.response?.data?.error ?? 'Error al guardar.');
    } finally { setSaving(false); }
  };

  const handleChangePwd = async () => {
    setError('');
    if (!pwdForm.new_password || pwdForm.new_password.length < 6) {
      return setError('La nueva contraseña debe tener al menos 6 caracteres.');
    }
    if (pwdForm.new_password !== pwdForm.confirm) {
      return setError('Las contraseñas no coinciden.');
    }
    const isSelf = pwdTarget?.id === currentUser?.id;
    if (isSelf && !pwdForm.current_password) return setError('Ingresa tu contraseña actual.');
    setSaving(true);
    try {
      await api.patch(`/settings/admins/${pwdTarget.id}/password`, {
        current_password: isSelf ? pwdForm.current_password : undefined,
        new_password: pwdForm.new_password,
      });
      setPwdTarget(null); setPwdForm({ current_password: '', new_password: '', confirm: '' });
    } catch (err) {
      setError(err.response?.data?.error ?? 'Error al cambiar contraseña.');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDelLoading(true);
    try {
      await api.delete(`/settings/admins/${deleteTarget.id}`);
      setAdmins(prev => prev.filter(a => a.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      alert(err.response?.data?.error ?? 'Error al eliminar.');
    } finally { setDelLoading(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-black text-lg">Usuarios del sistema</h2>
          <p className="text-slate-500 text-xs mt-0.5">{admins.length} usuarios registrados</p>
        </div>
        {isAdmin && (
          <button onClick={() => { setShowForm(true); setEditTarget(null); setForm(emptyForm); setError(''); }}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-bold text-sm rounded-xl transition-all">
            <Plus size={15} /> Nuevo usuario
          </button>
        )}
      </div>

      {/* Admin list */}
      <div className="bg-[#141414] border border-white/5 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-600 text-sm">Cargando...</div>
        ) : (
          admins.map((admin, i) => {
            const isMe = admin.id === currentUser?.id;
            const isDeleting = deleteTarget?.id === admin.id;
            return (
              <div key={admin.id} className={i > 0 ? 'border-t border-white/5' : ''}>
                <div className={`flex items-center gap-4 px-5 py-4 transition-colors ${isDeleting ? 'bg-red-500/5' : 'hover:bg-white/5'} group`}>
                  <div className="size-10 rounded-xl bg-white/5 flex items-center justify-center font-black text-lg flex-shrink-0">
                    {admin.full_name?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm">{admin.full_name}</p>
                      {isMe && <span className="text-[9px] text-green-400 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded-full font-bold">TÚ</span>}
                    </div>
                    <p className="text-[11px] text-slate-500">@{admin.username}</p>
                  </div>
                  <RoleBadge role={admin.role} />
                  <p className="text-[10px] text-slate-600 hidden sm:block">{fmtDate(admin.created_at)}</p>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setPwdTarget(admin); setError(''); setPwdForm({ current_password: '', new_password: '', confirm: '' }); }}
                      className="p-1.5 rounded-lg text-slate-600 hover:text-amber-400 hover:bg-amber-500/10 transition-all" title="Cambiar contraseña">
                      <KeyRound size={14} />
                    </button>
                    {(isAdmin || isMe) && (
                      <button onClick={() => openEdit(admin)}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-blue-400 hover:bg-blue-500/10 transition-all" title="Editar">
                        <Pencil size={14} />
                      </button>
                    )}
                    {isAdmin && !isMe && (
                      <button onClick={() => setDeleteTarget(admin)}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all" title="Eliminar">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
                <AnimatePresence>
                  {isDeleting && (
                    <ConfirmDelete
                      message={`¿Eliminar a ${admin.full_name}?`}
                      sub="Esta acción no se puede deshacer."
                      onConfirm={handleDelete}
                      onCancel={() => setDeleteTarget(null)}
                      loading={delLoading}
                    />
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>

      {/* Create / Edit modal */}
      <AnimatePresence>
        {(showForm || editTarget) && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setShowForm(false); setEditTarget(null); }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-[#1a1a1a] border border-white/10 w-full max-w-md rounded-3xl p-7 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black">{editTarget ? 'Editar usuario' : 'Nuevo usuario'}</h3>
                <button onClick={() => { setShowForm(false); setEditTarget(null); }} className="p-1.5 text-slate-500 hover:text-white"><X size={18} /></button>
              </div>
              {error && <div className="mb-4 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</div>}
              <div className="space-y-4">
                {!editTarget && (
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Username *</label>
                    <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                      placeholder="ej: juan.perez" className="w-full bg-[#0f0f0f] border border-white/5 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-green-600 outline-none transition-all" />
                  </div>
                )}
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Nombre completo *</label>
                  <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                    placeholder="ej: Juan Pérez" className="w-full bg-[#0f0f0f] border border-white/5 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-green-600 outline-none transition-all" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Rol</label>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(ROLE_CONFIG).map(([r, cfg]) => (
                      <button key={r} type="button" onClick={() => setForm(f => ({ ...f, role: r }))}
                        className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                          form.role === r ? `${cfg.bg} ${cfg.border} ${cfg.color}` : 'border-white/5 bg-[#0f0f0f] text-slate-500 hover:border-white/15'
                        }`}>
                        <cfg.icon size={14} />{cfg.label}
                      </button>
                    ))}
                  </div>
                </div>
                {!editTarget && (
                  <>
                    <PasswordInput label="Contraseña *" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Mínimo 6 caracteres" />
                    <PasswordInput label="Confirmar contraseña *" value={form.confirmPassword} onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))} placeholder="Repite la contraseña" />
                  </>
                )}
                <button onClick={handleSave} disabled={saving}
                  className="w-full bg-green-600 hover:bg-green-500 text-white font-black py-3 rounded-xl transition-all disabled:opacity-50 mt-1">
                  {saving ? 'Guardando...' : editTarget ? 'Guardar cambios' : 'Crear usuario'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Change password modal */}
      <AnimatePresence>
        {pwdTarget && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setPwdTarget(null)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-[#1a1a1a] border border-white/10 w-full max-w-sm rounded-3xl p-7 shadow-2xl">
              <div className="flex justify-between items-center mb-1">
                <h3 className="text-lg font-black">Cambiar contraseña</h3>
                <button onClick={() => setPwdTarget(null)} className="p-1.5 text-slate-500 hover:text-white"><X size={18} /></button>
              </div>
              <p className="text-slate-500 text-sm mb-5">{pwdTarget.full_name}</p>
              {error && <div className="mb-4 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</div>}
              <div className="space-y-4">
                {pwdTarget.id === currentUser?.id && (
                  <PasswordInput label="Contraseña actual" value={pwdForm.current_password} onChange={e => setPwdForm(f => ({ ...f, current_password: e.target.value }))} placeholder="Tu contraseña actual" />
                )}
                <PasswordInput label="Nueva contraseña" value={pwdForm.new_password} onChange={e => setPwdForm(f => ({ ...f, new_password: e.target.value }))} placeholder="Mínimo 6 caracteres" />
                <PasswordInput label="Confirmar nueva contraseña" value={pwdForm.confirm} onChange={e => setPwdForm(f => ({ ...f, confirm: e.target.value }))} placeholder="Repite la nueva contraseña" />
                <button onClick={handleChangePwd} disabled={saving}
                  className="w-full bg-amber-600 hover:bg-amber-500 text-white font-black py-3 rounded-xl transition-all disabled:opacity-50">
                  {saving ? 'Guardando...' : 'Actualizar contraseña'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: Activity Log
// ═══════════════════════════════════════════════════════════════════════════════
function ActivityLogTab() {
  const [log, setLog]         = useState([]);
  const [count, setCount]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset]   = useState(0);
  const LIMIT = 30;

  const fetch = useCallback(async (off = 0) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/settings/activity-log?limit=${LIMIT}&offset=${off}`);
      setLog(data.data ?? []);
      setCount(data.count ?? 0);
    } catch (_) {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(offset); }, [fetch, offset]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-black text-lg">Registro de actividad</h2>
          <p className="text-slate-500 text-xs mt-0.5">{count} acciones registradas</p>
        </div>
        <button onClick={() => fetch(offset)} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="bg-[#141414] border border-white/5 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-600 text-sm">Cargando...</div>
        ) : log.length === 0 ? (
          <div className="p-12 text-center text-slate-600">
            <Clock size={32} className="mx-auto mb-2 opacity-20" />
            <p className="text-sm">Sin actividad registrada</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {log.map(entry => {
              const action = ACTION_LABELS[entry.action] ?? { label: entry.action, color: 'text-slate-400' };
              return (
                <div key={entry.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/5 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold ${action.color}`}>{action.label}</span>
                      <span className="text-[10px] text-slate-600">·</span>
                      <span className="text-[11px] text-slate-400 truncate">{entry.details}</span>
                    </div>
                    <p className="text-[10px] text-slate-600 mt-0.5">
                      {entry.admins?.full_name ?? '—'} · @{entry.admins?.username}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] text-slate-600">{fmtDate(entry.created_at)}</p>
                    <p className="text-[10px] text-slate-700">{fmtTime(entry.created_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {count > LIMIT && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">{offset + 1}–{Math.min(offset + LIMIT, count)} de {count}</p>
          <div className="flex gap-2">
            <button onClick={() => setOffset(o => Math.max(0, o - LIMIT))} disabled={offset === 0 || loading}
              className="px-3 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-all">
              Anterior
            </button>
            <button onClick={() => setOffset(o => o + LIMIT)} disabled={offset + LIMIT >= count || loading}
              className="px-3 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 transition-all">
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Settings page
// ═══════════════════════════════════════════════════════════════════════════════
export default function Settings() {
  const { user } = useAuth();
  const [tab, setTab] = useState('admins');

  const tabs = [
    { id: 'admins',  label: 'Usuarios',    icon: UserCog,    badge: null },
    { id: 'log',     label: 'Actividad',   icon: Clock,      badge: null },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-black tracking-tight">Configuración</h1>
        <p className="text-slate-500 text-xs mt-0.5">Administración del sistema y parámetros del negocio</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 bg-[#141414] border border-white/5 p-1 rounded-xl overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {tabs.map(t => (
          <TabBtn key={t.id} active={tab === t.id} onClick={() => setTab(t.id)} icon={t.icon} label={t.label} badge={t.badge} />
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          {tab === 'admins' && <AdminsTab currentUser={user} />}
          {tab === 'log'    && <ActivityLogTab />}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}