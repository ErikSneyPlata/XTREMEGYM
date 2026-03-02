// backend/controllers/authController.js
import bcrypt from 'bcryptjs';
import { supabase } from '../db.js';
import { generateToken } from '../middleware/auth.js';

export const login = async (req, res) => {
  const { username, password } = req.body;

  try {
    const { data: admin, error } = await supabase
      .from('admins')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, admin.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(admin);
    res.json({
      token,
      user: {
        id: admin.id,
        username: admin.username,
        full_name: admin.full_name,
        role: admin.role
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

export const createAdmin = async (req, res) => {
  const { username, password, full_name } = req.body;

  try {
    const password_hash = await bcrypt.hash(password, 10);
    const { data, error } = await supabase
      .from('admins')
      .insert([{ username, password_hash, full_name }])
      .select();

    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json(data[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};
