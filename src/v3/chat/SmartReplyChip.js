/** Ported from MediaChatModal/ChatType/helpers/SmartReplyChip */
import { h } from 'preact';

export function SmartReplyChip({ reply, isSelected, isLastIndex, onClick }) {
  return (
    h('button', {
      type: 'button',
      class: `mcm-smart-chip${isSelected ? ' mcm-smart-chip--selected' : ''}${!isLastIndex ? ' mcm-smart-chip--past' : ''}`,
      onClick: (e) => {
        e.preventDefault();
        if (isLastIndex) onClick?.();
      },
    }, reply)
  );
}
