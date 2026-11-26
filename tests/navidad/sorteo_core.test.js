'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const core = require('../../api/navidad/_sorteo_core');
const { verificar } = require('../../scripts/navidad/verificar_sorteo');

let n = 0;
const uuid = () => '00000000-0000-4000-8000-' + String(++n).padStart(12, '0');
function carta(o) { return Object.assign({ id: uuid(), correo: 'p' + n + '@x.es', estado: 'aprobada', destino_carta_id: null, creada_at: '2026-12-01T10:00:00Z' }, o); }
function reservas(k, usos) { return Array.from({ length: k }, (_, i) => ({ id: 'R' + String(i + 1).padStart(2, '0'), usos: usos ? usos(i) : 0 })); }

function comprobar(entrada, r) {
  const receptores = new Set(entrada.cartas.map((c) => c.receptor));
  const porId = new Map(entrada.cartas.map((c) => [c.id, c]));
  // cada persona (receptor) recibe exactamente una carta
  assert.equal(r.asignaciones.length, receptores.size, 'todos reciben');
  assert.equal(new Set(r.asignaciones.map((a) => a.receptor)).size, receptores.size, 'una por persona');
  // cada carta de persona se entrega como mucho una vez, solo aprobadas, y nunca a su autor
  const cartasDadas = r.asignaciones.filter((a) => a.tipo === 'carta');
  assert.equal(new Set(cartasDadas.map((a) => a.id)).size, cartasDadas.length, 'carta entregada una sola vez');
  for (const a of cartasDadas) {
    const c = porId.get(a.id);
    assert.equal(c.estado, 'aprobada');
    assert.notEqual(c.receptor, a.receptor, 'nadie recibe la suya');
  }
  // las dirigidas válidas llegan a su destino
  for (const c of entrada.cartas) {
    if (c.estado === 'aprobada' && c.destino && porId.get(c.destino) && porId.get(c.destino).estado === 'aprobada') {
      const a = r.asignaciones.find((x) => x.receptor === porId.get(c.destino).receptor);
      assert.equal(a.id, c.id, 'destino respetado');
    }
  }
  return true;
}

test('1, 2, 3 y 300 personas: biyección, nadie recibe la suya, reproducible', () => {
  for (const k of [1, 2, 3, 300]) {
    const cartas = Array.from({ length: k }, () => carta());
    const e = core.prepararEntrada(cartas, reservas(20));
    const sem = core.nuevaSemilla();
    const r = core.ejecutar(e, sem);
    comprobar(e, r);
    const r2 = core.ejecutar(JSON.parse(JSON.stringify(e)), sem);
    assert.equal(r2.huella_sha256, r.huella_sha256, 'misma semilla, misma huella');
    assert.deepEqual(r2.asignaciones, r.asignaciones);
    if (k === 1) {
      assert.equal(r.asignaciones[0].tipo, 'reserva', 'sola: recibe una reserva');
      assert.ok(r.avisos.some((a) => a.codigo === 'carta_sin_entregar'));
    }
    if (k === 2) assert.equal(r.resumen.mutuos, 1, 'con 2 el intercambio es inevitable');
    if (k >= 3) {
      assert.equal(r.resumen.cartas_persona, k);
      assert.equal(r.resumen.reservas_usadas, 0);
      assert.equal(r.resumen.mutuos, 0, 'sin intercambios A↔B');
    }
  }
});

test('otra semilla da otro reparto (300 personas)', () => {
  const e = core.prepararEntrada(Array.from({ length: 300 }, () => carta()), []);
  const a = core.ejecutar(e, core.nuevaSemilla());
  const b = core.ejecutar(e, core.nuevaSemilla());
  assert.notEqual(a.huella_sha256, b.huella_sha256);
});

