/* POST /api/navidad/panel-accion — solo con sesión de Sara.
   body: { id, accion: 'aprobar' | 'rechazar' }
   Aprobar: estado -> aprobada (entra en la bolsa).
   Rechazar: estado -> rechazada y se borra el texto de la carta. */
const { requiereSesion } = require('./_auth');
const { getSupabase } = require('./_supabase');
const { enviaEmail } = require('./_resend');
const { plantillaAprobada, plantillaRechazada } = require('./_emailTemplates');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido.' });
  }
  const usuario = await requiereSesion(req, res);
  if (!usuario) return;

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  const id = String(body.id || '').trim();
  const accion = String(body.accion || '').trim();
  if (!id || !['aprobar', 'rechazar'].includes(accion)) {
    return res.status(422).json({ error: 'Faltan datos de la acción.' });
  }

  try {
    const supabase = getSupabase();
    const cambios = accion === 'aprobar'
      ? { estado: 'aprobada' }
      : { estado: 'rechazada', texto: null };

    const { data, error } = await supabase
      .from('cartas')
      .update(cambios)
      .eq('id', id)
      .eq('estado', 'pendiente')
      .select('id, estado, correo, seudonimo')
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(409).json({ error: 'Esa carta ya no está pendiente (puede que otra persona la haya gestionado ya).' });

    const plantilla = accion === 'aprobar'
      ? plantillaAprobada({ seudonimo: data.seudonimo })
      : plantillaRechazada({ seudonimo: data.seudonimo });
    const envio = await enviaEmail({ to: data.correo, subject: plantilla.subject, html: plantilla.html });
    if (!envio.ok) console.error('panel-accion.js: email no enviado', envio.error);

    return res.status(200).json({ ok: true, id: data.id, estado: data.estado, email: envio.ok });
  } catch (e) {
    console.error('panel-accion.js', { name: e && e.name, message: e && e.message, code: e && e.code, details: e && e.details, hint: e && e.hint });
    return res.status(500).json({ error: 'No hemos podido guardar el cambio. Inténtalo de nuevo.' });
  }
};
