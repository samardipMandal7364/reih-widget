/**
 * Ported from MediaChatModal/DesignPanelLeft/index.js
 * UX: auto-scroll, 50px threshold, negative margin, 500 char limit, auto-resize.
 */
import { h } from 'preact';
import { useRef, useCallback, useEffect } from 'preact/hooks';
import { ChatHeader } from './ChatHeader';
import { GreetingsUI } from './GreetingsUI';
import { ChatMessageContent } from './ChatMessageContent';
import { ThinkingStreamingType } from '../chat/ThinkingStreamingType';
import { GeneratingProcessingBackdrop } from '../GeneratingProcessingBackdrop';
import { InputControls } from './InputControls';

const MAX_CHARACTERS = 500;

export function DesignPanelLeft({
  mediaDetail,
  messages,
  thoughtsText = '',
  userName,
  isInitialLoading,
  isLastMessageAnalyzing,
  isLastMessageGenerating,
  userInputText,
  onInputChange,
  onSubmit,
  isSubmitDisabled,
  onGoBack,
  onSmartReplySelect,
  onGenerationClick,
  selectedGenerationOutputId,
  showScrollButton,
  onScrollToBottom,
  onScrollAreaScroll,
  scrollAreaHeight,
  previewImageUrl,
  scrollAreaRef,
  isFreeTrial,
  creditsLeft,
  initialCredits,
}) {
  const inputRef = useRef(null);

  const aiResponseList = messages;
  const displayText = userInputText;

  useEffect(() => {
    setTimeout(() => {
      if (scrollAreaRef?.current) {
        scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
      }
    }, 550);
  }, [aiResponseList]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 100) + 'px';
  }, [displayText]);

  const handleInputChange = useCallback((e) => {
    const val = e.target.value;
    if (val.length <= MAX_CHARACTERS) {
      onInputChange(val);
    }
  }, [onInputChange]);

  const imageSelectorButton = h('div', { class: 'mcm-image-selector' },
    h('div', { class: 'mcm-image-selector__thumb' },
      previewImageUrl
        ? h('img', { src: previewImageUrl, alt: 'Selected', loading: 'lazy' })
        : h('span', { class: 'mcm-image-selector__placeholder' },
            h('svg', { viewBox: '0 0 24 24', width: 20, height: 20 },
              h('path', {
                d: 'M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z',
                fill: '#666',
              })
            )
          )
    ),
    h('span', { class: 'mcm-image-selector__pill' },
      h('svg', { viewBox: '0 0 24 24', width: 16, height: 16 },
        h('path', { d: 'M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z', fill: '#6b7280' })
      )
    )
  );

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (!isSubmitDisabled) {
        e.preventDefault();
        onSubmit();
      }
    }
  }, [isSubmitDisabled, onSubmit]);

  const getResponseItemStyle = (res, index, list) => {
    const nextMsg = list[index + 1];
    if (nextMsg && res?.author === nextMsg?.author) {
      return 'margin-bottom:-5px';
    }
    return undefined;
  };

  return h('div', { class: 'mcm-panel-left' },
    h('div', { class: 'mcm-panel-left__inner' },
      h(ChatHeader, {
        onGoBack,
        isFreeTrial,
        creditsLeft,
        initialCredits,
      }),

      h('div', {
        ref: scrollAreaRef,
        class: 'mcm-scroll-area',
        style: scrollAreaHeight ? `height:${scrollAreaHeight}` : undefined,
        onScroll: onScrollAreaScroll,
      },
        isInitialLoading
          ? h('div', { class: 'mcm-skeleton' }, 'Loading messages…')
          : aiResponseList.length === 0
          ? h(GreetingsUI, { userName })
          : aiResponseList.map((res, index) => {
              const key = typeof res?._id === 'object'
                ? res?._id?.$oid
                : res?._id || `msg-${index}`;
              if (res.content?.type === 'call_tool') {
                const embeddedThoughts =
                  (thoughtsText && thoughtsText.trim()) ||
                  (res.content?.process_thoughts && String(res.content.process_thoughts).trim()) ||
                  '';
                return h('div', {
                  key,
                  class: 'mcm-response-item mcm-response-item--ai_agent mcm-call-tool-stack',
                  style: getResponseItemStyle(res, index, aiResponseList),
                },
                  h(ThinkingStreamingType, {
                    content: {
                      type: 'thoughts',
                      thoughts: embeddedThoughts,
                      streaming: false,
                    },
                    isLastMessageGenerating: isLastMessageAnalyzing,
                  }),
                  h('div', { class: 'mcm-gen-output-chat mcm-gen-output-chat--under-thoughts' },
                    h('div', { class: 'mcm-gen-output-chat__cards' },
                      h(GeneratingProcessingBackdrop, {
                        imageUrl: previewImageUrl,
                        title: '',
                      })
                    )
                  )
                );
              }
              return h('div', {
                key,
                class: `mcm-response-item mcm-response-item--${res.author}`,
                style: getResponseItemStyle(res, index, aiResponseList),
              },
                h(ChatMessageContent, {
                  res,
                  index,
                  aiResponseList: messages,
                  mediaDetail,
                  previewImageUrl,
                  isLastMessageAnalyzing,
                  isLastMessageGenerating,
                  onSmartReplySelect,
                  onGenerationClick,
                  selectedGenerationOutputId,
                })
              );
            })
      ),

      h('div', { class: 'mcm-sticky-footer' },
        showScrollButton
          ? h('div', {
              class: 'mcm-scroll-btn-wrapper',
              onClick: onScrollToBottom,
            },
              h('div', { class: 'mcm-scroll-latest' },
                h('svg', { viewBox: '0 0 24 24', width: 16, height: 16 },
                  h('path', { d: 'M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z', fill: 'currentColor' })
                ),
                h('span', null, 'Scroll to latest')
              )
            )
          : h('div', { class: 'mcm-credit-pill-wrapper' },
              h('div', { class: 'mcm-credit-pill' },
                '1 credit used per image generation or shoppable bundle creation.'
              )
            ),

        h('div', { class: 'mcm-input-area-wrap' },
          h('div', { class: 'mcm-input-box-wrap' },
            h('div', { class: 'mcm-input-container' },
              h('textarea', {
                ref: inputRef,
                class: 'mcm-input-field',
                rows: 1,
                disabled: isInitialLoading,
                placeholder: 'Tell us what to change…',
                maxLength: MAX_CHARACTERS,
                value: displayText,
                onInput: handleInputChange,
                onKeyDown: handleKeyDown,
              })
            ),
            h(InputControls, {
              displayText,
              maxCharacters: MAX_CHARACTERS,
              isSubmitDisabled: isSubmitDisabled || isInitialLoading,
              handleSubmit: onSubmit,
              imageSelectorButton,
            })
          )
        ),
        h('p', { class: 'mcm-disclaimer' },
          'Design companion can make mistakes. Double check for accuracy.'
        )
      )
    )
  );
}
