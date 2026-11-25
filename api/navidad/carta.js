/* POST /api/navidad/carta
   Guarda una carta nueva. Toda la validación que importa vive aquí, nunca solo en el navegador:
   plazo, límite de 300, un correo = una carta activa, destino único, filtro de contenido. */
const crypto = require('crypto');
const { getSupabase } = require('./_supabase');
const filtro = require('./_filtro');

const TOTAL = 300;
const PLAZO_UTC = '2026-12-23T22:59:59Z'; // 23/12/2026 23:59 Europe/Madrid
const SALUDOS_VALIDOS = { querido: 'querido', querida: 'querida', neutro: 'otro', otro: 'otro' };

function correoValido(correo) {
  return typeof correo === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo);
}

function generaToken() {
  return crypto.randomBytes(24).toString('base64url'); // 32 caracteres, aleatorio, no secuencial
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  const seudonimo = String(body.seudonimo || '').trim().slice(0, 40);
  const correo = String(body.correo || '').trim().toLowerCase();
  const texto = String(body.texto || '').trim();
  const idea = body.idea ? String(body.idea).trim().slice(0, 400) : null;
  const saludo = SALUDOS_VALIDOS[String(body.saludo || '').trim()] || null;
  const destinoId = body.destino_carta_id ? String(body.destino_carta_id).trim() : null;
  const acepto18 = body.acepto_18 === true;

  if (!acepto18) return res.status(422).json({ error: 'Tienes que marcar que eres mayor de edad y aceptas la privacidad.' });
  if (!seudonimo) return res.status(422).json({ error: 'Escribe tu nombre o seudónimo.' });
  if (!saludo) return res.status(422).json({ error: 'Elige cómo quieres que te saluden.' });
  if (!correoValido(correo)) return res.status(422).json({ error: 'Escribe un correo válido.' });
  if (texto.length < 80) return res.status(422).json({ error: 'Tu carta necesita al menos 80 caracteres.' });
  if (texto.length > 3000) return res.status(422).json({ error: 'Tu carta es demasiado larga.' });

  const filtroTexto = filtro.revisa(texto);
  const filtroNombre = filtro.revisa(seudonimo);
  if (!filtroTexto.ok || !filtroNombre.ok) {
    return res.status(422).json({ error: 'Hay algo en tu carta o tu seudónimo que no podemos aceptar (insultos, amenazas, discriminación, contenido sexual, enlaces o datos de contacto). Revísalo e inténtalo de nuevo.' });
  }

  if (Date.now() > new Date(PLAZO_UTC).getTime()) {
    return res.status(403).json({ error: 'El plazo para escribir ha terminado.' });
  }

  let stage = 'init';
  try {
    stage = 'getSupabase';
    const supabase = getSupabase();

    stage = 'count';
    const { count: escritas, error: errCount } = await supabase
      .from('cartas')
      .select('id', { count: 'exact', head: true })
      .in('estado', ['pendiente', 'aprobada']);
    if (errCount) throw errCount;
    if ((escritas || 0) >= TOTAL) {
      return res.status(403).json({ error: 'El buzón está lleno: ya hay 300 cartas.' });
    }

    stage = 'previas';
    const { data: previas, error: errPrevias } = await supabase
      .from('cartas')
      .select('id')
      .eq('correo', correo)
      .in('estado', ['pendiente', 'aprobada'])
      .limit(1);
    if (errPrevias) throw errPrevias;
    if (previas && previas.length) {
      return res.status(409).json({ error: 'Ya hay una carta en el buzón con este correo.' });
    }

    if (destinoId) {
      stage = 'destino';
      const { data: destino, error: errDestino } = await supabase
        .from('cartas')
        .select('id, estado, recibe_carta_id')
        .eq('id', destinoId)
        .maybeSingle();
      if (errDestino) throw errDestino;
      if (!destino || destino.estado !== 'aprobada' || destino.recibe_carta_id) {
        return res.status(409).json({ error: 'Esa persona ya no está disponible. Elige otra opción o escribe al azar.' });
      }
    }

    stage = 'insert';
    const token = generaToken();
    const { data: insertada, error: errInsert } = await supabase
      .from('cartas')
      .insert({
        token,
        correo,
        seudonimo,
        saludo,
        idea,
        texto,
        destino_carta_id: destinoId || null,
        estado: 'pendiente',
        acepto_18_privacidad_at: new Date().toISOString()
      })
      .select('id, token')
      .single();

    if (errInsert) {
      if (errInsert.code === '23505') {
        if (String(errInsert.message || '').includes('destino')) {
          return res.status(409).json({ error: 'Esa persona ya ha sido elegida por otra carta justo ahora. Elige otra opción o escribe al azar.' });
        }
        return res.status(409).json({ error: 'Ya hay una carta en el buzón con este correo.' });
      }
      throw errInsert;
    }

    return res.status(201).json({ ok: true, id: insertada.id, token: insertada.token });
  } catch (e) {
    console.error('carta.js', stage, {
      name: e && e.name,
      message: e && e.message,
      code: e && e.code,
      details: e && e.details,
      hint: e && e.hint,
      status: e && e.status,
      stack: e && e.stack,
      stringified: (() => { try { return JSON.stringify(e); } catch (x) { return 'no-json'; } })(),
      toString: (() => { try { return String(e); } catch (x) { return 'no-string'; } })(),
      keys: (() => { try { return Object.keys(e || {}); } catch (x) { return 'no-keys'; } })()
    });
    return res.status(500).json({ error: 'No hemos podido guardar tu carta. Inténtalo de nuevo en un momento.' });
  }
};
