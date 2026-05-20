import { h } from 'preact';
import { GeneratingCard } from './GeneratingCard';
import { CompareSlider } from './CompareSlider';
import {
  parseMarkdown,
  sanitizeHtml,
  stripQuickOptionSections,
  getQuickOptionsForMessage,
} from '../utils/helpers';

export function MessageBubble({
  message,
  onSmartReply,
  previewImageUrl,
  variant,
  onGenerationClick,
  isSelectedGeneration,
}) {
  const { author, comment, content, echo } = message;
  const isOverlay = variant === 'overlay';

  if (author === 'user' && echo === true) {
    return null;
  }

  if (content?.type === 'call_tool') {
    return h(GeneratingCard, {
      imageUrl: previewImageUrl,
      title: content.action_name ? `Generating ${content.action_name}...` : 'Generating...',
    });
  }

  if (author === 'analyzing') {
    const isGenerating =
      comment?.toLowerCase().includes('generating_output') ||
      comment?.toLowerCase().includes('generating');
    if (isGenerating) {
      return h(GeneratingCard, { imageUrl: previewImageUrl });
    }
  }

  if (content?.type === 'generation_output' && content.preview_url) {
    if (isOverlay) {
      return (
        h('button', {
          type: 'button',
          class: `reih-v3-gen-chat-card${isSelectedGeneration ? ' reih-v3-gen-chat-card--active' : ''}`,
          onClick: () => onGenerationClick && onGenerationClick(message),
        },
          h('img', {
            src: content.preview_url,
            alt: content.action_name || 'Generated design',
            loading: 'lazy',
          }),
          content.action_name &&
            h('span', { class: 'reih-v3-gen-chat-card__label' }, content.action_name)
        )
      );
    }
    const beforeUrl = previewImageUrl || content.original_url || content.input_url || '';
    return (
      h('div', { class: 'reih-generation reih-generation--card' },
        beforeUrl
          ? h(CompareSlider, {
              beforeSrc: beforeUrl,
              afterSrc: content.preview_url,
              beforeLabel: 'Original',
              afterLabel: 'Reimagined',
            })
          : h('img', {
              src: content.preview_url,
              alt: content.action_name || 'Generated image',
              loading: 'lazy',
            }),
        content.action_name &&
          h('div', { class: 'reih-generation-label' }, content.action_name)
      )
    );
  }

  if (author === 'notification') {
    if (content?.type === 'error') {
      return h('div', { class: isOverlay ? 'reih-v3-notification reih-v3-notification--error' : 'reih-msg reih-msg--error' },
        comment || 'An error occurred'
      );
    }
    return h('div', { class: isOverlay ? 'reih-v3-notification' : 'reih-msg reih-msg--system' }, comment);
  }

  const isUser = author === 'user';
  const isBot = author === 'ai_agent';

  let text = comment || '';
  if (!text && content?.type === 'text') {
    text = content.text || '';
  }
  if (!text && typeof content === 'string') {
    text = content;
  }

  const quickOptions = isBot ? getQuickOptionsForMessage(message) : [];
  const displayText = isBot ? stripQuickOptionSections(text) : text;

  if (!displayText && quickOptions.length === 0) {
    return null;
  }

  const className = isOverlay
    ? (isUser ? 'reih-v3-bubble reih-v3-bubble--user' : 'reih-v3-bubble reih-v3-bubble--bot')
    : (isUser
      ? 'reih-msg reih-msg--user'
      : isBot
        ? 'reih-msg reih-msg--bot'
        : 'reih-msg reih-msg--system');

  const html = displayText ? parseMarkdown(sanitizeHtml(displayText)) : '';

  return (
    h('div', { class: `reih-msg-block${isUser ? ' reih-msg-block--user' : ''}` },
      html &&
        h('div', { class: className, dangerouslySetInnerHTML: { __html: html } }),
      quickOptions.length > 0 &&
        h('div', { class: isOverlay ? 'reih-v3-smart-replies' : 'reih-msg-quick-options' },
          !isOverlay &&
            h('span', { class: 'reih-quick-options-label' }, 'Quick options'),
          h('div', { class: isOverlay ? 'reih-v3-smart-replies__chips' : 'reih-quick-options-pills' },
            quickOptions.map((reply, i) =>
              h('button', {
                key: i,
                type: 'button',
                class: isOverlay ? 'reih-v3-smart-chip' : 'reih-smart-reply',
                onClick: () => onSmartReply && onSmartReply(reply),
              }, reply)
            )
          )
        )
    )
  );
}
