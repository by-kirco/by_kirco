/* POST /api/navidad/panel-editar-texto — solo con sesión de Sara.
   body: { id, texto }
   Corrige el texto de una carta (tildes, ortografía, espaciado) antes de repartirla, sin avisar
   a quien la escribió ni mandar ningún email ni cambiar su estado. Solo mientras no se haya
   repartido todavía (igual que rechazar/bloquear: una vez tiene recibe_carta_id o
   recibe_reserva_id, es demasiado tarde para tocarla desde aquí). */
const { requiereSesion } = require('./_auth');
const { getSupabase } = require('./_supabase');

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
  const texto = String(body.texto || '').trim();
  if (!id) return res.status(422).json({ error: 'Falta la carta a editar.' });
  if (texto.length < 80) return res.status(422).json({ error: 'El texto es demasiado corto (mínimo 80 caracteres).' });
  if (texto.length > 3000) return res.status(422).json({ error: 'El texto es demasiado largo.' });

  try {
    const supabase = getSupabase();
    function construyeQuery(conReserva) {
      let q = supabase.from('cartas').update({ texto }).eq('id', id).is('recibe_carta_id', null).in('estado', ['pendiente', 'aprobada']);
      if (conReserva) q = q.is('recibe_reserva_id', null);
      return q.select('id').maybeSingle();
    }

    let { data, error } = await construyeQuery(true);
    // recibe_reserva_id es una columna nueva: si este proyecto de Supabase todavía no la tiene,
    // no debe impedir la corrección — se repite sin esa comprobación extra.
    if (error && String(error.message || '').includes('recibe_reserva_id')) {
      console.error('panel-editar-texto.js: recibe_reserva_id no disponible (¿falta aplicar schema.sql?)', error.message);
      ({ data, error } = await construyeQuery(false));
    }
    if (error) throw error;
    if (!data) {
      return res.status(409).json({ error: 'Esa carta ya no se puede editar (puede que ya se haya repartido, o que haya cambiado de estado).' });
    }

    return res.status(200).json({ ok: true, id: data.id });
  } catch (e) {
    console.error('panel-editar-texto.js', { name: e && e.name, message: e && e.message, code: e && e.code, details: e && e.details, hint: e && e.hint });
    return res.status(500).json({ error: 'No hemos podido guardar la corrección. Inténtalo de nuevo.' });
  }
};
