import { h, render } from 'preact';
import { useState, useCallback, useEffect, useRef } from 'preact/hooks';
import { ChatPanel } from './components/ChatPanel';
import { RestyleOverlay } from './components/RestyleOverlay';
import { RestyleOverlayV2 } from './components/RestyleOverlayV2';
import { RestyleTrigger } from './components/RestyleTrigger';
import { createApiClient } from './utils/api';
import { createWidgetWebSocket } from './utils/websocket';
import { saveSession, loadSession, clearSession, touchSession } from './utils/session';
import { getDomainFromUrl, extractMediaImageUrl } from './utils/helpers';
import widgetCSS from './styles/widget.css';
import mediaChatCSS from './v3/media-chat.css';

function TriggerButton({ onClick, isOpen, primaryColor, icon, position }) {
  const posStyle = position === 'bottom-left'
    ? 'left:24px;right:auto;'
    : 'right:24px;left:auto;';

  return (
    h('button', {
      class: `reih-trigger${isOpen ? ' reih-trigger--active' : ''}`,
      onClick,
      'aria-label': isOpen ? 'Close chat' : 'Open chat',
      style: `${primaryColor ? `background:${primaryColor};` : ''}${posStyle}`,
    },
      isOpen
        ? h('svg', { viewBox: '0 0 24 24' },
            h('path', { d: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z' })
          )
        : icon
          ? h('img', { src: icon, alt: 'Chat', style: 'width:28px;height:28px' })
          : h('svg', { viewBox: '0 0 24 24' },
              h('path', { d: 'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z' })
            )
    )
  );
}

function App({ config, apiClient, wsClient }) {
  const [isOpen, setIsOpen] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [mediaId, setMediaId] = useState(null);
  const [initialized, setInitialized] = useState(false);
  const [initError, setInitError] = useState(null);

  const initSession = useCallback(async () => {
    if (initialized) return;
    setInitError(null);

    const existing = loadSession();
    if (existing?.sessionId && existing?.mediaId) {
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
      const domain = getDomainFromUrl();
      const data = await apiClient.initSession(domain, config.clientId);
      setSessionId(data.session_id);
      setMediaId(data.media_id);
      saveSession(data.session_id, data.media_id);
      setInitialized(true);
    } catch (err) {
      setInitError(err.message || 'Failed to initialize. Please try again.');
      console.error('[ReihWidget] Init error:', err.message);
    }
  }, [config.clientId, apiClient, initialized]);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    touchSession();
    if (!initialized) initSession();
  }, [initialized, initSession]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    if (wsClient) wsClient.disconnect();
  }, [wsClient]);

  const handleSessionReady = useCallback((sid, mid) => {
    setSessionId(sid);
    setMediaId(mid);
    saveSession(sid, mid);
  }, []);

  useEffect(() => {
    if (config.autoOpen) {
      const delay = typeof config.autoOpen === 'number' ? config.autoOpen : 0;
      const timer = setTimeout(handleOpen, delay);
      return () => clearTimeout(timer);
    }
  }, [config.autoOpen]);

  return (
    h('div', null,
      h(ChatPanel, {
        isOpen,
        onClose: handleClose,
        config,
        apiClient,
        wsClient,
        sessionId,
        mediaId,
        mediaImageUrl: config.propertyImage || '',
        initError,
        onRetryInit: initSession,
        onSessionReady: handleSessionReady,
      }),
      (!config.hideTrigger) && h(TriggerButton, {
        onClick: isOpen ? handleClose : handleOpen,
        isOpen,
        primaryColor: config.primaryColor,
        icon: config.triggerIcon,
        position: config.position,
      })
    )
  );
}

// ─── Restyle Overlay App ───

