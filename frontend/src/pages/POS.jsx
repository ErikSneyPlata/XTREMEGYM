import { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  Search, 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  User, 
  CreditCard, 
  Banknote,
  CheckCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function POS() {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, [search]);

  useEffect(() => {
    if (clientSearch.length > 2) {
      handleClientSearch();
    } else {
      setClientResults([]);
    }
  }, [clientSearch]);

  const fetchProducts = async () => {
    try {
      const response = await api.get(`/products?search=${search}`);
      setProducts(response.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleClientSearch = async () => {
    try {
      const response = await api.get(`/clients?search=${clientSearch}`);
      setClientResults(response.data);
    } catch (err) {
      console.error(err);
    }
  };

  const addToCart = (product) => {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      setCart(cart.map(item => 
        item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  };

  const removeFromCart = (id) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const updateQuantity = (id, delta) => {
    setCart(cart.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const total = subtotal - discount;

  const handleCompleteSale = async (method) => {
    if (cart.length === 0) return;
    setLoading(true);
    try {
      await api.post('/sales', {
        user_id: selectedClient?.id,
        items: cart.map(item => ({
          product_id: item.id,
          quantity: item.quantity,
          unit_price: item.price
        })),
        total_amount: total,
        discount,
        payment_method: method
      });
      
      setSuccess(true);
      setCart([]);
      setSelectedClient(null);
      setDiscount(0);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-[calc(100vh-160px)]">
      {/* Products Section */}
      <div className="flex-1 flex flex-col gap-6 min-w-0">
        <div className="flex flex-col gap-4">
          <h1 className="text-3xl font-bold tracking-tight">Ventas (POS)</h1>
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-green-500 transition-colors" size={20} />
            <input 
              type="text"
              placeholder="Escanear o buscar productos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#141414] border border-white/5 rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-green-600 outline-none transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {products.map((product) => (
              <button 
                key={product.id}
                onClick={() => addToCart(product)}
                disabled={product.stock <= 0}
                className="bg-[#141414] border border-white/5 p-4 rounded-2xl text-left hover:border-green-600/50 transition-all group disabled:opacity-50"
              >
                <div className="aspect-square bg-[#0f0f0f] rounded-xl mb-3 flex items-center justify-center relative overflow-hidden">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <ShoppingCart className="text-slate-700" size={40} />
                  )}
                  {product.stock <= product.min_stock && product.stock > 0 && (
                    <span className="absolute top-2 right-2 bg-amber-500 text-white text-[8px] font-bold px-2 py-0.5 rounded-full">BAJO STOCK</span>
                  )}
                  {product.stock <= 0 && (
                    <span className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-xs font-bold">SIN STOCK</span>
                  )}
                </div>
                <h3 className="font-bold text-sm line-clamp-1 group-hover:text-green-500 transition-colors">{product.name}</h3>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-green-500 font-bold">${product.price}</span>
                  <span className="text-[10px] text-slate-500">{product.stock} disp.</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cart Section */}
      <aside className="w-full lg:w-[400px] flex flex-col bg-[#141414] border border-white/5 rounded-3xl overflow-hidden shadow-2xl relative">
        <AnimatePresence>
          {success && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-green-600 flex flex-col items-center justify-center text-white p-8 text-center"
            >
              <CheckCircle size={80} className="mb-4" />
              <h2 className="text-3xl font-bold">Venta Exitosa</h2>
              <p className="mt-2 opacity-90">El inventario ha sido actualizado.</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="p-6 border-b border-white/5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Carrito Actual</h2>
            <button 
              onClick={() => setCart([])}
              className="text-slate-500 hover:text-red-500 transition-colors"
            >
              <Trash2 size={20} />
            </button>
          </div>

          <div className="relative">
            <div className="flex items-center gap-3 bg-[#0f0f0f] p-3 rounded-xl border border-white/5">
              <User className="text-green-500" size={20} />
              <div className="flex-1">
                {selectedClient ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-500">Socio</p>
                      <p className="text-sm font-bold">{selectedClient.full_name}</p>
                    </div>
                    <button onClick={() => setSelectedClient(null)} className="text-red-500 text-xs font-bold">Quitar</button>
                  </div>
                ) : (
                  <input 
                    type="text"
                    placeholder="Asignar socio (opcional)..."
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    className="bg-transparent border-none p-0 text-sm focus:ring-0 w-full placeholder:text-slate-600"
                  />
                )}
              </div>
            </div>

            {clientResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden z-50 shadow-2xl">
                {clientResults.map(client => (
                  <button 
                    key={client.id}
                    onClick={() => {
                      setSelectedClient(client);
                      setClientSearch('');
                      setClientResults([]);
                    }}
                    className="w-full p-3 text-left hover:bg-green-600/10 text-sm border-b border-white/5 last:border-0"
                  >
                    {client.full_name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {cart.map((item) => (
            <div key={item.id} className="flex items-center gap-4 group">
              <div className="size-12 rounded-lg bg-[#0f0f0f] flex-shrink-0 flex items-center justify-center text-slate-700">
                <ShoppingCart size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{item.name}</p>
                <p className="text-xs text-green-500 font-medium">${item.price}</p>
              </div>
              <div className="flex items-center bg-[#0f0f0f] rounded-lg p-1 border border-white/5">
                <button 
                  onClick={() => updateQuantity(item.id, -1)}
                  className="size-6 flex items-center justify-center rounded-md hover:bg-white/5"
                >
                  <Minus size={14} />
                </button>
                <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                <button 
                  onClick={() => updateQuantity(item.id, 1)}
                  className="size-6 flex items-center justify-center rounded-md hover:bg-white/5 text-green-500"
                >
                  <Plus size={14} />
                </button>
              </div>
              <button 
                onClick={() => removeFromCart(item.id)}
                className="text-slate-600 hover:text-red-500 transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {cart.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50">
              <ShoppingCart size={48} className="mb-2" />
              <p>Carrito vacío</p>
            </div>
          )}
        </div>

        <div className="p-6 bg-[#0f0f0f]/50 border-t border-white/5 mt-auto">
          <div className="space-y-3 mb-6">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-bold">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Descuento</span>
              <input 
                type="number"
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
                className="bg-transparent border-none p-0 text-right text-sm focus:ring-0 w-20 text-red-500 font-bold"
              />
            </div>
            <div className="border-t border-dashed border-white/10 pt-3 flex justify-between items-end">
              <span className="text-lg font-bold">Total</span>
              <span className="text-3xl font-black text-green-500">${total.toFixed(2)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <button 
              onClick={() => handleCompleteSale('cash')}
              disabled={loading || cart.length === 0}
              className="flex items-center justify-center gap-2 py-3 rounded-xl border border-white/10 font-bold hover:bg-white/5 transition-all disabled:opacity-50"
            >
              <Banknote size={18} />
              Efectivo
            </button>
            <button 
              onClick={() => handleCompleteSale('card')}
              disabled={loading || cart.length === 0}
              className="flex items-center justify-center gap-2 py-3 rounded-xl border border-green-600/30 bg-green-600/10 text-green-500 font-bold hover:bg-green-600/20 transition-all disabled:opacity-50"
            >
              <CreditCard size={18} />
              Tarjeta
            </button>
          </div>

          <button 
            onClick={() => handleCompleteSale('cash')}
            disabled={loading || cart.length === 0}
            className="w-full bg-green-600 hover:bg-green-500 text-white py-4 rounded-2xl font-black text-lg shadow-lg shadow-green-600/20 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            Completar Venta
          </button>
        </div>
      </aside>
    </div>
  );
}
