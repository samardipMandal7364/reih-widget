/**
 * V3 restyle UI — structure and components ported from MediaChatModal/
 * (DesignPanelLeft + DesignPanelRight + ChatType message renderers).
 */
import { h } from 'preact';
import { useState, useEffect, useRef, useCallback, useMemo } from 'preact/hooks';
import { DesignPanelLeft } from '../v3/panels/DesignPanelLeft';
import { DesignPanelRight } from '../v3/panels/DesignPanelRight';
import {
  isVisibleChatMessage,
  mergeGenerationOutputsFromWs,
  collectGenerationOutputMessages,
  hasActiveGeneratingCard,
  isActiveCallToolMessage,
} from '../utils/helpers';
import { buildMediaDetail } from '../v3/utils';

const RESPONSE_DELAY_THRESHOLD = 10000;
const MAX_FALLBACK_POLLS = 8;
const FALLBACK_POLL_INTERVAL = 10000;

function getThoughtsFromMessages(messages) {
  const thought = [...messages]
    .reverse()
    .find((m) => m.content?.type === 'thoughts' && m.content?.thoughts);
  return thought?.content?.thoughts || '';
}

function filterChatList(messages) {
  let lastActiveCallIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (
      messages[i]?.content?.type === 'call_tool' &&
      isActiveCallToolMessage(messages[i], messages)
    ) {
      lastActiveCallIdx = i;
      break;
    }
  }
  return messages.filter((m, idx) => {
    if (m.content?.type === 'thoughts') {
      if (!m.content?.thoughts?.trim()) return false;
      if (lastActiveCallIdx >= 0 && idx > lastActiveCallIdx) {
        return false;
      }
      return true;
    }
    return isVisibleChatMessage(m, messages);
  });
}

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
  const [userInputText, setUserInputText] = useState('');
  const [selectedGenerationOutputId, setSelectedGenerationOutputId] = useState(null);
  const [originalImageUrl, setOriginalImageUrl] = useState('');
  const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesEndRef = useRef(null);
  const scrollAreaRef = useRef(null);
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

  const handleScroll = useCallback(() => {
    const el = scrollAreaRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollButton(distanceFromBottom > 50);
  }, []);

  const syncGenerationsFromMessages = useCallback((incoming) => {
    const gens = collectGenerationOutputMessages(incoming);
    if (gens.length > 0) {
      const last = gens[gens.length - 1];
      const outId = last.content?.generation_output_id || last._id;
      setSelectedGenerationOutputId(outId);
      if (!originalImageUrl) {
        for (const g of gens) {
          const oUrl = g.content?.original_url || g.content?.input_url;
          if (oUrl) { setOriginalImageUrl(oUrl); break; }
        }
      }
    }
  }, [originalImageUrl]);

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
          // Keep placeholder analyzing until real ai_agent content arrives (not notifications).
          const base =
            msg.author === 'ai_agent' ? prev.filter((m) => !m._synthetic) : prev;
          return [...base, msg];
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
              const base = prev.filter((m) => !m._synthetic);
              const existingIdx = base.findIndex(
                (m) => m._id === thoughtMsg._id && m.content?.type === 'thoughts'
              );
              if (existingIdx >= 0) {
                const updated = [...base];
                updated[existingIdx] = thoughtMsg;
                return updated;
              }
              return [...base, thoughtMsg];
            });
          }
          const tool = msg.content?.tool || '';
          const isImageGeneration = tool === 'edit_image' || tool === 'create_shopping_list';
          if (isImageGeneration) {
            setSelectedGenerationOutputId('generating');
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
          const merged = mergeGenerationOutputsFromWs(
            prev.filter((m) => !m._synthetic),
            genData
          );
          syncGenerationsFromMessages(merged);
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
          ...prev.filter((m) => !m._synthetic),
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
            const base = prev.filter((m) => !m._synthetic);
            const existingIdx = base.findIndex(
              (m) => m._id === `thought_${data.data.media_id}` && m.content?.type === 'thoughts'
            );
            const thoughtMsg = {
              _id: `thought_${data.data.media_id}`,
              author: 'ai_agent',
              content: { type: 'thoughts', thoughts: data.data.text },
              media_id: data.data.media_id,
            };
            if (existingIdx >= 0) {
              const updated = [...base];
              updated[existingIdx] = thoughtMsg;
              return updated;
            }
            return [...base, thoughtMsg];
          });
          scrollToBottom();
        }
        break;
      }

      default:
        break;
    }
  }, [mediaId, scrollToBottom, syncGenerationsFromMessages]);

  useEffect(() => {
    if (!wsClient || !isOpen || !sessionId || !mediaId) return;

    wsClient.onMessage(handleWsMessage);
    wsClient.onStatus(() => {});
    wsClient.setTokenProvider(() => apiClient.getToken());

    if (apiClient.getToken()) {
      wsClient.connect(apiClient.getToken());
    }

    _fetchFullMessages();

    return () => {
      wsClient.onMessage(null);
      wsClient.onStatus(null);
      wsClient.setTokenProvider(null);
    };
  }, [isOpen, sessionId, mediaId, wsClient, handleWsMessage]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  useEffect(() => {
    const host = document.getElementById('reih-widget-host');
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      if (host) {
        host.style.cssText =
          'position:fixed;inset:0;width:100%;height:100%;z-index:2147483647;pointer-events:auto;overflow:visible;';
      }
    } else {
      document.body.style.overflow = '';
      if (host) {
        host.style.cssText =
          'all:initial;position:fixed;top:0;left:0;width:0;height:0;overflow:visible;z-index:2147483646;pointer-events:none;';
      }
    }
    return () => {
      document.body.style.overflow = '';
      const h = document.getElementById('reih-widget-host');
      if (h) {
        h.style.cssText =
          'all:initial;position:fixed;top:0;left:0;width:0;height:0;overflow:visible;z-index:2147483646;pointer-events:none;';
      }
    };
  }, [isOpen]);

  function _fetchFullMessages() {
    if (!sessionId || !mediaId) return;
    apiClient.getMessages(sessionId, mediaId).then((data) => {
      const incoming = data.messages || [];
      if (incoming.length > 0) {
        setMessages(incoming);
        lastKnownMsgIdRef.current = incoming[incoming.length - 1]._id;
        syncGenerationsFromMessages(incoming);
        const hasAnalyzing = incoming.some(
          (m) => m.content?.type === 'call_tool' || m.content?.type === 'analyzing'
        );
        setIsTyping(hasAnalyzing);
        if (hasAnalyzing) {
          const lastTool = [...incoming].reverse().find(
            (m) => m.content?.type === 'call_tool'
          );
          if (lastTool?.content?.tool === 'edit_image' || lastTool?.content?.tool === 'create_shopping_list') {
            setSelectedGenerationOutputId('generating');
          }
        }
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
          syncGenerationsFromMessages(incoming);
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
        if (fallbackCountRef.current >= MAX_FALLBACK_POLLS) _cancelFallback();
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

  useEffect(() => () => _cancelFallback(), [isOpen]);

  const sendMessage = useCallback(async (textRaw) => {
    const text = (textRaw ?? userInputText).trim();
    if (!text || !sessionId) return;

    const userMsg = {
      _id: `local_${Date.now()}`,
      author: 'user',
      comment: text,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [
      ...prev,
      userMsg,
      {
        _id: `analyzing_${Date.now()}`,
        author: 'analyzing',
        comment: '',
        _synthetic: true,
      },
    ]);
    if (textRaw == null) setUserInputText('');
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
          setMessages((prev) => {
            const base =
              response.message.author === 'ai_agent'
                ? prev.filter((m) => !m._synthetic)
                : prev;
            return [...base, response.message];
          });
          lastKnownMsgIdRef.current = response.message._id;
        }
        awaitingResponseRef.current = true;
        _startFallbackTimer();
        if (response.media_id && response.media_id !== mediaId) {
          onSessionReady?.(sessionId, response.media_id);
        }
      }
    } catch (err) {
      setIsTyping(false);
      setError(err.message || 'Failed to send message.');
      setMessages((prev) => [
        ...prev.filter((m) => !m._synthetic),
        {
          _id: `err_${Date.now()}`,
          author: 'notification',
          content: { type: 'error' },
          comment: err.message,
        },
      ]);
    }
  }, [userInputText, sessionId, mediaId, apiClient, wsClient, onSessionReady, scrollToBottom]);

  const handleSubmit = useCallback(() => sendMessage(), [sendMessage]);

  const handleSmartReplySelect = useCallback((_key, reply) => {
    sendMessage(reply);
  }, [sendMessage]);

  const handleGenerationClick = useCallback((outputId) => {
    setSelectedGenerationOutputId(outputId);
  }, []);

  const lastCallTool = [...messages].reverse().find(
    (m) => m.content?.type === 'call_tool'
  );
  const isLastMessageAnalyzing = isTyping && !!lastCallTool;
  const isLastMessageGenerating = isLastMessageAnalyzing && (
    lastCallTool?.content?.tool === 'edit_image' ||
    lastCallTool?.content?.tool === 'create_shopping_list'
  );
  const thoughtsText = useMemo(() => getThoughtsFromMessages(messages), [messages]);

  const previewUrl = originalImageUrl || mediaImageUrl;

  const mediaDetail = useMemo(() => buildMediaDetail({
    mediaId,
    mediaImageUrl: previewUrl,
    messages,
    selectedGenerationOutputId,
    isGenerating: isLastMessageGenerating,
  }), [mediaId, previewUrl, messages, selectedGenerationOutputId, isLastMessageGenerating]);

  if (!isOpen) return null;

  const chatList = filterChatList(messages);

  return (
    h('div', { class: 'mcm-overlay' },
      h('div', { class: 'mcm-overlay__backdrop', onClick: onClose }),
      h('div', { class: 'mcm-modal-container' },
        h(DesignPanelLeft, {
          mediaDetail,
          messages: chatList,
          thoughtsText,
          userName: config.userName,
          isInitialLoading: mediaLoading && !previewUrl,
          isLastMessageAnalyzing,
          isLastMessageGenerating,
          userInputText,
          onInputChange: setUserInputText,
          onSubmit: handleSubmit,
          isSubmitDisabled: !sessionId || !userInputText.trim(),
          onGoBack: onClose,
          onSmartReplySelect: handleSmartReplySelect,
          onGenerationClick: handleGenerationClick,
          selectedGenerationOutputId,
          showScrollButton,
          onScrollToBottom: scrollToBottom,
          onScrollAreaScroll: handleScroll,
          scrollAreaRef,
          previewImageUrl: previewUrl,
          isFreeTrial: config.isFreeTrial,
          creditsLeft: config.creditsLeft,
          initialCredits: config.initialCredits,
        }),
        h(DesignPanelRight, {
          mediaDetail,
          isLastMessageGenerating,
          thoughtsText,
          mediaId,
          onSelectGenerationId: setSelectedGenerationOutputId,
        }),
        h('div', { ref: messagesEndRef, style: 'height:0;width:0;overflow:hidden' })
      ),
      error && h('div', { class: 'mcm-inline-error', style: 'position:absolute;bottom:24px;left:50%;transform:translateX(-50%)' }, error)
    )
  );
}
