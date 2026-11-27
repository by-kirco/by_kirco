/* POST /api/navidad/panel-asignar-reserva — solo con sesión de Sara.
   body: { id (carta aprobada), reservaId (cartas_reserva) }
   Asigna a mano una carta de reserva a alguien aprobado, sin esperar a que haya pareja real
   ni al reparto automático del 25 (que sigue sin construirse). Marca la carta de reserva
   como usada y manda ya el email de entrega. Elegida por Sara, no al azar. */
const { requiereSesion } = require('./_auth');
const { getSupabase } = require('./_supabase');
const { enviaEmail } = require('./_resend');
const { plantillaEntrega } = require('./_emailTemplates');

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
  const reservaId = String(body.reservaId || '').trim();
  if (!id || !reservaId) return res.status(422).json({ error: 'Faltan datos.' });

  try {
    const supabase = getSupabase();

    const { data: reserva, error: errReserva } = await supabase
      .from('cartas_reserva')
      .select('id, texto, usada')
      .eq('id', reservaId)
      .maybeSingle();
    if (errReserva) throw errReserva;
    if (!reserva) return res.status(404).json({ error: 'No encuentro esa carta de reserva.' });
    if (reserva.usada) return res.status(409).json({ error: 'Esa carta de reserva ya se ha usado con otra persona.' });

    const { data: carta, error: errUpdate } = await supabase
      .from('cartas')
      .update({ recibe_reserva_id: reservaId, enviada_25_at: new Date().toISOString() })
      .eq('id', id)
      .eq('estado', 'aprobada')
      .is('recibe_carta_id', null)
      .is('recibe_reserva_id', null)
      .select('id, token, seudonimo, correo, estado')
      .maybeSingle();
    if (errUpdate) throw errUpdate;
    if (!carta) return res.status(409).json({ error: 'Esa carta ya no está disponible para asignarle una reserva (puede que ya tenga una pareja, o que ya no esté aprobada).' });

    const { data: reservaMarcada, error: errMarcar } = await supabase
      .from('cartas_reserva')
      .update({ usada: true, usada_en_carta_id: carta.id })
      .eq('id', reservaId)
      .eq('usada', false)
      .select('id')
      .maybeSingle();
    if (errMarcar) throw errMarcar;
    if (!reservaMarcada) {
      // Carrera rarísima: otra persona usó la misma reserva justo ahora. Deshacemos la asignación.
      await supabase.from('cartas').update({ recibe_reserva_id: null, enviada_25_at: null }).eq('id', carta.id);
      return res.status(409).json({ error: 'Esa carta de reserva se acaba de usar con otra persona justo ahora. Elige otra.' });
    }

    const enlaceCarta = `https://www.bykirco.com/navidad/abrir.html?t=${carta.token}`;
    const plantilla = plantillaEntrega({ seudonimo: carta.seudonimo, enlaceCarta, bloqueSiAprobada: carta.estado === 'aprobada' });
    const envio = await enviaEmail({ to: carta.correo, subject: plantilla.subject, html: plantilla.html });
    if (!envio.ok) console.error('panel-asignar-reserva.js: email no enviado', envio.error);

    return res.status(200).json({ ok: true, id: carta.id, email: envio.ok });
  } catch (e) {
    console.error('panel-asignar-reserva.js', { name: e && e.name, message: e && e.message, code: e && e.code, details: e && e.details, hint: e && e.hint });
    return res.status(500).json({ error: 'No he podido asignar la carta de reserva. Inténtalo de nuevo.' });
  }
};
