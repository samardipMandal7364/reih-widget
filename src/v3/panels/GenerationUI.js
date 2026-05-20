/** Ported from MediaChatModal/DesignPanelRight/GenerationsUI */
import { h } from 'preact';
import { GeneratingProcessingBackdrop } from '../GeneratingProcessingBackdrop';
import { getThumbnail } from '../utils';
import { mapActionName } from '../constants/actionNameMapping';

function FailedPreviewIcon() {
  return (
    h('svg', {
      width: 22,
      height: 22,
      viewBox: '0 0 24 24',
      fill: 'none',
      'aria-hidden': 'true',
    },
      h('circle', { cx: '12', cy: '12', r: '10', stroke: '#c62828', 'stroke-width': '1.5', fill: 'none' }),
      h('path', {
        d: 'M8.5 8.5l7 7M15.5 8.5l-7 7',
        stroke: '#c62828',
        'stroke-width': '1.5',
        'stroke-linecap': 'round',
      })
    )
  );
}

export function GenerationUI({
  item,
  isError,
  isProcessing,
  isSelected,
  originalImageUrl,
}) {
  const label = mapActionName(item?.action_name) || item?.action_name || '';

  return (
    h('div', { class: 'mcm-gen-img-div' },
      isProcessing
        ? h(GeneratingProcessingBackdrop, {
          imageUrl: item?.preview_url || originalImageUrl,
          title: '',
          class: 'mcm-thumb-backdrop',
        })
        : isError
        ? h('div', { class: 'mcm-thumb-error-fill', 'aria-hidden': 'true' })
        : h('img', {
          src: getThumbnail(item?.preview_url),
          alt: 'preview media',
          class: 'mcm-thumb-img',
          loading: 'lazy',
        }),

      (!isSelected || isError) && !isProcessing &&
        h('div', {
          class: `mcm-thumb-overlay${isError ? ' mcm-thumb-overlay--error-mode' : ''}`,
        },
          isError
            ? h('div', { class: 'mcm-thumb-error-status' },
                h(FailedPreviewIcon),
                h('span', { class: 'mcm-thumb-overlay-err-text' }, 'Failed to generate preview')
              )
            : h('span', { class: 'mcm-thumb-overlay-label' }, label)
        )
    )
  );
}
