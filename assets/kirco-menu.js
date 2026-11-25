/* Menú hamburguesa móvil (max-width: 959px). En escritorio no hace nada visible. */
(function () {
  var BP = '(max-width: 959px)';

  // Guarda la instancia de Lenis cuando se construye (las páginas la dejan en un scope local).
  if (window.Lenis && !window.Lenis.__kcPatched) {
    var Orig = window.Lenis;
    function KcLenis() {
      var inst = Reflect.construct(Orig, arguments, KcLenis);
      window.__kcLenis = inst;
      return inst;
    }
    KcLenis.prototype = Orig.prototype;
    try { Object.setPrototypeOf(KcLenis, Orig); } catch (e) {}
    KcLenis.__kcPatched = true;
    window.Lenis = KcLenis;
  }

  function isMobile() {
    return window.matchMedia(BP).matches;
  }

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    var header = document.querySelector('header');
    var nav = header && header.querySelector('nav');
    if (!nav) return;

    if (!nav.id) nav.id = 'kc-menu-panel';
    nav.classList.add('kc-nav-panel');

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'kc-menu-btn';
    btn.setAttribute('aria-label', 'Abrir menú');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', nav.id);
    btn.innerHTML = '<span class="kc-menu-bars" aria-hidden="true"><span></span><span></span><span></span></span>';

    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'kc-menu-close';
    close.setAttribute('aria-label', 'Cerrar menú');
    close.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    nav.insertBefore(close, nav.firstChild);

    var portal = document.createElement('div');
    portal.className = 'kc-menu-portal';
    document.body.appendChild(portal);

    var overlay = document.createElement('div');
    overlay.className = 'kc-menu-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    portal.appendChild(overlay);

    var placeholder = document.createComment('kc-nav-home');
    nav.parentNode.insertBefore(btn, nav);
    document.documentElement.classList.add('kc-menu-ready');

    var open = false;
    var lastFocus = null;

    function navInHeader() {
      return header.contains(nav);
    }

    function syncNavPlace() {
      if (isMobile()) {
        if (navInHeader()) {
          nav.parentNode.insertBefore(placeholder, nav);
          portal.appendChild(nav);
        }
      } else if (!navInHeader() && placeholder.parentNode) {
        placeholder.parentNode.insertBefore(nav, placeholder);
      }
    }

    function focusables() {
      return Array.prototype.slice.call(
        nav.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
      ).filter(function (el) {
        return el.offsetParent !== null || el === close;
      });
    }

    function getLenis() {
      return window.__kcLenis || window.lenis || null;
    }

    function setOpen(next) {
      if (next && !isMobile()) return;
      if (next === open) return;
      open = next;
      if (open) syncNavPlace();
      document.documentElement.classList.toggle('kc-menu-open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
      overlay.setAttribute('aria-hidden', open ? 'false' : 'true');
      nav.setAttribute('aria-hidden', isMobile() && !open ? 'true' : 'false');

      var lenis = getLenis();
      if (open) {
        lastFocus = document.activeElement;
        if (lenis && typeof lenis.stop === 'function') lenis.stop();
        var firstLink = nav.querySelector('a');
        window.setTimeout(function () {
          if (firstLink) firstLink.focus();
        }, 0);
      } else {
        if (lenis && typeof lenis.start === 'function') lenis.start();
        var back = lastFocus && typeof lastFocus.focus === 'function' ? lastFocus : btn;
        window.setTimeout(function () { back.focus(); }, 0);
        lastFocus = null;
      }
    }

    btn.addEventListener('click', function () { setOpen(!open); });
    close.addEventListener('click', function () { setOpen(false); });
    overlay.addEventListener('click', function () { setOpen(false); });

    nav.addEventListener('keydown', function (e) {
      if (!open) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key !== 'Tab') return;
      var items = focusables();
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (open && e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    });

    var mq = window.matchMedia(BP);
    function onBp(e) {
      if (!e.matches && open) setOpen(false);
      syncNavPlace();
      nav.setAttribute('aria-hidden', isMobile() && !open ? 'true' : 'false');
    }
    if (mq.addEventListener) mq.addEventListener('change', onBp);
    else if (mq.addListener) mq.addListener(onBp);

    syncNavPlace();
    nav.setAttribute('aria-hidden', isMobile() && !open ? 'true' : 'false');
  });
})();
