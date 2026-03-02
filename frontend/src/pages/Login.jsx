// frontend/src/pages/Login.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Lock, User, Eye, EyeOff, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import '../autofill.css'

function Rings() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
      {[1, 2, 3, 4].map((i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border border-green-500/8"
          style={{ width: i * 220, height: i * 220 }}
          animate={{ scale: [1, 1.03, 1], opacity: [0.35, 0.1, 0.35] }}
          transition={{ duration: 3 + i, repeat: Infinity, ease: 'easeInOut', delay: i * 0.7 }}
        />
      ))}
      <div className="absolute size-56 rounded-full bg-green-500/5 blur-3xl" />
    </div>
  );
}

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const { login }  = useAuth();
  const navigate   = useNavigate();

  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/login', { username, password });
      login(data.token, data.user);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Credenciales incorrectas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080808] relative overflow-hidden flex items-center justify-center">

      {/* Grid */}
      <div
        className="absolute inset-0 opacity-[0.022]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(74,222,128,1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(74,222,128,1) 1px, transparent 1px)
          `,
          backgroundSize: '52px 52px',
        }}
      />

      {/* Glows */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-green-500/5 blur-[120px] rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-green-500/5 blur-[120px] rounded-full translate-x-1/2 translate-y-1/2 pointer-events-none" />

      <Rings />

      {/* ── BRANDING — ocupa toda la pantalla, desaparece al escribir ── */}
      <AnimatePresence>
        {!isFocused && (
          <motion.div
            key="branding"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.4, ease: 'easeInOut' }}
            className="absolute inset-0 flex flex-col items-center justify-center select-none pointer-events-none"
          >
            {/* Big name — fills the screen */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="text-center leading-none"
            >
              <div
                className="font-black text-white"
                style={{
                  fontSize: 'clamp(5rem, 18vw, 14rem)',
                  letterSpacing: '-0.05em',
                  lineHeight: 0.88,
                }}
              >
                XTREME
              </div>
              <div
                className="font-black"
                style={{
                  fontSize: 'clamp(5rem, 18vw, 14rem)',
                  letterSpacing: '-0.05em',
                  lineHeight: 0.88,
                  WebkitTextStroke: 'clamp(2px, 0.3vw, 4px) rgba(74,222,128,0.7)',
                  color: 'transparent',
                }}
              >
                GYM
              </div>
            </motion.div>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.5 }}
              className="text-slate-500 font-bold tracking-[.25em] uppercase mt-6"
              style={{ fontSize: 'clamp(0.65rem, 1.2vw, 1rem)' }}
            >
              Panel Administrativo
            </motion.p>

            {/* Location */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-slate-700 font-bold tracking-[.2em] uppercase mt-2"
              style={{ fontSize: 'clamp(0.55rem, 0.9vw, 0.75rem)' }}
            >
              Bucaramanga, Colombia
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── FORM — siempre centrado, encima del branding ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.5 }}
        className="relative z-10 w-full max-w-[360px] px-4"
        onMouseEnter={() => setIsFocused(true)}
        onFocus={() => setIsFocused(true)}
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setIsFocused(false); }}
      >
        {/* Card — transparente hasta que se activa */}
        <motion.div
          animate={{
            backgroundColor: isFocused ? 'rgba(17,17,17,0.95)' : 'rgba(17,17,17,0)',
            borderColor:      isFocused ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0)',
            backdropFilter:   isFocused ? 'blur(24px)' : 'blur(0px)',
            boxShadow:        isFocused ? '0 25px 60px rgba(0,0,0,0.6)' : 'none',
            paddingTop:       isFocused ? '2rem' : '1.5rem',
            paddingBottom:    isFocused ? '2rem' : '1.5rem',
            paddingLeft:      isFocused ? '2rem' : '0',
            paddingRight:     isFocused ? '2rem' : '0',
          }}
          transition={{ duration: 0.35 }}
          className="rounded-3xl border"
        >
          {/* Mini logo — solo visible mientras escribe */}
          <AnimatePresence>
            {isFocused && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: '1.5rem' }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden flex items-center gap-2.5"
              >
                <div className="size-7 bg-green-600 rounded-lg flex items-center justify-center shadow-lg shadow-green-600/30 flex-shrink-0">
                  <Zap size={14} className="text-white" fill="white" />
                </div>
                <span className="text-xs font-black text-white tracking-tight">XTREME GYM</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Header */}
          <div className="mb-6">
            <p className="text-[10px] text-green-500 uppercase font-black tracking-[.25em] mb-1">— Bienvenido</p>
            <h3 className="text-2xl font-black text-white tracking-tight">Inicia sesión</h3>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-3.5 py-2.5 rounded-xl text-xs font-medium">
                    {error}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Username */}
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">
                Usuario
              </label>
              <div className="relative group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-green-500 transition-colors">
                  <User size={15} />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Tu usuario"
                  required
                  autoComplete="username"
                  onAnimationStart={(e) => { if (e.animationName === 'onAutoFillStart') setIsFocused(true); }}
                  className="w-full bg-white/5 border border-white/10 hover:border-white/20 focus:border-green-600 rounded-xl py-3 pl-10 pr-4 text-sm font-medium focus:ring-2 focus:ring-green-600/15 outline-none transition-all placeholder:text-slate-700"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">
                Contraseña
              </label>
              <div className="relative group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-green-500 transition-colors">
                  <Lock size={15} />
                </div>
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  onAnimationStart={(e) => { if (e.animationName === 'onAutoFillStart') setIsFocused(true); }}
                  className="w-full bg-white/5 border border-white/10 hover:border-white/20 focus:border-green-600 rounded-xl py-3 pl-10 pr-11 text-sm font-medium focus:ring-2 focus:ring-green-600/15 outline-none transition-all placeholder:text-slate-700"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  tabIndex={-1}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 transition-colors"
                >
                  {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={loading}
              whileTap={{ scale: 0.98 }}
              className="w-full mt-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-black py-3.5 rounded-xl shadow-lg shadow-green-600/25 transition-colors flex items-center justify-center gap-2 text-sm"
            >
              {loading ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.75, repeat: Infinity, ease: 'linear' }}
                    className="size-4 border-2 border-white/30 border-t-white rounded-full"
                  />
                  Verificando...
                </>
              ) : (
                <>
                  Entrar al Sistema
                  <motion.span animate={{ x: [0, 3, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
                    →
                  </motion.span>
                </>
              )}
            </motion.button>
          </form>
        </motion.div>
      </motion.div>
    </div>
  );
}