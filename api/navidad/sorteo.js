/* GET/POST /api/navidad/sorteo — solo con sesión de Sara.
   GET: el sorteo ya hecho (fecha, participantes, huella...) o null, y la estimación de reservas.
   POST { confirmar: true, aceptar_pendientes?: true }: hace el sorteo UNA sola vez.
     - Solo después del cierre del buzón (23/12 23:59 Madrid).
     - Si quedan cartas sin revisar, pide aceptar_pendientes (esas cartas no se entregan; sus
       autores reciben una carta de reserva).
     - Idempotente: si ya hay sorteo, devuelve el existente y no repite nada.
     - Tras guardarlo (función SQL atómica navidad_registrar_sorteo), programa los correos de
       entrega con Resend para el 25/12 00:00 (Madrid). Un fallo de correo no deshace el sorteo:
       queda 'pendiente' y se reintenta desde el panel o con el cron diario.
   Algoritmo y casos límite: ver _sorteo_core.js. */
const { requiereSesion } = require('./_auth');
const { getSupabase } = require('./_supabase');
const core = require('./_sorteo_core');
const correo = require('./_correo');
const { EDICION, PLAZO_UTC, APERTURA_UTC } = require('./_config');

function ahora() { return (module.exports._ahora || Date.now)(); }

function resumenPublico(s) {
  if (!s) return null;
  return {
    ejecutado_at: s.ejecutado_at,
    participantes: s.participantes,
    cartas_persona: s.cartas_persona,
    reservas_usadas: s.reservas_usadas,
    semilla: s.semilla,
    huella_sha256: s.huella_sha256,
    huella_entrada: s.huella_entrada,
    version_codigo: s.version_codigo
  };
}

async function sorteoExistente(supabase) {
  const { data, error } = await supabase
    .from('sorteos')
    .select('ejecutado_at, participantes, cartas_persona, reservas_usadas, semilla, huella_sha256, huella_entrada, version_codigo')
    .eq('edicion', EDICION)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function leerEntrada(supabase) {
  const { data: cartas, error } = await supabase.from('cartas').select('id, correo, estado, destino_carta_id, creada_at');
  if (error) throw error;
  const { data: reservas, error: e2 } = await supabase.from('cartas_reserva').select('id, usos');
  if (e2) throw e2;
  return { cartas: cartas || [], entrada: core.prepararEntrada(cartas || [], reservas || [], EDICION) };
}

async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Método no permitido.' });
  }
  const usuario = await requiereSesion(req, res);
  if (!usuario) return;
  res.setHeader('Cache-Control', 'no-store');

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  try {
    const supabase = getSupabase();
    const existente = await sorteoExistente(supabase);

    if (req.method === 'GET') {
      const { entrada } = await leerEntrada(supabase);
      return res.status(200).json({ sorteo: resumenPublico(existente), estimacion: core.estimarReservas(entrada), cerrado: ahora() > new Date(PLAZO_UTC).getTime() });
    }

    if (existente) return res.status(200).json({ ok: true, ya_existia: true, sorteo: resumenPublico(existente) });
    if (body.confirmar !== true) return res.status(422).json({ error: 'Falta confirmar el sorteo.' });
    if (ahora() <= new Date(PLAZO_UTC).getTime()) {
      return res.status(409).json({ error: 'El sorteo solo se puede hacer cuando se cierre el buzón (23/12 a las 23:59).' });
    }

    const { cartas, entrada } = await leerEntrada(supabase);
    const pendientes = cartas.filter((c) => c.estado === 'pendiente').length;
    if (pendientes > 0 && body.aceptar_pendientes !== true) {
      return res.status(409).json({ error: 'Quedan ' + pendientes + ' cartas sin revisar. Si sorteas ahora, no se entregarán y sus autores recibirán una carta de reserva.', pendientes });
    }
    if (!entrada.cartas.length) return res.status(409).json({ error: 'No hay ninguna carta.' });

    const semilla = core.nuevaSemilla();
    let r;
    try {
      r = core.ejecutar(entrada, semilla);
    } catch (e) {
      if (e.codigo === 'SIN_RESERVAS') return res.status(409).json({ error: e.message + ' Carga las cartas de reserva antes de sortear.', necesarias: e.necesarias });
      throw e;
    }

    const { data: reg, error: errRpc } = await supabase.rpc('navidad_registrar_sorteo', {
      p_sorteo: {
        edicion: EDICION,
        participantes: r.resumen.participantes,
        cartas_persona: r.resumen.cartas_persona,
        reservas_usadas: r.resumen.reservas_usadas,
        semilla,
        entrada,
        resultado: { asignaciones: r.asignaciones, avisos: r.avisos, resumen: r.resumen },
        huella_entrada: r.huella_entrada,
        huella_sha256: r.huella_sha256,
        version_codigo: r.version,
        entrega_at: APERTURA_UTC
      },
      p_asignaciones: r.asignaciones,
      p_usos: r.usos
    });
    if (errRpc) {
      if (String(errRpc.message || '').includes('NAVIDAD_ENTRADA_CAMBIADA')) {
        return res.status(409).json({ error: 'Las cartas han cambiado mientras se sorteaba. Vuelve a intentarlo.' });
      }
      throw errRpc;
    }
    if (reg && reg.ya_existia) return res.status(200).json({ ok: true, ya_existia: true, sorteo: resumenPublico(reg.sorteo) });

    let correos = null;
    try { correos = await correo.programarEntregas(supabase); } catch (e) {
      console.error('sorteo.js programarEntregas', { code: e && e.code, message: e && e.message });
    }
    return res.status(200).json({ ok: true, ya_existia: false, sorteo: resumenPublico(reg && reg.sorteo), resumen: r.resumen, avisos: r.avisos, correos });
  } catch (e) {
    console.error('sorteo.js', { name: e && e.name, message: e && e.message, code: e && e.code });
    return res.status(500).json({ error: 'No se ha podido hacer el sorteo. No se ha guardado nada; inténtalo de nuevo.' });
  }
}

module.exports = handler;
module.exports._ahora = null;
