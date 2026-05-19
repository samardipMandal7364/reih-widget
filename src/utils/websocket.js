const PING_INTERVAL = 30000;
const PONG_TIMEOUT = 15000;
const INITIAL_RECONNECT_DELAY = 2000;
const MAX_RECONNECT_DELAY = 16000;

export function createWidgetWebSocket(config) {
  const { wsBaseUrl } = config;

  let ws = null;
  let token = null;
  let pingTimer = null;
  let pongTimer = null;
  let reconnectDelay = INITIAL_RECONNECT_DELAY;
  let reconnectTimer = null;
  let intentionalClose = false;
  let messageHandler = null;
  let statusHandler = null;

  function connect(authToken) {
    if (ws && ws.readyState === WebSocket.OPEN) return;

    token = authToken;
    intentionalClose = false;
    _clearTimers();

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
      _notifyStatus('connected');
      _startPing();
    };

    ws.onmessage = (event) => {
      _clearPong();
      if (!event.data) return;
      try {
        const data = JSON.parse(event.data);
        console.log('[ReihWS] Message received:', data.action, data);
        if (messageHandler) messageHandler(data);
      } catch (_) {}
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
      ws.close();
      ws = null;
    }
    _notifyStatus('closed');
  }

  function send(payload) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      console.log('[ReihWS] Sending:', payload);
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
    // If connected, reconnect with new token to keep auth valid
    if (ws && ws.readyState === WebSocket.OPEN) {
      intentionalClose = true;
      ws.close();
      intentionalClose = false;
      setTimeout(() => connect(token), 100);
    }
  }

  function onMessage(handler) {
    messageHandler = handler;
  }

  function onStatus(handler) {
    statusHandler = handler;
  }

  function isConnected() {
    return ws && ws.readyState === WebSocket.OPEN;
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
    const jitter = Math.floor(Math.random() * 1000);
    const delay = Math.min(reconnectDelay + jitter, MAX_RECONNECT_DELAY);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
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
    isConnected,
  };
}
