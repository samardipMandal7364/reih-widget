import { h } from 'preact';

export function TypingIndicator() {
  return (
    h('div', { class: 'reih-typing' },
      h('span', { class: 'reih-typing-dot' }),
      h('span', { class: 'reih-typing-dot' }),
      h('span', { class: 'reih-typing-dot' })
    )
  );
}
