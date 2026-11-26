/* POST /api/navidad/panel-accion — solo con sesión de Sara.
   body: { id, accion: 'aprobar' | 'rechazar', motivo?: 'M1' | 'M2' | 'M3' | texto libre (M4) }
   Aprobar: estado -> aprobada (entra en la bolsa) + correo «Tu carta ya está lista».
   Rechazar: estado -> rechazada, se borra el texto, se guarda el motivo (obligatorio: legal.html
     promete decir por qué) + correo «Sobre tu carta».
     FIX 26 nov: también se pone destino_carta_id = null, para que la persona que había elegido
     vuelva a estar libre (antes quedaba bloqueada por el índice ux_cartas_destino_elegido).
   Después del sorteo ya no se puede cambiar nada.
   Un fallo del correo nunca rompe la respuesta (queda en la cola para reintentar). */
const { requiereSesion } = require('./_auth');
const { getSupabase } = require('./_supabase');
const correo = require('./_correo');
const { MOTIVOS } = require('./_textos_correo');
const { EDICION } = require('./_config');

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
  let motivo = null;
  if (accion === 'rechazar') {
    const m = String(body.motivo || '').trim();
    motivo = MOTIVOS[m] ? m : m.slice(0, 300);
    if (!motivo) return res.status(422).json({ error: 'Elige el motivo del rechazo (se le dice en el correo).' });
  }

  try {
    const supabase = getSupabase();
    const { data: sorteo, error: errSorteo } = await supabase.from('sorteos').select('id').eq('edicion', EDICION).maybeSingle();
    if (errSorteo) throw errSorteo;
    if (sorteo) return res.status(409).json({ error: 'El sorteo ya está hecho: ya no se pueden aprobar ni rechazar cartas.' });

    const cambios = accion === 'aprobar'
      ? { estado: 'aprobada' }
      : { estado: 'rechazada', texto: null, destino_carta_id: null, motivo_rechazo: motivo };

    const { data, error } = await supabase
      .from('cartas')
      .update(cambios)
      .eq('id', id)
      .eq('estado', 'pendiente')
      .select('id, estado')
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(409).json({ error: 'Esa carta ya no está pendiente (puede que otra persona la haya gestionado ya).' });

    const envio = await correo.encolarYEnviar(supabase, data.id, accion === 'aprobar' ? 'aprobada' : 'rechazada');
    return res.status(200).json({ ok: true, id: data.id, estado: data.estado, correo: envio.estado });
  } catch (e) {
    console.error('panel-accion.js', { name: e && e.name, message: e && e.message, code: e && e.code, details: e && e.details, hint: e && e.hint });
    return res.status(500).json({ error: 'No hemos podido guardar el cambio. Inténtalo de nuevo.' });
  }
};
