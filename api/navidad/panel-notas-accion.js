/* POST /api/navidad/panel-notas-accion — solo con sesión de Sara.
   body: { id, accion: 'reenviar' | 'descartar' }
   Reenviar: manda el email "Alguien te da las gracias" a quien escribió la carta agradecida,
   firmado con el seudónimo de quien la recibió (y escribió la nota), y marca la nota como
   reenviada. Si la carta agradecida era una carta de reserva (sin autor real, firmada "Kirco"),
   se manda a by.kirco@gmail.com en su lugar, como si la hubiese escrito esa cuenta.
   Descartar: marca la nota como descartada, sin enviar nada. */
const { requiereSesion } = require('./_auth');
const { getSupabase } = require('./_supabase');
const { enviaEmail } = require('./_resend');
const { plantillaNotaReenviada } = require('./_emailTemplates');

const CORREO_RESERVA = 'by.kirco@gmail.com';

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

    // cartaDe = quien escribió la nota de agradecimiento (quien recibió la carta original).
    function construyeConsultaCartaDe(conReserva) {
      const cols = 'id, seudonimo, recibe_carta_id' + (conReserva ? ', recibe_reserva_id' : '');
      return supabase.from('cartas').select(cols).eq('id', nota.carta_id).maybeSingle();
    }
    let { data: cartaDe, error: errCarta } = await construyeConsultaCartaDe(true);
    // recibe_reserva_id es una columna nueva: si este proyecto de Supabase todavía no la tiene,
    // se repite la consulta sin ella en vez de romper el reenvío de notas.
    if (errCarta && String(errCarta.message || '').includes('recibe_reserva_id')) {
      console.error('panel-notas-accion.js: recibe_reserva_id no disponible (¿falta aplicar schema.sql?)', errCarta.message);
      ({ data: cartaDe, error: errCarta } = await construyeConsultaCartaDe(false));
      if (cartaDe) cartaDe.recibe_reserva_id = null;
    }
    if (errCarta) throw errCarta;
    if (!cartaDe) return res.status(500).json({ error: 'No se encuentra la carta de esta nota.' });

    // correoAutor/seudonimoAutor = a quién se le manda el agradecimiento: quien escribió la
    // carta original, o by.kirco@gmail.com si venía de la reserva (sin autor real, firma "Kirco").
    let correoAutor, seudonimoAutor;
    if (cartaDe.recibe_carta_id) {
      const { data: autor, error: errAutor } = await supabase
        .from('cartas')
        .select('seudonimo, correo')
        .eq('id', cartaDe.recibe_carta_id)
        .maybeSingle();
      if (errAutor) throw errAutor;
      if (!autor) return res.status(500).json({ error: 'No se encuentra quien escribió la carta original.' });
      correoAutor = autor.correo;
      seudonimoAutor = autor.seudonimo;
    } else if (cartaDe.recibe_reserva_id) {
      correoAutor = CORREO_RESERVA;
      seudonimoAutor = 'Kirco';
    } else {
      return res.status(409).json({ error: 'Esta carta todavía no tiene una carta original asociada: no se puede reenviar.' });
    }

    const plantilla = plantillaNotaReenviada({ seudonimoAutor, textoNota: nota.texto, seudonimoFirma: cartaDe.seudonimo });
    const envio = await enviaEmail({ to: correoAutor, subject: plantilla.subject, html: plantilla.html });
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
