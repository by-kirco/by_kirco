/* GET  /api/navidad/abrir?t=TOKEN — la carta que RECIBE la persona dueña del token.
   POST /api/navidad/abrir { t, texto } — guarda su nota de agradecimiento (máx. 300, pasa el filtro).
   Ventana: desde el 25/12/2026 00:00 hasta el 24/01/2027 (Madrid). Antes: estado 'antes' (sin carta).
   Después: 'no_valido', igual que un token que no existe.
   Respuesta: { estado: 'antes' | 'abierta' | 'no_valido', ... }. Nunca devuelve correos ni ids.
   Una carta de reserva se devuelve igual que las demás (firma «Kirco»), sin ninguna marca. */
const { getSupabase } = require('./_supabase');
const filtro = require('./_filtro');
const { APERTURA_UTC, CADUCIDAD_UTC, NOTA_MAX } = require('./_config');

function ahora() { return (module.exports._ahora || Date.now)(); }

function saludoCarta(saludo, seudonimo) {
  if (saludo === 'querida') return 'Querida ' + seudonimo + ':';
  if (saludo === 'querido') return 'Querido ' + seudonimo + ':';
  return 'Hola, ' + seudonimo + ':';
}

function tokenValido(t) { return typeof t === 'string' && /^[A-Za-z0-9_-]{20,64}$/.test(t); }

/* Devuelve { receptor } (la fila que recibe carta para el correo de ese token), { antes } o null */
async function buscarReceptor(supabase, token) {
  const { data: propia, error } = await supabase.from('cartas').select('id, correo').eq('token', token).maybeSingle();
  if (error) throw error;
  if (!propia) return null;
  const { data: filas, error: e2 } = await supabase
    .from('cartas')
    .select('id, correo, estado, seudonimo, saludo, recibe_carta_id, recibe_reserva_id')
    .eq('correo', propia.correo);
  if (e2) throw e2;
  const receptor = (filas || []).find((f) => f.recibe_carta_id || f.recibe_reserva_id) || null;
  return { receptor, filas: filas || [] };
}

function noValido(res) {
  return res.status(404).json({ estado: 'no_valido' });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Método no permitido.' });
  }
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};
  const token = String((req.method === 'GET' ? (req.query && req.query.t) : body.t) || '').trim();
  if (!tokenValido(token)) return noValido(res);
  if (ahora() >= new Date(CADUCIDAD_UTC).getTime()) return noValido(res);

  try {
    const supabase = getSupabase();
    const r = await buscarReceptor(supabase, token);
    if (!r) return noValido(res);
    if (ahora() < new Date(APERTURA_UTC).getTime() || !r.receptor) {
      if (req.method === 'POST') return res.status(409).json({ error: 'Tu carta todavía no se puede abrir.' });
      return res.status(200).json({ estado: 'antes', abre_at: APERTURA_UTC });
    }
    const rec = r.receptor;

    if (req.method === 'POST') {
      const texto = String(body.texto || '').trim();
      if (!texto) return res.status(422).json({ error: 'Escribe tu nota.' });
      if (texto.length > NOTA_MAX) return res.status(422).json({ error: 'Tu nota es demasiado larga (máximo ' + NOTA_MAX + ' caracteres).' });
      const f = filtro.revisa(texto);
      if (!f.ok) return res.status(422).json({ error: 'Hay algo en tu nota que no puede ir (insultos, amenazas, discriminación, contenido sexual, enlaces o datos de contacto). Revísalo y vuelve a intentarlo.' });
      const { error } = await supabase.from('notas').insert({ carta_id: rec.id, texto, estado: 'pendiente' });
      if (error) {
        if (error.code === '23505') return res.status(409).json({ error: 'Ya has dejado tu nota. ¡Gracias!' });
        throw error;
      }
      return res.status(201).json({ ok: true });
    }

    let texto = null;
    let firma = null;
    if (rec.recibe_carta_id) {
      const { data: c, error } = await supabase.from('cartas').select('texto, seudonimo').eq('id', rec.recibe_carta_id).maybeSingle();
      if (error) throw error;
      if (c) { texto = c.texto; firma = c.seudonimo; }
    } else {
      const { data: c, error } = await supabase.from('cartas_reserva').select('texto').eq('id', rec.recibe_reserva_id).maybeSingle();
      if (error) throw error;
      if (c) { texto = c.texto; firma = 'Kirco'; }
    }
    if (!texto) throw new Error('Carta asignada sin texto');

    // ¿su propia carta (aprobada) ha llegado a alguien?
    const suya = r.filas.find((f) => f.estado === 'aprobada');
    let aprobadaEntregada = false;
    if (suya) {
      const { data: q, error } = await supabase.from('cartas').select('id').eq('recibe_carta_id', suya.id).limit(1);
      if (error) throw error;
      aprobadaEntregada = !!(q && q.length);
    }
    const { data: nota, error: errNota } = await supabase.from('notas').select('id').eq('carta_id', rec.id).maybeSingle();
    if (errNota) throw errNota;

    return res.status(200).json({
      estado: 'abierta',
      seudonimo: rec.seudonimo,
      saludo: saludoCarta(rec.saludo, rec.seudonimo),
      texto,
      firma,
      aprobada_entregada: aprobadaEntregada,
      nota_enviada: !!nota,
      valida_hasta: CADUCIDAD_UTC
    });
  } catch (e) {
    console.error('abrir.js', { message: e && e.message, code: e && e.code });
    return res.status(500).json({ error: 'No he podido abrir tu carta ahora. Inténtalo de nuevo en un momento.' });
  }
};
module.exports._ahora = null;
module.exports.saludoCarta = saludoCarta;