test('destinos respetados; destino rechazado o pendiente pasa a azar', () => {
  const A = carta(); const B = carta(); const C = carta(); const D = carta({ estado: 'rechazada' }); const P = carta({ estado: 'pendiente' });
  const X = carta({ destino_carta_id: A.id });
  const Y = carta({ destino_carta_id: D.id }); // destino rechazado
  const Z = carta({ destino_carta_id: P.id }); // destino sin revisar
  const e = core.prepararEntrada([A, B, C, D, P, X, Y, Z], reservas(20));
  for (let i = 0; i < 50; i++) {
    const r = core.ejecutar(e, core.nuevaSemilla());
    comprobar(e, r);
    assert.equal(r.asignaciones.find((a) => a.receptor === A.id).id, X.id);
    assert.equal(r.avisos.filter((a) => a.codigo === 'destino_no_valido').length, 2);
    // D (rechazada) y P (sin revisar) reciben una reserva
    assert.equal(r.asignaciones.find((a) => a.receptor === D.id).tipo, 'reserva');
    assert.equal(r.asignaciones.find((a) => a.receptor === P.id).tipo, 'reserva');
  }
});

test('se evita A↔B también con cartas dirigidas', () => {
  for (let i = 0; i < 100; i++) {
    const A = carta(); const B = carta({ destino_carta_id: A.id }); const C = carta(); const D = carta();
    const e = core.prepararEntrada([A, B, C, D], []);
    const r = core.ejecutar(e, core.nuevaSemilla());
    comprobar(e, r);
    // B escribe a A: A no debe recibir... A escribe al azar y no debe ir a B
    assert.notEqual(r.asignaciones.find((a) => a.receptor === B.id).id, A.id);
    assert.equal(r.resumen.mutuos, 0);
  }
});

test('deduplica por correo: rechazada + aprobada del mismo correo = una sola carta', () => {
  const R = carta({ correo: 'ana@x.es', estado: 'rechazada', creada_at: '2026-12-01T10:00:00Z' });
  const A = carta({ correo: 'ANA@x.es ', estado: 'aprobada', creada_at: '2026-12-02T10:00:00Z' });
  const B = carta(); const C = carta();
  const e = core.prepararEntrada([R, A, B, C], reservas(20));
  assert.equal(e.cartas.find((c) => c.id === R.id).receptor, A.id, 'la aprobada representa a la persona');
  const r = core.ejecutar(e, core.nuevaSemilla());
  comprobar(e, r);
  assert.equal(r.resumen.participantes, 3);
  assert.equal(r.asignaciones.filter((a) => a.receptor === R.id).length, 0);
  assert.equal(r.resumen.reservas_usadas, 0);
});

test('dos rechazadas del mismo correo: una sola reserva, en la más reciente', () => {
  const R1 = carta({ correo: 'eva@x.es', estado: 'rechazada', creada_at: '2026-12-01T10:00:00Z' });
  const R2 = carta({ correo: 'eva@x.es', estado: 'rechazada', creada_at: '2026-12-03T10:00:00Z' });
  const e = core.prepararEntrada([R1, R2, carta(), carta()], reservas(3));
  const r = core.ejecutar(e, core.nuevaSemilla());
  comprobar(e, r);
  assert.equal(r.asignaciones.filter((a) => a.receptor === R2.id && a.tipo === 'reserva').length, 1);
  assert.equal(r.resumen.reservas_usadas, 1);
});

test('única carta al azar cuyo autor es la única persona libre: va a una rechazada y el autor recibe reserva', () => {
  const A = carta(); const B = carta({ destino_carta_id: A.id }); // A escribe al azar; B está libre? no: B es libre aprobada
  // Construimos: A al azar, B dirigida a A -> libres aprobados: B. A al azar -> B (sin conflicto). Caso real de conflicto:
  const S = carta(); const R = carta({ estado: 'rechazada' });
  const e = core.prepararEntrada([S, R], reservas(2));
  const r = core.ejecutar(e, core.nuevaSemilla());
  comprobar(e, r);
  assert.equal(r.asignaciones.find((a) => a.receptor === R.id).id, S.id, 'la carta de S llega a R');
  assert.equal(r.asignaciones.find((a) => a.receptor === S.id).tipo, 'reserva');
  assert.ok(r.avisos.some((a) => a.codigo === 'unica_al_azar_a_no_aprobada'));
  const e2 = core.prepararEntrada([A, B], []);
  comprobar(e2, core.ejecutar(e2, core.nuevaSemilla()));
});

