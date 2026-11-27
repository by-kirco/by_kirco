/* POST /api/navidad/panel-repartir — solo con sesión de Sara.
   Reparto MANUAL, para probar antes del 25: empareja las cartas aprobadas que todavía no
   se han repartido (recibe_carta_id a null) y manda el email de entrega de verdad.

   Respeta los destinos elegidos a mano (destino_carta_id): si A eligió a B, B recibe la de A.
   El resto ("al azar") se reparte entre sí mismas, sin que nadie se escriba a sí mismo.

   Esto NO es el reparto automático del 25 de diciembre (eso sigue sin construirse: haría
   falta un cron a las 00:00 hora de Madrid). Es un disparador manual para pruebas, pensado
   para usarse con un puñado de cartas de prueba, no con el buzón real completo. */
const { requiereSesion } = require('./_auth');
const { getSupabase } = require('./_supabase');
const { enviaEmail } = require('./_resend');
const { plantillaEntrega } = require('./_emailTemplates');

function baraja(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function emparejaSinAutoenvio(senders, targets) {
  for (let intento = 0; intento < 60; intento++) {
    const mezclados = baraja(targets);
    const asign = senders.map((s, i) => ({ sender: s, target: mezclados[i] }));
    let conflictos = asign.filter((a) => a.sender.id === a.target.id);
    if (conflictos.length) {
      for (const c of conflictos) {
        const otro = asign.find((a) => a !== c && a.sender.id !== c.target.id && a.target.id !== c.sender.id);
        if (otro) { const tmp = c.target; c.target = otro.target; otro.target = tmp; }
      }
      conflictos = asign.filter((a) => a.sender.id === a.target.id);
    }
    if (!conflictos.length) return asign;
  }
  return null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido.' });
  }
  const usuario = await requiereSesion(req, res);
  if (!usuario) return;

  try {
    const supabase = getSupabase();
    const { data: aprobadas, error } = await supabase
      .from('cartas')
      .select('id, token, seudonimo, correo, destino_carta_id, recibe_carta_id, estado')
      .eq('estado', 'aprobada')
      .is('recibe_carta_id', null)
      .is('recibe_reserva_id', null);
    if (error) throw error;

    const pool = aprobadas || [];
    if (pool.length < 2) {
      return res.status(422).json({ error: 'Hacen falta al menos 2 cartas aprobadas sin repartir todavía.' });
    }

    const poolIds = new Set(pool.map((c) => c.id));
    const huerfanas = pool.filter((c) => c.destino_carta_id && !poolIds.has(c.destino_carta_id));
    if (huerfanas.length) {
      return res.status(409).json({ error: `${huerfanas.length} carta(s) eligieron a alguien que ya no está disponible para repartir. Revísalas antes de continuar.` });
    }

    const manuales = pool.filter((c) => c.destino_carta_id);
    const usados = new Set(manuales.map((c) => c.destino_carta_id));
    const objetivosRestantes = pool.filter((c) => !usados.has(c.id));
    const remitentesAzar = pool.filter((c) => !c.destino_carta_id);

    if (objetivosRestantes.length !== remitentesAzar.length) {
      return res.status(500).json({ error: 'El reparto no cuadra (más destinos elegidos que cartas disponibles). Avisa para revisarlo a mano.' });
    }

    const parejasAzar = remitentesAzar.length ? emparejaSinAutoenvio(remitentesAzar, objetivosRestantes) : [];
    if (parejasAzar === null) {
      return res.status(409).json({ error: 'No se puede repartir así: alguien se quedaría escribiéndose a sí mismo. Añade otra carta aprobada e inténtalo de nuevo.' });
    }

    const todasLasParejas = manuales.map((c) => {
      const destino = pool.find((p) => p.id === c.destino_carta_id);
      return { sender: c, target: destino };
    }).concat(parejasAzar);

    const ahora = new Date().toISOString();
    const resultados = [];
    for (const pareja of todasLasParejas) {
      const { data: actualizada, error: errUpdate } = await supabase
        .from('cartas')
        .update({ recibe_carta_id: pareja.sender.id, enviada_25_at: ahora })
        .eq('id', pareja.target.id)
        .is('recibe_carta_id', null)
        .is('recibe_reserva_id', null)
        .select('id, token, seudonimo, correo, estado')
        .maybeSingle();
      if (errUpdate) { resultados.push({ id: pareja.target.id, ok: false, error: errUpdate.message }); continue; }
      if (!actualizada) { resultados.push({ id: pareja.target.id, ok: false, error: 'Ya tenía una carta asignada.' }); continue; }

      const enlaceCarta = `https://www.bykirco.com/navidad/abrir.html?t=${actualizada.token}`;
      const plantilla = plantillaEntrega({ seudonimo: actualizada.seudonimo, enlaceCarta, bloqueSiAprobada: actualizada.estado === 'aprobada' });
      const envio = await enviaEmail({ to: actualizada.correo, subject: plantilla.subject, html: plantilla.html });
      resultados.push({ id: actualizada.id, ok: true, email: envio.ok });
      if (!envio.ok) console.error('panel-repartir.js: email no enviado', envio.error);
    }

    const repartidas = resultados.filter((r) => r.ok).length;
    return res.status(200).json({ ok: true, repartidas, total: todasLasParejas.length, resultados });
  } catch (e) {
    console.error('panel-repartir.js', { name: e && e.name, message: e && e.message, code: e && e.code, details: e && e.details, hint: e && e.hint });
    return res.status(500).json({ error: 'No he podido repartir las cartas. Inténtalo de nuevo.' });
  }
};
