/* by_kirco · Navidad — núcleo del sorteo del 25 de diciembre (sin dependencias, sin red).
   Lo usan api/navidad/sorteo.js (para hacerlo) y scripts/navidad/verificar_sorteo.js (para
   reproducirlo). Mismo código = misma huella.

   QUIÉN RECIBE: todas las personas que han escrito (cualquier estado: aprobada, rechazada o sin
   revisar al cierre), UNA vez por correo. Si alguien escribió varias veces (p. ej. le rechazaron una
   y le aprobaron otra), recibe una sola carta, en la fila que la representa (la aprobada si la hay;
   si no, la pendiente; si no, la más reciente).

   QUÉ SE REPARTE: solo las cartas aprobadas, cada una a UNA persona, y cada persona recibe
   EXACTAMENTE una carta (de persona o, si no hay, de reserva). Orden:
     1. Cartas dirigidas (destino_carta_id) → a esa persona, si su carta está aprobada.
        Si el destino no es válido, la carta pasa a «al azar» (aviso 'destino_no_valido').
     2. Cartas «al azar» → entre las personas con carta aprobada que aún no reciben ninguna
        (salen exactamente tantas como cartas al azar). Nadie recibe la suya. Se intenta evitar el
        intercambio mutuo A↔B (también con las dirigidas); si no se puede (p. ej. solo 2 personas),
        se permite (aviso 'mutuo_inevitable').
        Caso límite: si queda UNA sola carta al azar y su única persona libre es quien la escribió,
        esa carta va a alguien sin carta aprobada (rechazada/sin revisar) si lo hay; si no hay nadie,
        no se entrega (aviso 'carta_sin_entregar') y su autor recibe una reserva.
     3. Reservas → a quien siga sin carta (rechazadas, sin revisar, caso límite). Primero las que
        menos usos llevan (primero las nunca usadas); si se agotan, se reutiliza la menos usada. Una
        persona solo recibe una carta, así que nunca recibe la misma dos veces.
        Sin ninguna reserva cargada y con gente que la necesita → error SIN_RESERVAS (no se sortea).

   ALEATORIEDAD: semilla de 32 bytes (crypto.randomBytes) → PRNG determinista SHA-256 en contador.
   Con la semilla + la entrada (guardadas en la tabla sorteos) el resultado se reproduce idéntico. */
'use strict';
const crypto = require('crypto');

const VERSION = 'navidad-sorteo-v1 (2026-11-26)';
const RANGO = { aprobada: 0, pendiente: 1, rechazada: 2 };
const INTENTOS_SIN_MUTUOS = 500;

function sha256(texto) {
  return crypto.createHash('sha256').update(texto, 'utf8').digest('hex');
}

/* JSON con las claves ordenadas: así la huella no depende del orden en que Postgres (jsonb) devuelva las claves */
function canonico(v) {
  if (Array.isArray(v)) return '[' + v.map(canonico).join(',') + ']';
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canonico(v[k])).join(',') + '}';
  }
  return JSON.stringify(v === undefined ? null : v);
}

