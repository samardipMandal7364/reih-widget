import { h } from 'preact';

export function GeneratingCard({ imageUrl, title = 'Generating...' }) {
  return (
    h('div', { class: 'reih-generating-card' },
      imageUrl &&
        h('div', { class: 'reih-generating-card__image-wrap' },
          h('img', {
            class: 'reih-generating-card__image',
            src: imageUrl,
            alt: '',
            loading: 'lazy',
          }),
          h('div', { class: 'reih-generating-card__backdrop', 'aria-hidden': 'true' })
        ),
      h('div', { class: 'reih-generating-card__loader' },
        h('div', { class: 'reih-spinner reih-spinner--sm' }),
        h('span', { class: 'reih-generating-card__title' }, title)
      )
    )
  );
}
