/** Ported from MediaChatModal/DesignPanelLeft/GreetingsUI */
import { h } from 'preact';

export function GreetingsUI({ userName }) {
  return (
    h('div', { class: 'mcm-greetings' },
      h('h2', { class: 'mcm-greetings__title' }, `Hello${userName ? `, ${userName}` : ''}!`),
      h('p', { class: 'mcm-greetings__subtitle' },
        "I'm your Design Companion.",
        h('br'),
        'Tell me what you want to change or ask for ideas for this space.'
      )
    )
  );
}
