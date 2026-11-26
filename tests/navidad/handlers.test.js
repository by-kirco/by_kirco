'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('./_fake');
const sim = F.instalar(); // ANTES de cargar los handlers

const carta = require('../../api/navidad/carta');
const estado = require('../../api/navidad/estado');
const panelAccion = require('../../api/navidad/panel-accion');
const panelDatos = require('../../api/navidad/panel-datos');
const panelNota = require('../../api/navidad/panel-nota');
const sorteo = require('../../api/navidad/sorteo');
const abrir = require('../../api/navidad/abrir');
const pendientes = require('../../api/navidad/correos-pendientes');
const correo = require('../../api/navidad/_correo');
const { APERTURA_UTC, CADUCIDAD_UTC } = require('../../api/navidad/_config');

const TRAS_CIERRE = Date.parse('2026-12-24T09:00:00Z');
const TEXTO = 'Querida persona desconocida, esta es una carta de prueba con más de ochenta caracteres para pasar la validación. ';

function sinClave() { delete process.env.RESEND_API_KEY; correo._fetch = null; }
async function llama(h, rq) { const r = F.res(); await h(rq, r); return r; }
async function nuevaCarta(o) {
  const r = await llama(carta, F.req('POST', Object.assign({ seudonimo: 'Seud' + Math.random().toString(36).slice(2, 6), correo: 'c' + Math.random().toString(36).slice(2, 8) + '@x.es', texto: TEXTO, saludo: 'querida', acepto_18: true }, o)));
  assert.equal(r.statusCode, 201, JSON.stringify(r.cuerpo));
  return r.cuerpo;
}
async function aprobar(id) { return llama(panelAccion, F.reqSara('POST', { id, accion: 'aprobar' })); }
function cargarReservas(k) { for (let i = 1; i <= k; i++) sim.db.cartas_reserva.push({ id: 'R' + String(i).padStart(2, '0'), texto: 'Texto de reserva número ' + i + ' '.repeat(80), tematica: null, usos: 0 }); }

test.beforeEach(() => { sim.nueva(); sinClave(); sorteo._ahora = null; abrir._ahora = null; });

test('carta.js: guarda y deja el acuse como «simulado» sin RESEND_API_KEY; textos nuevos', async () => {
  const c = await nuevaCarta();
  const filas = sim.db.correos.filter((x) => x.carta_id === c.id);
  assert.equal(filas.length, 1); assert.equal(filas[0].tipo, 'acuse'); assert.equal(filas[0].estado, 'simulado');
  assert.ok(!('html' in filas[0]) && !('texto' in filas[0]), 'no se guarda el cuerpo');
  const r = await llama(carta, F.req('POST', { seudonimo: 'X', correo: 'a@b.es', texto: 'corto', saludo: 'querida', acepto_18: true }));
  assert.equal(r.cuerpo.error, 'Escribe un poquito más: hacen falta al menos 80 caracteres.');
  const r2 = await llama(carta, F.req('POST', { seudonimo: 'X', correo: 'a@b.es', texto: TEXTO, saludo: 'querida' }));
  assert.equal(r2.cuerpo.error, 'Marca la casilla: tienes que tener 18 años o más y aceptar la política de privacidad.');
});

test('carta.js: si la cola de correos falla, la carta se guarda igual (201)', async () => {
  delete sim.db.correos; // tabla inexistente = migración sin aplicar
  const c = await nuevaCarta();
  assert.ok(sim.db.cartas.find((x) => x.id === c.id));
});

