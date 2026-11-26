/* by_kirco · Navidad — filtro de contenido (cliente).
   Busca: enlaces/contacto (regla "sin enlaces ni publicidad") e insultos/amenazas/discriminación/sexual.
   Dos pasadas: coincidencia exacta (con o sin acentos) y una pasada "difusa" que normaliza
   separadores (puntos, guiones, espacios sueltos entre letras) y sustituciones tipo leetspeak
   (g1l1p0ll4s, p.u.t.a...) para pillar variantes mal escritas a propósito.
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

  /* para la pasada difusa (separadores/leetspeak): cualquier raíz de una palabra basta, el patrón ya es poco casual */
  var TODAS_UNA_PALABRA = [].concat(INSULTOS, DISCRIMINACION, SEXUAL).filter(function (p) { return p.indexOf(' ') === -1 && p.length >= 4; });
  /* para la pasada por distancia de edición: solo palabras de 6+ letras — con menos, palabras normales
     (p.ej. "ruta" o "zorro") quedan a 1 letra de distancia de un insulto y darían falsos positivos */
  var PARA_ERRORES = TODAS_UNA_PALABRA.filter(function (p) { return p.length >= 6; });

  var LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '$': 's', '@': 'a' };

  function normaliza(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  /* quita todo lo que no sea letra/número (espacios, puntos, guiones...) y pasa el leetspeak a letras,
     para que "g.i.l.i.p.o.l.l.a.s" o "g1l1p0ll4s" se lean igual que "gilipollas" */
  function normalizaDifuso(s) {
    var n = normaliza(s);
    var out = '';
    for (var i = 0; i < n.length; i++) {
      var c = n[i];
      if (LEET[c]) { out += LEET[c]; continue; }
      if (/[a-z0-9]/.test(c)) out += c;
    }
    return out;
  }

  function buscaLista(textoNorm, lista, categoria, hallazgos) {
    lista.forEach(function (raiz) {
      var r = normaliza(raiz);
      var re = new RegExp('(^|[^a-z0-9])' + r.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)', 'i');
      if (re.test(textoNorm)) hallazgos.push({ categoria: categoria, patron: raiz });
    });
  }

  function buscaDifuso(textoDifuso, hallazgos, yaEncontrado) {
    TODAS_UNA_PALABRA.forEach(function (raiz) {
      if (yaEncontrado[raiz]) return;
      if (textoDifuso.indexOf(raiz) !== -1) { hallazgos.push({ categoria: 'posible insulto (variante)', patron: raiz }); yaEncontrado[raiz] = true; }
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

  /* compara cada "palabra" del texto contra la lista, tolerando 1-2 letras de diferencia según el largo */
  function buscaConErrores(textoNorm, hallazgos, yaEncontrado) {
    var palabras = textoNorm.split(/[^a-z]+/).filter(function (w) { return w.length >= 6; });
    palabras.forEach(function (palabra) {
      PARA_ERRORES.forEach(function (raiz) {
        if (yaEncontrado[raiz]) return;
        var tolerancia = raiz.length <= 6 ? 1 : 2;
        if (Math.abs(palabra.length - raiz.length) > tolerancia) return;
        if (distancia(palabra, raiz) <= tolerancia) { hallazgos.push({ categoria: 'posible insulto (variante)', patron: raiz }); yaEncontrado[raiz] = true; }
      });
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

    var yaEncontrado = {};
    hallazgos.forEach(function (h) { yaEncontrado[h.patron] = true; });
    buscaDifuso(normalizaDifuso(original), hallazgos, yaEncontrado);
    buscaConErrores(norm, hallazgos, yaEncontrado);

    return { ok: hallazgos.length === 0, hallazgos: hallazgos, coincidencias: coincidencias };
  }

  return { revisa: revisa };
})();
