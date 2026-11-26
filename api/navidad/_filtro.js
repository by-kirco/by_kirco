/* by_kirco · Navidad — filtro de contenido (servidor).
   Misma lógica que navidad/js/filtro.js: nunca confiar solo en el filtro del cliente.
   Dos pasadas: coincidencia exacta y una pasada "difusa" que normaliza separadores
   (puntos, guiones, espacios sueltos entre letras) y leetspeak (g1l1p0ll4s, p.u.t.a...).
   MVP: lista de palabras razonable, no exhaustiva — revisar y ampliar con Sara antes de lanzar. */
const RE_URL = /\b((https?:\/\/|www\.)[^\s]+|[a-z0-9-]+\.(com|es|net|org|io|co|me|gg|app)\b[^\s]*)/gi;
const RE_HANDLE = /[@][a-z0-9_.]{2,}/gi;
const RE_EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const RE_TEL = /\b(?:\+?\d[\d\s().-]{6,}\d)\b/g;

const INSULTOS = ['idiota', 'imbecil', 'estupid', 'subnormal', 'retrasad', 'gilipollas', 'cabron', 'cabrona', 'hijo de puta', 'hija de puta', 'puta', 'puto', 'zorra', 'maricon', 'bollera', 'mogolic', 'anormal', 'basura humana'];
const AMENAZAS = ['te voy a matar', 'te mato', 'voy a matarte', 'te voy a pegar', 'te voy a hacer dano', 'ojala te muer', 'ojala mueras', 'deberias morir', 'te deseo la muerte'];
const DISCRIMINACION = ['sudaca', 'panchit', 'muerto de hambre', 'vete a tu pais', 'moro de mierda', 'negro de mierda', 'gitano de mierda', 'puto negro', 'puto moro', 'puto gitano', 'enfermo mental', 'rata de cloaca'];
const SEXUAL = ['polla', 'verga', 'coño', 'chupamela', 'follar', 'follame', 'pornografia', 'sexo oral', 'desnud', 'mandame fotos', 'tetas', 'pene', 'vagina'];

const TODAS_UNA_PALABRA = [].concat(INSULTOS, DISCRIMINACION, SEXUAL).filter((p) => p.indexOf(' ') === -1 && p.length >= 4);

const LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '$': 's', '@': 'a' };

