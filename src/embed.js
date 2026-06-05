/**
 * ReihWidget Embed — runs INSIDE the iframe created by loader.js.
 *
 * Imports the same Preact components as the direct-embed SDK, but:
 *   - Renders into the iframe document body (no Shadow DOM needed — the iframe IS the sandbox)
 *   - Receives config from parent via postMessage
 *   - Sends events (ready, close, resize, custom) back to parent via postMessage
 *   - Uses parentDomain for session init instead of window.location.hostname
 *   - Session & tokens live in the iframe's own localStorage (widget domain origin)
 */
import { h, render } from 'preact';
import { useState, useCallback, useEffect, useRef } from 'preact/hooks';
import { ChatPanel } from './components/ChatPanel';
import { RestyleOverlay } from './components/RestyleOverlay';
import { RestyleOverlayV2 } from './components/RestyleOverlayV2';
import { createApiClient } from './utils/api';
import { createWidgetWebSocket } from './utils/websocket';
import { saveSession, loadSession, clearSession, touchSession } from './utils/session';
import { extractMediaImageUrl } from './utils/helpers';
import widgetCSS from './styles/widget.css';
import mediaChatCSS from './v3/media-chat.css';
import { StudioModal } from './v4/StudioModal';
import {
  applyBrandingFromConfig,
  mergeConfigWithBranding,
} from './utils/branding';

var NS = '__reih';

var parentOrigin = '*';

function normalizeMode(m) {
  return String(m || 'chat').toLowerCase().replace(/_/g, '-').trim();
}

function postToParent(type, payload) {
  if (!window.parent || window.parent === window) return;
  try {
    window.parent.postMessage({ ns: NS, type: type, payload: payload }, parentOrigin);
  } catch (_) {}
}

// CSS overrides so the widget fills the iframe viewport instead of floating
var EMBED_OVERRIDES_CSS =
  'html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent}' +

  '.reih-panel,.reih-panel--open{position:absolute!important;top:0!important;left:0!important;' +
  'right:0!important;bottom:0!important;width:100%!important;height:100%!important;' +
  'max-width:100%!important;max-height:100%!important;border-radius:0!important;' +
  'box-shadow:none!important;transform:none!important;pointer-events:auto}' +

  '.reih-restyle-overlay,.mcm-overlay,.reih-v4-modal-wrap{' +
  'position:absolute!important;top:0!important;left:0!important;' +
  'width:100%!important;height:100%!important}' +

  '.reih-trigger,.reih-restyle-trigger-btn{display:none!important}';


// ─── Chat mode wrapper ──────────────────────────────────────────────────────

function EmbedChatApp({ config, apiClient, wsClient }) {
  var _a = useState(null), sessionId = _a[0], setSessionId = _a[1];
  var _b = useState(null), mediaId = _b[0], setMediaId = _b[1];
  var _c = useState(false), initialized = _c[0], setInitialized = _c[1];
  var _d = useState(null), initError = _d[0], setInitError = _d[1];

  var initSession = useCallback(async function () {
    if (initialized) return;
    setInitError(null);

    var existing = loadSession();
    if (existing && existing.sessionId && existing.mediaId) {
      setSessionId(existing.sessionId);
      setMediaId(existing.mediaId);
      try {
        await apiClient.refreshToken(existing.sessionId);
        setInitialized(true);
        return;
      } catch (_) {
        clearSession();
      }
    }

    try {
      var domain = config.parentDomain || window.location.hostname;
      var data = await apiClient.initSession(domain, config.clientId || config.tenantId);
      setSessionId(data.session_id);
      setMediaId(data.media_id);
      saveSession(data.session_id, data.media_id);
      setInitialized(true);
    } catch (err) {
      setInitError(err.message || 'Failed to initialize.');
      console.error('[ReihEmbed] Init error:', err.message);
    }
  }, [config.clientId, config.tenantId, config.parentDomain, apiClient, initialized]);

  useEffect(function () { initSession(); }, []);

  var handleClose = useCallback(function () {
    postToParent('request-close');
    if (wsClient) wsClient.disconnect();
  }, [wsClient]);

  var handleSessionReady = useCallback(function (sid, mid) {
    setSessionId(sid);
    setMediaId(mid);
    saveSession(sid, mid);
  }, []);

  return h(ChatPanel, {
    isOpen: true,
    onClose: handleClose,
    config: Object.assign({}, config, { hideTrigger: true }),
    apiClient: apiClient,
    wsClient: wsClient,
    sessionId: sessionId,
    mediaId: mediaId,
    mediaImageUrl: config.propertyImage || '',
    initError: initError,
    onRetryInit: initSession,
    onSessionReady: handleSessionReady,
  });
}


