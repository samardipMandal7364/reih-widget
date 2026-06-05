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
  var LOADER_TIMEOUT_MS = 30000;
  var MIN_LOADER_MS = 5000;

  var CHAT_SVG =
    '<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">' +
    '<path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>' +
    '</svg>';

  var CLOSE_SVG =
    '<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">' +
    '<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>' +
    '</svg>';

  var LOADER_SCENE_SVG =
    '<svg class="reih-wl-scene" viewBox="0 0 172 128" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<rect class="reih-wl-floor" x="20" y="22" width="132" height="82" rx="9" fill="#f1f2f5"/>' +
    '<rect class="reih-wl-floor" x="20" y="88" width="132" height="16" rx="0" fill="#e5e8ee"/>' +
    '<g class="reih-wl-item i4">' +
    '<rect x="38" y="34" width="24" height="19" rx="2.5" fill="#ffffff" stroke="#d7dae1"/>' +
    '<rect x="42" y="38" width="16" height="11" rx="1.5" fill="#3fd37b"/>' +
    '</g>' +
    '<g class="reih-wl-item i3">' +
    '<rect x="127" y="55" width="2.4" height="33" rx="1" fill="#b9bdc7"/>' +
    '<path d="M118 55h21l-4.5-13h-12z" fill="#c8f5dc"/>' +
    '<rect x="120" y="86" width="16" height="3" rx="1.5" fill="#b9bdc7"/>' +
    '</g>' +
    '<g class="reih-wl-item i1">' +
    '<rect x="44" y="60" width="60" height="15" rx="6" fill="#d4d9e2"/>' +
    '<rect x="46" y="71" width="56" height="21" rx="6" fill="#c6ccd8"/>' +
    '<rect x="42" y="66" width="9" height="26" rx="4" fill="#b9c0cd"/>' +
    '<rect x="97" y="66" width="9" height="26" rx="4" fill="#b9c0cd"/>' +
    '<rect x="68" y="64" width="15" height="11" rx="3" fill="#3fd37b"/>' +
    '</g>' +
    '<g class="reih-wl-item i2">' +
    '<path d="M112 92l2-12h10l2 12z" fill="#cf8358"/>' +
    '<ellipse cx="115" cy="76" rx="5.5" ry="8" fill="#5b9e6f"/>' +
    '<ellipse cx="123" cy="77" rx="5.5" ry="7.5" fill="#6cae7d"/>' +
    '<ellipse cx="119" cy="71" rx="5" ry="8.5" fill="#4f9163"/>' +
    '</g>' +
    '<path class="reih-wl-spark" d="M140 28l1.8 5.4 5.4 1.8-5.4 1.8L140 42.4l-1.8-5.4-5.4-1.8 5.4-1.8z" fill="#3fd37b"/>' +
    '</svg>';

  var LOADER_LOGO_SVG =
    '<svg class="reih-wl-logo" viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">' +
    '<rect width="64" height="64" rx="14" fill="#3fd37b"/>' +
    '<path d="M18 40V24h8.2c5.4 0 8.8 2.8 8.8 7.4 0 3.2-1.6 5.6-4.2 6.6L38 40h-9l-4.8-6.8H26V40H18zm8-11.2h3.4c1.8 0 2.8-.8 2.8-2.2 0-1.4-1-2.2-2.8-2.2H26v4.4zM42 40V24h8v16h-8z" fill="#fff"/>' +
    '</svg>';

  var DEFAULT_LOADER_SUBTEXTS = [
    'Reimagining your space',
    'Applying your style',
    'Rendering furniture',
    'Almost done…',
  ];

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  var LOADER_CSS =
    '.reih-frame-wrap{position:fixed;z-index:2147483646;display:none;overflow:hidden}' +
    '.reih-frame-wrap--open{display:block}' +

    '.reih-frame-wrap--panel{bottom:96px;right:24px;width:420px;height:680px;' +
    'max-height:calc(100vh - 120px);border-radius:16px;box-shadow:0 12px 48px rgba(0,0,0,.15)}' +
    '.reih-frame-wrap--panel-left{right:auto;left:24px}' +

    '.reih-frame-wrap--fullscreen{top:0;left:0;width:100vw;height:100vh;border-radius:0}' +

    '.reih-frame-wrap__iframe{width:100%;height:100%;border:none;background:transparent;color-scheme:light}' +

    '.reih-host-loader{position:fixed;inset:0;z-index:2147483647;display:none;align-items:center;justify-content:center;' +
    'background:rgba(14,14,14,.55);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);' +
    'animation:reihLoaderFade .22s ease}' +
    '.reih-host-loader--visible{display:flex}' +
    '@keyframes reihLoaderFade{from{opacity:0}to{opacity:1}}' +
    '.reih-host-loader .reih-wl-card{position:relative;width:min(860px,calc(100vw - 48px),calc(100vh - 48px));aspect-ratio:1;' +
    'background:#fff;border-radius:20px;padding:clamp(32px,5vmin,56px) clamp(36px,6vmin,64px) clamp(28px,4vmin,48px);' +
    'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:clamp(16px,3vmin,32px);text-align:center;' +
    'box-shadow:0 30px 100px rgba(0,0,0,.45),0 0 0 1px rgba(255,255,255,.08);' +
    'animation:reihWlCardIn .42s cubic-bezier(.2,.8,.25,1) both}' +
    '.reih-host-loader .reih-wl-logo{width:clamp(48px,8vmin,64px);height:clamp(48px,8vmin,64px);object-fit:cover}' +
    '.reih-host-loader .reih-wl-scene{width:min(68%,520px);height:auto;flex:0 1 auto}' +
    '.reih-host-loader .reih-wl-floor{transform-box:fill-box;transform-origin:center;animation:reihWlRise .5s ease both}' +
    '.reih-host-loader .reih-wl-item{transform-box:fill-box;transform-origin:bottom center;' +
    'animation:reihWlFurnPop 2.6s cubic-bezier(.25,1.4,.4,1) infinite}' +
    '.reih-host-loader .reih-wl-item.i2{animation-delay:.28s}' +
    '.reih-host-loader .reih-wl-item.i3{animation-delay:.56s}' +
    '.reih-host-loader .reih-wl-item.i4{animation-delay:.84s}' +
    '.reih-host-loader .reih-wl-spark{transform-box:fill-box;transform-origin:center;' +
    'animation:reihWlSpark 2.6s ease-in-out infinite;animation-delay:1.1s}' +
    '.reih-host-loader .reih-wl-loading{font:500 clamp(18px,3.5vmin,28px)/1.2 system-ui,-apple-system,sans-serif;' +
    'color:#111827;display:flex;align-items:center}' +
    '.reih-host-loader .reih-wl-dots span{animation:reihWlDot 1.2s infinite}' +
    '.reih-host-loader .reih-wl-dots span:nth-child(2){animation-delay:.2s}' +
    '.reih-host-loader .reih-wl-dots span:nth-child(3){animation-delay:.4s}' +
    '.reih-host-loader .reih-wl-substep{font:400 clamp(14px,2.2vmin,18px)/1.4 system-ui,-apple-system,sans-serif;' +
    'color:#6b7280;min-height:1.4em;margin-top:clamp(-12px,-1.5vmin,-6px);transition:opacity .28s ease}' +
    '.reih-host-loader .reih-wl-powered{font:400 clamp(12px,2vmin,14px)/1.4 system-ui,-apple-system,sans-serif;' +
    'color:#6b7280;margin-top:clamp(4px,1vmin,12px)}' +
    '.reih-host-loader .reih-wl-powered b{font-weight:500;color:#374151}' +
    '@keyframes reihWlCardIn{from{opacity:0;transform:scale(.9) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}' +
    '@keyframes reihWlRise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}' +
    '@keyframes reihWlFurnPop{0%,6%{opacity:0;transform:scale(.2) translateY(8px)}16%{opacity:1;transform:scale(1.12) translateY(0)}' +
    '24%,80%{opacity:1;transform:scale(1) translateY(0)}94%,100%{opacity:0;transform:scale(.7) translateY(4px)}}' +
    '@keyframes reihWlSpark{0%,40%{opacity:0;transform:scale(.2) rotate(0deg)}55%{opacity:1;transform:scale(1.1) rotate(25deg)}' +
    '72%{opacity:.9;transform:scale(.9) rotate(40deg)}88%,100%{opacity:0;transform:scale(.4) rotate(60deg)}}' +
    '@keyframes reihWlDot{0%,100%{opacity:.25}40%{opacity:1}}' +
    '@media(prefers-reduced-motion:reduce){' +
    '.reih-host-loader .reih-wl-item,.reih-host-loader .reih-wl-spark,.reih-host-loader .reih-wl-floor,' +
    '.reih-host-loader .reih-wl-card,.reih-host-loader .reih-wl-dots span{animation:none}' +
    '.reih-host-loader .reih-wl-item{opacity:1;transform:none}' +
    '}' +

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
    this._widgetReady = false;
    this._mounted = false;
    this._hostLoaderEl = null;
    this._loaderSubEl = null;
    this._loaderMainEl = null;
    this._loaderTimer = null;
    this._loaderSubTimer = null;
    this._revealTimer = null;
    this._loaderShownAt = 0;
    this._widgetRevealed = false;
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
    this._isOpen = true;
    this._widgetRevealed = false;
    if (!this._styleEl) this._injectStyles();
    this._showLoader();

    if (!this._mounted) {
      this.init();
      if (!this._mounted) {
        this._isOpen = false;
        this._hideLoader(true);
        return this;
      }
    }

    if (this._cfg.deferWidgetUntilLoader) this._scheduleReveal();
    else this._revealWidget();
    return this;
  };

  ReihWidgetLoader.prototype.close = function () {
    this._isOpen = false;
    this._widgetReady = false;
    this._widgetRevealed = false;
    if (this._revealTimer) {
      clearTimeout(this._revealTimer);
      this._revealTimer = null;
    }
    this._updateLayout();
    this._hideLoader(true);
    this._post('close');
    this._updateTriggerIcon();
    return this;
  };

  ReihWidgetLoader.prototype.destroy = function () {
    this._post('destroy');
    window.removeEventListener('message', this._onMsg);
    if (this._revealTimer) {
      clearTimeout(this._revealTimer);
      this._revealTimer = null;
    }
    this._widgetRevealed = false;
    this._hideLoader(true);
    if (this._wrap) { this._wrap.remove(); this._wrap = null; this._iframe = null; }
    if (this._hostLoaderEl) { this._hostLoaderEl.remove(); this._hostLoaderEl = null; }
    if (this._trigger) { this._trigger.remove(); this._trigger = null; }
    if (this._styleEl) { this._styleEl.remove(); this._styleEl = null; }
    this._mounted = false;
    this._isOpen = false;
    this._iframeReady = false;
    this._widgetReady = false;
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
    if (this._styleEl) return;
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

  ReihWidgetLoader.prototype._buildLoaderLogoHtml = function () {
    var logoUrl = parseBranding(this._cfg).logoUrl;
    if (logoUrl) {
      return '<img class="reih-wl-logo" src="' + escapeHtml(logoUrl) + '" alt="" width="64" height="64">';
    }
    return LOADER_LOGO_SVG;
  };

  ReihWidgetLoader.prototype._ensureHostLoader = function () {
    if (this._hostLoaderEl) return;
    var mainText = this._cfg.loaderText || 'Loading';
    this._hostLoaderEl = document.createElement('div');
    this._hostLoaderEl.className = 'reih-host-loader';
    this._hostLoaderEl.setAttribute('aria-live', 'polite');
    this._hostLoaderEl.setAttribute('aria-busy', 'true');
    this._hostLoaderEl.innerHTML =
      '<div class="reih-wl-card">' +
        this._buildLoaderLogoHtml() +
        LOADER_SCENE_SVG +
        '<div class="reih-wl-loading">' + escapeHtml(mainText) +
          '<span class="reih-wl-dots"><span>.</span><span>.</span><span>.</span></span>' +
        '</div>' +
        '<div class="reih-wl-substep"></div>' +
        '<div class="reih-wl-powered">Powered by <b>ReimagineHome AI</b></div>' +
      '</div>';
    this._loaderMainEl = this._hostLoaderEl.querySelector('.reih-wl-loading');
    this._loaderSubEl = this._hostLoaderEl.querySelector('.reih-wl-substep');
    document.body.appendChild(this._hostLoaderEl);
  };

  ReihWidgetLoader.prototype._updateLoaderContent = function () {
    this._ensureHostLoader();
    var mainText = this._cfg.loaderText || 'Loading';
    if (this._loaderMainEl) {
      this._loaderMainEl.innerHTML = escapeHtml(mainText) +
        '<span class="reih-wl-dots"><span>.</span><span>.</span><span>.</span></span>';
    }
  };

  ReihWidgetLoader.prototype._getLoaderSubtexts = function () {
    var custom = this._cfg.loaderSubtexts;
    if (Array.isArray(custom) && custom.length) return custom;
    if (this._cfg.loaderSubtext) return [this._cfg.loaderSubtext];
    return DEFAULT_LOADER_SUBTEXTS;
  };

  ReihWidgetLoader.prototype._startLoaderSubtextCycle = function () {
    var self = this;
    var msgs = this._getLoaderSubtexts();
    var idx = 0;
    this._stopLoaderSubtextCycle();
    if (!this._loaderSubEl || !msgs.length) return;
    this._loaderSubEl.textContent = msgs[0];
    this._loaderSubEl.style.opacity = '1';
    if (msgs.length < 2) return;
    this._loaderSubTimer = setInterval(function () {
      if (!self._loaderSubEl) return;
      idx = (idx + 1) % msgs.length;
      self._loaderSubEl.style.opacity = '0';
      setTimeout(function () {
        if (!self._loaderSubEl) return;
        self._loaderSubEl.textContent = msgs[idx];
        self._loaderSubEl.style.opacity = '1';
      }, 280);
    }, 1150);
  };

  ReihWidgetLoader.prototype._stopLoaderSubtextCycle = function () {
    if (this._loaderSubTimer) {
      clearInterval(this._loaderSubTimer);
      this._loaderSubTimer = null;
    }
  };

  ReihWidgetLoader.prototype._showLoader = function () {
    this._updateLoaderContent();
    this._loaderShownAt = Date.now();
    this._hostLoaderEl.classList.add('reih-host-loader--visible');
    this._hostLoaderEl.setAttribute('aria-busy', 'true');
    this._startLoaderSubtextCycle();
    if (this._loaderTimer) clearTimeout(this._loaderTimer);
    var self = this;
    this._loaderTimer = setTimeout(function () {
      if (!self._widgetReady && self._isOpen) {
        console.warn('[ReihWidget] Widget load timed out.');
        self._hideLoader(true);
      }
    }, LOADER_TIMEOUT_MS);
  };

  ReihWidgetLoader.prototype._hideLoader = function (force) {
    if (!this._hostLoaderEl) return;

    var minMs = typeof this._cfg.loaderMinMs === 'number' ? this._cfg.loaderMinMs : MIN_LOADER_MS;
    var elapsed = Date.now() - (this._loaderShownAt || 0);
    if (!force && elapsed < minMs) {
      var self = this;
      setTimeout(function () { self._hideLoader(true); }, minMs - elapsed);
      return;
    }

    this._stopLoaderSubtextCycle();
    if (this._loaderTimer) {
      clearTimeout(this._loaderTimer);
      this._loaderTimer = null;
    }
    this._hostLoaderEl.classList.remove('reih-host-loader--visible');
    this._hostLoaderEl.setAttribute('aria-busy', 'false');
  };

  ReihWidgetLoader.prototype._scheduleReveal = function () {
    if (this._revealTimer) clearTimeout(this._revealTimer);
    var self = this;
    var minMs = typeof this._cfg.loaderMinMs === 'number' ? this._cfg.loaderMinMs : MIN_LOADER_MS;
    this._revealTimer = setTimeout(function () {
      self._revealWidget();
    }, minMs);
  };

  ReihWidgetLoader.prototype._revealWidget = function () {
    if (this._widgetRevealed || !this._isOpen) return;
    this._widgetRevealed = true;
    if (this._revealTimer) {
      clearTimeout(this._revealTimer);
      this._revealTimer = null;
    }
    this._updateLayout();
    this._post('open');
    this._updateTriggerIcon();
    this._hideLoader(true);
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
        this._widgetReady = true;
        if (this._isOpen && normalizeMode(this._cfg.mode) !== 'restyle') {
          this._hideLoader(false);
        }
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
      if (auto.autoInit !== false && !auto.lazyInit) {
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', function () { instance.init(); });
        } else {
          instance.init();
        }
      }
    }
  }
})();
