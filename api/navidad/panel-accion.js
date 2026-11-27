/* POST /api/navidad/panel-accion — solo con sesión de Sara.
   body: { id, accion: 'aprobar' | 'rechazar' }
   Aprobar: estado -> aprobada (entra en la bolsa). Solo si estaba pendiente.
   Rechazar: estado -> rechazada y se borra el texto de la carta. Vale tanto para una
   carta pendiente como para una ya aprobada (por si Sara se lo piensa mejor), pero nunca
   si ya tiene recibe_carta_id (ya le ha llegado una carta de otra persona: sería demasiado tarde). */
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
  const motivo = accion === 'rechazar' ? String(body.motivo || '').trim().slice(0, 300) : null;
  if (!id || !['aprobar', 'rechazar'].includes(accion)) {
    return res.status(422).json({ error: 'Faltan datos de la acción.' });
  }
  if (accion === 'rechazar' && !motivo) {
    return res.status(422).json({ error: 'Elige o escribe un motivo para el rechazo: hay que avisar por qué.' });
  }

  try {
    const supabase = getSupabase();
    const cambios = accion === 'aprobar'
      ? { estado: 'aprobada' }
      : { estado: 'rechazada', texto: null, motivo };

    function construyeQuery(conReserva) {
      let q = supabase.from('cartas').update(cambios).eq('id', id).is('recibe_carta_id', null);
      if (conReserva) q = q.is('recibe_reserva_id', null);
      q = accion === 'aprobar' ? q.eq('estado', 'pendiente') : q.in('estado', ['pendiente', 'aprobada']);
      return q.select('id, estado, correo, seudonimo').maybeSingle();
    }

    let { data, error } = await construyeQuery(true);
    // recibe_reserva_id es una columna nueva: si este proyecto de Supabase todavía no la tiene,
    // no debe bloquear aprobar/rechazar — se repite sin esa comprobación extra.
    if (error && String(error.message || '').includes('recibe_reserva_id')) {
      console.error('panel-accion.js: recibe_reserva_id no disponible (¿falta aplicar schema.sql?)', error.message);
      ({ data, error } = await construyeQuery(false));
    }
    if (error) throw error;
    if (!data) {
      return res.status(409).json({
        error: accion === 'aprobar'
          ? 'Esa carta ya no está pendiente (puede que otra persona la haya gestionado ya).'
          : 'Esa carta ya no se puede rechazar (puede que ya se haya repartido, o que otra persona la haya gestionado ya).'
      });
    }

    const plantilla = accion === 'aprobar'
      ? plantillaAprobada({ seudonimo: data.seudonimo })
      : plantillaRechazada({ seudonimo: data.seudonimo, motivo });
    const envio = await enviaEmail({ to: data.correo, subject: plantilla.subject, html: plantilla.html });
    if (!envio.ok) console.error('panel-accion.js: email no enviado', envio.error);

    return res.status(200).json({ ok: true, id: data.id, estado: data.estado, email: envio.ok });
  } catch (e) {
    console.error('panel-accion.js', { name: e && e.name, message: e && e.message, code: e && e.code, details: e && e.details, hint: e && e.hint });
    return res.status(500).json({ error: 'No hemos podido guardar el cambio. Inténtalo de nuevo.' });
  }
};
