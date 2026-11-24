/* by_kirco · Navidad — filtro de contenido (servidor).
   Misma lógica que navidad/js/filtro.js: nunca confiar solo en el filtro del cliente.
   MVP: lista de palabras razonable, no exhaustiva — revisar y ampliar con Sara antes de lanzar. */
const RE_URL = /\b((https?:\/\/|www\.)[^\s]+|[a-z0-9-]+\.(com|es|net|org|io|co|me|gg|app)\b[^\s]*)/gi;
const RE_HANDLE = /[@][a-z0-9_.]{2,}/gi;
const RE_EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const RE_TEL = /\b(?:\+?\d[\d\s().-]{6,}\d)\b/g;

const INSULTOS = ['idiota', 'imbecil', 'estupid', 'subnormal', 'retrasad', 'gilipollas', 'cabron', 'cabrona', 'hijo de puta', 'hija de puta', 'puta', 'puto', 'zorra', 'maricon', 'bollera', 'mogolic', 'anormal', 'basura humana'];
const AMENAZAS = ['te voy a matar', 'te mato', 'voy a matarte', 'te voy a pegar', 'te voy a hacer dano', 'ojala te muer', 'ojala mueras', 'deberias morir', 'te deseo la muerte'];
const DISCRIMINACION = ['sudaca', 'panchit', 'muerto de hambre', 'vete a tu pais', 'moro de mierda', 'negro de mierda', 'gitano de mierda', 'puto negro', 'puto moro', 'puto gitano', 'enfermo mental', 'rata de cloaca'];
const SEXUAL = ['polla', 'verga', 'coño', 'chupamela', 'follar', 'follame', 'pornografia', 'sexo oral', 'desnud', 'mandame fotos', 'tetas', 'pene', 'vagina'];

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

  return { ok: hallazgos.length === 0, hallazgos };
}

module.exports = { revisa };
