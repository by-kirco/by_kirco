/* GET /api/navidad/panel-datos — solo con sesión de Sara.
   Devuelve KPIs, la cola de revisión, la tabla de últimas cartas y (de momento vacías) las notas. */
const { requiereSesion } = require('./_auth');
const { getSupabase } = require('./_supabase');
const filtro = require('./_filtro');

function fechaCorta(iso) {
  try {
    return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch (e) { return iso; }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método no permitido.' });
  }
  const usuario = await requiereSesion(req, res);
  if (!usuario) return;

  try {
    const supabase = getSupabase();
    const { data: cartas, error } = await supabase
      .from('cartas')
      .select('id, seudonimo, correo, idea, texto, destino_carta_id, estado, recibe_carta_id, creada_at')
      .order('creada_at', { ascending: true });
    if (error) throw error;

    const porId = new Map((cartas || []).map((c) => [c.id, c]));
    const nombrePara = (c) => {
      if (!c.destino_carta_id) return 'Al azar';
      const d = porId.get(c.destino_carta_id);
      return d ? d.seudonimo : 'Al azar';
    };

    const pendientes = (cartas || []).filter((c) => c.estado === 'pendiente');
    const aprobadas = (cartas || []).filter((c) => c.estado === 'aprobada');
    const rechazadas = (cartas || []).filter((c) => c.estado === 'rechazada');
    const conDestino = (cartas || []).filter((c) => !!c.destino_carta_id);
    const alAzar = (cartas || []).filter((c) => !c.destino_carta_id);

    const { data: reserva, error: errReserva } = await supabase
      .from('cartas_reserva')
      .select('id, usada');
    if (errReserva) throw errReserva;
    const reservaTotal = (reserva || []).length;
    const reservaUsadas = (reserva || []).filter((r) => r.usada).length;

    const kpis = [
      { label: 'Escritas', valor: cartas.length, nota: 'Pendientes + aprobadas + rechazadas', clase: 'kpi' },
      { label: 'Por revisar', valor: pendientes.length, nota: 'Esperando a Sara', clase: 'kpi naranja' },
      { label: 'En la bolsa', valor: aprobadas.filter((c) => !c.recibe_carta_id).length, nota: 'Aprobadas, sin repartir', clase: 'kpi' },
      { label: 'Rechazadas', valor: rechazadas.length, nota: 'No se enviaron', clase: 'kpi naranja' },
      { label: 'Con destino', valor: conDestino.length, nota: 'Eligieron a alguien', clase: 'kpi' },
      { label: 'Al azar', valor: alAzar.length, nota: 'Desconocido al azar', clase: 'kpi' },
      { label: 'Reserva', valor: `${reservaUsadas}/${reservaTotal}`, nota: 'Usadas, solo si faltan cartas', clase: 'kpi' }
    ];

    const cola = pendientes.map((c) => {
      const r = filtro.revisa(`${c.seudonimo} ${c.texto || ''}`);
      return {
        id: c.id,
        nombre: c.seudonimo,
        para: nombrePara(c),
        fecha: fechaCorta(c.creada_at),
        texto: c.texto || '',
        tono: r.ok ? 'green' : 'yellow',
        aviso: r.ok ? 'Sin avisos del filtro' : 'El filtro marcó algo: revisar con atención'
      };
    });

    const ultimas = (cartas || [])
      .slice()
      .sort((a, b) => new Date(b.creada_at) - new Date(a.creada_at))
      .slice(0, 100)
      .map((c) => ({
        nombre: c.seudonimo,
        correo: c.correo,
        para: nombrePara(c),
        estado: c.estado,
        tono: c.estado === 'aprobada' ? 'green' : c.estado === 'rechazada' ? 'orange' : 'yellow',
        fecha: fechaCorta(c.creada_at)
      }));

    const { data: notasPendientes, error: errNotas } = await supabase
      .from('notas')
      .select('id, carta_id, texto, estado, creada_at')
      .eq('estado', 'pendiente')
      .order('creada_at', { ascending: true });
    if (errNotas) throw errNotas;

    const notas = (notasPendientes || []).map((n) => {
      const cartaDe = porId.get(n.carta_id); // la carta que se agradece (a quien le llega el email)
      const cartaFirma = cartaDe && cartaDe.recibe_carta_id ? porId.get(cartaDe.recibe_carta_id) : null; // quien la escribe (firma la nota)
      return {
        id: n.id,
        de: cartaFirma ? cartaFirma.seudonimo : '—',
        para: cartaDe ? cartaDe.seudonimo : '—',
        fecha: fechaCorta(n.creada_at),
        texto: n.texto,
        tono: 'yellow',
        estado: 'pendiente'
      };
    });

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ kpis, cola, notas, ultimas, vacio: cola.length === 0 });
  } catch (e) {
    console.error('panel-datos.js', { name: e && e.name, message: e && e.message, code: e && e.code, details: e && e.details, hint: e && e.hint });
    return res.status(500).json({ error: 'No hemos podido cargar los datos del panel.' });
  }
};
