import { h } from 'preact';

export function GreetingsPanel({ userName }) {
  const greeting = userName ? `Hello, ${userName}!` : 'Hello!';

  return (
    h('div', { class: 'reih-v3-greetings' },
      h('h2', { class: 'reih-v3-greetings__title' }, greeting),
      h('p', { class: 'reih-v3-greetings__subtitle' },
        "I'm your Design Companion.",
        h('br'),
        'Tell me what you want to change or ask for ideas for this space.'
      )
    )
  );
}
