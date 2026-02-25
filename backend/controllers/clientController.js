import { supabase } from '../db.js';

export const getClients = async (req, res) => {
  const { search } = req.query;
  let query = supabase.from('users').select('*');

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,dni.ilike.%${search}%`);
  }

  const { data, error } = await query.order('full_name', { ascending: true });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
};

export const createClient = async (req, res) => {
  const { full_name, phone, email, dni } = req.body;
  const { data, error } = await supabase
    .from('users')
    .insert([{ full_name, phone, email, dni }])
    .select();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data[0]);
};

export const updateClient = async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from('users')
    .update(req.body)
    .eq('id', id)
    .select();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data[0]);
};

export const getClientStats = async (req, res) => {
  const { id } = req.params;
  
  // Get active membership
  const { data: membership } = await supabase
    .from('user_memberships')
    .select('*, membership_plans(*)')
    .eq('user_id', id)
    .eq('status', 'active')
    .order('end_date', { ascending: false })
    .limit(1)
    .single();

  // Get recent check-ins
  const { data: checkins } = await supabase
    .from('check_ins')
    .select('*')
    .eq('user_id', id)
    .order('created_at', { ascending: false })
    .limit(5);

  res.json({ membership, recentCheckins: checkins });
};
