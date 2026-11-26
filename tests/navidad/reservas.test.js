'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validar, aSql } = require('../../scripts/navidad/reservas_a_sql');

const cuerpo = (i) => 'Esta es una carta de reserva de prueba número ' + i + ', con texto neutro y suficiente longitud para pasar.';

test('JSON de Toby → SQL: acepta «tematica» opcional y escapa comillas', () => {
  const lista = Array.from({ length: 20 }, (_, i) => ({ id: 'R' + String(i + 1).padStart(2, '0'), texto: cuerpo(i) + (i === 0 ? " L'hora d'anar" : ''), tematica: i % 2 ? 'Temática ' + i : undefined }));
  const v = validar(lista);
  assert.deepEqual(v.errores, []); assert.deepEqual(v.avisos, []);
  const sql = aSql(lista);
  assert.ok(sql.includes("L''hora d''anar")); assert.ok(sql.includes("'Temática 1'")); assert.ok(sql.includes(', null)'));
  assert.ok(sql.includes('on conflict (id) do update set texto = excluded.texto, tematica = excluded.tematica'));
  assert.ok(!/usos/.test(sql), 'no toca los usos');
});

test('valida ids, longitudes, repetidos; avisa de saludos, firma y número distinto de 20', () => {
  const v = validar([{ id: 'X1', texto: 'corto' }, { id: 'R02', texto: 'Querida persona, ' + cuerpo(2) }, { id: 'R02', texto: cuerpo(3) + ' — Kirco' }]);
  assert.ok(v.errores.some((e) => /id no válido/.test(e)));
  assert.ok(v.errores.some((e) => /entre 80 y 3000/.test(e)));
  assert.ok(v.errores.some((e) => /id repetido/.test(e)));
  assert.ok(v.avisos.some((a) => /saludo/.test(a)));
  assert.ok(v.avisos.some((a) => /firma/.test(a)));
  assert.ok(v.avisos.some((a) => /lo previsto son 20/.test(a)));
});
