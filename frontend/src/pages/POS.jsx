import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import {
  Search, ShoppingCart, Trash2, Plus, Minus, User,
  CreditCard, Banknote, CheckCircle, Clock, ChevronDown,
  ChevronUp, Tag, X, ArrowRightLeft, Package,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// ─── helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) => Number(n ?? 0).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const PAY = [
  { method: 'cash',     label: 'Efectivo',      Icon: Banknote,       cls: 'border-white/10 hover:bg-white/5 data-[active]:bg-white/10 data-[active]:border-white/30 text-slate-300' },
  { method: 'card',     label: 'Tarjeta',       Icon: CreditCard,     cls: 'border-green-600/40 bg-green-600/10 text-green-400 hover:bg-green-600/20 data-[active]:ring-2 data-[active]:ring-green-500' },
  { method: 'transfer', label: 'Transferencia', Icon: ArrowRightLeft, cls: 'border-blue-600/40 bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 data-[active]:ring-2 data-[active]:ring-blue-500' },
];

const payLabel = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia' };

// ─── SaleHistoryRow ───────────────────────────────────────────────────────────
function SaleHistoryRow({ sale }) {
  const [open, setOpen] = useState(false);
  const P = PAY.find(p => p.method === sale.payment_method) ?? PAY[0];

  return (
    <div className="border border-white/5 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
      >
        <div className="size-8 rounded-lg bg-green-600/10 flex items-center justify-center text-green-500 flex-shrink-0">
          <P.Icon size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate">{sale.users?.full_name ?? 'Cliente general'}</p>
          <p className="text-[10px] text-slate-500">
            {new Date(sale.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
            {' · '}{payLabel[sale.payment_method] ?? sale.payment_method}
          </p>
        </div>
        <span className="text-green-400 font-black text-sm mr-1">${fmt(sale.total_amount)}</span>
        {open ? <ChevronUp size={13} className="text-slate-600 flex-shrink-0" /> : <ChevronDown size={13} className="text-slate-600 flex-shrink-0" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 pt-3 space-y-1.5 border-t border-white/5">
              {(sale.sale_details ?? []).map((d, i) => (
                <div key={i} className="flex justify-between text-xs text-slate-400">
                  <span className="truncate">{d.products?.name ?? 'Producto'} × {d.quantity}</span>
                  <span className="text-slate-300 font-medium ml-2">${fmt(d.subtotal)}</span>
                </div>
              ))}
              {sale.discount > 0 && (
                <div className="flex justify-between text-xs text-red-400 pt-1 border-t border-white/5">
                  <span>Descuento</span><span>-${fmt(sale.discount)}</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── CartDrawer ───────────────────────────────────────────────────────────────
function CartDrawer({
  open, onClose,
  cart, onRemove, onUpdateQty,
  discount, onDiscountChange,
  subtotal, total,
  selectedClient, clientSearch, onClientSearch, clientResults,
  onSelectClient, onClearClient,
  // FIX: payMethod + onPayMethod para que el método seleccionado se propague al cobro
  payMethod, onPayMethod,
  onCompleteSale, loading, saleError, success,
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 32 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-sm flex flex-col bg-[#111] border-l border-white/8 shadow-2xl"
          >
            {/* Success overlay */}
            <AnimatePresence>
              {success && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 z-50 bg-green-600 flex flex-col items-center justify-center text-white p-8 text-center"
                >
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }}>
                    <CheckCircle size={72} className="mb-5" />
                  </motion.div>
                  <h2 className="text-3xl font-black">¡Venta Exitosa!</h2>
                  <p className="mt-2 text-green-100 text-sm">Inventario actualizado</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <ShoppingCart size={20} className="text-slate-300" />
                  {cart.length > 0 && (
                    <span className="absolute -top-2 -right-2 size-4 rounded-full bg-green-500 text-white text-[9px] font-black flex items-center justify-center">
                      {cart.reduce((s, i) => s + i.quantity, 0)}
                    </span>
                  )}
                </div>
                <h2 className="font-black text-base">Carrito</h2>
              </div>
              <div className="flex items-center gap-2">
                {cart.length > 0 && (
                  <button
                    onClick={() => onRemove('__clear__')}
                    className="text-xs text-slate-500 hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-red-500/10"
                  >
                    Vaciar
                  </button>
                )}
                <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-all">
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Client */}
            <div className="px-5 py-3 border-b border-white/5 flex-shrink-0">
              <div className="relative">
                <div className="flex items-center gap-2.5 bg-[#1a1a1a] border border-white/5 rounded-xl px-3 py-2.5">
                  <User size={15} className="text-green-500 flex-shrink-0" />
                  {selectedClient ? (
                    <div className="flex-1 flex items-center justify-between gap-2 min-w-0">
                      <div className="min-w-0">
                        <p className="text-[10px] text-slate-500 leading-none mb-0.5">Socio</p>
                        <p className="text-sm font-bold truncate">{selectedClient.full_name}</p>
                      </div>
                      <button onClick={onClearClient} className="text-slate-600 hover:text-red-400 flex-shrink-0 transition-colors">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <input
                      type="text"
                      placeholder="Buscar socio (opcional)..."
                      value={clientSearch}
                      onChange={e => onClientSearch(e.target.value)}
                      className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-600"
                    />
                  )}
                </div>
                {clientResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#1e1e1e] border border-white/10 rounded-xl overflow-hidden z-50 shadow-2xl">
                    {clientResults.map(c => (
                      <button
                        key={c.id}
                        onClick={() => onSelectClient(c)}
                        className="w-full px-4 py-2.5 text-left hover:bg-green-600/10 text-sm border-b border-white/5 last:border-0 transition-colors"
                      >
                        <span className="font-medium">{c.full_name}</span>
                        {c.phone && <span className="text-slate-500 ml-2 text-xs">{c.phone}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto py-3 px-5 space-y-2 min-h-0">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-700 py-16">
                  <ShoppingCart size={40} strokeWidth={1.5} />
                  <p className="text-sm">Selecciona productos</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#1a1a1a] border border-white/5 group">
                    <div className="size-10 rounded-lg bg-white/5 flex-shrink-0 flex items-center justify-center text-slate-600">
                      <Package size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate leading-tight">{item.name}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        ${fmt(item.price)} c/u
                        <span className="text-green-400 ml-2 font-bold">${fmt(item.price * item.quantity)}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1 bg-black/40 rounded-lg border border-white/5 p-0.5 flex-shrink-0">
                      <button
                        onClick={() => onUpdateQty(item.id, -1)}
                        className="size-6 flex items-center justify-center rounded-md hover:bg-white/10 text-slate-400 transition-colors"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="w-6 text-center text-sm font-black text-slate-200">{item.quantity}</span>
                      <button
                        onClick={() => onUpdateQty(item.id, 1)}
                        disabled={item.quantity >= item.stock}
                        className="size-6 flex items-center justify-center rounded-md hover:bg-white/10 text-green-400 disabled:opacity-20 transition-colors"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                    <button
                      onClick={() => onRemove(item.id)}
                      className="text-slate-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Totals + payment */}
            <div className="border-t border-white/5 bg-[#0d0d0d] px-5 py-5 space-y-4 flex-shrink-0">
              {saleError && (
                <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                  {saleError}
                </div>
              )}

              {/* Subtotal / descuento / total */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-slate-400">
                  <span>Subtotal</span>
                  <span className="font-bold text-slate-200">${fmt(subtotal)}</span>
                </div>
                <div className="flex justify-between items-center text-sm text-slate-400">
                  <span className="flex items-center gap-1.5"><Tag size={11} />Descuento</span>
                  <input
                    type="number" min="0" max={subtotal} value={discount}
                    onChange={e => onDiscountChange(Math.max(0, Number(e.target.value)))}
                    className="bg-transparent text-right w-16 text-red-400 font-bold outline-none text-sm"
                  />
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-dashed border-white/10">
                  <span className="font-bold text-base">Total</span>
                  <span className="text-2xl font-black text-green-400">${fmt(total)}</span>
                </div>
              </div>

              {/* FIX: método de pago — selección visual independiente del botón cobrar */}
              <div>
                <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest mb-2">Método de pago</p>
                <div className="grid grid-cols-3 gap-2">
                  {PAY.map(({ method, label, Icon, cls }) => (
                    <button
                      key={method}
                      data-active={payMethod === method ? '' : undefined}
                      onClick={() => onPayMethod(method)}
                      className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-bold transition-all ${cls} ${
                        payMethod === method ? 'ring-2 ring-offset-1 ring-offset-[#0d0d0d] ring-green-500' : ''
                      }`}
                    >
                      <Icon size={16} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Botón cobrar — ahora usa payMethod, no hardcodea 'cash' */}
              <button
                onClick={() => onCompleteSale(payMethod)}
                disabled={loading || cart.length === 0}
                className="w-full bg-green-600 hover:bg-green-500 text-white py-3.5 rounded-xl font-black text-base shadow-lg shadow-green-600/20 transition-all active:scale-[0.98] disabled:opacity-40"
              >
                {loading
                  ? 'Procesando...'
                  : `Cobrar $${fmt(total)} · ${payLabel[payMethod]}`}
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Main POS ─────────────────────────────────────────────────────────────────
export default function POS() {
  const [products, setProducts]   = useState([]);
  const [search, setSearch]       = useState('');
  const [cart, setCart]           = useState([]);
  const [discount, setDiscount]   = useState(0);
  const [cartOpen, setCartOpen]   = useState(false);
  const [activeCat, setActiveCat] = useState('Todos');
  // FIX: estado del método de pago seleccionado (antes siempre era 'cash')
  const [payMethod, setPayMethod] = useState('cash');

  const [selectedClient, setSelectedClient] = useState(null);
  const [clientSearch, setClientSearch]     = useState('');
  const [clientResults, setClientResults]   = useState([]);

  const [loading, setLoading]     = useState(false);
  const [saleError, setSaleError] = useState(null);
  const [success, setSuccess]     = useState(false);

  const [todaySales, setTodaySales]   = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  // ── fetchers ──────────────────────────────────────────────────────────
  const fetchProducts = useCallback(async () => {
    try {
      const { data } = await api.get(`/products?search=${encodeURIComponent(search)}`);
      setProducts(data ?? []);
    } catch (err) { console.error(err); }
  }, [search]);

  const fetchTodaySales = async () => {
    try {
      const { data } = await api.get('/sales/today');
      setTodaySales(data ?? []);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { const t = setTimeout(fetchProducts, 300); return () => clearTimeout(t); }, [fetchProducts]);
  useEffect(() => { fetchTodaySales(); }, []);

  // FIX: búsqueda de clientes — el backend ahora siempre devuelve { data, count }
  // Antes: setClientResults(data) donde data era el objeto completo { data, count }
  // Ahora: extraemos data.data para obtener el array de clientes
  useEffect(() => {
    if (clientSearch.length < 2) { setClientResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const { data: response } = await api.get(`/clients?search=${encodeURIComponent(clientSearch)}&limit=8`);
        // El backend siempre responde { data: [...], count: N }
        setClientResults(response.data ?? []);
      } catch (_) {}
    }, 300);
    return () => clearTimeout(t);
  }, [clientSearch]);

  // ── cart ──────────────────────────────────────────────────────────────
  const addToCart = (product) => {
    if (product.stock <= 0) return;
    setCart(prev => {
      const ex = prev.find(i => i.id === product.id);
      if (ex) {
        if (ex.quantity >= product.stock) return prev;
        return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setCartOpen(true);
  };

  const handleRemove = (id) => {
    if (id === '__clear__') { setCart([]); return; }
    setCart(prev => prev.filter(i => i.id !== id));
  };

  const handleUpdateQty = (id, delta) =>
    setCart(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        const q = item.quantity + delta;
        if (q < 1) return null;
        if (q > item.stock) return item;
        return { ...item, quantity: q };
      }).filter(Boolean)
    );

  const subtotal  = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const total     = Math.max(0, subtotal - discount);
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  // ── sale ──────────────────────────────────────────────────────────────
  const handleCompleteSale = async (method) => {
    if (!cart.length || loading) return;
    setSaleError(null);
    setLoading(true);
    try {
      await api.post('/sales', {
        user_id: selectedClient?.id ?? null,
        items: cart.map(i => ({ product_id: i.id, quantity: i.quantity, unit_price: i.price })),
        total_amount: total, discount, payment_method: method,
      });
      setCart([]); setSelectedClient(null); setClientSearch(''); setDiscount(0); setPayMethod('cash');
      await fetchProducts(); await fetchTodaySales();
      setSuccess(true);
      setTimeout(() => { setSuccess(false); setCartOpen(false); }, 2500);
    } catch (err) {
      setSaleError(err.response?.data?.error || 'Error al registrar la venta.');
    } finally { setLoading(false); }
  };

  // ── category filter ───────────────────────────────────────────────────
  const categories = ['Todos', ...new Set(products.map(p => p.category).filter(Boolean))];
  const visible = activeCat === 'Todos' ? products : products.filter(p => p.category === activeCat);

  // ── render ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100vh-160px)] min-h-0">

      {/* Top bar */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0 gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-black tracking-tight truncate">Punto de Venta</h1>
          <p className="text-slate-500 text-xs mt-0.5">{products.length} productos · {todaySales.length} ventas hoy</p>
        </div>
        <button
          onClick={() => setCartOpen(true)}
          className="relative flex items-center gap-2 sm:gap-2.5 bg-green-600 hover:bg-green-500 text-white font-black px-3 sm:px-5 py-2.5 rounded-xl shadow-lg shadow-green-600/25 transition-all active:scale-95 flex-shrink-0"
        >
          <ShoppingCart size={17} />
          <span className="text-sm hidden sm:inline">Carrito</span>
          {cartCount > 0 && (
            <>
              <motion.span key={cartCount} initial={{ scale: 1.5 }} animate={{ scale: 1 }}
                className="bg-white text-green-700 text-[10px] font-black size-5 rounded-full flex items-center justify-center"
              >
                {cartCount}
              </motion.span>
              <span className="text-green-200 text-sm hidden sm:inline">${fmt(total)}</span>
            </>
          )}
        </button>
      </div>

      {/* Search */}
      <div className="relative group mb-3 flex-shrink-0">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-green-500 transition-colors" size={17} />
        <input
          type="text" placeholder="Buscar producto..."
          value={search} onChange={e => { setSearch(e.target.value); setActiveCat('Todos'); }}
          className="w-full bg-[#141414] border border-white/5 rounded-xl py-2.5 sm:py-3 pl-11 pr-10 text-sm focus:ring-2 focus:ring-green-600 outline-none transition-all"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-white transition-colors">
            <X size={15} />
          </button>
        )}
      </div>

      {/* Category pills */}
      {categories.length > 1 && (
        <div className="flex gap-2 mb-4 overflow-x-auto flex-shrink-0 pb-1" style={{ scrollbarWidth: 'none' }}>
          {categories.map(cat => (
            <button key={cat} onClick={() => setActiveCat(cat)}
              className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all border flex-shrink-0 ${
                activeCat === cat
                  ? 'bg-green-600 border-green-600 text-white shadow-md shadow-green-600/20'
                  : 'bg-[#141414] border-white/5 text-slate-400 hover:border-white/15 hover:text-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Product grid — responsive: 2 cols en móvil hasta 6 en xl */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-700 gap-3">
            <Package size={36} strokeWidth={1.5} />
            <p className="text-sm">Sin productos</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 pb-4 pr-1">
            {visible.map(product => {
              const inCart = cart.find(i => i.id === product.id);
              return (
                <motion.button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  disabled={product.stock <= 0}
                  whileTap={{ scale: 0.95 }}
                  className={`relative flex flex-col bg-[#141414] border rounded-2xl p-3 sm:p-3.5 text-left transition-all group disabled:opacity-40 disabled:cursor-not-allowed ${
                    inCart ? 'border-green-600/50 shadow-md shadow-green-600/10 bg-green-600/5' : 'border-white/5 hover:border-white/15'
                  }`}
                >
                  {inCart && (
                    <div className="absolute top-2 right-2 size-5 rounded-full bg-green-500 flex items-center justify-center z-10">
                      <span className="text-[9px] font-black text-white">{inCart.quantity}</span>
                    </div>
                  )}
                  <div className="aspect-square bg-[#0f0f0f] rounded-xl mb-2.5 flex items-center justify-center relative overflow-hidden w-full">
                    {product.image_url
                      ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                      : <Package className="text-slate-700 group-hover:text-slate-600 transition-colors" size={24} strokeWidth={1.5} />
                    }
                    {product.stock > 0 && product.stock <= product.min_stock && (
                      <span className="absolute bottom-1.5 left-1.5 bg-amber-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full">BAJO</span>
                    )}
                    {product.stock <= 0 && (
                      <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                        <span className="text-white text-[9px] font-black tracking-wider">SIN STOCK</span>
                      </div>
                    )}
                  </div>
                  <p className="font-bold text-xs leading-tight line-clamp-2 mb-2 flex-1">{product.name}</p>
                  <div className="flex items-center justify-between mt-auto gap-1">
                    <span className={`font-black text-sm ${inCart ? 'text-green-400' : 'text-green-500'}`}>${fmt(product.price)}</span>
                    <span className="text-[10px] text-slate-600 truncate">{product.stock} disp.</span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>

      {/* History */}
      <div className="mt-3 bg-[#141414] border border-white/5 rounded-2xl overflow-hidden flex-shrink-0">
        <button onClick={() => setHistoryOpen(v => !v)}
          className="w-full flex items-center justify-between px-5 py-3 hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Clock className="text-green-500" size={15} />
            <span className="font-bold text-sm">Ventas del día</span>
            <span className="text-[10px] bg-green-600/15 text-green-400 font-bold px-2 py-0.5 rounded-full border border-green-600/25">
              {todaySales.length}
            </span>
          </div>
          {historyOpen ? <ChevronUp size={14} className="text-slate-600" /> : <ChevronDown size={14} className="text-slate-600" />}
        </button>
        <AnimatePresence>
          {historyOpen && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
              <div className="px-4 pb-4 pt-3 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                {todaySales.length === 0
                  ? <p className="text-slate-600 text-sm text-center py-4 col-span-3">Sin ventas hoy todavía.</p>
                  : todaySales.map(sale => <SaleHistoryRow key={sale.id} sale={sale} />)
                }
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Cart Drawer */}
      <CartDrawer
        open={cartOpen} onClose={() => setCartOpen(false)}
        cart={cart} onRemove={handleRemove} onUpdateQty={handleUpdateQty}
        discount={discount} onDiscountChange={setDiscount}
        subtotal={subtotal} total={total}
        selectedClient={selectedClient}
        clientSearch={clientSearch} onClientSearch={setClientSearch}
        clientResults={clientResults}
        onSelectClient={(c) => { setSelectedClient(c); setClientSearch(''); setClientResults([]); }}
        onClearClient={() => { setSelectedClient(null); setClientSearch(''); }}
        payMethod={payMethod} onPayMethod={setPayMethod}
        onCompleteSale={handleCompleteSale}
        loading={loading} saleError={saleError} success={success}
      />
    </div>
  );
}