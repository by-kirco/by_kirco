/* by_kirco · Navidad — filtro de contenido (cliente).
   Busca: enlaces/contacto (regla "sin enlaces ni publicidad") e insultos/amenazas/discriminación/sexual.
   MVP: la lista de palabras es una base razonable, no exhaustiva — revisar y ampliar con Sara antes de lanzar.
   No se guarda nunca lo que detecta; solo se usa para bloquear "Cerrar el sobre" en el navegador. */
var KFiltro = (function () {
  var RE_URL = /\b((https?:\/\/|www\.)[^\s]+|[a-z0-9-]+\.(com|es|net|org|io|co|me|gg|app)\b[^\s]*)/gi;
  var RE_HANDLE = /[@][a-z0-9_.]{2,}/gi;
  var RE_EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
  var RE_TEL = /\b(?:\+?\d[\d\s().-]{6,}\d)\b/g;

  /* palabras/raíces por categoría — coinciden con o sin acentos y en cualquier capitalización */
  var INSULTOS = ['idiota', 'imbecil', 'estupid', 'subnormal', 'retrasad', 'gilipollas', 'cabron', 'cabrona', 'hijo de puta', 'hija de puta', 'puta', 'puto', 'zorra', 'maricon', 'bollera', 'mogolic', 'anormal', 'basura humana'];
  var AMENAZAS = ['te voy a matar', 'te mato', 'voy a matarte', 'te voy a pegar', 'te voy a hacer dano', 'ojala te muer', 'ojala mueras', 'deberias morir', 'te deseo la muerte'];
  var DISCRIMINACION = ['sudaca', 'panchit', 'muerto de hambre', 'vete a tu pais', 'moro de mierda', 'negro de mierda', 'gitano de mierda', 'puto negro', 'puto moro', 'puto gitano', 'enfermo mental', 'rata de cloaca'];
  var SEXUAL = ['polla', 'verga', 'coño', 'chupamela', 'follar', 'follame', 'pornografia', 'sexo oral', 'desnud', 'mandame fotos', 'tetas', 'pene', 'vagina'];

  function normaliza(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function buscaLista(textoNorm, lista, categoria, hallazgos) {
    lista.forEach(function (raiz) {
      var r = normaliza(raiz);
      var re = new RegExp('(^|[^a-z0-9])' + r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)', 'i');
      if (re.test(textoNorm)) hallazgos.push({ categoria: categoria, patron: raiz });
    });
  }

  /* Revisa un texto y devuelve { ok, motivo, coincidencias:[{inicio,fin,texto}] } */
  function revisa(texto) {
    var original = texto || '';
    var hallazgos = [];
    var coincidencias = [];

    [[RE_URL, 'enlace'], [RE_HANDLE, 'usuario'], [RE_EMAIL, 'correo'], [RE_TEL, 'teléfono']].forEach(function (par) {
      var re = par[0]; re.lastIndex = 0;
      var m;
      while ((m = re.exec(original))) {
        coincidencias.push({ inicio: m.index, fin: m.index + m[0].length, texto: m[0] });
        hallazgos.push({ categoria: par[1], patron: m[0] });
      }
    });

    var norm = normaliza(original);
    buscaLista(norm, INSULTOS, 'insulto', hallazgos);
    buscaLista(norm, AMENAZAS, 'amenaza', hallazgos);
    buscaLista(norm, DISCRIMINACION, 'discriminación', hallazgos);
    buscaLista(norm, SEXUAL, 'sexual', hallazgos);

    return { ok: hallazgos.length === 0, hallazgos: hallazgos, coincidencias: coincidencias };
  }

  return { revisa: revisa };
})();
