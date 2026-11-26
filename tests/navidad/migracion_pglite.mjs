/* Prueba de la migración 02 y de la función navidad_registrar_sorteo en un Postgres real en memoria (PGlite).
   No toca Supabase. Necesita PGlite, que NO es dependencia del proyecto:
     npm i --no-save @electric-sql/pglite && node tests/navidad/migracion_pglite.mjs */
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const R = new URL('../../', import.meta.url).pathname;
const core = require(R + 'api/navidad/_sorteo_core.js');
const db = new PGlite();
await db.exec(`create role service_role bypassrls; create role anon; create role authenticated;`);
await db.exec(fs.readFileSync(R + 'navidad/supabase/schema.sql', 'utf8').replace(/create extension[^;]*;/, ''));
// datos: 5 aprobadas, 1 rechazada con destino, 1 pendiente
const ids = [];
for (let i = 0; i < 5; i++) { const r = await db.query(`insert into cartas (token, correo, seudonimo, saludo, texto, estado, acepto_18_privacidad_at) values ($1,$2,$3,'otro','x','aprobada',now()) returning id`, ['t' + i, 'p' + i + '@x.es', 'S' + i]); ids.push(r.rows[0].id); }
await db.query(`insert into cartas (token, correo, seudonimo, saludo, texto, estado, destino_carta_id, acepto_18_privacidad_at) values ('tr','r@x.es','R','otro',null,'rechazada',$1,now())`, [ids[0]]);
await db.query(`insert into cartas (token, correo, seudonimo, saludo, texto, estado, acepto_18_privacidad_at) values ('tp','pp@x.es','P','otro','x','pendiente',now())`);
const mig = fs.readFileSync(R + 'navidad/supabase/migracion_02_correos_sorteo.sql', 'utf8');
await db.exec(mig); await db.exec(mig); console.log('migración aplicada 2 veces: OK');
console.log('destino de rechazada liberado:', (await db.query(`select count(*)::int n from cartas where estado='rechazada' and destino_carta_id is not null`)).rows[0].n === 0);
await db.exec(`insert into cartas_reserva (id, texto) values ('R01', repeat('a', 90)), ('R02', repeat('b', 90))`);
const cartas = (await db.query(`select id, correo, estado, destino_carta_id, creada_at from cartas`)).rows;
const reservas = (await db.query(`select id, usos from cartas_reserva`)).rows;
const entrada = core.prepararEntrada(cartas, reservas, 2026);
const semilla = core.nuevaSemilla();
const r = core.ejecutar(entrada, semilla);
const p = { edicion: 2026, participantes: r.resumen.participantes, cartas_persona: r.resumen.cartas_persona, reservas_usadas: r.resumen.reservas_usadas, semilla, entrada, resultado: { asignaciones: r.asignaciones }, huella_entrada: r.huella_entrada, huella_sha256: r.huella_sha256, version_codigo: r.version, entrega_at: '2026-12-24T23:00:00Z' };
await db.exec('set role service_role');
const q = `select navidad_registrar_sorteo($1::jsonb, $2::jsonb, $3::jsonb) as r`;
const a1 = (await db.query(q, [JSON.stringify(p), JSON.stringify(r.asignaciones), JSON.stringify(r.usos)])).rows[0].r;
console.log('1.ª llamada ya_existia =', a1.ya_existia, '· participantes', a1.sorteo.participantes);
const a2 = (await db.query(q, [JSON.stringify(p), JSON.stringify(r.asignaciones), JSON.stringify(r.usos)])).rows[0].r;
console.log('2.ª llamada ya_existia =', a2.ya_existia);
const st = (await db.query(`select (select count(*)::int from cartas where recibe_carta_id is not null) c, (select count(*)::int from cartas where recibe_reserva_id is not null) rr, (select count(*)::int from correos where tipo='entrega') e, (select sum(usos)::int from cartas_reserva) u`)).rows[0];
console.log('cartas de persona asignadas', st.c, '· reservas', st.rr, '· correos entrega en cola', st.e, '· usos reservas', st.u);
// reproducción desde lo guardado
const fila = (await db.query(`select semilla, entrada, resultado, huella_sha256, huella_entrada, version_codigo from sorteos`)).rows[0];
const { verificar } = require(R + 'scripts/navidad/verificar_sorteo.js');
console.log('verificar_sorteo desde la fila jsonb:', verificar(fila).ok);
await db.exec('reset role');
// entrada cambiada
await db.exec(`delete from correos; update cartas set recibe_carta_id=null, recibe_reserva_id=null; delete from sorteos;`);
await db.query(`update cartas set estado='aprobada' where token='tp'`);
await db.exec('set role service_role');
try { await db.query(q, [JSON.stringify(p), JSON.stringify(r.asignaciones), JSON.stringify(r.usos)]); console.log('ERROR: no detectó el cambio'); } catch (e) { console.log('entrada cambiada →', e.message.slice(0, 60)); }
await db.exec('reset role; set role anon');
try { await db.query(q, [JSON.stringify(p), '[]', '[]']); console.log('ERROR: anon pudo llamar'); } catch (e) { console.log('anon no puede llamar a la función:', e.message.slice(0, 50)); }
