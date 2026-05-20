import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { parseMarkdown, sanitizeHtml } from '../utils/helpers';

export function ThinkingStream({ thoughts, isStreaming }) {
  const [isOpen, setIsOpen] = useState(false);
  const text = thoughts || '';

  useEffect(() => {
    if (isStreaming) {
      setIsOpen(true);
    }
  }, [isStreaming]);

  if (!text && !isStreaming) return null;

  const html = text ? parseMarkdown(sanitizeHtml(text)) : '';
  const subtitle = isStreaming ? 'Thinking through your request…' : 'Reasoning complete';

  return (
    h('div', { class: 'reih-v3-thinking' },
      h('button', {
        type: 'button',
        class: 'reih-v3-thinking__toggle',
        onClick: () => setIsOpen((v) => !v),
        'aria-expanded': isOpen,
      },
        h('span', { class: 'reih-v3-thinking__summary' },
          h('span', { class: 'reih-v3-thinking__icon', 'aria-hidden': 'true' },
            h('span', {
              class: `reih-v3-thinking__icon-spinner${isStreaming && !isOpen ? ' reih-v3-thinking__icon-spinner--active' : ''}`,
            }),
            h('svg', { viewBox: '0 0 24 24', width: 15, height: 15 },
              h('path', {
                d: 'M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z',
                fill: 'currentColor',
              })
            )
          ),
          h('span', { class: 'reih-v3-thinking__copy' },
            h('span', { class: 'reih-v3-thinking__title' }, 'Reasoning'),
            h('span', { class: 'reih-v3-thinking__subtitle' }, subtitle)
          )
        ),
        h('span', {
          class: `reih-v3-thinking__chevron${isOpen ? ' reih-v3-thinking__chevron--open' : ''}`,
          'aria-hidden': 'true',
        },
          h('svg', { viewBox: '0 0 24 24', width: 18, height: 18 },
            h('path', { d: 'M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z', fill: 'currentColor' })
          )
        )
      ),
      h('div', {
        class: `reih-v3-thinking__panel${isOpen ? ' reih-v3-thinking__panel--open' : ''}${isStreaming && !isOpen ? ' reih-v3-thinking__panel--peek' : ''}`,
      },
        html &&
          h('div', {
            class: 'reih-v3-thinking__content',
            dangerouslySetInnerHTML: { __html: html },
          })
      )
    )
  );
}
