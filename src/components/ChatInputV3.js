import { h } from 'preact';
import { useRef, useCallback } from 'preact/hooks';

export function ChatInputV3({ onSend, disabled, placeholder }) {
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
    h('div', { class: 'reih-v3-input-footer' },
      h('div', { class: 'reih-v3-input-box' },
        h('div', { class: 'reih-v3-input-inner' },
          h('textarea', {
            ref: textareaRef,
            class: 'reih-v3-input',
            placeholder: placeholder || 'Tell us what to change…',
            rows: 1,
            disabled,
            onKeyDown: handleKeyDown,
            onInput: handleInput,
          }),
          h('div', { class: 'reih-v3-input-actions' },
            h('button', {
              type: 'button',
              class: 'reih-v3-send-btn',
              onClick: handleSend,
              disabled,
              'aria-label': 'Send message',
            },
              h('svg', { viewBox: '0 0 24 24', width: 18, height: 18 },
                h('path', {
                  d: 'M2.01 21L23 12 2.01 3 2 10l15 2-15 2z',
                  fill: 'currentColor',
                })
              )
            )
          )
        )
      ),
      h('p', { class: 'reih-v3-disclaimer' },
        'Design companion can make mistakes. Double check for accuracy.'
      )
    )
  );
}
