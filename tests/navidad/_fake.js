/* Supabase y sesión simulados para las pruebas (en memoria). Nada toca la base de datos real. */
'use strict';
const path = require('path');
const crypto = require('crypto');

const API = path.join(__dirname, '..', '..', 'api', 'navidad');

const UNICOS = {
  cartas: [
    { cols: ['token'] },
    { cols: ['correo'], donde: (r) => ['pendiente', 'aprobada'].includes(r.estado), nombre: 'ux_cartas_correo_activo' },
    { cols: ['destino_carta_id'], donde: (r) => r.destino_carta_id != null, nombre: 'ux_cartas_destino_elegido' },
    { cols: ['recibe_carta_id'], donde: (r) => r.recibe_carta_id != null }
  ],
  correos: [{ cols: ['carta_id', 'tipo'] }],
  notas: [{ cols: ['carta_id'] }],
  sorteos: [{ cols: ['edicion'] }],
  cartas_reserva: [{ cols: ['id'] }]
};
const DEFECTOS = {
  cartas: () => ({ id: crypto.randomUUID(), estado: 'pendiente', destino_carta_id: null, recibe_carta_id: null, recibe_reserva_id: null, motivo_rechazo: null, creada_at: new Date().toISOString() }),
  correos: () => ({ id: crypto.randomUUID(), estado: 'pendiente', programado_para: null, resend_id: null, intentos: 0, ultimo_error: null, creado_at: new Date().toISOString(), enviado_at: null }),
  notas: () => ({ id: crypto.randomUUID(), estado: 'pendiente', creada_at: new Date().toISOString() }),
  sorteos: () => ({ id: crypto.randomUUID(), ejecutado_at: new Date().toISOString() }),
  cartas_reserva: () => ({ usos: 0, creada_at: new Date().toISOString() })
};

function crearDb() {
  const db = { cartas: [], correos: [], notas: [], sorteos: [], cartas_reserva: [], llamadasRpc: 0 };

  function violaUnico(tabla, fila, ignorar) {
    for (const u of UNICOS[tabla] || []) {
      if (u.donde && !u.donde(fila)) continue;
      const otra = db[tabla].find((r) => r !== ignorar && (!u.donde || u.donde(r)) && u.cols.every((c) => r[c] === fila[c]));
      if (otra) return { code: '23505', message: 'duplicate key value violates unique constraint "' + (u.nombre || tabla + '_' + u.cols.join('_')) + '"' };
    }
    return null;
  }

  class Q {
    constructor(tabla) { this.t = tabla; this.filtros = []; this.op = 'select'; this.ord = null; this.lim = null; this.uno = null; this.opts = {}; }
    select(cols, opts) { if (this.op === 'select') this.op = 'select'; this.ret = true; this.opts = opts || {}; return this; }
    insert(v) { this.op = 'insert'; this.val = v; return this; }
    update(v) { this.op = 'update'; this.val = v; return this; }
    upsert(v, o) { this.op = 'upsert'; this.val = v; this.uo = o || {}; return this; }
    eq(c, v) { this.filtros.push((r) => r[c] === v); return this; }
    neq(c, v) { this.filtros.push((r) => r[c] !== v); return this; }
    in(c, vs) { this.filtros.push((r) => vs.includes(r[c])); return this; }
    is(c, v) { this.filtros.push((r) => (v === null ? r[c] == null : r[c] === v)); return this; }
    not(c, op, v) { this.filtros.push((r) => (op === 'is' && v === null ? r[c] != null : r[c] !== v)); return this; }
    lt(c, v) { this.filtros.push((r) => r[c] < v); return this; }
    order(c, o) { this.ord = { c, asc: !o || o.ascending !== false }; return this; }
    limit(n) { this.lim = n; return this; }
    maybeSingle() { this.uno = 'maybe'; return this; }
    single() { this.uno = 'single'; return this; }
    filtra() { return db[this.t].filter((r) => this.filtros.every((f) => f(r))); }
    ejecuta() {
      const tabla = db[this.t];
      if (!tabla) return { data: null, error: { message: 'relation "' + this.t + '" does not exist', code: '42P01' } };
      let filas;
      if (this.op === 'insert' || this.op === 'upsert') {
        const vals = Array.isArray(this.val) ? this.val : [this.val];
        filas = [];
        for (const v of vals) {
          const fila = Object.assign(DEFECTOS[this.t] ? DEFECTOS[this.t]() : {}, JSON.parse(JSON.stringify(v)));
          const err = violaUnico(this.t, fila);
          if (err) { if (this.op === 'upsert' && this.uo.ignoreDuplicates) continue; return { data: null, error: err }; }
          tabla.push(fila); filas.push(fila);
        }
      } else if (this.op === 'update') {
        filas = this.filtra();
        for (const r of filas) {
          const nueva = Object.assign({}, r, this.val);
          const err = violaUnico(this.t, nueva, r);
          if (err) return { data: null, error: err };
        }
        filas.forEach((r) => Object.assign(r, this.val));
      } else {
        filas = this.filtra();
      }
      if (this.ord) { const { c, asc } = this.ord; filas = filas.slice().sort((a, b) => (a[c] < b[c] ? -1 : a[c] > b[c] ? 1 : 0) * (asc ? 1 : -1)); }
      if (this.lim != null) filas = filas.slice(0, this.lim);
      const copia = JSON.parse(JSON.stringify(filas));
      if (this.opts.head) return { data: null, count: copia.length, error: null };
      if (this.uno) {
        if (copia.length > 1) return { data: null, error: { message: 'varias filas' } };
        if (this.uno === 'single' && !copia.length) return { data: null, error: { message: 'ninguna fila' } };
        return { data: copia[0] || null, error: null };
      }
      return { data: copia, count: copia.length, error: null };
    }
    then(ok, ko) { try { return Promise.resolve(this.ejecuta()).then(ok, ko); } catch (e) { return Promise.reject(e).then(ok, ko); } }
  }

  /* Emula navidad_registrar_sorteo de la migración 02 */
  function registrarSorteo({ p_sorteo, p_asignaciones, p_usos }) {
    db.llamadasRpc++;
    const ex = db.sorteos.find((s) => s.edicion === p_sorteo.edicion);
    if (ex) return { data: { ya_existia: true, sorteo: ex }, error: null };
    const ent = p_sorteo.entrada.cartas;
    const cambios = db.cartas.length !== ent.length || ent.some((e) => { const c = db.cartas.find((x) => x.id === e.id); return !c || c.estado !== e.estado; });
    if (cambios) return { data: null, error: { message: 'NAVIDAD_ENTRADA_CAMBIADA: las cartas han cambiado' } };
    const copia = JSON.parse(JSON.stringify(db.cartas));
    for (const a of p_asignaciones) {
      const c = db.cartas.find((x) => x.id === a.receptor);
      if (!c || c.recibe_carta_id || c.recibe_reserva_id) { db.cartas = copia; return { data: null, error: { message: 'NAVIDAD_RECEPTOR_OCUPADO' } }; }
      c.recibe_carta_id = a.tipo === 'carta' ? a.id : null;
      c.recibe_reserva_id = a.tipo === 'reserva' ? a.id : null;
      if (!db.correos.find((x) => x.carta_id === a.receptor && x.tipo === 'entrega')) {
        db.correos.push(Object.assign(DEFECTOS.correos(), { carta_id: a.receptor, tipo: 'entrega', programado_para: p_sorteo.entrega_at }));
      }
    }
    for (const u of p_usos) { const r = db.cartas_reserva.find((x) => x.id === u.id); if (r) r.usos += u.veces; }
    const s = Object.assign(DEFECTOS.sorteos(), {
      edicion: p_sorteo.edicion, participantes: p_sorteo.participantes, cartas_persona: p_sorteo.cartas_persona,
      reservas_usadas: p_sorteo.reservas_usadas, semilla: p_sorteo.semilla, entrada: p_sorteo.entrada, resultado: p_sorteo.resultado,
      huella_entrada: p_sorteo.huella_entrada, huella_sha256: p_sorteo.huella_sha256, version_codigo: p_sorteo.version_codigo
    });
    db.sorteos.push(s);
    return { data: { ya_existia: false, sorteo: s }, error: null };
  }

  const cliente = {
    from: (t) => new Q(t),
    rpc: async (nombre, args) => {
      if (nombre !== 'navidad_registrar_sorteo') return { data: null, error: { message: 'rpc desconocida' } };
      return registrarSorteo(args);
    }
  };
  return { db, cliente };
}

