/* by_kirco · Navidad — envío de correos con Resend (API REST con fetch, sin dependencias nuevas)
   y cola en la tabla `correos` de Supabase.

   Variables de entorno (solo en Vercel, nunca en el repo):
     RESEND_API_KEY      clave de Resend. SIN CLAVE = MODO SIMULACIÓN: el correo se marca 'simulado'
                         y no se llama a Resend (sirve para previews y pruebas).
     CORREO_REMITENTE    por defecto «by_kirco <cartas@bykirco.com>» (dominio verificado en Resend).
     CORREO_RESPONDER_A  opcional (p. ej. by.kirco@gmail.com).

   Estados de una fila de `correos`:
     pendiente  → aún no ha salido (cuota de Resend agotada, error de red...). Lo reintenta
                  /api/navidad/correos-pendientes (cron diario o botón del panel).
     programado → aceptado por Resend con scheduled_at futuro (el de la entrega del 25).
     enviado    → aceptado por Resend para salir ya.
     simulado   → modo simulación (sin RESEND_API_KEY).
     error      → Resend lo rechazó (p. ej. 422). Se reintenta hasta MAX_INTENTOS.
   Resend NO reintenta los 429 (daily_quota_exceeded / monthly_quota_exceeded / rate_limit_exceeded):
   el correo se queda 'pendiente' y se para el lote para no gastar llamadas.

   Privacidad: no se guarda el cuerpo del correo (ni HTML ni texto) y en los logs solo salen el
   tipo y el id interno de la carta, nunca la dirección ni el contenido. */
const crypto = require('crypto');
const { construir } = require('./_plantilla_correo');
const { APERTURA_UTC } = require('./_config');

const API = 'https://api.resend.com';
const MAX_LOTE = 100; // límite de /emails/batch
const MAX_INTENTOS = 5;
const ERRORES_CUOTA = ['daily_quota_exceeded', 'monthly_quota_exceeded', 'rate_limit_exceeded'];

function config() {
  return {
    clave: process.env.RESEND_API_KEY || '',
    remitente: process.env.CORREO_REMITENTE || 'by_kirco <cartas@bykirco.com>',
    responderA: process.env.CORREO_RESPONDER_A || ''
  };
}

function modoSimulacion() { return !config().clave; }

function fetchImpl() {
  if (module.exports._fetch) return module.exports._fetch; // pruebas
  return fetch;
}

/* Llama a Resend. Devuelve { ok, datos } | { ok:false, cuota:true, nombre } | { ok:false, error, reintentable } */
async function llamarResend(ruta, cuerpo, claveIdempotencia) {
  const { clave } = config();
  let r;
  try {
    r = await fetchImpl()(API + ruta, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + clave,
        'Content-Type': 'application/json',
        'Idempotency-Key': claveIdempotencia
      },
      body: JSON.stringify(cuerpo)
    });
  } catch (e) {
    return { ok: false, error: 'red: ' + (e && e.message), reintentable: true };
  }
  let datos = null;
  try { datos = await r.json(); } catch (e) { datos = null; }
  if (r.status >= 200 && r.status < 300) return { ok: true, datos };
  const nombre = (datos && (datos.name || datos.type)) || '';
  if (r.status === 429 || ERRORES_CUOTA.includes(nombre)) {
    return { ok: false, cuota: true, nombre: nombre || 'http_429', error: 'Resend ' + r.status + ' ' + (nombre || '') };
  }
  return { ok: false, error: 'Resend ' + r.status + ' ' + nombre + ' ' + String((datos && datos.message) || '').slice(0, 200), reintentable: r.status >= 500 };
}

