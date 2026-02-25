import { supabase } from '../db.js';

export const getProducts = async (req, res) => {
  const { search } = req.query;
  let query = supabase.from('products').select('*');

  if (search) {
    query = query.ilike('name', `%${search}%`);
  }

  const { data, error } = await query.order('name', { ascending: true });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
};

export const createProduct = async (req, res) => {
  const { data, error } = await supabase
    .from('products')
    .insert([req.body])
    .select();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data[0]);
};

export const updateProduct = async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from('products')
    .update(req.body)
    .eq('id', id)
    .select();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data[0]);
};

export const deleteProduct = async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) return res.status(400).json({ error: error.message });
  res.status(204).send();
};
