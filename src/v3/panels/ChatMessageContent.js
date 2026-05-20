/** Ported from MediaChatModal/DesignPanelLeft/ChatMessageContent */
import { h } from 'preact';
import { AllNotificationTypes } from '../chat/AllNotificationTypes';
import { AllTypes } from '../chat/AllTypes';
import { AnalyzingType } from '../chat/AnalyzingType';
import { GeminiTextType } from '../chat/GeminiTextType';
import { GenerationOutputTypes } from '../chat/GenerationOutputTypes';
import { ThinkingStreamingType } from '../chat/ThinkingStreamingType';
import { getLastGeneratedPreviewDisplayUrl } from '../utils';

export function ChatMessageContent({
  res,
  index,
  aiResponseList,
  mediaDetail,
  previewImageUrl,
  isLastMessageAnalyzing,
  isLastMessageGenerating,
  onSmartReplySelect,
  onGenerationClick,
  selectedGenerationOutputId,
}) {
  const { author, content, comment, _id } = res;
  const lastNonNotificationIndex = aiResponseList?.findLastIndex?.(
    (item) => item.author !== 'notification'
  ) ?? aiResponseList.length - 1;
  const isLastIndex = index === lastNonNotificationIndex;
  const smartReplyKey = `smart-reply-${_id || index}`;

  const previewUrl = previewImageUrl || getLastGeneratedPreviewDisplayUrl(mediaDetail);

  if (author === 'analyzing') {
    return h(AnalyzingType, { comment, previewImageUrl: previewUrl });
  }

  if (author === 'user') {
    if (content?.type === 'generation_output') {
      return h(GenerationOutputTypes, {
        author,
        content,
        comment,
        isLastIndex,
        onGenerationClick,
        isSelected: selectedGenerationOutputId === (content?.generation_output_id || _id),
      });
    }
    return h(AllTypes, { author, content: comment || content });
  }

  if (author === 'notification') {
    return h(AllNotificationTypes, { comment });
  }

  switch (content?.type) {
    case 'thoughts':
      if (!content?.thoughts?.trim()) return null;
      return h(ThinkingStreamingType, {
        content,
        isLastMessageGenerating,
      });
    case 'generation_output':
      return h(GenerationOutputTypes, {
        author,
        content,
        comment: "Here's what was done to this photo. You can refine further with a prompt below.",
        isLastIndex,
        onSmartReplyClick: (reply) => onSmartReplySelect?.(smartReplyKey, reply),
        onGenerationClick: () => onGenerationClick?.(content?.generation_output_id || _id),
        isSelected: selectedGenerationOutputId === (content?.generation_output_id || _id),
      });
    case 'text':
      return h(GeminiTextType, {
        content,
        isLastIndex,
        onSmartReplyClick: (reply) => onSmartReplySelect?.(smartReplyKey, reply),
      });
    default:
      return h(AllTypes, { author, content: content?.text || comment || content });
  }
}
