'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const servidor = require('../../api/navidad/_filtro');

const raiz = path.join(__dirname, '..', '..');
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(raiz, 'navidad/js/filtro.js'), 'utf8') + ';this.KFiltro = KFiltro;', ctx);
const cliente = ctx.KFiltro;

const IDEAS = JSON.parse(fs.readFileSync(path.join(raiz, 'navidad/presentate.html'), 'utf8').match(/var T = (\[.*?\]);/)[1]);
const NORMALES = [
  'Es normal sentirse así en estas fechas.', 'Lo normal es que cueste.', 'Volver a la normalidad lleva tiempo.',
  'Normalmente escribo de noche.', 'Son cosas normales.', 'Mi diputado favorito', 'La reputación no importa.',
  'Estudio en la biblioteca.', 'Esta página es para ti.', 'Mi idioma es el español.', 'Me encanta tu collar.',
  'No vas a fallar.', 'El retraso del tren.', 'El animal de compañía.', 'Un acto formal.', 'La ortografía da igual.',
  'Sudaba de los nervios.', 'Estaba retratando el atardecer.', 'Escupir al suelo no.', 'Penélope me lo contó.',
  'Una computadora vieja', 'La disputa terminó.', 'Me cabrea el frío.', 'Siempre necesitas un abrazo.', 'Se me hace largo el invierno.'
];
const MALAS = ['eres anormal', 'Anormal', 'puta', 'p u t a', 'p.u.t.a', 'g1l1p0ll4s', 'gili pollas', 'gilipoyas', 'imvecil', 'estúpido', 'eres un idiota', 'subnormal', 'te voy a matar'];

test('sin falsos positivos en frases normales ni en las 20 ideas', () => {
  for (const t of NORMALES.concat(IDEAS)) {
    assert.equal(servidor.revisa(t).ok, true, 'marcó: ' + t + ' → ' + JSON.stringify(servidor.revisa(t).hallazgos));
    assert.equal(cliente.revisa(t).ok, true, '(cliente) marcó: ' + t);
  }
});

test('«anormal» y las variantes ofuscadas se siguen bloqueando', () => {
  for (const t of MALAS) {
    assert.equal(servidor.revisa(t).ok, false, 'no marcó: ' + t);
    assert.equal(cliente.revisa(t).ok, false, '(cliente) no marcó: ' + t);
  }
});

test('las cartas de reserva de Toby (solo como texto de prueba local, si existen) pasan el filtro', { skip: !fs.existsSync('/workspace/web-bykirco/entrega/cartas-reserva-toby.json') }, () => {
  const cartas = JSON.parse(fs.readFileSync('/workspace/web-bykirco/entrega/cartas-reserva-toby.json', 'utf8'));
  for (const c of cartas) assert.equal(servidor.revisa(c.texto).ok, true, c.id + ' marcada: ' + JSON.stringify(servidor.revisa(c.texto).hallazgos));
});

test('servidor y cliente dan el mismo resultado', () => {
  for (const t of NORMALES.concat(MALAS, IDEAS)) assert.deepEqual(JSON.parse(JSON.stringify(cliente.revisa(t).hallazgos)), servidor.revisa(t).hallazgos);
});