function RestyleApp({ config, apiClient, wsClient }) {
  const [isOpen, setIsOpen] = useState(false);
  const [sessionId] = useState(config.sessionId || `restyle_${Date.now()}`);
  const [mediaId, setMediaId] = useState(config.mediaId || null);
  const [mediaDetail, setMediaDetail] = useState(null);
  const [mediaLoading, setMediaLoading] = useState(!!config.mediaId);
  const [initialized, setInitialized] = useState(!!config.bearerToken);

  const mediaImageUrl = extractMediaImageUrl(mediaDetail) || config.propertyImage || '';
  const apiVersion = config.apiVersion || 'v3';

  useEffect(() => {
    if (config.bearerToken && !initialized) {
      setInitialized(true);
    }
  }, [config.bearerToken]);

  useEffect(() => {
    if (!mediaId || !apiClient?.getMedia) return;
    let cancelled = false;
    setMediaLoading(true);

    apiClient.getMedia(mediaId, apiVersion)
      .then((data) => {
        if (cancelled) return;
        setMediaDetail(data);
        const url = extractMediaImageUrl(data);
        if (url) {
          try {
            window.dispatchEvent(
              new CustomEvent('reihwidget:media-loaded', {
                detail: { url, mediaId, media: data },
              })
            );
          } catch (_) {}
        }
      })
      .catch((err) => {
        console.warn('[ReihWidget] Failed to load media:', err.message);
      })
      .finally(() => {
        if (!cancelled) setMediaLoading(false);
      });

    return () => { cancelled = true; };
  }, [mediaId, apiClient, apiVersion]);

  const initSession = useCallback(async () => {
    if (initialized && mediaId) return;

    if (config.bearerToken) {
      setInitialized(true);
      return;
    }

    try {
      const domain = getDomainFromUrl();
      const data = await apiClient.initSession(domain, config.clientId);
      setMediaId(data.media_id);
      saveSession(data.session_id, data.media_id);
      setInitialized(true);
    } catch (err) {
      console.error('[ReihWidget] Restyle init error:', err.message);
    }
  }, [config.clientId, config.bearerToken, apiClient, initialized, mediaId]);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    touchSession();
    if (!initialized) initSession();
  }, [initialized, initSession]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    if (wsClient) wsClient.disconnect();
  }, [wsClient]);

  const handleSessionReady = useCallback((sid, mid) => {
    setMediaId(mid);
    saveSession(sid, mid);
  }, []);

  useEffect(() => {
    if (config.autoOpen) {
      const delay = typeof config.autoOpen === 'number' ? config.autoOpen : 0;
      const timer = setTimeout(handleOpen, delay);
      return () => clearTimeout(timer);
    }
  }, [config.autoOpen]);

  useEffect(() => {
    const handler = () => handleOpen();
    window.addEventListener('reih:open-restyle', handler);
    return () => window.removeEventListener('reih:open-restyle', handler);
  }, [handleOpen]);

  const isV2 = apiVersion === 'v2';

  return (
    h('div', null,
      isV2
        ? h(RestyleOverlayV2, {
            isOpen,
            onClose: handleClose,
            config,
            apiClient,
            mediaId,
            media: mediaDetail,
            mediaImageUrl,
            mediaLoading,
          })
        : h(RestyleOverlay, {
            isOpen,
            onClose: handleClose,
            config,
            apiClient,
            wsClient,
            sessionId,
            mediaId,
            mediaImageUrl,
            mediaLoading,
            onSessionReady: handleSessionReady,
          }),
      (!config.hideTrigger) && h(RestyleTrigger, {
        onClick: handleOpen,
        label: config.triggerLabel,
        primaryColor: config.primaryColor,
      })
    )
  );
}

// ─── Widget Entry Point ───

const DEFAULTS = {
  mode: 'chat',
  primaryColor: '#6C63FF',
  title: 'REimagineHome',
  subtitle: 'AI Design Assistant',
  welcomeTitle: 'Welcome!',
  welcomeDescription: 'Upload an image and chat with our AI to reimagine your space.',
  chatTitle: 'Design Companion',
  placeholder: 'Tell us what to change…',
  position: 'bottom-right',
  hideTrigger: false,
  autoOpen: false,
  poweredByText: 'REimagineHome',
  poweredByUrl: 'https://reimaginehome.ai',
  triggerLabel: 'Restyle with AI',
};

class ReihWidgetSDK {
  constructor() {
    this._host = null;
    this._shadowRoot = null;
    this._config = { ...DEFAULTS };
    this._apiClient = null;
    this._wsClient = null;
    this._mounted = false;
    this._eventListeners = {};
  }

