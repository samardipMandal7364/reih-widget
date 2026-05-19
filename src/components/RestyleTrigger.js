import { h } from 'preact';

export function RestyleTrigger({ onClick, label, primaryColor, className }) {
  return (
    h('button', {
      class: `reih-restyle-btn${className ? ` ${className}` : ''}`,
      onClick,
      style: primaryColor ? `--reih-primary:${primaryColor}` : '',
    },
      h('svg', { viewBox: '0 0 24 24', width: 18, height: 18, fill: 'currentColor', class: 'reih-restyle-btn-icon' },
        h('path', { d: 'M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3z' })
      ),
      h('span', null, label || 'Restyle with AI')
    )
  );
}