test('FIX: al rechazar una carta dirigida, su destino vuelve a estar libre (estado.js y carta.js)', async () => {
  const a = await nuevaCarta({ seudonimo: 'Ana' }); await aprobar(a.id);
  const b = await nuevaCarta({ destino_carta_id: a.id });
  let e = await llama(estado, F.req('GET'));
  assert.equal(e.cuerpo.bolsa.length, 0, 'Ana está elegida');
  const sinMotivo = await llama(panelAccion, F.reqSara('POST', { id: b.id, accion: 'rechazar' }));
  assert.equal(sinMotivo.statusCode, 422, 'el motivo es obligatorio');
  const rech = await llama(panelAccion, F.reqSara('POST', { id: b.id, accion: 'rechazar', motivo: 'M2' }));
  assert.equal(rech.statusCode, 200);
  const fila = sim.db.cartas.find((x) => x.id === b.id);
  assert.equal(fila.destino_carta_id, null); assert.equal(fila.texto, null); assert.equal(fila.motivo_rechazo, 'M2');
  e = await llama(estado, F.req('GET'));
  assert.deepEqual(e.cuerpo.bolsa.map((x) => x.seudonimo), ['Ana'], 'Ana vuelve a la bolsa');
  assert.equal(e.cuerpo.escritas, 1, 'el contador solo cuenta pendientes + aprobadas');
  const c = await nuevaCarta({ destino_carta_id: a.id });
  assert.ok(c.id, 'otra persona puede elegir a Ana');
  assert.equal(sim.db.correos.find((x) => x.carta_id === b.id && x.tipo === 'rechazada').estado, 'simulado');
});

test('panel-accion: aprobar manda «aprobada»; sin sesión 401', async () => {
  const a = await nuevaCarta();
  assert.equal((await llama(panelAccion, F.req('POST', { id: a.id, accion: 'aprobar' }))).statusCode, 401);
  const r = await aprobar(a.id);
  assert.equal(r.cuerpo.correo, 'simulado');
  assert.ok(sim.db.correos.find((x) => x.carta_id === a.id && x.tipo === 'aprobada'));
});

test('sorteo.js: antes del cierre no; con pendientes pide confirmar; idempotente; bloquea el panel después', async () => {
  cargarReservas(20);
  const ids = [];
  for (let i = 0; i < 5; i++) { const c = await nuevaCarta(); await aprobar(c.id); ids.push(c.id); }
  const p = await nuevaCarta(); // sin revisar
  const r0 = await llama(sorteo, F.reqSara('POST', { confirmar: true }));
  assert.equal(r0.statusCode, 409, 'antes del cierre');
  sorteo._ahora = () => TRAS_CIERRE;
  const r1 = await llama(sorteo, F.reqSara('POST', { confirmar: true }));
  assert.equal(r1.statusCode, 409); assert.equal(r1.cuerpo.pendientes, 1);
  const r2 = await llama(sorteo, F.reqSara('POST', { confirmar: true, aceptar_pendientes: true }));
  assert.equal(r2.statusCode, 200, JSON.stringify(r2.cuerpo)); assert.equal(r2.cuerpo.ya_existia, false);
  assert.equal(r2.cuerpo.resumen.participantes, 6); assert.equal(r2.cuerpo.resumen.reservas_usadas, 1);
  assert.equal(sim.db.cartas.find((x) => x.id === p.id).recibe_reserva_id !== null, true, 'la no revisada recibe reserva');
  const ent = sim.db.correos.filter((x) => x.tipo === 'entrega');
  assert.equal(ent.length, 6); ent.forEach((x) => assert.equal(x.estado, 'simulado'));
  const r3 = await llama(sorteo, F.reqSara('POST', { confirmar: true, aceptar_pendientes: true }));
  assert.equal(r3.cuerpo.ya_existia, true); assert.equal(r3.cuerpo.sorteo.huella_sha256, r2.cuerpo.sorteo.huella_sha256);
  assert.equal(sim.db.sorteos.length, 1, 'un solo sorteo'); assert.equal(sim.db.llamadasRpc, 1);
  const bloq = await llama(panelAccion, F.reqSara('POST', { id: p.id, accion: 'aprobar' }));
  assert.equal(bloq.statusCode, 409);
  // doble clic simultáneo: la función SQL solo registra uno
  const g = await llama(sorteo, F.reqSara('GET'));
  assert.equal(g.cuerpo.sorteo.huella_sha256, r2.cuerpo.sorteo.huella_sha256);
});

