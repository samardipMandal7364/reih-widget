/** Ported from home-frontend InputControls layout (MediaChatModal footer) */
import { h } from 'preact';

const SEND_ICON = h('svg', { viewBox: '0 0 24 24', width: 18, height: 18 },
  h('path', { d: 'M2.01 21L23 12 2.01 3 2 10l15 2-15 2z', fill: 'currentColor' })
);

const PLUS_ICON = h('svg', { viewBox: '0 0 24 24', width: 20, height: 20 },
  h('path', { d: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z', fill: 'currentColor' })
);

export function InputControls({
  displayText,
  maxCharacters = 500,
  isSubmitDisabled,
  handleSubmit,
  imageSelectorButton,
}) {
  const len = (displayText || '').length;

  return (
    h('div', { class: 'mcm-input-controls' },
      imageSelectorButton,
      h('span', { class: 'mcm-input-controls__count' }, `${len}/${maxCharacters}`),
      h('button', {
        type: 'button',
        class: 'mcm-input-controls__plus',
        'aria-label': 'Add reference',
        disabled: true,
      }, PLUS_ICON),
      h('button', {
        type: 'button',
        class: 'mcm-input-controls__submit',
        disabled: isSubmitDisabled,
        onClick: handleSubmit,
        'aria-label': 'Send',
      }, SEND_ICON)
    )
  );
}
