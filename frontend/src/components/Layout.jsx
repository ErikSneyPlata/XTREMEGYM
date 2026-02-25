import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  CreditCard, 
  Package, 
  ShoppingCart, 
  LogIn, 
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';

const SidebarItem = ({ to, icon: Icon, label, active }) => (
  <Link 
    to={to} 
    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
      active 
        ? 'bg-green-600 text-white shadow-lg shadow-green-600/20' 
        : 'text-slate-400 hover:bg-green-600/10 hover:text-green-500'
    }`}
  >
    <Icon size={20} />
    <span className="font-medium">{label}</span>
  </Link>
);

export const Layout = ({ children }) => {
  const { logout, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const menuItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/manual-entry', icon: LogIn, label: 'Ingreso Manual' },
    { to: '/clients', icon: Users, label: 'Clientes' },
    { to: '/memberships', icon: CreditCard, label: 'Membresías' },
    { to: '/inventory', icon: Package, label: 'Inventario' },
    { to: '/pos', icon: ShoppingCart, label: 'Ventas (POS)' },
  ];

  return (
    <div className="flex h-screen bg-[#0f0f0f] text-slate-100 overflow-hidden">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex w-64 flex-col border-r border-white/5 bg-[#141414]">
        <div className="p-6 flex items-center gap-3">
          <div className="size-10 bg-green-600 rounded-lg flex items-center justify-center text-white">
            <LayoutDashboard size={24} />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-green-500">PowerGym</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">Admin Control</p>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          {menuItems.map((item) => (
            <SidebarItem 
              key={item.to} 
              to={item.to}
              icon={item.icon}
              label={item.label}
              active={location.pathname === item.to} 
            />
          ))}
        </nav>

        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="size-10 rounded-full bg-green-600/20 flex items-center justify-center overflow-hidden border border-green-600/30">
              <span className="text-green-500 font-bold">{user?.username?.[0].toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.full_name}</p>
              <p className="text-[10px] text-slate-500 truncate uppercase">{user?.role}</p>
            </div>
            <button 
              onClick={logout}
              className="text-slate-500 hover:text-red-500 transition-colors"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Menu Button */}
      <div className="md:hidden fixed top-4 right-4 z-50">
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 bg-green-600 rounded-lg text-white"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Sidebar */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-[#0f0f0f] flex flex-col p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="size-10 bg-green-600 rounded-lg flex items-center justify-center text-white">
              <LayoutDashboard size={24} />
            </div>
            <h1 className="text-xl font-bold text-green-500">PowerGym</h1>
          </div>
          <nav className="space-y-4">
            {menuItems.map((item) => (
              <Link 
                key={item.to} 
                to={item.to}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-4 p-4 rounded-xl ${
                  location.pathname === item.to ? 'bg-green-600 text-white' : 'text-slate-400'
                }`}
              >
                <item.icon size={24} />
                <span className="text-lg font-medium">{item.label}</span>
              </Link>
            ))}
            <button 
              onClick={logout}
              className="flex items-center gap-4 p-4 rounded-xl text-red-500 w-full"
            >
              <LogOut size={24} />
              <span className="text-lg font-medium">Cerrar Sesión</span>
            </button>
          </nav>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-y-auto relative">
        <div className="p-4 md:p-8 max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
};
