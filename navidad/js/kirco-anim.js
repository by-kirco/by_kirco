/* by_kirco · Navidad — motor de animación, portado de diseno/base.js (GSAP).
   Respeta prefers-reduced-motion en cada función. */
var K = {
  copos: function () {
    var s = ['assets/svg/copo_1.svg', 'assets/svg/copo_2.svg', 'assets/svg/copo_3.svg', 'assets/svg/copo_4.svg', 'assets/svg/copo_5.svg'];
    var o = [];
    for (var i = 0; i < 34; i++) { o.push({ src: s[i % 5], s: 8 + ((i * 7) % 15), o: (0.55 + ((i * 13) % 41) / 100).toFixed(2) }); }
    return o;
  },
  pintarCopos: function (box) {
    if (!box) return;
    K.copos().forEach(function (c) {
      var im = document.createElement('img');
      im.src = c.src; im.alt = ''; im.width = c.s; im.height = c.s; im.style.opacity = c.o;
      box.appendChild(im);
    });
  },
  rm: function () { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); },
  g: function () { if (window.gsap && window.ScrollTrigger && !K._reg) { window.gsap.registerPlugin(window.ScrollTrigger); K._reg = true; } return window.gsap; },
  listo: function (fn) { var n = 0; var t = function () { if (window.gsap || n > 40) { fn(); } else { n++; setTimeout(t, 50); } }; setTimeout(t, 30); },
  entrada: function (root) {
    var g = K.g(); if (!g || !root) return null;
    var hoja = root.querySelectorAll('.hoja-entra');
    var lineas = root.querySelectorAll('.linea > span');
    if (K.rm()) { g.fromTo(root, { opacity: 0 }, { opacity: 1, duration: .2 }); return null; }
    var tl = g.timeline();
    if (hoja.length) tl.fromTo(hoja, { yPercent: 100, rotation: 1.5 }, { yPercent: 0, rotation: 0, duration: .9, ease: 'expo.out', stagger: .08 });
    if (lineas.length) tl.from(lineas, { yPercent: 110, duration: 1, stagger: .08, ease: 'expo.out' }, hoja.length ? '-=.55' : 0);
    return tl;
  },
  revela: function (el) {
    var g = K.g(); if (!g || !el) return;
    var l = el.querySelectorAll('.linea > span');
    if (K.rm()) { g.fromTo(el, { opacity: 0 }, { opacity: 1, duration: .2 }); return; }
    g.fromTo(l, { yPercent: 110 }, { yPercent: 0, duration: 1, stagger: .08, ease: 'expo.out' });
  },
  pausable: function (tweens, trigger) {
    var g = K.g(); if (!g) return;
    if (window.ScrollTrigger && trigger) {
      window.ScrollTrigger.create({ trigger: trigger, start: 'top bottom', end: 'bottom top',
        onToggle: function (s) { tweens.forEach(function (t) { s.isActive ? t.resume() : t.pause(); }); } });
    }
    if (!K._vis) { K._vis = true; document.addEventListener('visibilitychange', function () { document.hidden ? g.globalTimeline.pause() : g.globalTimeline.resume(); }); }
  },
  pino: function (svg) {
    var g = K.g(); if (!g || !svg || K.rm()) return [];
    var out = [];
    [['#pino-capa-1','150 318',1.2,3.4],['#pino-capa-2','150 236',-1.6,3.0],['#pino-capa-3','150 158',2.2,2.6],
     ['#pino-guirnalda-1','150 318',1.2,3.4],['#pino-guirnalda-2','150 236',-1.6,3.0],['#pino-guirnalda-3','150 158',2.2,2.6],
     ['#pino-luces-1','150 318',1.2,3.4],['#pino-luces-2','150 236',-1.6,3.0],['#pino-luces-3','150 158',2.2,2.6],
     ['#pino-estrella','150 34',-6,2.2]].forEach(function (a, j) {
      var el = svg.querySelector(a[0]); if (!el) return;
      out.push(g.fromTo(el, { rotation: -a[2] * .5 }, { rotation: a[2], svgOrigin: a[1], duration: a[3], ease: 'sine.inOut', yoyo: true, repeat: -1, delay: j * .25 }));
    });
    svg.querySelectorAll('[id^="luz-"]').forEach(function (l) {
      out.push(g.to(l, { opacity: .35, duration: g.utils.random(1.1, 2.4), ease: 'sine.inOut', yoyo: true, repeat: -1, delay: g.utils.random(0, 2) }));
    });
    return out;
  },
  respira: function (el, origin) {
    var g = K.g(); if (!g || !el || K.rm()) return null;
    var v = { scaleY: 1.015, scaleX: .995, duration: 2.4, ease: 'sine.inOut', yoyo: true, repeat: -1 };
    if (origin) v.svgOrigin = origin; else v.transformOrigin = '50% 100%';
    return g.to(el, v);
  },
  banderita: function (svg, arriba) {
    var g = K.g(); var f = svg && svg.querySelector('#buzon-banderita'); if (!g || !f) return;
    if (K.rm()) { g.set(f, { rotation: arriba ? -90 : 0, svgOrigin: '312 300' }); return; }
    g.to(f, { rotation: arriba ? -90 : 0, svgOrigin: '312 300', duration: .7, ease: 'back.out(1.6)', delay: .1 });
  },
  acumula: function () {
    var g = K.g(); var c = Array.prototype.slice.call(document.querySelectorAll('.nieve-cap span'));
    if (!g || !c.length) return;
    c.forEach(function (s) { if (s.dataset.acu) return; s.dataset.acu = '1';
      if (K.rm()) { g.set(s, { scaleY: 1 }); return; }
      g.fromTo(s, { scaleY: 0 }, { scaleY: 1, duration: g.utils.random(14, 24), delay: g.utils.random(0, 3), ease: 'sine.inOut' }); });
  },
  caeNieveCap: function (listo, quieto) {
    var g = K.g(); var c = Array.prototype.slice.call(document.querySelectorAll('.nieve-cap span'));
    if (!g || !c.length) { listo(); return; }
    if (K.rm()) { g.to(c, { opacity: 0, duration: .2, onComplete: listo }); return; }
    var H = window.innerHeight || 800;
    g.killTweensOf(c);
    g.to(c, { y: function () { return H * g.utils.random(.9, 1.3); }, x: function () { return g.utils.random(-40, 40); },
      rotation: function () { return g.utils.random(-120, 120); }, opacity: 0,
      duration: function () { return g.utils.random(1, 1.6); }, ease: 'power2.in', stagger: { each: .04, from: 'random' },
      onComplete: function () { quieto ? listo() : setTimeout(listo, 150); } });
  },
  voltea: function (el, listo) {
    var g = K.g(); if (!g || !el) { listo(); return; }
    try { sessionStorage.setItem('kirco-volteo', String(Math.round(el.offsetHeight))); } catch (e) {}
    if (K.rm()) { g.to(el, { opacity: 0, duration: .2, onComplete: listo }); return; }
    g.to(el, { rotationY: 90, transformPerspective: 1400, transformOrigin: '50% 50%', duration: .45, ease: 'power2.in', onComplete: listo });
  },
  volteada: function (el) {
    var v = 0; try { v = parseInt(sessionStorage.getItem('kirco-volteo') || '0', 10); sessionStorage.removeItem('kirco-volteo'); } catch (e) {}
    var g = K.g(); if (!v || !g || !el) return false;
    el.style.display = 'flex'; el.style.flexDirection = 'column'; el.style.minHeight = v + 'px';
    if (el.firstElementChild) el.firstElementChild.style.flex = '1';
    if (K.rm()) { g.fromTo(el, { opacity: 0 }, { opacity: 1, duration: .2 }); return true; }
    g.fromTo(el, { rotationY: -90, transformPerspective: 1400, transformOrigin: '50% 50%' }, { rotationY: 0, duration: .45, ease: 'power2.out', clearProps: 'transform' });
    return true;
  },
  autoalto: function (ta) { if (!ta) return; ta.style.height = 'auto'; ta.style.height = Math.max(170, ta.scrollHeight) + 'px'; },
  vuela: function (el, listo) {
    var g = K.g(); if (!g || !el) { listo(); return; }
    if (K.rm()) { g.to(el, { opacity: 0, duration: .2, onComplete: listo }); return; }
    g.to(el, { y: -(window.innerHeight || 800) * 1.1, rotation: -8, scale: .85, opacity: 0, duration: .8, ease: 'power3.in', onComplete: listo });
  },
  nieve: function (box) {
    var g = K.g(); if (!g || !box || K.rm()) return;
    box.querySelectorAll('img').forEach(function (im) {
      if (im.offsetParent === null) return;
      var s = im.width || 14;
      var cae = function () {
        g.set(im, { x: g.utils.random(0, box.clientWidth), y: -30, rotation: g.utils.random(0, 180) });
        g.to(im, { y: box.clientHeight + 30, rotation: '+=' + g.utils.random(-120, 120), duration: g.utils.random(7, 14) * (22 / (s + 8)), ease: 'none', onComplete: cae });
      };
      g.set(im, { y: -40 });
      g.delayedCall(g.utils.random(0, 8), cae);
      g.to(im, { xPercent: g.utils.random(-120, 120), duration: g.utils.random(2.5, 4.5), ease: 'sine.inOut', yoyo: true, repeat: -1 });
    });
  }
};

