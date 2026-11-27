/* POST /api/navidad/panel-reserva-como-carta — solo con sesión de Sara.
   body: { reservaId }
   Convierte una carta de reserva en una carta normal, ya aprobada, "escrita" por
   by.kirco@gmail.com (con un alias +: por ejemplo by.kirco+a1b2c3d4@gmail.com — todo llega
   al mismo buzón real de Gmail, que ignora lo que va después del +). Sirve para rellenar el
   buzón con cartas de verdad listas para el reparto: entra en el sorteo como una más, así
   que puede tocarle a alguien Y a su vez le llegará una carta real — queda equilibrado, no
   hace falta ningún código especial para eso.
   No manda ningún email de confirmación: no hay nadie real esperando avisos de "tu carta ya
   está en el buzón". Marca la carta de reserva como usada para que no se repita ni aquí ni
   en el asignar-reserva de "Ya aprobadas". */
const crypto = require('crypto');
const { requiereSesion } = require('./_auth');
const { getSupabase } = require('./_supabase');

const DOMINIO_RELLENO = 'by.kirco';

function generaToken() {
  return crypto.randomBytes(24).toString('base64url');
}

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

  const reservaId = String(body.reservaId || '').trim();
  if (!reservaId) return res.status(422).json({ error: 'Falta elegir qué carta de reserva añadir.' });

  try {
    const supabase = getSupabase();

    const { data: reserva, error: errReserva } = await supabase
      .from('cartas_reserva')
      .select('id, tema, texto, usada')
      .eq('id', reservaId)
      .maybeSingle();
    if (errReserva) throw errReserva;
    if (!reserva) return res.status(404).json({ error: 'No encuentro esa carta de reserva.' });
    if (reserva.usada) return res.status(409).json({ error: 'Esa carta de reserva ya se ha usado.' });

    const token = generaToken();
    const sufijo = String(reserva.id).replace(/-/g, '').slice(0, 8);
    const correo = `${DOMINIO_RELLENO}+${sufijo}@gmail.com`;
    const seudonimo = `Kirco · ${reserva.tema}`.slice(0, 40);

    const { data: insertada, error: errInsert } = await supabase
      .from('cartas')
      .insert({
        token,
        correo,
        seudonimo,
        saludo: 'otro',
        texto: reserva.texto,
        estado: 'aprobada',
        acepto_18_privacidad_at: new Date().toISOString()
      })
      .select('id')
      .single();
    if (errInsert) throw errInsert;

    const { error: errUpdate } = await supabase
      .from('cartas_reserva')
      .update({ usada: true, usada_en_carta_id: insertada.id })
      .eq('id', reserva.id)
      .eq('usada', false);
    if (errUpdate) throw errUpdate;

    return res.status(200).json({ ok: true, id: insertada.id, correo });
  } catch (e) {
    console.error('panel-reserva-como-carta.js', { name: e && e.name, message: e && e.message, code: e && e.code, details: e && e.details, hint: e && e.hint });
    return res.status(500).json({ error: 'No he podido añadir esa carta al buzón. Inténtalo de nuevo.' });
  }
};