test('sorteo.js: dos peticiones a la vez → un solo sorteo', async () => {
  cargarReservas(20);
  for (let i = 0; i < 4; i++) { const c = await nuevaCarta(); await aprobar(c.id); }
  sorteo._ahora = () => TRAS_CIERRE;
  const [a, b] = await Promise.all([llama(sorteo, F.reqSara('POST', { confirmar: true })), llama(sorteo, F.reqSara('POST', { confirmar: true }))]);
  assert.equal(sim.db.sorteos.length, 1);
  assert.equal(a.cuerpo.sorteo.huella_sha256, b.cuerpo.sorteo.huella_sha256);
  assert.ok([a, b].some((x) => x.cuerpo.ya_existia === true));
});

test('sorteo.js: sin reservas cargadas y con rechazadas → 409, no se guarda nada', async () => {
  for (let i = 0; i < 3; i++) { const c = await nuevaCarta(); await aprobar(c.id); }
  const r = await nuevaCarta(); await llama(panelAccion, F.reqSara('POST', { id: r.id, accion: 'rechazar', motivo: 'M1' }));
  sorteo._ahora = () => TRAS_CIERRE;
  const s = await llama(sorteo, F.reqSara('POST', { confirmar: true }));
  assert.equal(s.statusCode, 409); assert.equal(sim.db.sorteos.length, 0);
});

async function escenarioSorteado() {
  cargarReservas(20);
  const a = await nuevaCarta({ seudonimo: 'Ana', saludo: 'querida' }); await aprobar(a.id);
  const b = await nuevaCarta({ seudonimo: 'Beto', saludo: 'querido' }); await aprobar(b.id);
  const c = await nuevaCarta({ seudonimo: 'Cris', saludo: 'neutro' }); await aprobar(c.id);
  const r = await nuevaCarta({ seudonimo: 'Rita' }); await llama(panelAccion, F.reqSara('POST', { id: r.id, accion: 'rechazar', motivo: 'M3' }));
  sorteo._ahora = () => TRAS_CIERRE;
  await llama(sorteo, F.reqSara('POST', { confirmar: true }));
  const tok = (id) => sim.db.cartas.find((x) => x.id === id).token;
  return { a, b, c, r, tok };
}

test('abrir.js: antes del 25, abierta, reserva firmada Kirco, caducada, token falso; nunca expone correos', async () => {
  const { a, c, r, tok } = await escenarioSorteado();
  abrir._ahora = () => Date.parse(APERTURA_UTC) - 1000;
  let x = await llama(abrir, F.req('GET', null, { query: { t: tok(a.id) } }));
  assert.equal(x.cuerpo.estado, 'antes'); assert.equal(x.cuerpo.texto, undefined);
  abrir._ahora = () => Date.parse(APERTURA_UTC) + 1000;
  x = await llama(abrir, F.req('GET', null, { query: { t: tok(a.id) } }));
  assert.equal(x.cuerpo.estado, 'abierta'); assert.equal(x.cuerpo.saludo, 'Querida Ana:');
  assert.ok(['Beto', 'Cris'].includes(x.cuerpo.firma)); assert.equal(x.cuerpo.aprobada_entregada, true);
  assert.ok(!JSON.stringify(x.cuerpo).includes('@'), 'sin correos');
  x = await llama(abrir, F.req('GET', null, { query: { t: tok(c.id) } }));
  assert.equal(x.cuerpo.saludo.startsWith('Hola, Cris:'), true);
  x = await llama(abrir, F.req('GET', null, { query: { t: tok(r.id) } }));
  assert.equal(x.cuerpo.estado, 'abierta'); assert.equal(x.cuerpo.firma, 'Kirco'); assert.equal(x.cuerpo.aprobada_entregada, false);
  assert.deepEqual(Object.keys(x.cuerpo).sort(), ['aprobada_entregada', 'estado', 'firma', 'nota_enviada', 'saludo', 'seudonimo', 'texto', 'valida_hasta'], 'misma forma que una carta de persona: nada delata la reserva');
  x = await llama(abrir, F.req('GET', null, { query: { t: 'x'.repeat(32) } }));
  assert.equal(x.statusCode, 404); assert.equal(x.cuerpo.estado, 'no_valido');
  abrir._ahora = () => Date.parse(CADUCIDAD_UTC) + 1000;
  x = await llama(abrir, F.req('GET', null, { query: { t: tok(a.id) } }));
  assert.equal(x.statusCode, 404);
});