function crearPrng(semillaHex) {
  if (!/^[0-9a-f]{64}$/.test(String(semillaHex))) throw new Error('La semilla debe ser 32 bytes en hexadecimal.');
  let contador = 0;
  let bloque = Buffer.alloc(0);
  let pos = 0;
  function u32() {
    if (pos + 4 > bloque.length) {
      bloque = crypto.createHash('sha256').update(semillaHex + ':' + contador).digest();
      contador += 1;
      pos = 0;
    }
    const v = bloque.readUInt32BE(pos);
    pos += 4;
    return v;
  }
  /* entero uniforme en [0, n) sin sesgo (rechazo) */
  function entero(n) {
    if (!(n >= 1)) throw new Error('entero(n) necesita n >= 1');
    const limite = Math.floor(0x100000000 / n) * n;
    let v;
    do { v = u32(); } while (v >= limite);
    return v % n;
  }
  function baraja(lista) {
    const a = lista.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = entero(i + 1);
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  return { entero, baraja };
}

const porId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/* cartas: filas de Supabase { id, correo, estado, destino_carta_id, creada_at }
   reservas: filas { id, usos }
   Devuelve la ENTRADA del sorteo: solo ids, estados y agrupación por persona (sin correos). */
function prepararEntrada(cartas, reservas, edicion) {
  const grupos = new Map();
  for (const c of cartas || []) {
    const k = String(c.correo || '').trim().toLowerCase();
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(c);
  }
  const receptorDe = new Map();
  for (const lista of grupos.values()) {
    const orden = lista.slice().sort((a, b) =>
      (RANGO[a.estado] - RANGO[b.estado]) ||
      (new Date(b.creada_at).getTime() - new Date(a.creada_at).getTime()) ||
      porId(a, b));
    for (const c of lista) receptorDe.set(c.id, orden[0].id);
  }
  return {
    edicion: edicion || 2026,
    cartas: (cartas || []).map((c) => ({
      id: c.id,
      estado: c.estado,
      destino: c.destino_carta_id || null,
      receptor: receptorDe.get(c.id)
    })).sort(porId),
    reservas: (reservas || []).map((r) => ({ id: r.id, usos: r.usos || 0 })).sort(porId)
  };
}

function ejecutar(entrada, semillaHex, opciones) {
  const opts = opciones || {};
  const prng = crearPrng(semillaHex);
  const mapa = new Map(entrada.cartas.map((c) => [c.id, c]));
  const receptores = Array.from(new Set(entrada.cartas.map((c) => c.receptor))).sort();
  const aprobadas = entrada.cartas.filter((c) => c.estado === 'aprobada');
  const recibe = new Map(); // receptor -> { tipo, id }
  const entregadaA = new Map(); // carta aprobada -> receptor
  const avisos = [];

  // 1) dirigidas
  const alAzar = [];
  for (const c of aprobadas) {
    if (c.destino) {
      const d = mapa.get(c.destino);
      if (d && d.estado === 'aprobada' && d.receptor !== c.receptor && !recibe.has(d.receptor)) {
        recibe.set(d.receptor, { tipo: 'carta', id: c.id });
        entregadaA.set(c.id, d.receptor);
        continue;
      }
      avisos.push({ codigo: 'destino_no_valido', carta: c.id });
    }
    alAzar.push(c);
  }

  // 2) al azar
  const libresAprobados = receptores.filter((r) => !recibe.has(r) && mapa.get(r).estado === 'aprobada');
  const libresOtros = receptores.filter((r) => !recibe.has(r) && mapa.get(r).estado !== 'aprobada');
  const n = alAzar.length;
  let objetivos = prng.baraja(libresAprobados);
  let otrosBarajados = prng.baraja(libresOtros);
  if (objetivos.length < n) {
    const faltan = n - objetivos.length;
    objetivos = objetivos.concat(otrosBarajados.slice(0, faltan));
    otrosBarajados = otrosBarajados.slice(faltan);
  } else {
    objetivos = objetivos.slice(0, n);
  }

  const autor = (i) => alAzar[i].receptor;
  function esMutuo(perm, i) {
    const t = perm[i];
    const a = autor(i);
    // ¿la carta de t (si t escribió una aprobada, su id es t) va a parar a a?
    if (entregadaA.get(t) === a) return true;
    const j = alAzar.findIndex((c) => c.id === t);
    return j !== -1 && perm[j] === a;
  }
  function valida(perm, sinMutuos) {
    for (let i = 0; i < perm.length; i++) {
      if (perm[i] === autor(i)) return false;
      if (sinMutuos && esMutuo(perm, i)) return false;
    }
    return true;
  }

  let perm = n === 0 ? [] : null;
  if (n === 1) {
    if (objetivos[0] !== autor(0)) perm = objetivos.slice();
    else if (otrosBarajados.length) {
      perm = [otrosBarajados[0]]; // caso límite: va a alguien sin carta aprobada
      avisos.push({ codigo: 'unica_al_azar_a_no_aprobada', carta: alAzar[0].id });
    } else {
      perm = [];
      avisos.push({ codigo: 'carta_sin_entregar', carta: alAzar[0].id });
    }
  } else if (n > 1) {
    for (let k = 0; k < INTENTOS_SIN_MUTUOS && !perm; k++) {
      const p = prng.baraja(objetivos);
      if (valida(p, true)) perm = p;
    }
    if (!perm) {
      // reparación determinista: nadie recibe la suya (siempre posible con n >= 2)
      const p = prng.baraja(objetivos);
      for (let i = 0; i < n; i++) {
        if (p[i] === autor(i)) { const j = (i + 1) % n; const t = p[i]; p[i] = p[j]; p[j] = t; }
      }
      if (!valida(p, false)) throw new Error('No se pudo repartir sin que alguien reciba su propia carta.');
      perm = p;
      avisos.push({ codigo: 'mutuo_inevitable' });
    }
  }
  for (let i = 0; i < perm.length && i < n; i++) {
    recibe.set(perm[i], { tipo: 'carta', id: alAzar[i].id });
    entregadaA.set(alAzar[i].id, perm[i]);
  }

  // 3) reservas
  const sinCarta = receptores.filter((r) => !recibe.has(r));
  const cargadas = entrada.reservas.length;
  const usosVez = {};
  if (sinCarta.length && !cargadas) {
    if (!opts.permitirSinReservas) {
      const e = new Error('Hacen falta ' + sinCarta.length + ' cartas de reserva y no hay ninguna cargada.');
      e.codigo = 'SIN_RESERVAS';
      e.necesarias = sinCarta.length;
      throw e;
    }
  } else if (sinCarta.length) {
    const orden = prng.baraja(entrada.reservas.map((r) => r.id));
    const pos = new Map(orden.map((id, i) => [id, i]));
    const usos = new Map(entrada.reservas.map((r) => [r.id, r.usos || 0]));
    for (const r of prng.baraja(sinCarta)) {
      let mejor = null;
      for (const id of orden) {
        if (mejor === null || usos.get(id) < usos.get(mejor) || (usos.get(id) === usos.get(mejor) && pos.get(id) < pos.get(mejor))) mejor = id;
      }
      recibe.set(r, { tipo: 'reserva', id: mejor });
      usos.set(mejor, usos.get(mejor) + 1);
      usosVez[mejor] = (usosVez[mejor] || 0) + 1;
    }
  }

  const asignaciones = receptores.filter((r) => recibe.has(r)).map((r) => ({ receptor: r, tipo: recibe.get(r).tipo, id: recibe.get(r).id }));
  let mutuos = 0;
  for (const [cartaId, receptor] of entregadaA) {
    if (entregadaA.get(receptor) === mapa.get(cartaId).receptor && cartaId < receptor) mutuos++;
  }
  const resumen = {
    participantes: receptores.length,
    cartas_persona: asignaciones.filter((a) => a.tipo === 'carta').length,
    reservas_usadas: asignaciones.filter((a) => a.tipo === 'reserva').length,
    reservas_necesarias: sinCarta.length,
    reservas_cargadas: cargadas,
    reservas_reutilizadas: Math.max(0, sinCarta.length - cargadas),
    sin_carta: receptores.length - asignaciones.length,
    mutuos
  };
  const huella_entrada = sha256(canonico(entrada));
  const huella_sha256 = sha256(canonico({ version: VERSION, semilla: semillaHex, entrada, asignaciones }));
  const usos = Object.keys(usosVez).sort().map((id) => ({ id, veces: usosVez[id] }));
  return { version: VERSION, semilla: semillaHex, asignaciones, usos, avisos, resumen, huella_entrada, huella_sha256 };
}

/* Cuántas reservas harían falta si se sorteara ahora (no depende de la semilla). */
function estimarReservas(entrada) {
  const r = ejecutar(entrada, '0'.repeat(64), { permitirSinReservas: true });
  return { necesarias: r.resumen.reservas_necesarias, cargadas: entrada.reservas.length, participantes: r.resumen.participantes };
}

function nuevaSemilla() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = { VERSION, prepararEntrada, ejecutar, estimarReservas, nuevaSemilla, crearPrng, canonico, sha256 };
