import { h } from 'preact';
import { GeneratingCard } from './GeneratingCard';
import { CompareSlider } from './CompareSlider';
import {
  parseMarkdown,
  sanitizeHtml,
  stripQuickOptionSections,
  getQuickOptionsForMessage,
} from '../utils/helpers';

export function MessageBubble({ message, onSmartReply, previewImageUrl }) {
  const { author, comment, content, echo } = message;

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
      return h('div', { class: 'reih-msg reih-msg--error' }, comment || 'An error occurred');
    }
    return h('div', { class: 'reih-msg reih-msg--system' }, comment);
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

  const className = isUser
    ? 'reih-msg reih-msg--user'
    : isBot
      ? 'reih-msg reih-msg--bot'
      : 'reih-msg reih-msg--system';

  const html = displayText ? parseMarkdown(sanitizeHtml(displayText)) : '';

  return (
    h('div', { class: `reih-msg-block${isUser ? ' reih-msg-block--user' : ''}` },
      html &&
        h('div', { class: className, dangerouslySetInnerHTML: { __html: html } }),
      quickOptions.length > 0 &&
        h('div', { class: 'reih-msg-quick-options' },
          h('span', { class: 'reih-quick-options-label' }, 'Quick options'),
          h('div', { class: 'reih-quick-options-pills' },
            quickOptions.map((reply, i) =>
              h('button', {
                key: i,
                type: 'button',
                class: 'reih-smart-reply',
                onClick: () => onSmartReply && onSmartReply(reply),
              }, reply)
            )
          )
        )
    )
  );
}