/* Instala los simulados en la caché de require ANTES de cargar los handlers */
function instalar() {
  const estado = { db: null, cliente: null };
  require.cache[path.join(API, '_supabase.js')] = {
    id: path.join(API, '_supabase.js'), filename: path.join(API, '_supabase.js'), loaded: true,
    exports: { getSupabase: () => estado.cliente, getSupabaseAnon: () => { throw new Error('no anon en pruebas'); } }
  };
  const sesionOk = (req) => String((req.headers && req.headers.cookie) || '').includes('sesion=sara');
  require.cache[path.join(API, '_auth.js')] = {
    id: path.join(API, '_auth.js'), filename: path.join(API, '_auth.js'), loaded: true,
    exports: {
      usuarioDeSesion: async (req) => (sesionOk(req) ? { user: { id: 'sara' } } : null),
      requiereSesion: async (req, res) => { if (sesionOk(req)) return { id: 'sara' }; res.status(401).json({ error: 'No autorizada.' }); return null; }
    }
  };
  function nueva() { const { db, cliente } = crearDb(); estado.db = db; estado.cliente = cliente; return db; }
  nueva();
  return { nueva, get db() { return estado.db; } };
}

function req(metodo, body, extra) {
  return Object.assign({ method: metodo, body: body || {}, headers: {}, query: {} }, extra || {});
}
function reqSara(metodo, body, extra) {
  const r = req(metodo, body, extra); r.headers = Object.assign({ cookie: 'sesion=sara' }, r.headers); return r;
}
function res() {
  const r = { statusCode: 200, cuerpo: null, cabeceras: {} };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.cuerpo = b; return r; };
  r.setHeader = (k, v) => { r.cabeceras[k] = v; };
  return r;
}

/* fetch simulado de Resend */
function fetchResend(respuestas) {
  const llamadas = [];
  const fn = async (url, opts) => {
    const cuerpo = JSON.parse(opts.body);
    llamadas.push({ url, cuerpo, cabeceras: opts.headers });
    const r = typeof respuestas === 'function' ? respuestas(url, cuerpo, llamadas.length) : { status: 200 };
    const status = r.status || 200;
    let datos = r.json;
    if (!datos && status === 200) datos = Array.isArray(cuerpo) ? { data: cuerpo.map((_, i) => ({ id: 're_' + llamadas.length + '_' + i })) } : { id: 're_' + llamadas.length };
    return { status, json: async () => datos };
  };
  fn.llamadas = llamadas;
  return fn;
}

module.exports = { instalar, req, reqSara, res, fetchResend, API };
