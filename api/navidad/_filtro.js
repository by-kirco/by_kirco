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
/* para distancia de edición: solo 6+ letras, para no confundir "ruta"/"zorro" con insultos a 1 letra de distancia.
   "anormal" se excluye aparte: a 1 letra de "normal", una palabra corriente ("una Navidad normal"),
   así que solo se detecta si se escribe tal cual (buscaLista/buscaDifuso), nunca por distancia de edición. */
const SIN_DISTANCIA = ['anormal'];
const PARA_ERRORES = TODAS_UNA_PALABRA.filter((p) => p.length >= 6 && !SIN_DISTANCIA.includes(p));

const LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '$': 's', '@': 'a' };

function normaliza(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function normalizaDifuso(s) {
  const n = normaliza(s);
  let out = '';
  for (let i = 0; i < n.length; i++) {
    const c = n[i];
    if (LEET[c]) { out += LEET[c]; continue; }
    if (/[a-z0-9]/.test(c)) out += c;
  }
  return out;
}

function buscaLista(textoNorm, lista, categoria, hallazgos) {
  lista.forEach((raiz) => {
    const r = normaliza(raiz);
    const re = new RegExp('(^|[^a-z0-9])' + r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)', 'i');
    if (re.test(textoNorm)) hallazgos.push({ categoria, patron: raiz });
  });
}

function buscaDifuso(textoDifuso, hallazgos, yaEncontrado) {
  TODAS_UNA_PALABRA.forEach((raiz) => {
    if (yaEncontrado[raiz]) return;
    if (textoDifuso.indexOf(raiz) !== -1) { hallazgos.push({ categoria: 'posible insulto (variante)', patron: raiz }); yaEncontrado[raiz] = true; }
  });
}

function distancia(a, b) {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 2) return 99;
  let fila = [];
  for (let j = 0; j <= n; j++) fila[j] = j;
  for (let i = 1; i <= m; i++) {
    let anterior = fila[0]; fila[0] = i;
    for (let k = 1; k <= n; k++) {
      const temp = fila[k];
      fila[k] = a[i - 1] === b[k - 1] ? anterior : 1 + Math.min(anterior, fila[k], fila[k - 1]);
      anterior = temp;
    }
  }
  return fila[n];
}

function buscaConErrores(textoNorm, hallazgos, yaEncontrado) {
  const palabras = textoNorm.split(/[^a-z]+/).filter((w) => w.length >= 6);
  palabras.forEach((palabra) => {
    PARA_ERRORES.forEach((raiz) => {
      if (yaEncontrado[raiz]) return;
      const tolerancia = raiz.length <= 6 ? 1 : 2;
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
  buscaDifuso(normalizaDifuso(original), hallazgos, yaEncontrado);
  buscaConErrores(norm, hallazgos, yaEncontrado);

  return { ok: hallazgos.length === 0, hallazgos };
}

module.exports = { revisa };
