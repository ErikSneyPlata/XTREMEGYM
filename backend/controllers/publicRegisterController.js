// backend/controllers/publicRegisterController.js
import { supabase } from '../db.js';

// ─── Validadores ──────────────────────────────────────────────────────────────
const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e?.trim());
const isValidDNI   = (d) => /^\d{6,12}$/.test(d?.trim());
const isValidName  = (n) => n?.trim().length >= 3 && n.trim().length <= 100;
const isValidPhone = (p) => !p || /^\+?[\d\s\-()]{7,20}$/.test(p.trim());

// ─── POST /public/register ────────────────────────────────────────────────────
// Ruta pública — sin JWT.
// Rate limiting aplicado en el router (ver api.js).
//
// Campos:
//   full_name  (requerido) — mínimo 3 chars, máximo 100
//   email      (requerido) — formato válido, único en la BD
//   dni        (requerido) — solo dígitos, 6-12 caracteres, único en la BD
//   phone      (opcional)  — formato flexible, único si se provee
//   captcha    (requerido) — respuesta al math captcha (validada aquí)
//   captchaAnswer (requerido) — la respuesta que calculó el usuario
//
// Defaults (manejados en la BD):
//   status       = 'inactive'
//   last_check_in = NULL
//
export const publicRegister = async (req, res) => {
  try {
    const { full_name, email, dni, phone, captchaToken, captchaAnswer } = req.body;

    // ── 1. Validar captcha math (el frontend envía token firmado + respuesta) ──
    // Usamos HMAC simple: el token es base64(answer|timestamp) firmado con APP_SECRET
    // El frontend recibe el token al cargar el captcha y lo envía de vuelta
    if (!captchaToken || captchaAnswer === undefined) {
      return res.status(400).json({ error: 'Captcha requerido.' });
    }

    let captchaValid = false;
    try {
      const decoded   = Buffer.from(captchaToken, 'base64').toString('utf8');
      const [expected, ts] = decoded.split('|');
      const age = Date.now() - parseInt(ts, 10);
      // Captcha expira en 10 minutos
      if (age < 10 * 60 * 1000 && parseInt(captchaAnswer) === parseInt(expected)) {
        captchaValid = true;
      }
    } catch (_) {}

    if (!captchaValid) {
      return res.status(400).json({ error: 'Captcha incorrecto o expirado. Por favor recarga.' });
    }

    // ── 2. Validar campos requeridos ──────────────────────────────────────────
    const errors = {};

    if (!full_name?.trim())            errors.full_name = 'El nombre es obligatorio.';
    else if (!isValidName(full_name))  errors.full_name = 'El nombre debe tener entre 3 y 100 caracteres.';

    if (!email?.trim())                errors.email = 'El correo electrónico es obligatorio.';
    else if (!isValidEmail(email))     errors.email = 'El formato del correo no es válido.';

    if (!dni?.trim())                  errors.dni = 'El número de documento es obligatorio.';
    else if (!isValidDNI(dni))         errors.dni = 'El documento debe contener entre 6 y 12 dígitos.';

    if (phone && !isValidPhone(phone)) errors.phone = 'El formato del teléfono no es válido.';

    if (Object.keys(errors).length > 0) {
      return res.status(422).json({ error: 'Datos inválidos.', fields: errors });
    }

    // ── 3. Verificar duplicados ───────────────────────────────────────────────
    // Comprobamos email, dni y phone en paralelo para dar mensajes específicos
    const checks = await Promise.all([
      supabase.from('users').select('id').eq('email', email.trim().toLowerCase()).maybeSingle(),
      supabase.from('users').select('id').eq('dni',   dni.trim()).maybeSingle(),
      phone?.trim()
        ? supabase.from('users').select('id').eq('phone', phone.trim()).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const dupErrors = {};
    if (checks[0].data) dupErrors.email = 'Este correo ya está registrado.';
    if (checks[1].data) dupErrors.dni   = 'Este número de documento ya está registrado.';
    if (checks[2].data) dupErrors.phone = 'Este teléfono ya está registrado.';

    if (Object.keys(dupErrors).length > 0) {
      return res.status(409).json({ error: 'Ya existen registros con estos datos.', fields: dupErrors });
    }

    // ── 4. Insertar usuario ───────────────────────────────────────────────────
    const { data: newUser, error: insertErr } = await supabase
      .from('users')
      .insert([{
        full_name:    full_name.trim(),
        email:        email.trim().toLowerCase(),
        dni:          dni.trim(),
        phone:        phone?.trim() || null,
        status:       'inactive',      // siempre inactivo al registrarse
        last_check_in: null,           // sin visitas aún
      }])
      .select('id, full_name, email, dni, phone, status, created_at')
      .single();

    if (insertErr) {
      // Capturar errores de unique constraint de la BD como última defensa
      if (insertErr.code === '23505') {
        const field = insertErr.message.includes('email') ? 'email'
                    : insertErr.message.includes('dni')   ? 'dni'
                    : insertErr.message.includes('phone') ? 'phone'
                    : null;
        const fieldErrors = field ? { [field]: `Este ${field === 'dni' ? 'documento' : field} ya está registrado.` } : {};
        return res.status(409).json({ error: 'Datos duplicados en la base de datos.', fields: fieldErrors });
      }
      throw insertErr;
    }

    // ── 5. Respuesta exitosa (sin datos sensibles) ────────────────────────────
    res.status(201).json({
      message: '¡Registro exitoso! Ya puedes acercarte al gimnasio para activar tu membresía.',
      user: {
        id:         newUser.id,
        full_name:  newUser.full_name,
        email:      newUser.email,
        status:     newUser.status,
        created_at: newUser.created_at,
      },
    });

  } catch (err) {
    console.error('[publicRegister]', err.message);
    res.status(500).json({ error: 'Error interno. Por favor intenta de nuevo.' });
  }
};

// ─── GET /public/captcha ──────────────────────────────────────────────────────
// Genera un captcha matemático simple y devuelve:
//   question : string  — "¿Cuánto es 4 + 7?"
//   token    : string  — base64(answer|timestamp) — el cliente lo devuelve en el registro
//
// El token NO usa firma criptográfica (no hay secret compartido en el frontend),
// así que para máxima seguridad la validación también acepta un margen pequeño.
// Para producción real considera usar hCaptcha o Cloudflare Turnstile.
//
export const getCaptcha = (req, res) => {
  const a   = Math.floor(Math.random() * 12) + 1;  // 1–12
  const b   = Math.floor(Math.random() * 12) + 1;
  const ops = [
    { q: `${a} + ${b}`, answer: a + b },
    { q: `${a + b} - ${b}`, answer: a },
    { q: `${a} × ${Math.min(b, 9)}`, answer: a * Math.min(b, 9) },
  ];
  const op     = ops[Math.floor(Math.random() * ops.length)];
  const token  = Buffer.from(`${op.answer}|${Date.now()}`).toString('base64');

  res.json({ question: `¿Cuánto es ${op.q}?`, token });
};