test('reservas: primero las no usadas; si hacen falta más que las 20 cargadas, se reutiliza la menos usada', () => {
  const cartas = Array.from({ length: 45 }, () => carta({ estado: 'rechazada' })).concat([carta(), carta(), carta()]);
  const e = core.prepararEntrada(cartas, reservas(20));
  const r = core.ejecutar(e, core.nuevaSemilla());
  comprobar(e, r);
  assert.equal(r.resumen.reservas_necesarias, 45);
  assert.equal(r.resumen.reservas_reutilizadas, 25);
  const usos = {}; r.asignaciones.filter((a) => a.tipo === 'reserva').forEach((a) => { usos[a.id] = (usos[a.id] || 0) + 1; });
  assert.equal(Object.keys(usos).length, 20, 'se usan las 20');
  const v = Object.values(usos); assert.ok(Math.max(...v) - Math.min(...v) <= 1, 'reparto equilibrado (la menos usada)');
  assert.equal(r.usos.reduce((s, u) => s + u.veces, 0), 45);
  // con usos previos, se prefieren las menos usadas
  const e2 = core.prepararEntrada([carta({ estado: 'rechazada' }), carta({ estado: 'rechazada' })], reservas(3, (i) => (i === 2 ? 0 : 5)));
  const r2 = core.ejecutar(e2, core.nuevaSemilla());
  assert.ok(r2.asignaciones.some((a) => a.id === 'R03'));
});

test('sin reservas cargadas y con gente que las necesita: SIN_RESERVAS', () => {
  const e = core.prepararEntrada([carta({ estado: 'rechazada' }), carta(), carta()], []);
  assert.throws(() => core.ejecutar(e, core.nuevaSemilla()), (err) => err.codigo === 'SIN_RESERVAS' && err.necesarias === 1);
  assert.equal(core.estimarReservas(e).necesarias, 1);
});

test('la huella no depende del orden de claves (jsonb) y el script de verificación la reproduce', () => {
  const cartas = Array.from({ length: 30 }, (_, i) => carta(i % 7 === 0 ? { estado: 'rechazada' } : {}));
  const e = core.prepararEntrada(cartas, reservas(20));
  const sem = core.nuevaSemilla();
  const r = core.ejecutar(e, sem);
  // simula lo que devuelve Postgres: claves reordenadas
  const reordena = (o) => Array.isArray(o) ? o.map(reordena) : (o && typeof o === 'object' ? Object.keys(o).reverse().reduce((a, k) => { a[k] = reordena(o[k]); return a; }, {}) : o);
  const fila = { semilla: sem, entrada: reordena(e), resultado: reordena({ asignaciones: r.asignaciones }), huella_sha256: r.huella_sha256, huella_entrada: r.huella_entrada, version_codigo: core.VERSION };
  assert.equal(verificar(fila).ok, true);
  const trucada = JSON.parse(JSON.stringify(fila)); trucada.resultado.asignaciones[0].id = trucada.resultado.asignaciones[1].id;
  assert.equal(verificar(trucada).ok, false);
  const otraSemilla = Object.assign({}, fila, { semilla: core.nuevaSemilla() });
  assert.equal(verificar(otraSemilla).ok, false);
});

test('PRNG: uniforme y determinista', () => {
  const a = core.crearPrng('a'.repeat(64)); const b = core.crearPrng('a'.repeat(64));
  const cuenta = [0, 0, 0];
  for (let i = 0; i < 30000; i++) { const x = a.entero(3); assert.equal(x, b.entero(3)); cuenta[x]++; }
  cuenta.forEach((c) => assert.ok(Math.abs(c - 10000) < 600));
  assert.throws(() => core.crearPrng('xyz'));
});
