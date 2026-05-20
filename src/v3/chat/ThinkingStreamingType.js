/** Ported from MediaChatModal/ChatType/ThinkingStreamingType (UI + label extraction) */
import { h } from 'preact';
import { useState, useEffect, useMemo } from 'preact/hooks';
import { parseMarkdown, sanitizeHtml } from '../../utils/helpers';
import { extractAllThinkingLabels } from '../utils';
import { TypingDots } from './TypingDots';

const BULB_SVG = h('svg', { viewBox: '0 0 24 24', width: 15, height: 15, 'aria-hidden': 'true' },
  h('path', {
    d: 'M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z',
    fill: 'currentColor',
  })
);

function getCurrentThinkingLabel(text) {
  const labels = extractAllThinkingLabels(text);
  return labels.length > 0 ? labels[labels.length - 1] : 'Thinking...';
}

export function ThinkingStreamingType({
  content,
  isLastMessageGenerating,
}) {
  const fullText = content?.thoughts || '';
  const [isExpanded, setIsExpanded] = useState(false);
  /* Active while backend is still generating — include empty stream (typing dots) */
  const isActivelyThinking = isLastMessageGenerating;
  const isComplete = !isLastMessageGenerating && !!fullText;
  const displayedText = fullText;
  const streamingPeek = isActivelyThinking && !isExpanded && !isComplete;

  const progressChips = useMemo(
    () => extractAllThinkingLabels(displayedText),
    [displayedText]
  );

  useEffect(() => {
    if (!isActivelyThinking) setIsExpanded(false);
  }, [isActivelyThinking]);

  if (!fullText?.trim() && !isActivelyThinking) return null;

  const headerTitle = isActivelyThinking
    ? getCurrentThinkingLabel(displayedText)
    : 'Design reasoning';

  const headerSubtitle = isActivelyThinking ? '' : 'See the thinking behind this design';

  const html = displayedText
    ? parseMarkdown(sanitizeHtml(displayedText))
    : '';

  return (
    h('div', { class: 'mcm-thinking-wrap' },
      h('div', { class: 'mcm-reasoning-card' },
        h('button', {
          type: 'button',
          class: 'mcm-reasoning-toggle',
          'aria-expanded': isExpanded,
          onClick: () => setIsExpanded((v) => !v),
        },
          h('span', { class: 'mcm-reasoning-summary' },
            h('span', { class: 'mcm-thinking-icon' },
              isActivelyThinking && !isExpanded &&
                h('span', { class: 'mcm-thinking-icon__spin', 'aria-hidden': 'true' }),
              h('span', { class: 'mcm-thinking-icon__bulb' }, BULB_SVG)
            ),
            h('span', { class: 'mcm-reasoning-copy' },
              h('span', { class: 'mcm-reasoning-title' }, headerTitle),
              headerSubtitle && h('span', { class: 'mcm-reasoning-subtitle' }, headerSubtitle)
            )
          ),
          h('span', {
            class: `mcm-reasoning-chevron${isExpanded ? ' mcm-reasoning-chevron--open' : ''}`,
            'aria-hidden': 'true',
          },
            h('svg', { width: 16, height: 16, viewBox: '0 0 24 24' },
              h('path', { d: 'M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z', fill: '#555' })
            )
          )
        ),
        h('div', {
          class: `mcm-reasoning-panel${isExpanded ? ' mcm-reasoning-panel--open' : ''}${streamingPeek ? ' mcm-reasoning-panel--peek' : ''}`,
        },
          isActivelyThinking && isExpanded && progressChips.length > 0 &&
            h('div', { class: 'mcm-progress-steps' },
              progressChips.map((label, idx) =>
                h('span', {
                  key: `${idx}-${label}`,
                  class: `mcm-progress-step${idx === progressChips.length - 1 ? ' mcm-progress-step--active' : ' mcm-progress-step--done'}`,
                }, label)
              )
            ),
          html
            ? h('div', {
              class: 'mcm-thinking-text',
              dangerouslySetInnerHTML: { __html: html },
            })
            : isActivelyThinking && h(TypingDots, { comment: '' })
        )
      )
    )
  );
}
