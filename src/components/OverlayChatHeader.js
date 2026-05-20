import { h } from 'preact';

export function OverlayChatHeader({ title, onClose }) {
  return (
    h('div', { class: 'reih-v3-chat-header' },
      h('div', { class: 'reih-v3-chat-header__title' },
        h('span', { class: 'reih-v3-chat-header__label' }, title || 'Design Companion')
      ),
      h('button', {
        type: 'button',
        class: 'reih-v3-chat-header__close',
        onClick: onClose,
        'aria-label': 'Close',
      },
        h('svg', { viewBox: '0 0 24 24', width: 18, height: 18, 'aria-hidden': 'true' },
          h('path', {
            d: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
            fill: 'currentColor',
          })
        )
      )
    )
  );
}
