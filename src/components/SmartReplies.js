import { h } from 'preact';

export function SmartReplies({ replies, onSelect }) {
  if (!replies || replies.length === 0) return null;

  return (
    h('div', { class: 'reih-smart-replies' },
      replies.map((reply, i) =>
        h('button', {
          key: i,
          class: 'reih-smart-reply',
          onClick: () => onSelect(reply),
        }, reply)
      )
    )
  );
}
