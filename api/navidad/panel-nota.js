/* POST /api/navidad/panel-nota — solo con sesión de Sara.
   body: { id, accion: 'reenviar' | 'descartar' | 'leida' }
   - reenviar: solo si la carta recibida era de una persona: encola el 5.º correo ('nota') a quien
     la escribió, con la nota y el seudónimo de quien la deja.
   - leida: para notas a Kirco (cartas de reserva). Se quedan en el panel; nunca salen por correo.
   - descartar: no se envía. */
const { requiereSesion } = require('./_auth');
const { getSupabase } = require('./_supabase');
const correo = require('./_correo');

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
  if (!id || !['reenviar', 'descartar', 'leida'].includes(accion)) return res.status(422).json({ error: 'Faltan datos de la acción.' });

  try {
    const supabase = getSupabase();
    const { data: nota, error } = await supabase.from('notas').select('id, carta_id, estado').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!nota) return res.status(404).json({ error: 'No encuentro esa nota.' });
    if (nota.estado !== 'pendiente') return res.status(409).json({ error: 'Esa nota ya está gestionada.' });

    const { data: receptor, error: e2 } = await supabase.from('cartas').select('id, recibe_carta_id, recibe_reserva_id').eq('id', nota.carta_id).maybeSingle();
    if (e2) throw e2;
    const esReserva = !receptor || !receptor.recibe_carta_id;

    if (accion === 'reenviar' && esReserva) return res.status(409).json({ error: 'Esta nota es para Kirco (carta de reserva): no se reenvía por correo. Márcala como leída.' });
    if (accion === 'leida' && !esReserva) return res.status(409).json({ error: 'Esta nota es para quien escribió la carta: reenvíala o descártala.' });

    const nuevo = accion === 'reenviar' ? 'reenviada' : accion === 'leida' ? 'leida' : 'descartada';
    const { data: upd, error: e3 } = await supabase.from('notas').update({ estado: nuevo }).eq('id', id).eq('estado', 'pendiente').select('id, estado').maybeSingle();
    if (e3) throw e3;
    if (!upd) return res.status(409).json({ error: 'Esa nota ya está gestionada.' });

    let envio = null;
    if (accion === 'reenviar') envio = await correo.encolarYEnviar(supabase, receptor.recibe_carta_id, 'nota');
    return res.status(200).json({ ok: true, estado: nuevo, correo: envio && envio.estado });
  } catch (e) {
    console.error('panel-nota.js', { message: e && e.message, code: e && e.code });
    return res.status(500).json({ error: 'No hemos podido guardar el cambio. Inténtalo de nuevo.' });
  }
};
