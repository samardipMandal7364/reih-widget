import { h } from 'preact';

export function ChatHeader({ title, subtitle, logoUrl, onClose, primaryColor }) {
  return (
    h('div', { class: 'reih-header', style: primaryColor ? `background:${primaryColor}` : '' },
      logoUrl
        ? h('img', { class: 'reih-header-logo', src: logoUrl, alt: title || 'Chat' })
        : h('div', { class: 'reih-header-logo', style: `display:flex;align-items:center;justify-content:center` },
            h('svg', { viewBox: '0 0 24 24', width: 20, height: 20, fill: '#fff' },
              h('path', { d: 'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z' })
            )
          ),
      h('div', { class: 'reih-header-info' },
        h('div', { class: 'reih-header-title' }, title || 'Chat with us'),
        subtitle && h('div', { class: 'reih-header-subtitle' }, subtitle)
      ),
      h('button', { class: 'reih-header-close', onClick: onClose, 'aria-label': 'Close chat' },
        h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' },
          h('line', { x1: 6, y1: 6, x2: 18, y2: 18 }),
          h('line', { x1: 6, y1: 18, x2: 18, y2: 6 })
        )
      )
    )
  );
}