// ─── Restyle mode wrapper ───────────────────────────────────────────────────

function EmbedRestyleApp({ config, apiClient, wsClient }) {
  var _a = useState(config.sessionId || ('restyle_' + Date.now())), sessionId = _a[0];
  var _b = useState(config.mediaId || null), mediaId = _b[0], setMediaId = _b[1];
  var _c = useState(null), mediaDetail = _c[0], setMediaDetail = _c[1];
  var _d = useState(!!config.mediaId), mediaLoading = _d[0], setMediaLoading = _d[1];
  var _e = useState(!!config.bearerToken), initialized = _e[0], setInitialized = _e[1];

  var mediaImageUrl = extractMediaImageUrl(mediaDetail) || config.propertyImage || '';
  var apiVersion = config.apiVersion || 'v3';

  useEffect(function () {
    if (config.bearerToken && !initialized) setInitialized(true);
  }, [config.bearerToken]);

  useEffect(function () {
    if (!mediaId || !apiClient || !apiClient.getMedia) return;
    var cancelled = false;
    setMediaLoading(true);

    apiClient.getMedia(mediaId, apiVersion)
      .then(function (data) {
        if (cancelled) return;
        setMediaDetail(data);
        var url = extractMediaImageUrl(data);
        if (url) {
          postToParent('event', {
            name: 'media-loaded',
            detail: { url: url, mediaId: mediaId, media: data },
          });
        }
      })
      .catch(function (err) {
        console.warn('[ReihEmbed] Failed to load media:', err.message);
      })
      .finally(function () {
        if (!cancelled) setMediaLoading(false);
      });

    return function () { cancelled = true; };
  }, [mediaId, apiClient, apiVersion]);

  var initSession = useCallback(async function () {
    if (initialized && mediaId) return;
    if (config.bearerToken) { setInitialized(true); return; }

    try {
      var domain = config.parentDomain || window.location.hostname;
      var data = await apiClient.initSession(domain, config.clientId || config.tenantId);
      setMediaId(data.media_id);
      saveSession(data.session_id, data.media_id);
      setInitialized(true);
    } catch (err) {
      console.error('[ReihEmbed] Restyle init error:', err.message);
    }
  }, [config.clientId, config.tenantId, config.bearerToken, config.parentDomain, apiClient, initialized, mediaId]);

  useEffect(function () { initSession(); }, []);

  var handleClose = useCallback(function () {
    postToParent('request-close');
    if (wsClient) wsClient.disconnect();
  }, [wsClient]);

  var handleSessionReady = useCallback(function (sid, mid) {
    setMediaId(mid);
    saveSession(sid, mid);
  }, []);

  var isV2 = apiVersion === 'v2';
  var cfgMerged = Object.assign({}, config, { hideTrigger: true });

  return isV2
    ? h(RestyleOverlayV2, {
        isOpen: true,
        onClose: handleClose,
        config: cfgMerged,
        apiClient: apiClient,
        mediaId: mediaId,
        media: mediaDetail,
        mediaImageUrl: mediaImageUrl,
        mediaLoading: mediaLoading,
      })
    : h(RestyleOverlay, {
        isOpen: true,
        onClose: handleClose,
        config: cfgMerged,
        apiClient: apiClient,
        wsClient: wsClient,
        sessionId: sessionId,
        mediaId: mediaId,
        mediaImageUrl: mediaImageUrl,
        mediaLoading: mediaLoading,
        onSessionReady: handleSessionReady,
      });
}