/* Carga el pie de página común (Pie.dc.html) en cualquier página con <div data-k-pie></div> */
K.pintarPie = function () {
  var host = document.querySelector('[data-k-pie]'); if (!host) return;
  var nieve = host.getAttribute('data-nieve') === 'si';
  host.innerHTML =
    (nieve ? '<div style="position:relative;z-index:4;margin-top:-2px"><svg viewBox="0 0 1440 50" preserveAspectRatio="none" aria-hidden="true" style="display:block;width:100%;height:36px"><path d="M0 50 L0 24 C240 4 480 4 720 22 C960 40 1200 36 1440 14 L1440 50 Z" fill="#FFFFFF"></path><path d="M0 50 L0 40 C240 22 480 22 720 36 C960 50 1200 48 1440 30 L1440 50 Z" fill="#6F9C3E"></path></svg></div>' : '') +
    '<footer class="k-pie"><div class="k-pie-inner">' +
      '<div style="flex:1 1 260px;display:flex;flex-direction:column;gap:4px">' +
        '<nav aria-label="Enlaces legales"><a href="legal.html" style="display:inline-flex;align-items:center;min-height:44px">Política de privacidad</a></nav>' +
        '<p class="etiqueta" style="margin:0;font-size:13px;color:#fff">by_kirco · Escribo para ti sin conocerte</p>' +
      '</div>' +
      '<img src="assets/svg/logo_bk-neg2c_naranja.svg" alt="by_kirco">' +
    '</div></footer>';
};
document.addEventListener('DOMContentLoaded', K.pintarPie);
