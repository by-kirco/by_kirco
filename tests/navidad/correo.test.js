'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const F = require('./_fake');
const sim = F.instalar();
const correo = require('../../api/navidad/_correo');
const { construir } = require('../../api/navidad/_plantilla_correo');

function sembrar(k, tipo, extra) {
  const filas = [];
  for (let i = 0; i < k; i++) {
    const id = crypto.randomUUID();
    sim.db.cartas.push({ id, correo: 'p' + i + '@x.es', seudonimo: 'S' + i, token: crypto.randomBytes(24).toString('base64url'), estado: 'aprobada', motivo_rechazo: null, recibe_carta_id: null, recibe_reserva_id: null });
    const f = Object.assign({ id: crypto.randomUUID(), carta_id: id, tipo: tipo || 'aprobada', estado: 'pendiente', intentos: 0, programado_para: null, creado_at: new Date(Date.now() + i).toISOString() }, extra);
    sim.db.correos.push(f); filas.push(f);
  }
  return filas;
}
test.beforeEach(() => { sim.nueva(); delete process.env.RESEND_API_KEY; delete process.env.CORREO_REMITENTE; delete process.env.CORREO_RESPONDER_A; correo._fetch = null; });

test('modo simulación: sin clave no se llama a Resend y queda «simulado»', async () => {
  correo._fetch = F.fetchResend();
  const filas = sembrar(3);
  const r = await correo.procesarFilas(sim.cliente || require('../../api/navidad/_supabase').getSupabase(), filas);
  assert.equal(r.simulado, 3); assert.equal(correo._fetch.llamadas.length, 0);
  sim.db.correos.forEach((q) => assert.equal(q.estado, 'simulado'));
});

test('con clave: remitente por defecto, Idempotency-Key, reply_to opcional, lotes de 100', async () => {
  process.env.RESEND_API_KEY = 're_prueba'; process.env.CORREO_RESPONDER_A = 'by.kirco@gmail.com';
  correo._fetch = F.fetchResend();
  const sb = require('../../api/navidad/_supabase').getSupabase();
  const r = await correo.procesarFilas(sb, sembrar(250));
  assert.equal(r.enviado, 250);
  const ll = correo._fetch.llamadas;
  assert.equal(ll.length, 3); assert.deepEqual(ll.map((l) => l.cuerpo.length), [100, 100, 50]);
  ll.forEach((l) => { assert.equal(l.url, 'https://api.resend.com/emails/batch'); assert.equal(l.cabeceras.Authorization, 'Bearer re_prueba'); assert.ok(l.cabeceras['Idempotency-Key'].startsWith('navidad-')); });
  assert.equal(ll[0].cuerpo[0].from, 'by_kirco <cartas@bykirco.com>'); assert.equal(ll[0].cuerpo[0].reply_to, 'by.kirco@gmail.com');
  assert.ok(sim.db.correos.every((q) => q.resend_id && q.estado === 'enviado'));
  const unico = await correo.procesarFilas(sb, sembrar(1));
  assert.equal(correo._fetch.llamadas[3].url, 'https://api.resend.com/emails'); assert.equal(unico.enviado, 1);
});

test('429 monthly_quota_exceeded: se para el lote y lo que queda sigue pendiente (Resend no reintenta)', async () => {
  process.env.RESEND_API_KEY = 're_prueba';
  correo._fetch = F.fetchResend((url, cuerpo, n) => (n === 1 ? { status: 200 } : { status: 429, json: { name: 'monthly_quota_exceeded' } }));
  const sb = require('../../api/navidad/_supabase').getSupabase();
  const r = await correo.procesarFilas(sb, sembrar(300));
  assert.equal(r.enviado, 100); assert.equal(r.pendiente, 200); assert.equal(r.cuota, 'monthly_quota_exceeded');
  assert.equal(correo._fetch.llamadas.length, 2, 'no sigue llamando tras la cuota');
});

test('422 → error (se reintenta hasta 5 veces); fallo de red → pendiente', async () => {
  process.env.RESEND_API_KEY = 're_prueba';
  const sb = require('../../api/navidad/_supabase').getSupabase();
  correo._fetch = F.fetchResend(() => ({ status: 422, json: { name: 'validation_error', message: 'bad' } }));
  let r = await correo.procesarFilas(sb, sembrar(1));
  assert.equal(r.error, 1);
  correo._fetch = async () => { throw new Error('ECONNRESET'); };
  r = await correo.procesarFilas(sb, sembrar(1));
  assert.equal(r.pendiente, 1);
  sim.db.correos.forEach((q) => { q.intentos = 5; });
  correo._fetch = F.fetchResend();
  r = await correo.reintentarPendientes(sb);
  assert.equal(r.enviado, 0, 'con 5 intentos ya no se reintenta');
});

test('entrega: se programa para el 25/12 00:00 Madrid; si ya pasó, sale al momento', async () => {
  process.env.RESEND_API_KEY = 're_prueba';
  correo._fetch = F.fetchResend();
  const sb = require('../../api/navidad/_supabase').getSupabase();
  sembrar(2, 'entrega');
  let r = await correo.programarEntregas(sb);
  assert.equal(r.programado, 2);
  assert.equal(correo._fetch.llamadas[0].cuerpo[0].scheduled_at, '2026-12-24T23:00:00.000Z');
  correo._ahora = () => Date.parse('2026-12-25T08:00:00Z');
  sembrar(1, 'entrega', { programado_para: '2026-12-24T23:00:00Z' });
  r = await correo.reintentarPendientes(sb);
  assert.equal(r.enviado, 1); assert.equal(correo._fetch.llamadas[1].cuerpo.scheduled_at, undefined);
  correo._ahora = null;
});

test('plantillas: textos de Ryan, logo, sin datos de carta; rechazo dice que recibirá carta', () => {
  const tipos = ['acuse', 'aprobada', 'rechazada', 'entrega', 'nota'];
  const asuntos = ['Tu carta ya va de camino', 'Tu carta ya está lista', 'Sobre tu carta', 'Te ha llegado una carta', 'Alguien te ha dejado una nota'];
  tipos.forEach((t, i) => {
    const m = construir(t, { seudonimo: 'Lu<script>', token: 'TOK', motivo: 'M1', nota: 'Gracias', seudonimo_nota: 'Ana', aprobada_entregada: true });
    assert.equal(m.asunto, asuntos[i]);
    assert.ok(m.html.includes('https://www.bykirco.com/assets/email/logo_bykirco.png'));
    assert.ok(m.html.includes('#FFE9D1'));
    assert.ok(!m.html.includes('<script>'), 'escapado');
    assert.ok(m.texto.includes('Recibes este correo porque has escrito una carta en by_kirco.'));
  });
  assert.ok(construir('rechazada', { seudonimo: 'X', motivo: 'M1' }).texto.includes('No te quedas sin la tuya. El 25 de diciembre, a las 00:00, te llega una carta a este correo'));
  assert.ok(construir('rechazada', { seudonimo: 'X', motivo: 'M1' }).texto.includes('Lleva datos que podrían dar pistas'));
  assert.ok(!construir('entrega', { seudonimo: 'X', token: 'T', aprobada_entregada: false }).texto.includes('Y la tuya también'));
});