/* ---------- datos para montar cada correo (se leen en el momento; no se guardan) ---------- */
async function cargarDatos(supabase, filas) {
  const ids = Array.from(new Set(filas.map((f) => f.carta_id)));
  const { data: cartas, error } = await supabase
    .from('cartas')
    .select('id, correo, seudonimo, token, estado, motivo_rechazo, recibe_carta_id, recibe_reserva_id')
    .in('id', ids);
  if (error) throw error;
  const porId = new Map((cartas || []).map((c) => [c.id, c]));

  const extra = { entregadas: new Set(), aprobadaPorCorreo: new Map(), notas: new Map() };
  if (filas.some((f) => f.tipo === 'entrega')) {
    const { data: rec, error: e1 } = await supabase.from('cartas').select('recibe_carta_id').not('recibe_carta_id', 'is', null);
    if (e1) throw e1;
    (rec || []).forEach((r) => extra.entregadas.add(r.recibe_carta_id));
    const { data: apr, error: e2 } = await supabase.from('cartas').select('id, correo').eq('estado', 'aprobada');
    if (e2) throw e2;
    (apr || []).forEach((c) => extra.aprobadaPorCorreo.set(String(c.correo).toLowerCase(), c.id));
  }
  if (filas.some((f) => f.tipo === 'nota')) {
    // la nota la deja quien RECIBIÓ la carta: su fila tiene recibe_carta_id = carta de quien escribió
    const escritores = filas.filter((f) => f.tipo === 'nota').map((f) => f.carta_id);
    const { data: receptores, error: e3 } = await supabase.from('cartas').select('id, seudonimo, recibe_carta_id').in('recibe_carta_id', escritores);
    if (e3) throw e3;
    const ridx = (receptores || []).map((r) => r.id);
    const { data: notas, error: e4 } = ridx.length
      ? await supabase.from('notas').select('carta_id, texto, estado').in('carta_id', ridx)
      : { data: [], error: null };
    if (e4) throw e4;
    const notaPorReceptor = new Map((notas || []).map((n) => [n.carta_id, n]));
    (receptores || []).forEach((r) => {
      const n = notaPorReceptor.get(r.id);
      if (n) extra.notas.set(r.recibe_carta_id, { texto: n.texto, seudonimo_nota: r.seudonimo });
    });
  }
  return { porId, extra };
}

function montar(fila, porId, extra) {
  const c = porId.get(fila.carta_id);
  if (!c || !c.correo) return null;
  const datos = { seudonimo: c.seudonimo };
  if (fila.tipo === 'rechazada') datos.motivo = c.motivo_rechazo;
  if (fila.tipo === 'entrega') {
    datos.token = c.token;
    const suya = extra.aprobadaPorCorreo.get(String(c.correo).toLowerCase());
    datos.aprobada_entregada = !!(suya && extra.entregadas.has(suya));
  }
  if (fila.tipo === 'nota') {
    const n = extra.notas.get(fila.carta_id);
    if (!n) return null;
    datos.nota = n.texto;
    datos.seudonimo_nota = n.seudonimo_nota;
  }
  const m = construir(fila.tipo, datos);
  const { remitente, responderA } = config();
  const msg = { from: remitente, to: [c.correo], subject: m.asunto, html: m.html, text: m.texto, tags: [{ name: 'campana', value: 'navidad-2026' }, { name: 'tipo', value: fila.tipo }] };
  if (responderA) msg.reply_to = responderA;
  const prog = fila.programado_para ? new Date(fila.programado_para).getTime() : 0;
  if (prog && prog > ahora() + 60 * 1000) msg.scheduled_at = new Date(prog).toISOString();
  return msg;
}

function ahora() { return (module.exports._ahora || Date.now)(); }

async function actualizar(supabase, fila, cambios) {
  const { error } = await supabase.from('correos').update(cambios).eq('id', fila.id);
  if (error) console.error('correo.actualizar', { id: fila.id, code: error.code, message: error.message });
}

