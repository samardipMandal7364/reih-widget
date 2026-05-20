import { h } from 'preact';

import { GeneratingBackdrop } from './GeneratingBackdrop';

export function GeneratingCard({ imageUrl, title = 'Generating...' }) {
  return (
    h('div', { class: 'reih-v3-gen-chat-card reih-v3-gen-chat-card--generating' },
      h(GeneratingBackdrop, { imageUrl, title })
    )
  );
}
