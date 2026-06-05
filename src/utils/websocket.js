const PING_INTERVAL = 30000;
const PONG_TIMEOUT = 15000;
const INITIAL_RECONNECT_DELAY = 2000;
const MAX_RECONNECT_DELAY = 16000;
const MAX_RECONNECT_ATTEMPTS = 15;

export function createWidgetWebSocket(config) {
  const { wsBaseUrl } = config;

  let ws = null;
  let token = null;
  let pingTimer = null;
  let pongTimer = null;
  let reconnectDelay = INITIAL_RECONNECT_DELAY;
  let reconnectTimer = null;
  let reconnectAttempts = 0;
  let intentionalClose = false;
  let messageHandler = null;
  let statusHandler = null;
  let tokenProvider = null;
  let visibilityBound = false;

  function connect(authToken) {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    // Detach handlers from any stale WS in CLOSING/CLOSED state so its
    // late-firing onclose won't corrupt state for the new connection.
    if (ws) {
      ws.onopen = ws.onclose = ws.onerror = ws.onmessage = null;
      ws = null;
    }

    token = authToken;
    intentionalClose = false;
    _clearTimers();
    _bindVisibility();

    console.log('[ReihWS] Connecting to:', wsBaseUrl);

    try {
      ws = new WebSocket(`${wsBaseUrl}?token=${encodeURIComponent(token)}`);
    } catch (err) {
      console.error('[ReihWS] Connection failed:', err.message);
      _notifyStatus('error', err.message);
      _scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      console.log('[ReihWS] Connected');
      reconnectDelay = INITIAL_RECONNECT_DELAY;
      reconnectAttempts = 0;
      _notifyStatus('connected');
      _startPing();
    };

    ws.onmessage = (event) => {
      _clearPong();
      if (!event.data) return;
      try {
        const data = JSON.parse(event.data);
        if (messageHandler) messageHandler(data);
      } catch (err) {
        console.warn('[ReihWS] Failed to parse message:', err.message, event.data);
      }
    };

    ws.onclose = (event) => {
      console.log('[ReihWS] Closed:', event.code, event.reason);
      _clearTimers();
      ws = null;
      if (!intentionalClose) {
        _notifyStatus('disconnected');
        _scheduleReconnect();
      }
    };

    ws.onerror = (err) => {
      console.error('[ReihWS] Error:', err);
      if (ws) ws.close();
    };
  }

  function disconnect() {
    intentionalClose = true;
    _clearTimers();
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (ws) {
      ws.onopen = ws.onclose = ws.onerror = ws.onmessage = null;
      ws.close();
      ws = null;
    }
    reconnectAttempts = 0;
    _notifyStatus('closed');
    _unbindVisibility();
  }

  function send(payload) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
      return true;
    }
    console.warn('[ReihWS] Cannot send — not connected');
    return false;
  }

  function sendChatMessage(mediaId, userMessage, attachments) {
    return send({
      action: 'sendMessage',
      message: {
        action: 'chat',
        payload: {
          media_id: mediaId,
          user_message: userMessage,
          input_modes: ['TEXT'],
          attachments: attachments || [],
        },
      },
    });
  }

  function updateToken(newToken) {
    token = newToken;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    // Detach old handlers to prevent late onclose from corrupting state,
    // then immediately reconnect with the new token.
    ws.onopen = ws.onclose = ws.onerror = ws.onmessage = null;
    ws.close();
    ws = null;
    _clearTimers();
    reconnectAttempts = 0;
    reconnectDelay = INITIAL_RECONNECT_DELAY;
    connect(token);
  }

  function onMessage(handler) {
    messageHandler = handler;
  }

  function onStatus(handler) {
    statusHandler = handler;
  }

  function setTokenProvider(fn) {
    tokenProvider = fn;
  }

  function isConnected() {
    return ws && ws.readyState === WebSocket.OPEN;
  }

  // ── Visibility-based reconnect ──
  // Mobile Safari / Chrome aggressively kill WS when the tab is backgrounded.
  // Re-check connection state when the user returns.

  function _bindVisibility() {
    if (visibilityBound || typeof document === 'undefined') return;
    visibilityBound = true;
    document.addEventListener('visibilitychange', _handleVisibility);
  }

  function _unbindVisibility() {
    if (!visibilityBound) return;
    visibilityBound = false;
    document.removeEventListener('visibilitychange', _handleVisibility);
  }

  function _handleVisibility() {
    if (document.visibilityState !== 'visible') return;
    if (intentionalClose) return;
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
    if (reconnectTimer) return;

    reconnectAttempts = 0;
    reconnectDelay = INITIAL_RECONNECT_DELAY;

    const freshToken = tokenProvider ? tokenProvider() : null;
    if (freshToken) token = freshToken;

    if (!token) return;

    console.log('[ReihWS] Tab visible — reconnecting');
    _notifyStatus('reconnecting');
    connect(token);
  }

  // ── Internal ──

  function _startPing() {
    _clearTimers();
    pingTimer = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: 'ping' }));
        pongTimer = setTimeout(() => {
          if (ws) ws.close();
        }, PONG_TIMEOUT);
      }
    }, PING_INTERVAL);
  }

  function _clearPong() {
    if (pongTimer) {
      clearTimeout(pongTimer);
      pongTimer = null;
    }
  }

  function _clearTimers() {
    if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
    _clearPong();
  }

  function _scheduleReconnect() {
    if (intentionalClose || !token) return;
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.warn('[ReihWS] Max reconnect attempts reached, giving up');
      _notifyStatus('failed', 'Max reconnect attempts reached');
      return;
    }
    const jitter = Math.floor(Math.random() * 1000);
    const delay = Math.min(reconnectDelay + jitter, MAX_RECONNECT_DELAY);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
      reconnectAttempts += 1;

      const freshToken = tokenProvider ? tokenProvider() : null;
      if (freshToken) token = freshToken;

      _notifyStatus('reconnecting');
      connect(token);
    }, delay);
  }

  function _notifyStatus(status, detail) {
    if (statusHandler) statusHandler(status, detail);
  }

  return {
    connect,
    disconnect,
    send,
    sendChatMessage,
    updateToken,
    onMessage,
    onStatus,
    setTokenProvider,
    isConnected,
  };
}
