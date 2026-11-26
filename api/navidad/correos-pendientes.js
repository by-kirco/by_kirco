/* GET/POST /api/navidad/correos-pendientes — reintenta los correos que no salieron
   (cuota diaria de Resend agotada, errores de red...). Protegido:
     - cron diario de Vercel: cabecera «Authorization: Bearer CRON_SECRET» (Vercel la añade sola
       si existe la variable CRON_SECRET en el proyecto);
     - o sesión de Sara (botón del panel).
   Sin RESEND_API_KEY, los marca como 'simulado'. */
const crypto = require('crypto');
const { usuarioDeSesion } = require('./_auth');
const { getSupabase } = require('./_supabase');
const correo = require('./_correo');

function cronValido(req) {
  const secreto = process.env.CRON_SECRET || '';
  const cab = String((req.headers && (req.headers.authorization || req.headers.Authorization)) || '');
  if (!secreto || !cab.startsWith('Bearer ')) return false;
  const a = Buffer.from(cab.slice(7));
  const b = Buffer.from(secreto);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Método no permitido.' });
  }
  let autorizado = cronValido(req);
  if (!autorizado) {
    try { autorizado = !!(await usuarioDeSesion(req, res)); } catch (e) { autorizado = false; }
  }
  if (!autorizado) return res.status(401).json({ error: 'No autorizada.' });

  try {
    const supabase = getSupabase();
    const resumen = await correo.reintentarPendientes(supabase);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, simulacion: correo.modoSimulacion(), resumen });
  } catch (e) {
    console.error('correos-pendientes.js', { message: e && e.message, code: e && e.code });
    return res.status(500).json({ error: 'No se han podido reintentar los correos.' });
  }
};
