import { h } from 'preact';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { ChatInput } from './ChatInput';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { CompareSlider } from './CompareSlider';
import {
  isVisibleChatMessage,
  mergeGenerationOutputsFromWs,
  collectGenerationOutputMessages,
  hasActiveGeneratingCard,
} from '../utils/helpers';

const RESPONSE_DELAY_THRESHOLD = 10000;
const MAX_FALLBACK_POLLS = 8;
const FALLBACK_POLL_INTERVAL = 10000;

export function RestyleOverlay({
  isOpen,
  onClose,
  config,
  apiClient,
  wsClient,
  sessionId,
  mediaId,
  mediaImageUrl,
  mediaLoading,
  onSessionReady,
}) {
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('chat');
  const [generatedImages, setGeneratedImages] = useState([]);
  const [selectedGeneration, setSelectedGeneration] = useState(null);
  const [originalImageUrl, setOriginalImageUrl] = useState('');
  const messagesEndRef = useRef(null);
  const fallbackTimerRef = useRef(null);
  const fallbackPollRef = useRef(null);
  const fallbackCountRef = useRef(0);
  const awaitingResponseRef = useRef(false);
  const lastKnownMsgIdRef = useRef(null);

  useEffect(() => {
    if (mediaImageUrl && !originalImageUrl) {
      setOriginalImageUrl(mediaImageUrl);
    }
  }, [mediaImageUrl]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }, []);

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
          if (msg.content?.process_thoughts) {
            const thoughtMsg = {
              _id: `thought_${msg.media_id || mediaId}`,
              author: 'ai_agent',
              content: { type: 'thoughts', thoughts: msg.content.process_thoughts },
              media_id: msg.media_id || mediaId,
            };
            setMessages((prev) => {
              const existingIdx = prev.findIndex(
                (m) => m._id === thoughtMsg._id && m.content?.type === 'thoughts'
              );
              if (existingIdx >= 0) {
                const updated = [...prev];
                updated[existingIdx] = thoughtMsg;
                return updated;
              }
              return [...prev, thoughtMsg];
            });
            scrollToBottom();
          }
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

        const genOriginal = genData?.url || genData?.input_url ||
          genData?.original_url || genData?.source_url ||
          genData?.input_image_url || genData?.media_url || '';
        if (genOriginal) {
          setOriginalImageUrl((prev) => prev || genOriginal);
        }

        setMessages((prev) => {
          const merged = mergeGenerationOutputsFromWs(prev, genData);
          const gens = collectGenerationOutputMessages(merged);
          if (gens.length > 0) {
            setGeneratedImages(gens);
            setSelectedGeneration(gens[gens.length - 1]);
          }
          return merged;
        });
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
        setIsTyping(true);
        if (data.data?.text) {
          setMessages((prev) => {
            const existingIdx = prev.findIndex(
              (m) => m._id === `thought_${data.data.media_id}` && m.content?.type === 'thoughts'
            );
            const thoughtMsg = {
              _id: `thought_${data.data.media_id}`,
              author: 'ai_agent',
              content: {
                type: 'thoughts',
                thoughts: data.data.text,
              },
              media_id: data.data.media_id,
            };
            if (existingIdx >= 0) {
              const updated = [...prev];
              updated[existingIdx] = thoughtMsg;
              return updated;
            }
            return [...prev, thoughtMsg];
          });
          scrollToBottom();
        }
        break;
      }

      default:
        break;
    }
  }, [mediaId]);

  useEffect(() => {
    if (!wsClient || !isOpen || !sessionId || !mediaId) return;

    wsClient.onMessage(handleWsMessage);
    wsClient.onStatus(() => {});

    if (apiClient.getToken()) {
      wsClient.connect(apiClient.getToken());
    }

    _fetchFullMessages();

    return () => {
      wsClient.onMessage(null);
      wsClient.onStatus(null);
    };
  }, [isOpen, sessionId, mediaId, wsClient, handleWsMessage]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  function _fetchFullMessages() {
    if (!sessionId || !mediaId) return;
    apiClient.getMessages(sessionId, mediaId).then((data) => {
      const incoming = data.messages || [];
      if (incoming.length > 0) {
        setMessages(incoming);
        lastKnownMsgIdRef.current = incoming[incoming.length - 1]._id;

        const gens = collectGenerationOutputMessages(incoming);
        if (gens.length > 0) {
          setGeneratedImages(gens);
          setSelectedGeneration(gens[gens.length - 1]);

          if (!originalImageUrl) {
            for (const g of gens) {
              const oUrl = g.content?.original_url || g.content?.input_url;
              if (oUrl) { setOriginalImageUrl(oUrl); break; }
            }
          }
        }

        const hasAnalyzing = incoming.some(
          (m) => m.content?.type === 'call_tool' || m.content?.type === 'analyzing'
        );
        setIsTyping(hasAnalyzing);
        scrollToBottom();
      }
    }).catch(() => {});
  }

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
          lastKnownMsgIdRef.current = lastId;
          setMessages(incoming);

          const gens = collectGenerationOutputMessages(incoming);
          if (gens.length > 0) {
            setGeneratedImages(gens);
            setSelectedGeneration(gens[gens.length - 1]);
          }

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

  useEffect(() => {
    return () => _cancelFallback();
  }, [isOpen]);

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

        let sentViaWs = false;
        if (wsClient && wsClient.isConnected()) {
          sentViaWs = wsClient.sendChatMessage(mediaId, text);
        }

        if (sentViaWs) {
          awaitingResponseRef.current = true;
          _startFallbackTimer();
        } else {
          const response = await apiClient.sendMessage(sessionId, mediaId, text);
          if (response.message) {
            setMessages((prev) => [...prev, response.message]);
            lastKnownMsgIdRef.current = response.message._id;
            scrollToBottom();
          }
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

  if (!isOpen) return null;

  const beforeImageUrl = originalImageUrl || mediaImageUrl;
  const displayImage = selectedGeneration?.content?.preview_url || mediaImageUrl;

  return (
    h('div', { class: 'reih-overlay' },
      h('div', { class: 'reih-overlay-backdrop', onClick: onClose }),
      h('div', { class: 'reih-overlay-container' },
        // Header
        h('div', { class: 'reih-overlay-header' },
          h('div', { class: 'reih-overlay-brand' },
            config.logoUrl
              ? h('img', { src: config.logoUrl, alt: config.title, class: 'reih-overlay-logo' })
              : h('div', { class: 'reih-overlay-logo-default' },
                  h('svg', { viewBox: '0 0 24 24', width: 20, height: 20, fill: '#fff' },
                    h('path', { d: 'M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3z' })
                  )
                ),
            h('span', { class: 'reih-overlay-title' }, config.title || 'REimagineHome'),
          ),
          h('button', {
            class: 'reih-overlay-close',
            onClick: onClose,
            'aria-label': 'Close overlay',
          },
            h('svg', { viewBox: '0 0 24 24', width: 24, height: 24 },
              h('path', {
                d: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
                fill: 'currentColor',
              })
            )
          )
        ),

        // Body — split layout
        h('div', { class: 'reih-overlay-body' },
          // Left: Image preview
          h('div', { class: 'reih-overlay-preview' },
            mediaLoading && !displayImage
              ? h('div', { class: 'reih-v2-generating' },
                  h('div', { class: 'reih-spinner' }),
                  h('p', null, 'Loading image...')
                )
              : selectedGeneration?.content?.preview_url && beforeImageUrl
              ? h(CompareSlider, {
                  beforeSrc: beforeImageUrl,
                  afterSrc: selectedGeneration.content.preview_url,
                  beforeLabel: 'Original',
                  afterLabel: 'Reimagined',
                })
              : displayImage
              ? h('img', {
                  src: displayImage,
                  alt: 'Property / Generated preview',
                  class: 'reih-overlay-preview-img',
                })
              : h('div', { class: 'reih-overlay-preview-placeholder' },
                  h('svg', { viewBox: '0 0 24 24', width: 48, height: 48, fill: '#ccc' },
                    h('path', { d: 'M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z' })
                  ),
                  h('p', null, 'Your restyled image will appear here')
                ),
            generatedImages.length > 1 &&
              h('div', { class: 'reih-overlay-thumbnails' },
                generatedImages.map((gen) =>
                  h('button', {
                    key: gen._id,
                    class: `reih-overlay-thumb${selectedGeneration?._id === gen._id ? ' reih-overlay-thumb--active' : ''}`,
                    onClick: () => setSelectedGeneration(gen),
                  },
                    h('img', { src: gen.content.preview_url, alt: gen.content.action_name || 'Generated' })
                  )
                )
              )
          ),

          // Right: Chat
          h('div', { class: 'reih-overlay-chat' },
            h('div', { class: 'reih-overlay-chat-messages' },
              messages.length === 0 && !isTyping
                ? h('div', { class: 'reih-overlay-welcome' },
                    h('div', { class: 'reih-overlay-welcome-icon' },
                      h('svg', { viewBox: '0 0 24 24', width: 32, height: 32, fill: 'currentColor' },
                        h('path', { d: 'M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3z' })
                      )
                    ),
                    h('h3', null, config.welcomeTitle || 'Restyle This Space'),
                    h('p', null, config.welcomeDescription || 'Describe how you\'d like to reimagine this room. Try "Make it modern minimalist" or "Add warm Scandinavian touches".'),
                  )
                : h('div', { class: 'reih-overlay-chat-list' },
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
            ),
            error &&
              h('div', { class: 'reih-msg reih-msg--error', style: 'margin:0 16px 8px' }, error),
            h(ChatInput, {
              onSend: handleSend,
              disabled: !sessionId,
              placeholder: config.placeholder || 'Describe your ideal room style...',
            }),
          )
        )
      )
    )
  );
}