test('notas: se guarda una por carta, pasa el filtro; reenviar manda el 5.º correo; las de reserva no', async () => {
  const { a, r, tok } = await escenarioSorteado();
  abrir._ahora = () => Date.parse(APERTURA_UTC) + 1000;
  let x = await llama(abrir, F.req('POST', { t: tok(a.id), texto: 'Eres un idiota' }));
  assert.equal(x.statusCode, 422);
  x = await llama(abrir, F.req('POST', { t: tok(a.id), texto: 'x'.repeat(301) }));
  assert.equal(x.statusCode, 422);
  x = await llama(abrir, F.req('POST', { t: tok(a.id), texto: 'Gracias por tu carta, me ha hecho mucha compañía. Es normal emocionarse.' }));
  assert.equal(x.statusCode, 201);
  x = await llama(abrir, F.req('POST', { t: tok(a.id), texto: 'Otra' }));
  assert.equal(x.statusCode, 409, 'una por carta');
  x = await llama(abrir, F.req('POST', { t: tok(r.id), texto: 'Gracias, Kirco.' }));
  assert.equal(x.statusCode, 201);
  const d = await llama(panelDatos, F.reqSara('GET'));
  assert.equal(d.cuerpo.notas.length, 2);
  const deAna = d.cuerpo.notas.find((n) => n.de === 'Ana'); const deRita = d.cuerpo.notas.find((n) => n.de === 'Rita');
  assert.equal(deAna.reserva, false); assert.equal(deRita.reserva, true); assert.equal(deRita.para, 'Kirco');
  assert.equal((await llama(panelNota, F.reqSara('POST', { id: deRita.id, accion: 'reenviar' }))).statusCode, 409);
  assert.equal((await llama(panelNota, F.reqSara('POST', { id: deRita.id, accion: 'leida' }))).statusCode, 200);
  // con clave: comprobamos el contenido del 5.º correo
  process.env.RESEND_API_KEY = 're_prueba';
  correo._fetch = F.fetchResend();
  const rr = await llama(panelNota, F.reqSara('POST', { id: deAna.id, accion: 'reenviar' }));
  assert.equal(rr.statusCode, 200); assert.equal(rr.cuerpo.correo, 'enviado');
  const msg = correo._fetch.llamadas[0].cuerpo;
  const escritor = sim.db.cartas.find((cc) => cc.id === sim.db.cartas.find((q) => q.id === a.id).recibe_carta_id);
  assert.deepEqual(msg.to, [escritor.correo]);
  assert.equal(msg.subject, 'Alguien te ha dejado una nota');
  assert.ok(msg.text.includes('«Gracias por tu carta, me ha hecho mucha compañía. Es normal emocionarse.»'));
  assert.ok(msg.text.includes('— Ana')); assert.ok(msg.text.includes('Hola, ' + escritor.seudonimo + ':'));
  assert.ok(!msg.text.includes(sim.db.cartas.find((q) => q.id === a.id).correo), 'no lleva el correo de quien deja la nota');
  assert.equal(sim.db.correos.filter((q) => q.tipo === 'nota').length, 1);
});

