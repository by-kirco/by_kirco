/* POST /api/navidad/panel-accion — solo con sesión de Sara.
   body: { id, accion: 'aprobar' | 'rechazar' | 'bloquear', motivo? }
   Aprobar: estado -> aprobada (entra en la bolsa). Solo si estaba pendiente.
   Rechazar: estado -> rechazada y se borra el texto de la carta. Vale tanto para una
   carta pendiente como para una ya aprobada (por si Sara se lo piensa mejor), pero nunca
   si ya tiene recibe_carta_id (ya le ha llegado una carta de otra persona: sería demasiado tarde).
   Bloquear: hace lo mismo que rechazar y, además, guarda el correo en correos_bloqueados
   para que esa cuenta no pueda volver a mandar otra carta (spam o incumplimiento repetido).
   La persona recibe el mismo email de rechazo de siempre: no se le avisa de que, además,
   queda bloqueada.
   Al rechazar o bloquear, si alguien había elegido esta carta como destino, esa elección se
   limpia (vuelve a "al azar") en vez de quedarse apuntando a una carta que ya no es válida. */
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
  const necesitaMotivo = accion === 'rechazar' || accion === 'bloquear';
  const motivo = necesitaMotivo ? String(body.motivo || '').trim().slice(0, 300) : null;
  if (!id || !['aprobar', 'rechazar', 'bloquear'].includes(accion)) {
    return res.status(422).json({ error: 'Faltan datos de la acción.' });
  }
  if (necesitaMotivo && !motivo) {
    return res.status(422).json({ error: 'Elige o escribe un motivo: hay que avisar por qué.' });
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
          : 'Esa carta ya no se puede gestionar (puede que ya se haya repartido, o que otra persona la haya gestionado ya).'
      });
    }

    // Si alguien había elegido esta carta como destino y ahora se rechaza (o se bloquea), esa
    // elección deja de ser válida: se limpia para que esa persona caiga a "al azar" en vez de
    // quedarse apuntando a un destino que ya no existe.
    if (accion !== 'aprobar') {
      const { error: errLimpia } = await supabase.from('cartas').update({ destino_carta_id: null }).eq('destino_carta_id', id);
      if (errLimpia) console.error('panel-accion.js: no se pudo limpiar destino_carta_id huérfano', errLimpia.message);
    }

    let bloqueado;
    if (accion === 'bloquear') {
      try {
        const { error: errBloqueo } = await supabase
          .from('correos_bloqueados')
          .upsert({ correo: data.correo, motivo, bloqueada_en_carta_id: data.id }, { onConflict: 'correo' });
        if (errBloqueo) throw errBloqueo;
        bloqueado = true;
      } catch (eBloqueo) {
        // correos_bloqueados es una tabla nueva: si todavía no existe, la carta se rechaza
        // igualmente, pero el correo no queda bloqueado hasta que se aplique schema.sql.
        console.error('panel-accion.js: no se ha podido bloquear el correo (¿falta aplicar schema.sql?)', eBloqueo && eBloqueo.message);
        bloqueado = false;
      }
    }

    const plantilla = accion === 'aprobar'
      ? plantillaAprobada({ seudonimo: data.seudonimo })
      : plantillaRechazada({ seudonimo: data.seudonimo, motivo });
    const envio = await enviaEmail({ to: data.correo, subject: plantilla.subject, html: plantilla.html });
    if (!envio.ok) console.error('panel-accion.js: email no enviado', envio.error);

    return res.status(200).json({ ok: true, id: data.id, estado: data.estado, email: envio.ok, bloqueado });
  } catch (e) {
    console.error('panel-accion.js', { name: e && e.name, message: e && e.message, code: e && e.code, details: e && e.details, hint: e && e.hint });
    return res.status(500).json({ error: 'No hemos podido guardar el cambio. Inténtalo de nuevo.' });
  }
};
