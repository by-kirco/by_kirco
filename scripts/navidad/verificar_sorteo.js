#!/usr/bin/env node
/* Verifica el sorteo de Navidad: lo reproduce desde la semilla + la entrada guardadas en la tabla
   `sorteos` y compara la huella. No necesita red ni claves.

   Uso:
     1. En Supabase → SQL Editor:  select semilla, entrada, resultado, huella_sha256, huella_entrada, version_codigo
                                   from sorteos where edicion = 2026;
        y exporta la fila como JSON (o cópiala a un archivo sorteo.json).
     2. node scripts/navidad/verificar_sorteo.js sorteo.json

   Sale con código 0 si todo coincide y 1 si algo no cuadra. */
'use strict';
const fs = require('fs');
const path = require('path');
const core = require(path.join(__dirname, '..', '..', 'api', 'navidad', '_sorteo_core.js'));

function verificar(fila) {
  if (Array.isArray(fila)) fila = fila[0];
  const parse = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
  const entrada = parse(fila.entrada);
  const resultado = parse(fila.resultado);
  const problemas = [];
  if (fila.version_codigo && fila.version_codigo !== core.VERSION) {
    problemas.push('La versión del código no coincide (guardada: ' + fila.version_codigo + ', actual: ' + core.VERSION + '). Usa el commit con el que se hizo el sorteo.');
  }
  const r = core.ejecutar(entrada, fila.semilla);
  if (r.huella_entrada !== fila.huella_entrada) problemas.push('La huella de la ENTRADA no coincide.');
  if (r.huella_sha256 !== fila.huella_sha256) problemas.push('La huella del RESULTADO no coincide.');
  if (resultado && resultado.asignaciones && core.canonico(resultado.asignaciones) !== core.canonico(r.asignaciones)) {
    problemas.push('Las asignaciones guardadas no coinciden con las reproducidas.');
  }
  return { ok: problemas.length === 0, problemas, recalculado: { huella_sha256: r.huella_sha256, huella_entrada: r.huella_entrada, resumen: r.resumen } };
}

if (require.main === module) {
  const archivo = process.argv[2];
  if (!archivo) { console.error('Uso: node scripts/navidad/verificar_sorteo.js sorteo.json'); process.exit(2); }
  const v = verificar(JSON.parse(fs.readFileSync(archivo, 'utf8')));
  console.log(JSON.stringify(v, null, 2));
  console.log(v.ok ? '✔ El sorteo se reproduce idéntico: la huella coincide.' : '✘ El sorteo NO cuadra.');
  process.exit(v.ok ? 0 : 1);
}
module.exports = { verificar };
