/* GET /api/navidad/carta-abierta?t={token}
   Página pública /navidad/abrir.html. Nunca expone correos ni datos de otras cartas:
   solo lo mínimo para mostrar la carta recibida (si ya hay una asignada) a quien tiene el token. */
const { getSupabase } = require('./_supabase');

const OBJETIVO_25 = Date.UTC(2026, 11, 24, 23, 0, 0); // 25/12/2026 00:00 Europe/Madrid (CET, UTC+1)

function saludoCarta(saludo, seudonimo) {
  const nombre = seudonimo || 'alguien';
  if (saludo === 'querido') return `Querido ${nombre}:`;
  if (saludo === 'querida') return `Querida ${nombre}:`;
  return `Hola, ${nombre}:`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  const token = String((req.query && req.query.t) || '').trim();
  if (!token) return res.status(404).json({ estado: 'no_encontrada' });

  try {
    const supabase = getSupabase();

    const { data: d, error } = await supabase
      .from('cartas')
      .select('id, seudonimo, saludo, estado, recibe_carta_id, abierta_at')
      .eq('token', token)
      .maybeSingle();
    if (error) throw error;
    if (!d) return res.status(404).json({ estado: 'no_encontrada' });

    if (Date.now() < OBJETIVO_25) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ estado: 'antes', objetivo: new Date(OBJETIVO_25).toISOString() });
    }

    if (!d.recibe_carta_id) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ estado: 'camino' });
    }

    const { data: autor, error: errAutor } = await supabase
      .from('cartas')
      .select('id, seudonimo, texto')
      .eq('id', d.recibe_carta_id)
      .maybeSingle();
    if (errAutor) throw errAutor;
    if (!autor || !autor.texto) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ estado: 'camino' });
    }

    if (!d.abierta_at) {
      await supabase.from('cartas').update({ abierta_at: new Date().toISOString() }).eq('id', d.id).is('abierta_at', null);
    }

    const { data: notaExistente, error: errNota } = await supabase
      .from('notas')
      .select('id')
      .eq('carta_id', d.id)
      .maybeSingle();
    if (errNota) throw errNota;

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      estado: 'abierta',
      seudonimo: d.seudonimo,
      saludoCarta: saludoCarta(d.saludo, d.seudonimo),
      texto: autor.texto,
      firma: autor.seudonimo || 'Kirco',
      bloqueSiAprobada: d.estado === 'aprobada',
      notaYaEnviada: !!notaExistente
    });
  } catch (e) {
    console.error('carta-abierta.js', { name: e && e.name, message: e && e.message, code: e && e.code, details: e && e.details, hint: e && e.hint });
    return res.status(500).json({ estado: 'error' });
  }
};
