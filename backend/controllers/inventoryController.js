// backend/controllers/inventoryController.js
import { supabase } from '../db.js';

export const getProducts = async (req, res) => {
  const { search } = req.query;
  let query = supabase.from('products').select('*');

  if (search?.trim()) {
    query = query.ilike('name', `%${search.trim()}%`);
  }

  const { data, error } = await query.order('name', { ascending: true });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data ?? []);
};

export const createProduct = async (req, res) => {
  const { name, category, stock, min_stock, price } = req.body;

  if (!name?.trim()) {
    return res.status(400).json({ error: 'El nombre del producto es obligatorio.' });
  }
  if (stock === undefined || price === undefined) {
    return res.status(400).json({ error: 'Faltan campos requeridos: stock, price.' });
  }
  if (Number(price) < 0) return res.status(400).json({ error: 'El precio no puede ser negativo.' });
  if (Number(stock) < 0) return res.status(400).json({ error: 'El stock no puede ser negativo.' });

  const { data, error } = await supabase
    .from('products')
    .insert([{
      name:      name.trim(),
      category:  category?.trim() ?? null,
      stock:     Number(stock),
      min_stock: Number(min_stock ?? 0),
      price:     Number(price),
    }])
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
};

export const updateProduct = async (req, res) => {
  const { id } = req.params;
  const { name, category, stock, min_stock, price } = req.body;

  const updates = {};
  if (name      !== undefined) updates.name      = name.trim();
  if (category  !== undefined) updates.category  = category?.trim() ?? null;
  if (stock     !== undefined) updates.stock     = Number(stock);
  if (min_stock !== undefined) updates.min_stock = Number(min_stock);
  if (price     !== undefined) updates.price     = Number(price);

  if (updates.price < 0) return res.status(400).json({ error: 'El precio no puede ser negativo.' });
  if (updates.stock < 0) return res.status(400).json({ error: 'El stock no puede ser negativo.' });

  const { data, error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  if (!data)  return res.status(404).json({ error: 'Producto no encontrado.' });
  res.json(data);
};

export const deleteProduct = async (req, res) => {
  const { id } = req.params;

  // Protección: no eliminar si tiene ventas asociadas
  const { count } = await supabase
    .from('sale_details')
    .select('id', { count: 'exact', head: true })
    .eq('product_id', id);

  if (count > 0) {
    return res.status(400).json({
      error: `No se puede eliminar: el producto tiene ${count} venta(s) registrada(s). Puedes dejarlo sin stock en su lugar.`,
    });
  }

  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) return res.status(400).json({ error: error.message });
  res.status(204).send();
};