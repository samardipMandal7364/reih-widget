/**
 * ReihWidget Hybrid Loader — thin script (~3 KB gzipped) that tenants add to their site.
 * Creates an iframe pointed at the widget embed page on YOUR domain, and exposes the
 * same `window.reihWidget` API the direct-embed SDK uses.
 *
 * All heavy lifting (Preact, API calls, WebSocket, session) runs inside the iframe.
 * The host page only needs `script-src <cdn>` + `frame-src <widget-domain>` in CSP.
 */
(function () {
  'use strict';

  // Inline branding helpers (loader stays dependency-free for CDN bundle size).
  function parseBranding(cfg) {
    if (!cfg || typeof cfg !== 'object') return {};
    var nested = cfg.branding && typeof cfg.branding === 'object' ? cfg.branding : {};
    function pick() {
      for (var i = 0; i < arguments.length; i++) {
        var v = arguments[i];
        if (v != null && v !== '') return String(v);
      }
      return undefined;
    }
    return {
      primaryColor: pick(nested.primaryColor, cfg.primaryColor),
      logoUrl: pick(nested.logoUrl, cfg.logoUrl),
      fontFamily: pick(nested.fontFamily, cfg.fontFamily),
    };
  }

  var NS = '__reih';
  var DEFAULT_EMBED_BASE = 'https://widget.reimaginehome.ai';

  var CHAT_SVG =
    '<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">' +
    '<path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>' +
    '</svg>';

  var CLOSE_SVG =
    '<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">' +
    '<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>' +
    '</svg>';

  var LOADER_CSS =
    '.reih-frame-wrap{position:fixed;z-index:2147483646;display:none;overflow:hidden}' +
    '.reih-frame-wrap--open{display:block}' +

    '.reih-frame-wrap--panel{bottom:96px;right:24px;width:420px;height:680px;' +
    'max-height:calc(100vh - 120px);border-radius:16px;box-shadow:0 12px 48px rgba(0,0,0,.15)}' +
    '.reih-frame-wrap--panel-left{right:auto;left:24px}' +

    '.reih-frame-wrap--fullscreen{top:0;left:0;width:100vw;height:100vh;border-radius:0}' +

    '.reih-frame-wrap__iframe{width:100%;height:100%;border:none;background:transparent;color-scheme:light}' +

    '.reih-fab{position:fixed;bottom:24px;right:24px;z-index:2147483646;width:56px;height:56px;' +
    'border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;' +
    'color:#fff;background:#6C63FF;box-shadow:0 4px 16px rgba(0,0,0,.18);' +
    'transition:transform .2s ease,box-shadow .2s ease}' +
    '.reih-fab:hover{transform:scale(1.08);box-shadow:0 6px 24px rgba(0,0,0,.24)}' +
    '.reih-fab:active{transform:scale(.96)}' +
    '.reih-fab--left{right:auto;left:24px}' +

    '.reih-restyle-trigger{display:inline-flex;align-items:center;gap:8px;padding:10px 20px;' +
    'border-radius:8px;border:none;cursor:pointer;font:600 14px/1.4 system-ui,-apple-system,sans-serif;' +
    'color:#fff;background:#6C63FF;box-shadow:0 2px 8px rgba(108,99,255,.3);' +
    'transition:transform .15s ease,box-shadow .15s ease}' +
    '.reih-restyle-trigger:hover{transform:translateY(-1px);box-shadow:0 4px 16px rgba(108,99,255,.4)}' +

    '@media(max-width:480px){' +
    '.reih-frame-wrap--panel{bottom:0;right:0;left:0;width:100vw;height:100vh;max-height:100vh;border-radius:0}' +
    '.reih-fab{bottom:16px;right:16px}' +
    '.reih-fab--left{right:auto;left:16px}' +
    '}';

  function normalizeMode(m) {
    return String(m || 'chat').toLowerCase().replace(/_/g, '-').trim();
  }

  function ReihWidgetLoader() {
    this._cfg = {};
    this._iframe = null;
    this._wrap = null;
    this._trigger = null;
    this._styleEl = null;
    this._isOpen = false;
    this._iframeReady = false;
    this._mounted = false;
    this._listeners = {};
    this._queue = [];
    this._embedOrigin = '';
    this._onMsg = function (e) { this._handleMessage(e); }.bind(this);
  }

  ReihWidgetLoader.prototype.configure = function (userConfig) {
    if (!userConfig || typeof userConfig !== 'object') return this;
    this._cfg = Object.assign({}, this._cfg, userConfig);
    this._applyHostBranding();
    if (this._iframeReady) this._post('configure', this._cfg);
    return this;
  };

  ReihWidgetLoader.prototype.init = function (overrides) {
    if (this._mounted) {
      console.warn('[ReihWidget] Already initialized.');
      return this;
    }

    if (overrides && typeof overrides === 'object') {
      this._cfg = Object.assign({}, this._cfg, overrides);
    }

    var mode = normalizeMode(this._cfg.mode);

    if (!this._cfg.tenantId && !this._cfg.clientId && mode !== 'widget-v4') {
      console.error('[ReihWidget] tenantId (or clientId) is required.');
      return this;
    }

    var embedBase = (this._cfg.embedBaseUrl || DEFAULT_EMBED_BASE).replace(/\/$/, '');
    try {
      this._embedOrigin = new URL(embedBase).origin;
    } catch (_) {
      this._embedOrigin = embedBase;
    }

    window.addEventListener('message', this._onMsg);
    this._injectStyles();
    this._createWrap(mode);
    this._createIframe(embedBase, mode);

    if (!this._cfg.hideTrigger && mode !== 'widget-v4') {
      this._createTrigger(mode);
      this._applyHostBranding();
    }

    this._mounted = true;

    var shouldAutoOpen = mode === 'widget-v4' || this._cfg.autoOpen;
    if (shouldAutoOpen && this._cfg.autoOpen !== false) {
      var delay =
        typeof this._cfg.autoOpen === 'number' && this._cfg.autoOpen > 0
          ? this._cfg.autoOpen
          : 0;
      if (delay > 0) {
        var self = this;
        setTimeout(function () { self.open(); }, delay);
      } else {
        this.open();
      }
    }

    return this;
  };

  ReihWidgetLoader.prototype.open = function () {
    if (!this._mounted) this.init();
    this._isOpen = true;
    this._updateLayout();
    this._post('open');
    this._updateTriggerIcon();
    return this;
  };

  ReihWidgetLoader.prototype.close = function () {
    this._isOpen = false;
    this._updateLayout();
    this._post('close');
    this._updateTriggerIcon();
    return this;
  };

  ReihWidgetLoader.prototype.destroy = function () {
    this._post('destroy');
    window.removeEventListener('message', this._onMsg);
    if (this._wrap) { this._wrap.remove(); this._wrap = null; this._iframe = null; }
    if (this._trigger) { this._trigger.remove(); this._trigger = null; }
    if (this._styleEl) { this._styleEl.remove(); this._styleEl = null; }
    this._mounted = false;
    this._isOpen = false;
    this._iframeReady = false;
    this._queue = [];
    this._emit('destroyed');
    this._listeners = {};
    return this;
  };

  ReihWidgetLoader.prototype.on = function (name, cb) {
    if (!this._listeners[name]) this._listeners[name] = [];
    this._listeners[name].push(cb);
    return this;
  };

  ReihWidgetLoader.prototype.off = function (name, cb) {
    if (!this._listeners[name]) return this;
    this._listeners[name] = this._listeners[name].filter(function (f) { return f !== cb; });
    return this;
  };

  // ─── Private ────────────────────────────────────────────────────────────────

  ReihWidgetLoader.prototype._injectStyles = function () {
    this._styleEl = document.createElement('style');
    this._styleEl.id = 'reih-loader-styles';
    this._styleEl.textContent = LOADER_CSS;
    document.head.appendChild(this._styleEl);
  };

  ReihWidgetLoader.prototype._createWrap = function (mode) {
    this._wrap = document.createElement('div');
    this._wrap.id = 'reih-widget-frame';
    var layout = mode === 'chat' ? 'panel' : 'fullscreen';
    this._wrap.className = 'reih-frame-wrap reih-frame-wrap--' + layout;
    if (mode === 'chat' && this._cfg.position === 'bottom-left') {
      this._wrap.classList.add('reih-frame-wrap--panel-left');
    }
    document.body.appendChild(this._wrap);
  };

  ReihWidgetLoader.prototype._createIframe = function (embedBase, mode) {
    var params = new URLSearchParams();
    params.set('origin', window.location.origin);
    params.set('mode', mode);
    if (this._cfg.tenantId) params.set('tenantId', this._cfg.tenantId);
    else if (this._cfg.clientId) params.set('clientId', this._cfg.clientId);

    this._iframe = document.createElement('iframe');
    this._iframe.src = embedBase + '/embed.html?' + params.toString();
    this._iframe.className = 'reih-frame-wrap__iframe';
    this._iframe.setAttribute('allow', 'clipboard-write');
    this._iframe.setAttribute('allowtransparency', 'true');
    this._iframe.setAttribute('frameborder', '0');
    this._iframe.setAttribute('title', 'REimagineHome Widget');
    this._wrap.appendChild(this._iframe);
  };

  ReihWidgetLoader.prototype._createTrigger = function (mode) {
    this._trigger = document.createElement('button');
    var pos = this._cfg.position || 'bottom-right';

    if (mode === 'restyle') {
      this._trigger.className = 'reih-restyle-trigger';
      this._trigger.textContent = this._cfg.triggerLabel || 'Restyle with AI';
    } else {
      this._trigger.className = 'reih-fab' + (pos === 'bottom-left' ? ' reih-fab--left' : '');
      this._trigger.innerHTML =
        this._cfg.triggerIcon
          ? '<img src="' + this._cfg.triggerIcon + '" alt="Chat" width="28" height="28">'
          : CHAT_SVG;
      this._trigger.setAttribute('aria-label', 'Open chat');
    }

    this._applyHostBranding();

    var self = this;
    this._trigger.addEventListener('click', function () {
      self._isOpen ? self.close() : self.open();
    });

    document.body.appendChild(this._trigger);
  };

  ReihWidgetLoader.prototype._applyHostBranding = function () {
    var b = parseBranding(this._cfg);
    if (!this._trigger) return;
    if (b.primaryColor) this._trigger.style.background = b.primaryColor;
    if (b.fontFamily) this._trigger.style.fontFamily = b.fontFamily;
  };

  ReihWidgetLoader.prototype._updateTriggerIcon = function () {
    if (!this._trigger || !this._trigger.classList.contains('reih-fab')) return;
    this._trigger.innerHTML = this._isOpen
      ? CLOSE_SVG
      : this._cfg.triggerIcon
        ? '<img src="' + this._cfg.triggerIcon + '" alt="Chat" width="28" height="28">'
        : CHAT_SVG;
    this._trigger.setAttribute('aria-label', this._isOpen ? 'Close chat' : 'Open chat');
  };

  ReihWidgetLoader.prototype._updateLayout = function () {
    if (!this._wrap) return;
    if (this._isOpen) {
      this._wrap.classList.add('reih-frame-wrap--open');
    } else {
      this._wrap.classList.remove('reih-frame-wrap--open');
    }
  };

  ReihWidgetLoader.prototype._post = function (type, payload) {
    var msg = { ns: NS, type: type, payload: payload };
    if (!this._iframeReady) {
      this._queue.push(msg);
      return;
    }
    try {
      this._iframe.contentWindow.postMessage(msg, this._embedOrigin);
    } catch (_) {}
  };

  ReihWidgetLoader.prototype._flush = function () {
    while (this._queue.length) {
      var msg = this._queue.shift();
      try {
        this._iframe.contentWindow.postMessage(msg, this._embedOrigin);
      } catch (_) {}
    }
  };

  ReihWidgetLoader.prototype._handleMessage = function (event) {
    if (this._embedOrigin && event.origin !== this._embedOrigin) return;
    var d = event.data;
    if (!d || d.ns !== NS) return;

    switch (d.type) {
      case 'embed-ready':
        this._iframeReady = true;
        this._post('init', Object.assign({}, this._cfg, {
          parentOrigin: window.location.origin,
          parentDomain: window.location.hostname,
        }));
        this._flush();
        break;

      case 'ready':
        this._emit('ready', d.payload);
        break;

      case 'resize':
        this._handleResize(d.payload);
        break;

      case 'request-close':
        this.close();
        break;

      case 'event':
        if (d.payload) this._emit(d.payload.name, d.payload.detail);
        break;
    }
  };

  ReihWidgetLoader.prototype._handleResize = function (p) {
    if (!this._wrap || !p) return;
    if (p.fullscreen) {
      this._wrap.classList.add('reih-frame-wrap--fullscreen');
      this._wrap.classList.remove('reih-frame-wrap--panel');
    } else if (p.panel) {
      this._wrap.classList.remove('reih-frame-wrap--fullscreen');
      this._wrap.classList.add('reih-frame-wrap--panel');
    }
    if (p.width) this._wrap.style.width = typeof p.width === 'number' ? p.width + 'px' : p.width;
    if (p.height) this._wrap.style.height = typeof p.height === 'number' ? p.height + 'px' : p.height;
  };

  ReihWidgetLoader.prototype._emit = function (name, detail) {
    var d = detail || {};
    var cbs = this._listeners[name] || [];
    cbs.forEach(function (cb) { try { cb(d); } catch (_) {} });
    try {
      window.dispatchEvent(new CustomEvent('reihwidget:' + name, { detail: d }));
    } catch (_) {}
  };

  // ─── Singleton & auto-init ──────────────────────────────────────────────────

  var instance = new ReihWidgetLoader();

  if (typeof window !== 'undefined') {
    window.reihWidget = instance;

    var auto = window.reihWidgetConfig;
    if (auto) {
      instance.configure(auto);
      if (auto.autoInit !== false) {
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', function () { instance.init(); });
        } else {
          instance.init();
        }
      }
    }
  }
})();