/* Envía una lista de filas de `correos` (de cualquier tipo). Devuelve un resumen por estado. */
async function procesarFilas(supabase, filas) {
  const resumen = { enviado: 0, programado: 0, simulado: 0, pendiente: 0, error: 0, omitido: 0, cuota: null };
  if (!filas || !filas.length) return resumen;
  const { porId, extra } = await cargarDatos(supabase, filas);

  const listos = [];
  for (const f of filas) {
    const msg = montar(f, porId, extra);
    if (!msg) {
      resumen.omitido++;
      await actualizar(supabase, f, { estado: 'error', intentos: (f.intentos || 0) + 1, ultimo_error: 'sin datos para montar el correo' });
      continue;
    }
    listos.push({ fila: f, msg });
  }

  if (modoSimulacion()) {
    for (const { fila } of listos) {
      console.log('[correo simulado]', fila.tipo, fila.carta_id);
      await actualizar(supabase, fila, { estado: 'simulado', intentos: (fila.intentos || 0) + 1, enviado_at: new Date(ahora()).toISOString(), ultimo_error: null });
      resumen.simulado++;
    }
    return resumen;
  }

  for (let i = 0; i < listos.length; i += MAX_LOTE) {
    const lote = listos.slice(i, i + MAX_LOTE);
    const clave = 'navidad-' + crypto.createHash('sha256')
      .update(lote.map((x) => x.fila.tipo + ':' + x.fila.carta_id + ':' + (x.fila.intentos || 0)).join('|')).digest('hex').slice(0, 40);
    const r = lote.length === 1
      ? await llamarResend('/emails', lote[0].msg, clave)
      : await llamarResend('/emails/batch', lote.map((x) => x.msg), clave);

    if (r.ok) {
      const ids = lote.length === 1 ? [r.datos && r.datos.id] : ((r.datos && r.datos.data) || []).map((d) => d && d.id);
      for (let k = 0; k < lote.length; k++) {
        const { fila, msg } = lote[k];
        const estado = msg.scheduled_at ? 'programado' : 'enviado';
        await actualizar(supabase, fila, { estado, resend_id: ids[k] || null, intentos: (fila.intentos || 0) + 1, enviado_at: new Date(ahora()).toISOString(), ultimo_error: null });
        resumen[estado]++;
      }
      continue;
    }
    // fallo: este lote (y, si es de cuota, los siguientes) se quedan para reintentar
    const resto = r.cuota ? listos.slice(i) : lote;
    const estado = (r.cuota || r.reintentable) ? 'pendiente' : 'error';
    for (const { fila } of resto) {
      await actualizar(supabase, fila, { estado, intentos: (fila.intentos || 0) + 1, ultimo_error: String(r.error || r.nombre).slice(0, 300) });
      resumen[estado]++;
    }
    if (r.cuota) { resumen.cuota = r.nombre; console.warn('correo: cuota de Resend agotada', r.nombre); break; }
  }
  return resumen;
}

/* Encola un correo (uno por carta y tipo; si ya existe, no se duplica) y lo intenta enviar ya.
   NUNCA lanza: un fallo de correo no debe romper la respuesta al usuario. */
async function encolarYEnviar(supabase, cartaId, tipo, opciones) {
  try {
    const fila = { carta_id: cartaId, tipo, estado: 'pendiente', programado_para: (opciones && opciones.programado_para) || null };
    const { error: errIns } = await supabase.from('correos').upsert(fila, { onConflict: 'carta_id,tipo', ignoreDuplicates: true });
    if (errIns) throw errIns;
    const { data: actual, error } = await supabase.from('correos').select('*').eq('carta_id', cartaId).eq('tipo', tipo).maybeSingle();
    if (error) throw error;
    if (!actual) return { estado: 'error' };
    if (['enviado', 'programado', 'simulado'].includes(actual.estado)) return { estado: actual.estado, duplicado: true };
    const r = await procesarFilas(supabase, [actual]);
    return { estado: Object.keys(r).find((k) => r[k] === 1 && k !== 'cuota') || 'pendiente', resumen: r };
  } catch (e) {
    console.error('correo.encolarYEnviar', tipo, cartaId, { code: e && e.code, message: e && e.message });
    return { estado: 'error' };
  }
}

/* Reintenta lo pendiente (y los errores con menos de MAX_INTENTOS). Pensado para el cron diario.
   Límite por pasada: 95, para no pasarse de los 100/día del plan gratis con una sola ejecución. */
async function reintentarPendientes(supabase, limite) {
  const { data, error } = await supabase
    .from('correos')
    .select('*')
    .in('estado', ['pendiente', 'error'])
    .lt('intentos', MAX_INTENTOS)
    .order('creado_at', { ascending: true })
    .limit(limite || 95);
  if (error) throw error;
  return procesarFilas(supabase, data || []);
}

/* Tras el sorteo: programa los correos 'entrega' (scheduled_at = 25/12 00:00 Madrid). */
async function programarEntregas(supabase) {
  const { data, error } = await supabase
    .from('correos')
    .select('*')
    .eq('tipo', 'entrega')
    .in('estado', ['pendiente', 'error'])
    .lt('intentos', MAX_INTENTOS)
    .order('creado_at', { ascending: true });
  if (error) throw error;
  const filas = (data || []).map((f) => Object.assign({}, f, { programado_para: f.programado_para || APERTURA_UTC }));
  return procesarFilas(supabase, filas);
}

module.exports = { encolarYEnviar, procesarFilas, reintentarPendientes, programarEntregas, modoSimulacion, llamarResend, MAX_INTENTOS, _fetch: null, _ahora: null };
