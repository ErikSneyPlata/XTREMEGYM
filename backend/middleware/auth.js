// backend/middleware/auth.js
import jwt from 'jsonwebtoken';

// 🔴 Fix: fallar en arranque si JWT_SECRET no está definido en .env
// Antes: usaba 'super-secret-powergym-key' como fallback público — cualquiera
// podría forjar tokens válidos conociendo ese string.
if (!process.env.JWT_SECRET) {
  throw new Error(
    '❌ JWT_SECRET no está definido. Agrega JWT_SECRET=<clave-segura> en tu .env'
  );
}

const JWT_SECRET = process.env.JWT_SECRET;

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access denied' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

export const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};