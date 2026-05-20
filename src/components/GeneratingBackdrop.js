import { h } from 'preact';

export function GeneratingBackdrop({ imageUrl, title = 'Generating…' }) {
  return (
    h('div', { class: 'reih-v3-gen-backdrop' },
      imageUrl &&
        h('img', {
          class: 'reih-v3-gen-backdrop__image',
          src: imageUrl,
          alt: '',
          loading: 'lazy',
        }),
      h('div', { class: 'reih-v3-gen-backdrop__overlay', 'aria-hidden': 'true' }),
      h('div', { class: 'reih-v3-gen-backdrop__loader' },
        h('div', { class: 'reih-v3-dashed-loader', 'aria-hidden': 'true' }),
        h('span', { class: 'reih-v3-gen-backdrop__title' }, title)
      )
    )
  );
}
