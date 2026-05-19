import { h } from 'preact';

export function WelcomeScreen({ title, description, primaryColor }) {
  return (
    h('div', { class: 'reih-welcome' },
      h('div', { class: 'reih-welcome-icon', style: primaryColor ? `background:${primaryColor}` : '' },
        h('svg', { viewBox: '0 0 24 24' },
          h('path', { d: 'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z' })
        )
      ),
      h('h3', null, title || 'Welcome!'),
      h('p', null, description || 'Upload an image and chat with our AI design assistant to reimagine your space.')
    )
  );
}
