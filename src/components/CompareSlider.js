import { h } from 'preact';
import { useState, useCallback } from 'preact/hooks';

export function CompareSlider({ beforeSrc, afterSrc, beforeLabel, afterLabel }) {
  const [position, setPosition] = useState(50);

  const onInput = useCallback((e) => {
    setPosition(Number(e.target.value));
  }, []);

  if (!beforeSrc) return null;

  const clipRight = 100 - position;

  return (
    h('div', { class: 'reih-compare' },
      h('img', {
        class: 'reih-compare-before',
        src: beforeSrc,
        alt: beforeLabel || 'Before',
      }),
      afterSrc &&
        h('img', {
          class: 'reih-compare-after',
          src: afterSrc,
          alt: afterLabel || 'After',
          style: `clip-path: inset(0 ${clipRight}% 0 0)`,
        }),
      afterSrc &&
        h('div', {
          class: 'reih-compare-handle',
          style: `left:${position}%`,
        }),
      h('span', { class: 'reih-compare-badge reih-compare-badge--before' }, beforeLabel || 'Before'),
      afterSrc && h('span', { class: 'reih-compare-badge reih-compare-badge--after' }, afterLabel || 'After'),
      afterSrc &&
        h('input', {
          type: 'range',
          class: 'reih-compare-range',
          min: 0,
          max: 100,
          value: position,
          onInput,
          'aria-label': 'Compare before and after',
        })
    )
  );
}
