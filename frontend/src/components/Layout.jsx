// frontend/src/components/Layout.jsx
// ─── ÚNICO CAMBIO vs versión anterior ────────────────────────────────────────
// 1. Importar `canAccess` desde App.jsx
// 2. Filtrar ALL_MENU_ITEMS según el rol del usuario antes de renderizar
// Todo lo demás (UI, animaciones, mobile drawer) permanece igual.
// ─────────────────────────────────────────────────────────────────────────────
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, CreditCard, Package,
  ShoppingCart, LogIn, LogOut, Menu, X, BarChart2,
  ChevronRight, Dumbbell, Settings,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { canAccess } from '../App';          // ← importar el helper
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

// Menú completo — el Layout filtra automáticamente según permisos del rol
const ALL_MENU_ITEMS = [
  { to: '/',             icon: LayoutDashboard, label: 'Dashboard',      color: 'text-green-400'   },
  { to: '/manual-entry', icon: LogIn,           label: 'Ingreso Manual', color: 'text-emerald-400' },
  { to: '/clients',      icon: Users,           label: 'Clientes',       color: 'text-sky-400'     },
  { to: '/memberships',  icon: CreditCard,      label: 'Membresías',     color: 'text-violet-400'  },
  { to: '/inventory',    icon: Package,         label: 'Inventario',     color: 'text-amber-400'   },
  { to: '/pos',          icon: ShoppingCart,    label: 'Ventas (POS)',   color: 'text-orange-400'  },
  { to: '/reports',      icon: BarChart2,       label: 'Reportes',       color: 'text-rose-400'    },
  { to: '/settings',     icon: Settings,        label: 'Configuración',  color: 'text-slate-400'   },
];

const ROLE_LABEL = {
  admin:      { label: 'Administrador', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20'  },
  encargado:  { label: 'Encargado',     color: 'text-green-400 bg-green-500/10 border-green-500/20'  },
  entrenador: { label: 'Entrenador',    color: 'text-blue-400  bg-blue-500/10  border-blue-500/20'   },
};

function SidebarItem({ to, icon: Icon, label, color, active, onClick }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${
        active ? 'bg-white/8 text-white' : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'
      }`}
    >
      {active && (
        <motion.div
          layoutId="activeIndicator"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-green-500 rounded-full"
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        />
      )}
      <div className={`size-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
        active ? `bg-white/8 ${color}` : 'text-slate-600 group-hover:text-slate-400'
      }`}>
        <Icon size={16} />
      </div>
      <span className="text-sm font-medium flex-1 truncate">{label}</span>
      {active && <ChevronRight size={13} className="text-slate-600 flex-shrink-0" />}
    </Link>
  );
}

export const Layout = ({ children }) => {
  const { logout, user } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // ── Filtrar menú según rol ─────────────────────────────────────────────────
  const menuItems = ALL_MENU_ITEMS.filter(item => canAccess(user?.role, item.to));
  const roleCfg   = ROLE_LABEL[user?.role] ?? ROLE_LABEL.encargado;

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const SidebarContent = ({ onItemClick }) => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/5 flex-shrink-0">
        <div className="size-9 bg-green-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-600/30">
          <Dumbbell size={18} className="text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="text-sm font-black tracking-widest text-white uppercase truncate">Xtreme Gym</h1>
          <p className="text-[9px] text-slate-600 uppercase tracking-[.15em] font-bold">Panel</p>
        </div>
      </div>

      {/* Nav — solo ítems permitidos al rol */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5 min-h-0" style={{ scrollbarWidth: 'none' }}>
        {menuItems.map((item, i) => (
          <motion.div
            key={item.to}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <SidebarItem
              {...item}
              active={location.pathname === item.to}
              onClick={onItemClick}
            />
          </motion.div>
        ))}
      </nav>

      {/* Footer con nombre + badge de rol + logout */}
      <div className="flex-shrink-0 border-t border-white/5 p-3">
        <div className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-white/5 transition-colors group">
          <div className="size-8 rounded-lg bg-green-600/20 border border-green-600/25 flex items-center justify-center flex-shrink-0">
            <span className="text-green-400 font-black text-sm">
              {user?.full_name?.[0]?.toUpperCase() ?? '?'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold truncate text-slate-200">{user?.full_name ?? user?.username}</p>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border inline-block mt-0.5 ${roleCfg.color}`}>
              {roleCfg.label}
            </span>
          </div>
          <button
            onClick={logout}
            title="Cerrar sesión"
            className="p-1.5 rounded-lg text-slate-700 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-slate-100 overflow-hidden">

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 flex-col border-r border-white/5 bg-[#111] flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-[#111]/90 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-2.5">
          <div className="size-7 bg-green-600 rounded-lg flex items-center justify-center">
            <Dumbbell size={14} className="text-white" />
          </div>
          <span className="text-sm font-black tracking-widest text-white uppercase">Xtreme Gym</span>
        </div>
        <button
          onClick={() => setMobileOpen(v => !v)}
          className="size-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 transition-all"
        >
          <AnimatePresence mode="wait" initial={false}>
            {mobileOpen
              ? <motion.div key="x"   initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}  transition={{ duration: 0.15 }}><X    size={18}/></motion.div>
              : <motion.div key="men" initial={{ rotate:  90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}><Menu size={18}/></motion.div>
            }
          </AnimatePresence>
        </button>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
            <motion.div
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 340, damping: 32 }}
              className="md:hidden fixed left-0 top-0 bottom-0 z-50 w-64 bg-[#111] border-r border-white/5 flex flex-col shadow-2xl"
            >
              <SidebarContent onItemClick={() => setMobileOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-y-auto min-w-0">
        <div className="md:hidden h-14 flex-shrink-0" />
        <div className="flex-1 p-4 md:p-7 w-full max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};