/** Ported from MediaChatModal/ChatType/AnalyzingType */
import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { GeneratingProcessingBackdrop } from '../GeneratingProcessingBackdrop';
import { TypingDots } from './TypingDots';

const BASE_TEXTS = ['Analyzing request...', 'Thinking...', 'Processing request...'];

export function AnalyzingType({ comment, previewImageUrl }) {
  const isUserLoading = comment === 'user_loading';
  const isGenerating =
    comment?.toLowerCase().includes('generating_output') ||
    comment?.toLowerCase().includes('generating');

  const [visibleTextIndex, setVisibleTextIndex] = useState(0);
  const textsToShow = comment ? [comment] : BASE_TEXTS;

  useEffect(() => {
    if (visibleTextIndex >= textsToShow.length - 1) return undefined;
    const interval = setInterval(() => {
      setVisibleTextIndex((prev) => (prev >= textsToShow.length - 1 ? prev : prev + 1));
    }, 5000);
    return () => clearInterval(interval);
  }, [visibleTextIndex, textsToShow.length]);

  if (isGenerating) {
    return (
      h('div', { class: 'mcm-gen-output-chat' },
        h('div', { class: 'mcm-gen-output-chat__cards' },
          h(GeneratingProcessingBackdrop, { imageUrl: previewImageUrl })
        )
      )
    );
  }

  if (isUserLoading) {
    return (
      h('div', { class: 'mcm-chat-bubble mcm-chat-bubble--user' },
        h(TypingDots, { comment: '', isUserMessage: true })
      )
    );
  }

  return (
    h('div', { class: 'mcm-analyzing' },
      h('div', { class: 'mcm-analyzing__loader', 'aria-hidden': 'true' }),
      h('div', { class: 'mcm-analyzing__text' }, textsToShow[visibleTextIndex])
    )
  );
}
