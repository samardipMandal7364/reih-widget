/** Ported from MediaChatModal/ChatType/GeminiTextType */
import { h } from 'preact';
import { parseMarkdown, sanitizeHtml, parseQuickOptionsFromText, stripQuickOptionSections } from '../../utils/helpers';
import { SmartReplyChip } from './SmartReplyChip';

export function GeminiTextType({
  content,
  onSmartReplyClick,
  selectedSmartReply,
  isLastIndex,
}) {
  const text = content?.text || '';
  const smartReplies = parseQuickOptionsFromText(text);
  const displayText = stripQuickOptionSections(text);
  const html = displayText ? parseMarkdown(sanitizeHtml(displayText)) : '';

  return (
    h('div', { class: 'mcm-gemini-text' },
      html && h('div', {
        class: 'mcm-gemini-text__body',
        dangerouslySetInnerHTML: { __html: html },
      }),
      smartReplies.length > 0 &&
        h('div', { class: 'mcm-smart-replies' },
          smartReplies.map((reply, index) =>
            h(SmartReplyChip, {
              key: `smart-reply-${index}`,
              reply,
              index,
              isSelected: selectedSmartReply === reply,
              isLastIndex,
              onClick: () => onSmartReplyClick?.(reply),
            })
          )
        )
    )
  );
}
