/* by_kirco · Navidad — sesión del panel privado (solo Sara), con Supabase Auth.
   El usuario (correo + contraseña) se crea a mano en el panel de Supabase
   (Authentication → Users), con el correo ya confirmado. Aquí solo se valida el
   login y se guarda la sesión en cookies HttpOnly (access + refresh token). */
const { getSupabaseAnon } = require('./_supabase');

const COOKIE_AT = 'kirco_sb_at';
const COOKIE_RT = 'kirco_sb_rt';
const RT_MAX_AGE = 60 * 60 * 24 * 30; // 30 días (la caducidad real la controla Supabase)

/* Solo dejan entrar los correos listados en PANEL_EMAILS (separados por comas), sin distinguir
   mayúsculas/minúsculas. Si la variable está vacía o no existe, no entra nadie. */
function correoPermitido(email) {
  const lista = String(process.env.PANEL_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!lista.length) return false;
  return lista.includes(String(email || '').trim().toLowerCase());
}

function leeCookie(req, nombre) {
  const cabecera = req.headers.cookie || '';
  const partes = cabecera.split(';').map((s) => s.trim());
  for (const p of partes) {
    if (p.startsWith(nombre + '=')) return decodeURIComponent(p.slice(nombre.length + 1));
  }
  return null;
}

function establecerCookiesSesion(res, session) {
  const atMaxAge = Math.max(60, (session.expires_in || 3600));
  const cookies = [
    `${COOKIE_AT}=${encodeURIComponent(session.access_token)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${atMaxAge}`,
    `${COOKIE_RT}=${encodeURIComponent(session.refresh_token)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${RT_MAX_AGE}`
  ];
  res.setHeader('Set-Cookie', cookies);
}

function limpiarCookiesSesion(res) {
  res.setHeader('Set-Cookie', [
    `${COOKIE_AT}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`,
    `${COOKIE_RT}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`
  ]);
}

/* Devuelve { user } si la sesión es válida (renovándola sola si hacía falta, en cuyo caso
   escribe las cookies nuevas en res), o null si no hay sesión válida. */
async function usuarioDeSesion(req, res) {
  const accessToken = leeCookie(req, COOKIE_AT);
  const refreshToken = leeCookie(req, COOKIE_RT);
  const supabase = getSupabaseAnon();

  if (accessToken) {
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (!error && data && data.user) return { user: data.user };
  }

  if (refreshToken) {
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
    if (!error && data && data.session && data.user) {
      if (res) establecerCookiesSesion(res, data.session);
      return { user: data.user };
    }
  }

  return null;
}

async function requiereSesion(req, res) {
  const sesion = await usuarioDeSesion(req, res);
  if (!sesion) {
    res.status(401).json({ error: 'No autorizada.' });
    return null;
  }
  if (!correoPermitido(sesion.user && sesion.user.email)) {
    res.status(403).json({ error: 'No autorizada.' });
    return null;
  }
  return sesion.user;
}

async function iniciarSesion(email, password) {
  if (!correoPermitido(email)) {
    return { data: null, error: { message: 'No autorizada.' } };
  }
  const supabase = getSupabaseAnon();
  return supabase.auth.signInWithPassword({ email, password });
}

module.exports = { usuarioDeSesion, requiereSesion, iniciarSesion, establecerCookiesSesion, limpiarCookiesSesion };