test('correo de entrega: enlace privado, sin texto de la carta ni datos de la otra persona', async () => {
  process.env.RESEND_API_KEY = 're_prueba';
  correo._fetch = F.fetchResend();
  const { a, tok } = await escenarioSorteado();
  const lotes = correo._fetch.llamadas.filter((l) => Array.isArray(l.cuerpo) || l.cuerpo.subject === 'Te ha llegado una carta');
  const msgs = lotes.flatMap((l) => (Array.isArray(l.cuerpo) ? l.cuerpo : [l.cuerpo]));
  assert.equal(msgs.length, 4);
  msgs.forEach((m) => {
    assert.equal(m.scheduled_at, '2026-12-24T23:00:00.000Z');
    assert.ok(!m.html.includes(TEXTO.trim().slice(0, 40)), 'sin el texto de la carta');
  });
  const deAna = msgs.find((m) => m.to[0] === sim.db.cartas.find((q) => q.id === a.id).correo);
  assert.ok(deAna.text.includes('/navidad/abrir.html?t=' + tok(a.id)));
  assert.ok(deAna.text.includes('Y la tuya también ha llegado esta noche a alguien.'));
  const deRita = msgs.find((m) => m.text.startsWith('Hola, Rita:'));
  assert.ok(!deRita.text.includes('Y la tuya también'), 'a quien se rechazó no se le menciona');
  ['Beto', 'Cris'].forEach((s) => assert.ok(!deAna.text.includes(s), 'no menciona a quien escribió'));
  sim.db.correos.filter((q) => q.tipo === 'entrega').forEach((q) => assert.equal(q.estado, 'programado'));
});

test('correos-pendientes: protegido (CRON_SECRET o sesión) y reintenta tras cuota agotada', async () => {
  process.env.RESEND_API_KEY = 're_prueba';
  let agotado = true;
  correo._fetch = F.fetchResend(() => (agotado ? { status: 429, json: { name: 'daily_quota_exceeded', message: 'quota' } } : { status: 200 }));
  const c = await nuevaCarta();
  const fila = () => sim.db.correos.find((q) => q.carta_id === c.id);
  assert.equal(fila().estado, 'pendiente'); assert.match(fila().ultimo_error, /daily_quota_exceeded/);
  process.env.CRON_SECRET = 'secreto-de-prueba';
  assert.equal((await llama(pendientes, F.req('GET'))).statusCode, 401);
  assert.equal((await llama(pendientes, F.req('GET', null, { headers: { authorization: 'Bearer otro' } }))).statusCode, 401);
  agotado = false;
  const ok = await llama(pendientes, F.req('GET', null, { headers: { authorization: 'Bearer secreto-de-prueba' } }));
  assert.equal(ok.statusCode, 200); assert.equal(ok.cuerpo.resumen.enviado, 1);
  assert.equal(fila().estado, 'enviado'); assert.equal(fila().intentos, 2);
  assert.equal((await llama(pendientes, F.reqSara('POST'))).statusCode, 200);
  delete process.env.CRON_SECRET;
});

test('panel-datos: contador de reservas necesarias vs cargadas', async () => {
  cargarReservas(2);
  for (let i = 0; i < 3; i++) { const c = await nuevaCarta(); await aprobar(c.id); }
  for (let i = 0; i < 4; i++) { const c = await nuevaCarta(); await llama(panelAccion, F.reqSara('POST', { id: c.id, accion: 'rechazar', motivo: 'Una frase nuestra, sin juicio.' })); }
  const d = await llama(panelDatos, F.reqSara('GET'));
  assert.deepEqual(d.cuerpo.reservas, { necesarias: 4, cargadas: 2, faltan: 2 });
  assert.equal(d.cuerpo.correos.simulacion, true);
  // M4: el texto libre llega al correo tal cual
  assert.equal(sim.db.cartas.filter((q) => q.motivo_rechazo === 'Una frase nuestra, sin juicio.').length, 4);
});