  configure(userConfig) {
    this._config = { ...DEFAULTS, ...userConfig };
    if (this._mounted) {
      this._applyCSSVars();
    }
    return this;
  }

  init(overrides) {
    if (this._mounted) {
      console.warn('[ReihWidget] Already initialized.');
      return this;
    }

    if (overrides) {
      this._config = { ...this._config, ...overrides };
    }

    if (!this._config.clientId) {
      console.error('[ReihWidget] clientId is required. Set it via reihWidgetConfig or init({clientId: "..."}).');
      return this;
    }

    this._apiClient = createApiClient({
      apiBaseUrl: this._config.apiBaseUrl,
      apiBaseUrlV2: this._config.apiBaseUrlV2,
      bearerToken: this._config.bearerToken,
    });
    if (this._config.apiVersion !== 'v2' && this._config.wsBaseUrl) {
      this._wsClient = createWidgetWebSocket({ wsBaseUrl: this._config.wsBaseUrl });
    }

    this._host = document.createElement('div');
    this._host.id = 'reih-widget-host';
    this._host.setAttribute('style',
      'all:initial; position:fixed; top:0; left:0; width:0; height:0; overflow:visible; z-index:2147483646; pointer-events:none;'
    );
    document.body.appendChild(this._host);

    this._shadowRoot = this._host.attachShadow({ mode: 'closed' });

    const styleEl = document.createElement('style');
    styleEl.textContent = widgetCSS + '\n' + mediaChatCSS;
    this._shadowRoot.appendChild(styleEl);

    this._applyCSSVars();

    const mountPoint = document.createElement('div');
    this._shadowRoot.appendChild(mountPoint);

    render(
      h(this._config.mode === 'restyle' ? RestyleApp : App, {
        config: this._config,
        apiClient: this._apiClient,
        wsClient: this._wsClient,
      }),
      mountPoint
    );

    this._mounted = true;
    this._emitEvent('ready');
    return this;
  }

  destroy() {
    if (this._wsClient) {
      this._wsClient.disconnect();
      this._wsClient = null;
    }
    if (this._host) {
      document.body.removeChild(this._host);
      this._host = null;
      this._shadowRoot = null;
      this._mounted = false;
      this._eventListeners = {};
      this._emitEvent('destroyed');
    }
  }

  open() {
    if (!this._mounted) {
      this.init();
    }
    window.dispatchEvent(new CustomEvent('reih:open-restyle'));
    return this;
  }

  on(eventName, callback) {
    if (!this._eventListeners[eventName]) {
      this._eventListeners[eventName] = [];
    }
    this._eventListeners[eventName].push(callback);
    return this;
  }

  off(eventName, callback) {
    if (!this._eventListeners[eventName]) return this;
    this._eventListeners[eventName] = this._eventListeners[eventName].filter(
      (cb) => cb !== callback
    );
    return this;
  }

  _applyCSSVars() {
    if (!this._shadowRoot) return;
    const host = this._shadowRoot.host;
    if (this._config.primaryColor) {
      host.style.setProperty('--reih-primary', this._config.primaryColor);
      host.style.setProperty('--tenant-primary', this._config.primaryColor);
    }
    if (this._config.position === 'bottom-left') {
      host.style.setProperty('--reih-panel-right', 'auto');
      host.style.setProperty('--reih-panel-left', '24px');
    }
  }

  _emitEvent(name, detail = {}) {
    const listeners = this._eventListeners[name] || [];
    listeners.forEach((cb) => {
      try { cb(detail); } catch (_) {}
    });

    try {
      window.dispatchEvent(
        new CustomEvent(`reihwidget:${name}`, { detail })
      );
    } catch (_) {}
  }
}

const widgetInstance = new ReihWidgetSDK();

if (typeof window !== 'undefined') {
  window.reihWidget = widgetInstance;

  const autoConfig = window.reihWidgetConfig;
  if (autoConfig) {
    widgetInstance.configure(autoConfig);
    if (autoConfig.autoInit !== false) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => widgetInstance.init());
      } else {
        widgetInstance.init();
      }
    }
  }
}

export default widgetInstance;
