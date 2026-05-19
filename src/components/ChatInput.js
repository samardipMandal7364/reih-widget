import { h } from 'preact';
import { useRef, useCallback } from 'preact/hooks';

export function ChatInput({ onSend, disabled, placeholder }) {
  const textareaRef = useRef(null);

  const handleSend = useCallback(() => {
    const val = textareaRef.current?.value?.trim();
    if (!val || disabled) return;
    onSend(val);
    textareaRef.current.value = '';
    textareaRef.current.style.height = 'auto';
  }, [onSend, disabled]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleInput = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 100) + 'px';
  }, []);

  return (
    h('div', { class: 'reih-input-area' },
      h('div', { class: 'reih-input-wrapper' },
        h('textarea', {
          ref: textareaRef,
          class: 'reih-input',
          placeholder: placeholder || 'Type a message...',
          rows: 1,
          disabled: disabled,
          onKeyDown: handleKeyDown,
          onInput: handleInput,
        })
      ),
      h('button', {
        class: 'reih-send-btn',
        onClick: handleSend,
        disabled: disabled,
        'aria-label': 'Send message',
      },
        h('svg', { viewBox: '0 0 24 24' },
          h('path', { d: 'M2.01 21L23 12 2.01 3 2 10l15 2-15 2z' })
        )
      )
    )
  );
}
