import { h } from 'preact';

export function TypingDots({ comment = '', isUserMessage = false }) {
  return (
    h('span', { class: 'mcm-typing-dots' },
      comment,
      ' ',
      [0, 1, 2].map((i) =>
        h('span', {
          key: i,
          class: `mcm-typing-dot${isUserMessage ? ' mcm-typing-dot--user' : ''}`,
          style: `animation-delay:${i * 0.2}s`,
        })
      )
    )
  );
}
