/** Ported from MediaChatModal/DesignPanelLeft/ChatHeader */
import { h } from 'preact';

const ARROW_LEFT = h('svg', { viewBox: '0 0 24 24', width: 18, height: 18, 'aria-hidden': 'true' },
  h('path', { d: 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z', fill: 'currentColor' })
);

const INFO_ICON = h('svg', { viewBox: '0 0 24 24', width: 18, height: 18, 'aria-hidden': 'true' },
  h('path', {
    d: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z',
    fill: 'currentColor',
  })
);

export function ChatHeader({ onGoBack, isFreeTrial, creditsLeft, initialCredits }) {
  const remaining = `${creditsLeft ?? 0}/${initialCredits ?? 3}`;

  return (
    h('div', { class: 'mcm-chat-header' },
      h('div', { class: 'mcm-chat-header__left' },
        h('button', {
          type: 'button',
          class: 'mcm-chat-header__back',
          onClick: onGoBack,
          'aria-label': 'Go back',
        }, ARROW_LEFT),
        h('div', { class: 'mcm-chat-header__meta' },
          h('div', { class: 'mcm-chat-header__title-row' },
            h('span', { class: 'mcm-chat-header__title' }, 'Your Design Companion'),
            h('span', { class: 'mcm-chat-header__info', title: "Design Companion tailors its suggestions based on your profession." }, INFO_ICON)
          ),
          h('div', { class: 'mcm-chat-header__status-row' },
            h('span', { class: 'mcm-chat-header__network' }, 'Online'),
            isFreeTrial &&
              h('div', { class: 'mcm-free-pill mcm-free-pill--sm' },
                h('span', { class: 'mcm-free-pill__icon' }, '✦'),
                h('span', { class: 'mcm-free-pill__text' },
                  h('strong', null, `${remaining} Free Designs`),
                  h('small', null, 'REMAINING')
                )
              )
          )
        )
      ),
      isFreeTrial &&
        h('div', { class: 'mcm-free-pill mcm-free-pill--lg' },
          h('span', { class: 'mcm-free-pill__icon' }, '✦'),
          h('span', { class: 'mcm-free-pill__text' },
            h('strong', null, `${remaining} Free Designs`),
            h('small', null, 'REMAINING')
          )
        )
    )
  );
}
