/** Ported from MediaChatModal/ChatType/GenerationOutputTypes (chat card) */
import { h } from 'preact';
import { useState } from 'preact/hooks';
import { getThumbnail } from '../utils';
import { SmartReplyChip } from './SmartReplyChip';
import { getQuickOptionsForMessage } from '../../utils/helpers';

const DEFAULT_STATUS = "Here's what was done to this photo. You can refine further with a prompt below.";

export function GenerationOutputTypes({
  author,
  content,
  comment,
  isLastIndex,
  onSmartReplyClick,
  selectedSmartReply,
  onGenerationClick,
  isSelected,
}) {
  const [isImageHovered, setIsImageHovered] = useState(false);
  const isUser = author === 'user';
  const preview = content?.preview_url;
  if (!preview) return null;

  const smartReplies = getQuickOptionsForMessage({ content });
  const statusText = comment || (!isUser ? DEFAULT_STATUS : '');

  return (
    h('div', { class: 'mcm-gen-output-chat' },
      h('div', { class: `mcm-gen-card-wrap${isUser ? ' mcm-gen-card-wrap--user' : ''}` },
        h('div', { class: `mcm-gen-card${isUser ? ' mcm-gen-card--user' : ''}` },
          statusText && h('div', { class: 'mcm-gen-card__status' }, statusText),
          h('button', {
            type: 'button',
            class: `mcm-gen-card__preview${isSelected ? ' mcm-gen-card__preview--selected' : ''}`,
            onMouseEnter: () => setIsImageHovered(true),
            onMouseLeave: () => setIsImageHovered(false),
            onClick: () => onGenerationClick?.(content),
          },
            h('img', {
              src: getThumbnail(preview),
              alt: content?.action_name || 'Generated',
              loading: 'lazy',
            }),
            content?.action_name &&
              h('div', {
                class: `mcm-gen-card__action-overlay${isImageHovered ? ' mcm-gen-card__action-overlay--visible' : ''}`,
              }, content.action_name)
          ),
          smartReplies.length > 0 &&
            h('div', { class: 'mcm-smart-replies' },
              smartReplies.map((reply, index) =>
                h(SmartReplyChip, {
                  key: index,
                  reply,
                  index,
                  isSelected: selectedSmartReply === reply,
                  isLastIndex,
                  onClick: () => onSmartReplyClick?.(reply),
                })
              )
            )
        )
      )
    )
  );
}
