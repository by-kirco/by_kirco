/* POST /api/navidad/nota — body: { token, texto }
   Guarda la nota de agradecimiento de quien acaba de leer su carta. Una por carta (lo
   garantiza también el índice único de la tabla). Pasa por el mismo filtro de contenido
   que las cartas, porque la nota se reenvía tal cual a quien escribió la carta original. */
const { getSupabase } = require('./_supabase');
const filtro = require('./_filtro');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  const token = String(body.token || '').trim();
  const texto = String(body.texto || '').trim();

  if (!token) return res.status(422).json({ error: 'Falta el enlace de tu carta.' });
  if (!texto) return res.status(422).json({ error: 'Escribe algo antes de enviar.' });
  if (texto.length > 300) return res.status(422).json({ error: 'Tu nota es demasiado larga: como mucho 300 caracteres.' });

  const filtroTexto = filtro.revisa(texto);
  if (!filtroTexto.ok) {
    return res.status(422).json({ error: 'Hay algo en tu nota que no puede ir (insultos, amenazas, discriminación, contenido sexual, enlaces o datos de contacto). Revísala y vuelve a intentarlo.' });
  }

  let stage = 'init';
  try {
    stage = 'getSupabase';
    const supabase = getSupabase();

    stage = 'carta';
    const { data: carta, error: errCarta } = await supabase
      .from('cartas')
      .select('id, recibe_carta_id, recibe_reserva_id')
      .eq('token', token)
      .maybeSingle();
    if (errCarta) throw errCarta;
    if (!carta) return res.status(404).json({ error: 'No encuentro esta carta.' });
    if (!carta.recibe_carta_id && !carta.recibe_reserva_id) return res.status(409).json({ error: 'Todavía no has recibido ninguna carta a la que dar las gracias.' });

    stage = 'insert';
    const { error: errInsert } = await supabase
      .from('notas')
      .insert({ carta_id: carta.id, texto, estado: 'pendiente' });

    if (errInsert) {
      if (errInsert.code === '23505') {
        return res.status(409).json({ error: 'Ya has mandado unas gracias por esta carta.' });
      }
      throw errInsert;
    }

    return res.status(201).json({ ok: true });
  } catch (e) {
    console.error('nota.js', stage, { name: e && e.name, message: e && e.message, code: e && e.code, details: e && e.details, hint: e && e.hint });
    return res.status(500).json({ error: 'No he podido guardar tu nota. Inténtalo de nuevo en un momento.' });
  }
};