// ─── Widget V4 (Studio) wrapper ─────────────────────────────────────────────

function EmbedV4App({ config }) {
  var handleClose = useCallback(function () {
    postToParent('request-close');
  }, []);

  var v4Opts =
    config.v4Studio && typeof config.v4Studio === 'object' ? config.v4Studio : {};

  return h(StudioModal, Object.assign({}, v4Opts, {
    styleMount: null,
    isOpen: true,
    onClose: handleClose,
  }));
}


// ─── Root component — receives config via postMessage ───────────────────────

function EmbedRoot() {
  var _a = useState(null), config = _a[0], setConfig = _a[1];
  var apiRef = useRef(null);
  var wsRef = useRef(null);

  useEffect(function () {
    if (!config) return;
    applyBrandingFromConfig(document.documentElement, config);
    var mount = document.getElementById('reih-embed-root');
    if (mount) applyBrandingFromConfig(mount, config);
  }, [config]);

  useEffect(function () {
    function handleMsg(event) {
      var d = event.data;
      if (!d || d.ns !== NS) return;

      if (parentOrigin !== '*' && event.origin !== parentOrigin) return;

      switch (d.type) {
        case 'init': {
          var cfg = d.payload || {};
          parentOrigin = cfg.parentOrigin || event.origin || '*';

          var mode = normalizeMode(cfg.mode);
          if (mode !== 'widget-v4') {
            apiRef.current = createApiClient({
              apiBaseUrl: cfg.apiBaseUrl,
              apiBaseUrlV2: cfg.apiBaseUrlV2,
              bearerToken: cfg.bearerToken,
            });
            if (cfg.apiVersion !== 'v2' && cfg.wsBaseUrl) {
              wsRef.current = createWidgetWebSocket({ wsBaseUrl: cfg.wsBaseUrl });
            }
          }

          setConfig(cfg);
          postToParent('ready', { mode: mode });
          break;
        }

        case 'configure':
          setConfig(function (prev) {
            return prev ? Object.assign({}, prev, d.payload) : d.payload;
          });
          break;

        case 'destroy':
          setConfig(null);
          if (wsRef.current) { wsRef.current.disconnect(); wsRef.current = null; }
          apiRef.current = null;
          break;
      }
    }

    window.addEventListener('message', handleMsg);

    postToParent('embed-ready');

    return function () { window.removeEventListener('message', handleMsg); };
  }, []);

  if (!config) return null;

  var mergedConfig = mergeConfigWithBranding(config);
  var mode = normalizeMode(mergedConfig.mode);

  if (mode === 'widget-v4') {
    return h(EmbedV4App, { config: mergedConfig });
  }

  if (mode === 'restyle') {
    return h(EmbedRestyleApp, {
      config: mergedConfig,
      apiClient: apiRef.current,
      wsClient: wsRef.current,
    });
  }

  return h(EmbedChatApp, {
    config: mergedConfig,
    apiClient: apiRef.current,
    wsClient: wsRef.current,
  });
}


// ─── Bootstrap ──────────────────────────────────────────────────────────────

(function bootstrap() {
  // Inject widget CSS into iframe document head
  var baseStyle = document.createElement('style');
  baseStyle.textContent = widgetCSS + '\n' + mediaChatCSS;
  document.head.appendChild(baseStyle);

  // Iframe-specific overrides (fill viewport, hide triggers)
  var overrideStyle = document.createElement('style');
  overrideStyle.textContent = EMBED_OVERRIDES_CSS;
  document.head.appendChild(overrideStyle);

  // Mount Preact
  var root = document.getElementById('reih-embed-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'reih-embed-root';
    document.body.appendChild(root);
  }
  render(h(EmbedRoot), root);
})();
