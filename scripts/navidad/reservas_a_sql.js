#!/usr/bin/env node
/* Convierte el JSON de cartas de reserva (las escribe Toby - PNM; previstas 20, una por temática)
   en un .sql de INSERT para pegar en el SQL Editor de Supabase, SOLO tras el OK de Sara.
   Este script NO contiene ninguna carta, y ni el JSON ni el .sql deben subirse al repo
   (están en .gitignore): son privados y Vercel sirve como estáticos los archivos del repo.

   Entrada: [{ "id": "R01", "texto": "...", "tematica": "opcional" }, ...]
     - id: R + 2 o 3 cifras, único.
     - texto: el CUERPO de la carta, sin saludo ni firma (el sistema antepone «Querido/Querida/Hola,
       [seudónimo]:» de quien la recibe y firma «Kirco»), 80-3000 caracteres, neutro de género.
     - tematica: opcional; se guarda si viene.
   Uso: node scripts/navidad/reservas_a_sql.js reservas_toby.json > reservas_carga.sql
   Si una carta ya existe (mismo id), se actualizan texto y temática; los usos no se tocan. */
'use strict';
const fs = require('fs');
const path = require('path');
const filtro = require(path.join(__dirname, '..', '..', 'api', 'navidad', '_filtro.js'));

function sqlTexto(v) {
  if (v == null || v === '') return 'null';
  return "'" + String(v).replace(/'/g, "''") + "'";
}

function validar(lista) {
  const errores = [];
  const avisos = [];
  if (!Array.isArray(lista)) return { errores: ['El JSON debe ser una lista [{ id, texto }]'], avisos };
  const ids = new Set();
  const textos = new Set();
  lista.forEach((c, i) => {
    const donde = 'Carta ' + (i + 1) + (c && c.id ? ' (' + c.id + ')' : '');
    if (!c || typeof c !== 'object') { errores.push(donde + ': no es un objeto'); return; }
    if (!/^R[0-9]{2,3}$/.test(String(c.id || ''))) errores.push(donde + ': id no válido (R01, R02...)');
    if (ids.has(c.id)) errores.push(donde + ': id repetido');
    ids.add(c.id);
    const t = String(c.texto || '').trim();
    if (t.length < 80 || t.length > 3000) errores.push(donde + ': el texto debe tener entre 80 y 3000 caracteres (tiene ' + t.length + ')');
    if (textos.has(t)) errores.push(donde + ': texto repetido');
    textos.add(t);
    if (/^(querid[oa]s?|hola)\b/i.test(t)) avisos.push(donde + ': parece empezar con un saludo; el sistema ya lo pone');
    if (/—\s*kirco\s*$/i.test(t)) avisos.push(donde + ': parece llevar firma; el sistema ya firma «Kirco»');
    const f = filtro.revisa(t);
    if (!f.ok) avisos.push(donde + ': el filtro de contenido marca algo: ' + f.hallazgos.map((h) => h.categoria).join(', '));
    if (c.tematica != null && typeof c.tematica !== 'string') errores.push(donde + ': tematica debe ser texto');
  });
  if (lista.length !== 20) avisos.push('Hay ' + lista.length + ' cartas; lo previsto son 20 (una por temática). El sistema funciona con cualquier número.');
  return { errores, avisos };
}

function aSql(lista) {
  const filas = lista.map((c) => '  (' + sqlTexto(c.id) + ', ' + sqlTexto(String(c.texto).trim()) + ', ' + sqlTexto(c.tematica ? String(c.tematica).trim() : null) + ')');
  return [
    '-- Cartas de reserva de Navidad (' + lista.length + '). PRIVADO: no subir al repo. Pegar en Supabase → SQL Editor.',
    'begin;',
    'insert into public.cartas_reserva (id, texto, tematica) values',
    filas.join(',\n'),
    'on conflict (id) do update set texto = excluded.texto, tematica = excluded.tematica;',
    'commit;',
    ''
  ].join('\n');
}

if (require.main === module) {
  const archivo = process.argv[2];
  if (!archivo) { console.error('Uso: node scripts/navidad/reservas_a_sql.js reservas.json > reservas.sql'); process.exit(2); }
  const lista = JSON.parse(fs.readFileSync(archivo, 'utf8'));
  const { errores, avisos } = validar(lista);
  avisos.forEach((a) => console.error('Aviso: ' + a));
  if (errores.length) { errores.forEach((e) => console.error('Error: ' + e)); process.exit(1); }
  process.stdout.write(aSql(lista));
}
module.exports = { validar, aSql };
