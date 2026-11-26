/* GET /api/navidad/estado
   Contador público del buzón + bolsa de seudónimos aprobados y aún sin destino elegido.
   No expone correos ni textos. */
const { getSupabase } = require('./_supabase');

const TOTAL = 300;
const PLAZO_UTC = '2026-12-23T22:59:59Z'; // 23/12/2026 23:59 Europe/Madrid (CET, UTC+1)

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  try {
    const supabase = getSupabase();

    const { count: escritas, error: errCount } = await supabase
      .from('cartas')
      .select('id', { count: 'exact', head: true })
      .in('estado', ['pendiente', 'aprobada']);
    if (errCount) throw errCount;

    const { data: aprobadas, error: errAprobadas } = await supabase
      .from('cartas')
      .select('id, seudonimo, saludo')
      .eq('estado', 'aprobada')
      .is('recibe_carta_id', null);
    if (errAprobadas) throw errAprobadas;

    const { data: elegidas, error: errElegidas } = await supabase
      .from('cartas')
      .select('destino_carta_id')
      .not('destino_carta_id', 'is', null);
    if (errElegidas) throw errElegidas;

    const elegidasSet = new Set((elegidas || []).map((r) => r.destino_carta_id));
    const bolsa = (aprobadas || [])
      .filter((c) => !elegidasSet.has(c.id))
      .map((c) => ({ id: c.id, seudonimo: c.seudonimo, saludo: c.saludo }));

    const cerradoPorPlazo = Date.now() > new Date(PLAZO_UTC).getTime();
    const cerradoPorLimite = (escritas || 0) >= TOTAL;

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      escritas: escritas || 0,
      total: TOTAL,
      cerrado: cerradoPorPlazo || cerradoPorLimite,
      cerradoPorLimite,
      cerradoPorPlazo,
      bolsa
    });
  } catch (e) {
    console.error('estado.js', {
      name: e && e.name,
      message: e && e.message,
      code: e && e.code,
      details: e && e.details,
      hint: e && e.hint,
      status: e && e.status,
      stack: e && e.stack
    });
    return res.status(200).json({ escritas: 0, total: TOTAL, cerrado: false, cerradoPorLimite: false, cerradoPorPlazo: false, bolsa: [] });
  }
};
