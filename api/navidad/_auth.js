/* by_kirco · Navidad — sesión del panel privado (solo Sara).
   Contraseña simple en PANEL_PASSWORD + cookie firmada con PANEL_SESSION_SECRET.
   Sin librerías de sesión: todo con crypto nativo de Node. */
const crypto = require('crypto');

const COOKIE_NAME = 'kirco_panel';
const DURACION_MS = 12 * 60 * 60 * 1000; // 12 horas

function firma(payload) {
  const secret = process.env.PANEL_SESSION_SECRET || '';
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

function creaToken() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + DURACION_MS })).toString('base64url');
  return `${payload}.${firma(payload)}`;
}

function tokenValido(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return false;
  const [payload, sello] = token.split('.');
  const esperado = firma(payload);
  const a = Buffer.from(sello || '');
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const datos = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof datos.exp === 'number' && Date.now() < datos.exp;
  } catch (e) {
    return false;
  }
}

function leeCookie(req) {
  const cabecera = req.headers.cookie || '';
  const partes = cabecera.split(';').map((s) => s.trim());
  for (const p of partes) {
    if (p.startsWith(COOKIE_NAME + '=')) return decodeURIComponent(p.slice(COOKIE_NAME.length + 1));
  }
  return null;
}

function sesionValida(req) {
  return tokenValido(leeCookie(req));
}

function contrasenaCorrecta(intento) {
  const esperado = process.env.PANEL_PASSWORD || '';
  if (!esperado) return false;
  const a = Buffer.from(String(intento || ''));
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function cookieInicio(res) {
  const token = creaToken();
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${Math.floor(DURACION_MS / 1000)}`);
}

function cookieCierre(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`);
}

module.exports = { sesionValida, contrasenaCorrecta, cookieInicio, cookieCierre };
