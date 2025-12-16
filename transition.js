// transition.js — clean header-fixed page slide transition implementation

(function () {
  'use strict';

  var DURATION = 700; // ms
  var isTransitioning = false;

  function log() { if (window.console && console.log) console.log.apply(console, arguments); }
  function warn() { if (window.console && console.warn) console.warn.apply(console, arguments); }
  function error() { if (window.console && console.error) console.error.apply(console, arguments); }

  function warnIfFileProtocol() {
    if (location.protocol === 'file:') {
      warn('[transition.js] Running under file:// — fetch may be restricted. Serve over HTTP to test.');
    }
  }

  function isInternal(href) {
    if (!href) return false;
    if (href.indexOf('#') === 0) return false;
    try {
      return (new URL(href, location.href)).origin === location.origin;
    } catch (e) {
      return false;
    }
  }

  function extractBodyWithoutHeader(body) {
    var container = document.createElement('div');
    var children = body && body.children ? Array.prototype.slice.call(body.children) : [];
    children.forEach(function (ch) {
      if (ch.tagName && ch.tagName.toLowerCase() === 'header') return;
      container.appendChild(ch.cloneNode(true));
    });
    return container.innerHTML;
  }

  function createOverlay(currentHTML, nextHTML, headerHeight, direction) {
    var overlay = document.createElement('div');
    overlay.id = 'page-transition-overlay';
    overlay.style.position = 'fixed';
    overlay.style.left = '0';
    overlay.style.top = headerHeight + 'px';
    overlay.style.width = '100%';
    overlay.style.height = (window.innerHeight - headerHeight) + 'px';
    overlay.style.overflow = 'hidden';
    overlay.style.zIndex = '99999';
    overlay.style.pointerEvents = 'none';
    overlay.style.background = window.getComputedStyle(document.body).backgroundColor || '#fff';

    var wrapper = document.createElement('div');
    wrapper.style.width = '200%';
    wrapper.style.height = '100%';
    wrapper.style.display = 'flex';
    wrapper.style.transition = 'transform ' + DURATION + 'ms ease-in-out';

    var left = document.createElement('div');
    left.style.width = '50%';
    left.style.height = '100%';
    left.style.overflow = 'auto';
    left.innerHTML = currentHTML;

    var right = document.createElement('div');
    right.style.width = '50%';
    right.style.height = '100%';
    right.style.overflow = 'auto';
    right.innerHTML = nextHTML;

    if (direction === 'left') {
      wrapper.appendChild(right);
      wrapper.appendChild(left);
      wrapper.style.transform = 'translateX(-50%)';
      requestAnimationFrame(function () { wrapper.style.transform = 'translateX(0)'; });
    } else {
      wrapper.appendChild(left);
      wrapper.appendChild(right);
      wrapper.style.transform = 'translateX(0)';
      requestAnimationFrame(function () { wrapper.style.transform = 'translateX(-50%)'; });
    }

    overlay.appendChild(wrapper);
    return overlay;
  }

  function doTransition(url, direction) {
    if (isTransitioning) return;
    isTransitioning = true;

    fetch(url, { credentials: 'same-origin' }).then(function (res) {
      if (!res.ok) throw new Error('fetch failed: ' + res.status);
      return res.text();
    }).then(function (text) {
      var parser = new DOMParser();
      var doc = parser.parseFromString(text, 'text/html');

      var header = document.querySelector('header');
      var headerHeight = header ? header.getBoundingClientRect().height : 0;

      var currentHTML = extractBodyWithoutHeader(document.body);
      var nextHTML = extractBodyWithoutHeader(doc.body);

      var overlay = createOverlay(currentHTML, nextHTML, headerHeight, direction);
      document.documentElement.appendChild(overlay);

      setTimeout(function () {
        try { overlay.remove(); } catch (e) { }
        location.href = url;
      }, DURATION + 40);
    }).catch(function (err) {
      error('[transition.js] transition failed', err);
      location.href = url;
    }).finally(function () { isTransitioning = false; });
  }

  // Dev helper: run transition using HTML text (no fetch). Useful when testing under file://
  function doTransitionFromHtml(htmlText, fakeUrl, direction) {
    try {
      var parser = new DOMParser();
      var doc = parser.parseFromString(htmlText, 'text/html');
      var header = document.querySelector('header');
      var headerHeight = header ? header.getBoundingClientRect().height : 0;
      var currentHTML = extractBodyWithoutHeader(document.body);
      var nextHTML = extractBodyWithoutHeader(doc.body);
      var overlay = createOverlay(currentHTML, nextHTML, headerHeight, direction || 'right');
      document.documentElement.appendChild(overlay);
      // remove overlay after animation but don't navigate (testing only)
      setTimeout(function () { try { overlay.remove(); } catch (e) { } }, DURATION + 40);
    } catch (err) {
      error('[transition.js] doTransitionFromHtml failed', err);
    }
  }

  // Helper to accept a File object (from an <input type="file">) and run the transition.
  function testFromFile(file, direction) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (ev) { doTransitionFromHtml(ev.target.result, file.name || 'local.html', direction || 'right'); };
    reader.onerror = function (ev) { error('[transition.js] testFromFile read error', ev); };
    reader.readAsText(file);
  }

  function setup() {
    warnIfFileProtocol();
    var nav = document.querySelector('header nav');
    if (!nav) { log('[transition.js] header nav not found'); return; }

    nav.addEventListener('click', function (ev) {
      var a = ev.target.closest && ev.target.closest('a');
      if (!a) return;
      var href = a.getAttribute('href');
      if (!isInternal(href)) return; // allow external or anchors
      ev.preventDefault();

      var links = Array.prototype.slice.call(nav.querySelectorAll('a'));
      var current = location.pathname.split('/').pop() || 'index.html';
      var currentIndex = links.findIndex(function (l) { return (new URL(l.href, location.href)).pathname.split('/').pop() === current; });
      var targetIndex = links.findIndex(function (l) { return (new URL(l.href, location.href)).href === (new URL(href, location.href)).href; });
      var direction = 'right';
      if (currentIndex >= 0 && targetIndex >= 0) direction = targetIndex < currentIndex ? 'left' : 'right';

      log('[transition.js] clicked', href, 'direction', direction);
      doTransition(new URL(href, location.href).href, direction);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup); else setup();

  // expose helpers for manual testing when served via file://
  window.__pageTransition = { doTransition: doTransition, doTransitionFromHtml: doTransitionFromHtml, testFromFile: testFromFile };
  log('[transition.js] ready (with testFromFile helper)');

  // File:// dev UI: floating Test Transition button (only visible when opened via file://)
  (function addLocalTestButton(){
    try {
      if (location.protocol !== 'file:') return; // only for local testing
      var btn = document.createElement('button');
      btn.id = 'transition-test-button';
      btn.textContent = 'Test Transition';
      btn.title = 'Choose an HTML file to preview the slide transition (dev only)';
      Object.assign(btn.style, {
        position: 'fixed',
        right: '16px',
        bottom: '16px',
        zIndex: '100000',
        padding: '10px 14px',
        background: '#0b79d0',
        color: '#fff',
        border: 'none',
        borderRadius: '6px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        cursor: 'pointer',
        fontSize: '14px'
      });
      btn.addEventListener('click', function(){
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = '.html,.htm';
        input.onchange = function(e){
          var file = e.target.files && e.target.files[0];
          if (file && window.__pageTransition && window.__pageTransition.testFromFile) {
            window.__pageTransition.testFromFile(file, 'right');
          }
          setTimeout(function(){ try { input.remove(); } catch(e){} }, 1000);
        };
        document.body.appendChild(input);
        input.click();
      });
      document.body.appendChild(btn);
    } catch (err) {
      console.error('Failed to add local Test Transition button', err);
    }
  })();
})();
