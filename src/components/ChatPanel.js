import { h } from 'preact';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { ChatHeader } from './ChatHeader';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { ChatInput } from './ChatInput';
import { WelcomeScreen } from './WelcomeScreen';
import {
  isVisibleChatMessage,
  mergeGenerationOutputsFromWs,
  hasActiveGeneratingCard,
} from '../utils/helpers';

const RESPONSE_DELAY_THRESHOLD = 10000; // 10s before fallback polling kicks in
const MAX_FALLBACK_POLLS = 8;
const FALLBACK_POLL_INTERVAL = 10000;

export function ChatPanel({
  isOpen,
  onClose,
  config,
  apiClient,
  wsClient,
  sessionId,
  mediaId,
  mediaImageUrl,
  initError,
  onRetryInit,
  onSessionReady,
}) {
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const messagesEndRef = useRef(null);
  const fallbackTimerRef = useRef(null);
  const fallbackPollRef = useRef(null);
  const fallbackCountRef = useRef(0);
  const awaitingResponseRef = useRef(false);
  const lastKnownMsgIdRef = useRef(null);

  const {
    title = 'Chat with us',
    subtitle = 'AI Design Assistant',
    primaryColor,
    logoUrl,
    welcomeTitle,
    welcomeDescription,
    placeholder,
    poweredByText,
    poweredByUrl,
    position,
  } = config;

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }, []);

  // ─── Process an incoming WS message ───
  const handleWsMessage = useCallback((data) => {
    if (!data || !data.action) return;
    const isForThisMedia = data.data?.media_id === mediaId ||
      data.data?.media_id?.toString() === mediaId?.toString();
    if (!isForThisMedia && data.action !== 'pong') return;

    switch (data.action) {
      case 'chat': {
        const msg = data.data;
        if (!msg || !msg._id) break;

        const isGeneratingState =
          msg.content?.type === 'call_tool' || msg.content?.type === 'analyzing';
        if (!isGeneratingState) {
          _cancelFallback();
          awaitingResponseRef.current = false;
        }

        setMessages((prev) => {
          const exists = prev.some((m) => m._id === msg._id);
          if (exists) return prev;
          return [...prev, msg];
        });

        lastKnownMsgIdRef.current = msg._id;

        if (msg.content?.type === 'call_tool' || msg.content?.type === 'analyzing') {
          setIsTyping(true);
        } else if (msg.author === 'ai_agent' || msg.author === 'notification') {
          setIsTyping(false);
        }

        scrollToBottom();
        break;
      }

      case 'generations': {
        const genData = data.data;
        _cancelFallback();
        awaitingResponseRef.current = false;
        setIsTyping(false);
        setMessages((prev) => mergeGenerationOutputsFromWs(prev, genData));
        scrollToBottom();
        _fetchFullMessages();
        break;
      }

      case 'error_message': {
        _cancelFallback();
        awaitingResponseRef.current = false;
        setIsTyping(false);

        const errMsg = data.data?.message || 'Something went wrong.';
        setMessages((prev) => [
          ...prev,
          {
            _id: `ws_err_${Date.now()}`,
            author: 'notification',
            content: { type: 'error' },
            comment: errMsg,
          },
        ]);
        scrollToBottom();
        break;
      }

      case 'thought_chunk': {
        // Extend the "typing" state while thoughts stream in
        setIsTyping(true);
        break;
      }

      default:
        break;
    }
  }, [mediaId]);

  // ─── WebSocket lifecycle ───
  useEffect(() => {
    if (!wsClient || !isOpen || !sessionId || !mediaId) return;

    wsClient.onMessage(handleWsMessage);
    wsClient.onStatus((status) => {
      setWsConnected(status === 'connected');
    });

    if (apiClient.getToken()) {
      wsClient.connect(apiClient.getToken());
    }

    // Load initial messages via REST
    _fetchFullMessages();

    return () => {
      wsClient.onMessage(null);
      wsClient.onStatus(null);
    };
  }, [isOpen, sessionId, mediaId, wsClient, handleWsMessage]);

  // ─── Full message fetch (initial load + generation refresh) ───
  function _fetchFullMessages() {
    if (!sessionId || !mediaId) return;
    apiClient.getMessages(sessionId, mediaId).then((data) => {
      const incoming = data.messages || [];
      if (incoming.length > 0) {
        setMessages(incoming);
        lastKnownMsgIdRef.current = incoming[incoming.length - 1]._id;

        const hasAnalyzing = incoming.some(
          (m) => m.content?.type === 'call_tool' || m.content?.type === 'analyzing'
        );
        setIsTyping(hasAnalyzing);
        scrollToBottom();
      }
    }).catch((err) => {
      if (err.name === 'AuthError') {
        setError('Session expired. Please reload the page.');
      }
    });
  }

  // ─── Fallback polling (triggers after 10s of no WS response, max 8 polls) ───
  function _startFallbackTimer() {
    _cancelFallback();
    fallbackCountRef.current = 0;

    fallbackTimerRef.current = setTimeout(() => {
      fallbackTimerRef.current = null;
      _startFallbackPolling();
    }, RESPONSE_DELAY_THRESHOLD);
  }

  function _startFallbackPolling() {
    if (fallbackCountRef.current >= MAX_FALLBACK_POLLS) {
      setIsTyping(false);
      awaitingResponseRef.current = false;
      return;
    }

    fallbackPollRef.current = setInterval(() => {
      if (!awaitingResponseRef.current || fallbackCountRef.current >= MAX_FALLBACK_POLLS) {
        _cancelFallback();
        return;
      }

      fallbackCountRef.current += 1;

      apiClient.getMessages(sessionId, mediaId).then((data) => {
        const incoming = data.messages || [];
        if (incoming.length === 0) return;

        const lastId = incoming[incoming.length - 1]._id;
        if (lastId !== lastKnownMsgIdRef.current) {
          // New messages arrived — update state and stop polling
          lastKnownMsgIdRef.current = lastId;
          setMessages(incoming);
          scrollToBottom();

          const stillAnalyzing = incoming.some(
            (m) => m.content?.type === 'call_tool' || m.content?.type === 'analyzing'
          );

          if (!stillAnalyzing) {
            _cancelFallback();
            awaitingResponseRef.current = false;
            setIsTyping(false);
          }
        }

        if (fallbackCountRef.current >= MAX_FALLBACK_POLLS) {
          _cancelFallback();
        }
      }).catch(() => {});
    }, FALLBACK_POLL_INTERVAL);
  }

  function _cancelFallback() {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    if (fallbackPollRef.current) {
      clearInterval(fallbackPollRef.current);
      fallbackPollRef.current = null;
    }
  }

  // Cleanup on unmount / panel close
  useEffect(() => {
    return () => _cancelFallback();
  }, [isOpen]);

  useEffect(() => {
    if (messages.length > 0) scrollToBottom();
  }, [messages.length]);

  // ─── Send message ───
  const handleSend = useCallback(
    async (text) => {
      if (!text.trim() || !sessionId) return;

      const userMsg = {
        _id: `local_${Date.now()}`,
        author: 'user',
        comment: text,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsTyping(true);
      setError(null);
      scrollToBottom();

      try {
        if (!apiClient.isTokenValid()) {
          await apiClient.refreshToken(sessionId);
          if (wsClient) wsClient.updateToken(apiClient.getToken());
        }

        // Try WebSocket first, fall back to REST
        let sentViaWs = false;
        if (wsClient && wsClient.isConnected()) {
          sentViaWs = wsClient.sendChatMessage(mediaId, text);
        }

        if (sentViaWs) {
          // WS sent — start fallback timer in case response is delayed
          awaitingResponseRef.current = true;
          _startFallbackTimer();
        } else {
          // REST fallback
          const response = await apiClient.sendMessage(sessionId, mediaId, text);

          if (response.message) {
            setMessages((prev) => [...prev, response.message]);
            lastKnownMsgIdRef.current = response.message._id;
            scrollToBottom();
          }

          // After REST send, the AI response still comes async —
          // start fallback polling to pick it up
          awaitingResponseRef.current = true;
          _startFallbackTimer();

          if (response.media_id && response.media_id !== mediaId) {
            onSessionReady && onSessionReady(sessionId, response.media_id);
          }
        }
      } catch (err) {
        setIsTyping(false);
        setError(err.message || 'Failed to send message. Please try again.');
        setMessages((prev) => [
          ...prev,
          {
            _id: `err_${Date.now()}`,
            author: 'notification',
            content: { type: 'error' },
            comment: err.message || 'Something went wrong. Please try again.',
          },
        ]);
        scrollToBottom();
      }
    },
    [sessionId, mediaId, apiClient, wsClient, onSessionReady]
  );

  const handleSmartReply = useCallback(
    (reply) => { handleSend(reply); },
    [handleSend]
  );

  const panelClass = `reih-panel${isOpen ? ' reih-panel--open' : ''}${
    position === 'bottom-left' ? ' reih-panel--left' : ''
  }`;

  return (
    h('div', { class: panelClass },
      h(ChatHeader, {
        title,
        subtitle,
        logoUrl,
        primaryColor,
        onClose,
      }),
      initError
        ? h('div', { class: 'reih-error-state' },
            h('div', { class: 'reih-error-icon' }, '!'),
            h('p', null, initError),
            h('button', {
              class: 'reih-retry-btn',
              onClick: onRetryInit,
              style: primaryColor ? `background:${primaryColor}` : '',
            }, 'Try Again')
          )
        : isLoading
          ? h('div', { class: 'reih-loading' },
              h('div', { class: 'reih-spinner' })
            )
          : messages.length === 0 && !isTyping
            ? h(WelcomeScreen, {
                title: welcomeTitle,
                description: welcomeDescription,
                primaryColor,
              })
            : h('div', { class: 'reih-messages' },
                messages
                  .filter((m) => isVisibleChatMessage(m, messages))
                  .map((msg) =>
                    h(MessageBubble, {
                      key: msg._id,
                      message: msg,
                      onSmartReply: handleSmartReply,
                      previewImageUrl: mediaImageUrl,
                    })
                  ),
                isTyping && !hasActiveGeneratingCard(messages) && h(TypingIndicator, null),
                h('div', { ref: messagesEndRef })
              ),
      error &&
        h('div', { class: 'reih-msg reih-msg--error', style: 'margin:0 16px 8px' }, error),
      h(ChatInput, {
        onSend: handleSend,
        disabled: isLoading || !sessionId || !!initError,
        placeholder,
      }),
      poweredByText !== false &&
        h('div', { class: 'reih-powered' },
          'Powered by ',
          h('a', {
            href: poweredByUrl || 'https://reimaginehome.ai',
            target: '_blank',
            rel: 'noopener noreferrer',
          }, poweredByText || 'REimagineHome')
        )
    )
  );
}
