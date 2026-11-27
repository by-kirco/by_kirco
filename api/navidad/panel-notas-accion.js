/* POST /api/navidad/panel-notas-accion — solo con sesión de Sara.
   body: { id, accion: 'reenviar' | 'descartar' }
   Reenviar: manda el email "Alguien te da las gracias" a quien escribió la carta agradecida,
   firmado con el seudónimo de quien la recibió (y escribió la nota), y marca la nota como reenviada.
   Descartar: marca la nota como descartada, sin enviar nada. */
const { requiereSesion } = require('./_auth');
const { getSupabase } = require('./_supabase');
const { enviaEmail } = require('./_resend');
const { plantillaNotaReenviada } = require('./_emailTemplates');

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
  if (!id || !['reenviar', 'descartar'].includes(accion)) {
    return res.status(422).json({ error: 'Faltan datos de la acción.' });
  }

  try {
    const supabase = getSupabase();

    if (accion === 'descartar') {
      const { data, error } = await supabase
        .from('notas')
        .update({ estado: 'descartada' })
        .eq('id', id)
        .eq('estado', 'pendiente')
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) return res.status(409).json({ error: 'Esa nota ya no está pendiente.' });
      return res.status(200).json({ ok: true, id: data.id });
    }

    const { data: nota, error: errNota } = await supabase
      .from('notas')
      .select('id, carta_id, texto, estado')
      .eq('id', id)
      .maybeSingle();
    if (errNota) throw errNota;
    if (!nota || nota.estado !== 'pendiente') return res.status(409).json({ error: 'Esa nota ya no está pendiente.' });

    const { data: cartaDe, error: errCarta } = await supabase
      .from('cartas')
      .select('id, correo, seudonimo, recibe_carta_id')
      .eq('id', nota.carta_id)
      .maybeSingle();
    if (errCarta) throw errCarta;
    if (!cartaDe) return res.status(500).json({ error: 'No se encuentra la carta de esta nota.' });

    let seudonimoFirma = 'alguien';
    if (cartaDe.recibe_carta_id) {
      const { data: cartaFirma, error: errFirma } = await supabase
        .from('cartas')
        .select('seudonimo')
        .eq('id', cartaDe.recibe_carta_id)
        .maybeSingle();
      if (errFirma) throw errFirma;
      if (cartaFirma) seudonimoFirma = cartaFirma.seudonimo;
    }

    const plantilla = plantillaNotaReenviada({ seudonimo: cartaDe.seudonimo, textoNota: nota.texto, seudonimoDestinatario: seudonimoFirma });
    const envio = await enviaEmail({ to: cartaDe.correo, subject: plantilla.subject, html: plantilla.html });
    if (!envio.ok) return res.status(502).json({ error: 'No se pudo enviar el email: ' + envio.error });

    const { data: actualizada, error: errUpdate } = await supabase
      .from('notas')
      .update({ estado: 'reenviada' })
      .eq('id', id)
      .eq('estado', 'pendiente')
      .select('id')
      .maybeSingle();
    if (errUpdate) throw errUpdate;
    if (!actualizada) return res.status(409).json({ error: 'El email se envió, pero otra persona gestionó la nota a la vez.' });

    return res.status(200).json({ ok: true, id: actualizada.id });
  } catch (e) {
    console.error('panel-notas-accion.js', { name: e && e.name, message: e && e.message, code: e && e.code, details: e && e.details, hint: e && e.hint });
    return res.status(500).json({ error: 'No hemos podido completar la acción. Inténtalo de nuevo.' });
  }
};
