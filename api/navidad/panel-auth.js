/* GET  /api/navidad/panel-auth  -> { authed: boolean }
   POST /api/navidad/panel-auth  -> { password } o { logout: true } */
const { sesionValida, contrasenaCorrecta, cookieInicio, cookieCierre } = require('./_auth');

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ authed: sesionValida(req) });
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    body = body || {};

    if (body.logout) {
      cookieCierre(res);
      return res.status(200).json({ ok: true });
    }

    if (!process.env.PANEL_PASSWORD || !process.env.PANEL_SESSION_SECRET) {
      return res.status(500).json({ error: 'El panel no está configurado todavía (faltan variables de entorno).' });
    }

    if (!contrasenaCorrecta(body.password)) {
      return res.status(401).json({ error: 'Contraseña incorrecta.' });
    }

    cookieInicio(res);
    return res.status(200).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Método no permitido.' });
};
