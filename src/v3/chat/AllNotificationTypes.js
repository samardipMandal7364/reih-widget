/** Ported from MediaChatModal/ChatType/AllNotificationTypes */
import { h } from 'preact';

export function AllNotificationTypes({ comment }) {
  return (
    h('div', { class: 'mcm-notification-wrap' },
      h('div', { class: 'mcm-notification-content' },
        h('div', { class: 'mcm-notification-line mcm-notification-line--left' }),
        h('div', { class: 'mcm-notification-text' }, comment),
        h('div', { class: 'mcm-notification-line mcm-notification-line--right' })
      )
    )
  );
}