function normaliza(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function buscaLista(textoNorm, lista, categoria, hallazgos) {
  lista.forEach((raiz) => {
    const r = normaliza(raiz);
    const re = new RegExp('(^|[^a-z0-9])' + r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)', 'i');
    if (re.test(textoNorm)) hallazgos.push({ categoria, patron: raiz });
  });
}

/* ---- Pasadas difusas (26 nov): con lista de palabras válidas para evitar falsos positivos ----
   Antes, «normal» se marcaba como «anormal» (1 letra de distancia), «página» como otra palabra,
   «diputado»/«reputación» por llevar dentro otra palabra, etc. Ahora:
   1) PALABRAS_VALIDAS / PREFIJOS_VALIDOS: nunca se marcan en las pasadas difusas (la pasada exacta
      sigue igual: «anormal», «puta»... se bloquean siempre).
   2) Pasada de separadores/leetspeak: una coincidencia dentro de UNA palabra normal solo cuenta si la
      palabra EMPIEZA por la raíz («estúpido», «cabrones»), no si la lleva en medio («diputado»).
      Si cruza varias palabras, solo cuenta si parece ofuscación: letras sueltas («p u t a»),
      separadores raros o números («p.u.t.a», «g1l1p0ll4s»), o palabras enteras pegadas («gili pollas»).
   3) Distancia de edición: solo contra palabras completas de la lista (no contra raíces tipo
      «estupid»), 1 letra de margen hasta 8 letras y 2 a partir de 9. */
var PALABRAS_VALIDAS = ['normal', 'normales', 'normalidad', 'normalmente', 'normalizar', 'normalizado', 'anomalo', 'anomala',
  'idioma', 'idiomas', 'pagina', 'paginas', 'collar', 'collares', 'fallar', 'fallare', 'dollar', 'foliar', 'follaje', 'follajes',
  'sudaba', 'sudabas', 'sudada', 'sudado', 'pollera', 'polleras', 'bolera', 'boleras', 'marion', 'cabros', 'cabrea', 'cabreas', 'cabreo',
  'ortografia', 'ortografias', 'monografia', 'monografias', 'orografia', 'coreografia', 'retraso', 'retrasos', 'retrasar', 'retrasa', 'retrasan',
  'retrase', 'retraso', 'retrasando', 'pancho', 'panchos', 'mongolia', 'vergara', 'envergadura', 'ampolla', 'ampollas', 'repollo', 'repollos', 'carrona'];
var PREFIJOS_VALIDOS = ['penetr', 'penelope', 'impenetr', 'retrat', 'estudi', 'escupi'];
var VALIDAS = {};
PALABRAS_VALIDAS.forEach(function (p) { VALIDAS[p] = true; });

function esValida(palabra) {
  if (VALIDAS[palabra]) return true;
  for (var i = 0; i < PREFIJOS_VALIDOS.length; i++) if (palabra.indexOf(PREFIJOS_VALIDOS[i]) === 0) return true;
  return false;
}

/* raíces que son prefijos (no palabras completas): no sirven para la distancia de edición */
var RAICES_PREFIJO = { estupid: true, retrasad: true, mogolic: true, panchit: true, desnud: true };
var PARA_ERRORES = TODAS_UNA_PALABRA.filter(function (p) { return p.length >= 6 && !RAICES_PREFIJO[p]; });

function esLetra(c) { return c >= 'a' && c <= 'z' || c === 'ñ'; }

function palabraEn(textoNorm, pos) {
  var a = pos, b = pos;
  while (a > 0 && esLetra(textoNorm[a - 1])) a--;
  while (b < textoNorm.length && esLetra(textoNorm[b])) b++;
  return { inicio: a, fin: b, palabra: textoNorm.slice(a, b) };
}

function buscaDifuso(textoNorm, hallazgos, yaEncontrado) {
  /* texto "difuso" (solo letras/números, leetspeak traducido) + posición de cada carácter en textoNorm */
  var dif = '', pos = [];
  for (var i = 0; i < textoNorm.length; i++) {
    var c = textoNorm[i];
    if (LEET[c]) { dif += LEET[c]; pos.push(i); continue; }
    if (/[a-z0-9]/.test(c)) { dif += c; pos.push(i); }
  }
  TODAS_UNA_PALABRA.forEach(function (raiz) {
    if (yaEncontrado[raiz]) return;
    var desde = 0, k;
    while ((k = dif.indexOf(raiz, desde)) !== -1) {
      desde = k + 1;
      var p0 = pos[k], p1 = pos[k + raiz.length - 1];
      var tramo = textoNorm.slice(p0, p1 + 1);
      var cuenta = false;
      if (/^[a-z]+$/.test(tramo)) {
        /* dentro de una sola palabra normal */
        var w = palabraEn(textoNorm, p0);
        cuenta = w.inicio === p0 && !esValida(w.palabra);
      } else if (/^[a-z]+( [a-z]+)+$/.test(tramo)) {
        /* cruza palabras separadas por espacios simples */
        var trozos = tramo.split(' ');
        var maxTrozo = Math.max.apply(null, trozos.map(function (t) { return t.length; }));
        var w0 = palabraEn(textoNorm, p0), w1 = palabraEn(textoNorm, p1);
        cuenta = maxTrozo <= 2 || (w0.inicio === p0 && w1.fin === p1 + 1);
      } else {
        /* separadores raros, números o símbolos dentro: ofuscación */
        cuenta = true;
      }
      if (cuenta) { hallazgos.push({ categoria: 'posible insulto (variante)', patron: raiz }); yaEncontrado[raiz] = true; return; }
    }
  });
}

/* distancia de edición (Levenshtein), para pillar faltas de ortografía tipo "gilipoyas" */
function distancia(a, b) {
  var m = a.length, n = b.length;
  if (Math.abs(m - n) > 2) return 99;
  var fila = [];
  for (var j = 0; j <= n; j++) fila[j] = j;
  for (var i = 1; i <= m; i++) {
    var anterior = fila[0]; fila[0] = i;
    for (var k = 1; k <= n; k++) {
      var temp = fila[k];
      fila[k] = a[i - 1] === b[k - 1] ? anterior : 1 + Math.min(anterior, fila[k], fila[k - 1]);
      anterior = temp;
    }
  }
  return fila[n];
}

function buscaConErrores(textoNorm, hallazgos, yaEncontrado) {
  var palabras = textoNorm.split(/[^a-zñ]+/).filter(function (w) { return w.length >= 6 && !esValida(w); });
  palabras.forEach(function (palabra) {
    PARA_ERRORES.forEach(function (raiz) {
      if (yaEncontrado[raiz]) return;
      var tolerancia = raiz.length <= 8 ? 1 : 2;
      if (Math.abs(palabra.length - raiz.length) > tolerancia) return;
      if (distancia(palabra, raiz) <= tolerancia) { hallazgos.push({ categoria: 'posible insulto (variante)', patron: raiz }); yaEncontrado[raiz] = true; }
    });
  });
}

function revisa(texto) {
  const original = String(texto || '');
  const hallazgos = [];

  [[RE_URL, 'enlace'], [RE_HANDLE, 'usuario'], [RE_EMAIL, 'correo'], [RE_TEL, 'teléfono']].forEach(([re, categoria]) => {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(original))) hallazgos.push({ categoria, patron: m[0] });
  });

  const norm = normaliza(original);
  buscaLista(norm, INSULTOS, 'insulto', hallazgos);
  buscaLista(norm, AMENAZAS, 'amenaza', hallazgos);
  buscaLista(norm, DISCRIMINACION, 'discriminación', hallazgos);
  buscaLista(norm, SEXUAL, 'sexual', hallazgos);

  const yaEncontrado = {};
  hallazgos.forEach((h) => { yaEncontrado[h.patron] = true; });
  buscaDifuso(norm, hallazgos, yaEncontrado);
  buscaConErrores(norm, hallazgos, yaEncontrado);

  return { ok: hallazgos.length === 0, hallazgos };
}

module.exports = { revisa };
