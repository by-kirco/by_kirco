/* GET  /api/navidad/panel-auth  -> { authed: boolean }
   POST /api/navidad/panel-auth  -> { email, password } o { logout: true } */
const { usuarioDeSesion, iniciarSesion, establecerCookiesSesion, limpiarCookiesSesion } = require('./_auth');

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    const sesion = await usuarioDeSesion(req, res);
    return res.status(200).json({ authed: !!sesion });
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    body = body || {};

    if (body.logout) {
      limpiarCookiesSesion(res);
      return res.status(200).json({ ok: true });
    }

    if (!process.env.SUPABASE_ANON_KEY) {
      return res.status(500).json({ error: 'El panel no está configurado todavía (falta SUPABASE_ANON_KEY).' });
    }

    const email = String(body.email || '').trim();
    const password = String(body.password || '');
    if (!email || !password) {
      return res.status(422).json({ error: 'Escribe tu correo y tu contraseña.' });
    }

    try {
      const { data, error } = await iniciarSesion(email, password);
      if (error || !data || !data.session) {
        return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
      }
      establecerCookiesSesion(res, data.session);
      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error('panel-auth.js', String(e));
      return res.status(500).json({ error: 'No se pudo iniciar sesión. Inténtalo de nuevo.' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Método no permitido.' });
};
