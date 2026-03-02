// frontend/src/pages/Inventory.jsx
import { useState, useEffect } from 'react';
import api from '../services/api';
import {
  Package, Plus, Search, AlertTriangle, Pencil,
  Trash2, X, TrendingDown, Boxes, BadgeDollarSign,
  ChevronUp, ChevronDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const fmt = (n) =>
  `$${Number(n ?? 0).toLocaleString('es-CO', { minimumFractionDigits: 0 })}`;

const EMPTY_FORM = { name: '', category: '', stock: '', min_stock: '', price: '' };

const CATEGORIES = [
  'Suplementos', 'Bebidas', 'Accesorios', 'Ropa', 'Equipamiento', 'Otros',
];

function StatCard({ label, value, icon: Icon, colorClass, sub }) {
  return (
    <div className="bg-[#141414] border border-white/5 rounded-2xl px-4 sm:px-5 py-4 flex items-center gap-4">
      <div className={`size-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colorClass}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">{label}</p>
        <p className="text-xl font-black">{value}</p>
        {sub && <p className="text-[10px] text-slate-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── ProductCard — vista móvil ─────────────────────────────────────────────────
function ProductCard({ product, onEdit, onDelete, deleteTarget, deleting }) {
  const isLow       = product.stock <= product.min_stock;
  const isDeleting  = deleteTarget?.id === product.id;
  const stockPct    = Math.min(100, (product.stock / Math.max(product.min_stock * 2, 10)) * 100);

  return (
    <div className={`bg-[#141414] border rounded-2xl p-4 transition-colors ${isDeleting ? 'border-red-500/30 bg-red-500/5' : 'border-white/5'}`}>
      <div className="flex items-start gap-3">
        <div className={`size-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isLow ? 'bg-red-500/10 text-red-400' : 'bg-green-600/10 text-green-500'}`}>
          <Package size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-bold text-sm truncate">{product.name}</p>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-wide inline-block mt-0.5">
                {product.category || 'General'}
              </span>
            </div>
            <p className="font-black text-green-400 text-sm flex-shrink-0">{fmt(product.price)}</p>
          </div>

          <div className="mt-2.5 flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className={`font-bold text-sm ${isLow ? 'text-red-400' : 'text-slate-200'}`}>{product.stock}</span>
                <span className="text-[10px] text-slate-600">/ mín {product.min_stock}</span>
                {isLow && <span className="text-[9px] font-black text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-full">BAJO</span>}
              </div>
              <div className="w-20 h-1 bg-white/5 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${isLow ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${stockPct}%` }} />
              </div>
            </div>

            {!isDeleting ? (
              <div className="flex items-center gap-1">
                <button onClick={() => onEdit(product)}
                  className="p-2 rounded-lg text-slate-600 hover:text-blue-400 hover:bg-blue-500/10 transition-all">
                  <Pencil size={14} />
                </button>
                <button onClick={() => onDelete(product)}
                  className="p-2 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all">
                  <Trash2 size={14} />
                </button>
              </div>
            ) : (
              <AnimatePresence>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex items-center gap-2">
                  <span className="text-[10px] text-red-400 font-medium">¿Eliminar?</span>
                  <button onClick={() => onDelete(null)} disabled={deleting}
                    className="text-[10px] text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-white/5 transition-all">No</button>
                  <button onClick={() => onDelete(product, true)} disabled={deleting}
                    className="text-[10px] font-bold text-white bg-red-600 hover:bg-red-500 px-2.5 py-1 rounded-lg transition-all disabled:opacity-50">
                    {deleting ? '...' : 'Sí'}
                  </button>
                </motion.div>
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Inventory() {
  const [products, setProducts]     = useState([]);
  const [search, setSearch]         = useState('');
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [sortField, setSortField]   = useState('name');
  const [sortAsc, setSortAsc]       = useState(true);
  const [filterLow, setFilterLow]   = useState(false);

  const [modalMode, setModalMode]           = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm]                     = useState(EMPTY_FORM);
  const [formError, setFormError]           = useState('');
  const [submitting, setSubmitting]         = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting]         = useState(false);

  useEffect(() => {
    const t = setTimeout(fetchProducts, 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchProducts = async () => {
    try {
      setLoading(true); setError(null);
      const { data } = await api.get(`/products?search=${encodeURIComponent(search)}`);
      setProducts(data ?? []);
    } catch {
      setError('No se pudieron cargar los productos.');
    } finally {
      setLoading(false);
    }
  };

  const displayed = [...products]
    .filter(p => !filterLow || p.stock <= p.min_stock)
    .sort((a, b) => {
      const va = ['price', 'stock'].includes(sortField) ? Number(a[sortField]) : String(a[sortField] ?? '').toLowerCase();
      const vb = ['price', 'stock'].includes(sortField) ? Number(b[sortField]) : String(b[sortField] ?? '').toLowerCase();
      return sortAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });

  const toggleSort = (field) => {
    if (sortField === field) setSortAsc(v => !v);
    else { setSortField(field); setSortAsc(true); }
  };

  const openCreate = () => { setForm(EMPTY_FORM); setEditingProduct(null); setFormError(''); setModalMode('create'); };
  const openEdit   = (p) => {
    setForm({ name: p.name, category: p.category ?? '', stock: p.stock, min_stock: p.min_stock, price: p.price });
    setEditingProduct(p); setFormError(''); setModalMode('edit');
  };
  const closeModal = () => { setModalMode(null); setEditingProduct(null); setForm(EMPTY_FORM); setFormError(''); };

  const handleSubmit = async (e) => {
    e.preventDefault(); setFormError('');
    if (!form.name.trim()) return setFormError('El nombre es obligatorio.');
    if (Number(form.price) < 0) return setFormError('El precio no puede ser negativo.');
    if (Number(form.stock) < 0) return setFormError('El stock no puede ser negativo.');
    setSubmitting(true);
    const payload = {
      name: form.name.trim(), category: form.category.trim(),
      stock: Number(form.stock), min_stock: Number(form.min_stock), price: Number(form.price),
    };
    try {
      if (modalMode === 'create') {
        const { data } = await api.post('/products', payload);
        setProducts(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        const { data } = await api.put(`/products/${editingProduct.id}`, payload);
        setProducts(prev => prev.map(p => p.id === editingProduct.id ? data : p));
      }
      closeModal();
    } catch (err) {
      setFormError(err.response?.data?.error ?? 'Error al guardar el producto.');
    } finally { setSubmitting(false); }
  };

  // Unificado: deleteTarget(null) = cancelar, deleteTarget(product, true) = confirmar
  const handleDeleteClick = async (product, confirm = false) => {
    if (!confirm) { setDeleteTarget(product); return; }
    setDeleting(true);
    try {
      await api.delete(`/products/${deleteTarget.id}`);
      setProducts(prev => prev.filter(p => p.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      alert(err.response?.data?.error ?? 'No se pudo eliminar el producto.');
    } finally { setDeleting(false); }
  };

  const totalValue    = products.reduce((s, p) => s + Number(p.price) * Number(p.stock), 0);
  const lowStockCount = products.filter(p => p.stock <= p.min_stock).length;

  const SortIcon = ({ field }) =>
    sortField === field
      ? (sortAsc ? <ChevronUp size={12} className="text-green-400" /> : <ChevronDown size={12} className="text-green-400" />)
      : <ChevronUp size={12} className="text-slate-700" />;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-6xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight">Inventario</h1>
          <p className="text-slate-500 text-xs mt-0.5">Control de stock y productos</p>
        </div>
        <button onClick={openCreate}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-green-600/20 transition-all active:scale-95">
          <Plus size={16} /> Nuevo producto
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <StatCard label="Total SKUs"     value={products.length}  icon={Boxes}           colorClass="bg-green-500/10 text-green-400" />
        <StatCard label="Valor en stock" value={fmt(totalValue)}  icon={BadgeDollarSign} colorClass="bg-blue-500/10 text-blue-400" sub={`${products.length} productos`} />
        <StatCard
          label="Stock bajo" value={lowStockCount} icon={TrendingDown}
          colorClass={lowStockCount > 0 ? 'bg-red-500/10 text-red-400' : 'bg-slate-500/10 text-slate-500'}
          sub={lowStockCount > 0 ? 'requieren reposición' : 'todo en orden'}
        />
      </div>

      {/* Search + filter */}
      <div className="flex gap-2 sm:gap-3">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-green-500 transition-colors" size={17} />
          <input type="text" placeholder="Buscar por nombre..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-[#141414] border border-white/5 rounded-xl py-2.5 pl-11 pr-4 text-sm focus:ring-2 focus:ring-green-600 outline-none transition-all" />
        </div>
        <button onClick={() => setFilterLow(v => !v)}
          className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 rounded-xl border text-xs sm:text-sm font-bold transition-all flex-shrink-0 ${
            filterLow ? 'bg-red-500/15 border-red-500/30 text-red-400' : 'bg-[#141414] border-white/5 text-slate-500 hover:border-white/15'
          }`}>
          <AlertTriangle size={14} />
          <span className="hidden sm:inline">{filterLow ? 'Ver todos' : 'Stock bajo'}</span>
          <span className="sm:hidden">{filterLow ? 'Todos' : 'Bajo'}</span>
        </button>
      </div>

      {error && <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</div>}

      {/* ─── Tabla desktop (sm+) ─────────────────────────────────────────────── */}
      <div className="hidden sm:block bg-[#141414] border border-white/5 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/5 text-[10px] text-slate-500 uppercase tracking-wider">
                <th className="px-5 py-3.5 font-bold">
                  <button onClick={() => toggleSort('name')} className="flex items-center gap-1 hover:text-white transition-colors">Producto <SortIcon field="name" /></button>
                </th>
                <th className="px-5 py-3.5 font-bold">Categoría</th>
                <th className="px-5 py-3.5 font-bold">
                  <button onClick={() => toggleSort('stock')} className="flex items-center gap-1 hover:text-white transition-colors">Stock <SortIcon field="stock" /></button>
                </th>
                <th className="px-5 py-3.5 font-bold">
                  <button onClick={() => toggleSort('price')} className="flex items-center gap-1 hover:text-white transition-colors">Precio <SortIcon field="price" /></button>
                </th>
                <th className="px-5 py-3.5 font-bold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}><td colSpan={5} className="px-5 py-3"><div className="h-8 bg-white/5 rounded-lg animate-pulse" /></td></tr>
                ))
              ) : displayed.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-14 text-center text-slate-600">
                  <Package size={32} className="mx-auto mb-2 opacity-20" />
                  <p className="text-sm">{filterLow ? 'No hay productos con stock bajo' : 'No se encontraron productos'}</p>
                </td></tr>
              ) : (
                displayed.map(product => {
                  const isLow      = product.stock <= product.min_stock;
                  const isDeleting = deleteTarget?.id === product.id;
                  const stockPct   = Math.min(100, (product.stock / Math.max(product.min_stock * 2, 10)) * 100);
                  return (
                    <motion.tr key={product.id} layout
                      className={`transition-colors group ${isDeleting ? 'bg-red-500/5' : 'hover:bg-white/5'}`}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={`size-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isLow ? 'bg-red-500/10 text-red-400' : 'bg-green-600/10 text-green-500'}`}>
                            <Package size={16} />
                          </div>
                          <div>
                            <p className="font-bold text-sm">{product.name}</p>
                            <p className="text-[10px] text-slate-600 font-mono">#{String(product.id).split('-')[0].toUpperCase()}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-wide">
                          {product.category || 'General'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`font-bold text-sm ${isLow ? 'text-red-400' : 'text-slate-200'}`}>{product.stock}</span>
                            <span className="text-[10px] text-slate-600">/ mín {product.min_stock}</span>
                            {isLow && <span className="text-[9px] font-black text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-full">BAJO</span>}
                          </div>
                          <div className="w-20 h-1 bg-white/5 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${isLow ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${stockPct}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-black text-green-400 text-sm">{fmt(product.price)}</td>
                      <td className="px-5 py-3.5">
                        {!isDeleting ? (
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEdit(product)}
                              className="p-1.5 rounded-lg text-slate-600 hover:text-blue-400 hover:bg-blue-500/10 transition-all">
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => setDeleteTarget(product)}
                              className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ) : (
                          <AnimatePresence>
                            <motion.div initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
                              className="flex items-center justify-end gap-2">
                              <span className="text-[10px] text-red-400 font-medium whitespace-nowrap">¿Eliminar?</span>
                              <button onClick={() => setDeleteTarget(null)} disabled={deleting}
                                className="text-[10px] text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-white/5 transition-all">No</button>
                              <button onClick={async () => {
                                setDeleting(true);
                                try {
                                  await api.delete(`/products/${deleteTarget.id}`);
                                  setProducts(prev => prev.filter(p => p.id !== deleteTarget.id));
                                  setDeleteTarget(null);
                                } catch (err) {
                                  alert(err.response?.data?.error ?? 'No se pudo eliminar.');
                                } finally { setDeleting(false); }
                              }} disabled={deleting}
                                className="text-[10px] font-bold text-white bg-red-600 hover:bg-red-500 px-2.5 py-1 rounded-lg transition-all disabled:opacity-50">
                                {deleting ? '...' : 'Sí'}
                              </button>
                            </motion.div>
                          </AnimatePresence>
                        )}
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {!loading && displayed.length > 0 && (
          <div className="px-5 py-3 border-t border-white/5 flex items-center justify-between">
            <p className="text-[10px] text-slate-600">
              {displayed.length} de {products.length} productos
              {filterLow && <span className="text-red-400 font-bold ml-1">· filtro stock bajo</span>}
            </p>
            <p className="text-[10px] text-slate-600">
              Valor visible: <span className="text-slate-400 font-bold">{fmt(displayed.reduce((s, p) => s + Number(p.price) * Number(p.stock), 0))}</span>
            </p>
          </div>
        )}
      </div>

      {/* ─── Cards móvil (< sm) ───────────────────────────────────────────────── */}
      <div className="sm:hidden space-y-3">
        {loading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-[#141414] border border-white/5 rounded-2xl animate-pulse" />
          ))
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-600">
            <Package size={32} className="mb-2 opacity-20" />
            <p className="text-sm">{filterLow ? 'No hay productos con stock bajo' : 'No se encontraron productos'}</p>
          </div>
        ) : (
          displayed.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              onEdit={openEdit}
              onDelete={handleDeleteClick}
              deleteTarget={deleteTarget}
              deleting={deleting}
            />
          ))
        )}
        {!loading && displayed.length > 0 && (
          <p className="text-[10px] text-slate-600 text-center py-1">
            {displayed.length} de {products.length} productos
          </p>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {modalMode && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={closeModal} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="relative bg-[#1a1a1a] border border-white/10 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 sm:p-7 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-black">{modalMode === 'create' ? 'Nuevo producto' : 'Editar producto'}</h3>
                  {editingProduct && <p className="text-slate-500 text-xs mt-0.5">{editingProduct.name}</p>}
                </div>
                <button onClick={closeModal} className="p-1.5 text-slate-500 hover:text-white"><X size={18} /></button>
              </div>

              {formError && (
                <div className="mb-4 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{formError}</div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Nombre *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Ej: Proteína Whey 1kg" required
                    className="w-full bg-[#0f0f0f] border border-white/5 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-green-600 outline-none transition-all" />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Categoría</label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {CATEGORIES.map(cat => (
                      <button key={cat} type="button" onClick={() => setForm(f => ({ ...f, category: cat }))}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all ${
                          form.category === cat
                            ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                            : 'bg-white/5 border-white/5 text-slate-500 hover:border-white/15'
                        }`}>{cat}
                      </button>
                    ))}
                  </div>
                  <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    placeholder="O escribe una categoría personalizada"
                    className="w-full bg-[#0f0f0f] border border-white/5 rounded-xl px-3.5 py-2 text-xs focus:ring-2 focus:ring-green-600 outline-none transition-all text-slate-400" />
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Stock actual *</label>
                    <input type="number" min="0" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
                      placeholder="0" required
                      className="w-full bg-[#0f0f0f] border border-white/5 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-green-600 outline-none transition-all" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Stock mínimo</label>
                    <input type="number" min="0" value={form.min_stock} onChange={e => setForm(f => ({ ...f, min_stock: e.target.value }))}
                      placeholder="0"
                      className="w-full bg-[#0f0f0f] border border-white/5 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-green-600 outline-none transition-all" />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">Precio *</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-bold">$</span>
                    <input type="number" min="0" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                      placeholder="0" required
                      className="w-full bg-[#0f0f0f] border border-white/5 rounded-xl pl-7 pr-3.5 py-2.5 text-sm focus:ring-2 focus:ring-green-600 outline-none transition-all" />
                  </div>
                  {form.price > 0 && <p className="text-[10px] text-slate-600 mt-1">{fmt(form.price)}</p>}
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={closeModal}
                    className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-bold text-slate-400 transition-all">
                    Cancelar
                  </button>
                  <button type="submit" disabled={submitting}
                    className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white font-black text-sm transition-all disabled:opacity-50 shadow-lg shadow-green-600/20">
                    {submitting ? 'Guardando...' : modalMode === 'create' ? 'Crear' : 'Guardar'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}