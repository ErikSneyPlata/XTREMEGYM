// frontend/src/pages/PublicRegister.jsx
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

const Ico = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const PATH = {
  user:    'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  mail:    'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6',
  id:      'M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7zM8 11h8M8 15h5',
  phone:   'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.21 12 19.79 19.79 0 0 1 1.18 3.4 2 2 0 0 1 3.16 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z',
  refresh: 'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
  check:   'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4 12 14.01l-3-3',
  alert:   'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
  spin:    'M21 12a9 9 0 1 1-6.219-8.56',
  back:    'M19 12H5M12 5l-7 7 7 7',
};

const validEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
const validDNI   = v => /^\d{6,12}$/.test(v.trim());
const validPhone = v => !v.trim() || /^\+?[\d\s\-().]{7,20}$/.test(v.trim());

async function fetchCaptcha() {
  const r = await fetch(`${API_BASE}/public/captcha`);
  if (!r.ok) throw new Error('captcha error');
  return r.json();
}

async function doRegister(body) {
  const r = await fetch(`${API_BASE}/public/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  return { ok: r.ok, status: r.status, data };
}

/* ─── CSS global inyectado una sola vez ─────────────────────────────────── */
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:ital,wght@0,400;0,600;0,700;0,800;0,900;1,400&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  html, body, #root {
    height: 100%;
    overflow: hidden;           /* sin scroll en el documento raíz */
  }

  /* Ocultar scrollbar en webkit (para la card del form) */
  .xg-scroll::-webkit-scrollbar { display: none; }
  .xg-scroll { -ms-overflow-style: none; scrollbar-width: none; }

  @keyframes xg-ring        { 0%,100%{ transform:scale(1);opacity:.35 } 50%{ transform:scale(1.03);opacity:.1 } }
  @keyframes xg-fade-up     { from{ opacity:0;transform:translateY(16px) } to{ opacity:1;transform:translateY(0) } }
  @keyframes xg-scroll-drop { 0%,100%{ transform:scaleY(1);opacity:1 } 50%{ transform:scaleY(.5);opacity:.3 } }
  @keyframes xg-spin        { to{ transform:rotate(360deg) } }
  @keyframes xg-ping        { 75%,100%{ transform:scale(2);opacity:0 } }

  .xg-fade-1{ opacity:0; animation:xg-fade-up .6s .20s forwards; }
  .xg-fade-2{ opacity:0; animation:xg-fade-up .7s .35s forwards; }
  .xg-fade-3{ opacity:0; animation:xg-fade-up .6s .55s forwards; }

  .xg-btn {
    background:#4ade80; color:#000;
    font-family:'Barlow',sans-serif; font-weight:900;
    font-size:clamp(.7rem,2vw,.85rem);
    letter-spacing:.14em; text-transform:uppercase;
    padding:clamp(.7rem,2vh,1rem) clamp(1.4rem,4vw,2.2rem);
    border-radius:10px; border:none; cursor:pointer;
    box-shadow:0 0 40px rgba(74,222,128,.25);
    transition:background .2s,box-shadow .2s,transform .15s;
    display:inline-flex; align-items:center; gap:.45rem;
    white-space:nowrap;
  }
  .xg-btn:hover:not(:disabled){ background:#86efac; box-shadow:0 0 60px rgba(74,222,128,.4); transform:translateY(-2px); }
  .xg-btn:disabled             { opacity:.45; cursor:not-allowed; }

  .xg-btn-full{ width:100%; justify-content:center; }

  input[type=number]::-webkit-inner-spin-button,
  input[type=number]::-webkit-outer-spin-button{ -webkit-appearance:none; }
  input[type=number]{ -moz-appearance:textfield; }
  input::placeholder{ color:#282828; }
`;

/* ─── Capa de fondo: grid + glows + rings (fixed → siempre detrás) ───────── */
function Background() {
  return (
    <>
      {/* Grid verde tenue */}
      <div style={{
        position:'fixed', inset:0, zIndex:0, pointerEvents:'none', opacity:.022,
        backgroundImage:'linear-gradient(rgba(74,222,128,1) 1px,transparent 1px),linear-gradient(90deg,rgba(74,222,128,1) 1px,transparent 1px)',
        backgroundSize:'52px 52px',
      }}/>
      {/* Glows */}
      {[{top:-250,left:-250},{bottom:-250,right:-250}].map((pos,i)=>(
        <div key={i} style={{ position:'fixed', ...pos, width:500, height:500, borderRadius:'50%', background:'rgba(74,222,128,.05)', filter:'blur(120px)', pointerEvents:'none', zIndex:0 }}/>
      ))}
      <div style={{ position:'fixed', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:700, height:700, borderRadius:'50%', background:'rgba(74,222,128,.05)', filter:'blur(120px)', opacity:.4, pointerEvents:'none', zIndex:0 }}/>
      {/* Rings */}
      <div style={{ position:'fixed', inset:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none', zIndex:0 }}>
        {[1,2,3,4].map(i=>(
          <div key={i} style={{
            position:'absolute', borderRadius:'50%',
            width:i*220, height:i*220,
            border:'1px solid rgba(74,222,128,.06)',
            animation:`xg-ring ${3+i}s ${i*.7}s ease-in-out infinite`,
          }}/>
        ))}
      </div>
    </>
  );
}

/* ─── Nav mínimo ─────────────────────────────────────────────────────────── */
function Nav() {
  return (
    <nav style={{
      position:'fixed', top:0, left:0, right:0, zIndex:100,
      height:56,
      display:'flex', alignItems:'center',
      padding:'0 clamp(1rem,4vw,2.5rem)',
      background:'rgba(8,8,8,.75)', backdropFilter:'blur(20px)',
      borderBottom:'1px solid rgba(255,255,255,.07)',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:'.65rem' }}>
        <div style={{ width:28,height:28,background:'#16a34a',borderRadius:7,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 0 16px rgba(74,222,128,.3)',fontSize:13,flexShrink:0 }}>⚡</div>
        <span style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:'1.25rem',letterSpacing:'.05em',color:'#f8f8f8',lineHeight:1 }}>XTREME GYM</span>
      </div>
    </nav>
  );
}

/* ─── Input con ícono ────────────────────────────────────────────────────── */
function Field({ label, name, type='text', placeholder, value, onChange, error, iconPath, optional }) {
  const [focused,setFocused] = useState(false);
  const hasVal = value.length > 0;
  const border = error   ? 'rgba(248,113,113,.55)'
               : focused ? 'rgba(74,222,128,.45)'
               : hasVal  ? 'rgba(255,255,255,.12)'
               :           'rgba(255,255,255,.06)';
  const shadow = focused ? (error ? '0 0 0 3px rgba(248,113,113,.10)' : '0 0 0 3px rgba(74,222,128,.09)') : 'none';

  return (
    <div>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'.38rem' }}>
        <label style={{ fontSize:'.56rem',fontWeight:900,letterSpacing:'.2em',textTransform:'uppercase',color:'#444' }}>{label}</label>
        {optional && <span style={{ fontSize:'.5rem',color:'#333',fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase' }}>Opcional</span>}
      </div>
      <div style={{ position:'relative' }}>
        <div style={{ position:'absolute',left:'.8rem',top:'50%',transform:'translateY(-50%)',color:error?'#f87171':focused?'#4ade80':hasVal?'#555':'#2a2a2a',transition:'color .2s',pointerEvents:'none',lineHeight:1 }}>
          <Ico d={iconPath} size={14}/>
        </div>
        <input
          type={type} name={name} placeholder={placeholder} value={value}
          onChange={e=>onChange(e.target.value)}
          onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
          autoComplete={name==='email'?'email':name==='phone'?'tel':'off'}
          style={{ width:'100%',padding:'.68rem 1rem .68rem 2.3rem',background:'rgba(255,255,255,.028)',border:`1px solid ${border}`,borderRadius:8,color:'#f8f8f8',fontSize:'.83rem',fontFamily:"'Barlow',sans-serif",fontWeight:600,outline:'none',transition:'border-color .2s,box-shadow .2s',boxShadow:shadow }}
        />
      </div>
      <AnimatePresence>
        {error && (
          <motion.p initial={{opacity:0,y:-4}} animate={{opacity:1,y:0}} exit={{opacity:0}}
            style={{ display:'flex',alignItems:'center',gap:'.28rem',marginTop:'.32rem',fontSize:'.65rem',color:'#f87171',fontWeight:700 }}>
            <Ico d={PATH.alert} size={10}/>{error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   HERO — exactamente 100dvh, sin overflow
   El título usa clamp para escalar desde móvil hasta 4K sin desbordar.
   ═══════════════════════════════════════════════════════════════════════════ */
function HeroStep({ onRegister }) {
  return (
    <section style={{
      /* Ocupa EXACTAMENTE la ventana visible, sin scroll */
      width:'100%', height:'100dvh',
      display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center',
      textAlign:'center', position:'relative', zIndex:1, overflow:'hidden',
      /* Espacio top para el nav (56px) y un poco de aire extra */
      paddingTop:'calc(56px + clamp(1rem,4vh,3rem))',
      paddingBottom:'clamp(3rem,8vh,5rem)',
      paddingLeft:'clamp(1rem,4vw,2rem)',
      paddingRight:'clamp(1rem,4vw,2rem)',
    }}>
      <p className="xg-fade-1" style={{ fontSize:'clamp(.5rem,1.2vw,.65rem)',fontWeight:900,letterSpacing:'.28em',textTransform:'uppercase',color:'#4ade80',marginBottom:'clamp(.75rem,2vh,1.5rem)' }}>
        — Bucaramanga, Colombia · Est. 2018
      </p>

      {/*
        Título: clamp garantiza que en un iPhone SE (320px) mida ~3.6rem
        y en pantallas 4K nunca pase de 14rem.
        min  = 3.6rem  (320px × 18vw / 100 ≈ 57.6px ≈ 3.6rem — muy ajustado)
        pref = 18vw    (fluido)
        max  = 14rem   (desktop grande)
      */}
      <h1 className="xg-fade-2" style={{ fontFamily:"'Bebas Neue',sans-serif",lineHeight:.88,letterSpacing:'-.05em',marginBottom:'clamp(1.5rem,4vh,2.5rem)',width:'100%' }}>
        <span style={{ display:'block',fontSize:'clamp(3.6rem,18vw,14rem)',color:'#f8f8f8' }}>XTREME</span>
        <span style={{ display:'block',fontSize:'clamp(3.6rem,18vw,14rem)',color:'transparent',WebkitTextStroke:'clamp(1.5px,.3vw,4px) rgba(74,222,128,.7)' }}>GYM</span>
      </h1>

      <div className="xg-fade-3">
        <button onClick={onRegister} className="xg-btn">Regístrate →</button>
      </div>

      {/* Scroll indicator — solo visible si hay espacio suficiente */}
      <div style={{ position:'absolute',bottom:'clamp(1rem,3vh,2.5rem)',left:'50%',transform:'translateX(-50%)',display:'flex',flexDirection:'column',alignItems:'center',gap:'.4rem',opacity:0,animation:'xg-fade-up .5s 1s forwards' }}>
        <span style={{ fontSize:'.52rem',fontWeight:700,letterSpacing:'.2em',textTransform:'uppercase',color:'#2a2a2a' }}></span>
        <div style={{ width:1,height:32,background:'linear-gradient(to bottom,rgba(74,222,128,.5),transparent)',animation:'xg-scroll-drop 1.5s ease-in-out infinite' }}/>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   FORM — 100dvh, card con scroll interno si el contenido no cabe
   ═══════════════════════════════════════════════════════════════════════════ */
function FormStep({ onSuccess, onBack }) {
  const [form,setForm]                     = useState({ full_name:'',email:'',dni:'',phone:'' });
  const [errors,setErrors]                 = useState({});
  const [captcha,setCaptcha]               = useState(null);
  const [captchaAnswer,setCaptchaAnswer]   = useState('');
  const [captchaLoading,setCaptchaLoading] = useState(false);
  const [submitting,setSubmitting]         = useState(false);
  const [globalError,setGlobalError]       = useState('');
  const captchaRef = useRef(null);

  const loadCaptcha = async () => {
    setCaptchaLoading(true); setCaptchaAnswer('');
    setErrors(e=>({...e,captcha:''}));
    try { setCaptcha(await fetchCaptcha()); }
    catch(_){ setGlobalError('No se pudo cargar el captcha. Verifica tu conexión.'); }
    finally { setCaptchaLoading(false); setTimeout(()=>captchaRef.current?.focus(),100); }
  };

  useEffect(()=>{ loadCaptcha(); },[]);

  const setField = name => val => {
    setForm(f=>({...f,[name]:val}));
    if(errors[name]) setErrors(e=>({...e,[name]:''}));
  };

  const validate = () => {
    const e={};
    if(!form.full_name.trim())              e.full_name='El nombre es obligatorio.';
    else if(form.full_name.trim().length<3) e.full_name='Mínimo 3 caracteres.';
    if(!form.email.trim())                  e.email='El correo es obligatorio.';
    else if(!validEmail(form.email))        e.email='Correo inválido.';
    if(!form.dni.trim())                    e.dni='El documento es obligatorio.';
    else if(!validDNI(form.dni))            e.dni='Solo dígitos, 6–12 caracteres.';
    if(!validPhone(form.phone))             e.phone='Formato de teléfono inválido.';
    if(!captchaAnswer.trim())               e.captcha='Responde el captcha.';
    return e;
  };

  const handleSubmit = async ev => {
    ev.preventDefault(); setGlobalError('');
    const errs=validate();
    if(Object.keys(errs).length){ setErrors(errs); return; }
    setSubmitting(true);
    try {
      const{ok,status,data}=await doRegister({
        full_name:form.full_name.trim(), email:form.email.trim().toLowerCase(),
        dni:form.dni.trim(), phone:form.phone.trim()||undefined,
        captchaToken:captcha?.token, captchaAnswer:parseInt(captchaAnswer.trim(),10),
      });
      if(ok)                                { onSuccess(data); }
      else if(status===422||status===409)   { if(data.fields) setErrors(data.fields); else setGlobalError(data.error??'Error al registrarse.'); loadCaptcha(); }
      else if(status===429)                 { setGlobalError('Demasiados intentos. Espera 15 minutos.'); }
      else                                  { setGlobalError(data.error??'Error inesperado.'); loadCaptcha(); }
    } catch(_){ setGlobalError('Error de conexión. Revisa tu internet.'); }
    finally{ setSubmitting(false); }
  };

  return (
    /*
      Contenedor ocupa toda la pantalla (100dvh) y centra verticalmente.
      paddingTop incluye el nav (56px).
    */
    <div style={{
      width:'100%', height:'100dvh', position:'relative', zIndex:1,
      display:'flex', alignItems:'center', justifyContent:'center',
      paddingTop:'calc(56px + clamp(.5rem,2vh,1.5rem))',
      paddingBottom:'clamp(.5rem,2vh,1.5rem)',
      paddingLeft:'clamp(1rem,4vw,1.5rem)',
      paddingRight:'clamp(1rem,4vw,1.5rem)',
      overflow:'hidden',
    }}>
      <motion.div
        initial={{opacity:0,y:24}} animate={{opacity:1,y:0}}
        transition={{duration:.45,ease:[.16,1,.3,1]}}
        style={{
          width:'100%',
          maxWidth:420,
          /*
            La columna interna (volver + header + card + pie) no puede
            superar el espacio disponible (altura ventana − nav − paddings).
            Si lo supera, la card scrollea internamente.
          */
          maxHeight:'calc(100dvh - 56px - clamp(1rem,4vh,3rem))',
          display:'flex', flexDirection:'column',
        }}>

        {/* Volver — fuera de la card, no scrollea */}
        <button onClick={onBack} style={{ flexShrink:0,background:'none',border:'none',cursor:'pointer',marginBottom:'clamp(.75rem,2vh,1.25rem)',display:'flex',alignItems:'center',gap:'.35rem',color:'#555',fontFamily:"'Barlow',sans-serif",fontWeight:700,fontSize:'.6rem',letterSpacing:'.2em',textTransform:'uppercase',padding:0 }}>
          <Ico d={PATH.back} size={12}/> Volver
        </button>

        {/* Header — fuera de la card, no scrollea */}
        <div style={{ flexShrink:0,marginBottom:'clamp(.75rem,2vh,1.25rem)' }}>
          <p style={{ fontSize:'.56rem',fontWeight:900,letterSpacing:'.28em',textTransform:'uppercase',color:'#4ade80',marginBottom:'.4rem' }}>— Únete ahora</p>
          <h2 style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:'clamp(1.7rem,5vw,2.6rem)',lineHeight:.9,letterSpacing:'.01em' }}>
            REGÍSTRATE <span style={{ color:'transparent',WebkitTextStroke:'clamp(1px,1.5px,2px) rgba(74,222,128,.7)' }}>AHORA</span>
          </h2>
        </div>

        {/*
          Card: flex-shrink:1 + overflow:auto → si la pantalla es pequeña
          la card se achica y aparece scroll interno. En pantallas grandes
          muestra todo sin scroll.
        */}
        <div className="xg-scroll" style={{
          flexShrink:1, overflowY:'auto',
          background:'rgba(17,17,17,.93)',
          border:'1px solid rgba(255,255,255,.07)',
          borderRadius:14,
          padding:'clamp(1rem,3vw,1.6rem)',
          backdropFilter:'blur(20px)',
          boxShadow:'0 24px 60px rgba(0,0,0,.55)',
        }}>
          <AnimatePresence>
            {globalError && (
              <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}} style={{overflow:'hidden',marginBottom:'.8rem'}}>
                <div style={{ display:'flex',alignItems:'flex-start',gap:'.45rem',padding:'.65rem',background:'rgba(248,113,113,.08)',border:'1px solid rgba(248,113,113,.2)',borderRadius:8 }}>
                  <Ico d={PATH.alert} size={13}/>
                  <p style={{ fontSize:'.74rem',color:'#f87171',fontWeight:700,margin:0 }}>{globalError}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} noValidate style={{ display:'flex',flexDirection:'column',gap:'.8rem' }}>
            <Field label="Nombre completo"    name="full_name" iconPath={PATH.user}  placeholder="Laura Rodríguez" value={form.full_name} onChange={setField('full_name')} error={errors.full_name}/>
            <Field label="Correo electrónico" name="email"     iconPath={PATH.mail}  type="email" placeholder="tu@correo.com"   value={form.email}     onChange={setField('email')}     error={errors.email}/>
            <Field label="DNI / Cédula"       name="dni"       iconPath={PATH.id}    placeholder="1234567890"       value={form.dni}       onChange={setField('dni')}       error={errors.dni}/>
            <Field label="Teléfono"           name="phone"     iconPath={PATH.phone} type="tel" placeholder="300 123 4567" optional value={form.phone} onChange={setField('phone')} error={errors.phone}/>

            <div style={{ borderTop:'1px solid rgba(255,255,255,.06)' }}/>

            {/* Captcha */}
            <div>
              <p style={{ fontSize:'.54rem',fontWeight:900,letterSpacing:'.2em',textTransform:'uppercase',color:'#444',marginBottom:'.45rem' }}>Verificación de seguridad</p>
              <div style={{ display:'flex',gap:'.4rem',marginBottom:'.45rem' }}>
                <div style={{ flex:1,display:'flex',alignItems:'center',gap:'.4rem',padding:'.6rem .8rem',background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.06)',borderRadius:8,minHeight:40 }}>
                  {captchaLoading
                    ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" style={{animation:'xg-spin 1s linear infinite',flexShrink:0}}><path d={PATH.spin}/></svg>
                    : captcha
                    ? <><span style={{fontSize:'.5rem',fontWeight:900,color:'#333',letterSpacing:'.1em',textTransform:'uppercase',flexShrink:0}}>Calcula:</span>
                        <span style={{color:'#4ade80',fontWeight:900,fontSize:'.88rem'}}>{captcha.question}</span></>
                    : <span style={{fontSize:'.72rem',color:'#f87171',fontWeight:700}}>Error</span>
                  }
                </div>
                <button type="button" onClick={loadCaptcha} disabled={captchaLoading} title="Nuevo captcha"
                  style={{width:40,height:40,flexShrink:0,borderRadius:8,background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.06)',color:'#555',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}
                  onMouseEnter={e=>{e.currentTarget.style.color='#4ade80';e.currentTarget.style.borderColor='rgba(74,222,128,.3)';}}
                  onMouseLeave={e=>{e.currentTarget.style.color='#555';e.currentTarget.style.borderColor='rgba(255,255,255,.06)';}}>
                  <Ico d={PATH.refresh} size={13}/>
                </button>
              </div>
              <input ref={captchaRef} type="number" inputMode="numeric" placeholder="Tu respuesta"
                value={captchaAnswer}
                onChange={e=>{ setCaptchaAnswer(e.target.value); if(errors.captcha) setErrors(er=>({...er,captcha:''})); }}
                style={{ width:'100%',textAlign:'center',letterSpacing:'.2em',padding:'.68rem 1rem',background:'rgba(255,255,255,.028)',border:`1px solid ${errors.captcha?'rgba(248,113,113,.5)':captchaAnswer?'rgba(74,222,128,.4)':'rgba(255,255,255,.06)'}`,borderRadius:8,color:'#f8f8f8',fontSize:'.88rem',fontFamily:"'Barlow',sans-serif",fontWeight:900,outline:'none' }}
              />
              <AnimatePresence>
                {errors.captcha && (
                  <motion.p initial={{opacity:0,y:-4}} animate={{opacity:1,y:0}} exit={{opacity:0}}
                    style={{display:'flex',alignItems:'center',gap:'.28rem',marginTop:'.32rem',fontSize:'.65rem',color:'#f87171',fontWeight:700}}>
                    <Ico d={PATH.alert} size={10}/>{errors.captcha}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <button type="submit" disabled={submitting||captchaLoading||!captcha} className="xg-btn xg-btn-full" style={{marginTop:'.1rem'}}>
              {submitting
                ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{animation:'xg-spin 1s linear infinite'}}><path d={PATH.spin}/></svg>Registrando...</>
                : 'Crear perfil →'}
            </button>
          </form>
        </div>

        {/* Pie — fuera de la card, fuera del scroll */}
        <p style={{ flexShrink:0,textAlign:'center',marginTop:'.7rem',fontSize:'.56rem',fontWeight:700,color:'#282828',letterSpacing:'.07em' }}>
          Tus datos solo se usan para gestionar tu membresía en Xtreme Gym.
        </p>
      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SUCCESS — 100dvh, centrado, sin scroll
   ═══════════════════════════════════════════════════════════════════════════ */
function SuccessStep({ data, onReset }) {
  return (
    <div style={{
      width:'100%', height:'100dvh', position:'relative', zIndex:1,
      display:'flex', alignItems:'center', justifyContent:'center',
      paddingTop:'calc(56px + clamp(.5rem,2vh,1rem))',
      padding:'calc(56px + clamp(.5rem,2vh,1rem)) clamp(1rem,5vw,2rem) clamp(1rem,3vh,2rem)',
      overflow:'hidden',
    }}>
      <motion.div
        initial={{opacity:0,scale:.92,y:20}} animate={{opacity:1,scale:1,y:0}}
        transition={{type:'spring',stiffness:200,damping:22}}
        style={{ width:'100%',maxWidth:400,textAlign:'center' }}>

        {/* Ícono */}
        <div style={{position:'relative',width:68,height:68,margin:'0 auto clamp(1rem,3vh,1.5rem)'}}>
          <div style={{position:'absolute',inset:0,borderRadius:'50%',background:'rgba(74,222,128,.06)',animation:'xg-ping 2s cubic-bezier(0,0,.2,1) infinite'}}/>
          <div style={{position:'relative',width:68,height:68,borderRadius:'50%',background:'rgba(74,222,128,.1)',border:'1px solid rgba(74,222,128,.3)',display:'flex',alignItems:'center',justifyContent:'center',color:'#4ade80'}}>
            <Ico d={PATH.check} size={28}/>
          </div>
        </div>

        <h1 style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:'clamp(2.2rem,8vw,3.8rem)',lineHeight:.88,letterSpacing:'-.02em',marginBottom:'clamp(.6rem,2vh,.9rem)'}}>
          ¡REGISTRO<br/>
          <span style={{color:'transparent',WebkitTextStroke:'clamp(1.5px,.3vw,3px) rgba(74,222,128,.7)'}}>EXITOSO!</span>
        </h1>

        <p style={{color:'#555',fontWeight:700,lineHeight:1.7,fontSize:'clamp(.78rem,2vw,.88rem)',marginBottom:'clamp(1rem,3vh,1.5rem)'}}>
          Bienvenido, <span style={{color:'#4ade80'}}>{data?.user?.full_name}</span>.<br/>
          Acércate al gimnasio para activar tu membresía.
        </p>

        <div style={{background:'rgba(17,17,17,.92)',border:'1px solid rgba(255,255,255,.07)',borderRadius:12,padding:'clamp(.9rem,3vw,1.25rem)',marginBottom:'clamp(1rem,3vh,1.5rem)',textAlign:'left'}}>
          {[{icon:'user',label:'Nombre',val:data?.user?.full_name},{icon:'mail',label:'Correo',val:data?.user?.email}].map(({icon,label,val})=>(
            <div key={label} style={{display:'flex',alignItems:'center',gap:'.65rem',padding:'.5rem 0',borderBottom:'1px solid rgba(255,255,255,.04)'}}>
              <div style={{width:30,height:30,borderRadius:8,background:'rgba(74,222,128,.08)',display:'flex',alignItems:'center',justifyContent:'center',color:'#4ade80',flexShrink:0}}>
                <Ico d={PATH[icon]} size={13}/>
              </div>
              <div style={{minWidth:0}}>
                <p style={{fontSize:'.5rem',fontWeight:900,letterSpacing:'.18em',textTransform:'uppercase',color:'#333',margin:0}}>{label}</p>
                <p style={{fontSize:'.8rem',fontWeight:700,color:'#888',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{val}</p>
              </div>
            </div>
          ))}
          <div style={{display:'flex',alignItems:'center',gap:'.4rem',paddingTop:'.6rem'}}>
            <div style={{width:5,height:5,borderRadius:'50%',background:'#4ade80',opacity:.5,animation:'xg-ping 2s infinite'}}/>
            <span style={{fontSize:'.56rem',fontWeight:900,color:'#4ade80',opacity:.6,letterSpacing:'.15em',textTransform:'uppercase'}}>Pendiente de activación</span>
          </div>
        </div>

        <button onClick={onReset} style={{background:'none',border:'none',cursor:'pointer',color:'#333',fontFamily:"'Barlow',sans-serif",fontWeight:700,fontSize:'.65rem',letterSpacing:'.15em',textTransform:'uppercase',textDecoration:'underline',textUnderlineOffset:4}}>
          Registrar otro miembro
        </button>
      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ROOT
   ═══════════════════════════════════════════════════════════════════════════ */
export default function PublicRegister() {
  const [step,setStep]             = useState('hero');
  const [successData,setSuccessData] = useState(null);
  const reset = () => { setSuccessData(null); setStep('hero'); };

  return (
    /*
      El root ocupa exactamente la ventana: width:100svw + height:100dvh.
      overflow:hidden evita cualquier scroll en este nivel.
      El scroll solo puede existir dentro de la card del formulario (.xg-scroll).
    */
    <div style={{
      fontFamily:"'Barlow',sans-serif",
      background:'#080808', color:'#f8f8f8',
      width:'100svw', maxWidth:'100%',
      height:'100dvh', maxHeight:'100dvh',
      overflow:'hidden', position:'relative',
    }}>
      <style>{GLOBAL_CSS}</style>
      <Background/>
      <Nav/>

      <AnimatePresence mode="wait">
        {step==='hero' && (
          <motion.div key="hero" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:.22}} style={{width:'100%',height:'100%'}}>
            <HeroStep onRegister={()=>setStep('form')}/>
          </motion.div>
        )}
        {step==='form' && (
          <motion.div key="form" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:.22}} style={{width:'100%',height:'100%'}}>
            <FormStep onSuccess={d=>{setSuccessData(d);setStep('success');}} onBack={()=>setStep('hero')}/>
          </motion.div>
        )}
        {step==='success' && (
          <motion.div key="success" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:.22}} style={{width:'100%',height:'100%'}}>
            <SuccessStep data={successData} onReset={reset}/>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}